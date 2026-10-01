import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../app/AppState';
import { clock, db } from '../../app/container';
import { useDialogs } from '../../app/dialogs';
import { goBack, navigate, setBackGuard } from '../../app/router';
import { useToast } from '../../app/toast';
import { addCategory } from '../../data/categoriesRepo';
import { processImageFile } from '../../data/images';
import { addRule } from '../../data/rulesRepo';
import { listTagsWithUsage } from '../../data/tagsRepo';
import { addTransaction, deleteTransaction, getTransactionDetails, lastCreatedTransaction, restoreTransaction, updateTransaction, type NewImage } from '../../data/transactionsRepo';
import type { Attachment, TxType } from '../../data/types';
import { addDays, type ISODate } from '../../domain/dates';
import { amountToInput, applyKeypadKey, parseAmountInput } from '../../domain/money';
import { nextOccurrenceOnOrAfter, type Frequency } from '../../domain/recurring';
import { useI18n } from '../../i18n';
import { CategoryEditor } from '../components/CategoryEditor';
import { Chip } from '../components/Chip';
import { DateInput } from '../components/DateInput';
import { FitText } from '../components/FitText';
import { CategoryIcon, Icon } from '../components/Icon';
import { AmountDisplay, Keypad } from '../components/Keypad';
import { PictureGrid, type PictureItem } from '../components/Pictures';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { Stepper } from '../components/Stepper';
import { TagInput } from '../components/TagInput';
import { useCategories } from '../hooks';
import { describeSchedule } from '../schedule';

type Repeat = 'OFF' | Frequency;

interface PendingImage extends NewImage {
  id: string;
}

interface FormState {
  type: TxType;
  amountText: string;
  categoryId: string | null;
  date: ISODate;
  tags: string[];
  comment: string;
  images: PendingImage[];
  removedAttachmentIds: string[];
  repeat: Repeat;
  interval: number;
  endDate: ISODate | null;
}

function emptyForm(today: ISODate): FormState {
  return { type: 'EXPENSE', amountText: '', categoryId: null, date: today, tags: [], comment: '', images: [], removedAttachmentIds: [], repeat: 'OFF', interval: 1, endDate: null };
}

function fingerprint(f: FormState): string {
  return JSON.stringify({ ...f, images: f.images.map((i) => i.id) });
}

