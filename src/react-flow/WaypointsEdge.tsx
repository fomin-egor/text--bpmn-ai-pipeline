import type { EdgeProps } from 'reactflow';
import { BaseEdge, EdgeLabelRenderer, Position, getBezierPath } from 'reactflow';
import type { DiagramPoint } from '../layout/applyDagreLayout';

interface WaypointsEdgeData {
  waypoints?: DiagramPoint[];
  kind?: 'forward' | 'backward';
}

const CORNER_RADIUS = 8;

function buildRoundedPath(points: DiagramPoint[]) {
  if (points.length < 2) {
    return '';
  }

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const pathParts = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    const prevDistance = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const nextDistance = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const radius = Math.min(CORNER_RADIUS, prevDistance / 2, nextDistance / 2);

    const entry = {
      x: current.x + Math.sign(previous.x - current.x) * radius,
      y: current.y + Math.sign(previous.y - current.y) * radius,
    };
    const exit = {
      x: current.x + Math.sign(next.x - current.x) * radius,
      y: current.y + Math.sign(next.y - current.y) * radius,
    };

    pathParts.push(`L ${entry.x} ${entry.y}`);
    pathParts.push(`Q ${current.x} ${current.y} ${exit.x} ${exit.y}`);
  }

  const lastPoint = points[points.length - 1];
  pathParts.push(`L ${lastPoint.x} ${lastPoint.y}`);
  return pathParts.join(' ');
}

function getLabelPoint(points: DiagramPoint[]) {
  const middlePoint = points[Math.floor(points.length / 2)] ?? points[0] ?? { x: 0, y: 0 };
  return middlePoint;
}

export function WaypointsEdge({
  id,
  data,
  label,
  markerEnd,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  labelStyle,
  labelBgStyle,
}: EdgeProps<WaypointsEdgeData>) {
  const waypoints = data?.waypoints ?? [];

  if (waypoints.length < 2) {
    const [fallbackPath] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    return <BaseEdge id={id} path={fallbackPath} markerEnd={markerEnd} style={style} />;
  }

  const path = buildRoundedPath(waypoints);
  const labelPoint = getLabelPoint(waypoints);

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px)`,
              pointerEvents: 'none',
              padding: '2px 6px',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
              ...labelBgStyle,
              ...labelStyle,
            }}
            className="react-flow__edge-textwrapper"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
