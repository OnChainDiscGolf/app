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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">

                <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold text-white">Play Tab Guide</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <Icons.Close size={24} />
                    </button>
                </div>

                <div className="p-4 space-y-4">

                    {/* Create Round */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                <Icons.Plus className="text-emerald-400" size={20} />
                            </div>
                            <h3 className="font-bold text-white">Create Round</h3>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Start a round as the host. Set your course, number of holes, and invite players. 
                            <span className="text-emerald-400 font-medium"> Entry fees are optional</span> — play just for fun or add sats to make it interesting!
                        </p>
                    </div>

                    {/* Join Round */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                                <Icons.QrCode className="text-amber-400" size={20} />
                            </div>
                            <h3 className="font-bold text-white">Join Round</h3>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Shows <strong>YOUR</strong> QR code. Have a friend scan it to add you to their round instantly. 
                            <span className="text-amber-400 font-medium"> They scan you</span> — not the other way around!
                        </p>
                    </div>

                    {/* Your Wallet */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                                <Icons.Wallet className="text-orange-400" size={20} />
                            </div>
                            <h3 className="font-bold text-white">Your Wallet</h3>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Your sats balance for playing rounds. Tap the balance at the top or visit the Wallet tab to deposit or withdraw via Lightning. Winnings from rounds are sent here automatically.
                        </p>
                    </div>

                    {/* How Sats Work */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                                <Icons.Trophy className="text-cyan-400" size={20} />
                            </div>
                            <h3 className="font-bold text-white">How Sats Work</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-300">
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                                <span><strong className="text-white">Entry Fee</strong> — Each player's sats go into the prize pool, distributed to top finishers</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0" />
                                <span><strong className="text-white">Ace Pool</strong> — Optional side pool. First hole-in-one takes it all!</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2 shrink-0" />
                                <span><strong className="text-white">Instant & Automatic</strong> — Sats distributed when the round ends. No IOUs!</span>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div className="pt-2 border-t border-slate-800">
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
