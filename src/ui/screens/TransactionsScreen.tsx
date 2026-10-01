import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../app/AppState';
import { db } from '../../app/container';
import { navigate, type TransactionsQuery } from '../../app/router';
import { useToast } from '../../app/toast';
import { countActiveFilters, EMPTY_FILTERS, setTxListState, useTxListState, type TxFilters } from '../../app/txListStore';
import { deleteTransaction, restoreTransaction, sortTransactions } from '../../data/transactionsRepo';
import type { Transaction, TxType } from '../../data/types';
import { yearOf, type ISODate } from '../../domain/dates';
import { formatNumber } from '../../domain/money';
import { useI18n } from '../../i18n';
import { Chip } from '../components/Chip';
import { DateInput } from '../components/DateInput';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { TransactionRow } from '../components/TransactionRow';
import { useAttachmentIds, useCategories, useTagNames } from '../hooks';

const CHUNK = 60;

function queryToFilters(q: TransactionsQuery): TxFilters {
  return { ...EMPTY_FILTERS, type: q.type ?? null, categoryIds: q.categoryId ? [q.categoryId] : [], start: q.start ?? null, end: q.end ?? null };
}

export function TransactionsScreen({ query }: { query: TransactionsQuery }) {
  const { t, f, relativeDay } = useI18n();
  const { today } = useApp();
  const toast = useToast();
  const state = useTxListState();
  const categories = useCategories();
  const tagNames = useTagNames();
  const withPictures = useAttachmentIds();
  const all = useLiveQuery(() => db.transactions.toArray(), []);
  const allTags = useLiveQuery(() => db.tags.orderBy('nameLower').toArray(), []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visible, setVisible] = useState(CHUNK);
  const sentinel = useRef<HTMLDivElement>(null);

  // Coming from Statistics with a query: start from those filters.
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    if (queryKey === state.queryKey) return;
    const hasQuery = !!(query.categoryId || query.type || query.start || query.end);
    if (hasQuery) {
      setTxListState({ filters: queryToFilters(query), search: '', queryKey });
    } else if (state.queryKey && state.queryKey !== '{}') {
      // leaving a drill-down from Statistics: back to the full list
      setTxListState({ filters: EMPTY_FILTERS, search: '', queryKey });
    } else {
      setTxListState({ queryKey });
    }
  }, [queryKey, query, state.queryKey]);

  const { search, filters } = state;
  const activeCount = countActiveFilters(filters);

  const filtered = useMemo(() => {
    if (!all || !categories) return null;
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^\d.,]/g, '').replace(',', '.');
    const catIds = new Set(filters.categoryIds);
    const tagSet = new Set(filters.tagNames.map((x) => x.toLowerCase()));
    const list = all.filter((tx) => {
      if (filters.type && tx.type !== filters.type) return false;
      if (catIds.size && !catIds.has(tx.categoryId)) return false;
      if (filters.start && tx.date < filters.start) return false;
      if (filters.end && tx.date > filters.end) return false;
      if (filters.hasPictures && !withPictures?.has(tx.id)) return false;
      const tags = tagNames?.get(tx.id) ?? [];
      if (tagSet.size && !tags.some((x) => tagSet.has(x.toLowerCase()))) return false;
      if (q) {
        const cat = categories.byId.get(tx.categoryId)?.name.toLowerCase() ?? '';
        const inText = tx.comment.toLowerCase().includes(q) || cat.includes(q) || tags.some((x) => x.toLowerCase().includes(q));
        const inAmount = qDigits !== '' && (formatNumber(tx.amount).replace(/'/g, '').includes(qDigits) || formatNumber(tx.amount).includes(q));
        if (!inText && !inAmount) return false;
      }
      return true;
    });
    return sortTransactions(list);
  }, [all, categories, search, filters, tagNames, withPictures]);

  useEffect(() => {
    setVisible(CHUNK);
  }, [search, filters]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !filtered || visible >= filtered.length) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + CHUNK);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered, visible]);

  const groups = useMemo(() => {
    if (!filtered) return [];
    const out: Array<{ date: ISODate; items: Transaction[]; net: number }> = [];
    let current: (typeof out)[number] | null = null;
    for (const tx of filtered.slice(0, visible)) {
      if (!current || current.date !== tx.date) {
        current = { date: tx.date, items: [], net: 0 };
        out.push(current);
      }
      current.items.push(tx);
    }
    // the day's net total uses all transactions of the day in the filtered list
    const netByDate = new Map<string, number>();
    for (const tx of filtered) netByDate.set(tx.date, (netByDate.get(tx.date) ?? 0) + (tx.type === 'INCOME' ? tx.amount : -tx.amount));
    for (const g of out) g.net = netByDate.get(g.date) ?? 0;
    return out;
  }, [filtered, visible]);

  const removeTx = async (id: string) => {
    const snapshot = await deleteTransaction(db, id);
    if (snapshot) toast.show(t('transactionDeleted'), { action: { label: t('undo'), onClick: () => void restoreTransaction(db, snapshot) } });
  };

  const clearAll = () => setTxListState({ search: '', filters: EMPTY_FILTERS });
  const setFilters = (patch: Partial<TxFilters>) => setTxListState({ filters: { ...filters, ...patch } });

  const headerLabel = (date: ISODate) => relativeDay(date, today) + (yearOf(date) !== yearOf(today) && date !== today ? '' : '');

  return (
    <Screen title={t('transactions')} large tab testId="transactions-screen" bodyClassName="screen__body--flush">
      <div style={{ padding: '0 var(--gutter)' }} className="stack stack--tight">
        <div className="row-flex">
          <div className="input-wrap grow">
            <Icon name="search" />
            <input
              type="search"
              className="input"
              value={search}
              placeholder={t('searchPlaceholder')}
              aria-label={t('search')}
              onChange={(e) => setTxListState({ search: e.target.value })}
              enterKeyHint="search"
              data-testid="search-input"
            />
            {search && (
              <button type="button" className="btn btn--icon" aria-label={t('close')} onClick={() => setTxListState({ search: '' })} style={{ width: '2.25rem', height: '2.25rem', minHeight: 0 }}>
                <Icon name="close" />
              </button>
            )}
          </div>
          <button type="button" className="btn btn--icon btn--icon-tonal" aria-label={t('filters')} onClick={() => setSheetOpen(true)} style={{ position: 'relative' }} data-testid="filter-button">
            <Icon name="tune" />
            {activeCount > 0 && (
              <span className="badge" style={{ position: 'absolute', top: '-0.25rem', right: '-0.25rem' }} data-testid="filter-badge">
                {activeCount}
              </span>
            )}
          </button>
        </div>
        {activeCount > 0 && categories && (
          <div className="chips chips--scroll" data-testid="active-filters">
            {filters.type && (
              <Chip selected onRemove={() => setFilters({ type: null })}>
                {filters.type === 'EXPENSE' ? t('expenses') : t('incomes')}
              </Chip>
            )}
            {filters.categoryIds.map((id) => (
              <Chip key={id} selected onRemove={() => setFilters({ categoryIds: filters.categoryIds.filter((x) => x !== id) })}>
                {categories.byId.get(id)?.name ?? '—'}
              </Chip>
            ))}
            {filters.tagNames.map((name) => (
              <Chip key={name} selected onRemove={() => setFilters({ tagNames: filters.tagNames.filter((x) => x !== name) })}>
                #{name}
              </Chip>
            ))}
            {(filters.start || filters.end) && (
              <Chip selected onRemove={() => setFilters({ start: null, end: null })}>
                {filters.start && filters.end ? f.range(filters.start, filters.end, { alwaysYear: true }) : filters.start ? `${t('from')} ${f.date(filters.start)}` : `${t('to')} ${f.date(filters.end!)}`}
              </Chip>
            )}
            {filters.hasPictures && (
              <Chip selected onRemove={() => setFilters({ hasPictures: false })}>
                {t('hasPictures')}
              </Chip>
            )}
          </div>
        )}
      </div>

      {filtered && categories && (
        <div style={{ marginTop: '0.5rem' }}>
          {all && all.length === 0 ? (
            <EmptyState icon="receipt_long" title={t('transactionsEmptyTitle')} text={t('transactionsEmptyText')} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="search"
              title={t('noResultsTitle')}
              text={t('noResultsText')}
              action={
                <button type="button" className="btn btn--secondary btn--sm" onClick={clearAll} data-testid="clear-filters">
                  {t('clearFilters')}
                </button>
              }
            />
          ) : (
            <div className="list" data-testid="transaction-list">
              {groups.map((g) => (
                <div key={g.date}>
                  <div className="sticky-header" data-testid="date-header">
                    <span>{headerLabel(g.date)}</span>
                    <span className="amount tabular">{g.net === 0 ? formatNumber(0) : `${g.net < 0 ? '−' : '+'}${formatNumber(g.net)}`}</span>
                  </div>
                  <div className="list list--card" style={{ margin: '0 var(--gutter)' }}>
                    {g.items.map((tx) => (
                      <SwipeToDelete key={tx.id} onDelete={() => void removeTx(tx.id)}>
                        <TransactionRow
                          transaction={tx}
                          category={categories.byId.get(tx.categoryId)}
                          tags={tagNames?.get(tx.id)}
                          hasPictures={withPictures?.has(tx.id)}
                          onClick={() => navigate({ name: 'transaction', id: tx.id })}
                        />
                      </SwipeToDelete>
                    ))}
                  </div>
                </div>
              ))}
              {visible < filtered.length && <div ref={sentinel} style={{ height: '2rem' }} />}
            </div>
          )}
        </div>
      )}

      {sheetOpen && categories && (
        <FilterSheet
          filters={filters}
          categories={categories.list}
          tags={allTags?.map((x) => x.name) ?? []}
          onClose={() => setSheetOpen(false)}
          onApply={(next) => {
            setTxListState({ filters: next });
            setSheetOpen(false);
          }}
        />
      )}
    </Screen>
  );
}

