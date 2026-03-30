/**
 * @file Tournament.tsx
 *
 * Orchestrator component for the Tournament page (~280 lines).
 *
 * Manages the full tournament lifecycle through five views:
 *
 * View state machine (driven by `view: TournamentView`):
 * ```
 *   setup ──> (create tournament on Nostr) ──> registration ──> card-assignment ──> leaderboard
 *   lobby (viewing an existing tournament, routes to appropriate phase view)
 * ```
 *
 * Auto-routing: when an `activeTournament` exists, the initial view is determined
 * by the tournament's current phase (registration/card-assignment/active/finalized).
 * The `/tournament/create` route always starts in setup.
 *
 * Key responsibilities:
 * - Tournament creation: name, course, holes, fees, player limits, card size,
 *   assignment mode, payout configuration, and optional geolocation (Nominatim geocoding).
 * - Draft persistence: save/restore setup state to localStorage.
 * - Player profile fetching for registered players (resolved from Nostr).
 * - Delegation to TournamentContext for create/start/finalize/card operations.
 * - Director vs. participant role awareness.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { fetchProfile, fetchTournament } from '../../services/nostrService';
import { publishTournament } from '../../services/nostrService';
import { CardAssignmentMode, TournamentSettings, DisplayProfile } from '../../types';
import { encodeGeohash } from '../../utils/geohash';
import { geocodeSearch, GeocodingResult } from '../../services/geocodeService';
import { buildTournamentJoinUrl } from '../../utils/qrUrls';
import { TournamentView, TournamentCreationState } from './tournamentTypes';
import { TournamentLobbyView } from './TournamentLobbyView';
import { TournamentSetupView } from './TournamentSetupView';
import { TournamentRegistrationView } from './TournamentRegistrationView';
import { TournamentCardAssignmentView } from './TournamentCardAssignmentView';
import { TournamentLeaderboardView } from './TournamentLeaderboardView';

/** localStorage key for persisting tournament creation draft state. */
const DRAFT_KEY = 'cdg_tournament_creation';

/**
 * Tournament page orchestrator -- manages tournament creation, phase routing,
 * player profiles, and delegation to sub-views.
 */
