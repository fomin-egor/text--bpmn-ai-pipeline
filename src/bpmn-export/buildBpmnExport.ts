import type { LayoutResult } from '../layout/applyDagreLayout';
import type { ProcessEdgeIr, ProcessIr, ProcessLaneIr, ProcessNodeIr } from '../process-ir/types';

export interface BpmnExportResult {
  fileName: string;
  xml: string;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapeAttribute(value: string | undefined) {
  return value ? escapeXml(value) : '';
}

function serializePoint(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function nodeTagForType(type: ProcessIr['nodes'][number]['type']) {
  switch (type) {
    case 'startEvent':
      return 'bpmn:startEvent';
    case 'endEvent':
      return 'bpmn:endEvent';
    case 'task':
      return 'bpmn:task';
    case 'exclusiveGateway':
      return 'bpmn:exclusiveGateway';
    case 'parallelGateway':
      return 'bpmn:parallelGateway';
  }
}

function buildIncomingOutgoingMaps(edges: ProcessEdgeIr[]) {
  const incomingMap = new Map<string, string[]>();
  const outgoingMap = new Map<string, string[]>();

  edges.forEach((edge) => {
    const incoming = incomingMap.get(edge.target) ?? [];
    incoming.push(edge.id);
    incomingMap.set(edge.target, incoming);

    const outgoing = outgoingMap.get(edge.source) ?? [];
    outgoing.push(edge.id);
    outgoingMap.set(edge.source, outgoing);
  });

  return {
    incomingMap,
    outgoingMap,
  };
}

function buildLaneXml(lane: ProcessLaneIr, nodeIds: string[]) {
  const flowNodeRefs = nodeIds.map((nodeId) => `        <bpmn:flowNodeRef>${escapeXml(nodeId)}</bpmn:flowNodeRef>`).join('\n');

  return [
    `      <bpmn:lane id="${escapeAttribute(lane.id)}" name="${escapeAttribute(lane.label)}">`,
    flowNodeRefs,
    '      </bpmn:lane>',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildNodeXml(node: ProcessNodeIr, incomingIds: string[], outgoingIds: string[], defaultEdgeId?: string) {
  const tagName = nodeTagForType(node.type);
  const attributes = [`id="${escapeAttribute(node.id)}"`];

  if (node.label) {
    attributes.push(`name="${escapeAttribute(node.label)}"`);
  }

  if (node.type === 'exclusiveGateway' && defaultEdgeId) {
    attributes.push(`default="${escapeAttribute(defaultEdgeId)}"`);
  }

  const incomingXml = incomingIds.map((edgeId) => `      <bpmn:incoming>${escapeXml(edgeId)}</bpmn:incoming>`);
  const outgoingXml = outgoingIds.map((edgeId) => `      <bpmn:outgoing>${escapeXml(edgeId)}</bpmn:outgoing>`);

  return [
    `    <${tagName} ${attributes.join(' ')}>`,
    ...incomingXml,
    ...outgoingXml,
    `    </${tagName}>`,
  ].join('\n');
}

function buildEdgeXml(edge: ProcessEdgeIr) {
  const attributes = [
    `id="${escapeAttribute(edge.id)}"`,
    `sourceRef="${escapeAttribute(edge.source)}"`,
    `targetRef="${escapeAttribute(edge.target)}"`,
  ];

  if (edge.label) {
    attributes.push(`name="${escapeAttribute(edge.label)}"`);
  }

  return `    <bpmn:sequenceFlow ${attributes.join(' ')} />`;
}

export function buildBpmnExport(processIr: ProcessIr, layoutResult: LayoutResult): BpmnExportResult {
  const { incomingMap, outgoingMap } = buildIncomingOutgoingMaps(processIr.edges);
  const sortedLanes = processIr.lanes.slice().sort((left, right) => left.order - right.order);
  const laneNodeMap = new Map(sortedLanes.map((lane) => [lane.id, [] as string[]]));

  processIr.nodes.forEach((node) => {
    if (!node.laneId) {
      return;
    }

    const laneNodes = laneNodeMap.get(node.laneId);
    if (laneNodes) {
      laneNodes.push(node.id);
    }
  });

  const laneSetId = `${processIr.process.id}_lane_set`;
  const definitionsId = `${processIr.process.id}_definitions`;
  const collaborationId = `${processIr.process.id}_collaboration`;
  const participantId = `${processIr.process.poolId}_participant`;
  const diagramId = `${processIr.process.id}_diagram`;
  const planeId = `${processIr.process.id}_plane`;

  const laneXml = sortedLanes.map((lane) => buildLaneXml(lane, laneNodeMap.get(lane.id) ?? [])).join('\n');
  const nodeXml = processIr.nodes
    .map((node) => {
      const defaultEdge = processIr.edges.find((edge) => edge.source === node.id && edge.isDefault);
      return buildNodeXml(node, incomingMap.get(node.id) ?? [], outgoingMap.get(node.id) ?? [], defaultEdge?.id);
    })
    .join('\n');
  const edgeXml = processIr.edges.map(buildEdgeXml).join('\n');

  const participantBounds = layoutResult.diagram.poolBounds;
  const participantShapeXml = [
    `    <bpmndi:BPMNShape id="${escapeAttribute(`${participantId}_di`)}" bpmnElement="${escapeAttribute(participantId)}" isHorizontal="true">`,
    `      <dc:Bounds x="${serializePoint(participantBounds.x)}" y="${serializePoint(participantBounds.y)}" width="${serializePoint(participantBounds.width)}" height="${serializePoint(participantBounds.height)}" />`,
    '    </bpmndi:BPMNShape>',
  ].join('\n');

  const laneShapesXml = sortedLanes
    .map((lane) => {
      const bounds = layoutResult.diagram.laneBounds[lane.id];

      if (!bounds) {
        return '';
      }

      return [
        `    <bpmndi:BPMNShape id="${escapeAttribute(`${lane.id}_di`)}" bpmnElement="${escapeAttribute(lane.id)}" isHorizontal="true">`,
        `      <dc:Bounds x="${serializePoint(bounds.x)}" y="${serializePoint(bounds.y)}" width="${serializePoint(bounds.width)}" height="${serializePoint(bounds.height)}" />`,
        '    </bpmndi:BPMNShape>',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const nodeShapesXml = processIr.nodes
    .map((node) => {
      const bounds = layoutResult.diagram.nodeBounds[node.id];

      if (!bounds) {
        throw new Error(`Не найдены layout bounds для node "${node.id}".`);
      }

      return [
        `    <bpmndi:BPMNShape id="${escapeAttribute(`${node.id}_di`)}" bpmnElement="${escapeAttribute(node.id)}">`,
        `      <dc:Bounds x="${serializePoint(bounds.x)}" y="${serializePoint(bounds.y)}" width="${serializePoint(bounds.width)}" height="${serializePoint(bounds.height)}" />`,
        '    </bpmndi:BPMNShape>',
      ].join('\n');
    })
    .join('\n');

  const edgeShapesXml = processIr.edges
    .map((edge) => {
      const waypoints = layoutResult.diagram.edgeWaypoints[edge.id];

      if (!waypoints || waypoints.length < 2) {
        throw new Error(`Не найдены waypoints для edge "${edge.id}".`);
      }

      const waypointXml = waypoints
        .map((point) => `      <di:waypoint x="${serializePoint(point.x)}" y="${serializePoint(point.y)}" />`)
        .join('\n');

      return [
        `    <bpmndi:BPMNEdge id="${escapeAttribute(`${edge.id}_di`)}" bpmnElement="${escapeAttribute(edge.id)}">`,
        waypointXml,
        '    </bpmndi:BPMNEdge>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<bpmn:definitions id="${escapeAttribute(definitionsId)}"`,
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
    '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"',
    '  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"',
    '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"',
    '  targetNamespace="http://bpmn.io/schema/bpmn"',
    '  exporter="text->bpmn ai pipeline"',
    '  exporterVersion="0.3.0">',
    `  <bpmn:collaboration id="${escapeAttribute(collaborationId)}">`,
    `    <bpmn:participant id="${escapeAttribute(participantId)}" name="${escapeAttribute(processIr.process.poolLabel)}" processRef="${escapeAttribute(processIr.process.id)}" />`,
    '  </bpmn:collaboration>',
    `  <bpmn:process id="${escapeAttribute(processIr.process.id)}" name="${escapeAttribute(processIr.process.title)}" isExecutable="true">`,
    `    <bpmn:laneSet id="${escapeAttribute(laneSetId)}">`,
    laneXml,
    '    </bpmn:laneSet>',
    nodeXml,
    edgeXml,
    '  </bpmn:process>',
    `  <bpmndi:BPMNDiagram id="${escapeAttribute(diagramId)}">`,
    `  <bpmndi:BPMNPlane id="${escapeAttribute(planeId)}" bpmnElement="${escapeAttribute(collaborationId)}">`,
    participantShapeXml,
    laneShapesXml,
    nodeShapesXml,
    edgeShapesXml,
    '  </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>',
    '</bpmn:definitions>',
  ].join('\n');

  return {
    fileName: `${processIr.process.id}.bpmn`,
    xml,
  };
}