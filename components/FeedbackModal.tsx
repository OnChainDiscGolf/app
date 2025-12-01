import React, { useState } from 'react';
import { Icons } from './Icons';
import { Button } from './Button';
import { sendFeedback, canSendFeedback, FeedbackPayload } from '../services/feedbackService';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultType?: 'bug' | 'feedback' | 'feature';
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
    isOpen, 
    onClose,
    defaultType = 'feedback'
}) => {
    const [type, setType] = useState<'bug' | 'feedback' | 'feature'>(defaultType);
    const [message, setMessage] = useState('');
    const [includeLogs, setIncludeLogs] = useState(true);
    const [includeDeviceInfo, setIncludeDeviceInfo] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null);

    if (!isOpen) return null;

    const canSend = canSendFeedback();

    const handleSend = async () => {
        if (!message.trim()) return;
        
        setIsSending(true);
        setSendResult(null);

        const payload: FeedbackPayload = {
            type,
            message: message.trim(),
            includeLogs,
            includeDeviceInfo,
            currentPath: window.location.pathname
        };

        const result = await sendFeedback(payload);
        setSendResult(result);
        setIsSending(false);

        if (result.success) {
            // Clear form and close after short delay
            setTimeout(() => {
                setMessage('');
                setSendResult(null);
                onClose();
            }, 2000);
        }
    };

    const handleClose = () => {
        setMessage('');
        setSendResult(null);
        onClose();
    };

    const typeConfig = {
        bug: {
            icon: <Icons.Bug size={20} />,
            label: 'Bug Report',
            placeholder: 'Describe the bug. What did you expect to happen? What actually happened?',
            color: 'text-red-400',
            bgColor: 'bg-red-500/20 border-red-500/30'
        },
        feedback: {
            icon: <Icons.Feedback size={20} />,
            label: 'Feedback',
            placeholder: 'Share your thoughts, suggestions, or anything else on your mind...',
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20 border-blue-500/30'
        },
        feature: {
            icon: <Icons.Zap size={20} />,
            label: 'Feature Request',
            placeholder: 'Describe the feature you\'d like to see. How would it help you?',
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/20 border-amber-500/30'
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Icons.Feedback size={24} className="text-brand-primary" />
                        Send Feedback
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <Icons.Close size={24} />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    
                    {/* Success State */}
                    {sendResult?.success && (
                        <div className="flex flex-col items-center justify-center py-8 animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
                                <Icons.CheckMark size={32} className="text-white" strokeWidth={3} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
                            <p className="text-slate-400 text-center text-sm">
                                Your feedback has been sent securely via Nostr.
                            </p>
                        </div>
                    )}

                    {/* Error State */}
                    {sendResult && !sendResult.success && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                                <Icons.Close size={20} className="text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-400 font-bold text-sm">Failed to send</p>
                                    <p className="text-red-300/80 text-xs mt-1">{sendResult.error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Not logged in warning */}
                    {!canSend && !sendResult && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Icons.Shield size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-amber-400 font-bold text-sm">Profile Required</p>
                                    <p className="text-amber-300/80 text-xs mt-1">
                                        You need to create a profile or login to send feedback. 
                                        Your feedback is sent encrypted via Nostr.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form - hide after success */}
                    {!sendResult?.success && (
                        <>
                            {/* Type Selector */}
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    What's this about?
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['bug', 'feedback', 'feature'] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setType(t)}
                                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                                type === t 
                                                    ? typeConfig[t].bgColor 
                                                    : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-80'
                                            }`}
                                        >
                                            <span className={type === t ? typeConfig[t].color : 'text-slate-400'}>
                                                {typeConfig[t].icon}
                                            </span>
                                            <span className={`text-xs mt-1 font-medium ${type === t ? 'text-white' : 'text-slate-400'}`}>
                                                {typeConfig[t].label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message Input */}
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Your Message
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder={typeConfig[type].placeholder}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-brand-primary outline-none resize-none h-32"
                                    disabled={isSending}
                                />
                                <div className="text-right mt-1">
                                    <span className={`text-xs ${message.length > 1000 ? 'text-red-400' : 'text-slate-500'}`}>
                                        {message.length}/1000
                                    </span>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                                    Include with feedback
                                </label>
                                
                                <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={includeLogs}
                                        onChange={(e) => setIncludeLogs(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand-primary focus:ring-brand-primary focus:ring-offset-0"
                                    />
                                    <div>
                                        <p className="text-white text-sm font-medium">App Logs</p>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            Recent errors, navigation history, and app state. Helps debug issues.
                                        </p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={includeDeviceInfo}
                                        onChange={(e) => setIncludeDeviceInfo(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand-primary focus:ring-brand-primary focus:ring-offset-0"
                                    />
                                    <div>
                                        <p className="text-white text-sm font-medium">Device Info</p>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            Browser, platform, screen size. Helps with compatibility issues.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {/* Privacy Note */}
                            <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700">
                                <div className="flex items-start gap-2">
                                    <Icons.Shield size={14} className="text-brand-primary shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        <strong className="text-slate-300">Private & Encrypted:</strong> Your feedback is sent via Nostr Gift Wrap (NIP-59), 
                                        meaning only the developer can read it. No email, no third parties.
                                    </p>
                                </div>
                            </div>

                            {/* Send Button */}
                            <div className="pt-2">
                                <Button
                                    fullWidth
                                    onClick={handleSend}
                                    disabled={!message.trim() || message.length > 1000 || isSending || !canSend}
                                    className={isSending ? 'opacity-80' : ''}
                                >
                                    {isSending ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Sending...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2">
                                            <Icons.SendMessage size={18} />
                                            <span>Send Feedback</span>
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Compact button to place at bottom of settings views
interface FeedbackButtonProps {
    onClick: () => void;
    className?: string;
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({ onClick, className = '' }) => {
    return (
        <div className={`mt-auto pt-8 pb-4 ${className}`}>
            <div className="border-t border-slate-800 pt-6">
                <p className="text-xs text-slate-500 text-center mb-3">
                    Found a bug? Have feedback?
                </p>
                <button
                    onClick={onClick}
                    className="w-full p-3 flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-slate-400 hover:text-white"
                >
                    <Icons.Feedback size={18} />
                    <span className="text-sm font-medium">Send Feedback</span>
                </button>
            </div>
        </div>
    );
};

