/**
 * @fileoverview Action Queue Service -- Offline-resilient Nostr event publishing.
 *
 * When the app is offline or a relay publish fails, this service queues the
 * failed action in localStorage and retries it when connectivity is restored.
 * The queue is flushed by NetworkContext when the app comes back online.
 *
 * Features:
 * - Persistent queue survives page reloads (localStorage-backed)
 * - Automatic expiry: actions older than 24 hours are pruned
 * - Retry limit: each action retries up to 5 times before being dropped
 * - Listener pattern for UI badge counts (e.g., offline indicator)
 * - `publishXxxWithRetry()` wrappers for fire-and-forget resilient publishing
 *
 * @see NetworkContext.tsx -- calls flush() on reconnection
 */

import { publishRound, publishScore, publishProfile, publishRecentPlayers, publishWalletBackup, publishTournament } from './nostrService';
import { RoundSettings, UserProfile, DisplayProfile, Proof, Mint, WalletTransaction, TournamentSettings } from '../types';

// ==========================================
// Types
// ==========================================

/** Supported Nostr publish action types that can be queued for retry */
export type ActionType =
  | 'publishScore'
  | 'publishRound'
  | 'publishProfile'
  | 'publishRecentPlayers'
  | 'publishWalletBackup'
  | 'publishTournament';

/** A queued action waiting to be retried */
export interface PendingAction {
  /** Unique ID: `{type}_{timestamp}_{random}` */
  id: string;
  /** Which Nostr publish operation to retry */
  type: ActionType;
  /** Serializable arguments for the publish function */
  payload: any;
  /** When the action was first queued (ms since epoch) */
  createdAt: number;
  /** How many times this action has been retried so far */
  retryCount: number;
  /** Maximum retry attempts before the action is dropped */
  maxRetries: number;
}

// ==========================================
// Storage
// ==========================================

/** localStorage key for persisting the action queue */
const STORAGE_KEY = 'cdg_pending_actions';
/** Maximum retry attempts per action */
const MAX_RETRIES = 5;
/** Actions older than this are pruned on load (24 hours) */
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const loadQueue = (): PendingAction[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed: PendingAction[] = JSON.parse(saved);
    // Prune expired actions
    const now = Date.now();
    return parsed.filter(a => now - a.createdAt < MAX_AGE_MS && a.retryCount < a.maxRetries);
  } catch {
    return [];
  }
};

const saveQueue = (queue: PendingAction[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to persist action queue:', e);
  }
};

// ==========================================
// Queue State
// ==========================================

let queue: PendingAction[] = loadQueue();
let listeners: Array<(length: number) => void> = [];

const notifyListeners = () => {
  const len = queue.length;
  listeners.forEach(fn => fn(len));
};

// ==========================================
// Public API
// ==========================================

/**
 * Subscribe to queue length changes. Used by UI components to show
 * pending action counts (e.g., offline badge).
 *
 * @param listener - Callback invoked with the current queue length on every change
 * @returns Unsubscribe function
 */
export const onQueueChange = (listener: (length: number) => void): (() => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(fn => fn !== listener);
  };
};

/**
 * Get the current number of pending actions in the queue.
 *
 * @returns Number of actions waiting to be retried
 */
export const getQueueLength = (): number => queue.length;

/**
 * Add a failed Nostr publish action to the retry queue.
 *
 * The action is persisted to localStorage immediately so it survives
 * page reloads. Queue change listeners are notified.
 *
 * @param type - Which publish operation failed
 * @param payload - The original arguments to pass when retrying
 */
export const enqueue = (type: ActionType, payload: any): void => {
  const action: PendingAction = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: MAX_RETRIES,
  };
  queue.push(action);
  saveQueue(queue);
  notifyListeners();
  console.log(`📦 Queued action: ${type} (queue size: ${queue.length})`);
};

/**
 * Execute a single action based on its type
 */
const executeAction = async (action: PendingAction): Promise<boolean> => {
  try {
    switch (action.type) {
      case 'publishScore': {
        const { roundId, scores, totalScore } = action.payload;
        await publishScore(roundId, scores, totalScore);
        return true;
      }
      case 'publishRound': {
        await publishRound(action.payload as RoundSettings);
        return true;
      }
      case 'publishProfile': {
        await publishProfile(action.payload as UserProfile);
        return true;
      }
      case 'publishRecentPlayers': {
        await publishRecentPlayers(action.payload as DisplayProfile[]);
        return true;
      }
      case 'publishWalletBackup': {
        const { proofs, mints, transactions, gatewayRegistrations } = action.payload;
        await publishWalletBackup(proofs, mints, transactions, gatewayRegistrations);
        return true;
      }
      case 'publishTournament': {
        await publishTournament(action.payload as TournamentSettings);
        return true;
      }
      default:
        console.warn(`Unknown action type: ${action.type}`);
        return false;
    }
  } catch (e) {
    console.warn(`Failed to execute queued action ${action.type}:`, e);
    return false;
  }
};

