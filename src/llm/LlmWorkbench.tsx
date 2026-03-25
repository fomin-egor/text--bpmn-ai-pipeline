import type { ProcessDefinition } from '../process-model/types';
import { mapProcessIrToDefinition } from '../process-ir/mapProcessIrToDefinition';
import { normalizeProcessIrDraft } from '../process-ir/normalizeProcessIr';
import { parseProcessIrDraft } from '../process-ir/parseDraft';
import type { ProcessIr } from '../process-ir/types';
import { validateProcessIr } from '../process-ir/validateProcessIr';
import { sendLlmChatRequest } from './api';
import { PROCESS_GENERATION_SYSTEM_PROMPT } from './systemPrompt';
import type { ChatMessage, LlmConnectionConfig } from './types';

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
  onMessagesChange,
  onInputChange,
  onStatusTextChange,
  onLoadingChange,
  onDiagnosticsChange,
  onProcessGenerated,
}: LlmWorkbenchProps) {
  const handleSend = async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      onStatusTextChange('Enter a process description.');
      return;
    }

    if (!connection.apiKey.trim()) {
      onStatusTextChange('Enter an API key.');
      return;
    }

    if (!connection.model.trim()) {
      onStatusTextChange('Enter a model name.');
      return;
    }

    if (connection.provider === 'local' && !connection.baseUrl?.trim()) {
      onStatusTextChange('Local provider requires a baseUrl.');
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
        ? 'Sending request to OpenRouter from the browser...'
        : connection.provider === 'openrouter'
          ? 'Sending request to OpenRouter through local proxy...'
          : 'Sending request to local LLM...'
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
        onStatusTextChange('LLM returned a response, but the draft Process IR is not valid JSON.');
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
        onStatusTextChange('Draft Process IR was normalized, but validation failed.');
        return;
      }

      const processDefinition = mapProcessIrToDefinition(validated.value);
      onProcessGenerated(processDefinition, validated.value);

      const warningCount = normalized.warnings.length + validated.warnings.length;
      onStatusTextChange(
        warningCount > 0
          ? `Process "${processDefinition.title}" was built with ${warningCount} warnings.`
          : `Process "${processDefinition.title}" was built.`
      );
    } catch (error) {
      onStatusTextChange(error instanceof Error ? error.message : 'LLM request failed.');
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <div className="llm-workbench llm-workbench--minimal">
      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && <p className="chat-placeholder">Describe a process to generate a diagram.</p>}
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`chat-bubble chat-bubble--${message.role}`}>
            <div className="chat-bubble__meta">{message.role === 'user' ? 'User' : message.role === 'assistant' ? 'LLM' : 'System'}</div>
            <pre className="chat-bubble__content">{message.content}</pre>
          </article>
        ))}
      </div>

      <div className="chat-footer">
        <div className="chat-composer">
          <textarea value={input} onChange={(event) => onInputChange(event.target.value)} rows={4} placeholder="Describe the process..." />
          <div className="chat-composer__actions">
            <button className="toolbar-button toolbar-button--primary" onClick={handleSend} disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send'}
            </button>
            <button
              className="icon-button"
              onClick={() => {
                onMessagesChange([]);
                onDiagnosticsChange({
                  rawLlmJson: '',
                  normalizedIr: null,
                  normalizationWarnings: [],
                  validationWarnings: [],
                  validationErrors: [],
                });
                onStatusTextChange('Chat cleared.');
              }}
              disabled={isLoading}
              aria-label="Clear chat"
              title="Clear chat"
            >
              x
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
