/**
 * @file PaymentRequestModal.tsx
 * @description Bottom-sheet modal that appears when the user receives a
 * payment request (entry fee) from a round host via NIP-17 Gift Wrap DM.
 * Displays the amount, optional breakdown (entry fee + ace pot), and
 * round context. Supports one-tap pay, retry on failure, Cashu token
 * fallback, and "Fund Wallet" redirect when balance is insufficient.
 * Sends a confirmation Gift Wrap back to the host on success.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDenomination } from '../hooks/useDenomination';
import { Icons } from './Icons';
import { sendGiftWrap } from '../services/giftWrapService';
import { getRelays } from '../services/nostrService';
import { hexToBytes } from '@noble/hashes/utils';

/**
 * Internal state for a single pending payment request.
 *
 * @property id - Unique request identifier.
 * @property invoice - Lightning invoice or payment destination.
 * @property amount - Total amount in sats.
 * @property breakdown - Optional split of entry fee and ace pot amounts.
 * @property round - Optional round context (course name, host, date).
 * @property message - Optional message from the host.
 * @property senderPubkey - Nostr pubkey of the requesting host.
 * @property status - Current payment state.
 * @property error - Error message if payment failed.
 */
interface PendingPaymentRequest {
  id: string;
  invoice: string;
  amount: number;
  breakdown?: { entryFee: number; acePot: number };
  round?: { course: string; host: string; date: string };
  message?: string;
  senderPubkey: string;
  status: 'pending' | 'paying' | 'paid' | 'failed';
  error?: string;
}

/**
 * Payment request bottom-sheet modal.
 *
 * Listens for `payment-request-received` CustomEvents dispatched by
 * WalletContext when a NIP-17 Gift Wrap payment request arrives. Deduplicates
 * by invoice string and displays the most recent actionable request.
 *
 * Payment flow:
 * 1. User taps "Pay Now" -> `sendFunds()` via the active wallet
 * 2. On success -> sends `payment_confirmation` Gift Wrap to host -> auto-dismiss
 * 3. On failure -> if Cashu wallet, attempts token fallback via `createToken()`
 * 4. On insufficient balance -> shows "Fund Wallet" button linking to wallet page
 *
 * @returns The modal overlay, or `null` when there are no actionable requests.
 */
