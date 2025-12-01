/**
 * MnemonicBackup Component
 * 
 * Displays 12/24 word mnemonic phrase for user backup.
 * Includes multiple backup options:
 * - Copy to clipboard
 * - QR Code with branding
 * - PDF Wallet Card with memory story
 * - Nostr encrypted backup
 * 
 * NO VERIFICATION STEP - Users may be on the disc golf course ready to play!
 */

import React, { useState, useMemo } from 'react';
import { Icons } from './Icons';
import { splitMnemonicToWords } from '../services/mnemonicService';
import { 
    downloadQRCode, 
    downloadWalletCardPDF,
    backupToNostr
} from '../services/backupService';

interface MnemonicBackupProps {
    mnemonic: string;
    onComplete: () => void;
    onBack?: () => void;
    title?: string;
    subtitle?: string;
}

export const MnemonicBackup: React.FC<MnemonicBackupProps> = ({
    mnemonic,
    onComplete,
    onBack,
    title = "Save Your Recovery Phrase",
    subtitle = "These 12 words are the ONLY way to recover your account and wallet."
}) => {
    const [copied, setCopied] = useState(false);
    const [showWords, setShowWords] = useState(false);
    const [showBackupOptions, setShowBackupOptions] = useState(false);
    
    // Backup option states
    const [showNostrModal, setShowNostrModal] = useState(false);
    const [nostrPassword, setNostrPassword] = useState('');
    const [nostrPasswordConfirm, setNostrPasswordConfirm] = useState('');
    const [nostrBackupSuccess, setNostrBackupSuccess] = useState(false);
    const [nostrBackupError, setNostrBackupError] = useState('');
    const [isBackingUp, setIsBackingUp] = useState(false);

    const words = useMemo(() => splitMnemonicToWords(mnemonic), [mnemonic]);

    const handleCopy = () => {
        navigator.clipboard.writeText(mnemonic);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadQR = async () => {
        await downloadQRCode(mnemonic);
    };

    const handleDownloadPDF = async () => {
        await downloadWalletCardPDF(mnemonic);
    };

    const handleNostrBackup = async () => {
        if (nostrPassword !== nostrPasswordConfirm) {
            setNostrBackupError('Passwords do not match');
            return;
        }
        if (nostrPassword.length < 6) {
            setNostrBackupError('Password must be at least 6 characters');
            return;
        }

        setIsBackingUp(true);
        setNostrBackupError('');

        try {
            const success = await backupToNostr(mnemonic, nostrPassword);
            if (success) {
                setNostrBackupSuccess(true);
                setTimeout(() => {
                    setShowNostrModal(false);
                    setNostrBackupSuccess(false);
                    setNostrPassword('');
                    setNostrPasswordConfirm('');
                }, 2000);
            } else {
                setNostrBackupError('Backup failed. Please try again.');
            }
        } catch (e) {
            setNostrBackupError('Backup failed. Please try again.');
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="text-center mb-4">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <Icons.Back size={24} />
                    </button>
                )}

                <div className="w-16 h-16 mx-auto mb-3 bg-amber-500/20 rounded-full flex items-center justify-center border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <Icons.Key className="text-amber-500" size={32} />
                </div>

                <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                <p className="text-slate-400 text-sm px-4">{subtitle}</p>
            </div>

            {/* Warning Banner */}
            <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start space-x-2">
                    <Icons.Shield className="text-red-400 shrink-0 mt-0.5" size={18} />
                    <div className="text-xs text-red-300">
                        <strong className="block mb-1">Never share these words!</strong>
                        Anyone with these words can steal your funds. We will NEVER ask for them.
                    </div>
                </div>
            </div>

            {/* Word Grid */}
            <div className="flex-1 mx-4 overflow-y-auto">
                <div className="relative">
                    {/* Blur overlay when hidden */}
                    {!showWords && (
                        <div
                            className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-md rounded-xl z-10 cursor-pointer"
                            onClick={() => setShowWords(true)}
                        >
                            <div className="text-center p-4">
                                <Icons.Eye className="mx-auto text-slate-400 mb-2" size={32} />
                                <p className="text-slate-300 font-medium text-sm">Tap to reveal words</p>
                                <p className="text-slate-500 text-xs mt-1">Make sure no one is watching</p>
                            </div>
                        </div>
                    )}

                    {/* Word Grid */}
                    <div className="grid grid-cols-3 gap-2 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                        {words.map((word, index) => (
                            <div
                                key={index}
                                className="flex items-center bg-slate-900/50 rounded-lg p-2 border border-slate-700"
                            >
                                <span className="text-slate-500 text-xs font-mono w-5 shrink-0">
                                    {index + 1}.
                                </span>
                                <span className="text-white font-mono text-sm">
                                    {showWords ? word : '•••••'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Copy Button - Always visible directly under word grid */}
                <button
                    onClick={handleCopy}
                    className="mt-3 w-full py-2 flex items-center justify-center space-x-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                >
                    {copied ? (
                        <>
                            <Icons.CheckMark size={16} className="text-green-400" />
                            <span className="text-green-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Icons.Copy size={16} className="text-slate-400" />
                            <span className="text-slate-300">Copy to clipboard</span>
                        </>
                    )}
                </button>

                {/* More Ways to Save - Accordion (always visible) */}
                <div className="mt-4">
                    <button
                        onClick={() => setShowBackupOptions(!showBackupOptions)}
                        className="w-full py-3 px-4 flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors"
                    >
                        <div className="flex items-center space-x-2">
                            <Icons.Shield className="text-teal-400" size={18} />
                            <span className="text-slate-300 font-medium">More Ways to Save</span>
                        </div>
                        <Icons.ChevronDown 
                            size={20} 
                            className={`text-slate-400 transition-transform duration-200 ${showBackupOptions ? 'rotate-180' : ''}`}
                        />
                    </button>

                    <div 
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                            showBackupOptions ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'
                        }`}
                    >
                        <div className="space-y-2 pt-1">
                            {/* 1. Download Card (PDF) - First */}
                            <button
                                onClick={handleDownloadPDF}
                                className="w-full p-3 flex items-center space-x-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl transition-colors text-left"
                            >
                                <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                                    <Icons.CreditCard className="text-teal-400" size={20} />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">Download Card</p>
                                    <p className="text-slate-500 text-xs">PDF with story + QR</p>
                                </div>
                            </button>

                            {/* 2. Download QR - Second */}
                            <button
                                onClick={handleDownloadQR}
                                className="w-full p-3 flex items-center space-x-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl transition-colors text-left"
                            >
                                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                    <Icons.QrCode className="text-orange-400" size={20} />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">Download QR</p>
                                    <p className="text-slate-500 text-xs">Scannable image</p>
                                </div>
                            </button>

                            {/* 3. Save to Nostr - Third (Purple) */}
                            <button
                                onClick={() => setShowNostrModal(true)}
                                className="w-full p-3 flex items-center space-x-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl transition-colors text-left"
                            >
                                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                    <Icons.Key className="text-purple-400" size={20} />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">Save to Nostr</p>
                                    <p className="text-slate-500 text-xs">Encrypted cloud sync</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Continue Section - Minimal friction */}
            <div className="p-4 space-y-2">
                {/* Reassurance note */}
                <p className="text-center text-slate-500 text-xs">
                    You can view these words anytime in your <span className="text-teal-400">Wallet settings</span>
                </p>

                <button
                    onClick={onComplete}
                    className="w-full py-3.5 bg-gradient-to-r from-brand-primary to-cyan-400 text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-brand-primary/20"
                >
                    <span>Continue</span>
                    <Icons.Next size={18} />
                </button>
            </div>

            {/* Nostr Backup Modal */}
            {showNostrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">Backup to Nostr</h3>
                                <button onClick={() => setShowNostrModal(false)} className="text-slate-400 hover:text-white">
                                    <Icons.Close size={24} />
                                </button>
                            </div>

                            {nostrBackupSuccess ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 mb-4">
                                        <Icons.CheckMark className="text-green-500" size={32} />
                                    </div>
                                    <p className="text-green-400 font-medium">Backup Complete!</p>
                                    <p className="text-slate-500 text-sm mt-1">Your encrypted backup is saved</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-3">
                                        <p className="text-xs text-teal-300">
                                            <strong>How it works:</strong> Your recovery phrase is encrypted with a password you choose, then stored on Nostr relays. Only you can decrypt it.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">Choose a password</label>
                                            <input
                                                type="password"
                                                value={nostrPassword}
                                                onChange={(e) => setNostrPassword(e.target.value)}
                                                placeholder="Enter password"
                                                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:border-teal-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">Confirm password</label>
                                            <input
                                                type="password"
                                                value={nostrPasswordConfirm}
                                                onChange={(e) => setNostrPasswordConfirm(e.target.value)}
                                                placeholder="Confirm password"
                                                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:border-teal-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {nostrBackupError && (
                                        <p className="text-red-400 text-xs">{nostrBackupError}</p>
                                    )}

                                    <p className="text-xs text-slate-500">
                                        ⚠️ Remember this password! You'll need it to recover your wallet.
                                    </p>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setShowNostrModal(false)}
                                            className="flex-1 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleNostrBackup}
                                            disabled={isBackingUp || !nostrPassword || !nostrPasswordConfirm}
                                            className="flex-1 py-3 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-400 transition-colors disabled:opacity-50"
                                        >
                                            {isBackingUp ? 'Backing up...' : 'Backup'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Simplified Mnemonic Display (no backup options)
 * For showing existing mnemonic in settings/profile
 */
export const MnemonicDisplay: React.FC<{
    mnemonic: string;
    onClose?: () => void;
}> = ({ mnemonic, onClose }) => {
    const [showWords, setShowWords] = useState(false);
    const [copied, setCopied] = useState(false);
    const words = splitMnemonicToWords(mnemonic);

    const handleCopy = () => {
        navigator.clipboard.writeText(mnemonic);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Warning */}
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start space-x-2">
                    <Icons.Shield className="text-red-400 shrink-0 mt-0.5" size={18} />
                    <p className="text-xs text-red-300">
                        <strong>Never share these words!</strong> Anyone with them can steal your funds.
                    </p>
                </div>
            </div>

            {/* Words Grid */}
            <div className="relative">
                {!showWords && (
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-md rounded-xl z-10 cursor-pointer"
                        onClick={() => setShowWords(true)}
                    >
                        <div className="text-center">
                            <Icons.Eye className="mx-auto text-slate-400 mb-2" size={24} />
                            <p className="text-slate-300 text-sm">Tap to reveal</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                    {words.map((word, index) => (
                        <div
                            key={index}
                            className="flex items-center bg-slate-900/50 rounded-lg p-2 border border-slate-700"
                        >
                            <span className="text-slate-500 text-xs font-mono w-5 shrink-0">
                                {index + 1}.
                            </span>
                            <span className="text-white font-mono text-xs">
                                {showWords ? word : '•••••'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2">
                {showWords && (
                    <button
                        onClick={handleCopy}
                        className="flex-1 py-2 flex items-center justify-center space-x-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                    >
                        {copied ? (
                            <>
                                <Icons.CheckMark size={16} className="text-green-400" />
                                <span className="text-green-400">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Icons.Copy size={16} className="text-slate-400" />
                                <span className="text-slate-300">Copy</span>
                            </>
                        )}
                    </button>
                )}

                {showWords && (
                    <button
                        onClick={() => setShowWords(false)}
                        className="flex-1 py-2 flex items-center justify-center space-x-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                    >
                        <Icons.EyeOff className="text-slate-400" size={16} />
                        <span className="text-slate-300">Hide</span>
                    </button>
                )}

                {onClose && (
                    <button
                        onClick={onClose}
                        className="py-2 px-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm text-slate-300"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * Mnemonic Recovery Input
 * For users recovering with their seed phrase
 */
export const MnemonicRecoveryInput: React.FC<{
    onSubmit: (mnemonic: string) => void;
    onCancel: () => void;
    error?: string;
    isLoading?: boolean;
}> = ({ onSubmit, onCancel, error, isLoading }) => {
    const [words, setWords] = useState<string[]>(Array(12).fill(''));
    const [pasteMode, setPasteMode] = useState(false);
    const [pasteInput, setPasteInput] = useState('');

    const handleWordChange = (index: number, value: string) => {
        const newWords = [...words];
        newWords[index] = value.trim().toLowerCase();
        setWords(newWords);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const pastedWords = pastedText.trim().toLowerCase().split(/\s+/);

        if (pastedWords.length === 12 || pastedWords.length === 24) {
            if (pastedWords.length === 12) {
                setWords(pastedWords);
            } else {
                setWords(pastedWords.slice(0, 12));
            }
        }
    };

    const handlePasteSubmit = () => {
        const pastedWords = pasteInput.trim().toLowerCase().split(/\s+/);
        if (pastedWords.length >= 12) {
            setWords(pastedWords.slice(0, 12));
            setPasteMode(false);
        }
    };

    const handleSubmit = () => {
        const mnemonic = words.join(' ');
        onSubmit(mnemonic);
    };

    const isComplete = words.every(w => w.length > 0);

    return (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto mb-3 bg-purple-500/20 rounded-full flex items-center justify-center border-2 border-purple-500">
                    <Icons.Key className="text-purple-500" size={28} />
                </div>
                <h3 className="text-lg font-bold text-white">Enter Recovery Phrase</h3>
                <p className="text-slate-400 text-sm">Enter your 12-word recovery phrase</p>
            </div>

            {/* Toggle between grid and paste */}
            <div className="flex justify-center space-x-2 mb-4">
                <button
                    onClick={() => setPasteMode(false)}
                    className={`px-4 py-1.5 rounded-full text-sm transition-colors ${!pasteMode
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                        }`}
                >
                    Word by Word
                </button>
                <button
                    onClick={() => setPasteMode(true)}
                    className={`px-4 py-1.5 rounded-full text-sm transition-colors ${pasteMode
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                        }`}
                >
                    Paste All
                </button>
            </div>

            {pasteMode ? (
                <div className="space-y-3">
                    <textarea
                        value={pasteInput}
                        onChange={(e) => setPasteInput(e.target.value)}
                        placeholder="Paste your 12 words here..."
                        className="w-full h-32 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-purple-500 focus:outline-none resize-none"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <button
                        onClick={handlePasteSubmit}
                        disabled={!pasteInput.trim()}
                        className="w-full py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                        Parse Words
                    </button>
                </div>
            ) : (
                <div
                    className="grid grid-cols-3 gap-2"
                    onPaste={handlePaste}
                >
                    {words.map((word, index) => (
                        <div key={index} className="flex items-center space-x-1">
                            <span className="text-slate-500 text-xs font-mono w-5 shrink-0">
                                {index + 1}.
                            </span>
                            <input
                                type="text"
                                value={word}
                                onChange={(e) => handleWordChange(index, e.target.value)}
                                placeholder="word"
                                className="flex-1 px-2 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                            />
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="flex items-center space-x-2 text-red-400 text-sm">
                    <Icons.Close size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2 pt-2">
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!isComplete || isLoading}
                    className="flex-1 py-3 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Recovering...' : 'Recover Account'}
                </button>
            </div>
        </div>
    );
};

export default MnemonicBackup;
