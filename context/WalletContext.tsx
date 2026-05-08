/**
 * @file WalletContext.tsx
 * @description Multi-wallet state management supporting three wallet backends:
 * Cashu eCash, NWC (Nostr Wallet Connect), and Breez SDK (Lightning).
 *
 * This is the largest context in the application with 17 effects handling:
 * - Wallet initialization and balance management across all three backends
 * - Real-time payment detection via Nostr DMs, NIP-17 Gift Wraps, Nutzaps,
 *   Lightning Gift Wraps, and multi-gateway WebSocket subscriptions
 * - Cashu proof management (storage, verification, deduplication, spent-proof cleanup)
 * - Encrypted wallet backup to Nostr (NIP-44) with merge-based restoration
 * - Breez SDK lifecycle (init from mnemonic, payment event subscriptions, reconciliation)
 * - NWC service lifecycle (init from connection string)
 * - Payment notification animations (lightning strike effect)
 *
 * @architecture Depends on AuthContext for `currentUserPubkey`, `isAuthenticated`, `isGuest`.
 * Exposes raw state setters so AppContext can perform cross-cutting wallet operations
 * during logout. Cross-context communication with RoundContext uses custom DOM events
 * ('ecash-received-from-player') rather than direct context coupling.
 *
 * **Effects (17 total):**
 * - Effect 1: Auto-reset lightning strike animation (3s timer)
 * - Effect 3: Proofs/balance persistence (recalculates on proof changes)
 * - Effect 4: Transactions persistence to localStorage
 * - Effect 5: Mints persistence to localStorage
 * - Effect 6: Auto-sync wallet backup to Nostr (debounced 2s)
 * - Effect 7: Initialize Cashu WalletService on mint changes
 * - Effect 8: Initialize NWC Service on connection string changes
 * - Effect 9: Auto-refresh balance when wallet mode changes
 * - Effect 10: Persist wallet mode and NWC string
 * - Effect 11: Wallet restoration on login (merge backup, init Breez, claim missed payments)
 * - Effect 12: Listen for DMs (auto-redeem eCash tokens)
 * - Effect 13: Listen for NIP-17 Gift Wraps (eCash, payment requests, confirmations, invites)
 * - Effect 14: Listen for Lightning Nutzaps
 * - Effect 15: Listen for Lightning Gift Wraps
 * - Effect 16: Real-time multi-gateway payment detection via WebSocket + fallback polling
 * - Effect 17: Breez reconciliation (catch missed payments on balance changes)
 */

import { CashuMint, CashuWallet, getDecodedToken } from '@cashu/cashu-ts';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WalletTransaction, Mint, Proof } from '../types';
import { BREEZ_API_KEY, BREEZ_CONFIG_READINESS } from '../constants';
import { publishWalletBackup, fetchWalletBackup, subscribeToDirectMessages, subscribeToGiftWraps, subscribeToNutzaps, subscribeToLightningGiftWraps, fetchHistoricalGiftWraps, getMagicLightningAddress } from '../services/nostrService';
import { hasStoredMnemonic, retrieveMnemonicEncrypted } from '../services/mnemonicService';
import {
  initializeBreez, isBreezInitialized, getBreezBalance,
  subscribeToPayments as subscribeToBreezEvents, disconnectBreez,
  getPaymentHistory, syncBreez,
  createInvoice as breezCreateInvoice,
  payInvoice as breezPayInvoice
} from '../services/breezService';
import { checkPendingPayments, subscribeToQuoteUpdates, unsubscribeFromQuoteUpdates, getQuoteById, registerWithAllGateways, checkGatewayRegistration, subscribeToAllGatewayUpdates } from '../services/npubCashService';
import { checkGatewayRegistration as getGatewayRegistrations } from '../services/npubCashService';
import { WalletService } from '../services/walletService';
import { notifyPaymentReceived, notifyRoundInvite, notifyPaymentRequest } from '../services/notificationService';
import { NWCService } from '../services/nwcService';
import { useAuth } from './AuthContext';

// ============================================================================
// TYPES
// ============================================================================

export interface WalletContextType {
  // State
  walletBalance: number;
  isBalanceLoading: boolean;
  transactions: WalletTransaction[];
  walletMode: 'cashu' | 'nwc' | 'breez';
  nwcString: string;
  mints: Mint[];
  proofs: Proof[];
  walletBalances: { cashu: number; nwc: number; breez: number };
  breezReady: boolean;
  breezInitError: string | null;
  retryBreezInit: () => void;

  // Payment notifications
  paymentNotification: { amount: number; context?: 'wallet_receive' | 'buyin_qr' } | null;
  setPaymentNotification: (notification: { amount: number; context?: 'wallet_receive' | 'buyin_qr' } | null) => void;
  lightningStrike: { amount: number; show: boolean } | null;

  // Actions
  depositFunds: (amount: number) => Promise<{ request: string; quote: string }>;
  checkDepositStatus: (quote: string) => Promise<boolean>;
  confirmDeposit: (quote: string, amount: number) => Promise<boolean>;
  sendFunds: (amount: number, invoice: string) => Promise<boolean>;
  receiveEcash: (token: string) => Promise<boolean>;
  createToken: (amount: number) => Promise<string>;
  getLightningQuote: (invoice: string) => Promise<{ amount: number; fee: number }>;
  refreshWalletBalance: () => Promise<void>;
  refreshAllBalances: () => Promise<void>;
  checkForPayments: () => Promise<number>;
  addMint: (url: string, nickname: string) => void;
  removeMint: (url: string) => void;
  setActiveMint: (url: string) => void;
  setWalletMode: (mode: 'cashu' | 'nwc' | 'breez') => void;
  setNwcConnection: (uri: string) => void;
  reconcileOnResume: () => Promise<void>;

  // For cross-cutting actions
  addTransaction: (type: WalletTransaction['type'], amount: number, description: string, walletType?: 'cashu' | 'nwc' | 'breez', options?: { id?: string; timestamp?: number; status?: 'pending' | 'complete' | 'failed' }) => void;
  syncWallet: (currentProofs: Proof[], currentMints: Mint[], currentTransactions: WalletTransaction[]) => Promise<void>;
  restoreWalletFromBackup: (backup: { proofs: Proof[]; mints: Mint[]; transactions: WalletTransaction[] }) => void;
  handleIncomingPayment: (walletType: 'cashu' | 'nwc' | 'breez', amount: number, description: string, paymentId?: string) => void;

