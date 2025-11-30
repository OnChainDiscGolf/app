import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { loginNsec } = useApp();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [generatedNsec, setGeneratedNsec] = useState('');
    const [copied, setCopied] = useState(false);

    // Animation State
    const [activeIcon, setActiveIcon] = useState(0);

    // Modal State
    const [showNewWorldModal, setShowNewWorldModal] = useState(false);
    const [showWhyKeyModal, setShowWhyKeyModal] = useState(false);
    const [showPWAPrompt, setShowPWAPrompt] = useState(false);
    const [showExistingNsecModal, setShowExistingNsecModal] = useState(false);
    const [existingNsecInput, setExistingNsecInput] = useState('');
    const [isLoggingInExisting, setIsLoggingInExisting] = useState(false);

    // Guard to prevent infinite loop
    const hasLoadedSession = useRef(false);

    useEffect(() => {
        // Prevent re-execution
        if (hasLoadedSession.current) return;

        const loadExistingSession = () => {
            try {
                console.log('[📱 Onboarding] Loading existing session...', {
                    isPWA: window.matchMedia('(display-mode: standalone)').matches,
                    hasHash: window.location.hash.length > 0
                });

                // Get the existing guest session's nsec from localStorage
                const existingSk = localStorage.getItem('nostr_sk');

                console.log('[📱 Onboarding] localStorage check:', {
                    hasKey: !!existingSk,
                    keyPreview: existingSk ? existingSk.substring(0, 8) + '...' : 'none'
                });

                if (existingSk) {
                    // User already has a session (guest or otherwise)
                    // Display their existing nsec
                    const nsec = nip19.nsecEncode(hexToBytes(existingSk));
                    setGeneratedNsec(nsec);
                    setStatus('success');
                    console.log('[✅ Onboarding] Successfully loaded existing keypair');
                } else {
                    // Fallback: generate new keypair if somehow no session exists
                    console.warn('[⚠️ Onboarding] No existing session found, generating new keypair');
                    const sk = generateSecretKey();
                    const nsec = nip19.nsecEncode(sk);
                    loginNsec(nsec); // This will save to localStorage
                    setGeneratedNsec(nsec);
                    setStatus('success');
                }
            } catch (e) {
                console.error("[❌ Onboarding] Session load failed:", e);
                setStatus('error');
                setErrorMessage('Failed to load session. Please refresh the page.');
            }
        };

        hasLoadedSession.current = true;
        loadExistingSession();

    }, [loginNsec]);

    // Icon Crossfade Loop
    useEffect(() => {
        if (status === 'success') {
            const interval = setInterval(() => {
                setActiveIcon(prev => (prev + 1) % 3);
            }, 3000); // Change every 3 seconds
            return () => clearInterval(interval);
        }
    }, [status]);

    const copyToClipboard = () => {
        if (generatedNsec) {
            navigator.clipboard.writeText(generatedNsec);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleExistingNsecSubmit = async () => {
        if (!existingNsecInput.trim()) return;

        setIsLoggingInExisting(true);
        try {
            await loginNsec(existingNsecInput.trim());
            setShowExistingNsecModal(false);
            setShowPWAPrompt(true);
        } catch (e) {
            console.error("Login with existing nsec failed:", e);
            alert('Invalid nsec. Please check and try again.');
        } finally {
            setIsLoggingInExisting(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col">
            {/* Header - matching Play tab exactly */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4">
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
                    {status === 'loading' && (
                        <div className="flex flex-col items-center space-y-4">
                            <Icons.Zap className="text-brand-primary animate-bounce" size={48} />
                            <h2 className="text-xl font-bold text-white">Loading...</h2>
                            <p className="text-slate-400">Preparing your account.</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center space-y-5 animate-in zoom-in duration-300">

                            {/* Animated Icon Container - closer to header */}
                            <div className="relative w-28 h-28 flex items-center justify-center -mt-2">
                                {/* 1. Teal Disc Golf Basket */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 0 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-24 h-24 bg-brand-primary/20 rounded-full flex items-center justify-center border-2 border-brand-primary shadow-[0_0_30px_rgba(45,212,191,0.3)]">
                                        <Icons.Trophy className="text-brand-primary" size={48} strokeWidth={2} />
                                    </div>
                                </div>

                                {/* 2. Orange Bitcoin */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 1 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-24 h-24 bg-orange-500/20 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                                        <Icons.Bitcoin className="text-orange-500" size={56} strokeWidth={2} />
                                    </div>
                                </div>

                                {/* 3. Purple Keypair */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 2 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                                        <Icons.Key className="text-purple-500" size={48} strokeWidth={2} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-slate-300 text-sm font-medium">This app uses</p>
                                <p className="text-lg font-bold">
                                    <span
                                        className={`text-brand-primary transition-all duration-500 ${activeIcon === 0 ? 'drop-shadow-[0_0_12px_rgba(45,212,191,0.8)] scale-110 inline-block' : ''
                                            }`}
                                    >
                                        Disc Golf
                                    </span>
                                    {' + '}
                                    <span
                                        className={`text-orange-500 transition-all duration-500 ${activeIcon === 1 ? 'drop-shadow-[0_0_12px_rgba(249,115,22,0.8)] scale-110 inline-block' : ''
                                            }`}
                                    >
                                        Bitcoin
                                    </span>
                                    {' + '}
                                    <span
                                        className={`text-purple-500 transition-all duration-500 ${activeIcon === 2 ? 'drop-shadow-[0_0_12px_rgba(168,85,247,0.8)] scale-110 inline-block' : ''
                                            }`}
                                    >
                                        Nostr
                                    </span>
                                </p>
                                <button
                                    onClick={() => {
                                        console.log('[Onboarding] Learn why clicked');
                                        setShowNewWorldModal(true);
                                    }}
                                    className="text-slate-400 text-xs hover:text-white transition-colors border-b border-dashed border-slate-600 hover:border-white pb-0.5"
                                >
                                    Learn why
                                </button>
                            </div>

                            <div className="w-full bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-xl p-4 text-left shadow-lg transition-colors">
                                {/* Clickable title to open Why modal */}
                                <button
                                    onClick={() => {
                                        console.log('[Onboarding] Why key clicked');
                                        setShowWhyKeyModal(true);
                                    }}
                                    className="w-full text-left mb-3 group"
                                >
                                    <p className="text-xs text-slate-400 group-hover:text-slate-300 font-bold uppercase tracking-wider border-b border-dashed border-slate-600 group-hover:border-slate-400 pb-1 inline-block transition-colors">
                                        Save your secret Key
                                    </p>
                                </button>

                                {/* nsec field and copy button on same line */}
                                <div className="flex items-center justify-between space-x-3 bg-slate-900/50 rounded-lg p-3 border border-slate-800 mb-2">
                                    <code className="text-sm text-slate-300 font-mono flex-1">
                                        {generatedNsec.substring(0, 5)}...{generatedNsec.substring(generatedNsec.length - 4)}
                                    </code>
                                    <button
                                        onClick={copyToClipboard}
                                        className="flex items-center space-x-2 bg-brand-primary hover:bg-brand-accent text-black font-bold px-4 py-2 rounded-lg transition-all active:scale-95 shrink-0"
                                        title="Copy your secret key"
                                    >
                                        {copied ? (
                                            <>
                                                <Icons.Check size={16} />
                                                <span className="text-xs">Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Icons.Copy size={16} />
                                                <span className="text-xs">Copy Key</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Helper text */}
                                <p className="text-xs text-slate-500 text-center">
                                    Tap to copy • Keep this safe
                                </p>

                                {/* "I already have a nsec" option */}
                                <div className="mt-3 text-center">
                                    <button
                                        onClick={() => setShowExistingNsecModal(true)}
                                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors border-b border-dashed border-slate-700 hover:border-slate-500"
                                    >
                                        I already have a nsec
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    console.log('[Onboarding] Navigate to profile setup via PWA prompt');
                                    setShowPWAPrompt(true);
                                }}
                                className="w-full py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-accent transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/20 flex items-center justify-center space-x-2"
                            >
                                <span>Go to Profile</span>
                                <Icons.Next size={18} />
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                                <Icons.Close className="text-red-500" size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Setup Failed</h2>
                            <p className="text-red-300 text-center px-4">{errorMessage}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold transition-colors"
                            >
                                Refresh Page
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* PWA Install Prompt */}
            {showPWAPrompt && (
                <PWAInstallPrompt onDismiss={() => navigate('/profile-setup')} />
            )}

            {/* Existing Nsec Input Modal */}
            {showExistingNsecModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Enter Your Secret Key</h3>
                                <button onClick={() => setShowExistingNsecModal(false)} className="text-slate-400 hover:text-white">
                                    <Icons.Close size={24} />
                                </button>
                            </div>
                            <div className="space-y-3 text-slate-300 text-sm">
                                <p>
                                    If you already have a Nostr account, paste your <strong className="text-purple-400">private key (nsec)</strong> below.
                                </p>
                                <div className="space-y-2">
                                    <input
                                        type="password"
                                        value={existingNsecInput}
                                        onChange={(e) => setExistingNsecInput(e.target.value)}
                                        placeholder="nsec1..."
                                        className="w-full px-4 py-3 bg-black/50 border border-slate-800 rounded-lg text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleExistingNsecSubmit();
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setShowExistingNsecModal(false)}
                                    className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExistingNsecSubmit}
                                    disabled={!existingNsecInput.trim() || isLoggingInExisting}
                                    className="flex-1 py-3 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoggingInExisting ? 'Logging in...' : 'Login'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modals rendered via Portal to document.body */}
            {showNewWorldModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Why This Combo?</h3>
                                <button onClick={() => setShowNewWorldModal(false)} className="text-slate-400 hover:text-white">
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
                                    Because traditional money is broken. Banks print it endlessly, devaluing your savings. They freeze accounts, charge fees, and track every transaction. Your $100 today buys less than it did last year, and even less next year.
                                </p>
                                <p>
                                    <strong className="text-orange-500">Bitcoin</strong> is different. It's un-inflatable, unstoppable money that <em className="text-slate-200">you</em> truly own. No bank can freeze it. No government can print more of it. It's financial freedom.
                                </p>
                                <p className="font-semibold text-white">
                                    And <span className="text-purple-500">Nostr</span>?
                                </p>
                                <p>
                                    Big Tech owns your identity. Facebook, Twitter, Google—they decide what you see, who sees you, and whether you even get to speak. Shadow bans. Account suspensions. Censorship committees.
                                </p>
                                <p>
                                    <strong className="text-purple-500">Nostr</strong> gives that power back to you. It's a protocol, not a platform. Your identity, your content, your network—nobody can take it away. Move between apps freely. Speak freely.
                                </p>
                                <p className="italic text-brand-primary text-center pt-2">
                                    Disc golf, financial sovereignty, and digital freedom. Now let's play.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowNewWorldModal(false)}
                                className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors mt-4"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Why Save Key Modal */}
            {showWhyKeyModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Your Money, Your Responsibility</h3>
                                <button onClick={() => setShowWhyKeyModal(false)} className="text-slate-400 hover:text-white">
                                    <Icons.Close size={24} />
                                </button>
                            </div>
                            <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
                                <p className="font-medium text-slate-200">
                                    This key is literally your money.
                                </p>
                                <p>
                                    Lose it, and your funds are gone forever. There's no "Forgot Password" button. No customer support agent to call. No reset email.
                                </p>
                                <p>
                                    <strong className="text-orange-400">You are the bank now.</strong> That's scary and liberating at the same time.
                                </p>
                                <p className="text-xs text-slate-400 italic">
                                    (Seriously though, text it to yourself if you have to. Screenshot it. Tattoo it on your forearm. We don't recommend any of those, but they're better than nothing.)
                                </p>
                                <p className="font-medium text-slate-200">
                                    Save it somewhere safe:
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-xs">
                                    <li>Password manager (best option)</li>
                                    <li>Encrypted note on your phone</li>
                                    <li>Good old pen and paper</li>
                                </ul>

                                {/* Copyable nsec */}
                                <div className="pt-2">
                                    <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-bold">Your Key:</p>
                                    <div className="flex items-center space-x-2 bg-black/50 rounded-lg p-2 border border-slate-800">
                                        <code className="flex-1 text-xs text-slate-300 font-mono truncate select-all">
                                            {generatedNsec}
                                        </code>
                                        <button
                                            onClick={copyToClipboard}
                                            className="p-1.5 hover:bg-slate-800 rounded transition-colors text-brand-primary"
                                        >
                                            {copied ? <Icons.Check size={14} /> : <Icons.Copy size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Nostr Clients */}
                                <div className="pt-2">
                                    <p className="text-xs text-slate-400 mb-2">Use your key in other apps:</p>
                                    <div className="flex flex-wrap gap-2">
                                        <a href="https://damus.io" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                            Damus
                                        </a>
                                        <a href="https://primal.net" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                            Primal
                                        </a>
                                        <a href="https://fountain.fm" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                            Fountain
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowWhyKeyModal(false)}
                                className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors mt-4"
                            >
                                I'll Guard It With My Life
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
