/**
 * Onboarding Page
 * 
 * NEW FLOW (mnemonic-based identity):
 * 
 * 1. NEW USER → Welcome → Profile Setup → Mnemonic Backup → Finalization → Home
 *    - Identity generated at Welcome (stored in memory via OnboardingContext)
 *    - Profile Setup uses real keys for NIP-98 uploads
 *    - Nothing persisted until Finalization
 * 
 * 2. RECOVERY → Enter 12-word mnemonic → Profile Setup → Home
 *    - Skips backup and finalization (identity already exists)
 * 
 * 3. NSEC LOGIN → Enter nsec → Profile Setup → Home
 * 
 * 4. AMBER LOGIN → Connect via NIP-46 → Profile Setup → Home
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { useOnboarding } from '../context/OnboardingContext';
import { Icons } from '../components/Icons';
import { MnemonicBackup, MnemonicRecoveryInput } from '../components/MnemonicBackup';
import { loginWithMnemonic, loginWithNsec, uploadProfileImageWithKey } from '../services/nostrService';
import { isNative, getPlatform } from '../services/capacitorService';
import { nip19 } from 'nostr-tools';

type OnboardingStep = 
    | 'welcome'           // Initial screen with options
    | 'profile-setup'     // Enter name, picture, pdga (NEW: comes before backup)
    | 'backup'            // Show mnemonic backup (NEW: comes after profile setup)
    | 'recovery'          // Enter existing mnemonic
    | 'nsec'              // Enter existing nsec
    | 'amber';            // Amber connection flow

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { loginNsec: appLoginNsec, loginAmber } = useApp();
    const { identity, profile, generateIdentity, setProfileData, setIsOnboarding } = useOnboarding();
    
    const [step, setStep] = useState<OnboardingStep>('welcome');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Animation State for welcome screen
    const [activeIcon, setActiveIcon] = useState(0);

    // Modal states
    const [showWhyModal, setShowWhyModal] = useState(false);
    const [showExistingOptionsModal, setShowExistingOptionsModal] = useState(false);

    // Icon animation loop
    useEffect(() => {
        if (step === 'welcome') {
            const interval = setInterval(() => {
                setActiveIcon(prev => (prev + 1) % 3);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [step]);

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

    const handleProfileSetupComplete = () => {
        // After profile setup, go to mnemonic backup
        setStep('backup');
    };

    const handleBackupComplete = () => {
        // After backup, go to finalization where everything gets persisted
        navigate('/finalization');
    };

    const handleRecoverySubmit = async (mnemonic: string) => {
        setIsLoading(true);
        setError('');

        try {
            loginWithMnemonic(mnemonic);
            // Recovery flow: go to profile setup with recovery flag
            navigate('/profile-setup', { state: { isRecovery: true } });
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
            loginWithNsec(nsec);
            await appLoginNsec(nsec);
            // NSEC flow: go to profile setup with recovery flag
            navigate('/profile-setup', { state: { isRecovery: true } });
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
                {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md p-4">
                <div className="max-w-md mx-auto text-center">
                    <p className="golden-shimmer text-base mb-2 font-semibold">Welcome to..</p>
                    <h1 className="font-extrabold tracking-tight leading-tight">
                        <div className="text-7xl mb-1">
                            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">On-Chain</span>
                        </div>
                        <div className="text-6xl">
                            <span className="text-white">Disc Golf</span>
                        </div>
                    </h1>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-between p-4 text-center">
                <div className="max-w-md w-full">
                        {/* Animated Icon Container */}
                        <div className="relative w-28 h-28 flex items-center justify-center mx-auto mb-4">
                            {/* Disc Golf */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 0 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-24 h-24 bg-brand-primary/20 rounded-full flex items-center justify-center border-2 border-brand-primary shadow-[0_0_30px_rgba(45,212,191,0.3)]">
                                        <Icons.Trophy className="text-brand-primary" size={60} strokeWidth={1.5} />
                                    </div>
                                </div>

                            {/* Bitcoin */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 1 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-24 h-24 bg-orange-500/20 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                                        <Icons.Bitcoin className="text-orange-500" size={56} strokeWidth={2} />
                                    </div>
                                </div>

                            {/* Nostr */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 2 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                                        <Icons.Key className="text-purple-500" size={48} strokeWidth={2} />
                                    </div>
                                </div>
                            </div>

                        {/* Tagline */}
                        <div className="space-y-2 mb-6">
                                <p className="text-slate-300 text-sm font-medium">This app uses</p>
                                <p className="text-lg font-bold">
                                <span className={`text-brand-primary transition-all duration-500 ${activeIcon === 0 ? 'drop-shadow-[0_0_12px_rgba(45,212,191,0.8)] scale-110 inline-block' : ''}`}>
                                        Disc Golf
                                    </span>
                                    {' + '}
                                <span className={`text-orange-500 transition-all duration-500 ${activeIcon === 1 ? 'drop-shadow-[0_0_12px_rgba(249,115,22,0.8)] scale-110 inline-block' : ''}`}>
                                        Bitcoin
                                    </span>
                                    {' + '}
                                <span className={`text-purple-500 transition-all duration-500 ${activeIcon === 2 ? 'drop-shadow-[0_0_12px_rgba(168,85,247,0.8)] scale-110 inline-block' : ''}`}>
                                        Nostr
                                    </span>
                                </p>
                                <button
                                onClick={() => setShowWhyModal(true)}
                                    className="text-slate-400 text-xs hover:text-white transition-colors border-b border-dashed border-slate-600 hover:border-white pb-0.5"
                                >
                                    Learn why
                                </button>
                            </div>

                        {/* Main CTA: Create New Account */}
                                <button
                            onClick={handleCreateNewAccount}
                            className="w-full py-4 bg-gradient-to-r from-brand-primary to-cyan-400 text-black font-bold rounded-xl hover:opacity-90 transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/30 flex items-center justify-center space-x-2 mb-4"
                        >
                            <Icons.Plus size={20} />
                            <span>Create New Account</span>
                                </button>

                        {/* Secondary Options */}
                                    <button
                            onClick={() => setShowExistingOptionsModal(true)}
                            className="w-full py-3 bg-slate-800/50 border border-slate-700 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center space-x-2"
                                    >
                            <Icons.Key size={18} className="text-slate-400" />
                            <span>I already have an account</span>
                                    </button>

                        {/* Error display */}
                        {error && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                    </div>
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
        lightningAddress: string;
    };
    profile: {
        name: string;
        picture: string;
        pdga?: string;
    };
    setProfileData: (data: Partial<{ name: string; picture: string; pdga?: string }>) => void;
    onComplete: () => void;
    onBack: () => void;
}

const OnboardingProfileSetup: React.FC<OnboardingProfileSetupProps> = ({
    identity,
    profile,
    setProfileData,
    onComplete,
    onBack
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [showKeys, setShowKeys] = useState(false);

    // Convert to npub/nsec for display
    const npub = nip19.npubEncode(identity.publicKey);
    const nsec = nip19.nsecEncode(identity.privateKey);

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

                    {/* Your Keys Section */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <button
                            onClick={() => setShowKeys(!showKeys)}
                            className="w-full flex items-center justify-between text-left"
                        >
                            <div className="flex items-center space-x-2">
                                <Icons.Key className="text-purple-400" size={20} />
                                <span className="font-medium text-white">Your Nostr Keys</span>
                            </div>
                            <Icons.ChevronDown 
                                className={`text-slate-400 transition-transform ${showKeys ? 'rotate-180' : ''}`} 
                                size={20} 
                            />
                        </button>

                        {showKeys && (
                            <div className="mt-4 space-y-3">
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Public Key (npub)</p>
                                    <div className="p-2 bg-slate-900/50 rounded-lg">
                                        <p className="text-xs text-brand-primary font-mono break-all">{npub}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Private Key (nsec) - Keep Secret!</p>
                                    <div className="p-2 bg-slate-900/50 rounded-lg">
                                        <p className="text-xs text-red-400 font-mono break-all">{nsec}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Lightning Address</p>
                                    <div className="p-2 bg-slate-900/50 rounded-lg">
                                        <p className="text-xs text-orange-400 font-mono break-all">{identity.lightningAddress}</p>
                                    </div>
                                </div>
                            </div>
                        )}
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
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Why This Combo?</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                                    <Icons.Close size={24} />
                                </button>
                            </div>
                            <div className="space-y-4 text-slate-300 leading-relaxed text-sm">
                                <p className="text-brand-primary font-semibold italic">
                                    "We'll settle up after the round!"
                                </p>
                                <p>
                                    Famous last words. Every disc golfer knows the awkward shuffle at the parking lot, someone doesn't have cash, Venmo is "acting weird," and somehow those $5 ace pot donations just... evaporate into the ether.
                                </p>
                                <p>
                                    This app fixes that. Pay when you start. Automatic payouts when you finish. No excuses, no IOUs, no "I swear I'll get you next time."
                                </p>
                                <p className="font-semibold text-white">
                                    But why <span className="text-orange-500">Bitcoin</span>?
                                </p>
                                <p>
                        Because traditional money is broken. Banks print it endlessly, devaluing your savings. They freeze accounts, charge fees, and track every transaction.
                                </p>
                                <p>
                        <strong className="text-orange-500">Bitcoin</strong> is different. It's un-inflatable, unstoppable money that <em className="text-slate-200">you</em> truly own.
                                </p>
                                <p className="font-semibold text-white">
                                    And <span className="text-purple-500">Nostr</span>?
                                </p>
                                <p>
                        Big Tech owns your identity. They decide what you see, who sees you, and whether you even get to speak.
                                </p>
                                <p>
                        <strong className="text-purple-500">Nostr</strong> gives that power back to you. Your identity, your content, your network—nobody can take it away.
                                </p>
                                <p className="italic text-brand-primary text-center pt-2">
                                    Disc golf, financial sovereignty, and digital freedom. Now let's play.
                                </p>
                            </div>
                            <button
                    onClick={onClose}
                                className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors mt-4"
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

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                <p className="text-xs text-slate-400">
                    <strong className="text-slate-300">Note:</strong> Your nsec is stored locally on this device. We never send it anywhere. However, logging in with nsec means your Bitcoin wallet will be separate from your Nostr identity.
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
