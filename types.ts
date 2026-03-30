/**
 * @file Core type definitions for On-Chain Disc Golf.
 *
 * Defines all shared interfaces, enums, and Nostr event kind constants used
 * throughout the application. Types cover player/round/tournament modeling,
 * wallet transactions, Cashu eCash primitives, user profile/stats, and the
 * global application state tree.
 *
 * Nostr kind constants follow the NIP numbering scheme and are used by
 * {@link ../services/nostrService.ts} for event publishing and subscription.
 */

/**
 * A player participating in an active round.
 *
 * Each player is identified by their Nostr public key and carries per-round
 * scoring data, fee opt-in flags, and display metadata. The `scores` map is
 * keyed by 1-based hole number.
 */
export interface Player {
  /** Nostr public key in hex format, used as the unique player identifier. */
  id: string;
  /** Display name resolved from the player's Nostr profile (Kind 0). */
  name: string;
  /** Lightning Address (LUD-16) for receiving payouts. */
  lightningAddress?: string;
  /** Stroke handicap applied to final scoring (negative = better than par). */
  handicap: number;
  /** Whether this player has paid all required fees for the round. */
  paid: boolean;
  /** Whether this player is opted in to the entry fee. */
  paysEntry: boolean;
  /** Whether this player is opted in to the ace pot. */
  paysAce: boolean;
  /** Hole-by-hole scores, keyed by 1-based hole number. */
  scores: Record<number, number>;
  /** Cumulative stroke total across all scored holes. */
  totalScore: number;
  /** True if this player corresponds to the locally authenticated user. */
  isCurrentUser: boolean;
  /** URL to the player's profile picture from their Nostr Kind 0 metadata. */
  photoUrl?: string;
}

/**
 * Lightweight profile used in player-selection lists, contacts, and recent-player displays.
 *
 * Derived from Nostr Kind 0 profile metadata and enriched with app-specific
 * fields like PDGA number and round count.
 */
export interface DisplayProfile {
  /** Nostr public key in hex format. */
  pubkey: string;
  /** Display name from the user's Nostr profile. */
  name: string;
  /** Profile picture URL. */
  image?: string;
  /** NIP-05 verified internet identifier (e.g., "user@example.com"). @see https://github.com/nostr-protocol/nips/blob/master/05.md */
  nip05?: string;
  /** Professional Disc Golf Association member number. */
  pdga?: string;
  /** Total number of rounds this player has participated in. */
  totalRoundsPlayed?: number;
  /** Whether the player has paid fees (used in round-context player lists). */
  paid?: boolean;
  /** Whether the player opted in to the entry fee. */
  paysEntry?: boolean;
  /** Whether the player opted in to the ace pot. */
  paysAce?: boolean;
}

/**
 * How prize money is distributed among finishing positions.
 * - `'winner-take-all'` -- first place receives the entire pot.
 * - `'percentage-based'` -- pot is split among the top N% of finishers.
 */
export type PayoutMode = 'winner-take-all' | 'percentage-based';

/**
 * Controls the steepness of payout distribution when mode is `'percentage-based'`.
 * - `'top-heavy'` -- higher positions receive disproportionately larger shares.
 * - `'linear'` -- shares decrease evenly across payout positions.
 *
 * @see {@link ../utils/payoutCalculations.ts} for the calculation algorithms.
 */
export type PayoutGradient = 'top-heavy' | 'linear';

/**
 * Determines what happens to the ace pot when no ace is hit during the round.
 * - `'forfeit'` -- pot is forfeited (stays unclaimed).
 * - `'add-to-entry-pot'` -- ace pot is merged into the entry-fee prize pool.
 * - `'redistribute-to-participants'` -- ace pot is refunded evenly to participants.
 */
export type AcePotRedistribution = 'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants';

/**
 * Configuration for how entry-fee and ace-pot funds are distributed after a
 * round or tournament is finalized.
 *
 * @see {@link ../utils/payoutCalculations.ts}
 */
export interface PayoutConfig {
  /** How the prize pool is distributed (all-to-first vs. split among top finishers). */
  mode: PayoutMode;
  /** Percentage of the field that receives a payout (e.g., 30 = top 30%). Only used when mode is `'percentage-based'`. */
  percentageThreshold?: number;
  /** Shape of the payout curve across eligible positions. */
  gradient: PayoutGradient;
  /** What to do with the ace pot if no ace is made. */
  acePotRedistribution: AcePotRedistribution;
}