function FilterSheet({ filters, categories, tags, onClose, onApply }: { filters: TxFilters; categories: { id: string; name: string; type: TxType; colorHex: string }[]; tags: string[]; onClose: () => void; onApply: (f: TxFilters) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<TxFilters>(filters);
  const cats = [...categories.filter((c) => !draft.type || c.type === draft.type)].sort((a, b) => (a.type === b.type ? 0 : a.type === 'EXPENSE' ? -1 : 1));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Sheet
      title={t('filters')}
      onClose={onClose}
      testId="filter-sheet"
      footer={
        <>
          <button type="button" className="btn btn--tonal" onClick={() => setDraft(EMPTY_FILTERS)}>
            {t('reset')}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onApply(draft)} data-testid="apply-filters">
            {t('apply')}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <span className="field__label">{t('type')}</span>
          <Segmented<'ALL' | TxType>
            value={draft.type ?? 'ALL'}
            options={[
              { value: 'ALL', label: t('all') },
              { value: 'EXPENSE', label: t('expenses') },
              { value: 'INCOME', label: t('incomes') },
            ]}
            onChange={(v) => setDraft((d) => ({ ...d, type: v === 'ALL' ? null : v, categoryIds: v === 'ALL' ? d.categoryIds : d.categoryIds.filter((id) => categories.find((c) => c.id === id)?.type === v) }))}
          />
        </div>
        <div className="field">
          <span className="field__label">{t('categories')}</span>
          <div className="chips">
            {cats.map((c) => (
              <Chip key={c.id} selected={draft.categoryIds.includes(c.id)} onClick={() => setDraft((d) => ({ ...d, categoryIds: toggle(d.categoryIds, c.id) }))}>
                <span className="legend-dot" style={{ background: c.colorHex, marginRight: '0.375rem' }} />
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
        {tags.length > 0 && (
          <div className="field">
            <span className="field__label">{t('tags')}</span>
            <div className="chips">
              {tags.map((name) => (
                <Chip key={name} selected={draft.tagNames.includes(name)} onClick={() => setDraft((d) => ({ ...d, tagNames: toggle(d.tagNames, name) }))}>
                  #{name}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <span className="field__label">{t('dateRange')}</span>
          <div className="chips">
            <DateInput value={draft.start ?? ''} max={draft.end ?? undefined} onChange={(v) => setDraft((d) => ({ ...d, start: v }))} ariaLabel={t('from')}>
              <Chip soft icon="event">
                {draft.start ? `${t('from')} ${draft.start}` : t('from')}
              </Chip>
            </DateInput>
            <DateInput value={draft.end ?? ''} min={draft.start ?? undefined} onChange={(v) => setDraft((d) => ({ ...d, end: v }))} ariaLabel={t('to')}>
              <Chip soft icon="event">
                {draft.end ? `${t('to')} ${draft.end}` : t('to')}
              </Chip>
            </DateInput>
            {(draft.start || draft.end) && (
              <Chip soft icon="close" onClick={() => setDraft((d) => ({ ...d, start: null, end: null }))}>
                {t('reset')}
              </Chip>
            )}
          </div>
        </div>
        <div className="field">
          <span className="field__label">{t('pictures')}</span>
          <div className="chips">
            <Chip selected={draft.hasPictures} icon="image" onClick={() => setDraft((d) => ({ ...d, hasPictures: !d.hasPictures }))}>
              {t('hasPictures')}
            </Chip>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
