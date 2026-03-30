/**
 * @file DiscGolfBasketLoader.tsx
 * @description Animated loading indicator shaped like a disc golf basket.
 * Displayed while the app syncs the user's profile from Nostr relays.
 * The basket tray fills with an animated gradient to convey progress.
 */

import React from 'react';

/**
 * SVG-based disc golf basket loading animation.
 *
 * Renders a detailed disc golf basket illustration with an animated fill
 * effect inside the catching tray, accompanied by "Syncing Profile..." and
 * "Fetching from Nostr relays" text. Used as the loading state during
 * initial profile hydration.
 *
 * @returns The basket loader UI with animation.
 */
export const DiscGolfBasketLoader: React.FC = () => {
    return (
        <div className="flex flex-col items-center">
            {/* SVG Disc Golf Basket - More realistic design based on app icon */}
            <div className="relative w-40 h-40">
                <svg viewBox="0 0 120 120" className="w-full h-full">
                    {/* Central pole */}
                    <rect x="57" y="0" width="6" height="100" fill="#64748b" rx="3" />

                    {/* Top disc/cap */}
                    <circle cx="60" cy="20" r="8" fill="#3b82f6" opacity="0.6" className="top-glow" />
                    <ellipse cx="60" cy="20" rx="10" ry="3" fill="#64748b" />

                    {/* Chains - multiple strands hanging down */}
                    {/* Center chains */}
                    <line x1="60" y1="25" x2="60" y2="75" stroke="#94a3b8" strokeWidth="1.5" opacity="0.7" strokeDasharray="2,2" />

                    {/* Inner ring chains */}
                    <line x1="50" y1="28" x2="52" y2="75" stroke="#94a3b8" strokeWidth="1" opacity="0.5" strokeDasharray="2,2" />
                    <line x1="70" y1="28" x2="68" y2="75" stroke="#94a3b8" strokeWidth="1" opacity="0.5" strokeDasharray="2,2" />
                    <line x1="55" y1="30" x2="56" y2="75" stroke="#94a3b8" strokeWidth="1" opacity="0.4" strokeDasharray="2,2" />
                    <line x1="65" y1="30" x2="64" y2="75" stroke="#94a3b8" strokeWidth="1" opacity="0.4" strokeDasharray="2,2" />

                    {/* Outer ring chains */}
                    <line x1="40" y1="32" x2="45" y2="75" stroke="#94a3b8" strokeWidth="0.8" opacity="0.3" strokeDasharray="2,2" />
                    <line x1="80" y1="32" x2="75" y2="75" stroke="#94a3b8" strokeWidth="0.8" opacity="0.3" strokeDasharray="2,2" />

                    {/* Chain support rings */}
                    <ellipse cx="60" cy="25" rx="15" ry="4" fill="none" stroke="#64748b" strokeWidth="1.5" opacity="0.4" />
                    <ellipse cx="60" cy="50" rx="18" ry="5" fill="none" stroke="#64748b" strokeWidth="1" opacity="0.3" />

                    {/* Basket catching tray - this is what fills */}
                    <defs>
                        <linearGradient id="basket-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                            <stop offset="50%" stopColor="#34d399" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.7" />
                        </linearGradient>

                        {/* Mask for the basket tray */}
                        <mask id="tray-mask">
                            {/* Outer rim */}
                            <ellipse cx="60" cy="80" rx="26" ry="7" fill="white" />
                            {/* Inner cutout */}
                            <ellipse cx="60" cy="80" rx="23" ry="5.5" fill="black" />
                        </mask>

                        {/* Clip path for fill animation */}
                        <clipPath id="fill-clip">
                            <ellipse cx="60" cy="80" rx="23" ry="5.5" />
                        </clipPath>
                    </defs>

                    {/* Basket tray structure - gray metal */}
                    <ellipse cx="60" cy="80" rx="26" ry="7" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                    <ellipse cx="60" cy="80" rx="26" ry="7" fill="#64748b" mask="url(#tray-mask)" opacity="0.8" />

                    {/* Inner shadow for depth */}
                    <ellipse cx="60" cy="79" rx="23" ry="5.5" fill="#0f172a" opacity="0.6" />

                    {/* Animated fill inside basket */}
                    <g clipPath="url(#fill-clip)">
                        <rect
                            x="37"
                            y="74.5"
                            width="46"
                            height="11"
                            fill="url(#basket-gradient)"
                            className="basket-fill"
                            opacity="0.9"
                        />
                    </g>

                    {/* Support pole to ground */}
                    <rect x="57" y="85" width="6" height="35" fill="#64748b" opacity="0.6" rx="3" />

                    {/* Base/ground indicator */}
                    <ellipse cx="60" cy="115" rx="20" ry="3" fill="#1e293b" opacity="0.4" />
                </svg>
            </div>

            <h2 className="mt-6 text-xl font-bold text-white">Syncing Profile...</h2>
            <p className="text-slate-400 text-sm mt-2">Fetching from Nostr relays</p>
        </div>
    );
};
