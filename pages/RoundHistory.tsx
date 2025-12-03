import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { Button } from '../components/Button';
import { Player } from '../types';

// Historical round data structure (stored in localStorage)
export interface HistoricalRound {
  id: string;
  roundName: string;
  courseName: string;
  date: string;
  par: number;
  holeCount: number;
  standings: Player[];
  payouts: { playerName: string; amount: number; isCurrentUser: boolean }[];
  aceWinners: { name: string; hole: number }[];
  acePotAmount: number;
  totalPot: number;
  entryFeeSats: number;
  acePotFeeSats: number;
  finalizedAt: number; // timestamp
}

// Helper to get score-to-par text
const getScoreToParText = (score: number, par: number) => {
  const diff = score - par;
  if (diff === 0) return '(E)';
  return `(${diff > 0 ? '+' : ''}${diff})`;
};

// Helper for score color
const getScoreColor = (diff: number) => {
  if (diff < 0) return 'text-emerald-400';
  if (diff > 0) return 'text-red-400';
  return 'text-slate-300';
};

// Ordinal suffix helper
const getOrdinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Format date nicely
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

export const RoundHistory: React.FC = () => {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<HistoricalRound[]>([]);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  // Load round history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cdg_round_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HistoricalRound[];
        // Sort by date, most recent first
        setRounds(parsed.sort((a, b) => b.finalizedAt - a.finalizedAt));
      } catch (e) {
        console.error('Failed to parse round history:', e);
      }
    }
  }, []);

  const toggleRound = (roundId: string) => {
    setExpandedRound(prev => prev === roundId ? null : roundId);
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <Icons.Prev size={24} />
          </button>
          <h1 className="text-lg font-bold text-white">Round History</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 nav-safe-bottom">
        {rounds.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center mb-4">
              <Icons.Trophy size={36} className="text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Rounds Yet</h2>
            <p className="text-slate-400 text-sm max-w-xs mb-6">
              Complete your first round to see your history here.
            </p>
            <Button onClick={() => navigate('/')}>
              <div className="flex items-center space-x-2">
                <Icons.Plus size={18} />
                <span>Create Round</span>
              </div>
            </Button>
          </div>
        ) : (
          /* Round List */
          <div className="space-y-3">
            {rounds.map((round) => {
              const isExpanded = expandedRound === round.id;
              const winner = round.standings[0];
              const winnerDiff = winner ? winner.totalScore - round.par : 0;
              
              return (
                <div
                  key={round.id}
                  className={`bg-slate-800/60 border rounded-xl overflow-hidden transition-all duration-200 ${
                    isExpanded ? 'border-amber-500/50' : 'border-slate-700/50'
                  }`}
                >
                  {/* Compact Header - Always Visible */}
                  <button
                    onClick={() => toggleRound(round.id)}
                    className="w-full text-left p-4 hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs text-slate-500 font-medium">
                            {formatDate(round.date)}
                          </span>
                          {round.totalPot > 0 && (
                            <span className="text-xs text-emerald-400 font-bold flex items-center">
                              <Icons.Zap size={10} className="mr-0.5" />
                              {round.totalPot}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-white truncate">
                          {round.courseName || round.roundName}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1 text-sm">
                          <span className="text-amber-400 font-medium">
                            🏆 {winner?.name || 'No winner'}
                          </span>
                          {winner && (
                            <span className={`${getScoreColor(winnerDiff)} font-mono text-xs`}>
                              {winner.totalScore} {getScoreToParText(winner.totalScore, round.par)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className="text-xs text-slate-500">
                            {round.standings.length} {round.standings.length === 1 ? 'player' : 'players'}
                          </span>
                        </div>
                        <Icons.Next
                          size={18}
                          className={`text-slate-500 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/50 animate-in slide-in-from-top-2 duration-200">
                      {/* Round Info */}
                      <div className="px-4 py-3 bg-slate-900/40 grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Holes</p>
                          <p className="text-sm font-bold text-white">{round.holeCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Par</p>
                          <p className="text-sm font-bold text-white">{round.par}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Entry</p>
                          <p className="text-sm font-bold text-emerald-400">
                            {round.entryFeeSats > 0 ? `${round.entryFeeSats.toLocaleString()} sats` : 'Free'}
                          </p>
                        </div>
                      </div>

                      {/* Full Standings */}
                      <div className="px-4 py-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Final Standings
                        </h4>
                        <div className="space-y-2">
                          {round.standings.map((player, index) => {
                            const diff = player.totalScore - round.par;
                            const payout = round.payouts.find(p => p.playerName === player.name);
                            
                            return (
                              <div
                                key={player.id}
                                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                                  index === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-800/30'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <span className={`w-6 text-center font-bold ${
                                    index === 0 ? 'text-amber-400' : 
                                    index === 1 ? 'text-slate-300' :
                                    index === 2 ? 'text-amber-600' : 'text-slate-500'
                                  }`}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : getOrdinal(index + 1)}
                                  </span>
                                  <span className={`font-medium ${index === 0 ? 'text-white' : 'text-slate-300'}`}>
                                    {player.name}
                                    {player.isCurrentUser && (
                                      <span className="ml-1 text-xs text-amber-400">(You)</span>
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <span className={`font-mono font-bold ${getScoreColor(diff)}`}>
                                    {player.totalScore}
                                    <span className="text-xs ml-1 opacity-75">
                                      {getScoreToParText(player.totalScore, round.par)}
                                    </span>
                                  </span>
                                  {payout && payout.amount > 0 && (
                                    <span className="text-xs text-emerald-400 font-bold flex items-center bg-emerald-500/10 px-2 py-0.5 rounded">
                                      <Icons.Zap size={10} className="mr-0.5" />
                                      +{payout.amount}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ace Winners */}
                      {round.aceWinners.length > 0 && (
                        <div className="px-4 py-3 border-t border-slate-700/50">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            🎯 Ace Pot Winners
                          </h4>
                          <div className="space-y-1">
                            {round.aceWinners.map((ace, index) => (
                              <div key={index} className="flex items-center justify-between py-2 px-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                <span className="text-white font-medium">{ace.name}</span>
                                <span className="text-xs text-slate-400">Hole {ace.hole}</span>
                              </div>
                            ))}
                            {round.acePotAmount > 0 && (
                              <p className="text-xs text-purple-400 text-center mt-2">
                                Ace Pot: {round.acePotAmount} sats
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Payouts Summary */}
                      {round.payouts.length > 0 && round.payouts.some(p => p.amount > 0) && (
                        <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-900/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Total Pot
                            </span>
                            <span className="text-emerald-400 font-bold flex items-center">
                              <Icons.Zap size={14} className="mr-1" />
                              {round.totalPot} sats
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Spacer for Nav */}
      <div className="h-20" />
    </div>
  );
};

