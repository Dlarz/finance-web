import { useMemo, useRef, useState } from 'react';
import { normalizeTagName } from '../../data/tagsRepo';
import { useI18n } from '../../i18n';
import { Chip } from './Chip';
import { Icon } from './Icon';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** existing tags, most used first */
  suggestions: string[];
  onFocus?: () => void;
}

export function TagInput({ tags, onChange, suggestions, onFocus }: TagInputProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const name = normalizeTagName(raw);
    if (!name) return;
    if (tags.some((x) => x.toLowerCase() === name.toLowerCase())) {
      setText('');
      return;
    }
    onChange([...tags, name]);
    setText('');
  };

  const remove = (name: string) => onChange(tags.filter((x) => x !== name));

  const matching = useMemo(() => {
    const q = text.trim().toLowerCase();
    const lowerTags = new Set(tags.map((x) => x.toLowerCase()));
    return suggestions.filter((s) => !lowerTags.has(s.toLowerCase()) && (q === '' || s.toLowerCase().includes(q))).slice(0, 8);
  }, [text, suggestions, tags]);

  return (
    <div className="stack stack--tight">
      <div className="input-wrap" onClick={() => inputRef.current?.focus()}>
        <Icon name="sell" />
        <div className="chips" style={{ flex: '1 1 auto', alignItems: 'center', padding: '0.25rem 0' }}>
          {tags.map((tag) => (
            <Chip key={tag} className="chip--tag" onRemove={() => remove(tag)} removeLabel={`${t('remove')} ${tag}`} testId="tag-chip">
              {tag}
            </Chip>
          ))}
          <input
            ref={inputRef}
            className="input"
            style={{ minHeight: '2.125rem', flex: '1 1 6rem', padding: 0 }}
            value={text}
            placeholder={tags.length === 0 ? t('tagsPlaceholder') : ''}
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="done"
            aria-label={t('tags')}
            data-testid="tag-input"
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
            onBlur={() => {
              setFocused(false);
              if (text.trim()) add(text);
            }}
            onChange={(e) => {
              const v = e.target.value;
              if (v.includes(',')) {
                for (const part of v.split(',')) add(part);
                setText('');
              } else setText(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(text);
              } else if (e.key === 'Backspace' && text === '' && tags.length) {
                remove(tags[tags.length - 1]!);
              }
            }}
          />
        </div>
      </div>
      {focused && matching.length > 0 && (
        <div className="chips chips--scroll" data-testid="tag-suggestions">
          {matching.map((s) => (
            <Chip key={s} soft onClick={() => add(s)} icon="add">
              {s}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
