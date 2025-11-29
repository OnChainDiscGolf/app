import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';

export const InviteHandler: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginNsec, isAuthenticated } = useApp();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState('');

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
                setStatus('success');
                // Short delay to show success state before redirecting
                setTimeout(() => {
                    window.location.href = '/play';
                }, 2500); // Increased delay to give time to read instructions
            } catch (e) {
                console.error("Invite login failed:", e);
                setStatus('error');
                setErrorMessage('Failed to log in with invite key.');
            }
        };

        // If already authenticated, we might want to warn or just redirect.
        // For now, let's assume if they scanned a code, they want to switch to that user
        // OR if they are just opening the app and happen to be logged in, maybe we should ask?
        // The requirement says "Instant Invite", implying a fresh session usually.
        // But if I'm already logged in as someone else, switching might be annoying if accidental.
        // However, the user explicitly scanned a QR code to get here.
        handleInvite();

    }, [searchParams, loginNsec, navigate]);

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
                    <div className="flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500">
                            <Icons.CheckMark className="text-green-500" size={32} strokeWidth={3} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Welcome!</h2>
                        <p className="text-slate-400 text-sm px-4">
                            To save your account, tap your browser menu and select <strong>"Add to Home Screen"</strong> or Bookmark this page.
                        </p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="mt-6 px-8 py-3 bg-brand-primary text-black font-bold rounded-full hover:bg-brand-accent transition-colors shadow-lg shadow-brand-primary/20"
                        >
                            Start Playing
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
