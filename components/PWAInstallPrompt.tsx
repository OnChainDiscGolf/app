import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';

interface PWAInstallPromptProps {
    onDismiss: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onDismiss }) => {
    const [dismissCount, setDismissCount] = useState(0);
    const [isWiggling, setIsWiggling] = useState(false);

    const handleDismiss = () => {
        if (dismissCount === 0) {
            // First click: wiggle animation
            setIsWiggling(true);
            setDismissCount(1);
            setTimeout(() => setIsWiggling(false), 400); // Match wiggle animation duration
        } else {
            // Second click: actually dismiss
            onDismiss();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 ${isWiggling ? 'animate-wiggle' : ''}`}>
                <div className="p-6 space-y-4">
                    {/* Header with X button */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white">Install the App</h3>
                        <button
                            onClick={handleDismiss}
                            className="text-slate-400 hover:text-white transition-colors"
                            aria-label="Close"
                        >
                            <Icons.Close size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                        <p className="text-brand-primary font-semibold">
                            Get the best experience!
                        </p>
                        <p>
                            Install <strong className="text-white">On-Chain Disc Golf</strong> as a Progressive Web App for:
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>⚡ <strong>Faster loading</strong> and offline access</li>
                            <li>📱 <strong>Full-screen</strong> mobile experience</li>
                            <li>🏠 <strong>Home screen icon</strong> like a native app</li>
                            <li>🔔 <strong>Push notifications</strong> for round updates</li>
                        </ul>

                        {/* Installation Instructions */}
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 space-y-2">
                            <p className="text-purple-300 text-xs font-bold uppercase tracking-wide">
                                How to Install:
                            </p>
                            <div className="space-y-2 text-xs">
                                <div>
                                    <p className="font-semibold text-purple-200">iOS (Safari):</p>
                                    <p className="text-slate-400">
                                        Tap the <strong>Share</strong> icon → <strong>"Add to Home Screen"</strong>
                                    </p>
                                </div>
                                <div>
                                    <p className="font-semibold text-purple-200">Android (Chrome):</p>
                                    <p className="text-slate-400">
                                        Tap the <strong>menu</strong> (⋮) → <strong>"Add to Home screen"</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {dismissCount === 1 && (
                            <p className="text-center text-brand-primary text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                                We really recommend installing! Click X again to continue anyway.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
