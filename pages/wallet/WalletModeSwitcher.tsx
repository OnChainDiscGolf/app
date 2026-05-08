/**
 * @file WalletModeSwitcher.tsx
 *
 * Animated pill-style wallet type switcher displayed below the balance header.
 *
 * Behavior:
 * - **Collapsed state ("All")** -- shows combined balance across all wallets.
 *   Tapping expands to reveal the three individual wallet mode pills.
 * - **Expanded state** -- shows Breez (Lightning), Cashu (eCash), and NWC pills.
 *   Tapping a pill selects that wallet, scrolling the view and updating the
 *   balance/actions displayed. Selecting the active wallet collapses back to "All".
 * - Smooth expand/collapse CSS transitions with `requestAnimationFrame` timing.
 */

import React, { useState, useEffect } from 'react';
import { Icons } from '../../components/Icons';

/**
 * Collapsible wallet mode switcher with animated expand/collapse transitions.
 * Controls which wallet's balance, send/receive UI, and transaction history are shown.
 */
export const WalletModeSwitcher: React.FC<{
    activeMode: 'breez' | 'cashu' | 'nwc';
    viewMode: 'all' | 'breez' | 'cashu' | 'nwc';
    isExpanded: boolean;
    isNwcConnected: boolean;
    onModeChange: (mode: 'breez' | 'cashu' | 'nwc') => void;
    onViewModeChange: (mode: 'all' | 'breez' | 'cashu' | 'nwc') => void;
    onExpandToggle: () => void;
    onWalletSelect: (mode: 'breez' | 'cashu' | 'nwc') => void;
}> = ({ activeMode, viewMode, isExpanded, isNwcConnected, onModeChange, onViewModeChange, onExpandToggle, onWalletSelect }) => {
    // Track animation state for smooth open/close
    const [animationState, setAnimationState] = useState<'collapsed' | 'expanding' | 'expanded' | 'collapsing'>('collapsed');
    const [shouldRender, setShouldRender] = useState(false);

    // Handle expand/collapse transitions
    useEffect(() => {
        if (isExpanded && animationState === 'collapsed') {
            setShouldRender(true);
            // Small delay to ensure DOM is ready before animation starts
            requestAnimationFrame(() => {
                setAnimationState('expanding');
            });
        } else if (!isExpanded && (animationState === 'expanded' || animationState === 'expanding')) {
            setAnimationState('collapsing');
        }
    }, [isExpanded]);

    // Handle animation end
    const handleAnimationEnd = () => {
        if (animationState === 'expanding') {
            setAnimationState('expanded');
        } else if (animationState === 'collapsing') {
            setAnimationState('collapsed');
            setShouldRender(false);
        }
    };

    const modes = [
        { id: 'breez' as const, label: 'Lightning', icon: Icons.Zap, color: 'blue' },
        { id: 'cashu' as const, label: 'Cashu', icon: Icons.Cashew, color: 'emerald' },
        { id: 'nwc' as const, label: 'NWC', icon: Icons.Link, color: 'purple' },
    ];

    const getColorClasses = (color: string) => {
        const colors: Record<string, { active: string; inactive: string; border: string; text: string }> = {
            blue: {
                active: 'bg-blue-500/30',
                inactive: 'bg-blue-500/10 hover:bg-blue-500/20',
                border: 'border-blue-500/50',
                text: 'text-blue-400'
            },
            emerald: {
                active: 'bg-emerald-500/30',
                inactive: 'bg-emerald-500/10 hover:bg-emerald-500/20',
                border: 'border-emerald-500/50',
                text: 'text-emerald-400'
            },
            purple: {
                active: 'bg-purple-500/30',
                inactive: 'bg-purple-500/10 hover:bg-purple-500/20',
                border: 'border-purple-500/50',
                text: 'text-purple-400'
            },
            orange: {
                active: 'bg-orange-500/30',
                inactive: 'bg-orange-500/10 hover:bg-orange-500/20',
                border: 'border-orange-500/50',
                text: 'text-orange-400'
            }
        };
        return colors[color];
    };

    const isAllActive = viewMode === 'all';
    const allColors = getColorClasses('orange');
    const ICON_SIZE = 16; // Consistent icon size across all buttons
    const isClosing = animationState === 'collapsing';

    return (
        <div className="flex flex-col gap-1.5 bg-black/30 rounded-xl p-1.5 border border-white/10 backdrop-blur-sm">
            {/* Bitcoin "All" button - always visible, consistent height */}
            <button
                onClick={onExpandToggle}
                className={`
                    relative flex items-center justify-center rounded-lg transition-all duration-300 ease-out
                    px-2.5 py-1.5 min-h-[36px]
                    ${isAllActive && !isExpanded
                        ? `${allColors.active} ${allColors.border} border`
                        : `${allColors.inactive} border border-transparent`
                    }
                `}
            >
                <Icons.Bitcoin
                    size={24}
                    className={`${allColors.text} transition-all duration-300`}
                />
            </button>

            {/* Individual wallet buttons - shown when expanded or animating */}
            {shouldRender && (
                <div
                    className="flex items-center justify-center origin-center overflow-hidden"
                    style={{
                        animation: isClosing
                            ? 'wallet-collapse 350ms ease-in forwards'
                            : 'wallet-expand 300ms ease-out forwards',
                        // Fixed width: big enough to fit 3 icons + 1 label ("Lightning" is longest)
                        width: '175px',
                        minWidth: '175px',
                        maxWidth: '175px'
                    }}
                    onAnimationEnd={handleAnimationEnd}
                >
                    {modes.map((mode, index) => {
                        const isActive = viewMode === mode.id;
                        const colors = getColorClasses(mode.color);
                        const IconComponent = mode.icon;
                        // Reverse the index for closing animation
                        const animationDelay = isClosing
                            ? (modes.length - 1 - index) * 50
                            : index * 50;

                        // When no wallet is selected (viewMode === 'all'), all buttons share space equally
                        // When a wallet IS selected, selected one expands for label, others stay compact
                        const hasSelection = viewMode !== 'all';

                        const isDisabled = mode.id === 'nwc' && !isNwcConnected;

                        return (
                            <button
                                key={mode.id}
                                onClick={() => {
                                    if (isDisabled) return;
                                    onWalletSelect(mode.id);
                                }}
                                disabled={isDisabled}
                                className={`
                                    relative flex items-center justify-center rounded-lg transition-colors duration-200
                                    min-h-[36px] py-1.5 px-2
                                    ${isDisabled
                                        ? 'bg-slate-800/50 border border-slate-700/50 opacity-30 cursor-not-allowed'
                                        : isActive
                                            ? `${colors.active} ${colors.border} border`
                                            : `${colors.inactive} border border-transparent`
                                    }
                                `}
                                style={{
                                    // No selection: all equal. Has selection: active expands, others compact
                                    flex: hasSelection ? (isActive ? '1 1 auto' : '0 0 auto') : '1 1 0',
                                    // Use 'both' fill mode so items stay visible during delay before disappear animation starts
                                    animation: isClosing
                                        ? `wallet-item-disappear 200ms ease-in ${animationDelay}ms both`
                                        : `wallet-item-appear 300ms ease-out ${animationDelay}ms forwards`,
                                    opacity: 0,
                                    transform: 'scale(0.8) translateY(-8px)'
                                }}
                            >
                                <IconComponent
                                    size={ICON_SIZE}
                                    className={`${isDisabled ? 'text-slate-600' : colors.text} flex-shrink-0 ${isActive ? 'mr-1' : ''}`}
                                />
                                {/* Only show label when this wallet is selected */}
                                {isActive && (
                                    <span
                                        className={`
                                            text-xs font-bold uppercase tracking-wide whitespace-nowrap
                                            ${colors.text}
                                        `}
                                    >
                                        {mode.label}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* CSS Keyframes for smooth animations */}
            <style>{`
                @keyframes wallet-expand {
                    0% {
                        opacity: 0;
                        transform: scaleX(0.5) scaleY(0.8);
                    }
                    100% {
                        opacity: 1;
                        transform: scaleX(1) scaleY(1);
                    }
                }
                @keyframes wallet-collapse {
                    0% {
                        opacity: 1;
                        transform: scaleX(1) scaleY(1);
                    }
                    70% {
                        opacity: 0.8;
                        transform: scaleX(0.9) scaleY(0.95);
                    }
                    100% {
                        opacity: 0;
                        transform: scaleX(0.5) scaleY(0.8);
                    }
                }
                @keyframes wallet-item-appear {
                    0% {
                        opacity: 0;
                        transform: scale(0.8) translateY(-8px);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @keyframes wallet-item-disappear {
                    0% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(0.85) translateY(-6px);
                    }
                }
            `}</style>
        </div>
    );
};
