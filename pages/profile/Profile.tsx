/**
 * @file Profile.tsx
 *
 * Orchestrator component for the Profile tab (~430 lines).
 *
 * View state machine:
 * ```
 *   isGuest?  ──yes──> ProfileGuestView  (login / create account)
 *             ──no───> isProfileLoading?  ──yes──> ProfileLoadingView (key animation)
 *                      ──no───> view === 'settings'? ──yes──> ProfileSettingsView
 *                                                     ──no──> ProfileMainView
 * ```
 *
 * Key responsibilities:
 * - Authentication flows: nsec login, NIP-46 bunker login, Amber signer, mnemonic creation.
 * - Profile CRUD: edit name, picture (NIP-98 upload), bio, NIP-05, PDGA#, Lightning address.
 * - Key management: display npub/nsec/mnemonic with copy-to-clipboard.
 * - Wallet card PDF download for mnemonic backup.
 * - Relay management: add/remove/reset Nostr relays.
 * - Display currency preference (sats/BTC/USD).
 * - Logout with hold-to-confirm + explosion animation.
 * - Stats display (rounds played, total earnings, etc.).
 * - "Pop to Root" event listener for bottom-nav double-tap.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getSession, getRelays, addRelay, removeRelay, resetRelays, uploadProfileImage, getMagicLightningAddress } from '../../services/nostrService';
import { retrieveMnemonicEncrypted } from '../../services/mnemonicService';
import { downloadWalletCardPDF } from '../../services/backupService';
import { useDenomination } from '../../hooks/useDenomination';
import { nip19 } from 'nostr-tools';

import { ProfileGuestView } from './ProfileGuestView';
import { ProfileSettingsView } from './ProfileSettingsView';
import { ProfileLoadingView } from './ProfileLoadingView';
import { ProfileMainView } from './ProfileMainView';

/**
 * Profile page orchestrator -- manages authentication state, profile editing,
 * key display, relay config, and view routing between guest/main/settings views.
 */
