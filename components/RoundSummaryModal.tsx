import React, { useState } from 'react';
import { Icons } from './Icons';
import { Button } from './Button';
import { Player } from '../types';
import { publishNote } from '../services/nostrService';

interface PayoutInfo {
    playerName: string;
    amount: number;
    isCurrentUser: boolean;
}

interface RoundSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone?: () => void; // Called when Done is clicked, for navigation
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
const formatScore = (totalStrokes: number, par: number): { total: number; diff: string; diffNum: number } => {
    const diff = totalStrokes - par;
    let diffStr = 'E';
    if (diff > 0) diffStr = `+${diff}`;
    else if (diff < 0) diffStr = `${diff}`;
    return { total: totalStrokes, diff: diffStr, diffNum: diff };
};

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
    isOpen,
    onClose,
    onDone,
    roundName,
    standings,
    payouts,
    aceWinners,
    acePotAmount = 0,
    totalPot,
    par,
    isProcessingPayments = false
}) => {
    const [isSharing, setIsSharing] = useState(false);
    const [shared, setShared] = useState(false);

    if (!isOpen) return null;

    const winner = standings[0];
    const hasAces = aceWinners.length > 0;
    const hasPayouts = totalPot > 0;

    // Calculate total strokes for each player (sum of all hole scores)
    const getTotalStrokes = (player: Player): number => {
        return Object.values(player.scores || {}).reduce((sum, score) => sum + score, 0);
    };

    // Get payout for a specific player
    const getPlayerPayout = (playerName: string): number => {
        const payout = payouts.find(p => p.playerName === playerName);
        return payout?.amount || 0;
    };

    // Build and publish a Nostr note with round results
    const handleShareToNostr = async () => {
        setIsSharing(true);
        try {
            const lines: string[] = [];
            lines.push(`Disc golf round complete! ${roundName}`);
            lines.push('');

            // Standings
            standings.forEach((p, idx) => {
                const strokes = getTotalStrokes(p);
                const scoreInfo = formatScore(strokes, par);
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                const payout = getPlayerPayout(p.name);
                const payoutStr = payout > 0 ? ` (+${payout.toLocaleString()} sats)` : '';
                lines.push(`${medal} ${p.name}: ${scoreInfo.diff} (${strokes})${payoutStr}`);
            });

            // Aces
            if (hasAces) {
                lines.push('');
                aceWinners.forEach(ace => {
                    lines.push(`🎯 Ace by ${ace.name} on hole ${ace.hole}!`);
                });
            }

            // Pot info
            if (totalPot > 0) {
                lines.push('');
                lines.push(`💰 Pot: ${totalPot.toLocaleString()} sats`);
            }

            lines.push('');
            lines.push('⛓️ Scored & settled on-chain with #ChainLinks');

            await publishNote(lines.join('\n'));
            setShared(true);
        } catch (e) {
            console.error('Failed to share to Nostr:', e);
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                
                {/* Header - Celebration */}
                <div className="relative bg-gradient-to-r from-emerald-600/20 via-emerald-500/30 to-emerald-600/20 p-5 text-center border-b border-emerald-500/20 shrink-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.15),transparent_70%)]" />
                    
                    <div className="relative">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 mb-2">
                            <Icons.Trophy size={28} className="text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Round Complete!</h2>
                        <p className="text-sm text-slate-400">{roundName || 'Round'}</p>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    
                    {/* Full Roster - All players sorted by score */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Final Standings</p>
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                            {/* Header Row */}
                            <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-slate-800/80 border-b border-slate-700/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                <div className="col-span-1">#</div>
                                <div className="col-span-5">Player</div>
                                <div className="col-span-3 text-right">Score</div>
                                {hasPayouts && <div className="col-span-3 text-right">Payout</div>}
                            </div>
                            
                            {/* Player Rows */}
                            <div className="divide-y divide-slate-700/30">
                                {standings.map((player, idx) => {
                                    const strokes = getTotalStrokes(player);
                                    const scoreInfo = formatScore(strokes, par);
                                    const payout = getPlayerPayout(player.name);
                                    const isWinner = idx === 0;
                                    
                                    return (
                                        <div 
                                            key={player.id} 
                                            className={`grid grid-cols-12 gap-1 px-3 py-2.5 items-center ${
                                                isWinner ? 'bg-amber-500/10' : ''
                                            } ${player.isCurrentUser ? 'bg-emerald-500/5' : ''}`}
                                        >
                                            {/* Rank */}
                                            <div className="col-span-1">
                                                <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold ${
                                                    idx === 0 ? 'bg-amber-500/30 text-amber-400' :
                                                    idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                                                    idx === 2 ? 'bg-orange-700/30 text-orange-400' :
                                                    'bg-slate-700/50 text-slate-500'
                                                }`}>
                                                    {idx + 1}
                                                </span>
                                            </div>
                                            
                                            {/* Player Name */}
                                            <div className="col-span-5 flex items-center space-x-2 min-w-0">
                                                {isWinner && <span className="shrink-0">🏆</span>}
                                                <span className={`font-medium truncate ${
                                                    player.isCurrentUser ? 'text-emerald-400' : 
                                                    isWinner ? 'text-amber-400' : 'text-slate-300'
                                                }`}>
                                                    {player.name}
                                                </span>
                                                {player.isCurrentUser && (
                                                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded shrink-0">YOU</span>
                                                )}
                                            </div>
                                            
                                            {/* Score */}
                                            <div className="col-span-3 text-right">
                                                <div className={`font-mono text-sm font-bold ${
                                                    scoreInfo.diffNum < 0 ? 'text-emerald-400' : 
                                                    scoreInfo.diffNum === 0 ? 'text-slate-300' : 
                                                    'text-orange-400'
                                                }`}>
                                                    {scoreInfo.diff}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    {scoreInfo.total} strokes
                                                </div>
                                            </div>
                                            
                                            {/* Payout */}
                                            {hasPayouts && (
                                                <div className="col-span-3 text-right">
                                                    {payout > 0 ? (
                                                        <span className="font-mono text-sm font-bold text-emerald-400">
                                                            {payout.toLocaleString()} <span className="text-[10px] text-emerald-500">sats</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs">—</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Processing Payments Indicator */}
                    {isProcessingPayments && (
                        <div className="flex items-center justify-center bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-3">
                            <div className="animate-pulse flex items-center space-x-2">
                                <Icons.Zap size={16} className="text-amber-400 animate-bounce" />
                                <span className="text-sm text-amber-300">Processing payments...</span>
                            </div>
                        </div>
                    )}

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
                                    <p className="text-lg font-bold text-purple-400 font-mono">{acePotAmount?.toLocaleString()}</p>
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
                </div>

                {/* Fixed Footer */}
                <div className="p-4 border-t border-slate-700/50 shrink-0 space-y-2">
                    {!isProcessingPayments && (
                        <button
                            onClick={handleShareToNostr}
                            disabled={isSharing || shared}
                            className={`w-full py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center justify-center space-x-2 ${
                                shared
                                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-purple-500/30 hover:text-purple-300'
                            }`}
                        >
                            {shared ? (
                                <>
                                    <Icons.CheckMark size={16} />
                                    <span>Shared to Nostr!</span>
                                </>
                            ) : isSharing ? (
                                <>
                                    <Icons.Zap size={16} className="animate-bounce" />
                                    <span>Sharing...</span>
                                </>
                            ) : (
                                <>
                                    <Icons.Share size={16} />
                                    <span>Share Results to Nostr</span>
                                </>
                            )}
                        </button>
                    )}
                    <Button fullWidth onClick={() => { onClose(); onDone?.(); }} variant="primary">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
};

