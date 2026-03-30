/**
 * @file HomeCustomizeView.tsx
 *
 * Step 3 (final) of the round creation wizard: payments, payout rules, and round start.
 *
 * Two tabs:
 * 1. **Players** -- shows all players with payment status (paid/unpaid/excluded).
 *    The host can pay for cardmates, resend payment requests, copy invoices,
 *    or open a Lightning wallet to pay. Each player card shows entry fee and
 *    ace pot participation. A funding guide modal helps new users deposit sats.
 *
 * 2. **Settings** -- configures payout distribution (winner-take-all vs. percentage-based),
 *    payout gradient (top-heavy vs. linear), ace pot redistribution policy,
 *    player handicaps, starting hole, honor system toggle, and tee order info.
 *
 * The "Start Round" button creates the round on Nostr and navigates to the scorecard.
 * Shows a confirmation modal before starting if there are unpaid players.
 */

import React from 'react';
import { Icons } from '../../components/Icons';
import { Button } from '../../components/Button';
import { FundingGuide } from '../../components/FundingGuide';
import { SuccessOverlay } from './SuccessOverlay';
import { HomeCustomizeViewProps } from './homeTypes';

/**
 * Customize/payments view -- final wizard step before round creation.
 * Manages player payment tracking, payout configuration, and round start.
 */
