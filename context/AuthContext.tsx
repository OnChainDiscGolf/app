/**
 * @file AuthContext.tsx
 * @description Manages authentication state and login methods for the application.
 *
 * Supports four login methods:
 * - **nsec**: Direct Nostr private key (hex-encoded via NIP-19 nsec)
 * - **mnemonic**: BIP-39 12-word seed phrase, derived to Nostr keys via NIP-06
 * - **NIP-46**: Remote signing via bunker URL (keys never leave the signer)
 * - **Amber**: Android Nostr signer app (native intent-based signing)
 *
 * On mount, attempts to restore a previous session from localStorage. Also checks
 * for a completed Amber connection flow (redirect-based).
 *
 * @architecture Innermost context in the provider hierarchy. All other domain contexts
 * (WalletContext, ProfileContext, RoundContext, TournamentContext) depend on AuthContext
 * for `currentUserPubkey` and `isAuthenticated`. Exposes raw state setters so the
 * AppContext composition layer can perform cross-cutting operations like logout.
 *
 * **Effects:**
 * - Effect 1: Session restoration on mount (checks localStorage + Amber redirect)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getSession,
  loginWithNsec,
  loginWithNip46,
  loginWithAmber,
  loginWithMnemonic as nostrLoginWithMnemonic,
} from '../services/nostrService';
import {
  getAuthSource,
  hasStoredMnemonic,
  hasUnifiedSeed,
  AuthSource,
  clearMnemonicStorage,
} from '../services/mnemonicService';
import { completeAmberConnection } from '../services/amberSigner';

export interface AuthContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  authMethod: 'local' | 'nip46' | 'amber' | null;
  currentUserPubkey: string;
  authSource: AuthSource | null;
  hasUnifiedBackup: boolean;

  // Simple login actions (only affect auth state)
  loginNsec: (nsec: string) => Promise<void>;
  loginMnemonic: (mnemonic: string) => Promise<void>;
  loginNip46: (bunkerUrl: string) => Promise<void>;
  loginAmber: () => Promise<void>;

  // State setters for finalization flow
  setAuthState: (state: {
    isAuthenticated: boolean;
    isGuest: boolean;
    currentUserPubkey: string;
    authMethod: 'local' | 'nip46' | 'amber' | null;
  }) => void;

  // For cross-cutting logout (called by composition layer)
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  setIsGuest: React.Dispatch<React.SetStateAction<boolean>>;
  setAuthMethod: React.Dispatch<React.SetStateAction<'local' | 'nip46' | 'amber' | null>>;
  setCurrentUserPubkey: React.Dispatch<React.SetStateAction<string>>;
  setAuthSourceState: React.Dispatch<React.SetStateAction<AuthSource | null>>;
  setHasUnifiedBackup: React.Dispatch<React.SetStateAction<boolean>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider - Manages keypair identity, login methods, and session restoration.
 *
 * **State managed:**
 * - `isAuthenticated` - Whether the user has a valid session
 * - `isGuest` - Whether the user is in guest/ephemeral mode
 * - `authMethod` - Current login method ('local' | 'nip46' | 'amber' | null)
 * - `currentUserPubkey` - Hex-encoded Nostr public key of the logged-in user
 * - `authSource` - How the private key was derived ('nsec' | 'mnemonic' | null)
 * - `hasUnifiedBackup` - Whether a unified BIP-39 seed exists (enables Breez wallet)
 *
 * **Exposed actions:**
 * - `loginNsec(nsec)` - Log in with a NIP-19 nsec string
 * - `loginMnemonic(mnemonic)` - Log in with a BIP-39 mnemonic (NIP-06 derivation)
 * - `loginNip46(bunkerUrl)` - Log in via NIP-46 remote signer
 * - `loginAmber()` - Initiate Amber signer flow (Android only)
 * - `setAuthState()` - Batch update for finalization flow
 * - Raw state setters for cross-cutting logout in AppContext
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [authMethod, setAuthMethod] = useState<'local' | 'nip46' | 'amber' | null>(null);
  const [currentUserPubkey, setCurrentUserPubkey] = useState('');
  const [authSource, setAuthSourceState] = useState<AuthSource | null>(() => getAuthSource());
  const [hasUnifiedBackup, setHasUnifiedBackup] = useState<boolean>(() => hasUnifiedSeed());

  // === Effect 1: Session Restoration ===
  // On mount, checks for an existing Nostr session in localStorage and restores it.
  // Also detects a completed Amber signer connection (returned from Android intent redirect)
  // and promotes it to a full session.
  useEffect(() => {
    const initSession = async () => {
      let session = getSession();

      // Check for completed Amber connection (user returned from Amber app).
      // completeAmberConnection() reads the pending state from localStorage,
      // waits for Amber's NIP-46 ack, and persists the session internally.
      const amberResult = await completeAmberConnection();
      if (amberResult) {
        console.log('✅ Amber connection completed:', amberResult.userPubkey);
        session = {
          method: 'amber' as const,
          pk: amberResult.userPubkey,
          sk: undefined
        };
        localStorage.removeItem('is_guest_mode');
      }

      if (session) {
        setCurrentUserPubkey(session.pk);
        setAuthMethod(session.method);
        setIsAuthenticated(true);
        setIsGuest(false);
      } else {
        setIsAuthenticated(false);
        setIsGuest(false);
      }
    };
    initSession();
  }, []);

  /**
   * Log in with a NIP-19 nsec private key string.
   * Sets auth source to 'nsec' and marks unified backup as false (no mnemonic).
   * @param {string} nsec - NIP-19 encoded private key (nsec1...)
   */
  const loginNsec = async (nsec: string) => {
    const { pk } = loginWithNsec(nsec);
    setCurrentUserPubkey(pk);
    setAuthMethod('local');
    setAuthSourceState('nsec');
    setHasUnifiedBackup(false);
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
  };

  /**
   * Log in with a BIP-39 mnemonic (12-word seed phrase).
   * Derives Nostr keys via NIP-06 standard derivation path.
   * Enables unified backup (mnemonic backs both identity and Breez wallet).
   * @param {string} mnemonic - Space-separated BIP-39 mnemonic words
   */
  const loginMnemonic = async (mnemonic: string) => {
    const { pk } = nostrLoginWithMnemonic(mnemonic);
    setCurrentUserPubkey(pk);
    setAuthMethod('local');
    setAuthSourceState('mnemonic');
    setHasUnifiedBackup(true);
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
  };

  /**
   * Log in via NIP-46 remote signer (bunker URL).
   * Private keys never leave the remote signer; signing is done over relay messages.
   * @param {string} bunkerUrl - NIP-46 bunker connection URL
   */
  const loginNip46 = async (bunkerUrl: string) => {
    const { pk } = await loginWithNip46(bunkerUrl);
    setCurrentUserPubkey(pk);
    setAuthMethod('nip46');
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
  };

  /**
   * Initiate login via Amber signer (Android Nostr signing app).
   * Redirects to Amber via Android intent; completion is handled in Effect 1 on return.
   */
  const loginAmber = async () => {
    await loginWithAmber();
  };

  /**
   * Batch update of auth state. Used by the finalization flow to atomically
   * transition from onboarding ephemeral state to a fully authenticated session.
   */
  const setAuthState = useCallback((state: {
    isAuthenticated: boolean;
    isGuest: boolean;
    currentUserPubkey: string;
    authMethod: 'local' | 'nip46' | 'amber' | null;
  }) => {
    setIsAuthenticated(state.isAuthenticated);
    setIsGuest(state.isGuest);
    setCurrentUserPubkey(state.currentUserPubkey);
    setAuthMethod(state.authMethod);
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isGuest,
    authMethod,
    currentUserPubkey,
    authSource,
    hasUnifiedBackup,
    loginNsec,
    loginMnemonic,
    loginNip46,
    loginAmber,
    setAuthState,
    setIsAuthenticated,
    setIsGuest,
    setAuthMethod,
    setCurrentUserPubkey,
    setAuthSourceState,
    setHasUnifiedBackup,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access authentication state and login actions.
 * @returns {AuthContextType} Auth state, login methods, and state setters.
 * @throws {Error} If called outside of AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
