/**
 * @file NotificationPreferences.tsx
 * @description Settings panel with toggle switches for each notification type.
 * Renders a permission request banner when notifications are not yet granted,
 * and individual on/off toggles for: round invitations, payments received,
 * round finalized, score updates, round starting soon, tournament invitations,
 * card assignments, and tournament finalized.
 *
 * Intended to be rendered inside the Profile settings view.
 */

import React from 'react';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { NotificationType } from '../services/notificationService';
import { Icons } from './Icons';

/** Configuration for each notification type toggle displayed in the preferences panel. */
const NOTIFICATION_OPTIONS: Array<{
  type: NotificationType;
  label: string;
  description: string;
}> = [
  {
    type: 'round_invite',
    label: 'Round Invitations',
    description: 'When someone invites you to a round',
  },
  {
    type: 'payment_received',
    label: 'Payments Received',
    description: 'When you receive sats',
  },
  {
    type: 'round_finalized',
    label: 'Round Finalized',
    description: 'When a round you played in is complete',
  },
  {
    type: 'score_update',
    label: 'Score Updates',
    description: 'When a cardmate updates their score',
  },
  {
    type: 'round_starting_soon',
    label: 'Round Starting Soon',
    description: 'Reminder before a scheduled round',
  },
  {
    type: 'tournament_invite',
    label: 'Tournament Invitations',
    description: 'When someone invites you to a tournament',
  },
  {
    type: 'card_assignment',
    label: 'Card Assignments',
    description: 'When you are assigned to a tournament card',
  },
  {
    type: 'tournament_finalized',
    label: 'Tournament Finalized',
    description: 'When a tournament you played in is complete',
  },
];

/**
 * Notification preferences settings panel.
 *
 * Shows a permission request banner if push notifications have not been
 * granted, followed by toggle switches for each notification category.
 * State is managed by the {@link useNotificationPreferences} hook and
 * persisted to localStorage.
 *
 * @returns The notification preferences UI with permission banner and toggles.
 */
export const NotificationPreferences: React.FC = () => {
  const {
    preferences,
    setPreference,
    permissionGranted,
    hasAskedPermission,
    requestPermission,
  } = useNotificationPreferences();

  return (
    <div className="space-y-3">
      {/* Permission request banner */}
      {!permissionGranted && (
        <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icons.AlertTriangle size={20} className="text-brand-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                {hasAskedPermission
                  ? 'Notifications are blocked'
                  : 'Enable notifications'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {hasAskedPermission
                  ? 'Update your browser or device settings to receive notifications.'
                  : 'Get notified about round invites, payments, and more.'}
              </p>
              {!hasAskedPermission && (
                <button
                  onClick={requestPermission}
                  className="mt-2 px-3 py-1.5 bg-brand-primary text-black text-xs font-bold rounded-lg hover:bg-brand-primary/90 transition-colors"
                >
                  Enable
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification type toggles */}
      {NOTIFICATION_OPTIONS.map(({ type, label, description }) => (
        <div
          key={type}
          className="flex items-center justify-between py-2"
        >
          <div className="flex-1 mr-4">
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
          <button
            onClick={() => setPreference(type, !preferences[type])}
            className={`
              relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
              ${preferences[type]
                ? 'bg-brand-primary'
                : 'bg-slate-700'
              }
            `}
            role="switch"
            aria-checked={preferences[type]}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                ${preferences[type] ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>
      ))}
    </div>
  );
};
