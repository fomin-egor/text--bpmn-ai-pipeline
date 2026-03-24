export type ProcessIrNodeType =
  | 'startEvent'
  | 'endEvent'
  | 'task'
  | 'exclusiveGateway'
  | 'parallelGateway';

export type ProcessIrEdgeKind = 'forward' | 'backward';

export interface ProcessMeta {
  id: string;
  title: string;
  poolId: string;
  poolLabel: string;
  description?: string;
}

export interface ProcessLaneIr {
  id: string;
  label: string;
  order: number;
  actor?: string;
}

export interface ProcessNodeIr {
  id: string;
  type: ProcessIrNodeType;
  label: string;
  laneId: string;
  bpmnType?: string;
  system?: string;
  gatewayRole?: 'split' | 'join' | 'decision';
  metadata?: Record<string, string | number | boolean>;
}

export interface ProcessEdgeIr {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: ProcessIrEdgeKind;
  condition?: string;
  isDefault?: boolean;
}

export interface ProcessWarning {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ProcessIr {
  version: string;
  process: ProcessMeta;
  lanes: ProcessLaneIr[];
  nodes: ProcessNodeIr[];
  edges: ProcessEdgeIr[];
  warnings?: ProcessWarning[];
}

export interface ParsedDraftSuccess {
  success: true;
  rawJson: string;
  value: unknown;
}

export interface ParsedDraftFailure {
  success: false;
  rawJson: string;
  errors: string[];
}

export type ParsedDraftResult = ParsedDraftSuccess | ParsedDraftFailure;

export interface NormalizationResult {
  value: ProcessIr;
  warnings: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  value?: ProcessIr;
}
