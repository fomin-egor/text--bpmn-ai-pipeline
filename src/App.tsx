import { useMemo, useState } from 'react';
import { buildBpmnExport } from './bpmn-export/buildBpmnExport';
import { applyDagreLayout } from './layout/applyDagreLayout';
import { LlmWorkbench } from './llm/LlmWorkbench';
import type { ChatMessage, LlmConnectionConfig, LlmTransport } from './llm/types';
import { defaultProcessId, processCatalog } from './process-model/catalog';
import type { ProcessDefinition } from './process-model/types';
import { mapDefinitionToProcessIr } from './process-ir/mapDefinitionToProcessIr';
import type { ProcessIr } from './process-ir/types';
import { ProcessFlow } from './react-flow/ProcessFlow';

const GENERATED_PROCESS_ID = '__generated__';

type SidebarTab = 'chat' | 'json' | 'diagnostics' | 'xml' | 'samples' | 'settings';

const DEFAULT_CONNECTION: LlmConnectionConfig = {
  provider: 'openrouter',
  transport: 'server',
  apiKey: '',
  model: '',
  temperature: 0.2,
};

const SECONDARY_TAB_OPTIONS: Array<{ value: Exclude<SidebarTab, 'chat'>; label: string }> = [
  { value: 'json', label: 'JSON' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'xml', label: 'XML' },
  { value: 'samples', label: 'Samples' },
  { value: 'settings', label: 'Settings' },
];

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

function sidebarTitle(tab: SidebarTab) {
  switch (tab) {
    case 'json':
      return 'Process JSON';
    case 'diagnostics':
      return 'Diagnostics';
    case 'xml':
      return 'BPMN XML';
    case 'samples':
      return 'Samples';
    case 'settings':
      return 'Settings';
    default:
      return 'Chat';
  }
}

