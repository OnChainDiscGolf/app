/**
 * @file Finalization.tsx
 *
 * Post-onboarding finalization screen -- handles all persistence and network
 * operations after a new user completes the onboarding wizard.
 *
 * Tasks executed (in order):
 * 1. Store identity (mnemonic + keys) in localStorage via mnemonicService.
 * 2. Publish profile metadata (Kind 0) to Nostr relays.
 * 3. Register Lightning address with npub.cash gateways.
 * 4. Initialize wallet backup and sync (encrypted Nostr backup).
 * 5. Sync contacts and recent players from Nostr network.
 * 6. Initialize Breez Lightning wallet in background (non-blocking).
 *
 * Shows AccountCreatedAnimation (reverse of the logout explosion) while tasks
 * complete. Animation is quick (~2s) to match the fast initialization process.
 * On completion, clears OnboardingContext and navigates to Home.
 *
 * Route: /finalization
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../context/OnboardingContext';
import { useApp } from '../context/AppContext';
import { AccountCreatedAnimation } from '../KeypairAnimations';
import {
    storeMnemonicEncrypted,
    setAuthSource,
    setUnifiedSeed
} from '../services/mnemonicService';
import {
    publishProfileWithKey,
    publishWalletBackup
} from '../services/nostrService';
import { registerWithAllGateways } from '../services/npubCashService';
import {
    initializeBreez,
    getLightningAddress,
    registerLightningAddress
} from '../services/breezService';
import { BREEZ_API_KEY } from '../constants';
import { UserProfile } from '../types';

/**
 * Finalization page -- persists identity, publishes profile to Nostr,
 * registers Lightning address, and initializes wallets after onboarding.
 */
