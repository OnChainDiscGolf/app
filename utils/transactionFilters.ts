/**
 * @file transactionFilters.ts
 * @description Pure helpers for filtering and sorting wallet transactions for display.
 */

import { WalletTransaction } from '../types';

export type TransactionViewMode = 'all' | 'breez' | 'cashu' | 'nwc';

/**
 * Filter wallet transactions by view mode and sort them newest-first.
 *
 * Transactions with no `walletType` are treated as `'cashu'` for filtering
 * purposes (matches legacy data that pre-dated the multi-wallet split).
 *
 * @param transactions - Source list (not mutated; sort is done on a copy).
 * @param viewMode - `'all'` returns everything; otherwise filters by wallet type.
 * @returns A new array sorted by `timestamp` descending.
 */
export function filterAndSortTransactions(
  transactions: WalletTransaction[],
  viewMode: TransactionViewMode,
): WalletTransaction[] {
  return transactions
    .filter((tx) => viewMode === 'all' || (tx.walletType || 'cashu') === viewMode)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp);
}
