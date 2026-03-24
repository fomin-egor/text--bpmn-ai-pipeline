import type { ProcessIr, ProcessIrNodeType, ValidationResult } from './types';

const ALLOWED_NODE_TYPES = new Set<ProcessIrNodeType>(['startEvent', 'endEvent', 'task', 'exclusiveGateway', 'parallelGateway']);
const TASK_LIKE_TYPES = new Set<ProcessIrNodeType>(['task']);

export function validateProcessIr(value: ProcessIr): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!value.process.id.trim()) {
    errors.push('process.id is required');
  }

  if (!value.process.title.trim()) {
    errors.push('process.title is required');
  }

  if (!value.process.poolId.trim()) {
    errors.push('process.poolId is required');
  }

  if (!value.process.poolLabel.trim()) {
    errors.push('process.poolLabel is required');
  }

  if (value.lanes.length === 0) {
    errors.push('lanes must be a non-empty array');
  }

  if (value.nodes.length === 0) {
    errors.push('nodes must be a non-empty array');
  }

  if (value.edges.length === 0) {
    errors.push('edges must be a non-empty array');
  }

  const laneIds = new Set<string>();
  const laneOrders = new Set<number>();
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const lane of value.lanes) {
    if (!lane.id.trim()) {
      errors.push('lane.id is required');
      continue;
    }

    if (laneIds.has(lane.id)) {
      errors.push(`duplicate lane id: ${lane.id}`);
    }
    laneIds.add(lane.id);

    if (!lane.label.trim()) {
      errors.push(`lane ${lane.id} must have label`);
    }

    if (laneOrders.has(lane.order)) {
      errors.push(`duplicate lane order: ${lane.order}`);
    }
    laneOrders.add(lane.order);
  }

  for (const node of value.nodes) {
    if (!node.id.trim()) {
      errors.push('node.id is required');
      continue;
    }

    if (nodeIds.has(node.id)) {
      errors.push(`duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);

    if (!ALLOWED_NODE_TYPES.has(node.type)) {
      errors.push(`node ${node.id} has unsupported type`);
    }

    if (!node.label.trim()) {
      errors.push(`node ${node.id} must have label`);
    }

    if (TASK_LIKE_TYPES.has(node.type)) {
      if (!node.laneId?.trim()) {
        errors.push(`task ${node.id} must have laneId`);
      } else if (!laneIds.has(node.laneId)) {
        errors.push(`node ${node.id} references unknown lane ${node.laneId}`);
      }
    } else if (node.laneId && !laneIds.has(node.laneId)) {
      errors.push(`node ${node.id} references unknown lane ${node.laneId}`);
    }

    if ((node.type === 'exclusiveGateway' || node.type === 'parallelGateway') && !node.gatewayRole) {
      warnings.push(`gateway ${node.id} has no gatewayRole`);
    }
  }

  const startCount = value.nodes.filter((node) => node.type === 'startEvent').length;
  const endCount = value.nodes.filter((node) => node.type === 'endEvent').length;

  if (startCount === 0) {
    errors.push('at least one startEvent is required');
  }

  if (endCount === 0) {
    errors.push('at least one endEvent is required');
  }

  for (const edge of value.edges) {
    if (!edge.id.trim()) {
      errors.push('edge.id is required');
      continue;
    }

    if (edgeIds.has(edge.id)) {
      errors.push(`duplicate edge id: ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      errors.push(`edge ${edge.id} has unknown source ${edge.source || '<empty>'}`);
    }

    if (!nodeIds.has(edge.target)) {
      errors.push(`edge ${edge.id} has unknown target ${edge.target || '<empty>'}`);
    }

    if (edge.source === edge.target) {
      errors.push(`edge ${edge.id} cannot be a self-loop`);
    }

    if (edge.kind !== 'forward' && edge.kind !== 'backward') {
      errors.push(`edge ${edge.id} has unsupported kind`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    value: errors.length === 0 ? value : undefined,
  };
}