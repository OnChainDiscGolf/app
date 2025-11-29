import React, { useEffect, useState } from 'react';

interface LightningStrikeProps {
    amount: number;
    onComplete: () => void;
    extendedDuration?: boolean;
}

const BRAND_COLORS = [
    '#10b981', // emerald-500 (primary green)
    'rgb(20, 184, 166)', // teal-500 (secondary)
    'rgb(251, 146, 60)', // orange-400 (accent)
    'rgb(251, 191, 36)', // amber-400 (yellow)
];

const getIntensityConfig = (amount: number) => {
    if (amount <= 1000) {
        return { tier: 'low', boltCount: Math.floor(Math.random() * 3) + 3, label: 'Low' };
    } else if (amount <= 5000) {
        return { tier: 'medium-low', boltCount: Math.floor(Math.random() * 5) + 6, label: 'Medium' };
    } else if (amount <= 15000) {
        return { tier: 'medium-high', boltCount: Math.floor(Math.random() * 8) + 11, label: 'High' };
    } else if (amount <= 30000) {
        return { tier: 'high', boltCount: Math.floor(Math.random() * 12) + 19, label: 'Very High' };
    } else {
        return { tier: 'max', boltCount: Math.floor(Math.random() * 20) + 31, label: 'MAXIMUM' };
    }
};

const generateLightningPath = (startX: number, startY: number, endX: number, endY: number) => {
    // More segments for realistic jagged lightning
    const segments = 12 + Math.floor(Math.random() * 5);
    let path = `M ${startX} ${startY}`;

    for (let i = 1; i < segments; i++) {
        const progress = i / segments;
        // More aggressive offsets for violent, jagged appearance
        const x = startX + (endX - startX) * progress + (Math.random() - 0.5) * 100;
        const y = startY + (endY - startY) * progress + (Math.random() - 0.5) * 100;
        path += ` L ${x} ${y}`;
    }

    path += ` L ${endX} ${endY}`;
    return path;
};

