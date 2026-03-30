/**
 * @file HomeSettingsView.tsx
 *
 * Round-level settings side-panel accessible from any step of the creation wizard.
 * Provides persistent preferences and round template management:
 *
 * - **Auto-follow players** -- automatically follow added players on Nostr.
 * - **Post results to Nostr** -- share finalized round results publicly.
 * - **Default entry fee / ace pot** -- pre-fill values for new rounds.
 * - **Round templates** -- save, load, and delete round configuration snapshots
 *   (holes, fees, cardmates) for quick reuse.
 *
 * All preferences are persisted to localStorage and survive across sessions.
 */

import React from 'react';
import { Icons } from '../../components/Icons';
import { Button } from '../../components/Button';
import { FeedbackModal, FeedbackButton } from '../../components/FeedbackModal';
import { HomeSettingsViewProps } from './homeTypes';

/**
 * Settings side-panel for the round creation wizard.
 * Manages persistent user preferences and round template CRUD.
 */
export const HomeSettingsView: React.FC<HomeSettingsViewProps> = ({
    autoFollowPlayers,
    setAutoFollowPlayers,
    postResults,
    setPostResults,
    defaultEntryFee,
    setDefaultEntryFee,
    defaultAcePot,
    setDefaultAcePot,
    settingsExpanded,
    toggleSettingsSection,
    savedTemplates,
    setSavedTemplates,
    showSaveTemplateModal,
    setShowSaveTemplateModal,
    templateName,
    setTemplateName,
    goBackFromSettings,
    previousView,
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
    selectedCardmates,
    setSelectedCardmates,
    setView,
    showFeedbackModal,
    setShowFeedbackModal,
}) => {
    // Handler to save current round setup as template
    const handleSaveTemplate = () => {
        if (!templateName.trim()) return;
        const newTemplate: typeof savedTemplates[0] = {
            id: Math.random().toString(36).substring(7),
            name: templateName.trim(),
            createdAt: Date.now(),
            layout,
            customHoles,
            hasEntryFee,
            entryFee,
            acePot,
            cardmates: selectedCardmates
        };
        setSavedTemplates(prev => [...prev, newTemplate]);
        setTemplateName('');
        setShowSaveTemplateModal(false);
    };

    // Handler to load a template and jump to payments
    const handleLoadTemplate = (template: typeof savedTemplates[0]) => {
        setLayout(template.layout);
        setCustomHoles(template.customHoles);
        setHasEntryFee(template.hasEntryFee);
        setEntryFee(template.entryFee);
        setAcePot(template.acePot);
        setSelectedCardmates(template.cardmates);
        // Jump to customize (payments) view
        setView('customize');
    };

    // Handler to delete a template
    const handleDeleteTemplate = (templateId: string) => {
        setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
    };

    return (
        <div className="p-6 flex flex-col h-full bg-brand-dark pb-24">
            <div className="flex items-center mb-6">
                <button onClick={goBackFromSettings} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                    <Icons.Prev />
                </button>
                <h2 className="text-xl font-bold">Round Settings</h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
                {/* Auto-follow Added Players */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl border border-white/10 overflow-hidden">
                    <button
                        onClick={() => setAutoFollowPlayers(!autoFollowPlayers)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <Icons.UserPlus size={14} className="text-purple-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-white text-sm">Auto-follow Added Players</h3>
                                <p className="text-xs text-slate-500">Follow players on Nostr when added to rounds</p>
                            </div>
                        </div>
                        <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 ${autoFollowPlayers ? 'bg-purple-500' : 'bg-slate-700'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${autoFollowPlayers ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </button>
                </div>

                {/* Post Results */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl border border-white/10 overflow-hidden">
                    <button
                        onClick={() => setPostResults(!postResults)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-7 h-7 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                <Icons.Share size={14} className="text-cyan-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-white text-sm">Post Results to Nostr</h3>
                                <p className="text-xs text-slate-500">Share round results when finalized</p>
                            </div>
                        </div>
                        <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 ${postResults ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${postResults ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </button>
                </div>

                {/* Default Entry Fee - Dropdown */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl border border-white/10 overflow-hidden">
                    <button
                        onClick={() => toggleSettingsSection('entryFee')}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                <Icons.Zap size={14} className="text-orange-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-white text-sm">Default Entry Fee</h3>
                                <p className="text-xs text-slate-500">{defaultEntryFee.toLocaleString()} sats</p>
                            </div>
                        </div>
                        <Icons.Next size={18} className={`text-slate-400 transition-transform duration-300 ${settingsExpanded['entryFee'] ? 'rotate-90' : ''}`} />
                    </button>
                    {settingsExpanded['entryFee'] && (
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/5 bg-black/20">
                            <p className="text-xs text-slate-400 pt-3">
                                This will be the default entry fee when creating new rounds.
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={defaultEntryFee || ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setDefaultEntryFee(val === '' ? 0 : parseInt(val, 10));
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                            />
                            <div className="flex flex-wrap gap-2">
                                {[1000, 2000, 5000, 10000].map(amount => (
                                    <button
                                        key={amount}
                                        onClick={() => setDefaultEntryFee(amount)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${defaultEntryFee === amount
                                            ? 'bg-gradient-to-r from-orange-500/70 to-amber-500/70 text-white shadow-lg shadow-orange-500/15'
                                            : 'bg-black/30 text-slate-300 hover:bg-slate-700 border border-white/10'
                                            }`}
                                    >
                                        {amount >= 1000 ? `${amount / 1000}k` : amount}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Default Ace Pot - Dropdown */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl border border-white/10 overflow-hidden">
                    <button
                        onClick={() => toggleSettingsSection('acePot')}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                <Icons.Trophy size={14} className="text-emerald-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-white text-sm">Default Ace Pot</h3>
                                <p className="text-xs text-slate-500">{defaultAcePot.toLocaleString()} sats</p>
                            </div>
                        </div>
                        <Icons.Next size={18} className={`text-slate-400 transition-transform duration-300 ${settingsExpanded['acePot'] ? 'rotate-90' : ''}`} />
                    </button>
                    {settingsExpanded['acePot'] && (
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/5 bg-black/20">
                            <p className="text-xs text-slate-400 pt-3">
                                This will be the default ace pot when creating new rounds.
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={defaultAcePot || ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setDefaultAcePot(val === '' ? 0 : parseInt(val, 10));
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                            <div className="flex flex-wrap gap-2">
                                {[500, 1000, 2000, 5000].map(amount => (
                                    <button
                                        key={amount}
                                        onClick={() => setDefaultAcePot(amount)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${defaultAcePot === amount
                                            ? 'bg-gradient-to-r from-emerald-500/70 to-teal-500/70 text-white shadow-lg shadow-emerald-500/15'
                                            : 'bg-black/30 text-slate-300 hover:bg-slate-700 border border-white/10'
                                            }`}
                                    >
                                        {amount >= 1000 ? `${amount / 1000}k` : amount}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Round Templates - Dropdown */}
                <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-xl border border-white/10 overflow-hidden">
                    <button
                        onClick={() => toggleSettingsSection('templates')}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <Icons.Copy size={14} className="text-blue-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-white text-sm">Round Templates</h3>
                                <p className="text-xs text-slate-500">{savedTemplates.length} saved template{savedTemplates.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <Icons.Next size={18} className={`text-slate-400 transition-transform duration-300 ${settingsExpanded['templates'] ? 'rotate-90' : ''}`} />
                    </button>
                    {settingsExpanded['templates'] && (
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/5 bg-black/20">
                            <div className="flex items-center justify-between pt-3">
                                <p className="text-xs text-slate-400">
                                    Save and load round configurations.
                                </p>
                                {(previousView === 'setup' || previousView === 'select_players' || previousView === 'customize') && (
                                    <button
                                        onClick={() => setShowSaveTemplateModal(true)}
                                        className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                                    >
                                        + Save Current
                                    </button>
                                )}
                            </div>

                            {savedTemplates.length === 0 ? (
                                <div className="bg-black/20 rounded-lg p-4 text-center">
                                    <p className="text-slate-500 text-sm">No templates saved yet.</p>
                                    <p className="text-slate-600 text-xs mt-1">Create a round and save it as a template.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {savedTemplates.map(template => (
                                        <div
                                            key={template.id}
                                            className="bg-black/30 rounded-lg p-3 border border-white/10 flex items-center justify-between"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white text-sm truncate">{template.name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {template.layout === 'custom' ? template.customHoles : template.layout} holes •
                                                    {template.hasEntryFee ? ` ${template.entryFee.toLocaleString()} sats` : ' No fee'} •
                                                    {template.cardmates.length} player{template.cardmates.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                                <button
                                                    onClick={() => handleLoadTemplate(template)}
                                                    className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500/30 transition-all"
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTemplate(template.id)}
                                                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                                                >
                                                    <Icons.Trash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Feedback Button */}
            <FeedbackButton onClick={() => setShowFeedbackModal(true)} />

            {/* Feedback Modal */}
            <FeedbackModal
                isOpen={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
            />

            {/* Save Template Modal */}
            {showSaveTemplateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowSaveTemplateModal(false)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-white"
                        >
                            <Icons.Close size={20} />
                        </button>

                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Icons.Copy size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Save Template</h3>
                        </div>

                        <p className="text-slate-400 text-sm mb-4">
                            Save your current round setup as a template for quick reuse.
                        </p>

                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Template name (e.g., Friday Minis)"
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            autoFocus
                        />

                        <div className="bg-slate-800/50 rounded-lg p-3 mb-4 text-xs text-slate-400">
                            <p><strong className="text-white">Holes:</strong> {layout === 'custom' ? customHoles : layout}</p>
                            <p><strong className="text-white">Entry Fee:</strong> {hasEntryFee ? `${entryFee.toLocaleString()} sats` : 'None'}</p>
                            <p><strong className="text-white">Ace Pot:</strong> {hasEntryFee && acePot > 0 ? `${acePot.toLocaleString()} sats` : 'None'}</p>
                            <p><strong className="text-white">Cardmates:</strong> {selectedCardmates.length} player{selectedCardmates.length !== 1 ? 's' : ''}</p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                fullWidth
                                variant="secondary"
                                onClick={() => setShowSaveTemplateModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                fullWidth
                                onClick={handleSaveTemplate}
                                disabled={!templateName.trim()}
                                className={!templateName.trim() ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
