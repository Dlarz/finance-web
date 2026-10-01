import { useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from './Icon';

/** Wraps a row: swipe left reveals a red delete area; swiping past the threshold deletes. */
export function SwipeToDelete({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const { t } = useI18n();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const widthRef = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0]!;
    start.current = { x: t0.clientX, y: t0.clientY, horizontal: null };
    widthRef.current = e.currentTarget.clientWidth;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t0 = e.touches[0]!;
    const mx = t0.clientX - s.x;
    const my = t0.clientY - s.y;
    if (s.horizontal === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.horizontal = Math.abs(mx) > Math.abs(my) * 1.2;
      if (s.horizontal) setDragging(true);
    }
    if (!s.horizontal) return;
    setDx(Math.min(0, mx));
  };
  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s?.horizontal) return;
    const threshold = Math.max(96, widthRef.current * 0.4);
    if (-dx > threshold) {
      setDx(-widthRef.current);
      window.setTimeout(onDelete, 160);
    } else if (-dx > 48) {
      setDx(-96);
    } else {
      setDx(0);
    }
  };

  return (
    <div className={`swipe${dragging ? ' swipe--dragging' : ''}`} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div className="swipe__action" aria-hidden="true">
        <Icon name="delete" />
        {t('delete')}
      </div>
      <div className="swipe__content" style={{ transform: `translateX(${dx}px)` }}>
        {dx <= -96 && !dragging && (
          <button type="button" className="visually-hidden" onClick={onDelete}>
            {t('delete')}
          </button>
        )}
        <div onClickCapture={(e) => {
          if (dx !== 0) {
            e.stopPropagation();
            e.preventDefault();
            setDx(0);
          }
        }}>
          {children}
        </div>
      </div>
      {dx <= -96 && !dragging && (
        <button type="button" className="swipe__action" style={{ background: 'transparent' }} onClick={onDelete} aria-label={t('delete')} data-testid="swipe-delete" />
      )}
    </div>
  );
}