/**
 * Settings and metadata for a single disc golf round.
 *
 * Persisted as a Nostr Kind 30001 replaceable event. The `id` field is the
 * event's `d` tag, enabling updates without creating duplicate events.
 *
 * @see {@link NOSTR_KIND_ROUND}
 */
export interface RoundSettings {
  /** Unique round identifier, used as the Nostr event `d` tag. */
  id: string;
  /** Nostr event ID assigned after the event is published to relays. */
  eventId?: string;
  /** Hex public key of the user who created the round. */
  pubkey: string;
  /** Human-readable round name (e.g., "Sunday Dubs"). */
  name: string;
  /** Name of the disc golf course being played. */
  courseName: string;
  /** Entry fee in satoshis that each opted-in player must pay. */
  entryFeeSats: number;
  /** Ace pot contribution in satoshis per opted-in player. */
  acePotFeeSats: number;
  /** ISO date string for when the round takes place. */
  date: string;
  /** Whether the round has been finalized and payouts settled. */
  isFinalized: boolean;
  /** Number of holes on the course (typically 9 or 18). */
  holeCount: number;
  /** Hex public keys of all players in the round. */
  players: string[];
  /** Total course par (e.g., 54 for an 18-hole par-3 course). */
  par: number;

  // -- Customization Config --

  /** 1-based hole number to begin play on (for shotgun starts). */
  startingHole: number;
  /** Whether penalty strokes (OB, hazard) are tracked separately. */
  trackPenalties: boolean;
  /** When true, the running total-to-par is hidden from players during play. */
  hideOverallScore: boolean;
  /** When true, tee-off order is determined by the previous hole's scores (best goes first). */
  useHonorSystem?: boolean;
  /** Payout distribution rules applied at finalization. */
  payoutConfig?: PayoutConfig;
  /** Per-player handicap overrides, keyed by hex pubkey. */
  playerHandicaps?: Record<string, number>;
}

/**
 * Record of a single wallet transaction (deposit, payment, payout, etc.).
 *
 * Transactions are stored in {@link AppState.transactions} and displayed in the
 * Wallet page's activity feed. They span all three supported wallet backends.
 */
export interface WalletTransaction {
  /** Unique transaction identifier (UUID or mint-assigned ID). */
  id: string;
  /** Semantic category describing why the transaction occurred. */
  type: 'deposit' | 'payment' | 'payout' | 'ace_pot' | 'send' | 'receive';
  /** Transaction amount in satoshis. */
  amountSats: number;
  /** Human-readable description shown in the activity feed. */
  description: string;
  /** Unix timestamp (seconds) when the transaction was created. */
  timestamp: number;
  /** Which wallet backend processed this transaction. */
  walletType?: 'cashu' | 'nwc' | 'breez';
  /** Current settlement status. */
  status?: 'pending' | 'complete' | 'failed';
}

/**
 * A Cashu mint that the user has configured for eCash operations.
 *
 * Users can add multiple mints but only one is active at a time for
 * minting/melting tokens.
 *
 * @see {@link ../services/walletService.ts}
 */
export interface Mint {
  /** Base URL of the Cashu mint (e.g., "https://mint.example.com"). */
  url: string;
  /** User-assigned friendly name for the mint. */
  nickname: string;
  /** Whether this mint is currently selected for new eCash operations. */
  isActive: boolean;
}

/**
 * A single Cashu eCash proof (token).
 *
 * Proofs are the fundamental unit of value in the Cashu protocol. Each proof
 * is a blind-signed token from a mint representing a specific satoshi amount.
 * The collection of proofs in {@link AppState.proofs} constitutes the user's
 * Cashu wallet balance.
 *
 * @see https://github.com/cashubtc/nuts
 */
export interface Proof {
  /** Keyset identifier from the mint that issued this proof. */
  id: string;
  /** Denomination of this proof in satoshis. */
  amount: number;
  /** Unique secret that proves ownership (spending condition). */
  secret: string;
  /** Blinded signature from the mint (compressed point on the curve). */
  C: string;
  /** URL of the mint that issued this proof, for multi-mint support. */
  mintUrl?: string;
}