export function AddEditScreen({ editId }: { editId?: string }) {
  const { t, f: fmt } = useI18n();
  const i18n = useI18n();
  const { settings, today } = useApp();
  const toast = useToast();
  const dialogs = useDialogs();
  const categories = useCategories();
  const isEdit = !!editId;
  const draftId = isEdit ? `edit:${editId}` : 'add';

  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<string>('');
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [keypadOpen, setKeypadOpen] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const saved = useRef(false);

  const lastUsed = useLiveQuery(() => lastCreatedTransaction(db), []);
  const tagUsage = useLiveQuery(() => listTagsWithUsage(db), []);
  const suggestions = useMemo(() => tagUsage?.map((x) => x.name) ?? [], [tagUsage]);

  // Load: draft first (survives being killed in the background), otherwise the transaction or an empty form.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let base: FormState = emptyForm(today);
      if (editId) {
        const details = await getTransactionDetails(db, editId);
        if (!details) {
          goBack();
          return;
        }
        const tx = details.transaction;
        base = {
          type: tx.type,
          amountText: amountToInput(tx.amount),
          categoryId: tx.categoryId,
          date: tx.date,
          tags: details.tags.map((x) => x.name),
          comment: tx.comment,
          images: [],
          removedAttachmentIds: [],
          repeat: 'OFF',
          interval: 1,
          endDate: null,
        };
        if (!cancelled) {
          setExistingAttachments(details.attachments);
          setEditRuleId(tx.recurringRuleId ?? null);
        }
      }
      const draft = await db.drafts.get(draftId);
      if (cancelled) return;
      setInitial(fingerprint(base));
      if (draft && draft.data && typeof draft.data === 'object') {
        const d = draft.data as Partial<FormState>;
        setForm({ ...base, ...d, images: Array.isArray(d.images) ? d.images : [] });
      } else {
        setForm(base);
      }
      if (editId) setKeypadOpen(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, draftId]);

  const dirty = form !== null && fingerprint(form) !== initial;

  // Persist the draft (debounced) so the form survives the app being killed.
  useEffect(() => {
    if (!form || saved.current) return;
    const handle = window.setTimeout(() => {
      if (dirty) db.drafts.put({ id: draftId, data: form, updatedAt: Date.now() }).catch(() => {});
      else db.drafts.delete(draftId).catch(() => {});
    }, 300);
    return () => window.clearTimeout(handle);
  }, [form, dirty, draftId]);

  const update = useCallback((patch: Partial<FormState> | ((prev: FormState) => Partial<FormState>)) => {
    setForm((prev) => (prev ? { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) } : prev));
  }, []);

  const discardAndLeave = useCallback(() => {
    saved.current = true;
    db.drafts.delete(draftId).catch(() => {});
    setBackGuard(null);
    goBack();
  }, [draftId]);

  const askDiscard = useCallback(async () => {
    const ok = await dialogs.confirm({ title: t('discardTitle'), text: t('discardText'), confirmLabel: t('discard'), cancelLabel: t('keepEditing'), danger: true });
    if (ok) discardAndLeave();
  }, [dialogs, t, discardAndLeave]);

  useEffect(() => {
    setBackGuard(() => {
      if (!dirty || saved.current) return true;
      void askDiscard();
      return false;
    });
    return () => setBackGuard(null);
  }, [dirty, askDiscard]);

  const onBack = () => {
    if (dirty && !saved.current) void askDiscard();
    else discardAndLeave();
  };

  if (!form || !categories) return <Screen title={isEdit ? t('editTransaction') : t('newTransaction')} back={onBack}>{null}</Screen>;

  const amount = parseAmountInput(form.amountText);
  const repeatOn = !isEdit && form.repeat !== 'OFF';
  const amountError = amount === null || amount <= 0 ? t('errorAmount') : null;
  const categoryError = !form.categoryId ? t('errorCategory') : null;
  const dateError = !repeatOn && form.date > today ? t('errorFutureDate') : null;
  const endDateError = repeatOn && form.endDate && form.endDate <= form.date ? t('errorEndDate') : null;
  const valid = !amountError && !categoryError && !dateError && !endDateError;

  const visibleCategories = categories.list.filter((c) => c.type === form.type);
  const twoDaysAgo = addDays(today, -2);
  const yesterday = addDays(today, -1);
  const quickDates = new Set([today, yesterday, twoDaysAgo]);
  const lastUsedDate = lastUsed && !quickDates.has(lastUsed.date) ? lastUsed.date : null;
  const isCustomDate = !quickDates.has(form.date) && form.date !== lastUsedDate;

  const schedule = repeatOn ? { frequency: form.repeat as Frequency, interval: form.interval, startDate: form.date, endDate: form.endDate } : null;
  const nextDate = schedule ? nextOccurrenceOnOrAfter(schedule, addDays(form.date > today ? form.date : today, 1)) : null;

  const pictureItems: PictureItem[] = [
    ...existingAttachments.filter((a) => !form.removedAttachmentIds.includes(a.id)).map((a) => ({ id: a.id, blob: a.blob, thumb: a.thumb })),
    ...form.images.map((i) => ({ id: i.id, blob: i.blob, thumb: i.thumb })),
  ];

  const addImages = async (files: File[]) => {
    setImageBusy(true);
    setKeypadOpen(false);
    try {
      for (const file of files) {
        try {
          const img = await processImageFile(file);
          update((prev) => ({ images: [...prev.images, { ...img, id: crypto.randomUUID() }] }));
        } catch {
          toast.show(t('errorImage'));
        }
      }
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = (id: string) => {
    update((prev) => (prev.images.some((i) => i.id === id) ? { images: prev.images.filter((i) => i.id !== id) } : { removedAttachmentIds: [...prev.removedAttachmentIds, id] }));
  };

  const save = async () => {
    setAttempted(true);
    if (!valid || busy || amount === null || !form.categoryId) return;
    setBusy(true);
    try {
      const input = { type: form.type, amount, categoryId: form.categoryId, date: form.date, comment: form.comment, tagNames: form.tags };
      let message = t('saved');
      if (isEdit && editId) {
        await updateTransaction(db, clock, editId, input, { newImages: form.images, removeAttachmentIds: form.removedAttachmentIds });
      } else if (schedule) {
        const ruleInput = { ...input, frequency: schedule.frequency, interval: schedule.interval, startDate: form.date, endDate: form.endDate };
        if (form.date <= today) {
          const tx = await addTransaction(db, clock, input, form.images);
          const { created } = await addRule(db, clock, ruleInput, { firstOccurrenceTransactionId: tx.id });
          if (created > 0) message = t('savedWithOccurrences', { n: created });
        } else {
          await addRule(db, clock, ruleInput);
          message = t('savedRuleFuture', { date: fmt.date(form.date) });
        }
      } else {
        await addTransaction(db, clock, input, form.images);
      }
      saved.current = true;
      await db.drafts.delete(draftId);
      setBackGuard(null);
      toast.show(message);
      goBack();
    } catch (e) {
      console.error(e);
      toast.show(t('error'));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    const ok = await dialogs.confirm({ title: t('deleteTransactionTitle'), text: t('deleteTransactionText'), confirmLabel: t('delete'), danger: true });
    if (!ok) return;
    const snapshot = await deleteTransaction(db, editId);
    saved.current = true;
    await db.drafts.delete(draftId);
    setBackGuard(null);
    if (snapshot) toast.show(t('transactionDeleted'), { action: { label: t('undo'), onClick: () => void restoreTransaction(db, snapshot) } });
    goBack();
  };

  const closeKeypad = () => setKeypadOpen(false);

  return (
    <Screen
      title={isEdit ? t('editTransaction') : t('newTransaction')}
      back={onBack}
      testId="add-edit-screen"
      actions={
        <button type="button" className="btn btn--primary btn--sm" disabled={!valid || busy} onClick={save} data-testid="save-button">
          {t('save')}
        </button>
      }
    >
      <div className="stack">
        <Segmented<TxType>
          value={form.type}
          ariaLabel={t('type')}
          className={form.type === 'EXPENSE' ? 'segmented--expense' : 'segmented--income'}
          options={[
            { value: 'EXPENSE', label: t('expense') },
            { value: 'INCOME', label: t('income') },
          ]}
          onChange={(type) =>
            update((prev) => ({
              type,
              categoryId: prev.categoryId && categories.byId.get(prev.categoryId)?.type === type ? prev.categoryId : null,
            }))
          }
        />

        <div>
          <AmountDisplay text={form.amountText} currency={settings.currency} active={keypadOpen} type={form.type} onClick={() => setKeypadOpen(true)} />
          {(attempted || (dirty && form.amountText !== '')) && amountError && <p className="error text-center">{amountError}</p>}
          <Keypad open={keypadOpen} onKey={(k) => update((prev) => ({ amountText: applyKeypadKey(prev.amountText, k) }))} />
          {keypadOpen && (
            <button type="button" className="link link--small" style={{ display: 'flex', margin: '0 auto' }} onClick={closeKeypad}>
              <Icon name="keyboard_hide" style={{ marginRight: '0.25rem' }} />
              {t('hideKeypad')}
            </button>
          )}
        </div>

        <div className="field">
          <span className="field__label">{t('category')}</span>
          <div className="tile-grid" role="radiogroup" aria-label={t('category')} data-testid="category-grid">
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
            <button
              type="button"
              className="tile tile--new"
              onClick={() => {
                closeKeypad();
                setShowCategoryEditor(true);
              }}
              data-testid="category-new"
            >
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

        <div className="field">
          <span className="field__label">{t('date')}</span>
          <div className="chips chips--scroll" role="radiogroup" aria-label={t('date')}>
            <Chip selected={form.date === today} onClick={() => update({ date: today })} testId="date-today">
              {t('today')}
            </Chip>
            <Chip selected={form.date === yesterday} onClick={() => update({ date: yesterday })}>
              {t('yesterday')}
            </Chip>
            <Chip selected={form.date === twoDaysAgo} onClick={() => update({ date: twoDaysAgo })}>
              {t('twoDaysAgo')}
            </Chip>
            {lastUsedDate && (
              <Chip selected={form.date === lastUsedDate} onClick={() => update({ date: lastUsedDate })} testId="date-last-used">
                {t('lastUsed')} · {fmt.monthDay(lastUsedDate)}
              </Chip>
            )}
            <DateInput value={form.date} max={repeatOn ? undefined : today} onChange={(d) => update({ date: d })} ariaLabel={t('pickDate')} testId="date-picker">
              <Chip selected={isCustomDate} icon="event">
                {isCustomDate ? fmt.monthDay(form.date, true) : t('pickDate')}
              </Chip>
            </DateInput>
          </div>
          {dateError && <p className="error">{dateError}</p>}
        </div>

        <div className="field">
          <span className="field__label">{t('tags')}</span>
          <TagInput tags={form.tags} onChange={(tags) => update({ tags })} suggestions={suggestions} onFocus={closeKeypad} />
        </div>

        <label className="field">
          <span className="field__label">{t('comment')}</span>
          <textarea className="input" rows={2} value={form.comment} placeholder={t('commentPlaceholder')} onFocus={closeKeypad} onChange={(e) => update({ comment: e.target.value })} data-testid="comment-input" />
        </label>

        <div className="field">
          <span className="field__label">{t('pictures')}</span>
          <PictureGrid items={pictureItems} onRemove={removeImage} onAdd={(files) => void addImages(files)} busy={imageBusy} />
        </div>

        {!isEdit && (
          <div className="field">
            <span className="field__label">{t('repeat')}</span>
            <div className="chips chips--scroll" role="radiogroup" aria-label={t('repeat')}>
              {(['OFF', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as Repeat[]).map((r) => (
                <Chip
                  key={r}
                  selected={form.repeat === r}
                  onClick={() => {
                    update({ repeat: r });
                    closeKeypad();
                  }}
                  testId={`repeat-${r}`}
                >
                  {r === 'OFF' ? t('repeatOff') : r === 'DAILY' ? t('daily') : r === 'WEEKLY' ? t('weekly') : r === 'MONTHLY' ? t('monthly') : t('yearly')}
                </Chip>
              ))}
            </div>
            {schedule && (
              <div className="card stack stack--tight" style={{ marginTop: '0.5rem' }} data-testid="repeat-options">
                <div className="row-flex" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>
                    {t('every')} {form.interval} {schedule.frequency === 'DAILY' ? t('unitDays') : schedule.frequency === 'WEEKLY' ? t('unitWeeks') : schedule.frequency === 'MONTHLY' ? t('unitMonths') : t('unitYears')}
                  </span>
                  <Stepper value={form.interval} onChange={(interval) => update({ interval })} label={t('every')} />
                </div>
                <div className="row-flex" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{t('endDate')}</span>
                  <span className="row-flex" style={{ gap: '0.25rem' }}>
                    <DateInput value={form.endDate ?? ''} min={addDays(form.date, 1)} onChange={(d) => update({ endDate: d })} ariaLabel={t('endDate')}>
                      <Chip soft icon="event">
                        {form.endDate ? fmt.date(form.endDate) : t('noEndDate')}
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
                <p className="small muted" data-testid="repeat-preview">
                  <Icon name="repeat" style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />
                  {describeSchedule(schedule, i18n, { withEnd: true })}
                  {nextDate && ` · ${t('nextLabel')}: ${fmt.monthDay(nextDate, nextDate.slice(0, 4) !== today.slice(0, 4))}`}
                </p>
              </div>
            )}
          </div>
        )}

        {isEdit && editRuleId && (
          <div className="notice" data-testid="recurring-hint">
            <Icon name="repeat" />
            <span>
              {t('recurringHint')}{' '}
              <button type="button" className="link" style={{ minHeight: 0, padding: 0 }} onClick={() => navigate({ name: 'rule', id: editRuleId })}>
                {t('editRule')}
              </button>
            </span>
          </div>
        )}

        <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!valid || busy} onClick={save} data-testid="save-button-bottom">
          {t('save')}
        </button>
        {isEdit && (
          <button type="button" className="btn btn--danger-soft btn--block" onClick={() => void remove()} data-testid="delete-button">
            <Icon name="delete" />
            {t('delete')}
          </button>
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
