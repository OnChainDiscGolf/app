/**
 * @file homeTypes.ts
 *
 * Shared TypeScript types and prop interfaces for the Home page module.
 *
 * Defines:
 * - State shapes for round creation wizard persistence (RoundCreationState)
 * - Round template and custom preset models
 * - The HomeView union type that drives the orchestrator's view routing
 * - Prop interfaces for every Home sub-component (HomeMenuView, HomeSetupView,
 *   HomeSelectPlayersView, HomeCustomizeView, HomeScanPlayerView, HomeSettingsView)
 *
 * All prop interfaces follow the orchestrator + view pattern: the Home.tsx orchestrator
 * owns all hooks/state and passes slices down through these typed prop contracts.
 */

import React from 'react';
import { DisplayProfile } from '../../types';

/**
 * Persistable snapshot of the round creation wizard's state.
 * Serialized to localStorage so users can resume an in-progress setup
 * after navigating away or refreshing the app.
 */
export interface RoundCreationState {
    view: 'setup' | 'select_players' | 'customize';
    courseName: string;
    layout: '9' | '18' | 'custom';
    customHoles: number;
    hasEntryFee: boolean;
    entryFee: number;
    acePot: number;
    selectedCardmates: DisplayProfile[];
    excludedPlayers: string[];
    paidStatus: Record<string, boolean>;
    paymentSelections?: Record<string, { entry: boolean; ace: boolean }>;
    startDate: string;
    startTime: string;
    trackPenalties: boolean;
    startHole: number;
    payoutMode: 'winner-take-all' | 'percentage-based';
    payoutPercentage: number;
    customPayoutPercentage: number;
    payoutGradient: 'top-heavy' | 'linear';
    acePotRedistribution: 'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants';
    playerHandicaps: Record<string, number>;
    handicapEnabled: boolean;
    startHoleEnabled: boolean;
    useHonorSystem: boolean;
}

/** Removes the persisted round creation draft from localStorage. */
export const clearRoundCreationState = () => {
    localStorage.removeItem('cdg_round_creation');
};

/**
 * A saved round configuration template that lets users quickly recreate
 * frequently-played setups (e.g., "Friday Minis at Riverside").
 * Stored in localStorage as an array.
 */
export interface RoundTemplate {
    id: string;
    name: string;
    createdAt: number;
    layout: '9' | '18' | 'custom';
    customHoles: number;
    hasEntryFee: boolean;
    entryFee: number;
    acePot: number;
    cardmates: DisplayProfile[];
}

/** User-defined entry fee or ace pot quick-select preset (up to 3 per category). */
export interface CustomPreset {
    amount: number;
    id: string;
}

/** Lightning invoice generated for a player's entry fee payment. */
export interface PlayerInvoice {
    invoice: string;
    paymentHash: string;
    amount: number;
    timestamp: number;
}

/**
 * Union type for the Home orchestrator's view state machine.
 *
 * View flow: menu -> setup -> select_players -> customize -> (round starts)
 * scan_player and settings are accessible as side-routes from multiple views.
 */
export type HomeView = 'menu' | 'setup' | 'select_players' | 'customize' | 'scan_player' | 'settings';

// ---------------------------------------------------------------------------
// Prop interfaces for sub-components
// ---------------------------------------------------------------------------

/** Props for the QR code scanner view used to add players by scanning their Nostr QR. */
export interface HomeScanPlayerViewProps {
    isCameraLoading: boolean;
    cameraError: string | null;
    logs: string[];
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    restart: () => void;
    isNativeScanner: boolean;
    permissionStatus: string | null;
    startNativeScan: () => void;
    openAppSettings: () => void;
    setView: (view: HomeView) => void;
}

/** DisplayProfile extended with an optional host flag, used in the customize view's player list. */
export interface AllPlayer extends DisplayProfile {
    isHost?: boolean;
}

/**
 * Props for the customize/payments step -- the final wizard step before starting a round.
 * Handles player payment tracking, payout configuration, handicaps, and round start.
 */
