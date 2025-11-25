import React from 'react';

export const DiscGolfBasketLoader: React.FC = () => {
    return (
        <div className="flex flex-col items-center">
            {/* SVG Disc Golf Basket */}
            <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Basket pole (gray) */}
                    <rect x="47" y="70" width="6" height="30" fill="#64748b" />

                    {/* Basket chains (gray) - vertical */}
                    <line x1="50" y1="30" x2="50" y2="70" stroke="#64748b" strokeWidth="1.5" opacity="0.6" />
                    <line x1="40" y1="35" x2="40" y2="70" stroke="#64748b" strokeWidth="1" opacity="0.4" />
                    <line x1="60" y1="35" x2="60" y2="70" stroke="#64748b" strokeWidth="1" opacity="0.4" />

                    {/* Basket chains (gray) - horizontal rings */}
                    <circle cx="50" cy="45" r="18" fill="none" stroke="#64748b" strokeWidth="1" opacity="0.3" />
                    <circle cx="50" cy="60" r="20" fill="none" stroke="#64748b" strokeWidth="1" opacity="0.3" />

                    {/* Basket bowl - gradient fill with animation */}
                    <defs>
                        <linearGradient id="fill-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" /> {/* Emerald */}
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.7" /> {/* Blue */}
                        </linearGradient>
                        <clipPath id="basket-clip">
                            <ellipse cx="50" cy="75" rx="22" ry="6" />
                        </clipPath>
                    </defs>

                    {/* Static basket outline */}
                    <ellipse cx="50" cy="75" rx="22" ry="6" fill="none" stroke="#64748b" strokeWidth="2.5" />

                    {/* Animated fill that grows from bottom */}
                    <g clipPath="url(#basket-clip)">
                        <rect
                            x="28"
                            y="69"
                            width="44"
                            height="12"
                            fill="url(#fill-gradient)"
                            className="basket-fill"
                        />
                    </g>

                    {/* Top ring highlight */}
                    <ellipse cx="50" cy="30" r="4" fill="#3b82f6" opacity="0.5" className="top-glow" />
                </svg>
            </div>

            <h2 className="mt-6 text-xl font-bold text-white">Syncing Profile...</h2>
            <p className="text-slate-400 text-sm mt-2">Fetching from Nostr relays</p>
        </div>
    );
};
