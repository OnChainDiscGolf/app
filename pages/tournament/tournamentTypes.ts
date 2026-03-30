/**
 * @file tournamentTypes.ts
 *
 * Shared TypeScript types and prop interfaces for the Tournament page module.
 *
 * Defines:
 * - TournamentView -- view state machine union type for the orchestrator.
 * - TournamentCreationState -- persistable draft state for tournament setup.
 * - Prop interfaces for all tournament sub-views: Lobby, Setup, Registration,
 *   CardAssignment, and Leaderboard.
 *
 * The Tournament.tsx orchestrator owns all state and passes typed slices to views.
 */

import { TournamentSettings, TournamentStanding, TournamentCard, CardAssignmentMode, TournamentPhase, PayoutConfig, DisplayProfile } from '../../types';

/**
 * View state machine for the Tournament orchestrator.
 *
 * Flow: setup -> registration -> card-assignment -> leaderboard
 * Lobby is used when viewing an existing tournament that isn't in the creation flow.
 */
export type TournamentView = 'lobby' | 'setup' | 'registration' | 'card-assignment' | 'leaderboard';

/**
 * Persistable snapshot of tournament creation form state.
 * Saved to localStorage so directors can resume setup after navigating away.
 */
export interface TournamentCreationState {
  view: TournamentView;
  name: string;
  courseName: string;
  layout: '9' | '18' | 'custom';
  customHoles: number;
  hasEntryFee: boolean;
  entryFee: number;
  acePot: number;
  maxPlayers: number;
  cardSize: number;
  cardAssignmentMode: CardAssignmentMode;
  payoutMode: 'winner-take-all' | 'percentage-based';
  payoutPercentage: number;
  payoutGradient: 'top-heavy' | 'linear';
  acePotRedistribution: 'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants';
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string;
}

/**
 * Props for the tournament lobby view -- overview of an existing tournament
 * with phase badge, player list, QR invite, and director actions.
 */
export interface TournamentLobbyViewProps {
  activeTournament: TournamentSettings;
  isDirector: boolean;
  standings: TournamentStanding[];
  setView: (view: TournamentView) => void;
  onEditTournament: () => void;
  onStartTournament: () => Promise<void>;
  onFinalizeTournament: () => Promise<void>;
  navigate: (path: string) => void;
}

/**
 * Props for the tournament setup/creation form.
 * Configures name, course, holes, fees, player limits, card size,
 * assignment mode, payout rules, and optional geolocation.
 */
export interface TournamentSetupViewProps {
  name: string;
  setName: (name: string) => void;
  courseName: string;
  setCourseName: (name: string) => void;
  layout: '9' | '18' | 'custom';
  setLayout: (layout: '9' | '18' | 'custom') => void;
  customHoles: number;
  setCustomHoles: (holes: number) => void;
  hasEntryFee: boolean;
  setHasEntryFee: (has: boolean) => void;
  entryFee: number;
  setEntryFee: (fee: number) => void;
  acePot: number;
  setAcePot: (pot: number) => void;
  maxPlayers: number;
  setMaxPlayers: (max: number) => void;
  cardSize: number;
  setCardSize: (size: number) => void;
  cardAssignmentMode: CardAssignmentMode;
  setCardAssignmentMode: (mode: CardAssignmentMode) => void;
  payoutMode: 'winner-take-all' | 'percentage-based';
  setPayoutMode: (mode: 'winner-take-all' | 'percentage-based') => void;
  payoutPercentage: number;
  setPayoutPercentage: (pct: number) => void;
  payoutGradient: 'top-heavy' | 'linear';
  setPayoutGradient: (gradient: 'top-heavy' | 'linear') => void;
  acePotRedistribution: 'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants';
  setAcePotRedistribution: (mode: 'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants') => void;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  locationLoading: boolean;
  locationQuery: string;
  locationResults: { displayName: string; lat: number; lng: number }[];
  onLocationQueryChange: (query: string) => void;
  onLocationSearch: () => void;
  onLocationSelect: (result: { displayName: string; lat: number; lng: number }) => void;
  onRequestLocation: () => void;
  onClearLocation: () => void;
  recentCourses: string[];
  isEditing?: boolean;
  onCreateTournament: () => void;
  onBack: () => void;
}

/**
 * Props for the tournament registration view.
 * Shows registered player list, progress bar, invite link/QR, and
 * a "Close Registration" action for the director.
 */
export interface TournamentRegistrationViewProps {
  tournament: TournamentSettings;
  isDirector: boolean;
  playerProfiles: Map<string, { name: string; photoUrl?: string }>;
  onCloseRegistration: () => void;
  onShareInvite: () => void;
  onBack: () => void;
}

/**
 * Props for the card assignment view.
 * Supports three modes: director-assigns (drag-drop), random (Fisher-Yates shuffle),
 * and player's-choice (self-select into a card). Director can start the tournament
 * once all players are assigned.
 */
export interface TournamentCardAssignmentViewProps {
  tournament: TournamentSettings;
  isDirector: boolean;
  playerProfiles: Map<string, { name: string; photoUrl?: string }>;
  currentUserPubkey: string;
  onAssignPlayer: (cardId: string, pubkey: string) => void;
  onRemovePlayer: (cardId: string, pubkey: string) => void;
  onRandomize: () => void;
  onJoinCard: (cardId: string) => void;
  onStartTournament: () => Promise<void>;
  onBack: () => void;
}

/**
 * Props for the live tournament leaderboard.
 * Shows real-time standings aggregated across all cards, card progress indicators,
 * and a "Finalize Tournament" action when all cards are complete.
 */
export interface TournamentLeaderboardViewProps {
  tournament: TournamentSettings;
  standings: TournamentStanding[];
  isDirector: boolean;
  onFinalizeTournament: () => Promise<void>;
  onBack: () => void;
  navigate: (path: string) => void;
}
