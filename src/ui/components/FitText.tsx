import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface FitTextProps {
  children: ReactNode;
  /** rem */
  max?: number;
  /** rem */
  min?: number;
  className?: string;
  lines?: number;
}

/**
 * Text that never breaks inside a word: at most `lines` lines, breaks only between words,
 * and the font shrinks (down to `min`) when the longest word does not fit the width.
 */
export function FitText({ children, max = 0.75, min = 0.5, className = '', lines = 2 }: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(max);
  const text = typeof children === 'string' ? children : '';

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const ps = getComputedStyle(parent);
      const width = parent.clientWidth - (parseFloat(ps.paddingLeft) || 0) - (parseFloat(ps.paddingRight) || 0);
      if (width <= 0) return;
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0;';
      const cs = getComputedStyle(el);
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.fontStyle = cs.fontStyle;
      probe.style.letterSpacing = cs.letterSpacing;
      document.body.appendChild(probe);
      const words = (el.textContent ?? '').split(/\s+/).filter(Boolean);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      let chosen = max;
      for (let s = max; s >= min - 1e-6; s -= 0.0625) {
        probe.style.fontSize = `${s * rem}px`;
        let longest = 0;
        for (const w of words) {
          probe.textContent = w;
          longest = Math.max(longest, probe.getBoundingClientRect().width);
        }
        chosen = s;
        if (longest > width - 2) continue;
        // the longest word fits: check that the whole text fits into the allowed lines
        el.style.fontSize = `${s}rem`;
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || s * rem * 1.2;
        if (el.scrollHeight <= lineHeight * lines + 2) break;
      }
      probe.remove();
      setSize((prev) => (Math.abs(prev - chosen) < 1e-6 ? prev : chosen));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    return () => ro?.disconnect();
  }, [text, max, min]);

  return (
    <span ref={ref} className={`fit-text${className ? ` ${className}` : ''}`} style={{ fontSize: `${size}rem`, WebkitLineClamp: lines, lineClamp: lines } as React.CSSProperties} title={text || undefined}>
      {children}
    </span>
  );
}
