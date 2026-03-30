/**
 * @file TournamentContext.tsx
 * @description Manages multi-card tournament state, live leaderboard computation,
 * card assignments, and real-time Nostr subscriptions for tournament score updates.
 *
 * A tournament consists of multiple "cards" (groups of players), each of which is
 * a standard Kind 30001 round event. This context subscribes to score events across
 * all cards simultaneously via a single Nostr filter and computes a unified leaderboard
 * with position, tie handling, and to-par calculations.
 *
 * Tournament phases: registration -> active -> finalized
 *
 * Card assignment modes: director-assigns (manual), random (Fisher-Yates shuffle),
 * player's-choice (self-select).
 *
 * @architecture Depends on AuthContext for `currentUserPubkey` (to determine isDirector).
 * Tournament creation, starting, joining, and finalization are cross-cutting actions
 * in AppContext. This context manages runtime state and Nostr subscriptions.
 *
 * **Effects:**
 * - Effect 1: Persist active tournament to localStorage
 * - Effect 2: Subscribe to all card scores when tournament is active
 * - Effect 3: Subscribe to tournament event updates (phase changes from director)
 * - Effect 4: Listen for eCash payments (registration fees)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TournamentSettings, TournamentCard, TournamentStanding } from '../types';
import { publishTournament, subscribeTournament, subscribeToTournamentScores, fetchProfile } from '../services/nostrService';
import { useAuth } from './AuthContext';

export interface TournamentContextType {
  activeTournament: TournamentSettings | null;
  standings: TournamentStanding[];
  isDirector: boolean;

  // Card assignment
  updateCardAssignment: (cardId: string, playerPubkey: string) => void;
  removeFromCard: (cardId: string, playerPubkey: string) => void;
  randomizeCards: () => void;

  // Registration
  addRegisteredPlayer: (pubkey: string) => void;

  // Raw setters for cross-cutting actions in AppContext
  setActiveTournament: React.Dispatch<React.SetStateAction<TournamentSettings | null>>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

/**
 * Fisher-Yates (Knuth) shuffle for fair random card assignment.
 * @template T
 * @param {T[]} arr - Array to shuffle
 * @returns {T[]} A new shuffled copy of the array
 */
const shuffleArray = <T,>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * TournamentProvider - Manages tournament state, card assignments, live leaderboard, and Nostr sync.
 *
 * **State managed:**
 * - `activeTournament` - Current tournament settings, cards, registered players, phase
 * - `standings` - Live leaderboard computed from accumulated score events
 * - `isDirector` - Whether the current user created (directs) this tournament
 *
 * **Internal refs (not exposed):**
 * - `scoreMapRef` - Accumulates scores per player pubkey -> { scores, totalScore, cardId }
 * - `profileMapRef` - Cached player profiles for leaderboard display
 *
 * **Exposed actions:**
 * - `updateCardAssignment(cardId, pubkey)` - Move a player to a card (director only)
 * - `removeFromCard(cardId, pubkey)` - Remove a player from a card
 * - `randomizeCards()` - Fisher-Yates shuffle players across cards
 * - `addRegisteredPlayer(pubkey)` - Add a player to the registration list
 * - `setActiveTournament` - Raw setter for cross-cutting actions in AppContext
 */
