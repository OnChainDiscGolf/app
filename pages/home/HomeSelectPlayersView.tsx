/**
 * @file HomeSelectPlayersView.tsx
 *
 * Step 2 of the round creation wizard: player/cardmate selection.
 *
 * User interactions:
 * - **Search** -- look up players by Nostr npub, NIP-05, PDGA number, or name.
 * - **Tabs** -- browse known players via Frequent, Recent, or A-Z tabs.
 * - **Add/remove cardmates** -- tap to toggle players in/out of the round.
 * - **QR invite** -- show a scannable QR code so players can join via deep link.
 * - **Instant invite** -- generate a throwaway Nostr identity for a non-app player.
 * - **Scan player** -- open QR scanner to add a player by their identity QR.
 * - **Payment selection** -- per-player toggles for entry fee and ace pot participation.
 * - **Confirm cardmates** -- generates Lightning invoices and sends NIP-17 payment
 *   requests to each selected player, then advances to the customize step.
 * - **Shield easter egg** -- hidden manifesto modal triggered by a specific interaction.
 */

import React, { useState } from 'react';
import { Icons } from '../../components/Icons';
import { Button } from '../../components/Button';
import { JoinQrCode } from '../../components/JoinQrCode';
import { buildRoundJoinUrl } from '../../utils/qrUrls';
import { HomeSelectPlayersViewProps } from './homeTypes';
import { getCardmateFlowHelperText } from './roundSetupCopy';

/**
 * Player selection view -- step 2 of the round creation wizard.
 * Supports search, contact lists, QR scanning, and payment configuration per player.
 */
