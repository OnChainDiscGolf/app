
import React, { useState, useEffect, useRef } from 'react';
import { useQrScanner } from '../hooks/useQrScanner';
import { useApp } from '../context/AppContext';
import { sendGiftWrap, getMagicLightningAddress } from '../services/nostrService';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { FeedbackModal, FeedbackButton } from '../components/FeedbackModal';
import { useNavigate } from 'react-router-dom';

// Helper Component for Success Animation
const SuccessOverlay: React.FC<{
    message: string,
    subMessage?: string,
    onClose: () => void,
    type?: 'sent' | 'received' | 'deposit'
}> = ({ message, subMessage, onClose, type }) => {
    useEffect(() => {
        // For received payments, show longer (4s) and don't auto-navigate
        // For sent/deposit, auto-close after 2.5s
        const duration = type === 'received' ? 4000 : 2500;
        const timer = setTimeout(() => {
            // Only auto-close for sent/deposit, not for received
            if (type !== 'received') {
                onClose();
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [onClose, type]);

    return (
        <div className="fixed inset-0 z-[100] bg-brand-dark flex flex-col items-center justify-center animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30 animate-in fade-in zoom-in-75 delay-100 duration-500">
                <Icons.CheckMark size={48} className="text-white" strokeWidth={4} />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2 animate-in slide-in-from-bottom-4 delay-200">{message}</h3>
            {subMessage && <p className="text-slate-400 text-lg animate-in slide-in-from-bottom-4 delay-300">{subMessage}</p>}

            {/* For received payments, show close button after animation */}
            {type === 'received' && (
                <button
                    onClick={onClose}
                    className="mt-8 px-6 py-3 bg-brand-primary rounded-xl font-bold hover:bg-brand-primary/80 transition-all animate-in fade-in delay-500"
                >
                    Continue
                </button>
            )}
        </div>
    );
};

// Helper Component for Processing Overlay (Blocking)
const ProcessingOverlay: React.FC<{ message: string }> = ({ message }) => {
    return (
        <div className="absolute inset-0 z-50 bg-brand-dark/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-bold text-white animate-pulse">{message}</h3>
        </div>
    );
};

const HelpModal: React.FC<{
    isOpen: boolean;
    title: string;
    text: string;
    onClose: () => void;
}> = ({ isOpen, title, text, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <Icons.Close size={24} />
                    </button>
                </div>
                <p className="text-slate-300 leading-relaxed">
                    {text}
                </p>
                <Button fullWidth className="mt-6" onClick={onClose}>Got it</Button>
            </div>
        </div>
    );
};

export const Wallet: React.FC = () => {
    const { walletBalance, transactions, userProfile, currentUserPubkey, mints, setActiveMint, addMint, removeMint, sendFunds, receiveEcash, depositFunds, checkDepositStatus, confirmDeposit, getLightningQuote, isAuthenticated, refreshWalletBalance, walletMode, nwcString, setWalletMode, setNwcConnection, checkForPayments } = useApp();
    const navigate = useNavigate();

    const [view, setView] = useState<'main' | 'receive' | 'deposit' | 'send-input' | 'send-contacts' | 'send-details' | 'settings'>('main');
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
                    alert(`Amount must be between ${data.minSendable / 1000} and ${data.maxSendable / 1000} sats`);
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
                            if (walletMode === 'nwc' && !nwcString) {
                                setShowNwcError(true);
                                setIsWiggling(true);
                                setTimeout(() => setIsWiggling(false), 500);
                                // Vibrate if supported
                                if (navigator.vibrate) navigator.vibrate(200);
                                return;
                            }
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
                            <Icons.Wallet size={20} className={`mb-1 ${walletMode === 'cashu' ? 'text-emerald-400' : 'text-slate-400'}`} />
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

                {/* Breez Wallet Settings */}
                {walletMode === 'breez' && (
                    <div className="mb-8 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Lightning Wallet</h3>
                        
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
                            <div className={`bg-slate-800 p-4 rounded-xl border transition-all duration-200 ${showNwcError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-700'} ${isWiggling ? 'animate-wiggle' : ''}`}>
                                <label className={`block text-xs mb-2 ${showNwcError ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                                    {showNwcError ? 'Connection Required' : 'Connection String (nostr+walletconnect://...)'}
                                </label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-xs font-mono h-24 focus:ring-2 focus:ring-purple-500 outline-none resize-none mb-3"
                                    placeholder="nostr+walletconnect://..."
                                    value={localNwcString}
                                    onChange={e => {
                                        setLocalNwcString(e.target.value);
                                        if (showNwcError) setShowNwcError(false);
                                    }}
                                />
                                <div className="flex justify-end mb-3">
                                    <Button
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
                                </div>
                                <p className="text-xs text-slate-400">
                                    Paste your NWC connection string from Alby, Mutiny, or your home node.
                                    <br /><span className="text-purple-400">Note: This is stored locally on your device.</span>
                                </p>
                            </div>
                        )}
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


                        <div className="mt-8 pt-6 border-t border-slate-700">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Developer Tools</h3>
                            <Button
                                variant="secondary"
                                fullWidth
                                onClick={handleTestBridge}
                                className="border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10"
                            >
                                <Icons.Zap size={16} className="mr-2" />
                                Simulate Bridge Payment (NIP-17)
                            </Button>
                            <p className="text-[10px] text-slate-500 mt-2 text-center">
                                Sends a self-encrypted Gift Wrap with a mock token to test the listener.
                            </p>
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
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                        <Icons.Prev />
                    </button>
                    <div className="flex items-center justify-center space-x-2">
                        <h2 className="text-xl font-bold">Create Invoice</h2>
                        <button
                            onClick={() => setHelpModal({
                                isOpen: true,
                                title: "When to use an Invoice?",
                                text: "Use an invoice when you need to request a specific amount of money. Unlike your Lightning Address, an invoice is valid for only one payment and expires after a short time."
                            })}
                            className="text-slate-500 hover:text-brand-primary transition-colors"
                        >
                            <Icons.Help size={18} />
                        </button>
                    </div>
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

                {helpModal && <HelpModal isOpen={helpModal.isOpen} title={helpModal.title} text={helpModal.text} onClose={() => setHelpModal(null)} />}
            </div>
        );
    }

    if (view === 'receive') {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiveAddress)}&bgcolor=ffffff&color=000000&margin=2`;

        return (
            <div className="p-6 h-full flex flex-col items-center text-center">
                <div className="w-full flex justify-start mb-6">
                    <button onClick={() => setView('main')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                        <Icons.Prev />
                    </button>
                </div>
                <div className="flex items-center justify-center space-x-2 mb-2">
                    <h2 className="text-2xl font-bold">Lightning Address</h2>
                    <button
                        onClick={() => setHelpModal({
                            isOpen: true,
                            title: "What is a Lightning Address?",
                            text: "Think of this like your email address for money. It's permanent, so you don't need to create a new QR code every time. You can share it with anyone to receive payments instantly."
                        })}
                        className="text-slate-500 hover:text-brand-primary transition-colors"
                    >
                        <Icons.Help size={20} />
                    </button>
                </div>
                <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                    Your permanent address for receiving payments. Share it like a username.
                </p>

                <div className="bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 p-1 rounded-2xl shadow-2xl shadow-purple-500/20 mb-6">
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
                            <div className="bg-brand-primary/10 p-2 rounded-lg">
                                <Icons.Zap size={18} className="text-brand-primary" />
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

                <div className="mt-6 w-full flex justify-center">
                    <div className="flex items-center space-x-2 text-brand-primary animate-pulse">
                        <Icons.Zap size={18} />
                        <span className="text-sm font-bold">Waiting for payment...</span>
                    </div>
                </div>
                {helpModal && <HelpModal isOpen={helpModal.isOpen} title={helpModal.title} text={helpModal.text} onClose={() => setHelpModal(null)} />}
            </div>
        );
    }

    if (view === 'send-input') {
        const fileInput = (
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        );

        return (
            <div className="p-6 h-full flex flex-col">
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Choose Payment Method</h2>
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

                    {/* Scan with Camera (Placeholder) */}
                    <button
                        disabled
                        className="flex flex-col items-center justify-center bg-slate-900/50 border-2 border-slate-700/50 rounded-2xl p-6 opacity-50 cursor-not-allowed relative"
                    >
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-brand-accent/20 border border-brand-accent/40 rounded-full">
                            <span className="text-[10px] font-bold text-brand-accent">Soon</span>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-full mb-3">
                            <Icons.Camera size={32} className="text-slate-600" />
                        </div>
                        <span className="text-slate-500 font-bold text-sm mb-1">Scan QR Code</span>
                        <span className="text-slate-600 text-xs text-center">Coming soon</span>
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

    if (view === 'send-details') {
        return (
            <div className="p-6 h-full flex flex-col relative">
                {isProcessing && <ProcessingOverlay message="Processing..." />}

                <div className="flex items-center mb-6">
                    <button onClick={() => setView('send-scan')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
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
                                    Wallet Balance: {walletBalance} Sats<br />
                                    Required: {parseInt(sendAmount || '0') + (quoteFee || 0)} Sats
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
                        onClick={() => setHelpModal({
                            isOpen: true,
                            title: "Wallet Help",
                            text: "Your wallet allows you to send and receive Bitcoin instantly. You can use eCash for private, instant payments or connect your own Lightning node via NWC."
                        })}
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

            {/* Wallet Balance Tile - Color coded by wallet type */}
            <div className={`rounded-3xl p-6 shadow-xl border relative overflow-hidden mb-8 transition-all duration-500 ${
                walletMode === 'breez' 
                    ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 border-blue-500/30' 
                    : walletMode === 'nwc' 
                        ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-purple-950 border-purple-500/30' 
                        : 'bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950 border-emerald-500/30'
            }`}>
                {/* Ambient glow effect */}
                <div className={`absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl ${
                    walletMode === 'breez' 
                        ? 'bg-blue-500/15' 
                        : walletMode === 'nwc' 
                            ? 'bg-purple-500/15' 
                            : 'bg-emerald-500/15'
                }`}></div>
                <div className={`absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-3xl ${
                    walletMode === 'breez' 
                        ? 'bg-blue-600/10' 
                        : walletMode === 'nwc' 
                            ? 'bg-purple-600/10' 
                            : 'bg-emerald-600/10'
                }`}></div>

                {/* Mode Indicator Header */}
                <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
                        walletMode === 'breez' 
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' 
                            : walletMode === 'nwc' 
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' 
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}>
                        {walletMode === 'breez' ? (
                            <Icons.Zap size={16} />
                        ) : walletMode === 'nwc' ? (
                            <Icons.Link size={16} />
                        ) : (
                            <Icons.Wallet size={16} />
                        )}
                        <span className="text-xs font-bold tracking-wider uppercase">
                            {walletMode === 'breez' ? 'Lightning' : walletMode === 'nwc' ? 'NWC' : 'Cashu'}
                        </span>
                    </div>

                    {walletMode === 'cashu' && activeMint && (
                        <div className="flex items-center space-x-1.5 bg-black/30 px-2 py-1 rounded-md border border-white/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">
                                {activeMint.nickname}
                            </span>
                        </div>
                    )}
                    {walletMode === 'breez' && (
                        <div className="flex items-center space-x-1.5 bg-black/30 px-2 py-1 rounded-md border border-white/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-[10px] text-slate-400 font-mono">
                                Pending
                            </span>
                        </div>
                    )}
                </div>

                <div className="relative z-10">
                    <div className="mb-1">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Available Balance</p>
                    </div>

                    <div className="flex items-baseline space-x-1 mb-8">
                        <span className="text-5xl font-extrabold tracking-tight text-white drop-shadow-sm">{walletBalance.toLocaleString()}</span>
                        <span className={`text-xl font-bold ${
                            walletMode === 'breez' 
                                ? 'text-blue-400' 
                                : walletMode === 'nwc' 
                                    ? 'text-purple-400' 
                                    : 'text-emerald-400'
                        }`}>SATS</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setView('send-input')} 
                            className={`flex flex-col items-center justify-center bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-xl py-3 transition-all active:scale-95`}
                        >
                            <div className={`p-2 rounded-full mb-1 ${
                                walletMode === 'breez' 
                                    ? 'bg-blue-500/20' 
                                    : walletMode === 'nwc' 
                                        ? 'bg-purple-500/20' 
                                        : 'bg-emerald-500/20'
                            }`}>
                                <Icons.Send size={20} className={
                                    walletMode === 'breez' 
                                        ? 'text-blue-400' 
                                        : walletMode === 'nwc' 
                                            ? 'text-purple-400' 
                                            : 'text-emerald-400'
                                } />
                            </div>
                            <span className="text-sm font-bold text-white">Send</span>
                        </button>

                        <button 
                            onClick={() => walletMode === 'nwc' ? setView('deposit') : setView('receive')} 
                            className={`flex flex-col items-center justify-center rounded-xl py-3 transition-all active:scale-95 ${
                                walletMode === 'breez' 
                                    ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500' 
                                    : walletMode === 'nwc' 
                                        ? 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 hover:border-purple-500' 
                                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 hover:border-emerald-500'
                            }`}
                        >
                            <div className={`p-2 rounded-full mb-1 ${
                                walletMode === 'breez' 
                                    ? 'bg-blue-500/20' 
                                    : walletMode === 'nwc' 
                                        ? 'bg-purple-500/20' 
                                        : 'bg-emerald-500/20'
                            }`}>
                                <Icons.Receive size={20} className={
                                    walletMode === 'breez' 
                                        ? 'text-blue-400' 
                                        : walletMode === 'nwc' 
                                            ? 'text-purple-400' 
                                            : 'text-emerald-400'
                                } />
                            </div>
                            <span className="text-sm font-bold text-white">Receive</span>
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
                        .filter(tx => (tx.walletType || 'cashu') === walletMode)
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
            {helpModal && <HelpModal isOpen={helpModal.isOpen} title={helpModal.title} text={helpModal.text} onClose={() => setHelpModal(null)} />}
        </div >
    );
};
