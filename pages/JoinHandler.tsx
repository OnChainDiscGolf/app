/**
 * @file JoinHandler.tsx
 *
 * Deep link handler for QR code round and tournament joins.
 *
 * Handles URLs of the form:
 * - `/join/round/:id?p=<pubkey>`     -- join an existing round
 * - `/join/tournament/:id?p=<pubkey>` -- register for a tournament
 *
 * These URLs are encoded in QR codes shown by hosts/directors and also served
 * as Android App Links / iOS Universal Links for native deep linking.
 *
 * Flow:
 * 1. **Loading** -- fetches the round/tournament event from Nostr relays using
 *    the `id` and optional host `pubkey` from the URL.
 * 2. **Loaded** -- displays event details (name, course, entry fee, player count)
 *    with a "Join" button. Shows wallet balance for fee context.
 * 3. **Joining** -- calls `joinRoundAndPay()` or `joinTournament()` which handles
 *    payment and Nostr event updates.
 * 4. **Joined** -- success screen with navigation to scorecard/tournament.
 * 5. **Error / Not Found** -- appropriate error states with retry/home buttons.
 *
 * Unauthenticated users see a prompt to create an account first.
 *
 * Route: /join/:type/:id
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { fetchRound, fetchTournament } from '../services/nostrService';
import { Icons } from '../components/Icons';
import { RoundSettings, TournamentSettings } from '../types';
import { useDenomination } from '../hooks/useDenomination';

/** State machine for the join flow UI. */
type JoinState = 'loading' | 'loaded' | 'joining' | 'joined' | 'error' | 'not-found';

/**
 * Join handler page -- processes deep link URLs for round and tournament joins.
 * Fetches event data from Nostr, displays details, and handles the join + payment flow.
 */
