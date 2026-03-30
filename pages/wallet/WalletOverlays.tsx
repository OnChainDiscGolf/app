/**
 * @file WalletOverlays.tsx
 *
 * Full-screen overlay components extracted from the Wallet page.
 *
 * Components:
 * - **SuccessOverlay** -- themed success animation (sent/received/deposit) with
 *   auto-dismiss and optional sub-message. Uses color-coded gradients and glow
 *   effects based on transaction type.
 * - **ProcessingOverlay** -- animated lightning-bolt loader shown during
 *   in-flight wallet operations (sending payments, generating invoices, etc.).
 */

import React, { useState, useEffect } from 'react';
import { Icons } from '../../components/Icons';

/**
 * Themed success overlay with staggered animations.
 * Auto-dismisses after 2.5s (sent/deposit) or 4s (received, with a "Continue" button).
 *
 * @param message - Primary success text (e.g., "Payment Sent!").
 * @param subMessage - Optional secondary detail line.
 * @param onClose - Callback to dismiss and clean up parent state.
 * @param type - Transaction type that determines the color theme.
 */
export const SuccessOverlay: React.FC<{
    message: string,
    subMessage?: string,
    onClose: () => void,
    type?: 'sent' | 'received' | 'deposit'
}> = ({ message, subMessage, onClose, type }) => {
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        // Stagger content appearance
        const showTimer = setTimeout(() => setShowContent(true), 100);

        // Auto-close timing
        const duration = type === 'received' ? 4000 : 2500;
        const closeTimer = setTimeout(() => {
            if (type !== 'received') {
                onClose();
            }
        }, duration);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(closeTimer);
        };
    }, [onClose, type]);

    // Theme colors based on transaction type
    const theme = {
        sent: { color: '#f97316', bg: 'from-orange-500/20', glow: 'shadow-orange-500/40' },
        received: { color: '#10b981', bg: 'from-emerald-500/20', glow: 'shadow-emerald-500/40' },
        deposit: { color: '#8b5cf6', bg: 'from-purple-500/20', glow: 'shadow-purple-500/40' },
    }[type || 'sent'];

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
            {/* Gradient background */}
            <div
                className={`absolute inset-0 bg-gradient-to-br ${theme.bg} via-slate-900/95 to-black/98 backdrop-blur-md`}
            />

            {/* Radial glow behind icon */}
            <div
                className="absolute w-64 h-64 rounded-full opacity-30 blur-3xl animate-pulse"
                style={{ background: `radial-gradient(circle, ${theme.color} 0%, transparent 70%)` }}
            />

            {/* Content */}
            <div className={`relative z-10 flex flex-col items-center transition-all duration-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                {/* Success icon with ring animation */}
                <div className="relative mb-6">
                    {/* Outer ring pulse */}
                    <div
                        className="absolute inset-0 rounded-full animate-ping opacity-20"
                        style={{
                            background: theme.color,
                            animationDuration: '1.5s',
                            animationIterationCount: '2'
                        }}
                    />
                    {/* Icon container */}
                    <div
                        className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl ${theme.glow}`}
                        style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.color}dd)` }}
                    >
                        <Icons.CheckMark size={40} className="text-white" strokeWidth={3} />
                    </div>
                </div>

                {/* Message */}
                <h3
                    className="text-2xl font-bold text-white mb-2 text-center"
                    style={{ textShadow: `0 0 30px ${theme.color}60` }}
                >
                    {message}
                </h3>

                {/* Sub message */}
                {subMessage && (
                    <p className="text-slate-400 text-base text-center max-w-xs">
                        {subMessage}
                    </p>
                )}

                {/* Continue button for received */}
                {type === 'received' && (
                    <button
                        onClick={onClose}
                        className="mt-8 px-8 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95"
                        style={{
                            background: `linear-gradient(135deg, ${theme.color}, ${theme.color}cc)`,
                            boxShadow: `0 4px 20px ${theme.color}40`
                        }}
                    >
                        Continue
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * Processing overlay with a rotating lightning-bolt spinner.
 * Displayed during in-flight wallet operations.
 *
 * @param message - Status text shown below the spinner (e.g., "Sending payment...").
 */
export const ProcessingOverlay: React.FC<{ message: string }> = ({ message }) => {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
            {/* Dark gradient backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-black/95 to-slate-900/95 backdrop-blur-md" />

            {/* Pulsing glow */}
            <div
                className="absolute w-48 h-48 rounded-full opacity-20 blur-3xl animate-pulse"
                style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Animated lightning bolt loader */}
                <div className="relative w-16 h-16 mb-6">
                    {/* Rotating ring */}
                    <div
                        className="absolute inset-0 rounded-full border-2 border-orange-500/30"
                        style={{
                            borderTopColor: '#f97316',
                            animation: 'spin 1s linear infinite'
                        }}
                    />
                    {/* Inner glow ring */}
                    <div
                        className="absolute inset-2 rounded-full border border-orange-500/20"
                        style={{
                            borderTopColor: '#fb923c',
                            animation: 'spin 0.8s linear infinite reverse'
                        }}
                    />
                    {/* Center lightning icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-orange-400 animate-pulse"
                            style={{ filter: 'drop-shadow(0 0 8px #f97316)' }}
                        >
                            <path
                                d="M13 2L4.09344 12.6879C3.74463 13.1064 3.57023 13.3157 3.56756 13.4925C3.56524 13.6461 3.63372 13.7923 3.75324 13.8889C3.89073 14 4.16316 14 4.70802 14H12L11 22L19.9065 11.3121C20.2553 10.8936 20.4297 10.6843 20.4324 10.5075C20.4347 10.3539 20.3663 10.2077 20.2467 10.1111C20.1092 10 19.8368 10 19.292 10H12L13 2Z"
                                fill="currentColor"
                            />
                        </svg>
                    </div>
                </div>

                {/* Message with subtle animation */}
                <h3
                    className="text-lg font-bold text-white"
                    style={{ textShadow: '0 0 20px rgba(249,115,22,0.4)' }}
                >
                    {message}
                </h3>

                {/* Animated dots */}
                <div className="flex space-x-1 mt-3">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
};
