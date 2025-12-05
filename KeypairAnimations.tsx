/**
 * Keypair Animation System
 * 
 * This file contains both keypair animations used in the On-Chain Disc Golf app:
 * 1. KeypairFormingAnimation - Used during profile creation (keys come together)
 * 2. KeypairBreakingAnimation - Used during logout (keys break apart)
 * 
 * Both animations use the same visual elements (keys, fragments, trails, shockwaves)
 * but in reverse, creating perfect symbolic duality.
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';

/**
 * Keypair Forming Animation
 * Used when a profile is being created/loaded
 * Symbolizes the birth of a new Nostr identity
 */
export const KeypairFormingAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-brand-dark via-slate-900 to-black">
            <div className="relative w-full h-full flex items-center justify-center">

                {/* Keypair Forming Together in Center */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {/* Left Key (Coming from left) */}
                    <div
                        style={{
                            position: 'absolute',
                            left: '-30px',
                            top: '0',
                            animation: 'keyFormLeft 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                        }}
                    >
                        <Icons.Key size={60} className="text-brand-primary" style={{ filter: 'drop-shadow(0 0 15px #10b981)' }} />
                    </div>

                    {/* Right Key (Coming from right) */}
                    <div
                        style={{
                            position: 'absolute',
                            left: '30px',
                            top: '0',
                            animation: 'keyFormRight 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                        }}
                    >
                        <Icons.Key size={60} className="text-brand-accent" style={{ filter: 'drop-shadow(0 0 15px #f59e0b)', transform: 'scaleX(-1)' }} />
                    </div>

                    {/* Connection Line appears after keys unite */}
                    <div
                        style={{
                            position: 'absolute',
                            left: '0',
                            top: '15px',
                            width: '2px',
                            height: '30px',
                            background: 'linear-gradient(to bottom, transparent, #10b981, #f59e0b, transparent)',
                            boxShadow: '0 0 15px rgba(16, 185, 129, 0.8)',
                            animation: 'connectionAppear 0.5s ease-out 1.3s forwards',
                            opacity: 0
                        }}
                    />
                </div>

                {/* Inward Flash (reverse of impact) */}
                <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white"
                    style={{
                        animation: 'inwardFlash 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s forwards',
                        opacity: 0
                    }}
                />

                {/* Radial Shockwave (converging inward) */}
                {[...Array(3)].map((_, i) => (
                    <div
                        key={`shockwave-in-${i}`}
                        className="absolute left-1/2 top-1/2 border-2 rounded-full"
                        style={{
                            borderColor: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : '#f59e0b',
                            animation: `shockwaveInward 2.0s ease-in ${i * 0.2}s forwards`
                        }}
                    />
                ))}

                {/* Key Fragments Converging Inward */}
                {[...Array(40)].map((_, i) => {
                    const angle = (i / 40) * 360;
                    const rad = angle * (Math.PI / 180);
                    const distance = 300 + Math.random() * 200;
                    const x = Math.cos(rad) * distance;
                    const y = Math.sin(rad) * distance;
                    const colors = ['#10b981', '#f59e0b'];
                    const color = colors[i % 2];
                    const size = 4 + Math.random() * 8;
                    const rotation = Math.random() * 720;
                    const delay = 0.1 + (Math.random() * 0.3);
                    const maxOpacity = 1 - (distance - 300) / 400;

                    return (
                        <div
                            key={`fragment-in-${i}`}
                            className="absolute left-1/2 top-1/2"
                            style={{
                                width: `${size}px`,
                                height: `${size}px`,
                                animation: `convergeFragment-${i} 2.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s forwards`
                            }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: color,
                                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                                    boxShadow: `0 0 ${size * 2}px ${color}`,
                                }}
                            />
                            <style>{`
                                @keyframes convergeFragment-${i} {
                                    0% {
                                        transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0) rotate(${rotation}deg);
                                        opacity: 0;
                                    }
                                    50% {
                                        opacity: ${maxOpacity * 0.6};
                                    }
                                    85% {
                                        transform: translate(-50%, -50%) scale(1.2) rotate(${rotation * 0.2}deg);
                                        opacity: ${maxOpacity};
                                    }
                                    100% {
                                        transform: translate(-50%, -50%) scale(0) rotate(0deg);
                                        opacity: 0;
                                    }
                                }
                            `}</style>
                        </div>
                    );
                })}

                {/* Particle Trails Converging */}
                {[...Array(20)].map((_, i) => {
                    const angle = (i / 20) * 360;
                    const rad = angle * (Math.PI / 180);
                    const distance = 350;
                    const x = Math.cos(rad) * distance;
                    const y = Math.sin(rad) * distance;

                    return (
                        <div
                            key={`trail-in-${i}`}
                            className="absolute left-1/2 top-1/2"
                            style={{
                                width: '3px',
                                height: '40px',
                                background: `linear-gradient(to bottom, ${i % 2 === 0 ? '#10b981' : '#f59e0b'}, transparent)`,
                                animation: `trailInward-${i} 2.0s ease-in 0.2s forwards`,
                                transformOrigin: 'top center'
                            }}
                        >
                            <style>{`
                                @keyframes trailInward-${i} {
                                    0% {
                                        transform: translate(calc(-50% + ${x * 0.7}px), calc(-50% + ${y * 0.7}px)) rotate(${angle}deg) scaleY(1.5);
                                        opacity: 0;
                                    }
                                    30% {
                                        transform: translate(calc(-50% + ${x * 0.5}px), calc(-50% + ${y * 0.5}px)) rotate(${angle}deg) scaleY(1.3);
                                        opacity: 0.3;
                                    }
                                    60% {
                                        transform: translate(-50%, -50%) rotate(${angle}deg) scaleY(1);
                                        opacity: 0.7;
                                    }
                                    100% {
                                        transform: translate(-50%, -50%) rotate(${angle}deg) scaleY(0);
                                        opacity: 0;
                                    }
                                }
                            `}</style>
                        </div>
                    );
                })}

                {/* Global Keyframes for Formation */}
                <style>{`
                    @keyframes keyFormLeft {
                        0% {
                            transform: translate(-250px, -150px) rotate(-180deg) scale(0);
                            opacity: 0;
                        }
                        70% {
                            transform: translate(-8px, 0) rotate(-15deg) scale(1);
                            opacity: 1;
                        }
                        100% {
                            transform: translate(0, 0) rotate(0deg) scale(1);
                            opacity: 1;
                        }
                    }

                    @keyframes keyFormRight {
                        0% {
                            transform: translate(250px, -150px) rotate(180deg) scale(0);
                            opacity: 0;
                        }
                        70% {
                            transform: translate(8px, 0) rotate(15deg) scale(1);
                            opacity: 1;
                        }
                        100% {
                            transform: translate(0, 0) rotate(0deg) scale(1);
                            opacity: 1;
                        }
                    }

                    @keyframes connectionAppear {
                        0% {
                            opacity: 0;
                            transform: scaleY(0);
                        }
                        100% {
                            opacity: 1;
                            transform: scaleY(1);
                        }
                    }

                    @keyframes inwardFlash {
                        0% {
                            transform: translate(-50%, -50%) scale(3);
                            opacity: 0;
                        }
                        50% {
                            transform: translate(-50%, -50%) scale(1);
                            opacity: 0.8;
                        }
                        100% {
                            transform: translate(-50%, -50%) scale(0);
                            opacity: 0;
                        }
                    }

                    @keyframes shockwaveInward {
                        0% {
                            width: 600px;
                            height: 600px;
                            margin-left: -300px;
                            margin-top: -300px;
                            opacity: 0;
                            border-width: 1px;
                        }
                        100% {
                            width: 40px;
                            height: 40px;
                            margin-left: -20px;
                            margin-top: -20px;
                            opacity: 1;
                            border-width: 4px;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};

/**
 * Account Created Animation
 * 
 * A quick animation (~2s) that is the visual reverse of the logout animation.
 * Used when a new account/wallet has been successfully created.
 * 
 * Visual flow:
 * 1. Keys come together from edges (reverse of breaking apart)
 * 2. Teal connection line forms (reverse of red fracture)
 * 3. Spark particles converge inward (reverse of exploding)
 * 4. "Account Created" success text
 * 5. Growing dots (reverse of fading)
 */

interface AccountCreatedAnimationProps {
    isComplete?: boolean;
}

export const AccountCreatedAnimation: React.FC<AccountCreatedAnimationProps> = ({ 
    isComplete = false 
}) => {
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        // Show success state after keys come together
        const timer = setTimeout(() => setShowSuccess(true), 1200);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-brand-dark via-slate-900 to-black">
            
            {/* Main animation container */}
            <div className="relative flex flex-col items-center justify-center">
                
                {/* Keypair container */}
                <div className="relative w-24 h-16 flex items-center justify-center">
                    
                    {/* Connection Line - forms when keys unite (teal/green for success) */}
                    <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12"
                        style={{
                            background: 'linear-gradient(to bottom, transparent, #10b981, #22d3ee, transparent)',
                            boxShadow: '0 0 15px rgba(16, 185, 129, 0.8), 0 0 30px rgba(16, 185, 129, 0.4)',
                            animation: 'connectionLineForm 0.4s ease-out 1.0s forwards',
                            opacity: 0,
                            transform: 'translate(-50%, -50%) scaleY(0)'
                        }}
                    />

                    {/* Left Key (Purple - Private) - slides in from left */}
                    <div
                        className="absolute left-1/2 top-1/2"
                        style={{
                            animation: 'keyFormLeftNew 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                        }}
                    >
                        <div className="relative">
                            <Icons.Key 
                                size={40} 
                                className="text-purple-400" 
                                style={{ 
                                    filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.8))',
                                    transform: 'translate(-50%, -50%) rotate(-45deg)'
                                }} 
                            />
                        </div>
                    </div>

                    {/* Right Key (Orange - Public) - slides in from right */}
                    <div
                        className="absolute left-1/2 top-1/2"
                        style={{
                            animation: 'keyFormRightNew 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                        }}
                    >
                        <div className="relative">
                            <Icons.Key 
                                size={40} 
                                className="text-orange-400" 
                                style={{ 
                                    filter: 'drop-shadow(0 0 12px rgba(249, 115, 22, 0.8))',
                                    transform: 'translate(-50%, -50%) rotate(135deg)'
                                }} 
                            />
                        </div>
                    </div>

                    {/* Spark particles converging inward */}
                    {[...Array(8)].map((_, i) => {
                        const angle = (i / 8) * 360;
                        const rad = angle * (Math.PI / 180);
                        const distance = 60;
                        const startX = Math.cos(rad) * distance;
                        const startY = Math.sin(rad) * distance;
                        
                        return (
                            <div
                                key={`spark-${i}`}
                                className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
                                style={{
                                    background: i % 2 === 0 ? '#10b981' : '#22d3ee',
                                    boxShadow: `0 0 8px ${i % 2 === 0 ? '#10b981' : '#22d3ee'}`,
                                    animation: `sparkConverge-${i} 0.8s ease-in 0.4s forwards`,
                                    opacity: 0
                                }}
                            >
                                <style>{`
                                    @keyframes sparkConverge-${i} {
                                        0% {
                                            transform: translate(calc(-50% + ${startX}px), calc(-50% + ${startY}px)) scale(0.5);
                                            opacity: 1;
                                        }
                                        70% {
                                            opacity: 1;
                                        }
                                        100% {
                                            transform: translate(-50%, -50%) scale(1.2);
                                            opacity: 0;
                                        }
                                    }
                                `}</style>
                            </div>
                        );
                    })}
                </div>

                {/* Success text - "Account Created" */}
                <div 
                    className="text-brand-primary/90 text-sm font-medium tracking-wider uppercase mt-6"
                    style={{ 
                        animation: 'fadeInUpText 0.5s ease-out 1.0s forwards', 
                        opacity: 0,
                        textShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
                    }}
                >
                    Account Created
                </div>
                
                {/* Growing dots (reverse of fading) */}
                <div 
                    className="flex space-x-1 mt-3"
                    style={{ 
                        animation: 'dotsAppear 0.6s ease-out 1.2s forwards',
                        opacity: 0
                    }}
                >
                    <div 
                        className="w-1.5 h-1.5 bg-brand-primary/40 rounded-full" 
                        style={{ animation: 'dotPulse 1s ease-in-out infinite', animationDelay: '0ms' }} 
                    />
                    <div 
                        className="w-1.5 h-1.5 bg-brand-primary/60 rounded-full" 
                        style={{ animation: 'dotPulse 1s ease-in-out infinite', animationDelay: '150ms' }} 
                    />
                    <div 
                        className="w-1.5 h-1.5 bg-brand-primary/80 rounded-full" 
                        style={{ animation: 'dotPulse 1s ease-in-out infinite', animationDelay: '300ms' }} 
                    />
                </div>

                {/* Success glow ring */}
                {showSuccess && (
                    <div 
                        className="absolute w-32 h-32 rounded-full pointer-events-none"
                        style={{
                            border: '2px solid rgba(16, 185, 129, 0.5)',
                            animation: 'successRing 1s ease-out forwards',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }}
                    />
                )}
            </div>

            {/* Completion flash overlay */}
            {isComplete && (
                <div 
                    className="absolute inset-0 bg-brand-primary/10 pointer-events-none"
                    style={{ animation: 'completionFlash 0.4s ease-out forwards' }}
                />
            )}

            {/* Keyframes */}
            <style>{`
                @keyframes keyFormLeftNew {
                    0% {
                        transform: translateX(-100px) translateY(-30px) rotate(-25deg);
                        opacity: 0;
                    }
                    30% {
                        opacity: 1;
                    }
                    80% {
                        transform: translateX(-8px) rotate(-5deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(-12px);
                        opacity: 1;
                    }
                }
                
                @keyframes keyFormRightNew {
                    0% {
                        transform: translateX(100px) translateY(-30px) rotate(25deg);
                        opacity: 0;
                    }
                    30% {
                        opacity: 1;
                    }
                    80% {
                        transform: translateX(8px) rotate(5deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(12px);
                        opacity: 1;
                    }
                }
                
                @keyframes connectionLineForm {
                    0% {
                        transform: translate(-50%, -50%) scaleY(0);
                        opacity: 0;
                    }
                    50% {
                        transform: translate(-50%, -50%) scaleY(1.2);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) scaleY(1);
                        opacity: 0.8;
                    }
                }
                
                @keyframes fadeInUpText {
                    from {
                        transform: translateY(10px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                @keyframes dotsAppear {
                    from { opacity: 0; transform: scale(0.5); }
                    to { opacity: 1; transform: scale(1); }
                }
                
                @keyframes dotPulse {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.3); opacity: 1; }
                }
                
                @keyframes successRing {
                    0% { 
                        transform: translate(-50%, -50%) scale(0.5); 
                        opacity: 1;
                    }
                    100% { 
                        transform: translate(-50%, -50%) scale(2); 
                        opacity: 0;
                    }
                }
                
                @keyframes completionFlash {
                    0% { opacity: 0.3; }
                    100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
};

/**
 * Keypair Breaking Animation
 * Used when user logs out
 * Symbolizes the destruction of the session/keypair
 */
export const KeypairBreakingAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-brand-dark via-slate-900 to-black animate-in fade-in duration-200">
            <div className="relative w-full h-full flex items-center justify-center">

                {/* Keypair Breaking in Center */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {/* Left Key (Private Key) */}
                    <div
                        style={{
                            position: 'absolute',
                            left: '-30px',
                            top: '0',
                            animation: 'keyBreakLeft 1.5s cubic-bezier(0.36, 0, 0.66, -0.56) forwards'
                        }}
                    >
                        <Icons.Key size={60} className="text-brand-primary" style={{ filter: 'drop-shadow(0 0 15px #10b981)' }} />
                    </div>

                    {/* Right Key (Public Key) */}
                    <div
                        style={{
                            position: 'absolute',
                            left: '30px',
                            top: '0',
                            animation: 'keyBreakRight 1.5s cubic-bezier(0.36, 0, 0.66, -0.56) forwards'
                        }}
                    >
                        <Icons.Key size={60} className="text-brand-accent" style={{ filter: 'drop-shadow(0 0 15px #f59e0b)', transform: 'scaleX(-1)' }} />
                    </div>

                    {/* Crack/Fracture Line in Center */}
                    <div
                        style={{
                            position: 'absolute',
                            left: '0',
                            top: '15px',
                            width: '2px',
                            height: '30px',
                            background: 'linear-gradient(to bottom, transparent, #f59e0b, transparent)',
                            boxShadow: '0 0 10px #f59e0b',
                            animation: 'crackAppear 0.5s ease-out forwards, crackFade 0.8s ease-in 0.5s forwards'
                        }}
                    />
                </div>

                {/* Impact Flash */}
                <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white"
                    style={{
                        animation: 'impactFlash 0.6s cubic-bezier(0.36, 0, 0.66, -0.56) forwards'
                    }}
                />

                {/* Radial Shockwave */}
                {[...Array(3)].map((_, i) => (
                    <div
                        key={`shockwave-${i}`}
                        className="absolute left-1/2 top-1/2 border-2 rounded-full"
                        style={{
                            borderColor: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : '#f59e0b',
                            animation: `shockwave 2.0s ease-out ${i * 0.2}s forwards`
                        }}
                    />
                ))}

                {/* Key Fragments Exploding Outward */}
                {[...Array(40)].map((_, i) => {
                    const angle = (i / 40) * 360;
                    const rad = angle * (Math.PI / 180);
                    const distance = 300 + Math.random() * 200;
                    const x = Math.cos(rad) * distance;
                    const y = Math.sin(rad) * distance;
                    const colors = ['#10b981', '#f59e0b'];
                    const color = colors[i % 2];
                    const size = 4 + Math.random() * 8;
                    const rotation = Math.random() * 720;
                    const delay = 0.3 + (Math.random() * 0.4);
                    const maxOpacity = 1 - (distance - 300) / 400;

                    return (
                        <div
                            key={`fragment-${i}`}
                            className="absolute left-1/2 top-1/2"
                            style={{
                                width: `${size}px`,
                                height: `${size}px`,
                                animation: `explodeFragment-${i} 2.5s cubic-bezier(0.36, 0, 0.66, -0.56) ${delay}s forwards`
                            }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: color,
                                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                                    boxShadow: `0 0 ${size * 2}px ${color}`,
                                }}
                            />
                            <style>{`
                                @keyframes explodeFragment-${i} {
                                    0% {
                                        transform: translate(-50%, -50%) scale(0) rotate(0deg);
                                        opacity: 1;
                                    }
                                    15% {
                                        transform: translate(-50%, -50%) scale(1.2) rotate(${rotation * 0.2}deg);
                                        opacity: ${maxOpacity};
                                    }
                                    50% {
                                        opacity: ${maxOpacity * 0.6};
                                    }
                                    100% {
                                        transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0) rotate(${rotation}deg);
                                        opacity: 0;
                                    }
                                }
                            `}</style>
                        </div>
                    );
                })}

                {/* Particle Trails */}
                {[...Array(20)].map((_, i) => {
                    const angle = (i / 20) * 360;
                    const rad = angle * (Math.PI / 180);
                    const distance = 350;
                    const x = Math.cos(rad) * distance;
                    const y = Math.sin(rad) * distance;

                    return (
                        <div
                            key={`trail-${i}`}
                            className="absolute left-1/2 top-1/2"
                            style={{
                                width: '3px',
                                height: '40px',
                                background: `linear-gradient(to bottom, ${i % 2 === 0 ? '#10b981' : '#f59e0b'}, transparent)`,
                                animation: `trail-${i} 2.0s ease-out 0.5s forwards`,
                                transformOrigin: 'top center'
                            }}
                        >
                            <style>{`
                                @keyframes trail-${i} {
                                    0% {
                                        transform: translate(-50%, -50%) rotate(${angle}deg) scaleY(0);
                                        opacity: 1;
                                    }
                                    40% {
                                        transform: translate(-50%, -50%) rotate(${angle}deg) scaleY(1);
                                        opacity: 0.7;
                                    }
                                    70% {
                                        transform: translate(calc(-50% + ${x * 0.5}px), calc(-50% + ${y * 0.5}px)) rotate(${angle}deg) scaleY(1.3);
                                        opacity: 0.3;
                                    }
                                    100% {
                                        transform: translate(calc(-50% + ${x * 0.7}px), calc(-50% + ${y * 0.7}px)) rotate(${angle}deg) scaleY(1.5);
                                        opacity: 0;
                                    }
                                }
                            `}</style>
                        </div>
                    );
                })}

                {/* Global Keyframes */}
                <style>{`
                    @keyframes keyBreakLeft {
                        0% {
                            transform: translate(0, 0) rotate(0deg) scale(1);
                            opacity: 1;
                        }
                        30% {
                            transform: translate(-8px, 0) rotate(-15deg) scale(1);
                            opacity: 1;
                        }
                        100% {
                            transform: translate(-250px, -150px) rotate(-180deg) scale(0);
                            opacity: 0;
                        }
                    }

                    @keyframes keyBreakRight {
                        0% {
                            transform: translate(0, 0) rotate(0deg) scale(1);
                            opacity: 1;
                        }
                        30% {
                            transform: translate(8px, 0) rotate(15deg) scale(1);
                            opacity: 1;
                        }
                        100% {
                            transform: translate(250px, -150px) rotate(180deg) scale(0);
                            opacity: 0;
                        }
                    }

                    @keyframes crackAppear {
                        0% {
                            transform: scaleY(0);
                            opacity: 0;
                        }
                        100% {
                            transform: scaleY(1);
                            opacity: 1;
                        }
                    }

                    @keyframes crackFade {
                        0% {
                            opacity: 1;
                        }
                        100% {
                            opacity: 0;
                        }
                    }

                    @keyframes impactFlash {
                        0% {
                            transform: translate(-50%, -50%) scale(0);
                            opacity: 1;
                        }
                        50% {
                            transform: translate(-50%, -50%) scale(1);
                            opacity: 0.8;
                        }
                        100% {
                            transform: translate(-50%, -50%) scale(3);
                            opacity: 0;
                        }
                    }

                    @keyframes shockwave {
                        0% {
                            width: 40px;
                            height: 40px;
                            margin-left: -20px;
                            margin-top: -20px;
                            opacity: 1;
                            border-width: 4px;
                        }
                        100% {
                            width: 600px;
                            height: 600px;
                            margin-left: -300px;
                            margin-top: -300px;
                            opacity: 0;
                            border-width: 1px;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};

/**
 * Genesis Disc Animation
 * 
 * A polished, on-brand animation for the Finalization screen that transforms
 * a disc golf disc into a cryptographic keypair/wallet through distinct phases.
 * 
 * Phases:
 * 1. Digital Disc Materializes (0-2s)
 * 2. Encryption Sequence (2-4s)
 * 3. Key Forge (4-6s)
 * 4. Wallet Lock (6-7.5s)
 * 5. Sustained Loop (7.5s+) - triggered by showSparkles
 * 6. Completion - triggered by isComplete
 */

interface GenesisDiscAnimationProps {
    showSparkles?: boolean;
    isComplete?: boolean;
}

type AnimationPhase = 'materialize' | 'encrypt' | 'forge' | 'lock' | 'sustain' | 'complete';

export const GenesisDiscAnimation: React.FC<GenesisDiscAnimationProps> = ({ 
    showSparkles = false,
    isComplete = false 
}) => {
    const [phase, setPhase] = useState<AnimationPhase>('materialize');

    // Generate stable random values for particles using useMemo
    const particleData = useMemo(() => {
        return [...Array(40)].map((_, i) => ({
            angle: (i / 40) * 360,
            distance: 150 + (i * 7) % 100,
            size: 3 + (i % 5),
            delay: (i * 0.05) % 0.5,
            duration: 2 + (i % 3) * 0.5,
            isOrange: i % 2 === 0
        }));
    }, []);

    const orbitParticles = useMemo(() => {
        return [...Array(16)].map((_, i) => ({
            radius: 90 + (i % 3) * 30,
            startAngle: (i / 16) * 360,
            duration: 4 + (i % 4),
            size: 4 + (i % 3) * 2,
            colorIndex: i % 4
        }));
    }, []);

    const hexChars = useMemo(() => {
        return [...Array(24)].map((_, i) => ({
            char: '0123456789ABCDEF'[i % 16],
            angle: (i / 24) * 360,
            radius: 100 + (i % 3) * 20,
            delay: i * 0.1,
            duration: 1.5 + (i % 3) * 0.3
        }));
    }, []);

    // Phase progression
    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];

        // Phase 1 -> 2: Materialize -> Encrypt
        timers.push(setTimeout(() => setPhase('encrypt'), 2000));
        
        // Phase 2 -> 3: Encrypt -> Forge
        timers.push(setTimeout(() => setPhase('forge'), 4000));
        
        // Phase 3 -> 4: Forge -> Lock
        timers.push(setTimeout(() => setPhase('lock'), 6000));
        
        // Phase 4 -> 5: Lock -> Sustain
        timers.push(setTimeout(() => setPhase('sustain'), 7500));

        return () => timers.forEach(t => clearTimeout(t));
    }, []);

    // Handle completion
    useEffect(() => {
        if (isComplete) {
            setPhase('complete');
        }
    }, [isComplete]);

    // Force sustain phase when showSparkles is true (for long waits)
    useEffect(() => {
        if (showSparkles && phase !== 'complete') {
            setPhase('sustain');
        }
    }, [showSparkles, phase]);

    const colors = {
        teal: '#10b981',
        orange: '#f97316',
        purple: '#8b5cf6',
        blue: '#3b82f6',
        dark: '#0f172a'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
            style={{ background: `linear-gradient(180deg, ${colors.dark} 0%, #0c1222 50%, #000 100%)` }}>
            
            {/* Subtle grid background */}
            <div 
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                    animation: 'gridPulse 4s ease-in-out infinite'
                }}
            />

            {/* Radial gradient overlay */}
            <div 
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 50% 50%, transparent 0%, ${colors.dark} 70%)`
                }}
            />

            {/* Main animation container */}
            <div className="relative w-80 h-80 flex items-center justify-center">

                {/* ============================================= */}
                {/* PHASE 1: Digital Disc Materializes */}
                {/* ============================================= */}
                {(phase === 'materialize' || phase === 'encrypt') && (
                    <>
                        {/* Scan lines */}
                        <div 
                            className="absolute w-48 h-1 rounded-full"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${colors.teal}, transparent)`,
                                animation: 'scanLine 1.5s ease-in-out infinite',
                                opacity: phase === 'materialize' ? 1 : 0,
                                transition: 'opacity 0.5s'
                            }}
                        />

                        {/* The Disc */}
                        <svg 
                            viewBox="0 0 200 200" 
                            className="w-48 h-48"
                            style={{
                                animation: phase === 'materialize' 
                                    ? 'discMaterialize 2s ease-out forwards, discFloat 3s ease-in-out infinite 2s'
                                    : 'discSpin 1s linear infinite',
                                filter: `drop-shadow(0 0 20px ${colors.teal})`
                            }}
                        >
                            <defs>
                                <linearGradient id="discGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={colors.teal} />
                                    <stop offset="50%" stopColor="#059669" />
                                    <stop offset="100%" stopColor={colors.teal} />
                                </linearGradient>
                                <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={colors.orange} />
                                    <stop offset="50%" stopColor={colors.teal} />
                                    <stop offset="100%" stopColor={colors.purple} />
                                </linearGradient>
                            </defs>
                            
                            {/* Outer glow ring */}
                            <circle cx="100" cy="100" r="85" fill="none" stroke="url(#rimGrad)" strokeWidth="2" opacity="0.5" />
                            
                            {/* Main disc body */}
                            <circle cx="100" cy="100" r="75" fill="url(#discGrad)" opacity="0.9" />
                            
                            {/* Inner rings for disc texture */}
                            <circle cx="100" cy="100" r="60" fill="none" stroke="#065f46" strokeWidth="1" opacity="0.6" />
                            <circle cx="100" cy="100" r="45" fill="none" stroke="#065f46" strokeWidth="1" opacity="0.4" />
                            
                            {/* Center hole */}
                            <circle cx="100" cy="100" r="15" fill={colors.dark} />
                            <circle cx="100" cy="100" r="12" fill="none" stroke={colors.teal} strokeWidth="1" opacity="0.5" />
                            
                            {/* Shine effect */}
                            <ellipse cx="75" cy="75" rx="25" ry="15" fill="white" opacity="0.15" transform="rotate(-30 75 75)" />
                        </svg>

                        {/* Materializing particles */}
                        {phase === 'materialize' && particleData.slice(0, 20).map((p, i) => (
                            <div
                                key={`mat-${i}`}
                                className="absolute"
                                style={{
                                    width: `${p.size}px`,
                                    height: `${p.size}px`,
                                    background: p.isOrange ? colors.orange : colors.teal,
                                    borderRadius: '50%',
                                    boxShadow: `0 0 ${p.size * 2}px ${p.isOrange ? colors.orange : colors.teal}`,
                                    animation: `materializeParticle 2s ease-out ${p.delay}s forwards`,
                                    opacity: 0
                                }}
                            />
                        ))}
                    </>
                )}

                {/* ============================================= */}
                {/* PHASE 2: Encryption Sequence */}
                {/* ============================================= */}
                {phase === 'encrypt' && (
                    <>
                        {/* Orbiting hex characters */}
                        {hexChars.map((h, i) => (
                            <div
                                key={`hex-${i}`}
                                className="absolute font-mono text-xs font-bold"
                                style={{
                                    color: i % 2 === 0 ? colors.teal : colors.orange,
                                    textShadow: `0 0 10px ${i % 2 === 0 ? colors.teal : colors.orange}`,
                                    animation: `orbitHex-${i} ${h.duration}s linear infinite`,
                                    animationDelay: `${h.delay}s`
                                }}
                            >
                                {h.char}
                                <style>{`
                                    @keyframes orbitHex-${i} {
                                        0% {
                                            transform: rotate(${h.angle}deg) translateX(${h.radius}px) rotate(-${h.angle}deg);
                                            opacity: 0;
                                        }
                                        20% { opacity: 1; }
                                        80% { opacity: 1; }
                                        100% {
                                            transform: rotate(${h.angle + 360}deg) translateX(${h.radius}px) rotate(-${h.angle + 360}deg);
                                            opacity: 0;
                                        }
                                    }
                                `}</style>
                            </div>
                        ))}

                        {/* Pulsing encryption rings */}
                        {[0, 1, 2].map((i) => (
                            <div
                                key={`enc-ring-${i}`}
                                className="absolute rounded-full"
                                style={{
                                    width: `${130 + i * 30}px`,
                                    height: `${130 + i * 30}px`,
                                    border: `2px solid ${i === 0 ? colors.teal : i === 1 ? colors.orange : colors.purple}`,
                                    animation: `encryptRing 1.5s ease-in-out ${i * 0.2}s infinite`,
                                    opacity: 0.5
                                }}
                            />
                        ))}
                    </>
                )}

                {/* ============================================= */}
                {/* PHASE 3: Key Forge */}
                {/* ============================================= */}
                {phase === 'forge' && (
                    <>
                        {/* Fragmenting particles splitting into two streams */}
                        {particleData.map((p, i) => {
                            const targetX = p.isOrange ? 60 : -60;
                            const targetY = 0;
                            
                            return (
                                <div
                                    key={`forge-${i}`}
                                    className="absolute"
                                    style={{
                                        width: `${p.size}px`,
                                        height: `${p.size}px`,
                                        background: p.isOrange ? colors.orange : colors.teal,
                                        borderRadius: '50%',
                                        boxShadow: `0 0 ${p.size * 2}px ${p.isOrange ? colors.orange : colors.teal}`,
                                        animation: `forgeParticle-${i} 2s ease-in-out forwards`
                                    }}
                                >
                                    <style>{`
                                        @keyframes forgeParticle-${i} {
                                            0% {
                                                transform: rotate(${p.angle}deg) translateX(${80}px);
                                                opacity: 1;
                                            }
                                            50% {
                                                transform: translate(${targetX * 0.5}px, ${(Math.random() - 0.5) * 100}px);
                                                opacity: 0.8;
                                            }
                                            100% {
                                                transform: translate(${targetX}px, ${targetY}px);
                                                opacity: 0;
                                            }
                                        }
                                    `}</style>
                                </div>
                            );
                        })}

                        {/* Forming keys */}
                        <div className="absolute flex items-center justify-center gap-8">
                            {/* Teal Key (Private) */}
                            <svg 
                                viewBox="0 0 60 60" 
                                className="w-16 h-16"
                                style={{
                                    animation: 'keyForgeLeft 2s ease-out forwards',
                                    filter: `drop-shadow(0 0 15px ${colors.teal})`
                                }}
                            >
                                <defs>
                                    <linearGradient id="tealKeyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={colors.teal} />
                                        <stop offset="100%" stopColor="#059669" />
                                    </linearGradient>
                                </defs>
                                {/* Key head */}
                                <circle cx="20" cy="20" r="15" fill="none" stroke="url(#tealKeyGrad)" strokeWidth="4" />
                                <circle cx="20" cy="20" r="6" fill="url(#tealKeyGrad)" />
                                {/* Key shaft */}
                                <rect x="32" y="17" width="25" height="6" rx="2" fill="url(#tealKeyGrad)" />
                                {/* Key teeth */}
                                <rect x="45" y="23" width="4" height="6" fill="url(#tealKeyGrad)" />
                                <rect x="52" y="23" width="4" height="8" fill="url(#tealKeyGrad)" />
                            </svg>

                            {/* Orange Key (Public) */}
                            <svg 
                                viewBox="0 0 60 60" 
                                className="w-16 h-16"
                                style={{
                                    animation: 'keyForgeRight 2s ease-out forwards',
                                    filter: `drop-shadow(0 0 15px ${colors.orange})`,
                                    transform: 'scaleX(-1)'
                                }}
                            >
                                <defs>
                                    <linearGradient id="orangeKeyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={colors.orange} />
                                        <stop offset="100%" stopColor="#ea580c" />
                                    </linearGradient>
                                </defs>
                                {/* Key head */}
                                <circle cx="20" cy="20" r="15" fill="none" stroke="url(#orangeKeyGrad)" strokeWidth="4" />
                                <circle cx="20" cy="20" r="6" fill="url(#orangeKeyGrad)" />
                                {/* Key shaft */}
                                <rect x="32" y="17" width="25" height="6" rx="2" fill="url(#orangeKeyGrad)" />
                                {/* Key teeth */}
                                <rect x="45" y="23" width="4" height="6" fill="url(#orangeKeyGrad)" />
                                <rect x="52" y="23" width="4" height="8" fill="url(#orangeKeyGrad)" />
                            </svg>
                        </div>
                    </>
                )}

                {/* ============================================= */}
                {/* PHASE 4: Wallet Lock */}
                {/* ============================================= */}
                {phase === 'lock' && (
                    <>
                        {/* Keys coming together */}
                        <div className="absolute flex items-center justify-center">
                            {/* Combined keys */}
                            <svg 
                                viewBox="0 0 120 80" 
                                className="w-40 h-28"
                                style={{
                                    animation: 'keysUnite 1.5s ease-out forwards',
                                    filter: `drop-shadow(0 0 20px ${colors.teal})`
                                }}
                            >
                                <defs>
                                    <linearGradient id="unifiedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={colors.teal} />
                                        <stop offset="50%" stopColor={colors.purple} />
                                        <stop offset="100%" stopColor={colors.orange} />
                                    </linearGradient>
                                </defs>
                                
                                {/* Left key */}
                                <g style={{ animation: 'keySlideLeft 1s ease-out forwards' }}>
                                    <circle cx="25" cy="40" r="12" fill="none" stroke={colors.teal} strokeWidth="3" />
                                    <circle cx="25" cy="40" r="4" fill={colors.teal} />
                                    <rect x="35" y="37" width="20" height="6" rx="2" fill={colors.teal} />
                                </g>
                                
                                {/* Right key */}
                                <g style={{ animation: 'keySlideRight 1s ease-out forwards' }}>
                                    <circle cx="95" cy="40" r="12" fill="none" stroke={colors.orange} strokeWidth="3" />
                                    <circle cx="95" cy="40" r="4" fill={colors.orange} />
                                    <rect x="65" y="37" width="20" height="6" rx="2" fill={colors.orange} />
                                </g>
                                
                                {/* Center connection - Lightning bolt */}
                                <path 
                                    d="M55 30 L60 38 L55 38 L60 50 L55 42 L60 42 L55 30" 
                                    fill={colors.orange}
                                    style={{ 
                                        animation: 'lightningFlash 0.5s ease-out 0.8s forwards',
                                        opacity: 0
                                    }}
                                />
                            </svg>
                        </div>

                        {/* Lock pulse */}
                        <div 
                            className="absolute w-48 h-48 rounded-full"
                            style={{
                                border: `3px solid ${colors.teal}`,
                                animation: 'lockPulse 1s ease-out forwards',
                                opacity: 0
                            }}
                        />

                        {/* Wallet outline forming */}
                        <svg 
                            viewBox="0 0 100 80" 
                            className="absolute w-56 h-44"
                            style={{
                                animation: 'walletTrace 1.5s ease-out 0.5s forwards',
                                opacity: 0
                            }}
                        >
                            <defs>
                                <linearGradient id="walletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={colors.teal} />
                                    <stop offset="100%" stopColor={colors.orange} />
                                </linearGradient>
                            </defs>
                            <rect 
                                x="10" y="10" 
                                width="80" height="60" 
                                rx="8" 
                                fill="none" 
                                stroke="url(#walletGrad)" 
                                strokeWidth="2"
                                strokeDasharray="300"
                                strokeDashoffset="300"
                                style={{ animation: 'drawWallet 1s ease-out 0.5s forwards' }}
                            />
                        </svg>
                    </>
                )}

                {/* ============================================= */}
                {/* PHASE 5: Sustained Loop */}
                {/* ============================================= */}
                {(phase === 'sustain' || phase === 'complete') && (
                    <>
                        {/* Central unified keypair/wallet icon */}
                        <div 
                            className="relative"
                            style={{
                                animation: phase === 'complete' ? 'completePulse 0.8s ease-out forwards' : 'gentlePulse 2s ease-in-out infinite'
                            }}
                        >
                            <svg 
                                viewBox="0 0 120 100" 
                                className="w-44 h-36"
                                style={{
                                    filter: `drop-shadow(0 0 ${phase === 'complete' ? '30px' : '20px'} ${colors.teal})`
                                }}
                            >
                                <defs>
                                    <linearGradient id="finalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={colors.teal} />
                                        <stop offset="50%" stopColor={colors.purple} />
                                        <stop offset="100%" stopColor={colors.orange} />
                                    </linearGradient>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                        <feMerge>
                                            <feMergeNode in="coloredBlur"/>
                                            <feMergeNode in="SourceGraphic"/>
                                        </feMerge>
                                    </filter>
                                </defs>
                                
                                {/* Wallet body */}
                                <rect x="15" y="20" width="90" height="65" rx="10" fill="none" stroke="url(#finalGrad)" strokeWidth="3" filter="url(#glow)" />
                                
                                {/* Wallet flap */}
                                <path d="M15 35 Q60 25 105 35" fill="none" stroke="url(#finalGrad)" strokeWidth="2" />
                                
                                {/* Keys inside */}
                                <g transform="translate(35, 45)">
                                    {/* Teal key */}
                                    <circle cx="10" cy="12" r="8" fill="none" stroke={colors.teal} strokeWidth="2" />
                                    <circle cx="10" cy="12" r="3" fill={colors.teal} />
                                    <rect x="16" y="10" width="12" height="4" rx="1" fill={colors.teal} />
                                </g>
                                <g transform="translate(55, 45)">
                                    {/* Orange key (mirrored) */}
                                    <circle cx="30" cy="12" r="8" fill="none" stroke={colors.orange} strokeWidth="2" />
                                    <circle cx="30" cy="12" r="3" fill={colors.orange} />
                                    <rect x="12" y="10" width="12" height="4" rx="1" fill={colors.orange} />
                                </g>
                                
                                {/* Center Bitcoin symbol */}
                                <text x="60" y="62" textAnchor="middle" fill={colors.orange} fontSize="14" fontWeight="bold" filter="url(#glow)">₿</text>
                            </svg>
                        </div>

                        {/* Orbiting particles */}
                        {orbitParticles.map((p, i) => {
                            const particleColors = [colors.teal, colors.orange, colors.purple, colors.blue];
                            return (
                                <div
                                    key={`orbit-${i}`}
                                    className="absolute"
                                    style={{
                                        width: `${p.size}px`,
                                        height: `${p.size}px`,
                                        background: particleColors[p.colorIndex],
                                        borderRadius: '50%',
                                        boxShadow: `0 0 ${p.size * 3}px ${particleColors[p.colorIndex]}`,
                                        animation: `sustainOrbit-${i} ${p.duration}s linear infinite`
                                    }}
                                >
                                    <style>{`
                                        @keyframes sustainOrbit-${i} {
                                            0% {
                                                transform: rotate(${p.startAngle}deg) translateX(${p.radius}px);
                                                opacity: 0.4;
                                            }
                                            25% {
                                                opacity: 1;
                                            }
                                            50% {
                                                transform: rotate(${p.startAngle + 180}deg) translateX(${p.radius}px);
                                                opacity: 0.6;
                                            }
                                            75% {
                                                opacity: 1;
                                            }
                                            100% {
                                                transform: rotate(${p.startAngle + 360}deg) translateX(${p.radius}px);
                                                opacity: 0.4;
                                            }
                                        }
                                    `}</style>
                                </div>
                            );
                        })}

                        {/* Pulsing outer ring */}
                        <div 
                            className="absolute w-64 h-64 rounded-full"
                            style={{
                                border: `2px solid ${colors.teal}`,
                                animation: 'ringPulse 3s ease-in-out infinite',
                                opacity: 0.3
                            }}
                        />
                        <div 
                            className="absolute w-72 h-72 rounded-full"
                            style={{
                                border: `1px solid ${colors.orange}`,
                                animation: 'ringPulse 3s ease-in-out infinite 1.5s',
                                opacity: 0.2
                            }}
                        />

                        {/* Digital rain effect in background */}
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={`rain-${i}`}
                                className="absolute font-mono text-xs opacity-20"
                                style={{
                                    color: i % 2 === 0 ? colors.teal : colors.orange,
                                    left: `${10 + (i * 7)}%`,
                                    animation: `digitalRain ${2 + (i % 3)}s linear infinite`,
                                    animationDelay: `${i * 0.3}s`
                                }}
                            >
                                {'01'.repeat(8).split('').map((c, j) => (
                                    <div key={j} style={{ opacity: 1 - (j * 0.06) }}>{c}</div>
                                ))}
                            </div>
                        ))}
                    </>
                )}

                {/* ============================================= */}
                {/* PHASE 6: Completion Flash */}
                {/* ============================================= */}
                {phase === 'complete' && (
                    <>
                        {/* Success flash */}
                        <div 
                            className="absolute w-96 h-96 rounded-full"
                            style={{
                                background: `radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, transparent 70%)`,
                                animation: 'successBurst 0.8s ease-out forwards'
                            }}
                        />
                        
                        {/* Radiating rings */}
                        {[0, 1, 2].map((i) => (
                            <div
                                key={`complete-ring-${i}`}
                                className="absolute rounded-full"
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    border: `2px solid ${colors.teal}`,
                                    animation: `completeRing 1s ease-out ${i * 0.15}s forwards`
                                }}
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Status text */}
            <div 
                className="absolute bottom-24 text-center"
                style={{ animation: 'fadeInUp 1s ease-out forwards' }}
            >
                <p className="text-slate-400 text-sm font-medium tracking-wide">
                    {phase === 'materialize' && 'Initializing...'}
                    {phase === 'encrypt' && 'Securing your identity...'}
                    {phase === 'forge' && 'Generating keypair...'}
                    {phase === 'lock' && 'Creating wallet...'}
                    {phase === 'sustain' && 'Finalizing setup...'}
                    {phase === 'complete' && 'Ready!'}
                </p>
            </div>

            {/* Global Keyframes */}
            <style>{`
                @keyframes gridPulse {
                    0%, 100% { opacity: 0.05; }
                    50% { opacity: 0.1; }
                }

                @keyframes scanLine {
                    0% { transform: translateY(-60px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(60px); opacity: 0; }
                }

                @keyframes discMaterialize {
                    0% {
                        transform: scale(0) rotate(-180deg);
                        opacity: 0;
                        filter: blur(20px);
                    }
                    50% {
                        filter: blur(5px);
                    }
                    100% {
                        transform: scale(1) rotate(0deg);
                        opacity: 1;
                        filter: blur(0);
                    }
                }

                @keyframes discFloat {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-10px) rotate(5deg); }
                }

                @keyframes discSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes materializeParticle {
                    0% {
                        transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(0);
                        opacity: 0;
                    }
                    50% { opacity: 1; }
                    100% {
                        transform: translate(0, 0) scale(1);
                        opacity: 0;
                    }
                }

                @keyframes encryptRing {
                    0%, 100% { 
                        transform: scale(1) rotate(0deg); 
                        opacity: 0.3;
                    }
                    50% { 
                        transform: scale(1.1) rotate(180deg); 
                        opacity: 0.7;
                    }
                }

                @keyframes keyForgeLeft {
                    0% {
                        transform: translateX(-100px) scale(0) rotate(-90deg);
                        opacity: 0;
                    }
                    100% {
                        transform: translateX(-40px) scale(1) rotate(0deg);
                        opacity: 1;
                    }
                }

                @keyframes keyForgeRight {
                    0% {
                        transform: translateX(100px) scale(0) rotate(90deg) scaleX(-1);
                        opacity: 0;
                    }
                    100% {
                        transform: translateX(40px) scale(1) rotate(0deg) scaleX(-1);
                        opacity: 1;
                    }
                }

                @keyframes keysUnite {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                @keyframes keySlideLeft {
                    0% { transform: translateX(-20px); }
                    100% { transform: translateX(0); }
                }

                @keyframes keySlideRight {
                    0% { transform: translateX(20px); }
                    100% { transform: translateX(0); }
                }

                @keyframes lightningFlash {
                    0% { opacity: 0; transform: scale(0.5); }
                    50% { opacity: 1; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }

                @keyframes lockPulse {
                    0% { 
                        transform: scale(0.5); 
                        opacity: 0;
                    }
                    50% { 
                        opacity: 0.8;
                    }
                    100% { 
                        transform: scale(1.5); 
                        opacity: 0;
                    }
                }

                @keyframes walletTrace {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }

                @keyframes drawWallet {
                    0% { stroke-dashoffset: 300; }
                    100% { stroke-dashoffset: 0; }
                }

                @keyframes gentlePulse {
                    0%, 100% { 
                        transform: scale(1); 
                        filter: drop-shadow(0 0 20px ${colors.teal});
                    }
                    50% { 
                        transform: scale(1.05); 
                        filter: drop-shadow(0 0 30px ${colors.teal});
                    }
                }

                @keyframes ringPulse {
                    0%, 100% { 
                        transform: scale(1); 
                        opacity: 0.2;
                    }
                    50% { 
                        transform: scale(1.1); 
                        opacity: 0.4;
                    }
                }

                @keyframes digitalRain {
                    0% { transform: translateY(-100%); opacity: 0; }
                    10% { opacity: 0.2; }
                    90% { opacity: 0.2; }
                    100% { transform: translateY(100vh); opacity: 0; }
                }

                @keyframes successBurst {
                    0% { 
                        transform: scale(0); 
                        opacity: 1;
                    }
                    100% { 
                        transform: scale(2); 
                        opacity: 0;
                    }
                }

                @keyframes completeRing {
                    0% { 
                        transform: scale(1); 
                        opacity: 1;
                    }
                    100% { 
                        transform: scale(4); 
                        opacity: 0;
                    }
                }

                @keyframes completePulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                    100% { transform: scale(1.1); }
                }

                @keyframes fadeInUp {
                    0% { 
                        transform: translateY(20px); 
                        opacity: 0;
                    }
                    100% { 
                        transform: translateY(0); 
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};
