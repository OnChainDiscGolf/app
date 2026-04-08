/**
 * @file Onboarding.tsx
 *
 * New user onboarding flow -- the first screen for unauthenticated users.
 *
 * Step machine (`OnboardingStep`):
 * ```
 * NEW USER:     welcome -> profile-setup -> backup -> Finalization -> Home
 * RECOVERY:     welcome -> recovery (12-word mnemonic) -> profile-setup -> Home
 * NSEC LOGIN:   welcome -> nsec (paste nsec) -> profile-setup -> Home
 * AMBER LOGIN:  welcome -> amber (Android NIP-46) -> profile-setup -> Home
 * ```
 *
 * Key design decisions:
 * - Identity is generated at the welcome step and held in OnboardingContext
 *   (in-memory only). Nothing is persisted to localStorage until Finalization.
 * - Profile setup uses the real keys for NIP-98 authenticated image uploads
 *   even before the account is persisted.
 * - The mnemonic backup step (for new users) shows the 12-word seed phrase
 *   and requires confirmation before proceeding to Finalization.
 * - Recovery flow derives keys from mnemonic via BIP-39 + NIP-06, then
 *   fetches the existing profile from Nostr relays.
 * - Amber option only shown on Android native builds.
 *
 * Route: /onboarding
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { useOnboarding } from '../context/OnboardingContext';
import { Icons } from '../components/Icons';
import { MnemonicBackup, MnemonicRecoveryInput } from '../components/MnemonicBackup';
import { uploadProfileImageWithKey } from '../services/nostrService';
import { isNative, getPlatform } from '../services/capacitorService';
import { nip19 } from 'nostr-tools';

/**
 * Steps in the onboarding flow.
 * - welcome: initial screen with "Create" and "I have an account" options.
 * - profile-setup: name, picture, PDGA# entry (uses real keys for NIP-98 uploads).
 * - backup: mnemonic display and confirmation (new users only).
 * - recovery: 12-word mnemonic entry for existing accounts.
 * - nsec: raw nsec key entry for existing accounts.
 * - amber: Android Amber signer connection flow.
 */
type OnboardingStep =
    | 'welcome'
    | 'profile-setup'
    | 'backup'
    | 'recovery'
    | 'nsec'
    | 'amber';

/**
 * Onboarding page -- multi-step new user flow for identity creation,
 * recovery, and initial profile setup.
 */
