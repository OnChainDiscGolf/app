
export interface Player {
  id: string; // This will be the Nostr Pubkey (hex)
  name: string;
  lightningAddress?: string; // lud16
  handicap: number;
  paid: boolean;
  scores: Record<number, number>; // hole number -> score
  totalScore: number;
  isCurrentUser: boolean;
  photoUrl?: string;
}

export interface DisplayProfile {
  pubkey: string;
  name: string;
  image?: string;
  nip05?: string;
  totalRoundsPlayed?: number;
  paid?: boolean;
}

export interface RoundSettings {
  id: string; // This is the 'd' tag of the Nostr event
  eventId?: string; // The actual Nostr Event ID
  pubkey: string; // The creator's pubkey
  name: string;
  courseName: string;
  entryFeeSats: number;
  acePotFeeSats: number;
  date: string;
  isFinalized: boolean;
  holeCount: number;
  players: string[]; // List of pubkeys
  
  // Customization Config
  startingHole: number;
  trackPenalties: boolean;
  hideOverallScore: boolean;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'payment' | 'payout' | 'ace_pot' | 'send' | 'receive';
  amountSats: number;
  description: string;
  timestamp: number;
}

export interface Mint {
  url: string;
  nickname: string;
  isActive: boolean;
}

// Cashu Proof (Token)
export interface Proof {
  id: string;
  amount: number;
  secret: string;
  C: string;
}

export interface UserProfile {
  name: string;
  about: string;
  picture: string;
  lud16: string; // Lightning Address
  nip05?: string; // NIP-05 Verified Address
}

export interface UserStats {
  totalRounds: number;
  totalWins: number;
  averageScore: number;
  bestScore: number;
}

export interface AppState {
  walletBalance: number;
  transactions: WalletTransaction[];
  activeRound: RoundSettings | null;
  players: Player[];
  currentHole: number;
  userProfile: UserProfile;
  userStats: UserStats;
  mints: Mint[];
  proofs: Proof[]; // Store eCash proofs
  recentPlayers: DisplayProfile[];
  contacts: DisplayProfile[]; // Nostr Contact List
  isAuthenticated: boolean;
  isGuest: boolean;
  authMethod: 'local' | 'nip46' | null;
}

export enum GameStatus {
  IDLE = 'IDLE',
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED'
}

// Nostr Kinds
export const NOSTR_KIND_PROFILE = 0;
export const NOSTR_KIND_CONTACTS = 3; // Contact List
export const NOSTR_KIND_ROUND = 30001; // Replaceable event for a League Round
export const NOSTR_KIND_SCORE = 30002; // Replaceable event for a Player's Score in a Round
export const NOSTR_KIND_APP_DATA = 30078; // Application-specific Data

export interface KeyPair {
  sk?: Uint8Array; 
  pk: string;
  method: 'local' | 'nip46';
}

// NIP-07 / NIP-46 Types
export interface WindowNostr {
    getPublicKey: () => Promise<string>;
    signEvent: (event: any) => Promise<any>;
    nip04?: {
        encrypt: (pubkey: string, plaintext: string) => Promise<string>;
        decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
    };
}

declare global {
    interface Window {
        nostr?: WindowNostr;
        Buffer: any;
    }
}