export const LightningStrikeNotification: React.FC<LightningStrikeProps> = ({
    amount,
    onComplete,
    extendedDuration = false
}) => {
    const [phase, setPhase] = useState<'initial-bolt' | 'amount-appear' | 'multi-bolt' | 'electrocute' | 'complete'>('initial-bolt');
    const [initialBolt, setInitialBolt] = useState({ path: '', color: '' });
    const [multibolts, setMultibolts] = useState<Array<{ path: string; color: string; delay: number }>>([]);

    const intensity = getIntensityConfig(amount);
    const baseDuration = 3000; // Fixed 3-second duration

    // Generate initial bolt on mount
    useEffect(() => {
        const startX = Math.random() * window.innerWidth;
        const startY = -20;
        const endX = Math.random() * window.innerWidth;
        const endY = window.innerHeight / 2;

        setInitialBolt({
            path: generateLightningPath(startX, startY, endX, endY),
            color: BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]
        });
    }, []);

    // Animation sequence
    useEffect(() => {
        // Faster, more violent timing
        const timings = {
            initialBolt: 100, // Faster initial strike
            amountAppear: 400, // Faster amount reveal
            multiBolt: 800, // Faster multi-bolt phase
            electrocute: 300, // Faster electrocute fade
        };

        // Phase 1: Initial bolt
        const phase1Timer = setTimeout(() => {
            setPhase('amount-appear');
        }, timings.initialBolt);

        // Phase 2: Amount appears
        const phase2Timer = setTimeout(() => {
            setPhase('multi-bolt');

            // Generate multiple bolts converging on center
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const bolts = [];

            for (let i = 0; i < intensity.boltCount; i++) {
                const angle = (Math.random() * 360 * Math.PI) / 180;
                const distance = 400 + Math.random() * 200;
                const startX = centerX + Math.cos(angle) * distance;
                const startY = centerY + Math.sin(angle) * distance;

                bolts.push({
                    path: generateLightningPath(startX, startY, centerX, centerY),
                    color: BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)],
                    delay: Math.random() * 100 // Even faster bolt strikes
                });
            }

            setMultibolts(bolts);
        }, timings.initialBolt + timings.amountAppear);

        // Phase 3: Electrocute away
        const phase3Timer = setTimeout(() => {
            setPhase('electrocute');
        }, timings.initialBolt + timings.amountAppear + timings.multiBolt);

        // Complete
        const completeTimer = setTimeout(() => {
            setPhase('complete');
            onComplete();
        }, timings.initialBolt + timings.amountAppear + timings.multiBolt + timings.electrocute);

        return () => {
            clearTimeout(phase1Timer);
            clearTimeout(phase2Timer);
            clearTimeout(phase3Timer);
            clearTimeout(completeTimer);
        };
    }, [intensity.boltCount, onComplete]);

    if (phase === 'complete') return null;

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            {/* Initial Bolt */}
            {phase === 'initial-bolt' && (
                <svg className="absolute inset-0 w-full h-full">
                    <path
                        d={initialBolt.path}
                        stroke={initialBolt.color}
                        strokeWidth="8" // Thicker initial bolt
                        fill="none"
                        className="lightning-bolt-initial"
                        style={{
                            filter: `drop-shadow(0 0 15px ${initialBolt.color})`, // Stronger glow
                            strokeDasharray: 1000,
                            strokeDashoffset: 1000,
                            animation: 'lightning-draw 0.1s ease-out forwards' // Faster draw
                        }}
                    />
                </svg>
            )}

            {/* Amount Display */}
            {(phase === 'amount-appear' || phase === 'multi-bolt' || phase === 'electrocute') && (
                <div
                    className={`absolute inset-0 flex items-center justify-center ${phase === 'electrocute' ? 'electrocute-animation' : ''
                        }`}
                >
                    <div
                        className={`text-center ${phase === 'amount-appear' ? 'animate-in fade-in zoom-in-95 duration-500' : ''
                            }`}
                        style={{
                            animation: phase === 'electrocute' ? 'electrocute-out 0.6s ease-out forwards' : undefined
                        }}
                    >
                        <div
                            className="text-6xl font-bold text-white mb-2"
                            style={{
                                textShadow: '0 0 30px rgba(0,0,0,1), 0 0 50px rgba(0,0,0,0.8), 0 0 70px rgba(16,185,129,0.9), 0 0 100px rgba(16,185,129,0.6), 0 4px 8px rgba(0,0,0,0.9)',
                                WebkitTextStroke: '1px rgba(0,0,0,0.5)',
                                animation: phase === 'multi-bolt' ? 'electric-glow 0.2s ease-in-out infinite' : undefined
                            }}
                        >
                            {amount.toLocaleString()}
                        </div>
                        <div
                            className="text-2xl font-bold text-white"
                            style={{
                                textShadow: '0 0 20px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                                WebkitTextStroke: '0.5px rgba(0,0,0,0.3)',
                            }}
                        >
                            SATS
                        </div>
                    </div>
                </div>
            )}

            {/* Multi-Bolt Convergence */}
            {phase === 'multi-bolt' && (
                <svg className="absolute inset-0 w-full h-full">
                    {multibolts.map((bolt, idx) => (
                        <path
                            key={idx}
                            d={bolt.path}
                            stroke={bolt.color}
                            strokeWidth="5"
                            fill="none"
                            style={{
                                filter: `drop-shadow(0 0 12px ${bolt.color}) drop-shadow(0 0 6px ${bolt.color})`,
                                strokeDasharray: 1000,
                                strokeDashoffset: 1000,
                                animation: `lightning-draw 0.1s ease-out ${bolt.delay}ms forwards`,
                                opacity: 0.95
                            }}
                        />
                    ))}
                </svg>
            )}
        </div>
    );
};
