import React, { useEffect, useState, useMemo, useRef } from 'react';

interface LightningStrikeProps {
    amount: number;
    onComplete: () => void;
    extendedDuration?: boolean;
}

// ============================================================================
// INTENSITY CONFIGURATION
// ============================================================================

type IntensityTier = 'minimal' | 'low' | 'medium' | 'high' | 'very-high' | 'massive';

interface IntensityConfig {
    tier: IntensityTier;
    boltCount: [number, number]; // [min, max]
    flashIntensity: number; // 0-1
    duration: number; // total ms
    boltWidth: [number, number]; // [min, max]
    hasBranches: boolean;
    hasShake: boolean;
    hasMultipleWaves: boolean;
    hasAfterGlow: boolean;
    glowColor: string;
    label: string;
}

const getIntensityConfig = (amount: number): IntensityConfig => {
    if (amount <= 100) {
        return {
            tier: 'minimal',
            boltCount: [1, 1],
            flashIntensity: 0.2,
            duration: 1500,
            boltWidth: [2, 3],
            hasBranches: false,
            hasShake: false,
            hasMultipleWaves: false,
            hasAfterGlow: false,
            glowColor: '#f97316',
            label: 'Spark'
        };
    } else if (amount <= 1000) {
        return {
            tier: 'low',
            boltCount: [1, 2],
            flashIntensity: 0.3,
            duration: 1600,
            boltWidth: [2, 4],
            hasBranches: false,
            hasShake: false,
            hasMultipleWaves: false,
            hasAfterGlow: false,
            glowColor: '#f97316',
            label: 'Strike'
        };
    } else if (amount <= 5000) {
        return {
            tier: 'medium',
            boltCount: [2, 4],
            flashIntensity: 0.4,
            duration: 1700,
            boltWidth: [3, 5],
            hasBranches: false,
            hasShake: false,
            hasMultipleWaves: false,
            hasAfterGlow: false,
            glowColor: '#fb923c',
            label: 'Bolt'
        };
    } else if (amount <= 10000) {
        return {
            tier: 'high',
            boltCount: [4, 7],
            flashIntensity: 0.5,
            duration: 1800,
            boltWidth: [3, 6],
            hasBranches: true,
            hasShake: true,
            hasMultipleWaves: false,
            hasAfterGlow: false,
            glowColor: '#fbbf24',
            label: 'Storm'
        };
    } else if (amount <= 50000) {
        return {
            tier: 'very-high',
            boltCount: [6, 10],
            flashIntensity: 0.6,
            duration: 2000,
            boltWidth: [4, 7],
            hasBranches: true,
            hasShake: true,
            hasMultipleWaves: true,
            hasAfterGlow: false,
            glowColor: '#fde047',
            label: 'Thunder'
        };
    } else {
        return {
            tier: 'massive',
            boltCount: [10, 16],
            flashIntensity: 0.8,
            duration: 2500,
            boltWidth: [5, 9],
            hasBranches: true,
            hasShake: true,
            hasMultipleWaves: true,
            hasAfterGlow: true,
            glowColor: '#fff',
            label: 'APOCALYPSE'
        };
    }
};

// ============================================================================
// BOLT GENERATION
// ============================================================================

interface Bolt {
    path: string;
    delay: number;
    width: number;
    branches: string[];
    wave: number; // 0, 1, or 2 for multi-wave
}

