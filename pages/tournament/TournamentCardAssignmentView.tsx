/**
 * @file TournamentCardAssignmentView.tsx
 *
 * Card (scoring group) assignment view for the tournament card-assignment phase.
 *
 * Supports three assignment modes:
 * 1. **Director-assigns** -- director taps an unassigned player, then taps a card to place them.
 * 2. **Random** -- "Randomize" button uses Fisher-Yates shuffle to distribute players.
 * 3. **Player's-choice** -- each player sees a "Join" button on available cards to self-select.
 *
 * Displays:
 * - Cards with assigned player names/avatars and open slots.
 * - Unassigned player pool at the bottom.
 * - "Start Tournament" button (director only) enabled when all players are assigned.
 */

import React, { useState } from 'react';
import { TournamentCardAssignmentViewProps } from './tournamentTypes';
import { Icons } from '../../components/Icons';

/**
 * Card assignment view -- distributes registered players into scoring groups (cards).
 */
export const TournamentCardAssignmentView: React.FC<TournamentCardAssignmentViewProps> = ({
  tournament,
  isDirector,
  playerProfiles,
  currentUserPubkey,
  onAssignPlayer,
  onRemovePlayer,
  onRandomize,
  onJoinCard,
  onStartTournament,
  onBack,
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const { cards, registeredPlayers, cardAssignmentMode } = tournament;

  const getPlayerName = (pubkey: string): string => {
    const profile = playerProfiles.get(pubkey);
    return profile?.name || `${pubkey.slice(0, 8)}...`;
  };

  // Players not yet assigned to any card
  const assignedPubkeys = new Set(cards.flatMap((c) => c.players));
  const unassignedPlayers = registeredPlayers.filter((pk) => !assignedPubkeys.has(pk));

  // Find the current user's card
  const currentUserCard = cards.find((c) => c.players.includes(currentUserPubkey));

  // Every card that has players must have at least 1
  const canStartTournament = cards.some((c) => c.players.length > 0) &&
    unassignedPlayers.length === 0;

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
        <h1 className="text-xl font-bold">Card Assignment</h1>
      </div>

      {/* Mode Selector (Director only) */}
      {isDirector && (
        <div className="flex items-center space-x-1 bg-slate-800/60 border border-slate-700/40 rounded-xl p-1">
          {(['director-assigns', 'random', 'players-choice'] as const).map((mode) => {
            const labels: Record<string, string> = {
              'director-assigns': 'Manual',
              'random': 'Random',
              'players-choice': "Player's Choice",
            };
            const isActive = cardAssignmentMode === mode;
            return (
              <div
                key={mode}
                className={`flex-1 text-center py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-500'
                }`}
              >
                {labels[mode]}
              </div>
            );
          })}
        </div>
      )}

      {/* ========== DIRECTOR ASSIGNS MODE ========== */}
      {cardAssignmentMode === 'director-assigns' && (
        <div className="space-y-5">
          {/* Unassigned Players */}
          {unassignedPlayers.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Unassigned Players ({unassignedPlayers.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {unassignedPlayers.map((pubkey) => (
                  <button
                    key={pubkey}
                    onClick={() => setSelectedPlayer(selectedPlayer === pubkey ? null : pubkey)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                      selectedPlayer === pubkey
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 ring-2 ring-emerald-500/30'
                        : 'bg-slate-800/60 text-slate-300 border border-slate-700/40 hover:border-emerald-500/30'
                    }`}
                  >
                    {getPlayerName(pubkey)}
                  </button>
                ))}
              </div>
              {selectedPlayer && (
                <p className="text-xs text-emerald-400">
                  Tap a card or empty slot below to assign {getPlayerName(selectedPlayer)}
                </p>
              )}
            </div>
          )}

          {/* Cards */}
          <div className="space-y-4">
            {cards.map((card) => {
              const emptySlots = card.maxPlayers - card.players.length;
              return (
                <div
                  key={card.id}
                  className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden"
                >
                  {/* Card Header */}
                  <button
                    onClick={() => {
                      if (selectedPlayer && emptySlots > 0) {
                        onAssignPlayer(card.id, selectedPlayer);
                        setSelectedPlayer(null);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b border-slate-700/30 transition-colors ${
                      selectedPlayer && emptySlots > 0
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    <h3 className="text-sm font-bold text-white">{card.name}</h3>
                    <span className="text-xs text-slate-500">
                      {card.players.length}/{card.maxPlayers}
                    </span>
                  </button>

                  {/* Player Slots */}
                  <div className="p-3 space-y-2">
                    {/* Filled slots */}
                    {card.players.map((pubkey) => (
                      <div
                        key={pubkey}
                        className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-white">{getPlayerName(pubkey)}</span>
                        <button
                          onClick={() => onRemovePlayer(card.id, pubkey)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Icons.Close size={16} />
                        </button>
                      </div>
                    ))}

                    {/* Empty slots */}
                    {Array.from({ length: emptySlots }).map((_, i) => (
                      <button
                        key={`empty-${i}`}
                        onClick={() => {
                          if (selectedPlayer) {
                            onAssignPlayer(card.id, selectedPlayer);
                            setSelectedPlayer(null);
                          }
                        }}
                        className={`w-full flex items-center justify-center border border-dashed rounded-lg px-3 py-2 text-sm transition-all ${
                          selectedPlayer
                            ? 'border-emerald-500/40 text-emerald-400/60 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer'
                            : 'border-slate-700/40 text-slate-600 cursor-default'
                        }`}
                      >
                        {selectedPlayer ? `+ Add ${getPlayerName(selectedPlayer)}` : 'Empty slot'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== RANDOM MODE ========== */}
      {cardAssignmentMode === 'random' && (
        <div className="space-y-5">
          {/* Shuffle Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onRandomize}
              className="flex-1 bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 border border-emerald-500/20 text-white font-semibold py-3 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <Icons.Refresh size={18} className="text-emerald-400" />
              <span>Shuffle Cards</span>
            </button>
            {cards.some((c) => c.players.length > 0) && (
              <button
                onClick={onRandomize}
                className="px-4 py-3 bg-slate-800/60 border border-slate-700/40 text-slate-300 font-medium rounded-xl hover:bg-slate-700/60 active:scale-95 transition-all text-sm"
              >
                Re-shuffle
              </button>
            )}
          </div>

          {/* Card Preview (Read-only) */}
          <div className="space-y-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                  <h3 className="text-sm font-bold text-white">{card.name}</h3>
                  <span className="text-xs text-slate-500">
                    {card.players.length}/{card.maxPlayers}
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  {card.players.length > 0 ? (
                    card.players.map((pubkey) => (
                      <div
                        key={pubkey}
                        className="bg-slate-900/40 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-white">{getPlayerName(pubkey)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-3 text-sm text-slate-600">
                      No players assigned yet
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== PLAYER'S CHOICE MODE ========== */}
      {cardAssignmentMode === 'players-choice' && (
        <div className="space-y-4">
          {cards.map((card) => {
            const isFull = card.players.length >= card.maxPlayers;
            const isUserCard = card.players.includes(currentUserPubkey);
            const openSpots = card.maxPlayers - card.players.length;

            return (
              <button
                key={card.id}
                onClick={() => {
                  if (!isFull && !isUserCard) {
                    onJoinCard(card.id);
                  }
                }}
                disabled={isFull && !isUserCard}
                className={`w-full text-left rounded-xl overflow-hidden transition-all ${
                  isUserCard
                    ? 'bg-emerald-500/10 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                    : isFull
                    ? 'bg-slate-800/30 border border-slate-700/20 opacity-60 cursor-not-allowed'
                    : 'bg-slate-800/60 border border-slate-700/40 hover:border-emerald-500/30 hover:bg-slate-800/80 active:scale-[0.99]'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/20">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-white">{card.name}</h3>
                    {isUserCard && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Your Card
                      </span>
                    )}
                    {isFull && !isUserCard && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-700/50 text-slate-500 border border-slate-600/30">
                        Full
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${isFull ? 'text-slate-600' : 'text-cyan-400'}`}>
                    {openSpots}/{card.maxPlayers} open
                  </span>
                </div>

                {/* Current Members */}
                <div className="p-3 space-y-1.5">
                  {card.players.length > 0 ? (
                    card.players.map((pubkey) => (
                      <div
                        key={pubkey}
                        className={`flex items-center space-x-2 px-2 py-1 rounded ${
                          pubkey === currentUserPubkey ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        <Icons.User size={14} className="text-slate-500" />
                        <span className="text-sm">{getPlayerName(pubkey)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-2 text-sm text-slate-600">
                      No players yet — be the first to join
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Section */}
      <div className="mt-auto pt-4 space-y-3">
        {isDirector && (
          <button
            onClick={onStartTournament}
            disabled={!canStartTournament}
            className={`w-full font-semibold py-4 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              canStartTournament
                ? 'bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-slate-800/50 text-slate-600 border border-slate-700/30 cursor-not-allowed'
            }`}
          >
            <Icons.Play size={20} />
            <span>Start Tournament</span>
          </button>
        )}
        {!canStartTournament && isDirector && unassignedPlayers.length > 0 && (
          <p className="text-xs text-slate-500 text-center">
            All players must be assigned to a card before starting
          </p>
        )}
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-white transition-colors py-2"
        >
          <Icons.Back size={18} />
          <span className="text-sm">Back</span>
        </button>
      </div>
    </div>
  );
};
