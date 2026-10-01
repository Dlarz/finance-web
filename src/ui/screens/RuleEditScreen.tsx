import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../app/AppState';
import { clock, db } from '../../app/container';
import { useDialogs } from '../../app/dialogs';
import { goBack, setBackGuard } from '../../app/router';
import { useToast } from '../../app/toast';
import { addCategory } from '../../data/categoriesRepo';
import { addRule, deleteRule, nextRuleDate, pauseRule, resumeRule, updateRule } from '../../data/rulesRepo';
import { listTagsWithUsage } from '../../data/tagsRepo';
import type { RecurringRule, TxType } from '../../data/types';
import { addDays, type ISODate } from '../../domain/dates';
import { amountToInput, applyKeypadKey, parseAmountInput } from '../../domain/money';
import type { Frequency } from '../../domain/recurring';
import { useI18n } from '../../i18n';
import { CategoryEditor } from '../components/CategoryEditor';
import { Chip } from '../components/Chip';
import { DateInput } from '../components/DateInput';
import { FitText } from '../components/FitText';
import { CategoryIcon, Icon } from '../components/Icon';
import { AmountDisplay, Keypad } from '../components/Keypad';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { Stepper } from '../components/Stepper';
import { TagInput } from '../components/TagInput';
import { useCategories } from '../hooks';
import { describeSchedule } from '../schedule';

interface RuleForm {
  type: TxType;
  amountText: string;
  categoryId: string | null;
  comment: string;
  tags: string[];
  frequency: Frequency;
  interval: number;
  startDate: ISODate;
  endDate: ISODate | null;
}

