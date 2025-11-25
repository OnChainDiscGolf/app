
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { Button } from '../components/Button';
import { getSession, getRelays, addRelay, removeRelay, resetRelays, uploadProfileImage, getMagicLightningAddress } from '../services/nostrService';
import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';
import { DiscGolfBasketLoader } from '../components/DiscGolfBasketLoader';

export const Profile: React.FC = () => {
    const {
        userProfile, userStats, updateUserProfile, resetRound, refreshStats,
        isAuthenticated, isGuest, authMethod, performLogout, isProfileLoading,
        loginNsec, loginNip46, createAccount, currentUserPubkey
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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [helpModal, setHelpModal] = useState<{ isOpen: boolean, title: string, text: string } | null>(null);
    const [imgError, setImgError] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: '',
        lud16: '',
        about: '',
        nip05: '',
        picture: ''
    });

    // Settings State
    const [relayList, setRelayList] = useState<string[]>([]);
    const [newRelayUrl, setNewRelayUrl] = useState('');

    useEffect(() => {
        if (isAuthenticated && !isProfileLoading) {
            setFormData({
                name: userProfile.name,
                lud16: userProfile.lud16 || getMagicLightningAddress(currentUserPubkey),
                about: userProfile.about || '',
                nip05: userProfile.nip05 || '',
                picture: userProfile.picture || ''
            });
            refreshStats();
        }
        setRelayList(getRelays());
    }, [userProfile, isAuthenticated, isProfileLoading]);

    // Reset image error if the URL changes (e.g. after a fetch)
    useEffect(() => {
        setImgError(false);
    }, [userProfile.picture, formData.picture]);

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
            await createAccount();
            setIsEditing(true); // Automatically open edit mode
        } catch (e) {
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
            picture: formData.picture
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
            alert('Copied Public Key (npub)!');
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
            alert('Copied Private Key (nsec)! Keep it safe.');
        }
    };

    const handleLogout = () => {
        setShowSecrets(false); // Ensure secrets are hidden by default when opening modal
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        performLogout();
        setShowLogoutConfirm(false);
    };

    const openHelp = (title: string, text: string) => {
        setHelpModal({ isOpen: true, title, text });
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
            <div className="p-6 pt-10 flex flex-col h-full pb-24">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4 text-brand-primary animate-pulse-fast">
                        <Icons.Shield size={40} />
                    </div>
                    <h1 className="text-2xl font-bold">Guest Account</h1>
                    <p className="text-slate-400 text-center mt-2 text-sm max-w-xs">
                        You are using a temporary identity. Login or create a profile to save your stats permanently.
                    </p>
                </div>

                <div className="flex bg-slate-800 p-1 rounded-xl mb-6">
                    <button
                        onClick={() => setAuthView('create')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${authView === 'create' ? 'bg-brand-primary text-black' : 'text-slate-400 hover:text-white'}`}
                    >
                        Create Profile
                    </button>
                    <button
                        onClick={() => setAuthView('login')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${authView === 'login' ? 'bg-brand-primary text-black' : 'text-slate-400 hover:text-white'}`}
                    >
                        Login
                    </button>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    {authView === 'create' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
                                <h3 className="font-bold text-lg text-white mb-2">New to Nostr?</h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Generate a secure cryptographic key pair. No email required.
                                </p>
                                <Button fullWidth onClick={handleCreate} disabled={isLoading}>
                                    {isLoading ? 'Generating...' : 'Create Profile'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-3">
                                <label className="text-sm text-slate-400 font-bold ml-1">Private Key (nsec)</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="nsec1..."
                                        value={nsecInput}
                                        onChange={e => setNsecInput(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 pl-12 text-white focus:ring-2 focus:ring-brand-primary outline-none"
                                    />
                                    <Icons.Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                </div>
                                <Button fullWidth onClick={handleLogin} disabled={!nsecInput || isLoading}>
                                    {isLoading ? 'Verifying...' : 'Login with Key'}
                                </Button>
                            </div>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-slate-700"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase">OR</span>
                                <div className="flex-grow border-t border-slate-700"></div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm text-slate-400 font-bold ml-1">Remote Signer (NIP-46)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="bunker://..."
                                        value={bunkerInput}
                                        onChange={e => setBunkerInput(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 pl-12 text-white focus:ring-2 focus:ring-brand-primary outline-none"
                                    />
                                    <Icons.Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                </div>
                                <Button fullWidth variant="secondary" onClick={handleNip46Login} disabled={!bunkerInput || isLoading}>
                                    Connect Remote Signer
                                </Button>
                                <p className="text-[10px] text-slate-500 text-center">
                                    Use a NIP-46 provider like nsec.app, Amber (Android), or other remote signers.
                                </p>
                            </div>
                        </div>
                    )}

                    {authError && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-center text-sm">
                            {authError}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- SETTINGS VIEW ---
    if (view === 'settings') {
        return (
            <div className="p-6 flex flex-col h-full bg-brand-dark">
                <div className="flex items-center mb-6">
                    <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Settings</h2>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                        <h3 className="font-bold text-white mb-2 flex items-center">
                            <Icons.Zap size={18} className="mr-2 text-brand-primary" />
                            Nostr Relays
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">
                            Connect to these relays to sync your profile, rounds, and scores.
                        </p>

                        <div className="space-y-2 mb-4">
                            {relayList.map(relay => (
                                <div key={relay} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
                                    <span className="text-sm font-mono text-slate-300 truncate mr-2">{relay}</span>
                                    <button
                                        onClick={() => handleRemoveRelay(relay)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-md hover:bg-slate-700 transition-colors"
                                    >
                                        <Icons.Trash size={16} />
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
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white outline-none"
                            />
                            <button
                                onClick={handleAddRelay}
                                disabled={!newRelayUrl}
                                className="p-2 bg-brand-primary text-black rounded-lg font-bold disabled:opacity-50"
                            >
                                <Icons.Plus size={20} />
                            </button>
                        </div>

                        <button
                            onClick={handleResetRelays}
                            className="text-xs text-slate-500 hover:text-white underline w-full text-center"
                        >
                            Reset to defaults
                        </button>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                        <h3 className="font-bold text-white mb-2">App Data</h3>
                        <button
                            onClick={() => {
                                resetRound();
                                alert("Local round cache cleared.");
                            }}
                            className="w-full p-3 flex items-center justify-center hover:bg-red-900/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors text-xs font-mono"
                        >
                            <Icons.Trash size={14} className="mr-2" />
                            Clear active round cache
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- AUTHENTICATED STATE (MAIN) ---

    if (isProfileLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[50vh]">
                <DiscGolfBasketLoader />
            </div>
        );
    }

    return (
        <div className="p-6 pt-10 space-y-8 pb-24 overflow-y-auto flex-1 w-full relative">

            {/* Settings Button */}
            <div className="absolute top-6 right-6 z-10">
                <button
                    onClick={() => setView('settings')}
                    className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                    <Icons.Settings size={20} />
                </button>
            </div>

            {/* Help Modal */}
            {helpModal && helpModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setHelpModal(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <Icons.Close size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-2 pt-2">
                            <div className="w-12 h-12 rounded-full bg-brand-secondary/10 flex items-center justify-center text-brand-secondary mb-2">
                                <Icons.Help size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">{helpModal.title}</h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {helpModal.text}
                            </p>
                        </div>

                        <Button variant="secondary" fullWidth onClick={() => setHelpModal(null)}>
                            Got it
                        </Button>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                                <Icons.LogOut size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Log Out?</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Are you sure you want to log out? You need to have your private key saved somewhere safe to log back in.
                            </p>
                        </div>

                        {/* Private Key Backup in Modal */}
                        {authMethod === 'local' && (
                            <div className="w-full bg-slate-800/50 p-3 rounded-xl border border-slate-600">
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block text-left">
                                    Save your key before leaving
                                </label>
                                <div className="flex items-center space-x-2">
                                    {showSecrets ? (
                                        <div className="flex-1 bg-slate-900 rounded p-2 text-xs text-red-400 font-mono truncate border border-red-900/30">
                                            {getPrivateString()}
                                        </div>
                                    ) : (
                                        <div className="flex-1 bg-slate-900 rounded p-2 text-xs text-slate-500 italic">
                                            ●●●●●●●●●●●●●●●●●●●●
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setShowSecrets(!showSecrets)}
                                        className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white"
                                    >
                                        {showSecrets ? <Icons.EyeOff size={16} /> : <Icons.Eye size={16} />}
                                    </button>
                                    <button onClick={handleCopyNsec} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white">
                                        <Icons.Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {authMethod === 'nip46' && (
                            <div className="flex items-center space-x-2 text-xs text-brand-primary bg-brand-primary/10 p-2 rounded">
                                <Icons.Shield size={14} />
                                <span>Keys managed by Remote Signer (NIP-46)</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="danger" onClick={confirmLogout}>
                                Log Out
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-gradient-to-tr from-brand-primary to-blue-600 rounded-full flex items-center justify-center mb-4 border-4 border-brand-surface shadow-xl relative group overflow-hidden">
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

                {isEditing ? (
                    <div className="w-full space-y-4 max-w-xs text-left">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profile Name</label>
                                <button
                                    onClick={() => openHelp('Profile Name', 'Your public username visible to other players on scorecards and leaderboards.')}
                                    className="text-slate-500 hover:text-brand-primary transition-colors"
                                >
                                    <Icons.Help size={14} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="e.g. Disc Golfer"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-slate-800 p-3 rounded-xl border border-slate-600 text-white text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                            />
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lightning Address</label>
                                <button
                                    onClick={() => openHelp('Lightning Address', 'An internet identifier (like an email) that allows anyone to send you Bitcoin/Sats instantly over the Lightning Network.')}
                                    className="text-slate-500 hover:text-brand-primary transition-colors"
                                >
                                    <Icons.Help size={14} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="user@domain.com"
                                value={formData.lud16}
                                onChange={e => setFormData({ ...formData, lud16: e.target.value })}
                                className="w-full bg-slate-800 p-3 rounded-xl border border-slate-600 text-white text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                            />
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verified Nostr ID</label>
                                <button
                                    onClick={() => openHelp('Verified Nostr ID', 'Also known as NIP-05. This verifies your account by linking your public key to a domain name (e.g., name@nostr.com) and adds a checkmark to your profile.')}
                                    className="text-slate-500 hover:text-brand-primary transition-colors"
                                >
                                    <Icons.Help size={14} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="name@nostr.com"
                                value={formData.nip05}
                                onChange={e => setFormData({ ...formData, nip05: e.target.value })}
                                className="w-full bg-slate-800 p-3 rounded-xl border border-slate-600 text-white text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                            />
                        </div>

                        <div className="flex space-x-2 pt-2">
                            <Button onClick={handleSaveProfile} fullWidth className="h-10 py-0">Save</Button>
                            <Button onClick={() => setIsEditing(false)} variant="secondary" fullWidth className="h-10 py-0">Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-white">{userProfile.name}</h1>

                        <div className="flex flex-col items-center space-y-1 mt-1">
                            {userProfile.nip05 && (
                                <div className="flex items-center text-brand-secondary text-xs font-bold space-x-1 bg-brand-secondary/10 px-2 py-1 rounded-md">
                                    <Icons.CheckMark size={12} />
                                    <span>{userProfile.nip05}</span>
                                </div>
                            )}
                            <button
                                onClick={handleCopyAddress}
                                className="flex items-center text-slate-400 text-sm space-x-2 bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-full transition-all group active:scale-95"
                            >
                                <Icons.Zap size={12} className="text-brand-accent" />
                                <span className="font-mono text-xs">{formatLightningAddress(lightningAddress)}</span>
                                {copiedAddress ? (
                                    <Icons.CheckMark size={12} className="text-green-500" />
                                ) : (
                                    <Icons.Copy size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                )}
                            </button>
                        </div>

                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-brand-primary text-sm font-medium mt-4 hover:underline"
                        >
                            Edit Profile
                        </button>
                    </>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl text-center border border-slate-700">
                    <p className="text-3xl font-bold text-white">{userStats.totalRounds}</p>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Rounds Played</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl text-center border border-slate-700">
                    <p className="text-3xl font-bold text-brand-primary">{userStats.totalSatsWon || 0}</p>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Total Sats Won</p>
                </div>
            </div>

            {/* Key Management */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center space-x-2">
                    <Icons.Key size={18} className="text-brand-accent" />
                    <h3 className="font-bold text-white">My Keys</h3>
                </div>
                <div className="p-4 space-y-4">
                    {/* Public Key */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Public Key (npub)</label>
                        <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-slate-900/50 rounded p-2 text-xs text-slate-400 font-mono truncate">
                                {(() => { try { return nip19.npubEncode(currentUserPubkey); } catch (e) { return '...'; } })()}
                            </div>
                            <button onClick={handleCopyNpub} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white">
                                <Icons.Copy size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Private Key (only if local) */}
                    {authMethod === 'local' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Private Key (nsec)</label>
                            <div className="flex items-center space-x-2">
                                {showSecrets ? (
                                    <div className="flex-1 bg-slate-900/50 rounded p-2 text-xs text-red-400 font-mono truncate border border-red-900/30">
                                        {getPrivateString()}
                                    </div>
                                ) : (
                                    <div className="flex-1 bg-slate-900/50 rounded p-2 text-xs text-slate-500 italic">
                                        ●●●●●●●●●●●●●●●●●●●●
                                    </div>
                                )}

                                <button
                                    onClick={() => setShowSecrets(!showSecrets)}
                                    className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white"
                                >
                                    {showSecrets ? <Icons.EyeOff size={16} /> : <Icons.Eye size={16} />}
                                </button>
                                <button onClick={handleCopyNsec} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white">
                                    <Icons.Copy size={16} />
                                </button>
                            </div>
                            {showSecrets && <p className="text-[10px] text-red-400 mt-1">Warning: Never share your nsec with anyone.</p>}
                        </div>
                    )}

                    {authMethod === 'nip46' && (
                        <div className="flex items-center space-x-2 text-xs text-brand-primary bg-brand-primary/10 p-2 rounded">
                            <Icons.Shield size={14} />
                            <span>Keys managed by Remote Signer (NIP-46)</span>
                        </div>
                    )}
                </div>
            </div>

            <Button
                variant="danger"
                fullWidth
                onClick={handleLogout}
                className="mt-4 mb-8"
            >
                <Icons.LogOut size={18} className="mr-2" />
                Log Out
            </Button>
        </div>
    );
};
