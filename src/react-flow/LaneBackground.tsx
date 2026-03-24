import { useViewport } from 'reactflow';
import type { LayoutMetrics } from '../layout/applyDagreLayout';

interface LaneBackgroundProps {
  metrics: LayoutMetrics;
  poolLabel: string;
}

export function LaneBackground({ metrics, poolLabel }: LaneBackgroundProps) {
  const { x, y, zoom } = useViewport();
  const laneWidth = metrics.graphWidth - metrics.poolLabelWidth;

  return (
    <div
      className="lane-layer"
      style={{
        width: metrics.graphWidth,
        height: metrics.graphHeight,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      }}
    >
      <div
        className="pool-strip"
        style={{
          width: metrics.poolLabelWidth,
          height: metrics.graphHeight,
        }}
      >
        {poolLabel}
      </div>
      {metrics.laneOffsets.map(({ lane, top, height }) => (
        <div
          key={lane.id}
          className="lane-band"
          style={{
            top,
            left: metrics.poolLabelWidth,
            height,
            width: laneWidth,
          }}
        >
          <div className="lane-band__label">{lane.label}</div>
        </div>
      ))}
    </div>
  );
}