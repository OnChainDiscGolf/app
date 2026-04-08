import { describe, it, expect } from 'vitest';
import { WalletTransaction } from '../types';
import { filterAndSortTransactions } from './transactionFilters';

const tx = (overrides: Partial<WalletTransaction>): WalletTransaction => ({
  id: 't1',
  type: 'send',
  amountSats: 100,
  description: '',
  timestamp: 1000,
  ...overrides,
});

describe('filterAndSortTransactions', () => {
  it('returns an empty array for empty input', () => {
    expect(filterAndSortTransactions([], 'all')).toEqual([]);
  });

  it("returns all transactions sorted desc by timestamp when viewMode='all'", () => {
    const txs = [
      tx({ id: 'a', timestamp: 100, walletType: 'cashu' }),
      tx({ id: 'b', timestamp: 300, walletType: 'breez' }),
      tx({ id: 'c', timestamp: 200, walletType: 'nwc' }),
    ];
    expect(filterAndSortTransactions(txs, 'all').map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it("filters to only cashu when viewMode='cashu'", () => {
    const txs = [
      tx({ id: 'a', walletType: 'cashu' }),
      tx({ id: 'b', walletType: 'breez' }),
      tx({ id: 'c', walletType: 'nwc' }),
    ];
    expect(filterAndSortTransactions(txs, 'cashu').map((t) => t.id)).toEqual(['a']);
  });

  it("treats undefined walletType as 'cashu'", () => {
    const txs = [
      tx({ id: 'a' }), // no walletType
      tx({ id: 'b', walletType: 'breez' }),
    ];
    expect(filterAndSortTransactions(txs, 'cashu').map((t) => t.id)).toEqual(['a']);
    expect(filterAndSortTransactions(txs, 'breez').map((t) => t.id)).toEqual(['b']);
  });

  it('does not mutate the input array', () => {
    const txs = [
      tx({ id: 'a', timestamp: 100 }),
      tx({ id: 'b', timestamp: 200 }),
    ];
    const before = txs.map((t) => t.id);
    filterAndSortTransactions(txs, 'all');
    expect(txs.map((t) => t.id)).toEqual(before);
  });

  it('preserves both transactions when timestamps are equal', () => {
    const txs = [
      tx({ id: 'a', timestamp: 100, walletType: 'cashu' }),
      tx({ id: 'b', timestamp: 100, walletType: 'cashu' }),
    ];
    const result = filterAndSortTransactions(txs, 'all');
    expect(result).toHaveLength(2);
    const ids = result.map((t) => t.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });
});
