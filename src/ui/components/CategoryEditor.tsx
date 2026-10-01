import { useState } from 'react';
import { CATEGORY_COLORS } from '../../data/defaultCategories';
import type { TxType } from '../../data/types';
import { useI18n } from '../../i18n';
import { CATEGORY_ICON_KEYS } from '../../icons/iconPaths';
import { CategoryIcon, Icon } from './Icon';

export interface CategoryDraft {
  name: string;
  iconKey: string;
  colorHex: string;
}

interface CategoryEditorProps {
  type: TxType;
  initial?: CategoryDraft;
  onCancel: () => void;
  onSave: (draft: CategoryDraft) => void;
}

const PICKER_ICONS = CATEGORY_ICON_KEYS.slice(0, 44);

/** Dialog with a name field, an icon picker and a color picker. */
export function CategoryEditor({ initial, onCancel, onSave }: CategoryEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [iconKey, setIconKey] = useState(initial?.iconKey ?? 'category');
  const [colorHex, setColorHex] = useState(initial?.colorHex ?? CATEGORY_COLORS[3]);
  const [touched, setTouched] = useState(false);
  const valid = name.trim().length > 0;

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cat-title" style={{ maxWidth: '26rem' }} data-testid="category-editor">
      <div className="row-flex">
        <CategoryIcon iconKey={iconKey} colorHex={colorHex} size="3rem" />
        <h2 id="cat-title" className="dialog__title grow">
          {initial ? t('editCategoryTitle') : t('newCategoryTitle')}
        </h2>
      </div>
      <label className="field">
        <span className="field__label">{t('name')}</span>
        <input
          className="input"
          value={name}
          placeholder={t('namePlaceholder')}
          maxLength={40}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          data-testid="category-name"
        />
        {touched && !valid && <span className="error">{t('errorName')}</span>}
      </label>
      <div className="field">
        <span className="field__label">{t('icon')}</span>
        <div className="icon-grid" role="radiogroup" aria-label={t('icon')}>
          {PICKER_ICONS.map((key) => (
            <button key={key} type="button" className="icon-choice" aria-pressed={key === iconKey} onClick={() => setIconKey(key)} aria-label={key.replace(/_/g, ' ')}>
              <Icon name={key} />
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field__label">{t('color')}</span>
        <div className="color-grid" role="radiogroup" aria-label={t('color')}>
          {CATEGORY_COLORS.map((c) => (
            <button key={c} type="button" className="color-dot" style={{ background: c }} aria-pressed={c === colorHex} onClick={() => setColorHex(c)} aria-label={c}>
              {c === colorHex && <Icon name="check" />}
            </button>
          ))}
        </div>
      </div>
      <div className="dialog__actions dialog__actions--row">
        <button type="button" className="btn btn--tonal" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={() => onSave({ name: name.trim(), iconKey, colorHex })} data-testid="category-save">
          {t('save')}
        </button>
      </div>
    </div>
  );
}
