/**
 * @file TournamentLobbyView.tsx
 *
 * Tournament lobby/overview view -- shown when viewing an existing tournament.
 *
 * Displays tournament details (name, course, phase badge, player count, fee info),
 * a QR code invite link for sharing, and phase-appropriate director actions:
 * - Registration phase: link to registration view.
 * - Card-assignment phase: link to card assignment view.
 * - Active phase: link to leaderboard.
 * - Finalized: shows final standings summary.
 *
 * The director can also edit tournament settings or trigger phase transitions
 * (start tournament, finalize tournament) from this view.
 */

import React, { useState } from 'react';
import { TournamentLobbyViewProps } from './tournamentTypes';
import { Icons } from '../../components/Icons';
import { buildTournamentJoinUrl } from '../../utils/qrUrls';
import { JoinQrCode } from '../../components/JoinQrCode';

const phaseBadge = (phase: string) => {
  switch (phase) {
    case 'registration':
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Registration</span>;
    case 'card-assignment':
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Card Assignment</span>;
    case 'active':
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active</span>;
    case 'finalized':
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Finalized</span>;
    default:
      return null;
  }
};

/**
 * Tournament lobby view -- overview with phase-appropriate actions and invite QR.
 */
export const TournamentLobbyView: React.FC<TournamentLobbyViewProps> = ({
  activeTournament,
  isDirector,
  standings,
  setView,
  onEditTournament,
  onStartTournament,
  onFinalizeTournament,
  navigate,
}) => {
  const [showShareQr, setShowShareQr] = useState(false);

  const {
    name,
    courseName,
    date,
    phase,
    registeredPlayers,
    maxPlayers,
    entryFeeSats,
    acePotFeeSats,
  } = activeTournament;

  const totalPot = (entryFeeSats + acePotFeeSats) * registeredPlayers.length;
  const top5 = standings.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col space-y-6 pb-24">
      {/* Tournament Status Card */}
      <div className="bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 rounded-2xl p-6 space-y-4 shadow-lg shadow-emerald-500/5">
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-white leading-tight flex-1 mr-3">{name}</h1>
          {phaseBadge(phase)}
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <div className="flex items-center space-x-2">
            <Icons.Location size={16} className="text-emerald-400" />
            <span>{courseName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Icons.History size={16} className="text-emerald-400" />
            <span>{date}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <div className="flex items-center space-x-2">
            <Icons.Users size={16} className="text-cyan-400" />
            <span className="text-sm text-slate-300">
              {registeredPlayers.length} / {maxPlayers} players
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Icons.Zap size={16} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">
              {totalPot.toLocaleString()} sats
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="space-y-3">
        {/* Edit button for director before tournament starts */}
        {isDirector && (phase === 'registration' || phase === 'card-assignment') && (
          <button
            onClick={onEditTournament}
            className="w-full bg-gradient-to-br from-slate-800/90 via-slate-700/20 to-slate-900/95 border border-slate-600/30 text-white font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <Icons.Settings size={20} className="text-slate-300" />
            <span>Edit Tournament Details</span>
          </button>
        )}

        {phase === 'registration' && (
          <>
            <button
              onClick={() => setView('registration')}
              className="w-full bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 text-white font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <Icons.Users size={20} className="text-emerald-400" />
              <span>View Registrations</span>
            </button>
            <button
              onClick={() => setShowShareQr(!showShareQr)}
              className="w-full bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 text-white font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <Icons.QrCode size={20} className="text-cyan-400" />
              <span>{showShareQr ? 'Hide QR Code' : 'Share QR Code'}</span>
            </button>
            {showShareQr && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6">
                <JoinQrCode
                  joinUrl={buildTournamentJoinUrl(activeTournament.id, activeTournament.pubkey)}
                  title="Scan to Register"
                  subtitle={`${name} • ${courseName}`}
                />
              </div>
            )}
          </>
        )}

        {phase === 'card-assignment' && (
          <button
            onClick={() => setView('card-assignment')}
            className="w-full bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 text-white font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <Icons.CreditCard size={20} className="text-amber-400" />
            <span>Assign Cards</span>
          </button>
        )}

        {phase === 'active' && (
          <>
            <button
              onClick={() => setView('leaderboard')}
              className="w-full bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold py-5 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-lg"
            >
              <Icons.BarChart size={22} />
              <span>View Leaderboard</span>
            </button>
            <button
              onClick={() => navigate('/play')}
              className="w-full bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 text-white font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <Icons.Trophy size={20} className="text-emerald-400" />
              <span>My Scorecard</span>
            </button>
          </>
        )}

        {phase === 'finalized' && (
          <button
            onClick={() => setView('leaderboard')}
            className="w-full bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-purple-500/20 text-white font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <Icons.TrophyMedal size={20} className="text-purple-400" />
            <span>View Final Standings</span>
          </button>
        )}
      </div>

      {/* Mini Leaderboard Preview (Active Phase) */}
      {phase === 'active' && top5.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Top 5</h2>
            <button
              onClick={() => setView('leaderboard')}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {top5.map((standing) => (
              <div
                key={standing.pubkey}
                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                  standing.isCurrentUser ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-bold text-slate-400 w-6 text-center">
                    {standing.isTied ? 'T' : ''}{standing.position}
                  </span>
                  <span className={`text-sm font-medium ${standing.isCurrentUser ? 'text-emerald-400' : 'text-white'}`}>
                    {standing.name}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-500">
                    thru {standing.thru === -1 ? 'F' : standing.thru}
                  </span>
                  <span className={`text-sm font-bold ${
                    standing.toPar < 0 ? 'text-emerald-400' :
                    standing.toPar > 0 ? 'text-red-400' :
                    'text-slate-300'
                  }`}>
                    {standing.toPar === 0 ? 'E' : standing.toPar > 0 ? `+${standing.toPar}` : standing.toPar}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back to Home */}
      <div className="mt-auto pt-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
        >
          <Icons.Back size={18} />
          <span className="text-sm">Back to Home</span>
        </button>
      </div>
    </div>
  );
};