export const Finalization: React.FC = () => {
    const navigate = useNavigate();
    const { identity, profile, lightningAddressType, clearOnboarding } = useOnboarding();
    const {
        setAuthState,
        setUserProfileState,
        setContactsState,
        setRecentPlayersState,
        restoreWalletFromBackup,
        initializeSubscriptions
    } = useApp();

    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasStarted = useRef(false);

    useEffect(() => {
        if (!identity || hasStarted.current) return;
        hasStarted.current = true;

        const runFinalization = async () => {
            try {
                // =====================================================
                // TASK 1: Store Identity in localStorage
                // =====================================================
                console.log('🔐 [Finalization] Storing identity...');

                // Store Nostr keys
                localStorage.setItem('nostr_sk', identity.privateKeyHex);
                localStorage.setItem('nostr_pk', identity.publicKey);
                localStorage.setItem('auth_method', 'local');
                localStorage.removeItem('is_guest_mode');

                // Store encrypted mnemonic
                storeMnemonicEncrypted(identity.mnemonic, identity.publicKey, false);
                setAuthSource('mnemonic');
                setUnifiedSeed(true);

                // Determine which lightning address to use based on user's selection
                const selectedLightningAddress = lightningAddressType === 'breez'
                    ? identity.breezLightningAddress
                    : identity.npubcashLightningAddress;

                // Store both lightning addresses (for future reference)
                localStorage.setItem('cdg_lightning_address', selectedLightningAddress);
                localStorage.setItem('cdg_breez_lightning_address', identity.breezLightningAddress);
                localStorage.setItem('cdg_npubcash_lightning_address', identity.npubcashLightningAddress);
                localStorage.setItem('cdg_lightning_address_type', lightningAddressType);

                console.log(`✅ [Finalization] Identity stored securely`);
                console.log(`⚡ [Finalization] Selected Lightning Address (${lightningAddressType}): ${selectedLightningAddress}`);

                // =====================================================
                // TASK 2: Publish Profile Metadata to Nostr
                // =====================================================
                console.log('📤 [Finalization] Publishing profile...');

                const fullProfile: UserProfile = {
                    name: profile.name || 'Disc Golfer',
                    about: '',
                    picture: profile.picture || '',
                    lud16: selectedLightningAddress,
                    nip05: '',
                    pdga: profile.pdga
                };

                await publishProfileWithKey(fullProfile, identity.privateKey);

                // Update app state
                setUserProfileState(fullProfile);
                localStorage.setItem('cdg_user_profile', JSON.stringify(fullProfile));

                console.log('✅ [Finalization] Profile published to Nostr');

                // =====================================================
                // TASK 3: Register Lightning Address with Gateways
                // =====================================================
                console.log('⚡ [Finalization] Registering lightning address...');

                try {
                    const registrations = await registerWithAllGateways();
                    const successful = registrations.filter(r => r.success).length;
                    console.log(`✅ [Finalization] Registered with ${successful}/${registrations.length} gateways`);
                } catch (e) {
                    console.warn('⚠️ [Finalization] Gateway registration partial failure:', e);
                    // Don't fail the whole flow for gateway issues
                }

                // =====================================================
                // TASK 4: Initialize Wallet Backup
                // =====================================================
                console.log('💰 [Finalization] Initializing wallet...');

                // New user flow - no existing backup possible, publish empty backup directly
                console.log('📦 [Finalization] Creating initial wallet backup...');
                await publishWalletBackup([], [], [], []);

                console.log('✅ [Finalization] Wallet initialized');

                // =====================================================
                // TASK 5: Initialize Real-time Subscriptions
                // =====================================================
                // Note: We skip fetching contacts, recent players, and historical payments
                // because this is a brand new keypair - there's nothing to fetch.
                // These will be populated naturally as the user plays rounds and adds contacts.
                console.log('🔄 [Finalization] Setting up real-time subscriptions...');
                initializeSubscriptions(identity.publicKey);

                console.log('✅ [Finalization] Subscriptions initialized');

                // =====================================================
                // TASK 6: Initialize Breez Lightning Wallet (Background)
                // =====================================================
                console.log('⚡ [Finalization] Starting Breez Lightning wallet initialization...');

                // Start Breez initialization in background - don't await
                // This allows onboarding to complete while Breez initializes
                const breezConfig = {
                    apiKey: BREEZ_API_KEY,
                    environment: 'production' as const
                };
                initializeBreez(identity.mnemonic, breezConfig).then(async (success) => {
                    if (success) {
                        console.log('✅ [Finalization] Breez SDK initialized in background');

                        // Try to get or register Lightning address
                        try {
                            let lnAddressInfo = await getLightningAddress();

                            if (!lnAddressInfo) {
                                // Try to register one based on pubkey
                                lnAddressInfo = await registerLightningAddress(identity.publicKey);
                            }

                            if (lnAddressInfo) {
                                const breezLnAddress = lnAddressInfo.lightningAddress;
                                localStorage.setItem('cdg_breez_lightning_address', breezLnAddress);
                                console.log(`⚡ [Finalization] Breez Lightning address: ${breezLnAddress}`);

                                // Optionally update profile with Breez address
                                // This would override the npub.cash fallback
                                // Uncomment if you want Breez address to be primary:
                                // const updatedProfile = { ...fullProfile, lud16: breezLnAddress };
                                // await publishProfileWithKey(updatedProfile, identity.privateKey);
                            }
                        } catch (e) {
                            console.warn('⚠️ [Finalization] Lightning address setup deferred:', e);
                        }
                    }
                }).catch((e) => {
                    console.warn('⚠️ [Finalization] Breez initialization will retry:', e);
                    // Breez service has infinite retry, so this will eventually succeed
                });

                // =====================================================
                // COMPLETE: Update Auth State and Navigate
                // =====================================================

                // Update app auth state
                setAuthState({
                    isAuthenticated: true,
                    isGuest: false,
                    currentUserPubkey: identity.publicKey,
                    authMethod: 'local'
                });

                // Clear onboarding context
                clearOnboarding();

                // Mark as complete for visual feedback
                setIsComplete(true);

                // Brief delay to show success state
                await new Promise(resolve => setTimeout(resolve, 800));

                // Navigate to Home (replace so back doesn't return to finalization)
                navigate('/', { replace: true });

            } catch (e) {
                console.error('❌ [Finalization] Error:', e);
                setError(e instanceof Error ? e.message : 'An unexpected error occurred');
            }
        };

        runFinalization();
    }, [identity, profile, navigate, clearOnboarding, setAuthState, setUserProfileState, setContactsState, setRecentPlayersState, restoreWalletFromBackup, initializeSubscriptions]);

    // Redirect if no identity (shouldn't happen in normal flow)
    // Don't show error if finalization has already started - identity may be cleared by clearOnboarding()
    if (!identity && !hasStarted.current) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-brand-dark via-slate-900 to-black">
                <div className="text-red-400 text-center p-6">
                    <p className="text-lg font-bold mb-2">Something went wrong</p>
                    <p className="text-sm text-slate-400 mb-4">No identity found. Please start over.</p>
                    <button
                        onClick={() => navigate('/', { replace: true })}
                        className="px-6 py-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-brand-dark via-slate-900 to-black">
                <div className="text-center p-6 max-w-sm">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <p className="text-lg font-bold text-white mb-2">Setup Failed</p>
                    <p className="text-sm text-slate-400 mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/', { replace: true })}
                        className="px-6 py-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Show the account created animation (reverse of logout animation)
    return <AccountCreatedAnimation isComplete={isComplete} />;
};

export default Finalization;
