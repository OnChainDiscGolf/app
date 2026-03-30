/**
 * @file ProfileGuestView.tsx
 *
 * Unauthenticated profile view -- shown to guest users who haven't logged in.
 *
 * Provides two primary flows:
 * 1. **Create** -- generates a new Nostr identity from a 12-word BIP-39 mnemonic
 *    (NIP-06 key derivation). Sets up both Nostr keys and Breez wallet seed.
 * 2. **Login** -- authenticate with an existing nsec key, NIP-46 bunker URL,
 *    or Amber signer (Android only).
 *
 * Includes educational help modals explaining Nostr identity and key concepts.
 */

import React from 'react';
import { Icons } from '../../components/Icons';
import { Button } from '../../components/Button';
import { ProfileGuestViewProps } from './profileTypes';

/**
 * Guest profile view -- login and account creation UI for unauthenticated users.
 */
export const ProfileGuestView: React.FC<ProfileGuestViewProps> = ({
    authView, setAuthView,
    nsecInput, setNsecInput,
    bunkerInput, setBunkerInput,
    authError, setAuthError,
    isLoading,
    handleLogin, handleNip46Login, handleCreate,
    loginAmber,
    helpModal, setHelpModal,
    openHelp,
}) => {
    return (
            <div className="p-6 pt-8 flex flex-col h-full pb-24 overflow-y-auto">
                {/* Header with gradient icon */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative mb-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 via-purple-600/30 to-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30 shadow-[0_0_30px_rgba(147,51,234,0.3)]">
                            <Icons.Key size={36} className="text-purple-400" />
                        </div>
                        {/* Subtle glow ring */}
                        <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-xl -z-10"></div>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Welcome!</h1>
                    <p className="text-slate-400 text-center mt-2 text-sm max-w-xs leading-relaxed">
                        Create your profile to save scores and compete with friends, or log in if you already have one.
                    </p>
                    <p className="text-slate-500 text-center mt-2 text-xs">
                        Powered by{' '}
                        <button
                            onClick={() => openHelp(
                                'What is Nostr?',
                                'nostr-intro'
                            )}
                            className="text-purple-400 hover:text-purple-300 underline transition-colors font-medium"
                        >
                            Nostr
                        </button>
                    </p>
                </div>

                {/* Wallet-style toggle pill */}
                <div className="flex bg-black/30 backdrop-blur-sm p-1 rounded-xl mb-6 border border-white/10">
                    <button
                        onClick={() => {
                            setAuthView('create');
                            setAuthError('');
                        }}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${
                            authView === 'create'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                                : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                    >
                        Create Profile
                    </button>
                    <button
                        onClick={() => {
                            setAuthView('login');
                            setAuthError('');
                        }}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${
                            authView === 'login'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                                : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                    >
                        Login
                    </button>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    {authView === 'create' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* Create Profile Card - Wallet style */}
                            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 p-6 rounded-2xl border border-white/10 text-center backdrop-blur-sm shadow-xl">
                                <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
                                    <Icons.Shield size={28} className="text-purple-400" />
                                </div>
                                <h3 className="font-bold text-lg text-white mb-2">First Time Here?</h3>
                                <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                                    We'll generate a <span className="text-purple-400 font-medium">12-word backup phrase</span> that secures both your identity and your Bitcoin wallet.
                                </p>

                                {/* Info callout */}
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-5 text-left">
                                    <div className="flex items-start space-x-2">
                                        <Icons.Bitcoin size={16} className="text-orange-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-orange-200/80 leading-relaxed">
                                            <span className="text-orange-400 font-bold">One backup, everything secured.</span> Your seed phrase backs up your profile AND your sats.
                                        </p>
                                    </div>
                                </div>

                                <Button fullWidth onClick={handleCreate} disabled={isLoading}>
                                    {isLoading ? 'Generating Keys...' : 'Create Profile'}
                                </Button>

                                <p className="text-[10px] text-slate-500 mt-3">
                                    No email or password required
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Seed Phrase Recovery Option - Primary */}
                            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 p-5 rounded-2xl border border-purple-500/20 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                                        <Icons.Key size={18} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-white font-bold block">Seed Phrase or Private Key</label>
                                        <span className="text-xs text-slate-500">12-word phrase or nsec</span>
                                    </div>
                                </div>
                                <div className="relative mb-3">
                                    <input
                                        type="password"
                                        placeholder="nsec1... or 12 words separated by spaces"
                                        value={nsecInput}
                                        onChange={e => setNsecInput(e.target.value)}
                                        className="w-full bg-black/30 border border-slate-700 rounded-xl p-4 pl-4 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none placeholder:text-slate-600 transition-all"
                                    />
                                </div>
                                <Button fullWidth onClick={handleLogin} disabled={!nsecInput || isLoading}>
                                    {isLoading ? 'Verifying...' : 'Restore Account'}
                                </Button>

                                {/* Error message */}
                                {authError && (
                                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center text-sm animate-in fade-in slide-in-from-top-2">
                                        {authError}
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="relative flex items-center py-1">
                                <div className="flex-grow border-t border-slate-800"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-600 text-xs font-bold uppercase tracking-wider">Advanced</span>
                                <div className="flex-grow border-t border-slate-800"></div>
                            </div>

                            {/* Advanced Options - Collapsed style */}
                            <div className="space-y-3">
                                {/* Amber Button */}
                                <button
                                    onClick={() => loginAmber()}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-green-500/30 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-9 h-9 bg-green-500/20 rounded-lg flex items-center justify-center">
                                            <Icons.Android size={18} className="text-green-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">Amber Signer</p>
                                            <p className="text-xs text-slate-500">Android only</p>
                                        </div>
                                    </div>
                                    <Icons.Next size={16} className="text-slate-500 group-hover:text-green-400 transition-colors" />
                                </button>

                                {/* NIP-46 Button */}
                                <button
                                    onClick={() => {
                                        // Toggle NIP-46 input
                                        if (bunkerInput === '') {
                                            setBunkerInput(' '); // Show input
                                        }
                                    }}
                                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/30 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                            <Icons.Link size={18} className="text-blue-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">Remote Signer</p>
                                            <p className="text-xs text-slate-500">NIP-46 bunker</p>
                                        </div>
                                    </div>
                                    <Icons.Next size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                                </button>

                                {/* NIP-46 Input (shown when clicked) */}
                                {bunkerInput && (
                                    <div className="animate-in slide-in-from-top-2 duration-200 space-y-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="bunker://..."
                                                value={bunkerInput === ' ' ? '' : bunkerInput}
                                                onChange={e => setBunkerInput(e.target.value)}
                                                className="w-full bg-black/30 border border-slate-600 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button
                                                fullWidth
                                                variant="secondary"
                                                onClick={handleNip46Login}
                                                disabled={bunkerInput.trim().length < 5 || isLoading}
                                            >
                                                {isLoading ? 'Connecting...' : 'Connect'}
                                            </Button>
                                            <button
                                                onClick={() => setBunkerInput('')}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 text-sm transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Help Modal */}
                {helpModal && helpModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[75vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
                            <button
                                onClick={() => setHelpModal(null)}
                                className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white"
                            >
                                <Icons.Close size={20} />
                            </button>

                            <div className="p-6 border-b border-slate-800">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                        <Icons.Help size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-white">{helpModal.title}</h2>
                                </div>
                            </div>

                            {helpModal.text === 'nostr-intro' ? (
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                        <p>
                                            <strong className="text-white text-base">Your identity, your control.</strong>
                                        </p>
                                        <p>
                                            Nostr is a protocol that lets YOU own your online identity. Unlike traditional apps where <strong className="text-red-400">companies own and control your account</strong>, with Nostr you have a <strong className="text-purple-400">private key (nsec)</strong> that proves you're you.
                                        </p>

                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                            <p className="text-red-200 font-bold text-xs mb-2">IMPORTANT: Keep Your nsec Safe!</p>
                                            <p className="text-red-100 text-xs">
                                                Your nsec is like a master password. Anyone with it can access your profile AND your funds in this app. Save it somewhere secure - if you lose it, you lose everything.
                                            </p>
                                        </div>

                                        <p className="text-brand-primary font-bold">
                                            In this app, your Bitcoin wallet is tied to your nsec. Guard it carefully!
                                        </p>

                                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                            <p className="text-purple-200 font-bold text-xs mb-2">One Key, Infinite Apps</p>
                                            <p className="text-purple-100 text-xs">
                                                You can use your nsec to log into other Nostr apps and services. Your profile, friends, and content follow you everywhere.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-white font-bold text-sm">Try Popular Nostr Apps:</p>
                                            <div className="flex flex-wrap gap-2">
                                                <a href="https://primal.net" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Primal
                                                </a>
                                                <a href="https://damus.io" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Damus
                                                </a>
                                                <a href="https://iris.to" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Iris
                                                </a>
                                                <a href="https://zap.stream" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Zap.Stream
                                                </a>
                                                <a href="https://zapstore.dev" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Zapstore
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="flex flex-col items-center text-center space-y-2">
                                        <div className="w-12 h-12 rounded-full bg-brand-secondary/10 flex items-center justify-center text-brand-secondary mb-2">
                                            <Icons.Help size={24} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white">{helpModal.title}</h3>
                                        <div
                                            className="text-slate-300 text-sm leading-relaxed text-left whitespace-pre-line"
                                            dangerouslySetInnerHTML={{ __html: helpModal.text }}
                                        />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
    );
};
