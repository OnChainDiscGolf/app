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
                // No auto-redirect anymore
            } catch (e) {
                console.error("Invite login failed:", e);
                setStatus('error');
                setErrorMessage('Failed to log in with invite key.');
            }
        };

        handleInvite();

    }, [searchParams, loginNsec]);

    const copyToClipboard = () => {
        if (inviteNsec) {
            navigator.clipboard.writeText(inviteNsec);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                {status === 'processing' && (
                    <div className="flex flex-col items-center space-y-4">
                        <Icons.Zap className="text-brand-primary animate-bounce" size={48} />
                        <h2 className="text-xl font-bold text-white">Accepting Invite...</h2>
                        <p className="text-slate-400">Setting up your secure player profile.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center space-y-6 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500">
                            <Icons.CheckMark className="text-green-500" size={32} strokeWidth={3} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-white">Welcome!</h2>
                            <p className="text-brand-primary font-medium">Disc Golf + Bitcoin</p>
                            <p className="text-slate-400 text-sm">
                                You are now ready to play.
                            </p>
                        </div>

                        <div className="w-full bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-left">
                            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">
                                Your Secret Key (Save This!)
                            </p>
                            <div className="flex items-center space-x-2 bg-slate-950 rounded-lg p-3 border border-slate-800">
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
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                                This key is your identity and wallet. If you lose it, you lose access to your funds and history. Save it in a password manager or safe place.
                            </p>
                        </div>

                        <button
                            onClick={() => navigate('/play')}
                            className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-accent transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/20 flex items-center justify-center space-x-2"
                        >
                            <span>Start Playing</span>
                            <Icons.Play size={20} fill="currentColor" />
                        </button>
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
    );
};