export default function App() {
  const [generatedProcess, setGeneratedProcess] = useState<ProcessDefinition | null>(null);
  const [generatedProcessIr, setGeneratedProcessIr] = useState<ProcessIr | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState(defaultProcessId);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('chat');
  const [connection, setConnection] = useState<LlmConnectionConfig>(DEFAULT_CONNECTION);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('Describe an employee onboarding process involving HR, IT, and a manager.');
  const [statusText, setStatusText] = useState('Ready to generate a process.');
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ProcessDiagnosticsState>(EMPTY_DIAGNOSTICS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const processOptions = useMemo(() => {
    const staticOptions = processCatalog.map((process) => ({
      id: process.id,
      title: process.title,
      process,
      processIr: mapDefinitionToProcessIr(process),
    }));

    if (!generatedProcess || !generatedProcessIr) {
      return staticOptions;
    }

    return [
      {
        id: GENERATED_PROCESS_ID,
        title: `LLM: ${generatedProcess.title}`,
        process: generatedProcess,
        processIr: generatedProcessIr,
      },
      ...staticOptions,
    ];
  }, [generatedProcess, generatedProcessIr]);

  const selectedProcessOption = useMemo(
    () => processOptions.find((option) => option.id === selectedProcessId) ?? processOptions[0],
    [processOptions, selectedProcessId],
  );

  const selectedProcess = selectedProcessOption.process;
  const selectedProcessIr = selectedProcessOption.processIr;
  const selectedLayout = useMemo(() => applyDagreLayout(selectedProcess), [selectedProcess]);

  const bpmnExport = useMemo(() => {
    try {
      return {
        ...buildBpmnExport(selectedProcessIr, selectedLayout),
        error: null as string | null,
      };
    } catch (error) {
      return {
        fileName: `${selectedProcess.id}.bpmn`,
        xml: '',
        error: error instanceof Error ? error.message : 'Failed to build BPMN XML.',
      };
    }
  }, [selectedLayout, selectedProcess.id, selectedProcessIr]);

  const handleProcessGenerated = (process: ProcessDefinition, processIr: ProcessIr) => {
    setGeneratedProcess(process);
    setGeneratedProcessIr(processIr);
    setSelectedProcessId(GENERATED_PROCESS_ID);
    setActiveSidebarTab('json');
  };

  const handleDownloadBpmn = () => {
    if (!bpmnExport.xml) {
      return;
    }

    const blob = new Blob([bpmnExport.xml], { type: 'application/xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = bpmnExport.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleConnectionFieldChange = <K extends keyof LlmConnectionConfig>(key: K, value: LlmConnectionConfig[K]) => {
    setConnection({
      ...connection,
      [key]: value,
    });
  };

  const handleProviderChange = (provider: 'openrouter' | 'local') => {
    setConnection({
      ...connection,
      provider,
      transport: 'server',
    });
  };

  const handleTransportChange = (transport: LlmTransport) => {
    setConnection({
      ...connection,
      transport,
    });
  };

  return (
    <main className={`app-shell ${isSidebarOpen ? '' : 'app-shell--sidebar-collapsed'}`}>
      <section className="workspace-pane">
        <div className="workspace-topbar">
          <div className="workspace-topbar__title">
            <p className="eyebrow">{"text->bpmn ai pipeline"}</p>
            <h1>{selectedProcess.title}</h1>
          </div>

          <div className="workspace-topbar__actions">
            <button className="toolbar-button toolbar-button--primary" onClick={handleDownloadBpmn} disabled={!bpmnExport.xml}>
              Export BPMN
            </button>
          </div>
        </div>

        {!isSidebarOpen && (
          <button className="sidebar-edge-toggle sidebar-edge-toggle--reveal" onClick={() => setIsSidebarOpen(true)} aria-label="Show panel">
            {'>'}
          </button>
        )}

        <ProcessFlow key={selectedProcess.id} process={selectedProcess} initialLayout={selectedLayout} />
      </section>

      {isSidebarOpen && (
        <aside className="sidebar-pane">
          <button className="sidebar-edge-toggle" onClick={() => setIsSidebarOpen(false)} aria-label="Hide panel">
            {'<'}
          </button>

          <div className="sidebar-header sidebar-header--compact">
            <button
              className={`chat-rail-tab ${activeSidebarTab === 'chat' ? 'is-active' : ''}`}
              onClick={() => setActiveSidebarTab('chat')}
              aria-label="Chat"
            >
              Chat
            </button>

            <div className="sidebar-toolbar">
              <select
                className="sidebar-mode-select"
                value={activeSidebarTab === 'chat' ? '' : activeSidebarTab}
                onChange={(event) => setActiveSidebarTab((event.target.value || 'chat') as SidebarTab)}
                aria-label="Open sidebar panel"
              >
                <option value="">More</option>
                {SECONDARY_TAB_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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

            {activeSidebarTab === 'xml' && (
              <section className="tool-pane tool-pane--json" role="tabpanel" aria-label="BPMN XML panel">
                <div className="tool-pane__header tool-pane__header--stacked">
                  <div>
                    <p className="eyebrow">BPMN Export</p>
                    <h2>BPMN XML</h2>
                  </div>
                  <div className="tool-pane__actions">
                    <button className="toolbar-button" onClick={handleDownloadBpmn} disabled={!bpmnExport.xml}>
                      Download .bpmn
                    </button>
                  </div>
                </div>

                <div className="diagnostics-view">
                  <div className="status-box">
                    <strong>Status:</strong>{' '}
                    {bpmnExport.error ? `Export pipeline error: ${bpmnExport.error}` : `XML is synchronized with process "${selectedProcess.title}".`}
                  </div>

                  {bpmnExport.error ? (
                    <div className="issues-box issues-box--pane">
                      <strong>Export error</strong>
                      <ul>
                        <li>{bpmnExport.error}</li>
                      </ul>
                    </div>
                  ) : (
                    <pre className="json-view json-view--embedded">{bpmnExport.xml}</pre>
                  )}
                </div>
              </section>
            )}

            {activeSidebarTab === 'samples' && (
              <section className="tool-pane tool-pane--json" role="tabpanel" aria-label="Samples panel">
                <div className="tool-pane__header">
                  <div>
                    <p className="eyebrow">Samples</p>
                    <h2>Test Processes</h2>
                  </div>
                </div>
                <div className="diagnostics-view">
                  <label className="process-picker process-picker--subtle">
                    <span className="process-picker__label">Test process</span>
                    <select value={selectedProcessId} onChange={(event) => setSelectedProcessId(event.target.value)}>
                      {processOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            )}

            {activeSidebarTab === 'settings' && (
              <section className="tool-pane tool-pane--json" role="tabpanel" aria-label="Settings panel">
                <div className="tool-pane__header">
                  <div>
                    <p className="eyebrow">Settings</p>
                    <h2>Model Settings</h2>
                  </div>
                </div>
                <div className="diagnostics-view">
                  <div className="llm-config-grid llm-config-grid--panel">
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
                          <option value="server">Local proxy</option>
                          <option value="browser">Browser direct</option>
                        </select>
                      </label>
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
                </div>
              </section>
            )}
          </div>
        </aside>
      )}
    </main>
  );
}