export const Tournament: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeTournament,
    tournamentStandings,
    isDirector,
    createTournament,
    startTournament,
    finalizeTournament,
    updateCardAssignment,
    removeFromCard,
    randomizeCards,
    addRegisteredPlayer,
    setActiveTournament,
    currentUserPubkey,
    publishCurrentScores,
  } = useApp();

  // --- View Routing ---
  const getInitialView = (): TournamentView => {
    if (location.pathname === '/tournament/create') return 'setup';
    if (!activeTournament) return 'setup';
    switch (activeTournament.phase) {
      case 'registration': return 'registration';
      case 'card-assignment': return 'card-assignment';
      case 'active': return 'leaderboard';
      case 'finalized': return 'leaderboard';
      default: return 'lobby';
    }
  };

  const [view, setView] = useState<TournamentView>(getInitialView);

  // --- Setup State ---
  const [name, setName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [layout, setLayout] = useState<'9' | '18' | 'custom'>('18');
  const [customHoles, setCustomHoles] = useState(18);
  const [hasEntryFee, setHasEntryFee] = useState(true);
  const [entryFee, setEntryFee] = useState(1000);
  const [acePot, setAcePot] = useState(500);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [cardSize, setCardSize] = useState(4);
  const [cardAssignmentMode, setCardAssignmentMode] = useState<CardAssignmentMode>('players-choice');

  // --- Location State ---
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);

  // --- Edit Mode ---
  const [isEditing, setIsEditing] = useState(false);

  // --- Payout Config State ---
  const [payoutMode, setPayoutMode] = useState<'winner-take-all' | 'percentage-based'>('percentage-based');
  const [payoutPercentage, setPayoutPercentage] = useState(30);
  const [payoutGradient, setPayoutGradient] = useState<'top-heavy' | 'linear'>('top-heavy');
  const [acePotRedistribution, setAcePotRedistribution] = useState<'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants'>('add-to-entry-pot');

  // --- Recent Courses ---
  const [recentCourses, setRecentCourses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cdg_courses');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // --- Player profiles cache for registration/card views ---
  const [playerProfiles, setPlayerProfiles] = useState<Map<string, { name: string; photoUrl?: string }>>(new Map());
  const profileFetchedRef = useRef<Set<string>>(new Set());

  // --- Resolve profiles for registered players ---
  useEffect(() => {
    if (!activeTournament) return;
    const toFetch = activeTournament.registeredPlayers.filter(
      pk => !profileFetchedRef.current.has(pk)
    );
    if (toFetch.length === 0) return;

    toFetch.forEach(async (pubkey) => {
      profileFetchedRef.current.add(pubkey);
      try {
        const prof = await fetchProfile(pubkey);
        if (prof) {
          setPlayerProfiles(prev => {
            const next = new Map(prev);
            next.set(pubkey, { name: prof.name || pubkey.slice(0, 8), photoUrl: prof.picture });
            return next;
          });
        }
      } catch { /* ignore */ }
    });
  }, [activeTournament?.registeredPlayers]);

  // --- Draft Persistence ---
  useEffect(() => {
    if (view !== 'setup') return;
    const draft: TournamentCreationState = {
      view, name, courseName, layout, customHoles,
      hasEntryFee, entryFee, acePot, maxPlayers, cardSize,
      cardAssignmentMode, payoutMode, payoutPercentage,
      payoutGradient, acePotRedistribution, latitude, longitude, locationName,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [view, name, courseName, layout, customHoles, hasEntryFee, entryFee, acePot,
      maxPlayers, cardSize, cardAssignmentMode, payoutMode, payoutPercentage,
      payoutGradient, acePotRedistribution, latitude, longitude, locationName]);

  // --- Restore Draft on Mount ---
  useEffect(() => {
    if (activeTournament) return; // Don't restore if tournament already active
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const draft: TournamentCreationState = JSON.parse(saved);
      setName(draft.name || '');
      setCourseName(draft.courseName || '');
      setLayout(draft.layout || '18');
      setCustomHoles(draft.customHoles || 18);
      setHasEntryFee(draft.hasEntryFee ?? true);
      setEntryFee(draft.entryFee || 1000);
      setAcePot(draft.acePot || 500);
      setMaxPlayers(draft.maxPlayers || 20);
      setCardSize(draft.cardSize || 4);
      setCardAssignmentMode(draft.cardAssignmentMode || 'random');
      setPayoutMode(draft.payoutMode || 'percentage-based');
      setPayoutPercentage(draft.payoutPercentage || 30);
      setPayoutGradient(draft.payoutGradient || 'top-heavy');
      setAcePotRedistribution(draft.acePotRedistribution || 'add-to-entry-pot');
      setLatitude(draft.latitude ?? null);
      setLongitude(draft.longitude ?? null);
      setLocationName(draft.locationName || '');
    } catch { /* ignore corrupt drafts */ }
  }, []);

  // --- Redirect to leaderboard when tournament starts ---
  useEffect(() => {
    if (activeTournament?.phase === 'active' && view !== 'leaderboard') {
      setView('leaderboard');
    }
  }, [activeTournament?.phase]);

  // --- Handlers ---

  const handleEditTournament = useCallback(() => {
    if (!activeTournament) return;
    // Populate setup state from active tournament
    setName(activeTournament.name);
    setCourseName(activeTournament.courseName);
    const hc = activeTournament.holeCount;
    if (hc === 9) setLayout('9');
    else if (hc === 18) setLayout('18');
    else { setLayout('custom'); setCustomHoles(hc); }
    setHasEntryFee(activeTournament.entryFeeSats > 0 || activeTournament.acePotFeeSats > 0);
    setEntryFee(activeTournament.entryFeeSats);
    setAcePot(activeTournament.acePotFeeSats);
    setMaxPlayers(activeTournament.maxPlayers);
    setCardSize(activeTournament.cardSize);
    setCardAssignmentMode(activeTournament.cardAssignmentMode);
    if (activeTournament.payoutConfig) {
      setPayoutMode(activeTournament.payoutConfig.mode);
      setPayoutPercentage(activeTournament.payoutConfig.percentageThreshold || 30);
      setPayoutGradient(activeTournament.payoutConfig.gradient);
      setAcePotRedistribution(activeTournament.payoutConfig.acePotRedistribution);
    }
    setLatitude(activeTournament.latitude ?? null);
    setLongitude(activeTournament.longitude ?? null);
    setLocationName(activeTournament.locationName || '');
    setIsEditing(true);
    setView('setup');
  }, [activeTournament]);

  const handleCreateTournament = useCallback(async () => {
    const holeCount = layout === 'custom' ? customHoles : layout === '9' ? 9 : 18;

    // Save course to recent
    if (courseName && !recentCourses.includes(courseName)) {
      const updated = [courseName, ...recentCourses].slice(0, 10);
      setRecentCourses(updated);
      localStorage.setItem('cdg_courses', JSON.stringify(updated));
    }

    if (isEditing && activeTournament) {
      // Update existing tournament
      const numCards = Math.ceil(maxPlayers / cardSize);
      const existingCards = activeTournament.cards;
      // Preserve existing cards, add new ones if needed, trim excess
      const cards = Array.from({ length: numCards }, (_, i) => {
        if (existingCards[i]) {
          return { ...existingCards[i], maxPlayers: cardSize };
        }
        const letter = String.fromCharCode(65 + i);
        return {
          id: `${activeTournament.id}_card_${letter.toLowerCase()}`,
          name: `Card ${letter}`,
          players: [] as string[],
          maxPlayers: cardSize,
        };
      });

      const updated: TournamentSettings = {
        ...activeTournament,
        name: name || 'Tournament',
        courseName: courseName || 'Course',
        holeCount,
        par: holeCount * 3,
        entryFeeSats: hasEntryFee ? entryFee : 0,
        acePotFeeSats: hasEntryFee ? acePot : 0,
        maxPlayers,
        cardSize,
        cardAssignmentMode,
        cards,
        payoutConfig: {
          mode: payoutMode,
          percentageThreshold: payoutPercentage,
          gradient: payoutGradient,
          acePotRedistribution,
        },
        ...(latitude != null && longitude != null ? {
          latitude,
          longitude,
          geohash: encodeGeohash(latitude, longitude, 6),
          locationName: locationName || undefined,
        } : {}),
      };

      setActiveTournament(updated);
      try {
        await publishTournament(updated);
      } catch (e) {
        console.warn('Failed to publish tournament update:', e);
      }

      setIsEditing(false);
      localStorage.removeItem(DRAFT_KEY);
      setView('lobby');
    } else {
      // Create new tournament
      await createTournament({
        name: name || 'Tournament',
        courseName: courseName || 'Course',
        date: new Date().toISOString(),
        holeCount,
        par: holeCount * 3,
        entryFeeSats: hasEntryFee ? entryFee : 0,
        acePotFeeSats: hasEntryFee ? acePot : 0,
        maxPlayers,
        cardSize,
        cardAssignmentMode,
        payoutConfig: {
          mode: payoutMode,
          percentageThreshold: payoutPercentage,
          gradient: payoutGradient,
          acePotRedistribution,
        },
        ...(latitude != null && longitude != null ? {
          latitude,
          longitude,
          geohash: encodeGeohash(latitude, longitude, 6),
          locationName: locationName || undefined,
        } : {}),
      });

      localStorage.removeItem(DRAFT_KEY);
      setView('registration');
    }
  }, [name, courseName, layout, customHoles, hasEntryFee, entryFee, acePot,
      maxPlayers, cardSize, cardAssignmentMode, payoutMode, payoutPercentage,
      payoutGradient, acePotRedistribution, createTournament, recentCourses,
      isEditing, activeTournament, setActiveTournament, latitude, longitude]);

  const handleCloseRegistration = useCallback(() => {
    if (!activeTournament) return;
    const updated: TournamentSettings = { ...activeTournament, phase: 'card-assignment' };
    setActiveTournament(updated);
    setView('card-assignment');
  }, [activeTournament, setActiveTournament]);

  const handleShareInvite = useCallback(() => {
    if (!activeTournament) return;
    const inviteUrl = buildTournamentJoinUrl(activeTournament.id, activeTournament.pubkey);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
    }
  }, [activeTournament]);

  const handleJoinCard = useCallback((cardId: string) => {
    if (!activeTournament || !currentUserPubkey) return;
    updateCardAssignment(cardId, currentUserPubkey);
  }, [activeTournament, currentUserPubkey, updateCardAssignment]);

  const handleStartTournament = useCallback(async () => {
    await startTournament();
    navigate('/play');
  }, [startTournament, navigate]);

  const handleFinalizeTournament = useCallback(async () => {
    await finalizeTournament();
  }, [finalizeTournament]);

  const handleLocationSearch = useCallback(async () => {
    if (!locationQuery.trim()) return;
    setLocationLoading(true);
    try {
      const results = await geocodeSearch(locationQuery);
      setLocationResults(results);
    } catch {
      setLocationResults([]);
    } finally {
      setLocationLoading(false);
    }
  }, [locationQuery]);

  const handleLocationSelect = useCallback((result: GeocodingResult) => {
    setLatitude(result.lat);
    setLongitude(result.lng);
    setLocationName(result.displayName);
    setLocationQuery('');
    setLocationResults([]);
  }, []);

  const handleRequestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationName('Current Location');
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const handleClearLocation = useCallback(() => {
    setLatitude(null);
    setLongitude(null);
    setLocationName('');
    setLocationQuery('');
    setLocationResults([]);
  }, []);

  // --- View Routing ---

  if (view === 'setup') {
    return (
      <TournamentSetupView
        name={name}
        setName={setName}
        courseName={courseName}
        setCourseName={setCourseName}
        layout={layout}
        setLayout={setLayout}
        customHoles={customHoles}
        setCustomHoles={setCustomHoles}
        hasEntryFee={hasEntryFee}
        setHasEntryFee={setHasEntryFee}
        entryFee={entryFee}
        setEntryFee={setEntryFee}
        acePot={acePot}
        setAcePot={setAcePot}
        maxPlayers={maxPlayers}
        setMaxPlayers={setMaxPlayers}
        cardSize={cardSize}
        setCardSize={setCardSize}
        cardAssignmentMode={cardAssignmentMode}
        setCardAssignmentMode={setCardAssignmentMode}
        payoutMode={payoutMode}
        setPayoutMode={setPayoutMode}
        payoutPercentage={payoutPercentage}
        setPayoutPercentage={setPayoutPercentage}
        payoutGradient={payoutGradient}
        setPayoutGradient={setPayoutGradient}
        acePotRedistribution={acePotRedistribution}
        setAcePotRedistribution={setAcePotRedistribution}
        latitude={latitude}
        longitude={longitude}
        locationName={locationName}
        locationLoading={locationLoading}
        locationQuery={locationQuery}
        locationResults={locationResults}
        onLocationQueryChange={setLocationQuery}
        onLocationSearch={handleLocationSearch}
        onLocationSelect={handleLocationSelect}
        onRequestLocation={handleRequestLocation}
        onClearLocation={handleClearLocation}
        recentCourses={recentCourses}
        isEditing={isEditing}
        onCreateTournament={handleCreateTournament}
        onBack={() => {
          if (isEditing) {
            setIsEditing(false);
            setView('lobby');
          } else {
            navigate('/');
          }
        }}
      />
    );
  }

  if (view === 'registration' && activeTournament) {
    return (
      <TournamentRegistrationView
        tournament={activeTournament}
        isDirector={isDirector}
        playerProfiles={playerProfiles}
        onCloseRegistration={handleCloseRegistration}
        onShareInvite={handleShareInvite}
        onBack={() => setView('lobby')}
      />
    );
  }

  if (view === 'card-assignment' && activeTournament) {
    return (
      <TournamentCardAssignmentView
        tournament={activeTournament}
        isDirector={isDirector}
        playerProfiles={playerProfiles}
        currentUserPubkey={currentUserPubkey}
        onAssignPlayer={updateCardAssignment}
        onRemovePlayer={removeFromCard}
        onRandomize={randomizeCards}
        onJoinCard={handleJoinCard}
        onStartTournament={handleStartTournament}
        onBack={() => setView('lobby')}
      />
    );
  }

  if (view === 'leaderboard' && activeTournament) {
    return (
      <TournamentLeaderboardView
        tournament={activeTournament}
        standings={tournamentStandings}
        isDirector={isDirector}
        onFinalizeTournament={handleFinalizeTournament}
        onBack={() => setView('lobby')}
        navigate={navigate}
      />
    );
  }

  // Default: Lobby view (or redirect to setup if no tournament)
  if (!activeTournament) {
    return (
      <TournamentSetupView
        name={name}
        setName={setName}
        courseName={courseName}
        setCourseName={setCourseName}
        layout={layout}
        setLayout={setLayout}
        customHoles={customHoles}
        setCustomHoles={setCustomHoles}
        hasEntryFee={hasEntryFee}
        setHasEntryFee={setHasEntryFee}
        entryFee={entryFee}
        setEntryFee={setEntryFee}
        acePot={acePot}
        setAcePot={setAcePot}
        maxPlayers={maxPlayers}
        setMaxPlayers={setMaxPlayers}
        cardSize={cardSize}
        setCardSize={setCardSize}
        cardAssignmentMode={cardAssignmentMode}
        setCardAssignmentMode={setCardAssignmentMode}
        payoutMode={payoutMode}
        setPayoutMode={setPayoutMode}
        payoutPercentage={payoutPercentage}
        setPayoutPercentage={setPayoutPercentage}
        payoutGradient={payoutGradient}
        setPayoutGradient={setPayoutGradient}
        acePotRedistribution={acePotRedistribution}
        setAcePotRedistribution={setAcePotRedistribution}
        latitude={latitude}
        longitude={longitude}
        locationName={locationName}
        locationLoading={locationLoading}
        locationQuery={locationQuery}
        locationResults={locationResults}
        onLocationQueryChange={setLocationQuery}
        onLocationSearch={handleLocationSearch}
        onLocationSelect={handleLocationSelect}
        onRequestLocation={handleRequestLocation}
        onClearLocation={handleClearLocation}
        recentCourses={recentCourses}
        onCreateTournament={handleCreateTournament}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <TournamentLobbyView
      activeTournament={activeTournament}
      isDirector={isDirector}
      standings={tournamentStandings}
      setView={setView}
      onEditTournament={handleEditTournament}
      onStartTournament={handleStartTournament}
      onFinalizeTournament={handleFinalizeTournament}
      navigate={navigate}
    />
  );
};
