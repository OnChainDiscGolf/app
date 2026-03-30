/**
 * @file OfflineBanner.tsx
 * @description Sticky notification banner displayed at the top of the viewport
 * when the app detects degraded or lost network connectivity. Shows the
 * connection state ("You're offline" or "Connection unstable") and the
 * count of pending actions queued for sync.
 */

import React from 'react';
import { ConnectionQuality } from '../context/NetworkContext';
import { Icons } from './Icons';

/**
 * Props for the {@link OfflineBanner} component.
 *
 * @property connectionQuality - Current network quality: `'good'`, `'degraded'`, or `'offline'`.
 * @property pendingActionCount - Number of queued actions waiting to sync when connectivity returns.
 */
interface OfflineBannerProps {
  connectionQuality: ConnectionQuality;
  pendingActionCount: number;
}

/**
 * Connectivity status banner.
 *
 * Renders a color-coded bar (red for offline, yellow for degraded) with
 * an icon and message. Hidden when `connectionQuality` is `'good'`. If
 * there are pending actions, their count is appended to the message.
 * Animates in from the top with a slide transition.
 *
 * @param props - {@link OfflineBannerProps}
 * @returns The banner element, or `null` when connectivity is good.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  connectionQuality,
  pendingActionCount,
}) => {
  if (connectionQuality === 'good') return null;

  const isOffline = connectionQuality === 'offline';
  const bgColor = isOffline
    ? 'bg-red-900/90 border-red-700/50'
    : 'bg-yellow-900/90 border-yellow-700/50';
  const iconColor = isOffline ? 'text-red-400' : 'text-yellow-400';
  const textColor = isOffline ? 'text-red-200' : 'text-yellow-200';

  return (
    <div
      className={`
        ${bgColor} border-b backdrop-blur-sm
        px-4 py-2 flex items-center justify-center gap-2
        animate-in slide-in-from-top duration-300
      `}
    >
      {isOffline ? (
        <Icons.WifiOff size={16} className={iconColor} />
      ) : (
        <Icons.AlertTriangle size={16} className={iconColor} />
      )}
      <span className={`text-xs font-medium ${textColor}`}>
        {isOffline
          ? "You're offline"
          : 'Connection unstable'}
        {pendingActionCount > 0 && (
          <span className="ml-1 opacity-75">
            &middot; {pendingActionCount} change{pendingActionCount !== 1 ? 's' : ''} pending sync
          </span>
        )}
      </span>
    </div>
  );
};
