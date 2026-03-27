import React, { useState } from 'react';
import { Icons } from './Icons';

interface FundingGuideProps {
  lightningAddress: string;
  amountNeeded?: number; // sats needed for context (e.g. entry fee shortfall)
  onClose: () => void;
}

type FundingTab = 'cashapp' | 'strike' | 'other';

export const FundingGuide: React.FC<FundingGuideProps> = ({ lightningAddress, amountNeeded, onClose }) => {
  const [activeTab, setActiveTab] = useState<FundingTab>('cashapp');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(lightningAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedAddress = lightningAddress.length > 28
    ? lightningAddress.substring(0, 14) + '...' + lightningAddress.substring(lightningAddress.length - 14)
    : lightningAddress;

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
          <button
            onClick={() => setActiveTab('other')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'other'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Other
          </button>
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
                  Confirm the send. Funds arrive instantly!
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
                  That's it. Arrives in seconds.
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

          {/* Other Wallets Guide */}
          {activeTab === 'other' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Any Lightning-compatible wallet works. Here's the general flow:
              </p>

              <div className="space-y-2">
                <Step number={1} color="purple-400">
                  Open your Lightning wallet app
                </Step>
                <Step number={2} color="purple-400">
                  Find <span className="font-bold text-white">Send</span> or <span className="font-bold text-white">Pay</span>
                </Step>
                <Step number={3} color="purple-400">
                  Paste the Lightning Address below (or scan from the Wallet tab)
                </Step>
                <Step number={4} color="purple-400">
                  Enter the amount and confirm
                </Step>
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Popular Lightning wallets</p>
                <div className="grid grid-cols-2 gap-2">
                  <WalletPill name="Phoenix" url="https://phoenix.acinq.co" />
                  <WalletPill name="Muun" url="https://muun.com" />
                  <WalletPill name="Zeus" url="https://zeusln.com" />
                  <WalletPill name="Blink" url="https://blink.sv" />
                </div>
              </div>
            </div>
          )}

          {/* Lightning Address - Always Visible */}
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

// --- Sub-components ---

const stepColors: Record<string, { bg: string; text: string }> = {
  '[#00D64F]': { bg: 'bg-[#00D64F]/20', text: 'text-[#00D64F]' },
  'blue-400': { bg: 'bg-blue-400/20', text: 'text-blue-400' },
  'purple-400': { bg: 'bg-purple-400/20', text: 'text-purple-400' },
};

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

const WalletPill: React.FC<{ name: string; url: string }> = ({ name, url }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-center py-2 px-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 font-medium hover:border-purple-500/30 hover:text-purple-300 transition-colors"
  >
    {name}
  </a>
);
