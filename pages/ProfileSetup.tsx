import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { uploadProfileImage } from '../services/nostrService';

export const ProfileSetup: React.FC = () => {
    const { userProfile, updateUserProfile, createAccount, isGuest } = useApp();
    const [name, setName] = useState(userProfile.name || 'Disc Golfer');
    const [picture, setPicture] = useState(userProfile.picture || '');
    const [pdga, setPdga] = useState(userProfile.pdga || '');
    const [isUploading, setIsUploading] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const navigate = useNavigate();

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

    const handleContinue = async () => {
        // Show transition state first
        setIsTransitioning(true);

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

        // Small delay to ensure state is settled before navigation
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clear any saved round creation state so user lands on home screen, not Players screen
        localStorage.removeItem('cdg_round_creation');

        // Navigate to root - HomeOrOnboarding will show Home (Play tab) for authenticated users
        navigate('/');
    };

    // Show transition screen while navigating
    if (isTransitioning) {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-brand-primary/20 rounded-full flex items-center justify-center border-2 border-brand-primary shadow-[0_0_30px_rgba(45,212,191,0.3)] animate-pulse">
                    <Icons.Play className="text-brand-primary" size={40} />
                </div>
                <h2 className="text-xl font-bold text-white mt-6">Let's Play!</h2>
                <p className="text-slate-400 text-sm mt-2">Setting up your profile...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col">
            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-4">
                <div className="max-w-md mx-auto">
                    <h1 className="text-3xl font-bold text-white">Welcome!</h1>
                    <p className="text-slate-400 text-sm mt-1">Let's set up your profile</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 max-w-md mx-auto w-full space-y-6 nav-safe-bottom">

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