export const Profile: React.FC = () => {
    const {
        userProfile, userStats, updateUserProfile, resetRound, refreshStats,
        isAuthenticated, isGuest, authMethod, authSource, performLogout, isProfileLoading,
        loginNsec, loginNip46, loginAmber, createAccountFromMnemonic, currentUserPubkey
    } = useApp();

    const navigate = useNavigate();
    const { denomination, setDenomination } = useDenomination();

    // Auth View States
    const [authView, setAuthView] = useState<'login' | 'create'>('create');
    const [nsecInput, setNsecInput] = useState('');
    const [bunkerInput, setBunkerInput] = useState('');
    const [authError, setAuthError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Authenticated View States
    const [view, setView] = useState<'main' | 'settings'>('main');
    const [isEditing, setIsEditing] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    const lightningAddress = userProfile.lud16 || getMagicLightningAddress(currentUserPubkey);

    const formatLightningAddress = (addr: string) => {
        if (!addr) return '';
        const parts = addr.split('@');
        if (parts.length !== 2) return addr.length > 20 ? addr.substring(0, 20) + '...' : addr;

        const [user, domain] = parts;
        if (user.length <= 12) return addr;
        return `${user.substring(0, 6)}...${user.substring(user.length - 6)}@${domain}`;
    };

    const handleCopyAddress = () => {
        if (!lightningAddress) return;
        navigator.clipboard.writeText(lightningAddress);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
    };
    const [showSecrets, setShowSecrets] = useState(false);
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [helpModal, setHelpModal] = useState<{ isOpen: boolean, title: string, text: string } | null>(null);
    const [imgError, setImgError] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [copiedKeyType, setCopiedKeyType] = useState<'npub' | 'nsec' | 'mnemonic' | null>(null);
    const [copiedLud16, setCopiedLud16] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get stored mnemonic for display (only for mnemonic-based accounts)
    const storedMnemonic = authSource === 'mnemonic' ? retrieveMnemonicEncrypted(currentUserPubkey) : null;

    const [formData, setFormData] = useState({
        name: '',
        lud16: '',
        about: '',
        nip05: '',
        picture: '',
        pdga: ''
    });

    // Settings State
    const [relayList, setRelayList] = useState<string[]>([]);
    const [newRelayUrl, setNewRelayUrl] = useState('');
    const [openSection, setOpenSection] = useState<string | null>(null);

    // Logout Hold State
    const [holdProgress, setHoldProgress] = useState(0);
    const holdIntervalRef = useRef<any>(null);
    const [isExploding, setIsExploding] = useState(false);

    const toggleSection = (section: string) => {
        if (openSection === section) {
            setOpenSection(null);
        } else {
            setOpenSection(section);
        }
    };

    const startHold = () => {
        if (holdIntervalRef.current) return;
        setHoldProgress(0);
        // 1.5 seconds to fill
        // Update every 15ms -> 100 steps
        // 100% / 100 steps = 1% per step
        holdIntervalRef.current = setInterval(() => {
            setHoldProgress(prev => {
                if (prev >= 100) {
                    clearInterval(holdIntervalRef.current);
                    holdIntervalRef.current = null;
                    handleLogoutSuccess();
                    return 100;
                }
                return prev + 1.5;
            });
        }, 15);
    };

    const stopHold = () => {
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
        setHoldProgress(0);
    };

    const handleLogoutSuccess = () => {
        setShowLogoutConfirm(false);
        setIsExploding(true);
        setTimeout(() => {
            setIsExploding(false);
            performLogout();
            navigate('/');  // Navigate to onboarding after logout
        }, 2000);
    };

    useEffect(() => {
        if (isAuthenticated && !isProfileLoading) {
            setFormData({
                name: userProfile.name,
                lud16: userProfile.lud16 || getMagicLightningAddress(currentUserPubkey),
                about: userProfile.about || '',
                nip05: userProfile.nip05 || '',
                picture: userProfile.picture || '',
                pdga: userProfile.pdga || ''
            });
            refreshStats();
        }
        setRelayList(getRelays());
    }, [userProfile, isAuthenticated, isProfileLoading]);

    // Reset image error if the URL changes (e.g. after a fetch)
    useEffect(() => {
        setImgError(false);
    }, [userProfile.picture, formData.picture]);

    // Listen for "Pop to Root" navigation event
    useEffect(() => {
        const handlePopToRoot = (e: CustomEvent) => {
            if (e.detail.path === '/profile') {
                setView('main');
            }
        };

        window.addEventListener('popToRoot', handlePopToRoot as EventListener);
        return () => window.removeEventListener('popToRoot', handlePopToRoot as EventListener);
    }, []);

    // Handlers

    const handleLogin = async () => {
        setAuthError('');
        setIsLoading(true);
        try {
            await loginNsec(nsecInput);
            setNsecInput('');
        } catch (e) {
            setAuthError('Invalid nsec. Please check and try again.');
        }
        setIsLoading(false);
    };

    const handleNip46Login = async () => {
        setAuthError('');
        setIsLoading(true);
        try {
            await loginNip46(bunkerInput);
        } catch (e) {
            setAuthError(e instanceof Error ? e.message : 'Could not connect to Remote Signer.');
        }
        setIsLoading(false);
    };

    const handleCreate = async () => {
        setAuthError('');
        setIsLoading(true);
        try {
            // Generate new account from 12-word mnemonic (BIP-89)
            // This creates both Nostr keys (NIP-06) and Breez wallet seed
            const { mnemonic } = await createAccountFromMnemonic();
            console.log("\u2705 New account created with mnemonic backup");

            // Set default bio & open edit mode on success
            setFormData(prev => ({ ...prev, about: "I <3 OnChainDiscGolf.com" }));
            setIsEditing(true);
        } catch (e) {
            console.error("Failed to create account:", e);
            setAuthError('Failed to generate keys.');
        }
        setIsLoading(false);
    };

    const handleSaveProfile = () => {
        updateUserProfile({
            ...userProfile,
            name: formData.name,
            lud16: formData.lud16,
            about: formData.about,
            nip05: formData.nip05,
            picture: formData.picture,
            pdga: formData.pdga || undefined
        });
        setIsEditing(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const url = await uploadProfileImage(file);
            setFormData(prev => ({ ...prev, picture: url }));
            setImgError(false);
        } catch (error) {
            alert("Image upload failed. Please try again.");
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCopyNpub = () => {
        try {
            const npub = nip19.npubEncode(currentUserPubkey);
            navigator.clipboard.writeText(npub);
            setCopiedKeyType('npub');
            setTimeout(() => setCopiedKeyType(null), 2000);
        } catch (e) { }
    };

    const getPrivateString = () => {
        const session = getSession();
        if (session && session.sk) {
            return nip19.nsecEncode(session.sk);
        }
        return '';
    };

    const handleCopyNsec = () => {
        const nsec = getPrivateString();
        if (nsec) {
            navigator.clipboard.writeText(nsec);
            setCopiedKeyType('nsec');
            setTimeout(() => setCopiedKeyType(null), 2000);
        }
    };

    const handleCopyMnemonic = () => {
        if (storedMnemonic) {
            navigator.clipboard.writeText(storedMnemonic);
            setCopiedKeyType('mnemonic');
            setTimeout(() => setCopiedKeyType(null), 2000);
        }
    };

    const handleCopyLud16 = () => {
        if (formData.lud16) {
            navigator.clipboard.writeText(formData.lud16);
            setCopiedLud16(true);
            setTimeout(() => setCopiedLud16(false), 2000);
        }
    };

    const openHelp = (title: string, text: string) => {
        setHelpModal({ isOpen: true, title, text });
    };

    const handleLogout = () => {
        setShowSecrets(false); // Ensure secrets are hidden by default when opening modal
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        performLogout();
        setShowLogoutConfirm(false);
    };

    // Relay Handlers
    const handleAddRelay = () => {
        if (newRelayUrl) {
            addRelay(newRelayUrl);
            setRelayList(getRelays());
            setNewRelayUrl('');
        }
    };

    const handleRemoveRelay = (url: string) => {
        removeRelay(url);
        setRelayList(getRelays());
    };

    const handleResetRelays = () => {
        if (confirm("Reset relays to default list?")) {
            resetRelays();
            setRelayList(getRelays());
        }
    };


    // --- GUEST / LOGIN STATE ---
    if (isGuest) {
        return (
            <ProfileGuestView
                authView={authView}
                setAuthView={setAuthView}
                nsecInput={nsecInput}
                setNsecInput={setNsecInput}
                bunkerInput={bunkerInput}
                setBunkerInput={setBunkerInput}
                authError={authError}
                setAuthError={setAuthError}
                isLoading={isLoading}
                handleLogin={handleLogin}
                handleNip46Login={handleNip46Login}
                handleCreate={handleCreate}
                loginAmber={loginAmber}
                helpModal={helpModal}
                setHelpModal={setHelpModal}
                openHelp={openHelp}
            />
        );
    }

    // --- SETTINGS VIEW ---
    if (view === 'settings') {
        return (
            <ProfileSettingsView
                denomination={denomination}
                setDenomination={setDenomination}
                relayList={relayList}
                newRelayUrl={newRelayUrl}
                setNewRelayUrl={setNewRelayUrl}
                handleAddRelay={handleAddRelay}
                handleRemoveRelay={handleRemoveRelay}
                handleResetRelays={handleResetRelays}
                openSection={openSection}
                toggleSection={toggleSection}
                formData={formData}
                setFormData={setFormData}
                handleSaveProfile={handleSaveProfile}
                handleCopyLud16={handleCopyLud16}
                copiedLud16={copiedLud16}
                openHelp={openHelp}
                helpModal={helpModal}
                setHelpModal={setHelpModal}
                resetRound={resetRound}
                setView={setView}
                showFeedbackModal={showFeedbackModal}
                setShowFeedbackModal={setShowFeedbackModal}
            />
        );
    }

    // --- AUTHENTICATED STATE (MAIN) ---

    if (isProfileLoading) {
        return <ProfileLoadingView />;
    }

    return (
        <ProfileMainView
            userProfile={userProfile}
            userStats={userStats}
            formData={formData}
            setFormData={setFormData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            handleSaveProfile={handleSaveProfile}
            handleImageUpload={handleImageUpload}
            lightningAddress={lightningAddress}
            copiedAddress={copiedAddress}
            handleCopyAddress={handleCopyAddress}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
            showMnemonic={showMnemonic}
            setShowMnemonic={setShowMnemonic}
            copiedKeyType={copiedKeyType}
            setCopiedKeyType={setCopiedKeyType}
            copiedLud16={copiedLud16}
            setCopiedLud16={setCopiedLud16}
            handleCopyNpub={handleCopyNpub}
            handleCopyNsec={handleCopyNsec}
            handleCopyMnemonic={handleCopyMnemonic}
            handleCopyLud16={handleCopyLud16}
            showLogoutConfirm={showLogoutConfirm}
            setShowLogoutConfirm={setShowLogoutConfirm}
            holdProgress={holdProgress}
            startHold={startHold}
            stopHold={stopHold}
            isExploding={isExploding}
            imgError={imgError}
            setImgError={setImgError}
            isUploading={isUploading}
            fileInputRef={fileInputRef}
            formatLightningAddress={formatLightningAddress}
            storedMnemonic={storedMnemonic}
            authMethod={authMethod}
            authSource={authSource}
            currentUserPubkey={currentUserPubkey}
            helpModal={helpModal}
            setHelpModal={setHelpModal}
            openHelp={openHelp}
            openSection={openSection}
            toggleSection={toggleSection}
            setView={setView}
            isProfileLoading={isProfileLoading}
            getPrivateString={getPrivateString}
            downloadWalletCardPDF={downloadWalletCardPDF}
            handleLogout={handleLogout}
        />
    );
};
