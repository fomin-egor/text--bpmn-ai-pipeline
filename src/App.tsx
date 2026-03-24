import { ProcessFlow } from './react-flow/ProcessFlow';
import { serviceRolloutProcess } from './process-model/serviceRollout';

export default function App() {
  return (
    <main className="app-shell">
      <section className="workspace-pane">
        <div className="pane-header">
          <div>
            <p className="eyebrow">BPMN Layout Research Prototype</p>
            <h1>{serviceRolloutProcess.title}</h1>
          </div>
          <p className="supporting-text">
            React Flow отвечает за редактирование графа, а dagre раскладывает основной поток слева направо по
            глобальным колонкам.
          </p>
        </div>
        <ProcessFlow process={serviceRolloutProcess} />
      </section>

      <aside className="json-pane">
        <div className="pane-header pane-header--compact">
          <div>
            <p className="eyebrow">Process Model</p>
            <h2>JSON</h2>
          </div>
          <p className="supporting-text">Эта же структура может стать базой для последующего BPMN export.</p>
        </div>
        <pre className="json-view">{JSON.stringify(serviceRolloutProcess, null, 2)}</pre>
      </aside>
    </main>
  );
}
