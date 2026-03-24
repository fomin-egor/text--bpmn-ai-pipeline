import type { ProcessDefinition } from '../process-model/types';
import { sendLlmChatRequest } from './api';
import { mapDraftToProcessDefinition, parseAndValidateDraft } from './processDraft';
import { PROCESS_GENERATION_SYSTEM_PROMPT } from './systemPrompt';
import type { ChatMessage, LlmConnectionConfig, LlmTransport } from './types';

interface LlmWorkbenchProps {
  connection: LlmConnectionConfig;
  messages: ChatMessage[];
  input: string;
  validationErrors: string[];
  statusText: string;
  isLoading: boolean;
  onConnectionChange: (connection: LlmConnectionConfig) => void;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onInputChange: (input: string) => void;
  onValidationErrorsChange: (errors: string[]) => void;
  onStatusTextChange: (status: string) => void;
  onLoadingChange: (value: boolean) => void;
  onProcessGenerated: (process: ProcessDefinition) => void;
  onRawJsonChange: (rawJson: string) => void;
}

export function LlmWorkbench({
  connection,
  messages,
  input,
  validationErrors,
  statusText,
  isLoading,
  onConnectionChange,
  onMessagesChange,
  onInputChange,
  onValidationErrorsChange,
  onStatusTextChange,
  onLoadingChange,
  onProcessGenerated,
  onRawJsonChange,
}: LlmWorkbenchProps) {
  const handleConnectionFieldChange = <K extends keyof LlmConnectionConfig>(key: K, value: LlmConnectionConfig[K]) => {
    onConnectionChange({
      ...connection,
      [key]: value,
    });
  };

  const handleProviderChange = (provider: 'openrouter' | 'local') => {
    if (provider === 'local') {
      onConnectionChange({
        ...connection,
        provider,
        transport: 'server',
      });
      return;
    }

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
    onValidationErrorsChange([]);
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

      const parsedDraft = parseAndValidateDraft(assistantMessage.content);
      onRawJsonChange(parsedDraft.rawJson);

      if (!parsedDraft.success) {
        onValidationErrorsChange(parsedDraft.errors);
        onStatusTextChange('LLM ответила, но JSON процесса не прошёл валидацию.');
        return;
      }

      const processDefinition = mapDraftToProcessDefinition(parsedDraft.value);
      onProcessGenerated(processDefinition);
      onStatusTextChange(`Процесс "${processDefinition.title}" построен.`);
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
        <p className="supporting-text">Пайплайн первой итерации: chat -&gt; JSON -&gt; validate -&gt; dagre preview.</p>
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
        {messages.length === 0 && <p className="chat-placeholder">Здесь появятся сообщения чата и JSON-ответ модели.</p>}
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
                onRawJsonChange('');
                onValidationErrorsChange([]);
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

        {validationErrors.length > 0 && (
          <div className="issues-box">
            <strong>Validation errors</strong>
            <ul>
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
