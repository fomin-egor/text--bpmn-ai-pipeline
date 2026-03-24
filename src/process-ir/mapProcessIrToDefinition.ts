import { EVENT_SIZE, GATEWAY_SIZE, TASK_SIZE } from '../process-model/nodeSizes';
import type { ProcessDefinition } from '../process-model/types';
import type { ProcessIr, ProcessIrNodeType } from './types';

function sizeForType(type: ProcessIrNodeType) {
  switch (type) {
    case 'task':
      return TASK_SIZE;
    case 'startEvent':
    case 'endEvent':
      return EVENT_SIZE;
    case 'exclusiveGateway':
    case 'parallelGateway':
      return GATEWAY_SIZE;
  }
}

export function mapProcessIrToDefinition(processIr: ProcessIr): ProcessDefinition {
  return {
    id: processIr.process.id,
    title: processIr.process.title,
    pool: {
      id: processIr.process.poolId,
      label: processIr.process.poolLabel,
    },
    lanes: processIr.lanes
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((lane) => ({
        id: lane.id,
        label: lane.label,
      })),
    nodes: processIr.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      lane: node.laneId,
      size: sizeForType(node.type),
    })),
    edges: processIr.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      kind: edge.kind,
    })),
  };
}