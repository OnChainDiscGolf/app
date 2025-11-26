import React from 'react';
import { Icons } from './Icons';
import { Button } from './Button';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const resources = [
        { title: 'Disc Golf (PDGA)', link: 'https://www.pdga.com/introduction' },
        { title: 'Bitcoin', link: 'https://bitcoin.org/en/how-it-works' },
        { title: 'Cashu (E-cash)', link: 'https://cashu.space/' },
        { title: 'Nostr', link: 'https://nostr.com/' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">

                <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold text-white">How it Works</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <Icons.Close size={24} />
                    </button>
                </div>

                <div className="p-4 space-y-8">

                    {/* Step 1: Profile */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3 text-brand-primary">
                            <Icons.Users size={24} />
                            <h3 className="font-bold text-lg text-white">1. Create Your Profile</h3>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Start by going to the <strong>Profile</strong> tab. You can create a new Nostr identity or login if you already have one.
                        </p>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-3">
                            <Icons.Shield className="text-red-500 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <p className="text-red-200 font-bold text-xs uppercase tracking-wide">Crucial Warning</p>
                                <p className="text-red-100 text-xs leading-relaxed">
                                    You MUST save your <strong>nsec</strong> (private key) securely. It is the <strong>ONLY</strong> way to recover your profile and funds. If you lose it, your account is gone forever.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Funds */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3 text-green-400">
                            <Icons.Wallet size={24} />
                            <h3 className="font-bold text-lg text-white">2. Fund Your Wallet</h3>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            This app uses <strong>Bitcoin Lightning</strong> and <strong>Cashu</strong> for instant payments. You'll need to deposit funds to play for money.
                        </p>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-2">We like:</p>
                            <div className="flex flex-wrap gap-2">
                                <a
                                    href="https://strike.me"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/30 rounded-lg text-sm font-bold text-brand-primary hover:bg-brand-primary/20 transition-colors"
                                >
                                    Strike <Icons.Send size={12} className="ml-1" />
                                </a>
                                <a
                                    href="https://cash.app"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/30 rounded-lg text-sm font-bold text-brand-primary hover:bg-brand-primary/20 transition-colors"
                                >
                                    Cash App <Icons.Send size={12} className="ml-1" />
                                </a>
                                <a
                                    href="https://www.walletofsatoshi.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/30 rounded-lg text-sm font-bold text-brand-primary hover:bg-brand-primary/20 transition-colors"
                                >
                                    WoS <Icons.Send size={12} className="ml-1" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Gameplay */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3 text-brand-accent">
                            <Icons.Trophy size={24} />
                            <h3 className="font-bold text-lg text-white">3. Play & Win</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-300">
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2" />
                                <span><strong>Entry Fee:</strong> Every player pays into the pot when the round starts.</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2" />
                                <span><strong>Ace Pot:</strong> An optional side-bet. If anyone hits a Hole-in-One (Ace), they take this pot!</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2" />
                                <span><strong>Payouts:</strong> Once scores are finalized, the smart contract automatically distributes funds to the winners.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div className="pt-4 border-t border-slate-800">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Learn More</p>
                        <div className="grid grid-cols-2 gap-2">
                            {resources.map(r => (
                                <a
                                    key={r.title}
                                    href={r.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-slate-400 hover:text-brand-primary transition-colors flex items-center space-x-1"
                                >
                                    <span>{r.title}</span>
                                    <Icons.Send size={10} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button fullWidth onClick={onClose} variant="secondary">
                            Got it
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
