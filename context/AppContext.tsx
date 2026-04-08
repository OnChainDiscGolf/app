/**
 * @file AppContext.tsx
 * @description Composition layer that wires all five domain contexts (Auth, Wallet,
 * Profile, Round, Tournament) into a single unified `useApp()` hook.
 *
 * Provides backward-compatible access to all context state and implements
 * cross-cutting actions that span multiple contexts:
 *
 * **Account lifecycle:**
 * - `createAccount()` - Promote guest to full account (publish profile, register gateways)
 * - `createAccountFromMnemonic()` - Generate new mnemonic-based account
 * - `performLogout()` - Clear all state, storage, and Breez connection
 *
 * **Round lifecycle:**
 * - `createRound()` - Create round, initialize players, publish to Nostr
 * - `joinRoundAndPay()` - Join a round, pay entry fee via Cashu token in DM
 * - `finalizeRound()` - Calculate payouts, process payments, publish finalization
 *
 * **Tournament lifecycle:**
 * - `createTournament()` - Create tournament, generate cards, publish to Nostr
 * - `joinTournament()` - Join tournament, pay entry fee
 * - `startTournament()` - Publish card rounds, assign active round for current user
 * - `finalizeTournament()` - Calculate payouts from standings, distribute, finalize
 *
 * @architecture Outermost context in the provider hierarchy. Nests all domain providers
 * (AuthProvider > WalletProvider > ProfileProvider > RoundProvider > TournamentProvider)
 * and the AppComposition component which has access to all of them via hooks.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppState, Player, RoundSettings, WalletTransaction, UserProfile, UserStats, Mint, DisplayProfile, Proof, PayoutConfig, TournamentSettings, TournamentStanding, TournamentCard } from '../types';
import { DEFAULT_HOLE_COUNT } from '../constants';
import { publishRound, publishScore, publishTournament, sendDirectMessage, getMagicLightningAddress, generateNewProfileFromMnemonic } from '../services/nostrService';
import { logout as nostrLogout } from '../services/nostrService';
import { clearMnemonicStorage } from '../services/mnemonicService';
import { disconnectBreez } from '../services/breezService';
import { registerWithAllGateways } from '../services/npubCashService';
import { AuthSource } from '../services/mnemonicService';
import { NWCService } from '../services/nwcService';
import { calculatePayouts } from '../utils/payoutCalculations';
import { processPayouts, PayoutRecipient, PaymentResult } from '../services/paymentRouter';
import { notifyRoundFinalized, notifyTournamentFinalized } from '../services/notificationService';

import { AuthProvider, useAuth, AuthContextType } from './AuthContext';
import { WalletProvider, useWallet, WalletContextType } from './WalletContext';
import { ProfileProvider, useProfile, ProfileContextType } from './ProfileContext';
import { RoundProvider, useRound, RoundContextType } from './RoundContext';
import { TournamentProvider, useTournament, TournamentContextType } from './TournamentContext';

// Re-export utility functions from their new location
export { getTopHeavyDistribution, getLinearDistribution, calculatePayouts } from '../utils/payoutCalculations';

interface AppContextType extends AppState {
  // Actions
  createRound: (
    settings: Omit<RoundSettings, 'id' | 'isFinalized' | 'pubkey' | 'players' | 'eventId'>,
    selectedPlayers: DisplayProfile[],
    paymentSelections?: Record<string, { entry: boolean; ace: boolean }>,
    roundId?: string
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

  // Tournament state & actions
  activeTournament: TournamentSettings | null;
  tournamentStandings: TournamentStanding[];
  isDirector: boolean;
  createTournament: (settings: Omit<TournamentSettings, 'id' | 'eventId' | 'pubkey' | 'phase' | 'cards' | 'registeredPlayers' | 'isFinalized'>) => Promise<void>;
  joinTournament: (tournamentId: string, tournamentData?: any) => Promise<boolean>;
  startTournament: () => Promise<void>;
  finalizeTournament: () => Promise<void>;
  updateCardAssignment: (cardId: string, playerPubkey: string) => void;
  removeFromCard: (cardId: string, playerPubkey: string) => void;
  randomizeCards: () => void;
  addRegisteredPlayer: (pubkey: string) => void;
  setActiveTournament: React.Dispatch<React.SetStateAction<TournamentSettings | null>>;
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
  const tournament = useTournament();

  // Round Summary Modal State (cross-cutting: set by finalizeRound, read by Layout)
  const [roundSummary, setRoundSummary] = useState<AppContextType['roundSummary']>(null);

  // --- Cross-cutting Actions ---

  /**
   * Promote the current guest session to a full account.
   * Sets up initial profile with a magic Lightning address, publishes to Nostr,
   * registers with all payment gateways, and creates an initial wallet backup.
   */
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

  /**
   * Generate a brand new account from a fresh BIP-39 mnemonic.
   * Derives Nostr keys via NIP-06 derivation, sets up auth state, publishes profile,
   * registers with payment gateways, and creates initial wallet backup.
   * @returns {Promise<{ mnemonic: string }>} The generated mnemonic for user backup
   */
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

  /**
   * Full logout: disconnects Breez SDK, clears Nostr session, removes all localStorage
   * data (keys, profile, wallet, rounds, relays, gateway registrations, processed payments),
   * and resets all context state to defaults.
   */
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

  /**
   * Create a new disc golf round. Initializes round settings, builds the player list
   * with payment selections and handicaps, publishes the round event to Nostr, and
   * adds selected players to the recent players list.
   * @param {Omit<RoundSettings, 'id' | 'isFinalized' | 'pubkey' | 'players' | 'eventId'>} settings - Round configuration
   * @param {DisplayProfile[]} selectedPlayers - Players to include in the round
   * @param {Record<string, { entry: boolean; ace: boolean }>} [paymentSelections] - Per-player payment opt-in/out
   * @param {string} [preGeneratedRoundId] - Optional pre-generated round ID (for QR code pre-sharing)
   */
  const createRound = async (
    settings: Omit<RoundSettings, 'id' | 'isFinalized' | 'pubkey' | 'players' | 'eventId'>,
    selectedPlayers: DisplayProfile[],
    paymentSelections: Record<string, { entry: boolean; ace: boolean }> = {},
    preGeneratedRoundId?: string
  ) => {
    const roundId = preGeneratedRoundId || Math.random().toString(36).substring(7);
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

  /**
   * Join an existing round and pay the entry fee. Creates a Cashu token for the fee
   * amount, sends it to the host via NIP-04 DM, sets up the local round state, and
   * publishes an initial score event to signal participation. If the DM fails, reclaims
   * the token to prevent fund loss.
   * @param {string} roundId - ID of the round to join
   * @param {any} [roundData] - Round metadata (name, fees, host pubkey, etc.)
   * @returns {Promise<boolean>} True if successfully joined (and paid if required)
   */
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

  /**
   * Resolve a Lightning Address (user@domain) to a BOLT11 invoice via LNURL-pay.
   * Fetches the LNURL metadata from .well-known/lnurlp, then requests an invoice.
   * @param {string} address - Lightning address (e.g., user@domain.com)
   * @param {number} amountSats - Amount in satoshis for the invoice
   * @returns {Promise<string | null>} BOLT11 invoice string, or null on failure
   */
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

  /**
   * Finalize the active round: sort standings with tiebreaking, calculate entry pot
   * and ace pot payouts using configurable distribution algorithms, detect aces,
   * process all payouts via processPayouts (smart routing with fallbacks), show the
   * round summary modal, publish finalization to Nostr, save to round history, and
   * clean up localStorage. If any payout fails, the round is NOT finalized to allow retry.
   */
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

    const payoutsMade: { playerName: string; amount: number; isCurrentUser: boolean; requiresManualClaim?: boolean }[] = [];
    const failedPayouts: { playerName: string; playerId: string; amount: number }[] = [];
    const manualClaimPayouts: { playerName: string; amount: number }[] = [];

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
            payoutsMade.push({
              playerName: player.name,
              amount,
              isCurrentUser: false,
              requiresManualClaim: paymentResult.requiresManualClaim
            });
            if (paymentResult.requiresManualClaim) {
              manualClaimPayouts.push({ playerName: player.name, amount });
            }
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

      // --- Warn the host about payouts that landed as Cashu DM tokens ---
      // These succeeded technically (the Gift Wrap was delivered) but the
      // recipient must manually import the token in their wallet. The host
      // should know so they can follow up out-of-band.
      if (manualClaimPayouts.length > 0) {
        const claimList = manualClaimPayouts.map(p => `${p.playerName}: ${p.amount} sats`).join('\n');
        alert(
          `Heads up — these payouts were sent as eCash tokens via DM and need to be claimed manually by the recipient:\n\n${claimList}\n\nThis usually means Breez was unfunded and Lightning fallback failed. Let them know to open their wallet and accept the token.`
        );
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

    // Notify round participants
    notifyRoundFinalized(round.activeRound.name || 'Round');

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

  // --- Tournament Cross-Cutting Actions ---

  /**
   * Create a new tournament. Generates a tournament ID, creates empty card slots
   * based on maxPlayers/cardSize, registers the director as the first player,
   * and publishes the Kind 30003 tournament event to Nostr.
   * @param {Omit<TournamentSettings, 'id' | 'eventId' | 'pubkey' | 'phase' | 'cards' | 'registeredPlayers' | 'isFinalized'>} settings - Tournament configuration
   */
  const createTournament = async (
    settings: Omit<TournamentSettings, 'id' | 'eventId' | 'pubkey' | 'phase' | 'cards' | 'registeredPlayers' | 'isFinalized'>
  ) => {
    const tournamentId = Math.random().toString(36).substring(2, 9);
    const numCards = Math.ceil(settings.maxPlayers / settings.cardSize);

    const cards: TournamentCard[] = [];
    for (let i = 0; i < numCards; i++) {
      const letter = String.fromCharCode(65 + i);
      cards.push({
        id: `${tournamentId}_card_${letter.toLowerCase()}`,
        name: `Card ${letter}`,
        players: [],
        maxPlayers: settings.cardSize,
      });
    }

    const newTournament: TournamentSettings = {
      ...settings,
      id: tournamentId,
      pubkey: auth.currentUserPubkey,
      phase: 'registration',
      cards,
      registeredPlayers: [auth.currentUserPubkey],
      isFinalized: false,
    };

    tournament.setActiveTournament(newTournament);

    try {
      const event = await publishTournament(newTournament);
      tournament.setActiveTournament(prev => prev ? { ...prev, eventId: event.id } : null);
    } catch (e) {
      console.warn('Failed to publish tournament:', e);
    }
  };

  /**
   * Join an existing tournament and pay the entry fee (if any).
   * Sends fee via Cashu token in a DM to the director and sets the tournament as active.
   * @param {string} tournamentId - Tournament ID to join
   * @param {any} [tournamentData] - Tournament metadata (name, fees, director, etc.)
   * @returns {Promise<boolean>} True if successfully joined
   */
  const joinTournament = async (tournamentId: string, tournamentData?: any): Promise<boolean> => {
    const fee = (tournamentData?.entryFeeSats || 0) + (tournamentData?.acePotFeeSats || 0);
    const directorPubkey = tournamentData?.pubkey;

    if (fee > 0 && wallet.walletBalance < fee) return false;

    if (fee > 0 && directorPubkey) {
      try {
        const token = await wallet.createToken(fee);
        await sendDirectMessage(directorPubkey, JSON.stringify({
          type: 'tournament_entry',
          tournamentId,
          amount: fee,
          token,
        }));
        wallet.addTransaction('send', fee, `Tournament entry: ${tournamentData?.name || tournamentId}`);
      } catch (e) {
        console.warn('Failed to send tournament entry fee:', e);
        return false;
      }
    }

    // Set as active tournament for the player
    if (tournamentData) {
      tournament.setActiveTournament({
        id: tournamentId,
        eventId: tournamentData.eventId,
        pubkey: directorPubkey || '',
        name: tournamentData.name || 'Tournament',
        courseName: tournamentData.courseName || '',
        date: tournamentData.date || new Date().toISOString(),
        holeCount: tournamentData.holeCount || 18,
        par: tournamentData.par || 54,
        entryFeeSats: tournamentData.entryFeeSats || 0,
        acePotFeeSats: tournamentData.acePotFeeSats || 0,
        maxPlayers: tournamentData.maxPlayers || 20,
        cardSize: tournamentData.cardSize || 4,
        cardAssignmentMode: tournamentData.cardAssignmentMode || 'random',
        phase: tournamentData.phase || 'registration',
        cards: tournamentData.cards || [],
        registeredPlayers: tournamentData.registeredPlayers || [],
        payoutConfig: tournamentData.payoutConfig,
        playerHandicaps: tournamentData.playerHandicaps,
        isFinalized: false,
      });
    }

    return true;
  };

  /**
   * Start the tournament: publish each card as a standard Kind 30001 round event,
   * set the current user's card as their active round with initialized players,
   * and transition the tournament phase to 'active'.
   */
  const startTournament = async () => {
    if (!tournament.activeTournament) return;
    const t = tournament.activeTournament;

    // Publish each card as a standard Kind 30001 round
    for (const card of t.cards) {
      if (card.players.length === 0) continue;

      const cardRound: RoundSettings = {
        id: card.id,
        pubkey: t.pubkey,
        name: `${t.name} - ${card.name}`,
        courseName: t.courseName,
        entryFeeSats: 0, // Fees are at tournament level, not per card
        acePotFeeSats: 0,
        date: t.date,
        isFinalized: false,
        holeCount: t.holeCount,
        players: card.players,
        par: t.par,
        startingHole: 1,
        trackPenalties: false,
        hideOverallScore: false,
      };

      try {
        await publishRound(cardRound);
      } catch (e) {
        console.warn(`Failed to publish card ${card.name}:`, e);
      }
    }

    // Find the current user's card and set it as the active round
    const myCard = t.cards.find(c => c.players.includes(auth.currentUserPubkey));
    if (myCard) {
      const myRound: RoundSettings = {
        id: myCard.id,
        pubkey: t.pubkey,
        name: `${t.name} - ${myCard.name}`,
        courseName: t.courseName,
        entryFeeSats: 0,
        acePotFeeSats: 0,
        date: t.date,
        isFinalized: false,
        holeCount: t.holeCount,
        players: myCard.players,
        par: t.par,
        startingHole: 1,
        trackPenalties: false,
        hideOverallScore: false,
      };
      round.setActiveRound(myRound);

      // Initialize players for the card
      const initialPlayers: Player[] = myCard.players.map(pubkey => ({
        id: pubkey,
        name: pubkey === auth.currentUserPubkey ? profile.userProfile.name : 'Loading...',
        handicap: t.playerHandicaps?.[pubkey] || 0,
        paid: true, // Fees already collected at tournament registration
        paysEntry: true,
        paysAce: true,
        scores: {},
        totalScore: t.playerHandicaps?.[pubkey] || 0,
        isCurrentUser: pubkey === auth.currentUserPubkey,
        photoUrl: pubkey === auth.currentUserPubkey ? profile.userProfile.picture : undefined,
      }));
      round.setPlayers(initialPlayers);
    }

    // Update tournament phase
    const updatedTournament: TournamentSettings = { ...t, phase: 'active' };
    tournament.setActiveTournament(updatedTournament);

    try {
      await publishTournament(updatedTournament);
    } catch (e) {
      console.warn('Failed to publish tournament phase update:', e);
    }
  };

  /**
   * Finalize the tournament: calculate total pot from all registered players,
   * compute payouts using standings and payout config, process payments to winners
   * via processPayouts with smart routing, publish finalization event, send
   * notifications, and save to tournament history.
   */
  const finalizeTournamentAction = async () => {
    if (!tournament.activeTournament) return;
    const t = tournament.activeTournament;
    const finalStandings = tournament.standings;

    if (finalStandings.length === 0) return;

    // Calculate total pot from all registered players
    const entryPot = t.entryFeeSats * t.registeredPlayers.length;
    const acePot = t.acePotFeeSats * t.registeredPlayers.length;
    const totalPot = entryPot + acePot;

    if (totalPot > 0) {
      // Build Player[] array for calculatePayouts (reuse existing util)
      const playersForPayout: Player[] = finalStandings.map(s => ({
        id: s.pubkey,
        name: s.name,
        handicap: 0,
        paid: true,
        paysEntry: true,
        paysAce: true,
        scores: s.scores,
        totalScore: s.totalScore,
        isCurrentUser: s.isCurrentUser,
      }));

      const payoutsMap = calculatePayouts(playersForPayout, totalPot, t.payoutConfig);

      // Build payout recipients
      const recipients: PayoutRecipient[] = [];
      payoutsMap.forEach((amount, pubkey) => {
        if (amount > 0 && pubkey !== auth.currentUserPubkey) {
          const standing = finalStandings.find(s => s.pubkey === pubkey);
          recipients.push({ pubkey, amountSats: amount, name: standing?.name });
        }
      });

      if (recipients.length > 0) {
        try {
          const cashuPayFn = async (invoice: string) => wallet.sendFunds(0, invoice);
          const cashuTokenFn = async (amount: number) => wallet.createToken(amount);
          await processPayouts(recipients, cashuPayFn, cashuTokenFn);
        } catch (e) {
          console.warn('Some tournament payouts failed:', e);
        }
      }
    }

    // Finalize tournament
    const finalizedTournament: TournamentSettings = { ...t, phase: 'finalized', isFinalized: true };
    tournament.setActiveTournament(finalizedTournament);

    try {
      await publishTournament(finalizedTournament);
      notifyTournamentFinalized(t.name);
    } catch (e) {
      console.warn('Failed to publish tournament finalization:', e);
    }

    // Save to tournament history
    try {
      const history = JSON.parse(localStorage.getItem('cdg_tournament_history') || '[]');
      history.unshift({ ...finalizedTournament, finalStandings });
      if (history.length > 50) history.length = 50;
      localStorage.setItem('cdg_tournament_history', JSON.stringify(history));
    } catch { /* ignore */ }
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

    // Tournament state & actions
    activeTournament: tournament.activeTournament,
    tournamentStandings: tournament.standings,
    isDirector: tournament.isDirector,
    createTournament,
    joinTournament,
    startTournament,
    finalizeTournament: finalizeTournamentAction,
    updateCardAssignment: tournament.updateCardAssignment,
    removeFromCard: tournament.removeFromCard,
    randomizeCards: tournament.randomizeCards,
    addRegisteredPlayer: tournament.addRegisteredPlayer,
    setActiveTournament: tournament.setActiveTournament,
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
            <TournamentProvider>
              <AppComposition>
                {children}
              </AppComposition>
            </TournamentProvider>
          </RoundProvider>
        </ProfileProvider>
      </WalletProvider>
    </AuthProvider>
  );
};

/**
 * Hook to access the unified app state and all actions.
 * Provides backward-compatible access to all domain context state (auth, wallet,
 * profile, round, tournament) plus cross-cutting actions (account, round, tournament lifecycle).
 * @returns {AppContextType} Unified app state and actions.
 * @throws {Error} If called outside of AppProvider.
 */
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
