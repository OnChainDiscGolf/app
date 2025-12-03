
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { Button } from '../components/Button';
import { FeedbackModal, FeedbackButton } from '../components/FeedbackModal';
import { getSession, getRelays, addRelay, removeRelay, resetRelays, uploadProfileImage, getMagicLightningAddress } from '../services/nostrService';
import { retrieveMnemonicEncrypted } from '../services/mnemonicService';
import { downloadWalletCardPDF } from '../services/backupService';
import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';
import { DiscGolfBasketLoader } from '../components/DiscGolfBasketLoader';

export const Profile: React.FC = () => {
    const {
        userProfile, userStats, updateUserProfile, resetRound, refreshStats,
        isAuthenticated, isGuest, authMethod, authSource, performLogout, isProfileLoading,
        loginNsec, loginNip46, loginAmber, createAccountFromMnemonic, currentUserPubkey
    } = useApp();

    const navigate = useNavigate();

    // Auth View States
    const [authView, setAuthView] = useState<'login' | 'create'>('create');
    const [nsecInput, setNsecInput] = useState('');
    const [bunkerInput, setBunkerInput] = useState('');
    const [authError, setAuthError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Authenticated View States
    const [view, setView] = useState<'main' | 'settings'>('main');
    const [isEditing, setIsEditing] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    const lightningAddress = userProfile.lud16 || getMagicLightningAddress(currentUserPubkey);

    const formatLightningAddress = (addr: string) => {
        if (!addr) return '';
        const parts = addr.split('@');
        if (parts.length !== 2) return addr.length > 20 ? addr.substring(0, 20) + '...' : addr;

        const [user, domain] = parts;
        if (user.length <= 12) return addr;
        return `${user.substring(0, 6)}...${user.substring(user.length - 6)}@${domain}`;
    };

    const handleCopyAddress = () => {
        if (!lightningAddress) return;
        navigator.clipboard.writeText(lightningAddress);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
    };
    const [showSecrets, setShowSecrets] = useState(false);
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [helpModal, setHelpModal] = useState<{ isOpen: boolean, title: string, text: string } | null>(null);
    const [imgError, setImgError] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [copiedKeyType, setCopiedKeyType] = useState<'npub' | 'nsec' | 'mnemonic' | null>(null);
    const [copiedLud16, setCopiedLud16] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Get stored mnemonic for display (only for mnemonic-based accounts)
    const storedMnemonic = authSource === 'mnemonic' ? retrieveMnemonicEncrypted(currentUserPubkey) : null;

    const [formData, setFormData] = useState({
        name: '',
        lud16: '',
        about: '',
        nip05: '',
        picture: '',
        pdga: ''
    });

    // Settings State
    const [relayList, setRelayList] = useState<string[]>([]);
    const [newRelayUrl, setNewRelayUrl] = useState('');
    const [openSection, setOpenSection] = useState<string | null>(null);

    // Logout Hold State
    const [holdProgress, setHoldProgress] = useState(0);
    const holdIntervalRef = useRef<any>(null);
    const [isExploding, setIsExploding] = useState(false);

    const toggleSection = (section: string) => {
        if (openSection === section) {
            setOpenSection(null);
        } else {
            setOpenSection(section);
        }
    };

    const startHold = () => {
        if (holdIntervalRef.current) return;
        setHoldProgress(0);
        // 1.5 seconds to fill
        // Update every 15ms -> 100 steps
        // 100% / 100 steps = 1% per step
        holdIntervalRef.current = setInterval(() => {
            setHoldProgress(prev => {
                if (prev >= 100) {
                    clearInterval(holdIntervalRef.current);
                    holdIntervalRef.current = null;
                    handleLogoutSuccess();
                    return 100;
                }
                return prev + 1.5;
            });
        }, 15);
    };

    const stopHold = () => {
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
        setHoldProgress(0);
    };

    const handleLogoutSuccess = () => {
        setShowLogoutConfirm(false);
        setIsExploding(true);
        setTimeout(() => {
            setIsExploding(false);
            performLogout();
        }, 2000);
    };

    useEffect(() => {
        if (isAuthenticated && !isProfileLoading) {
            setFormData({
                name: userProfile.name,
                lud16: userProfile.lud16 || getMagicLightningAddress(currentUserPubkey),
                about: userProfile.about || '',
                nip05: userProfile.nip05 || '',
                picture: userProfile.picture || '',
                pdga: userProfile.pdga || ''
            });
            refreshStats();
        }
        setRelayList(getRelays());
    }, [userProfile, isAuthenticated, isProfileLoading]);

    // Reset image error if the URL changes (e.g. after a fetch)
    useEffect(() => {
        setImgError(false);
    }, [userProfile.picture, formData.picture]);

    // Listen for "Pop to Root" navigation event
    useEffect(() => {
        const handlePopToRoot = (e: CustomEvent) => {
            if (e.detail.path === '/profile') {
                setView('main');
            }
        };

        window.addEventListener('popToRoot', handlePopToRoot as EventListener);
        return () => window.removeEventListener('popToRoot', handlePopToRoot as EventListener);
    }, []);

    // Handlers

    const handleLogin = async () => {
        setAuthError('');
        setIsLoading(true);
        try {
            await loginNsec(nsecInput);
            setNsecInput('');
        } catch (e) {
            setAuthError('Invalid nsec. Please check and try again.');
        }
        setIsLoading(false);
    };

    const handleNip46Login = async () => {
        setAuthError('');
        setIsLoading(true);
        try {
            await loginNip46(bunkerInput);
        } catch (e) {
            setAuthError(e instanceof Error ? e.message : 'Could not connect to Remote Signer.');
        }
        setIsLoading(false);
    };

    const handleCreate = async () => {
        setAuthError('');
        setIsLoading(true);
        try {
            // Generate new account from 12-word mnemonic (BIP-89)
            // This creates both Nostr keys (NIP-06) and Breez wallet seed
            const { mnemonic } = await createAccountFromMnemonic();
            console.log("✅ New account created with mnemonic backup");
            
            // Set default bio & open edit mode on success
            setFormData(prev => ({ ...prev, about: "I <3 OnChainDiscGolf.com" }));
            setIsEditing(true);
        } catch (e) {
            console.error("Failed to create account:", e);
            setAuthError('Failed to generate keys.');
        }
        setIsLoading(false);
    };

    const handleSaveProfile = () => {
        updateUserProfile({
            ...userProfile,
            name: formData.name,
            lud16: formData.lud16,
            about: formData.about,
            nip05: formData.nip05,
            picture: formData.picture,
            pdga: formData.pdga || undefined
        });
        setIsEditing(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const url = await uploadProfileImage(file);
            setFormData(prev => ({ ...prev, picture: url }));
            setImgError(false);
        } catch (error) {
            alert("Image upload failed. Please try again.");
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCopyNpub = () => {
        try {
            const npub = nip19.npubEncode(currentUserPubkey);
            navigator.clipboard.writeText(npub);
            setCopiedKeyType('npub');
            setTimeout(() => setCopiedKeyType(null), 2000);
        } catch (e) { }
    };

    const getPrivateString = () => {
        const session = getSession();
        if (session && session.sk) {
            return nip19.nsecEncode(session.sk);
        }
        return '';
    };

    const handleCopyNsec = () => {
        const nsec = getPrivateString();
        if (nsec) {
            navigator.clipboard.writeText(nsec);
            setCopiedKeyType('nsec');
            setTimeout(() => setCopiedKeyType(null), 2000);
        }
    };

    const handleCopyMnemonic = () => {
        if (storedMnemonic) {
            navigator.clipboard.writeText(storedMnemonic);
            setCopiedKeyType('mnemonic');
            setTimeout(() => setCopiedKeyType(null), 2000);
        }
    };

    const handleCopyLud16 = () => {
        if (formData.lud16) {
            navigator.clipboard.writeText(formData.lud16);
            setCopiedLud16(true);
            setTimeout(() => setCopiedLud16(false), 2000);
        }
    };

    const openHelp = (title: string, text: string) => {
        setHelpModal({ isOpen: true, title, text });
    };

    const handleLogout = () => {
        setShowSecrets(false); // Ensure secrets are hidden by default when opening modal
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        performLogout();
        setShowLogoutConfirm(false);
    };

    // Relay Handlers
    const handleAddRelay = () => {
        if (newRelayUrl) {
            addRelay(newRelayUrl);
            setRelayList(getRelays());
            setNewRelayUrl('');
        }
    };

    const handleRemoveRelay = (url: string) => {
        removeRelay(url);
        setRelayList(getRelays());
    };

    const handleResetRelays = () => {
        if (confirm("Reset relays to default list?")) {
            resetRelays();
            setRelayList(getRelays());
        }
    };


    // --- GUEST / LOGIN STATE ---
    if (isGuest) {
        return (
            <div className="p-6 pt-8 flex flex-col h-full pb-24 overflow-y-auto">
                {/* Header with gradient icon */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative mb-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 via-purple-600/30 to-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30 shadow-[0_0_30px_rgba(147,51,234,0.3)]">
                            <Icons.Key size={36} className="text-purple-400" />
                        </div>
                        {/* Subtle glow ring */}
                        <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-xl -z-10"></div>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Welcome!</h1>
                    <p className="text-slate-400 text-center mt-2 text-sm max-w-xs leading-relaxed">
                        Create your profile to save scores and compete with friends, or log in if you already have one.
                    </p>
                    <p className="text-slate-500 text-center mt-2 text-xs">
                        Powered by{' '}
                        <button
                            onClick={() => openHelp(
                                'What is Nostr?',
                                'nostr-intro'
                            )}
                            className="text-purple-400 hover:text-purple-300 underline transition-colors font-medium"
                        >
                            Nostr
                        </button>
                    </p>
                </div>

                {/* Wallet-style toggle pill */}
                <div className="flex bg-black/30 backdrop-blur-sm p-1 rounded-xl mb-6 border border-white/10">
                    <button
                        onClick={() => {
                            setAuthView('create');
                            setAuthError('');
                        }}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${
                            authView === 'create' 
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.2)]' 
                                : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                    >
                        Create Profile
                    </button>
                    <button
                        onClick={() => {
                            setAuthView('login');
                            setAuthError('');
                        }}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${
                            authView === 'login' 
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.2)]' 
                                : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                    >
                        Login
                    </button>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    {authView === 'create' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* Create Profile Card - Wallet style */}
                            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 p-6 rounded-2xl border border-white/10 text-center backdrop-blur-sm shadow-xl">
                                <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
                                    <Icons.Shield size={28} className="text-purple-400" />
                                </div>
                                <h3 className="font-bold text-lg text-white mb-2">First Time Here?</h3>
                                <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                                    We'll generate a <span className="text-purple-400 font-medium">12-word backup phrase</span> that secures both your identity and your Bitcoin wallet.
                                </p>
                                
                                {/* Info callout */}
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-5 text-left">
                                    <div className="flex items-start space-x-2">
                                        <Icons.Bitcoin size={16} className="text-orange-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-orange-200/80 leading-relaxed">
                                            <span className="text-orange-400 font-bold">One backup, everything secured.</span> Your seed phrase backs up your profile AND your sats.
                                        </p>
                                    </div>
                                </div>
                                
                                <Button fullWidth onClick={handleCreate} disabled={isLoading}>
                                    {isLoading ? 'Generating Keys...' : 'Create Profile'}
                                </Button>
                                
                                <p className="text-[10px] text-slate-500 mt-3">
                                    No email or password required
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Seed Phrase Recovery Option - Primary */}
                            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 p-5 rounded-2xl border border-purple-500/20 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                                        <Icons.Key size={18} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-white font-bold block">Seed Phrase or Private Key</label>
                                        <span className="text-xs text-slate-500">12-word phrase or nsec</span>
                                    </div>
                                </div>
                                <div className="relative mb-3">
                                    <input
                                        type="password"
                                        placeholder="nsec1... or 12 words separated by spaces"
                                        value={nsecInput}
                                        onChange={e => setNsecInput(e.target.value)}
                                        className="w-full bg-black/30 border border-slate-700 rounded-xl p-4 pl-4 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none placeholder:text-slate-600 transition-all"
                                    />
                                </div>
                                <Button fullWidth onClick={handleLogin} disabled={!nsecInput || isLoading}>
                                    {isLoading ? 'Verifying...' : 'Restore Account'}
                                </Button>

                                {/* Error message */}
                                {authError && (
                                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center text-sm animate-in fade-in slide-in-from-top-2">
                                        {authError}
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="relative flex items-center py-1">
                                <div className="flex-grow border-t border-slate-800"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-600 text-xs font-bold uppercase tracking-wider">Advanced</span>
                                <div className="flex-grow border-t border-slate-800"></div>
                            </div>

                            {/* Advanced Options - Collapsed style */}
                            <div className="space-y-3">
                                {/* Amber Button */}
                                <button
                                    onClick={() => loginAmber()}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-green-500/30 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-9 h-9 bg-green-500/20 rounded-lg flex items-center justify-center">
                                            <Icons.Android size={18} className="text-green-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">Amber Signer</p>
                                            <p className="text-xs text-slate-500">Android only</p>
                                        </div>
                                    </div>
                                    <Icons.Next size={16} className="text-slate-500 group-hover:text-green-400 transition-colors" />
                                </button>

                                {/* NIP-46 Button */}
                                <button
                                    onClick={() => {
                                        // Toggle NIP-46 input
                                        if (bunkerInput === '') {
                                            setBunkerInput(' '); // Show input
                                        }
                                    }}
                                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/30 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                            <Icons.Link size={18} className="text-blue-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">Remote Signer</p>
                                            <p className="text-xs text-slate-500">NIP-46 bunker</p>
                                        </div>
                                    </div>
                                    <Icons.Next size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                                </button>

                                {/* NIP-46 Input (shown when clicked) */}
                                {bunkerInput && (
                                    <div className="animate-in slide-in-from-top-2 duration-200 space-y-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="bunker://..."
                                                value={bunkerInput === ' ' ? '' : bunkerInput}
                                                onChange={e => setBunkerInput(e.target.value)}
                                                className="w-full bg-black/30 border border-slate-600 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button 
                                                fullWidth 
                                                variant="secondary" 
                                                onClick={handleNip46Login} 
                                                disabled={bunkerInput.trim().length < 5 || isLoading}
                                            >
                                                {isLoading ? 'Connecting...' : 'Connect'}
                                            </Button>
                                            <button
                                                onClick={() => setBunkerInput('')}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 text-sm transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Help Modal */}
                {helpModal && helpModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[75vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
                            <button
                                onClick={() => setHelpModal(null)}
                                className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white"
                            >
                                <Icons.Close size={20} />
                            </button>

                            <div className="p-6 border-b border-slate-800">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                        <Icons.Help size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-white">{helpModal.title}</h2>
                                </div>
                            </div>

                            {helpModal.text === 'nostr-intro' ? (
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                        <p>
                                            <strong className="text-white text-base">Your identity, your control.</strong>
                                        </p>
                                        <p>
                                            Nostr is a protocol that lets YOU own your online identity. Unlike traditional apps where <strong className="text-red-400">companies own and control your account</strong>, with Nostr you have a <strong className="text-purple-400">private key (nsec)</strong> that proves you're you.
                                        </p>

                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                            <p className="text-red-200 font-bold text-xs mb-2">IMPORTANT: Keep Your nsec Safe!</p>
                                            <p className="text-red-100 text-xs">
                                                Your nsec is like a master password. Anyone with it can access your profile AND your funds in this app. Save it somewhere secure - if you lose it, you lose everything.
                                            </p>
                                        </div>

                                        <p className="text-brand-primary font-bold">
                                            In this app, your Bitcoin wallet is tied to your nsec. Guard it carefully!
                                        </p>

                                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                            <p className="text-purple-200 font-bold text-xs mb-2">One Key, Infinite Apps</p>
                                            <p className="text-purple-100 text-xs">
                                                You can use your nsec to log into other Nostr apps and services. Your profile, friends, and content follow you everywhere.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-white font-bold text-sm">Try Popular Nostr Apps:</p>
                                            <div className="flex flex-wrap gap-2">
                                                <a href="https://primal.net" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Primal
                                                </a>
                                                <a href="https://damus.io" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Damus
                                                </a>
                                                <a href="https://iris.to" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Iris
                                                </a>
                                                <a href="https://zap.stream" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Zap.Stream
                                                </a>
                                                <a href="https://zapstore.dev" target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors text-xs font-bold border border-purple-500/30">
                                                    Zapstore
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="flex flex-col items-center text-center space-y-2">
                                        <div className="w-12 h-12 rounded-full bg-brand-secondary/10 flex items-center justify-center text-brand-secondary mb-2">
                                            <Icons.Help size={24} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white">{helpModal.title}</h3>
                                        <div
                                            className="text-slate-300 text-sm leading-relaxed text-left whitespace-pre-line"
                                            dangerouslySetInnerHTML={{ __html: helpModal.text }}
                                        />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- SETTINGS VIEW ---
    if (view === 'settings') {

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
                                        GitHub →
                                    </a>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-black/20 rounded-lg">
                                    <span className="text-slate-400 text-sm">Contact</span>
                                    <span className="text-emerald-400 text-sm">Use Feedback Button ↓</span>
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
    }

    // --- AUTHENTICATED STATE (MAIN) ---

    if (isProfileLoading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900" />
                
                {/* Subtle animated gradient orbs */}
                <div 
                    className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
                        animation: 'orbFloat 3s ease-in-out infinite'
                    }}
                />
                <div 
                    className="absolute w-64 h-64 rounded-full opacity-15 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
                        animation: 'orbFloat 3s ease-in-out infinite reverse',
                        animationDelay: '1.5s'
                    }}
                />

                {/* Center content */}
                <div className="relative z-10 flex flex-col items-center">
                    
                    {/* Rotating outer ring */}
                    <div className="relative w-32 h-32 mb-8">
                        <div 
                            className="absolute inset-0 rounded-full border-2 border-purple-500/30"
                            style={{ animation: 'ringRotate 3s linear infinite' }}
                        />
                        <div 
                            className="absolute inset-2 rounded-full border border-orange-500/20"
                            style={{ animation: 'ringRotate 2s linear infinite reverse' }}
                        />
                        
                        {/* Keys container */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            {/* Left Key (Purple - Private) */}
                            <div
                                className="absolute"
                                style={{
                                    animation: 'keySlideLeft 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                                }}
                            >
                                <div className="relative">
                                    <Icons.Key 
                                        size={36} 
                                        className="text-purple-400" 
                                        style={{ 
                                            filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.8))',
                                            transform: 'rotate(-45deg)'
                                        }} 
                                    />
                                </div>
                            </div>

                            {/* Right Key (Orange - Public) */}
                            <div
                                className="absolute"
                                style={{
                                    animation: 'keySlideRight 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                                }}
                            >
                                <div className="relative">
                                    <Icons.Key 
                                        size={36} 
                                        className="text-orange-400" 
                                        style={{ 
                                            filter: 'drop-shadow(0 0 12px rgba(249, 115, 22, 0.8))',
                                            transform: 'rotate(135deg)'
                                        }} 
                                    />
                                </div>
                            </div>

                            {/* Connection pulse (appears when keys meet) */}
                            <div
                                className="absolute w-3 h-3 rounded-full"
                                style={{
                                    background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                    boxShadow: '0 0 20px rgba(139, 92, 246, 0.8), 0 0 40px rgba(249, 115, 22, 0.6)',
                                    animation: 'connectionPulse 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards',
                                    opacity: 0,
                                    transform: 'scale(0)'
                                }}
                            />
                        </div>

                        {/* Success flash ring */}
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                border: '2px solid transparent',
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(249, 115, 22, 0.5)) border-box',
                                WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                                WebkitMaskComposite: 'xor',
                                maskComposite: 'exclude',
                                animation: 'successRing 0.6s ease-out 1s forwards',
                                opacity: 0
                            }}
                        />
                    </div>

                    {/* Loading text */}
                    <div 
                        className="text-white/80 text-sm font-medium tracking-wider uppercase"
                        style={{ animation: 'fadeInUp 0.5s ease-out 0.3s forwards', opacity: 0 }}
                    >
                        Loading Profile
                    </div>
                    
                    {/* Animated dots */}
                    <div className="flex space-x-1 mt-2">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>

                {/* Keyframes */}
                <style>{`
                    @keyframes orbFloat {
                        0%, 100% { transform: translate(-20%, -20%); }
                        50% { transform: translate(20%, 20%); }
                    }
                    
                    @keyframes ringRotate {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    
                    @keyframes keySlideLeft {
                        0% {
                            transform: translateX(-60px) rotate(-20deg);
                            opacity: 0;
                        }
                        60% {
                            transform: translateX(-8px) rotate(5deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateX(-12px) rotate(0deg);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes keySlideRight {
                        0% {
                            transform: translateX(60px) rotate(20deg);
                            opacity: 0;
                        }
                        60% {
                            transform: translateX(8px) rotate(-5deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateX(12px) rotate(0deg);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes connectionPulse {
                        0% {
                            transform: scale(0);
                            opacity: 0;
                        }
                        50% {
                            transform: scale(1.5);
                            opacity: 1;
                        }
                        100% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes successRing {
                        0% {
                            transform: scale(1);
                            opacity: 0;
                        }
                        50% {
                            transform: scale(1.3);
                            opacity: 0.8;
                        }
                        100% {
                            transform: scale(1.5);
                            opacity: 0;
                        }
                    }
                    
                    @keyframes fadeInUp {
                        from {
                            transform: translateY(10px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 pb-24 overflow-y-auto flex-1 w-full relative">

            {/* Header with Title and Icons - Matches Wallet tab styling */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center">
                    <Icons.Users className="mr-2 text-purple-400" /> Profile
                </h1>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setHelpModal({ isOpen: true, title: 'collapsible', text: '' })}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Help size={20} />
                    </button>
                    <button
                        onClick={() => setView('settings')}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Settings size={20} />
                    </button>
                </div>
            </div>

            {/* Help Modal - Wallet style */}
            {helpModal && helpModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-black border border-white/10 rounded-2xl shadow-2xl max-w-md w-full max-h-[75vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setHelpModal(null)}
                            className="absolute top-4 right-4 z-10 p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <Icons.Close size={18} />
                        </button>

                        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-purple-500/5 to-transparent">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                    <Icons.Help size={20} className="text-purple-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white">How It Works</h2>
                            </div>
                        </div>

                        {helpModal.title === 'collapsible' ? (
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {/* What is Nostr? - Purple theme */}
                                <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                                    <button
                                        onClick={() => toggleSection('nostr-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-purple-500/5 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/30">N</div>
                                            <span className="font-bold text-white">What is Nostr?</span>
                                        </div>
                                        <Icons.ChevronDown size={16} className={`text-purple-400 transition-transform duration-300 ${openSection === 'nostr-help' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openSection === 'nostr-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-black/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <p>
                                                <strong className="text-white">Your identity, your control.</strong> Think of Nostr like having your own house key instead of renting an apartment from a landlord who can kick you out anytime.
                                            </p>
                                            <p>
                                                With traditional apps (Twitter, Instagram), the company owns your account. They can delete it, ban you, or change the rules whenever they want.
                                            </p>
                                            <p>
                                                <strong className="text-purple-400">With Nostr, YOU own your identity.</strong> You have a private key (like a master password) that proves you're you. No company can take it away.
                                            </p>
                                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                                                <p className="text-xs text-purple-300 font-bold mb-2">The Key Analogy:</p>
                                                <p className="text-xs text-slate-300">
                                                    Your <strong className="text-purple-300">seed phrase or private key</strong> is like a master key that unlocks your digital life. You can use it to access <strong>any Nostr app</strong> - Damus, Primal, Amethyst, or this disc golf app.
                                                </p>
                                                <p className="text-xs text-slate-400 mt-2">
                                                    No more creating new usernames and passwords for every website. One key, infinite apps.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* What is Cashu? - Emerald theme */}
                                <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                                    <button
                                        onClick={() => toggleSection('cashu-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-emerald-500/5 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                                                <Icons.Cashew size={16} />
                                            </div>
                                            <span className="font-bold text-white">What is Cashu?</span>
                                        </div>
                                        <Icons.ChevronDown size={16} className={`text-emerald-400 transition-transform duration-300 ${openSection === 'cashu-help' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openSection === 'cashu-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-black/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <p>
                                                <strong className="text-white">Digital cash that actually works like cash.</strong> Remember handing someone a $20 bill? No banks, no permission, instant.
                                            </p>
                                            <p>
                                                Cashu (also called "eCash") lets you do that with Bitcoin. It's <strong className="text-emerald-400">instant</strong>, <strong className="text-emerald-400">private</strong>, and works even when the internet is slow.
                                            </p>
                                            <p className="text-emerald-400 font-bold">
                                                Perfect for disc golf: Pay your entry fee, split the pot, settle side bets - all in seconds, right from your phone.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* What is Bitcoin? - Orange theme */}
                                <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-orange-500/20 hover:border-orange-500/40 transition-colors">
                                    <button
                                        onClick={() => toggleSection('bitcoin-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-orange-500/5 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm border border-orange-500/30">
                                                <Icons.Bitcoin size={16} />
                                            </div>
                                            <span className="font-bold text-white">What is Bitcoin?</span>
                                        </div>
                                        <Icons.ChevronDown size={16} className={`text-orange-400 transition-transform duration-300 ${openSection === 'bitcoin-help' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openSection === 'bitcoin-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-black/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <p>
                                                <strong className="text-white">Money that can't be stopped.</strong> Bitcoin is digital money that no government, bank, or company controls.
                                            </p>
                                            <p>
                                                Ever had Venmo or PayPal freeze your account? Or charge you fees? Or take days to transfer money? <strong className="text-orange-400">Bitcoin fixes that.</strong>
                                            </p>
                                            <p>
                                                <strong className="text-orange-400">For disc golf:</strong> Many tournament directors have had their Venmo/PayPal accounts flagged for "suspicious activity" (collecting entry fees). With Bitcoin, that's impossible.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Why Does It Matter? - Yellow/Gold theme */}
                                <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
                                    <button
                                        onClick={() => toggleSection('why-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-yellow-500/5 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/30">
                                                <Icons.Trophy size={16} />
                                            </div>
                                            <span className="font-bold text-white">Why Does It Matter?</span>
                                        </div>
                                        <Icons.ChevronDown size={16} className={`text-yellow-400 transition-transform duration-300 ${openSection === 'why-help' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openSection === 'why-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-black/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <p className="text-white font-bold">
                                                Because your disc golf stats and money shouldn't disappear when a company shuts down.
                                            </p>
                                            <ul className="space-y-2 text-sm">
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 shrink-0" />
                                                    <span><strong className="text-purple-400">Your data is yours:</strong> Scores, stats, and profile travel with you</span>
                                                </li>
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0" />
                                                    <span><strong className="text-orange-400">Instant payouts:</strong> Win money? It's in your wallet immediately</span>
                                                </li>
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                                                    <span><strong className="text-emerald-400">No middleman:</strong> No payment processor taking a cut</span>
                                                </li>
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 shrink-0" />
                                                    <span><strong className="text-yellow-400">Unstoppable:</strong> No one can freeze your funds</span>
                                                </li>
                                            </ul>
                                            <p className="text-yellow-400 font-bold text-center pt-2">
                                                Play disc golf. Own your game.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : helpModal.text === 'nostr-intro' ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                    <p>
                                        <strong className="text-white text-base">Your identity, your control.</strong>
                                    </p>
                                    <p>
                                        Nostr is a protocol that lets YOU own your online identity. Unlike traditional apps where the company controls your account, with Nostr you have a <strong className="text-purple-400">private key (nsec)</strong> that proves you're you.
                                    </p>

                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                        <p className="text-red-200 font-bold text-xs mb-2">IMPORTANT: Keep Your nsec Safe!</p>
                                        <p className="text-red-100 text-xs">
                                            Your nsec is like a master password. Anyone with it can access your profile AND your funds in this app. Save it somewhere secure - if you lose it, you lose everything.
                                        </p>
                                    </div>

                                    <p className="text-brand-primary font-bold">
                                        In this app, your Bitcoin wallet is tied to your nsec. Guard it carefully!
                                    </p>

                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                        <p className="text-purple-200 font-bold text-xs mb-2">One Key, Infinite Apps</p>
                                        <p className="text-purple-100 text-xs">
                                            You can use your nsec to log into other Nostr apps and services. Your profile, friends, and content follow you everywhere.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-white font-bold text-sm">Try Popular Nostr Apps:</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            <a href="https://primal.net" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600">
                                                <span className="font-bold text-white">Primal</span>
                                                <span className="text-slate-400 text-xs">Social network</span>
                                            </a>
                                            <a href="https://damus.io" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600">
                                                <span className="font-bold text-white">Damus</span>
                                                <span className="text-slate-400 text-xs">iOS client</span>
                                            </a>
                                            <a href="https://iris.to" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600">
                                                <span className="font-bold text-white">Iris</span>
                                                <span className="text-slate-400 text-xs">Web messenger</span>
                                            </a>
                                            <a href="https://zap.stream" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600">
                                                <span className="font-bold text-white">Zap.Stream</span>
                                                <span className="text-slate-400 text-xs">Live streaming</span>
                                            </a>
                                            <a href="https://zapstore.dev" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600">
                                                <span className="font-bold text-white">Zapstore</span>
                                                <span className="text-slate-400 text-xs">App store</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="flex flex-col items-center text-center space-y-2">
                                    <div className="w-12 h-12 rounded-full bg-brand-secondary/10 flex items-center justify-center text-brand-secondary mb-2">
                                        <Icons.Help size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{helpModal.title}</h3>
                                    <div
                                        className="text-slate-300 text-sm leading-relaxed text-left whitespace-pre-line"
                                        dangerouslySetInnerHTML={{ __html: helpModal.text }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="p-4 border-t border-slate-800">
                            <Button variant="secondary" fullWidth onClick={() => setHelpModal(null)}>
                                Got it
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal - Wallet style */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-black border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30 mb-2">
                                <Icons.LogOut size={28} className="text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Log Out?</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {authSource === 'mnemonic' 
                                    ? "Make sure you've saved your 12-word seed phrase! You'll need it to recover your account and funds."
                                    : "You'll need your private key (nsec) saved somewhere safe to log back in."
                                }
                            </p>
                        </div>

                        {/* Seed Phrase Backup for mnemonic users */}
                        {authSource === 'mnemonic' && storedMnemonic && (
                            <div className="w-full bg-orange-500/10 p-4 rounded-xl border border-orange-500/20">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                                        Your 12-Word Backup
                                    </label>
                                    <button
                                        onClick={() => setShowMnemonic(!showMnemonic)}
                                        className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                                    >
                                        {showMnemonic ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                {showMnemonic ? (
                                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                                        {storedMnemonic.split(' ').map((word, index) => (
                                            <div key={index} className="bg-black/30 rounded px-1.5 py-1 border border-orange-500/20 text-center">
                                                <span className="text-orange-400/60 text-[9px] mr-0.5">{index + 1}.</span>
                                                <span className="text-white text-[10px] font-mono">{word}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-black/30 rounded-lg p-3 text-center border border-orange-500/10 mb-3">
                                        <span className="text-slate-500 text-xs">●●●●● ●●●●● ●●●●● ●●●●●</span>
                                    </div>
                                )}
                                
                                {/* Always show backup buttons */}
                                <div className="flex gap-2">
                                    {showMnemonic && (
                                        <button
                                            onClick={handleCopyMnemonic}
                                            className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1 ${
                                                copiedKeyType === 'mnemonic'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30'
                                            }`}
                                        >
                                            {copiedKeyType === 'mnemonic' ? <Icons.CheckMark size={14} /> : <Icons.Copy size={14} />}
                                            <span>{copiedKeyType === 'mnemonic' ? 'Copied!' : 'Copy'}</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => downloadWalletCardPDF(storedMnemonic)}
                                        className={`${showMnemonic ? 'flex-1' : 'w-full'} p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30`}
                                    >
                                        <Icons.CreditCard size={14} />
                                        <span>Save PDF Backup</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Private Key Backup for nsec users */}
                        {authSource === 'nsec' && authMethod === 'local' && (
                            <div className="w-full bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                                <label className="text-xs font-bold text-red-400 uppercase mb-2 block text-left">
                                    Save your nsec before leaving
                                </label>
                                <div className="flex items-center space-x-2">
                                    {showSecrets ? (
                                        <div className="flex-1 bg-black/30 rounded-lg p-2 text-xs text-red-400 font-mono truncate border border-red-500/20">
                                            {getPrivateString()}
                                        </div>
                                    ) : (
                                        <div className="flex-1 bg-black/30 rounded-lg p-2 text-xs text-slate-500 italic border border-white/10">
                                            ●●●●●●●●●●●●●●●●●●●●
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowSecrets(!showSecrets)}
                                        className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-white border border-white/10"
                                    >
                                        {showSecrets ? <Icons.EyeOff size={16} /> : <Icons.Eye size={16} />}
                                    </button>
                                    <button 
                                        onClick={handleCopyNsec} 
                                        className={`p-2 rounded-lg transition-colors ${
                                            copiedKeyType === 'nsec' 
                                                ? 'bg-green-600 text-white' 
                                                : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
                                        }`}
                                    >
                                        {copiedKeyType === 'nsec' ? <Icons.CheckMark size={16} /> : <Icons.Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {authMethod === 'nip46' && (
                            <div className="flex items-center space-x-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                                    <Icons.Link size={14} className="text-blue-400" />
                                </div>
                                <p className="text-xs text-blue-300">Keys managed by Remote Signer (NIP-46)</p>
                            </div>
                        )}

                        {authMethod === 'amber' && (
                            <div className="flex items-center space-x-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center shrink-0">
                                    <Icons.Android size={14} className="text-green-400" />
                                </div>
                                <p className="text-xs text-green-300">Keys safely stored in Amber app</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl font-bold text-slate-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                className="relative overflow-hidden bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-bold py-3 px-4 rounded-xl transition-all active:scale-95 select-none touch-none"
                                onMouseDown={startHold}
                                onMouseUp={stopHold}
                                onMouseLeave={stopHold}
                                onTouchStart={startHold}
                                onTouchEnd={stopHold}
                            >
                                <div
                                    className="absolute inset-0 bg-red-500 transition-all duration-75 ease-linear"
                                    style={{ width: `${holdProgress}%` }}
                                />
                                <span className="relative z-10 flex items-center justify-center text-sm">
                                    {holdProgress > 0 ? 'Keep Holding...' : 'Hold to Log Out'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keypair Breaking Animation Overlay - Clean & Stylish */}
            {isExploding && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden animate-in fade-in duration-200">
                    {/* Dark gradient background with red tint */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-red-950/20 to-black" />
                    
                    {/* Vignette effect */}
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)'
                        }}
                    />

                    {/* Center content */}
                    <div className="relative z-10 flex flex-col items-center">
                        
                        {/* Keys container */}
                        <div className="relative w-48 h-32 mb-6">
                            
                            {/* Fracture line (center) - appears first */}
                            <div
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12"
                                style={{
                                    background: 'linear-gradient(to bottom, transparent, #ef4444, #f97316, transparent)',
                                    boxShadow: '0 0 15px rgba(239, 68, 68, 0.8), 0 0 30px rgba(239, 68, 68, 0.4)',
                                    animation: 'fractureLine 0.3s ease-out forwards'
                                }}
                            />

                            {/* Left Key (Purple - Private) - slides away */}
                            <div
                                className="absolute left-1/2 top-1/2"
                                style={{
                                    animation: 'keyBreakLeftNew 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards'
                                }}
                            >
                                <div className="relative">
                                    <Icons.Key 
                                        size={40} 
                                        className="text-purple-400" 
                                        style={{ 
                                            filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.8))',
                                            transform: 'translate(-50%, -50%) rotate(-45deg)'
                                        }} 
                                    />
                                    {/* Glitch/static effect on key */}
                                    <div 
                                        className="absolute inset-0 opacity-0"
                                        style={{
                                            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139,92,246,0.1) 2px, rgba(139,92,246,0.1) 4px)',
                                            animation: 'glitchFlicker 0.1s linear infinite'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Right Key (Orange - Public) - slides away */}
                            <div
                                className="absolute left-1/2 top-1/2"
                                style={{
                                    animation: 'keyBreakRightNew 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards'
                                }}
                            >
                                <div className="relative">
                                    <Icons.Key 
                                        size={40} 
                                        className="text-orange-400" 
                                        style={{ 
                                            filter: 'drop-shadow(0 0 12px rgba(249, 115, 22, 0.8))',
                                            transform: 'translate(-50%, -50%) rotate(135deg)'
                                        }} 
                                    />
                                </div>
                            </div>

                            {/* Spark particles at break point */}
                            {[...Array(8)].map((_, i) => {
                                const angle = (i / 8) * 360;
                                const rad = angle * (Math.PI / 180);
                                const distance = 30 + Math.random() * 20;
                                const x = Math.cos(rad) * distance;
                                const y = Math.sin(rad) * distance;
                                
                                return (
                                    <div
                                        key={`spark-${i}`}
                                        className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full"
                                        style={{
                                            background: i % 2 === 0 ? '#ef4444' : '#f97316',
                                            boxShadow: `0 0 6px ${i % 2 === 0 ? '#ef4444' : '#f97316'}`,
                                            animation: `sparkFly-${i} 0.6s ease-out 0.15s forwards`,
                                            opacity: 0
                                        }}
                                    >
                                        <style>{`
                                            @keyframes sparkFly-${i} {
                                                0% {
                                                    transform: translate(-50%, -50%) scale(1);
                                                    opacity: 1;
                                                }
                                                100% {
                                                    transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0);
                                                    opacity: 0;
                                                }
                                            }
                                        `}</style>
                                    </div>
                                );
                            })}
                        </div>

                        {/* "Disconnected" text */}
                        <div 
                            className="text-red-400/80 text-sm font-medium tracking-wider uppercase"
                            style={{ 
                                animation: 'fadeInUp 0.5s ease-out 0.5s forwards', 
                                opacity: 0,
                                textShadow: '0 0 20px rgba(239, 68, 68, 0.5)'
                            }}
                        >
                            Logging Out
                        </div>
                        
                        {/* Fading dots */}
                        <div 
                            className="flex space-x-1 mt-2"
                            style={{ animation: 'fadeOut 1s ease-out 1s forwards' }}
                        >
                            <div className="w-1.5 h-1.5 bg-red-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-red-400/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-red-400/20 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>

                    {/* Screen fade to black at end */}
                    <div 
                        className="absolute inset-0 bg-black pointer-events-none"
                        style={{ animation: 'fadeToBlack 0.5s ease-in 1.5s forwards', opacity: 0 }}
                    />

                    {/* Keyframes */}
                    <style>{`
                        @keyframes fractureLine {
                            0% {
                                transform: translate(-50%, -50%) scaleY(0);
                                opacity: 0;
                            }
                            50% {
                                transform: translate(-50%, -50%) scaleY(1.2);
                                opacity: 1;
                            }
                            100% {
                                transform: translate(-50%, -50%) scaleY(1);
                                opacity: 0.8;
                            }
                        }
                        
                        @keyframes keyBreakLeftNew {
                            0% {
                                transform: translateX(-12px);
                                opacity: 1;
                            }
                            20% {
                                transform: translateX(-8px) rotate(-5deg);
                                opacity: 1;
                            }
                            100% {
                                transform: translateX(-100px) translateY(-30px) rotate(-25deg);
                                opacity: 0;
                            }
                        }
                        
                        @keyframes keyBreakRightNew {
                            0% {
                                transform: translateX(12px);
                                opacity: 1;
                            }
                            20% {
                                transform: translateX(8px) rotate(5deg);
                                opacity: 1;
                            }
                            100% {
                                transform: translateX(100px) translateY(-30px) rotate(25deg);
                                opacity: 0;
                            }
                        }
                        
                        @keyframes glitchFlicker {
                            0%, 100% { opacity: 0; }
                            50% { opacity: 0.3; }
                        }
                        
                        @keyframes fadeInUp {
                            from {
                                transform: translateY(10px);
                                opacity: 0;
                            }
                            to {
                                transform: translateY(0);
                                opacity: 1;
                            }
                        }
                        
                        @keyframes fadeOut {
                            from { opacity: 1; }
                            to { opacity: 0; }
                        }
                        
                        @keyframes fadeToBlack {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                    `}</style>
                </div>
            )}

            {/* Profile Card - Wallet style glassmorphism */}
            <div className="bg-gradient-to-br from-slate-800/80 via-slate-900 to-black/90 rounded-2xl p-6 border border-white/10 backdrop-blur-sm shadow-xl relative overflow-hidden">
                {/* Subtle glow behind card */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative flex flex-col items-center">
                    {/* Profile Picture with glow */}
                    <div className="relative mb-4">
                        <div className="w-24 h-24 bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 rounded-full flex items-center justify-center border-4 border-slate-800 shadow-xl relative group overflow-hidden">
                            {(isEditing ? formData.picture : userProfile.picture) && !imgError ? (
                                <img
                                    src={isEditing ? formData.picture : userProfile.picture}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <Icons.Users size={40} className="text-white" />
                            )}

                            {/* Camera Overlay for Upload */}
                            {isEditing && (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors"
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                    {isUploading ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Icons.Camera size={24} className="text-white opacity-80 hover:opacity-100" />
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Purple glow ring */}
                        <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl -z-10 scale-110"></div>
                    </div>

                    {isEditing ? (
                        <div className="w-full space-y-4 max-w-xs text-left">
                            {/* Profile Name */}
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profile Name</label>
                                    <button
                                        onClick={() => openHelp('Profile Name', 'Your public username visible to other players on scorecards and leaderboards.')}
                                        className="text-slate-500 hover:text-purple-400 transition-colors"
                                    >
                                        <Icons.Help size={14} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. Disc Golfer"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/30 p-3 rounded-lg border border-white/10 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-slate-600"
                                />
                            </div>
                            
                            {/* PDGA Number */}
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">PDGA Number</label>
                                    <button
                                        onClick={() => openHelp('PDGA Number', 'Your Professional Disc Golf Association membership number. Other players can find you by searching this number when adding you to their card.')}
                                        className="text-slate-500 hover:text-emerald-400 transition-colors"
                                    >
                                        <Icons.Help size={14} />
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
                                    className="w-full bg-black/30 p-3 rounded-lg border border-white/10 text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-600"
                                />
                            </div>

                            <div className="flex space-x-2 pt-2">
                                <Button onClick={handleSaveProfile} fullWidth className="h-10 py-0">Save</Button>
                                <Button onClick={() => setIsEditing(false)} variant="secondary" fullWidth className="h-10 py-0">Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-white">{userProfile.name}</h2>

                            <div className="flex flex-col items-center space-y-2 mt-3">
                                {/* PDGA Number Badge */}
                                {userProfile.pdga && (
                                    <div className="flex items-center text-emerald-400 text-xs font-bold space-x-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                        <span className="text-emerald-500">PDGA</span>
                                        <span className="font-mono">#{userProfile.pdga}</span>
                                    </div>
                                )}
                                
                                {/* NIP-05 Verified Badge */}
                                {userProfile.nip05 && (
                                    <div className="flex items-center text-purple-400 text-xs font-bold space-x-1 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                                        <Icons.CheckMark size={12} />
                                        <span>{userProfile.nip05}</span>
                                    </div>
                                )}
                                
                                {/* Lightning Address */}
                                <button
                                    onClick={handleCopyAddress}
                                    className="flex items-center text-slate-400 text-sm space-x-2 bg-black/30 hover:bg-black/50 px-4 py-2 rounded-full transition-all group active:scale-95 border border-white/10 hover:border-orange-500/30"
                                >
                                    <Icons.Zap size={14} className="text-orange-400" />
                                    <span className="font-mono text-xs">{formatLightningAddress(lightningAddress)}</span>
                                    {copiedAddress ? (
                                        <Icons.CheckMark size={14} className="text-green-500" />
                                    ) : (
                                        <Icons.Copy size={14} className="opacity-50 group-hover:opacity-100 transition-opacity text-slate-500" />
                                    )}
                                </button>
                            </div>

                            <button
                                onClick={() => setIsEditing(true)}
                                className="mt-4 px-4 py-2 text-purple-400 text-sm font-bold bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition-all active:scale-95"
                            >
                                Edit Profile
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats Grid - 4 Main Tiles with glassmorphism */}
            <div className="grid grid-cols-2 gap-3">
                {/* Rounds Played */}
                <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl text-center border border-white/10 hover:border-purple-500/30 transition-all group">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                        <Icons.BarChart size={16} className="text-purple-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{userStats.totalRounds}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Rounds Played</p>
                </div>
                
                {/* Total Sats Won - Orange Bitcoin theme */}
                <div className="bg-orange-500/5 backdrop-blur-sm p-4 rounded-xl text-center border border-orange-500/20 hover:border-orange-500/40 transition-all group relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl"></div>
                    <div className="relative">
                        <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                            <Icons.Bitcoin size={16} className="text-orange-400" />
                        </div>
                        <p className="text-3xl font-bold text-orange-400">{userStats.totalSatsWon?.toLocaleString() || 0}</p>
                        <p className="text-[10px] uppercase tracking-wider text-orange-400/70 font-bold">Total Sats Won</p>
                    </div>
                </div>
                
                {/* Total Wins - Emerald theme */}
                <div className="bg-emerald-500/5 backdrop-blur-sm p-4 rounded-xl text-center border border-emerald-500/20 hover:border-emerald-500/40 transition-all group">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                        <Icons.TrophyMedal size={16} className="text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-emerald-400">{userStats.totalWins || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 font-bold">Total Wins</p>
                </div>
                
                {/* Total Aces - Yellow/Gold theme */}
                <div className="bg-yellow-500/5 backdrop-blur-sm p-4 rounded-xl text-center border border-yellow-500/20 hover:border-yellow-500/40 transition-all group">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                        <span className="text-base">🎯</span>
                    </div>
                    <p className="text-3xl font-bold text-yellow-400">{userStats.totalAces || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-yellow-400/70 font-bold">Total Aces</p>
                </div>
            </div>

            {/* Detailed Stats Dropdown - Wallet style */}
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <button
                    onClick={() => toggleSection('detailed-stats')}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                >
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <Icons.BarChart size={16} className="text-amber-400" />
                        </div>
                        <span className="font-bold text-white">Detailed Stats</span>
                    </div>
                    <Icons.ChevronDown
                        size={20}
                        className={`text-slate-400 transition-transform duration-300 ${openSection === 'detailed-stats' ? 'rotate-180' : ''}`}
                    />
                </button>

                {openSection === 'detailed-stats' && (
                    <div className="border-t border-white/10 p-4 space-y-1 animate-in slide-in-from-top-2 duration-200 bg-black/20">
                        {/* Total Birdies */}
                        <div className="flex justify-between items-center py-3 px-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                            <span className="text-slate-400 text-sm">Total Birdies</span>
                            <span className="text-white font-bold">{userStats.totalBirdies || 0}</span>
                        </div>

                        {/* Bogey-Free Rounds */}
                        <div className="flex justify-between items-center py-3 px-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                            <span className="text-slate-400 text-sm">Bogey-Free Rounds</span>
                            <span className="text-white font-bold">{userStats.bogeyFreeRounds || 0}</span>
                        </div>

                        {/* Biggest Win Streak */}
                        <div className="flex justify-between items-center py-3 px-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                            <span className="text-slate-400 text-sm">Biggest Win Streak</span>
                            <span className="text-emerald-400 font-bold">🔥 {userStats.biggestWinStreak || 0}</span>
                        </div>

                        {/* ROI */}
                        <div className="flex justify-between items-center py-3 px-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                            <span className="text-slate-400 text-sm">ROI</span>
                            <span className={`font-bold ${userStats.totalSatsPaid > 0
                                    ? (((userStats.totalSatsWon - userStats.totalSatsPaid) / userStats.totalSatsPaid) * 100) >= 0
                                        ? 'text-emerald-400'
                                        : 'text-red-400'
                                    : 'text-slate-400'
                                }`}>
                                {userStats.totalSatsPaid > 0
                                    ? `${(((userStats.totalSatsWon - userStats.totalSatsPaid) / userStats.totalSatsPaid) * 100).toFixed(0)}%`
                                    : '—'
                                }
                            </span>
                        </div>

                        {/* Biggest Win */}
                        <div className="flex justify-between items-center py-3 px-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                            <span className="text-slate-400 text-sm">Biggest Win</span>
                            <span className="text-orange-400 font-bold">
                                {userStats.biggestWin > 0 ? `⚡ ${userStats.biggestWin.toLocaleString()} sats` : '—'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Identity Backup - Wallet style */}
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-orange-500/10 border-b border-white/10 flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Icons.Key size={16} className="text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">
                            {authSource === 'mnemonic' ? 'Identity Backup' : 'My Keys'}
                        </h3>
                        {authSource === 'mnemonic' && (
                            <p className="text-[10px] text-slate-400">Your seed phrase secures both your identity AND your Bitcoin</p>
                        )}
                    </div>
                </div>
                <div className="p-4 space-y-4">
                    {/* 1. Public Key (npub) - Always shown first */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <label className="text-xs font-bold text-purple-400 uppercase tracking-wider">Public Key (npub)</label>
                            <button
                                onClick={() => openHelp('What is npub?', '<p class="mb-3">Your <strong>npub</strong> is like your mailing address - it\'s safe to share!</p><p class="mb-2"><strong>Think of it like:</strong></p><p class="ml-4 mb-3">📬 Your public disc golf profile that anyone can see</p><p class="mb-2 text-slate-300"><strong>You can share it to:</strong></p><ul class="ml-6 mb-0 space-y-1 text-slate-300"><li>• Let cardmates find and add you</li><li>• Receive payments from anyone</li><li>• Prove it\'s really you across apps</li></ul>')}
                                className="text-slate-500 hover:text-purple-400 transition-colors"
                            >
                                <Icons.Help size={12} />
                            </button>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-black/30 rounded-lg p-2.5 text-xs text-slate-400 font-mono truncate border border-white/10">
                                {(() => { try { return nip19.npubEncode(currentUserPubkey); } catch (e) { return '...'; } })()}
                            </div>
                            <button
                                onClick={handleCopyNpub}
                                className={`p-2.5 rounded-lg transition-colors ${copiedKeyType === 'npub'
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
                                    }`}
                            >
                                {copiedKeyType === 'npub' ? <Icons.CheckMark size={16} /> : <Icons.Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* 2. Private Key (nsec) - Shown for local auth (both mnemonic and nsec users) */}
                    {authMethod === 'local' && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <label className="text-xs font-bold text-red-400 uppercase tracking-wider">Private Key (nsec)</label>
                                <button
                                    onClick={() => openHelp('What is nsec?', '<p class="mb-3">Your <strong class="text-red-400">nsec</strong> is like the <strong>only key to your mailbox</strong>. Keep it private!</p><p class="mb-2"><strong>Think of it like:</strong></p><p class="ml-4 mb-3">🔐 Your master password that controls everything</p><div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3"><p class="text-red-400 font-bold text-sm mb-2">⚠️ Important:</p><ul class="ml-4 space-y-1 text-sm text-slate-200"><li>• Your <strong class="text-brand-accent">wallet funds</strong> are tied to this key</li><li>• Never share it with anyone</li><li>• If lost, your money is gone forever</li></ul></div>' + (authSource === 'mnemonic' ? '<div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3"><p class="text-purple-300 text-xs"><strong class="text-purple-400">Note:</strong> Your nsec is derived from your 12-word seed phrase. If you have your seed phrase backed up, you can always regenerate this nsec.</p></div>' : '<p class="text-sm text-slate-300"><strong>Backup tip:</strong> Write it on paper and store somewhere safe.</p>'))}
                                    className="text-slate-500 hover:text-red-400 transition-colors"
                                >
                                    <Icons.Help size={12} />
                                </button>
                            </div>
                            <div className="flex items-center space-x-2">
                                {showSecrets ? (
                                    <div className="flex-1 bg-black/30 rounded-lg p-2.5 text-xs text-red-400 font-mono truncate border border-red-900/30">
                                        {getPrivateString()}
                                    </div>
                                ) : (
                                    <div className="flex-1 bg-black/30 rounded-lg p-2.5 text-xs text-slate-500 italic border border-white/10">
                                        ●●●●●●●●●●●●●●●●●●●●
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowSecrets(!showSecrets)}
                                    className="p-2.5 bg-slate-800 rounded-lg hover:bg-slate-700 text-white border border-white/10"
                                >
                                    {showSecrets ? <Icons.EyeOff size={16} /> : <Icons.Eye size={16} />}
                                </button>
                                <button
                                    onClick={handleCopyNsec}
                                    className={`p-2.5 rounded-lg transition-colors ${copiedKeyType === 'nsec'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
                                        }`}
                                >
                                    {copiedKeyType === 'nsec' ? <Icons.CheckMark size={16} /> : <Icons.Copy size={16} />}
                                </button>
                            </div>
                            {showSecrets && <p className="text-[10px] text-red-400 mt-2">Warning: Never share your nsec with anyone.</p>}
                            
                            {/* Migration suggestion for nsec-only users (not mnemonic users) */}
                            {authSource === 'nsec' && (
                                <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                    <p className="text-xs text-purple-300">
                                        <span className="font-bold text-purple-400">Tip:</span> Consider creating a new account with a 12-word seed phrase for unified backup of your identity and wallet.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. 12-Word Backup Phrase - Only for mnemonic users (shown last) */}
                    {authSource === 'mnemonic' && storedMnemonic && (
                        <div className="bg-gradient-to-br from-orange-500/10 to-purple-500/10 rounded-xl p-4 border border-orange-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                                        <Icons.Shield size={12} className="text-orange-400" />
                                    </div>
                                    <label className="text-xs font-bold text-orange-400 uppercase tracking-wider">12-Word Backup Phrase</label>
                                </div>
                                <button
                                    onClick={() => openHelp('The Master Key', '<p class="mb-3 text-lg font-bold text-orange-400">If your private key is the key to your house...</p><p class="mb-4 text-slate-200">Then your <strong class="text-orange-400">12-word seed phrase</strong> is the <strong class="text-orange-300">God Key</strong> — the master blueprint from which ALL your keys are created.</p><div class="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-3"><p class="text-orange-400 font-bold text-sm mb-2">🔑 The Hierarchy:</p><ul class="ml-2 space-y-2 text-sm text-slate-200"><li><strong class="text-orange-300">12 Words</strong> → generates your <strong class="text-red-400">Private Key (nsec)</strong></li><li><strong class="text-red-400">Private Key</strong> → generates your <strong class="text-purple-400">Public Key (npub)</strong></li><li class="text-slate-400 text-xs pt-1">The seed phrase also generates your Bitcoin wallet keys</li></ul></div><div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-3"><p class="text-purple-400 font-bold text-sm mb-2">💡 Why this matters:</p><p class="text-xs text-slate-300">Your nsec can unlock your identity. But your seed phrase can <em>recreate</em> your nsec from scratch. Lose your phone? Get a new one, enter your 12 words, and everything comes back — your identity AND your Bitcoin.</p></div><div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-3"><p class="text-emerald-400 font-bold text-sm mb-2">🔄 How to Recover:</p><ul class="ml-2 space-y-1 text-xs text-slate-300"><li>• <strong>This app:</strong> Re-download On-Chain Disc Golf → Login → "I have a seed phrase" → Enter your 12 words</li><li>• <strong>Nostr identity:</strong> Any app supporting <span class="text-purple-400">NIP-06</span> can derive your keys (like nsec.app)</li><li>• <strong>Bitcoin wallet:</strong> Your Lightning funds are tied to this app\'s infrastructure, so restore within On-Chain Disc Golf</li></ul></div><p class="text-sm text-slate-300 mb-2"><strong>Protect it like the God Key it is:</strong></p><ul class="ml-4 space-y-1 text-xs text-slate-400"><li>• Write it on paper — never save digitally</li><li>• Store in a fireproof safe or safety deposit box</li><li>• Consider a metal backup for disaster protection</li><li>• <strong class="text-red-400">Never share with anyone, ever</strong></li></ul>')}
                                    className="text-slate-500 hover:text-orange-400 transition-colors"
                                >
                                    <Icons.Help size={14} />
                                </button>
                            </div>
                            
                            {showMnemonic ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {storedMnemonic.split(' ').map((word, index) => (
                                            <div key={index} className="bg-black/30 rounded-lg px-2 py-1.5 border border-orange-500/20">
                                                <span className="text-orange-400/60 text-[10px] mr-1">{index + 1}.</span>
                                                <span className="text-white text-xs font-mono">{word}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setShowMnemonic(false)}
                                            className="flex-1 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 text-xs font-medium transition-colors flex items-center justify-center space-x-1"
                                        >
                                            <Icons.EyeOff size={14} />
                                            <span>Hide</span>
                                        </button>
                                        <button
                                            onClick={handleCopyMnemonic}
                                            className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1 ${
                                                copiedKeyType === 'mnemonic'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30'
                                            }`}
                                        >
                                            {copiedKeyType === 'mnemonic' ? <Icons.CheckMark size={14} /> : <Icons.Copy size={14} />}
                                            <span>{copiedKeyType === 'mnemonic' ? 'Copied!' : 'Copy'}</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-orange-400/70 text-center">Anyone with these words can access your identity and funds</p>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowMnemonic(true)}
                                    className="w-full p-3 bg-black/30 hover:bg-black/40 rounded-lg border border-orange-500/20 text-sm text-slate-400 transition-colors flex items-center justify-center space-x-2"
                                >
                                    <Icons.Eye size={16} />
                                    <span>Reveal Seed Phrase</span>
                                </button>
                            )}
                            
                            {/* Compatible Recovery Apps */}
                            <div className="mt-4 pt-4 border-t border-orange-500/10">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Recover with these apps:</p>
                                <div className="flex flex-wrap gap-2">
                                    <a 
                                        href="https://breez.technology/misty/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-full text-xs text-orange-400 transition-colors"
                                    >
                                        <Icons.Zap size={12} />
                                        <span>Misty Breez</span>
                                        <Icons.Send size={10} className="opacity-50" />
                                    </a>
                                    <a 
                                        href="https://nsec.app" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-full text-xs text-purple-400 transition-colors"
                                    >
                                        <Icons.Key size={12} />
                                        <span>nsec.app</span>
                                        <Icons.Send size={10} className="opacity-50" />
                                    </a>
                                    <a 
                                        href="https://primal.net" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-full text-xs text-purple-400 transition-colors"
                                    >
                                        <Icons.Users size={12} />
                                        <span>Primal</span>
                                        <Icons.Send size={10} className="opacity-50" />
                                    </a>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 italic">Lightning funds via Breez • Nostr identity via NIP-06 apps</p>
                            </div>
                        </div>
                    )}

                    {/* External signer notices */}
                    {authMethod === 'nip46' && (
                        <div className="flex items-center space-x-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                                <Icons.Link size={16} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-400">Remote Signer (NIP-46)</p>
                                <p className="text-[10px] text-slate-400">Keys managed by your external signer</p>
                            </div>
                        </div>
                    )}
                    
                    {authMethod === 'amber' && (
                        <div className="flex items-center space-x-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center shrink-0">
                                <Icons.Android size={16} className="text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-green-400">Amber Signer</p>
                                <p className="text-[10px] text-slate-400">Keys safely stored in Amber app</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Logout Button - Styled */}
            <button
                onClick={handleLogout}
                className="w-full mt-4 mb-8 p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-xl text-red-400 font-bold transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
            >
                <Icons.LogOut size={18} />
                <span>Log Out</span>
            </button>
        </div >
    );
};