export const HomeCustomizeView: React.FC<HomeCustomizeViewProps> = ({
    paymentRequestsSent,
    paymentRequestCount,
    onResendPaymentRequests,
    isResendingRequests,
    allPlayers,
    selectedCardmates,
    paidStatus,
    paymentSelections,
    showPaymentModal,
    setShowPaymentModal,
    paymentTarget,
    paymentInvoice,
    isGeneratingInvoice,
    isPayingWallet,
    paymentSuccess,
    paymentError,
    showFundingGuide,
    setShowFundingGuide,
    payoutMode,
    setPayoutMode,
    payoutPercentage,
    setPayoutPercentage,
    customPayoutPercentage,
    setCustomPayoutPercentage,
    payoutGradient,
    setPayoutGradient,
    acePotRedistribution,
    setAcePotRedistribution,
    handicapEnabled,
    setHandicapEnabled,
    playerHandicaps,
    setPlayerHandicaps,
    startHoleEnabled,
    setStartHoleEnabled,
    startHole,
    setStartHole,
    useHonorSystem,
    setUseHonorSystem,
    showTeeOrderInfo,
    setShowTeeOrderInfo,
    customizeTab,
    setCustomizeTab,
    hasEntryFee,
    entryFee,
    acePot,
    layout,
    customHoles,
    openPaymentModal,
    handlePayWithWallet,
    handleOpenLightningWallet,
    handleCopyInvoice,
    handleStartRound,
    currentUserPubkey,
    userProfile,
    showPaymentsHelp,
    setShowPaymentsHelp,
    setView,
    goToSettings,
    formatAmount,
    walletBalance,
    getMagicLightningAddress,
    getTopHeavyDistribution,
    getLinearDistribution,
}) => {
    // Calculate dynamic totals based on player selections
    let totalEntryPot = 0;
    let totalAcePot = 0;
    allPlayers.forEach(p => {
        const payment = paymentSelections[p.pubkey] || { entry: true, ace: true };
        if (payment.entry && entryFee > 0) totalEntryPot += entryFee;
        if (payment.ace && acePot > 0) totalAcePot += acePot;
    });

    return (
        <>
            <div className="flex flex-col h-full p-6 pb-24">
                {/* Header - Wallet style */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                        <button
                            onClick={() => setView('select_players')}
                            className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                        >
                            <Icons.Prev />
                        </button>
                        <h1 className="text-2xl font-bold flex items-center">
                            <Icons.Zap className="mr-2 text-orange-400" /> Payment
                        </h1>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setShowPaymentsHelp(true)}
                            className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            <Icons.Help size={20} />
                        </button>
                        <button
                            onClick={goToSettings}
                            className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            <Icons.Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Players / Settings Tab Switcher */}
                <div className="flex bg-black/30 backdrop-blur-sm p-1 rounded-xl mb-3 border border-white/10">
                    <button
                        onClick={() => setCustomizeTab('players')}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${
                            customizeTab === 'players'
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 shadow-[0_0_15px_rgba(251,146,60,0.2)]'
                                : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                    >
                        Players
                    </button>
                    <button
                        onClick={() => setCustomizeTab('settings')}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${
                            customizeTab === 'settings'
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 shadow-[0_0_15px_rgba(251,146,60,0.2)]'
                                : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                    >
                        Round Settings
                    </button>
                </div>

                {/* Payment Requests Sent Banner */}
                {paymentRequestsSent && hasEntryFee && (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5 mb-3">
                        <div className="flex items-center space-x-2">
                            <Icons.CheckMark size={14} className="text-emerald-400" />
                            <span className="text-xs font-semibold text-emerald-400">
                                Payment requests sent to {paymentRequestCount} player{paymentRequestCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <button
                            onClick={onResendPaymentRequests}
                            disabled={isResendingRequests}
                            className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                            {isResendingRequests ? 'Sending...' : 'Resend'}
                        </button>
                    </div>
                )}

                {/* Dynamic Pot Totals with integrated Customize Round */}
                {hasEntryFee && (entryFee > 0 || acePot > 0) && (
                    <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-2xl border border-white/10 backdrop-blur-sm mb-3 overflow-hidden">
                        {/* Total Pot Header - Always Visible */}
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                        <Icons.Zap size={16} className="text-orange-400" />
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pot</h3>
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {formatAmount(totalEntryPot + totalAcePot)}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {entryFee > 0 && (
                                    <div className="bg-black/30 rounded-xl p-3 border border-white/10">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Entry Fee</p>
                                        <p className="text-lg font-bold text-orange-400">{totalEntryPot.toLocaleString()} <span className="text-xs text-slate-400">sats</span></p>
                                    </div>
                                )}
                                {acePot > 0 && (
                                    <div className="bg-black/30 rounded-xl p-3 border border-white/10">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ace Pot</p>
                                        <p className="text-lg font-bold text-emerald-400">{totalAcePot.toLocaleString()} <span className="text-xs text-slate-400">sats</span></p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* Round Settings - Only visible on Settings tab */}
                {customizeTab === 'settings' && (
                    <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-2xl border border-white/10 backdrop-blur-sm mb-3 overflow-hidden">
                        <div className="p-5 space-y-4">
                                {/* Payout Distribution Mode */}
                                {hasEntryFee && entryFee > 0 && (
                                    <div className="space-y-3 pt-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payout Distribution</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setPayoutMode('winner-take-all')}
                                                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${payoutMode === 'winner-take-all'
                                                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                    : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                                                    }`}
                                            >
                                                Winner Take All
                                            </button>
                                            <button
                                                onClick={() => setPayoutMode('percentage-based')}
                                                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${payoutMode === 'percentage-based'
                                                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                    : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                                                    }`}
                                            >
                                                Top % of Players
                                            </button>
                                        </div>

                                        {/* Percentage Threshold Input */}
                                        {payoutMode === 'percentage-based' && (
                                            <div className="space-y-2">
                                                <span className="text-sm font-bold text-slate-300">% of players paid</span>
                                                <div className="flex space-x-2">
                                                    {[20, 30, 40].map(pct => (
                                                        <button
                                                            key={pct}
                                                            onClick={() => setPayoutPercentage(pct)}
                                                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${payoutPercentage === pct
                                                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                                : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                                                                }`}
                                                        >
                                                            {pct}%
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setPayoutPercentage(customPayoutPercentage)}
                                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${![20, 30, 40].includes(payoutPercentage)
                                                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                            : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                                                            }`}
                                                    >
                                                        Custom
                                                    </button>
                                                </div>
                                                {![20, 30, 40].includes(payoutPercentage) && (
                                                    <div className="flex items-center justify-between bg-black/30 rounded-xl p-3 border border-white/10 animate-in slide-in-from-top-2">
                                                        <span className="text-sm text-slate-400">Custom Percentage</span>
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="100"
                                                                value={customPayoutPercentage}
                                                                onChange={(e) => {
                                                                    const val = Math.min(100, Math.max(1, parseInt(e.target.value) || 0));
                                                                    setCustomPayoutPercentage(val);
                                                                    setPayoutPercentage(val);
                                                                }}
                                                                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white w-16 text-center outline-none focus:ring-2 focus:ring-orange-500"
                                                            />
                                                            <span className="text-sm text-slate-400">%</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Payout Gradient */}
                                        {payoutMode === 'percentage-based' && (
                                            <>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payout Gradient</h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => setPayoutGradient('top-heavy')}
                                                        className={`px-3 py-3 rounded-xl text-xs font-bold border transition-all ${payoutGradient === 'top-heavy'
                                                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                            : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <div>Top-Heavy</div>
                                                        <div className="text-[9px] text-slate-500 mt-1">
                                                            {(() => {
                                                                const numPlayers = selectedCardmates.length + 1;
                                                                const numWinners = Math.max(1, Math.ceil(numPlayers * (payoutPercentage / 100)));
                                                                const dist = getTopHeavyDistribution(numWinners);
                                                                return dist.map(p => `${Math.round(p * 100)}%`).join(' / ');
                                                            })()}
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => setPayoutGradient('linear')}
                                                        className={`px-3 py-3 rounded-xl text-xs font-bold border transition-all ${payoutGradient === 'linear'
                                                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                            : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <div>Flat</div>
                                                        <div className="text-[9px] text-slate-500 mt-1">
                                                            {(() => {
                                                                const numPlayers = selectedCardmates.length + 1;
                                                                const numWinners = Math.max(1, Math.ceil(numPlayers * (payoutPercentage / 100)));
                                                                const dist = getLinearDistribution(numWinners);
                                                                return dist.map(p => `${Math.round(p * 100)}%`).join(' / ');
                                                            })()}
                                                        </div>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Ace Pot Redistribution - Compact */}
                                {hasEntryFee && acePot > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">If No Ace</h4>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {[
                                                { value: 'add-to-entry-pot' as const, label: '+ Entry', icon: '\u{1F3C6}' },
                                                { value: 'redistribute-to-participants' as const, label: 'Split', icon: '\u21A9\uFE0F' },
                                                { value: 'forfeit' as const, label: 'Forfeit', icon: '\u274C' },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => setAcePotRedistribution(option.value)}
                                                    className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all text-center ${acePotRedistribution === option.value
                                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    <div className="text-sm mb-0.5">{option.icon}</div>
                                                    <div>{option.label}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tee Order Toggle - Moved under If No Ace */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1.5">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tee Order</h4>
                                        <button
                                            onClick={() => setShowTeeOrderInfo(true)}
                                            className="text-slate-500 hover:text-slate-300 transition-colors"
                                        >
                                            <Icons.Help size={12} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setUseHonorSystem(!useHonorSystem)}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${useHonorSystem ? 'bg-brand-secondary' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${useHonorSystem ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Handicap Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Handicap</h4>
                                        <button
                                            onClick={() => setHandicapEnabled(!handicapEnabled)}
                                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${handicapEnabled ? 'bg-brand-secondary' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${handicapEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    {handicapEnabled && (
                                        <p className="text-[10px] text-slate-500">
                                            Adjust starting scores for each player using the +/- buttons on their player tiles above.
                                        </p>
                                    )}
                                </div>

                                {/* Custom Starting Hole */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Starting Hole</h4>
                                        <button
                                            onClick={() => {
                                                setStartHoleEnabled(!startHoleEnabled);
                                                if (startHoleEnabled) setStartHole(1); // Reset to hole 1 when disabled
                                            }}
                                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${startHoleEnabled ? 'bg-brand-secondary' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${startHoleEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {startHoleEnabled && (
                                        <div className="grid grid-cols-6 gap-2 animate-in slide-in-from-top-2 duration-300">
                                            {Array.from({ length: layout === '9' ? 9 : layout === '18' ? 18 : customHoles }, (_, i) => i + 1).map((holeNum) => (
                                                <button
                                                    key={holeNum}
                                                    onClick={() => setStartHole(holeNum)}
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${startHole === holeNum
                                                        ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
                                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {holeNum}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                        </div>
                    </div>
                )}

                {/* === BASIC TAB: Player list, payments, start button === */}
                {customizeTab === 'players' && (<>
                <div className="flex-1 overflow-y-auto space-y-3">
                    <div className="space-y-3">
                        {allPlayers.map((p, idx) => {
                            const isPaid = paidStatus[p.pubkey] || false;
                            const payment = paymentSelections[p.pubkey] || { entry: true, ace: true };
                            const isHost = (p as any).isHost;
                            const totalAmount = entryFee + acePot;

                            // Determine what the player owes
                            const owesEntry = hasEntryFee && entryFee > 0 && payment.entry;
                            const owesAce = hasEntryFee && acePot > 0 && payment.ace;
                            const owesAnything = owesEntry || owesAce;

                            return (
                                <div key={p.pubkey} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                                    <div className="flex items-center justify-between gap-3">
                                        {/* Player Info */}
                                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                                            <span className="font-bold text-sm text-slate-500 w-5">{idx + 1}</span>
                                            <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                                {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-500" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-sm truncate text-white leading-tight">{p.name} {isHost && '(You)'}</p>
                                                <p className="text-[10px] text-slate-400 truncate leading-tight">
                                                    {(() => {
                                                        const nip05Value = p.nip05 ? String(p.nip05) : '';
                                                        return nip05Value ? (nip05Value.length > 18 ? nip05Value.substring(0, 15) + '...' : nip05Value) : 'Nostr User';
                                                    })()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Payment Status */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {hasEntryFee && owesAnything && (
                                                <button
                                                    onClick={() => openPaymentModal(p)}
                                                    className="relative shrink-0"
                                                >
                                                    {isPaid ? (
                                                        <div className="w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                                                            <Icons.CheckMark size={16} className="text-green-500" strokeWidth={3} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
                                                            <Icons.Dollar size={14} className="text-red-500" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Handicap Controls - separate row below player info */}
                                    {handicapEnabled && (
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Handicap</span>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => setPlayerHandicaps(prev => ({ ...prev, [p.pubkey]: Math.max(-3, (prev[p.pubkey] || 0) - 1) }))}
                                                    className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-white text-sm font-bold transition-colors"
                                                >
                                                    -
                                                </button>
                                                <div className={`w-10 h-8 flex items-center justify-center rounded-lg text-sm font-bold border ${
                                                    (playerHandicaps[p.pubkey] || 0) > 0
                                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                                        : (playerHandicaps[p.pubkey] || 0) < 0
                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                            : 'bg-slate-900 border-slate-600 text-white'
                                                }`}>
                                                    {(playerHandicaps[p.pubkey] || 0) > 0 ? '+' : ''}{playerHandicaps[p.pubkey] || 0}
                                                </div>
                                                <button
                                                    onClick={() => setPlayerHandicaps(prev => ({ ...prev, [p.pubkey]: Math.min(3, (prev[p.pubkey] || 0) + 1) }))}
                                                    className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-white text-sm font-bold transition-colors"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>


                </div>

                <div className="fixed bottom-20 left-0 right-0 bg-brand-dark border-t border-slate-800 p-4 max-w-md mx-auto z-20">
                    {(() => {
                        // Calculate unpaid players count
                        const playersNeedingPayment = allPlayers.filter(p => {
                            const payment = paymentSelections[p.pubkey] || { entry: true, ace: true };
                            const owesEntry = hasEntryFee && entryFee > 0 && payment.entry;
                            const owesAce = hasEntryFee && acePot > 0 && payment.ace;
                            const owesAnything = owesEntry || owesAce;
                            const isPaid = paidStatus[p.pubkey] || false;
                            return owesAnything && !isPaid;
                        });

                        const unpaidCount = playersNeedingPayment.length;
                        const allPaid = unpaidCount === 0;

                        return (
                            <Button
                                fullWidth
                                onClick={() => allPaid ? handleStartRound() : undefined}
                                disabled={!allPaid}
                                className={`font-bold py-4 rounded-full shadow-lg transition-all ${allPaid
                                    ? 'bg-brand-accent text-black shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-pulse'
                                    : 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse'
                                    }`}
                            >
                                {allPaid ? 'Start Round' : `Waiting for Payments (${unpaidCount})`}
                            </Button>
                        );
                    })()}
                </div>
                </>)}

                {/* === ADVANCED TAB: Player list with handicap controls === */}
                {customizeTab === 'settings' && handicapEnabled && (
                <div className="flex-1 overflow-y-auto space-y-3">
                    <div className="space-y-3">
                        {allPlayers.map((p, idx) => {
                            const isHost = (p as any).isHost;

                            return (
                                <div key={p.pubkey} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                                    <div className="flex items-center justify-between gap-3">
                                        {/* Player Info */}
                                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                                            <span className="font-bold text-sm text-slate-500 w-5">{idx + 1}</span>
                                            <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                                {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-500" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-sm truncate text-white leading-tight">{p.name} {isHost && '(You)'}</p>
                                            </div>
                                        </div>

                                        {/* Handicap Controls */}
                                        <div className="flex items-center space-x-2 shrink-0">
                                            <button
                                                onClick={() => setPlayerHandicaps(prev => ({ ...prev, [p.pubkey]: Math.max(-3, (prev[p.pubkey] || 0) - 1) }))}
                                                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-white text-sm font-bold transition-colors"
                                            >
                                                -
                                            </button>
                                            <div className={`w-10 h-8 flex items-center justify-center rounded-lg text-sm font-bold border ${
                                                (playerHandicaps[p.pubkey] || 0) > 0
                                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                                    : (playerHandicaps[p.pubkey] || 0) < 0
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                        : 'bg-slate-900 border-slate-600 text-white'
                                            }`}>
                                                {(playerHandicaps[p.pubkey] || 0) > 0 ? '+' : ''}{playerHandicaps[p.pubkey] || 0}
                                            </div>
                                            <button
                                                onClick={() => setPlayerHandicaps(prev => ({ ...prev, [p.pubkey]: Math.min(3, (prev[p.pubkey] || 0) + 1) }))}
                                                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-white text-sm font-bold transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* PAYMENT MODAL */}
                {
                    showPaymentModal && paymentTarget && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative overflow-hidden">

                                {paymentSuccess && (
                                    <SuccessOverlay message="Paid!" onClose={() => {/* handled by timeout */ }} />
                                )}

                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                                >
                                    <Icons.Close size={24} />
                                </button>

                                <div className="text-center space-y-4 pt-2">
                                    {/* Simplified header - host-centric perspective */}
                                    <h3 className="text-xl font-bold text-white">Pay Your Entry Fee</h3>
                                    <p className="text-slate-400 text-sm">
                                        Complete the entry fee payment for <span className="text-white font-bold">{paymentTarget.name}</span>.
                                    </p>

                                    {/* Error Banner with Fund Wallet CTA */}
                                    {paymentError && (
                                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-start space-x-2 text-left">
                                                <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={16} />
                                                <p className="text-xs text-red-200 font-bold leading-tight">{paymentError}</p>
                                            </div>
                                            {paymentError.includes('Insufficient') && (
                                                <button
                                                    onClick={() => setShowFundingGuide(true)}
                                                    className="mt-2 w-full py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center space-x-1.5"
                                                >
                                                    <Icons.Zap size={14} />
                                                    <span>Fund Wallet with Cash App or Strike</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Funding Guide Modal */}
                                    {showFundingGuide && (
                                        <FundingGuide
                                            lightningAddress={userProfile.lud16 || getMagicLightningAddress(currentUserPubkey)}
                                            amountNeeded={Math.max(0, (entryFee + acePot) - walletBalance)}
                                            onClose={() => setShowFundingGuide(false)}
                                        />
                                    )}

                                    {/* Amount Display - Moved BEFORE QR Code */}
                                    <div>
                                        <p className="text-2xl font-bold text-brand-accent">{formatAmount(entryFee + acePot)}</p>
                                        <p className="text-xs text-slate-500">Entry: {formatAmount(entryFee)} | Ace Pot: {formatAmount(acePot)}</p>
                                    </div>

                                    {/* Inline Copy Invoice */}
                                    {!isGeneratingInvoice && (
                                        <div
                                            onClick={handleCopyInvoice}
                                            className="flex items-center justify-center space-x-2 mb-2 cursor-pointer text-brand-primary hover:text-brand-accent transition-colors"
                                        >
                                            <span className="text-xs font-mono opacity-80">
                                                {paymentInvoice.slice(0, 8)}...{paymentInvoice.slice(-8)}
                                            </span>
                                            <Icons.Copy size={12} />
                                        </div>
                                    )}

                                    {/* QR Code Block with Pulse and Colorful Border */}
                                    <div className={`bg-gradient-to-br from-emerald-400 via-cyan-500 to-teal-600 p-1 rounded-2xl shadow-2xl shadow-cyan-500/30 inline-block mx-auto ${!isGeneratingInvoice && !paymentSuccess ? 'qr-pulse' : ''}`}>
                                        <div className="bg-white p-3 rounded-xl relative min-h-[200px] min-w-[200px] flex items-center justify-center">
                                            {isGeneratingInvoice ? (
                                                <div className="flex flex-col items-center">
                                                    <Icons.Zap className="text-brand-accent animate-bounce mb-2" size={32} />
                                                    <span className="text-slate-900 text-xs font-bold">Generating Invoice...</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentInvoice)}`}
                                                    className="w-48 h-48"
                                                    alt="Payment QR"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Listening Indicator - Moved Closer */}
                                    {!isGeneratingInvoice && !paymentSuccess && (
                                        <div className="pt-2 flex items-center justify-center space-x-2 text-brand-primary animate-pulse">
                                            <Icons.Zap size={14} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Listening for payment...</span>
                                        </div>
                                    )}

                                    {/* Payment Actions */}
                                    <div className="pt-4 space-y-3">
                                        {/* Primary Pay with App Wallet */}
                                        <Button
                                            fullWidth
                                            onClick={handlePayWithWallet}
                                            className="text-sm py-3 button-gleam"
                                            disabled={isPayingWallet}
                                        >
                                            <div className="flex items-center justify-center space-x-2">
                                                <span>{isPayingWallet ? 'Processing...' : `Pay ${formatAmount(entryFee + acePot)} with App Wallet`}</span>
                                                <Icons.Wallet size={18} />
                                            </div>
                                        </Button>

                                        {/* External Wallet */}
                                        <Button
                                            fullWidth
                                            onClick={handleOpenLightningWallet}
                                            variant="secondary"
                                            className="text-xs py-2"
                                        >
                                            Open Lightning Wallet
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

            </div>

            {/* TEE ORDER INFO MODAL */}
            {
                showTeeOrderInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-brand-secondary/20 rounded-xl flex items-center justify-center">
                                        <Icons.Users size={20} className="text-brand-secondary" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Tee Order</h3>
                                </div>
                                <button
                                    onClick={() => setShowTeeOrderInfo(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <Icons.Close size={20} />
                                </button>
                            </div>
                            <div className="space-y-3 text-sm text-slate-300">
                                <p>
                                    When enabled, the player who scored best on the previous hole will tee off first on the next hole.
                                </p>
                                <p className="text-slate-400 text-xs">
                                    This follows the traditional "honor system" in disc golf where the best performer earns the honor of throwing first.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowTeeOrderInfo(false)}
                                className="w-full mt-5 bg-brand-secondary text-black font-bold py-3 rounded-xl hover:bg-brand-secondary/90 transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                )
            }

            {/* PAYMENTS HELP MODAL */}
            {showPaymentsHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
                        <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex items-center justify-between z-10">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                <Icons.Zap className="mr-2 text-orange-400" size={22} /> Payment
                            </h2>
                            <button
                                onClick={() => setShowPaymentsHelp(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <Icons.Close size={24} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Overview */}
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Review the total pot, configure payout rules, and confirm all player buy-ins before starting the round.
                            </p>

                            {/* Total Pot */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Zap className="text-orange-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Total Pot</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    The combined total of all <span className="text-orange-400 font-medium">Entry Fees</span> and
                                    <span className="text-emerald-400 font-medium"> Ace Pot</span> contributions.
                                    This amount is distributed to winners when the round ends.
                                </p>
                            </div>

                            {/* Customize Round */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Settings className="text-blue-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Customize Round</h3>
                                </div>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    <li className="flex items-start space-x-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 shrink-0" />
                                        <span><strong className="text-white">Payout Distribution</strong> — Winner-take-all or split among top % of players</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                                        <span><strong className="text-white">If No Ace</strong> — What happens to the ace pot if nobody hits one</span>
                                    </li>
                                    <li className="flex items-start space-x-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                                        <span><strong className="text-white">Tee Order</strong> — Sort players by previous hole performance (honor system)</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Player List */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Users className="text-cyan-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Player Payments</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Each player shows their participation in <span className="text-orange-400 font-medium">Entry</span> and
                                    <span className="text-emerald-400 font-medium"> Ace</span> pools.
                                    The checkmark indicates payment status. Players can pay their buy-in via the round details page.
                                </p>
                            </div>

                            {/* What Happens Next */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Play className="text-purple-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Starting the Round</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    When you tap <span className="text-emerald-400 font-medium">Start Round</span>, the scorecard opens and all players
                                    are notified. <span className="text-orange-400 font-medium">Payments are handled on the honor system</span> —
                                    you can start even if not everyone has paid yet.
                                </p>
                            </div>

                            {/* Automatic Payouts */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Zap className="text-amber-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Automatic Payouts</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    When you finalize the round, winnings are <span className="text-amber-400 font-medium">automatically sent</span> to
                                    the winners' Lightning addresses via encrypted DM. No IOUs, no trust required!
                                </p>
                            </div>

                            <div className="pt-2">
                                <Button fullWidth onClick={() => setShowPaymentsHelp(false)} variant="secondary">
                                    Got it
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
