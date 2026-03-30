/**
 * @file TournamentLeaderboardView.tsx
 *
 * Live tournament leaderboard view -- displayed during the active and finalized phases.
 *
 * Features:
 * - Real-time standings table aggregated across all cards via a single Nostr subscription.
 * - Score-to-par display with color coding (under par green, over par red, even white).
 * - "Thru" column showing each player's current hole or "F" if finished.
 * - Card progress indicators showing which cards are complete vs. in-progress.
 * - Expandable player rows for per-card detail.
 * - "Finalize Tournament" button (director only) when all cards have finished.
 * - Navigation back to the tournament lobby.
 */

import React, { useState } from 'react';
import { TournamentLeaderboardViewProps } from './tournamentTypes';
import { Icons } from '../../components/Icons';
import { TournamentStanding } from '../../types';

/**
 * Live tournament leaderboard -- real-time standings with card progress and finalization.
 */
export const TournamentLeaderboardView: React.FC<TournamentLeaderboardViewProps> = ({
  tournament,
  standings,
  isDirector,
  onFinalizeTournament,
  onBack,
  navigate,
}) => {
  const [expandedPubkey, setExpandedPubkey] = useState<string | null>(null);

  const allFinished = standings.length > 0 && standings.every(s => s.thru === -1);

  // Build card progress: average thru per card
  const cardProgressMap = new Map<string, { cardName: string; thruValues: number[] }>();
  for (const s of standings) {
    const existing = cardProgressMap.get(s.cardId);
    if (existing) {
      existing.thruValues.push(s.thru);
    } else {
      cardProgressMap.set(s.cardId, { cardName: s.cardName, thruValues: [s.thru] });
    }
  }

  const cardProgress = Array.from(cardProgressMap.entries()).map(([cardId, data]) => {
    const allDone = data.thruValues.every(t => t === -1);
    const avgThru = allDone
      ? -1
      : Math.round(
          data.thruValues.filter(t => t !== -1).reduce((a, b) => a + b, 0) /
            Math.max(data.thruValues.filter(t => t !== -1).length, 1)
        );
    return { cardId, cardName: data.cardName, avgThru, allDone };
  });

  const formatToPar = (toPar: number) => {
    if (toPar < 0) return `${toPar}`;
    if (toPar === 0) return 'E';
    return `+${toPar}`;
  };

  const toParColor = (toPar: number) => {
    if (toPar < 0) return 'text-emerald-400';
    if (toPar === 0) return 'text-white';
    return 'text-red-400';
  };

  const truncateName = (name: string, max: number = 12) => {
    if (name.length <= max) return name;
    return name.slice(0, max - 1) + '\u2026';
  };

  const scoreColor = (score: number, holePar: number) => {
    if (score === 1) return 'text-yellow-400 border-yellow-400/50';
    if (score < holePar) return 'text-emerald-400 border-emerald-400/50';
    if (score === holePar) return 'text-white border-slate-600';
    return 'text-red-400 border-red-400/50';
  };

  const toggleExpand = (pubkey: string) => {
    setExpandedPubkey(prev => (prev === pubkey ? null : pubkey));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/50">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={onBack}
                className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                <Icons.Back size={22} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-white truncate">{tournament.name}</h1>
                <p className="text-xs text-slate-400 truncate">{tournament.courseName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* My Scorecard link */}
              <button
                onClick={() => navigate('/play')}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1"
              >
                My Scorecard
              </button>

              {/* Live/Final indicator */}
              {tournament.phase === 'active' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 tracking-wider">LIVE</span>
                </span>
              )}
              {tournament.phase === 'finalized' && (
                <span className="px-2.5 py-1 rounded-full bg-slate-700/50 border border-slate-600/30">
                  <span className="text-[10px] font-bold text-slate-300 tracking-wider">FINAL</span>
                </span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
            <span>{tournament.holeCount} Holes</span>
            <span className="text-slate-600">&middot;</span>
            <span>Par {tournament.par}</span>
            <span className="text-slate-600">&middot;</span>
            <span>{standings.length} Players</span>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_44px_44px_44px_52px] px-4 py-1.5 border-t border-slate-800/30">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Pos</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Player</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold text-center">Card</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold text-center">Thru</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold text-center">Tot</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold text-right">&plusmn;Par</span>
        </div>
      </div>

      {/* Scrollable leaderboard body */}
      <div className="flex-1 overflow-y-auto pb-28">
        {standings.map((standing, idx) => (
          <div key={standing.pubkey}>
            {/* Player row */}
            <button
              onClick={() => toggleExpand(standing.pubkey)}
              className={`w-full grid grid-cols-[40px_1fr_44px_44px_44px_52px] items-center px-4 py-2.5 transition-colors ${
                standing.isCurrentUser
                  ? 'ring-1 ring-emerald-500/30 bg-emerald-500/5'
                  : idx % 2 === 0
                    ? 'bg-slate-800/30'
                    : 'bg-slate-800/10'
              }`}
            >
              {/* Position */}
              <span className="text-sm font-semibold text-slate-300">
                {standing.isTied ? `T${standing.position}` : standing.position}
              </span>

              {/* Player */}
              <div className="flex items-center gap-2 min-w-0">
                {standing.photoUrl ? (
                  <img
                    src={standing.photoUrl}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Icons.User size={12} className="text-slate-400" />
                  </div>
                )}
                <span className="text-sm text-white truncate">
                  {truncateName(standing.name)}
                </span>
              </div>

              {/* Card */}
              <span className="text-xs text-slate-400 text-center">{standing.cardName}</span>

              {/* Thru */}
              <span className={`text-xs text-center ${standing.thru === -1 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
                {standing.thru === -1 ? 'F' : standing.thru}
              </span>

              {/* Total */}
              <span className="text-sm font-semibold text-white text-center">
                {standing.totalScore}
              </span>

              {/* ±Par */}
              <span className={`text-sm font-bold text-right ${toParColor(standing.toPar)}`}>
                {formatToPar(standing.toPar)}
              </span>
            </button>

            {/* Expanded hole-by-hole scores */}
            {expandedPubkey === standing.pubkey && (
              <div className="bg-slate-800/40 border-y border-slate-700/30 px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: tournament.holeCount }, (_, i) => i + 1).map(hole => {
                    const score = standing.scores[hole];
                    // Estimate hole par as tournament par / holeCount (rough, per-hole par not available)
                    const holePar = Math.round(tournament.par / tournament.holeCount);
                    const hasScore = score !== undefined && score !== null;

                    return (
                      <div
                        key={hole}
                        className="flex flex-col items-center"
                      >
                        <span className="text-[9px] text-slate-500 mb-0.5">{hole}</span>
                        <div
                          className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold ${
                            hasScore
                              ? scoreColor(score, holePar)
                              : 'text-slate-600 border-slate-700/50'
                          }`}
                        >
                          {hasScore ? score : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {standings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Icons.Users size={32} className="mb-3 opacity-50" />
            <p className="text-sm">No scores yet</p>
          </div>
        )}

        {/* Director controls */}
        {isDirector && tournament.phase === 'active' && allFinished && (
          <div className="px-4 py-6">
            <button
              onClick={onFinalizeTournament}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"
            >
              Finalize Tournament
            </button>
          </div>
        )}
      </div>

      {/* Card progress strip - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800/50">
        <div className="overflow-x-auto">
          <div className="flex items-center gap-3 px-4 py-3 min-w-max">
            {cardProgress.map(card => (
              <div
                key={card.cardId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/30"
              >
                <span className="text-[11px] font-medium text-slate-400">
                  {card.cardName}:
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    card.allDone ? 'text-emerald-400' : 'text-slate-300'
                  }`}
                >
                  {card.allDone ? 'F' : `Thru ${card.avgThru}`}
                </span>
              </div>
            ))}
            {cardProgress.length === 0 && (
              <span className="text-[11px] text-slate-500">No cards</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
