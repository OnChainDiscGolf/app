
import React, { useState, useEffect, useRef } from 'react';
import { useQrScanner } from '../hooks/useQrScanner';
import { useApp } from '../context/AppContext';
import { sendGiftWrap, getMagicLightningAddress } from '../services/nostrService';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { FeedbackModal, FeedbackButton } from '../components/FeedbackModal';
import { useNavigate } from 'react-router-dom';
import { getBtcPrice, satsToUsd } from '../services/priceService';
import { generateMnemonic, storeMnemonicEncrypted, retrieveMnemonicEncrypted, hasStoredMnemonic, hasUnifiedSeed } from '../services/mnemonicService';
import { downloadWalletCardPDF } from '../services/backupService';

// Helper Component for Success Animation
// Stylish Success Overlay with themed animations
const SuccessOverlay: React.FC<{
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

// Stylish Processing Overlay with animated lightning loader
const ProcessingOverlay: React.FC<{ message: string }> = ({ message }) => {
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

const HelpModal: React.FC<{
    isOpen: boolean;
    title: string;
    text: string;
    onClose: () => void;
    onAction?: (action: string) => void;
}> = ({ isOpen, title, text, onClose, onAction }) => {
    if (!isOpen) return null;
    
    const handleContentClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute('data-action');
        if (action && onAction) {
            onAction(action);
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-slate-800">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                                <Icons.Help size={20} className="text-brand-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
                            <Icons.Close size={20} />
                    </button>
                </div>
                </div>
                
                {/* Content */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    <div 
                        className="text-slate-300 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: text }}
                        onClick={handleContentClick}
                    />
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-slate-800">
                    <Button fullWidth onClick={onClose}>Got it</Button>
                </div>
            </div>
        </div>
    );
};

// Expandable Wallet Tile Component for Help Modal
const ExpandableWalletTile: React.FC<{
    type: 'breez' | 'cashu' | 'nwc';
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ type, isExpanded, onToggle }) => {
    const config = {
        breez: {
            color: 'blue',
            icon: <Icons.Zap size={16} className="text-blue-400" />,
            title: 'Lightning (Breez)',
            subtitle: 'Self-custodial Lightning wallet.',
            badge: '(Coming soon)',
            details: `The Breez SDK creates a Lightning node on your phone. It's like having your own mini Bitcoin bank that only you control. Best for larger amounts and users who value maximum security.`
        },
        cashu: {
            color: 'emerald',
            icon: <Icons.Cashew size={16} className="text-emerald-400" />,
            title: 'Cashu',
            subtitle: 'Private eCash tokens.',
            badge: null,
            details: `Think of it like digital arcade tokens — simple, private, and instant. Cashu uses "mints" that create tokens backed by Bitcoin. You can send these tokens instantly and privately. Great for everyday use and getting started.`
        },
        nwc: {
            color: 'purple',
            icon: <Icons.Link size={16} className="text-purple-400" />,
            title: 'NWC',
            subtitle: 'Connect your existing wallet.',
            badge: null,
            details: `Already using Alby, Zeus, or another Lightning wallet? Plug it right in! NWC (Nostr Wallet Connect) lets apps talk to your wallet securely. You keep full control — this app just sends payment requests.`
        }
    };
    
    const c = config[type];
    const colorClasses = {
        blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', hover: 'hover:bg-blue-500/20', text: 'text-blue-400' },
        emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', hover: 'hover:bg-emerald-500/20', text: 'text-emerald-400' },
        purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', hover: 'hover:bg-purple-500/20', text: 'text-purple-400' }
    }[c.color];
    
    return (
        <div className={`${colorClasses.bg} border ${colorClasses.border} rounded-lg overflow-hidden transition-all duration-300`}>
            <button 
                onClick={onToggle}
                className={`w-full p-3 ${colorClasses.hover} transition-colors text-left`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        {c.icon}
                        <span className={`font-bold ${colorClasses.text}`}>{c.title}</span>
                        {c.badge && <span className="text-slate-500 text-xs italic">{c.badge}</span>}
                    </div>
                    <Icons.ChevronDown 
                        size={16} 
                        className={`${colorClasses.text} transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
                <p className="text-xs text-slate-400 mt-1">{c.subtitle}</p>
            </button>
            
            {/* Expandable Content */}
            <div 
                className={`overflow-hidden transition-all duration-300 ease-out ${
                    isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="px-3 pb-3 pt-1 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400 leading-relaxed">{c.details}</p>
                </div>
            </div>
        </div>
    );
};

// Wallet Help Modal with expandable tiles
const WalletHelpModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onLightningClick: () => void;
    onWhyThreeClick: () => void;
    onNewToBitcoinClick: () => void;
    onSatoshiClick: () => void;
    showNewToBitcoin?: boolean;
}> = ({ isOpen, onClose, onLightningClick, onWhyThreeClick, onNewToBitcoinClick, onSatoshiClick, showNewToBitcoin = false }) => {
    const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
    
    if (!isOpen) return null;
    
    const toggleWallet = (type: string) => {
        setExpandedWallet(expandedWallet === type ? null : type);
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-slate-800">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                                <Icons.Help size={20} className="text-brand-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Your Wallet</h3>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
                            <Icons.Close size={20} />
                        </button>
                    </div>
                </div>
                
                {/* Content */}
                <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                    <p className="text-slate-300 text-sm">
                        Your wallet lets you <strong className="text-white">send and receive Bitcoin</strong> instantly using the{' '}
                        <button onClick={onLightningClick} className="text-brand-primary hover:underline">
                            Lightning Network
                        </button>
                        . Of course, you're not going to send a whole Bitcoin — you're way too poor for that. You're going to send{' '}
                        <button onClick={onSatoshiClick} className="text-orange-400 hover:underline font-bold">
                            Satoshis
                        </button>
                        {' '}(or sats).
                    </p>
                    
                    <div>
                        <p className="font-bold text-white mb-2">💡 Quick Tips:</p>
                        <ul className="list-disc ml-5 space-y-1 text-sm text-slate-300">
                            <li><strong>Tap your balance</strong> to see USD value</li>
                            <li><strong>Pull down</strong> to refresh your balance</li>
                        </ul>
                    </div>
                    
                    <div>
                        <div className="flex items-center space-x-2 mb-2">
                            <p className="font-bold text-white">🔄 Three Wallet Options</p>
                            <button onClick={onWhyThreeClick} className="text-brand-primary text-xs hover:underline">
                                (Why three?)
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            <ExpandableWalletTile 
                                type="breez" 
                                isExpanded={expandedWallet === 'breez'} 
                                onToggle={() => toggleWallet('breez')} 
                            />
                            <ExpandableWalletTile 
                                type="cashu" 
                                isExpanded={expandedWallet === 'cashu'} 
                                onToggle={() => toggleWallet('cashu')} 
                            />
                            <ExpandableWalletTile 
                                type="nwc" 
                                isExpanded={expandedWallet === 'nwc'} 
                                onToggle={() => toggleWallet('nwc')} 
                            />
                        </div>
                    </div>
                    
                    <p className="text-xs text-slate-500">
                        Tap a wallet above for more details. Switch anytime using the selector at the top.
                    </p>
                    
                    {/* New to Bitcoin - shows when user has balance */}
                    {showNewToBitcoin && (
                        <button
                            onClick={onNewToBitcoinClick}
                            className="w-full mt-4 p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl transition-colors group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Icons.Bitcoin size={20} className="text-orange-500" />
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-white">Need more sats?</p>
                                        <p className="text-xs text-slate-400">Learn how to buy Bitcoin</p>
                                    </div>
                                </div>
                                <Icons.Next size={16} className="text-slate-500 group-hover:text-orange-500 transition-colors" />
                            </div>
                        </button>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-slate-800">
                    <Button fullWidth onClick={onClose}>Got it</Button>
                </div>
            </div>
        </div>
    );
};

// Wallet Mode Pill Switcher Component with collapsible "All" option
const WalletModeSwitcher: React.FC<{
    activeMode: 'breez' | 'cashu' | 'nwc';
    viewMode: 'all' | 'breez' | 'cashu' | 'nwc';
    isExpanded: boolean;
    onModeChange: (mode: 'breez' | 'cashu' | 'nwc') => void;
    onViewModeChange: (mode: 'all' | 'breez' | 'cashu' | 'nwc') => void;
    onExpandToggle: () => void;
    onWalletSelect: (mode: 'breez' | 'cashu' | 'nwc') => void;
}> = ({ activeMode, viewMode, isExpanded, onModeChange, onViewModeChange, onExpandToggle, onWalletSelect }) => {
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
                        
                        return (
                            <button
                                key={mode.id}
                                onClick={() => onWalletSelect(mode.id)}
                                className={`
                                    relative flex items-center justify-center rounded-lg transition-colors duration-200
                                    min-h-[36px] py-1.5 px-2
                                    ${isActive 
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
                                    className={`${colors.text} flex-shrink-0 ${isActive ? 'mr-1' : ''}`} 
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

// Color mapping for wallet modes
const WALLET_COLORS = {
    breez: { 
        primary: 'rgb(59, 130, 246)',    // blue-500
        glow: 'rgba(59, 130, 246, 0.2)',
        glowStrong: 'rgba(59, 130, 246, 0.25)',
        border: 'rgba(59, 130, 246, 0.3)'
    },
    cashu: { 
        primary: 'rgb(16, 185, 129)',    // emerald-500
        glow: 'rgba(16, 185, 129, 0.2)',
        glowStrong: 'rgba(16, 185, 129, 0.25)',
        border: 'rgba(16, 185, 129, 0.3)'
    },
    nwc: { 
        primary: 'rgb(168, 85, 247)',    // purple-500
        glow: 'rgba(168, 85, 247, 0.2)',
        glowStrong: 'rgba(168, 85, 247, 0.25)',
        border: 'rgba(168, 85, 247, 0.3)'
    },
    all: { 
        primary: 'rgb(249, 115, 22)',    // orange-500
        glow: 'rgba(249, 115, 22, 0.2)',
        glowStrong: 'rgba(249, 115, 22, 0.25)',
        border: 'rgba(249, 115, 22, 0.3)'
    },
    none: {
        primary: 'transparent',
        glow: 'transparent',
        glowStrong: 'transparent',
        border: 'rgba(100, 116, 139, 0.3)'
    }
};

// Wallet order for determining left/right colors
const WALLET_ORDER: Array<'breez' | 'cashu' | 'nwc'> = ['breez', 'cashu', 'nwc'];

// Get the color that should appear on the LEFT side based on current selection
const getLeftGlowColor = (currentMode: 'breez' | 'cashu' | 'nwc'): 'breez' | 'cashu' | 'none' => {
    const currentIndex = WALLET_ORDER.indexOf(currentMode);
    if (currentIndex === 0) return 'none'; // Breez is leftmost, nothing to the left
    if (currentIndex === 1) return 'breez'; // Cashu: Breez is to the left
    return 'cashu'; // NWC: Cashu is to the left (Breez "disappears")
};

export const Wallet: React.FC = () => {
    const { walletBalance, isBalanceLoading, transactions, userProfile, currentUserPubkey, mints, setActiveMint, addMint, removeMint, sendFunds, receiveEcash, depositFunds, checkDepositStatus, confirmDeposit, getLightningQuote, isAuthenticated, refreshWalletBalance, walletMode, nwcString, setWalletMode, setNwcConnection, checkForPayments, walletBalances, refreshAllBalances, authSource } = useApp();
    const navigate = useNavigate();
    
    // Breez Wallet Creation State (for non-mnemonic users)
    const [hasBreezWallet, setHasBreezWallet] = useState<boolean>(() => {
        // Check if user has unified seed OR separate Breez mnemonic
        return hasUnifiedSeed() || hasStoredMnemonic(true);
    });
    const [showBreezSetup, setShowBreezSetup] = useState(false);
    const [breezMnemonic, setBreezMnemonic] = useState<string | null>(null);
    const [showBreezMnemonic, setShowBreezMnemonic] = useState(false);
    const [isCreatingBreezWallet, setIsCreatingBreezWallet] = useState(false);
    
    // View mode for cumulative balance display ('all' shows total of all wallets)
    // Start in 'all' mode (collapsed) by default for cleaner UI
    const [viewMode, setViewMode] = useState<'all' | 'breez' | 'cashu' | 'nwc'>('all');
    const [isWalletSelectorExpanded, setIsWalletSelectorExpanded] = useState(false);
    const autoCollapseTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Track wallet mode for gradient transitions
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [transitionDirection, setTransitionDirection] = useState<'left' | 'right'>('left');
    
    // Wallet selector expand/collapse handlers
    const clearAutoCollapseTimer = () => {
        if (autoCollapseTimerRef.current) {
            clearTimeout(autoCollapseTimerRef.current);
            autoCollapseTimerRef.current = null;
        }
    };
    
    const startAutoCollapseTimer = () => {
        clearAutoCollapseTimer();
        autoCollapseTimerRef.current = setTimeout(() => {
            if (viewMode === 'all') {
                setIsWalletSelectorExpanded(false);
            }
        }, 3000);
    };
    
    const handleExpandToggle = () => {
        if (isWalletSelectorExpanded) {
            setIsWalletSelectorExpanded(false);
            clearAutoCollapseTimer();
            setViewMode('all');
        } else {
            setIsWalletSelectorExpanded(true);
            if (viewMode === 'all') {
                startAutoCollapseTimer();
            }
        }
    };
    
    const handleWalletSelect = (mode: 'breez' | 'cashu' | 'nwc') => {
        clearAutoCollapseTimer();
        setViewMode(mode);
        if (walletMode !== mode) {
            handleWalletModeChange(mode);
        }
    };
    
    // Cleanup timer on unmount
    useEffect(() => {
        return () => clearAutoCollapseTimer();
    }, []);
    
    // Calculate cumulative balance for "All Wallets" view
    const cumulativeBalance = walletBalances.cashu + walletBalances.nwc + walletBalances.breez;
    
    // Get the display balance based on view mode
    const displayBalance = viewMode === 'all' ? cumulativeBalance : walletBalance;
    
    // Refresh all balances when entering "all" view mode
    useEffect(() => {
        if (viewMode === 'all') {
            refreshAllBalances();
        }
    }, [viewMode]);
    
    // Balance display toggle (SATS ↔ USD)
    const [showUsd, setShowUsd] = useState(false);
    const [usdValue, setUsdValue] = useState<string | null>(null);
    const [isFetchingPrice, setIsFetchingPrice] = useState(false);
    const usdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Fund wallet modal
    const [showFundModal, setShowFundModal] = useState(false);
    const [rabbitHoleLevel, setRabbitHoleLevel] = useState(0); // 0 = main, 1 = deeper, 2 = deepest, 3 = matrix
    const [showGlitch, setShowGlitch] = useState(false);
    const [matrixText, setMatrixText] = useState('');
    const [matrixComplete, setMatrixComplete] = useState(false);
    const [showLightningExplainer, setShowLightningExplainer] = useState(false);
    const [showWhyThreeWallets, setShowWhyThreeWallets] = useState(false);
    const [showWalletHelp, setShowWalletHelp] = useState(false);
    const [returnToWalletHelp, setReturnToWalletHelp] = useState(false); // Track if we should return to help modal
    const [matrixClickable, setMatrixClickable] = useState(false);
    const [showVisaConspiracy, setShowVisaConspiracy] = useState(false); // Easter egg: Level 1 - The financial system conspiracy
    const [showMoneyPrinters, setShowMoneyPrinters] = useState(false); // Easter egg: Level 2 - Central banks
    const [showCantillonClass, setShowCantillonClass] = useState(false); // Easter egg: Level 3 - Who benefits
    const [showLifeboat, setShowLifeboat] = useState(false); // Easter egg: Level 4 - Hope and Bitcoin
    const [showRedPill, setShowRedPill] = useState(false); // Easter egg: Level 5 - The final reveal
    const [redPillPhase, setRedPillPhase] = useState(0); // 0 = glitch, 1 = screen tear, 2 = message
    
    // Wallet selection modal for "All" mode
    const [showWalletSelectionModal, setShowWalletSelectionModal] = useState<'send' | 'receive' | null>(null);
    
    // Default wallet preferences (persisted to localStorage)
    const [defaultSendWallet, setDefaultSendWallet] = useState<'cashu' | 'nwc' | 'breez' | null>(() => {
        const saved = localStorage.getItem('cdg_default_send_wallet');
        return saved as 'cashu' | 'nwc' | 'breez' | null;
    });
    const [defaultReceiveWallet, setDefaultReceiveWallet] = useState<'cashu' | 'nwc' | 'breez' | null>(() => {
        const saved = localStorage.getItem('cdg_default_receive_wallet');
        return saved as 'cashu' | 'nwc' | 'breez' | null;
    });
    // Default quick-send wallet preference ('auto' means smart selection based on balance)
    const [defaultQuickSendWallet, setDefaultQuickSendWallet] = useState<'auto' | 'cashu' | 'nwc' | 'breez'>(() => {
        const saved = localStorage.getItem('cdg_default_quick_send_wallet');
        return (saved as 'auto' | 'cashu' | 'nwc' | 'breez') || 'auto';
    });
    
    // Persist default wallet preferences
    useEffect(() => {
        if (defaultSendWallet) {
            localStorage.setItem('cdg_default_send_wallet', defaultSendWallet);
        } else {
            localStorage.removeItem('cdg_default_send_wallet');
        }
    }, [defaultSendWallet]);
    
    useEffect(() => {
        if (defaultReceiveWallet) {
            localStorage.setItem('cdg_default_receive_wallet', defaultReceiveWallet);
        } else {
            localStorage.removeItem('cdg_default_receive_wallet');
        }
    }, [defaultReceiveWallet]);
    
    // Persist quick-send wallet preference
    useEffect(() => {
        localStorage.setItem('cdg_default_quick_send_wallet', defaultQuickSendWallet);
    }, [defaultQuickSendWallet]);
    
    // Smart wallet selection - picks the best wallet to send from based on balance
    // Priority: NWC (if connected & funded) > Breez (if available & funded) > Cashu (default)
    const getPreferredSendWallet = (): 'breez' | 'nwc' | 'cashu' => {
        // If user has set a specific preference, use it (if that wallet has balance)
        if (defaultQuickSendWallet !== 'auto') {
            const preferredBalance = walletBalances[defaultQuickSendWallet];
            // Check if preferred wallet is available and has balance
            if (defaultQuickSendWallet === 'nwc' && nwcString && preferredBalance > 0) return 'nwc';
            if (defaultQuickSendWallet === 'breez' && hasBreezWallet && preferredBalance > 0) return 'breez';
            if (defaultQuickSendWallet === 'cashu' && preferredBalance > 0) return 'cashu';
            // If preferred wallet has no balance, fall through to auto-selection
        }
        
        // Auto-selection: Priority 1 - NWC (if connected and has balance)
        if (nwcString && walletBalances.nwc > 0) {
            return 'nwc';
        }
        
        // Priority 2: Breez - if wallet exists and has balance
        if (hasBreezWallet && walletBalances.breez > 0) {
            return 'breez';
        }
        
        // Priority 3: Cashu - if has balance
        if (walletBalances.cashu > 0) {
            return 'cashu';
        }
        
        // Fallback: Check for any wallet with balance (handles edge cases)
        if (walletBalances.nwc > 0 && nwcString) return 'nwc';
        if (walletBalances.breez > 0 && hasBreezWallet) return 'breez';
        
        // Default to Cashu (built-in wallet, always available)
        return 'cashu';
    };
    
    // Helper to use default wallet or show selection modal
    const handleAllWalletsSend = () => {
        if (defaultSendWallet) {
            // Use the default wallet directly
            setViewMode(defaultSendWallet);
            setWalletMode(defaultSendWallet);
            setIsWalletSelectorExpanded(true);
            setView('send-input');
        } else {
            // Show selection modal
            setShowWalletSelectionModal('send');
        }
    };
    
    const handleAllWalletsReceive = () => {
        if (defaultReceiveWallet) {
            // Use the default wallet directly
            setViewMode(defaultReceiveWallet);
            setWalletMode(defaultReceiveWallet);
            setIsWalletSelectorExpanded(true);
            if (defaultReceiveWallet === 'nwc') {
                setView('deposit');
            } else {
                setView('receive');
            }
        } else {
            // Show selection modal
            setShowWalletSelectionModal('receive');
        }
    };
    
    // Satoshi Rabbit Hole states
    const [showWhatIsSatoshi, setShowWhatIsSatoshi] = useState(false); // Level 1: What is a Satoshi
    const [showSatoshiPricing, setShowSatoshiPricing] = useState(false); // Level 2: Historical pricing
    const [showDollarCollapse, setShowDollarCollapse] = useState(false); // Level 3: Dollar losing value
    const [showEmpiresFall, setShowEmpiresFall] = useState(false); // Level 4: Empires and currency
    const [showBitcoinForever, setShowBitcoinForever] = useState(false); // Level 5: Bitcoin cannot be debased
    const [transmissionPhase, setTransmissionPhase] = useState(0); // For the final fourth-wall break
    
    // Matrix typewriter effect
    useEffect(() => {
        if (rabbitHoleLevel === 3) {
            const userName = userProfile?.name || 'friend';
            const fullText = `Hello, ${userName}.\n\nYou've reached the bottom.\n\nCongratulations?\n\nBut here's the thing — the real revolution isn't on a screen. It's out there. On the course. With friends. Throwing plastic at chains.\n\nThe empire will crumble whether you're doom-scrolling or not.\n\nNow put your phone down and get to throwing. <3`;
            
            let currentIndex = 0;
            setMatrixText('');
            setMatrixComplete(false);
            setMatrixClickable(false);
            
            // Initial blink delay
            const blinkDelay = setTimeout(() => {
                const typeInterval = setInterval(() => {
                    if (currentIndex < fullText.length) {
                        setMatrixText(fullText.slice(0, currentIndex + 1));
                        currentIndex++;
                    } else {
                        clearInterval(typeInterval);
                        setMatrixComplete(true);
                        // Wait 3 seconds then enable clicking
                        setTimeout(() => {
                            setMatrixClickable(true);
                        }, 3000);
                    }
                }, 35); // Typewriter speed
                
                return () => clearInterval(typeInterval);
            }, 1500); // Initial blink time
            
            return () => clearTimeout(blinkDelay);
        }
    }, [rabbitHoleLevel, userProfile?.name]);
    
    // Handle Matrix exit
    const handleMatrixExit = () => {
        if (matrixClickable) {
            setRabbitHoleLevel(0);
            setShowFundModal(false);
            setMatrixText('');
            setMatrixComplete(false);
            setMatrixClickable(false);
        }
    };
    
    // Calculate gradient colors based on current view selection
    // When viewing 'all', use orange. Otherwise use the viewMode's color
    const effectiveMode = viewMode === 'all' ? 'all' : viewMode;
    const leftGlowType = viewMode === 'all' ? 'none' : getLeftGlowColor(viewMode as 'breez' | 'cashu' | 'nwc');
    const rightGlowColor = WALLET_COLORS[effectiveMode];
    const leftGlowColor = WALLET_COLORS[leftGlowType];
    
    // Handle wallet mode change with directional transition
    const handleWalletModeChange = (newMode: 'breez' | 'cashu' | 'nwc') => {
        if (newMode === walletMode) return;
        
        // Determine transition direction based on wallet order
        const currentIndex = WALLET_ORDER.indexOf(walletMode);
        const newIndex = WALLET_ORDER.indexOf(newMode);
        setTransitionDirection(newIndex > currentIndex ? 'left' : 'right');
        
        setIsTransitioning(true);
        setWalletMode(newMode);
        
        // Refresh balance for the new wallet
        refreshWalletBalance();
        
        // End transition after animation completes
        setTimeout(() => {
            setIsTransitioning(false);
        }, 500);
    };
    
    // Handle balance tap to show USD for 3 seconds
    const handleBalanceTap = async () => {
        // If already showing USD, clear and return to sats immediately
        if (showUsd) {
            if (usdTimeoutRef.current) {
                clearTimeout(usdTimeoutRef.current);
                usdTimeoutRef.current = null;
            }
            setShowUsd(false);
            return;
        }
        
        // Don't fetch if already fetching
        if (isFetchingPrice) return;
        
        setIsFetchingPrice(true);
        
        try {
            const btcPrice = await getBtcPrice();
            
            if (btcPrice) {
                const usd = satsToUsd(displayBalance, btcPrice);
                setUsdValue(usd);
                setShowUsd(true);
                
                // Auto-switch back to sats after 3 seconds
                usdTimeoutRef.current = setTimeout(() => {
                    setShowUsd(false);
                    usdTimeoutRef.current = null;
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to fetch price:', error);
        } finally {
            setIsFetchingPrice(false);
        }
    };
    
    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (usdTimeoutRef.current) {
                clearTimeout(usdTimeoutRef.current);
            }
        };
    }, []);

    const [view, setView] = useState<'main' | 'receive' | 'deposit' | 'send-input' | 'send-contacts' | 'send-details' | 'send-scan' | 'settings'>('main');
    const [sendAmount, setSendAmount] = useState('');
    const [sendInput, setSendInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    // Contacts state
    const [contacts, setContacts] = useState<Array<{ pubkey: string; name?: string; image?: string; lud16?: string }>>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [contactsError, setContactsError] = useState<string | null>(null);

    // Removed: Initial checkForPayments() call - now handled by subscription in AppContext

    // Removed: Aggressive tiered polling (2s → 3s → 5s)
    // Payment detection now handled by background subscription in AppContext (30s interval)

    // Pull-to-refresh state
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef<number | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [quoteFee, setQuoteFee] = useState<number | null>(null);
    const [insufficientFunds, setInsufficientFunds] = useState(false);
    const [isCheckingInvoice, setIsCheckingInvoice] = useState(false);
    const [isFixedAmount, setIsFixedAmount] = useState(false);
    const [transactionError, setTransactionError] = useState<string | null>(null);

    const [depositAmount, setDepositAmount] = useState('1000');
    const [depositInvoice, setDepositInvoice] = useState('');
    const [depositQuote, setDepositQuote] = useState('');
    const [depositSuccess, setDepositSuccess] = useState(false);

    const [successMode, setSuccessMode] = useState<'sent' | 'received' | null>(null);

    const [newMintUrl, setNewMintUrl] = useState('');
    const [newMintName, setNewMintName] = useState('');
    const [localNwcString, setLocalNwcString] = useState(nwcString);
    const [showNwcError, setShowNwcError] = useState(false);
    const [isWiggling, setIsWiggling] = useState(false);
    const [helpModal, setHelpModal] = useState<{ isOpen: boolean, title: string, text: string } | null>(null);

    // Scanner Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const safeMints = Array.isArray(mints) ? mints : [];
    const activeMint = safeMints.find(m => m.isActive) || safeMints[0];
    const receiveAddress = userProfile.lud16 || getMagicLightningAddress(currentUserPubkey);

    // Reset state when entering main view and verify balance
    useEffect(() => {
        if (view === 'main') {
            setDepositSuccess(false);
            setDepositQuote('');
            setDepositInvoice('');
            setSendInput('');
            setSendAmount('');
            setIsProcessing(false);
            setQuoteFee(null);
            setInsufficientFunds(false);
            setIsFixedAmount(false);
            setSuccessMode(null);
            setTransactionError(null);
            if (pollingRef.current) clearInterval(pollingRef.current);

            // Auto-verify wallet balance when entering main wallet screen
            refreshWalletBalance();
        }
        if (view === 'settings') {
            setLocalNwcString(nwcString);
        }
    }, [view, nwcString]);

    // Auto-Polling for Deposit Confirmation
    useEffect(() => {
        if (view === 'deposit' && depositQuote && !depositSuccess) {
            const startTime = Date.now();
            const THIRTY_SECONDS = 30 * 1000;
            const TWO_MINUTES = 2 * 60 * 1000;
            let timeoutId: NodeJS.Timeout;

            const poll = async () => {
                const isPaid = await checkDepositStatus(depositQuote);
                if (isPaid) {
                    const amount = parseInt(depositAmount);
                    const success = await confirmDeposit(depositQuote, amount);
                    if (success) {
                        setDepositSuccess(true);
                        setSuccessMode('deposit');
                    }
                    return; // Stop polling
                }

                // Tiered polling: 2s → 3s → 5s
                const elapsed = Date.now() - startTime;
                let delay;
                if (elapsed < THIRTY_SECONDS) {
                    delay = 2000; // First 30s: Very aggressive
                } else if (elapsed < TWO_MINUTES) {
                    delay = 3000; // 30s-2min: Moderate
                } else {
                    delay = 5000; // After 2min: Lighter
                }

                timeoutId = setTimeout(poll, delay);
            };

            // Start polling immediately
            poll();

            return () => {
                if (timeoutId) clearTimeout(timeoutId);
            };
        }
    }, [view, depositQuote, depositSuccess, depositAmount, checkDepositStatus, confirmDeposit]);

    // Auto-Populate Invoice Details
    useEffect(() => {
        if (view !== 'send-details') return;
        if (!sendInput) {
            setQuoteFee(null);
            setInsufficientFunds(false);
            setIsFixedAmount(false);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            const input = sendInput.trim();

            if (input.toLowerCase().startsWith('lnbc')) {
                setIsCheckingInvoice(true);
                setTransactionError(null);
                try {
                    const { amount, fee } = await getLightningQuote(input);
                    setSendAmount(amount.toString());
                    setQuoteFee(fee);
                    setIsFixedAmount(true);

                    if (walletBalance < (amount + fee)) {
                        setInsufficientFunds(true);
                    } else {
                        setInsufficientFunds(false);
                    }
                } catch (e) {
                    console.error("Failed to check invoice", e);
                    setQuoteFee(null);
                    setIsFixedAmount(false);
                } finally {
                    setIsCheckingInvoice(false);
                }
            } else {
                setQuoteFee(null);
                setIsFixedAmount(false);
                setInsufficientFunds(false);
            }
        }, 700);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [sendInput, walletBalance, getLightningQuote]);

    // Listen for "Pop to Root" navigation event
    useEffect(() => {
        const handlePopToRoot = (e: CustomEvent) => {
            if (e.detail.path === '/wallet') {
                setView('main');
            }
        };

        window.addEventListener('popToRoot', handlePopToRoot as EventListener);
        return () => window.removeEventListener('popToRoot', handlePopToRoot as EventListener);
    }, []);

    // Removed: Old payment event listener - now handled globally by App.tsx with LightningStrike


    // Camera & Scanning Logic
    const { isCameraLoading, cameraError, scannedData, logs, restart } = useQrScanner({
        videoRef,
        canvasRef,
        active: view === 'send-scan',
        onScan: (data) => {
            let cleanData = data;
            if (cleanData.toLowerCase().startsWith('lightning:')) {
                cleanData = cleanData.substring(10);
            }

            if (cleanData.startsWith('cashuA')) {
                const confirmReceive = window.confirm("This looks like an eCash token. Do you want to receive (claim) it?");
                if (confirmReceive) {
                    handleReceiveToken(cleanData);
                    return;
                }
            }
            setSendInput(cleanData);
            setView('send-details');
        }
    });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // @ts-ignore
            const jsQRModule = await import('jsqr');
            const jsQR = jsQRModule.default;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

                        if (code) {
                            let data = code.data;
                            if (data.toLowerCase().startsWith('lightning:')) data = data.substring(10);
                            if (data.startsWith('cashuA')) {
                                await handleReceiveToken(data);
                            } else {
                                setSendInput(data);
                                setView('send-details');
                            }
                        } else {
                            alert("No QR code found in image.");
                        }
                    }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        } catch (e) {
            alert("Failed to load QR scanner module.");
        }
    };

    const handleReceiveToken = async (token: string) => {
        const success = await receiveEcash(token);
        if (success) {
            setSuccessMode('received');
        } else {
            alert("Failed to claim eCash token.");
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const resolveLightningAddress = async (address: string, amountSats: number): Promise<string | null> => {
        try {
            const [user, domain] = address.split('@');
            if (!user || !domain) return null;

            const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
            const data = await res.json();

            if (data.callback) {
                const millisats = amountSats * 1000;
                if (millisats < data.minSendable || millisats > data.maxSendable) {
                    alert(`Amount must be between ${(data.minSendable / 1000).toLocaleString()} and ${(data.maxSendable / 1000).toLocaleString()} sats`);
                    return null;
                }
                const callbackUrl = `${data.callback}${data.callback.includes('?') ? '&' : '?'}amount=${millisats}`;
                const invoiceRes = await fetch(callbackUrl);
                const invoiceData = await invoiceRes.json();
                return invoiceData.pr;
            }
        } catch (e) {
            console.error("LN Address resolution failed", e);
        }
        return null;
    };

    const handleSend = async () => {
        const amount = parseInt(sendAmount);
        let targetInvoice = sendInput.trim();
        setTransactionError(null);

        if (!targetInvoice) {
            setTransactionError("Missing invoice or address");
            return;
        }

        if (targetInvoice.startsWith('cashuA')) {
            if (window.confirm("This looks like an eCash token. Do you want to Receive (Claim) it instead?")) {
                await handleReceiveToken(targetInvoice);
                return;
            }
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            if (targetInvoice.includes('@')) {
                setTransactionError("Please enter a valid amount");
                return;
            }
        }

        setIsProcessing(true);

        try {
            if (targetInvoice.includes('@') && !targetInvoice.startsWith('lnbc')) {
                const resolvedInvoice = await resolveLightningAddress(targetInvoice, amount);
                if (!resolvedInvoice) {
                    setTransactionError("Could not resolve Lightning Address. Please check validity.");
                    setIsProcessing(false);
                    return;
                }
                targetInvoice = resolvedInvoice;
            }

            const success = await sendFunds(amount, targetInvoice);
            if (success) {
                setSuccessMode('sent');
            } else {
                setTransactionError("Transaction Failed. Check your balance or mint connection.");
            }
        } catch (e) {
            console.error(e);
            setTransactionError("An error occurred during payment. Details: " + (e instanceof Error ? e.message : 'Unknown'));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateInvoice = async () => {
        const amount = parseInt(depositAmount);
        if (isNaN(amount) || amount < 10) {
            alert("Minimum amount 10 sats");
            return;
        }
        try {
            const { request, quote } = await depositFunds(amount);
            setDepositInvoice(request);
            setDepositQuote(quote);
        } catch (e) {
            alert("Failed to create invoice: " + (e instanceof Error ? e.message : "Unknown error"));
        }
    };

    const handleAddMint = () => {
        if (newMintUrl && newMintName) {
            addMint(newMintUrl, newMintName);
            setNewMintUrl('');
            setNewMintName('');
        }
    };

    const handleTestBridge = async () => {
        if (!currentUserPubkey) return;
        // Mock Token (Base64 encoded JSON)
        const mockToken = "cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vbWludC5taW5pYml0cy5jYXNoL0JpdGNvaW4iLCJwcm9vZnMiOlt7ImlkIjoiMDBiMjRjOGQ4OCIsImFtb3VudCI6MSwic2VjcmV0IjoiZTE4YmU5OGEwY2EwZThhMDc0YmU5OGEwY2EwZThhMDc0YmU5OGEwY2EwZThhMDc0YmU5OGEwY2EwZThhMDc0IiwiQyI6IjAyZTE4YmU5OGEwY2EwZThhMDc0YmU5OGEwY2EwZThhMDc0YmU5OGEwY2EwZThhMDc0YmU5OGEwY2EwZThhMDc0In1dfV19";

        try {
            await sendGiftWrap(currentUserPubkey, `Payment received! ${mockToken}`);
            alert("Simulated Bridge Payment Sent! Watch for 'Auto-redeemed' or 'Failed to redeem' in logs.");
        } catch (e) {
            alert("Failed to send simulation: " + e);
        }
    };

    // Pull-to-Refresh Handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current === null || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const distance = currentY - touchStartY.current;

        if (distance > 0 && scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
            e.preventDefault();
            setIsPulling(true);
            setPullDistance(Math.min(distance, 100)); // Max 100px
        }
    };

    const handleTouchEnd = async () => {
        if (pullDistance > 60 && !isRefreshing) {
            setIsRefreshing(true);
            try {
                await refreshWalletBalance();
                // Show brief success feedback
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                    setIsPulling(false);
                }, 500);
            } catch (e) {
                console.error("Refresh failed", e);
                setIsRefreshing(false);
                setPullDistance(0);
                setIsPulling(false);
            }
        } else {
            setPullDistance(0);
            setIsPulling(false);
        }
        touchStartY.current = null;
    };

    // --- Success Overlay Renders ---

    if (depositSuccess) {
        return (
            <div className="h-full p-6 relative">
                <SuccessOverlay
                    message="Deposit Confirmed!"
                    subMessage="Tokens minted successfully."
                    type="deposit"
                    onClose={() => setView('main')}
                />
            </div>
        );
    }

    if (successMode === 'sent') {
        return (
            <div className="h-full p-6 relative">
                <SuccessOverlay
                    message="Payment Sent!"
                    type="sent"
                    onClose={() => setView('main')}
                />
            </div>
        );
    }

    if (successMode === 'received') {
        return (
            <div className="h-full p-6 relative">
                <SuccessOverlay
                    message="Payment Received!"
                    subMessage="Your balance has been updated"
                    type="received"
                    onClose={() => setView('main')}
                />
            </div>
        );
    }

    // --- Sub-Views ---

    if (view === 'settings') {
        return (
            <div className="p-6 h-full flex flex-col overflow-y-auto pb-24">
                <div className="flex items-center mb-6">
                    <button
                        onClick={() => {
                            // User can always go back - no more blocking for NWC setup
                            setView('main');
                        }}
                        className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700"
                    >
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Wallet Settings</h2>
                </div>

                {/* Wallet Mode Selection */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Active Wallet Provider</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {/* Breez Wallet */}
                        <button
                            onClick={() => setWalletMode('breez')}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${walletMode === 'breez' ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'}`}
                        >
                            <Icons.Zap size={20} className={`mb-1 ${walletMode === 'breez' ? 'text-blue-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-sm mb-0.5">Breez</span>
                            <span className="text-[10px] text-center text-slate-400 leading-tight">Lightning</span>
                        </button>
                        {/* Cashu Wallet */}
                        <button
                            onClick={() => setWalletMode('cashu')}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${walletMode === 'cashu' ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'}`}
                        >
                            <Icons.Cashew size={20} className={`mb-1 ${walletMode === 'cashu' ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-sm mb-0.5">Cashu</span>
                            <span className="text-[10px] text-center text-slate-400 leading-tight">eCash</span>
                        </button>
                        {/* NWC Wallet */}
                        <button
                            onClick={() => setWalletMode('nwc')}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${walletMode === 'nwc' ? 'bg-purple-500/20 border-purple-500' : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'}`}
                        >
                            <Icons.Link size={20} className={`mb-1 ${walletMode === 'nwc' ? 'text-purple-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-sm mb-0.5">NWC</span>
                            <span className="text-[10px] text-center text-slate-400 leading-tight">Connect</span>
                        </button>
                    </div>
                    {showNwcError && walletMode === 'nwc' && !nwcString && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center animate-in fade-in slide-in-from-top-2">
                            <Icons.Close className="text-red-500 mr-2" size={16} />
                            <p className="text-xs text-red-400 font-bold">
                                Please save a connection or switch to another wallet.
                            </p>
                        </div>
                    )}
                </div>

                {/* Quick Scan Default Wallet */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Quick Scan Default</h3>
                    <p className="text-xs text-slate-500 mb-3">Choose which wallet to use when tapping the QR scan button</p>
                    <div className="grid grid-cols-4 gap-2">
                        {/* Auto (Smart Selection) */}
                        <button
                            onClick={() => setDefaultQuickSendWallet('auto')}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                defaultQuickSendWallet === 'auto' 
                                    ? 'bg-orange-500/20 border-orange-500' 
                                    : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'
                            }`}
                        >
                            <Icons.Zap size={18} className={`mb-1 ${defaultQuickSendWallet === 'auto' ? 'text-orange-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-[10px]">Auto</span>
                        </button>
                        {/* NWC */}
                        <button
                            onClick={() => setDefaultQuickSendWallet('nwc')}
                            disabled={!nwcString}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                defaultQuickSendWallet === 'nwc' 
                                    ? 'bg-purple-500/20 border-purple-500' 
                                    : !nwcString 
                                        ? 'bg-slate-800/50 border-slate-700/50 opacity-30 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'
                            }`}
                        >
                            <Icons.Link size={18} className={`mb-1 ${defaultQuickSendWallet === 'nwc' ? 'text-purple-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-[10px]">NWC</span>
                        </button>
                        {/* Breez */}
                        <button
                            onClick={() => setDefaultQuickSendWallet('breez')}
                            disabled={!hasBreezWallet}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                defaultQuickSendWallet === 'breez' 
                                    ? 'bg-blue-500/20 border-blue-500' 
                                    : !hasBreezWallet 
                                        ? 'bg-slate-800/50 border-slate-700/50 opacity-30 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'
                            }`}
                        >
                            <Icons.Zap size={18} className={`mb-1 ${defaultQuickSendWallet === 'breez' ? 'text-blue-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-[10px]">Breez</span>
                        </button>
                        {/* Cashu */}
                        <button
                            onClick={() => setDefaultQuickSendWallet('cashu')}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                defaultQuickSendWallet === 'cashu' 
                                    ? 'bg-emerald-500/20 border-emerald-500' 
                                    : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'
                            }`}
                        >
                            <Icons.Cashew size={18} className={`mb-1 ${defaultQuickSendWallet === 'cashu' ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-[10px]">Cashu</span>
                        </button>
                    </div>
                    {defaultQuickSendWallet === 'auto' && (
                        <p className="text-[10px] text-slate-500 mt-2 text-center">
                            Auto mode prioritizes: NWC → Breez → Cashu (based on available balance)
                        </p>
                    )}
                </div>

                {/* Breez Wallet Settings */}
                {walletMode === 'breez' && (
                    <div className="mb-8 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Lightning Wallet</h3>
                        
                        {/* Create Wallet Prompt (for non-mnemonic users without Breez wallet) */}
                        {!hasBreezWallet ? (
                            <div className="bg-gradient-to-br from-blue-500/10 via-slate-900 to-blue-500/5 border border-blue-500/30 p-6 rounded-xl">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 relative">
                                        <Icons.Zap size={40} className="text-blue-400" />
                                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border-2 border-blue-500/30">
                                            <Icons.Plus size={16} className="text-blue-400" />
                                        </div>
                                    </div>
                                    
                                    <h4 className="text-xl font-bold text-white mb-2">Create Lightning Wallet</h4>
                                    <p className="text-slate-400 text-sm mb-4 max-w-xs">
                                        Set up your self-custodial Lightning wallet powered by Breez SDK.
                                    </p>
                                    
                                    {/* Warning for non-mnemonic users */}
                                    {authSource !== 'mnemonic' && (
                                        <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                                            <p className="text-xs text-amber-400">
                                                <span className="font-bold">⚠️ Note:</span> This will create a <strong>separate</strong> 12-word backup phrase for your Bitcoin wallet. You'll need to backup both your Nostr key and this new phrase.
                                            </p>
                                        </div>
                                    )}
                                    
                                    <button
                                        onClick={async () => {
                                            setIsCreatingBreezWallet(true);
                                            try {
                                                // Generate new mnemonic for Breez
                                                const newMnemonic = generateMnemonic();
                                                // Store it as Breez-specific mnemonic
                                                storeMnemonicEncrypted(newMnemonic, currentUserPubkey, true);
                                                setBreezMnemonic(newMnemonic);
                                                setHasBreezWallet(true);
                                                setShowBreezSetup(true);
                                            } catch (e) {
                                                console.error('Failed to create Breez wallet:', e);
                                            }
                                            setIsCreatingBreezWallet(false);
                                        }}
                                        disabled={isCreatingBreezWallet}
                                        className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isCreatingBreezWallet ? 'Creating...' : 'Create Wallet'}
                                    </button>
                                    
                                    {/* Alternative: Unified backup suggestion */}
                                    {authSource !== 'mnemonic' && (
                                        <div className="mt-4 pt-4 border-t border-white/10 w-full">
                                            <p className="text-xs text-slate-500 text-center">
                                                💡 Want one backup for everything? Create a new profile with a unified seed phrase on the Profile tab.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Breez Wallet Created - Show Status & Backup */}
                                <div className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-xl">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                            <Icons.Zap size={24} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold">Breez SDK</h4>
                                            <p className="text-slate-400 text-xs">Non-custodial Lightning</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Lightning Address</label>
                                            <p className="text-sm text-white font-mono">Coming soon...</p>
                                        </div>
                                        
                                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Node Status</label>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                                <p className="text-sm text-amber-400">Pending Setup</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                        <p className="text-xs text-amber-400">
                                            <span className="font-bold">Coming Soon:</span> Breez SDK integration is in progress. Your self-custodial Lightning wallet will be available here.
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Breez Wallet Backup Section - Only for separate Breez mnemonic (non-unified users) */}
                                {!hasUnifiedSeed() && hasStoredMnemonic(true) && (
                                    <div className="mt-4 bg-gradient-to-br from-blue-500/10 via-slate-900 to-orange-500/5 border border-blue-500/30 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                                    <Icons.Key size={14} className="text-orange-400" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-orange-400 uppercase tracking-wider">Wallet Backup Phrase</label>
                                                    <p className="text-[10px] text-slate-500">For Breez Lightning Wallet only</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (!showBreezMnemonic) {
                                                        const stored = retrieveMnemonicEncrypted(currentUserPubkey, true);
                                                        setBreezMnemonic(stored);
                                                    }
                                                    setShowBreezMnemonic(!showBreezMnemonic);
                                                }}
                                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors"
                                            >
                                                {showBreezMnemonic ? 'Hide' : 'Show'}
                                            </button>
                                        </div>
                                        
                                        {showBreezMnemonic && breezMnemonic ? (
                                            <>
                                                <div className="grid grid-cols-3 gap-2 mb-3">
                                                    {breezMnemonic.split(' ').map((word, index) => (
                                                        <div key={index} className="bg-slate-800/80 border border-white/10 rounded-lg p-2 text-center">
                                                            <span className="text-[10px] text-slate-500 block">{index + 1}</span>
                                                            <span className="text-xs text-white font-mono">{word}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(breezMnemonic);
                                                        }}
                                                        className="flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                                                    >
                                                        <Icons.Copy size={12} />
                                                        <span>Copy</span>
                                                    </button>
                                                    <button
                                                        onClick={() => downloadWalletCardPDF(breezMnemonic)}
                                                        className="flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
                                                    >
                                                        <Icons.Download size={12} />
                                                        <span>Save PDF</span>
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-slate-500">
                                                This is a separate backup from your Nostr identity. Keep both backups safe!
                                            </p>
                                        )}
                                        
                                        {/* Warning that this is separate from Nostr */}
                                        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                            <p className="text-[10px] text-amber-400">
                                                <strong>⚠️ Separate Backup:</strong> This phrase only backs up your Breez wallet, not your Nostr identity. You also need your nsec for your profile.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* NWC Settings */}
                {walletMode === 'nwc' && (
                    <div className="mb-8 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">NWC Connection</h3>

                        {nwcString ? (
                            <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
                                    <Icons.CheckMark size={32} className="text-white" strokeWidth={4} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">Wallet Connected</h3>
                                <p className="text-slate-400 text-sm mb-6 max-w-xs">
                                    Your Lightning wallet is successfully connected via NWC.
                                </p>

                                <div className="w-full bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-6 text-xs font-mono text-slate-500 break-all">
                                    {nwcString.substring(0, 20)}...{nwcString.substring(nwcString.length - 20)}
                                </div>

                                <Button
                                    variant="secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm("Are you sure you want to disconnect? This will remove the connection string.")) {
                                            setNwcConnection('');
                                            setLocalNwcString('');
                                            setWalletMode('cashu');
                                        }
                                    }}
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                >
                                    Disconnect Wallet
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 transition-all duration-200">
                                <label className="block text-xs mb-2 text-slate-500">
                                    Connection String (nostr+walletconnect://...)
                                </label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-xs font-mono h-24 focus:ring-2 focus:ring-purple-500 outline-none resize-none mb-3"
                                    placeholder="nostr+walletconnect://..."
                                    value={localNwcString}
                                    onChange={e => setLocalNwcString(e.target.value)}
                                />
                                    <Button
                                    fullWidth
                                        onClick={async () => {
                                            if (!localNwcString) return;
                                            setIsProcessing(true);
                                            try {
                                                // Dynamic import to avoid circular deps or large bundles if not needed elsewhere
                                                const { NWCService } = await import('../services/nwcService');
                                                const tempService = new NWCService(localNwcString);

                                                // Test connection by fetching balance
                                                await tempService.getBalance();

                                                // If successful, save to context
                                                setNwcConnection(localNwcString);
                                                // Success UI is handled by re-render with nwcString present
                                            } catch (e) {
                                                alert("Connection Failed: " + (e instanceof Error ? e.message : "Unknown error"));
                                            } finally {
                                                setIsProcessing(false);
                                            }
                                        }}
                                        disabled={!localNwcString || isProcessing}
                                    >
                                        {isProcessing ? 'Verifying...' : 'Save Connection'}
                                    </Button>
                                <p className="text-xs text-slate-400 mt-3">
                                    Get your NWC connection string from{' '}
                                    <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Alby</a>,{' '}
                                    <a href="https://zeusln.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Zeus</a>, or{' '}
                                    <a href="https://primal.net" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Primal</a>.
                                    <br /><span className="text-slate-500">Stored locally on your device.</span>
                                </p>
                            </div>
                        )}
                        
                        {/* NWC Explanation */}
                        <div className="mt-6 bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                            <h4 className="text-sm font-bold text-purple-400 mb-2">What is NWC?</h4>
                            <p className="text-xs text-slate-400 leading-relaxed mb-3">
                                <strong className="text-slate-300">Nostr Wallet Connect</strong> is a protocol that lets this app communicate securely with your existing <strong className="text-slate-300">external</strong> Lightning wallet. Think of it like connecting your bank account to Venmo — your funds stay in your wallet, and this app just sends payment requests.
                            </p>
                            
                            <h4 className="text-sm font-bold text-purple-400 mb-2">Why use NWC?</h4>
                            <ul className="text-xs text-slate-400 space-y-1.5 mb-3">
                                <li className="flex items-start space-x-2">
                                    <span className="text-purple-400">•</span>
                                    <span><strong className="text-slate-300">Use your existing wallet</strong> — No need to manage another balance</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="text-purple-400">•</span>
                                    <span><strong className="text-slate-300">Full control</strong> — Your keys and funds never leave your wallet</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="text-purple-400">•</span>
                                    <span><strong className="text-slate-300">One balance</strong> — See your disc golf funds in your main wallet</span>
                                </li>
                            </ul>
                            
                            <div className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-xs text-slate-500">
                                    <strong className="text-slate-400">Best for:</strong> Experienced Lightning users who already have Alby, Zeus, Phoenix, or another NWC-compatible wallet set up.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {walletMode === 'cashu' && (
                    <div className="animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Manage Mints</h3>
                        <div className="space-y-4 mb-6">
                            {safeMints.map(mint => (
                                <div
                                    key={mint.url}
                                    onClick={() => setActiveMint(mint.url)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${mint.isActive ? 'bg-brand-primary/10 border-brand-primary' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-white">{mint.nickname}</span>
                                            {mint.isActive && <Icons.CheckMark size={14} className="text-brand-primary" />}
                                        </div>
                                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{mint.url}</div>
                                    </div>
                                    {!mint.isActive && (
                                        <button onClick={(e) => { e.stopPropagation(); removeMint(mint.url); }} className="p-2 text-red-400 hover:bg-red-900/20 rounded">
                                            <Icons.Trash size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold mb-3">Add New Mint</h3>
                            <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 mb-2 text-sm" placeholder="Mint Nickname" value={newMintName} onChange={e => setNewMintName(e.target.value)} />
                            <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 mb-3 text-sm" placeholder="Mint URL" value={newMintUrl} onChange={e => setNewMintUrl(e.target.value)} />
                            <Button fullWidth onClick={handleAddMint} disabled={!newMintName || !newMintUrl}>Add Mint</Button>
                        </div>


                        {/* Feedback Button */}
                        <FeedbackButton onClick={() => setShowFeedbackModal(true)} />
                    </div>
                )
                }

                {/* Feedback Modal */}
                <FeedbackModal
                    isOpen={showFeedbackModal}
                    onClose={() => setShowFeedbackModal(false)}
                />
            </div >
        );
    }

    if (view === 'deposit') {
        return (
            <div className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                    <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                        <Icons.Prev />
                    </button>
                    <div className="flex items-center justify-center space-x-2">
                        <h2 className="text-xl font-bold">Create Invoice</h2>
                        <button
                            onClick={() => setHelpModal({
                                isOpen: true,
                                title: "Lightning Invoice",
                                text: `
                                    <p class="mb-3">An invoice is a <strong>one-time payment request</strong> for a specific amount.</p>
                                    
                                    <p class="font-bold text-white mb-2">📋 When to use:</p>
                                    <ul class="list-disc ml-5 mb-4 space-y-1">
                                        <li>Requesting an exact amount from someone</li>
                                        <li>Getting paid for something specific</li>
                                        <li>When you need proof of payment</li>
                                    </ul>
                                    
                                    <p class="font-bold text-white mb-2">⚠️ Important:</p>
                                    <ul class="list-disc ml-5 mb-4 space-y-1 text-amber-400">
                                        <li>Invoices <strong>expire</strong> after ~10 minutes</li>
                                        <li>Can only be paid <strong>once</strong></li>
                                        <li>Must be paid for the <strong>exact amount</strong></li>
                                    </ul>
                                    
                                    <div class="bg-slate-800 rounded-lg p-3">
                                        <p class="text-xs text-slate-300">💡 <strong>Tip:</strong> For general receiving, use your Lightning Address instead—it never expires!</p>
                                    </div>
                                `
                            })}
                            className="text-slate-500 hover:text-brand-primary transition-colors"
                        >
                            <Icons.Help size={18} />
                        </button>
                    </div>
                    </div>
                    {/* Gear icon to change default receive wallet */}
                    {defaultReceiveWallet && (
                        <button 
                            onClick={() => setShowWalletSelectionModal('receive')}
                            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                            title="Change default receive wallet"
                        >
                            <Icons.Settings size={18} className="text-slate-400" />
                        </button>
                    )}
                </div>

                {!depositInvoice ? (
                    <div className="space-y-4">
                        <p className="text-slate-400 text-sm">Generate a request for a specific amount.</p>
                        <label className="block text-sm font-bold text-slate-500">Amount</label>
                        <input
                            type="number"
                            value={depositAmount}
                            onChange={e => setDepositAmount(e.target.value)}
                            className="w-full bg-slate-800 p-4 rounded-xl text-2xl font-mono text-white border border-slate-600"
                        />
                        <Button fullWidth onClick={handleCreateInvoice}>Generate Invoice</Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-4 animate-in fade-in relative">
                        <h3 className="text-lg font-bold text-white">Pay this Invoice</h3>
                        <div className="bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 p-1 rounded-2xl shadow-2xl shadow-purple-500/20">
                            <div className="bg-white p-3 rounded-xl">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(depositInvoice)}`}
                                    alt="Deposit Invoice"
                                    className="w-48 h-48"
                                    loading="eager"
                                />
                            </div>
                        </div>
                        <div className="w-full bg-slate-800 p-3 rounded text-xs font-mono text-slate-400 break-all">
                            {depositInvoice.substring(0, 30)}...
                        </div>
                        <Button fullWidth onClick={() => handleCopy(depositInvoice)} variant="secondary">Copy Invoice</Button>

                        <div className="flex items-center space-x-2 text-brand-primary animate-pulse">
                            <Icons.Zap size={18} />
                            <span className="text-sm font-bold">Waiting for payment...</span>
                        </div>
                    </div>
                )}

                {helpModal && <HelpModal isOpen={helpModal.isOpen} title={helpModal.title} text={helpModal.text} onClose={() => setHelpModal(null)} onAction={(action) => { 
                if (action === 'lightning-explainer') { setHelpModal(null); setReturnToWalletHelp(false); setShowLightningExplainer(true); }
            }} />}
            </div>
        );
    }

    if (view === 'receive') {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiveAddress)}&bgcolor=ffffff&color=000000&margin=2`;

        // Breez wallet receive view
        if (walletMode === 'breez') {
            // If no Breez wallet, show Create Wallet prompt
            if (!hasBreezWallet) {
                return (
                    <div className="p-6 h-full flex flex-col">
                        <div className="w-full flex justify-start mb-6">
                            <button onClick={() => setView('main')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                                <Icons.Prev />
                            </button>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                            <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 relative">
                                <Icons.Zap size={48} className="text-blue-400" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border-2 border-blue-500/30">
                                    <Icons.Plus size={20} className="text-blue-400" />
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-bold text-white mb-3">Create Lightning Wallet</h2>
                            <p className="text-slate-400 text-sm mb-6">
                                Set up your self-custodial Lightning wallet to receive payments.
                            </p>
                            
                            {authSource !== 'mnemonic' && (
                                <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
                                    <p className="text-xs text-amber-400">
                                        <span className="font-bold">⚠️ Note:</span> This creates a <strong>separate</strong> 12-word backup for your Bitcoin wallet.
                                    </p>
                                </div>
                            )}
                            
                            <button
                                onClick={async () => {
                                    setIsCreatingBreezWallet(true);
                                    try {
                                        const newMnemonic = generateMnemonic();
                                        storeMnemonicEncrypted(newMnemonic, currentUserPubkey, true);
                                        setBreezMnemonic(newMnemonic);
                                        setHasBreezWallet(true);
                                        setShowBreezSetup(true);
                                        setView('settings'); // Go to settings to show backup
                                    } catch (e) {
                                        console.error('Failed to create Breez wallet:', e);
                                    }
                                    setIsCreatingBreezWallet(false);
                                }}
                                disabled={isCreatingBreezWallet}
                                className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 mb-4"
                            >
                                {isCreatingBreezWallet ? 'Creating...' : 'Create Wallet'}
                            </button>
                            
                            <Button 
                                fullWidth 
                                variant="secondary"
                                onClick={() => { setWalletMode('cashu'); }}
                            >
                                <Icons.Cashew size={18} className="mr-2 text-emerald-400" /> 
                                Use Cashu Instead
                            </Button>
                        </div>
                    </div>
                );
            }
            
            // Has wallet but still coming soon
            return (
                <div className="p-6 h-full flex flex-col items-center text-center">
                    <div className="w-full flex justify-start mb-6">
                        <button onClick={() => setView('main')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                            <Icons.Prev />
                        </button>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center max-w-xs">
                        <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center mb-6">
                            <Icons.Zap size={48} className="text-blue-400" />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-white mb-3">Breez Wallet</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            Self-custodial Lightning receiving is coming soon! We're finishing up the integration.
                        </p>
                        
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 w-full mb-6">
                            <div className="flex items-center space-x-3 mb-2">
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                                <span className="text-amber-400 text-sm font-bold">Coming Soon</span>
                            </div>
                            <p className="text-slate-400 text-xs">
                                Your Breez Lightning address will appear here once setup is complete. Until then, you can use Cashu or NWC to receive.
                            </p>
                        </div>
                        
                        <Button 
                            fullWidth 
                            variant="secondary"
                            onClick={() => { setWalletMode('cashu'); setView('receive'); }}
                        >
                            <Icons.Cashew size={18} className="mr-2 text-emerald-400" /> 
                            Use Cashu Instead
                        </Button>
                    </div>
                </div>
            );
        }
        
        // NWC wallet receive view - if not connected, go directly to settings
        if (walletMode === 'nwc' && !nwcString) {
            // Redirect to settings immediately
            setView('settings');
            return null;
        }

        // Cashu (and connected NWC) receive view - shows npub.cash address
        return (
            <div className="p-6 h-full flex flex-col items-center text-center">
                <div className="w-full flex justify-between mb-6">
                    <button onClick={() => setView('main')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                        <Icons.Prev />
                    </button>
                    {/* Gear icon to change default receive wallet */}
                    {defaultReceiveWallet && (
                        <button 
                            onClick={() => setShowWalletSelectionModal('receive')}
                            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                            title="Change default receive wallet"
                        >
                            <Icons.Settings size={18} className="text-slate-400" />
                        </button>
                    )}
                </div>
                <div className="flex items-center justify-center space-x-2 mb-2">
                    <h2 className="text-2xl font-bold">
                        {walletMode === 'nwc' ? 'Receive via NWC' : 'Lightning Address'}
                    </h2>
                    <button
                        onClick={() => setHelpModal({
                            isOpen: true,
                            title: walletMode === 'nwc' ? "NWC Receiving" : "Lightning Address",
                            text: walletMode === 'nwc' 
                                ? `
                                    <p class="mb-3">Funds sent to this address will be routed to your <strong>connected NWC wallet</strong>.</p>
                                    
                                    <p class="font-bold text-white mb-2">📱 How it works:</p>
                                    <ol class="list-decimal ml-5 mb-4 space-y-1">
                                        <li>Someone sends to your Lightning address</li>
                                        <li>The payment arrives in your connected wallet</li>
                                        <li>You see the balance in your external app</li>
                                    </ol>
                                `
                                : `
                                <p class="mb-3">Think of this like your <strong>email address for money</strong>. It's permanent and reusable!</p>
                                
                                <p class="font-bold text-white mb-2">✅ You can:</p>
                                <ul class="list-disc ml-5 mb-4 space-y-1">
                                    <li>Share it with anyone to receive payments</li>
                                    <li>Post it on social media</li>
                                    <li>Use the same address forever</li>
                                </ul>
                                
                                <p class="font-bold text-white mb-2">📱 How others pay you:</p>
                                <ol class="list-decimal ml-5 mb-4 space-y-1">
                                    <li>They scan your QR code or copy your address</li>
                                    <li>Enter the amount to send</li>
                                    <li>You receive sats instantly!</li>
                                </ol>
                                
                                <div class="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-3">
                                    <p class="text-xs text-slate-300">💡 <strong>Tip:</strong> Unlike an invoice, your Lightning Address never expires. Share it freely!</p>
                                </div>
                            `
                        })}
                        className="text-slate-500 hover:text-brand-primary transition-colors"
                    >
                        <Icons.Help size={20} />
                    </button>
                </div>
                <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                    {walletMode === 'nwc' 
                        ? 'Payments will be routed to your connected wallet.'
                        : 'Your permanent address for receiving payments. Share it like a username.'}
                </p>

                <div className={`p-1 rounded-2xl shadow-2xl mb-6 ${
                    walletMode === 'nwc' 
                        ? 'bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 shadow-purple-500/20'
                        : 'bg-gradient-to-br from-cyan-400 via-emerald-500 to-teal-600 shadow-emerald-500/20'
                }`}>
                    <div className="bg-white p-3 rounded-xl">
                        <img src={qrUrl} alt="Wallet QR Code" className="w-48 h-48" loading="eager" />
                    </div>
                </div>

                <div className="w-full max-w-xs mb-6">
                    <button
                        onClick={() => handleCopy(receiveAddress)}
                        className="w-full flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-brand-primary transition-all group"
                    >
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <div className={`p-2 rounded-lg ${
                                walletMode === 'nwc' ? 'bg-purple-500/10' : 'bg-emerald-500/10'
                            }`}>
                                {walletMode === 'nwc' 
                                    ? <Icons.Link size={18} className="text-purple-400" />
                                    : <Icons.Cashew size={18} className="text-emerald-400" />}
                            </div>
                            <div className="flex flex-col items-start overflow-hidden">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Your Address</span>
                                <span className="text-sm text-white font-mono truncate w-full text-left">
                                    {receiveAddress.length > 25
                                        ? receiveAddress.substring(0, 12) + '...' + receiveAddress.substring(receiveAddress.length - 12)
                                        : receiveAddress}
                                </span>
                            </div>
                        </div>
                        <Icons.Copy size={18} className="text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    title: 'My Lightning Address',
                                    text: receiveAddress,
                                    url: `lightning:${receiveAddress}`
                                }).catch(console.error);
                            } else {
                                handleCopy(receiveAddress);
                            }
                        }}
                    >
                        <Icons.Share size={18} className="mr-2" /> Share
                    </Button>
                    <Button variant="secondary" onClick={() => setView('deposit')}>
                        <Icons.Plus size={18} className="mr-2" /> Invoice
                    </Button>
                </div>

                <div className="mt-6 w-full flex flex-col items-center space-y-4">
                    <div className={`flex items-center space-x-2 animate-pulse ${
                        walletMode === 'nwc' ? 'text-purple-400' : 'text-emerald-400'
                    }`}>
                        {walletMode === 'nwc' ? <Icons.Link size={18} /> : <Icons.Cashew size={18} />}
                        <span className="text-sm font-bold">Waiting for payment...</span>
                    </div>
                    
                    {/* Don't have Bitcoin link */}
                    <button 
                        onClick={() => setShowFundModal(true)}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Don't have Bitcoin yet? Learn how to buy
                    </button>
                </div>
                {helpModal && <HelpModal isOpen={helpModal.isOpen} title={helpModal.title} text={helpModal.text} onClose={() => setHelpModal(null)} onAction={(action) => { 
                if (action === 'lightning-explainer') { setHelpModal(null); setReturnToWalletHelp(false); setShowLightningExplainer(true); }
            }} />}
                
                {/* Fund Modal also available from receive view */}
                {showFundModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowFundModal(false)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-5 border-b border-slate-800">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                            <Icons.Bitcoin size={24} className="text-orange-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white">Getting Your First Sats</h3>
                                    </div>
                                    <button onClick={() => setShowFundModal(false)} className="text-slate-400 hover:text-white p-1">
                                        <Icons.Close size={20} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Content */}
                            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                    <p className="text-slate-300 text-sm leading-relaxed mb-3">
                                        <span className="text-white font-bold">Here's the deal:</span> The government has made it unnecessarily complicated to buy Bitcoin. 
                                        They'd prefer you keep your savings in dollars that lose value every year while they print trillions more.
                                    </p>
                                    <p className="text-slate-400 text-xs italic">
                                        Meanwhile, Bitcoin's supply is fixed forever. No one can print more. Ever. 
                                    </p>
                                </div>
                                
                                <p className="text-slate-300 text-sm">
                                    <span className="text-brand-primary font-bold">The good news?</span> These apps make it easy:
                                </p>
                                
                                <div className="space-y-2">
                                    <a href="https://cash.app" target="_blank" rel="noopener noreferrer" className="block p-3 bg-[#00D64F]/10 border border-[#00D64F]/30 rounded-lg hover:bg-[#00D64F]/20 transition-colors">
                                        <p className="font-bold text-[#00D64F] text-sm">Cash App <span className="text-xs text-slate-400 font-normal">• US & UK</span></p>
                                    </a>
                                    <a href="https://strike.me" target="_blank" rel="noopener noreferrer" className="block p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors">
                                        <p className="font-bold text-blue-400 text-sm">Strike <span className="text-xs text-slate-400 font-normal">• Americas</span></p>
                                    </a>
                                    <a href="https://relai.app" target="_blank" rel="noopener noreferrer" className="block p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-colors">
                                        <p className="font-bold text-orange-400 text-sm">Relai <span className="text-xs text-slate-400 font-normal">• Europe</span></p>
                                    </a>
                                    <a href="https://blink.sv" target="_blank" rel="noopener noreferrer" className="block p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors">
                                        <p className="font-bold text-purple-400 text-sm">Blink <span className="text-xs text-slate-400 font-normal">• Global</span></p>
                                    </a>
                                </div>
                                
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(receiveAddress);
                                        alert('Lightning Address copied!');
                                    }}
                                    className="w-full p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors flex items-center justify-center space-x-2"
                                >
                                    <Icons.Copy size={16} className="text-slate-400" />
                                    <span className="text-sm text-slate-300">Copy Your Address</span>
                                </button>
                            </div>
                            
                            <div className="p-4 border-t border-slate-800">
                                <Button fullWidth onClick={() => setShowFundModal(false)}>Got it</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'send-input') {
        const fileInput = (
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        );

        // Breez wallet send view
        if (walletMode === 'breez') {
            // If no Breez wallet, show Create Wallet prompt
            if (!hasBreezWallet) {
                return (
                    <div className="p-6 h-full flex flex-col">
                        <div className="w-full flex justify-start mb-6">
                            <button onClick={() => setView('main')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                                <Icons.Prev />
                            </button>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                            <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 relative">
                                <Icons.Send size={48} className="text-blue-400" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border-2 border-blue-500/30">
                                    <Icons.Plus size={20} className="text-blue-400" />
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-bold text-white mb-3">Create Lightning Wallet</h2>
                            <p className="text-slate-400 text-sm mb-6">
                                Set up your self-custodial Lightning wallet to send payments.
                            </p>
                            
                            {authSource !== 'mnemonic' && (
                                <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
                                    <p className="text-xs text-amber-400">
                                        <span className="font-bold">⚠️ Note:</span> This creates a <strong>separate</strong> 12-word backup for your Bitcoin wallet.
                                    </p>
                                </div>
                            )}
                            
                            <button
                                onClick={async () => {
                                    setIsCreatingBreezWallet(true);
                                    try {
                                        const newMnemonic = generateMnemonic();
                                        storeMnemonicEncrypted(newMnemonic, currentUserPubkey, true);
                                        setBreezMnemonic(newMnemonic);
                                        setHasBreezWallet(true);
                                        setShowBreezSetup(true);
                                        setView('settings'); // Go to settings to show backup
                                    } catch (e) {
                                        console.error('Failed to create Breez wallet:', e);
                                    }
                                    setIsCreatingBreezWallet(false);
                                }}
                                disabled={isCreatingBreezWallet}
                                className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 mb-4"
                            >
                                {isCreatingBreezWallet ? 'Creating...' : 'Create Wallet'}
                            </button>
                            
                            <Button 
                                fullWidth 
                                variant="secondary"
                                onClick={() => { setWalletMode('cashu'); }}
                            >
                                <Icons.Cashew size={18} className="mr-2 text-emerald-400" /> 
                                Use Cashu Instead
                            </Button>
                        </div>
                    </div>
                );
            }
            
            // Has wallet but still coming soon
            return (
                <div className="p-6 h-full flex flex-col items-center text-center">
                    <div className="w-full flex justify-start mb-6">
                        <button onClick={() => setView('main')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                            <Icons.Prev />
                        </button>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center max-w-xs">
                        <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center mb-6">
                            <Icons.Send size={48} className="text-blue-400" />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-white mb-3">Breez Wallet</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            Self-custodial Lightning sending is coming soon! We're finishing up the integration.
                        </p>
                        
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 w-full mb-6">
                            <div className="flex items-center space-x-3 mb-2">
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                                <span className="text-amber-400 text-sm font-bold">Coming Soon</span>
                            </div>
                            <p className="text-slate-400 text-xs">
                                Breez sending will be available once setup is complete. Until then, you can use Cashu or NWC to send.
                            </p>
                        </div>
                        
                        <Button 
                            fullWidth 
                            variant="secondary"
                            onClick={() => { setWalletMode('cashu'); }}
                        >
                            <Icons.Cashew size={18} className="mr-2 text-emerald-400" /> 
                            Use Cashu Instead
                        </Button>
                    </div>
                </div>
            );
        }
        
        // NWC wallet send view - if not connected, go directly to settings
        if (walletMode === 'nwc' && !nwcString) {
            // Redirect to settings immediately
            setView('settings');
            return null;
        }

        return (
            <div className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                    <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Choose Payment Method</h2>
                    </div>
                    {/* Gear icon to change default send wallet */}
                    {defaultSendWallet && (
                        <button 
                            onClick={() => setShowWalletSelectionModal('send')}
                            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                            title="Change default send wallet"
                        >
                            <Icons.Settings size={18} className="text-slate-400" />
                        </button>
                    )}
                </div>

                <p className="text-slate-400 text-sm mb-6">Select how you'd like to send your payment</p>

                <div className="grid grid-cols-2 gap-4 flex-1">
                    {/* Nostr Contacts */}
                    <button
                        onClick={async () => {
                            setView('send-contacts');
                            setIsLoadingContacts(true);
                            setContactsError(null);
                            try {
                                const { fetchContactList, lookupUser } = await import('../services/nostrService');
                                const pubkeys = await fetchContactList(currentUserPubkey);

                                // Fetch profile data for each contact
                                const contactProfiles = await Promise.all(
                                    pubkeys.slice(0, 50).map(async (pk) => {
                                        try {
                                            const profile = await lookupUser(pk);
                                            if (!profile) return { pubkey: pk };

                                            // lookupUser returns DisplayProfile which has nip05, not lud16
                                            // We'll store the lightning address separately
                                            const lightningAddr = profile.nip05 || undefined;

                                            return {
                                                pubkey: pk,
                                                name: profile.name,
                                                image: profile.image,
                                                lud16: lightningAddr
                                            };
                                        } catch {
                                            return { pubkey: pk };
                                        }
                                    })
                                );
                                setContacts(contactProfiles.filter(c => c !== null));
                            } catch (e) {
                                console.error('Failed to load contacts:', e);
                                setContactsError('Failed to load contacts. Please try again.');
                            } finally {
                                setIsLoadingContacts(false);
                            }
                        }}
                        className="flex flex-col items-center justify-center bg-brand-primary/10 hover:bg-brand-primary/20 border-2 border-brand-primary/40 rounded-2xl p-6 transition-all active:scale-95 group"
                    >
                        <div className="bg-brand-primary/20 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Icons.Users size={32} className="text-brand-primary" />
                        </div>
                        <span className="text-white font-bold text-sm mb-1">Nostr Contacts</span>
                        <span className="text-slate-400 text-xs text-center">Send to your followers</span>
                    </button>

                    {/* Paste Invoice/Address */}
                    <button
                        onClick={() => {
                            setSendInput('');
                            setView('send-details');
                        }}
                        className="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 rounded-2xl p-6 transition-all active:scale-95 group"
                    >
                        <div className="bg-slate-700/50 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Icons.Copy size={32} className="text-slate-300" />
                        </div>
                        <span className="text-white font-bold text-sm mb-1">Paste Manually</span>
                        <span className="text-slate-400 text-xs text-center">Invoice or address</span>
                    </button>

                    {/* Upload QR Image */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-2 border-purple-500/40 hover:border-purple-500/60 rounded-2xl p-6 transition-all active:scale-95 group"
                    >
                        <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Icons.QrCode size={32} className="text-purple-400" />
                        </div>
                        <span className="text-white font-bold text-sm mb-1">Upload QR Code</span>
                        <span className="text-slate-400 text-xs text-center">From your device</span>
                    </button>

                    {/* Scan with Camera */}
                    <button
                        onClick={() => setView('send-scan')}
                        className="flex flex-col items-center justify-center bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 hover:from-cyan-500/20 hover:to-emerald-500/20 border-2 border-cyan-500/40 hover:border-cyan-500/60 rounded-2xl p-6 transition-all active:scale-95 group"
                    >
                        <div className="bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Icons.Camera size={32} className="text-cyan-400" />
                        </div>
                        <span className="text-white font-bold text-sm mb-1">Scan QR Code</span>
                        <span className="text-slate-400 text-xs text-center">Use your camera</span>
                    </button>
                </div>

                {fileInput}
            </div>
        );
    }

    if (view === 'send-contacts') {
        return (
            <div className="p-6 h-full flex flex-col">
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('send-input')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Select Contact</h2>
                </div>

                {isLoadingContacts ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-slate-400">Loading your contacts...</p>
                    </div>
                ) : contactsError ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                            <Icons.Close size={32} className="text-red-500" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Error Loading Contacts</h3>
                        <p className="text-slate-400 text-sm mb-6 max-w-xs">{contactsError}</p>
                        <Button onClick={() => setView('send-input')}>Go Back</Button>
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Icons.Users size={32} className="text-slate-600" />
                        </div>
                        <h3 className="text-white font-bold mb-2">No Contacts Yet</h3>
                        <p className="text-slate-400 text-sm mb-6 max-w-xs">
                            Follow some people on Nostr to see them here!
                        </p>
                        <Button onClick={() => setView('send-input')}>Go Back</Button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2 no-scrollbar">
                            {contacts.map((contact) => (
                                <button
                                    key={contact.pubkey}
                                    onClick={() => {
                                        // Pre-fill send input with lightning address if available
                                        if (contact.lud16) {
                                            setSendInput(contact.lud16);
                                        } else {
                                            // Use magic lightning address
                                            const { getMagicLightningAddress } = require('../services/nostrService');
                                            setSendInput(getMagicLightningAddress(contact.pubkey));
                                        }
                                        setView('send-details');
                                    }}
                                    className="w-full flex items-center space-x-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-brand-primary/50 rounded-xl p-4 transition-all group"
                                >
                                    {contact.image ? (
                                        <img
                                            src={contact.image}
                                            alt={contact.name || 'Contact'}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 group-hover:border-brand-primary/50 transition-colors"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold text-lg border-2 border-slate-700 group-hover:border-brand-primary/50 transition-colors">
                                            {contact.name ? contact.name[0].toUpperCase() : '?'}
                                        </div>
                                    )}
                                    <div className="flex-1 text-left overflow-hidden">
                                        <p className="text-white font-bold truncate">
                                            {contact.name || 'Nostr User'}
                                        </p>
                                        {contact.lud16 ? (
                                            <p className="text-slate-400 text-sm truncate">{contact.lud16}</p>
                                        ) : (
                                            <p className="text-slate-500 text-xs">
                                                {contact.pubkey.substring(0, 16)}...
                                            </p>
                                        )}
                                    </div>
                                    <Icons.Send size={20} className="text-slate-600 group-hover:text-brand-primary transition-colors" />
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    if (view === 'send-scan') {
        return (
            <div className="p-6 h-full flex flex-col">
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('send-input')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Scan QR Code</h2>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black">
                        {/* Camera Preview */}
                        <video
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover"
                            autoPlay
                            playsInline
                            muted
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanning overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 border-2 border-cyan-400/50 rounded-2xl relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-xl"></div>
                                
                                {/* Scanning line animation */}
                                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse top-1/2"></div>
                            </div>
                        </div>

                        {/* Loading state */}
                        {isCameraLoading && (
                            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                                    <p className="text-slate-400 text-sm">Starting camera...</p>
                                </div>
                            </div>
                        )}

                        {/* Error state */}
                        {cameraError && (
                            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center p-6">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                                        <Icons.Camera size={32} className="text-red-500" />
                                    </div>
                                    <h3 className="text-white font-bold mb-2">Camera Error</h3>
                                    <p className="text-slate-400 text-sm mb-4">{cameraError}</p>
                                    <Button onClick={restart} variant="secondary">
                                        Try Again
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <p className="text-slate-400 text-sm mt-6 text-center">
                        Point your camera at a Lightning invoice or Bitcoin address QR code
                    </p>

                    {/* Alternative options */}
                    <div className="flex space-x-3 mt-6">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            <Icons.QrCode size={18} className="text-purple-400" />
                            <span className="text-sm text-white">Upload Image</span>
                        </button>
                        <button
                            onClick={() => {
                                setSendInput('');
                                setView('send-details');
                            }}
                            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            <Icons.Copy size={18} className="text-slate-400" />
                            <span className="text-sm text-white">Paste Manually</span>
                        </button>
                    </div>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
            </div>
        );
    }

    if (view === 'send-details') {
        return (
            <div className="p-6 h-full flex flex-col relative">
                {isProcessing && <ProcessingOverlay message="Processing..." />}

                <div className="flex items-center mb-6">
                    <button onClick={() => setView('send-input')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Transaction Details</h2>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-3xl p-6 shadow-xl flex-1 flex flex-col">
                    {transactionError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2">
                            <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h3 className="text-red-500 font-bold text-sm">Error</h3>
                                <p className="text-xs text-red-400 mt-1 leading-relaxed">
                                    {transactionError}
                                </p>
                            </div>
                        </div>
                    )}

                    {insufficientFunds && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2">
                            <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h3 className="text-red-500 font-bold">Insufficient Funds</h3>
                                <p className="text-xs text-red-400 mt-1">
                                    Wallet Balance: {walletBalance.toLocaleString()} Sats<br />
                                    Required: {(parseInt(sendAmount || '0') + (quoteFee || 0)).toLocaleString()} Sats
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6 flex-1">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Amount (Sats)</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    className={`w-full bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-3xl font-mono text-white placeholder-slate-600 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all ${isFixedAmount ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    placeholder="0"
                                    value={sendAmount}
                                    onChange={e => setSendAmount(e.target.value)}
                                    readOnly={isFixedAmount}
                                />
                                {isFixedAmount && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 font-bold">
                                        FIXED
                                    </div>
                                )}
                            </div>
                            {quoteFee !== null && (
                                <p className="text-xs text-slate-500 mt-2 ml-1 flex items-center">
                                    <Icons.Zap size={12} className="mr-1" />
                                    + {quoteFee} sats network fee
                                </p>
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recipient</label>
                                <button
                                    onClick={async () => {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            if (text) setSendInput(text);
                                        } catch (e) {
                                            console.error("Failed to read clipboard", e);
                                        }
                                    }}
                                    className="text-xs text-brand-secondary hover:text-white transition-colors flex items-center"
                                >
                                    <Icons.Copy size={12} className="mr-1" /> Paste
                                </button>
                            </div>
                            <div className="relative h-full max-h-48">
                                <textarea
                                    className="w-full h-full bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-sm font-mono text-slate-300 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none resize-none transition-all"
                                    placeholder="Lightning invoice, Lightning address, LNURL, or Cashu token..."
                                    value={sendInput}
                                    onChange={e => setSendInput(e.target.value)}
                                />
                                {isCheckingInvoice && (
                                    <div className="absolute top-4 right-4">
                                        <Icons.Zap size={16} className="text-brand-accent animate-pulse" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex space-x-4 mt-auto">
                        <Button fullWidth variant="secondary" onClick={() => setView('main')} className="bg-slate-800 hover:bg-slate-700 border-slate-600">Cancel</Button>
                        <Button
                            fullWidth
                            onClick={handleSend}
                            disabled={isProcessing || insufficientFunds || !sendAmount}
                            className={`shadow-lg shadow-brand-primary/20 ${insufficientFunds ? 'opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-90'}`}
                        >
                            {isProcessing ? 'Processing...' : 'Confirm Send'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Main View ---

    return (
        <div
            ref={scrollContainerRef}
            className="flex flex-col h-full p-6 pb-24 overflow-y-auto relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull-to-Refresh Indicator */}
            {isPulling && (
                <div
                    className="absolute top-0 left-0 right-0 flex justify-center items-center transition-opacity z-50"
                    style={{
                        transform: `translateY(${pullDistance - 60}px)`,
                        opacity: Math.min(pullDistance / 60, 1)
                    }}
                >
                    <div className="bg-brand-primary/20 border border-brand-primary/30 backdrop-blur-md rounded-full p-3">
                        {isRefreshing ? (
                            <div className="w-6 h-6 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Icons.Refresh
                                size={24}
                                className="text-brand-primary"
                                style={{
                                    transform: `rotate(${Math.min(pullDistance * 3, 360)}deg)`,
                                    transition: 'transform 0.2s'
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center">
                    <Icons.Wallet className="mr-2 text-brand-primary" /> Wallet
                </h1>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setShowWalletHelp(true)}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Help size={20} />
                    </button>
                    <button
                        onClick={() => setView('settings')}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Settings size={20} />
                    </button>
                </div>
            </div>

            {/* Wallet Balance Tile - Dual gradient system with shimmer transitions */}
            <div 
                className="rounded-3xl p-6 shadow-xl relative overflow-hidden mb-8 bg-slate-900"
                style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: rightGlowColor.border,
                    transition: 'border-color 0.5s ease-out'
                }}
            >
                {/* Base dark gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 pointer-events-none" />
                
                {/* LEFT GLOW - Shows the wallet to the LEFT of current selection */}
                <div 
                    className="absolute w-44 h-44 rounded-full blur-3xl pointer-events-none"
                    style={{
                        background: leftGlowColor.glowStrong,
                        top: '-30px',
                        left: '-30px',
                        opacity: leftGlowType === 'none' ? 0 : 1,
                        transition: 'all 0.5s ease-out',
                        transform: isTransitioning && transitionDirection === 'left' 
                            ? 'translateX(-20px) scale(1.1)' 
                            : isTransitioning && transitionDirection === 'right'
                                ? 'translateX(20px) scale(0.9)'
                                : 'translateX(0) scale(1)',
                    }}
                />
                
                {/* RIGHT GLOW - Shows the CURRENT wallet's color */}
                <div 
                    className="absolute w-48 h-48 rounded-full blur-3xl pointer-events-none"
                    style={{
                        background: rightGlowColor.glowStrong,
                        top: '-30px',
                        right: '-30px',
                        opacity: 1,
                        transition: 'all 0.5s ease-out',
                        transform: isTransitioning 
                            ? transitionDirection === 'left' 
                                ? 'translateX(20px) scale(0.8)' 
                                : 'translateX(-20px) scale(0.8)'
                            : 'translateX(0) scale(1)',
                    }}
                />
                
                {/* Subtle bottom accent glow */}
                <div 
                    className="absolute w-32 h-32 rounded-full blur-2xl pointer-events-none"
                    style={{
                        background: rightGlowColor.glow,
                        bottom: '-20px',
                        right: '30%',
                        opacity: 0.5,
                        transition: 'background 0.5s ease-out',
                    }}
                />
                
                {/* Shimmer sweep effect during transition */}
                {isTransitioning && (
                    <div 
                        className="absolute inset-0 pointer-events-none z-5"
                        style={{
                            background: transitionDirection === 'left'
                                ? `linear-gradient(90deg, transparent 0%, ${rightGlowColor.glow} 50%, transparent 100%)`
                                : `linear-gradient(-90deg, transparent 0%, ${leftGlowColor.glow} 50%, transparent 100%)`,
                            animation: transitionDirection === 'left' 
                                ? 'shimmerSweepLeft 0.5s ease-out forwards'
                                : 'shimmerSweepRight 0.5s ease-out forwards',
                        }}
                    />
                )}

                {/* Wallet Mode Switcher */}
                <div className="relative z-10 flex items-center justify-between mb-4">
                    <WalletModeSwitcher 
                        activeMode={walletMode}
                        viewMode={viewMode}
                        isExpanded={isWalletSelectorExpanded}
                        onModeChange={handleWalletModeChange}
                        onViewModeChange={setViewMode}
                        onExpandToggle={handleExpandToggle}
                        onWalletSelect={handleWalletSelect}
                    />

                    {/* Status Indicator - Tappable, goes to settings (hidden when viewing "all") */}
                    {viewMode !== 'all' && (
                        <button 
                            onClick={() => setView('settings')}
                            className="flex items-center space-x-1.5 bg-black/30 hover:bg-black/50 px-2 py-1 rounded-md border border-white/5 hover:border-white/10 transition-all active:scale-95"
                        >
                            {walletMode === 'breez' && (
                                <>
                                    {/* TODO: When Breez is connected, show blue dot + "Ready" */}
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        Setup
                                    </span>
                                </>
                            )}
                            {walletMode === 'cashu' && (
                                activeMint ? (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]">
                                {activeMint.nickname}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            No Mint
                                        </span>
                                    </>
                                )
                            )}
                            {walletMode === 'nwc' && (
                                nwcString ? (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.5)]"></div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            Connected
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            Not Connected
                                        </span>
                                    </>
                                )
                            )}
                        </button>
                    )}
                    
                    {/* "All Wallets" indicator when viewing cumulative balance */}
                    {viewMode === 'all' && (
                        <div className="flex items-center space-x-1.5 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                            <span className="text-[10px] text-orange-400 font-mono">
                                All Wallets
                            </span>
                        </div>
                    )}
                </div>

                <div className="relative z-10">
                    {/* Tappable Balance - toggles between SATS and USD */}
                    <button 
                        onClick={handleBalanceTap}
                        disabled={isBalanceLoading}
                        className="flex items-baseline space-x-1 mb-3 cursor-pointer active:scale-95 transition-transform select-none"
                    >
                        <div className="relative overflow-hidden">
                            {/* SATS display */}
                            <span 
                                className={`text-5xl font-extrabold tracking-tight drop-shadow-sm transition-all duration-300 ${
                                    isBalanceLoading || isFetchingPrice
                                        ? 'balance-shimmer' 
                                        : 'text-white'
                                } ${showUsd ? 'opacity-0 absolute' : 'opacity-100'}`}
                            >
                                {displayBalance.toLocaleString()}
                            </span>
                            
                            {/* USD display */}
                            <span 
                                className={`text-5xl font-extrabold tracking-tight drop-shadow-sm transition-all duration-300 text-green-400 ${
                                    showUsd ? 'opacity-100' : 'opacity-0 absolute'
                                }`}
                            >
                                {usdValue || '$0.00'}
                            </span>
                    </div>
                        
                        <span className={`text-xl font-bold transition-all duration-300 ${
                            showUsd 
                                ? 'text-green-400'
                                : viewMode === 'all'
                                    ? 'text-orange-400'
                                    : viewMode === 'breez' 
                                        ? 'text-blue-400' 
                                        : viewMode === 'nwc' 
                                            ? 'text-purple-400' 
                                            : 'text-emerald-400'
                        }`}>
                            {showUsd ? 'USD' : 'SATS'}
                        </span>
                    </button>
                    
                    {/* Zero Balance Prompt - Shows immediately if balance is 0 (don't wait for loading) */}
                    {displayBalance === 0 && (
                        <button
                            onClick={() => setShowFundModal(true)}
                            className="w-full mb-3 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-orange-500/30 rounded-xl transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                        <Icons.Bitcoin size={20} className="text-orange-500" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-white">New to Bitcoin?</p>
                                        <p className="text-xs text-slate-400">Learn how to add sats</p>
                                    </div>
                                </div>
                                <Icons.Next size={18} className="text-slate-500 group-hover:text-orange-500 transition-colors" />
                            </div>
                        </button>
                    )}

                    <div className="relative">
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => {
                                    if (viewMode === 'all') {
                                        handleAllWalletsSend();
                                    } else {
                                        setView('send-input');
                                    }
                                }} 
                                className={`flex flex-col items-center justify-center bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-xl py-2.5 transition-all active:scale-95`}
                            >
                                <div className={`p-2 rounded-full mb-1 ${
                                    viewMode === 'all'
                                        ? 'bg-orange-500/20'
                                        : viewMode === 'breez' 
                                            ? 'bg-blue-500/20' 
                                            : viewMode === 'nwc' 
                                                ? 'bg-purple-500/20' 
                                                : 'bg-emerald-500/20'
                                }`}>
                                    <Icons.Send size={20} className={
                                        viewMode === 'all'
                                            ? 'text-orange-400'
                                            : viewMode === 'breez' 
                                                ? 'text-blue-400' 
                                                : viewMode === 'nwc' 
                                                    ? 'text-purple-400' 
                                                    : 'text-emerald-400'
                                    } />
                                </div>
                                <span className="text-sm font-bold text-white">Send</span>
                            </button>

                            <button 
                                onClick={() => {
                                    if (viewMode === 'all') {
                                        handleAllWalletsReceive();
                                    } else {
                                        walletMode === 'nwc' ? setView('deposit') : setView('receive');
                                    }
                                }} 
                                className={`flex flex-col items-center justify-center rounded-xl py-2.5 transition-all active:scale-95 ${
                                    viewMode === 'all'
                                        ? 'bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 hover:border-orange-500'
                                        : viewMode === 'breez' 
                                            ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500' 
                                            : viewMode === 'nwc' 
                                                ? 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 hover:border-purple-500' 
                                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 hover:border-emerald-500'
                                }`}
                            >
                                <div className={`p-2 rounded-full mb-1 ${
                                    viewMode === 'all'
                                        ? 'bg-orange-500/20'
                                        : viewMode === 'breez' 
                                            ? 'bg-blue-500/20' 
                                            : viewMode === 'nwc' 
                                                ? 'bg-purple-500/20' 
                                                : 'bg-emerald-500/20'
                                }`}>
                                    <Icons.Receive size={20} className={
                                        viewMode === 'all'
                                            ? 'text-orange-400'
                                            : viewMode === 'breez' 
                                                ? 'text-blue-400' 
                                                : viewMode === 'nwc' 
                                                    ? 'text-purple-400' 
                                                    : 'text-emerald-400'
                                    } />
                                </div>
                                <span className="text-sm font-bold text-white">Receive</span>
                            </button>
                        </div>
                        
                        {/* Quick QR Scan Button - Centered overlay (Frosted Glass) */}
                        <button
                            onClick={() => {
                                if (viewMode === 'all') {
                                    // Smart auto-select: pick wallet with funds
                                    const preferredWallet = getPreferredSendWallet();
                                    setViewMode(preferredWallet);
                                    setWalletMode(preferredWallet);
                                    setIsWalletSelectorExpanded(true);
                                    setView('send-scan');
                                } else {
                                    // Specific wallet already selected
                                    setView('send-scan');
                                }
                            }}
                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm border hover:brightness-110 ${
                                viewMode === 'all'
                                    ? 'bg-slate-800/70 border-orange-500/30 hover:border-orange-500/50'
                                    : viewMode === 'breez' 
                                        ? 'bg-blue-900/40 border-blue-500/30 hover:border-blue-500/50' 
                                        : viewMode === 'nwc' 
                                            ? 'bg-purple-900/40 border-purple-500/30 hover:border-purple-500/50' 
                                            : 'bg-emerald-900/40 border-emerald-500/30 hover:border-emerald-500/50'
                            }`}
                        >
                            <Icons.QrCode size={20} className={
                                viewMode === 'all'
                                    ? 'text-orange-400'
                                    : viewMode === 'breez' 
                                        ? 'text-blue-400' 
                                        : viewMode === 'nwc' 
                                            ? 'text-purple-400' 
                                            : 'text-emerald-400'
                            } />
                        </button>
                    </div>
                </div>
            </div>

            <h2 className="text-lg font-bold mb-4 text-slate-300">Recent Activity</h2>
            <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2 no-scrollbar">
                {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-50">
                        <Icons.History size={40} className="mb-2" />
                        <p>No transactions yet.</p>
                    </div>
                ) : (
                    transactions
                        .filter(tx => viewMode === 'all' || (tx.walletType || 'cashu') === viewMode)
                        .map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-full ${['deposit', 'receive'].includes(tx.type) ? 'bg-green-500/20 text-green-400' :
                                        ['payout', 'ace_pot'].includes(tx.type) ? 'bg-brand-primary/20 text-brand-primary' :
                                            ['send', 'payment'].includes(tx.type) ? 'bg-brand-accent/20 text-brand-accent' :
                                                'bg-slate-600/30 text-slate-300'
                                        }`}>
                                        {['deposit', 'receive'].includes(tx.type) && <Icons.Zap size={16} />}
                                        {(tx.type === 'payout' || tx.type === 'ace_pot') && <Icons.Trophy size={16} />}
                                        {(tx.type === 'payment' || tx.type === 'send') && <Icons.Send size={16} />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-white">{tx.description}</p>
                                        <p className="text-xs text-slate-500">{new Date(tx.timestamp).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className={`font-mono font-bold ${['deposit', 'payout', 'ace_pot', 'receive'].includes(tx.type) ? 'text-green-400' : 'text-white'}`}>
                                    {['payment', 'send'].includes(tx.type) ? '-' : '+'}{tx.amountSats}
                                </span>
                            </div>
                        ))
                )}
            </div>
            {helpModal && <HelpModal isOpen={helpModal.isOpen} title={helpModal.title} text={helpModal.text} onClose={() => setHelpModal(null)} onAction={(action) => { 
                if (action === 'lightning-explainer') { setHelpModal(null); setReturnToWalletHelp(false); setShowLightningExplainer(true); }
            }} />}
            
            {/* Wallet Selection Modal (for "All Wallets" mode) */}
            {showWalletSelectionModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" 
                    onClick={() => setShowWalletSelectionModal(null)}
                >
                    <div 
                        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                        {showWalletSelectionModal === 'send' 
                                            ? <Icons.Send size={20} className="text-orange-500" />
                                            : <Icons.Receive size={20} className="text-orange-500" />
                                        }
                                    </div>
                                    <h3 className="text-lg font-bold text-white">
                                        {showWalletSelectionModal === 'send' ? 'Send From' : 'Receive To'}
                                    </h3>
                                </div>
                                <button onClick={() => setShowWalletSelectionModal(null)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                            <p className="text-slate-400 text-sm mt-2">
                                Select which wallet to use
                            </p>
                        </div>
                        
                        {/* Wallet Options */}
                        <div className="p-4 space-y-3">
                            {/* Cashu Option - Always available */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setShowWalletSelectionModal(null);
                                        setViewMode('cashu');
                                        setWalletMode('cashu');
                                        setIsWalletSelectorExpanded(true);
                                        setTimeout(() => {
                                            if (showWalletSelectionModal === 'send') {
                                                setView('send-input');
                                            } else {
                                                setView('receive');
                                            }
                                        }, 100);
                                    }}
                                    className="flex-1 flex items-center justify-between p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl transition-all"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <Icons.Cashew size={20} className="text-emerald-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-white font-bold">Cashu</p>
                                            <p className="text-emerald-400 text-xs">{walletBalances.cashu.toLocaleString()} sats</p>
                                        </div>
                                    </div>
                                    <Icons.Next size={18} className="text-emerald-400" />
                                </button>
                                {/* Default checkbox */}
                                <button
                                    onClick={() => {
                                        if (showWalletSelectionModal === 'send') {
                                            setDefaultSendWallet(defaultSendWallet === 'cashu' ? null : 'cashu');
                                        } else {
                                            setDefaultReceiveWallet(defaultReceiveWallet === 'cashu' ? null : 'cashu');
                                        }
                                    }}
                                    className="flex flex-col items-center justify-center p-2"
                                    title="Set as default"
                                >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                        (showWalletSelectionModal === 'send' ? defaultSendWallet : defaultReceiveWallet) === 'cashu'
                                            ? 'bg-emerald-500 border-emerald-500'
                                            : 'border-slate-500 hover:border-emerald-400'
                                    }`}>
                                        {(showWalletSelectionModal === 'send' ? defaultSendWallet : defaultReceiveWallet) === 'cashu' && (
                                            <Icons.Check size={12} className="text-white" />
                                        )}
                                    </div>
                                    <span className="text-[9px] text-slate-500 mt-0.5">Default</span>
                                </button>
                            </div>
                            
                            {/* NWC Option - Only if connected */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (!nwcString) {
                                            // Not connected - go to settings
                                            setShowWalletSelectionModal(null);
                                            setViewMode('nwc');
                                            setWalletMode('nwc');
                                            setIsWalletSelectorExpanded(true);
                                            setView('settings');
                                        } else {
                                            setShowWalletSelectionModal(null);
                                            setViewMode('nwc');
                                            setWalletMode('nwc');
                                            setIsWalletSelectorExpanded(true);
                                            setTimeout(() => {
                                                if (showWalletSelectionModal === 'send') {
                                                    setView('send-input');
                                                } else {
                                                    setView('deposit');
                                                }
                                            }, 100);
                                        }
                                    }}
                                    className={`flex-1 flex items-center justify-between p-4 rounded-xl transition-all ${
                                        nwcString 
                                            ? 'bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50'
                                            : 'bg-slate-800/50 border border-slate-700 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            nwcString ? 'bg-purple-500/20' : 'bg-slate-700'
                                        }`}>
                                            <Icons.Link size={20} className={nwcString ? 'text-purple-400' : 'text-slate-500'} />
                                        </div>
                                        <div className="text-left">
                                            <p className={nwcString ? 'text-white font-bold' : 'text-slate-400 font-bold'}>NWC</p>
                                            {nwcString ? (
                                                <p className="text-purple-400 text-xs">{walletBalances.nwc.toLocaleString()} sats</p>
                                            ) : (
                                                <p className="text-slate-500 text-xs">Not connected</p>
                                            )}
                                        </div>
                                    </div>
                                    {nwcString ? (
                                        <Icons.Next size={18} className="text-purple-400" />
                                    ) : (
                                        <span className="text-xs text-slate-500">Setup →</span>
                                    )}
                                </button>
                                {/* Default checkbox - only show if connected */}
                                {nwcString ? (
                                    <button
                                        onClick={() => {
                                            if (showWalletSelectionModal === 'send') {
                                                setDefaultSendWallet(defaultSendWallet === 'nwc' ? null : 'nwc');
                                            } else {
                                                setDefaultReceiveWallet(defaultReceiveWallet === 'nwc' ? null : 'nwc');
                                            }
                                        }}
                                        className="flex flex-col items-center justify-center p-2"
                                        title="Set as default"
                                    >
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                            (showWalletSelectionModal === 'send' ? defaultSendWallet : defaultReceiveWallet) === 'nwc'
                                                ? 'bg-purple-500 border-purple-500'
                                                : 'border-slate-500 hover:border-purple-400'
                                        }`}>
                                            {(showWalletSelectionModal === 'send' ? defaultSendWallet : defaultReceiveWallet) === 'nwc' && (
                                                <Icons.Check size={12} className="text-white" />
                                            )}
                                        </div>
                                        <span className="text-[9px] text-slate-500 mt-0.5">Default</span>
                                    </button>
                                ) : (
                                    <div className="w-[52px]" /> // Spacer to align with Cashu
                                )}
                            </div>
                            
                            {/* Breez Option - Coming soon */}
                            <div className="flex items-center gap-2">
                                <button
                                    disabled
                                    className="flex-1 flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl opacity-50 cursor-not-allowed"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                            <Icons.Zap size={20} className="text-blue-400/50" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-slate-400 font-bold">Lightning</p>
                                            <p className="text-slate-500 text-xs">Coming soon</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded">Soon™</span>
                                </button>
                                <div className="w-[52px]" /> {/* Spacer */}
                            </div>
                        </div>
                        
                        {/* Footer hint */}
                        <div className="px-4 pb-4">
                            <p className="text-slate-500 text-xs text-center">
                                Check the box to set a default wallet
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Fund Wallet Modal */}
            {showFundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowFundModal(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                                        <Icons.Bitcoin size={40} className="text-orange-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Getting Your First Sats</h3>
                                </div>
                                <button onClick={() => setShowFundModal(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content - Level 0: Getting Started */}
                        {rabbitHoleLevel === 0 && (
                            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                                {/* The Rant */}
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                    <p className="text-slate-300 text-sm leading-relaxed mb-3">
                                        <span className="text-white font-bold">Here's the deal:</span> The government has made it unnecessarily complicated to buy Bitcoin. 
                                        They'd prefer you keep your savings in dollars that lose value every year while they print trillions more.
                                    </p>
                                    <p className="text-slate-400 text-xs italic">
                                        Meanwhile, Bitcoin's supply is fixed forever. No one can print more. Ever. That's kind of the point.{' '}
                                        <button 
                                            onClick={() => setRabbitHoleLevel(1)}
                                            className="text-orange-400 hover:text-orange-300 underline transition-colors not-italic"
                                        >
                                            Go deeper.
                                        </button>
                                    </p>
                                </div>
                                
                                {/* The Good News */}
                                <p className="text-slate-300 text-sm">
                                    <span className="text-brand-primary font-bold">The good news?</span> A few apps make it easy to buy Bitcoin and send it directly to your wallet via Lightning:
                                </p>
                                
                                {/* App Recommendations */}
                                <div className="space-y-3">
                                    <a href="https://cash.app" target="_blank" rel="noopener noreferrer" className="block p-4 bg-[#00D64F]/10 border border-[#00D64F]/30 rounded-xl hover:bg-[#00D64F]/20 transition-colors group">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-[#00D64F]">Cash App</p>
                                                <p className="text-xs text-slate-400">US & UK • Free Lightning withdrawals</p>
                                            </div>
                                            <Icons.Next size={18} className="text-slate-500 group-hover:text-[#00D64F] transition-colors" />
                                        </div>
                                    </a>
                                    <a href="https://strike.me" target="_blank" rel="noopener noreferrer" className="block p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 transition-colors group">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-blue-400">Strike</p>
                                                <p className="text-xs text-slate-400">US & Americas • Lowest fees (0.3%)</p>
                                            </div>
                                            <Icons.Next size={18} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                    </a>
                                    <a href="https://relai.app" target="_blank" rel="noopener noreferrer" className="block p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl hover:bg-orange-500/20 transition-colors group">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-orange-400">Relai</p>
                                                <p className="text-xs text-slate-400">Europe • No KYC for small amounts</p>
                                            </div>
                                            <Icons.Next size={18} className="text-slate-500 group-hover:text-orange-400 transition-colors" />
                                        </div>
                                    </a>
                                    <a href="https://blink.sv" target="_blank" rel="noopener noreferrer" className="block p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl hover:bg-purple-500/20 transition-colors group">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-purple-400">Blink</p>
                                                <p className="text-xs text-slate-400">Global • Great for Latin America</p>
                                            </div>
                                            <Icons.Next size={18} className="text-slate-500 group-hover:text-purple-400 transition-colors" />
                                        </div>
                                    </a>
                                </div>
                                
                                {/* Instructions */}
                                <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-4">
                                    <p className="text-sm text-slate-300 mb-2">
                                        <span className="text-brand-primary font-bold">Quick steps:</span>
                                    </p>
                                    <ol className="text-xs text-slate-400 space-y-1 ml-4 list-decimal">
                                        <li>Download one of the apps above</li>
                                        <li>Buy some Bitcoin</li>
                                        <li>Withdraw to Lightning</li>
                                        <li>Paste your address: <span className="text-brand-primary font-mono">{receiveAddress.length > 20 ? receiveAddress.substring(0, 20) + '...' : receiveAddress}</span></li>
                                    </ol>
                                </div>
                                
                                {/* Copy Address Button */}
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(receiveAddress);
                                        alert('Lightning Address copied!');
                                    }}
                                    className="w-full p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors flex items-center justify-center space-x-2"
                                >
                                    <Icons.Copy size={16} className="text-slate-400" />
                                    <span className="text-sm text-slate-300">Copy Your Lightning Address</span>
                                </button>
                            </div>
                        )}
                        
                        {/* Content - Level 1: Deeper */}
                        {rabbitHoleLevel === 1 && (
                            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <p className="text-slate-300 text-sm leading-relaxed mb-3">
                                        Governments are, at their core, <span className="text-red-400 font-bold">institutions of coercion</span>. 
                                        They fund themselves not through voluntary exchange, but through taxation backed by force — 
                                        and increasingly, by simply <span className="text-red-400 font-bold">printing money out of thin air</span>.
                                    </p>
                                    <p className="text-slate-300 text-sm leading-relaxed mb-3">
                                        Every dollar printed dilutes your savings. Your purchasing power erodes while you sleep. 
                                        This isn't a bug — <span className="text-white font-bold">it's how the system is designed</span>.
                                    </p>
                                </div>
                                
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                    <p className="text-orange-400 text-sm italic leading-relaxed">
                                        "No man should work for what another man prints."
                                    </p>
                                    <p className="text-slate-500 text-xs mt-2 text-right">— Jack Mallers, CEO of Strike</p>
                                </div>
                                
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Bitcoin is the first technology that allows you to <span className="text-white font-bold">opt out</span> of this system. 
                                    Not through violence. Not through politics. Through mathematics. Through code that no government can change.{' '}
                                    <button 
                                        onClick={() => setRabbitHoleLevel(2)}
                                        className="text-orange-400 hover:text-orange-300 underline transition-colors"
                                    >
                                        How deep does this go?
                                    </button>
                                </p>
                            </div>
                        )}
                        
                        {/* Content - Level 2: The Signal */}
                        {rabbitHoleLevel === 2 && (
                            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                                <div className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 border border-purple-500/30 rounded-xl p-4">
                                    <p className="text-slate-300 text-sm leading-relaxed mb-3">
                                        Bitcoin isn't just a currency. It's an <span className="text-purple-400 font-bold">intergalactic protocol</span> — 
                                        a discovery of absolute digital scarcity that will outlast not just our generation, 
                                        but our <span className="text-orange-400 font-bold">civilizations</span>.
                                    </p>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        This technology will be here for <span className="text-white font-bold">millennia</span>. 
                                        Long after every fiat currency has hyperinflated into oblivion, 
                                        Bitcoin will still be running — block after block, forever.
                                    </p>
                                </div>
                                
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                    <p className="text-slate-300 text-sm leading-relaxed mb-3">
                                        Throughout history, every coercive institution has eventually fallen. 
                                        Empires. Monarchies. Dictatorships. They all crumble.
                                    </p>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        Bitcoin is the <span className="text-brand-primary font-bold">peaceful revolution</span>. 
                                        It doesn't fight governments — it simply makes them irrelevant. 
                                        When you can store and transfer value without permission, 
                                        the power to inflate, confiscate, and control <span className="text-white font-bold">evaporates</span>.
                                    </p>
                                </div>
                                
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                                    <p className="text-amber-400 text-sm leading-relaxed mb-2">
                                        <span className="font-bold">This is why there's so much misinformation.</span>
                                    </p>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Those in power understand the threat. They'll call it a scam, a bubble, a tool for criminals — 
                                        anything to delay the inevitable. But the signal cannot be stopped.
                                    </p>
                                </div>
                                
                                <div className="bg-gradient-to-r from-orange-500/20 to-purple-500/20 border border-orange-500/30 rounded-xl p-4 text-center">
                                    <p className="text-white font-bold text-sm mb-1">
                                        A golden age for humanity awaits.
                                    </p>
                                    <p className="text-slate-400 text-xs">
                                        You're early. You're here. Welcome to the revolution.
                                    </p>
                                </div>
                                
                                <p className="text-center">
                                    <button 
                                        onClick={() => {
                                            setShowGlitch(true);
                                            setTimeout(() => {
                                                setShowGlitch(false);
                                                setRabbitHoleLevel(3);
                                                setMatrixText('');
                                                setMatrixComplete(false);
                                            }, 800);
                                        }}
                                        className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                                    >
                                        Rock bottom.
                                    </button>
                                </p>
                            </div>
                        )}
                        
                        {/* Glitch Overlay */}
                        {showGlitch && (
                            <div className="fixed inset-0 z-[9999] bg-black pointer-events-none overflow-hidden">
                                {/* Glitch scanlines */}
                                <div className="absolute inset-0 animate-glitch-1">
                                    <div className="h-full w-full bg-gradient-to-b from-transparent via-green-500/20 to-transparent" 
                                         style={{ backgroundSize: '100% 4px' }} />
                                </div>
                                {/* RGB shift layers */}
                                <div className="absolute inset-0 animate-glitch-2 mix-blend-screen">
                                    <div className="absolute inset-0 bg-red-500/30 translate-x-2" />
                                </div>
                                <div className="absolute inset-0 animate-glitch-3 mix-blend-screen">
                                    <div className="absolute inset-0 bg-cyan-500/30 -translate-x-2" />
                                </div>
                                {/* Random noise blocks */}
                                <div className="absolute inset-0 animate-glitch-noise opacity-50">
                                    {[...Array(20)].map((_, i) => (
                                        <div 
                                            key={i}
                                            className="absolute bg-white/80"
                                            style={{
                                                left: `${Math.random() * 100}%`,
                                                top: `${Math.random() * 100}%`,
                                                width: `${Math.random() * 200 + 50}px`,
                                                height: `${Math.random() * 5 + 1}px`,
                                                animation: `glitch-block ${Math.random() * 0.3 + 0.1}s infinite`
                                            }}
                                        />
                                    ))}
                                </div>
                                {/* Static noise overlay */}
                                <div className="absolute inset-0 opacity-30" 
                                     style={{ 
                                         backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
                                         animation: 'glitch-static 0.1s infinite'
                                     }} 
                                />
                            </div>
                        )}
                        
                        {/* Footer - Hidden during Matrix (Level 3) */}
                        {rabbitHoleLevel < 3 && (
                            <div className="p-4 border-t border-slate-800">
                                {rabbitHoleLevel > 0 ? (
                                    <div className="flex space-x-3">
                                        <Button variant="secondary" onClick={() => setRabbitHoleLevel(rabbitHoleLevel - 1)}>
                                            <Icons.Back size={16} className="mr-1" /> Back
                                        </Button>
                                        <Button fullWidth onClick={() => { setShowFundModal(false); setRabbitHoleLevel(0); }}>Got it</Button>
                                    </div>
                                ) : (
                                    <Button fullWidth onClick={() => { setShowFundModal(false); setRabbitHoleLevel(0); }}>Got it</Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Lightning Network Explainer Modal */}
            {showLightningExplainer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setShowLightningExplainer(false); if (returnToWalletHelp) { setShowWalletHelp(true); setReturnToWalletHelp(false); } }}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header with Back Button */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    {returnToWalletHelp && (
                                        <button 
                                            onClick={() => { setShowLightningExplainer(false); setShowWalletHelp(true); setReturnToWalletHelp(false); }}
                                            className="p-1 -ml-1 text-slate-400 hover:text-white"
                                        >
                                            <Icons.Back size={20} />
                                        </button>
                                    )}
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                        <Icons.Zap size={20} className="text-blue-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">What is Lightning?</h3>
                                </div>
                                <button onClick={() => { setShowLightningExplainer(false); if (returnToWalletHelp) { setShowWalletHelp(true); setReturnToWalletHelp(false); } }} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    <span className="text-white font-bold">The Lightning Network</span> is a payment layer built on top of Bitcoin that enables instant, nearly-free transactions.
                                </p>
                            </div>
                            
                            <div className="space-y-3">
                                <p className="text-slate-300 text-sm">
                                    <span className="text-blue-400 font-bold">Think of it like this:</span>
                                </p>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Bitcoin is like a bank vault — super secure but slow and expensive to move money in and out. Lightning is like your everyday wallet — fast, cheap, and perfect for daily spending.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                                <p className="text-white font-bold text-sm">Why it matters for disc golf:</p>
                                <ul className="text-slate-400 text-xs space-y-1.5 ml-3">
                                    <li className="flex items-start space-x-2">
                                        <Icons.Zap size={12} className="text-blue-400 mt-0.5 shrink-0" />
                                        <span><strong className="text-slate-300">Instant transfers</strong> — Funds move the moment a round ends</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <Icons.Zap size={12} className="text-blue-400 mt-0.5 shrink-0" />
                                        <span><strong className="text-slate-300">Tiny fees</strong> — Fractions of a penny, even for small amounts</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <Icons.Zap size={12} className="text-blue-400 mt-0.5 shrink-0" />
                                        <span><strong className="text-slate-300">No middlemen</strong> — Peer-to-peer, like handing over cash</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <p className="text-slate-500 text-xs italic text-center">
                                Lightning makes Bitcoin practical for everyday use — why didn't you use it to pay for your{' '}
                                <button 
                                    onClick={() => { setShowLightningExplainer(false); setShowVisaConspiracy(true); }}
                                    className="text-blue-400 hover:text-blue-300 underline not-italic transition-colors"
                                >
                                    $500 Zuca cart setup
                                </button>?
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => { setShowLightningExplainer(false); if (returnToWalletHelp) { setShowWalletHelp(true); setReturnToWalletHelp(false); } }}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Visa/Apple Conspiracy Easter Egg Modal */}
            {showVisaConspiracy && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowVisaConspiracy(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowVisaConspiracy(false); setShowLightningExplainer(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <Icons.AlertTriangle size={20} className="text-red-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Why Can't You?</h3>
                                </div>
                                <button onClick={() => setShowVisaConspiracy(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    <span className="text-red-400 font-bold">The short answer?</span> The entire legacy financial system is paying billions to make sure you can't.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Visa-Apple Deal</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    <span className="text-yellow-400 font-bold">Visa pays Apple $200M–$500M annually</span> (that's 2,290–5,725+ BTC) since around 2016 to ensure Apple Pay relies on Visa's network and doesn't build rival features — like direct peer-to-peer transfers that could sideline card networks.
                                </p>
                                <p className="text-slate-500 text-xs italic">
                                    This was revealed in 2024 DOJ antitrust documents against Visa, which framed Apple Pay as an "existential threat" to Visa's swipe-fee empire.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">It's Not Just Visa</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    <span className="text-blue-400 font-bold">Mastercard</span> pays Apple too. <span className="text-green-400 font-bold">Google</span> pays Apple <span className="text-white">$20 billion per year</span> (229,016 BTC) just to be the default search engine on Safari.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">Why Bitcoin Threatens All of This</p>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                    Bitcoin and Lightning could <span className="text-orange-400 font-bold">disrupt every card network</span> by enabling fee-free, instant, global payments. No swipe fees. No middlemen. No permission needed.
                                </p>
                                <p className="text-slate-400 text-xs mt-2">
                                    Apple blocking early crypto apps in the App Store wasn't about "protecting users" — it was about <span className="text-red-400 font-bold">protecting its Visa/Mastercard partnerships</span>.
                                </p>
                            </div>
                            
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                                <p className="text-amber-400 font-bold text-sm mb-1">
                                    The system that makes you poorer every day?
                                </p>
                                <p className="text-slate-400 text-xs">
                                    It does <span className="text-white">not</span> want Bitcoin to succeed. Because it will destroy their monopoly and their empire.
                                </p>
                            </div>
                            
                            <p className="text-center pt-2">
                                <button 
                                    onClick={() => { setShowVisaConspiracy(false); setShowMoneyPrinters(true); }}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    But Visa and Apple are just the middlemen...
                                </button>
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowVisaConspiracy(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Level 2: The Money Printers */}
            {showMoneyPrinters && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowMoneyPrinters(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowMoneyPrinters(false); setShowVisaConspiracy(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <Icons.Dollar size={20} className="text-purple-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">The Money Printers</h3>
                                </div>
                                <button onClick={() => setShowMoneyPrinters(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Visa and Apple are just the <span className="text-purple-400 font-bold">distribution layer</span>. The real power lies with those who create the money itself.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Federal Reserve</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    The "Federal Reserve" is <span className="text-red-400 font-bold">not federal</span> and has <span className="text-red-400 font-bold">no reserves</span>. It's a private banking cartel that was granted the monopoly power to create US dollars from nothing in 1913.
                                </p>
                                <p className="text-slate-500 text-xs">
                                    Every dollar in existence was created as debt — with interest owed to the banking system.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Hidden Tax</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    They tell you inflation is 2-3%. The real rate — measured by the things you actually buy — is closer to <span className="text-red-400 font-bold">7-10% per year</span>.
                                </p>
                                <p className="text-slate-500 text-xs">
                                    Why do you think a disc now costs $25? Soon it'll be $30. In satoshis, it's 25k now. But in a year? It'll be 15k. <span className="text-orange-400">Price your life in Bitcoin and everything gets cheaper over time.</span> Price your life in dollars, everything gets more expensive.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-purple-500/10 to-red-500/10 border border-purple-500/30 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">The Cantillon Effect</p>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                    When new money is created, it doesn't reach everyone equally. Those <span className="text-purple-400 font-bold">closest to the money printer</span> — banks, corporations, the politically connected — receive it first, at yesterday's prices.
                                </p>
                                <p className="text-slate-400 text-xs mt-2">
                                    By the time wages rise for ordinary people, prices have already increased. You're always one step behind.
                                </p>
                            </div>
                            
                            <p className="text-center pt-2">
                                <button 
                                    onClick={() => { setShowMoneyPrinters(false); setShowCantillonClass(true); }}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Who actually benefits from this?
                                </button>
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowMoneyPrinters(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Level 3: The Cantillon Class */}
            {showCantillonClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowCantillonClass(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowCantillonClass(false); setShowMoneyPrinters(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <Icons.Chart size={20} className="text-amber-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">The Cantillon Class</h3>
                                </div>
                                <button onClick={() => setShowCantillonClass(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    There is an <span className="text-amber-400 font-bold">invisible class</span> of people who benefit from your losses. They don't work harder than you. They're just closer to the money printer.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The First Recipients</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    When trillions of new dollars are created, they flow first to:
                                </p>
                                <ul className="text-slate-400 text-xs space-y-1 ml-3">
                                    <li>- <span className="text-white">Banks</span> who receive it at 0% interest</li>
                                    <li>- <span className="text-white">Hedge funds</span> who borrow to buy assets</li>
                                    <li>- <span className="text-white">Corporations</span> who get bailouts</li>
                                    <li>- <span className="text-white">Politicians</span> who collect the taxes</li>
                                </ul>
                                <p className="text-slate-500 text-xs mt-2 italic">
                                    (Sound familiar? The PDGA collected membership fees for decades and still couldn't launch a cohesive pro tour. A private company had to step in and actually make things work...)
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Wealth Transfer</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    They buy assets — stocks, real estate, companies — <span className="text-amber-400 font-bold">before prices rise</span>. By the time the money reaches you through wages, those assets cost more.
                                </p>
                                <p className="text-slate-500 text-xs">
                                    This is why housing, healthcare, and education costs have skyrocketed while wages stagnated. Also why that two line Innova Destroyer you bought in 2013 is somehow worth $200 now.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Numbers</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Since 1971 when the dollar was detached from gold:
                                </p>
                                <ul className="text-slate-400 text-xs space-y-1 ml-3">
                                    <li>- Productivity up <span className="text-green-400">250%</span></li>
                                    <li>- Real wages up <span className="text-red-400">15%</span></li>
                                    <li>- Asset prices up <span className="text-green-400">3,000%+</span></li>
                                    <li>- Dollar purchasing power down <span className="text-red-400">87%</span></li>
                                    <li>- Discraft price per disc up <span className="text-red-400">400%</span></li>
                                </ul>
                                <p className="text-slate-500 text-xs mt-2">
                                    The gap between these numbers is what was stolen from you.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-red-500/10 to-amber-500/10 border border-red-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-xs leading-relaxed italic">
                                    "Inflation is taxation without legislation."
                                </p>
                                <p className="text-slate-500 text-xs mt-2 text-right">
                                    — Milton Friedman
                                </p>
                                <p className="text-slate-600 text-xs mt-1 text-right">
                                    (probably threw Discraft)
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Every dollar printed is a hidden tax on your savings. Every bailout transfers wealth from those who saved to those who speculated. The entire system is designed to move wealth <span className="text-red-400 font-bold">upward</span> — just like how the easiest way to get a high PDGA rating is to play a tournament where everyone else is already rated high.
                                </p>
                            </div>
                            
                            <p className="text-center pt-2">
                                <button 
                                    onClick={() => { setShowCantillonClass(false); setShowLifeboat(true); }}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Is there any way out?
                                </button>
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowCantillonClass(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Level 4: The Lifeboat - Hope */}
            {showLifeboat && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowLifeboat(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowLifeboat(false); setShowCantillonClass(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                        <Icons.Bitcoin size={20} className="text-orange-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">The Lifeboat</h3>
                                </div>
                                <button onClick={() => setShowLifeboat(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            {/* Big Answer */}
                            <div className="text-center py-4">
                                <p className="text-orange-500 text-5xl font-black tracking-tight drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">
                                    Bitcoin.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    You don't have to fight them. You don't have to ask permission. You don't have to wait for politicians to save you.
                                </p>
                                <p className="text-orange-400 font-bold text-sm mt-2">
                                    You just have to leave.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">Bitcoin Is the Exit</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    For the first time in history, there exists money that <span className="text-orange-400 font-bold">no one can print more of</span>. Not governments. Not banks. Not anyone.
                                </p>
                                <p className="text-slate-500 text-xs">
                                    21 million. Forever. Written in code that no one can change.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Peaceful Revolution</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Every revolution in history required violence, armies, and bloodshed. Bitcoin requires none of that.
                                </p>
                                <p className="text-slate-400 text-xs leading-relaxed mt-2">
                                    You simply <span className="text-white">opt out</span>. You move your savings into a system they cannot inflate, cannot confiscate, and cannot stop.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">Your Sovereignty</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Every satoshi you hold is a vote. A vote against the money printers. A vote for a future where your labor cannot be silently stolen through inflation.
                                </p>
                                <p className="text-slate-400 text-xs leading-relaxed mt-2">
                                    The state has always been controlled by those who control the money. Bitcoin separates money from state.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">This Is Hope</p>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                    The system seems invincible because it always has been. But for the first time, there's a door. And that door <span className="text-green-400 font-bold">cannot be closed</span>.
                                </p>
                                <p className="text-slate-300 text-xs leading-relaxed mt-2">
                                    Bitcoin cannot be stopped. Not by governments. Not by banks. Not by armies. It runs on tens of thousands of computers across the world, and every ten minutes, another block is added to the chain. It will outlast empires.
                                </p>
                                <p className="text-slate-300 text-xs leading-relaxed mt-2">
                                    Every day, more people walk through the door. And every day, the old system loses a little more power.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-slate-300 text-xs leading-relaxed italic">
                                    You are not powerless. You are not alone. And you are earlier than you think.
                                </p>
                                <p className="text-orange-400 text-sm font-bold mt-3">
                                    Welcome to the revolution.
                                </p>
                                <button 
                                    onClick={() => { 
                                        setShowLifeboat(false); 
                                        setRedPillPhase(0);
                                        setShowRedPill(true);
                                    }}
                                    className="text-slate-700 text-[10px] mt-2 hover:text-orange-500 transition-colors duration-500"
                                >
                                    take the orange pill
                                </button>
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowLifeboat(false)}>
                                Now go throw some plastic
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Level 5: The Red Pill - Final Radical Easter Egg */}
            {showRedPill && (
                <div 
                    className="fixed inset-0 z-[99999] bg-black cursor-pointer select-none overflow-hidden"
                    onClick={() => {
                        if (redPillPhase >= 2) {
                            setShowRedPill(false);
                            setRedPillPhase(0);
                        }
                    }}
                    style={{
                        animation: redPillPhase === 0 ? 'redpill-glitch 0.8s ease-out forwards' : 'none'
                    }}
                    onAnimationEnd={() => {
                        if (redPillPhase === 0) {
                            setRedPillPhase(1);
                            setTimeout(() => setRedPillPhase(2), 1500);
                        }
                    }}
                >
                    {/* Phase 0 & 1: Screen tear / static effect */}
                    {redPillPhase < 2 && (
                        <>
                            {/* Horizontal scan lines */}
                            <div className="absolute inset-0 pointer-events-none" style={{
                                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.03) 2px, rgba(255,0,0,0.03) 4px)',
                                animation: 'scanlines 0.1s linear infinite'
                            }} />
                            
                            {/* Screen tear effect */}
                            {redPillPhase === 1 && (
                                <div className="absolute inset-0 flex flex-col">
                                    {[...Array(20)].map((_, i) => (
                                        <div 
                                            key={i}
                                            className="flex-1 bg-black"
                                            style={{
                                                transform: `translateX(${Math.sin(i * 0.5) * (Math.random() * 30 - 15)}px)`,
                                                borderTop: i > 0 ? '1px solid rgba(255,0,0,0.2)' : 'none',
                                                animation: `screen-tear-line 0.15s ease-in-out ${i * 0.05}s infinite alternate`
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                            
                            {/* Red flash */}
                            <div 
                                className="absolute inset-0 bg-red-600 pointer-events-none"
                                style={{
                                    animation: 'red-flash 0.3s ease-out forwards',
                                    opacity: redPillPhase === 0 ? 1 : 0
                                }}
                            />
                            
                            {/* Loading text */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-red-500 font-mono text-sm animate-pulse">
                                    {redPillPhase === 0 ? 'SYSTEM OVERRIDE' : 'BREAKING FREE...'}
                                </p>
                            </div>
                        </>
                    )}
                    
                    {/* Phase 2: The Message */}
                    {redPillPhase === 2 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 animate-in fade-in duration-1000">
                            {/* Red glow effect */}
                            <div className="absolute inset-0 bg-gradient-radial from-red-900/20 via-transparent to-transparent pointer-events-none" />
                            
                            <div className="relative z-10 max-w-md text-center space-y-6">
                                <p className="text-red-500 font-mono text-2xl font-bold tracking-wider animate-in slide-in-from-bottom-4 duration-500">
                                    YOU SEE IT NOW.
                                </p>
                                
                                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 delay-300">
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        The taxes. The inflation. The fees. The rules. The licenses. The permits. The regulations. The wars.
                                    </p>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        All designed to keep you running on a hamster wheel while they print money and hand it to their friends.
                                    </p>
                                </div>
                                
                                <div className="pt-4 animate-in slide-in-from-bottom-4 duration-500 delay-500">
                                    <p className="text-white text-lg font-bold">
                                        But you found the exit.
                                    </p>
                                </div>
                                
                                {/* Large Bitcoin Logo */}
                                <div className="pt-6 pb-2 animate-in zoom-in-50 duration-700 delay-600">
                                    <Icons.Bitcoin size={80} className="text-orange-500 mx-auto drop-shadow-[0_0_40px_rgba(249,115,22,0.6)]" />
                                </div>
                                
                                <div className="pt-2 animate-in slide-in-from-bottom-4 duration-500 delay-700">
                                    <p className="text-slate-500 text-xs">
                                        Every sat you stack is a brick in the wall of your freedom.
                                    </p>
                                    <p className="text-slate-500 text-xs mt-1">
                                        Every transaction is a vote against the machine.
                                    </p>
                                </div>
                                
                                <div className="pt-8 animate-in slide-in-from-bottom-4 duration-500 delay-1000">
                                    <p className="text-red-400 font-mono text-xs">
                                        There is no going back.
                                    </p>
                                    <p className="text-orange-500 font-bold text-xl mt-4">
                                        Welcome to the new world.
                                    </p>
                                </div>
                                
                                <p className="text-slate-700 text-xs pt-8 animate-in fade-in duration-500 delay-1500">
                                    [ tap anywhere to return ]
                                </p>
                            </div>
                            
                            {/* Floating particles */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                {[...Array(15)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-1 h-1 bg-red-500/30 rounded-full"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `${Math.random() * 100}%`,
                                            animation: `float-particle ${3 + Math.random() * 4}s ease-in-out infinite`,
                                            animationDelay: `${Math.random() * 2}s`
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Why Three Wallets Modal */}
            {showWhyThreeWallets && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setShowWhyThreeWallets(false); setShowWalletHelp(true); }}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header with Back Button */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button 
                                        onClick={() => { setShowWhyThreeWallets(false); setShowWalletHelp(true); }}
                                        className="p-1 -ml-1 text-slate-400 hover:text-white"
                                    >
                                        <Icons.Back size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                                        <Icons.Help size={20} className="text-brand-primary" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Why Three Wallets?</h3>
                                </div>
                                <button onClick={() => { setShowWhyThreeWallets(false); setShowWalletHelp(true); }} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    <span className="text-amber-400 font-bold">We get it — this might seem confusing.</span> Why can't there just be one wallet?
                                </p>
                            </div>
                            
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Bitcoin is still young, and different wallet types have different trade-offs. We give you <strong className="text-white">three options</strong> so you can pick what works best for you:
                            </p>
                            
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Icons.Zap size={16} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-blue-400 font-bold text-sm">Lightning</p>
                                        <p className="text-slate-400 text-xs">Self-custodial. Your keys, your coins.</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Icons.Cashew size={16} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-emerald-400 font-bold text-sm">Cashu</p>
                                        <p className="text-slate-400 text-xs">Super simple & private. Great for everyday use.</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Icons.Link size={16} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-purple-400 font-bold text-sm">NWC</p>
                                        <p className="text-slate-400 text-xs">Already have a wallet? Connect it and use what you know.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <p className="text-slate-500 text-xs text-center">
                                All three work seamlessly in the app. Switch anytime!
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => { setShowWhyThreeWallets(false); setShowWalletHelp(true); }}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Wallet Help Modal */}
            <WalletHelpModal 
                isOpen={showWalletHelp}
                onClose={() => setShowWalletHelp(false)}
                onLightningClick={() => { setShowWalletHelp(false); setReturnToWalletHelp(true); setShowLightningExplainer(true); }}
                onWhyThreeClick={() => { setShowWalletHelp(false); setShowWhyThreeWallets(true); }}
                onNewToBitcoinClick={() => { setShowWalletHelp(false); setShowFundModal(true); }}
                onSatoshiClick={() => { setShowWalletHelp(false); setShowWhatIsSatoshi(true); }}
                showNewToBitcoin={walletBalance > 0}
            />
            
            {/* ====== SATOSHI RABBIT HOLE ====== */}
            
            {/* Satoshi Level 1: What is a Satoshi? */}
            {showWhatIsSatoshi && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowWhatIsSatoshi(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowWhatIsSatoshi(false); setShowWalletHelp(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                        <Icons.Bitcoin size={20} className="text-orange-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">What is a Satoshi?</h3>
                                </div>
                                <button onClick={() => setShowWhatIsSatoshi(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    A <span className="text-orange-400 font-bold">Satoshi</span> (or "sat") is the smallest unit of Bitcoin — named after Bitcoin's pseudonymous creator, Satoshi Nakamoto.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Math</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    <span className="text-orange-400 font-bold">1 Bitcoin = 100,000,000 satoshis</span>
                                </p>
                                <p className="text-slate-500 text-xs">
                                    That's one hundred million sats per Bitcoin. Just like a dollar has 100 cents, Bitcoin has 100 million sats.
                                </p>
                                <p className="text-slate-500 text-xs mt-2">
                                    At today's price, a single sat is worth a fraction of a cent. Perfect for small payments.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">Why Sats Matter</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Nobody pays for coffee with 0.00004521 BTC. That's unreadable. But <span className="text-orange-400 font-bold">4,521 sats</span>? That makes sense.
                                </p>
                                <p className="text-slate-500 text-xs">
                                    As Bitcoin's value rises, we'll use smaller and smaller fractions. Sats make that practical.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">Think About It</p>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                    In 1920, a burger cost <span className="text-red-400">10 cents</span>. Today it costs <span className="text-red-400">$10</span>. The dollar got weaker.
                                </p>
                                <p className="text-slate-300 text-xs leading-relaxed mt-2">
                                    Today, a burger costs <span className="text-orange-400">~20,000 sats</span>. In the future? Maybe <span className="text-green-400">200 sats</span>. Bitcoin gets stronger.
                                </p>
                            </div>
                            
                            <p className="text-center pt-2">
                                <button 
                                    onClick={() => { setShowWhatIsSatoshi(false); setShowSatoshiPricing(true); }}
                                    className="text-xs text-slate-500 hover:text-orange-400 transition-colors"
                                >
                                    Why does everything get cheaper in sats?
                                </button>
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowWhatIsSatoshi(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Satoshi Level 2: Pricing in Sats vs Dollars */}
            {showSatoshiPricing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowSatoshiPricing(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowSatoshiPricing(false); setShowWhatIsSatoshi(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <Icons.Chart size={20} className="text-green-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">Two Realities</h3>
                                </div>
                                <button onClick={() => setShowSatoshiPricing(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-gradient-to-br from-red-500/10 to-slate-800 border border-red-500/30 rounded-xl p-4">
                                <p className="text-red-400 font-bold text-sm mb-2">Life Priced in Dollars</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Everything gets more expensive. Every year. Forever. Your parents bought a house for $30,000. Now it's $500,000. Your grandparents paid $0.10 for a burger. Now it's $10.
                                </p>
                                <p className="text-slate-500 text-xs mt-2 italic">
                                    This feels normal because you've never known anything else.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-green-500/10 to-slate-800 border border-green-500/30 rounded-xl p-4">
                                <p className="text-green-400 font-bold text-sm mb-2">Life Priced in Sats</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Everything gets cheaper. Every year. Forever. In 2015, a Tesla cost ~250 million sats. In 2024? ~50 million sats. Same car. Fewer sats.
                                </p>
                                <p className="text-slate-500 text-xs mt-2 italic">
                                    This is how money is supposed to work.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Great Reversal</p>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <div className="bg-red-500/10 p-2 rounded-lg text-center">
                                        <p className="text-red-400 text-[10px] font-bold">DOLLAR WORLD</p>
                                        <p className="text-slate-400 text-[10px]">1920: Burger = $0.10</p>
                                        <p className="text-slate-400 text-[10px]">2024: Burger = $10.00</p>
                                        <p className="text-red-400 text-[10px] mt-1">100x MORE</p>
                                    </div>
                                    <div className="bg-green-500/10 p-2 rounded-lg text-center">
                                        <p className="text-green-400 text-[10px] font-bold">SAT WORLD</p>
                                        <p className="text-slate-400 text-[10px]">2024: Burger = 20k sats</p>
                                        <p className="text-slate-400 text-[10px]">2124: Burger = 200 sats</p>
                                        <p className="text-green-400 text-[10px] mt-1">100x LESS</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                                <p className="text-slate-300 text-xs leading-relaxed">
                                    <span className="text-amber-400 font-bold">Price your life in Bitcoin</span> and everything gets cheaper over time.
                                </p>
                                <p className="text-slate-300 text-xs leading-relaxed mt-1">
                                    <span className="text-red-400 font-bold">Price your life in dollars</span> and everything gets more expensive.
                                </p>
                            </div>
                            
                            <p className="text-center pt-2">
                                <button 
                                    onClick={() => { setShowSatoshiPricing(false); setShowDollarCollapse(true); }}
                                    className="text-xs text-slate-500 hover:text-orange-400 transition-colors"
                                >
                                    Why does the dollar keep losing value?
                                </button>
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowSatoshiPricing(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Satoshi Level 3: Dollar Collapse Over Time */}
            {showDollarCollapse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDollarCollapse(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowDollarCollapse(false); setShowSatoshiPricing(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <Icons.Dollar size={20} className="text-red-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">The Dying Dollar</h3>
                                </div>
                                <button onClick={() => setShowDollarCollapse(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            {/* The Big Number */}
                            <div className="text-center py-3 bg-gradient-to-br from-red-500/20 to-red-900/20 border border-red-500/30 rounded-xl">
                                <p className="text-red-400 text-5xl font-black">97%</p>
                                <p className="text-slate-400 text-xs mt-1">purchasing power lost since 1913</p>
                                <p className="text-slate-500 text-[10px] mt-2">
                                    What cost <span className="text-white">$1</span> in 1913 now costs <span className="text-red-400">$31</span>
                                </p>
                            </div>
                            
                            {/* What $100 Bought - Visual Timeline */}
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-3 text-center">What $100 Could Buy</p>
                                <div className="relative">
                                    {/* Vertical line */}
                                    <div className="absolute left-[52px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-500 via-yellow-500 to-red-500"></div>
                                    
                                    <div className="space-y-3">
                                        <div className="flex items-center">
                                            <span className="text-green-400 text-xs font-bold w-12">1913</span>
                                            <div className="w-3 h-3 rounded-full bg-green-500 mx-2 z-10"></div>
                                            <span className="text-white text-xs">A horse and buggy</span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="text-green-300 text-xs font-bold w-12">1950</span>
                                            <div className="w-3 h-3 rounded-full bg-green-400 mx-2 z-10"></div>
                                            <span className="text-white text-xs">A month's rent</span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="text-yellow-400 text-xs font-bold w-12">1980</span>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500 mx-2 z-10"></div>
                                            <span className="text-white text-xs">A week's groceries</span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="text-red-400 text-xs font-bold w-12">2024</span>
                                            <div className="w-3 h-3 rounded-full bg-red-500 mx-2 z-10"></div>
                                            <span className="text-white text-xs">A tank of gas</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* The Silent Theft */}
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">The Silent Theft</p>
                                <div className="space-y-2 text-xs text-slate-400">
                                    <p>Your grandparents raised a family on <span className="text-green-400 font-bold">one income</span>.</p>
                                    <p>Your parents needed <span className="text-yellow-400 font-bold">two incomes</span>.</p>
                                    <p>You need two incomes plus an <span className="text-red-400 font-bold">OnlyFans account</span>.</p>
                                </div>
                                <p className="text-slate-500 text-[10px] mt-3 italic">
                                    You're not lazier. The money keeps getting weaker.
                                </p>
                            </div>
                            
                            {/* Austrian Economist Quote */}
                            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-xs leading-relaxed italic">
                                    "I do not think it is an exaggeration to say history is largely a history of inflation, usually inflations engineered by governments for the gain of governments."
                                </p>
                                <p className="text-amber-400 text-xs mt-2 text-right font-medium">
                                    — Friedrich Hayek
                                </p>
                                <p className="text-slate-600 text-[10px] text-right">
                                    Nobel Prize in Economics, 1974
                                </p>
                            </div>
                            
                            {/* The Double Theft */}
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">The Double Theft</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    They raise your taxes <span className="text-red-400 font-bold">AND</span> print more money. You get hit twice — once when they take from your paycheck, and again when every dollar you have left buys less than it did yesterday.
                                </p>
                                <p className="text-slate-500 text-[10px] mt-2 italic">
                                    The number in your account stays the same. The value doesn't.
                                </p>
                            </div>
                            
                            <p className="text-center pt-2">
                                <button 
                                    onClick={() => { setShowDollarCollapse(false); setShowEmpiresFall(true); }}
                                    className="text-xs text-slate-500 hover:text-orange-400 transition-colors"
                                >
                                    Has this happened before?
                                </button>
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowDollarCollapse(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Satoshi Level 4: Empires Fall */}
            {showEmpiresFall && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowEmpiresFall(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowEmpiresFall(false); setShowDollarCollapse(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <Icons.History size={20} className="text-amber-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">When Empires Fall</h3>
                                </div>
                                <button onClick={() => setShowEmpiresFall(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    History teaches a pattern: <span className="text-amber-400 font-bold">the money dies first, then the empire follows</span>. Not the other way around.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Roman Denarius</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    In 64 AD, the Roman denarius was <span className="text-white">94% silver</span>. By 268 AD, it was <span className="text-red-400">0.02% silver</span>. The coin looked the same. The value was gone.
                                </p>
                                <p className="text-slate-500 text-xs mt-2">
                                    The Roman Empire "officially" fell in 476 AD — 200 years after the money died.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">Every. Single. Time.</p>
                                <div className="space-y-2 text-xs">
                                    <p className="text-slate-400"><span className="text-amber-400">Weimar Germany:</span> Money dies 1923, regime falls 1933</p>
                                    <p className="text-slate-400"><span className="text-amber-400">Soviet Union:</span> Ruble collapses 1989, USSR dissolves 1991</p>
                                    <p className="text-slate-400"><span className="text-amber-400">Yugoslavia:</span> Hyperinflation 1992, country gone 1992</p>
                                    <p className="text-slate-400"><span className="text-amber-400">Zimbabwe:</span> Currency dies 2008, regime change 2017</p>
                                </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-red-500/10 to-amber-500/10 border border-red-500/30 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">The Pattern</p>
                                <ol className="text-slate-400 text-xs space-y-1 ml-4 list-decimal">
                                    <li>Empire needs money for wars and welfare</li>
                                    <li>They debase the currency to pay for it</li>
                                    <li>Citizens lose faith in the money</li>
                                    <li>Society loses faith in the system</li>
                                    <li>The empire collapses</li>
                                </ol>
                                <p className="text-slate-500 text-xs mt-2 italic">
                                    The money is always the first domino.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    The US dollar has lost 97% of its value in 110 years. What happens when it loses the last 3%?
                                </p>
                            </div>
                            
                            <p className="text-center pt-2">
                                <button 
                                    onClick={() => { setShowEmpiresFall(false); setShowBitcoinForever(true); }}
                                    className="text-xs text-slate-500 hover:text-orange-400 transition-colors"
                                >
                                    What makes Bitcoin different?
                                </button>
                            </p>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowEmpiresFall(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Satoshi Level 5: Bitcoin Cannot Be Debased + Fourth Wall Break */}
            {showBitcoinForever && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowBitcoinForever(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => { setShowBitcoinForever(false); setShowEmpiresFall(true); }} className="text-slate-400 hover:text-white p-1 mr-1">
                                        <Icons.Prev size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                        <Icons.Bitcoin size={20} className="text-orange-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">The Unbreakable</h3>
                                </div>
                                <button onClick={() => setShowBitcoinForever(false)} className="text-slate-400 hover:text-white p-1">
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                            {/* Big Number */}
                            <div className="text-center py-2">
                                <p className="text-orange-500 text-4xl font-black tracking-tight">
                                    21,000,000
                                </p>
                                <p className="text-slate-400 text-xs mt-1">
                                    The number that changes everything
                                </p>
                            </div>
                            
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Bitcoin <span className="text-orange-400 font-bold">cannot be debased</span>. There will only ever be 21 million Bitcoin. No emperor, president, or committee can change this.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">Why It's Different</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Every currency in history was controlled by humans. Humans who could be bribed. Threatened. Corrupted. Or simply desperate.
                                </p>
                                <p className="text-slate-400 text-xs leading-relaxed mt-2">
                                    Bitcoin is controlled by <span className="text-orange-400">mathematics</span>. Math doesn't take bribes. Math doesn't have elections. Math doesn't need to fund a war.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <p className="text-white font-bold text-sm">The Promise</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Your great-great-grandchildren will live in a world where their savings <span className="text-green-400 font-bold">grow stronger</span> with time, not weaker.
                                </p>
                                <p className="text-slate-400 text-xs leading-relaxed mt-2">
                                    Where working hard and saving money is rewarded, not punished by inflation.
                                </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-4">
                                <p className="text-white font-bold text-sm mb-2">This Is the End of the Pattern</p>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                    For 5,000 years, empires rose and fell on the back of debased money. Bitcoin breaks the cycle. Not because it's better technology — because it <span className="text-orange-400 font-bold">removes the humans</span> from monetary policy.
                                </p>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-slate-300 text-xs leading-relaxed italic">
                                    Every sat you hold is a vote for a different future. A future where money cannot be weaponized against you.
                                </p>
                                <p className="text-orange-400 text-sm font-bold mt-3">
                                    21 million. Forever.
                                </p>
                                <button 
                                    onClick={() => { 
                                        // Start transmission immediately - overlay has z-[99999] so it covers the modal
                                        setTransmissionPhase(1);
                                        // Then schedule the subsequent phases
                                        setTimeout(() => setTransmissionPhase(2), 1400);
                                        setTimeout(() => setTransmissionPhase(3), 2900);
                                        // Close the modal after a brief delay (it's hidden behind the overlay anyway)
                                        setTimeout(() => setShowBitcoinForever(false), 100);
                                    }}
                                    className="text-slate-700 text-[10px] mt-3 hover:text-orange-500 transition-colors duration-500"
                                >
                                    receive transmission
                                </button>
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800">
                            <Button fullWidth onClick={() => setShowBitcoinForever(false)}>
                                Stack sats, change the future
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Satoshi Final: The Transmission - Fourth Wall Break */}
            {transmissionPhase > 0 && (
                <div 
                    className="fixed inset-0 z-[99999] bg-black cursor-pointer select-none overflow-hidden"
                    onClick={() => transmissionPhase >= 3 ? setTransmissionPhase(0) : null}
                    style={{ fontFamily: 'monospace' }}
                >
                    {/* Phase 1: Static/Interference */}
                    {transmissionPhase === 1 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="absolute inset-0 opacity-20" style={{
                                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
                                animation: 'glitch-static 0.1s infinite'
                            }} />
                            <div className="text-center animate-pulse">
                                <p className="text-orange-500/50 text-xs tracking-[0.5em]">RECEIVING TRANSMISSION</p>
                                <div className="flex justify-center gap-1 mt-2">
                                    <div className="w-2 h-2 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Phase 2: Decoding */}
                    {transmissionPhase === 2 && (
                        <div className="absolute inset-0 flex items-center justify-center p-8">
                            <div className="text-center">
                                <div className="text-orange-500/30 text-[8px] tracking-widest mb-4 animate-pulse">
                                    BLOCK HEIGHT: 2,140,000 | YEAR: 2140 | SATOSHI ERA
                                </div>
                                <p className="text-orange-400 text-lg font-bold animate-in fade-in duration-500">
                                    TRANSMISSION DECODED
                                </p>
                                <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto mt-4 animate-pulse" />
                            </div>
                        </div>
                    )}
                    
                    {/* Phase 3: The Message */}
                    {transmissionPhase === 3 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 animate-in fade-in duration-1000">
                            {/* Subtle orange glow */}
                            <div className="absolute inset-0 bg-gradient-radial from-orange-900/10 via-transparent to-transparent pointer-events-none" />
                            
                            {/* Header - looks like archived transmission */}
                            <div className="absolute top-8 left-0 right-0 text-center">
                                <p className="text-orange-500/20 text-[8px] tracking-[0.3em]">
                                    ARCHIVED TRANSMISSION • ORIGIN: UNKNOWN • TIMESTAMP: ████████
                                </p>
                            </div>
                            
                            <div className="relative z-10 max-w-md text-center space-y-6">
                                <p className="text-orange-500/60 text-xs tracking-widest animate-in slide-in-from-top-4 duration-500">
                                    MESSAGE FROM THE FUTURE
                                </p>
                                
                                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 delay-300">
                                    <p className="text-orange-400 text-xl font-bold leading-relaxed">
                                        We made it.
                                    </p>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        The transition was hard. The old system fought until the end. But here, on the other side, we want you to know:
                                    </p>
                                </div>
                                
                                <div className="py-4 animate-in slide-in-from-bottom-4 duration-500 delay-500">
                                    <p className="text-white text-lg font-medium leading-relaxed">
                                        You were right to stack.
                                    </p>
                                    <p className="text-white text-lg font-medium leading-relaxed">
                                        You were right to believe.
                                    </p>
                                    <p className="text-white text-lg font-medium leading-relaxed">
                                        You were not crazy.
                                    </p>
                                </div>
                                
                                <div className="pt-2 animate-in slide-in-from-bottom-4 duration-500 delay-700">
                                    <p className="text-slate-500 text-xs">
                                        The sats you stack today echo through generations.
                                    </p>
                                    <p className="text-slate-500 text-xs mt-1">
                                        Your great-grandchildren thank you.
                                    </p>
                                </div>
                                
                                <div className="pt-6 animate-in fade-in duration-500 delay-1000">
                                    <Icons.Bitcoin size={40} className="text-orange-500 mx-auto drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]" />
                                </div>
                                
                                <p className="text-orange-500/40 text-xs pt-4 animate-in fade-in duration-500 delay-1500 tracking-widest">
                                    21 MILLION. FOREVER.
                                </p>
                                
                                <p className="text-slate-700 text-xs pt-6 animate-in fade-in duration-500 delay-2000">
                                    [ tap anywhere to return ]
                                </p>
                            </div>
                            
                            {/* Scan lines effect */}
                            <div className="absolute inset-0 pointer-events-none opacity-5" style={{
                                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(249,115,22,0.1) 2px, rgba(249,115,22,0.1) 4px)'
                            }} />
                        </div>
                    )}
                </div>
            )}
            
            {/* THE MATRIX - Level 3: Rock Bottom */}
            {rabbitHoleLevel === 3 && (
                <div 
                    className="fixed inset-0 z-[99999] bg-black cursor-pointer select-none"
                    onClick={handleMatrixExit}
                    style={{ touchAction: 'none' }}
                >
                    {/* CRT Scanlines */}
                    <div 
                        className="absolute inset-0 pointer-events-none opacity-10"
                        style={{
                            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,0,0.03) 1px, rgba(0,255,0,0.03) 2px)',
                            backgroundSize: '100% 2px'
                        }}
                    />
                    
                    {/* Blinking cursor / Matrix terminal */}
                    <div className="absolute top-8 left-6 right-6 font-mono text-green-500 text-sm leading-relaxed">
                        {/* Blinking cursor before text starts */}
                        {!matrixText && (
                            <span className="animate-pulse">█</span>
                        )}
                        
                        {/* Typewriter text with blinking cursor */}
                        <div className="whitespace-pre-wrap">
                            {matrixText}
                            {matrixText && !matrixComplete && (
                                <span className="animate-pulse">█</span>
                            )}
                        </div>
                        
                        {/* Click to exit prompt */}
                        {matrixClickable && (
                            <div className="mt-8 animate-pulse text-green-400/60 text-xs">
                                [ tap anywhere to exit ]
                            </div>
                        )}
                    </div>
                    
                    {/* Subtle CRT glow effect */}
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'radial-gradient(ellipse at center, rgba(0,255,0,0.03) 0%, transparent 70%)',
                        }}
                    />
                </div>
            )}
            
        </div >
    );
};