export interface HomeCustomizeViewProps {
    // Payment request status
    paymentRequestsSent: boolean;
    paymentRequestCount: number;
    onResendPaymentRequests: () => Promise<void>;
    isResendingRequests: boolean;
    // Player state
    allPlayers: AllPlayer[];
    selectedCardmates: DisplayProfile[];
    excludedPlayers: Set<string>;
    paidStatus: Record<string, boolean>;
    paymentSelections: Record<string, { entry: boolean; ace: boolean }>;
    // Payment modal state
    showPaymentModal: boolean;
    setShowPaymentModal: (show: boolean) => void;
    paymentTarget: DisplayProfile | null;
    paymentInvoice: string;
    paymentQuote: string;
    isGeneratingInvoice: boolean;
    isPayingWallet: boolean;
    paymentSuccess: boolean;
    paymentError: string | null;
    showFundingGuide: boolean;
    setShowFundingGuide: (show: boolean) => void;
    // Payout config
    payoutMode: 'winner-take-all' | 'percentage-based';
    setPayoutMode: (mode: 'winner-take-all' | 'percentage-based') => void;
    payoutPercentage: number;
    setPayoutPercentage: (pct: number) => void;
    customPayoutPercentage: number;
    setCustomPayoutPercentage: (pct: number) => void;
    payoutGradient: 'top-heavy' | 'linear';
    setPayoutGradient: (gradient: 'top-heavy' | 'linear') => void;
    acePotRedistribution: 'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants';
    setAcePotRedistribution: (opt: 'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants') => void;
    // Handicap
    handicapEnabled: boolean;
    setHandicapEnabled: (enabled: boolean) => void;
    playerHandicaps: Record<string, number>;
    setPlayerHandicaps: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    // Start settings
    startHoleEnabled: boolean;
    setStartHoleEnabled: (enabled: boolean) => void;
    startHole: number;
    setStartHole: (hole: number) => void;
    useHonorSystem: boolean;
    setUseHonorSystem: (enabled: boolean) => void;
    showTeeOrderInfo: boolean;
    setShowTeeOrderInfo: (show: boolean) => void;
    // Tab state
    customizeTab: 'players' | 'settings';
    setCustomizeTab: (tab: 'players' | 'settings') => void;
    // Entry fee/ace pot
    hasEntryFee: boolean;
    entryFee: number;
    acePot: number;
    layout: '9' | '18' | 'custom';
    customHoles: number;
    // Handlers
    toggleScoreExclusion: (pubkey: string) => void;
    openPaymentModal: (player: DisplayProfile) => void;
    handlePayWithWallet: () => void;
    handleHostPaysForCardmate: () => void;
    handleOpenLightningWallet: () => void;
    handleCopyInvoice: () => void;
    handleStartRound: () => void;
    // Current user info
    currentUserPubkey: string;
    userProfile: { name: string; picture: string; lud16: string; nip05: string };
    // Confirm/help state
    showStartConfirm: boolean;
    showPaymentsHelp: boolean;
    setShowPaymentsHelp: (show: boolean) => void;
    // Navigation
    setView: (view: HomeView) => void;
    goToSettings: () => void;
    // Formatters
    formatAmount: (amount: number) => string;
    walletBalance: number;
    getMagicLightningAddress: (pubkey: string) => string;
    getTopHeavyDistribution: (numWinners: number) => number[];
    getLinearDistribution: (numWinners: number) => number[];
}

/**
 * Props for the player selection step of the round creation wizard.
 * Supports search (Nostr/PDGA), recent/frequent/A-Z tabs, QR scanning,
 * instant invite (generate throwaway identity), and payment selection per player.
 */
