/**
 * @file TournamentSetupView.tsx
 *
 * Tournament creation/editing form view.
 *
 * Configurable fields:
 * - Tournament name and course name (with recent course suggestions).
 * - Hole count (9/18/custom).
 * - Entry fee and ace pot (with toggle).
 * - Max players and card size (players per scoring group).
 * - Card assignment mode: director-assigns, random (Fisher-Yates), player's-choice.
 * - Payout configuration: winner-take-all vs. percentage-based, gradient, ace pot redistribution.
 * - Location: optional geolocation via browser GPS or Nominatim search.
 *   When set, publishes geohash `g` tags for relay-side discovery.
 *
 * Supports both creation (new tournament) and editing (existing tournament) modes.
 */

import React from 'react';
import { TournamentSetupViewProps } from './tournamentTypes';
import { Icons } from '../../components/Icons';

/**
 * Tournament creation/editing form with course, rules, payout, and location configuration.
 */
export const TournamentSetupView: React.FC<TournamentSetupViewProps> = ({
    name,
    setName,
    courseName,
    setCourseName,
    layout,
    setLayout,
    customHoles,
    setCustomHoles,
    hasEntryFee,
    setHasEntryFee,
    entryFee,
    setEntryFee,
    acePot,
    setAcePot,
    maxPlayers,
    setMaxPlayers,
    cardSize,
    setCardSize,
    cardAssignmentMode,
    setCardAssignmentMode,
    payoutMode,
    setPayoutMode,
    payoutPercentage,
    setPayoutPercentage,
    payoutGradient,
    setPayoutGradient,
    acePotRedistribution,
    setAcePotRedistribution,
    latitude,
    longitude,
    locationName,
    locationLoading,
    locationQuery,
    locationResults,
    onLocationQueryChange,
    onLocationSearch,
    onLocationSelect,
    onRequestLocation,
    onClearLocation,
    recentCourses,
    isEditing,
    onCreateTournament,
    onBack,
}) => {
    const entryFeePresets = [100, 250, 500, 1000, 2500, 5000];
    const acePotPresets = [100, 250, 500];

    const formatSats = (amount: number) => {
        if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
        return amount.toString();
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Back size={18} />
                    </button>
                    <h1 className="text-xl font-bold text-white flex items-center">
                        <Icons.TrophyMedal className="mr-2 text-emerald-400" size={20} />
                        {isEditing ? 'Edit Tournament' : 'Create Tournament'}
                    </h1>
                    <div className="w-10" />
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-4 pb-32">

                {/* Tournament Name */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Tournament Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Saturday Singles..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
                    />
                </div>

                {/* Course Name */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Course
                    </label>
                    <input
                        type="text"
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        placeholder="Enter course name..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
                    />
                    {recentCourses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {recentCourses
                                .filter(c => !courseName || c.toLowerCase().includes(courseName.toLowerCase()))
                                .slice(0, 5)
                                .map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCourseName(c)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                            courseName === c
                                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))
                            }
                        </div>
                    )}
                </div>

                {/* Location */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Location (optional)
                    </label>
                    {latitude != null && longitude != null ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                                <Icons.Location size={16} className="text-emerald-400 shrink-0" />
                                <span className="text-sm font-medium text-emerald-400 truncate">
                                    {locationName || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`}
                                </span>
                            </div>
                            <button
                                onClick={onClearLocation}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                            >
                                <Icons.Close size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Search input */}
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={locationQuery}
                                    onChange={(e) => onLocationQueryChange(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') onLocationSearch(); }}
                                    placeholder="Search for course or city..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
                                />
                                <button
                                    onClick={onLocationSearch}
                                    disabled={!locationQuery.trim() || locationLoading}
                                    className="px-3 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                                >
                                    {locationLoading ? (
                                        <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                    ) : (
                                        <Icons.Search size={16} />
                                    )}
                                </button>
                            </div>

                            {/* Search results */}
                            {locationResults.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {locationResults.map((result, i) => (
                                        <button
                                            key={i}
                                            onClick={() => onLocationSelect(result)}
                                            className="w-full flex items-start space-x-2 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 text-left hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
                                        >
                                            <Icons.Location size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                            <span className="text-xs text-slate-300 leading-snug line-clamp-2">
                                                {result.displayName}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Use current location fallback */}
                            <button
                                onClick={onRequestLocation}
                                className="flex items-center space-x-2 text-slate-500 hover:text-slate-300 transition-colors text-xs"
                            >
                                <Icons.Location size={12} />
                                <span>Use current location instead</span>
                            </button>
                        </div>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1.5">
                        Helps players discover your tournament nearby
                    </p>
                </div>

                {/* Hole Count */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Holes
                    </label>
                    <div className="grid grid-cols-3 gap-0 bg-slate-900/60 rounded-xl p-1 border border-slate-700/50">
                        {(['9', '18', 'custom'] as const).map((option) => (
                            <button
                                key={option}
                                onClick={() => setLayout(option)}
                                className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                                    layout === option
                                        ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {option === 'custom' ? 'Custom' : option}
                            </button>
                        ))}
                    </div>
                    {layout === 'custom' && (
                        <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 mt-3">
                            <span className="text-sm text-slate-400">Number of holes</span>
                            <input
                                type="number"
                                value={customHoles}
                                onChange={(e) => setCustomHoles(Math.max(1, parseInt(e.target.value) || 1))}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-right font-bold text-white outline-none w-20 focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                    )}
                </div>

                {/* Entry Fee */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Entry Fee
                    </label>

                    {/* Toggle */}
                    <div className="grid grid-cols-2 gap-0 bg-slate-900/60 rounded-xl p-1 border border-slate-700/50 mb-3">
                        <button
                            onClick={() => setHasEntryFee(true)}
                            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                                hasEntryFee
                                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Entry Fee
                        </button>
                        <button
                            onClick={() => setHasEntryFee(false)}
                            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                                !hasEntryFee
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Free
                        </button>
                    </div>

                    {hasEntryFee && (
                        <div className="space-y-4">
                            {/* Entry Fee Amount */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Entry (Sats)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {entryFeePresets.map(amount => (
                                        <button
                                            key={amount}
                                            onClick={() => setEntryFee(amount)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                entryFee === amount
                                                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                                    : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                                            }`}
                                        >
                                            {formatSats(amount)}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={entryFee || ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setEntryFee(val === '' ? 0 : parseInt(val, 10));
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="Custom amount..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
                                />
                            </div>

                            {/* Ace Pot */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Ace Pot (Sats)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {acePotPresets.map(amount => (
                                        <button
                                            key={amount}
                                            onClick={() => setAcePot(amount)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                acePot === amount
                                                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                                    : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                                            }`}
                                        >
                                            {formatSats(amount)}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={acePot || ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setAcePot(val === '' ? 0 : parseInt(val, 10));
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="Custom amount..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Max Players */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Max Players
                        </label>
                        <span className="text-lg font-bold text-emerald-400">{maxPlayers}</span>
                    </div>
                    <input
                        type="range"
                        min={8}
                        max={64}
                        step={4}
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                        <span>8</span>
                        <span>64</span>
                    </div>
                </div>

                {/* Card Size */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Card Size
                    </label>
                    <div className="grid grid-cols-3 gap-0 bg-slate-900/60 rounded-xl p-1 border border-slate-700/50">
                        {[3, 4, 5].map((size) => (
                            <button
                                key={size}
                                onClick={() => setCardSize(size)}
                                className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                                    cardSize === size
                                        ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                        Players per card
                    </p>
                </div>

                {/* Card Assignment Mode */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                        Card Assignment
                    </label>
                    <div className="space-y-2">
                        <button
                            onClick={() => setCardAssignmentMode('director-assigns')}
                            className={`w-full flex items-start space-x-3 p-3 rounded-xl border transition-all text-left ${
                                cardAssignmentMode === 'director-assigns'
                                    ? 'bg-emerald-500/20 border-emerald-500/50'
                                    : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                            }`}
                        >
                            <div className={`mt-0.5 shrink-0 ${cardAssignmentMode === 'director-assigns' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <Icons.Copy size={18} />
                            </div>
                            <div>
                                <p className={`text-sm font-bold ${cardAssignmentMode === 'director-assigns' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    Director Assigns
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    You manually place players on cards
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setCardAssignmentMode('random')}
                            className={`w-full flex items-start space-x-3 p-3 rounded-xl border transition-all text-left ${
                                cardAssignmentMode === 'random'
                                    ? 'bg-emerald-500/20 border-emerald-500/50'
                                    : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                            }`}
                        >
                            <div className={`mt-0.5 shrink-0 ${cardAssignmentMode === 'random' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <Icons.Refresh size={18} />
                            </div>
                            <div>
                                <p className={`text-sm font-bold ${cardAssignmentMode === 'random' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    Random Shuffle
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Players auto-assigned to random groups
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setCardAssignmentMode('players-choice')}
                            className={`w-full flex items-start space-x-3 p-3 rounded-xl border transition-all text-left ${
                                cardAssignmentMode === 'players-choice'
                                    ? 'bg-emerald-500/20 border-emerald-500/50'
                                    : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                            }`}
                        >
                            <div className={`mt-0.5 shrink-0 ${cardAssignmentMode === 'players-choice' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <Icons.Users size={18} />
                            </div>
                            <div>
                                <p className={`text-sm font-bold ${cardAssignmentMode === 'players-choice' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    Player's Choice
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Players pick their own card
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Payout Config */}
                {hasEntryFee && (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                            Payout Configuration
                        </label>

                        {/* Payout Mode */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Mode
                            </label>
                            <div className="grid grid-cols-2 gap-0 bg-slate-900/60 rounded-xl p-1 border border-slate-700/50">
                                <button
                                    onClick={() => setPayoutMode('winner-take-all')}
                                    className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                                        payoutMode === 'winner-take-all'
                                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Winner Take All
                                </button>
                                <button
                                    onClick={() => setPayoutMode('percentage-based')}
                                    className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                                        payoutMode === 'percentage-based'
                                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Percentage Based
                                </button>
                            </div>
                        </div>

                        {/* Percentage Threshold */}
                        {payoutMode === 'percentage-based' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        Payout Threshold
                                    </label>
                                    <span className="text-sm font-bold text-emerald-400">{payoutPercentage}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={10}
                                    max={100}
                                    step={10}
                                    value={payoutPercentage}
                                    onChange={(e) => setPayoutPercentage(parseInt(e.target.value))}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-slate-600">
                                    <span>10%</span>
                                    <span>100%</span>
                                </div>
                            </div>
                        )}

                        {/* Payout Gradient */}
                        {payoutMode === 'percentage-based' && (
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Distribution
                                </label>
                                <div className="grid grid-cols-2 gap-0 bg-slate-900/60 rounded-xl p-1 border border-slate-700/50">
                                    <button
                                        onClick={() => setPayoutGradient('top-heavy')}
                                        className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                                            payoutGradient === 'top-heavy'
                                                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Top Heavy
                                    </button>
                                    <button
                                        onClick={() => setPayoutGradient('linear')}
                                        className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                                            payoutGradient === 'linear'
                                                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Linear
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Ace Pot Redistribution */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Ace Pot (No Ace Hit)
                            </label>
                            <div className="space-y-1.5">
                                <button
                                    onClick={() => setAcePotRedistribution('forfeit')}
                                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left border transition-all ${
                                        acePotRedistribution === 'forfeit'
                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                                    }`}
                                >
                                    Forfeit
                                </button>
                                <button
                                    onClick={() => setAcePotRedistribution('add-to-entry-pot')}
                                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left border transition-all ${
                                        acePotRedistribution === 'add-to-entry-pot'
                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                                    }`}
                                >
                                    Add to Entry Pot
                                </button>
                                <button
                                    onClick={() => setAcePotRedistribution('redistribute-to-participants')}
                                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-left border transition-all ${
                                        acePotRedistribution === 'redistribute-to-participants'
                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                                    }`}
                                >
                                    Redistribute to Participants
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create / Save Tournament Button */}
                <div className="pt-2 pb-4">
                    <button
                        onClick={onCreateTournament}
                        disabled={!name.trim() || !courseName.trim()}
                        className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    >
                        {isEditing ? 'Save Changes' : 'Create Tournament'}
                    </button>
                </div>
            </div>
        </div>
    );
};
