import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { NodeType } from '../process-model/types';

type BpmnNodeData = {
  type: NodeType;
  label: string;
  lane?: string;
};

function shapeClassName(type: NodeType) {
  switch (type) {
    case 'task':
      return 'bpmn-node__task';
    case 'startEvent':
    case 'endEvent':
      return 'bpmn-node__event';
    case 'exclusiveGateway':
    case 'parallelGateway':
      return 'bpmn-node__gateway';
  }
}

function GatewayShape({ type }: { type: NodeType }) {
  return (
    <svg viewBox="0 0 50 50" className="bpmn-node__gateway-svg" aria-hidden="true">
      <path d="M25 0 L50 25 L25 50 L0 25 Z" className="bpmn-node__gateway-outline" />
      {type === 'exclusiveGateway' ? (
        <path d="M16 16 L34 34 M34 16 L16 34" className="bpmn-node__gateway-stroke" />
      ) : (
        <path d="M25 12 L25 38 M12 25 L38 25" className="bpmn-node__gateway-stroke" />
      )}
    </svg>
  );
}

export function BpmnNode({ data, selected }: NodeProps<BpmnNodeData>) {
  const isGateway = data.type === 'exclusiveGateway' || data.type === 'parallelGateway';
  const isEvent = data.type === 'startEvent' || data.type === 'endEvent';

  return (
    <div className={`bpmn-node bpmn-node--${data.type} ${selected ? 'is-selected' : ''}`}>
      <div className="bpmn-node__shape-wrap">
        <Handle type="target" position={Position.Left} className="bpmn-handle bpmn-handle--left" />
        <div className={shapeClassName(data.type)}>
          {isGateway && <GatewayShape type={data.type} />}
          {data.type === 'task' && <span className="bpmn-node__label">{data.label}</span>}
        </div>
        <Handle type="source" position={Position.Right} className="bpmn-handle bpmn-handle--right" />
      </div>
      {isGateway && <div className="bpmn-node__gateway-label">{data.label}</div>}
      {isEvent && <div className="bpmn-node__event-label">{data.label}</div>}
    </div>
  );
}
