/**
 * @file ProfileSettingsView.tsx
 *
 * Profile settings sub-view accessible from the main profile view's gear icon.
 *
 * Settings sections (each collapsible):
 * - **Display Currency** -- toggle between sats, BTC, and USD denomination.
 * - **Nostr Relays** -- view, add, remove, and reset the list of relay URLs.
 * - **Edit Profile** -- modify name, NIP-05, PDGA#, and Lightning address
 *   with copy-to-clipboard support.
 * - **Debug** -- reset active round state (development aid).
 * - **Feedback** -- opens the feedback submission modal.
 */

import React from 'react';
import { Icons } from '../../components/Icons';
import { FeedbackModal, FeedbackButton } from '../../components/FeedbackModal';
import { ProfileSettingsViewProps } from './profileTypes';

/**
 * Profile settings view -- manages display preferences, relay configuration,
 * profile fields, and debug actions.
 */
export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
    denomination, setDenomination,
    relayList, newRelayUrl, setNewRelayUrl,
    handleAddRelay, handleRemoveRelay, handleResetRelays,
    openSection, toggleSection,
    formData, setFormData,
    handleSaveProfile,
    handleCopyLud16, copiedLud16,
    openHelp,
    resetRound,
    setView,
    showFeedbackModal, setShowFeedbackModal,
}) => {
    return (
            <div className="p-6 pt-8 flex flex-col h-full overflow-y-auto">
                {/* Settings Header - Wallet style */}
                <div className="flex items-center mb-6 shrink-0">
                    <button
                        onClick={() => setView('main')}
                        className="mr-4 p-2.5 bg-black/30 backdrop-blur-sm rounded-full hover:bg-slate-800 border border-white/10 hover:border-purple-500/30 transition-all"
                    >
                        <Icons.Prev size={18} />
                    </button>
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-slate-800/50 rounded-lg flex items-center justify-center border border-white/10">
                            <Icons.Settings size={16} className="text-slate-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Settings</h2>
                    </div>
                </div>

                <div className="space-y-4 pb-24">
                    {/* Display Currency */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-emerald-500/20 overflow-hidden">
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                                    <Icons.Zap size={18} className="text-emerald-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-white block">Display Currency</span>
                                    <span className="text-[10px] text-slate-500">How amounts are shown across the app</span>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-emerald-500/10 p-4 bg-black/20">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setDenomination('sats')}
                                    className={`py-3 px-4 rounded-xl text-sm font-bold border transition-all ${
                                        denomination === 'sats'
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                            : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="text-lg mb-0.5">{"\u20BF"}</div>
                                    Sats
                                </button>
                                <button
                                    onClick={() => setDenomination('usd')}
                                    className={`py-3 px-4 rounded-xl text-sm font-bold border transition-all ${
                                        denomination === 'usd'
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                            : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="text-lg mb-0.5">$</div>
                                    USD
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 text-center mt-2">
                                {denomination === 'usd' ? 'Prices update every 5 minutes via mempool.space' : 'Showing native Bitcoin denomination'}
                            </p>
                        </div>
                    </div>

                    {/* Nostr Relays - Purple theme */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-purple-500/20 overflow-hidden">
                        <button
                            onClick={() => toggleSection('relays')}
                            className="w-full flex items-center justify-between p-4 hover:bg-purple-500/5 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center border border-purple-500/30">
                                    <Icons.Share size={18} className="text-purple-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-white block">Nostr Relays</span>
                                    <span className="text-[10px] text-slate-500">Sync profile & scores</span>
                                </div>
                            </div>
                            <Icons.ChevronDown size={18} className={`text-purple-400 transition-transform duration-300 ${openSection === 'relays' ? 'rotate-180' : ''}`} />
                        </button>
                        {openSection === 'relays' && (
                            <div className="border-t border-purple-500/10 p-4 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-slate-400 mb-4">
                                    Connect to these relays to sync your profile, rounds, and scores.
                                </p>

                                <div className="space-y-2 mb-4">
                                    {relayList.map(relay => (
                                        <div key={relay} className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-white/10 hover:border-purple-500/30 transition-colors group">
                                            <span className="text-sm font-mono text-slate-300 truncate mr-2">{relay}</span>
                                            <button
                                                onClick={() => handleRemoveRelay(relay)}
                                                className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors opacity-50 group-hover:opacity-100"
                                            >
                                                <Icons.Trash size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center space-x-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="wss://relay.example.com"
                                        value={newRelayUrl}
                                        onChange={(e) => setNewRelayUrl(e.target.value)}
                                        className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all placeholder:text-slate-600"
                                    />
                                    <button
                                        onClick={handleAddRelay}
                                        disabled={!newRelayUrl}
                                        className="p-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg font-bold disabled:opacity-30 border border-purple-500/30 transition-colors"
                                    >
                                        <Icons.Plus size={18} />
                                    </button>
                                </div>

                                <button
                                    onClick={handleResetRelays}
                                    className="text-xs text-slate-500 hover:text-purple-400 w-full text-center transition-colors"
                                >
                                    Reset to defaults
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Advanced Profile Settings - Blue theme */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-blue-500/20 overflow-hidden">
                        <button
                            onClick={() => toggleSection('advanced')}
                            className="w-full flex items-center justify-between p-4 hover:bg-blue-500/5 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                                    <Icons.Key size={18} className="text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-white block">Advanced Settings</span>
                                    <span className="text-[10px] text-slate-500">Lightning, NIP-05, PDGA</span>
                                </div>
                            </div>
                            <Icons.ChevronDown size={18} className={`text-blue-400 transition-transform duration-300 ${openSection === 'advanced' ? 'rotate-180' : ''}`} />
                        </button>
                        {openSection === 'advanced' && (
                            <div className="border-t border-blue-500/10 p-4 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-5">
                                    {/* Lightning Address */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Lightning Address</label>
                                            <button
                                                onClick={() => openHelp('Lightning Address', 'An internet identifier (like an email) that allows anyone to send you Bitcoin/Sats instantly over the Lightning Network.')}
                                                className="text-slate-500 hover:text-orange-400 transition-colors"
                                            >
                                                <Icons.Help size={12} />
                                            </button>
                                        </div>

                                        {/* Warning Alert */}
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3">
                                            <div className="flex items-start space-x-2">
                                                <div className="w-5 h-5 bg-amber-500/20 rounded flex items-center justify-center shrink-0 mt-0.5">
                                                    <Icons.Help size={12} className="text-amber-400" />
                                                </div>
                                                <p className="text-xs text-amber-200/80 leading-relaxed">
                                                    <strong className="text-amber-400">Payout Destination:</strong> Keep the default to fund your in-app wallet. External addresses won't update your in-app balance.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="text"
                                                placeholder="user@domain.com"
                                                value={formData.lud16}
                                                onChange={e => setFormData({ ...formData, lud16: e.target.value })}
                                                className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                                            />
                                            <button
                                                onClick={handleCopyLud16}
                                                className={`p-3 rounded-lg transition-colors shrink-0 ${copiedLud16
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
                                                    }`}
                                            >
                                                {copiedLud16 ? <Icons.CheckMark size={16} /> : <Icons.Copy size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Verified Nostr ID */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Verified Nostr ID</label>
                                            <button
                                                onClick={() => openHelp('Verified Nostr ID', 'Also known as NIP-05. This verifies your account by linking your public key to a domain name (e.g., name@nostr.com) and adds a checkmark to your profile.')}
                                                className="text-slate-500 hover:text-purple-400 transition-colors"
                                            >
                                                <Icons.Help size={12} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="name@nostr.com"
                                            value={formData.nip05}
                                            onChange={e => setFormData({ ...formData, nip05: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-slate-600"
                                        />
                                    </div>

                                    {/* PDGA Number */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">PDGA Number</label>
                                            <button
                                                onClick={() => openHelp('PDGA Number', 'Your Professional Disc Golf Association membership number. Other players can find you by searching this number when adding you to their card.')}
                                                className="text-slate-500 hover:text-emerald-400 transition-colors"
                                            >
                                                <Icons.Help size={12} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="e.g. 12345"
                                            value={formData.pdga}
                                            onChange={e => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                setFormData({ ...formData, pdga: value });
                                            }}
                                            maxLength={7}
                                            inputMode="numeric"
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-600"
                                        />
                                    </div>

                                    <button
                                        onClick={() => {
                                            handleSaveProfile();
                                            alert("Settings saved!");
                                        }}
                                        className="w-full p-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-400 font-bold transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* App Data - Amber theme */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-amber-500/20 overflow-hidden">
                        <button
                            onClick={() => toggleSection('data')}
                            className="w-full flex items-center justify-between p-4 hover:bg-amber-500/5 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center border border-amber-500/30">
                                    <Icons.History size={18} className="text-amber-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-white block">App Data</span>
                                    <span className="text-[10px] text-slate-500">Manage local storage</span>
                                </div>
                            </div>
                            <Icons.ChevronDown size={18} className={`text-amber-400 transition-transform duration-300 ${openSection === 'data' ? 'rotate-180' : ''}`} />
                        </button>
                        {openSection === 'data' && (
                            <div className="border-t border-amber-500/10 p-4 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                <button
                                    onClick={() => {
                                        resetRound();
                                        alert("Local round cache cleared.");
                                    }}
                                    className="w-full p-3 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors text-sm font-medium border border-red-500/20 hover:border-red-500/30"
                                >
                                    <Icons.Trash size={14} className="mr-2" />
                                    Clear active round cache
                                </button>
                            </div>
                        )}
                    </div>

                    {/* About - Emerald theme */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-emerald-500/20 overflow-hidden">
                        <button
                            onClick={() => toggleSection('about')}
                            className="w-full flex items-center justify-between p-4 hover:bg-emerald-500/5 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                                    <Icons.Help size={18} className="text-emerald-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-white block">About</span>
                                    <span className="text-[10px] text-slate-500">App info & links</span>
                                </div>
                            </div>
                            <Icons.ChevronDown size={18} className={`text-emerald-400 transition-transform duration-300 ${openSection === 'about' ? 'rotate-180' : ''}`} />
                        </button>
                        {openSection === 'about' && (
                            <div className="border-t border-emerald-500/10 p-4 bg-black/20 animate-in slide-in-from-top-2 duration-200 space-y-3">
                                <div className="flex justify-between items-center py-2 px-3 bg-black/20 rounded-lg">
                                    <span className="text-slate-400 text-sm">Version</span>
                                    <span className="font-mono text-white text-sm bg-emerald-500/20 px-2 py-0.5 rounded">v0.1.0</span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-black/20 rounded-lg">
                                    <span className="text-slate-400 text-sm">Source Code</span>
                                    <a href="https://github.com/OnChainDiscGolf/app" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors">
                                        {"GitHub \u2192"}
                                    </a>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-black/20 rounded-lg">
                                    <span className="text-slate-400 text-sm">Contact</span>
                                    <span className="text-emerald-400 text-sm">{"Use Feedback Button \u2193"}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Feedback Button */}
                    <FeedbackButton onClick={() => setShowFeedbackModal(true)} />
                </div>

                {/* Feedback Modal */}
                <FeedbackModal
                    isOpen={showFeedbackModal}
                    onClose={() => setShowFeedbackModal(false)}
                />
            </div>
    );
};
