/**
 * @file Home.tsx
 *
 * Orchestrator component for the Home / Play tab (~1060 lines).
 *
 * Owns **all** state and hooks for the round creation wizard, then passes
 * slices of state as props to six view sub-components:
 *
 * View state machine (driven by `view: HomeView`):
 * ```
 *   menu ──> setup ──> select_players ──> customize ──> (round created, navigate to /scorecard)
 *                   └──> settings (side panel, returns to previous view)
 *                   └──> scan_player (QR scanner, returns to select_players)
 * ```
 *
 * Key responsibilities:
 * - Round creation wizard state: course, holes, fees, cardmates, payout config
 * - Player search (Nostr npub/NIP-05/PDGA lookup)
 * - QR scanning for player addition and round joining
 * - Payment request generation (Lightning invoices via depositFunds)
 * - NIP-17 Gift Wrap payment request delivery to cardmates
 * - Draft persistence (save/restore wizard state to localStorage)
 * - Round template management
 * - Guided tour for first-time users
 * - Instant invite (generate throwaway Nostr identity)
 *
 * This file was split from a 4321-line monolith. Views contain only JSX
 * and minimal local UI logic; all business logic lives here.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp, getTopHeavyDistribution, getLinearDistribution } from '../../context/AppContext';
import { useDenomination } from '../../hooks/useDenomination';
import { useNavigate } from 'react-router-dom';
import { getRelays, lookupUser, lookupByPDGA, publishProfileWithKey, getMagicLightningAddress, updateContactList } from '../../services/nostrService';
import { DisplayProfile } from '../../types';
import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';
import { useQrScanner } from '../../hooks/useQrScanner';
import { sendGiftWrap } from '../../services/giftWrapService';
import { parseJoinUrl } from '../../utils/qrUrls';
import { hexToBytes } from '@noble/hashes/utils';
import { useTourStatus, TourStep } from '../../components/GuidedTour';

import { RoundCreationState, clearRoundCreationState, RoundTemplate, CustomPreset, PlayerInvoice, HomeView, AllPlayer } from './homeTypes';
import { HomeScanPlayerView } from './HomeScanPlayerView';
import { HomeCustomizeView } from './HomeCustomizeView';
import { HomeSelectPlayersView } from './HomeSelectPlayersView';
import { HomeSetupView } from './HomeSetupView';
import { HomeSettingsView } from './HomeSettingsView';
import { HomeMenuView } from './HomeMenuView';

/**
 * Home page orchestrator -- owns all state for the round creation wizard
 * and routes to the appropriate view sub-component based on `view` state.
 */