/**
 * Flush the queue -- retry all pending actions concurrently.
 *
 * Called by NetworkContext when online connectivity is restored.
 * Successful actions are removed; failed actions have their retry count
 * incremented and remain in the queue (unless maxRetries is exceeded).
 *
 * @returns Summary of how many actions succeeded vs. still pending
 */
export const flush = async (): Promise<{ succeeded: number; failed: number }> => {
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  console.log(`📦 Flushing action queue (${queue.length} pending)...`);

  const results = await Promise.allSettled(
    queue.map(async (action) => {
      const success = await executeAction(action);
      return { action, success };
    })
  );

  const succeeded: string[] = [];
  const stillPending: PendingAction[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      succeeded.push(result.value.action.id);
    } else {
      const action = result.status === 'fulfilled'
        ? result.value.action
        : queue.find(a => true)!; // fallback
      if (action && action.retryCount < action.maxRetries) {
        stillPending.push({ ...action, retryCount: action.retryCount + 1 });
      }
    }
  }

  queue = stillPending;
  saveQueue(queue);
  notifyListeners();

  console.log(`📦 Queue flush complete: ${succeeded.length} succeeded, ${stillPending.length} still pending`);
  return { succeeded: succeeded.length, failed: stillPending.length };
};

/**
 * Clear the entire action queue. Called on logout to prevent stale
 * actions from being retried under a different identity.
 */
export const clearQueue = (): void => {
  queue = [];
  saveQueue(queue);
  notifyListeners();
};

// ==========================================
// Resilient Publish Wrappers
// ==========================================

/**
 * Publish a score event to Nostr relays with automatic queue-on-failure.
 *
 * If the publish succeeds, nothing is queued. If it fails (e.g., offline),
 * the action is enqueued for retry when connectivity returns.
 *
 * @param roundId - The round's d-tag identifier
 * @param scores - Hole-by-hole scores keyed by hole number
 * @param totalScore - Aggregate score for the round
 */
export const publishScoreWithRetry = async (
  roundId: string,
  scores: Record<number, number>,
  totalScore: number
): Promise<void> => {
  try {
    await publishScore(roundId, scores, totalScore);
  } catch (e) {
    enqueue('publishScore', { roundId, scores, totalScore });
  }
};

/**
 * Publish a round event to Nostr relays with automatic queue-on-failure.
 *
 * @param round - Complete round settings to publish
 */
export const publishRoundWithRetry = async (round: RoundSettings): Promise<void> => {
  try {
    await publishRound(round);
  } catch (e) {
    enqueue('publishRound', round);
  }
};

/**
 * Publish a Kind 0 profile event with automatic queue-on-failure.
 *
 * @param profile - User profile metadata to publish
 */
export const publishProfileWithRetry = async (profile: UserProfile): Promise<void> => {
  try {
    await publishProfile(profile);
  } catch (e) {
    enqueue('publishProfile', profile);
  }
};

/**
 * Publish an encrypted wallet backup (NIP-44) with automatic queue-on-failure.
 *
 * @param proofs - Cashu proofs to back up
 * @param mints - Configured mint list
 * @param transactions - Transaction history
 * @param gatewayRegistrations - Optional gateway registration records
 */
export const publishWalletBackupWithRetry = async (
  proofs: Proof[],
  mints: Mint[],
  transactions: WalletTransaction[],
  gatewayRegistrations?: any[]
): Promise<void> => {
  try {
    await publishWalletBackup(proofs, mints, transactions, gatewayRegistrations);
  } catch (e) {
    enqueue('publishWalletBackup', { proofs, mints, transactions, gatewayRegistrations });
  }
};

/**
 * Publish a Kind 30003 tournament event with automatic queue-on-failure.
 *
 * @param tournament - Complete tournament settings to publish
 */
export const publishTournamentWithRetry = async (tournament: TournamentSettings): Promise<void> => {
  try {
    await publishTournament(tournament);
  } catch (e) {
    enqueue('publishTournament', tournament);
  }
};
