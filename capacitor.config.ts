import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.onchain.discgolf',
  appName: 'On-Chain Disc Golf',
  webDir: 'dist',

  // Server config
  server: {
    // Use HTTPS scheme for WebSocket connections (Nostr relays)
    androidScheme: 'https',
    iosScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#10b981',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },

  // Android-specific settings
  android: {
    allowMixedContent: true, // Required for WebSocket connections
    backgroundColor: '#0f172a',
    // Enable deep links
    appendUserAgent: 'OnChainDiscGolf/Android',
  },

  // iOS-specific settings
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f172a',
    preferredContentMode: 'mobile',
    appendUserAgent: 'OnChainDiscGolf/iOS',
  },
};

export default config;
