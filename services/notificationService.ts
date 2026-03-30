/**
 * @fileoverview Notification Service -- Dual-channel push notification dispatch.
 *
 * Provides a centralized notification system that dispatches through two channels:
 * 1. **Capacitor native** -- LocalNotifications plugin for iOS/Android
 * 2. **Web Notification API** -- For PWA users (only when tab is hidden)
 *
 * Features:
 * - User-configurable per-type preferences (stored in localStorage)
 * - Haptic feedback mapped to notification severity
 * - Convenience methods for all app notification types:
 *   round_invite, payment_received, round_finalized, score_update,
 *   round_starting_soon, tournament_invite, card_assignment,
 *   tournament_finalized, payment_request
 * - Listener pattern for React hooks (useNotificationPreferences)
 *
 * @see capacitorService.ts -- Low-level native notification and haptic APIs
 * @see NotificationPreferences.tsx -- UI component for toggling preferences
 */

import {
  isNative,
  showLocalNotification,
  initializeNotifications,
  hapticMedium,
  hapticSuccess,
  hapticLight,
} from './capacitorService';

// ==========================================
// Types
// ==========================================

/** All supported notification event types in the app */
export type NotificationType =
  | 'round_invite'
  | 'payment_received'
  | 'round_finalized'
  | 'score_update'
  | 'round_starting_soon'
  | 'tournament_invite'
  | 'card_assignment'
  | 'tournament_finalized'
  | 'payment_request';

/** Per-type toggle map for which notifications the user wants to receive */
export interface NotificationPreferences {
  round_invite: boolean;
  payment_received: boolean;
  round_finalized: boolean;
  score_update: boolean;
  round_starting_soon: boolean;
  tournament_invite: boolean;
  card_assignment: boolean;
  tournament_finalized: boolean;
  payment_request: boolean;
}

/** Structured notification data for dispatch */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  route?: string;
  data?: Record<string, unknown>;
}

// ==========================================
// Default Preferences
// ==========================================

const DEFAULT_PREFERENCES: NotificationPreferences = {
  round_invite: true,
  payment_received: true,
  round_finalized: true,
  score_update: false, // Off by default - can be noisy during active rounds
  round_starting_soon: true,
  tournament_invite: true,
  card_assignment: true,
  tournament_finalized: true,
  payment_request: true,
};

// ==========================================
// Storage
// ==========================================

const STORAGE_KEY = 'cdg_notification_prefs';
const PERMISSION_KEY = 'cdg_notification_permission_asked';

const loadPreferences = (): NotificationPreferences => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_PREFERENCES };
};

const savePreferences = (prefs: NotificationPreferences): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save notification preferences:', e);
  }
};

// ==========================================
// State
// ==========================================

let preferences: NotificationPreferences = loadPreferences();
let permissionGranted = false;
let initialized = false;
let listeners: Array<(prefs: NotificationPreferences) => void> = [];

// ==========================================
// Haptic mapping per notification type
// ==========================================

const hapticForType: Record<NotificationType, () => Promise<void>> = {
  round_invite: hapticMedium,
  payment_received: hapticSuccess,
  round_finalized: hapticSuccess,
  score_update: hapticLight,
  round_starting_soon: hapticMedium,
  tournament_invite: hapticMedium,
  card_assignment: hapticMedium,
  tournament_finalized: hapticSuccess,
  payment_request: hapticMedium,
};

// ==========================================
// Public API
// ==========================================

/**
 * Initialize the notification system.
 * Requests permission on native platforms.
 * On web, checks existing permission state.
 */
export const initNotifications = async (): Promise<boolean> => {
  if (initialized) return permissionGranted;

  if (isNative()) {
    permissionGranted = await initializeNotifications();
  } else if ('Notification' in window) {
    permissionGranted = Notification.permission === 'granted';
  }

  initialized = true;
  return permissionGranted;
};

/**
 * Request notification permission from the user.
 * Returns true if granted.
 */
export const requestPermission = async (): Promise<boolean> => {
  localStorage.setItem(PERMISSION_KEY, 'true');

  if (isNative()) {
    permissionGranted = await initializeNotifications();
  } else if ('Notification' in window) {
    const result = await Notification.requestPermission();
    permissionGranted = result === 'granted';
  }

  return permissionGranted;
};

/**
 * Check if permission has already been asked
 */
export const hasAskedPermission = (): boolean => {
  return localStorage.getItem(PERMISSION_KEY) === 'true';
};

/**
 * Check if notifications are currently permitted
 */
export const isPermissionGranted = (): boolean => {
  return permissionGranted;
};

/**
 * Send a notification if the type is enabled in user preferences.
 *
 * Dispatches to native (Capacitor) or web (Notification API) depending on
 * platform. Web notifications only fire when the tab is hidden to avoid
 * interrupting active use. Haptic feedback triggers on all supported platforms.
 *
 * @param type - The notification type (checked against user preferences)
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Optional metadata (route for navigation on tap, etc.)
 */
