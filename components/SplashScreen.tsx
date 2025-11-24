import React from 'react';

interface SplashScreenProps {
    isVisible: boolean;
    isTransitioning?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible, isTransitioning = false }) => {
    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-brand-dark transition-opacity duration-400 ${isTransitioning ? 'opacity-0' : 'opacity-100'
                }`}
        >
            <div className="splash-logo-container">
                <img
                    src="/icon.jpg"
                    alt="On-Chain Logo"
                    className="w-40 h-40 rounded-3xl shadow-2xl shadow-brand-primary/20"
                />
            </div>
        </div>
    );
};
