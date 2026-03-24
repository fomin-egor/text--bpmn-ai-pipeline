export type NodeType =
  | 'startEvent'
  | 'endEvent'
  | 'task'
  | 'exclusiveGateway'
  | 'parallelGateway';

export type EdgeKind = 'forward' | 'backward';

export interface ProcessLane {
  id: string;
  label: string;
}

export interface ProcessNode {
  id: string;
  type: NodeType;
  label: string;
  lane?: string;
  size: {
    width: number;
    height: number;
  };
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: EdgeKind;
}

export interface ProcessPool {
  id: string;
  label: string;
}

export interface ProcessDefinition {
  id: string;
  title: string;
  pool: ProcessPool;
  lanes: ProcessLane[];
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}