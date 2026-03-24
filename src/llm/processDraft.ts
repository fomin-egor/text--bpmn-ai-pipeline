import { EVENT_SIZE, GATEWAY_SIZE, TASK_SIZE } from '../process-model/nodeSizes';
import type { EdgeKind, NodeType, ProcessDefinition } from '../process-model/types';

const ALLOWED_NODE_TYPES: NodeType[] = ['startEvent', 'endEvent', 'task', 'exclusiveGateway', 'parallelGateway'];
const ALLOWED_EDGE_KINDS: EdgeKind[] = ['forward', 'backward'];

type DraftPool = {
  id: string;
  label: string;
};

type DraftLane = {
  id: string;
  label: string;
};

type DraftNode = {
  id: string;
  type: NodeType;
  label: string;
  lane: string;
};

type DraftEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: EdgeKind;
};

export interface LlmProcessDraft {
  id: string;
  title: string;
  pool: DraftPool;
  lanes: DraftLane[];
  nodes: DraftNode[];
  edges: DraftEdge[];
}

export interface DraftParseSuccess {
  success: true;
  value: LlmProcessDraft;
  rawJson: string;
}

export interface DraftParseFailure {
  success: false;
  rawJson: string;
  errors: string[];
}

export type DraftParseResult = DraftParseSuccess | DraftParseFailure;

function extractJsonObject(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseAndValidateDraft(text: string): DraftParseResult {
  const rawJson = extractJsonObject(text);
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      success: false,
      rawJson,
      errors: ['LLM returned invalid JSON'],
    };
  }

  const errors: string[] = [];
  const candidate = parsed as Partial<LlmProcessDraft>;

  if (!parsed || typeof parsed !== 'object') {
    errors.push('Root JSON value must be an object');
  }

  if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
    errors.push('process.id is required');
  }

  if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
    errors.push('process.title is required');
  }

  if (!candidate.pool || typeof candidate.pool !== 'object') {
    errors.push('pool is required');
  } else {
    if (typeof candidate.pool.id !== 'string' || !candidate.pool.id.trim()) {
      errors.push('pool.id is required');
    }

    if (typeof candidate.pool.label !== 'string' || !candidate.pool.label.trim()) {
      errors.push('pool.label is required');
    }
  }

  if (!Array.isArray(candidate.lanes) || candidate.lanes.length === 0) {
    errors.push('lanes must be a non-empty array');
  }

  if (!Array.isArray(candidate.nodes) || candidate.nodes.length === 0) {
    errors.push('nodes must be a non-empty array');
  }

  if (!Array.isArray(candidate.edges) || candidate.edges.length === 0) {
    errors.push('edges must be a non-empty array');
  }

  const laneIds = new Set<string>();
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const lane of candidate.lanes ?? []) {
    if (!lane || typeof lane !== 'object') {
      errors.push('each lane must be an object');
      continue;
    }

    if (typeof lane.id !== 'string' || !lane.id.trim()) {
      errors.push('each lane.id is required');
      continue;
    }

    if (laneIds.has(lane.id)) {
      errors.push(`duplicate lane id: ${lane.id}`);
    }

    laneIds.add(lane.id);

    if (typeof lane.label !== 'string' || !lane.label.trim()) {
      errors.push(`lane ${lane.id} must have label`);
    }
  }

  for (const node of candidate.nodes ?? []) {
    if (!node || typeof node !== 'object') {
      errors.push('each node must be an object');
      continue;
    }

    if (typeof node.id !== 'string' || !node.id.trim()) {
      errors.push('each node.id is required');
      continue;
    }

    if (nodeIds.has(node.id)) {
      errors.push(`duplicate node id: ${node.id}`);
    }

    nodeIds.add(node.id);

    if (!ALLOWED_NODE_TYPES.includes(node.type as NodeType)) {
      errors.push(`node ${node.id} has unsupported type`);
    }

    if (typeof node.label !== 'string' || !node.label.trim()) {
      errors.push(`node ${node.id} must have label`);
    }

    if (typeof node.lane !== 'string' || !laneIds.has(node.lane)) {
      errors.push(`node ${node.id} references unknown lane`);
    }
  }

  const startCount = (candidate.nodes ?? []).filter((node) => node?.type === 'startEvent').length;
  const endCount = (candidate.nodes ?? []).filter((node) => node?.type === 'endEvent').length;

  if (startCount === 0) {
    errors.push('at least one startEvent is required');
  }

  if (endCount === 0) {
    errors.push('at least one endEvent is required');
  }

  for (const edge of candidate.edges ?? []) {
    if (!edge || typeof edge !== 'object') {
      errors.push('each edge must be an object');
      continue;
    }

    if (typeof edge.id !== 'string' || !edge.id.trim()) {
      errors.push('each edge.id is required');
      continue;
    }

    if (edgeIds.has(edge.id)) {
      errors.push(`duplicate edge id: ${edge.id}`);
    }

    edgeIds.add(edge.id);

    if (typeof edge.source !== 'string' || !nodeIds.has(edge.source)) {
      errors.push(`edge ${edge.id} has unknown source`);
    }

    if (typeof edge.target !== 'string' || !nodeIds.has(edge.target)) {
      errors.push(`edge ${edge.id} has unknown target`);
    }

    if (edge.source === edge.target) {
      errors.push(`edge ${edge.id} cannot be a self-loop`);
    }

    if (edge.kind && !ALLOWED_EDGE_KINDS.includes(edge.kind)) {
      errors.push(`edge ${edge.id} has unsupported kind`);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      rawJson,
      errors,
    };
  }

  return {
    success: true,
    rawJson,
    value: {
      id: candidate.id!.trim(),
      title: candidate.title!.trim(),
      pool: {
        id: candidate.pool!.id.trim(),
        label: candidate.pool!.label.trim(),
      },
      lanes: candidate.lanes!.map((lane) => ({ id: lane.id.trim(), label: lane.label.trim() })),
      nodes: candidate.nodes!.map((node) => ({
        id: node.id.trim(),
        type: node.type,
        label: node.label.trim(),
        lane: node.lane.trim(),
      })),
      edges: candidate.edges!.map((edge) => ({
        id: edge.id.trim(),
        source: edge.source.trim(),
        target: edge.target.trim(),
        label: typeof edge.label === 'string' && edge.label.trim() ? edge.label.trim() : undefined,
        kind: edge.kind ?? 'forward',
      })),
    },
  };
}

function sizeForType(type: NodeType) {
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

export function mapDraftToProcessDefinition(draft: LlmProcessDraft): ProcessDefinition {
  return {
    id: draft.id,
    title: draft.title,
    pool: draft.pool,
    lanes: draft.lanes,
    nodes: draft.nodes.map((node) => ({
      ...node,
      size: sizeForType(node.type),
    })),
    edges: draft.edges.map((edge) => ({
      ...edge,
      kind: edge.kind ?? 'forward',
    })),
  };
}