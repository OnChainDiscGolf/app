/**
 * @file App.tsx — Root application component for On-Chain Disc Golf.
 *
 * Responsibilities:
 * - Wraps the app in context providers (Network → Onboarding → App → Router)
 * - Defines all routes with lazy-loaded page components for code splitting
 * - Renders the Layout shell (OfflineBanner, BottomNav, global modals)
 * - Manages splash screen animation on cold start
 * - Initializes error capture, Capacitor services, and notifications
 *
 * Layout handles:
 * - Deep link routing for /join/* URLs (Android App Links, iOS Universal Links)
 * - Payment received events (npub.cash custom events)
 * - Wallet reconciliation on app resume / visibility change
 * - Global overlays: LightningStrike animation, RoundSummaryModal, PaymentRequestModal
 *
 * @see context/AppContext.tsx — Composition layer providing useApp() hook
 * @see services/capacitorService.ts — Native platform initialization
 */
import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { OnboardingProvider, useOnboarding } from './context/OnboardingContext';
import { BottomNav } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { LightningStrikeNotification } from './components/LightningStrike';
import { RoundSummaryModal } from './components/RoundSummaryModal';
import { PaymentRequestModal } from './components/PaymentRequestModal';
import { DiscGolfBasketLoader } from './components/DiscGolfBasketLoader';
import { useSwipeBack } from './hooks/useSwipeBack';
import { initErrorCapture, trackNavigation } from './services/feedbackService';
import { initializeCapacitor, setupAppStateListener, setupDeepLinkHandler, isNative } from './services/capacitorService';
import { NetworkProvider, useNetwork } from './context/NetworkContext';
import { OfflineBanner } from './components/OfflineBanner';
import { initNotifications } from './services/notificationService';

// Lazy-loaded page components — each becomes its own chunk
const Home = React.lazy(() => import('./pages/home').then(m => ({ default: m.Home })));
const Wallet = React.lazy(() => import('./pages/wallet').then(m => ({ default: m.Wallet })));
const Scorecard = React.lazy(() => import('./pages/Scorecard').then(m => ({ default: m.Scorecard })));
const Profile = React.lazy(() => import('./pages/profile').then(m => ({ default: m.Profile })));
const Finalization = React.lazy(() => import('./pages/Finalization'));
const Onboarding = React.lazy(() => import('./pages/Onboarding'));
const ProfileSetup = React.lazy(() => import('./pages/ProfileSetup').then(m => ({ default: m.ProfileSetup })));
const RoundDetails = React.lazy(() => import('./pages/RoundDetails').then(m => ({ default: m.RoundDetails })));
const RoundHistory = React.lazy(() => import('./pages/RoundHistory').then(m => ({ default: m.RoundHistory })));
const InviteHandler = React.lazy(() => import('./pages/InviteHandler').then(m => ({ default: m.InviteHandler })));
const Tournament = React.lazy(() => import('./pages/tournament').then(m => ({ default: m.Tournament })));
const Events = React.lazy(() => import('./pages/events').then(m => ({ default: m.Events })));
const JoinHandler = React.lazy(() => import('./pages/JoinHandler'));