const generateLightningPath = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    jaggedness: number = 80
): string => {
    const segments = 6 + Math.floor(Math.random() * 5);
    let path = `M ${startX} ${startY}`;

    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    for (let i = 1; i < segments; i++) {
        const progress = i / segments;
        const perpX = -dy / length;
        const perpY = dx / length;
        const offset = (Math.random() - 0.5) * jaggedness * 2;

        const x = startX + dx * progress + perpX * offset;
        const y = startY + dy * progress + perpY * offset;
        path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    path += ` L ${endX} ${endY}`;
    return path;
};

const generateBranch = (
    parentPath: string,
    branchPoint: number // 0-1 along the path
): string => {
    // Extract a point along the parent path
    const pathParts = parentPath.split(/[ML]\s*/).filter(Boolean);
    const pointIndex = Math.floor(pathParts.length * branchPoint);
    const point = pathParts[pointIndex]?.split(' ').map(Number) || [0, 0];

    const branchLength = 40 + Math.random() * 60;
    const angle = Math.random() * Math.PI * 2;
    const endX = point[0] + Math.cos(angle) * branchLength;
    const endY = point[1] + Math.sin(angle) * branchLength;

    return generateLightningPath(point[0], point[1], endX, endY, 30);
};

const getRandomEdgePoint = (): { x: number; y: number } => {
    const edge = Math.floor(Math.random() * 4);
    const w = typeof window !== 'undefined' ? window.innerWidth : 400;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;

    switch (edge) {
        case 0: return { x: Math.random() * w, y: -20 };
        case 1: return { x: w + 20, y: Math.random() * h };
        case 2: return { x: Math.random() * w, y: h + 20 };
        default: return { x: -20, y: Math.random() * h };
    }
};

const generateBolts = (config: IntensityConfig): Bolt[] => {
    const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;

    const [minBolts, maxBolts] = config.boltCount;
    const boltCount = minBolts + Math.floor(Math.random() * (maxBolts - minBolts + 1));

    const waves = config.hasMultipleWaves ? 3 : 1;
    const boltsPerWave = Math.ceil(boltCount / waves);

    const bolts: Bolt[] = [];

    for (let wave = 0; wave < waves; wave++) {
        for (let i = 0; i < boltsPerWave && bolts.length < boltCount; i++) {
            const start = getRandomEdgePoint();
            const endX = centerX + (Math.random() - 0.5) * 120;
            const endY = centerY + (Math.random() - 0.5) * 100;

            const path = generateLightningPath(start.x, start.y, endX, endY, 50 + Math.random() * 50);

            // Generate branches for higher tiers
            const branches: string[] = [];
            if (config.hasBranches && Math.random() > 0.4) {
                const branchCount = 1 + Math.floor(Math.random() * 2);
                for (let b = 0; b < branchCount; b++) {
                    branches.push(generateBranch(path, 0.3 + Math.random() * 0.5));
                }
            }

            const [minWidth, maxWidth] = config.boltWidth;
            bolts.push({
                path,
                delay: wave * 200 + Math.random() * 100,
                width: minWidth + Math.random() * (maxWidth - minWidth),
                branches,
                wave
            });
        }
    }

    return bolts;
};

// ============================================================================
// COMPONENT
// ============================================================================

export const LightningStrikeNotification: React.FC<LightningStrikeProps> = ({
    amount,
    onComplete,
}) => {
    const [phase, setPhase] = useState<'flash' | 'show' | 'afterglow' | 'fade' | 'complete'>('flash');
    const [flashOpacity, setFlashOpacity] = useState(0);
    const [currentWave, setCurrentWave] = useState(0);

    const config = useMemo(() => getIntensityConfig(amount), [amount]);
    const bolts = useMemo(() => generateBolts(config), [config]);

    // Use a ref for the callback to prevent the animation useEffect from
    // restarting when the parent re-renders and passes a new callback reference
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    // Animation sequence - only depends on config, NOT on onComplete
    // This prevents the animation from restarting when parent re-renders
    useEffect(() => {
        const { duration, hasMultipleWaves, hasAfterGlow } = config;

        // Calculate phase timings
        const flashDuration = 120;
        const showDuration = hasAfterGlow ? duration * 0.5 : duration * 0.7;
        const afterglowDuration = hasAfterGlow ? duration * 0.2 : 0;
        const fadeDuration = duration * 0.2;

        // Phase 1: Flash
        setFlashOpacity(1);

        const flashTimer = setTimeout(() => {
            setFlashOpacity(0);
            setPhase('show');
        }, flashDuration);

        // Wave progression for multi-wave
        let waveTimers: NodeJS.Timeout[] = [];
        if (hasMultipleWaves) {
            waveTimers = [
                setTimeout(() => setCurrentWave(1), 200),
                setTimeout(() => setCurrentWave(2), 400),
            ];
        }

        // Phase 2: Show → Afterglow (if applicable)
        const afterglowTimer = hasAfterGlow
            ? setTimeout(() => setPhase('afterglow'), flashDuration + showDuration)
            : null;

        // Phase 3: Fade
        const fadeTimer = setTimeout(() => {
            setPhase('fade');
        }, flashDuration + showDuration + afterglowDuration);

        // Complete - use ref to call the current callback
        const completeTimer = setTimeout(() => {
            setPhase('complete');
            onCompleteRef.current();
        }, flashDuration + showDuration + afterglowDuration + fadeDuration);

        return () => {
            clearTimeout(flashTimer);
            waveTimers.forEach(t => clearTimeout(t));
            if (afterglowTimer) clearTimeout(afterglowTimer);
            clearTimeout(fadeTimer);
            clearTimeout(completeTimer);
        };
    }, [config]); // Removed onComplete from dependencies - using ref instead

    if (phase === 'complete') return null;

    const showBolts = phase === 'flash' || (phase === 'show' && config.tier !== 'minimal');

    return (
        <div
            className={`fixed inset-0 z-[200] pointer-events-none overflow-hidden ${config.hasShake && phase === 'flash' ? 'animate-shake' : ''
                }`}
        >
            {/* Screen flash effect */}
            <div
                className="absolute inset-0 transition-opacity"
                style={{
                    background: `radial-gradient(circle at center, ${config.glowColor}40 0%, transparent 70%)`,
                    opacity: flashOpacity * config.flashIntensity,
                    transitionDuration: '80ms'
                }}
            />

            {/* Lightning bolts SVG */}
            {showBolts && (
                <svg
                    className="absolute inset-0 w-full h-full"
                    style={{
                        opacity: phase === 'flash' ? 1 : 0.2,
                        transition: 'opacity 300ms ease-out'
                    }}
                >
                    {bolts.map((bolt, idx) => (
                        <g
                            key={idx}
                            style={{
                                opacity: config.hasMultipleWaves ? (bolt.wave <= currentWave ? 1 : 0) : 1,
                                transition: 'opacity 100ms'
                            }}
                        >
                            {/* Outer glow */}
                            <path
                                d={bolt.path}
                                stroke={config.glowColor}
                                strokeWidth={bolt.width + 12}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    filter: 'blur(12px)',
                                    opacity: 0.5,
                                    strokeDasharray: 2000,
                                    strokeDashoffset: 2000,
                                    animation: `bolt-draw 0.1s ease-out ${bolt.delay}ms forwards`
                                }}
                            />
                            {/* Inner glow */}
                            <path
                                d={bolt.path}
                                stroke={config.glowColor}
                                strokeWidth={bolt.width + 6}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    filter: 'blur(4px)',
                                    opacity: 0.8,
                                    strokeDasharray: 2000,
                                    strokeDashoffset: 2000,
                                    animation: `bolt-draw 0.1s ease-out ${bolt.delay}ms forwards`
                                }}
                            />
                            {/* Core bolt */}
                            <path
                                d={bolt.path}
                                stroke="#fff"
                                strokeWidth={bolt.width}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    filter: `drop-shadow(0 0 2px #fff)`,
                                    strokeDasharray: 2000,
                                    strokeDashoffset: 2000,
                                    animation: `bolt-draw 0.1s ease-out ${bolt.delay}ms forwards`
                                }}
                            />

                            {/* Branches */}
                            {bolt.branches.map((branch, bIdx) => (
                                <g key={bIdx}>
                                    <path
                                        d={branch}
                                        stroke={config.glowColor}
                                        strokeWidth={bolt.width * 0.5 + 4}
                                        fill="none"
                                        strokeLinecap="round"
                                        style={{
                                            filter: 'blur(3px)',
                                            opacity: 0.6,
                                            strokeDasharray: 1000,
                                            strokeDashoffset: 1000,
                                            animation: `bolt-draw 0.08s ease-out ${bolt.delay + 50}ms forwards`
                                        }}
                                    />
                                    <path
                                        d={branch}
                                        stroke="#fff"
                                        strokeWidth={bolt.width * 0.4}
                                        fill="none"
                                        strokeLinecap="round"
                                        style={{
                                            strokeDasharray: 1000,
                                            strokeDashoffset: 1000,
                                            animation: `bolt-draw 0.08s ease-out ${bolt.delay + 50}ms forwards`
                                        }}
                                    />
                                </g>
                            ))}
                        </g>
                    ))}
                </svg>
            )}

            {/* Afterglow effect for massive amounts */}
            {config.hasAfterGlow && phase === 'afterglow' && (
                <div
                    className="absolute inset-0 animate-pulse"
                    style={{
                        background: `radial-gradient(circle at center, ${config.glowColor}30 0%, transparent 60%)`,
                    }}
                />
            )}

            {/* Amount display */}
            {(phase === 'show' || phase === 'afterglow' || phase === 'fade') && (
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        opacity: phase === 'fade' ? 0 : 1,
                        transform: phase === 'fade' ? 'scale(1.15)' : 'scale(1)',
                        transition: `opacity ${config.duration * 0.2}ms ease-out, transform ${config.duration * 0.2}ms ease-out`
                    }}
                >
                    {/* Dark backdrop */}
                    <div
                        className="absolute inset-0 backdrop-blur-sm"
                        style={{
                            background: config.tier === 'massive'
                                ? 'radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%)'
                                : 'rgba(0,0,0,0.6)'
                        }}
                    />

                    {/* Amount container */}
                    <div className="relative z-10 flex flex-col items-center animate-in zoom-in-90 duration-200">
                        {/* Lightning icon */}
                        <div
                            className="mb-2"
                            style={{
                                filter: `drop-shadow(0 0 ${config.tier === 'massive' ? 16 : 8}px ${config.glowColor})`
                            }}
                        >
                            <svg
                                width={config.tier === 'massive' ? 48 : 32}
                                height={config.tier === 'massive' ? 48 : 32}
                                viewBox="0 0 24 24"
                                fill="none"
                                style={{ color: config.glowColor }}
                            >
                                <path
                                    d="M13 2L4.09344 12.6879C3.74463 13.1064 3.57023 13.3157 3.56756 13.4925C3.56524 13.6461 3.63372 13.7923 3.75324 13.8889C3.89073 14 4.16316 14 4.70802 14H12L11 22L19.9065 11.3121C20.2553 10.8936 20.4297 10.6843 20.4324 10.5075C20.4347 10.3539 20.3663 10.2077 20.2467 10.1111C20.1092 10 19.8368 10 19.292 10H12L13 2Z"
                                    fill="currentColor"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>

                        {/* Amount */}
                        <div
                            className={`font-black text-white tracking-tight ${config.tier === 'massive' ? 'text-6xl' :
                                    config.tier === 'very-high' ? 'text-5xl' : 'text-5xl'
                                }`}
                            style={{
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                textShadow: `0 0 ${config.tier === 'massive' ? 40 : 20}px ${config.glowColor}, 
                                             0 0 ${config.tier === 'massive' ? 80 : 40}px ${config.glowColor}60, 
                                             0 2px 4px rgba(0,0,0,0.9)`,
                            }}
                        >
                            +{amount.toLocaleString()}
                        </div>

                        {/* SATS label */}
                        <div
                            className={`font-bold tracking-widest mt-1 ${config.tier === 'massive' ? 'text-xl' : 'text-lg'
                                }`}
                            style={{
                                color: config.glowColor,
                                textShadow: `0 0 10px ${config.glowColor}90, 0 1px 2px rgba(0,0,0,0.8)`,
                            }}
                        >
                            SATS
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