export const HomeSelectPlayersView: React.FC<HomeSelectPlayersViewProps> = ({
    pendingRoundId,
    selectedCardmates,
    searchQuery,
    setSearchQuery,
    handleSearch,
    isSearching,
    foundUser,
    playerTab,
    setPlayerTab,
    displayedList,
    addCardmate,
    removeCardmate,
    showPlayerQr,
    setShowPlayerQr,
    inviteQrData,
    isGeneratingInvite,
    showInstantInviteModal,
    setShowInstantInviteModal,
    instantInviteName,
    setInstantInviteName,
    handleInstantInvite,
    confirmInstantInvite,
    wiggleSearchButton,
    setWiggleSearchButton,
    setView,
    goToSettings,
    showPlayersHelp,
    setShowPlayersHelp,
    handleConfirmCardmates,
    isGeneratingInvoices,
    invoiceError,
    paymentSelections,
    setPaymentSelections,
    hasEntryFee,
    entryFee,
    acePot,
    currentUserPubkey,
    userProfile,
    formatHandle,
    showShieldModal,
    hasScrolledToBottom,
    handleManifestoScroll,
    handleCloseShieldModal,
    handleShieldClick,
    manifestoRef,
    showScoldingModal,
    handleFinishReading,
    handlePayToSkip,
}) => {
    const [showRoundQr, setShowRoundQr] = useState(false);
    const cardmateHelperText = getCardmateFlowHelperText(selectedCardmates.length);

    return (
        <div className="flex flex-col h-full p-6 pb-24">
            {/* Header - Wallet style */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                    <button
                        onClick={() => setView('setup')}
                        className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Prev />
                    </button>
                    <h1 className="text-2xl font-bold flex items-center">
                        <Icons.Users className="mr-2 text-blue-400/80" /> Players
                    </h1>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setShowPlayersHelp(true)}
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

            {/* Share QR Code Section */}
            <div className="mb-3">
                <button
                    onClick={() => setShowRoundQr(!showRoundQr)}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:border-slate-600/50 transition-all"
                >
                    <Icons.QrCode size={16} className="text-cyan-400" />
                    <span>{showRoundQr ? 'Hide QR Code' : 'Show QR Code for Players'}</span>
                </button>
                {showRoundQr && (
                    <div className="mt-2 bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                        <JoinQrCode
                            joinUrl={buildRoundJoinUrl(pendingRoundId, currentUserPubkey)}
                            title="Scan to Join Round"
                            subtitle="Players can scan this to join your round"
                        />
                    </div>
                )}
            </div>

            {/* Current Card Section */}
            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-2xl p-4 border border-white/10 backdrop-blur-sm mb-3">
                <div className="flex items-center space-x-2 mb-1.5">
                    <div className="w-6 h-6 bg-blue-500/15 rounded-lg flex items-center justify-center">
                        <Icons.Users size={12} className="text-blue-400/80" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Current Card ({selectedCardmates.length + 1})
                    </h3>
                </div>
                <p className="mb-3 text-xs text-slate-400 leading-relaxed">
                    {cardmateHelperText}
                </p>
                <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                    {/* Host Player */}
                    <div className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-white/10">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden shrink-0 border-2 border-blue-500/25">
                                {userProfile.picture ? <img src={userProfile.picture} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-400" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-bold text-sm truncate">{userProfile.name} (You)</span>
                                <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded w-fit">HOST</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Entry/Ace Buttons - Horizontal */}
                            {hasEntryFee && (
                                <>
                                    {/* Entry Button */}
                                    {entryFee > 0 && (
                                        <button
                                            onClick={() => setPaymentSelections(prev => ({
                                                ...prev,
                                                [currentUserPubkey]: { ...(prev[currentUserPubkey] || { entry: true, ace: true }), entry: !(prev[currentUserPubkey]?.entry ?? true) }
                                            }))}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${(paymentSelections[currentUserPubkey]?.entry ?? true)
                                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                : 'bg-slate-700/50 text-slate-500 border-slate-600'
                                                }`}
                                        >
                                            Entry
                                        </button>
                                    )}

                                    {/* Ace Button */}
                                    {acePot > 0 && (
                                        <button
                                            onClick={() => setPaymentSelections(prev => ({
                                                ...prev,
                                                [currentUserPubkey]: { ...(prev[currentUserPubkey] || { entry: true, ace: true }), ace: !(prev[currentUserPubkey]?.ace ?? true) }
                                            }))}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${(paymentSelections[currentUserPubkey]?.ace ?? true)
                                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                : 'bg-slate-700/50 text-slate-500 border-slate-600'
                                                }`}
                                        >
                                            Ace
                                        </button>
                                    )}
                                </>
                            )}
                            {/* Host Indicator Icon */}
                            <button
                                onClick={handleShieldClick}
                                className="w-8 h-8 flex items-center justify-center bg-emerald-500/20 border-2 border-emerald-500/30 rounded-full hover:bg-emerald-500/30 hover:border-emerald-500/50 transition-all"
                            >
                                <Icons.Shield size={16} className="text-emerald-400" />
                            </button>
                        </div>
                    </div>

                    {/* Cardmates */}
                    {selectedCardmates.map(p => {
                        const payment = paymentSelections[p.pubkey] || { entry: true, ace: true };
                        return (
                            <div key={p.pubkey} className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-white/10 animate-in slide-in-from-left-2 duration-300">
                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden shrink-0 border border-white/10">
                                        {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-500" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm truncate">{p.name}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Entry/Ace Buttons - Horizontal */}
                                    {hasEntryFee && (
                                        <>
                                            {/* Entry Button */}
                                            {entryFee > 0 && (
                                                <button
                                                    onClick={() => setPaymentSelections(prev => ({
                                                        ...prev,
                                                        [p.pubkey]: { ...payment, entry: !payment.entry }
                                                    }))}
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${payment.entry
                                                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                        : 'bg-slate-700/50 text-slate-500 border-slate-600'
                                                        }`}
                                                >
                                                    Entry
                                                </button>
                                            )}

                                            {/* Ace Button */}
                                            {acePot > 0 && (
                                                <button
                                                    onClick={() => setPaymentSelections(prev => ({
                                                        ...prev,
                                                        [p.pubkey]: { ...payment, ace: !payment.ace }
                                                    }))}
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${payment.ace
                                                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                                        : 'bg-slate-700/50 text-slate-500 border-slate-600'
                                                        }`}
                                                >
                                                    Ace
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeCardmate(p.pubkey)}
                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
                                    >
                                        <Icons.Close size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Search Section */}
            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-2xl p-4 border border-white/10 backdrop-blur-sm mb-3">
                <div className="relative flex items-center space-x-2">
                    <div className="relative flex-1">
                        <Icons.Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-2 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none placeholder:text-slate-500 transition-all"
                            placeholder="Add player via NIP-05, npub..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            onPaste={() => {
                                setWiggleSearchButton(true);
                                setTimeout(() => setWiggleSearchButton(false), 5000);
                            }}
                        />
                    </div>

                    <button
                        onClick={handleSearch}
                        className={`p-3 rounded-xl transition-all duration-300 ${wiggleSearchButton
                            ? 'bg-blue-500/25 text-blue-200 border-2 border-blue-400/60 shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/15 animate-pulse'
                            : 'bg-blue-500/15 text-blue-400/80 border border-blue-500/25 hover:bg-blue-500/25'
                            }`}
                    >
                        {isSearching ? <Icons.Zap className="animate-spin" size={20} /> : <Icons.Search size={20} />}
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1"></div>

                    <button
                        onClick={() => setView('scan_player')}
                        className="p-3 bg-black/30 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-blue-500/25 transition-colors"
                        title="Scan Player QR"
                    >
                        <Icons.Camera size={24} />
                    </button>

                    <button
                        onClick={handleInstantInvite}
                        className="p-3 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-xl text-emerald-400 hover:text-emerald-300 hover:border-emerald-400/60 hover:bg-emerald-500/20 transition-all relative group"
                        disabled={isGeneratingInvite}
                        title="Instant Invite (New Player)"
                    >
                        {isGeneratingInvite ? (
                            <Icons.Zap className="animate-spin" size={24} />
                        ) : (
                            <Icons.UserPlus size={24} strokeWidth={2.5} />
                        )}
                    </button>
                </div>

                {foundUser && (
                    <div
                        className="mt-2 p-3 bg-slate-800 border border-brand-primary/50 rounded-lg flex items-center justify-between space-x-3 animate-in fade-in slide-in-from-top-2"
                    >
                        <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1">
                            <div className="w-10 h-10 bg-brand-primary rounded-full overflow-hidden shrink-0">
                                {foundUser.image ? <img src={foundUser.image} className="w-full h-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold truncate">{foundUser.name}</p>
                                <p className="text-xs text-slate-400 truncate">
                                    {formatHandle(foundUser)}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => addCardmate(foundUser)}
                            className="px-3 py-1.5 bg-brand-primary text-black font-bold text-sm rounded-lg hover:bg-emerald-400 flex items-center space-x-1 shrink-0"
                        >
                            <Icons.Plus size={14} />
                            <span>Add</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Scrollable Player List */}
            <div className="flex-1 overflow-y-auto">
                {/* Player Tabs */}
                <div className="bg-black/30 rounded-xl p-1 border border-white/10 mb-4 flex">
                    {!searchQuery && (
                        <>
                            <button
                                onClick={() => setPlayerTab('frequent')}
                                className={`flex-1 px-4 py-2 font-bold text-sm rounded-lg transition-all ${playerTab === 'frequent' ? 'bg-gradient-to-r from-purple-500/70 to-blue-500/70 text-white shadow-lg shadow-purple-500/15' : 'text-slate-500 hover:text-white'}`}
                            >
                                Frequent
                            </button>
                            <button
                                onClick={() => setPlayerTab('recent')}
                                className={`flex-1 px-4 py-2 font-bold text-sm rounded-lg transition-all ${playerTab === 'recent' ? 'bg-gradient-to-r from-purple-500/70 to-blue-500/70 text-white shadow-lg shadow-purple-500/15' : 'text-slate-500 hover:text-white'}`}
                            >
                                Recent
                            </button>
                            <button
                                onClick={() => setPlayerTab('a-z')}
                                className={`flex-1 px-4 py-2 font-bold text-sm rounded-lg transition-all ${playerTab === 'a-z' ? 'bg-gradient-to-r from-purple-500/70 to-blue-500/70 text-white shadow-lg shadow-purple-500/15' : 'text-slate-500 hover:text-white'}`}
                            >
                                Contacts
                            </button>
                        </>
                    )}
                    {searchQuery && (
                        <button className="flex-1 px-4 py-2 font-bold text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg shadow-lg shadow-purple-500/25">
                            All Results
                        </button>
                    )}
                </div>

                {/* Player List */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden">
                    {displayedList.length === 0 && !foundUser ? (
                        <div className="p-8 text-center text-slate-500">
                            <p>No players found.</p>
                            {playerTab === 'a-z' && !searchQuery && <p className="text-xs mt-1">Your Nostr contact list is empty or loading.</p>}
                        </div>
                    ) : (
                        displayedList.map(player => (
                            <div
                                key={player.pubkey}
                                onClick={() => addCardmate(player)}
                                className="px-4 py-3 flex items-center justify-between hover:bg-white/5 cursor-pointer border-b border-white/5 group transition-colors"
                            >
                                <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden relative group-hover:ring-2 ring-blue-500/50 transition-all shrink-0">
                                        {player.image ? (
                                            <img src={player.image} className="w-full h-full object-cover" />
                                        ) : (
                                            <Icons.Users className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-white truncate">{player.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{formatHandle(player)}</p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center text-slate-600 group-hover:border-blue-500/50 group-hover:bg-blue-600/80 group-hover:text-white transition-all shrink-0 ml-3">
                                    <Icons.Plus size={16} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Next Button */}
            <div className="mt-6">
                {invoiceError && (
                    <div className="mb-3 p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
                        <p className="text-sm text-red-400">{invoiceError}</p>
                    </div>
                )}
                <button
                    onClick={handleConfirmCardmates}
                    disabled={isGeneratingInvoices}
                    className="w-full bg-gradient-to-r from-purple-500/70 via-blue-500/70 to-cyan-500/70 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGeneratingInvoices ? (
                        <span className="flex items-center justify-center gap-2">
                            <Icons.Zap className="animate-spin" size={20} />
                            Sending invoices...
                        </span>
                    ) : (
                        'Confirm Cardmates'
                    )}
                </button>
            </div>

            {/* INSTANT INVITE MODAL */}
            {showPlayerQr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/90 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowPlayerQr(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                        >
                            <Icons.Close size={24} />
                        </button>

                        <div className="text-center space-y-4 pt-2">
                            <h3 className="text-xl font-bold text-white">Scan to Join</h3>
                            <p className="text-slate-400 text-sm">
                                Have your friend scan this code to instantly join the game with a new account.
                            </p>

                            <div className="bg-gradient-to-br from-emerald-400 via-cyan-500 to-teal-600 p-1 rounded-2xl shadow-2xl shadow-cyan-500/30 inline-block mx-auto">
                                <div className="bg-white p-3 rounded-xl">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteQrData)}`}
                                        className="w-48 h-48"
                                        alt="Invite QR"
                                    />
                                </div>
                            </div>

                            <p className="text-xs text-slate-500">
                                This creates a new account for them.
                            </p>

                            <Button
                                fullWidth
                                onClick={() => setShowPlayerQr(false)}
                                className="mt-2"
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* INSTANT INVITE INPUT MODAL */}
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

            {/* FREEDOM MANIFESTO MODAL */}
            {showShieldModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/90 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-brand-primary/50 p-6 rounded-2xl shadow-2xl shadow-brand-primary/20 max-w-lg w-full max-h-[70vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                                <Icons.Shield size={24} className="text-brand-primary" />
                                <h2 className="text-xl font-bold text-white">The Freedom Stack</h2>
                            </div>
                            <button
                                onClick={handleCloseShieldModal}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <Icons.Close size={24} />
                            </button>
                        </div>

                        <div
                            ref={manifestoRef}
                            onScroll={handleManifestoScroll}
                            className="flex-1 overflow-y-auto space-y-4 text-slate-300 text-sm leading-relaxed pr-2"
                        >
                            <p className="text-brand-accent font-bold text-base">
                                The tools you're using right now aren't just for keeping score.
                            </p>

                            <p>
                                <span className="text-brand-primary font-bold">Bitcoin</span> is an unstoppable force that will systematically collapse every government and banking institution that refuses to embrace it. This isn't hyperbole—it's mathematics. Every fiat currency in history has eventually gone to zero, and the dollar is no exception. The difference now? There's an exit. A lifeboat. And it's programmed to be absolutely scarce.
                            </p>

                            <p>
                                <span className="text-brand-secondary font-bold">Cashu</span> takes this further. It's an <span className="italic">extremely private</span> and <span className="font-bold">unstoppable</span> way of transacting ecash over Bitcoin. When the dying empire inevitably implements capital controls, confiscatory taxes, and CBDCs with expiration dates, they won't be able to touch Cashu. They can't tax what they can't see. They can't stop what they can't control.
                            </p>

                            <p>
                                As the American empire continues its terminal decline, the regime will desperately try to maintain control through surveillance and censorship. Digital IDs to track every purchase. Debanking for wrongthink. ISPs blocking "dangerous" websites. This is where <span className="text-brand-primary font-bold">Nostr</span> comes in.
                            </p>

                            <p>
                                Nostr is a decentralized protocol that circumvents all of it. No single point of failure. No CEO to threaten. No server to shut down. It's one of the most powerful tools we have to preserve free speech and resist the coming censorship of the internet. Your identity, your social graph, your communications—all sovereign, all unstoppable.
                            </p>

                            <p className="text-white font-bold">
                                Together, Bitcoin, Cashu, and Nostr form the Freedom Stack™—the tools that make tyranny obsolete.
                            </p>

                            <p>
                                The future isn't dystopian control. It's parallel systems. It's individuals with unconfiscatable wealth, uncensorable speech, and unstoppable commerce. The old system is dying, and these tools ensure something better rises in its place.
                            </p>

                            <p className="text-brand-accent italic border-l-4 border-brand-accent pl-4">
                                {"Or maybe\u2014just maybe\u2014the real collapse will come from sweaty, single men in their 30s who\u2019ve completely checked out of the workforce to throw frisbees in the park all day. The Fed can handle hyperinflation. They can handle bank runs. But can they handle an entire generation of dudes who\u2019d rather disc golf than participate in the economy? The system needs worker bees, and we\u2019re out here\u2026 counting birdies. \uD83E\uDD4F"}
                            </p>

                            <div className="h-4"></div>
                        </div>

                        {hasScrolledToBottom && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <p className="text-xs text-center text-slate-500">
                                    {"\u26A1 You\u2019ve been enlightened \u26A1"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SCOLDING MODAL */}
            {showScoldingModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pb-24 bg-black/95 backdrop-blur-md">
                    <div className="bg-gradient-to-br from-red-950 via-slate-900 to-slate-950 border-2 border-red-500/50 p-6 rounded-2xl shadow-2xl shadow-red-500/20 max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center space-x-3 mb-4">
                            <Icons.Close size={32} className="text-red-500" />
                            <h2 className="text-xl font-bold text-white">Hold Up...</h2>
                        </div>

                        <div className="space-y-4 text-slate-300 text-sm">
                            <p className="font-bold text-red-400">
                                Did you seriously just try to close that without reading it?
                            </p>

                            <p>
                                Of course you did. You can't read anymore because you've been staring at your phone scrolling pointless content all day. Your attention span is cooked.
                            </p>

                            <p>
                                But here's the thing: <span className="text-white font-bold">that essay actually matters.</span> It's about your freedom. Your financial sovereignty. Your ability to resist tyranny.
                            </p>

                            <p className="text-brand-accent font-bold">
                                So here's your choice:
                            </p>

                            <div className="space-y-3 mt-6">
                                <button
                                    onClick={handleFinishReading}
                                    className="w-full bg-brand-primary/20 border-2 border-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-primary/30 transition-all"
                                >
                                    Fine, I'll Read It (Scroll to Bottom)
                                </button>

                                <button
                                    onClick={handlePayToSkip}
                                    className="w-full bg-slate-800 border-2 border-brand-accent text-brand-accent font-bold py-3 rounded-lg hover:bg-slate-700 transition-all"
                                >
                                    {"Pay 1,000 Sats to Skip \u26A1"}
                                </button>
                            </div>

                            <p className="text-xs text-center text-slate-500 mt-4 italic">
                                (Yes, we're actually making you choose between reading or paying. This is for your own good.)
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* PLAYERS HELP MODAL */}
            {showPlayersHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
                        <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex items-center justify-between z-10">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                <Icons.Users className="mr-2 text-blue-400" size={22} /> Players
                            </h2>
                            <button
                                onClick={() => setShowPlayersHelp(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <Icons.Close size={24} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Overview */}
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Add players to your card before starting the round. You can search for existing Nostr users or create instant invites for new players.
                            </p>

                            {/* Current Card */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Users className="text-blue-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Current Card</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Shows all players currently added to the round, including you as the <span className="text-emerald-400 font-medium">Host</span>.
                                    Tap the <span className="text-red-400">X</span> button to remove a player before starting.
                                </p>
                            </div>

                            {/* Entry/Ace Buttons */}
                            {hasEntryFee && (
                                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                                            <Icons.Zap className="text-orange-400" size={20} />
                                        </div>
                                        <h3 className="font-bold text-white">Entry & Ace Buttons</h3>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        Toggle whether each player participates in the <span className="text-orange-400 font-medium">Entry Fee</span> (prize pool)
                                        or <span className="text-emerald-400 font-medium">Ace Pot</span> (hole-in-one side bet).
                                        Highlighted buttons mean the player is participating in that pool.
                                    </p>
                                </div>
                            )}

                            {/* Search */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Search className="text-cyan-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Search Players</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Find existing Nostr users by their <span className="text-cyan-400 font-medium">NIP-05</span> (e.g., name@domain.com),
                                    <span className="text-purple-400 font-medium"> npub</span>, or <span className="text-amber-400 font-medium">PDGA#</span>.
                                    You can also scan QR codes to add players.
                                </p>
                            </div>

                            {/* Instant Invite */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                        <Icons.UserPlus className="text-emerald-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Instant Invite</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Create a new player instantly! Enter their name and a unique Nostr identity is generated for them.
                                    They can scan the QR code to take control of their account and receive winnings.
                                </p>
                            </div>

                            {/* Recent & Frequent */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                                        <Icons.History className="text-purple-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white">Quick Add</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    See <span className="text-purple-400 font-medium">Frequent</span> (most played with),
                                    <span className="text-blue-400 font-medium"> Recent</span> (last played with), and
                                    <span className="text-slate-400 font-medium"> A-Z</span> (all contacts) lists for quick player selection.
                                </p>
                            </div>

                            <div className="pt-2">
                                <Button fullWidth onClick={() => setShowPlayersHelp(false)} variant="secondary">
                                    Got it
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
