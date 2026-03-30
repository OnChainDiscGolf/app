/**
 * @file useNotificationPreferences.ts
 * @description React hook for reading and updating push notification preferences
 * with automatic re-rendering on changes. Wraps the notificationService's
 * preference storage and browser/native permission APIs.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  NotificationType,
  NotificationPreferences,
  getPreferences,
  setPreference,
  onPreferencesChange,
  requestPermission,
  isPermissionGranted,
  hasAskedPermission,
} from '../services/notificationService';

/**
 * Return type for the {@link useNotificationPreferences} hook.
 *
 * @property preferences - Current preference map (`{ [NotificationType]: boolean }`).
 * @property setPreference - Toggle a specific notification type on or off.
 * @property permissionGranted - Whether the browser/OS notification permission is granted.
 * @property hasAskedPermission - Whether the user has been prompted for permission.
 * @property requestPermission - Async function to request notification permission from the user.
 */
interface UseNotificationPreferencesReturn {
  preferences: NotificationPreferences;
  setPreference: (type: NotificationType, enabled: boolean) => void;
  permissionGranted: boolean;
  hasAskedPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

/**
 * Hook for managing notification preferences.
 *
 * Reads the current preference state from `notificationService`, subscribes
 * to changes for automatic re-renders, and exposes setters for individual
 * notification types. Also wraps the browser notification permission flow.
 *
 * @returns {@link UseNotificationPreferencesReturn}
 */
export const useNotificationPreferences = (): UseNotificationPreferencesReturn => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(getPreferences);
  const [permGranted, setPermGranted] = useState(isPermissionGranted);
  const [hasAsked, setHasAsked] = useState(hasAskedPermission);

  useEffect(() => {
    return onPreferencesChange(setPreferences);
  }, []);

  const handleSetPreference = useCallback((type: NotificationType, enabled: boolean) => {
    setPreference(type, enabled);
  }, []);

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermission();
    setPermGranted(granted);
    setHasAsked(true);
    return granted;
  }, []);

  return {
    preferences,
    setPreference: handleSetPreference,
    permissionGranted: permGranted,
    hasAskedPermission: hasAsked,
    requestPermission: handleRequestPermission,
  };
};
