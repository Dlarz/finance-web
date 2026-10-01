import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../../app/container';
import { useDialogs } from '../../app/dialogs';
import { addCategory, categoryUsage, deleteCategory, reorderCategories, sortCategories, updateCategory } from '../../data/categoriesRepo';
import type { Category, TxType } from '../../data/types';
import { useI18n } from '../../i18n';
import { CategoryEditor } from '../components/CategoryEditor';
import { CategoryIcon, Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

export function CategoriesScreen() {
  const { t } = useI18n();
  const dialogs = useDialogs();
  const [type, setType] = useState<TxType>('EXPENSE');
  const all = useLiveQuery(() => db.categories.where('type').equals(type).toArray(), [type]);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [order, setOrder] = useState<Category[]>([]);
  const dragging = useRef<{ id: string; startY: number; startIndex: number; rowHeight: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (all && dragIndex === null) setOrder(sortCategories(all));
  }, [all, dragIndex]);

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    const row = (e.currentTarget as HTMLElement).closest('.settings-row') as HTMLElement | null;
    dragging.current = { id: order[index]!.id, startY: e.clientY, startIndex: index, rowHeight: row?.offsetHeight ?? 56 };
    setDragIndex(index);
    setDragOffset(0);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragging.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    setDragOffset(dy);
    const target = Math.max(0, Math.min(order.length - 1, d.startIndex + Math.round(dy / d.rowHeight)));
    const currentIndex = order.findIndex((c) => c.id === d.id);
    if (target !== currentIndex) {
      const next = [...order];
      const [item] = next.splice(currentIndex, 1);
      next.splice(target, 0, item!);
      setOrder(next);
      setDragIndex(target);
      d.startY = e.clientY - (target - d.startIndex) * d.rowHeight;
      setDragOffset(e.clientY - d.startY);
    }
  };
  const onPointerUp = () => {
    const d = dragging.current;
    dragging.current = null;
    setDragIndex(null);
    setDragOffset(0);
    if (d) void reorderCategories(db, type, order.map((c) => c.id));
  };

  const remove = async (cat: Category) => {
    if (cat.isDefaultOther) {
      await dialogs.confirm({ title: t('cannotDeleteOther'), confirmLabel: t('ok') });
      return;
    }
    const usage = await categoryUsage(db, cat.id);
    const total = usage.transactions + usage.rules;
    const candidates = order.filter((c) => c.id !== cat.id);
    if (total === 0) {
      if (await dialogs.confirm({ title: t('deleteCategoryTitle'), text: t('deleteCategoryEmpty'), confirmLabel: t('delete'), danger: true })) await deleteCategory(db, cat.id, null);
      return;
    }
    dialogs.open((close) => (
      <div className="dialog" role="dialog" aria-modal="true" data-testid="move-category-dialog">
        <h2 className="dialog__title">{t('deleteCategoryTitle')}</h2>
        <p className="dialog__text">{t('deleteCategoryMove', { n: total })}</p>
        <div className="list" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              className="row row--plain"
              style={{ background: 'transparent', minHeight: '3rem', padding: '0.5rem 0' }}
              onClick={async () => {
                await deleteCategory(db, cat.id, c.id);
                close();
              }}
            >
              <CategoryIcon iconKey={c.iconKey} colorHex={c.colorHex} size="2rem" />
              <span className="row__title grow">{c.name}</span>
            </button>
          ))}
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn btn--tonal" onClick={close}>
            {t('cancel')}
          </button>
        </div>
      </div>
    ));
  };

  return (
    <Screen
      title={t('manageCategories')}
      back
      testId="categories-screen"
      actions={
        <button type="button" className="btn btn--icon" aria-label={t('addCategory')} onClick={() => setEditing('new')} data-testid="add-category">
          <Icon name="add" />
        </button>
      }
    >
      <div className="stack">
        <Segmented<TxType>
          value={type}
          options={[
            { value: 'EXPENSE', label: t('expenses') },
            { value: 'INCOME', label: t('incomes') },
          ]}
          onChange={setType}
        />
        <p className="hint">{t('reorderHint')}</p>
        <div className="list list--card" ref={listRef} data-testid="category-manage-list">
          {order.map((c, i) => (
            <div
              key={c.id}
              className={`settings-row${dragIndex === i ? ' reorder-row--dragging' : ''}`}
              style={dragIndex === i ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : { transition: 'transform 150ms var(--ease)' }}
              data-testid="category-manage-row"
            >
              <button type="button" className="row-flex" style={{ minHeight: 'var(--touch)', textAlign: 'left', flex: '1 1 0', minWidth: 0 }} onClick={() => setEditing(c)} aria-label={`${t('edit')} ${c.name}`}>
                <CategoryIcon iconKey={c.iconKey} colorHex={c.colorHex} size="2.25rem" />
                <span className="settings-row__title grow" style={{ overflowWrap: 'anywhere' }}>
                  {c.name}
                </span>
              </button>
              {!c.isDefaultOther && (
                <button type="button" className="btn btn--icon" aria-label={`${t('delete')} ${c.name}`} onClick={() => void remove(c)}>
                  <Icon name="delete" style={{ color: 'var(--text-3)' }} />
                </button>
              )}
              <span className="drag-handle" role="button" aria-label={`${t('moveUp')} / ${t('moveDown')}`} onPointerDown={(e) => onPointerDown(e, i)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
                <Icon name="drag_indicator" />
              </span>
            </div>
          ))}
        </div>
      </div>
      {editing && (
        <div className="overlay overlay--center" role="presentation" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <CategoryEditor
            type={type}
            initial={editing === 'new' ? undefined : { name: editing.name, iconKey: editing.iconKey, colorHex: editing.colorHex }}
            onCancel={() => setEditing(null)}
            onSave={async (draft) => {
              if (editing === 'new') await addCategory(db, { ...draft, type });
              else await updateCategory(db, editing.id, draft);
              setEditing(null);
            }}
          />
        </div>
      )}
    </Screen>
  );
}
