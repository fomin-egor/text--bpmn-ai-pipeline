import type { NormalizationResult, ProcessEdgeIr, ProcessIr, ProcessIrEdgeKind, ProcessIrNodeType } from './types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIdentifier(value: unknown, fallback: string): { value: string; changed: boolean } {
  const raw = cleanString(value);
  const candidate = (raw || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;

  return {
    value: candidate,
    changed: candidate !== raw,
  };
}

function normalizeNodeType(value: unknown): ProcessIrNodeType {
  switch (value) {
    case 'startEvent':
    case 'endEvent':
    case 'task':
    case 'exclusiveGateway':
    case 'parallelGateway':
      return value;
    default:
      return 'task';
  }
}

function normalizeEdgeKind(value: unknown): ProcessIrEdgeKind {
  return value === 'backward' ? 'backward' : 'forward';
}

function normalizeMetadata(value: unknown): Record<string, string | number | boolean> | undefined {
  const record = asRecord(value);
  const entries = Object.entries(record).filter(([, entryValue]) => {
    return typeof entryValue === 'string' || typeof entryValue === 'number' || typeof entryValue === 'boolean';
  });

  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, string | number | boolean>) : undefined;
}

export function normalizeProcessIrDraft(input: unknown): NormalizationResult {
  const warnings: string[] = [];
  const root = asRecord(input);
  const processRecord = asRecord(root.process);
  const poolRecord = asRecord(root.pool);

  const processId = normalizeIdentifier(processRecord.id ?? root.id, 'generated_process');
  if (processId.changed) {
    warnings.push(`process.id normalized to ${processId.value}`);
  }

  const poolId = normalizeIdentifier(processRecord.poolId ?? poolRecord.id, `${processId.value}_pool`);
  if (poolId.changed && cleanString(processRecord.poolId ?? poolRecord.id)) {
    warnings.push(`process.poolId normalized to ${poolId.value}`);
  }

  const rawLanes = asArray(root.lanes);
  const laneIdMap = new Map<string, string>();

  const lanes = rawLanes.map((laneValue, index) => {
    const laneRecord = asRecord(laneValue);
    const normalizedId = normalizeIdentifier(laneRecord.id, `lane_${index + 1}`);
    const label = cleanString(laneRecord.label) || `Lane ${index + 1}`;
    const actor = cleanString(laneRecord.actor) || undefined;
    const originalId = cleanString(laneRecord.id);

    if (normalizedId.changed && originalId) {
      warnings.push(`lane.id normalized from ${originalId} to ${normalizedId.value}`);
    }

    laneIdMap.set(originalId || normalizedId.value, normalizedId.value);

    return {
      id: normalizedId.value,
      label,
      order: index,
      actor,
    };
  });

  const rawNodes = asArray(root.nodes);
  const nodeIdMap = new Map<string, string>();

  const nodes = rawNodes.map((nodeValue, index) => {
    const nodeRecord = asRecord(nodeValue);
    const normalizedId = normalizeIdentifier(nodeRecord.id, `node_${index + 1}`);
    const originalId = cleanString(nodeRecord.id);

    if (normalizedId.changed && originalId) {
      warnings.push(`node.id normalized from ${originalId} to ${normalizedId.value}`);
    }

    nodeIdMap.set(originalId || normalizedId.value, normalizedId.value);

    const rawLaneId = cleanString(nodeRecord.laneId ?? nodeRecord.lane);
    const laneId = laneIdMap.get(rawLaneId) ?? rawLaneId;
    const rawType = nodeRecord.type;
    const type = normalizeNodeType(rawType);

    if (rawType !== type) {
      warnings.push(`node ${normalizedId.value} received unsupported type and was normalized to task`);
    }

    return {
      id: normalizedId.value,
      type,
      label: cleanString(nodeRecord.label),
      laneId,
      bpmnType: cleanString(nodeRecord.bpmnType) || undefined,
      system: cleanString(nodeRecord.system) || undefined,
      gatewayRole: ['split', 'join', 'decision'].includes(cleanString(nodeRecord.gatewayRole))
        ? (cleanString(nodeRecord.gatewayRole) as 'split' | 'join' | 'decision')
        : undefined,
      metadata: normalizeMetadata(nodeRecord.metadata),
    };
  });

  const edges = asArray(root.edges).map((edgeValue, index) => {
    const edgeRecord = asRecord(edgeValue);
    const normalizedId = normalizeIdentifier(edgeRecord.id, `edge_${index + 1}`);
    const originalId = cleanString(edgeRecord.id);

    if (normalizedId.changed && originalId) {
      warnings.push(`edge.id normalized from ${originalId} to ${normalizedId.value}`);
    }

    const sourceRaw = cleanString(edgeRecord.source);
    const targetRaw = cleanString(edgeRecord.target);
    const source = nodeIdMap.get(sourceRaw) ?? sourceRaw;
    const target = nodeIdMap.get(targetRaw) ?? targetRaw;
    const rawKind = edgeRecord.kind;
    const kind = normalizeEdgeKind(rawKind);

    if (!cleanString(rawKind)) {
      warnings.push(`edge ${normalizedId.value} missing kind, defaulted to forward`);
    }

    return {
      id: normalizedId.value,
      source,
      target,
      label: cleanString(edgeRecord.label) || undefined,
      kind,
      condition: cleanString(edgeRecord.condition) || undefined,
      isDefault: typeof edgeRecord.isDefault === 'boolean' ? edgeRecord.isDefault : undefined,
    } satisfies ProcessEdgeIr;
  });

  return {
    value: {
      version: cleanString(root.version) || '1.0',
      process: {
        id: processId.value,
        title: cleanString(processRecord.title ?? root.title),
        poolId: poolId.value,
        poolLabel: cleanString(processRecord.poolLabel ?? poolRecord.label),
        description: cleanString(processRecord.description) || undefined,
      },
      lanes,
      nodes,
      edges,
    } satisfies ProcessIr,
    warnings,
  };
}