/**
 * The authenticated user's Nostr profile metadata.
 *
 * Mirrors the standard Kind 0 metadata fields plus the app-specific PDGA
 * number. Published to relays so other players can discover display names,
 * pictures, and Lightning addresses.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md (Kind 0)
 */
export interface UserProfile {
  /** Display name shown to other players. */
  name: string;
  /** Free-form bio / about text. */
  about: string;
  /** URL to the user's profile picture. */
  picture: string;
  /** Lightning Address (LUD-16) for receiving payments. @see https://lightningaddress.com */
  lud16: string;
  /** NIP-05 internet identifier for verification (e.g., "user@example.com"). @see https://github.com/nostr-protocol/nips/blob/master/05.md */
  nip05?: string;
  /** Professional Disc Golf Association member number. */
  pdga?: string;
}

/**
 * Aggregated lifetime statistics for the authenticated user.
 *
 * Calculated from historical round data and displayed on the Profile page.
 */
export interface UserStats {
  /** Total number of rounds played. */
  totalRounds: number;
  /** Number of rounds where the player finished in first place. */
  totalWins: number;
  /** Average total strokes per round. */
  averageScore: number;
  /** Lowest total strokes in a single round. */
  bestScore: number;
  /** Lifetime satoshis earned from payouts. */
  totalSatsWon: number;

  // -- Extended stats --

  /** Total hole-in-ones across all rounds. */
  totalAces: number;
  /** Total birdies (one under par on a hole) across all rounds. */
  totalBirdies: number;
  /** Number of rounds completed without any bogeys. */
  bogeyFreeRounds: number;
  /** Longest consecutive winning streak (rounds). */
  biggestWinStreak: number;
  /** Lifetime satoshis spent on entry fees and ace pots. */
  totalSatsPaid: number;
  /** Largest single-round payout in satoshis. */
  biggestWin: number;
}

/**
 * Top-level application state tree.
 *
 * Composed from the domain-specific contexts (Auth, Wallet, Profile, Round)
 * and exposed to components via {@link ../context/AppContext.tsx | useApp()}.
 */
export interface AppState {
  /** Current wallet balance in satoshis (sum across active wallet backend). */
  walletBalance: number;
  /** Chronological list of all wallet transactions. */
  transactions: WalletTransaction[];
  /** The currently active round, or null if no round is in progress. */
  activeRound: RoundSettings | null;
  /** Players in the active round with live scoring data. */
  players: Player[];
  /** 1-based index of the hole currently being scored. */
  currentHole: number;
  /** The authenticated user's Nostr profile metadata. */
  userProfile: UserProfile;
  /** The authenticated user's aggregated lifetime statistics. */
  userStats: UserStats;
  /** Cashu mints configured by the user. */
  mints: Mint[];
  /** Unspent Cashu eCash proofs constituting the Cashu wallet balance. */
  proofs: Proof[];
  /** Players the user has recently played rounds with. */
  recentPlayers: DisplayProfile[];
  /** Profiles from the user's Nostr contact list (Kind 3). */
  contacts: DisplayProfile[];
  /** Whether the user is currently authenticated (local key, NIP-46, or Amber). */
  isAuthenticated: boolean;
  /** Whether the user is browsing as an unauthenticated guest. */
  isGuest: boolean;
  /** Authentication method used for the current session. */
  authMethod: 'local' | 'nip46' | 'amber' | null;
  /** Which wallet backend is currently active. */
  walletMode: 'cashu' | 'nwc' | 'breez';
  /** Nostr Wallet Connect connection string for the NWC wallet backend. @see https://github.com/nostr-protocol/nips/blob/master/47.md */
  nwcString: string;
}

/**
 * Lifecycle phases of a disc golf round from the UI's perspective.
 *
 * Drives which views are rendered in the Home page orchestrator.
 */
export enum GameStatus {
  /** No round active; show the main menu. */
  IDLE = 'IDLE',
  /** Round is being configured (course, players, fees). */
  SETUP = 'SETUP',
  /** Round is in progress; scorecard is active. */
  PLAYING = 'PLAYING',
  /** Round is complete; finalization/payout screen is shown. */
  FINISHED = 'FINISHED'
}

