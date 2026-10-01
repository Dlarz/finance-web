import { Icon } from './Icon';

export function Stepper({ value, min = 1, max = 99, onChange, label }: { value: number; min?: number; max?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn btn--icon" aria-label="−" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <Icon name="remove" />
      </button>
      <span className="stepper__value" aria-live="polite">
        {value}
      </span>
      <button type="button" className="btn btn--icon" aria-label="+" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Icon name="add" />
      </button>
    </div>
  );
}
