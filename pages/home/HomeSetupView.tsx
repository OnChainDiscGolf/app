/**
 * @file HomeSetupView.tsx
 *
 * Step 1 of the round creation wizard: course and fee configuration.
 *
 * User interactions:
 * - Enter or select a recently-played course name (autocomplete chips).
 * - Choose hole count: 9 / 18 / custom.
 * - Toggle entry fee on/off and set amount via preset buttons or custom input.
 * - Set ace pot amount with its own preset/custom controls.
 * - Navigate to settings (gear icon) or help (question mark icon).
 * - Advance to player selection with the "Next" button.
 *
 * Supports up to 3 user-defined custom presets per fee category, persisted
 * in localStorage and managed by the orchestrator.
 */

import React from 'react';
import { Icons } from '../../components/Icons';
import { Button } from '../../components/Button';
import { HomeSetupViewProps } from './homeTypes';
import { getRoundSetupCourseHelperText, isRoundSetupReady } from './roundSetupCopy';

/**
 * Round setup form -- configures course, holes, entry fee, and ace pot.
 * First step in the round creation wizard flow.
 */
export const HomeSetupView: React.FC<HomeSetupViewProps> = ({
    courseName,
    setCourseName,
    recentCourses,
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
    customPresets,
    customAcePresets,
    handleSaveCustomPreset,
    handleDeleteCustomPreset,
    handleSaveCustomAcePreset,
    handleDeleteCustomAcePreset,
    showCustomInput,
    setShowCustomInput,
    customAmount,
    setCustomAmount,
    showCustomAceInput,
    setShowCustomAceInput,
    customAceAmount,
    setCustomAceAmount,
    showSetupHelp,
    setShowSetupHelp,
    setView,
    goToSettings,
}) => {
    const canContinue = isRoundSetupReady(courseName);
    const courseHelperText = getRoundSetupCourseHelperText(courseName);

    return (
        <div className="flex flex-col h-full p-4 pb-20">
            {/* Header - Compact */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                    <button
                        onClick={() => setView('menu')}
                        className="mr-3 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Prev size={18} />
                    </button>
                    <h1 className="text-xl font-bold flex items-center">
                        <Icons.Trophy className="mr-2 text-emerald-400" size={20} /> Round Setup
                    </h1>
                </div>
                <div className="flex space-x-1.5">
                    <button
                        onClick={() => setShowSetupHelp(true)}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Help size={18} />
                    </button>
                    <button
                        onClick={goToSettings}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Settings size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col space-y-2.5 min-h-0">

                {/* Course Name Section */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl p-3.5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center text-slate-400 space-x-2 mb-2">
                        <div className="w-6 h-6 bg-emerald-500/15 rounded-md flex items-center justify-center">
                            <Icons.Location size={14} className="text-emerald-400/80" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Course</span>
                    </div>

                    <input
                        type="text"
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        placeholder="Enter course name..."
                        aria-invalid={!canContinue}
                        aria-describedby="course-helper"
                        className={`w-full bg-black/30 border rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${
                            canContinue
                                ? 'border-white/10 focus:ring-emerald-500/50 focus:border-emerald-500/50'
                                : 'border-amber-500/50 focus:ring-amber-500/50 focus:border-amber-500/50'
                        }`}
                    />
                    <p
                        id="course-helper"
                        className={`mt-1.5 text-xs ${canContinue ? 'text-emerald-300/80' : 'text-amber-300'}`}
                    >
                        {courseHelperText}
                    </p>

                    {/* Recent courses - show when input is empty or matches */}
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
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-white'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))
                            }
                        </div>
                    )}
                </div>

                {/* Holes Section - Compact */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl p-3.5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center text-slate-400 space-x-2 mb-2">
                        <div className="w-6 h-6 bg-blue-500/15 rounded-md flex items-center justify-center">
                            <Icons.Trophy size={14} className="text-blue-400/80" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Holes</span>
                    </div>

                    <div className="grid grid-cols-3 gap-0 bg-black/30 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setLayout('9')}
                            className={`py-2 rounded-md text-sm font-bold transition-all ${layout === '9' ? 'bg-gradient-to-r from-blue-500/70 to-purple-500/70 text-white shadow-lg shadow-blue-500/15' : 'text-slate-400 hover:text-white'}`}
                        >
                            9
                        </button>
                        <button
                            onClick={() => setLayout('18')}
                            className={`py-2 rounded-md text-sm font-bold transition-all ${layout === '18' ? 'bg-gradient-to-r from-blue-500/70 to-purple-500/70 text-white shadow-lg shadow-blue-500/15' : 'text-slate-400 hover:text-white'}`}
                        >
                            18
                        </button>
                        <button
                            onClick={() => setLayout('custom')}
                            className={`py-2 rounded-md text-sm font-bold transition-all ${layout === 'custom' ? 'bg-gradient-to-r from-blue-500/70 to-purple-500/70 text-white shadow-lg shadow-blue-500/15' : 'text-slate-400 hover:text-white'}`}
                        >
                            Custom
                        </button>
                    </div>
                    {layout === 'custom' && (
                        <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-lg border border-white/10 mt-2">
                            <span className="text-sm text-slate-400">Holes</span>
                            <input
                                type="number"
                                value={customHoles}
                                onChange={(e) => setCustomHoles(parseInt(e.target.value))}
                                className="bg-transparent text-right font-bold outline-none w-16 focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    )}
                </div>

                {/* Entry Fee & Stakes Section - Compact */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl p-3.5 border border-white/10 backdrop-blur-sm flex-1 min-h-0 overflow-y-auto">
                    <div className="flex items-center text-slate-400 space-x-2 mb-2">
                        <div className="w-6 h-6 bg-orange-500/20 rounded-md flex items-center justify-center">
                            <Icons.Zap size={14} className="text-orange-400" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Entry Fee & Stakes</span>
                    </div>

                    {/* Entry Fee Toggle */}
                    <div className="bg-black/30 rounded-lg p-1 border border-white/10 flex mb-3">
                        <button
                            onClick={() => setHasEntryFee(true)}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${hasEntryFee ? 'bg-gradient-to-r from-orange-500/70 to-amber-500/70 text-white shadow-lg shadow-orange-500/15' : 'text-slate-400 hover:text-white'}`}
                        >
                            Entry Fee
                        </button>
                        <button
                            onClick={() => setHasEntryFee(false)}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${!hasEntryFee ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            No Entry Fee
                        </button>
                    </div>

                    {hasEntryFee && (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entry Fee (Sats)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={entryFee || ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setEntryFee(val === '' ? 0 : parseInt(val, 10));
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                />

                                {/* Preset Entry Fee Buttons */}
                                <div className="flex flex-wrap gap-2">
                                    {/* Combined and Sorted Presets */}
                                    {(() => {
                                        const defaultPresets = [1000, 2000, 5000, 10000];
                                        const allPresets = [
                                            ...defaultPresets.map(amount => ({ amount, id: `default-${amount}`, isCustom: false })),
                                            ...customPresets.map(preset => ({ ...preset, isCustom: true }))
                                        ].sort((a, b) => a.amount - b.amount);

                                        return allPresets.map(preset => (
                                            preset.isCustom ? (
                                                <div key={preset.id} className="relative group">
                                                    <button
                                                        onClick={() => setEntryFee(preset.amount)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${entryFee === preset.amount
                                                            ? 'bg-gradient-to-r from-orange-500/70 to-amber-500/70 text-white shadow-lg shadow-orange-500/15'
                                                            : 'bg-black/30 text-slate-300 hover:bg-slate-700 border border-white/10 hover:border-orange-500/30'
                                                            }`}
                                                    >
                                                        {preset.amount >= 1000 ? `${preset.amount / 1000}k` : preset.amount}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCustomPreset(preset.id)}
                                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete preset"
                                                    >
                                                        <Icons.Close size={10} className="text-white" strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => setEntryFee(preset.amount)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${entryFee === preset.amount
                                                        ? 'bg-gradient-to-r from-orange-500/70 to-amber-500/70 text-white shadow-lg shadow-orange-500/15'
                                                        : 'bg-black/30 text-slate-300 hover:bg-slate-700 border border-white/10 hover:border-orange-500/30'
                                                        }`}
                                                >
                                                    {preset.amount / 1000}k
                                                </button>
                                            )
                                        ));
                                    })()}

                                    {/* Add Custom Button */}
                                    {customPresets.length < 3 && !showCustomInput && (
                                        <button
                                            onClick={() => setShowCustomInput(true)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-black/30 text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all"
                                        >
                                            + Custom
                                        </button>
                                    )}
                                </div>

                                {/* Custom Input UI */}
                                {showCustomInput && (
                                    <div className="flex items-center gap-1.5 bg-black/30 p-2 rounded-xl border border-orange-500/30 animate-in fade-in slide-in-from-top-2">
                                        <input
                                            type="number"
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            placeholder="Amount..."
                                            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSaveCustomPreset}
                                            className="px-3 py-1.5 bg-orange-500 text-white font-bold text-xs rounded-lg hover:bg-orange-400 transition-colors shrink-0"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowCustomInput(false);
                                                setCustomAmount('');
                                            }}
                                            className="px-3 py-1.5 bg-slate-700 text-white font-bold text-xs rounded-lg hover:bg-slate-600 transition-colors shrink-0"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ace Pot (Sats)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={acePot || ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setAcePot(val === '' ? 0 : parseInt(val, 10));
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                />

                                {/* Ace Pot Quick Select */}
                                <div className="flex flex-wrap gap-2">
                                    {/* Combined and Sorted Ace Pot Presets */}
                                    {(() => {
                                        const defaultAcePresets = [1000, 2000, 5000, 10000];
                                        const allAcePresets = [
                                            ...defaultAcePresets.map(amount => ({ amount, id: `default-${amount}`, isCustom: false })),
                                            ...customAcePresets.map(preset => ({ ...preset, isCustom: true }))
                                        ].sort((a, b) => a.amount - b.amount);

                                        return allAcePresets.map(preset => (
                                            preset.isCustom ? (
                                                <div key={preset.id} className="relative group">
                                                    <button
                                                        onClick={() => setAcePot(preset.amount)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${acePot === preset.amount
                                                            ? 'bg-gradient-to-r from-orange-500/70 to-amber-500/70 text-white shadow-lg shadow-orange-500/15'
                                                            : 'bg-black/30 text-slate-300 hover:bg-slate-700 border border-white/10 hover:border-orange-500/30'
                                                            }`}
                                                    >
                                                        {preset.amount >= 1000 ? `${preset.amount / 1000}k` : preset.amount}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCustomAcePreset(preset.id)}
                                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete preset"
                                                    >
                                                        <Icons.Close size={10} className="text-white" strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => setAcePot(preset.amount)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${acePot === preset.amount
                                                        ? 'bg-gradient-to-r from-orange-500/70 to-amber-500/70 text-white shadow-lg shadow-orange-500/15'
                                                        : 'bg-black/30 text-slate-300 hover:bg-slate-700 border border-white/10 hover:border-orange-500/30'
                                                        }`}
                                                >
                                                    {preset.amount / 1000}k
                                                </button>
                                            )
                                        ));
                                    })()}

                                    {/* Add Custom Button */}
                                    {customAcePresets.length < 3 && !showCustomAceInput && (
                                        <button
                                            onClick={() => setShowCustomAceInput(true)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-black/30 text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all"
                                        >
                                            + Custom
                                        </button>
                                    )}
                                </div>

                                {/* Custom Ace Pot Input UI */}
                                {showCustomAceInput && (
                                    <div className="flex items-center gap-1.5 bg-black/30 p-2 rounded-xl border border-orange-500/30 animate-in fade-in slide-in-from-top-2">
                                        <input
                                            type="number"
                                            value={customAceAmount}
                                            onChange={(e) => setCustomAceAmount(e.target.value)}
                                            placeholder="Amount..."
                                            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSaveCustomAcePreset}
                                            className="px-3 py-1.5 bg-orange-500 text-white font-bold text-xs rounded-lg hover:bg-orange-400 transition-colors shrink-0"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowCustomAceInput(false);
                                                setCustomAceAmount('');
                                            }}
                                            className="px-3 py-1.5 bg-slate-700 text-white font-bold text-xs rounded-lg hover:bg-slate-600 transition-colors shrink-0"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Next Button - Fixed at bottom */}
            <div className="mt-3 pt-2 shrink-0">
                <button
                    onClick={() => setView('select_players')}
                    disabled={!canContinue}
                    aria-disabled={!canContinue}
                    className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all ${
                        canContinue
                            ? 'bg-gradient-to-r from-emerald-500/70 via-teal-500/70 to-cyan-500/70 text-white shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-[0.98]'
                            : 'bg-slate-800/80 text-slate-500 shadow-none cursor-not-allowed border border-slate-700/80'
                    }`}
                >
                    {canContinue ? 'Next' : 'Enter a course to continue'}
                </button>
            </div>

            {/* Setup Help Modal */}
            {showSetupHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full max-h-[70vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowSetupHelp(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                        >
                            <Icons.Close size={24} />
                        </button>

                        <div className="flex items-center space-x-3 mb-6">
                            <Icons.Help size={28} className="text-brand-primary" />
                            <h2 className="text-xl font-bold text-white">Round Setup Help</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            <div className="space-y-3">
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Icons.Zap size={16} className="text-brand-primary" />
                                        <h3 className="font-bold text-white text-sm">Entry Fee</h3>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        The entry fee is the amount each player pays to join the round. This creates the prize pool that gets distributed to winners at the end.
                                    </p>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Icons.Trophy size={16} className="text-brand-secondary" />
                                        <h3 className="font-bold text-white text-sm">Ace Pot</h3>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Optional bonus pool for hole-in-ones. Each player contributes this amount, and whoever gets an ace wins the entire pot!
                                    </p>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Icons.Settings size={16} className="text-brand-primary" />
                                        <h3 className="font-bold text-white text-sm">Custom Presets</h3>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Save your frequently used entry fees for quick access. You can create up to 3 custom presets. Hover over a custom preset to delete it.
                                    </p>
                                </div>

                                <div className="bg-brand-primary/10 rounded-lg p-3 border border-brand-primary/30">
                                    <p className="text-xs text-brand-primary leading-relaxed">
                                        <strong>{"\uD83D\uDCA1"} Tip:</strong> All payments are handled automatically using Bitcoin Lightning and eCash for instant, low-fee transactions.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                fullWidth
                                variant="secondary"
                                onClick={() => setShowSetupHelp(false)}
                            >
                                Got it!
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