export const notify = async (
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> => {
  // Check preference
  if (!preferences[type]) return;

  const route = data?.route as string | undefined;

  // Dispatch to appropriate notification system
  if (isNative() && permissionGranted) {
    await showLocalNotification(title, body, { type, route, ...data });
  } else if (
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.visibilityState === 'hidden' // Only show web notifications when tab is hidden
  ) {
    try {
      const notification = new Notification(title, {
        body,
        icon: '/icon.jpg',
        tag: type, // Collapse same-type notifications
        data: { type, route, ...data },
      });
      notification.onclick = () => {
        window.focus();
        if (route) {
          window.location.href = route;
        }
        notification.close();
      };
    } catch (e) {
      // Web Notification can fail in some contexts (e.g., insecure origin)
      console.warn('Web notification failed:', e);
    }
  }

  // Always trigger haptics on supported platforms
  const hapticFn = hapticForType[type];
  if (hapticFn) {
    await hapticFn();
  }
};

// ==========================================
// Convenience Methods
// ==========================================

/** Notify: round invitation received */
export const notifyRoundInvite = (roundName: string, hostName: string): Promise<void> =>
  notify('round_invite', 'Round Invitation', `${hostName} invited you to ${roundName}`, {
    route: '/',
  });

/** Notify: payment received (navigates to /wallet) */
export const notifyPaymentReceived = (amountSats: number): Promise<void> =>
  notify('payment_received', 'Payment Received!', `+${amountSats.toLocaleString()} sats`, {
    route: '/wallet',
  });

/** Notify: payment request from host for entry fee */
export const notifyPaymentRequest = (roundName: string, hostName: string, amountSats: number): Promise<void> =>
  notify('payment_request', 'Payment Request',
    `${hostName} requests ${amountSats.toLocaleString()} sats for ${roundName}`, {
    route: '/',
  });

/** Notify: round has been finalized */
export const notifyRoundFinalized = (roundName: string): Promise<void> =>
  notify('round_finalized', 'Round Complete!', `${roundName} has been finalized`, {
    route: '/history',
  });

/** Notify: another player updated their score (off by default -- can be noisy) */
export const notifyScoreUpdate = (playerName: string, holeName?: string): Promise<void> =>
  notify('score_update', 'Score Update', `${playerName} updated their score${holeName ? ` on ${holeName}` : ''}`, {
    route: '/play',
  });

/** Notify: round starting soon (countdown) */
export const notifyRoundStartingSoon = (roundName: string, minutesUntil: number): Promise<void> =>
  notify('round_starting_soon', 'Round Starting Soon', `${roundName} starts in ${minutesUntil} minutes`, {
    route: '/',
  });

/** Notify: tournament invitation received */
export const notifyTournamentInvite = (tournamentName: string, directorName: string): Promise<void> =>
  notify('tournament_invite', 'Tournament Invitation', `${directorName} invited you to ${tournamentName}`, {
    route: '/tournament',
  });

/** Notify: player assigned to a tournament card */
export const notifyCardAssignment = (tournamentName: string, cardName: string): Promise<void> =>
  notify('card_assignment', 'Card Assignment', `You're on ${cardName} in ${tournamentName}`, {
    route: '/tournament',
  });

/** Notify: tournament has been finalized */
export const notifyTournamentFinalized = (tournamentName: string): Promise<void> =>
  notify('tournament_finalized', 'Tournament Complete!', `${tournamentName} has been finalized. Check the standings!`, {
    route: '/tournament',
  });

// ==========================================
// Preferences Management
// ==========================================

/**
 * Get a copy of the current notification preferences.
 *
 * @returns Snapshot of all notification type toggles
 */
export const getPreferences = (): NotificationPreferences => {
  return { ...preferences };
};

/**
 * Toggle a single notification type on or off.
 *
 * @param type - The notification type to update
 * @param enabled - Whether to enable or disable this type
 */
export const setPreference = (type: NotificationType, enabled: boolean): void => {
  preferences = { ...preferences, [type]: enabled };
  savePreferences(preferences);
  notifyListeners();
};

/**
 * Batch-update multiple notification preferences at once.
 *
 * @param prefs - Partial map of types to enable/disable
 */
export const setAllPreferences = (prefs: Partial<NotificationPreferences>): void => {
  preferences = { ...preferences, ...prefs };
  savePreferences(preferences);
  notifyListeners();
};

/**
 * Subscribe to preference changes (for React hooks)
 */
export const onPreferencesChange = (
  listener: (prefs: NotificationPreferences) => void
): (() => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(fn => fn !== listener);
  };
};

const notifyListeners = () => {
  listeners.forEach(fn => fn({ ...preferences }));
};
