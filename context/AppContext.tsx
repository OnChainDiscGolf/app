

import { getDecodedToken } from '@cashu/cashu-ts';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Player, RoundSettings, WalletTransaction, UserProfile, UserStats, NOSTR_KIND_SCORE, Mint, DisplayProfile, Proof } from '../types';
import { DEFAULT_HOLE_COUNT } from '../constants';
import { publishProfile, publishRound, publishScore, subscribeToRound, fetchProfile, fetchUserHistory, getSession, loginWithNsec, loginWithNip46, generateNewProfile, logout as nostrLogout, publishWalletBackup, fetchWalletBackup, publishRecentPlayers, fetchRecentPlayers, fetchContactList, fetchProfilesBatch, sendDirectMessage, subscribeToDirectMessages, subscribeToGiftWraps } from '../services/nostrService';
import { WalletService } from '../services/walletService';
import { NWCService } from '../services/nwcService';
import { bytesToHex } from '@noble/hashes/utils';

interface AppContextType extends AppState {
  // Actions
  createRound: (
    settings: Omit<RoundSettings, 'id' | 'isFinalized' | 'pubkey' | 'players' | 'eventId'>,
    selectedPlayers: DisplayProfile[]
  ) => Promise<void>;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  updateScore: (hole: number, score: number, playerId?: string) => void;
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

  // Player Management
  addRecentPlayer: (player: DisplayProfile) => void;

  // Auth Actions
  loginNsec: (nsec: string) => Promise<void>;
  loginNip46: (bunkerUrl: string) => Promise<void>;
  createAccount: () => Promise<void>;
  performLogout: () => void;
  isProfileLoading: boolean;
  createToken: (amount: number) => Promise<string>;

