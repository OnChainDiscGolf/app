/**
 * AppContext - Composition Layer
 *
 * Composes AuthContext, WalletContext, ProfileContext, and RoundContext
 * into a single unified `useApp()` hook for backward compatibility.
 *
 * Also contains cross-cutting actions that span multiple contexts:
 * - createAccount / createAccountFromMnemonic
 * - performLogout
 * - createRound / joinRoundAndPay / finalizeRound
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppState, Player, RoundSettings, WalletTransaction, UserProfile, UserStats, Mint, DisplayProfile, Proof, PayoutConfig } from '../types';
import { DEFAULT_HOLE_COUNT } from '../constants';
import { publishRound, publishScore, sendDirectMessage, getMagicLightningAddress, generateNewProfileFromMnemonic } from '../services/nostrService';
import { logout as nostrLogout } from '../services/nostrService';
import { clearMnemonicStorage } from '../services/mnemonicService';
import { disconnectBreez } from '../services/breezService';
import { registerWithAllGateways } from '../services/npubCashService';
import { AuthSource } from '../services/mnemonicService';
import { NWCService } from '../services/nwcService';
import { calculatePayouts } from '../utils/payoutCalculations';
import { processPayouts, PayoutRecipient, PaymentResult } from '../services/paymentRouter';

import { AuthProvider, useAuth, AuthContextType } from './AuthContext';
import { WalletProvider, useWallet, WalletContextType } from './WalletContext';
import { ProfileProvider, useProfile, ProfileContextType } from './ProfileContext';
import { RoundProvider, useRound, RoundContextType } from './RoundContext';

// Re-export utility functions from their new location
export { getTopHeavyDistribution, getLinearDistribution, calculatePayouts } from '../utils/payoutCalculations';

interface AppContextType extends AppState {
  // Actions
  createRound: (
    settings: Omit<RoundSettings, 'id' | 'isFinalized' | 'pubkey' | 'players' | 'eventId'>,
    selectedPlayers: DisplayProfile[],
    paymentSelections?: Record<string, { entry: boolean; ace: boolean }>
  ) => Promise<void>;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  updateScore: (hole: number, score: number, playerId?: string) => void;
  publishCurrentScores: () => Promise<void>;
  setPlayerPaid: (playerId: string) => void;
  finalizeRound: () => void;
  depositFunds: (amount: number) => Promise<{ request: string, quote: string }>;
  checkDepositStatus: (quote: string) => Promise<boolean>;
  confirmDeposit: (quote: string, amount: number) => Promise<boolean>;
  joinRoundAndPay: (roundId: string, roundData?: any) => Promise<boolean>;
  resetRound: () => void;
  refreshStats: () => void;
  currentUserPubkey: string;

  // Mint/Wallet Actions
  addMint: (url: string, nickname: string) => void;
  removeMint: (url: string) => void;
  setActiveMint: (url: string) => void;
  sendFunds: (amount: number, invoice: string) => Promise<boolean>;
  receiveEcash: (token: string) => Promise<boolean>;
  getLightningQuote: (invoice: string) => Promise<{ amount: number, fee: number }>;
  refreshWalletBalance: () => Promise<void>;
  isBalanceLoading: boolean;

  // Player Management
  addRecentPlayer: (player: DisplayProfile) => void;

  // Auth Actions
  loginNsec: (nsec: string) => Promise<void>;
  loginMnemonic: (mnemonic: string) => Promise<void>;
  loginNip46: (bunkerUrl: string) => Promise<void>;
  loginAmber: () => Promise<void>;
  createAccount: () => Promise<void>;
  createAccountFromMnemonic: () => Promise<{ mnemonic: string }>;
  performLogout: () => void;
  isProfileLoading: boolean;
  createToken: (amount: number) => Promise<string>;

  // Auth Info
  authSource: AuthSource | null;
  hasUnifiedBackup: boolean;

  // Wallet Mode Actions
  setWalletMode: (mode: 'cashu' | 'nwc' | 'breez') => void;
  setNwcConnection: (uri: string) => void;
  checkForPayments: () => Promise<number>;

  // Individual Wallet Balances
  walletBalances: {
    cashu: number;
    nwc: number;
    breez: number;
  };
  refreshAllBalances: () => Promise<void>;

  // Payment Notification
  paymentNotification: {
    amount: number;
    context?: 'wallet_receive' | 'buyin_qr';
  } | null;
  setPaymentNotification: (notification: { amount: number; context?: 'wallet_receive' | 'buyin_qr' } | null) => void;

  // Lightning Strike
  lightningStrike: {
    amount: number;
    show: boolean;
  } | null;

  // Round Summary Modal
  roundSummary: {
    isOpen: boolean;
    roundName: string;
    standings: Player[];
    payouts: { playerName: string; amount: number; isCurrentUser: boolean }[];
    aceWinners: { name: string; hole: number }[];
    acePotAmount: number;
    totalPot: number;
    par: number;
    isProcessingPayments: boolean;
  } | null;
  setRoundSummary: (summary: AppContextType['roundSummary']) => void;

  // Finalization State Setters
  setAuthState: (state: {
    isAuthenticated: boolean;
    isGuest: boolean;
    currentUserPubkey: string;
    authMethod: 'local' | 'nip46' | 'amber' | null;
  }) => void;
  setUserProfileState: (profile: UserProfile) => void;
  setContactsState: (contacts: DisplayProfile[]) => void;
  setRecentPlayersState: (players: DisplayProfile[]) => void;
  restoreWalletFromBackup: (backup: { proofs: Proof[]; mints: Mint[]; transactions: WalletTransaction[] }) => void;
  initializeSubscriptions: (pubkey: string) => void;

  // Resume/foreground reconciliation
  reconcileOnResume: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Inner composition component that has access to all domain contexts.
 * Implements cross-cutting actions that span multiple contexts.
 */
