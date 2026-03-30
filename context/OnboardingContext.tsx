/**
 * @file OnboardingContext.tsx
 * @description Ephemeral identity state management during the new-user onboarding flow.
 *
 * This context holds a generated Nostr keypair, mnemonic, and Lightning addresses
 * entirely in memory. Nothing is persisted to localStorage or published to relays
 * until the Finalization step commits the identity via AppContext.
 *
 * **Onboarding Flow:**
 * Welcome (generate identity) -> Profile Setup (collect name/picture/PDGA) ->
 * Mnemonic Backup (user writes down 12 words) -> Finalization (persist & publish) -> Home
 *
 * @architecture Part of the context layer. Consumed by Onboarding.tsx page.
 * Sits outside the main AuthContext/WalletContext/ProfileContext hierarchy;
 * the finalization step bridges onboarding state into those contexts.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { generateMnemonic, deriveNostrKeyFromMnemonic } from '../services/mnemonicService';
import { generateCustomLightningAddress } from '../services/breezService';
import { nip19 } from 'nostr-tools';

// Lightning address type selection
export type LightningAddressType = 'breez' | 'npubcash';

interface OnboardingIdentity {
    mnemonic: string;
    privateKey: Uint8Array;
    privateKeyHex: string;
    publicKey: string;
    breezLightningAddress: string;     // xxx@breez.fun (default)
    npubcashLightningAddress: string;  // npub...@npubx.cash
}

interface OnboardingProfile {
    name: string;
    picture: string;
    pdga?: string;
}

interface OnboardingContextType {
    // Identity (generated at Welcome)
    identity: OnboardingIdentity | null;

    // Profile data (collected at Profile Setup)
    profile: OnboardingProfile;

    // Lightning address type selection (default: breez)
    lightningAddressType: LightningAddressType;
    setLightningAddressType: (type: LightningAddressType) => void;

    // Actions
    generateIdentity: () => OnboardingIdentity;
    setProfileData: (data: Partial<OnboardingProfile>) => void;
    clearOnboarding: () => void;

    // State
    isOnboarding: boolean;
    setIsOnboarding: (value: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

/**
 * OnboardingProvider - Manages ephemeral identity and profile state during onboarding.
 *
 * **State managed:**
 * - `identity` - Generated keypair, mnemonic, and Lightning addresses (null until Welcome)
 * - `profile` - User-entered name, picture URL, and optional PDGA number
 * - `lightningAddressType` - Which Lightning address format to use ('breez' or 'npubcash')
 * - `isOnboarding` - Flag indicating the onboarding flow is active
 *
 * **Exposed actions:**
 * - `generateIdentity()` - Creates a new BIP-39 mnemonic and derives Nostr keys + Lightning addresses
 * - `setProfileData()` - Partial update of profile fields
 * - `clearOnboarding()` - Resets all ephemeral state (called on cancel or after finalization)
 */
export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [identity, setIdentity] = useState<OnboardingIdentity | null>(null);
    const [profile, setProfile] = useState<OnboardingProfile>({
        name: 'Disc Golfer',
        picture: '',
        pdga: undefined
    });
    const [isOnboarding, setIsOnboarding] = useState(false);

    // Lightning address type - Breez is default
    const [lightningAddressType, setLightningAddressType] = useState<LightningAddressType>('breez');

    /**
     * Generate a new identity from mnemonic
     * Called at Welcome screen - stores in memory only
     */
    const generateIdentity = useCallback((): OnboardingIdentity => {
        // Generate 12-word BIP-39 mnemonic
        const mnemonic = generateMnemonic();

        // Derive Nostr keys using NIP-06 standard
        const keys = deriveNostrKeyFromMnemonic(mnemonic);

        // Generate both lightning addresses:
        // 1. Breez address: deterministic from mnemonic (xxx@breez.fun) - DEFAULT
        const breezLightningAddress = generateCustomLightningAddress(mnemonic);

        // 2. npub.cash address: npub...@npubx.cash (fallback/alternative)
        const npub = nip19.npubEncode(keys.publicKey);
        const npubcashLightningAddress = `${npub}@npubx.cash`;

        const newIdentity: OnboardingIdentity = {
            mnemonic,
            privateKey: keys.privateKey,
            privateKeyHex: keys.privateKeyHex,
            publicKey: keys.publicKey,
            breezLightningAddress,
            npubcashLightningAddress
        };

        setIdentity(newIdentity);
        console.log('🔑 [Onboarding] Identity generated in memory (not persisted yet)');
        console.log(`⚡ [Onboarding] Breez Address: ${breezLightningAddress}`);
        console.log(`📍 [Onboarding] npub.cash Address: ${npubcashLightningAddress}`);

        return newIdentity;
    }, []);

    /**
     * Update profile data (name, picture, pdga)
     * Called during Profile Setup screen
     */
    const setProfileData = useCallback((data: Partial<OnboardingProfile>) => {
        setProfile(prev => ({ ...prev, ...data }));
    }, []);

    /**
     * Clear all onboarding state
     * Called after finalization or on cancel
     */
    const clearOnboarding = useCallback(() => {
        setIdentity(null);
        setProfile({ name: 'Disc Golfer', picture: '', pdga: undefined });
        setIsOnboarding(false);
        setLightningAddressType('breez'); // Reset to default
    }, []);

    return (
        <OnboardingContext.Provider value={{
            identity,
            profile,
            lightningAddressType,
            setLightningAddressType,
            generateIdentity,
            setProfileData,
            clearOnboarding,
            isOnboarding,
            setIsOnboarding
        }}>
            {children}
        </OnboardingContext.Provider>
    );
};

/**
 * Hook to access onboarding state and actions.
 * Must be used within an OnboardingProvider.
 * @returns {OnboardingContextType} Ephemeral identity state, profile data, and onboarding actions.
 * @throws {Error} If called outside of OnboardingProvider.
 */
export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (context === undefined) {
        throw new Error('useOnboarding must be used within an OnboardingProvider');
    }
    return context;
};

