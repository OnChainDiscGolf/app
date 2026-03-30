/**
 * @file HomeMenuView.tsx
 *
 * Landing view of the Home/Play tab -- the first screen users see.
 *
 * Key sections and user interactions:
 * - **Active round banner** -- resume an in-progress round or view the scorecard.
 * - **Wallet balance pill** -- color-coded indicator of total sats balance.
 * - **Create Round** -- starts the round creation wizard (setup -> players -> customize).
 * - **Join Round** -- dual-mode: "My QR" shows the user's identity QR for hosts to scan,
 *   and "Scan to Join" opens a QR scanner to scan a host's round/tournament QR code.
 * - **Create Tournament** -- navigates to the tournament creation flow.
 * - **Draft restoration** -- if a previous round setup was interrupted, prompts the user
 *   to resume or discard the saved draft (from localStorage).
 * - **Guided tour** -- first-time user walkthrough of the Play tab.
 * - **Info modal** -- expandable FAQ topics about the app.
 * - **Instant invite** -- generate a throwaway Nostr identity for a friend on the spot.
 *
 * Guest users see login prompts when attempting authenticated actions (wiggle animation).
 */

import React, { useState } from 'react';
import { Icons } from '../../components/Icons';
import { Button } from '../../components/Button';
import { InfoModal } from '../../components/InfoModal';
import { GuidedTour } from '../../components/GuidedTour';
import { HomeMenuViewProps, RoundCreationState } from './homeTypes';

/**
 * Home menu landing view -- primary entry point for the Play tab.
 * Renders active round status, create/join actions, and guided tour.
 */
