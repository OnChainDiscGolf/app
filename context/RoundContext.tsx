import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Player, RoundSettings } from '../types';
import { DEFAULT_HOLE_COUNT } from '../constants';
import { publishRound, publishScore, subscribeToRound, subscribeToPlayerRounds, fetchProfile } from '../services/nostrService';
import { useAuth } from './AuthContext';

export interface RoundContextType {
  activeRound: RoundSettings | null;
  players: Player[];
  currentHole: number;

  updateScore: (hole: number, score: number, playerId?: string) => void;
  publishCurrentScores: () => Promise<void>;
  setPlayerPaid: (playerId: string) => void;
  resetRound: () => void;

  // Raw setters for cross-cutting actions (createRound, finalizeRound, joinRound in composition layer)
  setActiveRound: React.Dispatch<React.SetStateAction<RoundSettings | null>>;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  setCurrentHole: React.Dispatch<React.SetStateAction<number>>;
}

const RoundContext = createContext<RoundContextType | undefined>(undefined);

export const RoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUserPubkey, isAuthenticated } = useAuth();

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

  const subRef = useRef<any>(null);

  // Persist active round
  useEffect(() => {
    if (activeRound) {
      localStorage.setItem('cdg_active_round', JSON.stringify(activeRound));
    } else {
      localStorage.removeItem('cdg_active_round');
    }
  }, [activeRound]);

  // Persist players
  useEffect(() => {
    localStorage.setItem('cdg_players', JSON.stringify(players));
  }, [players]);

  // Persist current hole
  useEffect(() => {
    localStorage.setItem('cdg_current_hole', currentHole.toString());
  }, [currentHole]);

  // Active Round Syncing (subscribe to scores for active round)
  useEffect(() => {
    if (activeRound && !activeRound.isFinalized) {
      if (activeRound.startingHole) {
        setCurrentHole(activeRound.startingHole);
      }

      if (subRef.current) subRef.current.close();

      try {
        subRef.current = subscribeToRound(activeRound.id, async (event) => {
          const playerPubkey = event.pubkey;
          const content = JSON.parse(event.content);

          setPlayers(prev => {
            const exists = prev.find(p => p.id === playerPubkey);

            if (exists) {
              return prev.map(p => p.id === playerPubkey ? {
                ...p,
                scores: content.scores,
                totalScore: content.totalScore
              } : p);
            } else {
              fetchProfile(playerPubkey).then(prof => {
                setPlayers(curr => curr.map(p => p.id === playerPubkey ? { ...p, name: prof?.name || 'Unknown', lightningAddress: prof?.lud16, photoUrl: prof?.picture } : p));
              }).catch(() => { });

              return [...prev, {
                id: playerPubkey,
                name: 'Loading...',
                handicap: 0,
                paid: true,
                paysEntry: true,
                paysAce: true,
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

  // Listen for Rounds where user is tagged (Remote Round Notification)
  useEffect(() => {
    if (isAuthenticated && currentUserPubkey) {
      const sub = subscribeToPlayerRounds(currentUserPubkey, async (event) => {
        console.log("Found a round I am tagged in!", event);
        try {
          const content = JSON.parse(event.content);
          const roundId = event.tags.find(t => t[0] === 'd')?.[1];

          if (!roundId) return;
          if (activeRound && activeRound.id === roundId) return;
          if (event.pubkey === currentUserPubkey) return;

          console.log("Auto-joining remote round:", content.name);

          const joinedRound: RoundSettings = {
            id: roundId,
            name: content.name || 'Joined Round',
            courseName: content.courseName || 'Unknown Course',
            entryFeeSats: content.entryFeeSats || 0,
            acePotFeeSats: content.acePotFeeSats || 0,
            date: content.date || new Date().toISOString(),
            isFinalized: content.isFinalized || false,
            holeCount: content.holeCount || 18,
            players: [],
            pubkey: event.pubkey,
            eventId: event.id,
            startingHole: 1,
            trackPenalties: false,
            hideOverallScore: false,
            par: content.par || 54
          };

          setActiveRound(joinedRound);
        } catch (e) {
          console.warn("Failed to parse remote round:", e);
        }
      });

      return () => sub.close();
    }
  }, [isAuthenticated, currentUserPubkey, activeRound]);

  // Listen for eCash payments from players (custom event from WalletContext)
  useEffect(() => {
    const handleEcashFromPlayer = (e: CustomEvent) => {
      const playerPubkey = e.detail?.pubkey;
      if (playerPubkey && activeRound && !activeRound.isFinalized) {
        setPlayers(prev => prev.map(p =>
          p.id === playerPubkey ? { ...p, paid: true } : p
        ));
      }
    };

    window.addEventListener('ecash-received-from-player', handleEcashFromPlayer as EventListener);
    return () => window.removeEventListener('ecash-received-from-player', handleEcashFromPlayer as EventListener);
  }, [activeRound]);

  // Actions
  const updateScore = useCallback((hole: number, score: number, playerId?: string) => {
    const targetId = playerId || currentUserPubkey;
    setPlayers(prev => prev.map(p => {
      if (p.id !== targetId) return p;
      const newScores = { ...p.scores, [hole]: score };
      const total = (Object.values(newScores) as number[]).reduce((sum, s) => sum + s, 0);
      return { ...p, scores: newScores, totalScore: total };
    }));
  }, [currentUserPubkey]);

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

  const setPlayerPaid = useCallback((playerId: string) => {
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, paid: true } : p
    ));
  }, []);

  const resetRound = () => {
    setActiveRound(null);
    setPlayers([]);
    setCurrentHole(1);
    localStorage.removeItem('cdg_active_round');
    localStorage.removeItem('cdg_players');
    localStorage.removeItem('cdg_current_hole');
  };

  const value: RoundContextType = {
    activeRound,
    players,
    currentHole,
    updateScore,
    publishCurrentScores,
    setPlayerPaid,
    resetRound,
    setActiveRound,
    setPlayers,
    setCurrentHole,
  };

  return (
    <RoundContext.Provider value={value}>
      {children}
    </RoundContext.Provider>
  );
};

export const useRound = (): RoundContextType => {
  const context = useContext(RoundContext);
  if (!context) {
    throw new Error('useRound must be used within a RoundProvider');
  }
  return context;
};
