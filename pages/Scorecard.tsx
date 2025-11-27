
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { DEFAULT_PAR, DEFAULT_HOLE_COUNT } from '../constants';
import { useNavigate } from 'react-router-dom';

export const Scorecard: React.FC = () => {
    const { activeRound, players, updateScore, finalizeRound, isAuthenticated } = useApp();
    const navigate = useNavigate();

    // Initialize view hole to startingHole if available, else 1
    const [viewHole, setViewHole] = useState(activeRound?.startingHole || 1);
    const [showHalfwayReview, setShowHalfwayReview] = useState(false);
    const [showFinalReview, setShowFinalReview] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Calculate pots based on granular payment selections
    const entryPayers = players.filter(p => p.paysEntry);
    const acePayers = players.filter(p => p.paysAce);
    const entryPot = activeRound ? entryPayers.length * activeRound.entryFeeSats : 0;
    const acePot = activeRound ? acePayers.length * activeRound.acePotFeeSats : 0;
    const totalPot = entryPot + acePot;

    if (!activeRound) return <div className="p-6 text-center text-white">No active round.</div>;

    const handleScoreChange = (playerId: string, delta: number, currentVal?: number) => {
        let newScore;
        if (currentVal === undefined || currentVal === 0) {
            // If unset, logic depends on button pressed
            if (delta > 0) {
                // Initial Plus: Set to Par (e.g. 3)
                newScore = DEFAULT_PAR;
            } else {
                // Initial Minus: Set to Par - 1 (e.g. 2)
                newScore = DEFAULT_PAR + delta;
            }
        } else {
            newScore = Math.max(1, currentVal + delta);
        }

        updateScore(viewHole, newScore, playerId);
    };

    const handleFinish = async () => {
        if (window.confirm("Are you sure you want to finalize this round?")) {
            finalizeRound();
            navigate('/wallet');
        }
    };

    // Check if all players have scores for a specific hole
    const isHoleComplete = (h: number) => {
        if (players.length === 0) return false;
        return players.every(p => p.scores[h] && p.scores[h] > 0);
    };

    const handleNext = () => {
        // Check for incomplete scores on current hole before moving
        if (viewHole <= activeRound.holeCount && !isHoleComplete(viewHole)) {
            setToast(`Hole ${viewHole} incomplete`);
            setTimeout(() => setToast(null), 2500);
        }

        // Intercept for Halfway Review (after hole 9, going to 10)
        if (viewHole === 9 && activeRound.holeCount >= 10 && !showHalfwayReview) {
            setShowHalfwayReview(true);
            return;
        }

        if (showHalfwayReview) {
            setShowHalfwayReview(false);
            setViewHole(10);
            return;
        }

        // Intercept for Final Review (after last hole)
        if (viewHole === activeRound.holeCount && !showFinalReview) {
            setShowFinalReview(true);
            return;
        }

        if (viewHole < activeRound.holeCount) {
            setViewHole(h => h + 1);
        }
    };

    const handlePrev = () => {
        // Exit Final Review
        if (showFinalReview) {
            setShowFinalReview(false);
            return;
        }

        // Intercept for Halfway Review (coming back from 10)
        if (viewHole === 10 && !showHalfwayReview) {
            setShowHalfwayReview(true);
            return;
        }

        if (showHalfwayReview) {
            setShowHalfwayReview(false);
            setViewHole(9);
            return;
        }

        setViewHole(h => Math.max(1, h - 1));
    };

    // Helper to calculate "Total" text like "E (0)" or "+2 (20)"
    const getPlayerTotalText = (playerScores: Record<number, number>, rangeMax?: number) => {
        const scoresToCount = rangeMax
            ? Object.entries(playerScores).filter(([h]) => parseInt(h) <= rangeMax).map(([, s]) => s)
            : Object.values(playerScores);

        const holesPlayed = scoresToCount.length;
        if (holesPlayed === 0) return "E (0)";

        const totalStrokes = scoresToCount.reduce((a, b) => a + b, 0);
        const parSoFar = holesPlayed * DEFAULT_PAR;
        const diff = totalStrokes - parSoFar;

        let diffText = "E";
        if (diff > 0) diffText = `+${diff}`;
        if (diff < 0) diffText = `${diff}`;

        return `${diffText} (${totalStrokes})`;
    };

    // Check if all players have scores for a range
    const areScoresCompleteInRange = (start: number, end: number) => {
        for (const p of players) {
            for (let h = start; h <= end; h++) {
                if (!p.scores[h]) return false;
            }
        }
        return true;
    };

    // --- REVIEW UI (Shared for Halfway and Final) ---
    if (showHalfwayReview || showFinalReview) {
        // Determine range: Always start from 1 for review
        const rangeStart = 1;
        const rangeEnd = showHalfwayReview ? 9 : activeRound.holeCount;

        const isComplete = areScoresCompleteInRange(rangeStart, rangeEnd);
        const allHoles = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i);

        const front9 = allHoles.filter(h => h <= 9);
        const back9 = allHoles.filter(h => h > 9);

        return (
            <div className="flex flex-col h-screen bg-brand-dark text-white">
                {/* Header */}
                <div className="bg-brand-surface px-4 py-3 border-b border-slate-700 shadow-md z-10">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-bold text-slate-300">Scorecard review <span className="text-white">{rangeStart} - {rangeEnd}</span></h1>
                        </div>
                    </div>
                </div>

                {/* Status Banner */}
                <div className={`${isComplete ? 'bg-brand-secondary' : 'bg-slate-700'} px-4 py-2 text-sm font-bold text-white flex items-center`}>
                    {isComplete ? 'All scores entered' : 'Scores incomplete'}
                </div>

                {/* Player List */}
                <div className={`flex-1 overflow-y-auto ${showFinalReview ? 'pb-40' : 'pb-32'}`}>
                    {players.map((p) => (
                        <div key={p.id} className="border-b border-slate-800 py-4 px-4">
                            {/* Player Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
                                        {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" /> : <Icons.Users className="p-2 text-slate-400" />}
                                    </div>
                                    <div>
                                        <div className="font-bold">{p.name}</div>
                                        <div className="text-xs text-slate-500">@{p.name.replace(/\s/g, '').toLowerCase()}</div>
                                    </div>
                                </div>
                                <div className="text-xl font-bold text-slate-200">
                                    {getPlayerTotalText(p.scores, rangeEnd)}
                                </div>
                            </div>

                            {/* Score Grids - Stacked Layout (Front 9 / Back 9) to avoid horizontal scroll */}
                            <div className="space-y-3">
                                {/* Front 9 */}
                                {front9.length > 0 && (
                                    <div className="grid text-center gap-y-2 text-sm" style={{ gridTemplateColumns: `40px repeat(${front9.length}, 1fr)` }}>
                                        {/* Labels */}
                                        <div className="text-slate-500 font-bold text-[10px] flex items-center justify-start">HOLE</div>
                                        {front9.map(h => {
                                            const hasScore = p.scores[h] && p.scores[h] > 0;
                                            return (
                                                <div key={`h-${h}`} className={`font-bold flex items-center justify-center text-xs ${!hasScore ? 'bg-red-500/10 text-red-400 border border-red-500/50 rounded-full w-5 h-5 mx-auto' : 'text-slate-400'}`}>
                                                    {h}
                                                </div>
                                            );
                                        })}

                                        {/* Scores */}
                                        <div className="text-slate-500 font-bold text-[10px] flex items-center justify-start">SCORE</div>
                                        {front9.map(h => {
                                            const score = p.scores[h];
                                            const diff = score - DEFAULT_PAR;
                                            let colorClass = "text-white";
                                            if (score) {
                                                if (diff < 0) colorClass = "text-brand-primary bg-brand-primary/10 rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs";
                                                else if (diff > 0) colorClass = "text-brand-accent text-xs";
                                                else colorClass = "text-white text-xs";
                                            }

                                            return (
                                                <div key={`s-${h}`} className={`font-bold ${colorClass}`}>
                                                    {score || '-'}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Back 9 */}
                                {back9.length > 0 && (
                                    <div className="grid text-center gap-y-2 text-sm" style={{ gridTemplateColumns: `40px repeat(${back9.length}, 1fr)` }}>
                                        {/* Labels */}
                                        <div className="text-slate-500 font-bold text-[10px] flex items-center justify-start">HOLE</div>
                                        {back9.map(h => {
                                            const hasScore = p.scores[h] && p.scores[h] > 0;
                                            return (
                                                <div key={`h-${h}`} className={`font-bold flex items-center justify-center text-xs ${!hasScore ? 'bg-red-500/10 text-red-400 border border-red-500/50 rounded-full w-5 h-5 mx-auto' : 'text-slate-400'}`}>
                                                    {h}
                                                </div>
                                            );
                                        })}

                                        {/* Scores */}
                                        <div className="text-slate-500 font-bold text-[10px] flex items-center justify-start">SCORE</div>
                                        {back9.map(h => {
                                            const score = p.scores[h];
                                            const diff = score - DEFAULT_PAR;
                                            let colorClass = "text-white";
                                            if (score) {
                                                if (diff < 0) colorClass = "text-brand-primary bg-brand-primary/10 rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs";
                                                else if (diff > 0) colorClass = "text-brand-accent text-xs";
                                                else colorClass = "text-white text-xs";
                                            }

                                            return (
                                                <div key={`s-${h}`} className={`font-bold ${colorClass}`}>
                                                    {score || '-'}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Actions */}
                <div className="fixed bottom-16 left-0 right-0 bg-brand-surface/90 backdrop-blur border-t border-slate-700 p-4 z-20">
                    {showHalfwayReview ? (
                        /* Halfway Navigation */
                        <div className="max-w-md mx-auto flex justify-between items-center">
                            <button
                                onClick={handlePrev}
                                className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center active:scale-95 transition-all hover:bg-slate-700"
                            >
                                <span className="font-bold text-sm">{rangeEnd}</span>
                            </button>

                            <div className="bg-brand-secondary/20 px-4 py-2 rounded-full text-brand-secondary font-bold text-sm border border-brand-secondary/30">
                                Review {rangeStart} - {rangeEnd}
                            </div>

                            <button
                                onClick={handleNext}
                                className="w-12 h-12 rounded-full bg-brand-primary text-black border border-brand-primary flex items-center justify-center active:scale-95 transition-all hover:bg-emerald-400"
                            >
                                <span className="font-bold text-sm">{rangeEnd + 1}</span>
                            </button>
                        </div>
                    ) : (
                        /* Final Review Action */
                        <div className="max-w-md mx-auto flex flex-col space-y-3">
                            <Button
                                fullWidth
                                onClick={handleFinish}
                                disabled={!isComplete}
                                className={`${!isComplete ? 'opacity-50 cursor-not-allowed bg-slate-600 text-slate-300' : 'bg-brand-accent text-black shadow-lg shadow-brand-accent/20'}`}
                            >
                                Confirm Score and Send Payout
                            </Button>
                            <button
                                onClick={handlePrev}
                                className="text-slate-400 text-sm font-bold hover:text-white py-2"
                            >
                                Go back to Hole {activeRound.holeCount}
                            </button>
                        </div>
                    )}
                </div>
                <div className="h-16"></div>
            </div>
        );
    }

    // --- NORMAL SCORING UI ---

    return (
        <div className="flex flex-col h-screen bg-brand-dark text-white relative">

            {/* Toast Notification */}
            {toast && (
                <div className="absolute bottom-36 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg font-bold text-sm flex items-center space-x-2 border border-red-400/50">
                        <Icons.Close size={16} />
                        <span>{toast}</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-brand-surface px-4 py-3 border-b border-slate-700 shadow-md z-10 flex justify-between items-center">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{activeRound.courseName}</div>
                    <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-extrabold">Hole {viewHole}</h1>
                        <div className="px-2 py-0.5 bg-slate-800 rounded border border-slate-600">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Par {DEFAULT_PAR}</span>
                        </div>
                    </div>
                </div>


                {totalPot > 0 && (
                    <div className="flex flex-col items-end">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Pot</div>
                        <div className="text-xl font-bold text-brand-accent">{totalPot.toLocaleString()} <span className="text-xs text-brand-accent/70">sats</span></div>
                    </div>
                )}
            </div>

            {/* Players List */}
            <div className="flex-1 overflow-y-auto pb-32">
                {players.map((p, idx) => {
                    const currentHoleScore = p.scores[viewHole];
                    const totalText = getPlayerTotalText(p.scores);

                    return (
                        <div key={p.id} className="flex items-center justify-between p-4 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">

                            {/* Left: Info */}
                            <div className="flex items-center space-x-3 min-w-0 flex-1 mr-4">
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden shrink-0 border-2 border-slate-600">
                                    {p.photoUrl ? (
                                        <img src={p.photoUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <Icons.Users className="w-full h-full p-3 text-slate-400" />
                                    )}
                                </div>

                                {/* Name & Score */}
                                <div className="min-w-0">
                                    <div className="font-bold text-base truncate leading-tight mb-0.5">
                                        {p.name} {p.isCurrentUser && <span className="text-[10px] text-brand-primary ml-1">(You)</span>}
                                    </div>
                                    <div className="text-sm text-slate-400 font-medium">
                                        {totalText}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Scoring Controls */}
                            <div className="flex items-center space-x-4 shrink-0">
                                {/* Minus */}
                                <button
                                    onClick={() => handleScoreChange(p.id, -1, currentHoleScore)}
                                    className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center shadow-lg shadow-orange-900/20 active:scale-95 transition-transform"
                                >
                                    <div className="w-4 h-1 bg-black rounded-full"></div>
                                </button>

                                {/* Score Display */}
                                <div className="w-8 text-center">
                                    <span className={`text-2xl font-bold ${currentHoleScore ? 'text-white' : 'text-slate-600'}`}>
                                        {currentHoleScore || '-'}
                                    </span>
                                </div>

                                {/* Plus */}
                                <button
                                    onClick={() => handleScoreChange(p.id, 1, currentHoleScore)}
                                    className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center shadow-lg shadow-orange-900/20 active:scale-95 transition-transform"
                                >
                                    <div className="relative w-4 h-4">
                                        <div className="absolute top-1/2 left-0 w-4 h-1 bg-black rounded-full -translate-y-1/2"></div>
                                        <div className="absolute top-0 left-1/2 w-1 h-4 bg-black rounded-full -translate-x-1/2"></div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Navigation Bar */}
            <div className="fixed bottom-16 left-0 right-0 bg-brand-surface/90 backdrop-blur border-t border-slate-700 p-4 z-20">
                <div className="max-w-md mx-auto flex justify-between items-center">
                    {/* Prev Button */}
                    <button
                        onClick={handlePrev}
                        disabled={viewHole === 1}
                        className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all hover:bg-slate-700"
                    >
                        <Icons.Prev className="text-white" size={24} />
                    </button>

                    {/* Hole Numbers */}
                    <div className="flex space-x-1 items-center justify-center overflow-x-auto px-2 no-scrollbar flex-1 mx-2">
                        {(() => {
                            const count = activeRound.holeCount;
                            // Sliding window logic: show 5 numbers centered on current
                            let start = Math.max(1, viewHole - 2);
                            let end = Math.min(count, start + 4);

                            // Adjust window if at the very end to show 5 items if possible
                            if (end - start < 4) {
                                start = Math.max(1, end - 4);
                            }

                            // Ensure start is not less than 1
                            start = Math.max(1, start);

                            const items = [];
                            for (let i = start; i <= end; i++) {
                                // Insert Review button between 9 and 10
                                if (i === 10) items.push('REV');
                                items.push(i);
                            }

                            return items.map(item => {
                                if (item === 'REV') {
                                    return (
                                        <button
                                            key="rev"
                                            onClick={() => setShowHalfwayReview(true)}
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold transition-all shrink-0 text-brand-secondary bg-brand-secondary/10 border border-brand-secondary/30 hover:bg-brand-secondary hover:text-black"
                                        >
                                            REV
                                        </button>
                                    );
                                }

                                const h = item as number;
                                const isActive = h === viewHole;
                                const complete = isHoleComplete(h);
                                const isPast = h < viewHole;

                                let btnClass = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shrink-0 ";

                                if (isActive) {
                                    btnClass += "bg-brand-primary text-black shadow-lg scale-110";
                                } else if (isPast && !complete) {
                                    // Error indication for skipped holes
                                    btnClass += "bg-red-500/10 text-red-400 border border-red-500/50";
                                } else {
                                    btnClass += "text-slate-400 hover:text-white hover:bg-slate-800";
                                }

                                return (
                                    <button
                                        key={h}
                                        onClick={() => setViewHole(h)}
                                        className={btnClass}
                                    >
                                        {h}
                                    </button>
                                )
                            });
                        })()}
                    </div>

                    {/* Next / Finish Button */}
                    <button
                        onClick={handleNext}
                        className={`w-12 h-12 rounded-full border flex items-center justify-center active:scale-95 transition-all ${viewHole === activeRound.holeCount
                            ? 'bg-brand-primary border-brand-primary text-black shadow-lg hover:bg-emerald-400'
                            : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'
                            }`}
                    >
                        {viewHole === activeRound.holeCount ? <Icons.CheckMark size={24} /> : <Icons.Next size={24} />}
                    </button>
                </div>
            </div>

            {/* Fixed spacer for BottomNav */}
            <div className="h-16"></div>
        </div>
    );
};
