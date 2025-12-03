
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { DEFAULT_PAR, DEFAULT_HOLE_COUNT } from '../constants';
import { useNavigate } from 'react-router-dom';

export const Scorecard: React.FC = () => {
    const { activeRound, players, updateScore, publishCurrentScores, finalizeRound, isAuthenticated, userProfile, currentUserPubkey } = useApp();
    const navigate = useNavigate();

    const isHost = activeRound?.pubkey === currentUserPubkey;

    // Initialize view hole to startingHole if available, else 1
    const [viewHole, setViewHole] = useState(activeRound?.startingHole || 1);
    const [showHalfwayReview, setShowHalfwayReview] = useState(false);
    const [showFinalReview, setShowFinalReview] = useState(false);
    const [showConfirmFinalize, setShowConfirmFinalize] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [aceAnimation, setAceAnimation] = useState<string | null>(null); // Track which player just got an ace

    // Calculate pots based on granular payment selections
    const entryPayers = players.filter(p => p.paysEntry);
    const acePayers = players.filter(p => p.paysAce);
    const entryPot = activeRound ? entryPayers.length * activeRound.entryFeeSats : 0;
    const acePot = activeRound ? acePayers.length * activeRound.acePotFeeSats : 0;
    const totalPot = entryPot + acePot;

    // Check if current user is in an active round as a non-host player
    const currentPlayer = players.find(p => p.isCurrentUser);
    const isNonHostInRound = activeRound && !activeRound.isFinalized && !isHost && currentPlayer;

    // Handle "View Current Round" button click
    const handleViewCurrentRound = () => {
        if (!currentPlayer) return;

        // If player hasn't paid, navigate to round details for payment
        if (!currentPlayer.paid) {
            navigate('/round-details');
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (!activeRound) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-brand-dark text-white p-6 relative overflow-hidden">
                {/* Background Ambient Effects */}
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-transparent to-slate-900 pointer-events-none"></div>
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="w-full max-w-sm mx-auto relative z-10 space-y-8">

                    {/* Hero Status */}
                    <div className="text-center space-y-2 animate-in slide-in-from-top-8 duration-700 fade-in">
                        <div className="inline-flex items-center justify-center p-4 bg-emerald-500/20 rounded-full mb-4 ring-2 ring-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                            <Icons.CheckMark className="text-emerald-400 w-10 h-10" strokeWidth={3} />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-white">
                            You're In
                        </h1>
                        <p className="text-slate-400 font-medium">Ready to dominate the course</p>
                    </div>

                    {/* Player Card */}
                    <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-500 delay-150 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>

                        <div className="flex flex-col items-center space-y-4 relative z-10">
                            {/* Avatar */}
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-pulse"></div>
                                <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-emerald-500/50 shadow-xl overflow-hidden relative">
                                    {userProfile.picture ? (
                                        <img src={userProfile.picture} className="w-full h-full object-cover" />
                                    ) : (
                                        <Icons.Users className="w-full h-full p-5 text-slate-400" />
                                    )}
                                </div>
                            </div>

                            {/* Identity */}
                            <div className="text-center w-full">
                                <h2 className="text-2xl font-bold text-white truncate">{userProfile.name}</h2>
                                {userProfile.lud16 && (
                                    <div className="flex items-center justify-center space-x-1 mt-1">
                                        <Icons.Zap size={12} className="text-emerald-400" />
                                        <p className="text-xs font-mono text-emerald-400/80 truncate max-w-[200px]">
                                            {userProfile.lud16}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Status */}
                    <div className="text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                        {isNonHostInRound && (
                            <button
                                onClick={handleViewCurrentRound}
                                className="w-full py-3 px-6 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2"
                            >
                                <Icons.Play size={18} />
                                <span>View Current Round</span>
                            </button>
                        )}
                        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800/80 rounded-full border border-slate-700/50">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-slate-300">Waiting for host to start...</span>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    const handleScoreChange = (playerId: string, delta: number, currentVal?: number) => {
        let newScore;
        if (currentVal === undefined || currentVal === 0) {
            if (delta > 0) {
                newScore = DEFAULT_PAR;
            } else {
                newScore = DEFAULT_PAR + delta;
            }
        } else {
            newScore = Math.max(1, currentVal + delta);
        }

        // Trigger ace animation if score is 1
        if (newScore === 1) {
            setAceAnimation(playerId);
            setTimeout(() => setAceAnimation(null), 2000);
        }

        updateScore(viewHole, newScore, playerId);
    };

    const handleFinish = () => {
        setShowConfirmFinalize(true);
    };

    const confirmFinalize = async () => {
        setIsSubmitting(true);
        try {
            await publishCurrentScores();
            await finalizeRound();
        } catch (e) {
            console.error("Failed to finalize round:", e);
        } finally {
            setIsSubmitting(false);
            setShowConfirmFinalize(false);
        }
    };

    // Check if all players have scores for a specific hole
    const isHoleComplete = (h: number) => {
        if (players.length === 0) return false;
        return players.every(p => p.scores[h] && p.scores[h] > 0);
    };

    // Navigate to a specific hole from review
    const navigateToHole = (hole: number) => {
        setShowHalfwayReview(false);
        setShowFinalReview(false);
        setViewHole(hole);
    };

    // === CUSTOM STARTING HOLE HELPERS ===
    
    // Calculate how many holes have been played based on current position
    const getHolesPlayedCount = (currentHole: number, startingHole: number, totalHoles: number): number => {
        if (currentHole >= startingHole) {
            return currentHole - startingHole + 1;
        } else {
            // Wrapped around: holes from startingHole to totalHoles, plus holes from 1 to currentHole
            return (totalHoles - startingHole + 1) + currentHole;
        }
    };

    // Calculate the next hole with wrap-around
    const getNextHole = (currentHole: number, totalHoles: number): number => {
        return currentHole >= totalHoles ? 1 : currentHole + 1;
    };

    // Calculate the previous hole with wrap-around
    const getPrevHole = (currentHole: number, totalHoles: number): number => {
        return currentHole <= 1 ? totalHoles : currentHole - 1;
    };

    // Calculate the final hole (the one before startingHole, wrapping if needed)
    const getFinalHole = (startingHole: number, totalHoles: number): number => {
        return startingHole === 1 ? totalHoles : startingHole - 1;
    };

    // Get all holes in play order (starting from startingHole, wrapping around)
    const getHolesInPlayOrder = (startingHole: number, totalHoles: number): number[] => {
        const holes: number[] = [];
        let hole = startingHole;
        for (let i = 0; i < totalHoles; i++) {
            holes.push(hole);
            hole = getNextHole(hole, totalHoles);
        }
        return holes;
    };

    const handleNext = () => {
        const startingHole = activeRound.startingHole || 1;
        const totalHoles = activeRound.holeCount;
        const finalHole = getFinalHole(startingHole, totalHoles);
        const holesPlayed = getHolesPlayedCount(viewHole, startingHole, totalHoles);
        
        // Check if current hole is incomplete
        if (!isHoleComplete(viewHole)) {
            setToast(`Hole ${viewHole} incomplete`);
            setTimeout(() => setToast(null), 2500);
        }
        
        // Halfway review: show after half the holes are played
        const halfwayPoint = Math.floor(totalHoles / 2);
        if (holesPlayed === halfwayPoint && totalHoles >= 10 && !showHalfwayReview) {
            setShowHalfwayReview(true);
            return;
        }
        
        if (showHalfwayReview) {
            setShowHalfwayReview(false);
            setViewHole(getNextHole(viewHole, totalHoles));
            return;
        }
        
        // Final review: show when we've completed the final hole (one before starting)
        if (viewHole === finalHole && !showFinalReview) {
            setShowFinalReview(true);
            return;
        }
        
        // Normal progression with wrap-around
        if (holesPlayed < totalHoles) {
            publishCurrentScores();
            setViewHole(getNextHole(viewHole, totalHoles));
        }
    };

    const handlePrev = () => {
        const startingHole = activeRound.startingHole || 1;
        const totalHoles = activeRound.holeCount;
        
        if (showFinalReview) {
            setShowFinalReview(false);
            return;
        }
        
        if (showHalfwayReview) {
            setShowHalfwayReview(false);
            return;
        }
        
        // On the first hole, navigate back to the round setup/payments page
        if (viewHole === startingHole) {
            // Navigate back to Home with the customize view to see payments
            navigate('/');
            return;
        }
        
        setViewHole(getPrevHole(viewHole, totalHoles));
    };

    // Helper to calculate score info
    const getPlayerTotalText = (playerScores: Record<number, number>, handicap: number = 0, rangeMax?: number) => {
        const scoresToCount = rangeMax
            ? Object.entries(playerScores).filter(([h]) => parseInt(h) <= rangeMax).map(([, s]) => s)
            : Object.values(playerScores);

        const holesPlayed = scoresToCount.length;
        if (holesPlayed === 0) {
            if (handicap === 0) return { diff: "E", total: 0 };
            return { diff: handicap > 0 ? `+${handicap}` : `${handicap}`, total: 0 };
        }

        const totalStrokes = scoresToCount.reduce((a, b) => a + b, 0);
        const parSoFar = holesPlayed * DEFAULT_PAR;
        const diff = (totalStrokes - parSoFar) + handicap;

        let diffText = "E";
        if (diff > 0) diffText = `+${diff}`;
        if (diff < 0) diffText = `${diff}`;

        return { diff: diffText, total: totalStrokes };
    };

    // Get score color based on relation to par
    const getScoreColor = (score: number) => {
        if (score === 1) return 'text-amber-300'; // Ace!
        const diff = score - DEFAULT_PAR;
        if (diff < 0) return 'text-emerald-400';
        if (diff > 0) return 'text-rose-400';
        return 'text-white';
    };

    const getScoreBg = (score: number, isAceAnimating: boolean = false) => {
        if (score === 1) {
            // ACE! Electrified golden glow
            return isAceAnimating 
                ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 border-amber-300 ring-4 ring-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.8),0_0_60px_rgba(251,191,36,0.4)] animate-pulse'
                : 'bg-gradient-to-br from-amber-500/30 to-yellow-500/20 border-amber-400/70 ring-2 ring-amber-400/30 shadow-[0_0_20px_rgba(251,191,36,0.5)]';
        }
        const diff = score - DEFAULT_PAR;
        if (diff <= -2) return 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30';
        if (diff === -1) return 'bg-emerald-500/10 border-emerald-500/30';
        if (diff === 0) return 'bg-slate-700/50 border-slate-600';
        if (diff === 1) return 'bg-rose-500/10 border-rose-500/30';
        return 'bg-rose-500/20 border-rose-500/50';
    };

    // Check if all players have scores for a list of holes
    const areScoresCompleteForHoles = (holes: number[]) => {
        for (const p of players) {
            for (const h of holes) {
                if (!p.scores[h]) return false;
            }
        }
        return true;
    };

    // Sort players by total score for leaderboard
    const sortedPlayers = [...players].sort((a, b) => {
        const aTotal = getPlayerTotalText(a.scores, a.handicap);
        const bTotal = getPlayerTotalText(b.scores, b.handicap);
        return aTotal.total - bTotal.total;
    });

    // --- REVIEW UI (Shared for Halfway and Final) ---
    if (showHalfwayReview || showFinalReview) {
        const startingHole = activeRound.startingHole || 1;
        const totalHoles = activeRound.holeCount;
        const allHolesInOrder = getHolesInPlayOrder(startingHole, totalHoles);
        
        // For halfway review, show first half of holes in play order
        // For final review, show all holes in play order
        const halfwayCount = Math.floor(totalHoles / 2);
        const reviewHoles = showHalfwayReview 
            ? allHolesInOrder.slice(0, halfwayCount)
            : allHolesInOrder;

        const isComplete = areScoresCompleteForHoles(reviewHoles);
        
        // Split into rows of 9 holes each for display
        const holesPerRow = 9;
        const firstHalf = reviewHoles.slice(0, holesPerRow);
        const secondHalf = reviewHoles.slice(holesPerRow, holesPerRow * 2);
        const thirdRow = reviewHoles.slice(holesPerRow * 2);

        const reviewSortedPlayers = [...players].sort((a, b) => {
            const aTotal = getPlayerTotalText(a.scores, a.handicap, rangeEnd);
            const bTotal = getPlayerTotalText(b.scores, b.handicap, rangeEnd);
            return aTotal.total - bTotal.total;
        });

        // Check if a specific hole has any missing scores
        const isHoleMissingScore = (h: number) => {
            return players.some(p => !p.scores[h] || p.scores[h] === 0);
        };

        return (
            <div className="flex flex-col h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1),transparent_50%)] pointer-events-none"></div>
                
                {/* Header */}
                <div className="relative z-10 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 px-4 py-4">
                    <div className="max-w-md mx-auto">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                                    {showHalfwayReview ? 'Halfway Review' : 'Final Review'}
                                </p>
                                <h1 className="text-xl font-bold text-white">
                                    {activeRound.courseName}
                                </h1>
                            </div>
                            <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${isComplete ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                {isComplete ? '✓ Complete' : 'Incomplete'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Clickable Hole Navigator for Review */}
                <div className="relative z-10 bg-slate-800/50 border-b border-slate-700/50 px-4 py-3">
                    <div className="max-w-md mx-auto">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2 text-center">Tap hole to edit</p>
                        <div className="flex justify-center gap-1 flex-wrap">
                            {reviewHoles.map(h => {
                                const isMissing = isHoleMissingScore(h);
                                return (
                                    <button
                                        key={h}
                                        onClick={() => navigateToHole(h)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                            isMissing 
                                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse hover:bg-rose-500/30' 
                                                : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50 hover:text-white'
                                        }`}
                                    >
                                        {h}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Player List */}
                <div className={`flex-1 overflow-y-auto px-4 py-4 ${showFinalReview ? 'pb-48' : 'pb-40'}`}>
                    <div className="max-w-md mx-auto space-y-4">
                        {reviewSortedPlayers.map((p, idx) => {
                            // Calculate total only for the holes being reviewed
                            const reviewScores: Record<number, number> = {};
                            reviewHoles.forEach(h => {
                                if (p.scores[h]) reviewScores[h] = p.scores[h];
                            });
                            const totalInfo = getPlayerTotalText(reviewScores, p.handicap);
                            const isLeader = idx === 0;
                            
                            return (
                                <div 
                                    key={p.id} 
                                    className={`bg-slate-800/60 backdrop-blur border rounded-2xl overflow-hidden transition-all ${isLeader ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-slate-700/50'}`}
                                >
                                    {/* Player Header */}
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="relative">
                                                {isLeader && (
                                                    <div className="absolute -top-1 -left-1 text-lg">🏆</div>
                                                )}
                                                <div className={`w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 ${isLeader ? 'border-amber-500/50' : 'border-slate-600'}`}>
                                                    {p.photoUrl ? (
                                                        <img src={p.photoUrl} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Icons.Users className="w-full h-full p-2 text-slate-400" />
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-bold text-white flex items-center">
                                                    {p.name}
                                                    {p.isCurrentUser && (
                                                        <span className="ml-2 text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">YOU</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {idx === 0 ? 'Leader' : `${idx + 1}${idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Place`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-2xl font-bold ${parseInt(totalInfo.diff) < 0 ? 'text-emerald-400' : parseInt(totalInfo.diff) > 0 ? 'text-rose-400' : 'text-white'}`}>
                                                {totalInfo.diff}
                                            </div>
                                            <div className="text-xs text-slate-400">{totalInfo.total} strokes</div>
                                        </div>
                                    </div>

                                    {/* Score Grid - Clickable (in play order) */}
                                    <div className="px-4 pb-4 space-y-3">
                                        {/* First Half of Reviewed Holes */}
                                        {firstHalf.length > 0 && (
                                            <div className="bg-slate-900/50 rounded-xl p-3">
                                                <div className="grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${firstHalf.length}, 1fr)` }}>
                                                    {firstHalf.map(h => {
                                                        const isMissing = !p.scores[h] || p.scores[h] === 0;
                                                        return (
                                                            <button
                                                                key={`h-${h}`}
                                                                onClick={() => navigateToHole(h)}
                                                                className={`text-[10px] font-bold rounded transition-colors ${isMissing ? 'text-rose-400 hover:bg-rose-500/20' : 'text-slate-500 hover:bg-slate-700/50'}`}
                                                            >
                                                                {h}
                                                            </button>
                                                        );
                                                    })}
                                                    {firstHalf.map(h => {
                                                        const score = p.scores[h];
                                                        const isAce = score === 1;
                                                        return (
                                                            <button
                                                                key={`s-${h}`}
                                                                onClick={() => navigateToHole(h)}
                                                                className={`text-sm font-bold rounded-md py-1 transition-all hover:scale-110 ${
                                                                    isAce 
                                                                        ? 'text-amber-300 bg-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                                                                        : score ? getScoreColor(score) : 'text-slate-600'
                                                                }`}
                                                            >
                                                                {score || '-'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Second Row of Holes (holes 10-18) */}
                                        {secondHalf.length > 0 && (
                                            <div className="bg-slate-900/50 rounded-xl p-3">
                                                <div className="grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${secondHalf.length}, 1fr)` }}>
                                                    {secondHalf.map(h => {
                                                        const isMissing = !p.scores[h] || p.scores[h] === 0;
                                                        return (
                                                            <button
                                                                key={`h-${h}`}
                                                                onClick={() => navigateToHole(h)}
                                                                className={`text-[10px] font-bold rounded transition-colors ${isMissing ? 'text-rose-400 hover:bg-rose-500/20' : 'text-slate-500 hover:bg-slate-700/50'}`}
                                                            >
                                                                {h}
                                                            </button>
                                                        );
                                                    })}
                                                    {secondHalf.map(h => {
                                                        const score = p.scores[h];
                                                        const isAce = score === 1;
                                                        return (
                                                            <button
                                                                key={`s-${h}`}
                                                                onClick={() => navigateToHole(h)}
                                                                className={`text-sm font-bold rounded-md py-1 transition-all hover:scale-110 ${
                                                                    isAce 
                                                                        ? 'text-amber-300 bg-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                                                                        : score ? getScoreColor(score) : 'text-slate-600'
                                                                }`}
                                                            >
                                                                {score || '-'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Third Row of Holes (holes 19+) */}
                                        {thirdRow.length > 0 && (
                                            <div className="bg-slate-900/50 rounded-xl p-3">
                                                <div className="grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${thirdRow.length}, 1fr)` }}>
                                                    {thirdRow.map(h => {
                                                        const isMissing = !p.scores[h] || p.scores[h] === 0;
                                                        return (
                                                            <button
                                                                key={`h-${h}`}
                                                                onClick={() => navigateToHole(h)}
                                                                className={`text-[10px] font-bold rounded transition-colors ${isMissing ? 'text-rose-400 hover:bg-rose-500/20' : 'text-slate-500 hover:bg-slate-700/50'}`}
                                                            >
                                                                {h}
                                                            </button>
                                                        );
                                                    })}
                                                    {thirdRow.map(h => {
                                                        const score = p.scores[h];
                                                        const isAce = score === 1;
                                                        return (
                                                            <button
                                                                key={`s-${h}`}
                                                                onClick={() => navigateToHole(h)}
                                                                className={`text-sm font-bold rounded-md py-1 transition-all hover:scale-110 ${
                                                                    isAce 
                                                                        ? 'text-amber-300 bg-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                                                                        : score ? getScoreColor(score) : 'text-slate-600'
                                                                }`}
                                                            >
                                                                {score || '-'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="fixed bottom-20 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 p-4 z-20">
                    <div className="max-w-md mx-auto">
                        {showHalfwayReview ? (
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={handlePrev}
                                    className="flex items-center space-x-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    <Icons.Prev size={18} />
                                    <span className="text-sm font-medium">Hole 9</span>
                                </button>

                                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                                    <span className="text-emerald-400 font-bold text-sm">Front 9 Complete</span>
                                </div>

                                <button
                                    onClick={handleNext}
                                    className="flex items-center space-x-2 px-4 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors"
                                >
                                    <span className="text-sm">Hole 10</span>
                                    <Icons.Next size={18} />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {isHost ? (
                                    <button
                                        onClick={handleFinish}
                                        disabled={!isComplete}
                                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all ${!isComplete 
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                                            : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30'}`}
                                    >
                                        <Icons.Trophy size={20} />
                                        <span>{totalPot > 0 ? 'Confirm Scores & Send Payouts' : 'Confirm Scores'}</span>
                                    </button>
                                ) : (
                                    <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                        <div className="flex items-center justify-center space-x-2">
                                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                                            <p className="text-slate-300 text-sm font-medium">Waiting for host to finalize...</p>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={handlePrev}
                                    className="w-full text-slate-400 text-sm font-medium hover:text-white py-2 transition-colors"
                                >
                                    ← Back to Scoring
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="h-16"></div>

                {/* Confirm Finalize Modal - Must be inside Final Review section */}
                {showConfirmFinalize && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                            
                            {/* Header */}
                            <div className="relative bg-gradient-to-r from-amber-600/20 via-amber-500/30 to-amber-600/20 p-5 text-center border-b border-amber-500/20">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.15),transparent_70%)]" />
                                <div className="relative">
                                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400/50 mb-3">
                                        <Icons.Trophy size={28} className="text-amber-400" />
                                    </div>
                                    <h2 className="text-lg font-bold text-white">Finalize Round?</h2>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 space-y-4">
                                <p className="text-slate-300 text-sm text-center leading-relaxed">
                                    {totalPot > 0 
                                        ? 'This will lock all scores and automatically send payouts to winners.'
                                        : 'This will lock all scores and complete the round.'}
                                </p>

                                {/* Quick Summary */}
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Players</span>
                                        <span className="text-white font-medium">{players.length}</span>
                                    </div>
                                    {totalPot > 0 && (
                                        <>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Entry Pot</span>
                                                <span className="text-emerald-400 font-bold">{entryPot.toLocaleString()} sats</span>
                                            </div>
                                            {acePot > 0 && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">Ace Pot</span>
                                                    <span className="text-amber-400 font-bold">{acePot.toLocaleString()} sats</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <div className="flex justify-between text-sm border-t border-slate-700/50 pt-2 mt-2">
                                        <span className="text-slate-400">Leader</span>
                                        <span className="text-amber-400 font-medium">
                                            {reviewSortedPlayers[0]?.name || '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Warning */}
                                <div className="flex items-start space-x-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                    <Icons.Zap size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-200/80">
                                        Scores cannot be changed after finalizing. Make sure everyone's scores are correct!
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex space-x-3 pt-2">
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        onClick={() => setShowConfirmFinalize(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        fullWidth
                                        onClick={confirmFinalize}
                                        disabled={isSubmitting}
                                        className={isSubmitting ? 'animate-pulse' : ''}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center space-x-2">
                                                <Icons.Zap size={16} className="animate-bounce" />
                                                <span>Sending...</span>
                                            </span>
                                        ) : (
                                            totalPot > 0 ? 'Finalize & Pay' : 'Finalize'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- NORMAL SCORING UI ---

    // Honor system: sort players by previous hole performance
    // Best score on previous hole goes first, ties maintain current order
    const getHonorSortedPlayers = () => {
        const startingHole = activeRound?.startingHole || 1;
        
        // Don't sort if honor system disabled or on the first hole of the round
        if (!activeRound?.useHonorSystem || viewHole === startingHole) {
            return players;
        }
        
        const prevHole = getPrevHole(viewHole, activeRound.holeCount);
        const holesInOrder = getHolesInPlayOrder(startingHole, activeRound.holeCount);
        const currentHoleIndex = holesInOrder.indexOf(viewHole);
        const holesPlayedSoFar = holesInOrder.slice(0, currentHoleIndex);
        
        return [...players].sort((a, b) => {
            const aScore = a.scores[prevHole] || Infinity;
            const bScore = b.scores[prevHole] || Infinity;
            
            // Lower score = better = goes first
            if (aScore !== bScore) {
                return aScore - bScore;
            }
            
            // If tied, check cumulative score for holes played so far
            const aTotalToPrev = holesPlayedSoFar.reduce((sum, h) => sum + (a.scores[h] || 0), 0);
            const bTotalToPrev = holesPlayedSoFar.reduce((sum, h) => sum + (b.scores[h] || 0), 0);
            
            return aTotalToPrev - bTotalToPrev;
        });
    };

    const displayPlayers = getHonorSortedPlayers();

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none"></div>
            
            {/* Toast Notification */}
            {toast && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-rose-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg font-bold text-sm flex items-center space-x-2 border border-rose-400/50">
                        <Icons.Close size={16} />
                        <span>{toast}</span>
                    </div>
                </div>
            )}

            {/* Compact Header */}
            <div className="relative z-10 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 px-4 py-2.5">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    {/* Left: Hole Counter - shows actual hole number and progress */}
                    <div className="flex flex-col">
                        <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-black text-white">Hole {viewHole}</span>
                        </div>
                        <span className="text-slate-500 text-xs font-medium">
                            {getHolesPlayedCount(viewHole, activeRound.startingHole || 1, activeRound.holeCount)} of {activeRound.holeCount}
                        </span>
                    </div>
                    
                    {/* Center: Pots - Matching Payment Screen Style */}
                    {(entryPot > 0 || acePot > 0) && (
                        <div className="flex items-center space-x-1.5">
                            {(() => {
                                // Calculate min-width based on entry pot digits (usually larger)
                                const maxDigits = Math.max(
                                    entryPot.toLocaleString().length,
                                    acePot.toLocaleString().length
                                );
                                const minWidth = maxDigits <= 2 ? 'min-w-[40px]' : 
                                                 maxDigits <= 4 ? 'min-w-[48px]' : 
                                                 maxDigits <= 6 ? 'min-w-[56px]' : 'min-w-[64px]';
                                
                                return (
                                    <>
                                        {entryPot > 0 && (
                                            <div className={`bg-black/30 rounded-xl px-2 py-1 border border-orange-500/20 ${minWidth} text-center`}>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider leading-none">Entry</p>
                                                <p className="text-sm font-bold text-orange-400 leading-tight">{entryPot.toLocaleString()}</p>
                                            </div>
                                        )}
                                        {acePot > 0 && (
                                            <div className={`bg-black/30 rounded-xl px-2 py-1 border border-emerald-500/20 ${minWidth} text-center`}>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider leading-none">Ace</p>
                                                <p className="text-sm font-bold text-emerald-400 leading-tight">{acePot.toLocaleString()}</p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                    
                    {/* Right: Help & Settings */}
                    <div className="flex items-center space-x-1">
                        <button className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                            <Icons.Help size={18} />
                        </button>
                        <button className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                            <Icons.Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Players List */}
            <div className="flex-1 overflow-y-auto pb-40">
                <div className="max-w-md mx-auto px-4 py-4 space-y-3">
                    {displayPlayers.map((p, idx) => {
                        const currentHoleScore = p.scores[viewHole];
                        const totalInfo = getPlayerTotalText(p.scores, p.handicap);
                        const isAceAnimating = aceAnimation === p.id && currentHoleScore === 1;

                        return (
                            <div 
                                key={p.id} 
                                className={`bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-2xl p-4 transition-all ${p.isCurrentUser ? 'ring-1 ring-emerald-500/30' : ''} ${isAceAnimating ? 'ring-2 ring-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.3)]' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    {/* Left: Player Info */}
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        <div className={`w-12 h-12 rounded-full bg-slate-700 overflow-hidden shrink-0 border-2 ${p.isCurrentUser ? 'border-emerald-500/50' : 'border-slate-600/50'}`}>
                                            {p.photoUrl ? (
                                                <img src={p.photoUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <Icons.Users className="w-full h-full p-2 text-slate-400" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-white truncate flex items-center">
                                                {p.name}
                                                {p.isCurrentUser && (
                                                    <span className="ml-2 text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">YOU</span>
                                                )}
                                            </div>
                                            <div className={`text-sm font-semibold ${parseInt(totalInfo.diff) < 0 ? 'text-emerald-400' : parseInt(totalInfo.diff) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {totalInfo.diff} <span className="text-slate-500">({totalInfo.total})</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Scoring Controls */}
                                    <div className="flex items-center space-x-2 shrink-0">
                                        {isHost ? (
                                            <>
                                                <button
                                                    onClick={() => handleScoreChange(p.id, -1, currentHoleScore)}
                                                    className="w-11 h-11 rounded-xl bg-slate-700/80 border border-slate-600/50 flex items-center justify-center active:scale-95 active:bg-slate-600 transition-all hover:border-emerald-500/50 hover:bg-slate-700"
                                                >
                                                    <div className="w-4 h-0.5 bg-white rounded-full"></div>
                                                </button>

                                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all relative overflow-hidden ${
                                                    currentHoleScore ? getScoreBg(currentHoleScore, isAceAnimating) : 'bg-slate-800/50 border-slate-700/50'
                                                }`}>
                                                    {/* Ace sparkle effect */}
                                                    {currentHoleScore === 1 && (
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                                                    )}
                                                    <span className={`text-2xl font-black relative z-10 ${currentHoleScore === 1 ? 'text-black' : currentHoleScore ? getScoreColor(currentHoleScore) : 'text-slate-600'}`}>
                                                        {currentHoleScore || '-'}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => handleScoreChange(p.id, 1, currentHoleScore)}
                                                    className="w-11 h-11 rounded-xl bg-slate-700/80 border border-slate-600/50 flex items-center justify-center active:scale-95 active:bg-slate-600 transition-all hover:border-emerald-500/50 hover:bg-slate-700"
                                                >
                                                    <div className="relative w-4 h-4">
                                                        <div className="absolute top-1/2 left-0 w-4 h-0.5 bg-white rounded-full -translate-y-1/2"></div>
                                                        <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-white rounded-full -translate-x-1/2"></div>
                                                    </div>
                                                </button>
                                            </>
                                        ) : (
                                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${
                                                currentHoleScore ? getScoreBg(currentHoleScore, false) : 'bg-slate-800/50 border-slate-700/50'
                                            }`}>
                                                <span className={`text-2xl font-black ${currentHoleScore ? getScoreColor(currentHoleScore) : 'text-slate-600'}`}>
                                                    {currentHoleScore || '-'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Navigation Bar - Redesigned */}
            <div className="fixed bottom-20 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 z-20">
                <div className="max-w-md mx-auto px-3 py-3">
                    {/* Progress Bar - based on holes played, not hole number */}
                    <div className="mb-3">
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                                style={{ width: `${(getHolesPlayedCount(viewHole, activeRound.startingHole || 1, activeRound.holeCount) / activeRound.holeCount) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        {/* Prev Button - disabled at starting hole */}
                        <button
                            onClick={handlePrev}
                            disabled={viewHole === (activeRound.startingHole || 1)}
                            className="w-11 h-11 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all hover:bg-slate-700 hover:border-slate-600"
                        >
                            <Icons.Prev className="text-white" size={18} />
                        </button>

                        {/* Hole Pills - show holes in play order */}
                        <div className="flex items-center justify-center gap-1 flex-1 mx-2 overflow-hidden">
                            {(() => {
                                const startingHole = activeRound.startingHole || 1;
                                const totalHoles = activeRound.holeCount;
                                const allHolesInOrder = getHolesInPlayOrder(startingHole, totalHoles);
                                const currentIndex = allHolesInOrder.indexOf(viewHole);
                                const halfwayIndex = Math.floor(totalHoles / 2);
                                const finalHole = getFinalHole(startingHole, totalHoles);
                                
                                // Show 5 holes centered around current hole
                                let startIdx = Math.max(0, currentIndex - 2);
                                let endIdx = Math.min(totalHoles - 1, startIdx + 4);
                                if (endIdx - startIdx < 4) startIdx = Math.max(0, endIdx - 4);
                                
                                const visibleHoles = allHolesInOrder.slice(startIdx, endIdx + 1);

                                return visibleHoles.map((h, idx) => {
                                    const holeIndex = allHolesInOrder.indexOf(h);
                                    const isActive = h === viewHole;
                                    const complete = isHoleComplete(h);
                                    const isPast = holeIndex < currentIndex;
                                    const isHalfway = holeIndex === halfwayIndex - 1 && totalHoles >= 10;

                                    return (
                                        <button
                                            key={h}
                                            onClick={() => setViewHole(h)}
                                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all shrink-0 ${
                                                isActive 
                                                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/40 scale-110 ring-2 ring-emerald-400/50' 
                                                    : isPast && !complete 
                                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' 
                                                        : isPast && complete
                                                            ? 'bg-slate-700/80 text-emerald-400 border border-emerald-500/30'
                                                            : isHalfway
                                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                                : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700'
                                            }`}
                                        >
                                            {h}
                                        </button>
                                    );
                                });
                            })()}
                        </div>

                        {/* Next / Finish Button - finish at final hole (before starting hole) */}
                        <button
                            onClick={handleNext}
                            className={`w-11 h-11 rounded-xl border flex items-center justify-center active:scale-95 transition-all ${viewHole === getFinalHole(activeRound.startingHole || 1, activeRound.holeCount)
                                ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/30 hover:bg-emerald-400'
                                : 'bg-slate-800/80 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600'
                                }`}
                        >
                            {viewHole === getFinalHole(activeRound.startingHole || 1, activeRound.holeCount) ? <Icons.CheckMark size={18} /> : <Icons.Next size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Fixed spacer for BottomNav */}
            <div className="h-16"></div>

            {/* Confirm Finalize Modal */}
            {showConfirmFinalize && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="relative bg-gradient-to-r from-amber-600/20 via-amber-500/30 to-amber-600/20 p-5 text-center border-b border-amber-500/20">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.15),transparent_70%)]" />
                            <div className="relative">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400/50 mb-3">
                                    <Icons.Trophy size={28} className="text-amber-400" />
                                </div>
                                <h2 className="text-lg font-bold text-white">Finalize Round?</h2>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            <p className="text-slate-300 text-sm text-center leading-relaxed">
                                This will lock all scores and automatically send payouts to winners.
                            </p>

                            {/* Quick Summary */}
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Players</span>
                                    <span className="text-white font-medium">{players.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Entry Pot</span>
                                    <span className="text-emerald-400 font-bold">{entryPot.toLocaleString()} sats</span>
                                </div>
                                {acePot > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Ace Pot</span>
                                        <span className="text-amber-400 font-bold">{acePot.toLocaleString()} sats</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm border-t border-slate-700/50 pt-2 mt-2">
                                    <span className="text-slate-400">Leader</span>
                                    <span className="text-amber-400 font-medium">
                                        {sortedPlayers[0]?.name || '-'}
                                    </span>
                                </div>
                            </div>

                            {/* Warning */}
                            <div className="flex items-start space-x-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                <Icons.Zap size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-200/80">
                                    Scores cannot be changed after finalizing. Make sure everyone's scores are correct!
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-3 pt-2">
                                <Button
                                    variant="secondary"
                                    fullWidth
                                    onClick={() => setShowConfirmFinalize(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    onClick={confirmFinalize}
                                    disabled={isSubmitting}
                                    className={isSubmitting ? 'animate-pulse' : ''}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center justify-center space-x-2">
                                            <Icons.Zap size={16} className="animate-bounce" />
                                            <span>Sending...</span>
                                        </span>
                                    ) : (
                                        'Finalize & Pay'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for shimmer animation */}
            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                    animation: shimmer 1.5s infinite;
                }
            `}</style>
        </div>
    );
};
