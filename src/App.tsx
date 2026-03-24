import { useMemo, useState } from 'react';
import { LlmWorkbench } from './llm/LlmWorkbench';
import type { ChatMessage, LlmConnectionConfig } from './llm/types';
import { defaultProcessId, processCatalog } from './process-model/catalog';
import type { ProcessDefinition } from './process-model/types';
import type { ProcessIr } from './process-ir/types';
import { ProcessFlow } from './react-flow/ProcessFlow';

const GENERATED_PROCESS_ID = '__generated__';

type SidebarTab = 'chat' | 'json' | 'diagnostics';

const DEFAULT_CONNECTION: LlmConnectionConfig = {
  provider: 'openrouter',
  transport: 'server',
  apiKey: '',
  model: '',
  temperature: 0.2,
};

export interface ProcessDiagnosticsState {
  rawLlmJson: string;
  normalizedIr: ProcessIr | null;
  normalizationWarnings: string[];
  validationWarnings: string[];
  validationErrors: string[];
}

const EMPTY_DIAGNOSTICS: ProcessDiagnosticsState = {
  rawLlmJson: '',
  normalizedIr: null,
  normalizationWarnings: [],
  validationWarnings: [],
  validationErrors: [],
};

export default function App() {
  const [generatedProcess, setGeneratedProcess] = useState<ProcessDefinition | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState(defaultProcessId);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('chat');
  const [connection, setConnection] = useState<LlmConnectionConfig>(DEFAULT_CONNECTION);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('Опиши процесс онбординга нового сотрудника с HR, IT и руководителем.');
  const [statusText, setStatusText] = useState('Готов к генерации процесса.');
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ProcessDiagnosticsState>(EMPTY_DIAGNOSTICS);

  const processOptions = useMemo(() => {
    const staticOptions = processCatalog.map((process) => ({
      id: process.id,
      title: process.title,
      process,
    }));

    if (!generatedProcess) {
      return staticOptions;
    }

    return [
      {
        id: GENERATED_PROCESS_ID,
        title: `LLM: ${generatedProcess.title}`,
        process: generatedProcess,
      },
      ...staticOptions,
    ];
  }, [generatedProcess]);

  const selectedProcess = useMemo(
    () => processOptions.find((option) => option.id === selectedProcessId)?.process ?? processOptions[0].process,
    [processOptions, selectedProcessId],
  );

  const handleProcessGenerated = (process: ProcessDefinition) => {
    setGeneratedProcess(process);
    setSelectedProcessId(GENERATED_PROCESS_ID);
    setActiveSidebarTab('json');
  };

  return (
    <main className="app-shell">
      <section className="workspace-pane">
        <div className="pane-header pane-header--stacked-mobile">
          <div>
            <p className="eyebrow">BPMN Layout Research Prototype</p>
            <h1>{selectedProcess.title}</h1>
          </div>
          <div className="header-actions">
            <label className="process-picker">
              <span className="process-picker__label">Текущий процесс</span>
              <select value={selectedProcessId} onChange={(event) => setSelectedProcessId(event.target.value)}>
                {processOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="supporting-text">
              Вторая итерация: LLM генерирует draft Process IR, затем deterministic normalize/validate pipeline готовит preview model для dagre и React Flow.
            </p>
          </div>
        </div>
        <ProcessFlow key={selectedProcess.id} process={selectedProcess} />
      </section>

      <aside className="sidebar-pane">
        <div className="sidebar-tabs" role="tablist" aria-label="Right panel tabs">
          <button className={`sidebar-tab ${activeSidebarTab === 'chat' ? 'is-active' : ''}`} onClick={() => setActiveSidebarTab('chat')} role="tab" aria-selected={activeSidebarTab === 'chat'}>
            Chat
          </button>
          <button className={`sidebar-tab ${activeSidebarTab === 'json' ? 'is-active' : ''}`} onClick={() => setActiveSidebarTab('json')} role="tab" aria-selected={activeSidebarTab === 'json'}>
            Process JSON
          </button>
          <button className={`sidebar-tab ${activeSidebarTab === 'diagnostics' ? 'is-active' : ''}`} onClick={() => setActiveSidebarTab('diagnostics')} role="tab" aria-selected={activeSidebarTab === 'diagnostics'}>
            Diagnostics
          </button>
        </div>

        <div className="sidebar-tabpanel-wrap">
          {activeSidebarTab === 'chat' && (
            <section className="tool-pane tool-pane--chat" role="tabpanel" aria-label="Chat panel">
              <LlmWorkbench
                connection={connection}
                messages={messages}
                input={input}
                statusText={statusText}
                isLoading={isLoading}
                diagnostics={diagnostics}
                onConnectionChange={setConnection}
                onMessagesChange={setMessages}
                onInputChange={setInput}
                onStatusTextChange={setStatusText}
                onLoadingChange={setIsLoading}
                onDiagnosticsChange={setDiagnostics}
                onProcessGenerated={handleProcessGenerated}
              />
            </section>
          )}

          {activeSidebarTab === 'json' && (
            <section className="tool-pane tool-pane--json" role="tabpanel" aria-label="Process JSON panel">
              <div className="tool-pane__header">
                <div>
                  <p className="eyebrow">Preview Model</p>
                  <h2>Process JSON</h2>
                </div>
                <p className="supporting-text">Текущая preview-model, которая подаётся в dagre и React Flow после mapper-а из валидного Process IR.</p>
              </div>
              <pre className="json-view">{JSON.stringify(selectedProcess, null, 2)}</pre>
            </section>
          )}

          {activeSidebarTab === 'diagnostics' && (
            <section className="tool-pane tool-pane--json" role="tabpanel" aria-label="Diagnostics panel">
              <div className="tool-pane__header">
                <div>
                  <p className="eyebrow">Diagnostics</p>
                  <h2>IR Pipeline</h2>
                </div>
                <p className="supporting-text">Raw LLM JSON, normalized Process IR и сообщения normalize/validate pipeline.</p>
              </div>

              <div className="diagnostics-view">
                {diagnostics.validationErrors.length > 0 && (
                  <div className="issues-box issues-box--pane">
                    <strong>Validation errors</strong>
                    <ul>
                      {diagnostics.validationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagnostics.normalizationWarnings.length > 0 && (
                  <div className="issues-box issues-box--pane">
                    <strong>Normalization warnings</strong>
                    <ul>
                      {diagnostics.normalizationWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagnostics.validationWarnings.length > 0 && (
                  <div className="issues-box issues-box--pane">
                    <strong>Validation warnings</strong>
                    <ul>
                      {diagnostics.validationWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagnostics.rawLlmJson && (
                  <details className="raw-json-box raw-json-box--pane" open>
                    <summary>Raw LLM JSON</summary>
                    <pre>{diagnostics.rawLlmJson}</pre>
                  </details>
                )}

                {diagnostics.normalizedIr && (
                  <details className="raw-json-box raw-json-box--pane" open>
                    <summary>Normalized Process IR</summary>
                    <pre>{JSON.stringify(diagnostics.normalizedIr, null, 2)}</pre>
                  </details>
                )}
              </div>
            </section>
          )}
        </div>
      </aside>
    </main>
  );
}