  // NWC Actions
  setWalletMode: (mode: 'cashu' | 'nwc') => void;
  setNwcConnection: (uri: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [authMethod, setAuthMethod] = useState<'local' | 'nip46' | null>(null);
  const [currentUserPubkey, setCurrentUserPubkey] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Wallet & Local State
  const [proofs, setProofs] = useState<Proof[]>(() => {
    const saved = localStorage.getItem('cdg_proofs');
    return saved ? JSON.parse(saved) : [];
  });

  const [walletBalance, setWalletBalance] = useState<number>(0);

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

  // Nostr Data
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Disc Golfer',
    about: '',
    picture: '',
    lud16: '',
    nip05: ''
  });
  const [activeRound, setActiveRound] = useState<RoundSettings | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentHole, setCurrentHole] = useState<number>(1);

  // Stats
  const [userStats, setUserStats] = useState<UserStats>({
    totalRounds: 0,
    totalWins: 0,
    averageScore: 0,
    bestScore: 0,
    totalSatsWon: 0
  });

  // Wallet Mode
  const [walletMode, setWalletMode] = useState<'cashu' | 'nwc'>(() => {
    const savedMode = localStorage.getItem('cdg_wallet_mode') as 'cashu' | 'nwc';
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

  // --- Effects ---

  // Helper to force immediate sync (bypass debounce)
  const syncWallet = useCallback(async (currentProofs: Proof[], currentMints: Mint[], currentTransactions: WalletTransaction[]) => {
    if (isAuthenticated && !isGuest) {
      console.log("Syncing wallet to Nostr...");
      try {
        await publishWalletBackup(currentProofs, currentMints, currentTransactions);
      } catch (e) {
        console.error("Wallet Sync Failed:", e);
      }
    }
  }, [isAuthenticated, isGuest]);

  // Persistence & Auto-Calculation
  useEffect(() => {
    if (walletMode === 'cashu') {
      setWalletBalance(WalletService.calculateBalance(proofs));
    }
    localStorage.setItem('cdg_proofs', JSON.stringify(proofs));
  }, [proofs, mints, walletMode]);

  useEffect(() => localStorage.setItem('cdg_txs', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('cdg_mints', JSON.stringify(mints)), [mints]);
  useEffect(() => localStorage.setItem('cdg_recent_players', JSON.stringify(recentPlayers)), [recentPlayers]);

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
    setWalletBalance(0); // Clear balance to prevent stale data during switch
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
      let guestMode = localStorage.getItem('is_guest_mode') === 'true';

      // Auto-create Guest Account if no session exists
      if (!session) {
        const newIdentity = generateNewProfile();
        session = { method: 'local', pk: newIdentity.pk, sk: newIdentity.sk };
        guestMode = true;
        localStorage.setItem('is_guest_mode', 'true');
      }

      if (session) {
        setCurrentUserPubkey(session.pk);
        setAuthMethod(session.method);
        setIsAuthenticated(true);
        setIsGuest(guestMode);

        if (guestMode) {
          setUserProfile({ name: 'Guest Golfer', about: 'Unclaimed account', picture: '', lud16: '', nip05: '' });
        }
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

      // 1. Fetch Profile
      fetchProfile(currentUserPubkey).then(profile => {
        if (profile) {
          console.log("Profile loaded:", profile);
          setUserProfile(profile);
        } else {
          setUserProfile(prev => ({ ...prev, name: 'Nostr User', picture: '', lud16: '', nip05: '' }));
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
      fetchWalletBackup(currentUserPubkey).then(backup => {
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
        } else {
          console.log("No wallet backup found. Creating initial backup if funds exist.");
          // If user has local funds (from guest mode) but no remote backup, back them up now
          setProofs(current => {
            if (current.length > 0) {
              console.log("Skipping auto-backup on first load to avoid overwriting history.");
            }
            return current;
          });
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
                  addTransaction('receive', 0, 'Received via Lightning Bridge', 'cashu'); // Amount will be updated by receiveEcash logic if we tracked it better, but for now this logs the event. 
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


  // --- Actions ---

  const loginNsec = async (nsec: string) => {
    const { pk } = loginWithNsec(nsec);
    setUserProfile({ name: 'Loading...', about: '', picture: '', lud16: '', nip05: '' });
    setCurrentUserPubkey(pk);
    setAuthMethod('local');
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
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

  const createAccount = async () => {
    const { pk } = generateNewProfile();
    setCurrentUserPubkey(pk);
    setAuthMethod('local');
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
    setUserProfile({ name: 'Disc Golfer', about: '', picture: '', lud16: '', nip05: '' });
  };

  const performLogout = () => {
    // 1. Clear authenticated user data from storage
    nostrLogout();

    localStorage.removeItem('cdg_user_private_key');
    localStorage.removeItem('cdg_user_public_key');
    localStorage.removeItem('cdg_auth_method');
    localStorage.removeItem('cdg_wallet_mode');
    localStorage.removeItem('cdg_nwc_string');

    setIsAuthenticated(false);
    setAuthMethod(null);
    setCurrentUserPubkey('');
    setUserProfile({ name: 'Guest', picture: '' });

    // Reset Wallet Mode
    setWalletMode('cashu');
    setNwcString('');
    if (nwcServiceRef.current) {
      nwcServiceRef.current = null;
    }

    // Clear recent players if desired, or keep them. 
    // For now we keep them as they might be useful for re-login.

    // 2. Clear sensitive app state from memory
    setProofs([]);
    setTransactions([]);
    setRecentPlayers([]);
    setContacts([]);
    setActiveRound(null);

    // 3. Generate a new Guest Identity immediately
    const newIdentity = generateNewProfile();

    // 4. Update State to Guest Mode
    setCurrentUserPubkey(newIdentity.pk);
    setAuthMethod('local');
    setIsAuthenticated(true); // Guest is technically authenticated with ephemeral keys
    setIsGuest(true);
    localStorage.setItem('is_guest_mode', 'true');

    // 5. Reset Profile UI
    setUserProfile({ name: 'Guest Golfer', about: 'Unclaimed account', picture: '', lud16: '', nip05: '' });
  };

  const addRecentPlayer = (player: DisplayProfile) => {
    setRecentPlayers(prev => {
      // Remove if existing to bring to top
      const filtered = prev.filter(p => p.pubkey !== player.pubkey);
      return [player, ...filtered].slice(0, 20); // Keep last 20
    });
  };

  const addTransaction = (type: WalletTransaction['type'], amount: number, description: string, walletType?: 'cashu' | 'nwc') => {
    const tx: WalletTransaction = {
      id: Date.now().toString(),
      type,
      amountSats: amount,
      description,
      timestamp: Date.now(),
      walletType: walletType || walletMode // Default to current mode if not specified
    };
    setTransactions(prev => [tx, ...prev]);
  };

  const refreshStats = async () => {
    if (!currentUserPubkey) return;
    try {
      const history = await fetchUserHistory(currentUserPubkey);
      if (history && history.length > 0) {
        let totalScoreSum = 0;
        let best = 999;
        history.forEach(evt => {
          try {
            const c = JSON.parse(evt.content);
            const score = c.totalScore || 0;
            totalScoreSum += score;
            if (score < best && score > 0) best = score;
          } catch (e) { }
        });

        // Calculate Total Sats Won from Transactions
        const wonTxs = transactions.filter(t => t.type === 'payout' || t.type === 'ace_pot');
        const totalWon = wonTxs.reduce((sum, t) => sum + t.amountSats, 0);

        setUserStats({
          totalRounds: history.length,
          totalWins: 0,
          averageScore: Math.round(totalScoreSum / history.length),
          bestScore: best === 999 ? 0 : best,
          totalSatsWon: totalWon
        });
      }
    } catch (e) {
      console.warn("Could not fetch user stats:", e);
    }
  };

  const updateUserProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    try {
      await publishProfile(profile);
    } catch (e) {
      console.warn("Failed to publish profile:", e);
    }
  };

  const createRound = async (
    settings: Omit<RoundSettings, 'id' | 'isFinalized' | 'pubkey' | 'players' | 'eventId'>,
    selectedPlayers: DisplayProfile[]
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
      hideOverallScore: settings.hideOverallScore || false
    };

    setActiveRound(newRound);

    // Add self as player (Host presumed paid)
    const initialPlayers: Player[] = [{
      id: currentUserPubkey,
      name: userProfile.name,
      handicap: 0,
      paid: true,
      scores: {},
      totalScore: 0,
      isCurrentUser: true,
      lightningAddress: userProfile.lud16,
      photoUrl: userProfile.picture
    }];

    // Add other invited players
    selectedPlayers.forEach(p => {
      addRecentPlayer(p);
      initialPlayers.push({
        id: p.pubkey,
        name: p.name,
        handicap: 0,
        paid: !!p.paid, // Use passed paid status
        scores: {},
        totalScore: 0,
        isCurrentUser: false,
        lightningAddress: p.nip05,
        photoUrl: p.image
      });
    });

    setPlayers(initialPlayers);

    try {
      await publishRound(newRound);
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

      if (p.isCurrentUser && activeRound) {
        publishScore(activeRound.id, newScores, total).catch(e => console.warn("Score sync failed", e));
      }

      return { ...p, scores: newScores, totalScore: total };
    }));
  }, [activeRound, currentUserPubkey]);

  // Set player paid status manually
  const setPlayerPaid = useCallback((playerId: string) => {
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, paid: true } : p
    ));
  }, []);

  const finalizeRound = async () => {
    if (!activeRound) return;

    const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);
    const winner = sortedPlayers[0];
    const potSize = activeRound.entryFeeSats * players.length; // Simplified pot
    const prize = Math.floor(potSize * 0.8); // 80% payout example

    if (prize > 0) {
      if (winner.isCurrentUser) {
        // I won, I keep the pot (which I already hold as host)
        addTransaction('payout', prize, `Won Round: ${activeRound.name}`);
      } else {
        // Someone else won, pay them
        try {
          const token = await createToken(prize);
          await sendDirectMessage(winner.id, `You won ${activeRound.name}! Here is your prize: ${token}`);
          addTransaction('payout', prize, `Payout to ${winner.name}`);
        } catch (e) {
          console.error("Failed to pay winner", e);
          alert("Failed to pay winner. Please pay manually.");
        }
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
    refreshStats();
  };

  // --- Wallet Actions ---

  const refreshWalletBalance = async () => {
    if (walletMode === 'nwc') {
      if (nwcServiceRef.current) {
        try {
          const bal = await nwcServiceRef.current.getBalance();
          setWalletBalance(bal);
        } catch (e) {
          console.error("NWC Balance fetch failed", e);
        }
      }
      return;
    }

    // Cashu Logic
    if (!walletServiceRef.current || proofs.length === 0) return;
    try {
      console.log("Verifying wallet proofs...");
      const validProofs = await walletServiceRef.current.verifyProofs(proofs);

      if (validProofs.length !== proofs.length) {
        console.log(`Found spent proofs.Updating balance. (${proofs.length} -> ${validProofs.length})`);
        setProofs(validProofs);
        syncWallet(validProofs, mints, transactions); // Sync the corrected state
      } else {
        console.log("All proofs valid.");
      }
    } catch (e) {
      console.error("Wallet refresh failed:", e);
    }
  };

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
      addTransaction('receive', amount, 'Received via NWC');
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

    try {
      const { token, remaining } = await walletServiceRef.current.createTokenWithProofs(amount, proofs);
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
      throw e;
    }
  };

  const receiveEcash = async (token: string): Promise<boolean> => {
    if (!walletServiceRef.current) return false;
    try {
      const newProofs = await walletServiceRef.current.receiveToken(token);
      const updatedProofs = [...proofs, ...newProofs];
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
  };

  const addMint = (url: string, nickname: string) => {
    setMints(prev => [...prev, { url, nickname, isActive: prev.length === 0 }]);
  };

  const removeMint = (url: string) => {
    setMints(prev => prev.filter(m => m.url !== url));
  };

  const setActiveMint = (url: string) => {
    setMints(prev => prev.map(m => ({ ...m, isActive: m.url === url })));
  };

  const setWalletModeAction = (mode: 'cashu' | 'nwc') => {
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
      loginNip46,
      createAccount,
      performLogout,
      isProfileLoading,
      createToken,
      setWalletMode: setWalletModeAction,
      setNwcConnection
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
