/**
 * @file EventsMineView.tsx
 *
 * Mine sub-tab for the Events page.
 *
 * Displays tournaments the current user has created or registered for.
 * Shows the active tournament (if any) in a highlighted card at the top,
 * followed by a list of past/other tournaments. Includes a "Create Tournament"
 * button and loading skeletons. Tournament director status is indicated on
 * the active tournament card.
 */

import React from 'react';
import { EventsMineViewProps } from './eventsTypes';
import { Icons } from '../../components/Icons';

const phaseBadge = (phase: string) => {
  switch (phase) {
    case 'registration':
      return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Registration</span>;
    case 'card-assignment':
      return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Card Assignment</span>;
    case 'active':
      return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active</span>;
    case 'finalized':
      return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Finalized</span>;
    default:
      return null;
  }
};

const SkeletonCard: React.FC = () => (
  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="h-5 w-40 bg-slate-700/60 rounded" />
      <div className="h-5 w-20 bg-slate-700/60 rounded-full" />
    </div>
    <div className="space-y-2">
      <div className="h-4 w-32 bg-slate-700/40 rounded" />
      <div className="h-4 w-28 bg-slate-700/40 rounded" />
    </div>
    <div className="flex items-center space-x-4">
      <div className="h-4 w-20 bg-slate-700/40 rounded" />
      <div className="h-4 w-16 bg-slate-700/40 rounded" />
    </div>
  </div>
);

/**
 * User's own tournaments list with active tournament highlight and creation CTA.
 */
export const EventsMineView: React.FC<EventsMineViewProps> = ({
  activeTournament,
  myTournaments,
  isDirector,
  isLoading,
  onTournamentTap,
  onCreateTournament,
}) => {
  const hasAnyTournaments = activeTournament !== null || myTournaments.length > 0;

  // Loading state — show skeletons when loading and nothing to display yet
  if (isLoading && !activeTournament) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Empty state — not loading and no tournaments at all
  if (!isLoading && !hasAnyTournaments) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 text-center max-w-sm space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-700/40 flex items-center justify-center">
            <Icons.League size={24} className="text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            You're not in any tournaments
          </p>
          <button
            type="button"
            onClick={onCreateTournament}
            className="w-full px-6 py-2.5 bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-semibold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Create Tournament
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Tournament Card */}
      {activeTournament !== null && (
        <div className="bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-lg shadow-emerald-500/5">
          {/* ACTIVE label */}
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Active
            </span>
            {isDirector && (
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                Director
              </span>
            )}
          </div>

          {/* Tournament name */}
          <h2 className="text-xl font-bold text-white leading-tight">
            {activeTournament.name}
          </h2>

          {/* Course name */}
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <Icons.Location size={14} className="text-emerald-400 shrink-0" />
            <span className="truncate">{activeTournament.courseName}</span>
          </div>

          {/* Phase badge + player count */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
            {phaseBadge(activeTournament.phase)}
            <div className="flex items-center space-x-1.5 text-sm text-slate-300">
              <Icons.Users size={14} className="text-slate-500" />
              <span>
                {activeTournament.registeredPlayers.length}/{activeTournament.maxPlayers} players
              </span>
            </div>
          </div>

          {/* Continue button */}
          <button
            type="button"
            onClick={() => onTournamentTap(activeTournament)}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-semibold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Continue
          </button>
        </div>
      )}

      {/* Other Tournaments List */}
      {myTournaments.length > 0 && (
        <div className="space-y-3">
          {myTournaments.map((tournament) => (
            <button
              key={tournament.id}
              type="button"
              onClick={() => onTournamentTap(tournament)}
              className="w-full text-left bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
            >
              {/* Header: name + phase badge */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-white leading-tight flex-1">{tournament.name}</h3>
                {phaseBadge(tournament.phase)}
              </div>

              {/* Course & date */}
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 text-sm text-slate-400">
                  <Icons.Location size={14} className="text-slate-500 shrink-0" />
                  <span className="truncate">{tournament.courseName}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-sm text-slate-400">
                  <Icons.History size={14} className="text-slate-500 shrink-0" />
                  <span>{tournament.date}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <div className="flex items-center space-x-1.5 text-sm text-slate-400">
                  <Icons.Users size={14} className="text-slate-500" />
                  <span>{tournament.registeredPlayers.length}/{tournament.maxPlayers} players</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Icons.Zap size={14} className="text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400">
                    {tournament.entryFeeSats > 0
                      ? `${tournament.entryFeeSats.toLocaleString()} sats`
                      : 'Free'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Tournament button — always visible when there are tournaments showing */}
      {hasAnyTournaments && (
        <button
          type="button"
          onClick={onCreateTournament}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-slate-800/60 border border-emerald-500/20 rounded-xl text-slate-300 font-medium hover:text-white hover:border-emerald-500/40 active:scale-[0.98] transition-all"
        >
          <Icons.PlusIcon size={18} className="text-emerald-400" />
          <span>Create Tournament</span>
        </button>
      )}
    </div>
  );
};