/**
 * How players are assigned to scoring cards in a tournament.
 * - `'director-assigns'` -- the tournament director manually places players on cards.
 * - `'random'` -- players are shuffled onto cards via Fisher-Yates algorithm.
 * - `'players-choice'` -- players self-select their card/tee-time.
 */
export type CardAssignmentMode = 'director-assigns' | 'random' | 'players-choice';

/**
 * Lifecycle phases of a tournament from creation through completion.
 */
export type TournamentPhase = 'registration' | 'card-assignment' | 'active' | 'finalized';

/**
 * A scoring card (group) within a tournament.
 *
 * Each card maps 1:1 to a standard Kind 30001 round, so existing round
 * scoring and subscription logic works unchanged for tournament play.
 */
export interface TournamentCard {
  /** Card identifier; doubles as the `roundId` for the card's Kind 30001 event. */
  id: string;
  /** Friendly label (e.g., "Card A", "9:00 AM Tee Time"). */
  name: string;
  /** Hex public keys of players assigned to this card. */
  players: string[];
  /** Maximum number of players allowed on this card (typically 4-5). */
  maxPlayers: number;
  /** ISO 8601 tee time; primarily used in `'players-choice'` assignment mode. */
  teeTime?: string;
}

/**
 * Full configuration for a multi-card tournament.
 *
 * Persisted as a Nostr Kind 30003 replaceable event. The tournament director
 * publishes updates as the phase progresses (registration -> card-assignment
 * -> active -> finalized). Location fields enable discovery via the Events
 * tab's "Nearby" geohash queries.
 *
 * @see {@link NOSTR_KIND_TOURNAMENT}
 * @see {@link ../context/TournamentContext.tsx}
 */
export interface TournamentSettings {
  /** Unique tournament identifier, used as the Nostr event `d` tag. */
  id: string;
  /** Nostr event ID assigned after the event is published to relays. */
  eventId?: string;
  /** Hex public key of the tournament director. */
  pubkey: string;
  /** Tournament name (e.g., "Spring Classic 2026"). */
  name: string;
  /** Name of the disc golf course. */
  courseName: string;
  /** ISO date string for when the tournament takes place. */
  date: string;
  /** Number of holes per round. */
  holeCount: number;
  /** Total course par. */
  par: number;
  /** Entry fee in satoshis per player. */
  entryFeeSats: number;
  /** Ace pot contribution in satoshis per player. */
  acePotFeeSats: number;
  /** Maximum number of players the tournament can accept. */
  maxPlayers: number;
  /** Target number of players per card (default 4). */
  cardSize: number;
  /** How players are distributed across scoring cards. */
  cardAssignmentMode: CardAssignmentMode;
  /** Current lifecycle phase of the tournament. */
  phase: TournamentPhase;
  /** Scoring cards with assigned players. */
  cards: TournamentCard[];
  /** Hex public keys of all players who have registered. */
  registeredPlayers: string[];
  /** Payout distribution rules applied at finalization. */
  payoutConfig?: PayoutConfig;
  /** Per-player handicap overrides, keyed by hex pubkey. */
  playerHandicaps?: Record<string, number>;
  /** Whether the tournament has been finalized and payouts settled. */
  isFinalized: boolean;
  /** Venue latitude for geolocation-based discovery. */
  latitude?: number;
  /** Venue longitude for geolocation-based discovery. */
  longitude?: number;
  /** Encoded geohash of the venue; published as `g` tags at multiple precision levels for relay-side filtering. */
  geohash?: string;
  /** Human-readable location name (e.g., "Expo Park, Salt Lake City"). */
  locationName?: string;
}

/**
 * A single row in the live tournament leaderboard.
 *
 * Computed in {@link ../context/TournamentContext.tsx} by aggregating
 * Kind 30002 score events across all cards and ranking players.
 */