export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { loginNsec: appLoginNsec, loginMnemonic: appLoginMnemonic, loginAmber } = useApp();
    const { identity, profile, generateIdentity, setProfileData, setIsOnboarding, lightningAddressType, setLightningAddressType } = useOnboarding();

    const [step, setStep] = useState<OnboardingStep>('welcome');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Modal states
    const [showWhyModal, setShowWhyModal] = useState(false);
    const [showExistingOptionsModal, setShowExistingOptionsModal] = useState(false);

    // Mark that we're in onboarding
    useEffect(() => {
        setIsOnboarding(true);
        return () => setIsOnboarding(false);
    }, [setIsOnboarding]);

    // Check if user is on Android (for Amber option)
    const showAmberOption = isNative() && getPlatform() === 'android';

    // =========================================================================
    // ACTION HANDLERS
    // =========================================================================

    const handleCreateNewAccount = () => {
        setError('');

        try {
            // Generate identity in memory (NOT persisted yet)
            generateIdentity();

            // Go directly to profile setup
            setStep('profile-setup');
        } catch (e) {
            console.error('Failed to generate identity:', e);
            setError('Failed to create account. Please try again.');
        }
    };

    const handleQuickStart = () => {
        setError('');

        try {
            // Generate identity silently
            generateIdentity();

            // Set a default profile name
            setProfileData({ name: 'Disc Golfer' });

            // Skip profile setup and backup — go straight to finalization
            navigate('/finalization', { replace: true });
        } catch (e) {
            console.error('Quick start failed:', e);
            setError('Failed to create account. Please try again.');
        }
    };

    const handleProfileSetupComplete = () => {
        // After profile setup, go to mnemonic backup
        setStep('backup');
    };

    const handleBackupComplete = () => {
        // After backup, go to finalization where everything gets persisted
        navigate('/finalization', { replace: true });
    };

    const handleRecoverySubmit = async (mnemonic: string) => {
        setIsLoading(true);
        setError('');

        try {
            await appLoginMnemonic(mnemonic);
            // Recovery flow: go to profile setup with recovery flag
            navigate('/profile-setup', { state: { isRecovery: true }, replace: true });
        } catch (e) {
            console.error('Recovery failed:', e);
            setError('Invalid recovery phrase. Please check and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNsecSubmit = async (nsec: string) => {
        setIsLoading(true);
        setError('');

        try {
            await appLoginNsec(nsec);
            // NSEC flow: go to profile setup with recovery flag
            navigate('/profile-setup', { state: { isRecovery: true }, replace: true });
        } catch (e) {
            console.error('Nsec login failed:', e);
            setError('Invalid nsec. Please check and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAmberConnect = async () => {
        try {
            await loginAmber();
            // Amber will redirect back to the app after approval
        } catch (e) {
            console.error('Amber connection failed:', e);
            setError('Failed to connect to Amber.');
        }
    };

    // =========================================================================
    // RENDER: WELCOME SCREEN
    // =========================================================================

    if (step === 'welcome') {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col">
                {/* Hero */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md w-full">
                        {/* App Icon */}
                        <div className="mb-6">
                            <img
                                src="/icon.jpg"
                                alt="On-Chain Disc Golf"
                                className="w-28 h-28 rounded-3xl shadow-2xl shadow-brand-primary/20 mx-auto"
                            />
                        </div>

                        {/* Title */}
                        <h1 className="font-extrabold tracking-tight leading-tight mb-2">
                            <span className="text-5xl bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">On-Chain</span>
                            <span className="text-5xl text-white"> Disc Golf</span>
                        </h1>

                        {/* Value Prop */}
                        <p className="text-slate-300 text-base leading-relaxed mb-2">
                            Scorecard. Entry fees. Instant payouts.
                        </p>
                        <p className="text-slate-500 text-sm mb-8">
                            No IOUs. No chasing people down. No "I'll get you next time."
                        </p>

                        {/* Feature Pills */}
                        <div className="flex justify-center gap-2 mb-8">
                            <div className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-full flex items-center space-x-1.5">
                                <Icons.Trophy size={14} className="text-brand-primary" />
                                <span className="text-xs text-slate-300">Keep Score</span>
                            </div>
                            <div className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-full flex items-center space-x-1.5">
                                <Icons.Zap size={14} className="text-amber-400" />
                                <span className="text-xs text-slate-300">Collect Fees</span>
                            </div>
                            <div className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-full flex items-center space-x-1.5">
                                <Icons.Send size={14} className="text-emerald-400" />
                                <span className="text-xs text-slate-300">Auto Payout</span>
                            </div>
                        </div>

                        {/* Main CTA */}
                        <button
                            onClick={handleCreateNewAccount}
                            className="w-full py-4 bg-gradient-to-r from-brand-primary to-cyan-400 text-black font-bold rounded-xl hover:opacity-90 transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/30 flex items-center justify-center space-x-2 mb-3"
                        >
                            <span>Get Started</span>
                            <Icons.Next size={18} />
                        </button>

                        {/* Quick Start */}
                        <button
                            onClick={handleQuickStart}
                            className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/20 transition-colors flex items-center justify-center space-x-2 mb-3"
                        >
                            <Icons.Play size={16} />
                            <span>Just Keep Score</span>
                        </button>

                        {/* Secondary */}
                        <button
                            onClick={() => setShowExistingOptionsModal(true)}
                            className="w-full py-3 bg-slate-800/50 border border-slate-700 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
                        >
                            I already have an account
                        </button>

                        {/* Error display */}
                        {error && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Powered By Footer — tappable for curious users */}
                <div className="pb-8 pt-2 text-center">
                    <button
                        onClick={() => setShowWhyModal(true)}
                        className="text-slate-600 text-xs hover:text-slate-400 transition-colors inline-flex items-center space-x-1.5"
                    >
                        <span>Powered by</span>
                        <span className="text-orange-500/70">Bitcoin</span>
                        <span>&</span>
                        <span className="text-purple-500/70">Nostr</span>
                        <Icons.ChevronDown size={12} className="text-slate-600" />
                    </button>
                </div>

                {/* Why Modal */}
                {showWhyModal && createPortal(
                    <WhyModal onClose={() => setShowWhyModal(false)} />,
                    document.body
                )}

                {/* Existing Account Options Modal */}
                {showExistingOptionsModal && createPortal(
                    <ExistingAccountModal
                        onClose={() => setShowExistingOptionsModal(false)}
                        onSelectRecovery={() => {
                            setShowExistingOptionsModal(false);
                            setStep('recovery');
                        }}
                        onSelectNsec={() => {
                            setShowExistingOptionsModal(false);
                            setStep('nsec');
                        }}
                        onSelectAmber={() => {
                            setShowExistingOptionsModal(false);
                            handleAmberConnect();
                        }}
                        showAmber={showAmberOption}
                    />,
                    document.body
                )}
            </div>
        );
    }

    // =========================================================================
    // RENDER: PROFILE SETUP (NEW - uses OnboardingContext identity)
    // =========================================================================

    if (step === 'profile-setup' && identity) {
        return (
            <OnboardingProfileSetup
                identity={identity}
                profile={profile}
                setProfileData={setProfileData}
                lightningAddressType={lightningAddressType}
                setLightningAddressType={setLightningAddressType}
                onComplete={handleProfileSetupComplete}
                onBack={() => setStep('welcome')}
            />
        );
    }

    // =========================================================================
    // RENDER: MNEMONIC BACKUP (comes after profile setup now)
    // =========================================================================

    if (step === 'backup' && identity) {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col p-4 pt-8">
                <MnemonicBackup
                    mnemonic={identity.mnemonic}
                    onComplete={handleBackupComplete}
                    onBack={() => setStep('profile-setup')}
                    title="Save Your Recovery Phrase"
                    subtitle="These 12 words are the ONLY way to recover your account AND Bitcoin wallet. Write them down and keep them safe."
                    showVerification={true}
                />
            </div>
        );
    }

    // =========================================================================
    // RENDER: RECOVERY (Mnemonic Input)
    // =========================================================================

    if (step === 'recovery') {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col p-4 pt-8">
                <button
                    onClick={() => setStep('welcome')}
                    className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <Icons.Back size={24} />
                </button>

                <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                    <MnemonicRecoveryInput
                        onSubmit={handleRecoverySubmit}
                        onCancel={() => setStep('welcome')}
                        error={error}
                        isLoading={isLoading}
                    />
                </div>
            </div>
        );
    }

    // =========================================================================
    // RENDER: NSEC LOGIN
    // =========================================================================

    if (step === 'nsec') {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col p-4 pt-8">
                <button
                    onClick={() => setStep('welcome')}
                    className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <Icons.Back size={24} />
                </button>

                <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                    <NsecLoginForm
                        onSubmit={handleNsecSubmit}
                        onCancel={() => setStep('welcome')}
                        error={error}
                        isLoading={isLoading}
                    />
                </div>
            </div>
        );
    }

    // Fallback
    return null;
};

