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

  // Persist recent players to localStorage
  useEffect(() => {
    localStorage.setItem('cdg_recent_players', JSON.stringify(recentPlayers));
  }, [recentPlayers]);

  // Auto-sync recent players to Nostr (debounced 2s)
  useEffect(() => {
    if (isAuthenticated && !isGuest && !isProfileLoading && recentPlayers.length > 0) {
      const timer = setTimeout(() => {
        publishRecentPlayers(recentPlayers).catch(console.warn);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [recentPlayers, isAuthenticated, isGuest, isProfileLoading]);

  // refreshStats - reads transactions from localStorage
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
          } catch (e) { }
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

  // Fetch profile, contacts, recent players on login
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

  const updateUserProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('cdg_user_profile', JSON.stringify(profile));
    try {
      await publishProfile(profile);
    } catch (e) {
      console.warn("Failed to publish profile:", e);
    }
  };

  const addRecentPlayer = (player: DisplayProfile) => {
    setRecentPlayers(prev => {
      const filtered = prev.filter(p => p.pubkey !== player.pubkey);
      return [player, ...filtered].slice(0, 20);
    });
  };

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

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
