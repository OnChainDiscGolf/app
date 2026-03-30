/**
 * @file BottomNav.tsx
 * @description Fixed bottom navigation bar for the app's four main tabs:
 * Play, Events, Wallet, and Profile. Handles tab switching with route
 * replacement (so browser back doesn't cycle through tabs) and dispatches
 * a `popToRoot` CustomEvent when the user taps an already-active tab.
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons } from './Icons';

/**
 * Bottom navigation bar rendered at the root layout level.
 *
 * Renders four tab buttons (Play, Events, Wallet, Profile) anchored to the
 * bottom of the viewport. Uses `replace` navigation so tab switches don't
 * pollute the browser history stack. When the user taps the already-active
 * tab, a `popToRoot` CustomEvent is dispatched so the corresponding page
 * can reset its internal navigation state.
 *
 * @returns The fixed-position bottom navigation bar.
 */
export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Icons.Trophy, label: 'Play', tourId: 'tour-nav-play' },
    { path: '/events', icon: Icons.Calendar, label: 'Events', tourId: 'tour-nav-events' },
    { path: '/wallet', icon: Icons.Wallet, label: 'Wallet', tourId: 'tour-nav-wallet' },
    { path: '/profile', icon: Icons.Users, label: 'Profile', tourId: 'tour-nav-profile' },
  ];

  const handleNavClick = (path: string) => {
    if (isActive(path)) {
      // User tapped the already-active tab - dispatch "pop to root" event
      const event = new CustomEvent('popToRoot', { detail: { path } });
      window.dispatchEvent(event);
    } else {
      // Navigate to the new tab (replace so back doesn't cycle through tabs)
      navigate(path, { replace: true });
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-brand-surface/90 backdrop-blur-md border-t border-slate-700 pb-safe pt-2 px-6 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="flex justify-between items-center max-w-md mx-auto h-16">
        {navItems.map((item) => {
          const isBasket = item.label === 'Play';
          const iconSize = isBasket ? 32 : 24;
          const iconStrokeWidth = isBasket 
            ? (isActive(item.path) ? 1.75 : 1.5) 
            : (isActive(item.path) ? 2.5 : 2);
          
          return (
            <button
              key={item.path}
              id={item.tourId}
              onClick={() => handleNavClick(item.path)}
              className={`flex flex-col items-center w-16 transition-colors ${isActive(item.path) ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <div className="h-7 flex items-end justify-center">
                <item.icon size={iconSize} strokeWidth={iconStrokeWidth} />
              </div>
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
