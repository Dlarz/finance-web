import { useEffect, useRef, useState } from 'react';
import { compactNumber } from '../../domain/money';

export interface BarDatum {
  key: string;
  value: number;
  label: string;
  /** full label for the tap tooltip */
  title: string;
  highlighted?: boolean;
}

interface BarChartProps {
  data: BarDatum[];
  color: string;
  formatValue: (value: number) => string;
  /** show every n-th label */
  labelEvery?: number;
}

const W = 320;
const H = 150;
const PAD_L = 30;
const PAD_R = 6;
const PAD_T = 18;
const PAD_B = 22;

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / exp;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * exp;
}

/** Bars over time, drawn as SVG. Bars grow in; tapping a bar shows its value. */
export function BarChart({ data, color, formatValue, labelEvery }: BarChartProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [grow, setGrow] = useState(0);
  const frame = useRef(0);
  const key = data.map((d) => `${d.key}:${d.value}`).join('|');

  useEffect(() => {
    setSelected(null);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setGrow(1);
      return;
    }
    setGrow(0);
    const start = performance.now();
    const tick = (now: number) => {
      const x = Math.min(1, (now - start) / 600);
      setGrow(1 - Math.pow(1 - x, 3));
      if (x < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [key]);

  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const n = Math.max(1, data.length);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.62, 26);
  const every = labelEvery ?? (n > 20 ? 5 : n > 12 ? 2 : 1);
  const ticks = [0, 0.5, 1];

  return (
    <div className="bar-chart" data-testid="bar-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
        {ticks.map((tk) => {
          const y = PAD_T + innerH - innerH * tk;
          return (
            <g key={tk}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--border-strong)" strokeWidth="0.5" strokeDasharray={tk === 0 ? undefined : '2 3'} />
              <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-3)" fontWeight="600">
                {compactNumber(max * tk)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = max > 0 ? (d.value / max) * innerH * grow : 0;
          const x = PAD_L + slot * i + (slot - barW) / 2;
          const y = PAD_T + innerH - h;
          const isSel = selected === d.key;
          return (
            <g key={d.key} onClick={() => setSelected(isSel ? null : d.key)} style={{ cursor: 'pointer' }} data-testid="bar">
              <rect x={PAD_L + slot * i} y={PAD_T} width={slot} height={innerH} fill="transparent" />
              <rect x={x} y={y} width={barW} height={h} rx={Math.min(4, barW / 2)} fill={d.highlighted || isSel ? color : `color-mix(in srgb, ${color} 55%, var(--surface-3))`} style={{ transition: 'fill 150ms' }} />
              {d.highlighted && <circle cx={x + barW / 2} cy={H - 4} r="1.6" fill={color} />}
              {(i % every === 0 || d.highlighted) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="8" fill={d.highlighted ? color : 'var(--text-3)'} fontWeight={d.highlighted ? 700 : 600}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        {selected &&
          (() => {
            const i = data.findIndex((d) => d.key === selected);
            const d = data[i];
            if (!d) return null;
            const h = max > 0 ? (d.value / max) * innerH : 0;
            const cx = PAD_L + slot * i + slot / 2;
            const text = `${d.title} · ${formatValue(d.value)}`;
            const tw = Math.min(W - 8, text.length * 4.6 + 12);
            const bx = Math.max(4, Math.min(W - tw - 4, cx - tw / 2));
            const by = Math.max(0, PAD_T + innerH - h - 20);
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={bx} y={by} width={tw} height="14" rx="4" fill="var(--text)" />
                <text x={bx + tw / 2} y={by + 9.5} textAnchor="middle" fontSize="7.5" fill="var(--bg)" fontWeight="600">
                  {text}
                </text>
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
