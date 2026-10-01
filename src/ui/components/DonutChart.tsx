import { useEffect, useRef, useState } from 'react';
import type { DonutSegment } from '../../domain/statistics';

export interface DonutDatum extends DonutSegment {
  color: string;
  label: string;
}

interface DonutChartProps {
  segments: DonutDatum[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** ring stroke width in viewBox units (viewBox 100) */
  thickness?: number;
  children?: React.ReactNode;
}

const R = 40;
const C = 2 * Math.PI * R;
const GAP_DEG = 2.5;

function useProgress(key: string, duration = 900): number {
  const [p, setP] = useState(0);
  const frame = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setP(1);
      return;
    }
    setP(0);
    const start = performance.now();
    const tick = (now: number) => {
      const x = Math.min(1, (now - start) / duration);
      setP(1 - Math.pow(1 - x, 3));
      if (x < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [key, duration]);
  return p;
}

/**
 * Donut chart drawn as SVG arcs. Draws itself in, animates when the data changes, and lets the
 * user tap a segment to highlight it.
 */
export function DonutChart({ segments, selectedId, onSelect, thickness = 13, children }: DonutChartProps) {
  const key = segments.map((s) => `${s.id}:${s.amount}`).join('|');
  const progress = useProgress(key);
  const total = segments.reduce((s, x) => s + x.amount, 0);
  const n = segments.length;
  const gapTotal = n > 1 ? GAP_DEG * n : 0;
  const usable = 360 - gapTotal;
  let angle = -90;

  return (
    <div className="donut-wrap" data-testid="donut">
      <svg viewBox="0 0 100 100" role="img" aria-label="Donut chart">
        {total <= 0 ? (
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--neutral-ring)" strokeWidth={thickness} />
        ) : (
          segments.map((seg) => {
            const sweep = (seg.amount / total) * usable;
            const startAngle = angle;
            angle += sweep + (n > 1 ? GAP_DEG : 0);
            const visibleSweep = Math.max(0, Math.min(sweep, (progress * 360 - (startAngle + 90)) ));
            if (visibleSweep <= 0) return null;
            const selected = selectedId === seg.id;
            const dimmed = selectedId !== null && !selected;
            const length = (visibleSweep / 360) * C;
            const offset = -((startAngle + 90) / 360) * C;
            return (
              <circle
                key={seg.id}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={selected ? thickness + 4 : thickness}
                strokeDasharray={`${length} ${C - length}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                opacity={dimmed ? 0.3 : 1}
                style={{ transition: 'stroke-width 200ms var(--ease), opacity 200ms', cursor: 'pointer' }}
                onClick={() => onSelect(selected ? null : seg.id)}
                data-testid={`donut-segment-${seg.id}`}
              >
                <title>{seg.label}</title>
              </circle>
            );
          })
        )}
        {/* transparent center hit area to reset */}
        <circle cx="50" cy="50" r={R - thickness} fill="transparent" onClick={() => onSelect(null)} style={{ cursor: selectedId ? 'pointer' : 'default' }} />
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  );
}