export const JoinHandler: React.FC = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { formatAmount } = useDenomination();
  const {
    isAuthenticated,
    currentUserPubkey,
    joinRoundAndPay,
    joinTournament,
    setActiveTournament,
    activeRound,
    activeTournament,
    walletBalance,
  } = useApp();

  const pubkey = searchParams.get('p') || undefined;
  const [state, setState] = useState<JoinState>('loading');
  const [roundData, setRoundData] = useState<RoundSettings | null>(null);
  const [tournamentData, setTournamentData] = useState<TournamentSettings | null>(null);
  const [error, setError] = useState<string>('');
  const fetchedRef = useRef(false);

  const eventName = roundData?.name || tournamentData?.name || '';
  const courseName = roundData?.courseName || tournamentData?.courseName || '';
  const entryFee = (roundData?.entryFeeSats || tournamentData?.entryFeeSats || 0) +
    (roundData?.acePotFeeSats || tournamentData?.acePotFeeSats || 0);

  // Fetch the event from Nostr
  useEffect(() => {
    if (fetchedRef.current || !id || !type) return;
    fetchedRef.current = true;

    const fetchEvent = async () => {
      setState('loading');

      if (type === 'round') {
        const round = await fetchRound(id, pubkey);
        if (round) {
          setRoundData(round);
          setState('loaded');
        } else {
          setState('not-found');
        }
      } else if (type === 'tournament') {
        const tournament = await fetchTournament(id);
        if (tournament) {
          setTournamentData(tournament);
          setState('loaded');
        } else {
          setState('not-found');
        }
      } else {
        setState('not-found');
      }
    };

    fetchEvent().catch(() => {
      setError('Failed to connect to relays.');
      setState('error');
    });
  }, [id, type, pubkey]);

  // Check if user is already in this round/tournament
  const isAlreadyIn = type === 'round'
    ? activeRound?.id === id
    : activeTournament?.id === id ||
      (tournamentData?.registeredPlayers?.includes(currentUserPubkey) ?? false);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      // Stash the join intent and redirect to onboarding
      sessionStorage.setItem('cdg_join_intent', window.location.pathname + window.location.search);
      navigate('/', { replace: true });
      return;
    }

    setState('joining');

    try {
      if (type === 'round' && roundData) {
        const success = await joinRoundAndPay(roundData.id, roundData);
        if (success) {
          setState('joined');
          setTimeout(() => navigate('/play', { replace: true }), 1200);
        } else {
          setError(walletBalance < entryFee
            ? `Insufficient balance. You need ${formatAmount(entryFee)} but only have ${formatAmount(walletBalance)}.`
            : 'Failed to join round.');
          setState('error');
        }
      } else if (type === 'tournament' && tournamentData) {
        const success = await joinTournament(tournamentData.id, tournamentData);
        if (success) {
          setState('joined');
          setTimeout(() => navigate('/tournament', { replace: true }), 1200);
        } else {
          setError(walletBalance < entryFee
            ? `Insufficient balance. You need ${formatAmount(entryFee)} but only have ${formatAmount(walletBalance)}.`
            : 'Failed to register for tournament.');
          setState('error');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  };

  const handleGoToEvent = () => {
    if (type === 'round') {
      navigate('/play');
    } else {
      if (tournamentData) setActiveTournament(tournamentData);
      navigate('/tournament');
    }
  };

  // --- Loading ---
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <Icons.Zap size={32} className="text-emerald-400 animate-pulse" />
          </div>
          <p className="text-slate-400 text-sm">
            Loading {type === 'tournament' ? 'tournament' : 'round'} details...
          </p>
        </div>
      </div>
    );
  }

  // --- Not Found ---
  if (state === 'not-found') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700">
            <Icons.AlertTriangle size={32} className="text-slate-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Event Not Found</h1>
            <p className="text-slate-400 text-sm">
              This {type === 'tournament' ? 'tournament' : 'round'} may have ended or the link may be invalid.
            </p>
          </div>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3 bg-slate-800 border border-slate-700 text-white font-semibold rounded-xl hover:bg-slate-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // --- Joined Success ---
  if (state === 'joined') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <Icons.CheckMark size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold">You're In!</h1>
          <p className="text-slate-400 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  // --- Loaded / Error / Joining ---
  const isTournament = type === 'tournament';
  const playerCount = isTournament
    ? tournamentData?.registeredPlayers?.length || 0
    : roundData?.players?.length || 0;
  const maxPlayers = isTournament ? tournamentData?.maxPlayers : undefined;
  const isFinalized = roundData?.isFinalized || tournamentData?.isFinalized;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-6 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="self-start p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors mb-6"
      >
        <Icons.Back size={20} />
      </button>

      {/* Event Card */}
      <div className="bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 rounded-2xl p-6 space-y-4 shadow-lg shadow-emerald-500/5">
        <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {isTournament ? <Icons.Trophy size={14} /> : <Icons.Play size={14} />}
          <span>{isTournament ? 'Tournament' : 'Round'}</span>
        </div>

        <h1 className="text-2xl font-bold text-white leading-tight">{eventName || 'Disc Golf Round'}</h1>

        <div className="space-y-2 text-sm text-slate-400">
          {courseName && (
            <div className="flex items-center space-x-2">
              <Icons.Location size={16} className="text-emerald-400 flex-shrink-0" />
              <span>{courseName}</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Icons.Users size={16} className="text-cyan-400 flex-shrink-0" />
            <span>
              {playerCount} player{playerCount !== 1 ? 's' : ''}
              {maxPlayers ? ` / ${maxPlayers} max` : ''}
            </span>
          </div>
          {(roundData?.date || tournamentData?.date) && (
            <div className="flex items-center space-x-2">
              <Icons.History size={16} className="text-slate-500 flex-shrink-0" />
              <span>{roundData?.date || tournamentData?.date}</span>
            </div>
          )}
        </div>

        {/* Entry Fee */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
          <span className="text-sm text-slate-400">Entry Fee</span>
          <div className="flex items-center space-x-1.5">
            <Icons.Zap size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-amber-400">
              {entryFee > 0 ? formatAmount(entryFee) : 'Free'}
            </span>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {isFinalized && (
        <div className="mt-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
          <p className="text-sm text-purple-300">This {isTournament ? 'tournament' : 'round'} has already been finalized.</p>
        </div>
      )}

      {isTournament && maxPlayers && playerCount >= maxPlayers && !isAlreadyIn && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
          <p className="text-sm text-amber-300">Registration is full ({maxPlayers} players).</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center space-y-3">
          <p className="text-sm text-red-300">{error}</p>
          {walletBalance < entryFee && (
            <button
              onClick={() => navigate('/wallet')}
              className="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-semibold"
            >
              Fund Wallet
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 space-y-3">
        {isAlreadyIn ? (
          <button
            onClick={handleGoToEvent}
            className="w-full py-4 bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <Icons.Play size={20} />
            <span>Go to {isTournament ? 'Tournament' : 'Scorecard'}</span>
          </button>
        ) : isFinalized ? (
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-4 bg-slate-800 border border-slate-700 text-white font-semibold rounded-xl hover:bg-slate-700 transition-colors"
          >
            Go Home
          </button>
        ) : !isAuthenticated ? (
          <button
            onClick={handleJoin}
            className="w-full py-4 bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Sign Up to Join
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={state === 'joining' || (isTournament && maxPlayers !== undefined && playerCount >= maxPlayers)}
            className="w-full py-4 bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {state === 'joining' ? (
              <>
                <Icons.Zap size={20} className="animate-spin" />
                <span>Joining...</span>
              </>
            ) : (
              <span>{isTournament ? 'Register' : 'Join Round'}{entryFee > 0 ? ` • ${formatAmount(entryFee)}` : ''}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default JoinHandler;
