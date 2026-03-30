/**
 * @file profileTypes.ts
 *
 * Shared TypeScript types and prop interfaces for the Profile page module.
 *
 * Defines:
 * - ProfileFormData -- editable fields for the user's Nostr profile.
 * - HelpModal -- state shape for contextual help modals.
 * - Prop interfaces for ProfileGuestView, ProfileMainView, ProfileSettingsView.
 *
 * The Profile.tsx orchestrator owns all state and passes typed slices to views.
 */

import React from 'react';
import { Denomination } from '../../hooks/useDenomination';
import { UserProfile, UserStats } from '../../types';

/** Editable fields for the user's Nostr profile (Kind 0 metadata). */
export interface ProfileFormData {
    name: string;
    lud16: string;
    about: string;
    nip05: string;
    picture: string;
    pdga: string;
}

/** State shape for contextual help modals throughout the profile page. */
export interface HelpModal {
    isOpen: boolean;
    title: string;
    text: string;
}

/**
 * Props for the guest/unauthenticated profile view.
 * Provides login (nsec, NIP-46 bunker, Amber) and account creation flows.
 */
export interface ProfileGuestViewProps {
    authView: 'login' | 'create';
    setAuthView: React.Dispatch<React.SetStateAction<'login' | 'create'>>;
    nsecInput: string;
    setNsecInput: React.Dispatch<React.SetStateAction<string>>;
    bunkerInput: string;
    setBunkerInput: React.Dispatch<React.SetStateAction<string>>;
    authError: string;
    setAuthError: React.Dispatch<React.SetStateAction<string>>;
    isLoading: boolean;
    handleLogin: () => Promise<void>;
    handleNip46Login: () => Promise<void>;
    handleCreate: () => Promise<void>;
    loginAmber: () => void;
    helpModal: HelpModal | null;
    setHelpModal: React.Dispatch<React.SetStateAction<HelpModal | null>>;
    openHelp: (title: string, text: string) => void;
}

/**
 * Props for the profile settings sub-view.
 * Manages display currency, Nostr relay configuration, profile editing,
 * and round reset/debug actions.
 */
export interface ProfileSettingsViewProps {
    denomination: Denomination;
    setDenomination: (d: Denomination) => void;
    relayList: string[];
    newRelayUrl: string;
    setNewRelayUrl: React.Dispatch<React.SetStateAction<string>>;
    handleAddRelay: () => void;
    handleRemoveRelay: (url: string) => void;
    handleResetRelays: () => void;
    openSection: string | null;
    toggleSection: (section: string) => void;
    formData: ProfileFormData;
    setFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
    handleSaveProfile: () => void;
    handleCopyLud16: () => void;
    copiedLud16: boolean;
    openHelp: (title: string, text: string) => void;
    helpModal: HelpModal | null;
    setHelpModal: React.Dispatch<React.SetStateAction<HelpModal | null>>;
    resetRound: () => void;
    setView: React.Dispatch<React.SetStateAction<'main' | 'settings'>>;
    showFeedbackModal: boolean;
    setShowFeedbackModal: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Props for the authenticated profile main view.
 * Displays user avatar, stats, key management (npub/nsec/mnemonic),
 * profile editing, Lightning address, and logout with hold-to-confirm.
 */
export interface ProfileMainViewProps {
    userProfile: UserProfile;
    userStats: UserStats;
    formData: ProfileFormData;
    setFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
    isEditing: boolean;
    setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
    handleSaveProfile: () => void;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    lightningAddress: string;
    copiedAddress: boolean;
    handleCopyAddress: () => void;
    showSecrets: boolean;
    setShowSecrets: React.Dispatch<React.SetStateAction<boolean>>;
    showMnemonic: boolean;
    setShowMnemonic: React.Dispatch<React.SetStateAction<boolean>>;
    copiedKeyType: 'npub' | 'nsec' | 'mnemonic' | null;
    setCopiedKeyType: React.Dispatch<React.SetStateAction<'npub' | 'nsec' | 'mnemonic' | null>>;
    copiedLud16: boolean;
    setCopiedLud16: React.Dispatch<React.SetStateAction<boolean>>;
    handleCopyNpub: () => void;
    handleCopyNsec: () => void;
    handleCopyMnemonic: () => void;
    handleCopyLud16: () => void;
    showLogoutConfirm: boolean;
    setShowLogoutConfirm: React.Dispatch<React.SetStateAction<boolean>>;
    holdProgress: number;
    startHold: () => void;
    stopHold: () => void;
    isExploding: boolean;
    imgError: boolean;
    setImgError: React.Dispatch<React.SetStateAction<boolean>>;
    isUploading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    formatLightningAddress: (addr: string) => string;
    storedMnemonic: string | null;
    authMethod: string;
    authSource: string;
    currentUserPubkey: string;
    helpModal: HelpModal | null;
    setHelpModal: React.Dispatch<React.SetStateAction<HelpModal | null>>;
    openHelp: (title: string, text: string) => void;
    openSection: string | null;
    toggleSection: (section: string) => void;
    setView: React.Dispatch<React.SetStateAction<'main' | 'settings'>>;
    isProfileLoading: boolean;
    getPrivateString: () => string;
    downloadWalletCardPDF: (mnemonic: string) => void;
    handleLogout: () => void;
}
