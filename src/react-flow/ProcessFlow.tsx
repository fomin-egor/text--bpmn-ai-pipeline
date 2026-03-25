import { useState } from 'react';
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
import type { LayoutMetrics, LayoutResult } from '../layout/applyDagreLayout';
import type { ProcessDefinition } from '../process-model/types';
import { BpmnNode } from './BpmnNode';
import { LaneBackground } from './LaneBackground';
import { WaypointsEdge } from './WaypointsEdge';

const nodeTypes = Object.freeze({
  bpmnNode: BpmnNode,
});

const edgeTypes = Object.freeze({
  waypoints: WaypointsEdge,
});

const fitViewOptions = Object.freeze({
  padding: 0.16,
});

const defaultEdgeOptions = Object.freeze({
  zIndex: 3,
});

interface ProcessFlowCanvasProps {
  process: ProcessDefinition;
  initialLayout: LayoutResult;
}

function minimapNodeColor(node: { data?: { type?: string } }) {
  switch (node.data?.type) {
    case 'task':
      return '#334155';
    case 'startEvent':
    case 'endEvent':
      return '#0f766e';
    case 'exclusiveGateway':
    case 'parallelGateway':
      return '#a16207';
    default:
      return '#475569';
  }
}

function ProcessFlowCanvas({ process, initialLayout }: ProcessFlowCanvasProps) {
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
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitViewOptions={fitViewOptions}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.35}
      >
        <LaneBackground metrics={layoutMetrics} poolLabel={process.pool.label} />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#1f2832" />
        <MiniMap pannable zoomable className="minimap" nodeColor={minimapNodeColor} maskColor="rgba(7, 10, 14, 0.38)" />
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