export const Home: React.FC = () => {
    const { activeRound, players, createRound, joinRoundAndPay, recentPlayers, contacts, userProfile, resetRound, isAuthenticated, isGuest, currentUserPubkey, addRecentPlayer, depositFunds, checkDepositStatus, confirmDeposit, sendFunds, walletBalance, walletBalances, refreshAllBalances, isBalanceLoading } = useApp();
    const navigate = useNavigate();
    const { formatAmount } = useDenomination();

    // Local UI state for the creation wizard
    const [view, setView] = useState<HomeView>('menu');
    const [previousView, setPreviousView] = useState<'menu' | 'setup' | 'select_players' | 'customize'>('menu');
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    // Setup Form State
    const [courseName, setCourseName] = useState('');
    const [recentCourses, setRecentCourses] = useState<string[]>(() => {
        const saved = localStorage.getItem('cdg_courses');
        return saved ? JSON.parse(saved) : [];
    });
    const [layout, setLayout] = useState<'9' | '18' | 'custom'>('18');
    const [customHoles, setCustomHoles] = useState(21);
    const [hasEntryFee, setHasEntryFee] = useState(true);
    const [entryFee, setEntryFee] = useState(() => {
        const saved = localStorage.getItem('cdg_default_entry_fee');
        return saved ? parseInt(saved, 10) : 1000;
    });
    const [acePot, setAcePot] = useState(() => {
        const saved = localStorage.getItem('cdg_default_ace_pot');
        return saved ? parseInt(saved, 10) : 500;
    });

    // Player Selection State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCardmates, setSelectedCardmates] = useState<DisplayProfile[]>([]);
    const [foundUser, setFoundUser] = useState<DisplayProfile | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [playerTab, setPlayerTab] = useState<'frequent' | 'recent' | 'a-z'>('frequent');
    const [wiggleSearchButton, setWiggleSearchButton] = useState(false);

    // Player Scanner State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Join Scanner State
    const [joinScanActive, setJoinScanActive] = useState(false);
    const joinScanVideoRef = useRef<HTMLVideoElement | null>(null);
    const joinScanCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Customize View State
    const [excludedPlayers, setExcludedPlayers] = useState<Set<string>>(new Set());
    const [paidStatus, setPaidStatus] = useState<Record<string, boolean>>({});
    const [paymentSelections, setPaymentSelections] = useState<Record<string, { entry: boolean; ace: boolean }>>({});

    // Payment Modal Logic
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState<DisplayProfile | null>(null);
    const [paymentInvoice, setPaymentInvoice] = useState('');
    const [paymentQuote, setPaymentQuote] = useState('');
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [isPayingWallet, setIsPayingWallet] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [showFundingGuide, setShowFundingGuide] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [startHole, setStartHole] = useState(1);
    const [trackPenalties, setTrackPenalties] = useState(false);
    const [hideOverallScore, setHideOverallScore] = useState(false);
    const [orderPlayersByTee, setOrderPlayersByTee] = useState(true);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));

    // Payout Configuration State
    const [payoutMode, setPayoutMode] = useState<'winner-take-all' | 'percentage-based'>('winner-take-all');
    const [payoutPercentage, setPayoutPercentage] = useState(30);
    const [customPayoutPercentage, setCustomPayoutPercentage] = useState(30);
    const [payoutGradient, setPayoutGradient] = useState<'top-heavy' | 'linear'>('top-heavy');
    const [acePotRedistribution, setAcePotRedistribution] = useState<'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants'>('add-to-entry-pot');
    const [playerHandicaps, setPlayerHandicaps] = useState<Record<string, number>>({});
    const [handicapEnabled, setHandicapEnabled] = useState(false);
    const [startHoleEnabled, setStartHoleEnabled] = useState(false);
    const [useHonorSystem, setUseHonorSystem] = useState(true);
    const [customizeTab, setCustomizeTab] = useState<'players' | 'settings'>('players');

    const [pendingRoundId, setPendingRoundId] = useState(() => Math.random().toString(36).substring(7));
    const [joinError, setJoinError] = useState('');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showStartConfirm, setShowStartConfirm] = useState(false);
    const [showDiscardDraftConfirm, setShowDiscardDraftConfirm] = useState(false);
    const [cancelFundOption, setCancelFundOption] = useState<'pay-winner' | 'redistribute' | 'host-keeps'>('pay-winner');

    // Info Modal State
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
    const [showTeeOrderInfo, setShowTeeOrderInfo] = useState(false);

    // Guided Tour State
    const shouldShowTour = useTourStatus('play-tab');
    const [showTour, setShowTour] = useState(false);

    const tourSteps: TourStep[] = [
        { targetId: 'tour-create-round', title: 'Create Round', content: "Start here to host a round. Set your course and invite cardmates. Entry fees are optional!" },
        { targetId: 'tour-join-round', title: 'Join Round', content: "Show your QR code so friends can scan you into their round. They scan YOU!" },
        { targetId: 'tour-help', title: 'Need Help?', content: "This guide is always here if you get stuck." },
        { targetId: 'tour-nav-wallet', title: 'Wallet', content: "Manage your sats here. Deposit via Lightning, view transactions, and withdraw anytime.", position: 'top' },
        { targetId: 'tour-nav-profile', title: 'Profile', content: "Your identity, player stats, and key backup all live here. Now go play!", position: 'top' },
    ];

    useEffect(() => {
        if (shouldShowTour && isAuthenticated && !isGuest) {
            const timer = setTimeout(() => setShowTour(true), 500);
            return () => clearTimeout(timer);
        }
    }, [shouldShowTour, isAuthenticated, isGuest]);

    // Player QR Modal State
    const [showPlayerQr, setShowPlayerQr] = useState(false);
    const [inviteQrData, setInviteQrData] = useState('');
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
    const [paymentRequestsSent, setPaymentRequestsSent] = useState(false);

    // Round Template State
    const [savedTemplates, setSavedTemplates] = useState<RoundTemplate[]>(() => {
        try {
            const saved = localStorage.getItem('cdg_round_templates');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [templateName, setTemplateName] = useState('');

    // Default Fee Settings (persisted)
    const [defaultEntryFee, setDefaultEntryFee] = useState(() => {
        const saved = localStorage.getItem('cdg_default_entry_fee');
        return saved ? parseInt(saved, 10) : 1000;
    });
    const [defaultAcePot, setDefaultAcePot] = useState(() => {
        const saved = localStorage.getItem('cdg_default_ace_pot');
        return saved ? parseInt(saved, 10) : 500;
    });

    useEffect(() => { localStorage.setItem('cdg_default_entry_fee', defaultEntryFee.toString()); }, [defaultEntryFee]);
    useEffect(() => { localStorage.setItem('cdg_default_ace_pot', defaultAcePot.toString()); }, [defaultAcePot]);
    useEffect(() => { localStorage.setItem('cdg_round_templates', JSON.stringify(savedTemplates)); }, [savedTemplates]);

    // Settings dropdown expansion state
    const [settingsExpanded, setSettingsExpanded] = useState<Record<string, boolean>>({});
    const toggleSettingsSection = (section: string) => {
        setSettingsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Auto-follow added players setting (persisted)
    const [autoFollowPlayers, setAutoFollowPlayers] = useState(() => {
        const saved = localStorage.getItem('cdg_auto_follow_players');
        return saved === 'true';
    });
    useEffect(() => { localStorage.setItem('cdg_auto_follow_players', autoFollowPlayers.toString()); }, [autoFollowPlayers]);

    // Post results to Nostr setting (persisted)
    const [postResults, setPostResults] = useState(() => {
        const saved = localStorage.getItem('cdg_post_results');
        return saved !== 'false';
    });
    useEffect(() => { localStorage.setItem('cdg_post_results', postResults.toString()); }, [postResults]);

    // Tournament navigation handler
    const handleCreateTournament = () => navigate('/events');

    // Instant Invite State
    const [showInstantInviteModal, setShowInstantInviteModal] = useState(false);
    const [instantInviteName, setInstantInviteName] = useState('');

    // Wallet pill - subtle color drift animation
    const [walletPillColorIndex, setWalletPillColorIndex] = useState(0);
    const walletPillColors = [
        { r: 249, g: 115, b: 22 },
        { r: 59, g: 130, b: 246 },
        { r: 16, g: 185, b: 129 },
        { r: 168, g: 85, b: 247 },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setWalletPillColorIndex(prev => (prev + 1) % walletPillColors.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isAuthenticated && !isGuest) {
            refreshAllBalances();
        }
    }, [isAuthenticated, isGuest]);

    const totalWalletBalance = walletBalances.cashu + walletBalances.nwc + walletBalances.breez;
    const currentColor = walletPillColors[walletPillColorIndex];
    const pillBgColor = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.15)`;
    const pillBorderColor = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.25)`;
    const pillIconColor = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.8)`;
    const pillGlowColor = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.1)`;

    const handleInstantInvite = () => {
        setInstantInviteName('');
        setShowInstantInviteModal(true);
    };

    const confirmInstantInvite = async () => {
        if (!instantInviteName.trim()) return;
        setIsGeneratingInvite(true);
        try {
            const sk = generateSecretKey();
            const pk = getPublicKey(sk);
            const nsec = nip19.nsecEncode(sk);
            const inviteLink = `${window.location.origin}/invite?nsec=${nsec}`;
            setInviteQrData(inviteLink);
            const guestName = instantInviteName.trim();
            const magicLUD16 = getMagicLightningAddress(pk);
            const newPlayer: DisplayProfile = { pubkey: pk, name: guestName, image: '', nip05: magicLUD16 };
            addCardmate(newPlayer);
            publishProfileWithKey({ name: guestName, about: 'On-Chain Disc Golf Player', picture: '', lud16: magicLUD16, nip05: '' }, sk).catch(err => console.error("Failed to sync guest profile:", err));
            setShowInstantInviteModal(false);
            setShowPlayerQr(true);
        } catch (e) {
            console.error("Failed to generate invite:", e);
            alert("Failed to generate invite. Please try again.");
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    // Onboarding flow
    const [wiggleLogin, setWiggleLogin] = useState(false);
    const [showLoginHint, setShowLoginHint] = useState(false);

    // Shield Icon Easter Egg
    const [showShieldModal, setShowShieldModal] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [showScoldingModal, setShowScoldingModal] = useState(false);
    const manifestoRef = useRef<HTMLDivElement>(null);

    const handleShieldClick = () => { setShowShieldModal(true); setHasScrolledToBottom(false); };
    const handleManifestoScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop - target.clientHeight < 10) setHasScrolledToBottom(true);
    };
    const handleCloseShieldModal = () => { if (!hasScrolledToBottom) setShowScoldingModal(true); else setShowShieldModal(false); };
    const handleFinishReading = () => { setShowScoldingModal(false); if (manifestoRef.current) manifestoRef.current.scrollTop = 0; };
    const handlePayToSkip = () => { window.location.href = 'lightning:npub1xg8nc32sw6u3m337wzhk8gs3nqmh73r86z6a93s3hetca4jvktls68qyue@npubx.cash?amount=1000000'; setShowScoldingModal(false); setShowShieldModal(false); };

    // Invoice Distribution State
    const [playerInvoices, setPlayerInvoices] = useState<Map<string, PlayerInvoice>>(new Map());
    const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);
    const [invoiceError, setInvoiceError] = useState<string | null>(null);

    // Custom Entry Fee Presets
    const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
        const saved = localStorage.getItem('cdg_custom_entry_presets');
        if (saved) { try { return JSON.parse(saved); } catch (e) { return []; } }
        return [];
    });
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customAmount, setCustomAmount] = useState('');

    // Custom Ace Pot Presets
    const [customAcePresets, setCustomAcePresets] = useState<CustomPreset[]>(() => {
        const saved = localStorage.getItem('cdg_custom_ace_presets');
        if (saved) { try { return JSON.parse(saved); } catch (e) { return []; } }
        return [];
    });
    const [showCustomAceInput, setShowCustomAceInput] = useState(false);
    const [customAceAmount, setCustomAceAmount] = useState('');

    // Help Modals
    const [showSetupHelp, setShowSetupHelp] = useState(false);
    const [showPlayersHelp, setShowPlayersHelp] = useState(false);
    const [showPaymentsHelp, setShowPaymentsHelp] = useState(false);

    const handleGuestActionAttempt = () => {
        if (isGuest) {
            setWiggleLogin(true);
            setShowLoginHint(true);
            setTimeout(() => setWiggleLogin(false), 400);
            setTimeout(() => setShowLoginHint(false), 3000);
            return true;
        }
        return false;
    };

    // Reset paid status when entering customize view
    useEffect(() => {
        if (view === 'customize') {
            const initialStatus: Record<string, boolean> = {};
            const initialPayments: Record<string, { entry: boolean; ace: boolean }> = {};
            [currentUserPubkey, ...selectedCardmates.map(p => p.pubkey)].forEach(pk => {
                if (initialStatus[pk] === undefined) initialStatus[pk] = false;
                if (initialPayments[pk] === undefined) initialPayments[pk] = { entry: true, ace: true };
            });
            setPaidStatus(prev => ({ ...initialStatus, ...prev }));
            setPaymentSelections(prev => ({ ...initialPayments, ...prev }));
        }
    }, [view, currentUserPubkey, selectedCardmates]);

    // Save round creation state to localStorage
    useEffect(() => {
        if (view === 'setup' || view === 'select_players' || view === 'customize') {
            const state: RoundCreationState = {
                view, courseName, layout, customHoles, hasEntryFee, entryFee, acePot,
                selectedCardmates, excludedPlayers: Array.from(excludedPlayers), paidStatus,
                paymentSelections, startDate, startTime, trackPenalties, startHole,
                payoutMode, payoutPercentage, customPayoutPercentage, payoutGradient,
                acePotRedistribution, playerHandicaps, handicapEnabled, startHoleEnabled, useHonorSystem,
            };
            localStorage.setItem('cdg_round_creation', JSON.stringify(state));
        }
    }, [view, courseName, layout, customHoles, hasEntryFee, entryFee, acePot,
        selectedCardmates, excludedPlayers, paidStatus, paymentSelections, startDate, startTime, trackPenalties,
        startHole, payoutMode, payoutPercentage, customPayoutPercentage, payoutGradient, acePotRedistribution, playerHandicaps, handicapEnabled, startHoleEnabled, useHonorSystem]);

    // Restore round creation state on mount
    useEffect(() => {
        const saved = localStorage.getItem('cdg_round_creation');
        if (saved && !activeRound) {
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
                setPaymentSelections(state.paymentSelections || {});
                setStartDate(state.startDate);
                setStartTime(state.startTime);
                setTrackPenalties(state.trackPenalties);
                setStartHole(state.startHole || 1);
                setPayoutMode(state.payoutMode || 'winner-take-all');
                setPayoutPercentage(state.payoutPercentage || 30);
                setCustomPayoutPercentage(state.customPayoutPercentage || 30);
                setPayoutGradient(state.payoutGradient || 'top-heavy');
                setAcePotRedistribution(state.acePotRedistribution || 'add-to-entry-pot');
                setPlayerHandicaps(state.playerHandicaps || {});
                setHandicapEnabled(state.handicapEnabled || false);
                setStartHoleEnabled(state.startHoleEnabled || false);
                setUseHonorSystem(state.useHonorSystem !== false);
            } catch (e) {
                console.error('Failed to restore round creation state:', e);
                clearRoundCreationState();
            }
        }
    }, []);

    // Polling for Player Payment
    useEffect(() => {
        if (showPaymentModal && paymentQuote && !paymentSuccess) {
            pollingRef.current = setInterval(async () => {
                const isPaid = await checkDepositStatus(paymentQuote);
                if (isPaid) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    handlePaymentConfirmed();
                }
            }, 2000);
        }
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [showPaymentModal, paymentQuote, paymentSuccess, checkDepositStatus]);

    // Listen for "Pop to Root" navigation event
    useEffect(() => {
        const handlePopToRoot = (e: CustomEvent) => { if (e.detail.path === '/') setView('menu'); };
        window.addEventListener('popToRoot', handlePopToRoot as EventListener);
        return () => window.removeEventListener('popToRoot', handlePopToRoot as EventListener);
    }, []);

    // Listen for payment confirmations from players (via Gift Wrap)
    useEffect(() => {
        const handler = (e: CustomEvent) => {
            const { senderPubkey } = e.detail;
            if (senderPubkey) {
                setPaidStatus(prev => ({ ...prev, [senderPubkey]: true }));
            }
        };
        window.addEventListener('payment-confirmation-received', handler as EventListener);
        return () => window.removeEventListener('payment-confirmation-received', handler as EventListener);
    }, []);

    // Monitor Invoice Payments
    useEffect(() => {
        if (view !== 'customize' || playerInvoices.size === 0) return;
        const monitorPayments = async () => {
            for (const [pubkey, invoiceData] of playerInvoices.entries()) {
                if (paidStatus[pubkey]) continue;
                try {
                    const isPaid = await checkDepositStatus(invoiceData.paymentHash);
                    if (isPaid) {
                        console.log(`Payment detected for ${pubkey.slice(0, 8)}...`);
                        setPaidStatus(prev => ({ ...prev, [pubkey]: true }));
                    }
                } catch (error) {
                    console.error(`Failed to check payment status for ${pubkey.slice(0, 8)}:`, error);
                }
            }
        };
        monitorPayments();
        const intervalId = setInterval(monitorPayments, 5000);
        return () => clearInterval(intervalId);
    }, [view, playerInvoices, paidStatus, checkDepositStatus]);

    // Scanner Logic
    const {
        isCameraLoading, logs, restart, isNativeScanner, startNativeScan, cameraError, permissionStatus, openAppSettings
    } = useQrScanner({
        videoRef, canvasRef, active: view === 'scan_player',
        onScan: async (data) => {
            // Check for join URL first
            const joinInfo = parseJoinUrl(data);
            if (joinInfo) {
                setShowPlayerQr(false);
                navigate(`/join/${joinInfo.type}/${joinInfo.id}${joinInfo.pubkey ? `?p=${joinInfo.pubkey}` : ''}`);
                return;
            }
            let cleanData = data;
            if (cleanData.startsWith('nostr:')) cleanData = cleanData.replace('nostr:', '');
            if (cleanData.toLowerCase().startsWith('lightning:')) cleanData = cleanData.split(':')[1];
            setView('select_players');
            setSearchQuery(cleanData);
            setIsSearching(true);
            try {
                const user = await lookupUser(cleanData);
                if (user) setFoundUser(user); else alert("Could not find user from QR code.");
            } catch (e) { alert("Invalid QR Code format."); } finally { setIsSearching(false); }
        }
    });

    // Join Scan Scanner Logic
    const {
        isCameraLoading: isJoinScanning,
        isNativeScanner: isJoinNativeScanner,
        startNativeScan: startJoinNativeScan,
    } = useQrScanner({
        videoRef: joinScanVideoRef,
        canvasRef: joinScanCanvasRef,
        active: joinScanActive,
        onScan: async (data) => {
            // Check if it's a join URL first
            const joinInfo = parseJoinUrl(data);
            if (joinInfo) {
                setShowPlayerQr(false);
                setJoinScanActive(false);
                navigate(`/join/${joinInfo.type}/${joinInfo.id}${joinInfo.pubkey ? `?p=${joinInfo.pubkey}` : ''}`);
                return;
            }
            // Not a join URL — show helpful toast/alert
            alert('This doesn\'t appear to be a round or event QR code. If you\'re trying to add a player, use the player scanner during round setup.');
        }
    });

    const handleStartJoinScan = useCallback(() => {
        setJoinScanActive(true);
    }, []);

    const handleStopJoinScan = useCallback(() => {
        setJoinScanActive(false);
    }, []);

    // --- Handler Functions ---

    const handleStartRound = async () => {
        const holes = layout === '9' ? 9 : layout === '18' ? 18 : customHoles;
        if (courseName && !recentCourses.includes(courseName)) {
            const updated = [courseName, ...recentCourses].slice(0, 20);
            setRecentCourses(updated);
            localStorage.setItem('cdg_courses', JSON.stringify(updated));
        }
        const finalPlayers = selectedCardmates.filter(p => !excludedPlayers.has(p.pubkey)).map(p => ({
            ...p, paid: paidStatus[p.pubkey] || false
        }));
        await createRound({
            name: `${courseName} Round`, courseName,
            entryFeeSats: hasEntryFee ? entryFee : 0, acePotFeeSats: hasEntryFee ? acePot : 0,
            date: `${startDate}T${startTime}:00Z`, holeCount: holes, startingHole: startHole,
            trackPenalties, hideOverallScore, useHonorSystem,
            payoutConfig: { mode: payoutMode, percentageThreshold: payoutMode === 'percentage-based' ? payoutPercentage : undefined, gradient: payoutGradient, acePotRedistribution },
            playerHandicaps
        }, finalPlayers, paymentSelections, pendingRoundId);
        setPendingRoundId(Math.random().toString(36).substring(7));
        setShowStartConfirm(false);
        clearRoundCreationState();
        setView('menu');
        navigate('/play');
    };

    const handleSearch = async () => {
        if (!searchQuery) return;
        setIsSearching(true);
        setFoundUser(null);
        let user = null;
        const cleanQuery = searchQuery.trim().replace(/^#/, '');
        if (/^\d{4,7}$/.test(cleanQuery)) user = await lookupByPDGA(cleanQuery);
        if (!user) user = await lookupUser(searchQuery);
        setFoundUser(user);
        setIsSearching(false);
    };

    const addCardmate = (player: DisplayProfile) => {
        if (!selectedCardmates.find(p => p.pubkey === player.pubkey)) {
            setSelectedCardmates(prev => [...prev, player]);
            addRecentPlayer(player);
            if (foundUser?.pubkey === player.pubkey) { setFoundUser(null); setSearchQuery(''); }
        }
    };

    const removeCardmate = (pubkey: string) => {
        setSelectedCardmates(prev => prev.filter(p => p.pubkey !== pubkey));
    };

    const goToSettings = () => {
        if (view !== 'settings' && view !== 'scan_player') setPreviousView(view as any);
        setView('settings');
    };

    const goBackFromSettings = () => { setView(previousView); };

    const toggleScoreExclusion = (pubkey: string) => {
        setExcludedPlayers(prev => {
            const next = new Set(prev);
            if (next.has(pubkey)) next.delete(pubkey); else next.add(pubkey);
            return next;
        });
    };

    const formatHandle = (p: DisplayProfile) => {
        if (p.nip05) { return p.nip05.length > 30 ? `${p.nip05.substring(0, 10)}...` : p.nip05; }
        try { return String(nip19.npubEncode(p.pubkey)).substring(0, 10) + '...'; } catch (e) { return 'Nostr User'; }
    };

    const handleCreateRoundClick = () => {
        if (handleGuestActionAttempt()) return;
        if (activeRound && !activeRound.isFinalized) { setShowResetConfirm(true); }
        else {
            const savedDraft = localStorage.getItem('cdg_round_creation');
            if (savedDraft) setShowDiscardDraftConfirm(true); else setView('setup');
        }
    };

    const handleDiscardDraft = () => { clearRoundCreationState(); setShowDiscardDraftConfirm(false); setView('setup'); };

    const handleResumeDraft = () => {
        setShowDiscardDraftConfirm(false);
        const saved = localStorage.getItem('cdg_round_creation');
        if (saved) {
            try {
                const state: RoundCreationState = JSON.parse(saved);
                setView(state.view); setCourseName(state.courseName); setLayout(state.layout);
                setCustomHoles(state.customHoles); setHasEntryFee(state.hasEntryFee);
                setEntryFee(state.entryFee); setAcePot(state.acePot);
                setSelectedCardmates(state.selectedCardmates);
                setExcludedPlayers(new Set(state.excludedPlayers));
                setPaidStatus(state.paidStatus); setStartDate(state.startDate);
                setStartTime(state.startTime); setTrackPenalties(state.trackPenalties);
            } catch (e) { console.error('Failed to restore round creation state:', e); clearRoundCreationState(); setView('setup'); }
        }
    };

    const confirmNewRound = async () => {
        if (activeRound) {
            const entryPayers = players.filter(p => p.paysEntry);
            const acePayers = players.filter(p => p.paysAce);
            const entryPot = entryPayers.length * activeRound.entryFeeSats;
            const acePotTotal = acePayers.length * activeRound.acePotFeeSats;
            const totalPot = entryPot + acePotTotal;
            if (totalPot > 0) {
                const aceWinners: { playerId: string; name: string; hole: number }[] = [];
                players.forEach(player => {
                    Object.entries(player.scores).forEach(([hole, score]) => {
                        if (score === 1) aceWinners.push({ playerId: player.id, name: player.name, hole: parseInt(hole) });
                    });
                });
                switch (cancelFundOption) {
                    case 'pay-winner':
                        const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);
                        const winner = sortedPlayers[0];
                        if (winner && entryPot > 0) console.log(`[Cancel Round] Paying winner ${winner.name}: ${entryPot} sats`);
                        if (aceWinners.length > 0 && acePotTotal > 0) console.log(`[Cancel Round] Paying ace winner ${aceWinners[0].name}: ${acePotTotal} sats`);
                        break;
                    case 'redistribute':
                        players.forEach(player => {
                            let refundAmount = 0;
                            if (player.paysEntry) refundAmount += activeRound.entryFeeSats;
                            if (player.paysAce) refundAmount += activeRound.acePotFeeSats;
                            if (refundAmount > 0) console.log(`[Cancel Round] Refunding ${player.name}: ${refundAmount} sats`);
                        });
                        break;
                    case 'host-keeps':
                        console.log(`[Cancel Round] Host keeps pot: ${totalPot} sats`);
                        break;
                }
            }
        }
        resetRound();
        clearRoundCreationState();
        setShowResetConfirm(false);
        setCancelFundOption('pay-winner');
        setView('setup');
    };

    const toggleTopic = (topic: string) => { setExpandedTopic(prev => prev === topic ? null : topic); };

    const openPaymentModal = async (player: DisplayProfile) => {
        setPaymentTarget(player); setShowPaymentModal(true); setPaymentInvoice(''); setPaymentQuote('');
        setPaymentSuccess(false); setPaymentError(null); setIsGeneratingInvoice(true); setIsPayingWallet(false);
        try {
            const totalAmount = entryFee + acePot;
            const { request, quote } = await depositFunds(totalAmount);
            setPaymentInvoice(request); setPaymentQuote(quote);
        } catch (e) {
            console.error("Failed to generate invoice for player", e);
            setPaymentError("Could not contact mint to generate invoice."); setShowPaymentModal(false);
        } finally { setIsGeneratingInvoice(false); }
    };

    const handlePaymentConfirmed = async () => {
        const totalAmount = entryFee + acePot;
        if (paymentQuote) {
            try {
                await confirmDeposit(paymentQuote, totalAmount);
                setPaymentSuccess(true);
                if (paymentTarget) setPaidStatus(prev => ({ ...prev, [paymentTarget.pubkey]: true }));
                setTimeout(() => { setShowPaymentModal(false); setPaymentTarget(null); }, 2000);
            } catch (e) { console.error("Failed to claim funds", e); setPaymentError("Failed to claim funds from mint."); }
        }
    };

    const handlePayWithWallet = async () => {
        const totalAmount = entryFee + acePot;
        setPaymentError(null);
        if (walletBalance < totalAmount) {
            const shortfall = totalAmount - walletBalance;
            setPaymentError(`Insufficient balance. Need ${formatAmount(shortfall)} more.`);
            return;
        }
        setIsPayingWallet(true);
        try {
            setPaymentSuccess(true);
            if (paymentTarget) setPaidStatus(prev => ({ ...prev, [paymentTarget.pubkey]: true }));
            setTimeout(() => { setShowPaymentModal(false); setPaymentTarget(null); setIsPayingWallet(false); }, 2000);
        } catch (e) {
            console.error("Wallet pay failed", e);
            setPaymentError("Payment failed: " + (e instanceof Error ? e.message : "Unknown error"));
            setIsPayingWallet(false);
        }
    };

    const handleHostPaysForCardmate = async () => {
        if (!paymentTarget) return;
        const totalAmount = entryFee + acePot;
        setPaymentError(null);
        if (walletBalance < totalAmount) {
            const shortfall = totalAmount - walletBalance;
            setPaymentError(`Insufficient balance. Need ${formatAmount(shortfall)} more.`);
            return;
        }
        if (confirm(`Pay ${totalAmount.toLocaleString()} sats from your wallet to cover ${paymentTarget.name}'s entry fee? You can collect cash from them later.`)) {
            setIsPayingWallet(true);
            try {
                const success = await sendFunds(totalAmount, paymentInvoice);
                if (!success) { setPaymentError("Payment failed. Please try again."); setIsPayingWallet(false); }
            } catch (e) {
                console.error("Host payment for cardmate failed", e);
                setPaymentError("Payment failed: " + (e instanceof Error ? e.message : "Unknown error"));
                setIsPayingWallet(false);
            }
        }
    };

    const handleConfirmCardmates = async () => {
        const playerPubkeys = selectedCardmates.map(p => p.pubkey);
        if (playerPubkeys.length > 0) updateContactList(playerPubkeys).catch(err => console.error("Auto-follow failed", err));
        if (!hasEntryFee || (entryFee === 0 && acePot === 0)) { setView('customize'); return; }
        setIsGeneratingInvoices(true); setInvoiceError(null);
        try {
            const userSkHex = localStorage.getItem('nostr_sk');
            if (!userSkHex) throw new Error('Cannot send invoices: No secret key found');
            const userSk = hexToBytes(userSkHex);
            const invoiceMap = new Map<string, PlayerInvoice>();
            const relays = getRelays();
            for (const player of selectedCardmates) {
                const payment = paymentSelections[player.pubkey] || { entry: true, ace: true };
                let amount = 0;
                if (payment.entry && entryFee > 0) amount += entryFee;
                if (payment.ace && acePot > 0) amount += acePot;
                if (amount === 0) continue;
                const { request: invoice, quote: paymentHash } = await depositFunds(amount);
                const messageContent = JSON.stringify({
                    type: 'payment_request',
                    round: { course: courseName || 'Disc Golf Round', host: userProfile.name, date: `${startDate} ${startTime}` },
                    invoice, amount,
                    breakdown: { entryFee: payment.entry ? entryFee : 0, acePot: payment.ace ? acePot : 0 },
                    message: `${userProfile.name} invited you to play at ${courseName || 'disc golf'}. Please pay to confirm your spot!`
                });
                await sendGiftWrap(messageContent, userSk, player.pubkey, relays, 14);
                invoiceMap.set(player.pubkey, { invoice, paymentHash, amount, timestamp: Date.now() });
                console.log(`Invoice sent to ${player.name} (${amount} sats)`);
            }
            setPlayerInvoices(invoiceMap);
            setPaymentRequestsSent(true);
            setView('customize');
            console.log(`Successfully sent ${invoiceMap.size} invoices via Nostr DMs`);
        } catch (error) {
            console.error('Invoice generation failed:', error);
            setInvoiceError(error instanceof Error ? error.message : 'Failed to generate invoices');
            setTimeout(() => { setView('customize'); }, 2000);
        } finally { setIsGeneratingInvoices(false); }
    };

    const handleResendPaymentRequests = async () => {
        setIsGeneratingInvoices(true);
        try {
            const userSkHex = localStorage.getItem('nostr_sk');
            if (!userSkHex) return;
            const userSk = hexToBytes(userSkHex);
            const relays = getRelays();
            const invoiceMap = new Map(playerInvoices);
            for (const player of selectedCardmates) {
                if (paidStatus[player.pubkey]) continue;
                const payment = paymentSelections[player.pubkey] || { entry: true, ace: true };
                let amount = 0;
                if (payment.entry && entryFee > 0) amount += entryFee;
                if (payment.ace && acePot > 0) amount += acePot;
                if (amount === 0) continue;
                const { request: invoice, quote: paymentHash } = await depositFunds(amount);
                const messageContent = JSON.stringify({
                    type: 'payment_request',
                    round: { course: courseName || 'Disc Golf Round', host: userProfile.name, date: `${startDate} ${startTime}` },
                    invoice, amount,
                    breakdown: { entryFee: payment.entry ? entryFee : 0, acePot: payment.ace ? acePot : 0 },
                    message: `${userProfile.name} invited you to play at ${courseName || 'disc golf'}. Please pay to confirm your spot!`
                });
                await sendGiftWrap(messageContent, userSk, player.pubkey, relays, 14);
                invoiceMap.set(player.pubkey, { invoice, paymentHash, amount, timestamp: Date.now() });
            }
            setPlayerInvoices(invoiceMap);
        } catch (e) {
            console.error('Resend failed:', e);
        } finally { setIsGeneratingInvoices(false); }
    };

    const handleOpenLightningWallet = () => { if (paymentInvoice) window.location.href = `lightning:${paymentInvoice}`; };

    const handleCopyInvoice = async () => {
        if (paymentInvoice) {
            try { await navigator.clipboard.writeText(paymentInvoice); } catch (e) { console.error('Failed to copy invoice:', e); setPaymentError('Failed to copy to clipboard'); }
        }
    };

    const getPlayerQrData = () => {
        if (inviteQrData) return inviteQrData;
        if (userProfile.nip05) return userProfile.nip05;
        try { return String(nip19.npubEncode(currentUserPubkey)); } catch (e) { return currentUserPubkey; }
    };

    const handleSaveCustomPreset = () => {
        const amount = parseInt(customAmount);
        if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount'); return; }
        if (customPresets.length >= 3) { alert('Maximum 3 custom presets allowed. Delete one to add another.'); return; }
        const newPreset: CustomPreset = { amount, id: Date.now().toString() };
        const updated = [...customPresets, newPreset];
        setCustomPresets(updated);
        localStorage.setItem('cdg_custom_entry_presets', JSON.stringify(updated));
        setEntryFee(amount); setCustomAmount(''); setShowCustomInput(false);
    };

    const handleDeleteCustomPreset = (id: string) => {
        const updated = customPresets.filter(p => p.id !== id);
        setCustomPresets(updated);
        localStorage.setItem('cdg_custom_entry_presets', JSON.stringify(updated));
    };

    const handleSaveCustomAcePreset = () => {
        const amount = parseInt(customAceAmount);
        if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount'); return; }
        if (customAcePresets.length >= 3) { alert('Maximum 3 custom presets allowed. Delete one to add another.'); return; }
        const newPreset: CustomPreset = { amount, id: Date.now().toString() };
        const updated = [...customAcePresets, newPreset];
        setCustomAcePresets(updated);
        localStorage.setItem('cdg_custom_ace_presets', JSON.stringify(updated));
        setAcePot(amount); setCustomAceAmount(''); setShowCustomAceInput(false);
    };

    const handleDeleteCustomAcePreset = (id: string) => {
        const updated = customAcePresets.filter(p => p.id !== id);
        setCustomAcePresets(updated);
        localStorage.setItem('cdg_custom_ace_presets', JSON.stringify(updated));
    };

    // Filter displayed list based on Tab and Search
    const getDisplayedPlayers = () => {
        let list: DisplayProfile[] = [];
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const all = [...recentPlayers, ...contacts];
            const uniqueMap = new Map();
            all.forEach(p => uniqueMap.set(p.pubkey, p));
            list = Array.from(uniqueMap.values());
            list = list.filter(p => p.name.toLowerCase().includes(q) || (p.nip05 && p.nip05.toLowerCase().includes(q)) || (p.pdga && p.pdga.includes(q)));
        } else {
            if (playerTab === 'frequent' || playerTab === 'recent') list = recentPlayers;
            else if (playerTab === 'a-z') list = contacts;
        }
        list = list.filter(p => !selectedCardmates.find(s => s.pubkey === p.pubkey));
        return list;
    };

    const displayedList = getDisplayedPlayers();

    // Compute allPlayers for customize view
    const allPlayers: AllPlayer[] = [
        {
            pubkey: currentUserPubkey || 'me',
            name: userProfile.name,
            image: userProfile.picture,
            nip05: String(userProfile.lud16 || userProfile.nip05 || ''),
            isHost: true
        },
        ...selectedCardmates
    ];

    // --- View Rendering ---

    if (view === 'scan_player') {
        return (
            <HomeScanPlayerView
                isCameraLoading={isCameraLoading}
                cameraError={cameraError}
                logs={logs}
                videoRef={videoRef}
                canvasRef={canvasRef}
                restart={restart}
                isNativeScanner={isNativeScanner}
                permissionStatus={permissionStatus}
                startNativeScan={startNativeScan}
                openAppSettings={openAppSettings}
                setView={setView}
            />
        );
    }

    if (view === 'customize') {
        return (
            <HomeCustomizeView
                paymentRequestsSent={paymentRequestsSent}
                paymentRequestCount={playerInvoices.size}
                onResendPaymentRequests={handleResendPaymentRequests}
                isResendingRequests={isGeneratingInvoices}
                allPlayers={allPlayers}
                selectedCardmates={selectedCardmates}
                excludedPlayers={excludedPlayers}
                paidStatus={paidStatus}
                paymentSelections={paymentSelections}
                showPaymentModal={showPaymentModal}
                setShowPaymentModal={setShowPaymentModal}
                paymentTarget={paymentTarget}
                paymentInvoice={paymentInvoice}
                paymentQuote={paymentQuote}
                isGeneratingInvoice={isGeneratingInvoice}
                isPayingWallet={isPayingWallet}
                paymentSuccess={paymentSuccess}
                paymentError={paymentError}
                showFundingGuide={showFundingGuide}
                setShowFundingGuide={setShowFundingGuide}
                payoutMode={payoutMode}
                setPayoutMode={setPayoutMode}
                payoutPercentage={payoutPercentage}
                setPayoutPercentage={setPayoutPercentage}
                customPayoutPercentage={customPayoutPercentage}
                setCustomPayoutPercentage={setCustomPayoutPercentage}
                payoutGradient={payoutGradient}
                setPayoutGradient={setPayoutGradient}
                acePotRedistribution={acePotRedistribution}
                setAcePotRedistribution={setAcePotRedistribution}
                handicapEnabled={handicapEnabled}
                setHandicapEnabled={setHandicapEnabled}
                playerHandicaps={playerHandicaps}
                setPlayerHandicaps={setPlayerHandicaps}
                startHoleEnabled={startHoleEnabled}
                setStartHoleEnabled={setStartHoleEnabled}
                startHole={startHole}
                setStartHole={setStartHole}
                useHonorSystem={useHonorSystem}
                setUseHonorSystem={setUseHonorSystem}
                showTeeOrderInfo={showTeeOrderInfo}
                setShowTeeOrderInfo={setShowTeeOrderInfo}
                customizeTab={customizeTab}
                setCustomizeTab={setCustomizeTab}
                hasEntryFee={hasEntryFee}
                entryFee={entryFee}
                acePot={acePot}
                layout={layout}
                customHoles={customHoles}
                toggleScoreExclusion={toggleScoreExclusion}
                openPaymentModal={openPaymentModal}
                handlePayWithWallet={handlePayWithWallet}
                handleHostPaysForCardmate={handleHostPaysForCardmate}
                handleOpenLightningWallet={handleOpenLightningWallet}
                handleCopyInvoice={handleCopyInvoice}
                handleStartRound={handleStartRound}
                currentUserPubkey={currentUserPubkey}
                userProfile={userProfile as any}
                showStartConfirm={showStartConfirm}
                showPaymentsHelp={showPaymentsHelp}
                setShowPaymentsHelp={setShowPaymentsHelp}
                setView={setView}
                goToSettings={goToSettings}
                formatAmount={formatAmount}
                walletBalance={walletBalance}
                getMagicLightningAddress={getMagicLightningAddress}
                getTopHeavyDistribution={getTopHeavyDistribution}
                getLinearDistribution={getLinearDistribution}
            />
        );
    }

    if (view === 'select_players') {
        return (
            <HomeSelectPlayersView
                selectedCardmates={selectedCardmates}
                setSelectedCardmates={setSelectedCardmates}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                isSearching={isSearching}
                foundUser={foundUser}
                playerTab={playerTab}
                setPlayerTab={setPlayerTab}
                displayedList={displayedList}
                addCardmate={addCardmate}
                removeCardmate={removeCardmate}
                showPlayerQr={showPlayerQr}
                setShowPlayerQr={setShowPlayerQr}
                inviteQrData={inviteQrData}
                isGeneratingInvite={isGeneratingInvite}
                getPlayerQrData={getPlayerQrData}
                showInstantInviteModal={showInstantInviteModal}
                setShowInstantInviteModal={setShowInstantInviteModal}
                instantInviteName={instantInviteName}
                setInstantInviteName={setInstantInviteName}
                handleInstantInvite={handleInstantInvite}
                confirmInstantInvite={confirmInstantInvite}
                wiggleSearchButton={wiggleSearchButton}
                setWiggleSearchButton={setWiggleSearchButton}
                setView={setView}
                goToSettings={goToSettings}
                showPlayersHelp={showPlayersHelp}
                setShowPlayersHelp={setShowPlayersHelp}
                handleConfirmCardmates={handleConfirmCardmates}
                isGeneratingInvoices={isGeneratingInvoices}
                invoiceError={invoiceError}
                paymentSelections={paymentSelections}
                setPaymentSelections={setPaymentSelections}
                hasEntryFee={hasEntryFee}
                entryFee={entryFee}
                acePot={acePot}
                pendingRoundId={pendingRoundId}
                currentUserPubkey={currentUserPubkey}
                userProfile={userProfile as any}
                formatHandle={formatHandle}
                showShieldModal={showShieldModal}
                setShowShieldModal={setShowShieldModal}
                hasScrolledToBottom={hasScrolledToBottom}
                handleManifestoScroll={handleManifestoScroll}
                handleCloseShieldModal={handleCloseShieldModal}
                handleShieldClick={handleShieldClick}
                manifestoRef={manifestoRef}
                showScoldingModal={showScoldingModal}
                handleFinishReading={handleFinishReading}
                handlePayToSkip={handlePayToSkip}
            />
        );
    }

    if (view === 'setup') {
        return (
            <HomeSetupView
                courseName={courseName}
                setCourseName={setCourseName}
                recentCourses={recentCourses}
                layout={layout}
                setLayout={setLayout}
                customHoles={customHoles}
                setCustomHoles={setCustomHoles}
                hasEntryFee={hasEntryFee}
                setHasEntryFee={setHasEntryFee}
                entryFee={entryFee}
                setEntryFee={setEntryFee}
                acePot={acePot}
                setAcePot={setAcePot}
                customPresets={customPresets}
                customAcePresets={customAcePresets}
                handleSaveCustomPreset={handleSaveCustomPreset}
                handleDeleteCustomPreset={handleDeleteCustomPreset}
                handleSaveCustomAcePreset={handleSaveCustomAcePreset}
                handleDeleteCustomAcePreset={handleDeleteCustomAcePreset}
                showCustomInput={showCustomInput}
                setShowCustomInput={setShowCustomInput}
                customAmount={customAmount}
                setCustomAmount={setCustomAmount}
                showCustomAceInput={showCustomAceInput}
                setShowCustomAceInput={setShowCustomAceInput}
                customAceAmount={customAceAmount}
                setCustomAceAmount={setCustomAceAmount}
                showSetupHelp={showSetupHelp}
                setShowSetupHelp={setShowSetupHelp}
                setView={setView}
                goToSettings={goToSettings}
            />
        );
    }

    if (view === 'settings') {
        return (
            <HomeSettingsView
                autoFollowPlayers={autoFollowPlayers}
                setAutoFollowPlayers={setAutoFollowPlayers}
                postResults={postResults}
                setPostResults={setPostResults}
                defaultEntryFee={defaultEntryFee}
                setDefaultEntryFee={setDefaultEntryFee}
                defaultAcePot={defaultAcePot}
                setDefaultAcePot={setDefaultAcePot}
                settingsExpanded={settingsExpanded}
                toggleSettingsSection={toggleSettingsSection}
                customPresets={customPresets}
                customAcePresets={customAcePresets}
                savedTemplates={savedTemplates}
                setSavedTemplates={setSavedTemplates}
                showSaveTemplateModal={showSaveTemplateModal}
                setShowSaveTemplateModal={setShowSaveTemplateModal}
                templateName={templateName}
                setTemplateName={setTemplateName}
                goBackFromSettings={goBackFromSettings}
                previousView={previousView}
                layout={layout}
                setLayout={setLayout}
                customHoles={customHoles}
                setCustomHoles={setCustomHoles}
                hasEntryFee={hasEntryFee}
                setHasEntryFee={setHasEntryFee}
                entryFee={entryFee}
                setEntryFee={setEntryFee}
                acePot={acePot}
                setAcePot={setAcePot}
                selectedCardmates={selectedCardmates}
                setSelectedCardmates={setSelectedCardmates}
                setView={setView}
                showFeedbackModal={showFeedbackModal}
                setShowFeedbackModal={setShowFeedbackModal}
            />
        );
    }

    // Default: Menu View
    return (
        <HomeMenuView
            activeRound={activeRound}
            players={players}
            walletBalance={walletBalance}
            walletBalances={walletBalances}
            isBalanceLoading={isBalanceLoading}
            totalWalletBalance={totalWalletBalance}
            pillBgColor={pillBgColor}
            pillBorderColor={pillBorderColor}
            pillIconColor={pillIconColor}
            pillGlowColor={pillGlowColor}
            showResetConfirm={showResetConfirm}
            setShowResetConfirm={setShowResetConfirm}
            showDiscardDraftConfirm={showDiscardDraftConfirm}
            setShowDiscardDraftConfirm={setShowDiscardDraftConfirm}
            handleCreateRoundClick={handleCreateRoundClick}
            confirmNewRound={confirmNewRound}
            handleDiscardDraft={handleDiscardDraft}
            handleResumeDraft={handleResumeDraft}
            showInfoModal={showInfoModal}
            setShowInfoModal={setShowInfoModal}
            expandedTopic={expandedTopic}
            toggleTopic={toggleTopic}
            showTour={showTour}
            tourSteps={tourSteps}
            setShowTour={setShowTour}
            handleCreateTournament={handleCreateTournament}
            joinError={joinError}
            setJoinError={setJoinError}
            showFeedbackModal={showFeedbackModal}
            setShowFeedbackModal={setShowFeedbackModal}
            cancelFundOption={cancelFundOption}
            setCancelFundOption={setCancelFundOption}
            navigate={navigate}
            formatAmount={formatAmount}
            showPlayerQr={showPlayerQr}
            setShowPlayerQr={setShowPlayerQr}
            inviteQrData={inviteQrData}
            setInviteQrData={setInviteQrData}
            getPlayerQrData={getPlayerQrData}
            onStartJoinScan={handleStartJoinScan}
            onStopJoinScan={handleStopJoinScan}
            joinScanActive={joinScanActive}
            isJoinScanning={isJoinScanning}
            joinScanVideoRef={joinScanVideoRef}
            joinScanCanvasRef={joinScanCanvasRef}
            isNativeScanner={isJoinNativeScanner}
            startNativeScan={startJoinNativeScan}
            showInstantInviteModal={showInstantInviteModal}
            setShowInstantInviteModal={setShowInstantInviteModal}
            instantInviteName={instantInviteName}
            setInstantInviteName={setInstantInviteName}
            confirmInstantInvite={confirmInstantInvite}
            isGeneratingInvite={isGeneratingInvite}
            handleInstantInvite={handleInstantInvite}
            currentUserPubkey={currentUserPubkey}
            userProfile={userProfile as any}
            isGuest={isGuest}
            isAuthenticated={isAuthenticated}
            handleGuestActionAttempt={handleGuestActionAttempt}
            wiggleLogin={wiggleLogin}
            showLoginHint={showLoginHint}
            goToSettings={goToSettings}
            setView={setView}
            setCourseName={setCourseName}
            setLayout={setLayout}
            setCustomHoles={setCustomHoles}
            setHasEntryFee={setHasEntryFee}
            setEntryFee={setEntryFee}
            setAcePot={setAcePot}
            setSelectedCardmates={setSelectedCardmates}
            setExcludedPlayers={setExcludedPlayers}
            setPaidStatus={setPaidStatus}
            setStartDate={setStartDate}
            setStartTime={setStartTime}
            setTrackPenalties={setTrackPenalties}
        />
    );
};
