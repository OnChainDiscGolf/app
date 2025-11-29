import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';

export const InviteHandler: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginNsec } = useApp();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState('');
    const [inviteNsec, setInviteNsec] = useState('');
    const [copied, setCopied] = useState(false);

    // Animation State
    const [activeIcon, setActiveIcon] = useState(0);

    // Modal State
    const [showNewWorldModal, setShowNewWorldModal] = useState(false);
    const [showWhyKeyModal, setShowWhyKeyModal] = useState(false);

    // Guard to prevent infinite loop
    const hasAttemptedLogin = useRef(false);

    useEffect(() => {
        // Prevent re-execution
        if (hasAttemptedLogin.current) return;

        const handleInvite = async () => {
            const nsec = searchParams.get('nsec');

            if (!nsec) {
                setStatus('error');
                setErrorMessage('Invalid invite link: Missing key.');
                return;
            }

            try {
                await loginNsec(nsec);
                setInviteNsec(nsec);
                setStatus('success');
            } catch (e) {
                console.error("Invite login failed:", e);
                setStatus('error');
                setErrorMessage('Failed to log in with invite key.');
            }
        };

        hasAttemptedLogin.current = true;
        handleInvite();

    }, [searchParams]); // Removed loginNsec - it's from context and causes infinite loop

    // Timeout protection - prevent stuck processing state
    useEffect(() => {
        if (status === 'processing') {
            const timeout = setTimeout(() => {
                console.error('[InviteHandler] Login timeout after 10 seconds');
                setStatus('error');
                setErrorMessage('Connection timeout. Please try scanning the QR code again.');
            }, 10000);

            return () => clearTimeout(timeout);
        }
    }, [status]);

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
        if (inviteNsec) {
            navigator.clipboard.writeText(inviteNsec);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex-1 bg-brand-dark flex flex-col overflow-y-auto">
            {/* Header - matching Play tab exactly */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4 sticky top-0 z-10">
                <div className="max-w-md mx-auto text-center">
                    <p className="golden-shimmer text-base mb-2 font-semibold">You've been added to the card on..</p>
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

            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <div className="max-w-md w-full">
                    {status === 'processing' && (
                        <div className="flex flex-col items-center space-y-4">
                            <Icons.Zap className="text-brand-primary animate-bounce" size={48} />
                            <h2 className="text-xl font-bold text-white">Accepting Invite...</h2>
                            <p className="text-slate-400">Setting up your secure player profile.</p>
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
                                        console.log('[InviteHandler] Learn why clicked');
                                        setShowNewWorldModal(true);
                                    }}
                                    className="text-slate-400 text-xs hover:text-white transition-colors border-b border-dashed border-slate-600 hover:border-white pb-0.5"
                                >
                                    Learn why
                                </button>
                            </div>

                            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-left shadow-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                        Save your secret Key
                                    </p>
                                    <button
                                        onClick={() => {
                                            console.log('[InviteHandler] Why key clicked');
                                            setShowWhyKeyModal(true);
                                        }}
                                        className="text-xs text-brand-primary hover:text-brand-accent flex items-center space-x-1"
                                    >
                                        <Icons.Help size={12} />
                                        <span>Why?</span>
                                    </button>
                                </div>

                                <div className="flex items-center space-x-2 bg-black/50 rounded-lg p-2 border border-slate-800">
                                    <code className="flex-1 text-xs text-slate-300 font-mono truncate select-all">
                                        {inviteNsec}
                                    </code>
                                    <button
                                        onClick={copyToClipboard}
                                        className="p-2 hover:bg-slate-800 rounded-md transition-colors text-brand-primary"
                                        title="Copy Key"
                                    >
                                        {copied ? <Icons.Check size={14} /> : <Icons.Copy size={14} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    console.log('[InviteHandler] Navigate to /play');
                                    navigate('/play');
                                }}
                                className="w-full py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-accent transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/20 flex items-center justify-center space-x-2"
                            >
                                <span>Go to Scorecard</span>
                                <Icons.Next size={18} />
                            </button>

                            <p className="text-xs text-slate-500 font-medium">
                                You have been added to the round.
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                                <Icons.Close className="text-red-500" size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Invite Failed</h2>
                            <p className="text-red-300 text-center px-4">{errorMessage}</p>
                            <button
                                onClick={() => navigate('/')}
                                className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold transition-colors"
                            >
                                Go Home
                            </button>
                        </div>
                    )}
                </div>
            </div>

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
                                            {inviteNsec}
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
                                        <a href="https://snort.social" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                            Snort
                                        </a>
                                        <a href="https://nostrudel.ninja" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                            Nostrudel
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