  // Raw setters for cross-cutting (logout, etc.)
  setProofs: React.Dispatch<React.SetStateAction<Proof[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<WalletTransaction[]>>;
  setWalletModeState: React.Dispatch<React.SetStateAction<'cashu' | 'nwc' | 'breez'>>;
  setNwcString: React.Dispatch<React.SetStateAction<string>>;
  nwcServiceRef: React.MutableRefObject<NWCService | null>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

/**
 * WalletProvider - Multi-wallet state management with 17 effects for payment detection,
 * proof management, backup sync, and wallet lifecycle.
 *
 * **State managed:**
 * - `walletBalance` - Balance of the currently active wallet mode
 * - `walletBalances` - Individual balances for each wallet type { cashu, nwc, breez }
 * - `isBalanceLoading` - Loading indicator during balance refresh
 * - `transactions` - Unified transaction history across all wallet types
 * - `walletMode` - Currently active wallet ('cashu' | 'nwc' | 'breez')
 * - `nwcString` - NWC connection URI
 * - `mints` - List of Cashu mints with active selection
 * - `proofs` - Cashu token proofs (the actual eCash)
 * - `paymentNotification` - Pending payment notification for UI display
 * - `lightningStrike` - Lightning strike animation state
 *
 * **Exposed actions:**
 * - `depositFunds(amount)` - Generate a Lightning invoice for receiving (all wallet types)
 * - `checkDepositStatus(quote)` - Poll whether an invoice has been paid
 * - `confirmDeposit(quote, amount)` - Finalize deposit and mint proofs
 * - `sendFunds(amount, invoice)` - Pay a Lightning invoice (all wallet types)
 * - `receiveEcash(token)` - Redeem a Cashu token
 * - `createToken(amount)` - Create a Cashu token for sending
 * - `getLightningQuote(invoice)` - Get fee estimate for a Lightning payment
 * - `refreshWalletBalance()` - Refresh balance with proof verification
 * - `refreshAllBalances()` - Refresh balances across all three wallet types
 * - `checkForPayments()` - Manually check npub.cash for pending payments
 * - `addMint/removeMint/setActiveMint` - Cashu mint management
 * - `setWalletMode/setNwcConnection` - Switch wallet mode
 * - `reconcileOnResume()` - Full wallet reconciliation (called on app foreground)
 * - `addTransaction/syncWallet/restoreWalletFromBackup/handleIncomingPayment` - For cross-cutting use
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isGuest, currentUserPubkey } = useAuth();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [proofs, setProofs] = useState<Proof[]>(() => {
    const saved = localStorage.getItem('cdg_proofs');
    return saved ? JSON.parse(saved) : [];
  });

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const saved = localStorage.getItem('cdg_proofs');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        return WalletService.calculateBalance(p);
      } catch (e) {
        console.warn("Failed to calculate initial balance from localStorage", e);
        return 0;
      }
    }
    return 0;
  });

  const [walletBalances, setWalletBalances] = useState<{
    cashu: number;
    nwc: number;
    breez: number;
  }>(() => {
    const saved = localStorage.getItem('cdg_proofs');
    let cashuBal = 0;
    if (saved) {
      try {
        const p = JSON.parse(saved);
        cashuBal = WalletService.calculateBalance(p);
      } catch (e) {
        console.warn("Failed to calculate initial Cashu balance", e);
      }
    }
    return { cashu: cashuBal, nwc: 0, breez: 0 };
  });

  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [breezReady, setBreezReady] = useState<boolean>(isBreezInitialized());
  const [breezInitError, setBreezInitError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    const saved = localStorage.getItem('cdg_txs');
    return saved ? JSON.parse(saved) : [];
  });

  const [mints, setMints] = useState<Mint[]>(() => {
    const saved = localStorage.getItem('cdg_mints');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn("Corrupt mints data in localStorage, resetting.", e);
      }
    }
    return [
      { url: 'https://mint.minibits.cash/Bitcoin', nickname: 'Minibits', isActive: true }
    ];
  });

  const [walletMode, setWalletModeState] = useState<'cashu' | 'nwc' | 'breez'>(() => {
    const savedMode = localStorage.getItem('cdg_wallet_mode') as 'cashu' | 'nwc' | 'breez' | null;
    const savedString = localStorage.getItem('cdg_nwc_string');
    if (savedMode === 'nwc' && savedString) return 'nwc';
    if (savedMode === 'breez') return 'breez';
    if (savedMode === 'cashu') return 'cashu';
    // New users default to Breez — Breez SDK is initialized at the end of onboarding
    // (Finalization.tsx) and is the intended primary wallet for round settlement.
    return 'breez';
  });

  const [nwcString, setNwcString] = useState<string>(() => {
    return localStorage.getItem('cdg_nwc_string') || '';
  });

  // Refs
  const subRef = useRef<any>(null);
  const walletServiceRef = useRef<WalletService | null>(null);
  const nwcServiceRef = useRef<NWCService | null>(null);
  const animatedPaymentIdsRef = useRef<Set<string>>(new Set());
  const breezPaymentSubscriptionCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      breezPaymentSubscriptionCleanupRef.current?.();
      breezPaymentSubscriptionCleanupRef.current = null;
    };
  }, []);

  // Payment notification state
  const [paymentNotification, setPaymentNotification] = useState<{
    amount: number;
    context?: 'wallet_receive' | 'buyin_qr';
  } | null>(null);

  // Lightning strike state
  const [lightningStrike, setLightningStrike] = useState<{
    amount: number;
    show: boolean;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Record a new wallet transaction. Deduplicates by transaction ID.
   * @param {WalletTransaction['type']} type - Transaction type (deposit, send, receive, payout, etc.)
   * @param {number} amount - Amount in satoshis (must be > 0)
   * @param {string} description - Human-readable transaction description
   * @param {'cashu' | 'nwc' | 'breez'} [walletType] - Wallet backend (defaults to current mode)
   * @param {{ id?: string; timestamp?: number; status?: string }} [options] - Optional overrides
   */
  const addTransaction = (
    type: WalletTransaction['type'],
    amount: number,
    description: string,
    walletType?: 'cashu' | 'nwc' | 'breez',
    options?: { id?: string; timestamp?: number; status?: 'pending' | 'complete' | 'failed' }
  ) => {
    if (!amount || amount <= 0) return;

    const txId = options?.id || Date.now().toString();
    const ts = options?.timestamp || Date.now();
    const status = options?.status || 'complete';

    const tx: WalletTransaction = {
      id: txId,
      type,
      amountSats: amount,
      description,
      timestamp: ts,
      walletType: walletType || walletMode,
      status
    };
    setTransactions(prev => {
      if (prev.some(t => t.id === txId)) return prev;
      return [tx, ...prev];
    });
  };

  // === Effect 1: Auto-Reset Lightning Strike Animation ===
  // Clears the lightning strike visual effect after 3 seconds.
  // The lightning strike fires when any incoming payment is detected.

  useEffect(() => {
    if (lightningStrike?.show) {
      const timer = setTimeout(() => {
        setLightningStrike(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lightningStrike]);

  // ---------------------------------------------------------------------------
  // syncWallet helper (useCallback) - publishes wallet backup to Nostr
  // ---------------------------------------------------------------------------

  /**
   * Publish an encrypted wallet backup (proofs, mints, transactions, gateway registrations)
   * to Nostr relays using NIP-44 encryption. Called after any wallet state change.
   * @param {Proof[]} currentProofs - Current Cashu proofs
   * @param {Mint[]} currentMints - Current mint list
   * @param {WalletTransaction[]} currentTransactions - Current transaction history
   */
  const syncWallet = useCallback(async (currentProofs: Proof[], currentMints: Mint[], currentTransactions: WalletTransaction[]) => {
    if (isAuthenticated && !isGuest) {
      console.log("Syncing wallet to Nostr...");
      try {
        const gatewayRegistrations = checkGatewayRegistration();
        await publishWalletBackup(currentProofs, currentMints, currentTransactions, gatewayRegistrations);
      } catch (e) {
        console.error("Wallet Sync Failed:", e);
      }
    }
  }, [isAuthenticated, isGuest]);

  // === Effect 3: Proofs/Balance Persistence ===
  // Recalculates Cashu balance from proofs and persists to localStorage.
  // Updates the active wallet balance if Cashu is the current mode.

  useEffect(() => {
    const cashuBal = WalletService.calculateBalance(proofs);
    setWalletBalances(prev => ({ ...prev, cashu: cashuBal }));
    if (walletMode === 'cashu') {
      setWalletBalance(cashuBal);
    }
    localStorage.setItem('cdg_proofs', JSON.stringify(proofs));
  }, [proofs, mints, walletMode]);

  // === Effect 4: Transactions Persistence ===
  // Persists the full transaction history to localStorage on every change.

  useEffect(() => localStorage.setItem('cdg_txs', JSON.stringify(transactions)), [transactions]);

  // === Effect 5: Mints Persistence ===
  // Persists the mint list to localStorage on every change.

  useEffect(() => localStorage.setItem('cdg_mints', JSON.stringify(mints)), [mints]);

  // === Effect 6: Auto-Sync Wallet Backup to Nostr (Debounced 2s) ===
  // Publishes an encrypted wallet backup whenever proofs, mints, or transactions change.
  // Debounced by 2 seconds to avoid excessive relay writes during rapid changes.
  // Only runs for authenticated, non-guest users with at least one proof.

  useEffect(() => {
    if (isAuthenticated && !isGuest && proofs.length > 0) {
      const timer = setTimeout(() => {
        console.log("[Backup] Auto-syncing wallet to Nostr...");
        syncWallet(proofs, mints, transactions).catch(e => console.error("Auto-sync failed:", e));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [proofs, mints, transactions, isAuthenticated, isGuest, syncWallet]);

  // === Effect 7: Initialize Cashu WalletService ===
  // Creates a new WalletService instance connected to the active Cashu mint
  // whenever the mint list changes. Falls back to the first mint if none is active.

  useEffect(() => {
    const activeMint = mints.find(m => m.isActive) || mints[0];
    if (activeMint) {
      walletServiceRef.current = new WalletService(activeMint.url);
      walletServiceRef.current.connect().catch(console.error);
    }
  }, [mints]);

  // === Effect 8: Initialize NWC (Nostr Wallet Connect) Service ===
  // Creates a new NWCService instance from the connection URI.
  // Clears the connection and falls back to Cashu mode if the URI is invalid.

  useEffect(() => {
    if (nwcString) {
      try {
        nwcServiceRef.current = new NWCService(nwcString);
        console.log("NWC Service initialized");
      } catch (e) {
        console.error("Invalid NWC String, clearing...", e);
        setNwcString('');
        localStorage.removeItem('cdg_nwc_string');
        setWalletModeState('cashu');
      }
    }
  }, [nwcString]);

  // === Effect 9: Auto-Refresh Balance on Wallet Mode Change ===
  // When the user switches wallet mode (cashu/nwc/breez), immediately sets the
  // display balance to the cached value for that mode and triggers a full refresh.

  useEffect(() => {
    if (walletMode === 'cashu') {
      setWalletBalance(walletBalances.cashu);
    } else if (walletMode === 'nwc') {
      setWalletBalance(walletBalances.nwc);
    } else if (walletMode === 'breez') {
      setWalletBalance(walletBalances.breez);
    }
    refreshWalletBalance();
  }, [walletMode, nwcString]);

  // === Effect 10: Persist Wallet Mode and NWC Connection ===
  // Saves the current wallet mode and NWC connection string to localStorage.

  useEffect(() => {
    localStorage.setItem('cdg_wallet_mode', walletMode);
    localStorage.setItem('cdg_nwc_string', nwcString);
  }, [walletMode, nwcString]);

  // ---------------------------------------------------------------------------
  // refreshWalletBalance (full implementation)
  // ---------------------------------------------------------------------------

  /**
   * Refresh the wallet balance for the currently active wallet mode.
   * - **Breez**: Queries Breez SDK for Lightning balance
   * - **NWC**: Queries remote wallet via NWC protocol
   * - **Cashu**: Verifies all proofs against their mints (removes spent proofs),
   *   then checks for missed payments via historical Gift Wraps (48h lookback)
   */
  const refreshWalletBalance = async () => {
    setIsBalanceLoading(true);

    // Breez Logic
    if (walletMode === 'breez') {
      if (isBreezInitialized()) {
        try {
          const breezBalance = await getBreezBalance();
          setWalletBalance(breezBalance.balanceSats);
          setWalletBalances(prev => ({ ...prev, breez: breezBalance.balanceSats }));
          console.log(`Breez balance: ${breezBalance.balanceSats} sats`);
        } catch (e) {
          console.error("Breez balance fetch failed:", e);
        }
      } else {
        console.log('Breez SDK not yet initialized, balance pending...');
      }
      setIsBalanceLoading(false);
      return;
    }

    // NWC Logic
    if (walletMode === 'nwc') {
      if (nwcServiceRef.current) {
        try {
          const bal = await nwcServiceRef.current.getBalance();
          setWalletBalance(bal);
          setWalletBalances(prev => ({ ...prev, nwc: bal }));
        } catch (e) {
          console.error("NWC Balance fetch failed", e);
        }
      }
      setIsBalanceLoading(false);
      return;
    }

    // Cashu Logic
    if (!walletServiceRef.current || proofs.length === 0) {
      // Even if no proofs, check for missed payments
      if (currentUserPubkey && !isGuest) {
        const twoDaysAgo = Math.floor(Date.now() / 1000) - (48 * 60 * 60);
        fetchHistoricalGiftWraps(currentUserPubkey, twoDaysAgo).then(async (events) => {
          if (events.length > 0) {
            console.log(`Pull-to-refresh: Found ${events.length} recent Gift Wraps`);
            for (const event of events) {
              const content = event.content;
              if (content && content.includes('cashuA')) {
                const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
                if (tokens) {
                  for (const token of tokens) {
                    const tokenId = token.substring(0, 20);
                    const processedKey = `processed_token_${tokenId}`;
                    if (!localStorage.getItem(processedKey)) {
                      try {
                        await receiveEcash(token);
                        localStorage.setItem(processedKey, Date.now().toString());
                        console.log("Pull-to-refresh: Claimed missed payment!");
                      } catch (e) {
                        console.warn("Failed to claim token on refresh", e);
                      }
                    }
                  }
                }
              }
            }
          }
        }).catch(e => console.warn("Refresh Gift Wrap check failed:", e))
          .finally(() => setIsBalanceLoading(false));
      } else {
        setIsBalanceLoading(false);
      }
      return;
    }

    try {
      console.log("Verifying wallet proofs across all mints...");

      // Group proofs by Mint URL
      const proofsByMint: Record<string, Proof[]> = {};
      const activeMintUrl = mints.find(m => m.isActive)?.url || mints[0]?.url;

      proofs.forEach(p => {
        const url = p.mintUrl || activeMintUrl;
        if (!url) return;
        if (!proofsByMint[url]) proofsByMint[url] = [];
        proofsByMint[url].push(p);
      });

      let allValidProofs: Proof[] = [];
      let hasChanges = false;

      for (const [mintUrl, mintProofs] of Object.entries(proofsByMint)) {
        try {
          console.log(`Verifying ${mintProofs.length} proofs for ${mintUrl}...`);
          let service = walletServiceRef.current;
          if (!service || service['mintUrl'] !== mintUrl) {
            service = new WalletService(mintUrl);
          }

          const validProofs = await service.verifyProofs(mintProofs);
          const validWithUrl = validProofs.map(p => ({ ...p, mintUrl }));
          allValidProofs = [...allValidProofs, ...validWithUrl];

          if (validProofs.length !== mintProofs.length) {
            const lostProofCount = mintProofs.length - validProofs.length;
            const lostAmount = WalletService.calculateBalance(mintProofs) - WalletService.calculateBalance(validProofs);
            console.log(`Found ${lostProofCount} spent proofs for ${mintUrl}. (${mintProofs.length} -> ${validProofs.length}, ${lostAmount} sats removed)`);
            hasChanges = true;
            if (lostAmount > 0) {
              // Notify user of the balance change
              console.warn(`⚠️ ${lostAmount} sats worth of spent proofs removed from wallet`);
              addTransaction('send', lostAmount, `Spent proofs cleared (${mintUrl.split('/').pop()})`, 'cashu', { status: 'complete' });
            }
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.warn(`Failed to verify proofs for ${mintUrl}:`, errorMsg);

          if (errorMsg.includes('different units') || errorMsg.includes('keyset') || errorMsg.includes('unknown keyset')) {
            // Keyset mismatch: keep proofs instead of clearing them.
            // The mint may have rotated keys but the proofs could still be valid
            // once the keyset is refreshed. Warn user instead of silently wiping.
            const lostAmount = WalletService.calculateBalance(mintProofs);
            console.warn(`⚠️ Keyset mismatch for ${mintUrl}. Keeping ${mintProofs.length} proofs (${lostAmount} sats) - may need manual migration.`);
            allValidProofs = [...allValidProofs, ...mintProofs];
            // Alert user so they can take action
            alert(
              `Your wallet mint "${mintUrl}" has updated its keyset. ` +
              `${lostAmount} sats may need to be migrated. ` +
              `Try swapping to a different mint or contact support if your balance looks wrong.`
            );
            continue;
          }

          allValidProofs = [...allValidProofs, ...mintProofs];
        }
      }

      if (hasChanges) {
        console.log("Updating wallet state with verified proofs.");
        setProofs(allValidProofs);
        syncWallet(allValidProofs, mints, transactions);
      } else {
        console.log("All proofs valid.");
      }

      // Also check for missed payments on manual refresh
      if (currentUserPubkey && !isGuest) {
        const twoDaysAgo = Math.floor(Date.now() / 1000) - (48 * 60 * 60);
        fetchHistoricalGiftWraps(currentUserPubkey, twoDaysAgo).then(async (events) => {
          if (events.length > 0) {
            for (const event of events) {
              const content = event.content;
              if (content && content.includes('cashuA')) {
                const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
                if (tokens) {
                  for (const token of tokens) {
                    const tokenId = token.substring(0, 20);
                    const processedKey = `processed_token_${tokenId}`;
                    if (!localStorage.getItem(processedKey)) {
                      try {
                        await receiveEcash(token);
                        localStorage.setItem(processedKey, Date.now().toString());
                      } catch (e) {
                        console.warn("Failed to claim token on refresh", e);
                      }
                    }
                  }
                }
              }
            }
          }
        }).catch(e => console.warn("Refresh Gift Wrap check failed:", e));
      }
    } catch (e) {
      console.error("Wallet refresh failed:", e);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // refreshAllBalances (useCallback)
  // ---------------------------------------------------------------------------

  /**
   * Refresh balances across all three wallet types (Cashu, NWC, Breez) in parallel.
   * Updates both individual balances and the active wallet's display balance.
   * @returns {Promise<void>}
   */
  const refreshAllBalances = useCallback(async () => {
    setIsBalanceLoading(true);
    console.log("Refreshing all wallet balances...");

    const newBalances = { cashu: 0, nwc: 0, breez: 0 };

    // 1. Get Cashu balance from proofs
    try {
      if (proofs.length > 0) {
        newBalances.cashu = WalletService.calculateBalance(proofs);
      }
      console.log(`Cashu balance: ${newBalances.cashu} sats`);
    } catch (e) {
      console.warn("Failed to get Cashu balance:", e);
    }

    // 2. Get NWC balance (if connected)
    if (nwcServiceRef.current && nwcString) {
      try {
        const nwcBal = await nwcServiceRef.current.getBalance();
        newBalances.nwc = nwcBal;
        console.log(`NWC balance: ${newBalances.nwc} sats`);
      } catch (e) {
        console.warn("Failed to get NWC balance:", e);
      }
    }

    // 3. Get Breez balance (if initialized)
    try {
      if (isBreezInitialized()) {
        const breezBal = await getBreezBalance();
        newBalances.breez = breezBal.balanceSats;
        console.log(`Breez balance: ${newBalances.breez} sats`);
      }
    } catch (e) {
      console.warn("Failed to get Breez balance:", e);
    }

    setWalletBalances(newBalances);

    if (walletMode === 'cashu') {
      setWalletBalance(newBalances.cashu);
    } else if (walletMode === 'nwc') {
      setWalletBalance(newBalances.nwc);
    } else if (walletMode === 'breez') {
      setWalletBalance(newBalances.breez);
    }

    const total = newBalances.cashu + newBalances.nwc + newBalances.breez;
    console.log(`Total balance across all wallets: ${total} sats`);

    setIsBalanceLoading(false);
  }, [walletMode, nwcString, proofs]);

  // ---------------------------------------------------------------------------
  // handleIncomingPayment (useCallback, with dedup via animatedPaymentIdsRef)
  // ---------------------------------------------------------------------------

  /**
   * Handle an incoming payment by recording a transaction, triggering the
   * lightning strike animation, refreshing balances, and sending a push notification.
   * Deduplicates animations using animatedPaymentIdsRef (30s cooldown per payment ID).
   * @param {'cashu' | 'nwc' | 'breez'} walletType - Which wallet received the payment
   * @param {number} amount - Amount in satoshis
   * @param {string} description - Human-readable description
   * @param {string} [paymentId] - Unique payment identifier for deduplication
   */
  const handleIncomingPayment = useCallback((
    walletType: 'cashu' | 'nwc' | 'breez',
    amount: number,
    description: string,
    paymentId?: string
  ) => {
    if (!amount || amount <= 0) return;

    const txId = paymentId ? `${walletType}-${paymentId}` : undefined;

    // Check if we've already animated this payment
    if (txId && animatedPaymentIdsRef.current.has(txId)) {
      console.log(`[handleIncomingPayment] Already animated payment ${txId}, skipping animation`);
      addTransaction('receive', amount, description, walletType, { id: txId });
      refreshAllBalances();
      return;
    }

    // Mark as animated
    if (txId) {
      animatedPaymentIdsRef.current.add(txId);
      setTimeout(() => animatedPaymentIdsRef.current.delete(txId), 30000);
    }

    addTransaction('receive', amount, description, walletType, { id: txId });
    setLightningStrike({ amount, show: true });
    refreshAllBalances();

    // Push notification for payment received (fires when app is backgrounded)
    notifyPaymentReceived(amount);
  }, [refreshAllBalances]);

  // ---------------------------------------------------------------------------
  // reconcileBreezPayments (useCallback)
  // ---------------------------------------------------------------------------

  /**
   * Reconcile Breez payment history with local transaction list.
   * Syncs the Breez node, fetches full payment history, and adds any transactions
   * not yet recorded locally. Shows a lightning strike animation for the most recent
   * missed receive payment.
   */
  const reconcileBreezPayments = useCallback(async () => {
    if (!isBreezInitialized()) return;

    try {
      await syncBreez();
      const history = await getPaymentHistory();
      if (!history || history.length === 0) return;

      let latestNewReceive: { amount: number; timestamp: number } | null = null;

      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const toAdd: WalletTransaction[] = [];

        for (const p of history) {
          if (!p) continue;
          if (p.status === 'failed') continue;
          if (!p.amountSats || p.amountSats <= 0) continue;

          const txId = `breez-${p.id}`;
          if (existingIds.has(txId)) continue;

          if (animatedPaymentIdsRef.current.has(txId)) {
            console.log(`[Breez Reconciliation] Payment ${txId} already animated, skipping animation`);
            continue;
          }

          const tsSeconds = Math.floor(p.timestamp || Date.now() / 1000);
          const tsMillis = tsSeconds * 1000;
          const tx: WalletTransaction = {
            id: txId,
            type: p.paymentType === 'receive' ? 'receive' : 'send',
            amountSats: p.amountSats,
            description: p.paymentType === 'receive' ? 'Received via Breez Lightning' : 'Sent via Breez Lightning',
            timestamp: tsMillis,
            walletType: 'breez' as const
          };

          toAdd.push(tx);

          if (tx.type === 'receive') {
            if (!latestNewReceive || tsMillis > latestNewReceive.timestamp) {
              latestNewReceive = { amount: tx.amountSats, timestamp: tsMillis };
            }
          }
        }

        if (toAdd.length === 0) return prev;

        const next = [...toAdd, ...prev];
        next.sort((a, b) => b.timestamp - a.timestamp);
        return next;
      });

      if (latestNewReceive) {
        console.log(`[Breez Reconciliation] Found missed payment, showing animation for ${latestNewReceive.amount} sats`);
        setLightningStrike({ amount: latestNewReceive.amount, show: true });
        await refreshAllBalances();
      }
    } catch (e) {
      console.warn("Breez reconciliation failed:", e);
    }
  }, [refreshAllBalances]);

  // ---------------------------------------------------------------------------
  // reconcileOnResume (useCallback)
  // ---------------------------------------------------------------------------

  /**
   * Full wallet reconciliation triggered when the app returns to foreground.
   * Refreshes all balances and reconciles Breez payment history to catch
   * any payments received while the app was backgrounded.
   */
  const reconcileOnResume = useCallback(async () => {
    console.log('[Resume] Running full wallet reconciliation...');
    try {
      await refreshAllBalances();
      await reconcileBreezPayments();
      console.log('[Resume] Reconciliation complete');
    } catch (e) {
      console.warn('[Resume] Reconciliation error:', e);
    }
  }, [refreshAllBalances, reconcileBreezPayments]);

  // ---------------------------------------------------------------------------
  // tryInitBreez — shared Breez init logic (called from Effect 11 + retry button)
  // ---------------------------------------------------------------------------
  const tryInitBreez = useCallback(async () => {
    const hasMnemonic = hasStoredMnemonic(false) || hasStoredMnemonic(true);
    if (!hasMnemonic) return;

    setBreezInitError(null);

    // Helper: subscribe to Breez payment events and refresh balances
    const onReady = () => {
      setBreezReady(true);
      setBreezInitError(null);

      // Keep exactly one active Breez event listener. Retry/sync paths can call
      // tryInitBreez after the SDK is already initialized; without cleanup, each
      // call would register another listener and duplicate transaction handling.
      breezPaymentSubscriptionCleanupRef.current?.();
      breezPaymentSubscriptionCleanupRef.current = subscribeToBreezEvents(
        (payment) => {
          const amountSats = payment.amountSats;
          console.log(`Received ${amountSats} sats via Breez! (id: ${payment.id})`);
          handleIncomingPayment('breez', amountSats, 'Received via Breez Lightning', payment.id);
        },
        (payment) => {
          const amountSats = payment.amountSats;
          console.log(`Sent ${amountSats} sats via Breez (id: ${payment.id})`);
          if (amountSats && amountSats > 0) {
            const txId = payment.id ? `breez-${payment.id}` : undefined;
            addTransaction('send', amountSats, 'Sent via Breez Lightning', 'breez', { id: txId });
            refreshAllBalances();
          }
        }
      );
      refreshAllBalances();
    };

    // Finalization.tsx may have already initialized Breez — just sync React state
    if (isBreezInitialized()) {
      console.log('[WalletContext] Breez already initialized, syncing state...');
      onReady();
      return;
    }

    console.log('[WalletContext] Starting Breez SDK initialization...');

    let mnemonic = retrieveMnemonicEncrypted(currentUserPubkey, false);
    if (!mnemonic) {
      mnemonic = retrieveMnemonicEncrypted(currentUserPubkey, true);
    }

    if (!mnemonic) {
      console.warn('[WalletContext] No mnemonic found for Breez init');
      setBreezInitError('No wallet seed found. Try logging out and back in.');
      return;
    }

    if (!BREEZ_CONFIG_READINESS.hasApiKey) {
      console.warn('[WalletContext] Breez initialization skipped: VITE_BREEZ_API_KEY is missing from this build.');
      setBreezInitError(BREEZ_CONFIG_READINESS.missingApiKeyMessage);
      return;
    }

    const breezConfig = {
      apiKey: BREEZ_API_KEY,
      environment: 'production' as const
    };

    try {
      const success = await initializeBreez(mnemonic, breezConfig);
      if (success) {
        console.log('[WalletContext] Breez SDK initialized successfully');
        onReady();
      } else {
        console.warn('[WalletContext] Breez init returned false');
        setBreezInitError('Lightning wallet failed to start. Tap to retry.');
      }
    } catch (e: any) {
      console.warn('[WalletContext] Breez initialization error:', e);
      setBreezInitError(e?.message || 'Lightning wallet initialization failed. Tap to retry.');
    }
  }, [currentUserPubkey, refreshAllBalances]);

  // === Effect 11: Wallet Restoration on Login ===
  // Triggered when `currentUserPubkey` changes. Performs three major tasks:
  // 1. Fetches encrypted wallet backup from Nostr and merges proofs/transactions/mints
  //    with local state. Restores gateway registrations (re-registers if needed).
  // 2. Scans historical NIP-17 Gift Wraps (7-day lookback) for unclaimed Cashu tokens.
  // 3. Initializes Breez SDK for mnemonic-based users (derives from stored seed),
  //    sets up payment event subscriptions, and refreshes all balances.

  useEffect(() => {
    if (currentUserPubkey && !isGuest) {
      // Log the user's Lightning address for debugging
      const lightningAddress = getMagicLightningAddress(currentUserPubkey);
      console.log(`Your Lightning Address: ${lightningAddress}`);
      console.log(`Your Pubkey: ${currentUserPubkey}`);

      // Restore Wallet Proofs (Merge Strategy)
      fetchWalletBackup(currentUserPubkey).then(async (backup) => {
        if (backup) {
          console.log("Found remote backup, merging...");

          // Merge existing proofs with remote proofs
          setProofs(currentLocalProofs => {
            const merged = WalletService.deduplicateProofs(currentLocalProofs, backup.proofs);
            return merged;
          });

          // Merge Transactions
          setTransactions(currentTxs => {
            const existingIds = new Set(currentTxs.map(t => t.id));
            const newTxs = backup.transactions.filter(t => !existingIds.has(t.id));
            return [...newTxs, ...currentTxs].sort((a, b) => b.timestamp - a.timestamp);
          });

          if (backup.mints.length > 0) setMints(backup.mints);

          // Restore Gateway Registrations
          if (backup.gatewayRegistrations && backup.gatewayRegistrations.length > 0) {
            console.log(`Restoring ${backup.gatewayRegistrations.length} gateway registrations...`);
            localStorage.setItem('gateway_registrations', JSON.stringify(backup.gatewayRegistrations));

            const needsReregistration = backup.gatewayRegistrations.some((reg: any) => !reg.success);
            if (needsReregistration) {
              console.log("Some gateway registrations failed previously, attempting to re-register...");
              try {
                const newRegistrations = await registerWithAllGateways();
                const mergedRegistrations = backup.gatewayRegistrations.map((existing: any) => {
                  const updated = newRegistrations.find(newReg => newReg.gateway === existing.gateway);
                  return updated || existing;
                });
                localStorage.setItem('gateway_registrations', JSON.stringify(mergedRegistrations));
              } catch (e) {
                console.warn("Failed to re-register gateways:", e);
              }
            }
          } else {
            console.log("No gateway registrations in backup, registering now...");
            try {
              await registerWithAllGateways();
            } catch (e) {
              console.warn("Failed to register gateways on restore:", e);
            }
          }
        } else {
          console.log("No wallet backup found. Creating initial backup to enable payment detection.");
          setProofs(current => {
            if (current.length > 0) {
              console.log("Creating initial backup with existing funds...");
            } else {
              console.log("Creating empty initial backup to enable payment tracking...");
            }
            setTimeout(() => {
              syncWallet(current, mints, transactions).catch(e =>
                console.error("Initial backup failed:", e)
              );
            }, 100);
            return current;
          });

          console.log("Registering with payment gateways for new account...");
          try {
            await registerWithAllGateways();
          } catch (e) {
            console.warn("Failed to register gateways for new account:", e);
          }
        }
      }).catch(e => console.error("Wallet restore failed:", e));

      // Check for Missed Cashu Payments (Historical Gift Wraps)
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      fetchHistoricalGiftWraps(currentUserPubkey, sevenDaysAgo).then(async (events) => {
        if (events.length > 0) {
          console.log(`Found ${events.length} historical Gift Wraps, checking for Cashu tokens...`);

          let claimedCount = 0;

          for (const event of events) {
            const content = event.content;
            if (content && content.includes('cashuA')) {
              const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
              if (tokens) {
                for (const token of tokens) {
                  try {
                    const tokenId = token.substring(0, 20);
                    const processedKey = `processed_token_${tokenId}`;
                    if (localStorage.getItem(processedKey)) {
                      console.log(`Token ${tokenId} already processed, skipping...`);
                      continue;
                    }

                    const success = await receiveEcash(token);
                    if (success) {
                      claimedCount++;
                      localStorage.setItem(processedKey, Date.now().toString());
                      console.log(`Auto-claimed historical Cashu token!`);
                    }
                  } catch (e) {
                    console.warn("Failed to claim historical token", e);
                  }
                }
              }
            }
          }

          if (claimedCount > 0) {
            console.log(`Recovered ${claimedCount} missed payments!`);
          }
        }
      }).catch(e => console.warn("Historical Gift Wrap fetch failed:", e));

      // Initialize Breez Lightning Wallet (for mnemonic-based users)
      tryInitBreez();
    }
  }, [currentUserPubkey, isGuest]);

  // === Effect 12: Listen for DMs (Auto-Redeem eCash) ===
  // Subscribes to incoming NIP-04 DMs. Scans decrypted content for Cashu tokens
  // (cashuA... prefix) and auto-redeems them. Dispatches 'ecash-received-from-player'
  // custom event so RoundContext can mark the sender as paid.

  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToDirectMessages(async (event, decrypted) => {
        if (decrypted.includes('cashuA')) {
          console.log("Received potential eCash in DM from", event.pubkey);
          const tokens = decrypted.match(/cashuA[A-Za-z0-9_=-]+/g);

          if (tokens) {
            for (const token of tokens) {
              try {
                const success = await receiveEcash(token);
                if (success) {
                  console.log("Auto-redeemed token from DM!");
                  // Dispatch event so RoundContext can mark the player as paid
                  window.dispatchEvent(new CustomEvent('ecash-received-from-player', {
                    detail: { playerPubkey: event.pubkey }
                  }));
                }
              } catch (e) {
                console.warn("Failed to auto-redeem token", e);
              }
            }
          }
        }
      });

      return () => sub.close();
    }
  }, [isAuthenticated, isGuest]);

  // === Effect 13: Listen for NIP-17 Gift Wraps ===
  // Subscribes to incoming NIP-17 Gift Wrap events. Handles multiple message types:
  // - **Cashu tokens**: Auto-redeems and triggers incoming payment animation
  // - **Payment requests**: Dispatches 'payment-request-received' for PaymentRequestModal
  // - **Payment confirmations**: Dispatches 'payment-confirmation-received' for hosts
  // - **Round invites**: Triggers push notification for round invitation

  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToGiftWraps(async (event) => {
        console.log("Received NIP-17 Gift Wrap!", event);
        const content = event.content;
        if (content && content.includes('cashuA')) {
          console.log("Found Cashu token in Gift Wrap!");
          const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
          if (tokens) {
            for (const token of tokens) {
              try {
                // Extract amount from token before redeeming
                let tokenAmount = 0;
                try {
                  const decoded = getDecodedToken(token) as any;
                  tokenAmount = decoded.token?.[0]?.proofs?.reduce((s: number, p: any) => s + (p.amount || 0), 0) || 0;
                } catch { /* amount extraction failed, will still redeem */ }

                const success = await receiveEcash(token);
                if (success) {
                  console.log(`Auto-redeemed ${tokenAmount} sats from Gift Wrap!`);
                  if (tokenAmount > 0) {
                    handleIncomingPayment('cashu', tokenAmount, 'Received via Lightning Bridge', event.id);
                  }
                }
              } catch (e) {
                console.warn("Failed to redeem token from Gift Wrap", e);
              }
            }
          }
        }

        // Detect payment requests from round hosts
        if (content && content.includes('"payment_request"')) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.type === 'payment_request' && parsed.invoice) {
              window.dispatchEvent(new CustomEvent('payment-request-received', {
                detail: {
                  invoice: parsed.invoice,
                  amount: parsed.amount,
                  breakdown: parsed.breakdown,
                  round: parsed.round,
                  message: parsed.message,
                  senderPubkey: event.pubkey,
                }
              }));
              notifyPaymentRequest(
                parsed.round?.course || 'a round',
                parsed.round?.host || 'A player',
                parsed.amount || 0
              );
              return; // Already handled — skip generic invite notification below
            }
          } catch { /* not a valid payment request JSON */ }
        }

        // Detect payment confirmations from players (for hosts)
        if (content && content.includes('"payment_confirmation"')) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.type === 'payment_confirmation') {
              window.dispatchEvent(new CustomEvent('payment-confirmation-received', {
                detail: { senderPubkey: event.pubkey, amount: parsed.amount, round: parsed.round }
              }));
            }
          } catch { /* ignore */ }
        }

        // Detect round invite messages (contain "invited you to play")
        if (content && content.includes('invited you to play')) {
          try {
            const parsed = JSON.parse(content);
            const message = parsed.message || content;
            const inviterMatch = message.match(/^(.+?) invited you/);
            const courseMatch = message.match(/play at (.+?)\./);
            const hostName = inviterMatch?.[1] || 'Someone';
            const roundName = courseMatch?.[1] || 'a round';
            notifyRoundInvite(roundName, hostName);
          } catch {
            // Content may not be JSON, try plain text
            notifyRoundInvite('a round', 'A player');
          }
        }
      });

      return () => sub.close();
    }
  }, [isAuthenticated, isGuest]);

  // === Effect 14: Listen for Lightning Nutzaps ===
  // Subscribes to Nutzap events (Lightning zaps that produce Cashu tokens).
  // Extracts the zap amount from the description tag, verifies the recipient
  // matches the current user, and triggers incoming payment handling with sound.

  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToNutzaps(async (event) => {
        console.log("Processing nutzap payment!", event);

        try {
          const zapRequest = event.tags.find((t: string[]) => t[0] === 'description')?.[1];
          if (zapRequest) {
            const zapData = JSON.parse(zapRequest);
            const amountMsats = parseInt(zapData.amount);
            const amount = Math.floor(amountMsats / 1000);

            const recipient = zapData.tags?.find((t: any[]) => t[0] === 'p')?.[1];
            const ourLud16 = getMagicLightningAddress(currentUserPubkey);

            if (recipient === currentUserPubkey || zapData.lud16 === ourLud16) {
              console.log(`Lightning nutzap received: ${amount} sats (event: ${event.id})`);

              handleIncomingPayment('cashu', amount, 'Received via Lightning Zap', event.id);

              try {
                const audio = new Audio('/lightning-strike.mp3');
                audio.volume = 0.3;
                audio.play().catch(e => console.warn('Could not play lightning sound:', e));
              } catch (e) {
                console.warn('Audio not supported:', e);
              }
            }
          }
        } catch (e) {
          console.warn("Failed to process nutzap", e);
        }
      });

      return () => sub.close();
    }
  }, [isAuthenticated, isGuest, currentUserPubkey]);

  // === Effect 15: Listen for Lightning Gift Wraps ===
  // Subscribes to Lightning-specific Gift Wrap events. These are typically
  // generated by Lightning-to-Cashu gateway services. Extracts and redeems
  // embedded Cashu tokens, triggers payment notification and animation.

  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToLightningGiftWraps(async (event) => {
        console.log("Processing Lightning gift-wrap payment!", event);

        try {
          const content = event.content;
          if (content && content.includes('cashuA')) {
            console.log("Found Cashu token in Lightning gift-wrap!");
            const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
            if (tokens) {
              for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                try {
                  // Extract amount from token before redeeming
                  let tokenAmount = 0;
                  try {
                    const decoded = getDecodedToken(token) as any;
                    tokenAmount = decoded.token?.[0]?.proofs?.reduce((s: number, p: any) => s + (p.amount || 0), 0) || 0;
                  } catch { /* amount extraction failed, will still redeem */ }

                  const success = await receiveEcash(token);
                  if (success) {
                    console.log(`Auto-redeemed ${tokenAmount} sats from Lightning gift-wrap!`);
                    if (tokenAmount > 0) {
                      handleIncomingPayment('cashu', tokenAmount, 'Received via Lightning Gateway', `${event.id}-${i}`);
                      setPaymentNotification({ amount: tokenAmount, context: 'wallet_receive' });
                    }
                  }
                } catch (e) {
                  console.warn("Failed to redeem token from Lightning gift-wrap", e);
                }
              }
            }
          }
        } catch (e) {
          console.warn("Failed to process Lightning gift-wrap", e);
        }
      });

      return () => sub.close();
    }
  }, [isAuthenticated, isGuest]);

  // === Effect 16: Real-Time Multi-Gateway Payment Detection via WebSocket ===
  // Subscribes to WebSocket updates from all registered payment gateways (npub.cash,
  // Minibits, etc.) for real-time payment detection. When a quote transitions to PAID,
  // mints new Cashu proofs and records the payment. Includes a 60-second fallback
  // polling mechanism in case WebSocket events are missed.

  useEffect(() => {
    if (isAuthenticated && currentUserPubkey) {
      console.log("Setting up multi-gateway WebSocket subscriptions for payment detection...");

      const handleQuoteUpdate = async (quoteId: string, gateway: string) => {
        console.log(`[${gateway}] Received quote update: ${quoteId}`);

        try {
          const quote = await getQuoteById(quoteId);

          if (!quote) {
            console.warn(`Quote ${quoteId} not found on ${gateway}`);
            return;
          }

          console.log(`Quote ${quoteId} state: ${quote.state}, amount: ${quote.amount}`);

          if (quote.state !== 'PAID') {
            console.log(`Quote ${quoteId} is not PAID yet, skipping...`);
            return;
          }

          const processedKey = `processed_quote_${gateway}_${quoteId}`;
          if (localStorage.getItem(processedKey)) {
            console.log(`Quote ${quoteId} from ${gateway} already processed, skipping...`);
            return;
          }

          console.log(`[${gateway}] Minting ${quote.amount} sats from ${quote.mintUrl} for quote ${quoteId}...`);

          const mint = new CashuMint(quote.mintUrl);
          const wallet = new CashuWallet(mint);
          await wallet.loadMint();

          const newProofs = await wallet.mintProofs(quote.amount, quoteId);

          if (newProofs && newProofs.length > 0) {
            const proofsWithMint = newProofs.map(p => ({ ...p, mintUrl: quote.mintUrl }));
            setProofs(prev => [...prev, ...proofsWithMint]);

            setMints(prev => {
              if (prev.find(m => m.url === quote.mintUrl)) return prev;
              return [...prev, { url: quote.mintUrl, nickname: gateway, isActive: true }];
            });

            localStorage.setItem(processedKey, Date.now().toString());

            handleIncomingPayment('cashu', quote.amount, `Received via ${gateway}`, quoteId);

            console.log(`[${gateway}] Successfully received ${quote.amount} sats!`);

            const context = window.location.pathname.includes('/wallet') ? 'wallet_receive' : undefined;
            window.dispatchEvent(new CustomEvent('gateway-payment-received', {
              detail: { quoteId, amount: quote.amount, gateway, context }
            }));
          }
        } catch (e) {
          console.error(`Failed to process quote ${quoteId} from ${gateway}:`, e);
        }
      };

      const handleError = (error: any, gateway: string) => {
        console.error(`[${gateway}] WebSocket subscription error:`, error);
      };

      const disposer = subscribeToAllGatewayUpdates(handleQuoteUpdate, handleError);

      // FALLBACK: Poll all gateways for pending payments every 60 seconds
      let pollingInterval: NodeJS.Timeout | null = null;
      let pollingTimeout: NodeJS.Timeout | null = null;

      const pollAllGateways = async () => {
        try {
          console.log("Polling all gateways for pending payments (fallback)...");
          const pendingQuotes = await checkPendingPayments();

          for (const quote of pendingQuotes) {
            const gateway = quote.mintUrl?.includes('minibits') ? 'minibits.cash' : 'npub.cash';
            await handleQuoteUpdate(quote.quoteId, gateway);
          }
        } catch (e) {
          console.error("Multi-gateway polling failed:", e);
        }
      };

      pollingTimeout = setTimeout(() => {
        pollingInterval = setInterval(pollAllGateways, 60000);
        console.log("Started multi-gateway fallback polling (every 60s)");
        pollAllGateways();
      }, 60000);

      return () => {
        console.log("Cleaning up multi-gateway WebSocket subscriptions...");
        disposer();
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          console.log("Cancelled polling startup timeout");
        }
        if (pollingInterval) {
          clearInterval(pollingInterval);
          console.log("Stopped multi-gateway fallback polling");
        }
      };
    }
  }, [isAuthenticated, isGuest, currentUserPubkey]);

  // === Effect 17: Breez Payment Reconciliation ===
  // Triggered when the Breez balance changes. Syncs the Breez node and reconciles
  // payment history to catch any payments that were received but not yet recorded
  // in the local transaction list (e.g., payments received while app was backgrounded).

  useEffect(() => {
    reconcileBreezPayments();
  }, [walletBalances.breez, reconcileBreezPayments]);

  // ---------------------------------------------------------------------------
  // WALLET ACTIONS
  // ---------------------------------------------------------------------------

  /**
   * Generate a Lightning invoice to receive funds. Routes to the active wallet backend:
   * - **Breez**: Creates invoice via Breez SDK
   * - **NWC**: Creates invoice via NWC makeInvoice
   * - **Cashu**: Creates a mint quote via the active Cashu mint
   * @param {number} amount - Amount in satoshis to request
   * @returns {Promise<{ request: string; quote: string }>} Lightning invoice (request) and quote ID
   */
  const depositFunds = async (amount: number): Promise<{ request: string; quote: string }> => {
    if (walletMode === 'breez') {
      const result = await breezCreateInvoice(amount, 'Round Entry Fee');
      if (!result) throw new Error('Breez invoice generation failed');
      return { request: result.bolt11, quote: result.paymentHash };
    }

    if (walletMode === 'nwc') {
      if (!nwcServiceRef.current) throw new Error("NWC not connected");
      const { invoice, paymentHash } = await nwcServiceRef.current.makeInvoice(amount, "Deposit to NWC Wallet");
      return { request: invoice, quote: paymentHash };
    }

    if (!walletServiceRef.current) throw new Error("Wallet not connected");
    return await walletServiceRef.current.requestDeposit(amount);
  };

  /**
   * Check whether a deposit invoice has been paid.
   * @param {string} quote - Quote ID or payment hash returned by depositFunds
   * @returns {Promise<boolean>} True if the invoice has been paid
   */
  const checkDepositStatus = async (quote: string): Promise<boolean> => {
    if (walletMode === 'breez') {
      try {
        const history = await getPaymentHistory();
        return history.some((p: any) => p.paymentHash === quote && p.status === 'complete');
      } catch { return false; }
    }

    if (walletMode === 'nwc') {
      if (!nwcServiceRef.current) return false;
      try {
        const { paid } = await nwcServiceRef.current.lookupInvoice(quote);
        return paid;
      } catch (e) {
        console.warn("NWC lookup failed", e);
        return false;
      }
    }

    if (!walletServiceRef.current) return false;
    return await walletServiceRef.current.checkDepositQuoteStatus(quote);
  };

  /**
   * Finalize a deposit after the invoice has been paid.
   * - **Breez/NWC**: Just refreshes balance and records the payment
   * - **Cashu**: Mints new proofs from the quote and updates wallet state
   * @param {string} quote - Quote ID from depositFunds
   * @param {number} amount - Amount that was deposited
   * @returns {Promise<boolean>} True if deposit was successfully confirmed
   */
  const confirmDeposit = async (quote: string, amount: number): Promise<boolean> => {
    if (walletMode === 'breez') {
      await refreshAllBalances();
      handleIncomingPayment('breez', amount, 'Round Entry Fee', quote);
      return true;
    }

    if (walletMode === 'nwc') {
      await refreshWalletBalance();
      handleIncomingPayment('nwc', amount, 'Received via NWC', quote);
      return true;
    }

    if (!walletServiceRef.current) return false;
    try {
      const newProofs = await walletServiceRef.current.completeDeposit(quote, amount);
      const updatedProofs = [...proofs, ...newProofs];
      setProofs(updatedProofs);

      const newTx: WalletTransaction = {
        id: Date.now().toString(),
        type: 'deposit',
        amountSats: amount,
        description: 'Mint Deposit',
        timestamp: Date.now()
      };

      setTransactions(prev => {
        const updatedTxs = [newTx, ...prev];
        syncWallet(updatedProofs, mints, updatedTxs);
        return updatedTxs;
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  /**
   * Get a fee estimate for paying a Lightning invoice (Cashu only).
   * @param {string} invoice - BOLT11 Lightning invoice
   * @returns {Promise<{ amount: number; fee: number }>} Invoice amount and estimated fee in sats
   */
  const getLightningQuote = async (invoice: string): Promise<{ amount: number; fee: number }> => {
    if (!walletServiceRef.current) throw new Error("Wallet not connected");
    return await walletServiceRef.current.getLightningQuote(invoice);
  };

  /**
   * Pay a Lightning invoice using the active wallet backend.
   * - **Breez**: Pays via Breez SDK, refreshes balance
   * - **NWC**: Pays via NWC payInvoice, handles timeout gracefully
   * - **Cashu**: Melts proofs to pay invoice, includes spent-proof recovery on error
   * @param {number} amount - Expected payment amount in sats
   * @param {string} invoice - BOLT11 Lightning invoice to pay
   * @returns {Promise<boolean>} True if payment succeeded
   * @throws {Error} On payment failure (after recovery attempt for Cashu)
   */
  const sendFunds = async (amount: number, invoice: string): Promise<boolean> => {
    if (walletMode === 'breez') {
      const result = await breezPayInvoice(invoice);
      if (!result.success) throw new Error(result.error || 'Breez payment failed');
      await refreshAllBalances();
      return true;
    }

    if (walletMode === 'nwc') {
      if (!nwcServiceRef.current) throw new Error("NWC not connected");
      try {
        await nwcServiceRef.current.payInvoice(invoice);
        addTransaction('send', amount, 'Paid via NWC', 'nwc');
        refreshWalletBalance();
        return true;
      } catch (e) {
        console.error("NWC Payment failed", e);
        if (e instanceof Error && e.message === "NWC Timeout") {
          alert("Payment timed out. It may have still gone through. Please check your wallet before retrying.");
          refreshWalletBalance();
          return false;
        }
        throw e;
      }
    }

    if (!walletServiceRef.current) return false;
    if (walletBalance < amount) return false;

    const proofsToSpend = proofs;

    try {
      const { remaining } = await walletServiceRef.current.payInvoice(invoice, proofsToSpend);
      setProofs(remaining);

      const newTx: WalletTransaction = {
        id: Date.now().toString(),
        type: 'send',
        amountSats: amount,
        description: 'Paid Invoice',
        timestamp: Date.now(),
        walletType: 'cashu'
      };

      setTransactions(prev => {
        const updated = [newTx, ...prev];
        syncWallet(remaining, mints, updated);
        return updated;
      });

      return true;
    } catch (e) {
      console.error("Send failed logic, attempting recovery:", e);

      const errorMsg = e instanceof Error ? e.message : String(e);
      if (errorMsg.includes('different units') || errorMsg.includes('keyset') || errorMsg.includes('unknown keyset')) {
        console.warn("Cashu keyset mismatch detected during send. Proofs kept for manual migration.");
        alert(
          "This payment failed because the mint updated its keyset. " +
          "Your funds are still safe. Try refreshing your wallet or switching to a different mint."
        );
        return false;
      }

      // RECOVERY: Check if proofs were spent despite the error (False Negative)
      try {
        const validProofs = await walletServiceRef.current.verifyProofs(proofsToSpend);
        const prevBal = WalletService.calculateBalance(proofsToSpend);
        const newBal = WalletService.calculateBalance(validProofs);

        if ((prevBal - newBal) >= amount) {
          console.log("Transaction recovered: Funds were spent.");
          setProofs(validProofs);

          const newTx: WalletTransaction = {
            id: Date.now().toString(),
            type: 'send',
            amountSats: amount,
            description: 'Paid Invoice',
            timestamp: Date.now(),
            walletType: 'cashu'
          };

          setTransactions(prev => {
            const updated = [newTx, ...prev];
            syncWallet(validProofs, mints, updated);
            return updated;
          });

          return true;
        }
      } catch (recErr) {
        console.error("Recovery failed:", recErr);
      }

      await refreshWalletBalance();
      throw e;
    }
  };

  /**
   * Create a Cashu eCash token for a given amount. Used for P2P payments
   * (entry fees sent via DM, tournament registration, etc.).
   * Validates proof integrity before attempting to create the token.
   * @param {number} amount - Amount in satoshis to encode in the token
   * @returns {Promise<string>} Serialized Cashu token string (cashuA...)
   * @throws {Error} If wallet not connected, insufficient funds, or no valid proofs
   */
  const createToken = async (amount: number): Promise<string> => {
    if (!walletServiceRef.current) throw new Error("Wallet not connected");
    if (walletBalance < amount) throw new Error("Insufficient funds");

    const validProofs = proofs.filter(proof => {
      return proof &&
        typeof proof === 'object' &&
        proof.id &&
        proof.amount &&
        proof.secret &&
        proof.C;
    });

    if (validProofs.length === 0) {
      throw new Error("No valid proofs available for token creation");
    }

    const totalAvailable = validProofs.reduce((sum, proof) => sum + (proof.amount || 0), 0);
    if (totalAvailable < amount) {
      throw new Error(`Insufficient proof value: need ${amount} sats, have ${totalAvailable} sats`);
    }

    try {
      const { token, remaining } = await walletServiceRef.current.createTokenWithProofs(amount, validProofs);
      setProofs(remaining);

      const newTx: WalletTransaction = {
        id: Date.now().toString(),
        type: 'send',
        amountSats: amount,
        description: 'Created Token',
        timestamp: Date.now(),
        walletType: 'cashu'
      };

      setTransactions(prev => {
        const updated = [newTx, ...prev];
        syncWallet(remaining, mints, updated);
        return updated;
      });

      return token;
    } catch (e) {
      console.error("Create token failed", e);
      if (e instanceof Error) {
        throw e;
      } else {
        throw new Error(`Token creation failed: ${String(e)}`);
      }
    }
  };

  /**
   * Redeem a Cashu eCash token. Extracts the mint URL from the token,
   * receives new proofs, records a transaction, triggers lightning strike
   * animation, and plays a sound effect.
   * @param {string} token - Serialized Cashu token (cashuA...)
   * @returns {Promise<boolean>} True if the token was successfully redeemed
   */
  const receiveEcash = async (token: string): Promise<boolean> => {
    if (!walletServiceRef.current) return false;
    try {
      const newProofs = await walletServiceRef.current.receiveToken(token);

      // Extract mint URL from token to ensure we tag proofs correctly
      const decoded = getDecodedToken(token) as any;
      const tokenMintUrl = decoded.token[0].mint;

      const proofsWithMint = newProofs.map(p => ({ ...p, mintUrl: tokenMintUrl }));
      const updatedProofs = [...proofs, ...proofsWithMint];

      setProofs(updatedProofs);
      const amount = WalletService.calculateBalance(newProofs);

      const newTx: WalletTransaction = {
        id: Date.now().toString(),
        type: 'receive',
        amountSats: amount,
        description: 'Received eCash',
        timestamp: Date.now(),
        walletType: 'cashu'
      };

      setTransactions(prev => {
        const updatedTxs = [newTx, ...prev];
        syncWallet(updatedProofs, mints, updatedTxs);
        return updatedTxs;
      });

      // Trigger lightning strike for auto-received payments
      setLightningStrike({ amount, show: true });

      // Play lightning strike sound
      try {
        const audio = new Audio('/lightning-strike.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.warn('Could not play lightning sound:', e));
      } catch (e) {
        console.warn('Audio not supported:', e);
      }

      return true;
    } catch (e) {
      console.error("Receive failed", e);
      return false;
    }
  };

  /**
   * Manually check all npub.cash gateways for pending payments.
   * Mints Cashu proofs for any PAID quotes not yet processed.
   * @returns {Promise<number>} Number of payments successfully claimed
   */
  const checkForPayments = async (): Promise<number> => {
    if (!currentUserPubkey || isGuest) return 0;

    try {
      const quotes = await checkPendingPayments();

      if (quotes.length > 0) {
        console.log(`Found ${quotes.length} pending npub.cash payments!`);

        let claimedCount = 0;

        for (const quote of quotes) {
          try {
            const quoteId = quote.quoteId;
            const processedKey = `processed_quote_${quoteId}`;
            if (localStorage.getItem(processedKey)) {
              console.log(`Quote ${quoteId} already processed, skipping...`);
              continue;
            }

            console.log(`Attempting to mint ${quote.amount} sats from ${quote.mintUrl} for quote ${quoteId}...`);

            const mint = new CashuMint(quote.mintUrl);
            const wallet = new CashuWallet(mint);
            await wallet.loadMint();

            const newProofs = await wallet.mintProofs(quote.amount, quote.quoteId);

            if (newProofs && newProofs.length > 0) {
              const proofsWithMint = newProofs.map(p => ({ ...p, mintUrl: quote.mintUrl }));
              setProofs(prev => [...prev, ...proofsWithMint]);

              setMints(prev => {
                if (prev.find(m => m.url === quote.mintUrl)) return prev;
                return [...prev, { url: quote.mintUrl, nickname: 'npub.cash', isActive: true }];
              });

              claimedCount++;
              localStorage.setItem(processedKey, Date.now().toString());
              console.log(`Auto-claimed npub.cash payment!`);

              handleIncomingPayment('cashu', quote.amount, 'Received via npub.cash', quote.quoteId);
              alert(`Successfully received ${quote.amount} sats from npub.cash!`);
            }
          } catch (e) {
            console.warn("Failed to mint npub.cash quote", e);
            alert(`Failed to claim payment: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
          }
        }

        if (claimedCount > 0) {
          console.log(`Recovered ${claimedCount} npub.cash payments!`);
        }
        return claimedCount;
      } else {
        return 0;
      }
    } catch (e) {
      console.warn("npub.cash check failed:", e);
      alert(`Error checking npub.cash: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      return 0;
    }
  };

  /**
   * Add a new Cashu mint. The first mint added is automatically set as active.
   * @param {string} url - Mint URL
   * @param {string} nickname - Display name for the mint
   */
  const addMint = (url: string, nickname: string) => {
    setMints(prev => [...prev, { url, nickname, isActive: prev.length === 0 }]);
  };

  /**
   * Remove a Cashu mint by URL. Falls back to Minibits default if all mints are removed.
   * Promotes the first remaining mint to active if the removed mint was active.
   * @param {string} url - Mint URL to remove
   */
  const removeMint = (url: string) => {
    setMints(prev => {
      const filtered = prev.filter(m => m.url !== url);
      if (filtered.length === 0) {
        return [{ url: 'https://mint.minibits.cash/Bitcoin', nickname: 'Minibits', isActive: true }];
      }
      const wasActiveRemoved = prev.find(m => m.url === url)?.isActive;
      if (wasActiveRemoved && !filtered.some(m => m.isActive)) {
        filtered[0].isActive = true;
      }
      return filtered;
    });
  };

  /**
   * Set the active Cashu mint. Only one mint can be active at a time.
   * @param {string} url - URL of the mint to activate
   */
  const setActiveMint = (url: string) => {
    setMints(prev => prev.map(m => ({ ...m, isActive: m.url === url })));
  };

  /**
   * Switch the active wallet mode. Triggers balance refresh via Effect 9.
   * @param {'cashu' | 'nwc' | 'breez'} mode - Wallet mode to switch to
   */
  const setWalletModeAction = (mode: 'cashu' | 'nwc' | 'breez') => {
    setWalletModeState(mode);
  };

  /**
   * Set the NWC connection URI and automatically switch to NWC mode.
   * @param {string} uri - NWC connection URI (nostr+walletconnect://...)
   */
  const setNwcConnection = (uri: string) => {
    setNwcString(uri);
    if (uri) {
      setWalletModeState('nwc');
    }
  };

  /**
   * Restore wallet state from an encrypted backup. Merges proofs (with deduplication),
   * transactions (by ID), and mints into the current state.
   * @param {{ proofs: Proof[]; mints: Mint[]; transactions: WalletTransaction[] }} backup - Backup data
   */
  const restoreWalletFromBackup = useCallback((backup: { proofs: Proof[]; mints: Mint[]; transactions: WalletTransaction[] }) => {
    if (backup.proofs && backup.proofs.length > 0) {
      setProofs(current => WalletService.deduplicateProofs(current, backup.proofs));
    }
    if (backup.transactions && backup.transactions.length > 0) {
      setTransactions(current => {
        const existingIds = new Set(current.map(t => t.id));
        const newTxs = backup.transactions.filter(t => !existingIds.has(t.id));
        return [...newTxs, ...current].sort((a, b) => b.timestamp - a.timestamp);
      });
    }
    if (backup.mints && backup.mints.length > 0) {
      setMints(backup.mints);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // CONTEXT VALUE
  // ---------------------------------------------------------------------------

  const value: WalletContextType = {
    // State
    walletBalance,
    isBalanceLoading,
    transactions,
    walletMode,
    nwcString,
    mints,
    proofs,
    walletBalances,
    breezReady,
    breezInitError,
    retryBreezInit: tryInitBreez,

    // Payment notifications
    paymentNotification,
    setPaymentNotification,
    lightningStrike,

    // Actions
    depositFunds,
    checkDepositStatus,
    confirmDeposit,
    sendFunds,
    receiveEcash,
    createToken,
    getLightningQuote,
    refreshWalletBalance,
    refreshAllBalances,
    checkForPayments,
    addMint,
    removeMint,
    setActiveMint,
    setWalletMode: setWalletModeAction,
    setNwcConnection,
    reconcileOnResume,

    // Cross-cutting
    addTransaction,
    syncWallet,
    restoreWalletFromBackup,
    handleIncomingPayment,

    // Raw setters
    setProofs,
    setTransactions,
    setWalletModeState,
    setNwcString,
    nwcServiceRef,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access multi-wallet state, balances, transactions, and payment actions.
 * @returns {WalletContextType} Wallet state, payment actions, and raw setters.
 * @throws {Error} If called outside of WalletProvider.
 */
export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
