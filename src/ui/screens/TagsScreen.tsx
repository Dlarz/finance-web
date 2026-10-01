import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../app/container';
import { useDialogs } from '../../app/dialogs';
import { deleteTag, listTagsWithUsage, renameTag, type TagUsage } from '../../data/tagsRepo';
import { useI18n } from '../../i18n';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';

export function TagsScreen() {
  const { t } = useI18n();
  const dialogs = useDialogs();
  const tags = useLiveQuery(() => listTagsWithUsage(db), []);
  const [editing, setEditing] = useState<TagUsage | null>(null);

  const remove = async (tag: TagUsage) => {
    if (await dialogs.confirm({ title: t('deleteTagTitle'), text: t('deleteTagText', { n: tag.count }), confirmLabel: t('delete'), danger: true })) await deleteTag(db, tag.id);
  };

  return (
    <Screen title={t('manageTags')} back testId="tags-screen">
      {tags && tags.length === 0 && <EmptyState icon="sell" title={t('tagsEmptyTitle')} text={t('tagsEmptyText')} />}
      {tags && tags.length > 0 && (
        <div className="list list--card">
          {tags.map((tag) => (
            <div key={tag.id} className="settings-row" data-testid="tag-row">
              <button type="button" className="row-flex grow" style={{ minHeight: 'var(--touch)', textAlign: 'left' }} onClick={() => setEditing(tag)} aria-label={`${t('rename')} ${tag.name}`}>
                <span className="icon-circle icon-circle--soft settings-row__icon">
                  <Icon name="sell" />
                </span>
                <span className="settings-row__body">
                  <span className="settings-row__title" style={{ overflowWrap: 'anywhere' }}>
                    {tag.name}
                  </span>
                  <span className="settings-row__hint">{tag.count === 1 ? t('usedInOne') : t('usedIn', { n: tag.count })}</span>
                </span>
              </button>
              <button type="button" className="btn btn--icon" aria-label={`${t('delete')} ${tag.name}`} onClick={() => void remove(tag)}>
                <Icon name="delete" style={{ color: 'var(--text-3)' }} />
              </button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <RenameDialog
          tag={editing}
          onClose={() => setEditing(null)}
          onSave={async (name) => {
            await renameTag(db, editing.id, name);
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}

function RenameDialog({ tag, onClose, onSave }: { tag: TagUsage; onClose: () => void; onSave: (name: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(tag.name);
  const valid = name.trim().length > 0;
  return (
    <div className="overlay overlay--center" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(name);
        }}
      >
        <h2 className="dialog__title">{t('renameTag')}</h2>
        <input className="input" value={name} autoFocus maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={t('name')} data-testid="rename-input" />
        <p className="hint">{t('renameMergeHint')}</p>
        <div className="dialog__actions dialog__actions--row">
          <button type="button" className="btn btn--tonal" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid}>
            {t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
