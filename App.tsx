import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { OnboardingProvider, useOnboarding } from './context/OnboardingContext';
import { BottomNav } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { LightningStrikeNotification } from './components/LightningStrike';
import { RoundSummaryModal } from './components/RoundSummaryModal';
import { Home } from './pages/Home';
import { Scorecard } from './pages/Scorecard';
import { Wallet } from './pages/Wallet';
import { Profile } from './pages/Profile';
import { InviteHandler } from './pages/InviteHandler';
import { ProfileSetup } from './pages/ProfileSetup';
import { RoundDetails } from './pages/RoundDetails';
import { Onboarding } from './pages/Onboarding';
import { Finalization } from './pages/Finalization';
import { RoundHistory } from './pages/RoundHistory';
import { useSwipeBack } from './hooks/useSwipeBack';
import { initErrorCapture, trackNavigation } from './services/feedbackService';
import { initializeCapacitor, setupAppStateListener, isNative } from './services/capacitorService';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useSwipeBack(); // Enable global swipe-to-back
  const navigate = useNavigate();
  const location = useLocation();
  const { paymentNotification, setPaymentNotification, lightningStrike, isAuthenticated, roundSummary, setRoundSummary, reconcileOnResume } = useApp();
  const { isOnboarding } = useOnboarding();

  // Hide nav during onboarding, finalization, and profile-setup for new users
  const hideNav = !isAuthenticated || isOnboarding || location.pathname === '/finalization' || location.pathname === '/profile-setup';

  // Track navigation for feedback logs
  useEffect(() => {
    trackNavigation(location.pathname);
  }, [location.pathname]);

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
      </div>
    </div>
  );
};

// Conditional Route Component for / route
// Show Onboarding if not authenticated, Home otherwise
const HomeOrOnboarding: React.FC = () => {
  const { isAuthenticated } = useApp();
  const { isOnboarding } = useOnboarding();
  
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
    <OnboardingProvider>
      <AppProvider>
        <BrowserRouter>
          <div className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <Layout>
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
              </Routes>
            </Layout>
          </div>
          <SplashScreen isVisible={showSplash} isTransitioning={isTransitioning} />
        </BrowserRouter>
      </AppProvider>
    </OnboardingProvider>
  );
};

export default App;