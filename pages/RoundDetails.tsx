import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { sendGiftWrap } from '../services/nostrService';

export const RoundDetails: React.FC = () => {
    const {
        activeRound,
        players,
        walletBalance,
        createToken,
        addTransaction,
        setPlayerPaid,
        currentUserPubkey,
        depositFunds,
        checkDepositStatus
    } = useApp();

    const navigate = useNavigate();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentInvoice, setPaymentInvoice] = useState('');
    const [paymentQuote, setPaymentQuote] = useState('');
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [isPayingWallet, setIsPayingWallet] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [paymentError, setPaymentError] = useState('');

    const currentPlayer = players.find(p => p.isCurrentUser);
    const isHost = activeRound?.pubkey === currentUserPubkey;

    const entryFee = activeRound?.entryFeeSats || 0;
    const acePotFee = activeRound?.acePotFeeSats || 0;

    // Calculate what the current player owes
    const playerOwesEntry = currentPlayer?.paysEntry && entryFee > 0;
    const playerOwesAce = currentPlayer?.paysAce && acePotFee > 0;
    const totalOwed =
        (playerOwesEntry ? entryFee : 0) +
        (playerOwesAce ? acePotFee : 0);

    // Watch for payment on invoice
    useEffect(() => {
        if (showPaymentModal && paymentQuote && !paymentSuccess) {
            const interval = setInterval(async () => {
                const paid = await checkDepositStatus(paymentQuote);
                if (paid) {
                    setPaymentSuccess(true);
                    setPlayerPaid(currentUserPubkey);
                    setTimeout(() => {
                        setShowPaymentModal(false);
                        setPaymentSuccess(false);
                    }, 2000);
                }
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [showPaymentModal, paymentQuote, paymentSuccess, checkDepositStatus, currentUserPubkey, setPlayerPaid]);

    const handleOpenPayment = async () => {
        setShowPaymentModal(true);
        setIsGeneratingInvoice(true);
        setPaymentError('');

        try {
            const { request, quote } = await depositFunds(totalOwed);
            setPaymentInvoice(request);
            setPaymentQuote(quote);
        } catch (error) {
            setPaymentError('Failed to generate invoice. Please try again.');
            console.error('Invoice generation failed:', error);
        } finally {
            setIsGeneratingInvoice(false);
        }
    };

    const handlePayWithWallet = async () => {
        if (!activeRound || !currentPlayer || totalOwed === 0) return;

        if (walletBalance < totalOwed) {
            setPaymentError(`Insufficient balance. You need ${totalOwed} sats but only have ${walletBalance} sats.`);
            return;
        }

        setIsPayingWallet(true);
        setPaymentError('');

        try {
            // Create eCash token
            const token = await createToken(totalOwed);

            // Send to host via NIP-17 Gift Wrap
            const hostPubkey = activeRound.pubkey;
            const message = `Payment for ${activeRound.name}: ${token}`;

            await sendGiftWrap(hostPubkey, message);

            // Mark self as paid locally
            setPlayerPaid(currentUserPubkey);

            // Add transaction
            addTransaction('send', totalOwed, `Buy-in: ${activeRound.name}`, 'cashu');

            setPaymentSuccess(true);
            setTimeout(() => {
                setShowPaymentModal(false);
                setPaymentSuccess(false);
            }, 2000);
        } catch (error) {
            console.error('Payment failed:', error);
            setPaymentError('Payment failed. Please try again.');
        } finally {
            setIsPayingWallet(false);
        }
    };

    const handleCopyInvoice = () => {
        navigator.clipboard.writeText(paymentInvoice);
    };

    const handleOpenLightningWallet = () => {
        window.open(`lightning:${paymentInvoice}`, '_blank');
    };

    if (!activeRound) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6">
                <div className="text-center">
                    <p className="text-slate-400">No active round found.</p>
                    <button
                        onClick={() => navigate('/play')}
                        className="mt-4 text-brand-primary hover:underline"
                    >
                        Go to Play Tab
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col">
            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <button
                        onClick={() => navigate('/play')}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <Icons.Prev size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-white">Round Details</h1>
                    <div className="w-6" /> {/* Spacer */}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 max-w-md mx-auto w-full space-y-6 pb-24">

                {/* Round Info Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{activeRound.name}</h2>
                        <div className="flex items-center text-slate-400 text-sm">
                            <Icons.Location size={14} className="mr-1" />
                            <span>{activeRound.courseName}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <span className="text-slate-400 text-sm">Holes</span>
                        <span className="text-white font-bold">{activeRound.holeCount}</span>
                    </div>

                    {entryFee > 0 && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Entry Fee</span>
                            <span className="text-white font-bold">{entryFee.toLocaleString()} sats</span>
                        </div>
                    )}

                    {acePotFee > 0 && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Ace Pot</span>
                            <span className="text-white font-bold">{acePotFee} sats</span>
                        </div>
                    )}
                </div>

                {/* Players List */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Players ({players.length})</h3>
                    {players.map((player) => (
                        <div
                            key={player.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center space-x-3">
                                {player.photoUrl ? (
                                    <img
                                        src={player.photoUrl}
                                        alt={player.name}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                                        <Icons.User size={20} className="text-slate-500" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-white font-medium">
                                        {player.name}
                                        {player.isCurrentUser && (
                                            <span className="ml-2 text-xs text-brand-primary">(You)</span>
                                        )}
                                        {player.id === activeRound.pubkey && (
                                            <Icons.Shield size={14} className="inline ml-1 text-yellow-500" />
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {player.paysEntry && player.paysAce ? 'Entry + Ace' :
                                            player.paysEntry ? 'Entry only' :
                                                player.paysAce ? 'Ace only' : 'Spectating'}
                                    </p>
                                </div>
                            </div>
                            <div>
                                {player.paid ? (
                                    <div className="flex items-center text-green-500 text-xs font-bold">
                                        <Icons.CheckMark size={16} className="mr-1" />
                                        Paid
                                    </div>
                                ) : (
                                    <div className="text-orange-400 text-xs font-bold">
                                        Unpaid
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Payment/Action Section */}
                {currentPlayer && !currentPlayer.paid && totalOwed > 0 && (
                    <button
                        onClick={handleOpenPayment}
                        className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-accent transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/20 flex items-center justify-center space-x-2"
                    >
                        <Icons.Zap size={18} />
                        <span>Pay {totalOwed} sats</span>
                    </button>
                )}

                {currentPlayer?.paid && (
                    <button
                        onClick={() => navigate('/play')}
                        className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all transform hover:scale-[1.02] shadow-lg flex items-center justify-center space-x-2"
                    >
                        <Icons.Play size={18} />
                        <span>View Scorecard</span>
                    </button>
                )}

                {isHost && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <p className="text-xs text-blue-300">
                            <Icons.Shield size={12} className="inline mr-1" />
                            You're the host. Players will pay you directly.
                        </p>
                    </div>
                )}
            </div>

            {/* PAYMENT MODAL */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative overflow-hidden">

                        {paymentSuccess && (
                            <div className="absolute inset-0 bg-green-500/20 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in">
                                <div className="text-center">
                                    <Icons.CheckMark className="text-green-500 w-16 h-16 mx-auto mb-2" />
                                    <p className="text-white font-bold text-xl">Paid!</p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setShowPaymentModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                        >
                            <Icons.Close size={24} />
                        </button>

                        <div className="text-center space-y-4 pt-2">
                            <h3 className="text-xl font-bold text-white">Pay Your Entry Fee</h3>
                            <p className="text-slate-400 text-sm">
                                Complete the entry fee payment for <span className="text-white font-bold">{activeRound.name}</span>.
                            </p>

                            {/* Error Banner */}
                            {paymentError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start space-x-2 text-left animate-in fade-in slide-in-from-top-2">
                                    <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={16} />
                                    <p className="text-xs text-red-200 font-bold leading-tight">{paymentError}</p>
                                </div>
                            )}

                            {/* Amount Display */}
                            <div>
                                <p className="text-2xl font-bold text-brand-accent">{totalOwed} SATS</p>
                                <p className="text-xs text-slate-500">Entry: {playerOwesEntry ? entryFee : 0} | Ace Pot: {playerOwesAce ? acePotFee : 0}</p>
                            </div>

                            {/* Inline Copy Invoice */}
                            {!isGeneratingInvoice && paymentInvoice && (
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

                            {/* QR Code Block */}
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

                            {/* Listening Indicator */}
                            {!isGeneratingInvoice && !paymentSuccess && paymentInvoice && (
                                <div className="pt-2 flex items-center justify-center space-x-2 text-brand-primary animate-pulse">
                                    <Icons.Zap size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Listening for payment...</span>
                                </div>
                            )}

                            {/* Payment Actions */}
                            <div className="pt-4 space-y-3">
                                {/* Primary Pay with App Wallet */}
                                <button
                                    onClick={handlePayWithWallet}
                                    disabled={isPayingWallet}
                                    className="w-full py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center justify-center space-x-2">
                                        <span>{isPayingWallet ? 'Processing...' : `Pay ${totalOwed} SATS with App Wallet`}</span>
                                        <Icons.Wallet size={18} />
                                    </div>
                                </button>

                                {/* External Wallet */}
                                <button
                                    onClick={handleOpenLightningWallet}
                                    className="w-full py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all text-xs"
                                >
                                    Open Lightning Wallet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
