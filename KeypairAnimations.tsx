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

import React from 'react';
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
