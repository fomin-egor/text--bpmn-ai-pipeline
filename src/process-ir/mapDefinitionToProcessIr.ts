import type { ProcessDefinition } from '../process-model/types';
import type { ProcessIr } from './types';

export function mapDefinitionToProcessIr(process: ProcessDefinition): ProcessIr {
  return {
    version: '1.0',
    process: {
      id: process.id,
      title: process.title,
      poolId: process.pool.id,
      poolLabel: process.pool.label,
    },
    lanes: process.lanes.map((lane, index) => ({
      id: lane.id,
      label: lane.label,
      order: index,
    })),
    nodes: process.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      laneId: node.lane,
    })),
    edges: process.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      kind: edge.kind,
    })),
  };
}