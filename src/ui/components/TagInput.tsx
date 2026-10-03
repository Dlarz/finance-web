import { useEffect, useMemo, useRef, useState } from 'react';
import { addTagName, addTagsFromInput, suggestTags } from '../../domain/tagSuggestions';
import { useI18n } from '../../i18n';
import { Chip } from './Chip';
import { Icon } from './Icon';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** text currently typed in the field (kept by the parent so it is saved with the form) */
  text: string;
  onTextChange: (text: string) => void;
  /** existing tags, most used first */
  suggestions: string[];
  onFocus?: () => void;
}

/**
 * Keeps the element visible above the iPhone keyboard: pads the scroll container by the
 * keyboard height (from the visual viewport) and scrolls the element into the visible part.
 */
function useVisibleAboveKeyboard(ref: React.RefObject<HTMLElement | null>, active: boolean, contentKey: number) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const body = ref.current?.closest('.screen__body') as HTMLElement | null;
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      const viewportTop = vv ? vv.offsetTop : 0;
      const inset = Math.max(0, window.innerHeight - viewportHeight - viewportTop);
      body?.style.setProperty('--keyboard-inset', `${inset}px`);
      const rect = el.getBoundingClientRect();
      const visibleBottom = viewportTop + viewportHeight;
      if (rect.bottom > visibleBottom - 8) body?.scrollBy({ top: rect.bottom - visibleBottom + 16, behavior: 'smooth' });
    };
    apply();
    const timer = window.setTimeout(apply, 400); // after the keyboard animation
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    return () => {
      window.clearTimeout(timer);
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      body?.style.removeProperty('--keyboard-inset');
    };
  }, [ref, active, contentKey]);
}

export function TagInput({ tags, onChange, text, onTextChange, suggestions, onFocus }: TagInputProps) {
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const add = (raw: string) => {
    onChange(addTagName(tags, raw));
    onTextChange('');
  };

  const remove = (name: string) => onChange(tags.filter((x) => x !== name));

  const matching = useMemo(() => suggestTags(suggestions, text, tags), [text, suggestions, tags]);
  useVisibleAboveKeyboard(wrapRef, focused, matching.length);

  return (
    <div className="stack stack--tight" ref={wrapRef}>
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
            autoComplete="off"
            spellCheck={false}
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
              const { tags: next, rest } = addTagsFromInput(tags, e.target.value);
              if (next.length !== tags.length || rest !== e.target.value) onChange(next);
              onTextChange(rest);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return; // let iOS finish a word suggestion first
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
        <div
          className="chips chips--scroll"
          data-testid="tag-suggestions"
          // keep the input focused while tapping a suggestion (otherwise the blur hides the row before the tap lands)
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
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
