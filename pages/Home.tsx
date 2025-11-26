
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { InfoModal } from '../components/InfoModal';
import { useNavigate } from 'react-router-dom';
import { getPool, getRelays, listEvents, lookupUser } from '../services/nostrService';
import { NOSTR_KIND_ROUND, DisplayProfile } from '../types';
import { nip19 } from 'nostr-tools';
import { useQrScanner } from '../hooks/useQrScanner';

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
    const [entryFee, setEntryFee] = useState(1000);
    const [acePot, setAcePot] = useState(500);

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

    const [joinError, setJoinError] = useState('');
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Info Modal State
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

    // Player QR Modal State
    const [showPlayerQr, setShowPlayerQr] = useState(false);

    // Onboarding flow - wiggle login button for guest users
    const [wiggleLogin, setWiggleLogin] = useState(false);
    const [showLoginHint, setShowLoginHint] = useState(false);

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
            [currentUserPubkey, ...selectedCardmates.map(p => p.pubkey)].forEach(pk => {
                if (!initialStatus[pk]) initialStatus[pk] = false;
            });
            setPaidStatus(prev => ({ ...initialStatus, ...prev }));
        }
    }, [view, currentUserPubkey, selectedCardmates]);

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
            hideOverallScore
        }, finalPlayers);

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
            return `${npub.substring(0, 10)}...`;
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

    const confirmNewRound = () => {
        resetRound();
        setShowResetConfirm(false);
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
            return;
        }

        if (confirm(`Pay ${totalAmount} sats from your wallet to cover ${paymentTarget?.name}?`)) {
            setIsPayingWallet(true);
            try {
                // We pay the invoice ourselves
                const success = await sendFunds(totalAmount, paymentInvoice);
                if (!success) {
                    setPaymentError("Payment failed. Please try again.");
                    setIsPayingWallet(false);
                    return;
                }

                // The payment succeeded. The poller (checkDepositStatus) running in useEffect
                // will detect that the quote is PAID and automatically call handlePaymentConfirmed.

            } catch (e) {
                console.error("Wallet pay failed", e);
                setPaymentError("Payment failed: " + (e instanceof Error ? e.message : "Unknown error"));
                setIsPayingWallet(false);
            }
        }
    };

    const handleOpenLightningWallet = () => {
        if (paymentInvoice) {
            window.location.href = `lightning:${paymentInvoice}`;
        }
    };

    const getPlayerQrData = () => {
        if (userProfile.nip05) return userProfile.nip05;
        try {
            return nip19.npubEncode(currentUserPubkey);
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
            { pubkey: currentUserPubkey || 'me', name: userProfile.name, image: userProfile.picture, nip05: userProfile.lud16, isHost: true },
            ...selectedCardmates
        ];

        return (
            <div className="flex flex-col h-full bg-brand-dark relative">
                <div className="px-4 py-4 flex items-center justify-between bg-brand-dark">
                    <button onClick={() => setView('select_players')} className="text-slate-400 hover:text-white">
                        <Icons.Prev size={24} />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-slate-400 font-bold uppercase">Holes {layout === 'custom' ? customHoles : layout}</span>
                    </div>
                    <div className="w-6"></div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                    <div className="space-y-3">
                        {allPlayers.map((p, idx) => {
                            const isExcluded = excludedPlayers.has(p.pubkey);
                            const isPaid = paidStatus[p.pubkey] || (p as any).isHost; // Host assumed paid
                            return (
                                <div key={p.pubkey} className="bg-slate-800 rounded-xl p-3 flex flex-col space-y-3 border border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                                            <span className="font-bold text-lg text-slate-500 w-6 text-center">{idx + 1}</span>
                                            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                                {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-500" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold truncate text-white">{p.name} {(p as any).isHost && '(You)'}</p>
                                                <p className="text-xs text-slate-400 truncate">
                                                    {p.nip05 ? (p.nip05.length > 20 ? p.nip05.substring(0, 15) + '...' : p.nip05) : 'Nostr User'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Payment Status Icon */}
                                        {hasEntryFee && !(p as any).isHost && (
                                            <button
                                                onClick={() => !isPaid && openPaymentModal(p)}
                                                className={`p-2 rounded-lg transition-colors ${isPaid ? 'text-green-500 bg-green-500/10 cursor-default' : 'text-red-500 bg-red-500/10 hover:bg-red-500/20'}`}
                                            >
                                                {isPaid ? <Icons.CheckMark size={24} strokeWidth={3} /> : <Icons.QrCode size={24} />}
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex bg-slate-900/50 rounded-lg p-1">
                                        <button
                                            onClick={() => toggleScoreExclusion(p.pubkey)}
                                            className={`flex-1 flex items-center justify-center py-2 rounded-md text-xs font-bold space-x-2 transition-all ${isExcluded ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            <Icons.Close size={14} />
                                            <span>Scores off</span>
                                        </button>
                                        <button
                                            onClick={() => isExcluded && toggleScoreExclusion(p.pubkey)}
                                            className={`flex-1 flex items-center justify-center py-2 rounded-md text-xs font-bold space-x-2 transition-all ${!isExcluded ? 'bg-brand-secondary/20 text-brand-secondary' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            <Icons.CheckMark size={14} />
                                            <span>Scores on</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                        <button
                            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                            className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700/50 transition-colors"
                        >
                            <h3 className="font-bold text-white">Customize your round</h3>
                            <Icons.Next size={20} className={`transition-transform duration-300 ${isCustomExpanded ? '-rotate-90' : 'rotate-90'}`} />
                        </button>

                        {isCustomExpanded && (
                            <div className="p-4 space-y-4 border-t border-slate-700 bg-slate-900/30">
                                {([
                                    { label: "Track penalties", val: trackPenalties, set: setTrackPenalties },
                                ] as const).map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-1">
                                        <div className="flex items-center space-x-3">
                                            <Icons.Close size={20} className="text-slate-400" />
                                            <span className="text-sm font-bold text-slate-300">{item.label}</span>
                                        </div>
                                        <button
                                            onClick={() => item.set(!item.val)}
                                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${item.val ? 'bg-brand-secondary' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${item.val ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 text-slate-300">
                                        <span className="text-sm font-bold">Start Date</span>
                                    </div>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white outline-none"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 text-slate-300">
                                        <span className="text-sm font-bold">Start Time</span>
                                    </div>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="fixed bottom-20 left-0 right-0 bg-brand-dark border-t border-slate-800 p-4 max-w-md mx-auto z-20">
                    <Button
                        fullWidth
                        onClick={handleStartRound}
                        className="bg-brand-accent text-black font-bold py-4 rounded-full shadow-lg shadow-brand-accent/20"
                    >
                        Start my round
                    </Button>
                </div>

                {/* PAYMENT MODAL */}
                {showPaymentModal && paymentTarget && (
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
                                <h3 className="text-xl font-bold text-white">Collect Entry Fee</h3>
                                <p className="text-slate-400 text-sm">
                                    Ask <span className="text-white font-bold">{paymentTarget.name}</span> to pay this invoice.
                                </p>

                                {/* Error Banner */}
                                {paymentError && (
                                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start space-x-2 text-left animate-in fade-in slide-in-from-top-2">
                                        <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={16} />
                                        <p className="text-xs text-red-200 font-bold leading-tight">{paymentError}</p>
                                    </div>
                                )}

                                <div className="bg-white p-4 rounded-xl inline-block mx-auto relative min-h-[200px] min-w-[200px] flex items-center justify-center">
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

                                <div>
                                    <p className="text-2xl font-bold text-brand-accent">{entryFee + acePot} SATS</p>
                                    <p className="text-xs text-slate-500">Entry: {entryFee} | Ace Pot: {acePot}</p>
                                </div>

                                {!isGeneratingInvoice && !paymentSuccess && (
                                    <div className="pt-2 flex items-center justify-center space-x-2 text-brand-primary animate-pulse">
                                        <Icons.Zap size={16} />
                                        <span className="text-xs font-bold">Listening for payment...</span>
                                    </div>
                                )}

                                <div className="pt-2 space-y-2">
                                    <Button
                                        fullWidth
                                        onClick={handleOpenLightningWallet}
                                        variant="secondary"
                                        className="text-xs py-2"
                                    >
                                        Open Lightning Wallet
                                    </Button>
                                    <Button
                                        fullWidth
                                        onClick={handlePayWithWallet}
                                        variant="secondary"
                                        className="text-xs py-2"
                                        disabled={isPayingWallet}
                                    >
                                        {isPayingWallet ? 'Processing...' : 'Pay with Wallet / Cash'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- WHO'S PLAYING? (PLAYER SELECTION) ---
    if (view === 'select_players') {
        return (
            <div className="flex flex-col h-full relative">
                {/* Header */}
                <div className="p-4 flex items-center space-x-2">
                    <button onClick={() => setView('setup')} className="text-slate-400 hover:text-white">
                        <Icons.Prev size={24} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                        <Icons.Users size={16} />
                    </div>
                    <h1 className="text-xl font-bold">Who's playing?</h1>
                </div>

                {/* Current Card Section */}
                <div className="px-4 py-3 bg-brand-surface/50 border-b border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Current Card ({selectedCardmates.length + 1})
                    </h3>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                        <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-700">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                    {userProfile.picture ? <img src={userProfile.picture} className="w-full h-full object-cover" /> : <Icons.Users className="p-1" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">{userProfile.name} (You)</span>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold bg-brand-primary/10 text-brand-primary px-2 py-1 rounded">HOST</span>
                        </div>

                        {selectedCardmates.map(p => (
                            <div key={p.pubkey} className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-700 animate-in slide-in-from-left-2 duration-300">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                        {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Icons.Users className="p-1 text-slate-500" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">{p.name}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeCardmate(p.pubkey)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors shrink-0"
                                >
                                    <Icons.Close size={16} />
                                </button>
                            </div>
                        ))}
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
                                    setTimeout(() => setWiggleSearchButton(false), 2000);
                                }}
                            />
                        </div>

                        <button
                            onClick={() => setView('scan_player')}
                            className="p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                        >
                            <Icons.QrCode size={20} />
                        </button>

                        <button
                            onClick={handleSearch}
                            className={`p-3 rounded-lg transition-all duration-300 ${wiggleSearchButton
                                ? 'bg-brand-accent/30 text-brand-accent border-2 border-brand-accent shadow-lg shadow-brand-accent/50 ring-4 ring-brand-accent/30 animate-pulse'
                                : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/20'
                                }`}
                        >
                            {isSearching ? <Icons.Zap className="animate-spin" size={20} /> : <Icons.Next size={20} />}
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
                    <Button fullWidth onClick={() => setView('customize')} className="bg-brand-accent text-black font-bold py-4 rounded-full shadow-lg shadow-brand-accent/20">
                        Confirm cardmates
                    </Button>
                </div>
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
                        <h2 className="text-lg font-bold">Round setup</h2>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setShowSetupHelp(true)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <Icons.Help size={20} />
                        </button>
                        <button
                            onClick={() => setView('settings')}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <Icons.Settings size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 pb-32 space-y-4">

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
                                    </div>
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

            <div className="flex-1 flex flex-col justify-center items-center space-y-10">
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
                    {activeRound && !activeRound.isFinalized && (
                        <Button fullWidth onClick={() => navigate('/play')} className="bg-brand-accent text-black hover:bg-brand-accent/80 shadow-lg shadow-brand-accent/20">
                            <div className="flex items-center justify-center space-x-2">
                                <Icons.Play fill="currentColor" />
                                <span>Continue Round</span>
                            </div>
                        </Button>
                    )}

                    {isGuest && (
                        <Button
                            fullWidth
                            onClick={() => navigate('/profile')}
                            className={`bg-brand-accent text-black font-bold shadow-lg shadow-brand-accent/20 mb-4 hover:bg-brand-accent/90 transition-transform button-gleam ${wiggleLogin ? 'animate-wiggle' : ''}`}
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

                    {joinError && (
                        <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                            {joinError}
                        </div>
                    )}
                </div>
            </div>

            {activeRound?.isFinalized && (
                <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-bold text-slate-300 mb-2">Last Round</h3>
                    <div className="flex justify-between text-sm">
                        <span>{activeRound.name}</span>
                        <span className="text-brand-primary">Complete</span>
                    </div>
                </div>
            )}

            {/* New Round Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                                    <Icons.Trophy size={28} className="text-brand-dark" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-white tracking-tight">ON-CHAIN</h1>
                                    <p className="text-xs text-brand-primary font-bold tracking-wider uppercase">Disc Golf</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowInfoModal(true)}
                                className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <Icons.Help size={24} />
                            </button>
                        </div>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                                <Icons.Trash size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Start New Round?</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                If you create another league round, the previous continued round will be deleted.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="danger" onClick={confirmNewRound}>
                                Continue
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                            onClick={() => setShowPlayerQr(false)}
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

                            <Button fullWidth variant="secondary" onClick={() => setShowPlayerQr(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* INFO MODAL */}
            <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
        </div>
    );
};