export function RuleEditScreen({ id }: { id: string | null }) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const { settings, today } = useApp();
  const toast = useToast();
  const dialogs = useDialogs();
  const categories = useCategories();
  const isEdit = id !== null;
  const [form, setForm] = useState<RuleForm | null>(null);
  const [initial, setInitial] = useState('');
  const [rule, setRule] = useState<RecurringRule | null>(null);
  const [keypadOpen, setKeypadOpen] = useState(!isEdit);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const tagUsage = useLiveQuery(() => listTagsWithUsage(db), []);
  const allTags = useLiveQuery(() => db.tags.toArray(), []);
  const suggestions = useMemo(() => tagUsage?.map((x) => x.name) ?? [], [tagUsage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let base: RuleForm = { type: 'EXPENSE', amountText: '', categoryId: null, comment: '', tags: [], frequency: 'MONTHLY', interval: 1, startDate: today, endDate: null };
      if (id) {
        const existing = await db.recurringRules.get(id);
        if (!existing) {
          goBack();
          return;
        }
        const tags = await db.tags.bulkGet(existing.tagIds);
        base = {
          type: existing.type,
          amountText: amountToInput(existing.amount),
          categoryId: existing.categoryId,
          comment: existing.comment,
          tags: tags.filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.name),
          frequency: existing.frequency,
          interval: existing.interval,
          startDate: existing.startDate,
          endDate: existing.endDate,
        };
        if (!cancelled) setRule(existing);
      }
      if (!cancelled) {
        setForm(base);
        setInitial(JSON.stringify(base));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, today]);

  const dirty = form !== null && JSON.stringify(form) !== initial;
  const askDiscard = useCallback(async () => {
    const ok = await dialogs.confirm({ title: t('discardTitle'), text: t('discardText'), confirmLabel: t('discard'), cancelLabel: t('keepEditing'), danger: true });
    if (ok) {
      setBackGuard(null);
      goBack();
    }
  }, [dialogs, t]);
  useEffect(() => {
    setBackGuard(() => {
      if (!dirty) return true;
      void askDiscard();
      return false;
    });
    return () => setBackGuard(null);
  }, [dirty, askDiscard]);

  const update = (patch: Partial<RuleForm>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  void allTags;

  if (!form || !categories) return <Screen title={isEdit ? t('editRule') : t('newRule')} back>{null}</Screen>;

  const amount = parseAmountInput(form.amountText);
  const amountError = amount === null || amount <= 0 ? t('errorAmount') : null;
  const categoryError = !form.categoryId ? t('errorCategory') : null;
  const endDateError = form.endDate && form.endDate <= form.startDate ? t('errorEndDate') : null;
  const valid = !amountError && !categoryError && !endDateError;
  const visibleCategories = categories.list.filter((c) => c.type === form.type);
  const schedule = { frequency: form.frequency, interval: form.interval, startDate: form.startDate, endDate: form.endDate };
  const preview = describeSchedule(schedule, i18n, { withEnd: true });
  const next = rule ? nextRuleDate({ ...rule, ...schedule, isPaused: false }, today) : nextRuleDate({ ...schedule, isPaused: false, generateFrom: form.startDate } as RecurringRule, today);

  const save = async () => {
    setAttempted(true);
    if (!valid || busy || amount === null || !form.categoryId) return;
    setBusy(true);
    try {
      const input = { type: form.type, amount, categoryId: form.categoryId, comment: form.comment, tagNames: form.tags, frequency: form.frequency, interval: form.interval, startDate: form.startDate, endDate: form.endDate };
      let message = t('ruleSaved');
      if (id) await updateRule(db, clock, id, input);
      else {
        const { created } = await addRule(db, clock, input);
        if (created > 0) message = t('savedWithOccurrences', { n: created });
        else if (form.startDate > today) message = t('savedRuleFuture', { date: f.date(form.startDate) });
      }
      setBackGuard(null);
      setInitial(JSON.stringify(form));
      toast.show(message);
      goBack();
    } catch (e) {
      console.error(e);
      toast.show(t('error'));
      setBusy(false);
    }
  };

  const remove = () => {
    if (!id) return;
    dialogs.open((close) => (
      <div className="dialog" role="alertdialog" aria-modal="true" data-testid="delete-rule-dialog">
        <h2 className="dialog__title">{t('deleteRuleTitle')}</h2>
        <p className="dialog__text">{t('deleteRuleText')}</p>
        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await deleteRule(db, id, false);
              close();
              setBackGuard(null);
              toast.show(t('ruleDeleted'));
              goBack();
            }}
            data-testid="delete-rule-keep"
          >
            {t('deleteRuleKeep')}
          </button>
          <button
            type="button"
            className="btn btn--danger-soft"
            onClick={async () => {
              await deleteRule(db, id, true);
              close();
              setBackGuard(null);
              toast.show(t('ruleDeleted'));
              goBack();
            }}
          >
            {t('deleteRuleAll')}
          </button>
          <button type="button" className="btn btn--tonal" onClick={close}>
            {t('cancel')}
          </button>
        </div>
      </div>
    ));
  };

  const togglePause = async () => {
    if (!rule) return;
    if (rule.isPaused) await resumeRule(db, clock, rule.id);
    else await pauseRule(db, clock, rule.id);
    const fresh = await db.recurringRules.get(rule.id);
    if (fresh) setRule(fresh);
  };

  const closeKeypad = () => setKeypadOpen(false);
  const unit = form.frequency === 'DAILY' ? t('unitDays') : form.frequency === 'WEEKLY' ? t('unitWeeks') : form.frequency === 'MONTHLY' ? t('unitMonths') : t('unitYears');

  return (
    <Screen
      title={isEdit ? t('editRule') : t('newRule')}
      back={() => (dirty ? void askDiscard() : goBack())}
      testId="rule-edit-screen"
      actions={
        <button type="button" className="btn btn--primary btn--sm" disabled={!valid || busy} onClick={save} data-testid="save-rule">
          {t('save')}
        </button>
      }
    >
      <div className="stack">
        {rule?.isPaused && (
          <div className="notice notice--warning">
            <Icon name="pause" />
            <span>{t('paused')}</span>
          </div>
        )}
        <Segmented<TxType>
          value={form.type}
          ariaLabel={t('type')}
          className={form.type === 'EXPENSE' ? 'segmented--expense' : 'segmented--income'}
          options={[
            { value: 'EXPENSE', label: t('expense') },
            { value: 'INCOME', label: t('income') },
          ]}
          onChange={(type) => update({ type, categoryId: form.categoryId && categories.byId.get(form.categoryId)?.type === type ? form.categoryId : null })}
        />
        <div>
          <AmountDisplay text={form.amountText} currency={settings.currency} active={keypadOpen} type={form.type} onClick={() => setKeypadOpen(true)} />
          {(attempted || (dirty && form.amountText !== '')) && amountError && <p className="error text-center">{amountError}</p>}
          <Keypad open={keypadOpen} onKey={(k) => update({ amountText: applyKeypadKey(form.amountText, k) })} />
        </div>
        <div className="field">
          <span className="field__label">{t('category')}</span>
          <div className="tile-grid" role="radiogroup" aria-label={t('category')}>
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="tile"
                aria-pressed={form.categoryId === c.id}
                style={{ '--tile-color': c.colorHex } as React.CSSProperties}
                onClick={() => {
                  update({ categoryId: c.id });
                  closeKeypad();
                }}
                data-testid="category-tile"
              >
                <CategoryIcon iconKey={c.iconKey} colorHex={c.colorHex} size="2.5rem" />
                <span className="tile__label">
                  <FitText>{c.name}</FitText>
                </span>
              </button>
            ))}
            <button type="button" className="tile tile--new" onClick={() => setShowCategoryEditor(true)}>
              <span className="icon-circle" style={{ background: 'transparent', color: 'var(--text-2)', '--size': '2.5rem' } as React.CSSProperties}>
                <Icon name="add" />
              </span>
              <span className="tile__label">
                <FitText>{`+ ${t('newCategory')}`}</FitText>
              </span>
            </button>
          </div>
          {(attempted || (dirty && !amountError)) && categoryError && <p className="error">{categoryError}</p>}
        </div>

        <div className="card stack" data-testid="rule-schedule">
          <div className="field">
            <span className="field__label">{t('repeat')}</span>
            <div className="chips chips--scroll" role="radiogroup" aria-label={t('repeat')} style={{ margin: 0, padding: '0.25rem 0' }}>
              {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as Frequency[]).map((r) => (
                <Chip key={r} selected={form.frequency === r} onClick={() => update({ frequency: r })}>
                  {r === 'DAILY' ? t('daily') : r === 'WEEKLY' ? t('weekly') : r === 'MONTHLY' ? t('monthly') : t('yearly')}
                </Chip>
              ))}
            </div>
          </div>
          <div className="row-flex" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>
              {t('every')} {form.interval} {unit}
            </span>
            <Stepper value={form.interval} onChange={(interval) => update({ interval })} label={t('every')} />
          </div>
          <div className="row-flex" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{t('startDate')}</span>
            <DateInput value={form.startDate} onChange={(startDate) => update({ startDate })} ariaLabel={t('startDate')} testId="rule-start-date">
              <Chip soft icon="event">
                {f.date(form.startDate)}
              </Chip>
            </DateInput>
          </div>
          <div className="row-flex" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{t('endDate')}</span>
            <span className="row-flex" style={{ gap: '0.25rem' }}>
              <DateInput value={form.endDate ?? ''} min={addDays(form.startDate, 1)} onChange={(endDate) => update({ endDate })} ariaLabel={t('endDate')}>
                <Chip soft icon="event">
                  {form.endDate ? f.date(form.endDate) : t('noEndDate')}
                </Chip>
              </DateInput>
              {form.endDate && (
                <button type="button" className="btn btn--icon" aria-label={t('remove')} onClick={() => update({ endDate: null })}>
                  <Icon name="close" />
                </button>
              )}
            </span>
          </div>
          {endDateError && <p className="error">{endDateError}</p>}
          <p className="small muted" data-testid="rule-preview">
            <Icon name="repeat" style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />
            {preview}
            {next && ` · ${t('nextLabel')}: ${f.date(next)}`}
          </p>
        </div>

        <div className="field">
          <span className="field__label">{t('tags')}</span>
          <TagInput tags={form.tags} onChange={(tags) => update({ tags })} suggestions={suggestions} onFocus={closeKeypad} />
        </div>
        <label className="field">
          <span className="field__label">{t('comment')}</span>
          <textarea className="input" rows={2} value={form.comment} placeholder={t('commentPlaceholder')} onFocus={closeKeypad} onChange={(e) => update({ comment: e.target.value })} />
        </label>

        <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!valid || busy} onClick={save}>
          {t('save')}
        </button>
        {rule && (
          <div className="row-flex">
            <button type="button" className="btn btn--tonal grow" onClick={() => void togglePause()} data-testid="rule-pause">
              <Icon name={rule.isPaused ? 'play_arrow' : 'pause'} />
              {rule.isPaused ? t('resume') : t('pause')}
            </button>
            <button type="button" className="btn btn--danger-soft grow" onClick={remove} data-testid="rule-delete">
              <Icon name="delete" />
              {t('delete')}
            </button>
          </div>
        )}
      </div>
      {showCategoryEditor && (
        <div className="overlay overlay--center" role="presentation" onClick={(e) => e.target === e.currentTarget && setShowCategoryEditor(false)}>
          <CategoryEditor
            type={form.type}
            onCancel={() => setShowCategoryEditor(false)}
            onSave={async (draft) => {
              const created = await addCategory(db, { ...draft, type: form.type });
              update({ categoryId: created.id });
              setShowCategoryEditor(false);
            }}
          />
        </div>
      )}
    </Screen>
  );
}
