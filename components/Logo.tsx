/**
 * @file Logo.tsx
 * @description Application logo components in three variants:
 * - {@link Logo} - Realistic disc golf basket with Bitcoin accent (primary)
 * - {@link LogoChainDisc} - Abstract disc with chain ring and Bitcoin center
 * - {@link LogoMinimal} - Simplified basket outline with gradient stroke
 *
 * All variants are pure SVG, resolution-independent, and accept a `size` prop.
 */

import React from 'react';

/**
 * Props shared by all logo variants.
 *
 * @property size - Width and height in pixels. Defaults to 80.
 * @property variant - Logo variant hint (not currently used for switching; each variant is a separate export).
 * @property className - Additional CSS classes.
 */
interface LogoProps {
    size?: number;
    variant?: 'full' | 'icon' | 'minimal';
    className?: string;
}

/**
 * Primary application logo: a realistic disc golf basket SVG with metal
 * gradients, hanging chains, an orange top band, and a Bitcoin (₿) symbol
 * on the pole cap.
 *
 * @param props - {@link LogoProps}
 * @returns The basket logo SVG.
 */
export const Logo: React.FC<LogoProps> = ({ size = 80, className = '' }) => {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg 
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
            >
                <defs>
                    {/* Metal gradient for chains and basket */}
                    <linearGradient id="metalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e2e8f0" />
                        <stop offset="50%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                    {/* Pole gradient */}
                    <linearGradient id="poleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                    {/* Orange accent for Bitcoin hint */}
                    <linearGradient id="orangeAccent" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fb923c" />
                        <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                </defs>
                
                {/* Center pole */}
                <rect x="47" y="25" width="6" height="65" rx="3" fill="url(#poleGrad)" />
                
                {/* Base plate */}
                <ellipse cx="50" cy="90" rx="20" ry="5" fill="#334155" />
                <ellipse cx="50" cy="88" rx="16" ry="4" fill="#475569" />
                
                {/* Top band/ring - the yellow band on real baskets */}
                <ellipse cx="50" cy="20" rx="22" ry="5" fill="none" stroke="url(#orangeAccent)" strokeWidth="4" />
                <ellipse cx="50" cy="20" rx="22" ry="5" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" />
                
                {/* Chains - hanging from top band to basket */}
                <g stroke="url(#metalGradient)" strokeWidth="1.5" fill="none" strokeLinecap="round">
                    {/* 12 chains around the basket */}
                    <path d="M28 20 C28 35 30 45 32 55" />
                    <path d="M33 18 C32 33 33 45 35 55" />
                    <path d="M39 16 C37 32 37 45 38 55" />
                    <path d="M45 15 C43 31 43 45 43 55" />
                    <path d="M50 15 C50 31 50 45 50 55" />
                    <path d="M55 15 C57 31 57 45 57 55" />
                    <path d="M61 16 C63 32 63 45 62 55" />
                    <path d="M67 18 C68 33 67 45 65 55" />
                    <path d="M72 20 C72 35 70 45 68 55" />
                </g>
                
                {/* Basket/tray - the catching area */}
                <path 
                    d="M28 55 L32 72 L68 72 L72 55" 
                    fill="none" 
                    stroke="url(#metalGradient)" 
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                
                {/* Basket bottom */}
                <ellipse cx="50" cy="72" rx="18" ry="4" fill="none" stroke="url(#metalGradient)" strokeWidth="2" />
                
                {/* Inner basket ring */}
                <ellipse cx="50" cy="55" rx="22" ry="4" fill="none" stroke="#64748b" strokeWidth="1.5" />
                
                {/* Small Bitcoin accent on the pole cap */}
                <circle cx="50" cy="12" r="5" fill="#1e293b" stroke="url(#orangeAccent)" strokeWidth="2" />
                <text x="50" y="15" textAnchor="middle" fill="#f97316" fontSize="7" fontWeight="bold">₿</text>
            </svg>
        </div>
    );
};

/**
 * Alternative logo: an abstract disc with a dashed chain outer ring,
 * emerald disc body, and a Bitcoin (₿) symbol in the center.
 *
 * @param props - {@link LogoProps}
 * @returns The chain-disc logo SVG.
 */
export const LogoChainDisc: React.FC<LogoProps> = ({ size = 80, className = '' }) => {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg 
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
            >
                <defs>
                    <linearGradient id="discGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
                
                {/* Outer ring - chain representation */}
                <circle cx="50" cy="50" r="44" fill="none" stroke="url(#ringGradient)" strokeWidth="4" strokeDasharray="8 4" />
                
                {/* Middle ring */}
                <circle cx="50" cy="50" r="36" fill="none" stroke="#334155" strokeWidth="2" />
                
                {/* Disc body */}
                <circle cx="50" cy="50" r="28" fill="url(#discGradient)" />
                
                {/* Disc inner ring */}
                <circle cx="50" cy="50" r="20" fill="none" stroke="#065f46" strokeWidth="2" />
                
                {/* Center hole */}
                <circle cx="50" cy="50" r="8" fill="#0f172a" />
                
                {/* Bitcoin symbol in center */}
                <text x="50" y="54" textAnchor="middle" fill="#f97316" fontSize="12" fontWeight="bold">₿</text>
                
                {/* Shine effect */}
                <ellipse cx="40" cy="40" rx="12" ry="8" fill="white" opacity="0.15" transform="rotate(-30 40 40)" />
            </svg>
        </div>
    );
};

/**
 * Minimal logo: a stylized basket outline with a multi-color gradient stroke
 * (orange -> green -> blue -> purple). Suitable for small sizes and loading states.
 *
 * @param props - {@link LogoProps}
 * @returns The minimal basket outline SVG.
 */
export const LogoMinimal: React.FC<LogoProps> = ({ size = 80, className = '' }) => {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg 
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
            >
                <defs>
                    <linearGradient id="minimalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="33%" stopColor="#10b981" />
                        <stop offset="66%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
                
                {/* Stylized basket outline */}
                <g stroke="url(#minimalGradient)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    {/* Top band */}
                    <ellipse cx="50" cy="25" rx="25" ry="6" />
                    
                    {/* Chains - simplified */}
                    <path d="M28 25 L32 60" />
                    <path d="M39 25 L40 60" />
                    <path d="M50 25 L50 60" />
                    <path d="M61 25 L60 60" />
                    <path d="M72 25 L68 60" />
                    
                    {/* Basket rim */}
                    <path d="M30 60 Q50 68 70 60" />
                    
                    {/* Pole */}
                    <line x1="50" y1="60" x2="50" y2="90" />
                    
                    {/* Base */}
                    <ellipse cx="50" cy="90" rx="12" ry="3" />
                </g>
            </svg>
        </div>
    );
};

export default Logo;

