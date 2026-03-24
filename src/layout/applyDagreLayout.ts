import dagre from '@dagrejs/dagre';
import { MarkerType, Position } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import { EVENT_FOOTPRINT, EVENT_SIZE, GATEWAY_FOOTPRINT, GATEWAY_SIZE, TASK_FOOTPRINT, TASK_SIZE } from '../process-model/nodeSizes';
import type { NodeType, ProcessDefinition, ProcessLane, ProcessNode } from '../process-model/types';

export interface LayoutMetrics {
  laneGap: number;
  lanePaddingY: number;
  headerHeight: number;
  poolLabelWidth: number;
  graphWidth: number;
  graphHeight: number;
  laneOffsets: Array<{
    lane: ProcessLane;
    top: number;
    height: number;
    centerY: number;
    contentTop: number;
    contentBottom: number;
    bottom: number;
  }>;
}

export interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramPoint {
  x: number;
  y: number;
}

export interface DiagramLayoutData {
  poolBounds: DiagramBounds;
  laneBounds: Record<string, DiagramBounds>;
  nodeBounds: Record<string, DiagramBounds>;
  edgeWaypoints: Record<string, DiagramPoint[]>;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  metrics: LayoutMetrics;
  diagram: DiagramLayoutData;
}

interface FootprintSize {
  width: number;
  height: number;
}

interface RawNodeLayout {
  node: ProcessNode;
  footprint: FootprintSize;
  rawX: number;
  rawY: number;
  laneId: string;
}

type PortSide = 'left' | 'right' | 'top' | 'bottom';

type EndpointRole = 'source' | 'target';

type GatewayFlowRole = 'split' | 'join' | 'mixed';

interface EndpointAssignment {
  source: PortSide;
  target: PortSide;
}

interface RouteSegment {
  start: DiagramPoint;
  end: DiagramPoint;
}

const DEFAULT_NODE_TYPE = 'bpmnNode';
const HORIZONTAL_GAP = 112;
const VERTICAL_GAP = 56;
const MIN_LANE_HEIGHT = 176;
const LANE_GAP = 0;
const LANE_PADDING_Y = 20;
const HEADER_HEIGHT = 0;
const POOL_LABEL_WIDTH = 30;
const CONTENT_PADDING_X = 120;
const CONTENT_PADDING_Y = 28;
const BACKWARD_EDGE_OFFSET_X = 52;
const BACKWARD_EDGE_OFFSET_Y = 36;
const BACKWARD_EDGE_STACK_STEP = 20;
const ROUTE_ESCAPE = 28;
const SHAPE_TOP_PADDING = 4;

function stripConsecutiveDuplicatePoints(points: DiagramPoint[]) {
  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previousPoint = points[index - 1];
    return previousPoint.x !== point.x || previousPoint.y !== point.y;
  });
}

function stripCollinearPoints(points: DiagramPoint[]) {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return true;
    }

    const previousPoint = points[index - 1];
    const nextPoint = points[index + 1];
    const sameX = previousPoint.x === point.x && point.x === nextPoint.x;
    const sameY = previousPoint.y === point.y && point.y === nextPoint.y;
    return !sameX && !sameY;
  });
}

function normalizePoints(points: DiagramPoint[]) {
  return stripCollinearPoints(stripConsecutiveDuplicatePoints(points));
}

function getFootprint(type: NodeType): FootprintSize {
  switch (type) {
    case 'task':
      return TASK_FOOTPRINT;
    case 'startEvent':
    case 'endEvent':
      return EVENT_FOOTPRINT;
    case 'exclusiveGateway':
    case 'parallelGateway':
      return GATEWAY_FOOTPRINT;
  }
}

function getShapeBounds(node: ProcessNode, footprintX: number, footprintY: number): DiagramBounds {
  switch (node.type) {
    case 'task':
      return {
        x: footprintX + (TASK_FOOTPRINT.width - TASK_SIZE.width) / 2,
        y: footprintY + (TASK_FOOTPRINT.height - TASK_SIZE.height) / 2,
        width: TASK_SIZE.width,
        height: TASK_SIZE.height,
      };
    case 'startEvent':
    case 'endEvent':
      return {
        x: footprintX + (EVENT_FOOTPRINT.width - EVENT_SIZE.width) / 2,
        y: footprintY + SHAPE_TOP_PADDING,
        width: EVENT_SIZE.width,
        height: EVENT_SIZE.height,
      };
    case 'exclusiveGateway':
    case 'parallelGateway':
      return {
        x: footprintX + (GATEWAY_FOOTPRINT.width - GATEWAY_SIZE.width) / 2,
        y: footprintY + SHAPE_TOP_PADDING,
        width: GATEWAY_SIZE.width,
        height: GATEWAY_SIZE.height,
      };
  }
}

