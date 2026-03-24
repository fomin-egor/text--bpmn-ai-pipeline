import type { ProcessDefinition } from '../process-model/types';
import { mapProcessIrToDefinition } from '../process-ir/mapProcessIrToDefinition';
import { normalizeProcessIrDraft } from '../process-ir/normalizeProcessIr';
import { parseProcessIrDraft } from '../process-ir/parseDraft';
import type { ProcessIr } from '../process-ir/types';
import { validateProcessIr } from '../process-ir/validateProcessIr';
import { sendLlmChatRequest } from './api';
import { PROCESS_GENERATION_SYSTEM_PROMPT } from './systemPrompt';
import type { ChatMessage, LlmConnectionConfig, LlmTransport } from './types';

interface ProcessDiagnosticsState {
  rawLlmJson: string;
  normalizedIr: ProcessIr | null;
  normalizationWarnings: string[];
  validationWarnings: string[];
  validationErrors: string[];
}

interface LlmWorkbenchProps {
  connection: LlmConnectionConfig;
  messages: ChatMessage[];
  input: string;
  statusText: string;
  isLoading: boolean;
  diagnostics: ProcessDiagnosticsState;
  onConnectionChange: (connection: LlmConnectionConfig) => void;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onInputChange: (input: string) => void;
  onStatusTextChange: (status: string) => void;
  onLoadingChange: (value: boolean) => void;
  onDiagnosticsChange: (diagnostics: ProcessDiagnosticsState) => void;
  onProcessGenerated: (process: ProcessDefinition, processIr: ProcessIr) => void;
}