const AppComposition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const wallet = useWallet();
  const profile = useProfile();
  const round = useRound();

  // Round Summary Modal State (cross-cutting: set by finalizeRound, read by Layout)
  const [roundSummary, setRoundSummary] = useState<AppContextType['roundSummary']>(null);

  // --- Cross-cutting Actions ---

  const createAccount = async () => {
    auth.setIsGuest(false);
    localStorage.removeItem('is_guest_mode');

    const magicLUD16 = getMagicLightningAddress(auth.currentUserPubkey);
    const initialProfile: UserProfile = {
      name: 'Disc Golfer',
      about: '',
      picture: '',
      lud16: magicLUD16,
      nip05: ''
    };
    profile.setUserProfile(initialProfile);

    await profile.updateUserProfile(initialProfile);

    console.log("🔗 Registering with payment gateways...");
    try {
      const registrations = await registerWithAllGateways();
      const successful = registrations.filter(r => r.success).length;
      console.log(`✅ Registered with ${successful}/${registrations.length} gateways`);
    } catch (e) {
      console.error("⚠️ Gateway registration failed:", e);
    }

    console.log("📦 Creating initial wallet backup for new account...");
    try {
      await wallet.syncWallet(wallet.proofs, wallet.mints, wallet.transactions);
      console.log("✅ Initial wallet backup created successfully!");
    } catch (e) {
      console.error("⚠️ Failed to create initial wallet backup:", e);
    }
  };

  const createAccountFromMnemonic = async (): Promise<{ mnemonic: string }> => {
    const { mnemonic, pk } = generateNewProfileFromMnemonic();

    auth.setCurrentUserPubkey(pk);
    auth.setAuthMethod('local');
    auth.setAuthSourceState('mnemonic');
    auth.setHasUnifiedBackup(true);
    auth.setIsAuthenticated(true);
    auth.setIsGuest(false);
    localStorage.removeItem('is_guest_mode');

    const magicLUD16 = getMagicLightningAddress(pk);
    const initialProfile: UserProfile = {
      name: 'Disc Golfer',
      about: '',
      picture: '',
      lud16: magicLUD16,
      nip05: ''
    };
    profile.setUserProfile(initialProfile);

    console.log("📤 Publishing new profile to Nostr...");
    try {
      await profile.updateUserProfile(initialProfile);
      console.log("✅ Profile published successfully!");
    } catch (e) {
      console.error("⚠️ Failed to publish profile:", e);
    }

    console.log("🔗 Registering with payment gateways...");
    try {
      const registrations = await registerWithAllGateways();
      const successful = registrations.filter(r => r.success).length;
      console.log(`✅ Registered with ${successful}/${registrations.length} gateways`);
    } catch (e) {
      console.error("⚠️ Gateway registration failed:", e);
    }

    console.log("📦 Creating initial wallet backup for new account...");
    try {
      await wallet.syncWallet(wallet.proofs, wallet.mints, wallet.transactions);
      console.log("✅ Initial wallet backup created successfully!");
    } catch (e) {
      console.error("⚠️ Failed to create initial wallet backup:", e);
    }

    return { mnemonic };
  };

  const performLogout = () => {
    // Disconnect Breez SDK
    disconnectBreez().catch(e => console.warn('Breez disconnect error:', e));

    // Clear Nostr session
    nostrLogout();
    clearMnemonicStorage();

    // Clear all localStorage
    localStorage.removeItem('cdg_user_private_key');
    localStorage.removeItem('cdg_user_public_key');
    localStorage.removeItem('cdg_auth_method');
    localStorage.removeItem('cdg_wallet_mode');
    localStorage.removeItem('cdg_nwc_string');
    localStorage.removeItem('cdg_user_profile');
    localStorage.removeItem('is_guest_mode');
    localStorage.removeItem('cdg_breez_lightning_address');
    localStorage.removeItem('cdg_proofs');
    localStorage.removeItem('cdg_txs');
    localStorage.removeItem('cdg_mints');
    localStorage.removeItem('cdg_recent_players');
    localStorage.removeItem('cdg_round_history');
    localStorage.removeItem('cdg_relays');
    localStorage.removeItem('cdg_lightning_address');
    localStorage.removeItem('cdg_nostr_backup');
    localStorage.removeItem('cdg_nostr_backup_timestamp');
    localStorage.removeItem('gateway_registrations');

    // Clear processed payment tracking keys
    Object.keys(localStorage).filter(k =>
      k.startsWith('processed_token_') || k.startsWith('processed_quote_')
    ).forEach(k => localStorage.removeItem(k));

    // Reset auth state
    auth.setIsAuthenticated(false);
    auth.setIsGuest(false);
    auth.setAuthMethod(null);
    auth.setCurrentUserPubkey('');

    // Reset profile state
    profile.setUserProfile({ name: '', picture: '', about: '', lud16: '', nip05: '' });
    profile.setRecentPlayers([]);
    profile.setContacts([]);

    // Reset wallet state
    wallet.setWalletModeState('cashu');
    wallet.setNwcString('');
    if (wallet.nwcServiceRef.current) {
      wallet.nwcServiceRef.current = null;
    }
    wallet.setProofs([]);
    wallet.setTransactions([]);

    // Reset round state
    round.setActiveRound(null);
    round.setPlayers([]);
    round.setCurrentHole(1);
  };

  const createRound = async (
    settings: Omit<RoundSettings, 'id' | 'isFinalized' | 'pubkey' | 'players' | 'eventId'>,
    selectedPlayers: DisplayProfile[],
    paymentSelections: Record<string, { entry: boolean; ace: boolean }> = {}
  ) => {
    const roundId = Math.random().toString(36).substring(7);
    const newRound: RoundSettings = {
      ...settings,
      holeCount: settings.holeCount || DEFAULT_HOLE_COUNT,
      id: roundId,
      pubkey: auth.currentUserPubkey,
      isFinalized: false,
      players: [auth.currentUserPubkey, ...selectedPlayers.map(p => p.pubkey)],
      startingHole: settings.startingHole || 1,
      trackPenalties: settings.trackPenalties || false,
      hideOverallScore: settings.hideOverallScore || false,
      par: settings.par || ((settings.holeCount || DEFAULT_HOLE_COUNT) * 3)
    };

    round.setActiveRound(newRound);

    const hostPayment = paymentSelections[auth.currentUserPubkey] ?? { entry: true, ace: true };
    const hostOwesPayment = (settings.entryFeeSats > 0 && hostPayment.entry) || (settings.acePotFeeSats > 0 && hostPayment.ace);
    const initialPlayers: Player[] = [{
      id: auth.currentUserPubkey,
      name: profile.userProfile.name,
      handicap: 0,
      paid: !hostOwesPayment,
      paysEntry: hostPayment.entry,
      paysAce: hostPayment.ace,
      scores: {},
      totalScore: 0,
      isCurrentUser: true,
      lightningAddress: profile.userProfile.lud16,
      photoUrl: profile.userProfile.picture
    }];

    selectedPlayers.forEach(p => {
      profile.addRecentPlayer(p);
      const payment = paymentSelections[p.pubkey] ?? { entry: true, ace: true };
      const owesPayment = (settings.entryFeeSats > 0 && payment.entry) || (settings.acePotFeeSats > 0 && payment.ace);
      const handicap = settings.playerHandicaps?.[p.pubkey] || 0;
      initialPlayers.push({
        id: p.pubkey,
        name: p.name,
        handicap,
        paid: owesPayment ? (!!p.paid) : true,
        paysEntry: payment.entry,
        paysAce: payment.ace,
        scores: {},
        totalScore: handicap,
        isCurrentUser: false,
        lightningAddress: p.nip05,
        photoUrl: p.image
      });
    });

    // Update host handicap
    initialPlayers[0].handicap = settings.playerHandicaps?.[auth.currentUserPubkey] || 0;
    initialPlayers[0].totalScore = settings.playerHandicaps?.[auth.currentUserPubkey] || 0;

    round.setPlayers(initialPlayers);

    try {
      const roundEvent = await publishRound(newRound);
      round.setActiveRound(prev => prev ? { ...prev, eventId: roundEvent.id } : null);
    } catch (e) {
      console.warn("Failed to publish round:", e);
    }
  };

  const joinRoundAndPay = async (roundId: string, roundData?: any): Promise<boolean> => {
    const fee = (roundData?.entryFeeSats || 0) + (roundData?.acePotFeeSats || 0);
    const hostPubkey = roundData?.pubkey;

    if (wallet.walletBalance < fee) return false;

    let token = '';
    if (fee > 0 && hostPubkey) {
      try {
        token = await wallet.createToken(fee);
      } catch (e) {
        console.error("Failed to create entry fee token", e);
        return false;
      }

      try {
        await sendDirectMessage(hostPubkey, `Payment for round ${roundData?.name || 'Disc Golf'}: ${token}`);
        wallet.addTransaction('send', fee, `Entry Fee: ${roundData?.name || 'Round'}`);
      } catch (e) {
        // DM failed - reclaim the token so funds aren't lost
        console.error("Failed to send entry fee DM, reclaiming token...", e);
        try {
          await wallet.receiveEcash(token);
          console.log("✅ Token reclaimed successfully after DM failure");
        } catch (reclaimErr) {
          console.error("❌ CRITICAL: Failed to reclaim token after DM failure. Token:", token, reclaimErr);
          alert(
            `Entry fee payment failed and automatic recovery failed. ` +
            `Your ${fee} sat token may still be claimable. ` +
            `Please go to Wallet and paste this token to recover your funds:\n\n${token}`
          );
        }
        return false;
      }
    }

    const joinedRound: RoundSettings = {
      id: roundId,
      name: roundData?.name || 'Joined Round',
      courseName: roundData?.courseName || 'Unknown Course',
      entryFeeSats: roundData?.entryFeeSats || 0,
      acePotFeeSats: roundData?.acePotFeeSats || 0,
      date: roundData?.date || new Date().toISOString(),
      isFinalized: false,
      holeCount: roundData?.holeCount || 18,
      players: [],
      pubkey: roundData?.pubkey || '',
      eventId: roundData?.id,
      startingHole: 1,
      trackPenalties: false,
      hideOverallScore: false,
      par: roundData?.par || 54
    };

    round.setActiveRound(joinedRound);

    round.setPlayers([{
      id: auth.currentUserPubkey,
      name: profile.userProfile.name,
      handicap: 0,
      paid: true,
      paysEntry: true,
      paysAce: true,
      scores: {},
      totalScore: 0,
      isCurrentUser: true,
      lightningAddress: profile.userProfile.lud16,
      photoUrl: profile.userProfile.picture
    }]);

    try {
      await publishScore(roundId, {}, 0);
    } catch (e) {
      console.warn("Failed to join round on network:", e);
    }

    return true;
  };

  // Helper to resolve Lightning Address to an invoice
  const resolveLightningAddress = async (address: string, amountSats: number): Promise<string | null> => {
    try {
      const [user, domain] = address.split('@');
      if (!user || !domain) return null;

      console.log(`⚡ Resolving Lightning Address: ${address} for ${amountSats} sats`);
      const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
      const data = await res.json();

      if (data.callback) {
        const amountMsat = amountSats * 1000;
        const callbackUrl = new URL(data.callback);
        callbackUrl.searchParams.set('amount', amountMsat.toString());

        const invoiceRes = await fetch(callbackUrl.toString());
        const invoiceData = await invoiceRes.json();

        if (invoiceData.pr) {
          console.log(`✅ Got invoice from Lightning Address`);
          return invoiceData.pr;
        }
      }
      return null;
    } catch (e) {
      console.error("Failed to resolve Lightning Address:", e);
      return null;
    }
  };

  const finalizeRound = async () => {
    if (!round.activeRound) return;
    if (round.players.length === 0) {
      console.warn('Cannot finalize round with no players');
      return;
    }

    // --- Tie-breaking sort: lowest total first, then hole-by-hole from last hole back ---
    const totalHoles = round.activeRound.holeCount;
    const sortedPlayers = [...round.players].sort((a, b) => {
      const diff = (a.totalScore || 0) - (b.totalScore || 0);
      if (diff !== 0) return diff;
      // Tiebreaker: compare hole-by-hole from last hole backwards
      for (let h = totalHoles; h >= 1; h--) {
        const aH = a.scores[h] || 0;
        const bH = b.scores[h] || 0;
        if (aH !== bH) return aH - bH;
      }
      return 0;
    });

    // --- Calculate pots using granular payment selections (matching Scorecard.tsx) ---
    const entryPayers = round.players.filter(p => p.paysEntry);
    const acePayers = round.players.filter(p => p.paysAce);
    const entryPot = (round.activeRound.entryFeeSats || 0) * entryPayers.length;
    const acePotAmount = (round.activeRound.acePotFeeSats || 0) * acePayers.length;
    const totalPot = entryPot + acePotAmount;
    const par = round.activeRound.par || (round.activeRound.holeCount * 3);
    const payoutConfig = round.activeRound.payoutConfig;

    // --- Calculate entry pot payouts using calculatePayouts() (no more hardcoded 80%) ---
    const entryPayoutsMap = entryPot > 0
      ? calculatePayouts(round.players, entryPot, payoutConfig)
      : new Map<string, number>();

    // --- Detect aces ---
    const aceWinners: { name: string; hole: number }[] = [];
    const aceWinnerPlayers: Player[] = [];
    round.players.forEach(player => {
      let hasAce = false;
      Object.entries(player.scores || {}).forEach(([hole, score]) => {
        if (score === 1) {
          aceWinners.push({ name: player.name, hole: parseInt(hole) });
          hasAce = true;
        }
      });
      if (hasAce) aceWinnerPlayers.push(player);
    });

    // --- Calculate ace pot payouts ---
    const acePayoutsMap = new Map<string, number>();
    let acePotRemainder = acePotAmount;

    if (acePotAmount > 0) {
      if (aceWinnerPlayers.length > 0) {
        // Split ace pot among ace winners with remainder handling
        const perAceWinner = Math.floor(acePotAmount / aceWinnerPlayers.length);
        let distributed = 0;
        aceWinnerPlayers.forEach((p, idx) => {
          if (idx === aceWinnerPlayers.length - 1) {
            acePayoutsMap.set(p.id, acePotAmount - distributed);
          } else {
            acePayoutsMap.set(p.id, perAceWinner);
            distributed += perAceWinner;
          }
        });
        acePotRemainder = 0;
      } else {
        // No aces - handle redistribution
        const redistribution = payoutConfig?.acePotRedistribution || 'add-to-entry-pot';
        if (redistribution === 'add-to-entry-pot' && entryPot > 0) {
          const combinedPot = entryPot + acePotAmount;
          const combined = calculatePayouts(round.players, combinedPot, payoutConfig);
          combined.forEach((amount, id) => entryPayoutsMap.set(id, amount));
          acePotRemainder = 0;
        } else if (redistribution === 'redistribute-to-participants') {
          const acePaying = round.players.filter(p => p.paysAce);
          if (acePaying.length > 0) {
            const perPlayer = Math.floor(acePotAmount / acePaying.length);
            let distributed = 0;
            acePaying.forEach((p, idx) => {
              if (idx === acePaying.length - 1) {
                acePayoutsMap.set(p.id, acePotAmount - distributed);
              } else {
                acePayoutsMap.set(p.id, perPlayer);
                distributed += perPlayer;
              }
            });
            acePotRemainder = 0;
          }
        }
        // 'forfeit' mode: pot rolls over, acePotRemainder stays
      }
    }

    // --- Merge all payouts per player ---
    const totalPayoutsMap = new Map<string, number>();
    entryPayoutsMap.forEach((amount, id) => {
      totalPayoutsMap.set(id, (totalPayoutsMap.get(id) || 0) + amount);
    });
    acePayoutsMap.forEach((amount, id) => {
      totalPayoutsMap.set(id, (totalPayoutsMap.get(id) || 0) + amount);
    });

    // Show summary modal immediately
    setRoundSummary({
      isOpen: true,
      roundName: round.activeRound.name || 'Round',
      standings: sortedPlayers,
      payouts: [],
      aceWinners,
      acePotAmount,
      totalPot: totalPot,
      par,
      isProcessingPayments: totalPot > 0
    });

    const payoutsMade: { playerName: string; amount: number; isCurrentUser: boolean }[] = [];
    const failedPayouts: { playerName: string; playerId: string; amount: number }[] = [];

    // --- Process payouts using routePayment with fallbacks ---
    if (totalPot > 0) {
      // Build recipients list from merged payouts
      const recipients: { player: Player; amount: number }[] = [];
      totalPayoutsMap.forEach((amount, playerId) => {
        if (amount <= 0) return;
        const player = round.players.find(p => p.id === playerId);
        if (player) recipients.push({ player, amount });
      });

      for (const { player, amount } of recipients) {
        if (player.isCurrentUser) {
          // Current user won - just record it, no payment needed
          wallet.addTransaction('payout', amount, `Won Round: ${round.activeRound.name}`);
          payoutsMade.push({ playerName: player.name, amount, isCurrentUser: true });
          continue;
        }

        try {
          // Use processPayouts/routePayment for smart routing with fallbacks
          const result = await processPayouts(
            [{ pubkey: player.id, amountSats: amount, name: player.name }],
            wallet.sendFunds.bind(null, amount),
            wallet.createToken,
            (completed, total, current) => {
              console.log(`💸 Paying ${current.name}: ${completed + 1}/${total}`);
            }
          );

          const paymentResult = result.results.get(player.id);
          if (paymentResult?.success) {
            console.log(`✅ Paid ${amount} sats to ${player.name} via ${paymentResult.method}`);
            wallet.addTransaction('payout', amount, `Payout to ${player.name}`);
            payoutsMade.push({ playerName: player.name, amount, isCurrentUser: false });
          } else {
            console.error(`❌ Failed to pay ${player.name}: ${paymentResult?.error}`);
            failedPayouts.push({ playerName: player.name, playerId: player.id, amount });
          }
        } catch (e) {
          console.error(`Failed to pay ${player.name}:`, e);
          failedPayouts.push({ playerName: player.name, playerId: player.id, amount });
        }
      }

      // Update summary with results
      setRoundSummary(prev => prev ? { ...prev, payouts: payoutsMade, isProcessingPayments: false } : null);

      // --- If any payouts failed, alert and DO NOT finalize ---
      if (failedPayouts.length > 0) {
        const failedList = failedPayouts.map(f => `${f.playerName}: ${f.amount} sats`).join('\n');
        alert(
          `Some payouts failed. The round has NOT been finalized so you can retry.\n\nFailed payouts:\n${failedList}\n\nPlease check your wallet balance and try finalizing again.`
        );
        return; // Do NOT finalize - allow retry
      }
    } else {
      setRoundSummary(prev => prev ? { ...prev, isProcessingPayments: false } : null);
    }

    // --- Only finalize after all payments succeed ---
    if (round.activeRound.pubkey === auth.currentUserPubkey) {
      try {
        await publishRound({ ...round.activeRound, isFinalized: true });
      } catch (e) {
        console.warn("Failed to finalize round on network:", e);
      }
    }

    round.setActiveRound(prev => prev ? { ...prev, isFinalized: true } : null);

    // Save to round history
    try {
      const historicalRound = {
        id: round.activeRound.id,
        roundName: round.activeRound.name,
        courseName: round.activeRound.courseName,
        date: round.activeRound.date,
        par,
        holeCount: round.activeRound.holeCount,
        standings: sortedPlayers,
        payouts: payoutsMade,
        aceWinners,
        acePotAmount,
        totalPot,
        entryFeeSats: round.activeRound.entryFeeSats,
        acePotFeeSats: round.activeRound.acePotFeeSats,
        finalizedAt: Date.now()
      };

      const existingHistory = localStorage.getItem('cdg_round_history');
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      history.unshift(historicalRound);
      if (history.length > 50) history.pop();
      localStorage.setItem('cdg_round_history', JSON.stringify(history));
      console.log('📜 Saved round to history');
    } catch (e) {
      console.warn('Failed to save round to history:', e);
    }

    localStorage.removeItem('cdg_active_round');
    localStorage.removeItem('cdg_players');
    localStorage.removeItem('cdg_current_hole');
    profile.refreshStats();
  };

  // Compose all context values into the unified AppContextType
  const value: AppContextType = {
    // Auth state
    isAuthenticated: auth.isAuthenticated,
    isGuest: auth.isGuest,
    authMethod: auth.authMethod,
    currentUserPubkey: auth.currentUserPubkey,
    authSource: auth.authSource,
    hasUnifiedBackup: auth.hasUnifiedBackup,

    // Wallet state
    walletBalance: wallet.walletBalance,
    isBalanceLoading: wallet.isBalanceLoading,
    transactions: wallet.transactions,
    walletMode: wallet.walletMode,
    nwcString: wallet.nwcString,
    mints: wallet.mints,
    proofs: wallet.proofs,
    walletBalances: wallet.walletBalances,
    paymentNotification: wallet.paymentNotification,
    setPaymentNotification: wallet.setPaymentNotification,
    lightningStrike: wallet.lightningStrike,

    // Profile state
    userProfile: profile.userProfile,
    userStats: profile.userStats,
    recentPlayers: profile.recentPlayers,
    contacts: profile.contacts,
    isProfileLoading: profile.isProfileLoading,

    // Round state
    activeRound: round.activeRound,
    players: round.players,
    currentHole: round.currentHole,

    // Round Summary (cross-cutting)
    roundSummary,
    setRoundSummary,

    // Auth actions
    loginNsec: auth.loginNsec,
    loginMnemonic: auth.loginMnemonic,
    loginNip46: auth.loginNip46,
    loginAmber: auth.loginAmber,
    setAuthState: auth.setAuthState,

    // Cross-cutting auth actions
    createAccount,
    createAccountFromMnemonic,
    performLogout,

    // Wallet actions
    depositFunds: wallet.depositFunds,
    checkDepositStatus: wallet.checkDepositStatus,
    confirmDeposit: wallet.confirmDeposit,
    sendFunds: wallet.sendFunds,
    receiveEcash: wallet.receiveEcash,
    createToken: wallet.createToken,
    getLightningQuote: wallet.getLightningQuote,
    refreshWalletBalance: wallet.refreshWalletBalance,
    refreshAllBalances: wallet.refreshAllBalances,
    checkForPayments: wallet.checkForPayments,
    addMint: wallet.addMint,
    removeMint: wallet.removeMint,
    setActiveMint: wallet.setActiveMint,
    setWalletMode: wallet.setWalletMode,
    setNwcConnection: wallet.setNwcConnection,
    reconcileOnResume: wallet.reconcileOnResume,
    restoreWalletFromBackup: wallet.restoreWalletFromBackup,

    // Profile actions
    updateUserProfile: profile.updateUserProfile,
    refreshStats: profile.refreshStats,
    addRecentPlayer: profile.addRecentPlayer,
    setUserProfileState: profile.setUserProfileState,
    setContactsState: profile.setContactsState,
    setRecentPlayersState: profile.setRecentPlayersState,
    initializeSubscriptions: profile.initializeSubscriptions,

    // Round actions
    updateScore: round.updateScore,
    publishCurrentScores: round.publishCurrentScores,
    setPlayerPaid: round.setPlayerPaid,
    resetRound: round.resetRound,

    // Cross-cutting round actions
    createRound,
    joinRoundAndPay,
    finalizeRound,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * AppProvider - Nests all domain contexts and the composition layer.
 * This is the only provider that consumers need to wrap their app with.
 */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <WalletProvider>
        <ProfileProvider>
          <RoundProvider>
            <AppComposition>
              {children}
            </AppComposition>
          </RoundProvider>
        </ProfileProvider>
      </WalletProvider>
    </AuthProvider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
