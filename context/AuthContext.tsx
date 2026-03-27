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
import { bytesToHex } from '@noble/hashes/utils';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [authMethod, setAuthMethod] = useState<'local' | 'nip46' | 'amber' | null>(null);
  const [currentUserPubkey, setCurrentUserPubkey] = useState('');
  const [authSource, setAuthSourceState] = useState<AuthSource | null>(() => getAuthSource());
  const [hasUnifiedBackup, setHasUnifiedBackup] = useState<boolean>(() => hasUnifiedSeed());

  useEffect(() => {
    const initSession = async () => {
      let session = getSession();

      // Check for completed Amber connection
      const amberResult = await completeAmberConnection();
      if (amberResult) {
        console.log('✅ Amber connection completed:', amberResult);
        session = {
          method: 'amber',
          pk: amberResult.userPubkey,
          sk: ''
        };
        localStorage.removeItem('is_guest_mode');
        localStorage.setItem('amber_ephemeral_sk', bytesToHex(amberResult.ephemeralSk));
        localStorage.setItem('amber_relay', amberResult.relay);
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

  const loginNip46 = async (bunkerUrl: string) => {
    const { pk } = await loginWithNip46(bunkerUrl);
    setCurrentUserPubkey(pk);
    setAuthMethod('nip46');
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('is_guest_mode');
  };

  const loginAmber = async () => {
    await loginWithAmber();
  };

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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
