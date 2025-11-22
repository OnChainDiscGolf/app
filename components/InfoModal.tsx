import React from 'react';
import { Icons } from './Icons';
import { Button } from './Button';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const topics = [
        {
            title: 'Disc Golf',
            icon: <Icons.Trophy className="text-brand-primary" size={24} />,
            description: 'A flying disc sport in which players throw a disc at a target; it is played using rules similar to golf.',
            link: 'https://www.pdga.com/introduction',
            linkText: 'Learn at PDGA'
        },
        {
            title: 'Bitcoin',
            icon: <Icons.Zap className="text-orange-500" size={24} />,
            description: 'A decentralized digital currency without a central bank or single administrator.',
            link: 'https://bitcoin.org/en/how-it-works',
            linkText: 'Learn about Bitcoin'
        },
        {
            title: 'E-cash (Cashu)',
            icon: <Icons.Wallet className="text-green-400" size={24} />,
            description: 'A privacy-preserving Chaumian ecash protocol for Bitcoin Lightning.',
            link: 'https://cashu.space/',
            linkText: 'Learn about Cashu'
        },
        {
            title: 'Nostr',
            icon: <Icons.Users className="text-purple-400" size={24} />,
            description: 'A decentralized network protocol for a censorship-resistant social media.',
            link: 'https://nostr.com/',
            linkText: 'Learn about Nostr'
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">

                <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold text-white">What is this app?</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <Icons.Close size={24} />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    <p className="text-slate-300 text-sm leading-relaxed">
                        On-Chains combines the sport of Disc Golf with the freedom of decentralized tech. Here's what powers it:
                    </p>

                    <div className="space-y-4">
                        {topics.map((topic) => (
                            <div key={topic.title} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-colors">
                                <div className="flex items-center space-x-3 mb-2">
                                    {topic.icon}
                                    <h3 className="font-bold text-white">{topic.title}</h3>
                                </div>
                                <p className="text-slate-400 text-sm mb-3">{topic.description}</p>
                                <a
                                    href={topic.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs font-bold text-brand-primary hover:text-emerald-300 hover:underline"
                                >
                                    {topic.linkText}
                                    <Icons.Send size={12} className="ml-1" />
                                </a>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4">
                        <Button fullWidth onClick={onClose} variant="secondary">
                            Got it
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
