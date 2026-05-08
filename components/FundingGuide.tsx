/**
 * @file FundingGuide.tsx
 * @description Step-by-step modal guide for funding a wallet via Cash App,
 * Strike, or on-chain Bitcoin from an exchange (Coinbase, Robinhood, etc.).
 * Shows the user's Lightning address for the first two methods and generates
 * an on-chain Bitcoin deposit address via Breez SDK for the exchange tab.
 */

import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { isBreezInitialized, createOnchainAddress } from '../services/breezService';

/**
 * Props for the {@link FundingGuide} component.
 *
 * @property lightningAddress - The user's Lightning address to display for copying.
 * @property amountNeeded - Optional sats amount needed (e.g., entry fee shortfall) shown for context.
 * @property onClose - Callback invoked when the guide is dismissed.
 */
interface FundingGuideProps {
  lightningAddress: string;
  amountNeeded?: number;
  onClose: () => void;
}

/** Available funding method tabs. */
type FundingTab = 'cashapp' | 'strike' | 'exchange';

/**
 * Full-screen modal with tabbed step-by-step instructions for funding the wallet.
 *
 * - **Cash App** - Instructions for sending Bitcoin via Lightning with Cash App.
 * - **Strike** - Instructions for sending via Strike's Lightning address feature.
 * - **Coinbase & More** - Generates an on-chain BTC deposit address via Breez SDK
 *   (only shown when Breez is initialized) for exchanges that don't support Lightning.
 *
 * Each tab displays numbered steps and a copyable address (Lightning or on-chain).
 *
 * @param props - {@link FundingGuideProps}
 * @returns The funding guide modal overlay.
 */
