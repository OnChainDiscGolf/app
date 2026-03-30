/**
 * @file NetworkContext.tsx
 * @description Monitors network connectivity at two levels: browser online/offline state
 * and Nostr relay reachability. Exposes a unified `connectionQuality` signal
 * ('good' | 'degraded' | 'offline') for the entire app.
 *
 * On reconnection (transition from offline/degraded to good), this context
 * automatically flushes the offline action queue (actionQueueService) to sync
 * any Nostr events that were queued while offline.
 *
 * @architecture Sits outside the main domain context hierarchy. Consumed by
 * OfflineBanner (UI indicator), WalletContext (wallet reconciliation on reconnect),
 * and RoundContext (re-subscribe to relay events on reconnect).
 *
 * **Effects:**
 * - Effect 1: Browser online/offline event listeners
 * - Effect 2: Periodic relay health check (every 30s when online)
 * - Effect 3: Reconnection detection and action queue flush
 * - Effect 4: Action queue change listener
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getRelays, listEvents } from '../services/nostrService';
import { flush as flushActionQueue, getQueueLength, onQueueChange } from '../services/actionQueueService';

// ==========================================
// Types
// ==========================================

export type ConnectionQuality = 'good' | 'degraded' | 'offline';

export interface NetworkContextType {
  /** Browser reports navigator.onLine */
  isOnline: boolean;
  /** At least one Nostr relay is responding */
  relayConnected: boolean;
  /** Combined quality assessment */
  connectionQuality: ConnectionQuality;
  /** Number of actions waiting to sync */
  pendingActionCount: number;
  /** Force a connectivity check now */
  checkConnectivity: () => Promise<void>;
}

// ==========================================
// Context
// ==========================================

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

// ==========================================
// Provider
// ==========================================

const RELAY_CHECK_INTERVAL_MS = 30_000; // Check relay every 30s
const RELAY_CHECK_TIMEOUT_MS = 5_000;   // 5s timeout for relay ping

/**
 * NetworkProvider - Monitors browser and relay connectivity, manages action queue flush on reconnect.
 *
 * **State managed:**
 * - `isOnline` - Browser's navigator.onLine status
 * - `relayConnected` - Whether at least one Nostr relay responds to a lightweight query
 * - `connectionQuality` - Derived: 'good' (online + relay), 'degraded' (online, no relay), 'offline'
 * - `pendingActionCount` - Number of queued actions waiting for connectivity to flush
 *
 * **Exposed actions:**
 * - `checkConnectivity()` - Force an immediate connectivity check
 */
export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [relayConnected, setRelayConnected] = useState(true); // Assume connected initially
  const [pendingActionCount, setPendingActionCount] = useState(getQueueLength());
  const wasOfflineRef = useRef(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectCallbacksRef = useRef<Array<() => void>>([]);

  // Compute connection quality
  const connectionQuality: ConnectionQuality = !isOnline
    ? 'offline'
    : !relayConnected
      ? 'degraded'
      : 'good';

  // Track previous quality for reconnection detection
  const prevQualityRef = useRef<ConnectionQuality>(connectionQuality);

  /**
   * Checks relay connectivity by firing a lightweight Nostr query against the first 3 relays.
   * Returns true if any relay responds within the timeout, false otherwise.
   * @returns {Promise<boolean>} Whether at least one relay is reachable.
   */
  const checkRelayConnectivity = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;

    try {
      const relays = getRelays();
      // Query for a non-existent event with a short timeout — we just want to know if relays respond
      const events = await listEvents(
        relays.slice(0, 3), // Only check first 3 relays for speed
        [{ kinds: [0], limit: 1, authors: ['0000000000000000000000000000000000000000000000000000000000000000'] }],
        RELAY_CHECK_TIMEOUT_MS
      );
      // If we got back without throwing, relays are reachable (even with 0 events)
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Full connectivity check: updates both browser online state and relay connectivity.
   * Called on demand via the exposed `checkConnectivity` action.
   */
  const checkConnectivity = useCallback(async () => {
    const online = navigator.onLine;
    setIsOnline(online);

    if (!online) {
      setRelayConnected(false);
      return;
    }

    const connected = await checkRelayConnectivity();
    setRelayConnected(connected);
  }, [checkRelayConnectivity]);

  // === Effect 1: Browser Online/Offline Event Listeners ===
  // Listens to the browser's native online/offline events and immediately triggers
  // a relay connectivity check when the browser comes back online.
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Browser reports: online');
      setIsOnline(true);
      // Immediately check relay connectivity
      checkRelayConnectivity().then(setRelayConnected);
    };

    const handleOffline = () => {
      console.log('🌐 Browser reports: offline');
      setIsOnline(false);
      setRelayConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkRelayConnectivity]);

  // === Effect 2: Periodic Relay Health Check ===
  // Polls relay connectivity every 30 seconds while the browser reports online.
  // Stops polling when offline to avoid wasted requests.
  useEffect(() => {
    if (!isOnline) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Start periodic checks
    checkIntervalRef.current = setInterval(async () => {
      const connected = await checkRelayConnectivity();
      setRelayConnected(connected);
    }, RELAY_CHECK_INTERVAL_MS);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isOnline, checkRelayConnectivity]);

  // === Effect 3: Reconnection Detection and Action Queue Flush ===
  // Detects transition from offline/degraded to 'good' quality. On reconnect,
  // flushes the offline action queue (pending Nostr publishes) and notifies
  // registered reconnect callbacks so other contexts can re-subscribe.
  useEffect(() => {
    const prevQuality = prevQualityRef.current;
    prevQualityRef.current = connectionQuality;

    // Detect transition from offline/degraded to good
    if (connectionQuality === 'good' && prevQuality !== 'good' && wasOfflineRef.current) {
      console.log('🌐 Connection restored - flushing action queue');
      flushActionQueue().then(({ succeeded, failed }) => {
        if (succeeded > 0) {
          console.log(`🌐 Synced ${succeeded} pending actions`);
        }
        setPendingActionCount(failed);
      });

      // Notify reconnect callbacks
      reconnectCallbacksRef.current.forEach(cb => {
        try { cb(); } catch (e) { console.warn('Reconnect callback error:', e); }
      });
    }

    if (connectionQuality !== 'good') {
      wasOfflineRef.current = true;
    }
  }, [connectionQuality]);

  // === Effect 4: Action Queue Change Listener ===
  // Subscribes to the action queue service to keep `pendingActionCount` in sync
  // with the number of queued offline actions.
  useEffect(() => {
    return onQueueChange(setPendingActionCount);
  }, []);

  const value: NetworkContextType = {
    isOnline,
    relayConnected,
    connectionQuality,
    pendingActionCount,
    checkConnectivity,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

// ==========================================
// Hook
// ==========================================

/**
 * Hook to access network connectivity state.
 * @returns {NetworkContextType} Online status, relay connectivity, connection quality, pending action count, and checkConnectivity action.
 * @throws {Error} If called outside of NetworkProvider.
 */
export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

/**
 * Register a callback to be invoked when connectivity is restored.
 * Used by WalletContext and RoundContext to re-subscribe to relay events after going offline.
 * @param {() => void} callback - Function to call on reconnection.
 * @returns {() => void} Cleanup function that removes the listener.
 */
export const onReconnect = (callback: () => void): (() => void) => {
  // Note: This uses a module-level ref that is set by the provider.
  // For now, we use a simpler event-based approach.
  const handler = () => callback();
  window.addEventListener('cdg-reconnect', handler);
  return () => window.removeEventListener('cdg-reconnect', handler);
};
