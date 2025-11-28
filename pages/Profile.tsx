
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
        loginNsec, loginNip46, loginAmber, createAccount, currentUserPubkey
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
    const [copiedKeyType, setCopiedKeyType] = useState<'npub' | 'nsec' | null>(null);
    const [copiedLud16, setCopiedLud16] = useState(false);
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

    const SectionHeader = ({ title, icon, id }: { title: string, icon?: React.ReactNode, id: string }) => (
        <button
            onClick={() => toggleSection(id)}
            className={`w-full flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 ${openSection === id ? 'rounded-t-xl border-b-0 bg-slate-800' : 'rounded-xl hover:bg-slate-800 transition-colors'}`}
        >
            <div className="flex items-center font-bold text-white">
                {icon}
                <span className={icon ? 'ml-2' : ''}>{title}</span>
            </div>
            <Icons.Next size={16} className={`text-slate-500 transition-transform duration-200 ${openSection === id ? 'rotate-90' : ''}`} />
        </button>
    );

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
            await createAccount(); // This now publishes the NIP-01 with LUD16
            // Set default bio & open edit mode on success
            setFormData(prev => ({ ...prev, about: "I <3 OnChainDiscGolf.com" }));
            setIsEditing(true);
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

    const handleCopyLud16 = () => {
        if (formData.lud16) {
            navigator.clipboard.writeText(formData.lud16);
            setCopiedLud16(true);
            setTimeout(() => setCopiedLud16(false), 2000);
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
                        onClick={() => {
                            setAuthView('create');
                            setAuthError(''); // Clear error when switching
                        }}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${authView === 'create' ? 'bg-brand-primary text-black' : 'text-slate-400 hover:text-white'}`}
                    >
                        Create Profile
                    </button>
                    <button
                        onClick={() => {
                            setAuthView('login');
                            setAuthError(''); // Clear error when switching
                        }}
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
                                <div className="mt-4 p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-lg">
                                    <p className="text-xs text-brand-primary font-bold">
                                        💡 After creating, add your name so cardmates can find you!
                                    </p>
                                </div>
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

                                {/* Error message right after login button */}
                                {authError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-center text-sm animate-in fade-in slide-in-from-top-2">
                                        {authError}
                                    </div>
                                )}
                            </div>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-slate-700"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase">OR</span>
                                <div className="flex-grow border-t border-slate-700"></div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 ml-1">
                                    <label className="text-sm text-slate-400 font-bold">Amber (Android)</label>
                                    <button
                                        onClick={() => openHelp(
                                            'What is Amber?',
                                            'Amber is a free Android app that keeps your Nostr key safe on your phone - like a password manager, but for social media.\\n\\nInstead of typing your password into websites (which can be hacked), Amber holds your key and signs things for you when you approve them.\\n\\nThink of it like TouchID for your online identity - tap to approve each action, and your key never leaves your phone!'
                                        )}
                                        className="text-slate-500 hover:text-brand-primary transition-colors"
                                    >
                                        <Icons.Help size={14} />
                                    </button>
                                </div>
                                <Button
                                    fullWidth
                                    onClick={() => loginAmber()}
                                    disabled={isLoading}
                                    className="flex items-center justify-center gap-2"
                                >
                                    <Icons.Android size={20} />
                                    <span>{isLoading ? 'Opening Amber...' : 'Connect with Amber'}</span>
                                </Button>
                                <p className="text-[10px] text-slate-500 text-center">
                                    Android users only. <a href="https://github.com/greenart7c3/Amber/releases" target="_blank" rel="noreferrer" className="underline hover:text-brand-primary">Download Amber</a>
                                </p>
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
                                    Use a NIP-46 provider like nsec.app or other remote signers.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- SETTINGS VIEW ---
    // --- SETTINGS VIEW ---
    if (view === 'settings') {

        return (
            <div className="p-6 flex flex-col h-full bg-brand-dark overflow-y-auto">
                <div className="flex items-center mb-6 shrink-0">
                    <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                        <Icons.Prev />
                    </button>
                    <h2 className="text-xl font-bold">Settings</h2>
                </div>

                <div className="space-y-4 pb-24">
                    {/* Nostr Relays */}
                    <div>
                        <SectionHeader id="relays" title="Nostr Relays" icon={<Icons.Share size={18} className="text-purple-400" />} />
                        {openSection === 'relays' && (
                            <div className="bg-slate-800/30 border border-t-0 border-slate-700 rounded-b-xl p-4 animate-in slide-in-from-top-2 duration-200">
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
                        )}
                    </div>

                    {/* Advanced Profile Settings */}
                    <div>
                        <SectionHeader id="advanced" title="Advanced Profile Settings" icon={<Icons.Key size={18} className="text-blue-400" />} />
                        {openSection === 'advanced' && (
                            <div className="bg-slate-800/30 border border-t-0 border-slate-700 rounded-b-xl p-4 animate-in slide-in-from-top-2 duration-200">
                                <p className="text-xs text-slate-400 mb-4">
                                    Manage your technical identity settings.
                                </p>

                                <div className="space-y-4">
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

                                        {/* WARNING ALERT */}
                                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                                            <div className="flex items-start space-x-2">
                                                <Icons.Help size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                                                <p className="text-xs text-yellow-200/80 leading-relaxed">
                                                    <strong className="text-yellow-500 block mb-1">Payout Destination</strong>
                                                    This address controls where you receive payouts. Keep the default to fund your in-app wallet. If you change this to an external wallet (e.g. Strike), your in-app balance will <strong>not update</strong> when you get paid.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="text"
                                                placeholder="user@domain.com"
                                                value={formData.lud16}
                                                onChange={e => setFormData({ ...formData, lud16: e.target.value })}
                                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                                            />
                                            <button
                                                onClick={handleCopyLud16}
                                                className={`p-3 rounded-lg transition-colors shrink-0 ${copiedLud16
                                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                                                    }`}
                                            >
                                                {copiedLud16 ? <Icons.CheckMark size={16} /> : <Icons.Copy size={16} />}
                                            </button>
                                        </div>
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
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                                        />
                                    </div>

                                    <Button onClick={() => {
                                        handleSaveProfile();
                                        alert("Settings saved!");
                                    }} fullWidth className="h-10 py-0">Save Changes</Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* App Data */}
                    <div>
                        <SectionHeader id="data" title="App Data" icon={<Icons.History size={18} className="text-amber-400" />} />
                        {openSection === 'data' && (
                            <div className="bg-slate-800/30 border border-t-0 border-slate-700 rounded-b-xl p-4 animate-in slide-in-from-top-2 duration-200">
                                <button
                                    onClick={() => {
                                        resetRound();
                                        alert("Local round cache cleared.");
                                    }}
                                    className="w-full p-3 flex items-center justify-center hover:bg-red-900/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors text-xs font-mono border border-slate-700 bg-slate-800"
                                >
                                    <Icons.Trash size={14} className="mr-2" />
                                    Clear active round cache
                                </button>
                            </div>
                        )}
                    </div>

                    {/* About */}
                    <div>
                        <SectionHeader id="about" title="About" icon={<Icons.Help size={18} className="text-emerald-400" />} />
                        {openSection === 'about' && (
                            <div className="bg-slate-800/30 border border-t-0 border-slate-700 rounded-b-xl p-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-3 text-sm text-slate-400">
                                    <div className="flex justify-between">
                                        <span>Version</span>
                                        <span className="font-mono text-white">v0.1.0</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Source Code</span>
                                        <a href="https://github.com/GarrettGlass/On-Chain-Disc-Golf" target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">GitHub</a>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Developer</span>
                                        <a href="https://primal.net/Garrett" target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">Nostr Profile</a>
                                    </div>
                                </div>
                            </div>
                        )}
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

            {/* Header Icons */}
            <div className="absolute top-6 right-6 z-10 flex space-x-2">
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

            {/* Help Modal */}
            {helpModal && helpModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
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
                                <h2 className="text-xl font-bold text-white">How It Works</h2>
                            </div>
                        </div>

                        {helpModal.title === 'collapsible' ? (
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {/* What is Nostr? */}
                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => toggleSection('nostr-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold text-sm">N</div>
                                            <span className="font-bold text-white">What is Nostr?</span>
                                        </div>
                                        <Icons.Next size={16} className={`transition-transform ${openSection === 'nostr-help' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {openSection === 'nostr-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-slate-900/30 space-y-3">
                                            <p>
                                                <strong className="text-white">Your identity, your control.</strong> Think of Nostr like having your own house key instead of renting an apartment from a landlord who can kick you out anytime.
                                            </p>
                                            <p>
                                                With traditional apps (Twitter, Instagram), the company owns your account. They can delete it, ban you, or change the rules whenever they want.
                                            </p>
                                            <p>
                                                <strong className="text-purple-400">With Nostr, YOU own your identity.</strong> You have a private key (like a master password) that proves you're you. No company can take it away.
                                            </p>
                                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                                <p className="text-xs text-purple-200 font-bold mb-2">🔑 The Key Analogy:</p>
                                                <p className="text-xs text-purple-100">
                                                    Your <strong>private key (nsec)</strong> is like a master key that unlocks your digital life. You can copy and paste it into <strong>any Nostr app</strong> - Damus, Primal, Amethyst, or this disc golf app - and instantly access your profile, friends, and history.
                                                </p>
                                                <p className="text-xs text-purple-100 mt-2">
                                                    No more creating new usernames and passwords for every website. One key, infinite apps. Your identity travels with you.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* What is Cashu? */}
                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => toggleSection('cashu-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center">
                                                <Icons.Zap size={16} />
                                            </div>
                                            <span className="font-bold text-white">What is Cashu?</span>
                                        </div>
                                        <Icons.Next size={16} className={`transition-transform ${openSection === 'cashu-help' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {openSection === 'cashu-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-slate-900/30 space-y-3">
                                            <p>
                                                <strong className="text-white">Digital cash that actually works like cash.</strong> Remember handing someone a $20 bill? No banks, no permission, instant.
                                            </p>
                                            <p>
                                                Cashu (also called "eCash") lets you do that with Bitcoin. It's <strong>instant</strong>, <strong>private</strong>, and works even when the internet is slow.
                                            </p>
                                            <p className="text-brand-primary font-bold">
                                                Perfect for disc golf: Pay your entry fee, split the pot, settle side bets - all in seconds, right from your phone.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* What is Bitcoin? */}
                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => toggleSection('bitcoin-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-sm">₿</div>
                                            <span className="font-bold text-white">What is Bitcoin?</span>
                                        </div>
                                        <Icons.Next size={16} className={`transition-transform ${openSection === 'bitcoin-help' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {openSection === 'bitcoin-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-slate-900/30 space-y-3">
                                            <p>
                                                <strong className="text-white">Money that can't be stopped.</strong> Bitcoin is digital money that no government, bank, or company controls.
                                            </p>
                                            <p>
                                                Ever had Venmo or PayPal freeze your account? Or charge you fees? Or take days to transfer money? Bitcoin fixes that.
                                            </p>
                                            <p>
                                                <strong className="text-orange-400">For disc golf:</strong> Many tournament directors have had their Venmo/PayPal accounts flagged for "suspicious activity" (collecting entry fees). With Bitcoin, that's impossible. No one can stop your transactions.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Why Does It Matter? */}
                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => toggleSection('why-help')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-accent/20 text-brand-accent flex items-center justify-center">
                                                <Icons.Trophy size={16} />
                                            </div>
                                            <span className="font-bold text-white">Why Does It Matter?</span>
                                        </div>
                                        <Icons.Next size={16} className={`transition-transform ${openSection === 'why-help' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {openSection === 'why-help' && (
                                        <div className="p-4 pt-0 text-sm text-slate-300 leading-relaxed bg-slate-900/30 space-y-3">
                                            <p className="text-white font-bold">
                                                Because your disc golf stats and money shouldn't disappear when a company shuts down.
                                            </p>
                                            <ul className="space-y-2 text-sm">
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2 shrink-0" />
                                                    <span><strong>Your data is yours:</strong> Scores, stats, and profile travel with you to any Nostr app</span>
                                                </li>
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2 shrink-0" />
                                                    <span><strong>Instant payouts:</strong> Win money? It's in your wallet immediately, not "pending" for days</span>
                                                </li>
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2 shrink-0" />
                                                    <span><strong>No middleman:</strong> Play with friends anywhere in the world, no payment processor taking a cut</span>
                                                </li>
                                                <li className="flex items-start space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2 shrink-0" />
                                                    <span><strong>Unstoppable:</strong> No company can ban you, freeze your funds, or delete your history</span>
                                                </li>
                                            </ul>
                                            <p className="text-brand-accent font-bold text-center pt-2">
                                                Play disc golf. Own your game.
                                            </p>
                                        </div>
                                    )}
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

                        {authMethod === 'amber' && (
                            <div className="flex items-center space-x-2 text-xs text-green-400 bg-green-400/10 p-2 rounded">
                                <Icons.Android size={14} />
                                <span>Keys managed by Amber (Android Signer)</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>
                                Cancel
                            </Button>
                            <button
                                className="relative overflow-hidden bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 font-bold py-3 px-4 rounded-xl transition-all active:scale-95 select-none touch-none"
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

            {/* Explosion Animation Overlay */}
            {isExploding && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative flex flex-col items-center">
                        <div className="text-6xl mb-8 animate-bounce">👋</div>
                        <h2 className="text-3xl font-bold text-white mb-2 animate-pulse">Logging Out...</h2>

                        {/* CSS Particles */}
                        {[...Array(20)].map((_, i) => {
                            const angle = (i / 20) * 360;
                            const rad = angle * (Math.PI / 180);
                            const x = Math.cos(rad) * 300;
                            const y = Math.sin(rad) * 300;
                            const color = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5];

                            return (
                                <div
                                    key={i}
                                    className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full"
                                    style={{
                                        backgroundColor: color,
                                        boxShadow: `0 0 10px ${color}`,
                                        animation: `explode-particle-${i} 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards`
                                    }}
                                >
                                    <style>{`
                                        @keyframes explode-particle-${i} {
                                            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                                            100% { transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0); opacity: 0; }
                                        }
                                    `}</style>
                                </div>
                            );
                        })}
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

                        <div className="flex space-x-2 pt-2">
                            <Button onClick={handleSaveProfile} fullWidth className="h-10 py-0">Save</Button>
                            <Button onClick={() => setIsEditing(false)} variant="secondary" fullWidth className="h-10 py-0">Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-white">{userProfile.name}</h1>

                        <div className="flex flex-col items-center space-y-1 mt-3">
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
                        <div className="flex items-center gap-1.5 mb-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Public Key (npub)</label>
                            <button
                                onClick={() => openHelp('What is npub?', '<p class="mb-3">Your <strong>npub</strong> is like your mailing address - it\'s safe to share!</p><p class="mb-2"><strong>Think of it like:</strong></p><p class="ml-4 mb-3">📬 Your public disc golf profile that anyone can see</p><p class="mb-2 text-slate-300"><strong>You can share it to:</strong></p><ul class="ml-6 mb-0 space-y-1 text-slate-300"><li>• Let cardmates find and add you</li><li>• Receive payments from anyone</li><li>• Prove it\'s really you across apps</li></ul>')}
                                className="text-slate-500 hover:text-brand-primary transition-colors"
                            >
                                <Icons.Help size={12} />
                            </button>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-slate-900/50 rounded p-2 text-xs text-slate-400 font-mono truncate">
                                {(() => { try { return nip19.npubEncode(currentUserPubkey); } catch (e) { return '...'; } })()}
                            </div>
                            <button
                                onClick={handleCopyNpub}
                                className={`p-2 rounded transition-colors ${copiedKeyType === 'npub'
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                                    }`}
                            >
                                {copiedKeyType === 'npub' ? <Icons.CheckMark size={16} /> : <Icons.Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Private Key (only if local) */}
                    {authMethod === 'local' && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">private key (nsec)</label>
                                <button
                                    onClick={() => openHelp('What is nsec? 🔑', '<p class="mb-3">Your <strong class="text-red-400">nsec</strong> is like the <strong>only key to your mailbox</strong>. Keep it private!</p><p class="mb-2"><strong>Think of it like:</strong></p><p class="ml-4 mb-3">🔐 Your master password that controls everything</p><div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3"><p class="text-red-400 font-bold text-sm mb-2">⚠️ Important:</p><ul class="ml-4 space-y-1 text-sm text-slate-200"><li>• Your <strong class="text-brand-accent">wallet funds</strong> are tied to this key</li><li>• Never share it with anyone</li><li>• If lost, your money is gone forever</li></ul></div><p class="text-sm text-slate-300"><strong>Backup tip:</strong> Write it on paper and store somewhere safe (like a fireproof safe).</p>')}
                                    className="text-slate-500 hover:text-red-400 transition-colors"
                                >
                                    <Icons.Help size={12} />
                                </button>
                            </div>
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
                                <button
                                    onClick={handleCopyNsec}
                                    className={`p-2 rounded transition-colors ${copiedKeyType === 'nsec'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                                        }`}
                                >
                                    {copiedKeyType === 'nsec' ? <Icons.CheckMark size={16} /> : <Icons.Copy size={16} />}
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
        </div >
    );
};
