/**
 * @file EventsFriendsView.tsx
 *
 * Friends sub-tab for the Events page.
 *
 * Shows tournaments where the user's contacts or recent players are registered.
 * Each card displays the tournament info plus a line listing which friends are
 * participating (e.g., "Alice and Bob are registered"). Uses the same phase
 * badge system as other event views. Empty state prompts users to play more
 * rounds to build their contacts list.
 */

import React from 'react';
import { EventsFriendsViewProps, FriendsTournamentGroup } from './eventsTypes';
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

const formatFriendsLine = (names: string[]) => {
  if (names.length === 0) return null;
  if (names.length === 1) {
    return (
      <span>
        <span className="text-cyan-400 font-medium">{names[0]}</span>
        {' '}is registered
      </span>
    );
  }
  if (names.length === 2) {
    return (
      <span>
        <span className="text-cyan-400 font-medium">{names[0]}</span>
        {' and '}
        <span className="text-cyan-400 font-medium">{names[1]}</span>
        {' '}are registered
      </span>
    );
  }
  return (
    <span>
      <span className="text-cyan-400 font-medium">{names[0]}</span>
      {' + '}
      <span className="text-cyan-400 font-medium">{names.length - 1} others</span>
      {' '}are registered
    </span>
  );
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
      <div className="h-4 w-48 bg-slate-700/40 rounded" />
    </div>
    <div className="flex items-center space-x-4">
      <div className="h-4 w-20 bg-slate-700/40 rounded" />
      <div className="h-4 w-16 bg-slate-700/40 rounded" />
    </div>
  </div>
);

const TournamentCard: React.FC<{
  group: FriendsTournamentGroup;
  onTap: () => void;
}> = ({ group, onTap }) => {
  const { tournament, friendNames } = group;
  const { name, courseName, date, entryFeeSats, maxPlayers, registeredPlayers, phase } = tournament;

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
    >
      {/* Header: name + phase badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-white leading-tight flex-1">{name}</h3>
        {phaseBadge(phase)}
      </div>

      {/* Course & date */}
      <div className="space-y-1">
        <div className="flex items-center space-x-1.5 text-sm text-slate-400">
          <Icons.Location size={14} className="text-slate-500 shrink-0" />
          <span className="truncate">{courseName}</span>
        </div>
        <div className="flex items-center space-x-1.5 text-sm text-slate-400">
          <Icons.History size={14} className="text-slate-500 shrink-0" />
          <span>{date}</span>
        </div>
      </div>

      {/* Friends line */}
      <div className="text-sm text-slate-300">
        {formatFriendsLine(friendNames)}
      </div>

      {/* Stats row */}
      <div className="flex items-center space-x-4 text-sm text-slate-400">
        <div className="flex items-center space-x-1.5">
          <Icons.Users size={14} className="text-slate-500" />
          <span>{registeredPlayers.length}/{maxPlayers} players</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <Icons.Zap size={14} className="text-amber-400" />
          <span>{entryFeeSats > 0 ? `${entryFeeSats} sats` : 'Free'}</span>
        </div>
      </div>
    </button>
  );
};

/**
 * Friends tournaments list -- shows events where the user's contacts are registered.
 */
export const EventsFriendsView: React.FC<EventsFriendsViewProps> = ({
  groups,
  isLoading,
  onTournamentTap,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Empty state
  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 text-center max-w-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-700/40 flex items-center justify-center">
            <Icons.Users size={24} className="text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            None of your contacts are in upcoming tournaments. When friends register for events, they will show up here.
          </p>
        </div>
      </div>
    );
  }

  // Tournament cards
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <TournamentCard
          key={group.tournament.id}
          group={group}
          onTap={() => onTournamentTap(group.tournament)}
        />
      ))}
    </div>
  );
};
