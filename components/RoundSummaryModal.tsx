import React from 'react';
import { Icons } from './Icons';
import { Button } from './Button';
import { Player } from '../types';

interface PayoutInfo {
    playerName: string;
    amount: number;
    isCurrentUser: boolean;
}

interface RoundSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundName: string;
    standings: Player[];
    payouts: PayoutInfo[];
    aceWinners: { name: string; hole: number }[];
    acePotAmount?: number;
    totalPot: number;
    par: number;
    isProcessingPayments?: boolean;
}

// Helper to format score relative to par
const formatScore = (totalStrokes: number, par: number): string => {
    const diff = totalStrokes - par;
    if (diff === 0) return `${totalStrokes} (E)`;
    if (diff > 0) return `${totalStrokes} (+${diff})`;
    return `${totalStrokes} (${diff})`;
};

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
    isOpen,
    onClose,
    roundName,
    standings,
    payouts,
    aceWinners,
    acePotAmount = 0,
    totalPot,
    par,
    isProcessingPayments = false
}) => {
    if (!isOpen) return null;

    const winner = standings[0];
    const hasAces = aceWinners.length > 0;
    
    // Calculate total strokes for each player (sum of all hole scores)
    const getTotalStrokes = (player: Player): number => {
        return Object.values(player.scores).reduce((sum, score) => sum + score, 0);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300">
                
                {/* Header - Celebration */}
                <div className="relative bg-gradient-to-r from-emerald-600/20 via-emerald-500/30 to-emerald-600/20 p-6 text-center border-b border-emerald-500/20">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.15),transparent_70%)]" />
                    
                    <div className="relative">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 mb-3">
                            <Icons.Trophy size={32} className="text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Round Complete!</h2>
                        <p className="text-sm text-slate-400">{roundName || 'Round'}</p>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    
                    {/* Winner Spotlight */}
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Winner</p>
                        <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                            {winner?.photoUrl ? (
                                <img src={winner.photoUrl} alt="" className="w-10 h-10 rounded-full border-2 border-amber-400/50" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-amber-400/50">
                                    <Icons.User size={20} className="text-slate-400" />
                                </div>
                            )}
                            <div className="text-left">
                                <p className="font-bold text-white">{winner?.name || 'Unknown'}</p>
                                <p className="text-sm text-amber-400 font-mono">
                                    {winner ? formatScore(getTotalStrokes(winner), par) : '0'}
                                </p>
                            </div>
                            {winner?.isCurrentUser && (
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-medium">You!</span>
                            )}
                        </div>
                    </div>

                    {/* Standings */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Final Standings</p>
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
                            {standings.slice(0, 5).map((player, idx) => {
                                const strokes = getTotalStrokes(player);
                                const diff = strokes - par;
                                return (
                                    <div key={player.id} className="flex items-center justify-between px-3 py-2">
                                        <div className="flex items-center space-x-3">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                                                idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                                                idx === 2 ? 'bg-orange-700/20 text-orange-400' :
                                                'bg-slate-700/50 text-slate-500'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <span className={`font-medium ${player.isCurrentUser ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                {player.name}
                                                {player.isCurrentUser && <span className="text-xs ml-1 opacity-60">(you)</span>}
                                            </span>
                                        </div>
                                        <span className={`font-mono text-sm ${
                                            diff < 0 ? 'text-emerald-400' : 
                                            diff === 0 ? 'text-slate-400' : 
                                            'text-orange-400'
                                        }`}>
                                            {formatScore(strokes, par)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Payouts */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                            <Icons.Zap size={12} className="inline mr-1 text-amber-400" />
                            {isProcessingPayments ? 'Sending Payouts...' : 'Payouts'}
                        </p>
                        {isProcessingPayments && payouts.length === 0 ? (
                            <div className="flex items-center justify-center bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-3">
                                <div className="animate-pulse flex items-center space-x-2">
                                    <Icons.Zap size={16} className="text-amber-400 animate-bounce" />
                                    <span className="text-sm text-amber-300">Processing payment...</span>
                                </div>
                            </div>
                        ) : payouts.length > 0 ? (
                            <div className="space-y-2">
                                {payouts.map((payout, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                        <span className={`text-sm ${payout.isCurrentUser ? 'text-emerald-400 font-medium' : 'text-slate-300'}`}>
                                            {payout.isCurrentUser ? 'You kept' : `→ ${payout.playerName}`}
                                        </span>
                                        <span className="font-bold text-emerald-400 font-mono">
                                            {payout.amount} sats
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-2 text-slate-500 text-sm">
                                No payouts for this round
                            </div>
                        )}
                    </div>

                    {/* Ace Pot */}
                    {hasAces && acePotAmount > 0 && (
                        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-purple-400 mb-1">🎯 Ace!</p>
                                    {aceWinners.map((ace, idx) => (
                                        <p key={idx} className="text-sm text-white">
                                            <span className="font-medium">{ace.name}</span>
                                            <span className="text-slate-400"> on hole {ace.hole}</span>
                                        </p>
                                    ))}
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-purple-400 font-mono">{acePotAmount}</p>
                                    <p className="text-xs text-slate-500">sats</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No Aces message */}
                    {!hasAces && acePotAmount > 0 && (
                        <div className="text-center py-2">
                            <p className="text-xs text-slate-500">No aces this round • Ace pot rolls over</p>
                        </div>
                    )}

                    {/* Close Button */}
                    <Button fullWidth onClick={onClose} variant="primary" className="mt-2">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
};

