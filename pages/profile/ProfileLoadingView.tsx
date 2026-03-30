/**
 * @file ProfileLoadingView.tsx
 *
 * Full-screen loading animation shown while the user's Nostr profile is being
 * fetched from relays after authentication.
 *
 * Features a cryptographic key-pair animation: two key icons (purple/orange)
 * slide in from opposite sides and "connect" in the center, symbolizing the
 * public/private key pair. Includes rotating rings, a connection pulse, and
 * animated loading dots. Uses CSS `@keyframes` defined inline.
 */

import React from 'react';
import { Icons } from '../../components/Icons';

/**
 * Animated loading screen displayed while fetching the user's profile from Nostr relays.
 * Shows a key-pair animation with rotating rings and pulsing connection effects.
 */
export const ProfileLoadingView: React.FC = () => {
    return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900" />

                {/* Subtle animated gradient orbs */}
                <div
                    className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
                        animation: 'orbFloat 3s ease-in-out infinite'
                    }}
                />
                <div
                    className="absolute w-64 h-64 rounded-full opacity-15 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
                        animation: 'orbFloat 3s ease-in-out infinite reverse',
                        animationDelay: '1.5s'
                    }}
                />

                {/* Center content */}
                <div className="relative z-10 flex flex-col items-center">

                    {/* Rotating outer ring */}
                    <div className="relative w-32 h-32 mb-8">
                        <div
                            className="absolute inset-0 rounded-full border-2 border-purple-500/30"
                            style={{ animation: 'ringRotate 3s linear infinite' }}
                        />
                        <div
                            className="absolute inset-2 rounded-full border border-orange-500/20"
                            style={{ animation: 'ringRotate 2s linear infinite reverse' }}
                        />

                        {/* Keys container */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            {/* Left Key (Purple - Private) */}
                            <div
                                className="absolute"
                                style={{
                                    animation: 'keySlideLeft 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                                }}
                            >
                                <div className="relative">
                                    <Icons.Key
                                        size={36}
                                        className="text-purple-400"
                                        style={{
                                            filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.8))',
                                            transform: 'rotate(-45deg)'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Right Key (Orange - Public) */}
                            <div
                                className="absolute"
                                style={{
                                    animation: 'keySlideRight 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                                }}
                            >
                                <div className="relative">
                                    <Icons.Key
                                        size={36}
                                        className="text-orange-400"
                                        style={{
                                            filter: 'drop-shadow(0 0 12px rgba(249, 115, 22, 0.8))',
                                            transform: 'rotate(135deg)'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Connection pulse (appears when keys meet) */}
                            <div
                                className="absolute w-3 h-3 rounded-full"
                                style={{
                                    background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                    boxShadow: '0 0 20px rgba(139, 92, 246, 0.8), 0 0 40px rgba(249, 115, 22, 0.6)',
                                    animation: 'connectionPulse 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards',
                                    opacity: 0,
                                    transform: 'scale(0)'
                                }}
                            />
                        </div>

                        {/* Success flash ring */}
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                border: '2px solid transparent',
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(249, 115, 22, 0.5)) border-box',
                                WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                                WebkitMaskComposite: 'xor',
                                maskComposite: 'exclude',
                                animation: 'successRing 0.6s ease-out 1s forwards',
                                opacity: 0
                            }}
                        />
                    </div>

                    {/* Loading text */}
                    <div
                        className="text-white/80 text-sm font-medium tracking-wider uppercase"
                        style={{ animation: 'fadeInUp 0.5s ease-out 0.3s forwards', opacity: 0 }}
                    >
                        Loading Profile
                    </div>

                    {/* Animated dots */}
                    <div className="flex space-x-1 mt-2">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>

                {/* Keyframes */}
                <style>{`
                    @keyframes orbFloat {
                        0%, 100% { transform: translate(-20%, -20%); }
                        50% { transform: translate(20%, 20%); }
                    }

                    @keyframes ringRotate {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }

                    @keyframes keySlideLeft {
                        0% {
                            transform: translateX(-60px) rotate(-20deg);
                            opacity: 0;
                        }
                        60% {
                            transform: translateX(-8px) rotate(5deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateX(-12px) rotate(0deg);
                            opacity: 1;
                        }
                    }

                    @keyframes keySlideRight {
                        0% {
                            transform: translateX(60px) rotate(20deg);
                            opacity: 0;
                        }
                        60% {
                            transform: translateX(8px) rotate(-5deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateX(12px) rotate(0deg);
                            opacity: 1;
                        }
                    }

                    @keyframes connectionPulse {
                        0% {
                            transform: scale(0);
                            opacity: 0;
                        }
                        50% {
                            transform: scale(1.5);
                            opacity: 1;
                        }
                        100% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }

                    @keyframes successRing {
                        0% {
                            transform: scale(1);
                            opacity: 0;
                        }
                        50% {
                            transform: scale(1.3);
                            opacity: 0.8;
                        }
                        100% {
                            transform: scale(1.5);
                            opacity: 0;
                        }
                    }

                    @keyframes fadeInUp {
                        from {
                            transform: translateY(10px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                `}</style>
            </div>
    );
};
