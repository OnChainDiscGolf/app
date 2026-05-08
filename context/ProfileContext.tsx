/**
 * @file ProfileContext.tsx
 * @description Manages the authenticated user's Nostr profile (Kind 0), gameplay statistics,
 * contact list (Kind 3), and recent players list (Kind 30078).
 *
 * On login, fetches the user's profile from Nostr relays (with localStorage fallback),
 * loads the contact list, restores recent players from a Nostr backup, and computes
 * aggregate stats from round history.
 *
 * @architecture Depends on AuthContext for `currentUserPubkey` and `isGuest`.
 * Exposes raw state setters so AppContext can perform cross-cutting profile updates
 * during account creation, onboarding finalization, and logout.
 *
 * **Effects:**
 * - Effect 1: Persist recent players to localStorage
 * - Effect 2: Auto-sync recent players to Nostr (debounced 2s)
 * - Effect 3: Fetch profile, contacts, and recent players on login
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserStats, DisplayProfile } from '../types';
import { publishProfile, fetchProfile, fetchUserHistory, fetchRecentPlayers, fetchContactList, fetchProfilesBatch, publishRecentPlayers, getMagicLightningAddress } from '../services/nostrService';
import { useAuth } from './AuthContext';

export interface ProfileContextType {
  userProfile: UserProfile;
  userStats: UserStats;
  recentPlayers: DisplayProfile[];
  contacts: DisplayProfile[];
  isProfileLoading: boolean;

  updateUserProfile: (profile: UserProfile) => Promise<void>;
  refreshStats: () => void;
  addRecentPlayer: (player: DisplayProfile) => void;

  // State setters for finalization/cross-cutting
  setUserProfileState: (profile: UserProfile) => void;
  setContactsState: (contacts: DisplayProfile[]) => void;
  setRecentPlayersState: (players: DisplayProfile[]) => void;

  // Raw setters for cross-cutting (logout reset)
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  setRecentPlayers: React.Dispatch<React.SetStateAction<DisplayProfile[]>>;
  setContacts: React.Dispatch<React.SetStateAction<DisplayProfile[]>>;

  initializeSubscriptions: (pubkey: string) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

/**
 * ProfileProvider - Manages user profile, stats, contacts, and recent players.
 *
 * **State managed:**
 * - `userProfile` - Nostr Kind 0 metadata (name, about, picture, lud16, nip05)
 * - `userStats` - Aggregated gameplay statistics (rounds, wins, aces, sats won/paid)
 * - `recentPlayers` - List of recently played-with users (up to 50)
 * - `contacts` - User's Nostr Kind 3 contact list with resolved profiles
 * - `isProfileLoading` - Loading state during initial profile fetch
 *
 * **Exposed actions:**
 * - `updateUserProfile(profile)` - Save profile locally and publish to Nostr
 * - `refreshStats()` - Recalculate stats from round history and transaction log
 * - `addRecentPlayer(player)` - Add/promote a player in the recent players list
 * - `initializeSubscriptions(pubkey)` - Log Lightning address on finalization
 * - State setters for cross-cutting operations in AppContext
 */
