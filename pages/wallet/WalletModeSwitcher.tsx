/**
 * @file WalletModeSwitcher.tsx
 *
 * Casual-user wallet selector. Breez is presented as the recommended default,
 * while Cashu and NWC live under advanced/fallback options.
 */

import React from 'react';
import { Icons } from '../../components/Icons';
import { getWalletModeUxOptions, type WalletModeId } from './walletModeUx';

const modeColors: Record<WalletModeId | 'all', { active: string; inactive: string; icon: string; border: string }> = {
    all: {
        active: 'bg-orange-500/20 border-orange-500/40',
        inactive: 'bg-black/30 border-white/10 hover:border-orange-500/30',
        icon: 'text-orange-400',
        border: 'border-orange-500/40',
    },
    breez: {
        active: 'bg-blue-500/20 border-blue-500/50',
        inactive: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40',
        icon: 'text-blue-400',
        border: 'border-blue-500/50',
    },
    cashu: {
        active: 'bg-emerald-500/20 border-emerald-500/50',
        inactive: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40',
        icon: 'text-emerald-400',
        border: 'border-emerald-500/50',
    },
    nwc: {
        active: 'bg-purple-500/20 border-purple-500/50',
        inactive: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40',
        icon: 'text-purple-400',
        border: 'border-purple-500/50',
    },
};

const modeIcons: Record<WalletModeId, React.FC<{ size?: number; className?: string }>> = {
    breez: Icons.Zap,
    cashu: Icons.Cashew,
    nwc: Icons.Link,
};

/**
 * Wallet selector with a recommended primary path and clear recovery copy for
 * unconfigured advanced modes.
 */
export const WalletModeSwitcher: React.FC<{
    activeMode: WalletModeId;
    viewMode: 'all' | WalletModeId;
    isExpanded: boolean;
    isNwcConnected: boolean;
    hasBreezWallet: boolean;
    hasCashuMint: boolean;
    onExpandToggle: () => void;
    onWalletSelect: (mode: WalletModeId) => void;
    onConfigureWallet: (mode: WalletModeId) => void;
}> = ({ activeMode, viewMode, isExpanded, isNwcConnected, hasBreezWallet, hasCashuMint, onExpandToggle, onWalletSelect, onConfigureWallet }) => {
    const options = getWalletModeUxOptions({ hasBreezWallet, hasCashuMint, isNwcConnected });

    const renderModeButton = (option: typeof options.primary, variant: 'primary' | 'advanced') => {
        const colors = modeColors[option.id];
        const IconComponent = modeIcons[option.id];
        const isActive = viewMode === option.id || (viewMode === 'all' && activeMode === option.id && option.id === 'breez');
        const shouldConfigure = option.id === 'nwc' && !isNwcConnected;

        return (
            <button
                key={option.id}
                type="button"
                onClick={() => shouldConfigure ? onConfigureWallet(option.id) : onWalletSelect(option.id)}
                className={`w-full rounded-xl border text-left transition-all active:scale-[0.99] ${isActive ? colors.active : colors.inactive} ${variant === 'primary' ? 'p-4' : 'p-3'}`}
            >
                <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-lg bg-black/20 ${variant === 'primary' ? 'p-2.5' : 'p-2'}`}>
                        <IconComponent size={variant === 'primary' ? 22 : 18} className={colors.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">{option.label}</span>
                            {option.badge && (
                                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-300 border border-blue-500/30">
                                    {option.badge}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{option.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`text-[11px] font-medium ${option.isConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {option.status}
                            </span>
                            <span className="text-[11px] font-bold text-slate-200 underline decoration-white/20 underline-offset-2">
                                {option.actionLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </button>
        );
    };

    return (
        <div className="w-full max-w-full rounded-2xl bg-black/30 p-2 border border-white/10 backdrop-blur-sm">
            <button
                type="button"
                onClick={onExpandToggle}
                className={`w-full rounded-xl border p-3 text-left transition-all active:scale-[0.99] ${viewMode === 'all' && !isExpanded ? modeColors.all.active : modeColors.all.inactive}`}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Icons.Bitcoin size={24} className={modeColors.all.icon} />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white">Wallet overview</p>
                            <p className="text-xs leading-snug text-slate-400">Breez recommended · score without payments anytime</p>
                        </div>
                    </div>
                    <Icons.Next
                        size={16}
                        className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                </div>
            </button>

            {isExpanded && (
                <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1">
                    {renderModeButton(options.primary, 'primary')}

                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Advanced / fallback</p>
                            <span className="text-[10px] text-slate-500">optional</span>
                        </div>
                        <div className="space-y-2">
                            {options.advanced.map(option => renderModeButton(option, 'advanced'))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                        <p className="text-xs leading-relaxed text-orange-200">{options.scorekeepingOnly}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
