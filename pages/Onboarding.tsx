/**
 * Onboarding Page
 * 
 * New architecture with mnemonic-based identity:
 * 
 * Flow Options:
 * 1. NEW USER → Generate 12-word mnemonic → Backup → Profile Setup
 * 2. RECOVERY → Enter 12-word mnemonic → Profile Setup
 * 3. NSEC LOGIN → Enter nsec → Profile Setup
 * 4. AMBER LOGIN → Connect via NIP-46 → Profile Setup
 * 
 * The mnemonic serves as a UNIFIED backup for:
 * - Nostr identity (derived via NIP-06)
 * - Breez Lightning wallet (same seed)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { MnemonicBackup, MnemonicRecoveryInput } from '../components/MnemonicBackup';
import { generateNewProfileFromMnemonic, loginWithMnemonic, loginWithNsec } from '../services/nostrService';

type OnboardingStep = 
    | 'welcome'           // Initial screen with options
    | 'generating'        // Brief loading while generating keys
    | 'backup'            // Show mnemonic backup
    | 'recovery'          // Enter existing mnemonic
    | 'nsec'              // Enter existing nsec
    | 'amber'             // Amber connection flow
    | 'complete';         // Success, redirect to profile setup

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { loginNsec: appLoginNsec, loginAmber } = useApp();
    
    const [step, setStep] = useState<OnboardingStep>('welcome');
    const [generatedMnemonic, setGeneratedMnemonic] = useState('');
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


    // =========================================================================
    // ACTION HANDLERS
    // =========================================================================

    const handleCreateNewAccount = async () => {
        setStep('generating');
        setError('');

        try {
            // Small delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 500));

            // Generate mnemonic and derive keys
            const { mnemonic } = generateNewProfileFromMnemonic();
            setGeneratedMnemonic(mnemonic);
            setStep('backup');

        } catch (e) {
            console.error('Failed to generate identity:', e);
            setError('Failed to create account. Please try again.');
            setStep('welcome');
        }
    };

    const handleBackupComplete = () => {
        // Mnemonic is already stored by generateNewProfileFromMnemonic
        // Navigate to profile setup
        navigate('/profile-setup');
    };

    const handleRecoverySubmit = async (mnemonic: string) => {
        setIsLoading(true);
        setError('');

        try {
            loginWithMnemonic(mnemonic);
            navigate('/profile-setup');
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
            navigate('/profile-setup');
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
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4">
                <div className="max-w-md mx-auto text-center">
                    <p className="golden-shimmer text-base mb-2 font-semibold">Welcome to..</p>
                    <h1 className="font-extrabold tracking-tight leading-tight">
                        <div className="text-6xl mb-1">
                            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">On-Chain</span>
                        </div>
                        <div className="text-4xl">
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
                                        <Icons.Trophy className="text-brand-primary" size={48} strokeWidth={2} />
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
                                <p className="text-slate-300 text-sm font-medium">Play with</p>
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
                    />,
                    document.body
                )}
                            </div>
        );
    }

    // =========================================================================
    // RENDER: GENERATING KEYS
    // =========================================================================

    if (step === 'generating') {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
                <div className="w-20 h-20 bg-brand-primary/20 rounded-full flex items-center justify-center border-2 border-brand-primary shadow-[0_0_30px_rgba(45,212,191,0.3)] animate-pulse">
                    <Icons.Key className="text-brand-primary animate-spin" size={40} />
                </div>
                <h2 className="text-xl font-bold text-white mt-6">Creating Your Identity</h2>
                <p className="text-slate-400 text-sm mt-2">Generating secure keys...</p>
            </div>
        );
    }

    // =========================================================================
    // RENDER: MNEMONIC BACKUP
    // =========================================================================

    if (step === 'backup' && generatedMnemonic) {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col p-4 pt-8">
                <MnemonicBackup
                    mnemonic={generatedMnemonic}
                    onComplete={handleBackupComplete}
                    onBack={() => setStep('welcome')}
                    title="Save Your Recovery Phrase"
                    subtitle="This recovery phrase is the only way to recover your account and Bitcoin wallet."
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
}> = ({ onClose, onSelectRecovery, onSelectNsec, onSelectAmber }) => (
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

                    {/* Amber (Android - Always shown) */}
                    <button
                        onClick={onSelectAmber}
                        className="w-full p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl hover:bg-orange-500/20 transition-colors text-left"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                                <Icons.Diamond className="text-orange-500" size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-white">Amber Signer</p>
                                <p className="text-xs text-slate-400">Android key manager</p>
                            </div>
                        </div>
                    </button>
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
