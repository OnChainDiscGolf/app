/**
 * @file walletSelection.ts
 * @description Pure wallet-selection logic for the Wallet quick-send flow.
 *
 * Picks the best wallet to send from given a user preference, current
 * balances, and which wallets are actually configured. Extracted from
 * Wallet.tsx so the priority cascade can be tested without rendering.
 */

export type WalletKind = 'breez' | 'nwc' | 'cashu';
export type DefaultQuickSendWallet = WalletKind | 'auto';

export interface WalletSelectionInputs {
  defaultQuickSendWallet: DefaultQuickSendWallet;
  walletBalances: { breez: number; nwc: number; cashu: number };
  nwcString: string | null;
  hasBreezWallet: boolean;
}

/**
 * Pick the best wallet to send from based on user preference and balances.
 *
 * Priority cascade:
 * 1. Honor an explicit user preference if that wallet exists and has balance.
 * 2. Auto-select: Breez (if exists & funded) → NWC (if configured & funded) → Cashu (if funded).
 * 3. Edge-case fallback: any wallet with balance, in the same order.
 * 4. Default to Cashu (always available as built-in wallet).
 */
export function getPreferredSendWallet(inputs: WalletSelectionInputs): WalletKind {
  const { defaultQuickSendWallet, walletBalances, nwcString, hasBreezWallet } = inputs;

  if (defaultQuickSendWallet !== 'auto') {
    const preferredBalance = walletBalances[defaultQuickSendWallet];
    if (defaultQuickSendWallet === 'nwc' && nwcString && preferredBalance > 0) return 'nwc';
    if (defaultQuickSendWallet === 'breez' && hasBreezWallet && preferredBalance > 0) return 'breez';
    if (defaultQuickSendWallet === 'cashu' && preferredBalance > 0) return 'cashu';
  }

  if (hasBreezWallet && walletBalances.breez > 0) return 'breez';
  if (nwcString && walletBalances.nwc > 0) return 'nwc';
  if (walletBalances.cashu > 0) return 'cashu';

  if (walletBalances.breez > 0 && hasBreezWallet) return 'breez';
  if (walletBalances.nwc > 0 && nwcString) return 'nwc';

  return 'cashu';
}
