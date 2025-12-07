
import { CashuMint, CashuWallet, getDecodedToken } from '@cashu/cashu-ts';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Player, RoundSettings, WalletTransaction, UserProfile, UserStats, NOSTR_KIND_SCORE, Mint, DisplayProfile, Proof, PayoutConfig } from '../types';
import { DEFAULT_HOLE_COUNT, BREEZ_API_KEY } from '../constants';
import { publishProfile, publishRound, publishScore, subscribeToRound, subscribeToPlayerRounds, fetchProfile, fetchUserHistory, getSession, loginWithNsec, loginWithNip46, loginWithAmber, generateNewProfile, generateNewProfileFromMnemonic, loginWithMnemonic as nostrLoginWithMnemonic, logout as nostrLogout, publishWalletBackup, fetchWalletBackup, publishRecentPlayers, fetchRecentPlayers, fetchContactList, fetchProfilesBatch, sendDirectMessage, subscribeToDirectMessages, subscribeToGiftWraps, subscribeToNutzaps, subscribeToLightningGiftWraps, fetchHistoricalGiftWraps, getMagicLightningAddress } from '../services/nostrService';
import { getAuthSource, hasStoredMnemonic, hasUnifiedSeed, AuthSource, retrieveMnemonicEncrypted, clearMnemonicStorage } from '../services/mnemonicService';
import {
  initializeBreez,
  isBreezInitialized,
  getBreezBalance,
  subscribeToPayments as subscribeToBreezEvents,
  disconnectBreez,
  getPaymentHistory,
  syncBreez
} from '../services/breezService';
import { checkPendingPayments, NpubCashQuote, subscribeToQuoteUpdates, unsubscribeFromQuoteUpdates, getQuoteById, registerWithAllGateways, checkGatewayRegistration, subscribeToAllGatewayUpdates } from '../services/npubCashService';
import { checkGatewayRegistration as getGatewayRegistrations } from '../services/npubCashService';
import { WalletService } from '../services/walletService';
import { NWCService } from '../services/nwcService';
import { bytesToHex } from '@noble/hashes/utils';
import { LightningStrikeNotification } from '../components/LightningStrike';
import { completeAmberConnection } from '../services/amberSigner';

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
  depositFunds: (amount: number) => Promise<{ request: string, quote: string }>; // Returns {request, quote}
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

  // Individual Wallet Balances (for cumulative view)
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

  // Finalization State Setters (for onboarding flow)
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [authMethod, setAuthMethod] = useState<'local' | 'nip46' | 'amber' | null>(null);
  const [currentUserPubkey, setCurrentUserPubkey] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Mnemonic/Auth Source State
  const [authSource, setAuthSourceState] = useState<AuthSource | null>(() => getAuthSource());
  const [hasUnifiedBackup, setHasUnifiedBackup] = useState<boolean>(() => hasUnifiedSeed());

  // Wallet & Local State
  const [proofs, setProofs] = useState<Proof[]>(() => {
    const saved = localStorage.getItem('cdg_proofs');
    return saved ? JSON.parse(saved) : [];
  });

  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const saved = localStorage.getItem('cdg_proofs');
    if (saved) {
      try {
        const proofs = JSON.parse(saved);
        return WalletService.calculateBalance(proofs);
      } catch (e) {
        console.warn("Failed to calculate initial balance from localStorage", e);
        return 0;
      }
    }
    return 0;
  });

  // Individual wallet balances for cumulative view
  const [walletBalances, setWalletBalances] = useState<{
    cashu: number;
    nwc: number;
    breez: number;
  }>(() => {
    // Initialize Cashu balance from proofs
    const saved = localStorage.getItem('cdg_proofs');
    let cashuBal = 0;
    if (saved) {
      try {
        const proofs = JSON.parse(saved);
        cashuBal = WalletService.calculateBalance(proofs);
      } catch (e) {
        console.warn("Failed to calculate initial Cashu balance", e);
      }
    }
    return {
      cashu: cashuBal,
      nwc: 0,
      breez: 0
    };
  });

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

  const [recentPlayers, setRecentPlayers] = useState<DisplayProfile[]>(() => {
    const saved = localStorage.getItem('cdg_recent_players');
    return saved ? JSON.parse(saved) : [];
  });

  const [contacts, setContacts] = useState<DisplayProfile[]>([]);

  // Nostr Data - Load from localStorage first, then fetch from Nostr
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('cdg_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn("Failed to parse saved profile", e);
      }
    }
    return {
      name: 'Disc Golfer',
      about: '',
      picture: '',
      lud16: '',
      nip05: ''
    };
  });
  const [activeRound, setActiveRound] = useState<RoundSettings | null>(() => {
    const saved = localStorage.getItem('cdg_active_round');
    return saved ? JSON.parse(saved) : null;
  });
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('cdg_players');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentHole, setCurrentHole] = useState<number>(() => {
    const saved = localStorage.getItem('cdg_current_hole');
    return saved ? parseInt(saved) : 1;
  });

  // Stats
  const [userStats, setUserStats] = useState<UserStats>({
    totalRounds: 0,
    totalWins: 0,
    averageScore: 0,
    bestScore: 0,
    totalSatsWon: 0,
    // Extended stats
    totalAces: 0,
    totalBirdies: 0,
    bogeyFreeRounds: 0,
    biggestWinStreak: 0,
    totalSatsPaid: 0,
    biggestWin: 0,
  });

  // Wallet Mode
  const [walletMode, setWalletMode] = useState<'cashu' | 'nwc' | 'breez'>(() => {
    const savedMode = localStorage.getItem('cdg_wallet_mode') as 'cashu' | 'nwc' | 'breez';
    const savedString = localStorage.getItem('cdg_nwc_string');
    // Only allow NWC as default if we have a connection string
    if (savedMode === 'nwc' && savedString) return 'nwc';
    return 'cashu';
  });
  const [nwcString, setNwcString] = useState<string>(() => {
    return localStorage.getItem('cdg_nwc_string') || '';
  });

  const subRef = useRef<any>(null);
  const walletServiceRef = useRef<WalletService | null>(null);
  const nwcServiceRef = useRef<NWCService | null>(null);

  // Track recently animated payment IDs to prevent duplicate animations
  // This handles race conditions between event subscriptions and reconciliation
  const animatedPaymentIdsRef = useRef<Set<string>>(new Set());

  // Payment Notification State
  const [paymentNotification, setPaymentNotification] = useState<{
    amount: number;
    context?: 'wallet_receive' | 'buyin_qr';
  } | null>(null);

  // Lightning Strike State
  const [lightningStrike, setLightningStrike] = useState<{
    amount: number;
    show: boolean;
  } | null>(null);

  // Round Summary Modal State
  const [roundSummary, setRoundSummary] = useState<{
    isOpen: boolean;
    roundName: string;
    standings: Player[];
    payouts: { playerName: string; amount: number; isCurrentUser: boolean }[];
    aceWinners: { name: string; hole: number }[];
    acePotAmount: number;
    totalPot: number;
    par: number;
    isProcessingPayments: boolean;
  } | null>(null);

  // Auto-reset lightning strike after animation
  useEffect(() => {
    if (lightningStrike?.show) {
      const timer = setTimeout(() => {
        setLightningStrike(null);
      }, 3000); // 3 seconds matches the animation duration

      return () => clearTimeout(timer);
    }
  }, [lightningStrike]);

  // --- Effects ---

  // Helper to force immediate sync (bypass debounce)
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

  // Persistence & Auto-Calculation
  useEffect(() => {
    const cashuBal = WalletService.calculateBalance(proofs);
    // Always update the individual Cashu balance
    setWalletBalances(prev => ({ ...prev, cashu: cashuBal }));
    // Update main balance only if in Cashu mode
    if (walletMode === 'cashu') {
      setWalletBalance(cashuBal);
    }
    localStorage.setItem('cdg_proofs', JSON.stringify(proofs));
  }, [proofs, mints, walletMode]);

  useEffect(() => localStorage.setItem('cdg_txs', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('cdg_mints', JSON.stringify(mints)), [mints]);
  useEffect(() => localStorage.setItem('cdg_recent_players', JSON.stringify(recentPlayers)), [recentPlayers]);

  // Persist active round state
  useEffect(() => {
    if (activeRound) {
      localStorage.setItem('cdg_active_round', JSON.stringify(activeRound));
    } else {
      localStorage.removeItem('cdg_active_round');
    }
  }, [activeRound]);

  // Persist players state
  useEffect(() => {
    localStorage.setItem('cdg_players', JSON.stringify(players));
  }, [players]);

  // Persist current hole
  useEffect(() => {
    localStorage.setItem('cdg_current_hole', currentHole.toString());
  }, [currentHole]);

  // Auto-sync wallet to Nostr when proofs/mints/transactions change (Debounced)
  useEffect(() => {
    if (isAuthenticated && !isGuest && proofs.length > 0) {
      const timer = setTimeout(() => {
        console.log("🔄 [Backup] Auto-syncing wallet to Nostr...");
        syncWallet(proofs, mints, transactions).catch(e => console.error("Auto-sync failed:", e));
      }, 2000); // Debounce 2s to prevent spam
      return () => clearTimeout(timer);
    }
  }, [proofs, mints, transactions, isAuthenticated, isGuest, syncWallet]);

  // Sync Recent Players to Nostr when changed (Debounced)
  useEffect(() => {
    if (isAuthenticated && !isGuest && !isProfileLoading && recentPlayers.length > 0) {
      const timer = setTimeout(() => {
        publishRecentPlayers(recentPlayers).catch(console.warn);
      }, 2000); // Debounce 2s to prevent spam
      return () => clearTimeout(timer);
    }
  }, [recentPlayers, isAuthenticated, isGuest, isProfileLoading]);

  // Init Wallet Service
  useEffect(() => {
    const activeMint = mints.find(m => m.isActive) || mints[0];
    if (activeMint) {
      walletServiceRef.current = new WalletService(activeMint.url);
      walletServiceRef.current.connect().catch(console.error);
    }
  }, [mints]);

  // Init NWC Service
  useEffect(() => {
    if (nwcString) {
      try {
        nwcServiceRef.current = new NWCService(nwcString);
        console.log("NWC Service initialized");
      } catch (e) {
        console.error("Invalid NWC String, clearing...", e);
        setNwcString('');
        localStorage.removeItem('cdg_nwc_string');
        setWalletMode('cashu');
      }
    }
  }, [nwcString]);

  // Auto-refresh balance when wallet mode changes
  useEffect(() => {
    // Immediately update balance from cached values when switching modes
    // This prevents the old wallet's balance from showing during async refresh
    if (walletMode === 'cashu') {
      setWalletBalance(walletBalances.cashu);
    } else if (walletMode === 'nwc') {
      setWalletBalance(walletBalances.nwc);
    } else if (walletMode === 'breez') {
      setWalletBalance(walletBalances.breez);
    }
    // Then refresh async to get latest values
    refreshWalletBalance();
  }, [walletMode, nwcString]);

  // Persist Wallet Mode
  useEffect(() => {
    localStorage.setItem('cdg_wallet_mode', walletMode);
    localStorage.setItem('cdg_nwc_string', nwcString);
  }, [walletMode, nwcString]);

  // Init Auth
  useEffect(() => {
    const initSession = async () => {
      let session = getSession();

      // Check for completed Amber connection
      const amberResult = await completeAmberConnection();
      if (amberResult) {
        console.log('✅ Amber connection completed:', amberResult);
        // Create session with Amber
        session = {
          method: 'amber',
          pk: amberResult.userPubkey,
          sk: '' // Amber handles signing
        };
        localStorage.removeItem('is_guest_mode');
        localStorage.setItem('amber_ephemeral_sk', bytesToHex(amberResult.ephemeralSk));
        localStorage.setItem('amber_relay', amberResult.relay);
      }

      // REMOVED: Auto-create Guest Account
      // Previously: if (!session) { generateNewProfile()... }
      // Now: If no session, user stays unauthenticated and sees Onboarding

      if (session) {
        setCurrentUserPubkey(session.pk);
        setAuthMethod(session.method);
        setIsAuthenticated(true);
        setIsGuest(false);
      } else {
        // No session = not authenticated, will show Onboarding
        setIsAuthenticated(false);
        setIsGuest(false);
      }
    };
    initSession();

    return () => {
      if (subRef.current) subRef.current.close();
    };
  }, []); // Only run once on mount

  // Fetch profile & Restore Wallet/Data when identity changes (e.g. login)
  useEffect(() => {
    if (currentUserPubkey && !isGuest) {
      setIsProfileLoading(true);

      // Log the user's Lightning address for debugging
      const lightningAddress = getMagicLightningAddress(currentUserPubkey);
      console.log(`⚡ Your Lightning Address: ${lightningAddress}`);
      console.log(`📡 Your Pubkey: ${currentUserPubkey}`);

      // 1. Fetch Profile (remote fetch may update local cache)
      fetchProfile(currentUserPubkey).then(profile => {
        if (profile) {
          console.log("Profile loaded from Nostr:", profile);
          setUserProfile(profile);
          // Update localStorage with the latest from Nostr
          localStorage.setItem('cdg_user_profile', JSON.stringify(profile));
        } else {
          // Only set default if we don't have a local profile
          const savedProfile = localStorage.getItem('cdg_user_profile');
          if (!savedProfile) {
            setUserProfile(prev => ({ ...prev, name: 'Nostr User', picture: '', lud16: '', nip05: '' }));
          }
        }
      }).catch(e => {
        console.error("Error fetching profile in effect:", e);
      }).finally(() => {
        setIsProfileLoading(false);
        refreshStats();
      });

      // 2. Fetch Contacts (Friend List)
      fetchContactList(currentUserPubkey).then(async (contactPubkeys) => {
        if (contactPubkeys.length > 0) {
          console.log(`Found ${contactPubkeys.length} contacts.Fetching profiles...`);
          const profiles = await fetchProfilesBatch(contactPubkeys);
          setContacts(profiles.sort((a, b) => a.name.localeCompare(b.name)));
        }
      }).catch(e => console.warn("Contacts fetch failed", e));

      // 3. Restore Wallet Proofs (Merge Strategy)
      fetchWalletBackup(currentUserPubkey).then(async (backup) => {
        if (backup) {
          console.log("Found remote backup, merging...");

          // Merge existing (guest) proofs with remote proofs
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

          // 3.1. Restore Gateway Registrations
          if (backup.gatewayRegistrations && backup.gatewayRegistrations.length > 0) {
            console.log(`Restoring ${backup.gatewayRegistrations.length} gateway registrations...`);
            localStorage.setItem('gateway_registrations', JSON.stringify(backup.gatewayRegistrations));

            // Check if registrations are still valid and re-register if needed
            const needsReregistration = backup.gatewayRegistrations.some(reg => !reg.success);
            if (needsReregistration) {
              console.log("Some gateway registrations failed previously, attempting to re-register...");
              try {
                const newRegistrations = await registerWithAllGateways();
                // Merge with existing registrations
                const mergedRegistrations = backup.gatewayRegistrations.map(existing => {
                  const updated = newRegistrations.find(newReg => newReg.gateway === existing.gateway);
                  return updated || existing;
                });
                localStorage.setItem('gateway_registrations', JSON.stringify(mergedRegistrations));
              } catch (e) {
                console.warn("Failed to re-register gateways:", e);
              }
            }
          } else {
            // No gateway registrations in backup, register now
            console.log("No gateway registrations in backup, registering now...");
            try {
              await registerWithAllGateways();
            } catch (e) {
              console.warn("Failed to register gateways on restore:", e);
            }
          }
        } else {
          console.log("No wallet backup found. Creating initial backup to enable payment detection.");
          // Create initial backup immediately (even if empty) to ensure npub.cash payments work
          // The auto-sync will handle future updates
          setProofs(current => {
            // Force an immediate backup (don't wait for debounce)
            if (current.length > 0) {
              console.log("Creating initial backup with existing funds...");
            } else {
              console.log("Creating empty initial backup to enable payment tracking...");
            }
            // Trigger immediate sync after state update
            setTimeout(() => {
              syncWallet(current, mints, transactions).catch(e =>
                console.error("Initial backup failed:", e)
              );
            }, 100); // Minimal delay to allow state to settle
            return current;
          });

          // Register with gateways for new account
          console.log("Registering with payment gateways for new account...");
          try {
            await registerWithAllGateways();
          } catch (e) {
            console.warn("Failed to register gateways for new account:", e);
          }
        }
      }).catch(e => console.error("Wallet restore failed:", e));

      // 4. Restore Recent Players
      fetchRecentPlayers(currentUserPubkey).then(remotePlayers => {
        if (remotePlayers && remotePlayers.length > 0) {
          console.log("Restoring recent players...");
          setRecentPlayers(prev => {
            const existingPubkeys = new Set(prev.map(p => p.pubkey));
            const uniqueRemote = remotePlayers.filter(p => !existingPubkeys.has(p.pubkey));
            return [...uniqueRemote, ...prev].slice(0, 50); // keep 50
          });
        }
      }).catch(e => console.warn("Recent players restore failed:", e));

      // 5. Check for Missed Cashu Payments (Historical Gift Wraps)
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      fetchHistoricalGiftWraps(currentUserPubkey, sevenDaysAgo).then(async (events) => {
        if (events.length > 0) {
          console.log(`Found ${events.length} historical Gift Wraps, checking for Cashu tokens...`);

          let claimedCount = 0;
          let totalAmount = 0;

          for (const event of events) {
            const content = event.content;
            if (content && content.includes('cashuA')) {
              const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
              if (tokens) {
                for (const token of tokens) {
                  try {
                    // Check if we've already processed this token
                    const tokenId = token.substring(0, 20);
                    const processedKey = `processed_token_${tokenId}`;
                    if (localStorage.getItem(processedKey)) {
                      console.log(`Token ${tokenId} already processed, skipping...`);
                      continue;
                    }

                    const success = await receiveEcash(token);
                    if (success) {
                      claimedCount++;
                      // Mark as processed
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
            console.log(`✅ Recovered ${claimedCount} missed payments!`);
            // Optionally show a notification to user
          }
        }
      }).catch(e => console.warn("Historical Gift Wrap fetch failed:", e));

      // NOTE: npub.cash payments now handled by WebSocket subscription (see useEffect below)

      // 6. Initialize Breez Lightning Wallet (for mnemonic-based users)
      // This runs in background with infinite retry, never fails
      const initBreezWallet = async () => {
        // Check if user has a mnemonic (unified or Breez-specific)
        const hasMnemonic = hasStoredMnemonic(false) || hasStoredMnemonic(true);

        if (hasMnemonic && !isBreezInitialized()) {
          console.log('⚡ [AppContext] Starting Breez SDK initialization...');

          // Try unified mnemonic first, then Breez-specific
          let mnemonic = retrieveMnemonicEncrypted(currentUserPubkey, false);
          if (!mnemonic) {
            mnemonic = retrieveMnemonicEncrypted(currentUserPubkey, true);
          }

          if (mnemonic) {
            // Initialize Breez with API key config
            const breezConfig = {
              apiKey: BREEZ_API_KEY,
              environment: 'production' as const
            };

            initializeBreez(mnemonic, breezConfig).then((success) => {
              if (success) {
                console.log('✅ [AppContext] Breez SDK initialized successfully');

                // Subscribe to Breez events for payment notifications
                subscribeToBreezEvents(
                  // On payment received
                  (payment) => {
                    const amountSats = payment.amountSats;
                    console.log(`⚡ Received ${amountSats} sats via Breez! (id: ${payment.id})`);
                    // Pass payment.id for deduplication
                    handleIncomingPayment('breez', amountSats, 'Received via Breez Lightning', payment.id);
                  },
                  // On payment sent
                  (payment) => {
                    const amountSats = payment.amountSats;
                    console.log(`⚡ Sent ${amountSats} sats via Breez (id: ${payment.id})`);

                    if (amountSats && amountSats > 0) {
                      // Record transaction in history with payment ID for deduplication
                      const txId = payment.id ? `breez-${payment.id}` : undefined;
                      addTransaction('send', amountSats, 'Sent via Breez Lightning', 'breez', { id: txId });

                      // Refresh balances after sending
                      refreshAllBalances();
                    }
                  }
                );

                // Refresh balances now that Breez is ready
                refreshAllBalances();
              }
            }).catch((e) => {
              console.warn('⚠️ [AppContext] Breez initialization error (will retry):', e);
            });
          }
        }
      };

      // Start Breez initialization in background (don't await)
      initBreezWallet();
    }
  }, [currentUserPubkey, isGuest]);

  // Active Round Syncing
  useEffect(() => {
    if (activeRound && !activeRound.isFinalized) {
      // Set initial hole if provided
      if (activeRound.startingHole) {
        setCurrentHole(activeRound.startingHole);
      }

      // Subscribe to scores for this round
      if (subRef.current) subRef.current.close();

      try {
        subRef.current = subscribeToRound(activeRound.id, async (event) => {
          const playerPubkey = event.pubkey;
          const content = JSON.parse(event.content);

          // If we don't know this player, fetch their profile
          setPlayers(prev => {
            const exists = prev.find(p => p.id === playerPubkey);

            if (exists) {
              // Update existing player score
              return prev.map(p => p.id === playerPubkey ? {
                ...p,
                scores: content.scores,
                totalScore: content.totalScore
              } : p);
            } else {
              // New player found (async fetch profile but add placeholder first)
              fetchProfile(playerPubkey).then(prof => {
                setPlayers(curr => curr.map(p => p.id === playerPubkey ? { ...p, name: prof?.name || 'Unknown', lightningAddress: prof?.lud16, photoUrl: prof?.picture } : p));
              }).catch(() => { });

              return [...prev, {
                id: playerPubkey,
                name: 'Loading...',
                handicap: 0,
                paid: true, // Assumed paid if participating on Nostr
                scores: content.scores,
                totalScore: content.totalScore,
                isCurrentUser: playerPubkey === currentUserPubkey
              }];
            }
          });
        });
      } catch (e) {
        console.warn("Offline mode: Could not subscribe to round.");
      }
    }

    return () => {
      if (subRef.current) subRef.current.close();
    };
  }, [activeRound?.id, currentUserPubkey]);

  // Listen for Direct Messages (Auto-Redeem eCash)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToDirectMessages(async (event, decrypted) => {
        // Check for eCash token
        if (decrypted.includes('cashuA')) {
          console.log("Received potential eCash in DM from", event.pubkey);
          const tokens = decrypted.match(/cashuA[A-Za-z0-9_=-]+/g);

          if (tokens) {
            for (const token of tokens) {
              try {
                const success = await receiveEcash(token);
                if (success) {
                  console.log("Auto-redeemed token from DM!");
                  // If this is a player in the active round, mark them as paid
                  if (activeRound && !activeRound.isFinalized) {
                    setPlayers(prev => prev.map(p => {
                      if (p.id === event.pubkey) {
                        return { ...p, paid: true };
                      }
                      return p;
                    }));
                  }
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
  }, [isAuthenticated, isGuest, activeRound?.id]);

  // Listen for NIP-17 Gift Wraps (Bridge Payments)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToGiftWraps(async (event) => {
        console.log("Received NIP-17 Gift Wrap!", event);
        // The event content is the "Rumor". We check it for tokens.
        const content = event.content;
        if (content && content.includes('cashuA')) {
          console.log("Found Cashu token in Gift Wrap!");
          const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
          if (tokens) {
            for (const token of tokens) {
              try {
                const success = await receiveEcash(token);
                if (success) {
                  console.log("Auto-redeemed token from Gift Wrap!");
                  // Notify user (could add a toast here later)
                  handleIncomingPayment('cashu', 0, 'Received via Lightning Bridge'); // Guarded against zero in handler
                  // Actually receiveEcash updates the proofs, so balance updates automatically.
                }
              } catch (e) {
                console.warn("Failed to redeem token from Gift Wrap", e);
              }
            }
          }
        }
      });

      return () => sub.close();
    }
  }, [isAuthenticated, isGuest]);

  // Listen for Lightning Nutzaps (kind 9735)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToNutzaps(async (event) => {
        console.log("🔔 Processing nutzap payment!", event);

        try {
          // Parse the zap event to extract payment details
          const zapRequest = event.tags.find(t => t[0] === 'description')?.[1];
          if (zapRequest) {
            const zapData = JSON.parse(zapRequest);
            const amountMsats = parseInt(zapData.amount);
            const amount = Math.floor(amountMsats / 1000); // msats to sats

            // Check if this is a payment to us (via our lud16 or pubkey)
            const recipient = zapData.tags?.find((t: any[]) => t[0] === 'p')?.[1];
            const ourLud16 = getMagicLightningAddress(currentUserPubkey);

            if (recipient === currentUserPubkey || zapData.lud16 === ourLud16) {
              // This is a payment to us via Lightning
              console.log(`⚡ Lightning nutzap received: ${amount} sats (event: ${event.id})`);

              // Add transaction and show notification (use event.id for deduplication)
              // handleIncomingPayment already calls setLightningStrike, setPaymentNotification, and refreshAllBalances
              handleIncomingPayment('cashu', amount, 'Received via Lightning Zap', event.id);

              // Play lightning strike sound
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

  // Listen for Lightning Gift Wraps (kinds 23194/23195)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      const sub = subscribeToLightningGiftWraps(async (event) => {
        console.log("⚡ Processing Lightning gift-wrap payment!", event);

        try {
          const content = event.content;
          if (content && content.includes('cashuA')) {
            console.log("Found Cashu token in Lightning gift-wrap!");
            const tokens = content.match(/cashuA[A-Za-z0-9_=-]+/g);
            if (tokens) {
              for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                try {
                  const success = await receiveEcash(token);
                  if (success) {
                    console.log("Auto-redeemed token from Lightning gift-wrap!");
                    // Extract amount from token if possible
                    const amount = 0; // TODO: Extract amount from token
                    // Use event.id + token index for deduplication
                    handleIncomingPayment('cashu', amount, 'Received via Lightning Gateway', `${event.id}-${i}`);
                    setPaymentNotification({ amount: amount || 0, context: 'wallet_receive' });
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

  // Listen for Rounds where I am tagged (Remote Round Notification)
  useEffect(() => {
    if (isAuthenticated && currentUserPubkey) {
      const sub = subscribeToPlayerRounds(currentUserPubkey, async (event) => {
        console.log("🔔 Found a round I am tagged in!", event);
        try {
          const content = JSON.parse(event.content);
          const roundId = event.tags.find(t => t[0] === 'd')?.[1];

          if (!roundId) return;

          // If we are already in this round, do nothing
          if (activeRound && activeRound.id === roundId) return;

          // If we are the host, we probably already have this state, but just in case
          if (event.pubkey === currentUserPubkey) return;

          console.log("✨ Auto-joining remote round:", content.name);

          const joinedRound: RoundSettings = {
            id: roundId,
            name: content.name || 'Joined Round',
            courseName: content.courseName || 'Unknown Course',
            entryFeeSats: content.entryFeeSats || 0,
            acePotFeeSats: content.acePotFeeSats || 0,
            date: content.date || new Date().toISOString(),
            isFinalized: content.isFinalized || false,
            holeCount: content.holeCount || 18,
            players: [], // Will be populated by subscribeToRound
            pubkey: event.pubkey, // Host pubkey
            eventId: event.id,
            startingHole: 1,
            trackPenalties: false,
            hideOverallScore: false
          };

          setActiveRound(joinedRound);

          // We don't need to setPlayers here because the existing 'Active Round Syncing' effect 
          // (lines 407+) will trigger when activeRound changes, subscribe to scores, 
          // and populate the player list.

        } catch (e) {
          console.warn("Failed to parse remote round:", e);
        }
      });

      return () => sub.close();
    }
  }, [isAuthenticated, currentUserPubkey, activeRound]);

  // Real-time multi-gateway payment detection via WebSocket
  useEffect(() => {
    if (isAuthenticated && currentUserPubkey) {
      console.log("🔌 Setting up multi-gateway WebSocket subscriptions for payment detection...");

      const handleQuoteUpdate = async (quoteId: string, gateway: string) => {
        console.log(`📥 [${gateway}] Received quote update: ${quoteId}`);

        try {
          // Fetch the updated quote
          const quote = await getQuoteById(quoteId);

          if (!quote) {
            console.warn(`Quote ${quoteId} not found on ${gateway}`);
            return;
          }

          console.log(`Quote ${quoteId} state: ${quote.state}, amount: ${quote.amount}`);

          // Only process PAID quotes
          if (quote.state !== 'PAID') {
            console.log(`Quote ${quoteId} is not PAID yet, skipping...`);
            return;
          }

          // Check if we've already processed this quote
          const processedKey = `processed_quote_${gateway}_${quoteId}`;
          if (localStorage.getItem(processedKey)) {
            console.log(`Quote ${quoteId} from ${gateway} already processed, skipping...`);
            return;
          }

          console.log(`🪙 [${gateway}] Minting ${quote.amount} sats from ${quote.mintUrl} for quote ${quoteId}...`);

          // Mint the tokens
          const mint = new CashuMint(quote.mintUrl);
          const wallet = new CashuWallet(mint);
          await wallet.loadMint();

          const newProofs = await wallet.mintProofs(quote.amount, quoteId);

          if (newProofs && newProofs.length > 0) {
            // Add proofs to state with mintUrl attached
            const proofsWithMint = newProofs.map(p => ({ ...p, mintUrl: quote.mintUrl }));
            setProofs(prev => [...prev, ...proofsWithMint]);

            // Add mint to state if not exists
            setMints(prev => {
              if (prev.find(m => m.url === quote.mintUrl)) return prev;
              return [...prev, { url: quote.mintUrl, nickname: gateway, isActive: true }];
            });

            // Mark as processed
            localStorage.setItem(processedKey, Date.now().toString());

            // Add transaction record (use quoteId for deduplication)
            // handleIncomingPayment already calls setLightningStrike, setPaymentNotification, and refreshAllBalances
            handleIncomingPayment('cashu', quote.amount, `Received via ${gateway}`, quoteId);

            console.log(`✅ [${gateway}] Successfully received ${quote.amount} sats!`);

            // Dispatch event for UI with context metadata
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
        console.error(`❌ [${gateway}] WebSocket subscription error:`, error);
        // Individual gateway reconnection is handled automatically
        // No need for additional fallback polling since we have multiple gateways
      };

      // Subscribe to all registered gateways
      const disposer = subscribeToAllGatewayUpdates(handleQuoteUpdate, handleError);

      // FALLBACK: Poll all gateways for pending payments every 60 seconds
      // This ensures we catch payments even if all WebSockets fail
      let pollingInterval: NodeJS.Timeout | null = null;
      let pollingTimeout: NodeJS.Timeout | null = null;

      const pollAllGateways = async () => {
        try {
          console.log("🔄 Polling all gateways for pending payments (fallback)...");
          const pendingQuotes = await checkPendingPayments();

          for (const quote of pendingQuotes) {
            // Determine which gateway this quote is from (simplified - in practice you'd check the mint URL)
            const gateway = quote.mintUrl?.includes('minibits') ? 'minibits.cash' : 'npub.cash';
            await handleQuoteUpdate(quote.quoteId, gateway);
          }
        } catch (e) {
          console.error("❌ Multi-gateway polling failed:", e);
        }
      };

      // Wait 60 seconds before starting polling to give WebSockets a chance
      pollingTimeout = setTimeout(() => {
        pollingInterval = setInterval(pollAllGateways, 60000);
        console.log("⏰ Started multi-gateway fallback polling (every 60s)");
        // Do the first poll immediately
        pollAllGateways();
      }, 60000);

      // Cleanup on unmount
      return () => {
        console.log("🔌 Cleaning up multi-gateway WebSocket subscriptions...");
        disposer();
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          console.log("⏰ Cancelled polling startup timeout");
        }
        if (pollingInterval) {
          clearInterval(pollingInterval);
          console.log("⏰ Stopped multi-gateway fallback polling");
        }
      };
    }
  }, [isAuthenticated, isGuest, currentUserPubkey]);


  // --- Actions ---

  const loginNsec = async (nsec: string) => {
    const { pk } = loginWithNsec(nsec);
    setUserProfile({ name: 'Loading...', about: '', picture: '', lud16: '', nip05: '' });
    setCurrentUserPubkey(pk);
    setAuthMethod('local');
    setAuthSourceState('nsec');
    setHasUnifiedBackup(false);
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
  };

  const loginMnemonic = async (mnemonic: string) => {
    const { pk } = nostrLoginWithMnemonic(mnemonic);
    setUserProfile({ name: 'Loading...', about: '', picture: '', lud16: '', nip05: '' });
    setCurrentUserPubkey(pk);
    setAuthMethod('local');
    setAuthSourceState('mnemonic');
    setHasUnifiedBackup(true);
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
  };

  const createAccountFromMnemonic = async (): Promise<{ mnemonic: string }> => {
    // Generate new identity from mnemonic (NIP-06 / BIP-89)
    // This creates both Nostr keys AND Breez wallet seed from the same 12 words
    const { mnemonic, pk } = generateNewProfileFromMnemonic();

    setCurrentUserPubkey(pk);
    setAuthMethod('local');
    setAuthSourceState('mnemonic');
    setHasUnifiedBackup(true);
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');

    // 1. Get the magic lightning address for this new pubkey
    const magicLUD16 = getMagicLightningAddress(pk);

    // 2. Set the initial profile with the magic LUD16
    const initialProfile: UserProfile = {
      name: 'Disc Golfer',
      about: '',
      picture: '',
      lud16: magicLUD16,
      nip05: ''
    };
    setUserProfile(initialProfile);

    // 3. Publish the new profile (with LUD16) to Nostr
    console.log("📤 Publishing new profile to Nostr...");
    try {
      await updateUserProfile(initialProfile);
      console.log("✅ Profile published successfully!");
    } catch (e) {
      console.error("⚠️ Failed to publish profile:", e);
    }

    // 4. Register with payment gateways for automatic receiving
    console.log("🔗 Registering with payment gateways...");
    try {
      const registrations = await registerWithAllGateways();
      const successful = registrations.filter(r => r.success).length;
      console.log(`✅ Registered with ${successful}/${registrations.length} gateways`);
    } catch (e) {
      console.error("⚠️ Gateway registration failed:", e);
    }

    // 5. Create initial wallet backup to enable payment detection
    console.log("📦 Creating initial wallet backup for new account...");
    try {
      await syncWallet(proofs, mints, transactions);
      console.log("✅ Initial wallet backup created successfully!");
    } catch (e) {
      console.error("⚠️ Failed to create initial wallet backup:", e);
    }

    return { mnemonic };
  };

  const loginNip46 = async (bunkerUrl: string) => {
    const { pk } = await loginWithNip46(bunkerUrl);
    setUserProfile({ name: 'Loading...', about: '', picture: '', lud16: '', nip05: '' });
    setCurrentUserPubkey(pk);
    setAuthMethod('nip46');
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
  };

  const loginAmber = async () => {
    await loginWithAmber(); // Opens Amber app
    // Note: Actual login completion happens when user returns from Amber
    // The app will redirect to nostrconnect://, so we can't continue here
  };

  const createAccount = async () => {
    // DO NOT generate a new keypair - use the existing guest keypair
    // This ensures the lightning address (npub@npub.cash) remains consistent
    // The keypair was already generated when the app first opened
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');

    // 1. Get the magic lightning address
    const magicLUD16 = getMagicLightningAddress(currentUserPubkey);

    // 2. Set the initial profile with the magic LUD16
    const initialProfile: UserProfile = {
      name: 'Disc Golfer',
      about: '',
      picture: '',
      lud16: magicLUD16,
      nip05: ''
    };
    setUserProfile(initialProfile);

    // 3. Publish the new profile (with LUD16) to Nostr
    await updateUserProfile(initialProfile);

    // 4. Register with payment gateways for automatic receiving
    console.log("🔗 Registering with payment gateways...");
    try {
      const registrations = await registerWithAllGateways();
      const successful = registrations.filter(r => r.success).length;
      console.log(`✅ Registered with ${successful}/${registrations.length} gateways`);
    } catch (e) {
      console.error("⚠️ Gateway registration failed:", e);
    }

    // 5. Create initial wallet backup to enable payment detection
    // This ensures npub.cash can send payments immediately
    console.log("📦 Creating initial wallet backup for new account...");
    try {
      await syncWallet(proofs, mints, transactions);
      console.log("✅ Initial wallet backup created successfully!");
    } catch (e) {
      console.error("⚠️ Failed to create initial wallet backup:", e);
    }

    // Profile.tsx handles setting isEditing(true) via the profile state/useEffect
    // Profile.tsx also handles setting the default bio
  };

  const performLogout = () => {
    // 1. Disconnect Breez SDK (fire and forget - don't block logout)
    disconnectBreez().catch(e => console.warn('Breez disconnect error:', e));

    // 2. Clear authenticated user data from storage
    nostrLogout();

    // Clear mnemonic/seed phrase storage
    clearMnemonicStorage();

    localStorage.removeItem('cdg_user_private_key');
    localStorage.removeItem('cdg_user_public_key');
    localStorage.removeItem('cdg_auth_method');
    localStorage.removeItem('cdg_wallet_mode');
    localStorage.removeItem('cdg_nwc_string');
    localStorage.removeItem('cdg_user_profile');
    localStorage.removeItem('is_guest_mode');
    localStorage.removeItem('cdg_breez_lightning_address');

    // Clear wallet/payment data from localStorage
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

    // 3. Reset auth state (user will see Onboarding)
    setIsAuthenticated(false);
    setIsGuest(false);
    setAuthMethod(null);
    setCurrentUserPubkey('');
    setUserProfile({ name: '', picture: '', about: '', lud16: '', nip05: '' });

    // Reset Wallet Mode
    setWalletMode('cashu');
    setNwcString('');
    if (nwcServiceRef.current) {
      nwcServiceRef.current = null;
    }

    // 4. Clear sensitive app state from memory
    setProofs([]);
    setTransactions([]);
    setRecentPlayers([]);
    setContacts([]);
    setActiveRound(null);

    // REMOVED: Guest account auto-creation
    // Now user goes back to Onboarding to create a new account
  };

  const addRecentPlayer = (player: DisplayProfile) => {
    setRecentPlayers(prev => {
      // Remove if existing to bring to top
      const filtered = prev.filter(p => p.pubkey !== player.pubkey);
      return [player, ...filtered].slice(0, 20); // Keep last 20
    });
  };

  // =========================================================================
  // FINALIZATION STATE SETTERS (for onboarding flow)
  // =========================================================================

  const setAuthState = useCallback((state: {
    isAuthenticated: boolean;
    isGuest: boolean;
    currentUserPubkey: string;
    authMethod: 'local' | 'nip46' | 'amber' | null;
  }) => {
    setIsAuthenticated(state.isAuthenticated);
    setIsGuest(state.isGuest);
    setCurrentUserPubkey(state.currentUserPubkey);
    setAuthMethod(state.authMethod);
  }, []);

  const setUserProfileState = useCallback((profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('cdg_user_profile', JSON.stringify(profile));
  }, []);

  const setContactsState = useCallback((newContacts: DisplayProfile[]) => {
    setContacts(newContacts.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const setRecentPlayersState = useCallback((newPlayers: DisplayProfile[]) => {
    setRecentPlayers(prev => {
      const existingPubkeys = new Set(prev.map(p => p.pubkey));
      const uniqueNew = newPlayers.filter(p => !existingPubkeys.has(p.pubkey));
      return [...uniqueNew, ...prev].slice(0, 50);
    });
  }, []);

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

  const initializeSubscriptions = useCallback((pubkey: string) => {
    // Log the user's Lightning address for debugging
    const lightningAddress = getMagicLightningAddress(pubkey);
    console.log(`⚡ Your Lightning Address: ${lightningAddress}`);
    console.log(`📡 Your Pubkey: ${pubkey}`);

    // Note: Real-time subscriptions are handled by existing useEffects
    // that react to isAuthenticated and currentUserPubkey changes
    console.log('🔄 [Finalization] Subscriptions will be initialized by existing effects');
  }, []);

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
      walletType: walletType || walletMode, // Default to current mode if not specified
      status
    };
    setTransactions(prev => {
      // Dedupe by id
      if (prev.some(t => t.id === txId)) return prev;
      return [tx, ...prev];
    });
  };

  const refreshStats = async () => {
    if (!currentUserPubkey) return;
    try {
      const history = await fetchUserHistory(currentUserPubkey);
      if (history && history.length > 0) {
        let totalScoreSum = 0;
        let best = 999;
        let totalAces = 0;
        let totalBirdies = 0;
        let bogeyFreeRounds = 0;

        history.forEach(evt => {
          try {
            const c = JSON.parse(evt.content);
            const score = c.totalScore || 0;
            const scores = c.scores || {};

            totalScoreSum += score;
            if (score < best && score > 0) best = score;

            // Calculate aces and birdies (assuming par 3 per hole)
            let hasBogey = false;
            Object.values(scores).forEach((holeScore: any) => {
              if (holeScore === 1) totalAces++;
              if (holeScore === 2) totalBirdies++;
              if (holeScore >= 4) hasBogey = true;
            });

            if (!hasBogey && Object.keys(scores).length > 0) bogeyFreeRounds++;
          } catch (e) { }
        });

        // Calculate Sats from Transactions
        const wonTxs = transactions.filter(t => t.type === 'payout' || t.type === 'ace_pot');
        const paidTxs = transactions.filter(t => t.type === 'payment');
        const totalWon = wonTxs.reduce((sum, t) => sum + t.amountSats, 0);
        const totalPaid = paidTxs.reduce((sum, t) => sum + t.amountSats, 0);
        const biggestWin = wonTxs.length > 0 ? Math.max(...wonTxs.map(t => t.amountSats)) : 0;

        // Calculate win streak (count consecutive payouts)
        const sortedWins = wonTxs.sort((a, b) => b.timestamp - a.timestamp);
        let biggestWinStreak = sortedWins.length > 0 ? 1 : 0;
        // Simplified: just use total wins as streak for now
        // A true streak would require tracking consecutive round wins

        setUserStats({
          totalRounds: history.length,
          totalWins: wonTxs.length,
          averageScore: Math.round(totalScoreSum / history.length),
          bestScore: best === 999 ? 0 : best,
          totalSatsWon: totalWon,
          totalAces,
          totalBirdies,
          bogeyFreeRounds,
          biggestWinStreak,
          totalSatsPaid: totalPaid,
          biggestWin,
        });
      }
    } catch (e) {
      console.warn("Could not fetch user stats:", e);
    }
  };

  const updateUserProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    // Persist to localStorage immediately for instant access on page navigation
    localStorage.setItem('cdg_user_profile', JSON.stringify(profile));
    try {
      await publishProfile(profile);
    } catch (e) {
      console.warn("Failed to publish profile:", e);
    }
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
      pubkey: currentUserPubkey,
      isFinalized: false,
      players: [currentUserPubkey, ...selectedPlayers.map(p => p.pubkey)],
      startingHole: settings.startingHole || 1,
      trackPenalties: settings.trackPenalties || false,
      hideOverallScore: settings.hideOverallScore || false,
      par: settings.par || ((settings.holeCount || DEFAULT_HOLE_COUNT) * 3) // Par 3 per hole
    };

    setActiveRound(newRound);

    // Add self as player (Host)
    const hostPayment = paymentSelections[currentUserPubkey] ?? { entry: true, ace: true };
    const hostOwesPayment = (settings.entryFeeSats > 0 && hostPayment.entry) || (settings.acePotFeeSats > 0 && hostPayment.ace);
    const initialPlayers: Player[] = [{
      id: currentUserPubkey,
      name: userProfile.name,
      handicap: 0,
      paid: !hostOwesPayment, // Marked paid if nothing is owed
      paysEntry: hostPayment.entry,
      paysAce: hostPayment.ace,
      scores: {},
      totalScore: 0,
      isCurrentUser: true,
      lightningAddress: userProfile.lud16,
      photoUrl: userProfile.picture
    }];

    // Add other invited players
    selectedPlayers.forEach(p => {
      addRecentPlayer(p);
      const payment = paymentSelections[p.pubkey] ?? { entry: true, ace: true };
      const owesPayment = (settings.entryFeeSats > 0 && payment.entry) || (settings.acePotFeeSats > 0 && payment.ace);
      const handicap = settings.playerHandicaps?.[p.pubkey] || 0;
      initialPlayers.push({
        id: p.pubkey,
        name: p.name,
        handicap,
        paid: owesPayment ? (!!p.paid) : true, // If owes payment, use passed status; else marked paid
        paysEntry: payment.entry,
        paysAce: payment.ace,
        scores: {},
        totalScore: handicap, // Start with handicap as initial score
        isCurrentUser: false,
        lightningAddress: p.nip05,
        photoUrl: p.image
      });
    });

    // Update host handicap
    initialPlayers[0].handicap = settings.playerHandicaps?.[currentUserPubkey] || 0;
    initialPlayers[0].totalScore = settings.playerHandicaps?.[currentUserPubkey] || 0;


    setPlayers(initialPlayers);

    try {
      const roundEvent = await publishRound(newRound);
      // Update the active round with the event ID
      setActiveRound(prev => prev ? { ...prev, eventId: roundEvent.id } : null);
    } catch (e) {
      console.warn("Failed to publish round:", e);
    }
  };

  const joinRoundAndPay = async (roundId: string, roundData?: any): Promise<boolean> => {
    const fee = (roundData?.entryFeeSats || 0) + (roundData?.acePotFeeSats || 0);
    const hostPubkey = roundData?.pubkey;

    if (walletBalance < fee) return false;

    // 1. Create Token
    let token = '';
    if (fee > 0 && hostPubkey) {
      try {
        token = await createToken(fee);
        // 2. Send Token to Host via DM
        await sendDirectMessage(hostPubkey, `Payment for round ${roundData?.name || 'Disc Golf'}: ${token}`);
        addTransaction('send', fee, `Entry Fee: ${roundData?.name || 'Round'}`);
      } catch (e) {
        console.error("Failed to pay entry fee", e);
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
      hideOverallScore: false
    };

    setActiveRound(joinedRound);

    setPlayers([{
      id: currentUserPubkey,
      name: userProfile.name,
      handicap: 0,
      paid: true,
      scores: {},
      totalScore: 0,
      isCurrentUser: true,
      lightningAddress: userProfile.lud16,
      photoUrl: userProfile.picture
    }]);

    try {
      await publishScore(roundId, {}, 0);
    } catch (e) {
      console.warn("Failed to join round on network:", e);
    }

    return true;
  };

  const updateScore = useCallback((hole: number, score: number, playerId?: string) => {
    const targetId = playerId || currentUserPubkey;

    setPlayers(prev => prev.map(p => {
      if (p.id !== targetId) return p;

      const newScores = { ...p.scores, [hole]: score };
      const total = (Object.values(newScores) as number[]).reduce((sum, s) => sum + s, 0);

      return { ...p, scores: newScores, totalScore: total };
    }));
  }, []);

  const publishCurrentScores = useCallback(async () => {
    if (!activeRound) return;

    const currentPlayer = players.find(p => p.isCurrentUser);
    if (!currentPlayer) return;

    try {
      await publishScore(activeRound.id, currentPlayer.scores, currentPlayer.totalScore);
    } catch (e) {
      console.warn("Score sync failed", e);
    }
  }, [activeRound, players]);

  // Set player paid status manually
  const setPlayerPaid = useCallback((playerId: string) => {
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, paid: true } : p
    ));
  }, []);

  // Helper function to resolve Lightning Address to an invoice
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
    if (!activeRound) return;
    if (players.length === 0) {
      console.warn('Cannot finalize round with no players');
      return;
    }

    const sortedPlayers = [...players].sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0));
    const winner = sortedPlayers[0];
    const potSize = (activeRound.entryFeeSats || 0) * players.length;
    const prize = Math.floor(potSize * 0.8); // 80% payout
    const acePotAmount = activeRound.acePotFeeSats ? activeRound.acePotFeeSats * players.length : 0;
    // Calculate par dynamically: 3 strokes per hole
    const par = activeRound.par || (activeRound.holeCount * 3);

    // Detect aces (score of 1 on any hole)
    const aceWinners: { name: string; hole: number }[] = [];
    players.forEach(player => {
      Object.entries(player.scores || {}).forEach(([hole, score]) => {
        if (score === 1) {
          aceWinners.push({ name: player.name, hole: parseInt(hole) });
        }
      });
    });

    // Show the round summary modal IMMEDIATELY with processing state
    setRoundSummary({
      isOpen: true,
      roundName: activeRound.name || 'Round',
      standings: sortedPlayers,
      payouts: [], // Empty initially
      aceWinners,
      acePotAmount,
      totalPot: potSize,
      par,
      isProcessingPayments: prize > 0 && winner && !winner.isCurrentUser
    });

    // Track payouts for summary
    const payoutsMade: { playerName: string; amount: number; isCurrentUser: boolean }[] = [];

    // Pay main pot (async, modal already showing)
    if (prize > 0 && winner) {
      if (winner.isCurrentUser) {
        // I won, I keep the pot (which I already hold as host)
        addTransaction('payout', prize, `Won Round: ${activeRound.name}`);
        payoutsMade.push({ playerName: winner.name, amount: prize, isCurrentUser: true });

        // Update modal with payout info
        setRoundSummary(prev => prev ? {
          ...prev,
          payouts: payoutsMade,
          isProcessingPayments: false
        } : null);
      } else {
        // Someone else won, pay them via their Lightning Address
        try {
          const winnerLightningAddress = winner.lightningAddress || getMagicLightningAddress(winner.id);

          if (!winnerLightningAddress) {
            throw new Error("Winner has no Lightning Address configured");
          }

          console.log(`💸 Paying ${prize} sats to winner ${winner.name} at ${winnerLightningAddress}`);

          const invoice = await resolveLightningAddress(winnerLightningAddress, prize);

          if (!invoice) {
            throw new Error(`Could not get invoice from ${winnerLightningAddress}`);
          }

          const success = await sendFunds(prize, invoice);

          if (success) {
            console.log(`✅ Successfully paid ${prize} sats to ${winner.name}`);
            addTransaction('payout', prize, `Payout to ${winner.name}`);
            payoutsMade.push({ playerName: winner.name, amount: prize, isCurrentUser: false });
          } else {
            throw new Error("Payment failed");
          }
        } catch (e) {
          console.error("Failed to pay winner", e);
          const errorMessage = e instanceof Error ? e.message : String(e);
          // Show error in modal or alert
          alert(`Failed to pay winner: ${errorMessage}. Please pay manually.`);
        }

        // Update modal with payout info (whether success or fail)
        setRoundSummary(prev => prev ? {
          ...prev,
          payouts: payoutsMade,
          isProcessingPayments: false
        } : null);
      }
    }

    // Pay ace pot if someone got an ace
    if (aceWinners.length > 0 && acePotAmount > 0) {
      const aceWinner = players.find(p =>
        p.scores && Object.values(p.scores).includes(1)
      );
      if (aceWinner) {
        const aceShare = Math.floor(acePotAmount / aceWinners.length);
        // For now, just log - ace pot payment logic can be similar to main pot
        console.log(`🎯 Ace pot: ${aceShare} sats to ${aceWinner.name}`);
      }
    }

    if (activeRound.pubkey === currentUserPubkey) {
      try {
        await publishRound({ ...activeRound, isFinalized: true });
      } catch (e) {
        console.warn("Failed to finalize round on network:", e);
      }
    }

    setActiveRound(prev => prev ? { ...prev, isFinalized: true } : null);

    // Save to round history
    try {
      const historicalRound = {
        id: activeRound.id,
        roundName: activeRound.name,
        courseName: activeRound.courseName,
        date: activeRound.date,
        par,
        holeCount: activeRound.holeCount,
        standings: sortedPlayers,
        payouts: payoutsMade,
        aceWinners,
        acePotAmount,
        totalPot: potSize,
        entryFeeSats: activeRound.entryFeeSats,
        acePotFeeSats: activeRound.acePotFeeSats,
        finalizedAt: Date.now()
      };

      const existingHistory = localStorage.getItem('cdg_round_history');
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      // Add new round at the beginning, limit to 50 rounds
      history.unshift(historicalRound);
      if (history.length > 50) history.pop();
      localStorage.setItem('cdg_round_history', JSON.stringify(history));
      console.log('📜 Saved round to history');
    } catch (e) {
      console.warn('Failed to save round to history:', e);
    }

    // Clear persisted game state from localStorage
    localStorage.removeItem('cdg_active_round');
    localStorage.removeItem('cdg_players');
    localStorage.removeItem('cdg_current_hole');
    refreshStats();
  };

  // --- Wallet Actions ---

  const checkForPayments = async (): Promise<number> => {
    if (!currentUserPubkey || isGuest) return 0;

    // Check npub.cash
    try {
      // alert("Checking npub.cash..."); // Too noisy for auto-check
      const quotes = await checkPendingPayments();

      if (quotes.length > 0) {
        console.log(`Found ${quotes.length} pending npub.cash payments!`);
        // Only alert if we found something, so we don't annoy user on auto-check
        // But for manual check, we want to know.
        // We can't easily distinguish manual vs auto here without passing a flag.
        // Let's assume if we find quotes, we want to know what happens.

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
            // alert(`Found payment! Minting ${quote.amount} sats...`);

            const mint = new CashuMint(quote.mintUrl);
            const wallet = new CashuWallet(mint);
            await wallet.loadMint();

            // Mint the tokens
            const newProofs = await wallet.mintProofs(quote.amount, quote.quoteId);

            if (newProofs && newProofs.length > 0) {
              // Add proofs to state with mintUrl attached
              const proofsWithMint = newProofs.map(p => ({ ...p, mintUrl: quote.mintUrl }));
              setProofs(prev => [...prev, ...proofsWithMint]);

              // Add mint to state if not exists
              setMints(prev => {
                if (prev.find(m => m.url === quote.mintUrl)) return prev;
                return [...prev, { url: quote.mintUrl, nickname: 'npub.cash', isActive: true }];
              });

              claimedCount++;
              localStorage.setItem(processedKey, Date.now().toString());
              console.log(`Auto-claimed npub.cash payment!`);

              // Add transaction record (use quoteId for deduplication)
              handleIncomingPayment('cashu', quote.amount, 'Received via npub.cash', quote.quoteId);
              alert(`Successfully received ${quote.amount} sats from npub.cash!`);
            }
          } catch (e) {
            console.warn("Failed to mint npub.cash quote", e);
            alert(`Failed to claim payment: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
          }
        }

        if (claimedCount > 0) {
          console.log(`✅ Recovered ${claimedCount} npub.cash payments!`);
          // Trigger a sync to save new state
          // We can't call syncWallet directly easily because it needs current state,
          // but updating state triggers effects or we can rely on next sync.
          // Ideally we should sync here.
        }
        return claimedCount;
      } else {
        // If called manually, user wants to know if nothing was found.
        // We'll rely on the UI button to say "Checked!" but maybe we should return the count.
        return 0;
      }
    } catch (e) {
      console.warn("npub.cash check failed:", e);
      alert(`Error checking npub.cash: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      return 0;
    }
  };

  const refreshWalletBalance = async () => {
    setIsBalanceLoading(true);

    // Breez Logic
    if (walletMode === 'breez') {
      if (isBreezInitialized()) {
        try {
          const breezBalance = await getBreezBalance();
          setWalletBalance(breezBalance.balanceSats);
          setWalletBalances(prev => ({ ...prev, breez: breezBalance.balanceSats }));
          console.log(`⚡ Breez balance: ${breezBalance.balanceSats} sats`);
        } catch (e) {
          console.error("Breez balance fetch failed:", e);
        }
      } else {
        console.log('⏳ Breez SDK not yet initialized, balance pending...');
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
          // Also update individual balance
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

        // NOTE: npub.cash payments now handled by WebSocket subscription
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
        const url = p.mintUrl || activeMintUrl; // Default to active mint if missing
        if (!url) return; // Should not happen
        if (!proofsByMint[url]) proofsByMint[url] = [];
        proofsByMint[url].push(p);
      });

      let allValidProofs: Proof[] = [];
      let hasChanges = false;

      // Verify each batch
      for (const [mintUrl, mintProofs] of Object.entries(proofsByMint)) {
        try {
          console.log(`Verifying ${mintProofs.length} proofs for ${mintUrl}...`);
          // Use existing service if it matches, otherwise create temp one
          let service = walletServiceRef.current;
          if (!service || service['mintUrl'] !== mintUrl) {
            service = new WalletService(mintUrl);
            // We don't strictly need to connect() for verify, but good practice if loadMint needed
            // await service.connect(); 
          }

          const validProofs = await service.verifyProofs(mintProofs);

          // Ensure valid proofs keep their mintUrl
          const validWithUrl = validProofs.map(p => ({ ...p, mintUrl }));
          allValidProofs = [...allValidProofs, ...validWithUrl];

          if (validProofs.length !== mintProofs.length) {
            console.log(`Found spent proofs for ${mintUrl}. (${mintProofs.length} -> ${validProofs.length})`);
            hasChanges = true;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.warn(`Failed to verify proofs for ${mintUrl}:`, errorMsg);

          // Check for keyset mismatch - clear those proofs
          if (errorMsg.includes('different units') || errorMsg.includes('keyset') || errorMsg.includes('unknown keyset')) {
            console.warn(`⚠️ Keyset mismatch for ${mintUrl}. Clearing invalid proofs.`);
            hasChanges = true;
            // Don't add these proofs to allValidProofs - they're invalid
            continue;
          }

          // If verification fails for other reasons (network), keep original proofs to be safe
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

        // NOTE: npub.cash payments now handled by WebSocket subscription
      }
    } catch (e) {
      console.error("Wallet refresh failed:", e);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  // Refresh all wallet balances (for cumulative "All Wallets" view)
  const refreshAllBalances = useCallback(async () => {
    setIsBalanceLoading(true);
    console.log("🔄 Refreshing all wallet balances...");

    const newBalances = { cashu: 0, nwc: 0, breez: 0 };

    // 1. Get Cashu balance from proofs
    try {
      if (proofs.length > 0) {
        newBalances.cashu = WalletService.calculateBalance(proofs);
      }
      console.log(`💰 Cashu balance: ${newBalances.cashu} sats`);
    } catch (e) {
      console.warn("Failed to get Cashu balance:", e);
    }

    // 2. Get NWC balance (if connected)
    if (nwcServiceRef.current && nwcString) {
      try {
        const nwcBal = await nwcServiceRef.current.getBalance();
        newBalances.nwc = nwcBal;
        console.log(`💰 NWC balance: ${newBalances.nwc} sats`);
      } catch (e) {
        console.warn("Failed to get NWC balance:", e);
      }
    }

    // 3. Get Breez balance (if initialized)
    try {
      if (isBreezInitialized()) {
        const breezBal = await getBreezBalance();
        newBalances.breez = breezBal.balanceSats;
        console.log(`⚡ Breez balance: ${newBalances.breez} sats`);
      }
    } catch (e) {
      console.warn("Failed to get Breez balance:", e);
    }

    setWalletBalances(newBalances);

    // Also update the main walletBalance based on current mode
    if (walletMode === 'cashu') {
      setWalletBalance(newBalances.cashu);
    } else if (walletMode === 'nwc') {
      setWalletBalance(newBalances.nwc);
    } else if (walletMode === 'breez') {
      setWalletBalance(newBalances.breez);
    }

    const total = newBalances.cashu + newBalances.nwc + newBalances.breez;
    console.log(`📊 Total balance across all wallets: ${total} sats`);

    setIsBalanceLoading(false);
  }, [walletMode, nwcString, proofs]);

  /**
   * Central handler for incoming payments across wallets.
   * Adds transaction, triggers animation/notification, refreshes balances.
   * @param paymentId - Optional unique payment ID for deduplication (prevents duplicate entries)
   */
  const handleIncomingPayment = useCallback((
    walletType: 'cashu' | 'nwc' | 'breez',
    amount: number,
    description: string,
    paymentId?: string
  ) => {
    if (!amount || amount <= 0) return;

    // Use payment ID for deduplication if provided
    const txId = paymentId ? `${walletType}-${paymentId}` : undefined;

    // Check if we've already animated this payment (prevents race condition duplicates)
    if (txId && animatedPaymentIdsRef.current.has(txId)) {
      console.log(`⚡ [handleIncomingPayment] Already animated payment ${txId}, skipping animation`);
      addTransaction('receive', amount, description, walletType, { id: txId });
      refreshAllBalances();
      return;
    }

    // Mark as animated
    if (txId) {
      animatedPaymentIdsRef.current.add(txId);
      // Clean up after 30 seconds to prevent memory leak
      setTimeout(() => animatedPaymentIdsRef.current.delete(txId), 30000);
    }

    addTransaction('receive', amount, description, walletType, { id: txId });
    setLightningStrike({ amount, show: true });
    // Note: We only set lightningStrike, NOT paymentNotification
    // Setting both would cause double animation (paymentNotification plays after lightningStrike resets)
    refreshAllBalances();
  }, [refreshAllBalances]);

  /**
   * Reconcile Breez payments by syncing, listing payments, and backfilling any
   * missing transactions. Triggers lightning animation for newly detected
   * incoming payments.
   */
  const reconcileBreezPayments = useCallback(async () => {
    if (!isBreezInitialized()) return;

    try {
      await syncBreez();
      const history = await getPaymentHistory();
      if (!history || history.length === 0) return;

      // Track new receives found during reconciliation (only for transactions NOT already processed)
      let latestNewReceive: { amount: number; timestamp: number } | null = null;

      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const toAdd: WalletTransaction[] = [];

        for (const p of history) {
          if (!p) continue;
          if (p.status === 'failed') continue;
          if (!p.amountSats || p.amountSats <= 0) continue;

          const txId = `breez-${p.id}`;
          // Skip if already processed (by event subscription or previous reconciliation)
          if (existingIds.has(txId)) continue;

          // Also skip if this payment was already animated by the event subscription
          // (handles race condition where animation fired but setTransactions hasn't completed)
          if (animatedPaymentIdsRef.current.has(txId)) {
            console.log(`🔄 [Breez Reconciliation] Payment ${txId} already animated, skipping animation`);
            continue;
          }

          // Breez timestamps are in seconds, convert to milliseconds for JS Date
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

          // Only track as "new" receive if it's being added for the first time AND wasn't animated already
          // This prevents double-animation when event subscription already handled it
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

      // Only trigger animation for truly NEW receives (not already processed by event subscription)
      // The event subscription adds transactions with `breez-{id}` format, so if we get here
      // with a new receive, it means it wasn't caught by the realtime subscription
      if (latestNewReceive) {
        console.log(`🔄 [Breez Reconciliation] Found missed payment, showing animation for ${latestNewReceive.amount} sats`);
        setLightningStrike({ amount: latestNewReceive.amount, show: true });
        // Note: We only set lightningStrike, NOT paymentNotification
        // Setting both would cause double animation
        await refreshAllBalances();
      }
    } catch (e) {
      console.warn("Breez reconciliation failed:", e);
    }
  }, [refreshAllBalances]);

  // Run Breez reconciliation on mount and whenever Breez balance changes
  useEffect(() => {
    reconcileBreezPayments();
  }, [walletBalances.breez, reconcileBreezPayments]);

  /**
   * Full reconciliation on app resume/foreground.
   * Syncs Breez, backfills missed payments, and refreshes all balances.
   */
  const reconcileOnResume = useCallback(async () => {
    console.log('🔄 [Resume] Running full wallet reconciliation...');
    try {
      // Refresh all wallet balances first
      await refreshAllBalances();
      // Reconcile Breez payments (sync + diff)
      await reconcileBreezPayments();
      console.log('✅ [Resume] Reconciliation complete');
    } catch (e) {
      console.warn('⚠️ [Resume] Reconciliation error:', e);
    }
  }, [refreshAllBalances, reconcileBreezPayments]);

  const depositFunds = async (amount: number): Promise<{ request: string, quote: string }> => {
    if (walletMode === 'nwc') {
      if (!nwcServiceRef.current) throw new Error("NWC not connected");
      const { invoice, paymentHash } = await nwcServiceRef.current.makeInvoice(amount, "Deposit to NWC Wallet");
      return { request: invoice, quote: paymentHash };
    }

    if (!walletServiceRef.current) throw new Error("Wallet not connected");
    return await walletServiceRef.current.requestDeposit(amount);
  };

  const checkDepositStatus = async (quote: string): Promise<boolean> => {
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

  const confirmDeposit = async (quote: string, amount: number): Promise<boolean> => {
    if (walletMode === 'nwc') {
      // For NWC, if confirmed, we just refresh balance and add tx
      await refreshWalletBalance();
      // Use quote hash for deduplication
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

  const getLightningQuote = async (invoice: string): Promise<{ amount: number, fee: number }> => {
    if (!walletServiceRef.current) throw new Error("Wallet not connected");
    return await walletServiceRef.current.getLightningQuote(invoice);
  };

  const sendFunds = async (amount: number, invoice: string): Promise<boolean> => {
    // Guard: Breez wallet should use its own send functions in Wallet.tsx
    if (walletMode === 'breez') {
      console.error('sendFunds called while in Breez mode - this should use Breez-specific functions');
      throw new Error('Use Breez wallet send functions when in Breez mode');
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
          // Optionally refresh balance anyway just in case
          refreshWalletBalance();
          return false; // Return false so UI doesn't show success immediately, but user is warned
        }
        throw e; // Re-throw other errors
      }
    }

    if (!walletServiceRef.current) return false;
    if (walletBalance < amount) return false;

    // Keep reference to proofs before attempting spend
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

      // Check for keyset mismatch error (mint rotated keys or unit mismatch)
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (errorMsg.includes('different units') || errorMsg.includes('keyset') || errorMsg.includes('unknown keyset')) {
        console.warn("⚠️ Cashu keyset mismatch detected. Clearing invalid proofs.");
        // Clear invalid proofs - the keyset has changed and old proofs are no longer valid
        setProofs([]);
        localStorage.removeItem('cdg_proofs');
        alert("Your Cashu wallet has been reset due to a mint keyset change. Any previous balance has been cleared.");
        return false;
      }

      // RECOVERY: Check if proofs were spent despite the error (False Negative)
      try {
        const validProofs = await walletServiceRef.current.verifyProofs(proofsToSpend);
        const prevBal = WalletService.calculateBalance(proofsToSpend);
        const newBal = WalletService.calculateBalance(validProofs);

        // If balance dropped by at least the amount sent, assume it went through
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

          return true; // Return success to UI
        }
      } catch (recErr) {
        console.error("Recovery failed:", recErr);
      }

      // If not recovered, sync the potentially changed balance and throw
      await refreshWalletBalance();
      throw e;
    }
  };

  const createToken = async (amount: number): Promise<string> => {
    if (!walletServiceRef.current) throw new Error("Wallet not connected");
    if (walletBalance < amount) throw new Error("Insufficient funds");

    // Validate proofs before using them
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

    // Calculate total available amount from valid proofs
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
      // Ensure we throw a proper Error object
      if (e instanceof Error) {
        throw e;
      } else {
        throw new Error(`Token creation failed: ${String(e)}`);
      }
    }
  };

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
      // Note: We only set lightningStrike, NOT paymentNotification
      // Setting both would cause double animation
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

  const resetRound = () => {
    setActiveRound(null);
    setPlayers([]);
    setCurrentHole(1);

    // Clear persisted game state from localStorage
    localStorage.removeItem('cdg_active_round');
    localStorage.removeItem('cdg_players');
    localStorage.removeItem('cdg_current_hole');
  };

  const addMint = (url: string, nickname: string) => {
    setMints(prev => [...prev, { url, nickname, isActive: prev.length === 0 }]);
  };

  const removeMint = (url: string) => {
    setMints(prev => {
      const filtered = prev.filter(m => m.url !== url);
      // Ensure there's always at least one mint (fallback to Minibits if needed)
      if (filtered.length === 0) {
        return [{ url: 'https://mint.minibits.cash/Bitcoin', nickname: 'Minibits', isActive: true }];
      }
      // If we removed the active mint, make the first remaining mint active
      const wasActiveRemoved = prev.find(m => m.url === url)?.isActive;
      if (wasActiveRemoved && !filtered.some(m => m.isActive)) {
        filtered[0].isActive = true;
      }
      return filtered;
    });
  };

  const setActiveMint = (url: string) => {
    setMints(prev => prev.map(m => ({ ...m, isActive: m.url === url })));
  };

  const setWalletModeAction = (mode: 'cashu' | 'nwc' | 'breez') => {
    setWalletMode(mode);
  };

  const setNwcConnection = (uri: string) => {
    setNwcString(uri);
    if (uri) {
      setWalletMode('nwc'); // Auto-switch only if setting a valid string
    }
  };

  return (
    <AppContext.Provider value={{
      walletBalance,
      isBalanceLoading,
      transactions,
      walletMode,
      nwcString,
      activeRound,
      players,
      currentHole,
      userProfile,
      userStats,
      mints,
      proofs,
      recentPlayers,
      contacts,
      isAuthenticated,
      isGuest,
      authMethod,
      currentUserPubkey,
      createRound,
      updateUserProfile,
      updateScore,
      publishCurrentScores,
      setPlayerPaid,
      finalizeRound,
      depositFunds,
      checkDepositStatus,
      confirmDeposit,
      joinRoundAndPay,
      resetRound,
      refreshStats,
      addMint,
      removeMint,
      setActiveMint,
      sendFunds,
      receiveEcash,
      getLightningQuote,
      refreshWalletBalance,
      addRecentPlayer,
      loginNsec,
      loginMnemonic,
      loginNip46,
      loginAmber,
      createAccount,
      createAccountFromMnemonic,
      performLogout,
      isProfileLoading,
      createToken,
      authSource,
      hasUnifiedBackup,
      setWalletMode: setWalletModeAction,
      setNwcConnection,
      checkForPayments,
      paymentNotification,
      setPaymentNotification,
      lightningStrike,
      roundSummary,
      setRoundSummary,
      walletBalances,
      refreshAllBalances,
      setAuthState,
      setUserProfileState,
      setContactsState,
      setRecentPlayersState,
      restoreWalletFromBackup,
      initializeSubscriptions,
      reconcileOnResume
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Helper to generate top-heavy distribution percentages
export function getTopHeavyDistribution(numWinners: number): number[] {
  if (numWinners <= 1) return [1.0];

  // Standard top-heavy distributions for common small player counts
  // Adjusted to be more "loaded at the top"
  const distributions: Record<number, number[]> = {
    2: [0.75, 0.25],                  // Winner takes 3x second place
    3: [0.60, 0.25, 0.15],            // Winner takes >2x second place
    4: [0.50, 0.25, 0.15, 0.10],      // Winner takes half the pot
    5: [0.45, 0.25, 0.15, 0.10, 0.05] // Winner takes nearly half
  };

  if (distributions[numWinners]) {
    return distributions[numWinners];
  }

  // For larger groups, use a steeper decay formula: weight = 1 / (rank + 1)
  // This is steeper than the previous (rank + 1.5)
  let weights = [];
  let totalWeight = 0;
  for (let i = 0; i < numWinners; i++) {
    const weight = 1 / (i + 1.0);
    weights.push(weight);
    totalWeight += weight;
  }

  return weights.map(w => w / totalWeight);
}

// Helper to generate linear (flat but steep) distribution percentages
// This creates a LINEAR gradient rather than exponential, but still favors top positions
export function getLinearDistribution(numWinners: number): number[] {
  if (numWinners <= 1) return [1.0];

  // Linear distribution with steep gradient
  // Each position gets incrementally less, but the decrease is constant (linear)
  // Example for 3 winners: if we use weights [3, 2, 1] then percentages are [50%, 33%, 17%]

  let weights = [];
  let totalWeight = 0;

  for (let i = 0; i < numWinners; i++) {
    // Linear decay: start high and decrease by a constant amount
    // Weight = (numWinners - rank)
    const weight = numWinners - i;
    weights.push(weight);
    totalWeight += weight;
  }

  return weights.map(w => w / totalWeight);
}

// Helper function to calculate payout distribution based on configuration
export function calculatePayouts(
  players: Player[],
  totalPot: number,
  config?: PayoutConfig
): Map<string, number> {
  if (!config || totalPot === 0) {
    // Default: winner takes all
    const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);
    return new Map([[sortedPlayers[0].id, totalPot]]);
  }

  // Sort players by score (ascending - lower is better)
  const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);

  if (config.mode === 'winner-take-all') {
    return new Map([[sortedPlayers[0].id, totalPot]]);
  }

  // Calculate number of winners based on percentage
  const numWinners = Math.max(1, Math.ceil(players.length * ((config.percentageThreshold || 30) / 100)));
  const winners = sortedPlayers.slice(0, numWinners);

  const payouts = new Map<string, number>();

  if (config.gradient === 'top-heavy') {
    const percentages = getTopHeavyDistribution(winners.length);

    // Distribute based on percentages, tracking remainder to avoid rounding loss
    let distributed = 0;
    winners.forEach((player, idx) => {
      if (idx === winners.length - 1) {
        // Last winner gets the remainder
        payouts.set(player.id, totalPot - distributed);
      } else {
        const amount = Math.floor(totalPot * percentages[idx]);
        payouts.set(player.id, amount);
        distributed += amount;
      }
    });
  } else {
    // Linear: Equal distribution
    const amountPerWinner = Math.floor(totalPot / winners.length);
    let distributed = 0;
    winners.forEach((player, idx) => {
      if (idx === winners.length - 1) {
        payouts.set(player.id, totalPot - distributed);
      } else {
        payouts.set(player.id, amountPerWinner);
        distributed += amountPerWinner;
      }
    });
  }

  return payouts;
}