export const HomeMenuView: React.FC<HomeMenuViewProps> = ({
    activeRound,
    players,
    isBalanceLoading,
    totalWalletBalance,
    pillBgColor,
    pillBorderColor,
    pillIconColor,
    pillGlowColor,
    showResetConfirm,
    setShowResetConfirm,
    showDiscardDraftConfirm,
    setShowDiscardDraftConfirm,
    handleCreateRoundClick,
    confirmNewRound,
    handleDiscardDraft,
    handleResumeDraft,
    showInfoModal,
    setShowInfoModal,
    expandedTopic,
    toggleTopic,
    showTour,
    tourSteps,
    setShowTour,
    handleCreateTournament,
    joinError,
    cancelFundOption,
    setCancelFundOption,
    navigate,
    formatAmount,
    showPlayerQr,
    setShowPlayerQr,
    setInviteQrData,
    getPlayerQrData,
    onStartJoinScan,
    onStopJoinScan,
    joinScanActive,
    isJoinScanning,
    joinScanVideoRef,
    joinScanCanvasRef,
    isNativeScanner,
    startNativeScan,
    showInstantInviteModal,
    setShowInstantInviteModal,
    instantInviteName,
    setInstantInviteName,
    confirmInstantInvite,
    isGeneratingInvite,
    handleInstantInvite,
    currentUserPubkey,
    userProfile,
    isGuest,
    handleGuestActionAttempt,
    wiggleLogin,
    showLoginHint,
    goToSettings,
    setView,
    setCourseName,
    setLayout,
    setCustomHoles,
    setHasEntryFee,
    setEntryFee,
    setAcePot,
    setSelectedCardmates,
    setExcludedPlayers,
    setPaidStatus,
    setStartDate,
    setStartTime,
    setTrackPenalties,
}) => {
    const [qrModalTab, setQrModalTab] = useState<'show' | 'scan'>('show');

    return (
        <div className="p-6 flex flex-col flex-1 w-full relative pb-20">
            {/* Wallet Balance Pill - Top Left with Subtle Color Drift */}
            <div className="absolute top-6 left-6 z-10">
                <button
                    onClick={() => navigate('/wallet')}
                    className="px-4 py-2 rounded-full backdrop-blur-sm hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                        background: pillBgColor,
                        border: `1px solid ${pillBorderColor}`,
                        boxShadow: `0 4px 20px ${pillGlowColor}`,
                        transition: 'all 2s ease-in-out', // Very slow, smooth transition
                    }}
                >
                    <div className="flex items-center space-x-2">
                        <Icons.Wallet
                            size={16}
                            style={{
                                color: pillIconColor,
                                transition: 'color 2s ease-in-out',
                            }}
                        />
                        <span className={`text-sm font-bold text-white ${isBalanceLoading ? 'balance-shimmer' : ''}`}>
                            {formatAmount(totalWalletBalance)}
                        </span>
                    </div>
                </button>
            </div>

            {/* Header Icons - Top Right */}
            <div className="absolute top-6 right-6 z-10 flex space-x-3">
                <button
                    id="tour-help"
                    onClick={() => setShowInfoModal(true)}
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

            <div className="flex-1 flex flex-col items-center pt-16 space-y-6">
                {/* Hero Section */}
                <div className="text-center space-y-2">
                    {/* Logo */}
                    <div className="inline-flex items-center justify-center mb-4 relative">
                        <div className="p-[2px] rounded-2xl bg-gradient-to-br from-emerald-500/50 to-cyan-500/50 shadow-lg shadow-emerald-500/20">
                            <img
                                src="/icons/icon-512x512.png"
                                alt="On-Chain Disc Golf"
                                className="w-20 h-20 rounded-xl"
                            />
                        </div>
                        <div className="absolute -top-0 -right-0 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                    </div>

                    {/* Title - Original styling */}
                    <h1 className="font-extrabold tracking-tight leading-tight">
                        <div className="text-6xl mb-1">
                            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">On-Chain</span>
                        </div>
                        <div className="text-4xl">
                            <span className="text-white">Disc Golf</span>
                        </div>
                    </h1>
                </div>

                <div className="w-full max-w-sm space-y-4 px-4">
                    {/* Only show Continue Round for active, non-finalized rounds */}
                    {activeRound && !activeRound.isFinalized && (
                        <button
                            onClick={() => navigate('/play')}
                            className="w-full bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <Icons.Play fill="currentColor" />
                                <span>{activeRound.pubkey === currentUserPubkey ? 'Continue Round' : 'View Current Round'}</span>
                            </div>
                        </button>
                    )}

                    {!activeRound && (() => {
                        const saved = localStorage.getItem('cdg_round_creation');
                        return saved ? (
                            <button
                                onClick={() => {
                                    try {
                                        const state: RoundCreationState = JSON.parse(saved);
                                        setView(state.view);
                                        setCourseName(state.courseName);
                                        setLayout(state.layout);
                                        setCustomHoles(state.customHoles);
                                        setHasEntryFee(state.hasEntryFee);
                                        setEntryFee(state.entryFee);
                                        setAcePot(state.acePot);
                                        setSelectedCardmates(state.selectedCardmates);
                                        setExcludedPlayers(new Set(state.excludedPlayers));
                                        setPaidStatus(state.paidStatus);
                                        setStartDate(state.startDate);
                                        setStartTime(state.startTime);
                                        setTrackPenalties(state.trackPenalties);
                                    } catch (e) {
                                        console.error('Failed to restore round creation state:', e);
                                        localStorage.removeItem('cdg_round_creation');
                                    }
                                }}
                                className="w-full bg-gradient-to-r from-amber-500/70 via-orange-500/70 to-red-500/70 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/35 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <Icons.Play fill="currentColor" />
                                    <span>Resume Round Setup</span>
                                </div>
                            </button>
                        ) : null;
                    })()}

                    {isGuest && (
                        <button
                            onClick={() => navigate('/profile')}
                            className={`w-full bg-gradient-to-r from-purple-500/70 via-blue-500/70 to-cyan-500/70 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all hover:scale-[1.02] active:scale-[0.98] ${wiggleLogin ? 'animate-wiggle' : ''}`}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <Icons.Users />
                                <span>Login or Create Profile</span>
                            </div>
                        </button>
                    )}

                    {showLoginHint && isGuest && (
                        <div className="text-blue-300/80 text-xs text-center bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 animate-in fade-in slide-in-from-top-2 mb-2">
                            {"\uD83D\uDC46"} Create a profile to start playing!
                        </div>
                    )}

                    <button
                        id="tour-create-round"
                        onClick={handleCreateRoundClick}
                        className="w-full bg-gradient-to-br from-slate-800/90 via-emerald-900/20 to-slate-900/95 text-white font-bold py-4 rounded-xl border border-emerald-500/20 backdrop-blur-sm hover:border-emerald-500/40 hover:from-slate-800/95 hover:via-emerald-900/30 hover:to-slate-900 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-900/10"
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Icons.Plus className="text-emerald-400" />
                            <span>Create Round</span>
                        </div>
                    </button>

                    <button
                        onClick={handleCreateTournament}
                        className="w-full bg-gradient-to-br from-slate-800/90 via-cyan-900/20 to-slate-900/95 text-white font-bold py-4 rounded-xl border border-cyan-500/20 backdrop-blur-sm hover:border-cyan-500/40 hover:from-slate-800/95 hover:via-cyan-900/30 hover:to-slate-900 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan-900/10"
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Icons.League className="text-cyan-400" />
                            <span>Tournament</span>
                        </div>
                    </button>

                    <button
                        id="tour-join-round"
                        onClick={() => {
                            if (handleGuestActionAttempt()) return;
                            setShowPlayerQr(true);
                        }}
                        className="w-full py-4 px-4 rounded-xl bg-gradient-to-br from-slate-800/90 via-amber-900/15 to-slate-900/95 border border-amber-500/20 backdrop-blur-sm text-white hover:border-amber-500/40 hover:from-slate-800/95 hover:via-amber-900/25 hover:to-slate-900 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-900/10"
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Icons.QrCode className="text-amber-400" />
                            <span>Join Round</span>
                        </div>
                    </button>

                    {/* Round History - subtle link */}
                    <button
                        onClick={() => navigate('/history')}
                        className="w-full py-3 text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center space-x-2 hover:bg-white/5 rounded-xl"
                    >
                        <Icons.History size={16} />
                        <span>Round History</span>
                    </button>

                    {joinError && (
                        <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                            {joinError}
                        </div>
                    )}
                </div>
            </div>



            {/* Cancel Round Confirmation Modal */}
            {showResetConfirm && activeRound && (() => {
                const entryPayers = players.filter((p: any) => p.paysEntry);
                const acePayers = players.filter((p: any) => p.paysAce);
                const entryPot = entryPayers.length * activeRound.entryFeeSats;
                const acePotAmount = acePayers.length * activeRound.acePotFeeSats;
                const totalPot = entryPot + acePotAmount;
                const hasMoney = totalPot > 0;

                // Determine current leader
                const sortedPlayers = [...players].sort((a: any, b: any) => a.totalScore - b.totalScore);
                const currentLeader = sortedPlayers[0];

                // Check for any aces
                const aceWinners: { name: string; hole: number }[] = [];
                players.forEach((player: any) => {
                    Object.entries(player.scores).forEach(([hole, score]) => {
                        if (score === 1) {
                            aceWinners.push({ name: player.name, hole: parseInt(hole) });
                        }
                    });
                });

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <Icons.Help size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Quit Current Round?</h3>
                            </div>

                            {/* Round Info */}
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400 text-sm">Course</span>
                                    <span className="text-white font-semibold">{activeRound.courseName}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400 text-sm">Players</span>
                                    <span className="text-white font-semibold">{players.length}</span>
                                </div>
                                {hasMoney && (
                                    <>
                                        {entryPot > 0 && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 text-sm">Entry Pot</span>
                                                <span className="text-amber-400 font-semibold">{entryPot.toLocaleString()} sats</span>
                                            </div>
                                        )}
                                        {acePotAmount > 0 && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 text-sm">Ace Pot</span>
                                                <span className="text-emerald-400 font-semibold">{acePotAmount.toLocaleString()} sats</span>
                                            </div>
                                        )}
                                        <div className="border-t border-slate-700 pt-2 flex items-center justify-between">
                                            <span className="text-slate-300 text-sm font-medium">Total Pot</span>
                                            <span className="text-white font-bold">{totalPot.toLocaleString()} sats</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Fund Distribution Options - Only shown if there's money */}
                            {hasMoney && (
                                <div className="space-y-2">
                                    <p className="text-slate-400 text-xs text-center mb-3">What happens to the pot?</p>

                                    {/* Pay Winner Option */}
                                    <button
                                        onClick={() => setCancelFundOption('pay-winner')}
                                        className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${cancelFundOption === 'pay-winner'
                                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cancelFundOption === 'pay-winner' ? 'bg-amber-500/20' : 'bg-slate-700'
                                            }`}>
                                            <Icons.Trophy size={16} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="font-semibold text-sm">Pay Current Leader</p>
                                            <p className="text-xs text-slate-500">
                                                {currentLeader?.name || 'Leader'} wins{aceWinners.length > 0 ? ' + ace payout' : ''}
                                            </p>
                                        </div>
                                        {cancelFundOption === 'pay-winner' && (
                                            <Icons.CheckMark size={18} className="text-amber-500" />
                                        )}
                                    </button>

                                    {/* Redistribute Option */}
                                    <button
                                        onClick={() => setCancelFundOption('redistribute')}
                                        className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${cancelFundOption === 'redistribute'
                                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cancelFundOption === 'redistribute' ? 'bg-emerald-500/20' : 'bg-slate-700'
                                            }`}>
                                            <Icons.Users size={16} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="font-semibold text-sm">Refund Everyone</p>
                                            <p className="text-xs text-slate-500">Return what each player paid</p>
                                        </div>
                                        {cancelFundOption === 'redistribute' && (
                                            <Icons.CheckMark size={18} className="text-emerald-500" />
                                        )}
                                    </button>

                                    {/* Host Keeps Option */}
                                    <button
                                        onClick={() => setCancelFundOption('host-keeps')}
                                        className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${cancelFundOption === 'host-keeps'
                                            ? 'bg-slate-500/10 border-slate-500 text-slate-300'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cancelFundOption === 'host-keeps' ? 'bg-slate-500/20' : 'bg-slate-700'
                                            }`}>
                                            <Icons.Wallet size={16} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="font-semibold text-sm">Host Keeps Pot</p>
                                            <p className="text-xs text-slate-500">Funds stay with round host</p>
                                        </div>
                                        {cancelFundOption === 'host-keeps' && (
                                            <Icons.SmirkFace size={24} className="text-amber-400" />
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setShowResetConfirm(false);
                                        setCancelFundOption('pay-winner');
                                    }}
                                >
                                    Keep Round
                                </Button>
                                <Button variant="danger" onClick={confirmNewRound}>
                                    Quit Round
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Discard Draft Confirmation Modal */}
            {showDiscardDraftConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-2xl max-w-xs w-full animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowDiscardDraftConfirm(false)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-white"
                        >
                            <Icons.Close size={20} />
                        </button>

                        <div className="flex items-center space-x-3 mb-4 pr-6">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                <Icons.Help size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Resume Draft?</h3>
                        </div>

                        <p className="text-slate-400 text-sm mb-5">
                            You have an unfinished round setup. Resume or start fresh?
                        </p>

                        <div className="flex gap-3">
                            <Button
                                fullWidth
                                variant="secondary"
                                onClick={handleDiscardDraft}
                                className="text-sm"
                            >
                                Start New
                            </Button>
                            <Button
                                fullWidth
                                onClick={handleResumeDraft}
                                className="bg-amber-500 text-black hover:bg-amber-400 text-sm"
                            >
                                Resume
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* What is On-Chain Info Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full h-[70vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowInfoModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                        >
                            <Icons.Close size={24} />
                        </button>

                        <div className="flex items-center space-x-3 mb-6">
                            <Icons.Help size={28} className="text-brand-primary" />
                            <h2 className="text-xl font-bold text-white">What is On-Chain?</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            <p className="text-slate-300 text-sm leading-relaxed">
                                On-Chain is a disc golf scorekeeping application that integrates payment with scorekeeping.
                                <br /><br />
                                We built On-Chain Disc Golf on decentralized technologies to give players and organizers true ownership and financial freedom.
                            </p>

                            <div className="space-y-2">
                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => toggleTopic('bitcoin')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-sm">B</div>
                                            <span className="font-bold text-white">Bitcoin (The Money)</span>
                                        </div>
                                        <Icons.Next size={16} className={`transition-transform ${expandedTopic === 'bitcoin' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {expandedTopic === 'bitcoin' && (
                                        <div className="p-4 pt-0 text-sm text-slate-400 leading-relaxed bg-slate-900/30">
                                            We use Bitcoin because it is a permissionless financial layer. Many tournament directors have run into problems when using Venmo and PayPal because their accounts get flagged for sending and receiving transactions. With Bitcoin, it's impossible to flag and stop transactions.
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => toggleTopic('nostr')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold text-sm">N</div>
                                            <span className="font-bold text-white">Nostr (The Identity)</span>
                                        </div>
                                        <Icons.Next size={16} className={`transition-transform ${expandedTopic === 'nostr' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {expandedTopic === 'nostr' && (
                                        <div className="p-4 pt-0 text-sm text-slate-400 leading-relaxed bg-slate-900/30">
                                            We use Nostr because we want the user to have control over their own identity. Your identity on the internet should not be owned by any corporation or government, including UDisc.
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => toggleTopic('ecash')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-sm">
                                                <Icons.Zap size={16} />
                                            </div>
                                            <span className="font-bold text-white">eCash (The Speed)</span>
                                        </div>
                                        <Icons.Next size={16} className={`transition-transform ${expandedTopic === 'ecash' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {expandedTopic === 'ecash' && (
                                        <div className="p-4 pt-0 text-sm text-slate-400 leading-relaxed bg-slate-900/30">
                                            We use eCash because it is a simpler way to build transactions within a single application.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Join Round Dual-Tab Modal */}
            {showPlayerQr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => {
                                setShowPlayerQr(false);
                                setInviteQrData('');
                                onStopJoinScan();
                                setQrModalTab('show');
                            }}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <Icons.Close size={24} />
                        </button>

                        <div className="text-center space-y-4 pt-2">
                            <h3 className="text-xl font-bold text-white">Join Round</h3>

                            {/* Segmented Control */}
                            <div className="flex bg-slate-800 rounded-xl p-1">
                                <button
                                    onClick={() => {
                                        setQrModalTab('show');
                                        onStopJoinScan();
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                                        qrModalTab === 'show'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    My QR
                                </button>
                                <button
                                    onClick={() => {
                                        setQrModalTab('scan');
                                        onStartJoinScan();
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                                        qrModalTab === 'scan'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Scan to Join
                                </button>
                            </div>

                            {/* Tab 1: My QR */}
                            {qrModalTab === 'show' && (
                                <>
                                    <div className="bg-gradient-to-br from-emerald-400 via-cyan-500 to-teal-600 p-1 rounded-2xl shadow-2xl shadow-cyan-500/30 inline-block mx-auto">
                                        <div className="bg-white p-3 rounded-xl">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getPlayerQrData())}`}
                                                className="w-48 h-48"
                                                alt="Player QR"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 mb-2">
                                            {userProfile.picture ? <img src={userProfile.picture} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-400" />}
                                        </div>
                                        <p className="font-bold text-lg">{userProfile.name}</p>
                                        <p className="text-xs text-slate-400">Scan to add me</p>
                                    </div>
                                </>
                            )}

                            {/* Tab 2: Scan to Join */}
                            {qrModalTab === 'scan' && (
                                <div className="py-4">
                                    {isNativeScanner ? (
                                        <div className="flex flex-col items-center space-y-4">
                                            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500/30">
                                                <Icons.Camera size={48} className="text-emerald-400" />
                                            </div>
                                            <p className="text-slate-400 text-sm">Scan a round or event QR code</p>
                                            {isJoinScanning && (
                                                <p className="text-emerald-400 text-xs font-semibold animate-pulse">Scanning...</p>
                                            )}
                                            <button
                                                onClick={startNativeScan}
                                                className="w-full max-w-xs bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <span className="flex items-center justify-center space-x-2">
                                                    <Icons.Camera size={20} />
                                                    <span>Open Scanner</span>
                                                </span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-xl overflow-hidden bg-black">
                                            <video
                                                ref={joinScanVideoRef}
                                                className="absolute inset-0 w-full h-full object-cover"
                                                muted={true}
                                                autoPlay={true}
                                                playsInline={true}
                                            />
                                            <canvas ref={joinScanCanvasRef} className="hidden" />
                                            {/* QR Viewfinder overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-40 h-40 border-2 border-emerald-400 rounded-lg relative">
                                                    <div className="absolute top-0 left-0 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg"></div>
                                                    <div className="absolute top-0 right-0 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg"></div>
                                                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg"></div>
                                                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br-lg"></div>
                                                </div>
                                            </div>
                                            {isJoinScanning && (
                                                <div className="absolute bottom-2 left-0 right-0 text-center">
                                                    <span className="text-emerald-400 text-xs font-semibold bg-black/60 px-3 py-1 rounded-full animate-pulse">Scanning...</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button fullWidth variant="secondary" onClick={() => {
                                setShowPlayerQr(false);
                                setInviteQrData('');
                                onStopJoinScan();
                                setQrModalTab('show');
                            }}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Instant Invite Input Modal */}
            {showInstantInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowInstantInviteModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <Icons.Close size={24} />
                        </button>

                        <div className="text-center space-y-6 pt-2">
                            <div className="flex flex-col items-center space-y-2">
                                <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center">
                                    <Icons.UserPlus size={24} className="text-brand-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-white">New Player</h3>
                                <p className="text-sm text-slate-400">Enter a name to generate an instant invite.</p>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={instantInviteName}
                                    onChange={(e) => setInstantInviteName(e.target.value)}
                                    placeholder="Player Name"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-lg text-center text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-primary outline-none"
                                    autoFocus
                                />

                                <Button
                                    fullWidth
                                    onClick={confirmInstantInvite}
                                    disabled={!instantInviteName.trim() || isGeneratingInvite}
                                    className="bg-brand-primary text-black font-bold py-3 rounded-xl shadow-lg shadow-brand-primary/20"
                                >
                                    {isGeneratingInvite ? 'Creating...' : 'Create Invite'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* INFO MODAL */}
            <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />

            {/* GUIDED TOUR */}
            {showTour && (
                <GuidedTour
                    tourId="play-tab"
                    steps={tourSteps}
                    onComplete={() => setShowTour(false)}
                    onSkip={() => setShowTour(false)}
                />
            )}

        </div>
    );
};
