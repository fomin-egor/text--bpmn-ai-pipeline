import dagre from '@dagrejs/dagre';
import { MarkerType, Position } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import type { ProcessDefinition, ProcessLane } from '../process-model/types';

export interface LayoutMetrics {
  laneHeight: number;
  laneGap: number;
  lanePaddingY: number;
  headerHeight: number;
  graphWidth: number;
  graphHeight: number;
  laneOffsets: Array<{
    lane: ProcessLane;
    top: number;
    centerY: number;
    contentTop: number;
    contentBottom: number;
    bottom: number;
  }>;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  metrics: LayoutMetrics;
}

const DEFAULT_NODE_TYPE = 'bpmnNode';
const HORIZONTAL_GAP = 90;
const VERTICAL_GAP = 44;
const LANE_HEIGHT = 176;
const LANE_GAP = 18;
const LANE_PADDING_Y = 20;
const HEADER_HEIGHT = 52;
const CONTENT_PADDING_X = 120;
const CONTENT_PADDING_Y = 28;

const getLaneTop = (laneIndex: number) => HEADER_HEIGHT + CONTENT_PADDING_Y + laneIndex * (LANE_HEIGHT + LANE_GAP);

export function applyDagreLayout(process: ProcessDefinition): LayoutResult {
  const graph = new dagre.graphlib.Graph();

  graph.setGraph({
    rankdir: 'LR',
    ranksep: HORIZONTAL_GAP,
    nodesep: VERTICAL_GAP,
    marginx: CONTENT_PADDING_X,
    marginy: CONTENT_PADDING_Y,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const laneOffsets = process.lanes.map((lane, index) => {
    const top = getLaneTop(index);
    const bottom = top + LANE_HEIGHT;
    const contentTop = top + LANE_PADDING_Y;
    const contentBottom = bottom - LANE_PADDING_Y;

    return {
      lane,
      top,
      centerY: contentTop + (contentBottom - contentTop) / 2,
      contentTop,
      contentBottom,
      bottom,
    };
  });

  const laneOffsetMap = new Map(laneOffsets.map((laneOffset) => [laneOffset.lane.id, laneOffset]));

  process.nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: node.size.width,
      height: node.size.height,
    });
  });

  process.edges
    .filter((edge) => edge.kind === 'forward')
    .forEach((edge) => {
      graph.setEdge(edge.source, edge.target);
    });

  dagre.layout(graph);

  const positionedNodes: Node[] = process.nodes.map((node) => {
    const layoutNode = graph.node(node.id);
    const laneOffset = laneOffsetMap.get(node.lane) ?? laneOffsets[0];
    const desiredTop = laneOffset.centerY - node.size.height / 2;
    const minTop = laneOffset.contentTop;
    const maxTop = laneOffset.contentBottom - node.size.height;
    const boundedTop = Math.min(Math.max(desiredTop, minTop), maxTop);

    return {
      id: node.id,
      type: DEFAULT_NODE_TYPE,
      data: {
        ...node,
      },
      draggable: true,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: layoutNode.x - node.size.width / 2,
        y: boundedTop,
      },
      width: node.size.width,
      height: node.size.height,
    };
  });

  const maxNodeRight = Math.max(...positionedNodes.map((node) => node.position.x + (node.width ?? 0)));
  const graphWidth = maxNodeRight + CONTENT_PADDING_X;
  const graphHeight = laneOffsets.at(-1)?.bottom ? laneOffsets[laneOffsets.length - 1].bottom + CONTENT_PADDING_Y : 0;

  const positionedEdges: Edge[] = process.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
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
    },
  }));

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    metrics: {
      laneHeight: LANE_HEIGHT,
      laneGap: LANE_GAP,
      lanePaddingY: LANE_PADDING_Y,
      headerHeight: HEADER_HEIGHT,
      graphWidth,
      graphHeight,
      laneOffsets,
    },
  };
}