export const FundingGuide: React.FC<FundingGuideProps> = ({ lightningAddress, amountNeeded, onClose }) => {
  const [activeTab, setActiveTab] = useState<FundingTab>('cashapp');
  const [copied, setCopied] = useState(false);
  const [copiedBtc, setCopiedBtc] = useState(false);

  // On-chain address state
  const [btcAddress, setBtcAddress] = useState<string | null>(null);
  const [btcFee, setBtcFee] = useState<number>(0);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const breezAvailable = isBreezInitialized();

  // Generate on-chain address when Exchange tab is selected
  useEffect(() => {
    if (activeTab === 'exchange' && breezAvailable && !btcAddress && !isLoadingAddress) {
      setIsLoadingAddress(true);
      setAddressError(null);
      createOnchainAddress()
        .then(result => {
          if (result) {
            setBtcAddress(result.address);
            setBtcFee(result.feeSats);
          } else {
            setAddressError('Could not generate address. Please try again.');
          }
        })
        .catch(() => setAddressError('Failed to generate address.'))
        .finally(() => setIsLoadingAddress(false));
    }
  }, [activeTab, breezAvailable, btcAddress, isLoadingAddress]);

  const handleCopy = () => {
    navigator.clipboard.writeText(lightningAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyBtc = () => {
    if (!btcAddress) return;
    navigator.clipboard.writeText(btcAddress).catch(() => {});
    setCopiedBtc(true);
    setTimeout(() => setCopiedBtc(false), 2000);
  };

  const truncatedAddress = lightningAddress.length > 28
    ? lightningAddress.substring(0, 14) + '...' + lightningAddress.substring(lightningAddress.length - 14)
    : lightningAddress;

  const truncatedBtc = btcAddress
    ? btcAddress.length > 28
      ? btcAddress.substring(0, 14) + '...' + btcAddress.substring(btcAddress.length - 14)
      : btcAddress
    : '';

  // Show address section based on active tab
  const showLightningAddress = activeTab !== 'exchange';
  const showBtcAddress = activeTab === 'exchange' && breezAvailable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Icons.Zap size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Fund Your Wallet</h3>
                {amountNeeded && amountNeeded > 0 && (
                  <p className="text-xs text-slate-400">You need <span className="text-emerald-400 font-bold">{amountNeeded.toLocaleString()} sats</span> to continue</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 transition-colors">
              <Icons.Close size={20} />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-700/50">
          <button
            onClick={() => setActiveTab('cashapp')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'cashapp'
                ? 'text-[#00D64F] border-b-2 border-[#00D64F] bg-[#00D64F]/5'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Cash App
          </button>
          <button
            onClick={() => setActiveTab('strike')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'strike'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Strike
          </button>
          {breezAvailable && (
            <button
              onClick={() => setActiveTab('exchange')}
              className={`flex-1 py-2.5 text-xs font-bold transition-all ${
                activeTab === 'exchange'
                  ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/5'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Coinbase & More
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 max-h-[55vh] overflow-y-auto">

          {/* Cash App Guide */}
          {activeTab === 'cashapp' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Already have Cash App? You can send Bitcoin via Lightning in under a minute.
              </p>

              <div className="space-y-2">
                <Step number={1} color="[#00D64F]">
                  Open <span className="font-bold text-[#00D64F]">Cash App</span> and tap the Bitcoin tab (the <span className="font-bold">&#8383;</span> icon at the bottom)
                </Step>
                <Step number={2} color="[#00D64F]">
                  Tap the <span className="font-bold text-white">Send</span> button
                </Step>
                <Step number={3} color="[#00D64F]">
                  Switch to <span className="font-bold text-white">Lightning</span> mode (tap the toggle at the top of the send screen)
                </Step>
                <Step number={4} color="[#00D64F]">
                  Paste the address below and enter the amount
                </Step>
                <Step number={5} color="[#00D64F]">
                  Confirm the send. Most Lightning payments arrive in seconds; if one stays pending, wait for a clear success before trying again.
                </Step>
              </div>

              <DownloadLink
                name="Cash App"
                color="#00D64F"
                url="https://cash.app"
                note="Free Lightning sends. US & UK."
              />
            </div>
          )}

          {/* Strike Guide */}
          {activeTab === 'strike' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Strike has the lowest fees and the simplest Lightning experience.
              </p>

              <div className="space-y-2">
                <Step number={1} color="blue-400">
                  Open <span className="font-bold text-blue-400">Strike</span> and tap <span className="font-bold text-white">Send</span>
                </Step>
                <Step number={2} color="blue-400">
                  Tap <span className="font-bold text-white">Lightning Address</span> at the top
                </Step>
                <Step number={3} color="blue-400">
                  Paste the address below
                </Step>
                <Step number={4} color="blue-400">
                  Enter the amount{amountNeeded ? <span className="text-blue-400"> ({amountNeeded.toLocaleString()} sats)</span> : ''}, tap <span className="font-bold text-white">Send</span>
                </Step>
                <Step number={5} color="blue-400">
                  That's it. Most payments arrive in seconds; if one stays pending, wait for a clear success before trying again.
                </Step>
              </div>

              <DownloadLink
                name="Strike"
                color="#3B82F6"
                url="https://strike.me"
                note="0.3% fees. US, EU & Americas."
              />
            </div>
          )}

          {/* Exchange / Coinbase Guide */}
          {activeTab === 'exchange' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Have Bitcoin on an exchange? Send it directly to your wallet. Works with Coinbase, Robinhood, Kraken, Gemini, or any exchange.
              </p>

              <div className="space-y-2">
                <Step number={1} color="orange-400">
                  Open your exchange app (Coinbase, Robinhood, etc.) and find <span className="font-bold text-white">Send</span> or <span className="font-bold text-white">Withdraw</span>
                </Step>
                <Step number={2} color="orange-400">
                  Select <span className="font-bold text-white">Bitcoin</span> as the asset
                </Step>
                <Step number={3} color="orange-400">
                  Copy the deposit address below and paste it as the destination
                </Step>
                <Step number={4} color="orange-400">
                  Enter the amount and confirm the withdrawal
                </Step>
              </div>

              {/* Timing note */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <div className="flex items-start space-x-2">
                  <Icons.Zap size={14} className="text-orange-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-orange-200/90 leading-snug">
                      <span className="font-bold">Arrives in 10-30 minutes</span> (Bitcoin network confirmation). Load up for the season — we recommend $10 or more.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lightning Address - visible on Cash App / Strike tabs */}
          {showLightningAddress && (
            <div className="mt-4 pt-3 border-t border-slate-700/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Your Lightning Address</p>
              <button
                onClick={handleCopy}
                className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between ${
                  copied
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                }`}
              >
                <span className={`text-xs font-mono ${copied ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {copied ? 'Copied!' : truncatedAddress}
                </span>
                {copied ? (
                  <Icons.CheckMark size={16} className="text-emerald-400" />
                ) : (
                  <Icons.Copy size={16} className="text-slate-400" />
                )}
              </button>
            </div>
          )}

          {/* Bitcoin Address - visible on Exchange tab */}
          {showBtcAddress && (
            <div className="mt-4 pt-3 border-t border-slate-700/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Your Bitcoin Deposit Address</p>
              {isLoadingAddress ? (
                <div className="w-full p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center space-x-2">
                  <Icons.Zap size={14} className="text-orange-400 animate-bounce" />
                  <span className="text-xs text-slate-400">Generating address...</span>
                </div>
              ) : addressError ? (
                <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                  <p className="text-xs text-red-300">{addressError}</p>
                  <button
                    onClick={() => { setBtcAddress(null); setAddressError(null); }}
                    className="text-xs text-red-400 underline mt-1"
                  >
                    Try again
                  </button>
                </div>
              ) : btcAddress ? (
                <button
                  onClick={handleCopyBtc}
                  className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between ${
                    copiedBtc
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span className={`text-xs font-mono ${copiedBtc ? 'text-orange-400' : 'text-slate-300'}`}>
                    {copiedBtc ? 'Copied!' : truncatedBtc}
                  </span>
                  {copiedBtc ? (
                    <Icons.CheckMark size={16} className="text-orange-400" />
                  ) : (
                    <Icons.Copy size={16} className="text-slate-400" />
                  )}
                </button>
              ) : null}
              {btcFee > 0 && btcAddress && (
                <p className="text-[10px] text-slate-500 mt-1.5 text-center">Swap fee: ~{btcFee.toLocaleString()} sats</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components (internal) ---

/** Color mapping from Tailwind color tokens to bg/text class pairs for Step badges. */
const stepColors: Record<string, { bg: string; text: string }> = {
  '[#00D64F]': { bg: 'bg-[#00D64F]/20', text: 'text-[#00D64F]' },
  'blue-400': { bg: 'bg-blue-400/20', text: 'text-blue-400' },
  'orange-400': { bg: 'bg-orange-400/20', text: 'text-orange-400' },
};

/**
 * Numbered step indicator with a colored badge and descriptive text.
 *
 * @param props.number - Step number displayed in the badge.
 * @param props.color - Tailwind color key for the badge (e.g., `'blue-400'`).
 * @param props.children - Step description content.
 */
const Step: React.FC<{ number: number; color: string; children: React.ReactNode }> = ({ number, color, children }) => {
  const colors = stepColors[color] || { bg: 'bg-slate-700', text: 'text-slate-300' };
  return (
    <div className="flex items-start space-x-3">
      <div className={`w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center shrink-0 mt-0.5`}>
        <span className={`text-xs font-bold ${colors.text}`}>{number}</span>
      </div>
      <p className="text-sm text-slate-300 leading-snug">{children}</p>
    </div>
  );
};

/**
 * Download CTA link for a payment app (Cash App or Strike).
 *
 * @param props.name - Display name of the app.
 * @param props.color - Hex color for the app brand accent.
 * @param props.url - External URL to the app's website.
 * @param props.note - Short note about fees and availability.
 */
const DownloadLink: React.FC<{ name: string; color: string; url: string; note: string }> = ({ name, color, url, note }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="block p-3 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors group bg-slate-800/30"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-white">
          Don't have {name}? <span style={{ color }} className="group-hover:underline">Download it</span>
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">{note}</p>
      </div>
      <Icons.Next size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
    </div>
  </a>
);
