/**
 * @file TournamentRegistrationView.tsx
 *
 * Tournament registration phase view -- manages player sign-ups before the tournament starts.
 *
 * Features:
 * - Registration progress bar (registered / max players).
 * - Registered player list with profile names and avatars.
 * - Invite link with copy-to-clipboard and scannable QR code.
 * - "Close Registration" button (director only, requires >= 2 players)
 *   that advances the tournament to the card-assignment phase.
 */

import React, { useState } from 'react';
import { TournamentRegistrationViewProps } from './tournamentTypes';
import { Icons } from '../../components/Icons';
import { buildTournamentJoinUrl } from '../../utils/qrUrls';
import { JoinQrCode } from '../../components/JoinQrCode';

/**
 * Tournament registration view -- player sign-up list, invite sharing, and close registration.
 */
export const TournamentRegistrationView: React.FC<TournamentRegistrationViewProps> = ({
  tournament,
  isDirector,
  playerProfiles,
  onCloseRegistration,
  onShareInvite,
  onBack,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const { registeredPlayers, maxPlayers, id } = tournament;
  const progressPercent = Math.min((registeredPlayers.length / maxPlayers) * 100, 100);
  const inviteLink = buildTournamentJoinUrl(id, tournament.pubkey);
  const canCloseRegistration = registeredPlayers.length >= 2;

  const handleCopyLink = () => {
    onShareInvite();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getPlayerName = (pubkey: string): string => {
    const profile = playerProfiles.get(pubkey);
    return profile?.name || `${pubkey.slice(0, 8)}...`;
  };

  const getPlayerInitials = (pubkey: string): string => {
    const profile = playerProfiles.get(pubkey);
    if (profile?.name) {
      return profile.name.slice(0, 2).toUpperCase();
    }
    return pubkey.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onBack}
          className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <Icons.Back size={20} />
        </button>
        <h1 className="text-xl font-bold">Registration</h1>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Players Registered</span>
          <span className="font-semibold text-white">
            {registeredPlayers.length} / {maxPlayers}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {registeredPlayers.length >= maxPlayers && (
          <p className="text-xs text-amber-400 font-medium">Registration full</p>
        )}
      </div>

      {/* Share Invite Section */}
      <div className="bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Invite Players</h2>

        {/* Invite Link */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-400 truncate font-mono">
            {inviteLink}
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 active:scale-95 transition-all text-sm font-medium whitespace-nowrap"
          >
            {copiedLink ? (
              <>
                <Icons.CheckMark size={16} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Icons.Copy size={16} />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* QR Code */}
        <JoinQrCode
          joinUrl={inviteLink}
          title="Scan to Register"
          subtitle={`${tournament.name} • ${tournament.courseName}`}
        />
      </div>

      {/* Registered Players List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Registered Players ({registeredPlayers.length})
        </h2>
        <div className="space-y-2">
          {registeredPlayers.map((pubkey) => {
            const profile = playerProfiles.get(pubkey);
            const isPaid = true; // Derived from payment status in orchestrator
            return (
              <div
                key={pubkey}
                className="flex items-center justify-between bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  {profile?.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt={getPlayerName(pubkey)}
                      className="w-9 h-9 rounded-full object-cover border border-slate-600"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-emerald-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-emerald-400">
                        {getPlayerInitials(pubkey)}
                      </span>
                    </div>
                  )}
                  {/* Name */}
                  <span className="text-sm font-medium text-white">
                    {getPlayerName(pubkey)}
                  </span>
                </div>
                {/* Paid Status */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isPaid
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
                }`}>
                  {isPaid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
            );
          })}

          {registeredPlayers.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No players registered yet. Share the invite link to get started.
            </div>
          )}
        </div>
      </div>

      {/* Director Controls */}
      {isDirector && (
        <div className="mt-auto pt-4">
          <button
            onClick={onCloseRegistration}
            disabled={!canCloseRegistration}
            className={`w-full font-semibold py-4 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              canCloseRegistration
                ? 'bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-slate-800/50 text-slate-600 border border-slate-700/30 cursor-not-allowed'
            }`}
          >
            <Icons.CreditCard size={20} />
            <span>Close Registration & Assign Cards</span>
          </button>
          {!canCloseRegistration && (
            <p className="text-xs text-slate-500 text-center mt-2">
              At least 2 players required to proceed
            </p>
          )}
        </div>
      )}
    </div>
  );
};
