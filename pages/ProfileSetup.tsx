/**
 * @file ProfileSetup.tsx
 *
 * Post-authentication profile setup page.
 *
 * Shown after a user creates an account or logs in for the first time.
 * Allows setting a display name, uploading a profile picture (NIP-98 authenticated),
 * and entering an optional PDGA number.
 *
 * Also displays the user's npub (public key) and nsec (private key) with
 * copy-to-clipboard functionality and an educational "What are these?" modal
 * explaining Nostr key concepts.
 *
 * If the user is still in guest mode, this page converts them to a full account
 * before saving the profile and navigating to the scorecard or home.
 *
 * Route: /profile-setup
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { nip19 } from 'nostr-tools';
import { getSession, uploadProfileImage } from '../services/nostrService';

/**
 * Profile setup page -- set display name, avatar, and PDGA# after account creation.
 */
export const ProfileSetup: React.FC = () => {
    const { userProfile, updateUserProfile, currentUserPubkey, activeRound, createAccount, isGuest, authSource, authMethod } = useApp();
    const location = useLocation();
    const isRecovery = (location.state as any)?.isRecovery === true;
    const [name, setName] = useState(userProfile.name || 'Disc Golfer');
    const [picture, setPicture] = useState(userProfile.picture || '');
    const [pdga, setPdga] = useState(userProfile.pdga || '');
    const [showKeyInfo, setShowKeyInfo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [copiedKeyType, setCopiedKeyType] = useState<'npub' | 'nsec' | null>(null);
    const navigate = useNavigate();

    const npub = currentUserPubkey ? nip19.npubEncode(currentUserPubkey) : '';

    const getPrivateString = () => {
        const session = getSession();
        if (session && session.sk) {
            return nip19.nsecEncode(session.sk);
        }
        return '';
    };

    const nsec = getPrivateString();

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const url = await uploadProfileImage(file);
            setPicture(url);
        } catch (error) {
            alert("Image upload failed. Please try again.");
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCopyNpub = () => {
        navigator.clipboard.writeText(npub);
        setCopiedKeyType('npub');
        setTimeout(() => setCopiedKeyType(null), 2000);
    };

    const handleCopyNsec = () => {
        navigator.clipboard.writeText(nsec);
        setCopiedKeyType('nsec');
        setTimeout(() => setCopiedKeyType(null), 2000);
    };

    const handleContinue = async () => {
        // If user is still a guest, convert them to a full user first
        if (isGuest) {
            await createAccount();
        }

        // Update profile with name, picture, and PDGA
        await updateUserProfile({ 
            ...userProfile, 
            name, 
            picture,
            pdga: pdga || undefined  // Only include if set
        });

        // Navigate to root - HomeOrOnboarding will show Home (Play tab) for authenticated users
        navigate('/', { replace: true });
    };

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col">
            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4">
                <div className="max-w-md mx-auto">
                    <h1 className="text-3xl font-bold text-white">
                        {isRecovery
                            ? (authSource === 'mnemonic' ? 'Account Recovered!' : authMethod === 'amber' ? 'Connected!' : 'Signed In!')
                            : 'Welcome!'}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {isRecovery ? 'Confirm your profile details' : "Let's set up your profile"}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 max-w-md mx-auto w-full space-y-6 nav-safe-bottom">

                {/* Recovery Status Summary */}
                {isRecovery && (
                    <div className={`p-4 rounded-xl border ${
                        authSource === 'mnemonic'
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : authMethod === 'amber'
                            ? 'bg-orange-500/10 border-orange-500/30'
                            : 'bg-purple-500/10 border-purple-500/30'
                    }`}>
                        <div className="flex items-center space-x-3 mb-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                authSource === 'mnemonic' ? 'bg-amber-500/20' : authMethod === 'amber' ? 'bg-orange-500/20' : 'bg-purple-500/20'
                            }`}>
                                {authSource === 'mnemonic'
                                    ? <Icons.Key size={16} className="text-amber-500" />
                                    : authMethod === 'amber'
                                    ? <Icons.Android size={16} className="text-orange-500" />
                                    : <Icons.Shield size={16} className="text-purple-500" />}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">
                                    {authSource === 'mnemonic' ? 'Full Recovery' : authMethod === 'amber' ? 'Amber Signer' : 'Nostr Key Login'}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {authSource === 'mnemonic'
                                        ? 'Your identity and Bitcoin wallet have been restored'
                                        : authMethod === 'amber'
                                        ? 'Signed in via Amber. Lightning wallet requires separate setup.'
                                        : 'Your Nostr identity is ready. Lightning wallet requires separate setup.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-full border border-emerald-500/30">
                                Cashu ready
                            </span>
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded-full border border-purple-500/30">
                                NWC ready
                            </span>
                            {authSource === 'mnemonic' ? (
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded-full border border-blue-500/30">
                                    Lightning restored
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 text-[10px] rounded-full border border-slate-500/30">
                                    Lightning — setup needed
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Profile Picture */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-300 uppercase tracking-wide">Profile Picture</label>
                    <div className="flex flex-col items-center space-y-3">
                        <div className="relative">
                            <label htmlFor="picture-upload" className="cursor-pointer group">
                                {picture ? (
                                    <img
                                        src={picture}
                                        alt="Profile"
                                        className="w-28 h-28 rounded-full object-cover border-4 border-brand-primary group-hover:border-brand-accent transition-colors shadow-xl"
                                    />
                                ) : (
                                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-slate-700 group-hover:border-brand-primary flex items-center justify-center transition-all shadow-xl">
                                        <Icons.User className="text-slate-500 group-hover:text-brand-primary transition-colors" size={48} />
                                    </div>
                                )}
                                {/* Camera Icon Overlay */}
                                <div className="absolute bottom-0 right-0 bg-brand-primary rounded-full p-2 shadow-lg group-hover:bg-brand-accent transition-colors">
                                    {isUploading ? (
                                        <div className="animate-spin">
                                            <Icons.Refresh size={16} className="text-black" />
                                        </div>
                                    ) : (
                                        <Icons.Camera size={16} className="text-black" />
                                    )}
                                </div>
                            </label>
                            <input
                                id="picture-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>
                        <p className="text-xs text-slate-500 text-center">Tap to upload from your device</p>
                    </div>
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300 uppercase tracking-wide">Your Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:border-brand-primary focus:outline-none"
                    />
                </div>

                {/* PDGA Number Input */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300 uppercase tracking-wide flex items-center space-x-2">
                        <span>PDGA Number</span>
                        <span className="text-xs font-normal text-slate-500 normal-case">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={pdga}
                        onChange={(e) => {
                            // Only allow digits
                            const value = e.target.value.replace(/\D/g, '');
                            setPdga(value);
                        }}
                        placeholder="e.g. 12345"
                        maxLength={7}
                        inputMode="numeric"
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:border-brand-primary focus:outline-none"
                    />
                    <p className="text-xs text-slate-500">
                        Your PDGA membership number. Other players can find you by searching this number.
                    </p>
                </div>

                {/* Key Explanation — hidden for Amber users (keys are in Amber app) */}
                {authMethod === 'amber' ? (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                            <Icons.Android className="text-orange-500" size={20} />
                            <div>
                                <p className="text-sm font-bold text-white">Keys managed by Amber</p>
                                <p className="text-xs text-slate-400">Your private key is stored securely in the Amber app</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowKeyInfo(!showKeyInfo)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center space-x-2">
                                <Icons.Key className="text-purple-500" size={20} />
                                <h3 className="font-bold text-white">Your Keys</h3>
                            </div>
                            <Icons.ChevronDown
                                size={20}
                                className={`transition-transform duration-200 text-slate-400 ${showKeyInfo ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {showKeyInfo && (
                            <div className="px-4 pb-4 space-y-4 text-sm animate-in slide-in-from-top duration-200">
                                <p className="text-slate-300 leading-relaxed">
                                    <strong className="text-white">Your identity, your control.</strong> Think of Nostr like having your own house key instead of renting an apartment from a landlord who can kick you out anytime.
                                </p>

                                <p className="text-slate-300 leading-relaxed">
                                    <strong className="text-purple-400">With Nostr, YOU own your identity.</strong> You have a private key (like a master password) that proves you're you. No company can take it away.
                                </p>

                                {/* Public Key */}
                                <div className="bg-black/30 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">Public Key</p>
                                        <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">SAFE TO SHARE</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <code className="flex-1 font-mono text-xs text-brand-primary break-all">{npub.slice(0, 40)}...</code>
                                        <button
                                            onClick={handleCopyNpub}
                                            className="p-2 hover:bg-slate-800 rounded transition-colors text-brand-primary shrink-0"
                                        >
                                            {copiedKeyType === 'npub' ? <Icons.CheckMark size={14} /> : <Icons.Copy size={14} />}
                                        </button>
                                    </div>
                                    <p className="text-slate-400 text-xs italic">
                                        Like your email address - anyone can use this to find you or send you sats!
                                    </p>
                                </div>

                                {/* Private Key */}
                                <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-orange-300 text-xs font-bold uppercase tracking-wide">Private Key</p>
                                        <span className="text-[10px] text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-full">KEEP SECRET</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <code className="flex-1 font-mono text-xs text-orange-300 break-all">{nsec.slice(0, 40)}...</code>
                                        <button
                                            onClick={handleCopyNsec}
                                            className="p-2 hover:bg-orange-900/30 rounded transition-colors text-orange-400 shrink-0"
                                        >
                                            {copiedKeyType === 'nsec' ? <Icons.CheckMark size={14} /> : <Icons.Copy size={14} />}
                                        </button>
                                    </div>
                                    <p className="text-orange-200/80 text-xs">
                                        <strong>This controls your funds.</strong> Losing it means losing your money forever. Save it somewhere safe!
                                    </p>
                                </div>

                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 space-y-2">
                                    <p className="text-purple-300 text-xs leading-relaxed">
                                        💡 <strong>One key, infinite apps.</strong> Your identity travels with you across any Nostr app:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <a
                                            href="https://damus.io"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30"
                                        >
                                            Damus
                                        </a>
                                        <a
                                            href="https://primal.net"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30"
                                        >
                                            Primal
                                        </a>
                                        <a
                                            href="https://fountain.fm"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30"
                                        >
                                            Fountain
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Continue Button */}
                <button
                    onClick={handleContinue}
                    disabled={!name.trim()}
                    className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-accent transition-all transform hover:scale-[1.02] shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};