// =============================================================================
// ONBOARDING PROFILE SETUP (inline component using OnboardingContext)
// =============================================================================

interface OnboardingProfileSetupProps {
    identity: {
        mnemonic: string;
        privateKey: Uint8Array;
        privateKeyHex: string;
        publicKey: string;
        breezLightningAddress: string;
        npubcashLightningAddress: string;
    };
    profile: {
        name: string;
        picture: string;
        pdga?: string;
    };
    setProfileData: (data: Partial<{ name: string; picture: string; pdga?: string }>) => void;
    lightningAddressType: 'breez' | 'npubcash';
    setLightningAddressType: (type: 'breez' | 'npubcash') => void;
    onComplete: () => void;
    onBack: () => void;
}

const OnboardingProfileSetup: React.FC<OnboardingProfileSetupProps> = ({
    identity,
    profile,
    setProfileData,
    lightningAddressType,
    setLightningAddressType,
    onComplete,
    onBack
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            setUploadError('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setUploadError('Image must be under 5MB');
            return;
        }

        setIsUploading(true);
        setUploadError('');

        try {
            // Upload using the real private key (not stored in localStorage yet)
            const imageUrl = await uploadProfileImageWithKey(file, identity.privateKey);
            setProfileData({ picture: imageUrl });
        } catch (e) {
            console.error('Image upload failed:', e);
            setUploadError('Failed to upload image. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleContinue = () => {
        if (!profile.name.trim()) {
            return; // Name is required
        }
        onComplete();
    };

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col">
            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4">
                <div className="flex items-center">
                    <button
                        onClick={onBack}
                        className="p-2 text-slate-400 hover:text-white transition-colors -ml-2"
                    >
                        <Icons.Back size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Set Up Your Profile</h1>
                </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
                <div className="max-w-md mx-auto space-y-6">

                    {/* Profile Picture */}
                    <div className="flex flex-col items-center">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center">
                                {profile.picture ? (
                                    <img
                                        src={profile.picture}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Icons.User className="text-slate-500" size={40} />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-primary/80 transition-colors">
                                <Icons.Camera className="text-black" size={16} />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={isUploading}
                                />
                            </label>
                        </div>
                        {isUploading && (
                            <p className="text-sm text-slate-400 mt-2">Uploading...</p>
                        )}
                        {uploadError && (
                            <p className="text-sm text-red-400 mt-2">{uploadError}</p>
                        )}
                    </div>

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Display Name *
                        </label>
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfileData({ name: e.target.value })}
                            placeholder="Your name"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:border-brand-primary focus:outline-none"
                        />
                    </div>

                    {/* PDGA Number (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            PDGA Number <span className="text-slate-500">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={profile.pdga || ''}
                            onChange={(e) => setProfileData({ pdga: e.target.value || undefined })}
                            placeholder="e.g., 12345"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:border-brand-primary focus:outline-none"
                        />
                    </div>

                    {/* Continue Button */}
                    <button
                        onClick={handleContinue}
                        disabled={!profile.name.trim()}
                        className="w-full py-4 bg-gradient-to-r from-brand-primary to-cyan-400 text-black font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Continue
                    </button>

                    <p className="text-xs text-slate-500 text-center">
                        Next: Save your recovery phrase
                    </p>

                    {/* Advanced Options Dropdown */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between text-left"
                        >
                            <div className="flex items-center space-x-2">
                                <Icons.Settings className="text-slate-400" size={20} />
                                <span className="font-medium text-white">Advanced Options</span>
                            </div>
                            <Icons.ChevronDown
                                className={`text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                                size={20}
                            />
                        </button>

                        {showAdvanced && (
                            <div className="mt-4 space-y-3">
                                <p className="text-xs text-slate-400">Lightning Address for Profile</p>
                                <p className="text-xs text-slate-500 mb-2">
                                    Choose which address to publish to your Nostr profile for receiving payments.
                                </p>

                                {/* Breez Option (Default) */}
                                <button
                                    onClick={() => setLightningAddressType('breez')}
                                    className={`w-full p-3 rounded-xl border transition-all text-left flex items-center space-x-3 ${lightningAddressType === 'breez'
                                        ? 'bg-orange-500/20 border-orange-500/50'
                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${lightningAddressType === 'breez' ? 'border-orange-500' : 'border-slate-500'
                                        }`}>
                                        {lightningAddressType === 'breez' && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-white text-sm">Breez <span className="text-xs text-orange-400">(Recommended)</span></p>
                                        <p className="text-xs text-orange-400 font-mono truncate">{identity.breezLightningAddress}</p>
                                    </div>
                                </button>

                                {/* npub.cash Option */}
                                <button
                                    onClick={() => setLightningAddressType('npubcash')}
                                    className={`w-full p-3 rounded-xl border transition-all text-left flex items-center space-x-3 ${lightningAddressType === 'npubcash'
                                        ? 'bg-purple-500/20 border-purple-500/50'
                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${lightningAddressType === 'npubcash' ? 'border-purple-500' : 'border-slate-500'
                                        }`}>
                                        {lightningAddressType === 'npubcash' && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-white text-sm">Cashu (npub.cash)</p>
                                        <p className="text-xs text-purple-400 font-mono truncate">
                                            {identity.npubcashLightningAddress.replace(/^(npub1.{4}).*(@.*)$/, '$1...$2')}
                                        </p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Why Modal - Explains Bitcoin + Nostr
 */
const WhyModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[75vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">How It Works</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <Icons.Close size={24} />
                    </button>
                </div>

                {/* The pitch — lead with the problem */}
                <div className="space-y-3 text-slate-300 leading-relaxed text-sm">
                    <p className="text-brand-primary font-semibold italic">
                        "We'll settle up after the round!"
                    </p>
                    <p>
                        Famous last words. Someone doesn't have cash, Venmo is "acting weird," and those ace pot dollars just... disappear.
                    </p>
                    <p className="text-white font-medium">
                        This app fixes that. Entry fees collected upfront. Payouts sent automatically when the round ends. Zero hassle.
                    </p>
                </div>

                {/* How it works — simple steps */}
                <div className="space-y-2">
                    <div className="flex items-start space-x-3 p-3 bg-slate-800/50 rounded-xl">
                        <div className="w-8 h-8 bg-brand-primary/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-brand-primary font-bold text-sm">1</span>
                        </div>
                        <div>
                            <p className="text-white font-medium text-sm">Create a round</p>
                            <p className="text-slate-400 text-xs">Set the course, entry fee, and invite players</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-slate-800/50 rounded-xl">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-amber-400 font-bold text-sm">2</span>
                        </div>
                        <div>
                            <p className="text-white font-medium text-sm">Play and score</p>
                            <p className="text-slate-400 text-xs">Track every hole, see live standings</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-slate-800/50 rounded-xl">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-emerald-400 font-bold text-sm">3</span>
                        </div>
                        <div>
                            <p className="text-white font-medium text-sm">Winners get paid instantly</p>
                            <p className="text-slate-400 text-xs">Payouts sent the moment the round is finalized</p>
                        </div>
                    </div>
                </div>

                {/* Tech section — available but not dominant */}
                <div className="border-t border-slate-700/50 pt-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3">Under the Hood</p>
                    <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                            <Icons.Zap size={16} className="text-orange-500 shrink-0" />
                            <p className="text-xs text-slate-400">
                                <span className="text-orange-400 font-medium">Bitcoin Lightning</span> — Instant, low-fee payments. Your money, your wallet. No bank needed.
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Icons.Key size={16} className="text-purple-500 shrink-0" />
                            <p className="text-xs text-slate-400">
                                <span className="text-purple-400 font-medium">Nostr</span> — Your identity travels with you. No company controls your account.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
                >
                    Got it
                </button>
            </div>
        </div>
    </div>
);

/**
 * Existing Account Modal - Options for recovery, nsec, amber
 */
const ExistingAccountModal: React.FC<{
    onClose: () => void;
    onSelectRecovery: () => void;
    onSelectNsec: () => void;
    onSelectAmber: () => void;
    showAmber: boolean;
}> = ({ onClose, onSelectRecovery, onSelectNsec, onSelectAmber, showAmber }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Welcome Back!</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <Icons.Close size={24} />
                    </button>
                </div>

                <p className="text-slate-400 text-sm">
                    Choose how you want to sign in:
                </p>

                <div className="space-y-3">
                    {/* Recovery Phrase (Recommended) */}
                    <button
                        onClick={onSelectRecovery}
                        className="w-full p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-colors text-left"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                                <Icons.Key className="text-amber-500" size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-white">Recovery Phrase</p>
                                <p className="text-xs text-slate-400">12 words from this app</p>
                                <p className="text-[10px] text-amber-400/70 mt-0.5">Restores your identity + Bitcoin wallet</p>
                            </div>
                        </div>
                    </button>

                    {/* Nsec */}
                    <button
                        onClick={onSelectNsec}
                        className="w-full p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl hover:bg-purple-500/20 transition-colors text-left"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                                <Icons.Shield className="text-purple-500" size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-white">Private Key (nsec)</p>
                                <p className="text-xs text-slate-400">From Damus, Primal, etc.</p>
                                <p className="text-[10px] text-purple-400/70 mt-0.5">Identity only — Lightning wallet set up separately</p>
                            </div>
                        </div>
                    </button>

                    {/* Amber (Android only) */}
                    {showAmber && (
                        <button
                            onClick={onSelectAmber}
                            className="w-full p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl hover:bg-orange-500/20 transition-colors text-left"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                                    <Icons.Android className="text-orange-500" size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-white">Amber Signer</p>
                                    <p className="text-xs text-slate-400">Android key manager</p>
                                    <p className="text-[10px] text-orange-400/70 mt-0.5">Identity only — Lightning wallet set up separately</p>
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
);

/**
 * Nsec Login Form
 */
const NsecLoginForm: React.FC<{
    onSubmit: (nsec: string) => void;
    onCancel: () => void;
    error?: string;
    isLoading?: boolean;
}> = ({ onSubmit, onCancel, error, isLoading }) => {
    const [nsec, setNsec] = useState('');
    const [showKey, setShowKey] = useState(false);

    const handleSubmit = () => {
        if (nsec.trim()) {
            onSubmit(nsec.trim());
        }
    };

    return (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 bg-purple-500/20 rounded-full flex items-center justify-center border-2 border-purple-500">
                    <Icons.Shield className="text-purple-500" size={28} />
                </div>
                <h3 className="text-lg font-bold text-white">Enter Your Secret Key</h3>
                <p className="text-slate-400 text-sm">Paste your nsec private key</p>
            </div>

            <div className="relative">
                <input
                    type={showKey ? 'text' : 'password'}
                    value={nsec}
                    onChange={(e) => setNsec(e.target.value)}
                    placeholder="nsec1..."
                    className="w-full px-4 py-3 pr-12 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                />
                <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                    {showKey ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />}
                </button>
            </div>

            {error && (
                <div className="flex items-center space-x-2 text-red-400 text-sm">
                    <Icons.Close size={16} />
                    <span>{error}</span>
                </div>
            )}

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                <p className="text-xs text-slate-300">
                    <strong className="text-purple-400">What to expect:</strong> Your Nostr identity will be restored and stored locally on this device. Cashu and NWC wallets work right away. For Lightning (Breez), you'll create a separate wallet in the Wallet tab.
                </p>
            </div>

            <div className="flex space-x-2 pt-2">
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!nsec.trim() || isLoading}
                    className="flex-1 py-3 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </div>
        </div>
    );
};

export default Onboarding;
