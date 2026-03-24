import { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { applyDagreLayout } from '../layout/applyDagreLayout';
import type { LayoutMetrics } from '../layout/applyDagreLayout';
import type { ProcessDefinition } from '../process-model/types';
import { BpmnNode } from './BpmnNode';
import { LaneBackground } from './LaneBackground';

const nodeTypes = Object.freeze({
  bpmnNode: BpmnNode,
});

const fitViewOptions = Object.freeze({
  padding: 0.16,
});

const defaultEdgeOptions = Object.freeze({
  zIndex: 3,
});

interface ProcessFlowCanvasProps {
  process: ProcessDefinition;
}

function ProcessFlowCanvas({ process }: ProcessFlowCanvasProps) {
  const initialLayout = useMemo(() => applyDagreLayout(process), [process]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);
  const [layoutMetrics, setLayoutMetrics] = useState<LayoutMetrics>(initialLayout.metrics);

  const handleAutoLayout = () => {
    const nextLayout = applyDagreLayout(process);
    setNodes(nextLayout.nodes);
    setEdges(nextLayout.edges);
    setLayoutMetrics(nextLayout.metrics);
  };

  return (
    <div className="flow-shell">
      <ReactFlow
        fitView
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitViewOptions={fitViewOptions}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.35}
      >
        <LaneBackground metrics={layoutMetrics} poolLabel={process.pool.label} />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#d8ddd4" />
        <MiniMap pannable zoomable className="minimap" />
        <Controls position="bottom-left" />
        <Panel position="top-left">
          <button className="toolbar-button" onClick={handleAutoLayout}>
            Auto Layout
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function ProcessFlow(props: ProcessFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <ProcessFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