export interface HomeSelectPlayersViewProps {
    // Host QR code
    pendingRoundId: string;
    // Player selection
    selectedCardmates: DisplayProfile[];
    setSelectedCardmates: React.Dispatch<React.SetStateAction<DisplayProfile[]>>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    handleSearch: () => void;
    isSearching: boolean;
    foundUser: DisplayProfile | null;
    // Player tab
    playerTab: 'frequent' | 'recent' | 'a-z';
    setPlayerTab: (tab: 'frequent' | 'recent' | 'a-z') => void;
    // Player list
    displayedList: DisplayProfile[];
    addCardmate: (player: DisplayProfile) => void;
    removeCardmate: (pubkey: string) => void;
    // QR/invite state
    showPlayerQr: boolean;
    setShowPlayerQr: (show: boolean) => void;
    inviteQrData: string;
    isGeneratingInvite: boolean;
    getPlayerQrData: () => string;
    // Instant invite
    showInstantInviteModal: boolean;
    setShowInstantInviteModal: (show: boolean) => void;
    instantInviteName: string;
    setInstantInviteName: (name: string) => void;
    handleInstantInvite: () => void;
    confirmInstantInvite: () => Promise<void>;
    // Search button wiggle
    wiggleSearchButton: boolean;
    setWiggleSearchButton: (wiggle: boolean) => void;
    // Navigation
    setView: (view: HomeView) => void;
    goToSettings: () => void;
    // Help
    showPlayersHelp: boolean;
    setShowPlayersHelp: (show: boolean) => void;
    // Confirm handler
    handleConfirmCardmates: () => Promise<void>;
    isGeneratingInvoices: boolean;
    invoiceError: string | null;
    // Payment selections
    paymentSelections: Record<string, { entry: boolean; ace: boolean }>;
    setPaymentSelections: React.Dispatch<React.SetStateAction<Record<string, { entry: boolean; ace: boolean }>>>;
    // Entry fee state
    hasEntryFee: boolean;
    entryFee: number;
    acePot: number;
    // Current user
    currentUserPubkey: string;
    userProfile: { name: string; picture: string; lud16: string; nip05: string };
    // Format helper
    formatHandle: (p: DisplayProfile) => string;
    // Shield easter egg
    showShieldModal: boolean;
    setShowShieldModal: (show: boolean) => void;
    hasScrolledToBottom: boolean;
    handleManifestoScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    handleCloseShieldModal: () => void;
    handleShieldClick: () => void;
    manifestoRef: React.RefObject<HTMLDivElement | null>;
    showScoldingModal: boolean;
    handleFinishReading: () => void;
    handlePayToSkip: () => void;
}

/**
 * Props for the round setup step (step 1 of the wizard).
 * Configures course name, hole count, entry fee, and ace pot with custom presets.
 */
export interface HomeSetupViewProps {
    courseName: string;
    setCourseName: (name: string) => void;
    recentCourses: string[];
    layout: '9' | '18' | 'custom';
    setLayout: (layout: '9' | '18' | 'custom') => void;
    customHoles: number;
    setCustomHoles: (holes: number) => void;
    hasEntryFee: boolean;
    setHasEntryFee: (has: boolean) => void;
    entryFee: number;
    setEntryFee: (fee: number) => void;
    acePot: number;
    setAcePot: (pot: number) => void;
    customPresets: CustomPreset[];
    customAcePresets: CustomPreset[];
    handleSaveCustomPreset: () => void;
    handleDeleteCustomPreset: (id: string) => void;
    handleSaveCustomAcePreset: () => void;
    handleDeleteCustomAcePreset: (id: string) => void;
    showCustomInput: boolean;
    setShowCustomInput: (show: boolean) => void;
    customAmount: string;
    setCustomAmount: (amount: string) => void;
    showCustomAceInput: boolean;
    setShowCustomAceInput: (show: boolean) => void;
    customAceAmount: string;
    setCustomAceAmount: (amount: string) => void;
    showSetupHelp: boolean;
    setShowSetupHelp: (show: boolean) => void;
    setView: (view: HomeView) => void;
    goToSettings: () => void;
}

/**
 * Props for the round settings side-panel.
 * Manages persistent preferences (auto-follow, post results, default fees)
 * and round templates (save/load/delete).
 */
export interface HomeSettingsViewProps {
    autoFollowPlayers: boolean;
    setAutoFollowPlayers: (follow: boolean) => void;
    postResults: boolean;
    setPostResults: (post: boolean) => void;
    defaultEntryFee: number;
    setDefaultEntryFee: (fee: number) => void;
    defaultAcePot: number;
    setDefaultAcePot: (pot: number) => void;
    settingsExpanded: Record<string, boolean>;
    toggleSettingsSection: (section: string) => void;
    customPresets: CustomPreset[];
    customAcePresets: CustomPreset[];
    savedTemplates: RoundTemplate[];
    setSavedTemplates: React.Dispatch<React.SetStateAction<RoundTemplate[]>>;
    showSaveTemplateModal: boolean;
    setShowSaveTemplateModal: (show: boolean) => void;
    templateName: string;
    setTemplateName: (name: string) => void;
    goBackFromSettings: () => void;
    previousView: 'menu' | 'setup' | 'select_players' | 'customize';
    // Round state needed for template saving
    layout: '9' | '18' | 'custom';
    setLayout: (layout: '9' | '18' | 'custom') => void;
    customHoles: number;
    setCustomHoles: (holes: number) => void;
    hasEntryFee: boolean;
    setHasEntryFee: (has: boolean) => void;
    entryFee: number;
    setEntryFee: (fee: number) => void;
    acePot: number;
    setAcePot: (pot: number) => void;
    selectedCardmates: DisplayProfile[];
    setSelectedCardmates: React.Dispatch<React.SetStateAction<DisplayProfile[]>>;
    setView: (view: HomeView) => void;
    // Feedback
    showFeedbackModal: boolean;
    setShowFeedbackModal: (show: boolean) => void;
}

