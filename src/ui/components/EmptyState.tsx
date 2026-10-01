import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty anim-in">
      <span className="icon-circle empty__icon">
        <Icon name={icon} />
      </span>
      <div className="empty__title">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {action}
    </div>
  );
}