function getShapeVerticalOffset(type: NodeType) {
  switch (type) {
    case 'task':
      return (TASK_FOOTPRINT.height - TASK_SIZE.height) / 2;
    case 'startEvent':
    case 'endEvent':
    case 'exclusiveGateway':
    case 'parallelGateway':
      return SHAPE_TOP_PADDING;
  }
}

function isGateway(type: NodeType) {
  return type === 'exclusiveGateway' || type === 'parallelGateway';
}

function isEventOrGateway(type: NodeType) {
  return type === 'startEvent' || type === 'endEvent' || isGateway(type);
}

function centerOf(bounds: DiagramBounds): DiagramPoint {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function resolveLaneAssignments(process: ProcessDefinition, laneIds: string[]) {
  const assignments = new Map<string, string>();
  const adjacency = new Map<string, string[]>();
  const nodeById = new Map(process.nodes.map((node) => [node.id, node]));

  process.edges.forEach((edge) => {
    const outgoing = adjacency.get(edge.source) ?? [];
    outgoing.push(edge.target);
    adjacency.set(edge.source, outgoing);

    const incoming = adjacency.get(edge.target) ?? [];
    incoming.push(edge.source);
    adjacency.set(edge.target, incoming);
  });

  process.nodes.forEach((node) => {
    if (node.lane && laneIds.includes(node.lane)) {
      assignments.set(node.id, node.lane);
      return;
    }

    const neighbours = adjacency.get(node.id) ?? [];
    const neighbourLaneCounts = new Map<string, number>();

    neighbours.forEach((neighbourId) => {
      const neighbourNode = nodeById.get(neighbourId);
      if (neighbourNode?.lane && laneIds.includes(neighbourNode.lane)) {
        neighbourLaneCounts.set(neighbourNode.lane, (neighbourLaneCounts.get(neighbourNode.lane) ?? 0) + 1);
      }
    });

    const preferredLane = [...neighbourLaneCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
    assignments.set(node.id, preferredLane ?? laneIds[0]);
  });

  return assignments;
}

function getPortPoint(bounds: DiagramBounds, side: PortSide): DiagramPoint {
  switch (side) {
    case 'left':
      return { x: bounds.x, y: bounds.y + bounds.height / 2 };
    case 'right':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
    case 'top':
      return { x: bounds.x + bounds.width / 2, y: bounds.y };
    case 'bottom':
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
  }
}

function movePoint(point: DiagramPoint, side: PortSide, distance: number): DiagramPoint {
  switch (side) {
    case 'left':
      return { x: point.x - distance, y: point.y };
    case 'right':
      return { x: point.x + distance, y: point.y };
    case 'top':
      return { x: point.x, y: point.y - distance };
    case 'bottom':
      return { x: point.x, y: point.y + distance };
  }
}

function getPreferredPortOrder(self: DiagramPoint, other: DiagramPoint, role?: GatewayFlowRole, endpointRole?: EndpointRole): PortSide[] {
  const dx = other.x - self.x;
  const dy = other.y - self.y;

  let preferred: PortSide[];

  if (Math.abs(dx) >= Math.abs(dy)) {
    preferred = dx >= 0 ? ['right', 'top', 'bottom', 'left'] : ['left', 'top', 'bottom', 'right'];
  } else {
    preferred = dy >= 0 ? ['bottom', 'right', 'left', 'top'] : ['top', 'right', 'left', 'bottom'];
  }

  if (role === 'split' && endpointRole === 'source') {
    preferred = [...preferred.filter((side) => side !== 'left'), 'left'];
  }

  if (role === 'join' && endpointRole === 'target') {
    preferred = [...preferred.filter((side) => side !== 'right'), 'right'];
  }

  return preferred;
}

function assignGatewayPorts(
  process: ProcessDefinition,
  nodeBounds: Record<string, DiagramBounds>,
) {
  const assignments = new Map<string, EndpointAssignment>();

  process.nodes.filter((node) => isGateway(node.type)).forEach((gateway) => {
    const gatewayCenter = centerOf(nodeBounds[gateway.id]);
    const incomingEdges = process.edges.filter((edge) => edge.target === gateway.id);
    const outgoingEdges = process.edges.filter((edge) => edge.source === gateway.id);
    const incomingForwardEdges = incomingEdges.filter((edge) => edge.kind === 'forward');
    const outgoingForwardEdges = outgoingEdges.filter((edge) => edge.kind === 'forward');
    const gatewayRole: GatewayFlowRole = incomingForwardEdges.length > 1 && outgoingForwardEdges.length === 1 ? 'join' : incomingForwardEdges.length === 1 && outgoingForwardEdges.length > 1 ? 'split' : 'mixed';
    const items = process.edges
      .filter((edge) => edge.source === gateway.id || edge.target === gateway.id)
      .map((edge) => {
        const role: EndpointRole = edge.source === gateway.id ? 'source' : 'target';
        const otherNodeId = role === 'source' ? edge.target : edge.source;
        const otherBounds = nodeBounds[otherNodeId];
        const otherCenter = centerOf(otherBounds);
        const preferred = getPreferredPortOrder(gatewayCenter, otherCenter, gatewayRole, role);
        const strength = Math.max(Math.abs(otherCenter.x - gatewayCenter.x), Math.abs(otherCenter.y - gatewayCenter.y));
        return {
          edgeId: edge.id,
          role,
          preferred,
          strength,
        };
      })
      .sort((left, right) => right.strength - left.strength);

    const usedSides = new Set<PortSide>();

    if (gatewayRole === 'split' && incomingForwardEdges[0]) {
      const current = assignments.get(incomingForwardEdges[0].id) ?? { source: 'right' as PortSide, target: 'left' as PortSide };
      current.target = 'left';
      assignments.set(incomingForwardEdges[0].id, current);
      usedSides.add('left');
    }

    if (gatewayRole === 'join' && outgoingForwardEdges[0]) {
      const current = assignments.get(outgoingForwardEdges[0].id) ?? { source: 'right' as PortSide, target: 'left' as PortSide };
      current.source = 'right';
      assignments.set(outgoingForwardEdges[0].id, current);
      usedSides.add('right');
    }

    items.forEach((item) => {
      const existing = assignments.get(item.edgeId);
      if ((item.role === 'source' && existing?.source) || (item.role === 'target' && existing?.target)) {
        return;
      }

      const assignedSide = item.preferred.find((side) => !usedSides.has(side)) ?? item.preferred[0];
      usedSides.add(assignedSide);
      const current = existing ?? { source: 'right' as PortSide, target: 'left' as PortSide };
      if (item.role === 'source') {
        current.source = assignedSide;
      } else {
        current.target = assignedSide;
      }
      assignments.set(item.edgeId, current);
    });
  });

  process.edges.forEach((edge) => {
    const current = assignments.get(edge.id) ?? { source: 'right' as PortSide, target: 'left' as PortSide };
    assignments.set(edge.id, current);
  });

  return assignments;
}

function segmentIntersectsBounds(segment: RouteSegment, bounds: DiagramBounds) {
  if (segment.start.x === segment.end.x) {
    const x = segment.start.x;
    if (x < bounds.x || x > bounds.x + bounds.width) {
      return false;
    }

    const minY = Math.min(segment.start.y, segment.end.y);
    const maxY = Math.max(segment.start.y, segment.end.y);
    return maxY > bounds.y && minY < bounds.y + bounds.height;
  }

  const y = segment.start.y;
  if (y < bounds.y || y > bounds.y + bounds.height) {
    return false;
  }

  const minX = Math.min(segment.start.x, segment.end.x);
  const maxX = Math.max(segment.start.x, segment.end.x);
  return maxX > bounds.x && minX < bounds.x + bounds.width;
}

function buildSegments(points: DiagramPoint[]) {
  const segments: RouteSegment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    segments.push({ start: points[index - 1], end: points[index] });
  }
  return segments;
}

function segmentsIntersect(first: RouteSegment, second: RouteSegment) {
  const firstVertical = first.start.x === first.end.x;
  const secondVertical = second.start.x === second.end.x;

  if (firstVertical === secondVertical) {
    return false;
  }

  const vertical = firstVertical ? first : second;
  const horizontal = firstVertical ? second : first;
  const x = vertical.start.x;
  const y = horizontal.start.y;
  const verticalMinY = Math.min(vertical.start.y, vertical.end.y);
  const verticalMaxY = Math.max(vertical.start.y, vertical.end.y);
  const horizontalMinX = Math.min(horizontal.start.x, horizontal.end.x);
  const horizontalMaxX = Math.max(horizontal.start.x, horizontal.end.x);

  return x > horizontalMinX && x < horizontalMaxX && y > verticalMinY && y < verticalMaxY;
}

function getSharedSegmentPenalty(first: RouteSegment, second: RouteSegment) {
  const firstVertical = first.start.x === first.end.x;
  const secondVertical = second.start.x === second.end.x;

  if (firstVertical !== secondVertical) {
    return 0;
  }

  if (firstVertical) {
    if (first.start.x !== second.start.x) {
      return 0;
    }
    const overlap = Math.min(Math.max(first.start.y, first.end.y), Math.max(second.start.y, second.end.y)) - Math.max(Math.min(first.start.y, first.end.y), Math.min(second.start.y, second.end.y));
    return Math.max(0, overlap);
  }

  if (first.start.y !== second.start.y) {
    return 0;
  }
  const overlap = Math.min(Math.max(first.start.x, first.end.x), Math.max(second.start.x, second.end.x)) - Math.max(Math.min(first.start.x, first.end.x), Math.min(second.start.x, second.end.x));
  return Math.max(0, overlap);
}

function scoreRoute(
  points: DiagramPoint[],
  nodeBounds: Record<string, DiagramBounds>,
  sourceNodeId: string,
  targetNodeId: string,
  existingSegments: RouteSegment[],
) {
  const segments = buildSegments(points);
  const figureCrossings = segments.reduce((count, segment, segmentIndex) => {
    return (
      count +
      Object.entries(nodeBounds).reduce((innerCount, [nodeId, bounds]) => {
        if (nodeId === sourceNodeId && segmentIndex === 0) {
          return innerCount;
        }
        if (nodeId === targetNodeId && segmentIndex === segments.length - 1) {
          return innerCount;
        }
        return innerCount + (segmentIntersectsBounds(segment, bounds) ? 1 : 0);
      }, 0)
    );
  }, 0);

  const edgeCrossings = segments.reduce((count, segment) => {
    return count + existingSegments.reduce((innerCount, existingSegment) => innerCount + (segmentsIntersect(segment, existingSegment) ? 1 : 0), 0);
  }, 0);

  const sharedSegmentPenalty = segments.reduce((count, segment) => {
    return count + existingSegments.reduce((innerCount, existingSegment) => innerCount + getSharedSegmentPenalty(segment, existingSegment), 0);
  }, 0);

  const bends = Math.max(0, points.length - 2);
  const length = segments.reduce(
    (sum, segment) => sum + Math.abs(segment.end.x - segment.start.x) + Math.abs(segment.end.y - segment.start.y),
    0,
  );

  return figureCrossings * 10000 + edgeCrossings * 500 + sharedSegmentPenalty * 16 + bends * 24 + length * 0.02;
}

function buildDirectCandidates(start: DiagramPoint, end: DiagramPoint, sourceSide: PortSide, targetSide: PortSide) {
  const startEscape = movePoint(start, sourceSide, ROUTE_ESCAPE);
  const endEscape = movePoint(end, targetSide, ROUTE_ESCAPE);
  const middleX = startEscape.x + (endEscape.x - startEscape.x) / 2;
  const middleY = startEscape.y + (endEscape.y - startEscape.y) / 2;

  return [
    normalizePoints([start, startEscape, { x: middleX, y: startEscape.y }, { x: middleX, y: endEscape.y }, endEscape, end]),
    normalizePoints([start, startEscape, { x: startEscape.x, y: middleY }, { x: endEscape.x, y: middleY }, endEscape, end]),
  ];
}

function buildCorridorCandidate(
  start: DiagramPoint,
  end: DiagramPoint,
  sourceSide: PortSide,
  targetSide: PortSide,
  corridor: { side: PortSide; value: number },
) {
  const startEscape = movePoint(start, sourceSide, ROUTE_ESCAPE);
  const endEscape = movePoint(end, targetSide, ROUTE_ESCAPE);

  switch (corridor.side) {
    case 'top':
    case 'bottom':
      return normalizePoints([
        start,
        startEscape,
        { x: startEscape.x, y: corridor.value },
        { x: endEscape.x, y: corridor.value },
        endEscape,
        end,
      ]);
    case 'left':
    case 'right':
      return normalizePoints([
        start,
        startEscape,
        { x: corridor.value, y: startEscape.y },
        { x: corridor.value, y: endEscape.y },
        endEscape,
        end,
      ]);
  }
}

function alignEventAndGatewayNodes(
  process: ProcessDefinition,
  nodes: Node[],
  laneAssignments: Map<string, string>,
  laneOffsetMap: Map<string, { contentTop: number; contentBottom: number }>,
) {
  const nodeById = new Map(process.nodes.map((node) => [node.id, node]));
  const positionedById = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  process.edges
    .filter((edge) => edge.kind === 'forward')
    .forEach((edge) => {
      outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
      incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
    });

  process.nodes.forEach((node) => {
    if (!isEventOrGateway(node.type)) {
      return;
    }

    const laneId = laneAssignments.get(node.id);
    if (!laneId) {
      return;
    }

    const currentPosition = positionedById.get(node.id);
    const laneOffset = laneOffsetMap.get(laneId);
    if (!currentPosition || !laneOffset || !currentPosition.height) {
      return;
    }

    const incomingNodes = [...new Set(incoming.get(node.id) ?? [])]
      .map((neighbourId) => nodeById.get(neighbourId))
      .filter((candidate): candidate is ProcessNode => Boolean(candidate))
      .filter((candidate) => laneAssignments.get(candidate.id) === laneId);
    const outgoingNodes = [...new Set(outgoing.get(node.id) ?? [])]
      .map((neighbourId) => nodeById.get(neighbourId))
      .filter((candidate): candidate is ProcessNode => Boolean(candidate))
      .filter((candidate) => laneAssignments.get(candidate.id) === laneId);

    const incomingTasks = incomingNodes.filter((candidate) => candidate.type === 'task');
    const outgoingTasks = outgoingNodes.filter((candidate) => candidate.type === 'task');

    let anchorTask: ProcessNode | undefined;

    if (incomingTasks.length === 1 && outgoingNodes.length !== 1) {
      anchorTask = incomingTasks[0];
    } else if (outgoingTasks.length === 1 && incomingNodes.length !== 1) {
      anchorTask = outgoingTasks[0];
    }

    if (!anchorTask) {
      return;
    }

    const anchorTaskPosition = positionedById.get(anchorTask.id);
    if (!anchorTaskPosition) {
      return;
    }

    const taskShapeBounds = getShapeBounds(anchorTask, anchorTaskPosition.position.x, anchorTaskPosition.position.y);
    const targetCenterY = taskShapeBounds.y + taskShapeBounds.height / 2;
    const shapeHeight = node.type === 'startEvent' || node.type === 'endEvent' ? EVENT_SIZE.height : GATEWAY_SIZE.height;
    const desiredFootprintTop = targetCenterY - getShapeVerticalOffset(node.type) - shapeHeight / 2;
    const minTop = laneOffset.contentTop;
    const maxTop = Math.max(laneOffset.contentTop, laneOffset.contentBottom - currentPosition.height);

    currentPosition.position = {
      ...currentPosition.position,
      y: Math.min(Math.max(desiredFootprintTop, minTop), maxTop),
    };
  });

  return nodes;
}

export function applyDagreLayout(process: ProcessDefinition): LayoutResult {
  const graph = new dagre.graphlib.Graph();

  graph.setGraph({
    rankdir: 'LR',
    ranksep: HORIZONTAL_GAP,
    nodesep: VERTICAL_GAP,
    marginx: CONTENT_PADDING_X + POOL_LABEL_WIDTH,
    marginy: CONTENT_PADDING_Y,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  process.nodes.forEach((node) => {
    const footprint = getFootprint(node.type);
    graph.setNode(node.id, {
      width: footprint.width,
      height: footprint.height,
    });
  });

  process.edges
    .filter((edge) => edge.kind === 'forward')
    .forEach((edge) => {
      graph.setEdge(edge.source, edge.target);
    });

  dagre.layout(graph);

  const laneIds = process.lanes.map((lane) => lane.id);
  const laneAssignments = resolveLaneAssignments(process, laneIds);

  const rawNodeLayouts = new Map(
    process.nodes.map((node) => {
      const layoutNode = graph.node(node.id);
      const footprint = getFootprint(node.type);
      const laneId = laneAssignments.get(node.id) ?? laneIds[0];

      return [
        node.id,
        {
          node,
          footprint,
          rawX: layoutNode.x - footprint.width / 2,
          rawY: layoutNode.y - footprint.height / 2,
          laneId,
        } satisfies RawNodeLayout,
      ];
    }),
  );

  const laneSummaries = process.lanes.map((lane, index) => {
    const laneNodes = process.nodes.filter((node) => laneAssignments.get(node.id) === lane.id);
    const rawTops = laneNodes.map((node) => rawNodeLayouts.get(node.id)?.rawY ?? 0);
    const rawBottoms = laneNodes.map((node) => {
      const rawNode = rawNodeLayouts.get(node.id);
      return rawNode ? rawNode.rawY + rawNode.footprint.height : 0;
    });

    const contentMin = rawTops.length > 0 ? Math.min(...rawTops) : 0;
    const contentMax = rawBottoms.length > 0 ? Math.max(...rawBottoms) : MIN_LANE_HEIGHT - 2 * LANE_PADDING_Y;
    const contentHeight = Math.max(MIN_LANE_HEIGHT - 2 * LANE_PADDING_Y, contentMax - contentMin);
    const height = contentHeight + LANE_PADDING_Y * 2;

    return {
      lane,
      index,
      rawContentTop: contentMin,
      rawContentBottom: contentMax,
      height,
    };
  });

  let currentTop = HEADER_HEIGHT;
  const laneOffsets = laneSummaries.map((summary) => {
    const top = currentTop;
    const bottom = top + summary.height;
    const contentTop = top + LANE_PADDING_Y;
    const contentBottom = bottom - LANE_PADDING_Y;
    currentTop = bottom + LANE_GAP;

    return {
      lane: summary.lane,
      top,
      height: summary.height,
      centerY: contentTop + (contentBottom - contentTop) / 2,
      contentTop,
      contentBottom,
      bottom,
      rawContentTop: summary.rawContentTop,
    };
  });

  const laneOffsetMap = new Map(laneOffsets.map((laneOffset) => [laneOffset.lane.id, laneOffset]));

  const positionedNodes: Node[] = process.nodes.map((node) => {
    const rawNode = rawNodeLayouts.get(node.id)!;
    const laneOffset = laneOffsetMap.get(rawNode.laneId)!;
    const relativeY = rawNode.rawY - laneOffset.rawContentTop;
    const desiredTop = laneOffset.contentTop + relativeY;
    const minTop = laneOffset.contentTop;
    const maxTop = Math.max(laneOffset.contentTop, laneOffset.contentBottom - rawNode.footprint.height);
    const boundedTop = Math.min(Math.max(desiredTop, minTop), maxTop);

    return {
      id: node.id,
      type: DEFAULT_NODE_TYPE,
      data: {
        ...node,
        lane: rawNode.laneId,
      },
      draggable: true,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: rawNode.rawX,
        y: boundedTop,
      },
      width: rawNode.footprint.width,
      height: rawNode.footprint.height,
    };
  });

  alignEventAndGatewayNodes(process, positionedNodes, laneAssignments, laneOffsetMap);

  const nodeById = new Map(process.nodes.map((node) => [node.id, node]));
  const shapeBoundsByNodeId = Object.fromEntries(
    positionedNodes.map((node) => {
      const sourceNode = nodeById.get(node.id)!;
      return [node.id, getShapeBounds(sourceNode, node.position.x, node.position.y)];
    }),
  );

  const maxNodeRight = Math.max(...positionedNodes.map((node) => node.position.x + (node.width ?? 0)));
  const graphWidth = maxNodeRight + CONTENT_PADDING_X;
  const graphHeight = laneOffsets.length > 0 ? laneOffsets[laneOffsets.length - 1].bottom : 0;
  const poolBounds: DiagramBounds = {
    x: 0,
    y: 0,
    width: graphWidth,
    height: graphHeight,
  };

  const laneBounds = Object.fromEntries(
    laneOffsets.map((laneOffset) => [
      laneOffset.lane.id,
      {
        x: POOL_LABEL_WIDTH,
        y: laneOffset.top,
        width: graphWidth - POOL_LABEL_WIDTH,
        height: laneOffset.height,
      } satisfies DiagramBounds,
    ]),
  );

  const portAssignments = assignGatewayPorts(process, shapeBoundsByNodeId);
  const existingSegments: RouteSegment[] = [];
  const allNodeBounds = Object.values(shapeBoundsByNodeId);
  const minNodeX = Math.min(...allNodeBounds.map((bounds) => bounds.x));
  const maxNodeX = Math.max(...allNodeBounds.map((bounds) => bounds.x + bounds.width));
  const minNodeY = Math.min(...allNodeBounds.map((bounds) => bounds.y));
  const maxNodeY = Math.max(...allNodeBounds.map((bounds) => bounds.y + bounds.height));
  const backwardEdges = process.edges.filter((edge) => edge.kind === 'backward');

  const edgeWaypoints = Object.fromEntries(
    process.edges.map((edge) => {
      const sourceBounds = shapeBoundsByNodeId[edge.source];
      const targetBounds = shapeBoundsByNodeId[edge.target];
      const assignment = portAssignments.get(edge.id) ?? { source: 'right' as PortSide, target: 'left' as PortSide };
      const startPoint = getPortPoint(sourceBounds, assignment.source);
      const endPoint = getPortPoint(targetBounds, assignment.target);
      const directCandidates = buildDirectCandidates(startPoint, endPoint, assignment.source, assignment.target);
      const candidates = [...directCandidates];

      if (edge.kind === 'backward') {
        const backwardIndex = backwardEdges.findIndex((candidate) => candidate.id === edge.id);
        candidates.push(
          buildCorridorCandidate(startPoint, endPoint, assignment.source, assignment.target, {
            side: 'top',
            value: Math.max(CONTENT_PADDING_Y / 2, minNodeY - BACKWARD_EDGE_OFFSET_Y - backwardIndex * BACKWARD_EDGE_STACK_STEP),
          }),
          buildCorridorCandidate(startPoint, endPoint, assignment.source, assignment.target, {
            side: 'bottom',
            value: maxNodeY + BACKWARD_EDGE_OFFSET_Y + backwardIndex * BACKWARD_EDGE_STACK_STEP,
          }),
          buildCorridorCandidate(startPoint, endPoint, assignment.source, assignment.target, {
            side: 'left',
            value: minNodeX - BACKWARD_EDGE_OFFSET_X - backwardIndex * BACKWARD_EDGE_STACK_STEP,
          }),
          buildCorridorCandidate(startPoint, endPoint, assignment.source, assignment.target, {
            side: 'right',
            value: maxNodeX + BACKWARD_EDGE_OFFSET_X + backwardIndex * BACKWARD_EDGE_STACK_STEP,
          }),
        );
      }

      const scoredCandidates = candidates
        .map((points) => ({
          points,
          score: scoreRoute(points, shapeBoundsByNodeId, edge.source, edge.target, existingSegments),
        }))
        .sort((left, right) => left.score - right.score);

      const chosenPoints = scoredCandidates[0]?.points ?? [startPoint, endPoint];
      existingSegments.push(...buildSegments(chosenPoints));
      return [edge.id, chosenPoints];
    }),
  );

  const positionedEdges: Edge[] = process.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'waypoints',
    label: edge.label,
    animated: edge.kind === 'backward',
    markerEnd: { type: MarkerType.ArrowClosed },
    style:
      edge.kind === 'backward'
        ? {
            stroke: '#d9485f',
            strokeWidth: 2,
          }
        : {
            stroke: '#2f4558',
            strokeWidth: 1.8,
          },
    labelStyle: {
      fill: edge.kind === 'backward' ? '#a61e4d' : '#20303d',
      fontSize: 12,
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: '#fffaf0',
      fillOpacity: 0.92,
    },
    data: {
      kind: edge.kind,
      waypoints: edgeWaypoints[edge.id],
    },
  }));

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    metrics: {
      laneGap: LANE_GAP,
      lanePaddingY: LANE_PADDING_Y,
      headerHeight: HEADER_HEIGHT,
      poolLabelWidth: POOL_LABEL_WIDTH,
      graphWidth,
      graphHeight,
      laneOffsets: laneOffsets.map(({ rawContentTop: _rawContentTop, ...laneOffset }) => laneOffset),
    },
    diagram: {
      poolBounds,
      laneBounds,
      nodeBounds: shapeBoundsByNodeId,
      edgeWaypoints,
    },
  };
}
