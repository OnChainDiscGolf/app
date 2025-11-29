import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

    useEffect(() => {
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

        handleInvite();

    }, [searchParams, loginNsec]);

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
        <div className="min-h-screen bg-brand-dark flex flex-col">
            {/* Header - matching Play tab exactly */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-6 sticky top-0 z-10">
                <div className="max-w-md mx-auto text-center">
                    <p className="text-slate-400 text-xs mb-3 font-medium">You've been added to the card on..</p>
                    <h1 className="font-extrabold tracking-tight leading-tight">
                        <div className="text-5xl mb-1">
                            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">On-Chain</span>
                        </div>
                        <div className="text-4xl">
                            <span className="text-white">Disc Golf</span>
                        </div>
                    </h1>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full">
                    {status === 'processing' && (
                        <div className="flex flex-col items-center space-y-4">
                            <Icons.Zap className="text-brand-primary animate-bounce" size={48} />
                            <h2 className="text-xl font-bold text-white">Accepting Invite...</h2>
                            <p className="text-slate-400">Setting up your secure player profile.</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-300">

                            {/* Animated Icon Container */}
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                {/* 1. Teal Disc Golf Basket */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 0 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-20 h-20 bg-brand-primary/20 rounded-full flex items-center justify-center border-2 border-brand-primary shadow-[0_0_30px_rgba(45,212,191,0.3)]">
                                        <Icons.Trophy className="text-brand-primary" size={40} strokeWidth={2} />
                                    </div>
                                </div>

                                {/* 2. Orange Bitcoin */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 1 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                                        <Icons.Bitcoin className="text-orange-500" size={40} strokeWidth={2} />
                                    </div>
                                </div>

                                {/* 3. Purple Keypair */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${activeIcon === 2 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                                        <Icons.Key className="text-purple-500" size={40} strokeWidth={2} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-slate-300 text-base font-medium">This app uses</p>
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
                                    onClick={() => setShowNewWorldModal(true)}
                                    className="text-slate-400 text-sm hover:text-white transition-colors border-b border-dashed border-slate-600 hover:border-white pb-0.5"
                                >
                                    Welcome to the New World
                                </button>
                            </div>

                            <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                        Save your secret Key
                                    </p>
                                    <button
                                        onClick={() => setShowWhyKeyModal(true)}
                                        className="text-xs text-brand-primary hover:text-brand-accent flex items-center space-x-1"
                                    >
                                        <Icons.Help size={12} />
                                        <span>Why?</span>
                                    </button>
                                </div>

                                <div className="flex items-center space-x-2 bg-black/50 rounded-lg p-3 border border-slate-800 mb-1">
                                    <code className="flex-1 text-xs text-slate-300 font-mono truncate select-all">
                                        {inviteNsec}
                                    </code>
                                    <button
                                        onClick={copyToClipboard}
                                        className="p-2 hover:bg-slate-800 rounded-md transition-colors text-brand-primary"
                                        title="Copy Key"
                                    >
                                        {copied ? <Icons.Check size={16} /> : <Icons.Copy size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/play')}
                                className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-accent transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/20 flex items-center justify-center space-x-2"
                            >
                                <span>Go to Scorecard</span>
                                <Icons.Next size={20} />
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
                            <p className="text-red-300">{errorMessage}</p>
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

            {/* New World Modal */}
            {showNewWorldModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">The New World</h3>
                                <button onClick={() => setShowNewWorldModal(false)} className="text-slate-400 hover:text-white">
                                    <Icons.Close size={24} />
                                </button>
                            </div>
                            <div className="space-y-4 text-slate-300 leading-relaxed text-sm">
                                <p>
                                    Banks and corporations own your money. They track every transaction, sell your data, and can turn off your account if you rebel or simply disagree with them.
                                </p>
                                <p>
                                    Media companies own your identity. They keep you in walled gardens that get worse every year, algorithmically manipulating what you see and who sees you.
                                </p>
                                <p className="font-semibold text-white">
                                    In come Bitcoin and Nostr.
                                </p>
                                <p>
                                    <strong className="text-orange-500">Bitcoin</strong> is unstoppable, uninflatable money that you truly own. No one can freeze it, seize it, or print more of it to devalue your savings.
                                </p>
                                <p>
                                    <strong className="text-purple-500">Nostr</strong> is an identity no one but yourself controls. It's a protocol, not a platform. You can take your followers, your content, and your reputation to any app you choose.
                                </p>
                                <p className="italic text-brand-primary">
                                    Thank god we have disc golf.
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
                </div>
            )}

            {/* Why Key Modal */}
            {showWhyKeyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Why Save This Key?</h3>
                                <button onClick={() => setShowWhyKeyModal(false)} className="text-slate-400 hover:text-white">
                                    <Icons.Close size={24} />
                                </button>
                            </div>
                            <div className="space-y-4 text-slate-300 text-sm">
                                <p>
                                    This app is built on <strong className="text-purple-500">Nostr</strong>, a decentralized network.
                                </p>
                                <p>
                                    Unlike traditional apps where you have a username and password stored on a company's server, here you have a <strong>Key Pair</strong>.
                                </p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>Your <strong>Secret Key (nsec)</strong> is your master password. It controls your account and your money.</li>
                                    <li>If you lose this key, you lose access to your funds and history forever. There is no "Forgot Password" button.</li>
                                </ul>
                                <p className="text-brand-primary font-medium">
                                    Save it in a password manager or a safe place!
                                </p>
                            </div>
                            <button
                                onClick={() => setShowWhyKeyModal(false)}
                                className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors mt-4"
                            >
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