export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isGuest, currentUserPubkey } = useAuth();

  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('cdg_user_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.warn("Failed to parse saved profile", e); }
    }
    return { name: 'Disc Golfer', about: '', picture: '', lud16: '', nip05: '' };
  });

  const [userStats, setUserStats] = useState<UserStats>({
    totalRounds: 0, totalWins: 0, averageScore: 0, bestScore: 0, totalSatsWon: 0,
    totalAces: 0, totalBirdies: 0, bogeyFreeRounds: 0, biggestWinStreak: 0, totalSatsPaid: 0, biggestWin: 0,
  });

  const [recentPlayers, setRecentPlayers] = useState<DisplayProfile[]>(() => {
    const saved = localStorage.getItem('cdg_recent_players');
    return saved ? JSON.parse(saved) : [];
  });

  const [contacts, setContacts] = useState<DisplayProfile[]>([]);

  // === Effect 1: Persist Recent Players to localStorage ===
  // Keeps the local recent players cache in sync with state changes.
  useEffect(() => {
    localStorage.setItem('cdg_recent_players', JSON.stringify(recentPlayers));
  }, [recentPlayers]);

  // === Effect 2: Auto-Sync Recent Players to Nostr (Debounced 2s) ===
  // Publishes the recent players list to Nostr as a Kind 30078 event after a 2-second
  // debounce. Skipped during initial profile loading to avoid overwriting remote data
  // before it's been fetched and merged.
  useEffect(() => {
    if (isAuthenticated && !isGuest && !isProfileLoading && recentPlayers.length > 0) {
      const timer = setTimeout(() => {
        publishRecentPlayers(recentPlayers).catch(console.warn);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [recentPlayers, isAuthenticated, isGuest, isProfileLoading]);

  /**
   * Recalculates user stats by fetching round history from Nostr and reading
   * transactions from localStorage. Computes totals for rounds, wins, aces,
   * birdies, bogey-free rounds, sats won/paid, and best score.
   */
  const refreshStats = useCallback(async () => {
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
            let hasBogey = false;
            Object.values(scores).forEach((holeScore: any) => {
              if (holeScore === 1) totalAces++;
              if (holeScore === 2) totalBirdies++;
              if (holeScore >= 4) hasBogey = true;
            });
            if (!hasBogey && Object.keys(scores).length > 0) bogeyFreeRounds++;
          } catch (e) {
            console.warn('Failed to parse round history event:', e);
          }
        });

        // Read transactions from localStorage
        const savedTxs = localStorage.getItem('cdg_txs');
        const transactions = savedTxs ? JSON.parse(savedTxs) : [];
        const wonTxs = transactions.filter((t: any) => t.type === 'payout' || t.type === 'ace_pot');
        const paidTxs = transactions.filter((t: any) => t.type === 'payment');
        const totalWon = wonTxs.reduce((sum: number, t: any) => sum + t.amountSats, 0);
        const totalPaid = paidTxs.reduce((sum: number, t: any) => sum + t.amountSats, 0);
        const biggestWin = wonTxs.length > 0 ? Math.max(...wonTxs.map((t: any) => t.amountSats)) : 0;
        const biggestWinStreak = wonTxs.length > 0 ? 1 : 0;

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
  }, [currentUserPubkey]);

  // === Effect 3: Fetch Profile, Contacts, and Recent Players on Login ===
  // Triggered when `currentUserPubkey` changes (login/logout). Fetches the user's
  // Kind 0 profile from Nostr (falls back to localStorage), loads the Kind 3 contact
  // list with batch profile resolution, and restores remote recent players with
  // deduplication against local cache.
  useEffect(() => {
    if (currentUserPubkey && !isGuest) {
      setIsProfileLoading(true);

      const lightningAddress = getMagicLightningAddress(currentUserPubkey);
      console.log(`⚡ Your Lightning Address: ${lightningAddress}`);
      console.log(`📡 Your Pubkey: ${currentUserPubkey}`);

      // Fetch Profile
      fetchProfile(currentUserPubkey).then(profile => {
        if (profile) {
          console.log("Profile loaded from Nostr:", profile);
          setUserProfile(profile);
          localStorage.setItem('cdg_user_profile', JSON.stringify(profile));
        } else {
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

      // Fetch Contacts
      fetchContactList(currentUserPubkey).then(async (contactPubkeys) => {
        if (contactPubkeys.length > 0) {
          console.log(`Found ${contactPubkeys.length} contacts. Fetching profiles...`);
          const profiles = await fetchProfilesBatch(contactPubkeys);
          setContacts(profiles.sort((a, b) => a.name.localeCompare(b.name)));
        }
      }).catch(e => console.warn("Contacts fetch failed", e));

      // Fetch Recent Players
      fetchRecentPlayers(currentUserPubkey).then(remotePlayers => {
        if (remotePlayers && remotePlayers.length > 0) {
          console.log("Restoring recent players...");
          setRecentPlayers(prev => {
            const existingPubkeys = new Set(prev.map(p => p.pubkey));
            const uniqueRemote = remotePlayers.filter(p => !existingPubkeys.has(p.pubkey));
            return [...uniqueRemote, ...prev].slice(0, 50);
          });
        }
      }).catch(e => console.warn("Recent players restore failed:", e));
    }
  }, [currentUserPubkey, isGuest]);

  /**
   * Update the user's profile locally and publish to Nostr relays.
   * @param {UserProfile} profile - Updated profile data (name, about, picture, lud16, nip05)
   */
  const updateUserProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('cdg_user_profile', JSON.stringify(profile));
    try {
      await publishProfile(profile);
    } catch (e) {
      console.warn("Failed to publish profile:", e);
    }
  };

  /**
   * Add or promote a player to the top of the recent players list.
   * Deduplicates by pubkey and caps the list at 20 entries.
   * @param {DisplayProfile} player - Player to add/promote
   */
  const addRecentPlayer = (player: DisplayProfile) => {
    setRecentPlayers(prev => {
      const filtered = prev.filter(p => p.pubkey !== player.pubkey);
      return [player, ...filtered].slice(0, 20);
    });
  };

  /**
   * Set user profile state and persist to localStorage.
   * Used by AppContext during onboarding finalization.
   * @param {UserProfile} profile - Profile data to set
   */
  const setUserProfileState = useCallback((profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('cdg_user_profile', JSON.stringify(profile));
  }, []);

  /**
   * Set contacts state with alphabetical sorting. Used by AppContext.
   * @param {DisplayProfile[]} newContacts - Contacts to set
   */
  const setContactsState = useCallback((newContacts: DisplayProfile[]) => {
    setContacts(newContacts.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  /**
   * Merge new players into the recent players list with deduplication.
   * Caps at 50 entries. Used by AppContext during finalization.
   * @param {DisplayProfile[]} newPlayers - Players to merge in
   */
  const setRecentPlayersState = useCallback((newPlayers: DisplayProfile[]) => {
    setRecentPlayers(prev => {
      const existingPubkeys = new Set(prev.map(p => p.pubkey));
      const uniqueNew = newPlayers.filter(p => !existingPubkeys.has(p.pubkey));
      return [...uniqueNew, ...prev].slice(0, 50);
    });
  }, []);

  /**
   * Log Lightning address and pubkey on subscription initialization.
   * Actual subscriptions are handled by existing effects keyed on currentUserPubkey.
   * @param {string} pubkey - User's public key to initialize for
   */
  const initializeSubscriptions = useCallback((pubkey: string) => {
    const lightningAddress = getMagicLightningAddress(pubkey);
    console.log(`⚡ Your Lightning Address: ${lightningAddress}`);
    console.log(`📡 Your Pubkey: ${pubkey}`);
    console.log('🔄 [Finalization] Subscriptions will be initialized by existing effects');
  }, []);

  const value: ProfileContextType = {
    userProfile,
    userStats,
    recentPlayers,
    contacts,
    isProfileLoading,

    updateUserProfile,
    refreshStats,
    addRecentPlayer,

    setUserProfileState,
    setContactsState,
    setRecentPlayersState,

    setUserProfile,
    setRecentPlayers,
    setContacts,

    initializeSubscriptions,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

/**
 * Hook to access user profile, stats, contacts, and recent players.
 * @returns {ProfileContextType} Profile state and actions.
 * @throws {Error} If called outside of ProfileProvider.
 */
export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