const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center">
    <DiscGolfBasketLoader />
  </div>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useSwipeBack(); // Enable global swipe-to-back
  const navigate = useNavigate();
  const location = useLocation();
  const { paymentNotification, setPaymentNotification, lightningStrike, isAuthenticated, roundSummary, setRoundSummary, reconcileOnResume } = useApp();
  const { isOnboarding } = useOnboarding();
  const { connectionQuality, pendingActionCount } = useNetwork();

  // Hide nav during onboarding, finalization, and profile-setup for new users
  const hideNav = !isAuthenticated || isOnboarding || location.pathname === '/finalization' || location.pathname === '/profile-setup';

  // Track navigation for feedback logs
  useEffect(() => {
    trackNavigation(location.pathname);
  }, [location.pathname]);

  // Deep link handling for native app (Universal Links / App Links)
  useEffect(() => {
    const cleanup = setupDeepLinkHandler(
      (url) => {
        // nostrconnect:// handler — already handled by Amber signer flow. Do not log raw deep links; they may contain signer connection material.
        console.log('📱 Nostr Connect deep link received');
      },
      undefined,
      (url) => {
        try {
          const parsed = new URL(url);
          if (parsed.pathname.startsWith('/join/')) {
            navigate(parsed.pathname + parsed.search);
          }
        } catch {
          console.warn('📱 Failed to parse deep link URL');
        }
      }
    );
    return cleanup;
  }, [navigate]);

  // Listen for payment events
  useEffect(() => {
    const handlePayment = (e: CustomEvent) => {
      setPaymentNotification({
        amount: e.detail.amount,
        context: e.detail.context
      });
    };

    window.addEventListener('npubcash-payment-received', handlePayment as EventListener);
    return () => window.removeEventListener('npubcash-payment-received', handlePayment as EventListener);
  }, [setPaymentNotification]);

  // Reconcile wallets when app resumes (visibility change or focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        console.log('📱 App visible - running reconciliation');
        reconcileOnResume();
      }
    };

    const handleFocus = () => {
      if (isAuthenticated) {
        console.log('📱 Window focused - running reconciliation');
        reconcileOnResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, reconcileOnResume]);

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans antialiased selection:bg-brand-primary selection:text-black pb-safe">
      <div className="max-w-md mx-auto min-h-screen relative bg-brand-dark shadow-2xl overflow-hidden flex flex-col safe-top">
        {/* Offline connectivity banner */}
        <OfflineBanner connectionQuality={connectionQuality} pendingActionCount={pendingActionCount} />
        {/* Main content area - pb-20 creates space above fixed nav bar */}
        <div className={`flex-1 flex flex-col relative ${!hideNav ? 'pb-20' : ''}`}>
          {children}
        </div>
        {!hideNav && <BottomNav />}

        {/* Global Lightning Strike Notification */}
        {lightningStrike?.show && (
          <LightningStrikeNotification
            amount={lightningStrike.amount}
            onComplete={() => {
              // Reset lightning strike state
              // Note: We don't navigate here - lightning strikes are pure notifications
            }}
            extendedDuration={false}
          />
        )}

        {/* Legacy payment notification (for QR code payments) */}
        {paymentNotification && !lightningStrike?.show && (
          <LightningStrikeNotification
            amount={paymentNotification.amount}
            onComplete={() => {
              // Context-aware navigation
              if (paymentNotification.context === 'wallet_receive') {
                navigate('/wallet'); // Return to main wallet view
              }
              // For 'buyin_qr', navigation is handled by Home.tsx state
              setPaymentNotification(null);
            }}
            extendedDuration={paymentNotification.context === 'wallet_receive'}
          />
        )}

        {/* Round Summary Modal */}
        {roundSummary && (
          <RoundSummaryModal
            isOpen={roundSummary.isOpen}
            onClose={() => setRoundSummary(null)}
            onDone={() => { setRoundSummary(null); navigate('/', { replace: true }); }}
            roundName={roundSummary.roundName}
            standings={roundSummary.standings}
            payouts={roundSummary.payouts}
            aceWinners={roundSummary.aceWinners}
            acePotAmount={roundSummary.acePotAmount}
            totalPot={roundSummary.totalPot}
            par={roundSummary.par}
            isProcessingPayments={roundSummary.isProcessingPayments}
          />
        )}

        {/* Payment Request Modal (player-side) */}
        <PaymentRequestModal />
      </div>
    </div>
  );
};

// Conditional Route Component for / route
// Show Onboarding if not authenticated, Home otherwise
const HomeOrOnboarding: React.FC = () => {
  const { isAuthenticated } = useApp();
  const { isOnboarding } = useOnboarding();
  const navigate = useNavigate();

  // After Amber login completes, redirect to profile setup
  useEffect(() => {
    if (isAuthenticated && localStorage.getItem('amber_needs_profile_setup')) {
      localStorage.removeItem('amber_needs_profile_setup');
      navigate('/profile-setup', { state: { isRecovery: true }, replace: true });
    }
  }, [isAuthenticated, navigate]);

  // If authenticated, always show Home (never show onboarding to logged-in users)
  if (isAuthenticated) {
    return <Home />;
  }

  // If actively onboarding (started the new user flow), show Onboarding
  if (isOnboarding) {
    return <Onboarding />;
  }

  // Not authenticated, show Onboarding
  return <Onboarding />;
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Initialize error capture for feedback logs and Capacitor services
  useEffect(() => {
    initErrorCapture();
    
    // Initialize Capacitor for native platforms
    initializeCapacitor().then(() => {
      if (isNative()) {
        console.log('📱 Capacitor initialized successfully');
      }
    });

    // Initialize notification service
    initNotifications();

    // Setup app state listener to refresh data when app comes to foreground
    const cleanupAppState = setupAppStateListener(
      () => {
        console.log('📱 App resumed - checking for updates');
        // Could trigger wallet refresh, notification checks, etc.
      },
      () => {
        console.log('📱 App paused');
      }
    );

    return () => {
      cleanupAppState();
    };
  }, []);

  useEffect(() => {
    // Start exit animation after 1 second
    const startExit = setTimeout(() => {
      setIsTransitioning(true);
    }, 1000);

    // Hide splash and start content fade-in after exit completes
    const hideSplash = setTimeout(() => {
      setShowSplash(false);
      setIsLoaded(true);
    }, 1500); // Logo finishes exiting at 1500ms

    return () => {
      clearTimeout(startExit);
      clearTimeout(hideSplash);
    };
  }, []);

  return (
    <NetworkProvider>
    <OnboardingProvider>
      <AppProvider>
        <BrowserRouter>
          <div className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomeOrOnboarding />} />
                  <Route path="/play" element={<Scorecard />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/invite" element={<InviteHandler />} />
                  <Route path="/profile-setup" element={<ProfileSetup />} />
                  <Route path="/finalization" element={<Finalization />} />
                  <Route path="/round-details" element={<RoundDetails />} />
                  <Route path="/history" element={<RoundHistory />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/join/:type/:id" element={<JoinHandler />} />
                  <Route path="/tournament" element={<Tournament />} />
                  <Route path="/tournament/create" element={<Tournament />} />
                </Routes>
              </Suspense>
            </Layout>
          </div>
          <SplashScreen isVisible={showSplash} isTransitioning={isTransitioning} />
        </BrowserRouter>
      </AppProvider>
    </OnboardingProvider>
    </NetworkProvider>
  );
};

export default App;