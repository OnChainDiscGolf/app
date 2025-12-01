/**
 * Capacitor Service
 * 
 * Centralized service for all Capacitor/native functionality.
 * Provides platform detection and graceful fallbacks for web/PWA.
 */

import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';

// ==========================================
// Platform Detection
// ==========================================

/**
 * Check if running in a native Capacitor app (iOS/Android)
 */
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
};

/**
 * Check if a specific plugin is available
 */
export const isPluginAvailable = (pluginName: string): boolean => {
  return Capacitor.isPluginAvailable(pluginName);
};

// ==========================================
// App Lifecycle & Deep Links
// ==========================================

type DeepLinkHandler = (url: string) => void;
let deepLinkListenerActive = false;

/**
 * Initialize deep link handling for Nostr Connect (Amber) and custom schemes
 */
export const setupDeepLinkHandler = (
  onNostrConnect: DeepLinkHandler,
  onCustomScheme?: DeepLinkHandler
): (() => void) => {
  if (!isNative() || deepLinkListenerActive) {
    return () => {}; // No-op cleanup for web
  }

  deepLinkListenerActive = true;

  // Handle deep links when app is already running
  const urlOpenListener = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    const url = event.url;
    console.log('📱 Deep link received:', url);

    if (url.startsWith('nostrconnect://')) {
      onNostrConnect(url);
    } else if (url.startsWith('on-chain-dg://')) {
      onCustomScheme?.(url);
    }
  });

  // Check for deep link on cold start
  App.getLaunchUrl().then((result) => {
    if (result?.url) {
      console.log('📱 App launched with URL:', result.url);
      if (result.url.startsWith('nostrconnect://')) {
        onNostrConnect(result.url);
      } else if (result.url.startsWith('on-chain-dg://')) {
        onCustomScheme?.(result.url);
      }
    }
  });

  // Return cleanup function
  return () => {
    urlOpenListener.remove();
    deepLinkListenerActive = false;
  };
};

/**
 * Listen for app state changes (foreground/background)
 */
export const setupAppStateListener = (
  onResume: () => void,
  onPause: () => void
): (() => void) => {
  if (!isNative()) {
    // Web fallback using visibility API
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onResume();
      } else {
        onPause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  const resumeListener = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      onResume();
    } else {
      onPause();
    }
  });

  return () => resumeListener.remove();
};

// ==========================================
// Status Bar
// ==========================================

/**
 * Configure the status bar for the app
 */
export const configureStatusBar = async (): Promise<void> => {
  if (!isNative()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch (e) {
    console.warn('StatusBar configuration failed:', e);
  }
};

/**
 * Hide the status bar (for immersive experiences)
 */
export const hideStatusBar = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await StatusBar.hide();
  } catch (e) {
    console.warn('Failed to hide status bar:', e);
  }
};

/**
 * Show the status bar
 */
export const showStatusBar = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await StatusBar.show();
  } catch (e) {
    console.warn('Failed to show status bar:', e);
  }
};

// ==========================================
// Splash Screen
// ==========================================

/**
 * Hide the splash screen (call after app is ready)
 */
export const hideSplash = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await SplashScreen.hide();
  } catch (e) {
    console.warn('Failed to hide splash screen:', e);
  }
};

// ==========================================
// Haptic Feedback
// ==========================================

/**
 * Trigger light haptic feedback (for button taps)
 */
export const hapticLight = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Silently fail - haptics are non-critical
  }
};

/**
 * Trigger medium haptic feedback (for selections)
 */
export const hapticMedium = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger heavy haptic feedback (for important actions)
 */
export const hapticHeavy = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger success haptic pattern
 */
export const hapticSuccess = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger warning haptic pattern
 */
export const hapticWarning = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger error haptic pattern
 */
export const hapticError = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    // Silently fail
  }
};

// ==========================================
// Local Notifications
// ==========================================

let notificationsInitialized = false;

/**
 * Initialize local notifications (request permissions)
 */
export const initializeNotifications = async (): Promise<boolean> => {
  if (!isNative()) return false;
  if (notificationsInitialized) return true;

  try {
    const permission = await LocalNotifications.requestPermissions();
    notificationsInitialized = permission.display === 'granted';
    
    if (notificationsInitialized) {
      // Set up notification action listener
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const data = notification.notification.extra;
        console.log('📬 Notification tapped:', data);
        
        // Navigate based on notification type
        if (data?.route) {
          window.location.href = data.route;
        }
      });
    }
    
    return notificationsInitialized;
  } catch (e) {
    console.warn('Failed to initialize notifications:', e);
    return false;
  }
};

/**
 * Show a local notification
 */
export const showLocalNotification = async (
  title: string,
  body: string,
  extra?: Record<string, unknown>
): Promise<void> => {
  if (!isNative() || !notificationsInitialized) return;

  try {
    const options: ScheduleOptions = {
      notifications: [
        {
          id: Date.now(),
          title,
          body,
          extra,
          smallIcon: 'ic_stat_icon',
          iconColor: '#10b981',
        }
      ]
    };
    
    await LocalNotifications.schedule(options);
  } catch (e) {
    console.warn('Failed to show notification:', e);
  }
};

/**
 * Show a payment received notification
 */
export const notifyPaymentReceived = async (amount: number): Promise<void> => {
  await showLocalNotification(
    'Payment Received! ⚡',
    `+${amount.toLocaleString()} sats`,
    { type: 'payment_received', amount, route: '/wallet' }
  );
  await hapticSuccess();
};

/**
 * Show a round invite notification
 */
export const notifyRoundInvite = async (roundName: string, hostName: string): Promise<void> => {
  await showLocalNotification(
    'Round Invitation 🏌️',
    `${hostName} invited you to ${roundName}`,
    { type: 'round_invite', route: '/' }
  );
  await hapticMedium();
};

// ==========================================
// Browser / External Links
// ==========================================

/**
 * Open a URL in the system browser (not in-app)
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  if (isNative()) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' });
    } catch (e) {
      console.warn('Failed to open browser:', e);
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
};

// ==========================================
// Keyboard
// ==========================================

/**
 * Hide the keyboard programmatically
 */
export const hideKeyboard = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Keyboard.hide();
  } catch (e) {
    // Silently fail
  }
};

/**
 * Setup keyboard listeners for UI adjustments
 */
export const setupKeyboardListeners = (
  onShow: (keyboardHeight: number) => void,
  onHide: () => void
): (() => void) => {
  if (!isNative()) {
    return () => {}; // No-op for web
  }

  const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
    onShow(info.keyboardHeight);
  });

  const hideListener = Keyboard.addListener('keyboardWillHide', () => {
    onHide();
  });

  return () => {
    showListener.remove();
    hideListener.remove();
  };
};

// ==========================================
// Initialization
// ==========================================

/**
 * Initialize all Capacitor services
 * Call this once when the app starts
 */
export const initializeCapacitor = async (): Promise<void> => {
  if (!isNative()) {
    console.log('📱 Running in web/PWA mode');
    return;
  }

  console.log(`📱 Running in native mode: ${getPlatform()}`);

  // Configure status bar
  await configureStatusBar();

  // Initialize notifications
  await initializeNotifications();

  // Hide splash screen after a brief delay
  setTimeout(async () => {
    await hideSplash();
  }, 500);
};

