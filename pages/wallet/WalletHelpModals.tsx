/**
 * @file WalletHelpModals.tsx
 *
 * Reusable help/info modal components extracted from the Wallet page.
 *
 * Components:
 * - **HelpModal** -- generic dismissible modal that renders an HTML string body.
 *   Supports an optional `onAction` callback for interactive elements with
 *   `data-action` attributes inside the HTML content.
 * - **ExpandableWalletTile** -- collapsible card explaining a wallet type
 *   (Breez Lightning / Cashu eCash / NWC). Used inside the WalletHelpModal
 *   to educate users about the three wallet options.
 * - **WalletHelpModal** (exported below) -- full wallet education modal
 *   combining three ExpandableWalletTiles with a recommendation section.
 */

import React, { useState } from 'react';
import { Icons } from '../../components/Icons';
import { Button } from '../../components/Button';

/**
 * Generic help modal that renders HTML content with an optional action callback.
 * Used throughout the Wallet page for contextual help on features.
 */
export const HelpModal: React.FC<{
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

/**
 * Expandable wallet info tile that shows a summary line and toggles to reveal
 * a detailed description of the wallet type. Color-coded by wallet.
 */
export const ExpandableWalletTile: React.FC<{
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
                className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="px-3 pb-3 pt-1 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400 leading-relaxed">{c.details}</p>
                </div>
            </div>
        </div>
    );
};

/**
 * Full wallet education modal combining three ExpandableWalletTiles (Breez, Cashu, NWC)
 * with additional links to "What is Lightning?", "Why 3 wallets?", "New to Bitcoin?",
 * and "Who is Satoshi?" help content. Shown from the Wallet tab's help button.
 */
export const WalletHelpModal: React.FC<{
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
                        <p className="font-bold text-white mb-2">Quick Tips:</p>
                        <ul className="list-disc ml-5 space-y-1 text-sm text-slate-300">
                            <li><strong>Tap your balance</strong> to see USD value</li>
                            <li><strong>Pull down</strong> to refresh your balance</li>
                        </ul>
                    </div>

                    <div>
                        <div className="flex items-center space-x-2 mb-2">
                            <p className="font-bold text-white">Three Wallet Options</p>
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
