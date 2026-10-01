import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function ChoiceSheet<T extends string>({ title, value, choices, onClose, onPick }: { title: string; value: T; choices: Choice<T>[]; onClose: () => void; onPick: (v: T) => void }) {
  return (
    <Sheet title={title} onClose={onClose} testId="choice-sheet">
      <div className="list" role="radiogroup" aria-label={title}>
        {choices.map((c) => (
          <button key={c.value} type="button" role="radio" aria-checked={c.value === value} className="row row--plain" style={{ background: 'transparent', minHeight: '3.25rem' }} onClick={() => onPick(c.value)}>
            <span className="row__body">
              <span className="row__title">{c.label}</span>
              {c.hint && <span className="row__subtitle">{c.hint}</span>}
            </span>
            {c.value === value && <Icon name="check" style={{ color: 'var(--accent)' }} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
