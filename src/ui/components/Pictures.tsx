import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from './Icon';

export interface PictureItem {
  id: string;
  blob: Blob;
  thumb: Blob;
}

/** Object URL for a blob, revoked on unmount. */
export function useObjectUrl(blob: Blob | null | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

function Thumb({ item, onClick, onRemove }: { item: PictureItem; onClick: () => void; onRemove?: () => void }) {
  const { t } = useI18n();
  const url = useObjectUrl(item.thumb);
  return (
    <div className="thumb anim-in">
      <button type="button" onClick={onClick} aria-label={t('photoViewer')} style={{ width: '100%', height: '100%' }}>
        {url && <img src={url} alt="" />}
      </button>
      {onRemove && (
        <button type="button" className="thumb__remove" aria-label={t('deletePicture')} onClick={onRemove} data-testid="thumb-remove">
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

interface PictureGridProps {
  items: PictureItem[];
  onRemove?: (id: string) => void;
  onAdd?: (files: File[]) => void;
  busy?: boolean;
}

export function PictureGrid({ items, onRemove, onAdd, busy }: PictureGridProps) {
  const { t } = useI18n();
  const [viewer, setViewer] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="thumbs" data-testid="pictures">
        {items.map((item, i) => (
          <Thumb key={item.id} item={item} onClick={() => setViewer(i)} onRemove={onRemove ? () => onRemove(item.id) : undefined} />
        ))}
        {onAdd && (
          <>
            <button type="button" className="thumb thumb--add" onClick={() => inputRef.current?.click()} aria-label={t('addPicture')} disabled={busy} data-testid="add-picture">
              <Icon name={busy ? 'refresh' : 'add_a_photo'} />
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="visually-hidden"
              tabIndex={-1}
              data-testid="picture-input"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length) onAdd(files);
              }}
            />
          </>
        )}
      </div>
      {viewer !== null && <PictureViewer items={items} index={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}

function Slide({ item, active }: { item: PictureItem; active: boolean }) {
  const url = useObjectUrl(item.blob);
  const imgRef = useRef<HTMLImageElement>(null);
  const state = useRef({ scale: 1, x: 0, y: 0, startDist: 0, startScale: 1, lastX: 0, lastY: 0, panning: false, lastTap: 0 });

  useEffect(() => {
    if (!active) {
      state.current = { ...state.current, scale: 1, x: 0, y: 0 };
      apply();
    }
  }, [active]);

  const apply = () => {
    const s = state.current;
    if (imgRef.current) imgRef.current.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
  };

  const dist = (touches: React.TouchList) => {
    const a = touches[0]!;
    const b = touches[1]!;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  return (
    <div
      className="viewer__slide"
      style={{ touchAction: state.current.scale > 1 ? 'none' : 'pan-x' }}
      onTouchStart={(e) => {
        const s = state.current;
        if (e.touches.length === 2) {
          s.startDist = dist(e.touches);
          s.startScale = s.scale;
        } else if (e.touches.length === 1) {
          const now = Date.now();
          if (now - s.lastTap < 300) {
            s.scale = s.scale > 1 ? 1 : 2.5;
            s.x = 0;
            s.y = 0;
            apply();
          }
          s.lastTap = now;
          s.lastX = e.touches[0]!.clientX;
          s.lastY = e.touches[0]!.clientY;
          s.panning = s.scale > 1;
        }
      }}
      onTouchMove={(e) => {
        const s = state.current;
        if (e.touches.length === 2) {
          e.preventDefault();
          s.scale = Math.min(6, Math.max(1, (s.startScale * dist(e.touches)) / s.startDist));
          if (s.scale === 1) {
            s.x = 0;
            s.y = 0;
          }
          apply();
        } else if (e.touches.length === 1 && s.panning) {
          e.preventDefault();
          const t = e.touches[0]!;
          s.x += t.clientX - s.lastX;
          s.y += t.clientY - s.lastY;
          s.lastX = t.clientX;
          s.lastY = t.clientY;
          apply();
        }
      }}
      onTouchEnd={() => {
        state.current.panning = state.current.scale > 1;
      }}
    >
      {url && <img ref={imgRef} src={url} alt="" draggable={false} />}
    </div>
  );
}

/** Fullscreen viewer: swipe between pictures (scroll snap), pinch or double-tap to zoom. */
export function PictureViewer({ items, index, onClose }: { items: PictureItem[]; index: number; onClose: () => void }) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(index);

  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = index * track.clientWidth;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={t('photoViewer')} data-testid="picture-viewer">
      <div className="viewer__bar">
        <span className="small" style={{ fontWeight: 600 }}>
          {t('pictureOf', { i: current + 1, n: items.length })}
        </span>
        <button type="button" className="btn btn--icon" aria-label={t('close')} onClick={onClose} style={{ color: '#fff' }}>
          <Icon name="close" />
        </button>
      </div>
      <div
        ref={trackRef}
        className="viewer__track"
        onScroll={(e) => {
          const el = e.currentTarget;
          setCurrent(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {items.map((item, i) => (
          <Slide key={item.id} item={item} active={i === current} />
        ))}
      </div>
    </div>
  );
}
