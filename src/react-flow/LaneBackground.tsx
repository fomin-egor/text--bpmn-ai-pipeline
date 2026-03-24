import { useViewport } from 'reactflow';
import type { LayoutMetrics } from '../layout/applyDagreLayout';

interface LaneBackgroundProps {
  metrics: LayoutMetrics;
  poolLabel: string;
}

export function LaneBackground({ metrics, poolLabel }: LaneBackgroundProps) {
  const { x, y, zoom } = useViewport();

  return (
    <div
      className="lane-layer"
      style={{
        width: metrics.graphWidth,
        height: metrics.graphHeight,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      }}
    >
      <div className="pool-header">{poolLabel}</div>
      {metrics.laneOffsets.map(({ lane, top }) => (
        <div
          key={lane.id}
          className="lane-band"
          style={{
            top,
            height: metrics.laneHeight,
            width: metrics.graphWidth,
          }}
        >
          <div className="lane-band__label">{lane.label}</div>
        </div>
      ))}
    </div>
  );
}