export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUserPubkey } = useAuth();

  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(() => {
    const saved = localStorage.getItem('cdg_active_tournament');
    return saved ? JSON.parse(saved) : null;
  });

  const [standings, setStandings] = useState<TournamentStanding[]>([]);

  // Score accumulator: pubkey -> { scores, totalScore, cardId }
  const scoreMapRef = useRef<Map<string, { scores: Record<number, number>; totalScore: number; cardId: string }>>(new Map());
  // Player profiles: pubkey -> { name, photoUrl }
  const profileMapRef = useRef<Map<string, { name: string; photoUrl?: string }>>(new Map());

  const scoreSubRef = useRef<any>(null);
  const tournamentSubRef = useRef<any>(null);

  const isDirector = !!(activeTournament && currentUserPubkey && activeTournament.pubkey === currentUserPubkey);

  // === Effect 1: Persist Active Tournament to localStorage ===
  // Saves or removes the active tournament for crash recovery.
  useEffect(() => {
    if (activeTournament) {
      localStorage.setItem('cdg_active_tournament', JSON.stringify(activeTournament));
    } else {
      localStorage.removeItem('cdg_active_tournament');
    }
  }, [activeTournament]);

  /**
   * Build a lookup map from roundId to card metadata.
   * Each card's id IS the roundId for its Kind 30001 event.
   * @returns {Map<string, { cardId: string; cardName: string }>} Round-to-card lookup
   */
  const getCardLookup = useCallback((): Map<string, { cardId: string; cardName: string }> => {
    const lookup = new Map<string, { cardId: string; cardName: string }>();
    if (!activeTournament) return lookup;
    for (const card of activeTournament.cards) {
      // Card id IS the roundId
      lookup.set(card.id, { cardId: card.id, cardName: card.name });
    }
    return lookup;
  }, [activeTournament]);

  /**
   * Compute tournament standings from the accumulated score map.
   * Calculates to-par, thru (holes completed), and assigns positions with tie handling.
   * Sorting: lowest totalScore first; tiebreak by holes completed (more = ranked higher).
   */
  const computeStandings = useCallback(() => {
    if (!activeTournament) return;

    const cardLookup = getCardLookup();
    const holeCount = activeTournament.holeCount;
    const par = activeTournament.par;
    const parPerHole = par / holeCount;

    const rawStandings: TournamentStanding[] = [];

    scoreMapRef.current.forEach((data, pubkey) => {
      const profile = profileMapRef.current.get(pubkey);
      const cardInfo = cardLookup.get(data.cardId);

      const thru = Object.keys(data.scores).filter(k => data.scores[parseInt(k)] > 0).length;
      const isFinished = thru >= holeCount;
      // Calculate to-par based on holes played
      const expectedPar = Math.round(thru * parPerHole);
      const toPar = data.totalScore > 0 ? data.totalScore - expectedPar : 0;

      rawStandings.push({
        position: 0,
        isTied: false,
        pubkey,
        name: profile?.name || 'Unknown',
        photoUrl: profile?.photoUrl,
        cardId: data.cardId,
        cardName: cardInfo?.cardName || '?',
        scores: data.scores,
        totalScore: data.totalScore,
        toPar,
        thru: isFinished ? -1 : thru, // -1 signals "F" (finished)
        isCurrentUser: pubkey === currentUserPubkey,
      });
    });

    // Sort: finished players first (thru === -1), then by totalScore ascending
    // Among unfinished: lower toPar is better
    rawStandings.sort((a, b) => {
      // Both finished: sort by totalScore
      if (a.thru === -1 && b.thru === -1) return a.totalScore - b.totalScore;
      // Finished beats unfinished with same or better score? Just sort by toPar then totalScore
      if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
      // Tiebreak by thru (more holes played = ranked higher among same score)
      const aThru = a.thru === -1 ? holeCount : a.thru;
      const bThru = b.thru === -1 ? holeCount : b.thru;
      return bThru - aThru;
    });

    // Assign positions with tie handling
    for (let i = 0; i < rawStandings.length; i++) {
      if (i === 0) {
        rawStandings[i].position = 1;
        rawStandings[i].isTied = false;
      } else {
        const prev = rawStandings[i - 1];
        if (rawStandings[i].totalScore === prev.totalScore && rawStandings[i].thru === prev.thru) {
          rawStandings[i].position = prev.position;
          rawStandings[i].isTied = true;
          prev.isTied = true;
        } else {
          rawStandings[i].position = i + 1;
          rawStandings[i].isTied = false;
        }
      }
    }

    setStandings(rawStandings);
  }, [activeTournament, currentUserPubkey, getCardLookup]);

  // === Effect 2: Subscribe to All Card Scores (Active Tournament) ===
  // When the tournament enters 'active' phase, subscribes to score events across all cards
  // via a single Nostr filter on the card round IDs. Each incoming score event updates the
  // score accumulator, resolves player profiles (lazy), and recomputes standings.
  useEffect(() => {
    if (!activeTournament || activeTournament.phase !== 'active') {
      if (scoreSubRef.current) {
        scoreSubRef.current.close();
        scoreSubRef.current = null;
      }
      return;
    }

    const cardRoundIds = activeTournament.cards.map(c => c.id);
    if (cardRoundIds.length === 0) return;

    // Build card lookup for mapping score events to cards
    const cardPlayerLookup = new Map<string, string>(); // roundId -> cardId (they're the same)
    activeTournament.cards.forEach(card => {
      card.players.forEach(pubkey => {
        // Map pubkey -> cardId for this tournament
        // Not needed: the d-tag on the score event tells us which card
      });
    });

    if (scoreSubRef.current) scoreSubRef.current.close();

    try {
      scoreSubRef.current = subscribeToTournamentScores(cardRoundIds, async (event) => {
        const playerPubkey = event.pubkey;
        const roundId = event.tags?.find((t: string[]) => t[0] === 'd')?.[1];
        if (!roundId) return;

        try {
          const content = JSON.parse(event.content);

          // Update score map
          scoreMapRef.current.set(playerPubkey, {
            scores: content.scores || {},
            totalScore: content.totalScore || 0,
            cardId: roundId,
          });

          // Resolve profile if not cached
          if (!profileMapRef.current.has(playerPubkey)) {
            profileMapRef.current.set(playerPubkey, { name: 'Loading...' });
            try {
              const prof = await fetchProfile(playerPubkey);
              if (prof) {
                profileMapRef.current.set(playerPubkey, {
                  name: prof.name || 'Unknown',
                  photoUrl: prof.picture,
                });
              }
            } catch { /* ignore profile fetch failures */ }
          }

          // Recompute standings
          computeStandings();
        } catch (e) {
          console.warn('Failed to parse tournament score event:', e);
        }
      });
    } catch (e) {
      console.warn('Offline: Could not subscribe to tournament scores');
    }

    return () => {
      if (scoreSubRef.current) {
        scoreSubRef.current.close();
        scoreSubRef.current = null;
      }
    };
  }, [activeTournament?.id, activeTournament?.phase, activeTournament?.cards?.length, computeStandings]);

  // === Effect 3: Subscribe to Tournament Event Updates (Non-Director Only) ===
  // Players (non-directors) subscribe to the tournament's Kind 30003 event for phase
  // changes (registration -> active -> finalized), card assignment updates, and
  // player registration updates published by the director.
  useEffect(() => {
    if (!activeTournament || isDirector) return; // Director doesn't need to subscribe to own updates

    if (tournamentSubRef.current) tournamentSubRef.current.close();

    try {
      tournamentSubRef.current = subscribeTournament(activeTournament.id, (event) => {
        try {
          const content = JSON.parse(event.content);
          setActiveTournament(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              phase: content.phase || prev.phase,
              cards: content.cards || prev.cards,
              registeredPlayers: content.registeredPlayers || prev.registeredPlayers,
              isFinalized: content.isFinalized || false,
            };
          });
        } catch (e) {
          console.warn('Failed to parse tournament update:', e);
        }
      });
    } catch {
      console.warn('Offline: Could not subscribe to tournament updates');
    }

    return () => {
      if (tournamentSubRef.current) {
        tournamentSubRef.current.close();
        tournamentSubRef.current = null;
      }
    };
  }, [activeTournament?.id, isDirector]);

  // --- Card Assignment Actions ---

  /**
   * Move a player to a specific card. Removes them from any existing card first.
   * Respects card maxPlayers limit.
   * @param {string} cardId - Target card ID
   * @param {string} playerPubkey - Player's public key to assign
   */
  const updateCardAssignment = useCallback((cardId: string, playerPubkey: string) => {
    setActiveTournament(prev => {
      if (!prev) return prev;
      // Remove from any existing card first
      const cards = prev.cards.map(card => ({
        ...card,
        players: card.players.filter(p => p !== playerPubkey),
      }));
      // Add to target card
      return {
        ...prev,
        cards: cards.map(card =>
          card.id === cardId && card.players.length < card.maxPlayers
            ? { ...card, players: [...card.players, playerPubkey] }
            : card
        ),
      };
    });
  }, []);

  /**
   * Remove a player from a specific card.
   * @param {string} cardId - Card to remove from
   * @param {string} playerPubkey - Player's public key to remove
   */
  const removeFromCard = useCallback((cardId: string, playerPubkey: string) => {
    setActiveTournament(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(card =>
          card.id === cardId
            ? { ...card, players: card.players.filter(p => p !== playerPubkey) }
            : card
        ),
      };
    });
  }, []);

  /**
   * Randomly assign all registered players to cards using Fisher-Yates shuffle.
   * Creates the appropriate number of cards based on cardSize setting.
   */
  const randomizeCards = useCallback(() => {
    setActiveTournament(prev => {
      if (!prev) return prev;
      const shuffled = shuffleArray<string>(prev.registeredPlayers);
      const cardSize = prev.cardSize;
      const numCards = Math.ceil(shuffled.length / cardSize);

      const cards: TournamentCard[] = [];
      for (let i = 0; i < numCards; i++) {
        const start = i * cardSize;
        const players = shuffled.slice(start, start + cardSize);
        const letter = String.fromCharCode(65 + i); // A, B, C, ...
        cards.push({
          id: prev.cards[i]?.id || `${prev.id}_card_${letter.toLowerCase()}`,
          name: `Card ${letter}`,
          players,
          maxPlayers: cardSize,
        });
      }

      return { ...prev, cards };
    });
  }, []);

  /**
   * Add a player to the tournament's registered players list (idempotent).
   * @param {string} pubkey - Player's public key to register
   */
  const addRegisteredPlayer = useCallback((pubkey: string) => {
    setActiveTournament(prev => {
      if (!prev) return prev;
      if (prev.registeredPlayers.includes(pubkey)) return prev;
      return {
        ...prev,
        registeredPlayers: [...prev.registeredPlayers, pubkey],
      };
    });
  }, []);

  // === Effect 4: eCash Payment Detection for Registration Fees ===
  // Listens for 'ecash-received-from-player' custom DOM events (dispatched by WalletContext).
  // During the registration phase, auto-registers the paying player.
  useEffect(() => {
    const handleEcashFromPlayer = (e: CustomEvent) => {
      const playerPubkey = e.detail?.pubkey;
      if (playerPubkey && activeTournament && activeTournament.phase === 'registration') {
        addRegisteredPlayer(playerPubkey);
      }
    };

    window.addEventListener('ecash-received-from-player', handleEcashFromPlayer as EventListener);
    return () => window.removeEventListener('ecash-received-from-player', handleEcashFromPlayer as EventListener);
  }, [activeTournament, addRegisteredPlayer]);

  const value: TournamentContextType = {
    activeTournament,
    standings,
    isDirector,
    updateCardAssignment,
    removeFromCard,
    randomizeCards,
    addRegisteredPlayer,
    setActiveTournament,
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};

/**
 * Hook to access tournament state, standings, and card management actions.
 * @returns {TournamentContextType} Tournament state, standings, and actions.
 * @throws {Error} If called outside of TournamentProvider.
 */
export const useTournament = (): TournamentContextType => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};