export function LlmWorkbench({
  connection,
  messages,
  input,
  statusText,
  isLoading,
  diagnostics,
  onConnectionChange,
  onMessagesChange,
  onInputChange,
  onStatusTextChange,
  onLoadingChange,
  onDiagnosticsChange,
  onProcessGenerated,
}: LlmWorkbenchProps) {
  const handleConnectionFieldChange = <K extends keyof LlmConnectionConfig>(key: K, value: LlmConnectionConfig[K]) => {
    onConnectionChange({
      ...connection,
      [key]: value,
    });
  };

  const handleProviderChange = (provider: 'openrouter' | 'local') => {
    onConnectionChange({
      ...connection,
      provider,
      transport: 'server',
    });
  };

  const handleTransportChange = (transport: LlmTransport) => {
    onConnectionChange({
      ...connection,
      transport,
    });
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      onStatusTextChange('Введите описание процесса.');
      return;
    }

    if (!connection.apiKey.trim()) {
      onStatusTextChange('Укажите API key.');
      return;
    }

    if (!connection.model.trim()) {
      onStatusTextChange('Укажите model.');
      return;
    }

    if (connection.provider === 'local' && !connection.baseUrl?.trim()) {
      onStatusTextChange('Для локальной модели нужен baseUrl.');
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedInput,
    };

    const nextMessages = [...messages, userMessage];

    onMessagesChange(nextMessages);
    onLoadingChange(true);
    onDiagnosticsChange({
      rawLlmJson: '',
      normalizedIr: null,
      normalizationWarnings: [],
      validationWarnings: [],
      validationErrors: [],
    });
    onStatusTextChange(
      connection.provider === 'openrouter' && connection.transport === 'browser'
        ? 'Отправляю описание в OpenRouter напрямую из браузера...'
        : connection.provider === 'openrouter'
          ? 'Отправляю описание в OpenRouter через local proxy...'
          : 'Отправляю описание в локальную LLM...'
    );

    try {
      const response = await sendLlmChatRequest({
        connection,
        messages: [
          {
            role: 'system',
            content: PROCESS_GENERATION_SYSTEM_PROMPT,
          },
          ...nextMessages,
        ],
      });

      const assistantMessage = response.message;
      onMessagesChange([...nextMessages, assistantMessage]);

      const parsedDraft = parseProcessIrDraft(assistantMessage.content);

      if (!parsedDraft.success) {
        onDiagnosticsChange({
          rawLlmJson: parsedDraft.rawJson,
          normalizedIr: null,
          normalizationWarnings: [],
          validationWarnings: [],
          validationErrors: parsedDraft.errors,
        });
        onStatusTextChange('LLM ответила, но draft Process IR не является валидным JSON.');
        return;
      }

      const normalized = normalizeProcessIrDraft(parsedDraft.value);
      const validated = validateProcessIr(normalized.value);

      onDiagnosticsChange({
        rawLlmJson: parsedDraft.rawJson,
        normalizedIr: normalized.value,
        normalizationWarnings: normalized.warnings,
        validationWarnings: validated.warnings,
        validationErrors: validated.errors,
      });

      if (!validated.ok || !validated.value) {
        onStatusTextChange('Draft Process IR нормализован, но не прошёл валидацию.');
        return;
      }

      const processDefinition = mapProcessIrToDefinition(validated.value);
      onProcessGenerated(processDefinition, validated.value);

      const warningCount = normalized.warnings.length + validated.warnings.length;
      onStatusTextChange(
        warningCount > 0
          ? `Процесс "${processDefinition.title}" построен с ${warningCount} предупреждениями.`
          : `Процесс "${processDefinition.title}" построен.`
      );
    } catch (error) {
      onStatusTextChange(error instanceof Error ? error.message : 'Ошибка запроса к LLM');
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <div className="llm-workbench">
      <div className="tool-pane__header">
        <div>
          <p className="eyebrow">LLM Client</p>
          <h2>Chat</h2>
        </div>
        <p className="supporting-text">Пайплайн второй итерации: chat -&gt; Process IR draft -&gt; normalize -&gt; validate -&gt; preview mapper.</p>
      </div>

      <details className="settings-box">
        <summary>Connection settings</summary>
        <div className="llm-config-grid">
          <label className="field-block">
            <span>Provider</span>
            <select value={connection.provider} onChange={(event) => handleProviderChange(event.target.value as 'openrouter' | 'local')}>
              <option value="openrouter">OpenRouter</option>
              <option value="local">Local</option>
            </select>
          </label>

          {connection.provider === 'openrouter' && (
            <label className="field-block">
              <span>Transport</span>
              <select value={connection.transport} onChange={(event) => handleTransportChange(event.target.value as LlmTransport)}>
                <option value="server">Local proxy (Recommended)</option>
                <option value="browser">Browser direct (Experimental)</option>
              </select>
            </label>
          )}

          {connection.provider === 'openrouter' && connection.transport === 'browser' && (
            <p className="inline-note inline-note--warning">
              Experimental mode. Может не работать в отдельных браузерах, VPN-конфигурациях и при строгих сетевых политиках.
            </p>
          )}

          {connection.provider === 'local' && (
            <label className="field-block field-block--full">
              <span>Base URL</span>
              <input
                type="text"
                value={connection.baseUrl ?? ''}
                placeholder="http://localhost:8000/v1"
                onChange={(event) => handleConnectionFieldChange('baseUrl', event.target.value)}
              />
            </label>
          )}

          <label className="field-block field-block--full">
            <span>API Key</span>
            <input
              type="password"
              value={connection.apiKey}
              placeholder="sk-..."
              onChange={(event) => handleConnectionFieldChange('apiKey', event.target.value)}
            />
          </label>

          <label className="field-block field-block--full">
            <span>Model</span>
            <input
              type="text"
              value={connection.model}
              placeholder={connection.provider === 'openrouter' ? 'openai/gpt-5-mini' : 'qwen2.5-72b-instruct'}
              onChange={(event) => handleConnectionFieldChange('model', event.target.value)}
            />
          </label>

          <label className="field-block">
            <span>Temperature</span>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={connection.temperature}
              onChange={(event) => handleConnectionFieldChange('temperature', Number(event.target.value))}
            />
          </label>
        </div>
      </details>

      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && <p className="chat-placeholder">Здесь появятся сообщения чата и raw JSON draft, который вернула модель.</p>}
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`chat-bubble chat-bubble--${message.role}`}>
            <div className="chat-bubble__meta">{message.role === 'user' ? 'User' : message.role === 'assistant' ? 'LLM' : 'System'}</div>
            <pre className="chat-bubble__content">{message.content}</pre>
          </article>
        ))}
      </div>

      <div className="chat-footer">
        <div className="chat-composer">
          <label className="field-block field-block--full">
            <span>Описание процесса</span>
            <textarea value={input} onChange={(event) => onInputChange(event.target.value)} rows={4} />
          </label>
          <div className="chat-composer__actions">
            <button className="toolbar-button" onClick={handleSend} disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Process'}
            </button>
            <button
              className="toolbar-button toolbar-button--secondary"
              onClick={() => {
                onMessagesChange([]);
                onDiagnosticsChange({
                  rawLlmJson: '',
                  normalizedIr: null,
                  normalizationWarnings: [],
                  validationWarnings: [],
                  validationErrors: [],
                });
                onStatusTextChange('Чат очищен.');
              }}
              disabled={isLoading}
            >
              Clear Chat
            </button>
          </div>
        </div>

        <div className="status-box">
          <strong>Status:</strong> {statusText}
        </div>

        {diagnostics.validationErrors.length > 0 && (
          <div className="issues-box">
            <strong>Validation errors</strong>
            <ul>
              {diagnostics.validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {diagnostics.normalizationWarnings.length > 0 && (
          <div className="issues-box">
            <strong>Normalization warnings</strong>
            <ul>
              {diagnostics.normalizationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {diagnostics.validationWarnings.length > 0 && (
          <div className="issues-box">
            <strong>Validation warnings</strong>
            <ul>
              {diagnostics.validationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}