/**
 * Props for the home menu (landing) view.
 * Displays active round status, wallet balance pill, create/join round actions,
 * QR code scanner for joining, guided tour, and draft restoration.
 */
export interface HomeMenuViewProps {
    activeRound: any;
    players: any[];
    walletBalance: number;
    walletBalances: { cashu: number; nwc: number; breez: number };
    isBalanceLoading: boolean;
    totalWalletBalance: number;
    pillBgColor: string;
    pillBorderColor: string;
    pillIconColor: string;
    pillGlowColor: string;
    showResetConfirm: boolean;
    setShowResetConfirm: (show: boolean) => void;
    showDiscardDraftConfirm: boolean;
    setShowDiscardDraftConfirm: (show: boolean) => void;
    handleCreateRoundClick: () => void;
    confirmNewRound: () => Promise<void>;
    handleDiscardDraft: () => void;
    handleResumeDraft: () => void;
    showInfoModal: boolean;
    setShowInfoModal: (show: boolean) => void;
    expandedTopic: string | null;
    toggleTopic: (topic: string) => void;
    showTour: boolean;
    tourSteps: any[];
    setShowTour: (show: boolean) => void;
    handleCreateTournament: () => void;
    joinError: string;
    setJoinError: (error: string) => void;
    showFeedbackModal: boolean;
    setShowFeedbackModal: (show: boolean) => void;
    cancelFundOption: 'pay-winner' | 'redistribute' | 'host-keeps';
    setCancelFundOption: (option: 'pay-winner' | 'redistribute' | 'host-keeps') => void;
    navigate: (path: string) => void;
    formatAmount: (amount: number) => string;
    // Player QR
    showPlayerQr: boolean;
    setShowPlayerQr: (show: boolean) => void;
    inviteQrData: string;
    setInviteQrData: (data: string) => void;
    getPlayerQrData: () => string;
    // Join scan mode
    onStartJoinScan: () => void;
    onStopJoinScan: () => void;
    joinScanActive: boolean;
    isJoinScanning: boolean;
    joinScanVideoRef: React.RefObject<HTMLVideoElement | null>;
    joinScanCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    isNativeScanner: boolean;
    startNativeScan: () => void;
    // Instant invite
    showInstantInviteModal: boolean;
    setShowInstantInviteModal: (show: boolean) => void;
    instantInviteName: string;
    setInstantInviteName: (name: string) => void;
    confirmInstantInvite: () => Promise<void>;
    isGeneratingInvite: boolean;
    handleInstantInvite: () => void;
    // Current user
    currentUserPubkey: string;
    userProfile: { name: string; picture: string; lud16: string; nip05: string };
    isGuest: boolean;
    isAuthenticated: boolean;
    handleGuestActionAttempt: () => boolean;
    wiggleLogin: boolean;
    showLoginHint: boolean;
    // Settings navigation
    goToSettings: () => void;
    // State restoration helpers
    setView: (view: HomeView) => void;
    setCourseName: (name: string) => void;
    setLayout: (layout: '9' | '18' | 'custom') => void;
    setCustomHoles: (holes: number) => void;
    setHasEntryFee: (has: boolean) => void;
    setEntryFee: (fee: number) => void;
    setAcePot: (pot: number) => void;
    setSelectedCardmates: React.Dispatch<React.SetStateAction<DisplayProfile[]>>;
    setExcludedPlayers: React.Dispatch<React.SetStateAction<Set<string>>>;
    setPaidStatus: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setStartDate: (date: string) => void;
    setStartTime: (time: string) => void;
    setTrackPenalties: (track: boolean) => void;
}
