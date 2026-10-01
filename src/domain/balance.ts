import type { TxLike } from './statistics';

/** Total balance = starting balance + all income − all expenses. */
export function computeBalance(startingBalance: number, transactions: readonly Pick<TxLike, 'type' | 'amount'>[]): number {
  let balance = startingBalance;
  for (const t of transactions) balance += t.type === 'INCOME' ? t.amount : -t.amount;
  return balance;
}
