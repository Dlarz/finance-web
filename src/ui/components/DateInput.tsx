import type { ReactNode } from 'react';
import type { ISODate } from '../../domain/dates';

interface DateInputProps {
  value: ISODate | '';
  onChange: (value: ISODate) => void;
  min?: ISODate;
  max?: ISODate;
  children: ReactNode;
  className?: string;
  ariaLabel: string;
  type?: 'date' | 'month';
  testId?: string;
}

/**
 * A styled button with an invisible native <input type="date"> on top, so tapping it opens
 * the iOS date picker while the button keeps the app's look.
 */
export function DateInput({ value, onChange, min, max, children, className = '', ariaLabel, type = 'date', testId }: DateInputProps) {
  return (
    <span className={`native-picker ${className}`}>
      {children}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          if (type === 'month') onChange(`${v}-01`);
          else if (max && v > max) onChange(max);
          else if (min && v < min) onChange(min);
          else onChange(v);
        }}
        data-testid={testId}
      />
    </span>
  );
}
