/**
 * @file EventsNearbyView.tsx
 *
 * Nearby tournaments sub-tab for the Events page.
 *
 * Displays tournaments discovered via geohash relay queries, sorted by distance
 * from the user's current location. Features a radius picker (10-250 miles),
 * location permission prompts, loading skeletons, and tournament cards showing
 * name, course, distance, phase badge (registration/active/finalized), and
 * player count. Tapping a card navigates to the tournament detail view.
 */

import React from 'react';
import { EventsNearbyViewProps, RadiusOption } from './eventsTypes';
import { Icons } from '../../components/Icons';

/** Available radius filter options in miles. */
const RADIUS_OPTIONS: RadiusOption[] = [10, 25, 50, 100, 250];

const phaseBadge = (phase: string) => {
  switch (phase) {
    case 'registration':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Registration</span>;
    case 'active':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active</span>;
    case 'finalized':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Finalized</span>;
    default:
      return null;
  }
};

/**
 * Nearby tournaments list with radius filter, location prompts, and tournament cards.
 */
export const EventsNearbyView: React.FC<EventsNearbyViewProps> = ({
  tournaments,
  isLoading,
  radius,
  setRadius,
  userLocation,
  locationError,
  onRequestLocation,
  onTournamentTap,
}) => {
  return (
    <div className="space-y-4">
      {/* Radius Picker */}
      <div className="flex items-center justify-center space-x-2">
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setRadius(option)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              radius === option
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:text-slate-300'
            }`}
          >
            {option} mi
          </button>
        ))}
      </div>

      {/* Location Permission Prompt */}
      {userLocation === null && locationError === null && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Icons.Location size={24} className="text-emerald-400" />
          </div>
          <p className="text-slate-300 text-sm">
            Enable location to discover nearby tournaments
          </p>
          <button
            onClick={onRequestLocation}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-semibold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Share Location
          </button>
        </div>
      )}

      {/* Location Error State */}
      {locationError !== null && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <Icons.AlertTriangle size={24} className="text-red-400" />
          </div>
          <p className="text-red-300 text-sm">{locationError}</p>
          <button
            onClick={onRequestLocation}
            className="px-6 py-2.5 bg-red-500/20 text-red-300 font-semibold rounded-xl border border-red-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 animate-pulse"
            >
              <div className="h-5 bg-slate-700/50 rounded w-3/4" />
              <div className="h-4 bg-slate-700/50 rounded w-1/2" />
              <div className="flex items-center space-x-3">
                <div className="h-4 bg-slate-700/50 rounded w-16" />
                <div className="h-4 bg-slate-700/50 rounded w-20" />
                <div className="h-4 bg-slate-700/50 rounded w-14" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && tournaments.length === 0 && userLocation !== null && locationError === null && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 flex flex-col items-center text-center space-y-3">
          <Icons.Location size={20} className="text-slate-500" />
          <p className="text-slate-400 text-sm">
            No tournaments found within {radius} miles
          </p>
          <p className="text-slate-500 text-xs">
            Try expanding your search radius or check back later
          </p>
        </div>
      )}

      {/* Tournament Cards */}
      {!isLoading && tournaments.length > 0 && (
        <div className="space-y-3">
          {tournaments.map((tournament) => (
            <button
              key={tournament.id}
              onClick={() => onTournamentTap(tournament)}
              className="w-full text-left bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 hover:border-slate-600/50 active:scale-[0.98] transition-all"
            >
              {/* Header: Name + Phase Badge */}
              <div className="flex items-start justify-between">
                <h3 className="text-base font-bold text-white leading-tight flex-1 mr-3">
                  {tournament.name}
                </h3>
                {phaseBadge(tournament.phase)}
              </div>

              {/* Course + Date */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <Icons.Location size={14} className="text-slate-500 flex-shrink-0" />
                  <span className="text-sm text-slate-400 truncate">{tournament.courseName}{tournament.locationName ? ` \u2022 ${tournament.locationName.split(',').slice(0, 2).join(',')}` : ''}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Icons.History size={14} className="text-slate-500 flex-shrink-0" />
                  <span className="text-sm text-slate-400">{tournament.date}</span>
                </div>
              </div>

              {/* Bottom Row: Distance, Players, Entry Fee */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <div className="flex items-center space-x-3">
                  {tournament.distanceMiles !== undefined && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                      {tournament.distanceMiles! < 10
                        ? tournament.distanceMiles!.toFixed(1)
                        : Math.round(tournament.distanceMiles!)} mi
                    </span>
                  )}
                  <div className="flex items-center space-x-1.5">
                    <Icons.Users size={14} className="text-slate-500" />
                    <span className="text-xs text-slate-400">
                      {tournament.registeredPlayers.length}/{tournament.maxPlayers} players
                    </span>
                  </div>
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
    </div>
  );
};
