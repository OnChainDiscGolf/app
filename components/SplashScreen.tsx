/**
 * @file SplashScreen.tsx
 * @description Full-screen splash/loading screen displayed during app
 * initialization. Shows the app icon centered on a dark background with
 * a fade-out transition when the app is ready.
 */

import React from 'react';

/**
 * Props for the {@link SplashScreen} component.
 *
 * @property isVisible - Whether the splash screen is rendered at all.
 * @property isTransitioning - When true, applies an opacity-0 transition to fade out. Defaults to false.
 */
interface SplashScreenProps {
    isVisible: boolean;
    isTransitioning?: boolean;
}

/**
 * Full-screen splash screen shown during app startup.
 *
 * Renders the app icon (`/icon.jpg`) centered on a dark background at z-50.
 * When `isTransitioning` is set to true, the entire overlay fades out over
 * 400ms before being removed from the DOM when `isVisible` becomes false.
 *
 * @param props - {@link SplashScreenProps}
 * @returns The splash overlay, or `null` when `isVisible` is false.
 */
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