export const PaymentRequestModal: React.FC = () => {
  const navigate = useNavigate();
  const { sendFunds, walletBalance, createToken, walletMode } = useApp();
  const { formatAmount } = useDenomination();

  const [requests, setRequests] = useState<PendingPaymentRequest[]>([]);

  // Listen for payment-request-received custom events dispatched from WalletContext
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const detail = e.detail as Omit<PendingPaymentRequest, 'status'>;
      setRequests(prev => {
        // Dedupe by invoice string
        if (prev.some(r => r.invoice === detail.invoice)) return prev;
        return [...prev, { ...detail, status: 'pending' }];
      });
    };

    window.addEventListener('payment-request-received', handler as EventListener);
    return () => window.removeEventListener('payment-request-received', handler as EventListener);
  }, []);

  // The most recent pending request to display
  const current = requests.find(r => r.status === 'pending' || r.status === 'paying' || r.status === 'failed')
    ?? null;

  // Send confirmation Gift Wrap back to host
  const sendConfirmation = useCallback(async (request: PendingPaymentRequest) => {
    try {
      const userSkHex = localStorage.getItem('nostr_sk');
      if (userSkHex) {
        const userSk = hexToBytes(userSkHex);
        const content = JSON.stringify({
          type: 'payment_confirmation',
          round: request.round,
          amount: request.amount,
          message: 'Payment confirmed',
        });
        await sendGiftWrap(content, userSk, request.senderPubkey, getRelays(), 14);
      }
    } catch (err) {
      console.error('Failed to send payment confirmation:', err);
    }
  }, []);

  // Attempt Cashu token fallback when Lightning fails
  const tryCashuFallback = useCallback(async (request: PendingPaymentRequest): Promise<boolean> => {
    if (walletMode !== 'cashu' || walletBalance < request.amount) return false;

    try {
      const token = await createToken(request.amount);
      const userSkHex = localStorage.getItem('nostr_sk');
      if (userSkHex) {
        const userSk = hexToBytes(userSkHex);
        const content = JSON.stringify({
          type: 'cashu_payment',
          token,
          amount: request.amount,
          round: request.round,
        });
        await sendGiftWrap(content, userSk, request.senderPubkey, getRelays(), 14);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Cashu fallback failed:', err);
      return false;
    }
  }, [walletMode, walletBalance, createToken]);

  // Handle "Pay Now" tap
  const handlePay = useCallback(async (request: PendingPaymentRequest) => {
    // Set status to paying
    setRequests(prev =>
      prev.map(r => r.id === request.id ? { ...r, status: 'paying' as const, error: undefined } : r)
    );

    try {
      const success = await sendFunds(request.amount, request.invoice);
      if (success) {
        setRequests(prev =>
          prev.map(r => r.id === request.id ? { ...r, status: 'paid' as const } : r)
        );
        // Send confirmation Gift Wrap to host
        await sendConfirmation(request);
        // Auto-dismiss after 2s
        setTimeout(() => {
          setRequests(prev => prev.filter(r => r.id !== request.id));
        }, 2000);
      } else {
        throw new Error('Payment failed');
      }
    } catch (err) {
      // Lightning failed — try Cashu fallback if applicable
      if (walletMode === 'cashu') {
        const fallbackSuccess = await tryCashuFallback(request);
        if (fallbackSuccess) {
          setRequests(prev =>
            prev.map(r => r.id === request.id ? { ...r, status: 'paid' as const } : r)
          );
          await sendConfirmation(request);
          setTimeout(() => {
            setRequests(prev => prev.filter(r => r.id !== request.id));
          }, 2000);
          return;
        }
      }

      // Determine error message
      const errorMsg = walletBalance < request.amount
        ? 'Insufficient balance'
        : 'Payment failed. Please try again.';

      setRequests(prev =>
        prev.map(r => r.id === request.id ? { ...r, status: 'failed' as const, error: errorMsg } : r)
      );
    }
  }, [sendFunds, walletBalance, walletMode, sendConfirmation, tryCashuFallback]);

  // Handle "Later" — dismiss current request (keep in queue as pending for potential future handling)
  const handleLater = useCallback((request: PendingPaymentRequest) => {
    setRequests(prev => prev.filter(r => r.id !== request.id));
  }, []);

  if (!current) return null;

  const insufficientBalance = current.status === 'failed' && current.error === 'Insufficient balance';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Icons.Zap size={18} className="text-amber-400" />
            <h3 className="text-lg font-bold text-white">Payment Request</h3>
          </div>
          {current.round && (
            <p className="text-sm text-slate-400 mt-1">
              {current.round.course} &middot; hosted by {current.round.host}
            </p>
          )}
        </div>

        {/* Amount display */}
        <div className="px-5 pb-4">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            {/* Total */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Total</span>
              <span className="text-xl font-bold text-amber-400">
                {formatAmount(current.amount)}
              </span>
            </div>

            {/* Breakdown */}
            {current.breakdown && (
              <div className="border-t border-slate-700/50 pt-2 space-y-1">
                {current.breakdown.entryFee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Entry fee</span>
                    <span className="text-slate-300">{formatAmount(current.breakdown.entryFee)}</span>
                  </div>
                )}
                {current.breakdown.acePot > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Ace pot</span>
                    <span className="text-slate-300">{formatAmount(current.breakdown.acePot)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {current.message && (
            <p className="text-xs text-slate-500 mt-2 italic">{current.message}</p>
          )}
        </div>

        {/* Status / Action area */}
        <div className="px-5 pb-5">
          {/* Paid state */}
          {current.status === 'paid' && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Icons.CheckMark size={20} className="text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Payment sent</span>
            </div>
          )}

          {/* Paying state */}
          {current.status === 'paying' && (
            <div className="flex items-center justify-center gap-2 py-3">
              <div className="h-5 w-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-300 font-medium">Sending payment...</span>
            </div>
          )}

          {/* Failed state */}
          {current.status === 'failed' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-red-400">
                <Icons.AlertTriangle size={18} />
                <span className="text-sm font-medium">{current.error}</span>
              </div>
              <div className="flex gap-3">
                {insufficientBalance ? (
                  <>
                    <button
                      onClick={() => {
                        handleLater(current);
                        navigate('/wallet');
                      }}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold text-sm active:scale-[0.97] transition-transform"
                    >
                      Fund Wallet
                    </button>
                    <button
                      onClick={() => handleLater(current)}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-700/60 text-slate-300 font-semibold text-sm active:scale-[0.97] transition-transform"
                    >
                      Later
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handlePay(current)}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold text-sm active:scale-[0.97] transition-transform"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => handleLater(current)}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-700/60 text-slate-300 font-semibold text-sm active:scale-[0.97] transition-transform"
                    >
                      Later
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Pending state — primary action buttons */}
          {current.status === 'pending' && (
            <div className="flex gap-3">
              <button
                onClick={() => handlePay(current)}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white font-bold text-sm active:scale-[0.97] transition-transform"
              >
                Pay Now
              </button>
              <button
                onClick={() => handleLater(current)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-700/60 text-slate-300 font-semibold text-sm active:scale-[0.97] transition-transform"
              >
                Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
