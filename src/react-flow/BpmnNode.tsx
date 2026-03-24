import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { NodeType } from '../process-model/types';

type BpmnNodeData = {
  type: NodeType;
  label: string;
  lane: string;
};

function shapeClassName(type: NodeType) {
  switch (type) {
    case 'task':
      return 'bpmn-node__task';
    case 'startEvent':
      return 'bpmn-node__event bpmn-node__event--start';
    case 'endEvent':
      return 'bpmn-node__event bpmn-node__event--end';
    case 'exclusiveGateway':
      return 'bpmn-node__gateway';
    case 'parallelGateway':
      return 'bpmn-node__gateway bpmn-node__gateway--parallel';
  }
}

export function BpmnNode({ data, selected }: NodeProps<BpmnNodeData>) {
  return (
    <div className={`bpmn-node bpmn-node--${data.type} ${selected ? 'is-selected' : ''}`}>
      <div className="bpmn-node__shape-wrap">
        <Handle type="target" position={Position.Left} className="bpmn-handle bpmn-handle--left" />
        <div className={shapeClassName(data.type)}>
          {data.type === 'exclusiveGateway' && <span className="bpmn-node__gateway-mark">×</span>}
          {data.type === 'parallelGateway' && <span className="bpmn-node__gateway-mark">+</span>}
          {(data.type === 'task' || data.type === 'startEvent' || data.type === 'endEvent') && (
            <span className="bpmn-node__label">{data.label}</span>
          )}
        </div>
        <Handle type="source" position={Position.Right} className="bpmn-handle bpmn-handle--right" />
      </div>
      {(data.type === 'exclusiveGateway' || data.type === 'parallelGateway') && (
        <div className="bpmn-node__gateway-label">{data.label}</div>
      )}
    </div>
  );
}