import { FitText } from './FitText';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export function Segmented<T extends string>({ value, options, onChange, className = '', ariaLabel }: { value: T; options: SegmentOption<T>[]; onChange: (v: T) => void; className?: string; ariaLabel?: string }) {
  return (
    <div className={`segmented${className ? ` ${className}` : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" className="segmented__item" aria-pressed={o.value === value} onClick={() => onChange(o.value)} data-testid={`segment-${o.value}`}>
          {o.icon}
          <FitText max={0.9375} min={0.5625} lines={1}>
            {o.label}
          </FitText>
        </button>
      ))}
    </div>
  );
}
