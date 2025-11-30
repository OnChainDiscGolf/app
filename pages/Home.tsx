
import React, { useState, useEffect, useRef } from 'react';
import { useApp, getTopHeavyDistribution, getLinearDistribution } from '../context/AppContext';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { InfoModal } from '../components/InfoModal';
import { useNavigate } from 'react-router-dom';
import { getPool, getRelays, listEvents, lookupUser, publishProfileWithKey, getMagicLightningAddress, updateContactList } from '../services/nostrService';
import { NOSTR_KIND_ROUND, DisplayProfile } from '../types';
import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';
import { useQrScanner } from '../hooks/useQrScanner';
import { sendGiftWrap } from '../services/giftWrapService';
import { hexToBytes } from '@noble/hashes/utils';

// Helper Component for Success Animation (Reusable)
const SuccessOverlay: React.FC<{ message: string, onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center animate-in zoom-in duration-300 rounded-2xl">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/30 animate-in fade-in zoom-in-75 delay-100 duration-500">
                <Icons.CheckMark size={40} className="text-white" strokeWidth={4} />
            </div>
            <h3 className="text-2xl font-bold text-white animate-in slide-in-from-bottom-4 delay-200">{message}</h3>
        </div>
    );
};

// TypeScript interface for persistable round creation state
interface RoundCreationState {
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

// Helper to clear persisted round creation state
const clearRoundCreationState = () => {
    localStorage.removeItem('cdg_round_creation');
};


export const Home: React.FC = () => {
    const { activeRound, players, createRound, joinRoundAndPay, recentPlayers, contacts, userProfile, resetRound, isAuthenticated, isGuest, currentUserPubkey, addRecentPlayer, depositFunds, checkDepositStatus, confirmDeposit, sendFunds, walletBalance } = useApp();
    const navigate = useNavigate();

    // Local UI state for the creation wizard
    const [view, setView] = useState<'menu' | 'setup' | 'select_players' | 'customize' | 'scan_player' | 'settings'>('menu');

    // Setup Form State
    const [courseName, setCourseName] = useState('');
    const [recentCourses, setRecentCourses] = useState<string[]>(() => {
        const saved = localStorage.getItem('cdg_courses');
        return saved ? JSON.parse(saved) : [];
    });
    const [layout, setLayout] = useState<'9' | '18' | 'custom'>('18');
    const [customHoles, setCustomHoles] = useState(21);
    const [hasEntryFee, setHasEntryFee] = useState(true);
    const [entryFee, setEntryFee] = useState(10); // Test default: 10 sats
    const [acePot, setAcePot] = useState(0); // Test default: 0 sats

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
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isCustomExpanded, setIsCustomExpanded] = useState(false);
    const [startHole, setStartHole] = useState(1);
    const [trackPenalties, setTrackPenalties] = useState(false);
    const [hideOverallScore, setHideOverallScore] = useState(false);
    const [orderPlayersByTee, setOrderPlayersByTee] = useState(true);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));

    // Payout Configuration State
    const [payoutMode, setPayoutMode] = useState<'winner-take-all' | 'percentage-based'>('winner-take-all');
    const [payoutPercentage, setPayoutPercentage] = useState(30); // Top 30% default
    const [customPayoutPercentage, setCustomPayoutPercentage] = useState(30); // Store custom value separately
    const [payoutGradient, setPayoutGradient] = useState<'top-heavy' | 'linear'>('top-heavy');
    const [acePotRedistribution, setAcePotRedistribution] = useState<'forfeit' | 'add-to-entry-pot' | 'redistribute-to-participants'>('add-to-entry-pot');
    const [playerHandicaps, setPlayerHandicaps] = useState<Record<string, number>>({});
    const [handicapEnabled, setHandicapEnabled] = useState(false); // Toggle for handicap feature
    const [startHoleEnabled, setStartHoleEnabled] = useState(false); // Toggle for custom starting hole
    const [useHonorSystem, setUseHonorSystem] = useState(true); // Sort by previous hole performance

    const [joinError, setJoinError] = useState('');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showStartConfirm, setShowStartConfirm] = useState(false);
    const [cancelFundOption, setCancelFundOption] = useState<'pay-winner' | 'redistribute' | 'host-keeps'>('pay-winner');

    // Info Modal State
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

    // Player QR Modal State
    const [showPlayerQr, setShowPlayerQr] = useState(false);
    const [inviteQrData, setInviteQrData] = useState('');
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

    // Instant Invite State
    const [showInstantInviteModal, setShowInstantInviteModal] = useState(false);
    const [instantInviteName, setInstantInviteName] = useState('');

    const handleInstantInvite = () => {
        setInstantInviteName('');
        setShowInstantInviteModal(true);
    };

    const confirmInstantInvite = async () => {
        if (!instantInviteName.trim()) return;

        setIsGeneratingInvite(true);
        try {
            // 1. Generate Ephemeral Keypair
            const sk = generateSecretKey();
            const pk = getPublicKey(sk);
            const nsec = nip19.nsecEncode(sk);

            // 2. Create Invite Link
            const inviteLink = `${window.location.origin}/invite?nsec=${nsec}`;
            setInviteQrData(inviteLink);

            // 3. Add Player to Card immediately
            const guestName = instantInviteName.trim();
            const magicLUD16 = getMagicLightningAddress(pk);

            const newPlayer: DisplayProfile = {
                pubkey: pk,
                name: guestName,
                image: '',
                nip05: magicLUD16
            };
            addCardmate(newPlayer);

            // 4. Publish Profile to Relays (Async)
            publishProfileWithKey({
                name: guestName,
                about: 'On-Chain Disc Golf Player',
                picture: '',
                lud16: magicLUD16,
                nip05: ''
            }, sk).catch(err => console.error("Failed to sync guest profile:", err));

            // 5. Show QR Code
            setShowInstantInviteModal(false);
            setShowPlayerQr(true);
        } catch (e) {
            console.error("Failed to generate invite:", e);
            alert("Failed to generate invite. Please try again.");
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    // Onboarding flow - wiggle login button for guest users
    const [wiggleLogin, setWiggleLogin] = useState(false);
    const [showLoginHint, setShowLoginHint] = useState(false);

    // Shield Icon Easter Egg
    const [showShieldModal, setShowShieldModal] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [showScoldingModal, setShowScoldingModal] = useState(false);
    const manifestoRef = useRef<HTMLDivElement>(null);

    const handleShieldClick = () => {
        setShowShieldModal(true);
        setHasScrolledToBottom(false);
    };

    const handleManifestoScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const threshold = 10; // pixels from bottom
        const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
        if (isAtBottom) {
            setHasScrolledToBottom(true);
        }
    };

    const handleCloseShieldModal = () => {
        if (!hasScrolledToBottom) {
            setShowScoldingModal(true);
        } else {
            setShowShieldModal(false);
        }
    };

    const handleFinishReading = () => {
        setShowScoldingModal(false);
        // Scroll to top so they can read
        if (manifestoRef.current) {
            manifestoRef.current.scrollTop = 0;
        }
    };

    const handlePayToSkip = () => {
        // Open Lightning Address payment
        window.location.href = 'lightning:Garrett@minibits.net?amount=1000000'; // 1000 sats in millisats
        setShowScoldingModal(false);
        setShowShieldModal(false);
    };

    // Invoice Distribution State
    interface PlayerInvoice {
        invoice: string;
        paymentHash: string;
        amount: number;
        timestamp: number;
    }
    const [playerInvoices, setPlayerInvoices] = useState<Map<string, PlayerInvoice>>(new Map());
    const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);
    const [invoiceError, setInvoiceError] = useState<string | null>(null);


    // Custom Entry Fee Presets
    interface CustomPreset {
        amount: number;
        id: string;
    }
    const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
        const saved = localStorage.getItem('cdg_custom_entry_presets');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load custom presets:', e);
                return [];
            }
        }
        return [];
    });
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customAmount, setCustomAmount] = useState('');

    // Custom Ace Pot Presets
    const [customAcePresets, setCustomAcePresets] = useState<CustomPreset[]>(() => {
        const saved = localStorage.getItem('cdg_custom_ace_presets');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load custom ace presets:', e);
                return [];
            }
        }
        return [];
    });
    const [showCustomAceInput, setShowCustomAceInput] = useState(false);
    const [customAceAmount, setCustomAceAmount] = useState('');

    // Setup Help Modal
    const [showSetupHelp, setShowSetupHelp] = useState(false);

    const handleGuestActionAttempt = () => {
        if (isGuest) {
            // Wiggle the login button
            setWiggleLogin(true);
            setShowLoginHint(true);
            setTimeout(() => setWiggleLogin(false), 400); // Match wiggle animation duration
            setTimeout(() => setShowLoginHint(false), 3000); // Hide hint after 3 seconds
            return true; // Indicates guest attempted action
        }
        return false; // User is logged in, allow action
    };

    // Reset paid status when entering customize view
    useEffect(() => {
        if (view === 'customize') {
            const initialStatus: Record<string, boolean> = {};
            const initialPayments: Record<string, { entry: boolean; ace: boolean }> = {};
            [currentUserPubkey, ...selectedCardmates.map(p => p.pubkey)].forEach(pk => {
                if (initialStatus[pk] === undefined) initialStatus[pk] = false;
                if (initialPayments[pk] === undefined) initialPayments[pk] = { entry: true, ace: true }; // Default to both
            });
            setPaidStatus(prev => ({ ...initialStatus, ...prev }));
            setPaymentSelections(prev => ({ ...initialPayments, ...prev }));
        }
    }, [view, currentUserPubkey, selectedCardmates]);

    // Save round creation state to localStorage
    useEffect(() => {
        // Only persist if user is actively creating a round
        if (view === 'setup' || view === 'select_players' || view === 'customize') {
            const state: RoundCreationState = {
                view,
                courseName,
                layout,
                customHoles,
                hasEntryFee,
                entryFee,
                acePot,
                selectedCardmates,
                excludedPlayers: Array.from(excludedPlayers),
                paidStatus,
                paymentSelections,
                startDate,
                startTime,
                trackPenalties,
                startHole,
                payoutMode,
                payoutPercentage,
                customPayoutPercentage,
                payoutGradient,
                acePotRedistribution,
                playerHandicaps,
                handicapEnabled,
                startHoleEnabled,
                useHonorSystem,
            };
            localStorage.setItem('cdg_round_creation', JSON.stringify(state));
        } else if (view === 'menu') {
            // Clear if user returns to menu without creating
            clearRoundCreationState();
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
                setUseHonorSystem(state.useHonorSystem !== false); // Default true
            } catch (e) {
                console.error('Failed to restore round creation state:', e);
                clearRoundCreationState();
            }
        }
    }, []); // Run only on mount

    // Polling for Player Payment
    useEffect(() => {
        if (showPaymentModal && paymentQuote && !paymentSuccess) {
            // Poll every 2 seconds
            pollingRef.current = setInterval(async () => {
                const isPaid = await checkDepositStatus(paymentQuote);
                if (isPaid) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    handlePaymentConfirmed();
                }
            }, 2000);
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [showPaymentModal, paymentQuote, paymentSuccess, checkDepositStatus]);

    // Listen for "Pop to Root" navigation event
    useEffect(() => {
        const handlePopToRoot = (e: CustomEvent) => {
            if (e.detail.path === '/') {
                setView('menu');
            }
        };

        window.addEventListener('popToRoot', handlePopToRoot as EventListener);
        return () => window.removeEventListener('popToRoot', handlePopToRoot as EventListener);
    }, []);

    // Monitor Invoice Payments - Poll for payment status
    useEffect(() => {
        if (view !== 'customize' || playerInvoices.size === 0) return;

        const monitorPayments = async () => {
            for (const [pubkey, invoiceData] of playerInvoices.entries()) {
                // Skip if already marked as paid
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

        // Poll immediately
        monitorPayments();

        // Then poll every 5 seconds
        const intervalId = setInterval(monitorPayments, 5000);

        return () => clearInterval(intervalId);
    }, [view, playerInvoices, paidStatus, checkDepositStatus]);

    // Scanner Logic for Adding Players
    const { isCameraLoading, logs, restart } = useQrScanner({
        videoRef,
        canvasRef,
        active: view === 'scan_player',
        onScan: async (data) => {
            let cleanData = data;
            if (cleanData.startsWith('nostr:')) cleanData = cleanData.replace('nostr:', '');
            if (cleanData.toLowerCase().startsWith('lightning:')) cleanData = cleanData.split(':')[1];

            setView('select_players');
            setSearchQuery(cleanData);
            setIsSearching(true);

            try {
                const user = await lookupUser(cleanData);
                if (user) {
                    setFoundUser(user);
                } else {
                    alert("Could not find user from QR code.");
                }
            } catch (e) {
                alert("Invalid QR Code format.");
            } finally {
                setIsSearching(false);
            }
        }
    });

    const handleStartRound = async () => {

        const holes = layout === '9' ? 9 : layout === '18' ? 18 : customHoles;

        if (courseName && !recentCourses.includes(courseName)) {
            const updated = [courseName, ...recentCourses].slice(0, 20);
            setRecentCourses(updated);
            localStorage.setItem('cdg_courses', JSON.stringify(updated));
        }

        const finalPlayers = selectedCardmates.filter(p => !excludedPlayers.has(p.pubkey)).map(p => ({
            ...p,
            paid: paidStatus[p.pubkey] || false
        }));

        await createRound({
            name: `${courseName} Round`,
            courseName,
            entryFeeSats: hasEntryFee ? entryFee : 0,
            acePotFeeSats: hasEntryFee ? acePot : 0,
            date: `${startDate}T${startTime}:00Z`,
            holeCount: holes,
            startingHole: startHole,
            trackPenalties,
            hideOverallScore,
            useHonorSystem,
            payoutConfig: {
                mode: payoutMode,
                percentageThreshold: payoutMode === 'percentage-based' ? payoutPercentage : undefined,
                gradient: payoutGradient,
                acePotRedistribution
            },
            playerHandicaps
        }, finalPlayers, paymentSelections);

        setShowStartConfirm(false);
        clearRoundCreationState(); // Clear persisted state
        setView('menu');
        navigate('/play');
    };

    const handleSearch = async () => {
        if (!searchQuery) return;
        setIsSearching(true);
        setFoundUser(null);
        const user = await lookupUser(searchQuery);
        setFoundUser(user);
        setIsSearching(false);
    };

    const addCardmate = (player: DisplayProfile) => {
        if (!selectedCardmates.find(p => p.pubkey === player.pubkey)) {
            setSelectedCardmates(prev => [...prev, player]);
            // Update recent players immediately to bring to top
            addRecentPlayer(player);

            if (foundUser?.pubkey === player.pubkey) {
                setFoundUser(null);
                setSearchQuery('');
            }
        }
    };

    const removeCardmate = (pubkey: string) => {
        setSelectedCardmates(prev => prev.filter(p => p.pubkey !== pubkey));
    };

    const toggleScoreExclusion = (pubkey: string) => {
        setExcludedPlayers(prev => {
            const next = new Set(prev);
            if (next.has(pubkey)) next.delete(pubkey);
            else next.add(pubkey);
            return next;
        });
    };

    const formatHandle = (p: DisplayProfile) => {
        if (p.nip05) {
            if (p.nip05.length > 30) {
                return `${p.nip05.substring(0, 10)}...`;
            }
            return p.nip05;
        }
        try {
            const npub = nip19.npubEncode(p.pubkey);
            // Ensure we always return a string, not an object
            return String(npub).substring(0, 10) + '...';
        } catch (e) {
            return 'Nostr User';
        }
    };

    const handleCreateRoundClick = () => {
        // If guest, wiggle login button instead
        if (handleGuestActionAttempt()) return;

        if (activeRound && !activeRound.isFinalized) {
            setShowResetConfirm(true);
        } else {
            setView('setup');
        }
    };

    const confirmNewRound = async () => {
        // Handle fund distribution based on selected option
        if (activeRound) {
            const entryPayers = players.filter(p => p.paysEntry);
            const acePayers = players.filter(p => p.paysAce);
            const entryPot = entryPayers.length * activeRound.entryFeeSats;
            const acePot = acePayers.length * activeRound.acePotFeeSats;
            const totalPot = entryPot + acePot;
            
            if (totalPot > 0) {
                // Check for any aces
                const aceWinners: { playerId: string; name: string; hole: number }[] = [];
                players.forEach(player => {
                    Object.entries(player.scores).forEach(([hole, score]) => {
                        if (score === 1) {
                            aceWinners.push({ playerId: player.id, name: player.name, hole: parseInt(hole) });
                        }
                    });
                });
                
                switch (cancelFundOption) {
                    case 'pay-winner':
                        // Pay the current leader the entry pot
                        const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);
                        const winner = sortedPlayers[0];
                        if (winner && entryPot > 0) {
                            console.log(`[Cancel Round] Paying winner ${winner.name}: ${entryPot} sats`);
                            // Payment would be handled via sendFunds similar to finalizeRound
                        }
                        // If there's an ace winner, pay them the ace pot
                        if (aceWinners.length > 0 && acePot > 0) {
                            const aceWinner = aceWinners[0];
                            console.log(`[Cancel Round] Paying ace winner ${aceWinner.name}: ${acePot} sats`);
                        }
                        break;
                        
                    case 'redistribute':
                        // Refund each player what they paid
                        players.forEach(player => {
                            let refundAmount = 0;
                            if (player.paysEntry) refundAmount += activeRound.entryFeeSats;
                            if (player.paysAce) refundAmount += activeRound.acePotFeeSats;
                            if (refundAmount > 0) {
                                console.log(`[Cancel Round] Refunding ${player.name}: ${refundAmount} sats`);
                            }
                        });
                        break;
                        
                    case 'host-keeps':
                        // No action needed - funds stay with host
                        console.log(`[Cancel Round] Host keeps pot: ${totalPot} sats`);
                        break;
                }
            }
        }
        
        resetRound();
        clearRoundCreationState(); // Clear persisted state
        setShowResetConfirm(false);
        setCancelFundOption('pay-winner'); // Reset to default
        setView('setup');
    };

    const toggleTopic = (topic: string) => {
        setExpandedTopic(prev => prev === topic ? null : topic);
    };

    const openPaymentModal = async (player: DisplayProfile) => {
        setPaymentTarget(player);
        setShowPaymentModal(true);
        setPaymentInvoice('');
        setPaymentQuote('');
        setPaymentSuccess(false);
        setPaymentError(null);
        setIsGeneratingInvoice(true);
        setIsPayingWallet(false);

        try {
            const totalAmount = entryFee + acePot;
            const { request, quote } = await depositFunds(totalAmount);
            setPaymentInvoice(request);
            setPaymentQuote(quote);
        } catch (e) {
            console.error("Failed to generate invoice for player", e);
            setPaymentError("Could not contact mint to generate invoice.");
            setShowPaymentModal(false);
        } finally {
            setIsGeneratingInvoice(false);
        }
    };

    const handlePaymentConfirmed = async () => {
        const totalAmount = entryFee + acePot;
        if (paymentQuote) {
            try {
                await confirmDeposit(paymentQuote, totalAmount);
                setPaymentSuccess(true);

                if (paymentTarget) {
                    setPaidStatus(prev => ({ ...prev, [paymentTarget.pubkey]: true }));
                }

                // Close modal after success animation
                setTimeout(() => {
                    setShowPaymentModal(false);
                    setPaymentTarget(null);
                }, 2000);
            } catch (e) {
                console.error("Failed to claim funds", e);
                setPaymentError("Failed to claim funds from mint.");
            }
        }
    };

    const handlePayWithWallet = async () => {
        const totalAmount = entryFee + acePot;
        setPaymentError(null);

        if (walletBalance < totalAmount) {
            setPaymentError(`Insufficient balance. Need ${totalAmount} sats.`);
            // Auto-dismiss error after 5 seconds
            setTimeout(() => setPaymentError(null), 5000);
            return;
        }

        setIsPayingWallet(true);
        try {
            // For the host paying themselves: directly deduct from Cashu wallet
            // We don't need to pay a Lightning invoice - just mark as paid

            // Note: Since this is the host paying for themselves from their own Cashu wallet,
            // we need to deduct the funds. However, the actual funds will be held in the round
            // and distributed at the end. For now, we just mark as paid.
            // The wallet balance adjustment happens when the round is created and funds are locked.

            setPaymentSuccess(true);

            if (paymentTarget) {
                setPaidStatus(prev => ({ ...prev, [paymentTarget.pubkey]: true }));
            }

            // Close modal after success animation
            setTimeout(() => {
                setShowPaymentModal(false);
                setPaymentTarget(null);
                setIsPayingWallet(false);
            }, 2000);

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

        // Double-check balance
        if (walletBalance < totalAmount) {
            setPaymentError(`Insufficient balance. Need ${totalAmount} sats.`);
            // Auto-dismiss error after 5 seconds
            setTimeout(() => setPaymentError(null), 5000);
            return;
        }

        if (confirm(`Pay ${totalAmount} sats from your wallet to cover ${paymentTarget.name}'s entry fee? You can collect cash from them later.`)) {
            setIsPayingWallet(true);
            try {
                // Pay the invoice using the host's wallet
                const success = await sendFunds(totalAmount, paymentInvoice);
                if (!success) {
                    setPaymentError("Payment failed. Please try again.");
                    setIsPayingWallet(false);
                    return;
                }

                // The payment succeeded. The poller will detect it and call handlePaymentConfirmed.
                // Note: Host is paying for cardmate out of pocket, to be reimbursed in cash.

            } catch (e) {
                console.error("Host payment for cardmate failed", e);
                setPaymentError("Payment failed: " + (e instanceof Error ? e.message : "Unknown error"));
                setIsPayingWallet(false);
            }
        }
    };

    // INVOICE DISTRIBUTION: Generate invoices and send via Gift Wrap
    const handleConfirmCardmates = async () => {
        // Auto-follow players (Fire and forget)
        const playerPubkeys = selectedCardmates.map(p => p.pubkey);
        if (playerPubkeys.length > 0) {
            updateContactList(playerPubkeys).catch(err => console.error("Auto-follow failed", err));
        }

        // Check if host has NWC configured
        const walletMode = localStorage.getItem('wallet_mode');
        const nwcString = localStorage.getItem('nwc_connection');

        if (walletMode !== 'nwc' || !nwcString) {
            // Fallback to manual flow
            console.log('NWC not configured, using manual payment flow');
            setView('customize');
            return;
        }

        // Only generate invoices if there are entry fees configured
        if (!hasEntryFee || (entryFee === 0 && acePot === 0)) {
            // No payment required, proceed to customize
            setView('customize');
            return;
        }

        setIsGeneratingInvoices(true);
        setInvoiceError(null);

        try {
            // Get user's secret key for signing gift wraps
            const userSkHex = localStorage.getItem('nostr_sk');
            if (!userSkHex) {
                throw new Error('Cannot send invoices: No secret key found');
            }
            const userSk = hexToBytes(userSkHex);

            const invoiceMap = new Map<string, PlayerInvoice>();
            const relays = getRelays();

            // Generate invoice for each cardmate (not the host)
            for (const player of selectedCardmates) {
                const payment = paymentSelections[player.pubkey] || { entry: true, ace: true };

                // Calculate amount owed
                let amount = 0;
                if (payment.entry && entryFee > 0) amount += entryFee;
                if (payment.ace && acePot > 0) amount += acePot;

                if (amount === 0) continue; // Skip if player owes nothing

                // Generate invoice via NWC
                const { invoice, paymentHash } = await depositFunds(amount);

                // Create gift wrap message content
                const messageContent = JSON.stringify({
                    type: 'payment_request',
                    round: {
                        course: courseName || 'Disc Golf Round',
                        host: userProfile.name,
                        date: `${startDate} ${startTime}`
                    },
                    invoice,
                    amount,
                    breakdown: {
                        entryFee: payment.entry ? entryFee : 0,
                        acePot: payment.ace ? acePot : 0
                    },
                    message: `${userProfile.name} invited you to play at ${courseName || 'disc golf'}. Please pay to confirm your spot!`
                });

                // Send via Gift Wrap
                await sendGiftWrap(
                    messageContent,
                    userSk,
                    player.pubkey,
                    relays,
                    14 // kind 14 = chat message
                );

                // Store invoice data
                invoiceMap.set(player.pubkey, {
                    invoice,
                    paymentHash,
                    amount,
                    timestamp: Date.now()
                });

                console.log(`Invoice sent to ${player.name} (${amount} sats)`);
            }

            // Update state with invoices
            setPlayerInvoices(invoiceMap);

            // Navigate to payment screen
            setView('customize');

            console.log(`Successfully sent ${invoiceMap.size} invoices via Nostr DMs`);

        } catch (error) {
            console.error('Invoice generation failed:', error);
            setInvoiceError(error instanceof Error ? error.message : 'Failed to generate invoices');

            // Fallback: still navigate but show error
            setTimeout(() => {
                setView('customize');
            }, 2000);
        } finally {
            setIsGeneratingInvoices(false);
        }
    };

    const handleOpenLightningWallet = () => {
        if (paymentInvoice) {
            window.location.href = `lightning:${paymentInvoice}`;
        }
    };

    const handleCopyInvoice = async () => {
        if (paymentInvoice) {
            try {
                await navigator.clipboard.writeText(paymentInvoice);
                // Show a brief success indicator (could add a toast or temp message here)
            } catch (e) {
                console.error('Failed to copy invoice:', e);
                setPaymentError('Failed to copy to clipboard');
            }
        }
    };

    const getPlayerQrData = () => {
        if (inviteQrData) return inviteQrData;
        if (userProfile.nip05) return userProfile.nip05;
        try {
            return String(nip19.npubEncode(currentUserPubkey));
        } catch (e) {
            return currentUserPubkey;
        }
    };

    // Custom Preset Management
    const handleSaveCustomPreset = () => {
        const amount = parseInt(customAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Check if we already have 3 custom presets
        if (customPresets.length >= 3) {
            alert('Maximum 3 custom presets allowed. Delete one to add another.');
            return;
        }

        const newPreset: CustomPreset = {
            amount,
            id: Date.now().toString()
        };

        const updated = [...customPresets, newPreset];
        setCustomPresets(updated);
        localStorage.setItem('cdg_custom_entry_presets', JSON.stringify(updated));
        setEntryFee(amount);
        setCustomAmount('');
        setShowCustomInput(false);
    };

    const handleDeleteCustomPreset = (id: string) => {
        const updated = customPresets.filter(p => p.id !== id);
        setCustomPresets(updated);
        localStorage.setItem('cdg_custom_entry_presets', JSON.stringify(updated));
    };

    // Custom Ace Pot Preset Management
    const handleSaveCustomAcePreset = () => {
        const amount = parseInt(customAceAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Check if we already have 3 custom presets
        if (customAcePresets.length >= 3) {
            alert('Maximum 3 custom presets allowed. Delete one to add another.');
            return;
        }

        const newPreset: CustomPreset = {
            amount,
            id: Date.now().toString()
        };

        const updated = [...customAcePresets, newPreset];
        setCustomAcePresets(updated);
        localStorage.setItem('cdg_custom_ace_presets', JSON.stringify(updated));
        setAcePot(amount);
        setCustomAceAmount('');
        setShowCustomAceInput(false);
    };

    const handleDeleteCustomAcePreset = (id: string) => {
        const updated = customAcePresets.filter(p => p.id !== id);
        setCustomAcePresets(updated);
        localStorage.setItem('cdg_custom_ace_presets', JSON.stringify(updated));
    };

    // Filter displayed list based on Tab and Search
    const getDisplayedPlayers = () => {
        let list: DisplayProfile[] = [];

        // If searching, search everything (Recent + Contacts) combined
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const all = [...recentPlayers, ...contacts];
            // Deduplicate by pubkey
            const uniqueMap = new Map();
            all.forEach(p => uniqueMap.set(p.pubkey, p));
            list = Array.from(uniqueMap.values());

            list = list.filter(p => p.name.toLowerCase().includes(q) || (p.nip05 && p.nip05.toLowerCase().includes(q)));
        } else {
            // Otherwise respect tabs
            if (playerTab === 'frequent' || playerTab === 'recent') {
                list = recentPlayers;
            } else if (playerTab === 'a-z') {
                list = contacts;
            }
        }

        // Filter out already selected
        list = list.filter(p => !selectedCardmates.find(s => s.pubkey === p.pubkey));

        return list;
    };

    const displayedList = getDisplayedPlayers();

    // --- SCANNER UI ---
    if (view === 'scan_player') {
        return (
            <div className="relative h-full bg-black flex flex-col">
                <div className="flex-1 relative overflow-hidden">
                    <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover z-10 border-2 border-red-500"
                        muted={true}
                        autoPlay={true}
                        playsInline={true}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Debug Logs */}
                    <div className="absolute top-20 left-4 right-4 z-50 pointer-events-none">
                        <div className="bg-black/70 p-2 rounded text-[10px] text-green-400 font-mono border border-green-900/50 shadow-lg backdrop-blur-sm">
                            {logs.map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="w-64 h-64 border-2 border-brand-primary rounded-lg relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                            {!isCameraLoading && (
                                <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                            )}
                        </div>
                    </div>

                    {/* Manual Start Button if stuck */}
                    <div className="absolute bottom-32 left-0 right-0 z-50 flex justify-center pointer-events-auto">
                        <button
                            onClick={() => restart()}
                            className="bg-brand-primary/80 hover:bg-brand-primary text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm transition-all"
                        >
                            Force Restart Camera
                        </button>
                    </div>

                    <button
                        onClick={() => setView('select_players')}
                        className="absolute top-4 left-4 z-30 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 backdrop-blur-sm"
                    >
                        <Icons.Close size={24} />
                    </button>
                </div>
            </div>
        );
    }

    // --- STEP 3: CUSTOMIZE ROUND ---
    if (view === 'customize') {
        const allPlayers = [
            {
                pubkey: currentUserPubkey || 'me',
                name: userProfile.name,
                image: userProfile.picture,
                nip05: String(userProfile.lud16 || userProfile.nip05 || ''),
                isHost: true
            },
            ...selectedCardmates
        ];

        // Calculate dynamic totals based on player selections
        let totalEntryPot = 0;
        let totalAcePot = 0;
        allPlayers.forEach(p => {
            const payment = paymentSelections[p.pubkey] || { entry: true, ace: true };
            if (payment.entry && entryFee > 0) totalEntryPot += entryFee;
            if (payment.ace && acePot > 0) totalAcePot += acePot;
        });

        return (
            <div className="flex flex-col h-full bg-brand-dark relative">
                <div className="px-4 py-4 flex items-center justify-between bg-brand-dark">
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setView('select_players')} className="text-slate-400 hover:text-white">
                            <Icons.Prev size={24} />
                        </button>
                        <h2 className="text-xl font-bold">Payment & Buy-ins</h2>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setShowInfoModal(true)}
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

                {/* Dynamic Pot Totals */}
                {hasEntryFee && (entryFee > 0 || acePot > 0) && (
                    <div className="px-4 pb-1">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                                    <Icons.Zap size={14} className="text-brand-primary mr-1.5" />
                                    Total Pot
                                </h3>
                                <div className="text-2xl font-bold text-white">
                                    {(totalEntryPot + totalAcePot).toLocaleString()} <span className="text-sm text-slate-400">sats</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {entryFee > 0 && (
                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Entry Fee</p>
                                        <p className="text-lg font-bold text-brand-accent">{totalEntryPot.toLocaleString()} <span className="text-xs text-slate-400">sats</span></p>
                                    </div>
                                )}
                                {acePot > 0 && (
                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ace Pot</p>
                                        <p className="text-lg font-bold text-brand-secondary">{totalAcePot.toLocaleString()} <span className="text-xs text-slate-400">sats</span></p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
                    {/* Customize your round - moved above player tiles */}
                    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                        <button
                            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                            className="w-full flex items-center justify-between p-2 bg-slate-800 hover:bg-slate-700/50 transition-colors"
                        >
                            <h3 className="font-bold text-white">Customize your round</h3>
                            <Icons.Next size={20} className={`transition-transform duration-300 ${isCustomExpanded ? '-rotate-90' : 'rotate-90'}`} />
                        </button>

                        {isCustomExpanded && (
                            <div className="p-4 space-y-4 border-t border-slate-700 bg-slate-900/30">
                                {/* Payout Distribution Mode */}
                                {hasEntryFee && entryFee > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payout Distribution</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setPayoutMode('winner-take-all')}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${payoutMode === 'winner-take-all'
                                                    ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                    }`}
                                            >
                                                Winner Take All
                                            </button>
                                            <button
                                                onClick={() => setPayoutMode('percentage-based')}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${payoutMode === 'percentage-based'
                                                    ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
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
                                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${payoutPercentage === pct
                                                                ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
                                                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                                }`}
                                                        >
                                                            {pct}%
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setPayoutPercentage(customPayoutPercentage)}
                                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${![20, 30, 40].includes(payoutPercentage)
                                                            ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        Custom
                                                    </button>
                                                </div>
                                                {![20, 30, 40].includes(payoutPercentage) && (
                                                    <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3 border border-slate-700 animate-in slide-in-from-top-2">
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
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-16 text-center outline-none"
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
                                                        className={`px-3 py-3 rounded-lg text-xs font-bold border transition-all ${payoutGradient === 'top-heavy'
                                                            ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
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
                                                        className={`px-3 py-3 rounded-lg text-xs font-bold border transition-all ${payoutGradient === 'linear'
                                                            ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
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

                                {/* Tee Order Toggle */}
                                <div className="flex items-center justify-between py-2">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-300">Order by Tee Position</h4>
                                        <p className="text-[10px] text-slate-500">Best previous hole goes first</p>
                                    </div>
                                    <button
                                        onClick={() => setUseHonorSystem(!useHonorSystem)}
                                        className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 ${useHonorSystem ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${useHonorSystem ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Ace Pot Redistribution - Compact */}
                                {hasEntryFee && acePot > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">If No Ace</h4>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {[
                                                { value: 'add-to-entry-pot' as const, label: '+ Entry', icon: '🏆' },
                                                { value: 'redistribute-to-participants' as const, label: 'Split', icon: '↩️' },
                                                { value: 'forfeit' as const, label: 'Forfeit', icon: '❌' },
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
                        )}
                    </div>

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
                                    <div className="flex items-start justify-between gap-3">
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

                                        {/* Handicap Controls - shown only when enabled */}
                                        {handicapEnabled && (
                                            <div className="flex items-center space-x-1 mr-1 shrink-0">
                                                <button
                                                    onClick={() => setPlayerHandicaps(prev => ({ ...prev, [p.pubkey]: Math.max(-3, (prev[p.pubkey] || 0) - 1) }))}
                                                    className="w-6 h-6 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white text-xs font-bold"
                                                >
                                                    -
                                                </button>
                                                <div className="w-8 h-6 flex items-center justify-center bg-slate-900 border border-slate-600 rounded text-xs font-bold text-white">
                                                    {playerHandicaps[p.pubkey] || 0}
                                                </div>
                                                <button
                                                    onClick={() => setPlayerHandicaps(prev => ({ ...prev, [p.pubkey]: Math.min(3, (prev[p.pubkey] || 0) + 1) }))}
                                                    className="w-6 h-6 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white text-xs font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}

                                        {/* Payment Status */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Payment Status Icon */}
                                            {hasEntryFee && owesAnything && (
                                                <button
                                                    onClick={() => openPaymentModal(p)}
                                                    className="relative shrink-0"
                                                >
                                                    {isPaid ? (
                                                        // Green checkmark - static
                                                        <div className="w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                                                            <Icons.CheckMark size={16} className="text-green-500" strokeWidth={3} />
                                                        </div>
                                                    ) : (
                                                        // Red glowing dollar sign - payment due
                                                        <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
                                                            <Icons.Dollar size={14} className="text-red-500" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
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
                                onClick={() => allPaid ? setShowStartConfirm(true) : undefined}
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

                {/* PAYMENT MODAL */}
                {
                    showPaymentModal && paymentTarget && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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

                                    {/* Error Banner */}
                                    {paymentError && (
                                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start space-x-2 text-left animate-in fade-in slide-in-from-top-2">
                                            <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={16} />
                                            <p className="text-xs text-red-200 font-bold leading-tight">{paymentError}</p>
                                        </div>
                                    )}

                                    {/* Amount Display - Moved BEFORE QR Code */}
                                    <div>
                                        <p className="text-2xl font-bold text-brand-accent">{entryFee + acePot} SATS</p>
                                        <p className="text-xs text-slate-500">Entry: {entryFee} | Ace Pot: {acePot}</p>
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

                                    {/* QR Code Block with Pulse */}
                                    <div className={`bg-white p-4 rounded-xl inline-block mx-auto relative min-h-[200px] min-w-[200px] flex items-center justify-center ${!isGeneratingInvoice && !paymentSuccess ? 'qr-pulse' : ''}`}>
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
                                                <span>{isPayingWallet ? 'Processing...' : `Pay ${entryFee + acePot} SATS with App Wallet`}</span>
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

                {/* START ROUND CONFIRMATION MODAL */}
                {showStartConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                            <div className="text-center space-y-4">
                                {/* Warning Icon and Title */}
                                <div className="flex flex-col items-center space-y-2">
                                    <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center">
                                        <span className="text-4xl">⚠️</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Ready to Start?</h3>
                                </div>

                                {/* Warning Message */}
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Once you start the round, you won't be able to edit any round details (players, fees, settings, etc.). Make sure everything is correct before proceeding.
                                </p>

                                {/* Action Buttons */}
                                <div className="flex space-x-3 pt-2">
                                    <Button
                                        fullWidth
                                        variant="secondary"
                                        onClick={() => setShowStartConfirm(false)}
                                        className="py-3"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        fullWidth
                                        onClick={handleStartRound}
                                        className="bg-brand-accent text-black font-bold py-3 hover:bg-brand-accent/90"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div >
        );
    }

    // --- WHO'S PLAYING? (PLAYER SELECTION) ---
    if (view === 'select_players') {
        return (
            <div className="flex flex-col h-full relative">
                {/* Header */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setView('setup')} className="text-slate-400 hover:text-white">
                            <Icons.Prev size={24} />
                        </button>
                        <h1 className="text-xl font-bold">Who's playing?</h1>
                    </div>
                    <div className="flex space-x-2">
                        {/* Handicap Toggle */}

                        <button
                            onClick={() => setShowInfoModal(true)}
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

                {/* Current Card Section */}
                <div className="px-4 py-3 bg-brand-surface/50 border-b border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Current Card ({selectedCardmates.length + 1})
                    </h3>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                        {/* Host Player */}
                        <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-700">
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                    {userProfile.picture ? <img src={userProfile.picture} className="w-full h-full object-cover" /> : <Icons.Users className="p-1" />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm truncate">{userProfile.name} (You)</span>
                                    <span className="text-[9px] font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded w-fit">HOST</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {/* Handicap Controls - shown only when enabled */}

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
                                                className={`px-3 py-2 rounded text-xs font-bold border transition-all ${(paymentSelections[currentUserPubkey]?.entry ?? true)
                                                    ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
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
                                                className={`px-3 py-2 rounded text-xs font-bold border transition-all ${(paymentSelections[currentUserPubkey]?.ace ?? true)
                                                    ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
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
                                    className="w-8 h-8 flex items-center justify-center bg-brand-primary/10 border-2 border-brand-primary/30 rounded-full hover:bg-brand-primary/20 hover:border-brand-primary/50 transition-all"
                                >
                                    <Icons.Shield size={16} className="text-brand-primary" />
                                </button>
                            </div>
                        </div>

                        {/* Cardmates */}
                        {selectedCardmates.map(p => {
                            const payment = paymentSelections[p.pubkey] || { entry: true, ace: true };
                            return (
                                <div key={p.pubkey} className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-700 animate-in slide-in-from-left-2 duration-300">
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                        <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                            {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Icons.Users className="p-1 text-slate-500" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-sm truncate">{p.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {/* Handicap Controls - shown only when enabled */}

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
                                                        className={`px-3 py-2 rounded text-xs font-bold border transition-all ${payment.entry
                                                            ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
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
                                                        className={`px-3 py-2 rounded text-xs font-bold border transition-all ${payment.ace
                                                            ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
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
                <div className="p-4">
                    <div className="relative flex items-center space-x-2">
                        <div className="relative flex-1">
                            <Icons.Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-2 text-white focus:ring-1 focus:ring-brand-primary outline-none placeholder:text-slate-500"
                                placeholder="Add player via NIP-05, npub..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                onPaste={() => {
                                    // Golden glow on search button when user pastes
                                    setWiggleSearchButton(true);
                                    setTimeout(() => setWiggleSearchButton(false), 5000);
                                }}
                            />
                        </div>

                        <button
                            onClick={handleSearch}
                            className={`p-3 rounded-lg transition-all duration-300 ${wiggleSearchButton
                                ? 'bg-brand-accent/30 text-brand-accent border-2 border-brand-accent shadow-lg shadow-brand-accent/50 ring-4 ring-brand-accent/30 animate-pulse'
                                : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/20'
                                }`}
                        >
                            {isSearching ? <Icons.Zap className="animate-spin" size={20} /> : <Icons.Search size={20} />}
                        </button>

                        <div className="w-px h-8 bg-slate-700 mx-1"></div>

                        <button
                            onClick={() => setView('scan_player')}
                            className="p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                            title="Scan Player QR"
                        >
                            <Icons.Camera size={24} />
                        </button>

                        <button
                            onClick={handleInstantInvite}
                            className="p-3 bg-blue-500/10 border-2 border-blue-500/40 rounded-lg text-blue-400 hover:text-blue-300 hover:border-blue-400/60 hover:bg-blue-500/20 transition-all relative group"
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

                {/* Scrollable Player List - with padding for fixed button */}
                <div className="flex-1 overflow-y-auto pb-32">
                    <div className="flex border-b border-slate-800 px-4 mb-2">
                        {!searchQuery && (
                            <>
                                <button
                                    onClick={() => setPlayerTab('frequent')}
                                    className={`px-4 py-2 font-bold text-sm transition-colors ${playerTab === 'frequent' ? 'text-brand-secondary border-b-2 border-brand-secondary' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Frequent
                                </button>
                                <button
                                    onClick={() => setPlayerTab('recent')}
                                    className={`px-4 py-2 font-bold text-sm transition-colors ${playerTab === 'recent' ? 'text-brand-secondary border-b-2 border-brand-secondary' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Recent
                                </button>
                                <button
                                    onClick={() => setPlayerTab('a-z')}
                                    className={`px-4 py-2 font-bold text-sm transition-colors ${playerTab === 'a-z' ? 'text-brand-secondary border-b-2 border-brand-secondary' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Search
                                </button>
                            </>
                        )}
                        {searchQuery && (
                            <button className="px-4 py-2 font-bold text-sm text-brand-secondary border-b-2 border-brand-secondary">
                                All Results
                            </button>
                        )}
                    </div>

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
                                className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 cursor-pointer border-b border-slate-800/50 group"
                            >
                                <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden relative group-hover:ring-2 ring-brand-secondary transition-all shrink-0">
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
                                <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center text-slate-600 group-hover:border-brand-secondary group-hover:bg-brand-secondary group-hover:text-white transition-all shrink-0 ml-3">
                                    <Icons.Plus size={16} />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Fixed Button - outside scrollable area */}
                <div className="fixed bottom-20 left-0 right-0 bg-brand-dark border-t border-slate-800 p-4 max-w-md mx-auto z-20">
                    {invoiceError && (
                        <div className="mb-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{invoiceError}</p>
                        </div>
                    )}
                    <Button
                        fullWidth
                        onClick={handleConfirmCardmates}
                        disabled={isGeneratingInvoices}
                        className="bg-brand-accent text-black font-bold py-4 rounded-full shadow-lg shadow-brand-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGeneratingInvoices ? (
                            <span className="flex items-center justify-center gap-2">
                                <Icons.Zap className="animate-spin" size={20} />
                                Sending invoices...
                            </span>
                        ) : (
                            'Confirm cardmates'
                        )}
                    </Button>
                </div>

                {/* INSTANT INVITE MODAL */}
                {showPlayerQr && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
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

                                <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteQrData)}`}
                                        className="w-48 h-48"
                                        alt="Invite QR"
                                    />
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-brand-primary/50 p-6 rounded-2xl shadow-2xl shadow-brand-primary/20 max-w-lg w-full max-h-[80vh] flex flex-col">
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
                                    Or maybe—just maybe—the real collapse will come from sweaty, single men in their 30s who've completely checked out of the workforce to throw frisbees in the park all day. The Fed can handle hyperinflation. They can handle bank runs. But can they handle an entire generation of dudes who'd rather disc golf than participate in the economy? The system needs worker bees, and we're out here… counting birdies. 🥏
                                </p>

                                <div className="h-4"></div>
                            </div>

                            {hasScrolledToBottom && (
                                <div className="mt-4 pt-4 border-t border-slate-700">
                                    <p className="text-xs text-center text-slate-500">
                                        ⚡ You've been enlightened ⚡
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SCOLDING MODAL */}
                {showScoldingModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
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
                                        Pay 1,000 Sats to Skip ⚡
                                    </button>
                                </div>

                                <p className="text-xs text-center text-slate-500 mt-4 italic">
                                    (Yes, we're actually making you choose between reading or paying. This is for your own good.)
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- STEP 1: ROUND SETUP ---
    if (view === 'setup') {
        return (
            <div className="flex flex-col h-full">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setView('menu')} className="text-slate-400 hover:text-white">
                            <Icons.Prev size={24} />
                        </button>
                        <h2 className="text-xl font-bold">Round setup</h2>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setShowSetupHelp(true)}
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

                <div className="flex-1 overflow-y-auto px-4 py-3 pb-48 space-y-4">

                    <div className="space-y-2">
                        <div className="flex items-center text-slate-400 space-x-2">
                            <Icons.Location size={14} className="text-brand-primary" />
                            <span className="text-xs font-bold uppercase tracking-wider">Course</span>
                        </div>
                        <input
                            type="text"
                            value={courseName}
                            onChange={(e) => setCourseName(e.target.value)}
                            className="text-xl font-bold bg-transparent border-none outline-none w-full placeholder-slate-600"
                            placeholder="Enter Course Name"
                        />

                        {/* Recent Courses Quick Select */}
                        {recentCourses.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent</p>
                                <div className="flex flex-wrap gap-2">
                                    {recentCourses.slice(0, 6).map((course) => (
                                        <button
                                            key={course}
                                            onClick={() => setCourseName(course)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${courseName === course
                                                ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20'
                                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-brand-primary/30'
                                                }`}
                                        >
                                            {course}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="border-slate-800" />

                    <div className="space-y-2">
                        <div className="flex items-center text-slate-400 space-x-2">
                            <Icons.Trophy size={14} className="text-brand-secondary" />
                            <span className="text-xs font-bold uppercase tracking-wider">Holes</span>
                        </div>

                        <div className="grid grid-cols-3 gap-0 bg-slate-800 rounded-lg p-1 border border-slate-700">
                            <button
                                onClick={() => setLayout('9')}
                                className={`py-1.5 rounded-md text-sm font-bold transition-all ${layout === '9' ? 'bg-brand-secondary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                9
                            </button>
                            <button
                                onClick={() => setLayout('18')}
                                className={`py-1.5 rounded-md text-sm font-bold transition-all ${layout === '18' ? 'bg-brand-secondary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                18
                            </button>
                            <button
                                onClick={() => setLayout('custom')}
                                className={`py-1.5 rounded-md text-sm font-bold transition-all ${layout === 'custom' ? 'bg-brand-secondary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Custom
                            </button>
                        </div>
                        {layout === 'custom' && (
                            <div className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg">
                                <span className="text-sm text-slate-400">Holes</span>
                                <input
                                    type="number"
                                    value={customHoles}
                                    onChange={(e) => setCustomHoles(parseInt(e.target.value))}
                                    className="bg-transparent text-right font-bold outline-none w-16"
                                />
                            </div>
                        )}
                    </div>

                    <hr className="border-slate-800" />

                    <div className="space-y-3">
                        {/* Section Header with Zap Icon */}
                        <div className="flex items-center text-slate-400 space-x-2">
                            <Icons.Zap size={14} className="text-brand-primary" />
                            <span className="text-xs font-bold uppercase tracking-wider">Entry Fee & Stakes</span>
                        </div>

                        {/* Entry Fee Toggle */}
                        <div className="bg-slate-800 rounded-lg p-1 border border-slate-700 flex">
                            <button
                                onClick={() => setHasEntryFee(true)}
                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${hasEntryFee ? 'bg-brand-primary text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Entry Fee
                            </button>
                            <button
                                onClick={() => setHasEntryFee(false)}
                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${!hasEntryFee ? 'bg-brand-primary text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                No Entry Fee
                            </button>
                        </div>

                        {hasEntryFee && (
                            <>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entry Fee (Sats)</label>
                                    <input
                                        type="number"
                                        step="1000"
                                        value={entryFee}
                                        onChange={(e) => setEntryFee(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-brand-primary outline-none"
                                    />

                                    {/* Preset Entry Fee Buttons */}
                                    <div className="flex flex-wrap gap-2">
                                        {/* Default Presets */}
                                        {[1000, 5000, 10000].map(amount => (
                                            <button
                                                key={amount}
                                                onClick={() => setEntryFee(amount)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${entryFee === amount
                                                    ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-brand-primary/30'
                                                    }`}
                                            >
                                                {amount / 1000}k
                                            </button>
                                        ))}

                                        {/* Custom Presets */}
                                        {customPresets.map(preset => (
                                            <div key={preset.id} className="relative group">
                                                <button
                                                    onClick={() => setEntryFee(preset.amount)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${entryFee === preset.amount
                                                        ? 'bg-brand-secondary text-white shadow-lg shadow-brand-secondary/20'
                                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-brand-secondary/30'
                                                        }`}
                                                >
                                                    {preset.amount >= 1000 ? `${preset.amount / 1000}k` : preset.amount}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCustomPreset(preset.id)}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete preset"
                                                >
                                                    <Icons.Close size={10} className="text-white" strokeWidth={3} />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Add Custom Button */}
                                        {customPresets.length < 3 && !showCustomInput && (
                                            <button
                                                onClick={() => setShowCustomInput(true)}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/10 transition-all"
                                            >
                                                + Custom
                                            </button>
                                        )}
                                    </div>

                                    {/* Custom Input UI */}
                                    {showCustomInput && (
                                        <div className="flex items-center gap-2 bg-slate-800/50 p-2.5 rounded-lg border border-brand-primary/30 animate-in fade-in slide-in-from-top-2">
                                            <input
                                                type="number"
                                                value={customAmount}
                                                onChange={(e) => setCustomAmount(e.target.value)}
                                                placeholder="Enter amount..."
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleSaveCustomPreset}
                                                className="px-3 py-1.5 bg-brand-primary text-black font-bold text-xs rounded hover:bg-brand-primary/80 transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowCustomInput(false);
                                                    setCustomAmount('');
                                                }}
                                                className="px-3 py-1.5 bg-slate-700 text-white font-bold text-xs rounded hover:bg-slate-600 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ace Pot (Sats)</label>
                                    <input
                                        type="number"
                                        step="500"
                                        value={acePot}
                                        onChange={(e) => setAcePot(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-brand-primary outline-none"
                                    />

                                    {/* Ace Pot Quick Select */}
                                    <div className="flex flex-wrap gap-2">
                                        {[1000, 2000, 5000, 10000].map(amount => (
                                            <button
                                                key={amount}
                                                onClick={() => setAcePot(amount)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${acePot === amount
                                                    ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-brand-primary/30'
                                                    }`}
                                            >
                                                {amount / 1000}k
                                            </button>
                                        ))}

                                        {/* Custom Ace Pot Presets */}
                                        {customAcePresets.map(preset => (
                                            <div key={preset.id} className="relative group">
                                                <button
                                                    onClick={() => setAcePot(preset.amount)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${acePot === preset.amount
                                                        ? 'bg-brand-secondary text-white shadow-lg shadow-brand-secondary/20'
                                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-brand-secondary/30'
                                                        }`}
                                                >
                                                    {preset.amount >= 1000 ? `${preset.amount / 1000}k` : preset.amount}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCustomAcePreset(preset.id)}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete preset"
                                                >
                                                    <Icons.Close size={10} className="text-white" strokeWidth={3} />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Add Custom Button */}
                                        {customAcePresets.length < 3 && !showCustomAceInput && (
                                            <button
                                                onClick={() => setShowCustomAceInput(true)}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/10 transition-all"
                                            >
                                                + Custom
                                            </button>
                                        )}
                                    </div>

                                    {/* Custom Ace Pot Input UI */}
                                    {showCustomAceInput && (
                                        <div className="flex items-center gap-2 bg-slate-800/50 p-2.5 rounded-lg border border-brand-primary/30 animate-in fade-in slide-in-from-top-2">
                                            <input
                                                type="number"
                                                value={customAceAmount}
                                                onChange={(e) => setCustomAceAmount(e.target.value)}
                                                placeholder="Enter amount..."
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleSaveCustomAcePreset}
                                                className="px-3 py-1.5 bg-brand-primary text-black font-bold text-xs rounded hover:bg-brand-primary/80 transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowCustomAceInput(false);
                                                    setCustomAceAmount('');
                                                }}
                                                className="px-3 py-1.5 bg-slate-700 text-white font-bold text-xs rounded hover:bg-slate-600 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                </div>

                <div className="fixed bottom-20 left-0 right-0 bg-brand-dark border-t border-slate-800 p-4 max-w-md mx-auto z-20">
                    <Button
                        fullWidth
                        onClick={() => setView('select_players')}
                        className="bg-brand-accent text-black font-bold py-4 rounded-full shadow-lg shadow-brand-accent/20"
                    >
                        Next
                    </Button>
                </div>

                {/* Setup Help Modal */}
                {showSetupHelp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
                            <button
                                onClick={() => setShowSetupHelp(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                            >
                                <Icons.Close size={24} />
                            </button>

                            <div className="flex items-center space-x-3 mb-6">
                                <Icons.Help size={28} className="text-brand-primary" />
                                <h2 className="text-xl font-bold text-white">Round Setup Help</h2>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                <div className="space-y-3">
                                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <Icons.Zap size={16} className="text-brand-primary" />
                                            <h3 className="font-bold text-white text-sm">Entry Fee</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            The entry fee is the amount each player pays to join the round. This creates the prize pool that gets distributed to winners at the end.
                                        </p>
                                    </div>

                                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <Icons.Trophy size={16} className="text-brand-secondary" />
                                            <h3 className="font-bold text-white text-sm">Ace Pot</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Optional bonus pool for hole-in-ones. Each player contributes this amount, and whoever gets an ace wins the entire pot!
                                        </p>
                                    </div>

                                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <Icons.Settings size={16} className="text-brand-primary" />
                                            <h3 className="font-bold text-white text-sm">Custom Presets</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Save your frequently used entry fees for quick access. You can create up to 3 custom presets. Hover over a custom preset to delete it.
                                        </p>
                                    </div>

                                    <div className="bg-brand-primary/10 rounded-lg p-3 border border-brand-primary/30">
                                        <p className="text-xs text-brand-primary leading-relaxed">
                                            <strong>💡 Tip:</strong> All payments are handled automatically using Bitcoin Lightning and eCash for instant, low-fee transactions.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button
                                    fullWidth
                                    variant="secondary"
                                    onClick={() => setShowSetupHelp(false)}
                                >
                                    Got it!
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- SETTINGS VIEW ---
    if (view === 'settings') {
        return (
            <div className="p-6 flex flex-col h-full bg-brand-dark">
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('menu')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Settings</h2>
                </div>
                <div className="text-slate-400 text-center mt-10">
                    <p>Settings coming soon...</p>
                </div>
            </div>
        );
    }

    // Default Menu View
    return (
        <div className="p-6 flex flex-col flex-1 w-full relative pb-20">
            {/* Wallet Balance Pill - Top Left */}
            <div className="absolute top-6 left-6 z-10">
                <button
                    onClick={() => navigate('/wallet')}
                    className="px-4 py-2 bg-gradient-to-r from-brand-primary/20 to-emerald-500/20 border border-brand-primary/40 rounded-full backdrop-blur-sm hover:from-brand-primary/30 hover:to-emerald-500/30 hover:border-brand-primary/60 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                    <div className="flex items-center space-x-2">
                        <Icons.Wallet size={16} className="text-brand-primary" />
                        <span className="text-sm font-bold text-white">{walletBalance.toLocaleString()} Sats</span>
                    </div>
                </button>
            </div>

            {/* Header Icons - Top Right */}
            <div className="absolute top-6 right-6 z-10 flex space-x-3">
                <button
                    onClick={() => setShowInfoModal(true)}
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

            <div className="flex-1 flex flex-col items-center pt-20 space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center mb-4 relative home-logo-container">
                        <img
                            src="/icon.jpg"
                            alt="On-Chain Logo"
                            className="w-20 h-20 rounded-2xl shadow-xl shadow-brand-primary/20"
                        />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <h1 className="font-extrabold tracking-tight leading-tight">
                        <div className="text-6xl mb-1">
                            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">On-Chain</span>
                        </div>
                        <div className="text-4xl">
                            <span className="text-white">Disc Golf</span>
                        </div>
                    </h1>
                    <p className="text-slate-200 text-base font-medium mt-3">Unstoppable Disc Golf Powered by Unstoppable Money</p>
                </div>

                <div className="w-full max-w-sm space-y-4">
                    {/* Only show Continue Round for active, non-finalized rounds */}
                    {activeRound && !activeRound.isFinalized && (
                        <Button fullWidth onClick={() => navigate('/play')} className="golden-button-shimmer text-black font-bold hover:brightness-110 transition-all">
                            <div className="flex items-center justify-center space-x-2">
                                <Icons.Play fill="currentColor" />
                                <span>{activeRound.pubkey === currentUserPubkey ? 'Continue Round' : 'View Current Round'}</span>
                            </div>
                        </Button>
                    )}

                    {!activeRound && (() => {
                        const saved = localStorage.getItem('cdg_round_creation');
                        return saved ? (
                            <Button
                                fullWidth
                                onClick={() => {
                                    // Restore state is handled by the useEffect on mount,
                                    // but we can trigger it immediately by reloading the state
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
                                        clearRoundCreationState();
                                    }
                                }}
                                className="bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-transform button-gleam"
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <Icons.Play fill="currentColor" />
                                    <span>Resume Round Setup</span>
                                </div>
                            </Button>
                        ) : null;
                    })()}

                    {isGuest && (
                        <Button
                            fullWidth
                            onClick={() => navigate('/profile')}
                            className={`bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/20 mb-4 hover:bg-amber-400 transition-transform button-gleam ${wiggleLogin ? 'animate-wiggle' : ''}`}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <Icons.Users />
                                <span>Login or Create Profile</span>
                            </div>
                        </Button>
                    )}

                    {showLoginHint && isGuest && (
                        <div className="text-brand-primary text-xs text-center bg-brand-primary/10 p-2 rounded-lg border border-brand-primary/20 animate-in fade-in slide-in-from-top-2 mb-2">
                            👆 Create a profile to start playing!
                        </div>
                    )}

                    <Button fullWidth onClick={handleCreateRoundClick}>
                        <div className="flex items-center justify-center space-x-2">
                            <Icons.Plus />
                            <span>Create Round</span>
                        </div>
                    </Button>

                    <button
                        onClick={() => {
                            // If guest, wiggle login button instead
                            if (handleGuestActionAttempt()) return;
                            setShowPlayerQr(true);
                        }}
                        className="w-full py-3 px-4 rounded-xl border-2 border-brand-primary bg-transparent text-brand-primary hover:bg-brand-primary/10 font-bold transition-colors"
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Icons.QrCode />
                            <span>Scan to Join</span>
                        </div>
                    </button>

                    {/* Round History - subtle link */}
                    <button
                        onClick={() => navigate('/history')}
                        className="w-full py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                        <Icons.History size={16} />
                        <span>Round History</span>
                    </button>

                    {joinError && (
                        <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                            {joinError}
                        </div>
                    )}
                </div>
            </div>



            {/* Cancel Round Confirmation Modal */}
            {showResetConfirm && activeRound && (() => {
                const entryPayers = players.filter(p => p.paysEntry);
                const acePayers = players.filter(p => p.paysAce);
                const entryPot = entryPayers.length * activeRound.entryFeeSats;
                const acePot = acePayers.length * activeRound.acePotFeeSats;
                const totalPot = entryPot + acePot;
                const hasMoney = totalPot > 0;
                
                // Determine current leader
                const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);
                const currentLeader = sortedPlayers[0];
                
                // Check for any aces
                const aceWinners: { name: string; hole: number }[] = [];
                players.forEach(player => {
                    Object.entries(player.scores).forEach(([hole, score]) => {
                        if (score === 1) {
                            aceWinners.push({ name: player.name, hole: parseInt(hole) });
                        }
                    });
                });
                
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                                        {acePot > 0 && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 text-sm">Ace Pot</span>
                                                <span className="text-emerald-400 font-semibold">{acePot.toLocaleString()} sats</span>
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
                                        className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${
                                            cancelFundOption === 'pay-winner'
                                                ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            cancelFundOption === 'pay-winner' ? 'bg-amber-500/20' : 'bg-slate-700'
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
                                        className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${
                                            cancelFundOption === 'redistribute'
                                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            cancelFundOption === 'redistribute' ? 'bg-emerald-500/20' : 'bg-slate-700'
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
                                        className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${
                                            cancelFundOption === 'host-keeps'
                                                ? 'bg-slate-500/10 border-slate-500 text-slate-300'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            cancelFundOption === 'host-keeps' ? 'bg-slate-500/20' : 'bg-slate-700'
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

            {/* What is On-Chain Info Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
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

            {/* Scan to Join (Show Player QR) Modal */}
            {showPlayerQr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => {
                                setShowPlayerQr(false);
                                setInviteQrData('');
                            }}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <Icons.Close size={24} />
                        </button>

                        <div className="text-center space-y-4 pt-2">
                            <h3 className="text-xl font-bold text-white">Join My Round</h3>

                            <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getPlayerQrData())}`}
                                    className="w-48 h-48"
                                    alt="Player QR"
                                />
                            </div>

                            <div className="flex flex-col items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 mb-2">
                                    {userProfile.picture ? <img src={userProfile.picture} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-400" />}
                                </div>
                                <p className="font-bold text-lg">{userProfile.name}</p>
                                <p className="text-xs text-slate-400">Scan to add me</p>
                            </div>

                            <Button fullWidth variant="secondary" onClick={() => {
                                setShowPlayerQr(false);
                                setInviteQrData('');
                            }}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Instant Invite Input Modal */}
            {showInstantInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
        </div>
    );
};
