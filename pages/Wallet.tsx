
import React, { useState, useEffect, useRef } from 'react';
import { useQrScanner } from '../hooks/useQrScanner';
import { useApp } from '../context/AppContext';
import { sendGiftWrap } from '../services/nostrService';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';

// Helper Component for Success Animation
const SuccessOverlay: React.FC<{ message: string, subMessage?: string, onClose: () => void }> = ({ message, subMessage, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2500);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="absolute inset-0 z-50 bg-brand-dark flex flex-col items-center justify-center animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30 animate-in fade-in zoom-in-75 delay-100 duration-500">
                <Icons.CheckMark size={48} className="text-white" strokeWidth={4} />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2 animate-in slide-in-from-bottom-4 delay-200">{message}</h3>
            {subMessage && <p className="text-slate-400 text-lg animate-in slide-in-from-bottom-4 delay-300">{subMessage}</p>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
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
    const { walletBalance, transactions, userProfile, currentUserPubkey, mints, setActiveMint, addMint, removeMint, sendFunds, receiveEcash, depositFunds, checkDepositStatus, confirmDeposit, getLightningQuote, isAuthenticated, refreshWalletBalance, walletMode, nwcString, setWalletMode, setNwcConnection } = useApp();
    const navigate = useNavigate();

    const [view, setView] = useState<'main' | 'receive' | 'deposit' | 'send-scan' | 'send-details' | 'settings'>('main');
    const [sendAmount, setSendAmount] = useState('');
    const [sendInput, setSendInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

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
    const receiveAddress = userProfile.lud16 || currentUserPubkey;

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
            // Poll every 3 seconds
            pollingRef.current = setInterval(async () => {
                const isPaid = await checkDepositStatus(depositQuote);
                if (isPaid) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    const amount = parseInt(depositAmount);
                    const success = await confirmDeposit(depositQuote, amount);
                    if (success) {
                        setDepositSuccess(true);
                    }
                }
            }, 3000);
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
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


    // Camera & Scanning Logic
    const { isCameraLoading, cameraError, scannedData } = useQrScanner({
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

    // --- Success Overlay Renders ---

    if (depositSuccess) {
        return (
            <div className="h-full p-6 relative">
                <SuccessOverlay
                    message="Deposit Confirmed!"
                    subMessage="Tokens minted successfully."
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
                    onClose={() => setView('main')}
                />
            </div>
        );
    }

    if (successMode === 'received') {
        return (
            <div className="h-full p-6 relative">
                <SuccessOverlay
                    message="eCash Received!"
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
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setWalletMode('cashu')}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${walletMode === 'cashu' ? 'bg-brand-primary/20 border-brand-primary' : 'bg-slate-800 border-slate-700 opacity-60'}`}
                        >
                            <span className="font-bold text-lg mb-1">Cashu</span>
                            <span className="text-xs text-center text-slate-400">Private, Instant, eCash</span>
                        </button>
                        <button
                            onClick={() => setWalletMode('nwc')}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${walletMode === 'nwc' ? 'bg-brand-secondary/20 border-brand-secondary' : 'bg-slate-800 border-slate-700 opacity-60'}`}
                        >
                            <span className="font-bold text-lg mb-1">NWC</span>
                            <span className="text-xs text-center text-slate-400">Self-Custody, Lightning</span>
                        </button>
                    </div>
                    {showNwcError && walletMode === 'nwc' && !nwcString && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center animate-in fade-in slide-in-from-top-2">
                            <Icons.Close className="text-red-500 mr-2" size={16} />
                            <p className="text-xs text-red-400 font-bold">
                                Please save a connection or switch to Cashu.
                            </p>
                        </div>
                    )}
                </div>

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
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-xs font-mono h-24 focus:ring-2 focus:ring-brand-secondary outline-none resize-none mb-3"
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
                                    <br /><span className="text-brand-secondary">Note: This is stored locally on your device.</span>
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
                    </div>
                )
                }
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
                        <div className="bg-white p-4 rounded-xl">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(depositInvoice)}`}
                                alt="Deposit Invoice"
                                className="w-48 h-48"
                            />
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

                <div className="bg-white p-4 rounded-2xl shadow-xl mb-6">
                    <img src={qrUrl} alt="Wallet QR Code" className="w-48 h-48" />
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
                {helpModal && <HelpModal isOpen={helpModal.isOpen} title={helpModal.title} text={helpModal.text} onClose={() => setHelpModal(null)} />}
            </div>
        );
    }

    if (view === 'send-scan') {
        const fileInput = (
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        );

        if (cameraError) {
            return (
                <div className="h-full bg-brand-dark flex flex-col p-6 relative">
                    <button
                        onClick={() => setView('main')}
                        className="absolute top-6 left-6 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Close size={24} />
                    </button>

                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="relative">
                            <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl border border-slate-700">
                                <Icons.Camera size={48} className="text-slate-600" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center border-4 border-brand-dark shadow-lg">
                                <Icons.Close size={20} className="text-white" strokeWidth={3} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-white">Scanner Unavailable</h2>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                                We couldn't access your camera. Please check your browser permissions or try an alternative method.
                            </p>
                        </div>
                        <div className="w-full max-w-sm space-y-3 pt-4">
                            <Button fullWidth onClick={() => { setView('main'); setTimeout(() => setView('send-scan'), 100); }} className="bg-brand-primary text-white hover:bg-brand-primary/90">
                                <Icons.Refresh className="mr-2" size={20} />
                                <span>Retry Camera</span>
                            </Button>
                            <Button fullWidth onClick={() => fileInputRef.current?.click()} className="bg-brand-surface border border-slate-600 hover:bg-slate-700 text-white">
                                <Icons.QrCode className="mr-2 text-brand-primary" size={20} />
                                <span>Upload QR Image</span>
                            </Button>
                            <Button fullWidth onClick={() => setView('send-details')} className="bg-brand-surface border border-slate-600 hover:bg-slate-700 text-white">
                                <Icons.Plus className="mr-2 text-brand-secondary" size={20} />
                                <span>Paste Address / Invoice</span>
                            </Button>
                        </div>
                    </div>
                    {fileInput}
                </div>
            );
        }

        return (
            <div className="relative h-full bg-black flex flex-col">
                <div className="flex-1 relative overflow-hidden">
                    <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover z-10"
                        muted autoPlay playsInline
                        onLoadedMetadata={() => { videoRef.current?.play().catch(e => console.warn("Auto-play prevented", e)); }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {isCameraLoading && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
                            <div className="flex flex-col items-center bg-slate-900/90 p-6 rounded-2xl border border-slate-700">
                                <Icons.QrCode className="animate-pulse text-brand-primary mb-3" size={40} />
                                <p className="text-white text-sm font-bold">Starting Camera...</p>
                            </div>
                        </div>
                    )}
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-2 border-brand-primary rounded-lg relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-primary -mt-1 -ml-1"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-primary -mt-1 -mr-1"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-primary -mb-1 -ml-1"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-primary -mb-1 -mr-1"></div>
                            {!isCameraLoading && (
                                <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                            )}
                        </div>
                    </div>
                    <div className="absolute top-8 left-0 right-0 z-20 text-center pointer-events-none">
                        <h2 className="text-white font-bold text-lg drop-shadow-md bg-black/30 inline-block px-4 py-1 rounded-full backdrop-blur-sm">Scan Invoice or Token</h2>
                    </div>
                    <button onClick={() => setView('main')} className="absolute top-6 left-6 z-30 p-3 bg-black/40 rounded-full text-white hover:bg-black/60 backdrop-blur-md transition-all">
                        <Icons.Close size={24} />
                    </button>
                </div>
                <div className="bg-brand-dark p-6 pb-24 z-20 border-t border-slate-800 flex space-x-3 bottom-20 fixed left-0 right-0">
                    <Button fullWidth variant="secondary" onClick={() => fileInputRef.current?.click()} className="text-white">
                        <Icons.QrCode className="mr-2" size={18} /> Upload Image
                    </Button>
                    <Button fullWidth variant="secondary" onClick={() => setView('send-details')} className="text-white">
                        <Icons.Plus className="mr-2" size={18} /> Paste Address
                    </Button>
                </div>
                {fileInput}
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
                                    placeholder="lnbc... or user@domain.com or cashuA..."
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
        <div className="flex flex-col h-full p-6 pb-24">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center">
                    <Icons.Wallet className="mr-2 text-brand-primary" /> Wallet
                </h1>
                <button onClick={() => setView('settings')} className="p-2 bg-slate-800 rounded-full hover:text-brand-primary transition-colors">
                    <Icons.Settings size={20} />
                </button>
            </div>

            <div className={`rounded-3xl p-6 shadow-xl border relative overflow-hidden mb-8 transition-all duration-500 ${walletMode === 'nwc' ? 'bg-gradient-to-br from-slate-800 to-indigo-950 border-indigo-500/30' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700'}`}>
                <div className={`absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl ${walletMode === 'nwc' ? 'bg-indigo-500/10' : 'bg-brand-primary/5'}`}></div>

                {/* Mode Indicator Header */}
                <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${walletMode === 'nwc' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'}`}>
                        {walletMode === 'nwc' ? <Icons.Zap size={16} /> : <Icons.Wallet size={16} />}
                        <span className="text-xs font-bold tracking-wider uppercase">
                            {walletMode === 'nwc' ? 'NWC Wallet' : 'Cashu Wallet'}
                        </span>
                    </div>

                    {walletMode === 'cashu' && activeMint && (
                        <div className="flex items-center space-x-1.5 bg-black/30 px-2 py-1 rounded-md border border-white/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">
                                {activeMint.nickname}
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
                        <span className={`text-xl font-bold ${walletMode === 'nwc' ? 'text-indigo-400' : 'text-brand-accent'}`}>SATS</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setView('send-scan')} className="flex flex-col items-center justify-center bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-xl py-3 transition-all active:scale-95">
                            <div className="bg-brand-accent/20 p-2 rounded-full mb-1">
                                <Icons.Send size={20} className="text-brand-accent" />
                            </div>
                            <span className="text-sm font-bold text-white">Send</span>
                        </button>

                        <button onClick={() => walletMode === 'nwc' ? setView('deposit') : setView('receive')} className="flex flex-col items-center justify-center bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/50 hover:border-brand-primary rounded-xl py-3 transition-all active:scale-95">
                            <div className="bg-brand-primary/20 p-2 rounded-full mb-1">
                                <Icons.Receive size={20} className="text-brand-primary" />
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
