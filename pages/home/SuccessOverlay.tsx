/**
 * @file SuccessOverlay.tsx
 *
 * Lightweight success feedback overlay used within the Home module.
 * Displays a green checkmark animation with a custom message, then
 * auto-dismisses after 2 seconds. Used after successful payment
 * confirmations and other positive actions during round setup.
 */

import React, { useEffect } from 'react';
import { Icons } from '../../components/Icons';

/**
 * Full-screen success animation overlay that auto-closes after 2 seconds.
 *
 * @param message - Text displayed beneath the checkmark icon.
 * @param onClose - Callback invoked on auto-dismiss to clean up parent state.
 */
export const SuccessOverlay: React.FC<{ message: string, onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center animate-in zoom-in duration-300 rounded-2xl">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/30 animate-in fade-in zoom-in-75 delay-100 duration-500">
                <Icons.CheckMark size={40} className="text-white" strokeWidth={4} />
            </div>
            <h3 className="text-2xl font-bold text-white animate-in slide-in-from-bottom-4 delay-200">{message}</h3>
        </div>
    );
};
