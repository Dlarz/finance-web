import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: string;
  children: ReactNode;
  className?: string;
  removeLabel?: string;
  soft?: boolean;
  testId?: string;
}

export function Chip({ selected, onClick, onRemove, icon, children, className = '', removeLabel = 'Remove', soft, testId }: ChipProps) {
  const cls = `chip${soft ? ' chip--soft' : ''}${className ? ` ${className}` : ''}`;
  if (onRemove && !onClick) {
    return (
      <span className={cls} data-testid={testId}>
        {icon && <Icon name={icon} />}
        <span className="chip__label">{children}</span>
        <button type="button" className="chip__remove" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="close" />
        </button>
      </span>
    );
  }
  return (
    <button type="button" className={cls} aria-pressed={selected} onClick={onClick} data-testid={testId}>
      {icon && <Icon name={icon} />}
      <span className="chip__label">{children}</span>
      {onRemove && (
        <span
          className="chip__remove"
          role="button"
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Icon name="close" />
        </span>
      )}
    </button>
  );
}
