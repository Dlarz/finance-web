import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/AppState';
import { formatAmount, type TxType } from '../../domain/money';

interface AmountProps {
  value: number;
  type?: TxType;
  /** show +/− from the type (default when a type is given) */
  signed?: boolean;
  /** color from the type */
  colored?: boolean;
  className?: string;
  bare?: boolean;
}

export function Amount({ value, type, signed = !!type, colored = !!type, className = '', bare = false }: AmountProps) {
  const { currency } = useSettings();
  const text = formatAmount(value, { currency, sign: signed ? 'type' : 'none', type, bare });
  const color = colored && type ? (type === 'EXPENSE' ? ' amount--expense' : ' amount--income') : '';
  return <span className={`amount${color}${className ? ` ${className}` : ''}`}>{text}</span>;
}

/** Signed value (negative = red) with a count-up animation when it changes. */
export function AnimatedAmount({ value, className = '', duration = 700 }: { value: number; className?: string; duration?: number }) {
  const { currency } = useSettings();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const startValue = from.current;
    const delta = value - startValue;
    if (delta === 0) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(startValue + delta * eased);
      setDisplay(current);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return (
    <span className={`amount${className ? ` ${className}` : ''}`} data-value={value}>
      {formatAmount(display, { currency, sign: 'value' })}
    </span>
  );
}