export interface TournamentStanding {
  /** 1-based finishing position (ties share the same position). */
  position: number;
  /** True when multiple players share the same position (displayed as "T1" vs "1"). */
  isTied: boolean;
  /** Hex public key of the player. */
  pubkey: string;
  /** Display name from the player's Nostr profile. */
  name: string;
  /** URL to the player's profile picture. */
  photoUrl?: string;
  /** ID of the card this player is scoring on. */
  cardId: string;
  /** Friendly name of the player's assigned card. */
  cardName: string;
  /** Hole-by-hole scores, keyed by 1-based hole number. */
  scores: Record<number, number>;
  /** Cumulative stroke total. */
  totalScore: number;
  /** Strokes relative to par through holes completed (negative = under par). */
  toPar: number;
  /** Number of holes completed (0-18); -1 indicates the player has finished the round. */
  thru: number;
  /** True if this standing row corresponds to the locally authenticated user. */
  isCurrentUser: boolean;
}

// ---------------------------------------------------------------------------
// Nostr Event Kind Constants
// ---------------------------------------------------------------------------

/**
 * Kind 0 -- User metadata (profile name, picture, Lightning address, etc.).
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export const NOSTR_KIND_PROFILE = 0;

/**
 * Kind 3 -- Contact list. Stores the user's follow list as `p` tags.
 * Used to populate the contacts array in {@link AppState}.
 * @see https://github.com/nostr-protocol/nips/blob/master/02.md
 */
export const NOSTR_KIND_CONTACTS = 3;

/**
 * Kind 30001 -- Parameterized replaceable event representing a disc golf round.
 * The `d` tag is the round ID, enabling in-place updates without duplicates.
 * Each tournament card also publishes as a Kind 30001 event so existing
 * scoring logic works for both casual rounds and tournament cards.
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md (parameterized replaceable events)
 */
export const NOSTR_KIND_ROUND = 30001;

/**
 * Kind 30002 -- Parameterized replaceable event for a player's hole-by-hole
 * score within a round. The `d` tag combines the round ID and player pubkey
 * so each player has exactly one live score event per round.
 */
export const NOSTR_KIND_SCORE = 30002;

/**
 * Kind 30003 -- Parameterized replaceable event for tournament coordination.
 * Contains tournament metadata, registered players, card assignments, and
 * phase transitions. Published by the tournament director.
 */
export const NOSTR_KIND_TOURNAMENT = 30003;

/**
 * Kind 30078 -- Application-specific data storage (NIP-78).
 * Used for persisting app settings, eCash proof backups, and user stats
 * to Nostr relays in an app-namespaced, replaceable event.
 * @see https://github.com/nostr-protocol/nips/blob/master/78.md
 */
export const NOSTR_KIND_APP_DATA = 30078;

/**
 * Kind 1059 -- NIP-17 Gift Wrap for private peer-to-peer messaging.
 * Used to send payment requests, payment confirmations, and eCash tokens
 * between players without exposing message content to relays.
 * @see https://github.com/nostr-protocol/nips/blob/master/17.md
 */
export const NOSTR_KIND_GIFT_WRAP = 1059;

/**
 * Nostr key pair used for signing events and deriving identity.
 *
 * When `method` is `'local'`, the secret key is held in-app. When `'nip46'`,
 * signing is delegated to a remote signer and `sk` is absent.
 *
 * @see {@link ../context/AuthContext.tsx}
 */
export interface KeyPair {
  /** 32-byte secret key (absent when using NIP-46 remote signing). */
  sk?: Uint8Array;
  /** Hex-encoded public key. */
  pk: string;
  /** How signing operations are performed. */
  method: 'local' | 'nip46';
}

/**
 * Shape of the `window.nostr` object injected by NIP-07 browser extensions
 * (e.g., nos2x, Alby) or NIP-46 remote signer bridges.
 *
 * Provides methods for public key retrieval, event signing, and optional
 * NIP-04 encryption/decryption (used only for NWC and NIP-46 -- all new
 * internal encryption uses NIP-44).
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/07.md
 * @see https://github.com/nostr-protocol/nips/blob/master/46.md
 */
export interface WindowNostr {
  /** Returns the user's hex-encoded public key. */
  getPublicKey: () => Promise<string>;
  /** Signs a Nostr event and returns the signed event with `id` and `sig`. */
  signEvent: (event: any) => Promise<any>;
  /** Optional NIP-04 encryption/decryption (legacy; used only for NWC and NIP-46). */
  nip04?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
}

/**
 * Global augmentation to declare the optional `window.nostr` provider
 * and the `Buffer` polyfill used by some cryptographic libraries.
 */
declare global {
  interface Window {
    nostr?: WindowNostr;
    Buffer: any;
  }
}