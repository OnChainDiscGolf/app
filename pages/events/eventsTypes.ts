/**
 * @file eventsTypes.ts
 *
 * Shared TypeScript types and prop interfaces for the Events page module.
 *
 * Defines:
 * - EventsTab -- the three sub-tabs (nearby, friends, mine).
 * - RadiusOption -- geolocation search radius options in miles.
 * - DiscoveredTournament -- tournament with computed distance from user.
 * - FriendsTournamentGroup -- tournament grouped by which friends are registered.
 * - Prop interfaces for EventsNearbyView, EventsFriendsView, EventsMineView.
 */

import { TournamentSettings } from '../../types';

/** Sub-tab selection for the Events page. */
export type EventsTab = 'nearby' | 'friends' | 'mine';
/** Allowed geolocation search radius options in miles. */
export type RadiusOption = 10 | 25 | 50 | 100 | 250;

/** Tournament discovered via geohash relay queries, with computed distance from the user. */
export interface DiscoveredTournament extends TournamentSettings {
  distanceMiles?: number;
}

/** A tournament along with the subset of the user's friends/contacts who are registered. */
export interface FriendsTournamentGroup {
  tournament: TournamentSettings;
  friendPubkeys: string[];
  friendNames: string[];
}

/** Props for the Nearby sub-tab -- geolocation-based tournament discovery. */
export interface EventsNearbyViewProps {
  tournaments: DiscoveredTournament[];
  isLoading: boolean;
  radius: RadiusOption;
  setRadius: (r: RadiusOption) => void;
  userLocation: { lat: number; lng: number } | null;
  locationError: string | null;
  onRequestLocation: () => void;
  onTournamentTap: (tournament: TournamentSettings) => void;
}

/** Props for the Friends sub-tab -- tournaments where contacts/recent players are registered. */
export interface EventsFriendsViewProps {
  groups: FriendsTournamentGroup[];
  isLoading: boolean;
  onTournamentTap: (tournament: TournamentSettings) => void;
}

/** Props for the Mine sub-tab -- tournaments the user has created or registered for. */
export interface EventsMineViewProps {
  activeTournament: TournamentSettings | null;
  myTournaments: TournamentSettings[];
  isDirector: boolean;
  isLoading: boolean;
  onTournamentTap: (tournament: TournamentSettings) => void;
  onCreateTournament: () => void;
}
