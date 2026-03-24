import { useMemo, useState } from 'react';
import { LlmWorkbench } from './llm/LlmWorkbench';
import { defaultProcessId, processCatalog } from './process-model/catalog';
import type { ProcessDefinition } from './process-model/types';
import { ProcessFlow } from './react-flow/ProcessFlow';
import type { ChatMessage, LlmConnectionConfig } from './llm/types';

const GENERATED_PROCESS_ID = '__generated__';

type SidebarTab = 'chat' | 'json';

const DEFAULT_CONNECTION: LlmConnectionConfig = {
  provider: 'openrouter',
  transport: 'server',
  apiKey: '',
  model: '',
  temperature: 0.2,
};

export default function App() {
  const [generatedProcess, setGeneratedProcess] = useState<ProcessDefinition | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState(defaultProcessId);
  const [rawLlmJson, setRawLlmJson] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('chat');
  const [connection, setConnection] = useState<LlmConnectionConfig>(DEFAULT_CONNECTION);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('Опиши процесс онбординга нового сотрудника с HR, IT и руководителем.');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('Готов к генерации процесса.');
  const [isLoading, setIsLoading] = useState(false);

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
              Первая итерация: подключение к LLM, генерация JSON-процесса и построение графа текущим dagre-движком.
            </p>
          </div>
        </div>
        <ProcessFlow key={selectedProcess.id} process={selectedProcess} />
      </section>

      <aside className="sidebar-pane">
        <div className="sidebar-tabs" role="tablist" aria-label="Right panel tabs">
          <button
            className={`sidebar-tab ${activeSidebarTab === 'chat' ? 'is-active' : ''}`}
            onClick={() => setActiveSidebarTab('chat')}
            role="tab"
            aria-selected={activeSidebarTab === 'chat'}
          >
            Chat
          </button>
          <button
            className={`sidebar-tab ${activeSidebarTab === 'json' ? 'is-active' : ''}`}
            onClick={() => setActiveSidebarTab('json')}
            role="tab"
            aria-selected={activeSidebarTab === 'json'}
          >
            Process JSON
          </button>
        </div>

        <div className="sidebar-tabpanel-wrap">
          {activeSidebarTab === 'chat' ? (
            <section className="tool-pane tool-pane--chat" role="tabpanel" aria-label="Chat panel">
              <LlmWorkbench
                connection={connection}
                messages={messages}
                input={input}
                validationErrors={validationErrors}
                statusText={statusText}
                isLoading={isLoading}
                onConnectionChange={setConnection}
                onMessagesChange={setMessages}
                onInputChange={setInput}
                onValidationErrorsChange={setValidationErrors}
                onStatusTextChange={setStatusText}
                onLoadingChange={setIsLoading}
                onProcessGenerated={handleProcessGenerated}
                onRawJsonChange={setRawLlmJson}
              />
            </section>
          ) : (
            <section className="tool-pane tool-pane--json" role="tabpanel" aria-label="Process JSON panel">
              <div className="tool-pane__header">
                <div>
                  <p className="eyebrow">Process Model</p>
                  <h2>JSON</h2>
                </div>
                <p className="supporting-text">Текущая preview-модель, которая подаётся в dagre и React Flow.</p>
              </div>
              {rawLlmJson && (
                <details className="raw-json-box raw-json-box--pane">
                  <summary>Raw LLM JSON</summary>
                  <pre>{rawLlmJson}</pre>
                </details>
              )}
              <pre className="json-view">{JSON.stringify(selectedProcess, null, 2)}</pre>
            </section>
          )}
        </div>
      </aside>
    </main>
  );
}
