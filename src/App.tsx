import { useMemo, useState } from 'react';
import { ProcessFlow } from './react-flow/ProcessFlow';
import { defaultProcessId, processCatalog } from './process-model/catalog';

export default function App() {
  const [selectedProcessId, setSelectedProcessId] = useState(defaultProcessId);

  const selectedProcess = useMemo(
    () => processCatalog.find((process) => process.id === selectedProcessId) ?? processCatalog[0],
    [selectedProcessId],
  );

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
              <span className="process-picker__label">Тестовый процесс</span>
              <select value={selectedProcessId} onChange={(event) => setSelectedProcessId(event.target.value)}>
                {processCatalog.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="supporting-text">
              React Flow отвечает за редактирование графа, а dagre раскладывает основной поток слева направо по
              глобальным колонкам.
            </p>
          </div>
        </div>
        <ProcessFlow key={selectedProcess.id} process={selectedProcess} />
      </section>

      <aside className="json-pane">
        <div className="pane-header pane-header--compact">
          <div>
            <p className="eyebrow">Process Model</p>
            <h2>JSON</h2>
          </div>
          <p className="supporting-text">Эта же структура может стать базой для последующего BPMN export.</p>
        </div>
        <pre className="json-view">{JSON.stringify(selectedProcess, null, 2)}</pre>
      </aside>
    </main>
  );
}