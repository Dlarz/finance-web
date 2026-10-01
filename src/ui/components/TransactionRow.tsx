import type { Category, Transaction } from '../../data/types';
import { Amount } from './Amount';
import { CategoryIcon, Icon } from './Icon';

interface TransactionRowProps {
  transaction: Transaction;
  category: Category | undefined;
  tags?: string[];
  hasPictures?: boolean;
  /** shown under the category name, e.g. Today / Yesterday / Mon, Sep 28 */
  dateLabel?: string;
  onClick: () => void;
  animate?: boolean;
}

export function TransactionRow({ transaction, category, tags = [], hasPictures = false, dateLabel, onClick, animate = false }: TransactionRowProps) {
  const subtitleParts: string[] = [];
  if (dateLabel) subtitleParts.push(dateLabel);
  if (transaction.comment) subtitleParts.push(transaction.comment);
  return (
    <button type="button" className={`row${animate ? ' anim-in' : ''}`} onClick={onClick} data-testid="transaction-row">
      <CategoryIcon iconKey={category?.iconKey ?? 'category'} colorHex={category?.colorHex ?? '#6B7280'} />
      <span className="row__body">
        <span className="row__title">{category?.name ?? '—'}</span>
        {(subtitleParts.length > 0 || tags.length > 0) && (
          <span className="row__subtitle">
            {subtitleParts.length > 0 && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto', minWidth: '2rem' }}>{subtitleParts.join(' · ')}</span>}
            {tags.length > 0 && (
              <span className="tag-list" style={{ flexWrap: 'nowrap', overflow: 'hidden', flex: '0 1 auto', minWidth: 0 }}>
                {tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
                {tags.length > 3 && <span className="tag">+{tags.length - 3}</span>}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="row__trailing">
        <Amount value={transaction.amount} type={transaction.type} />
        {(hasPictures || transaction.recurringRuleId) && (
          <span className="row__meta">
            {hasPictures && <Icon name="image" />}
            {transaction.recurringRuleId && <Icon name="repeat" />}
          </span>
        )}
      </span>
    </button>
  );
}
