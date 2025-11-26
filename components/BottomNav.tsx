
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons } from './Icons';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Icons.Trophy, label: 'Play' },
    { path: '/wallet', icon: Icons.Wallet, label: 'Wallet' },
    { path: '/profile', icon: Icons.Users, label: 'Profile' },
  ];

  const handleNavClick = (path: string) => {
    if (isActive(path)) {
      // User tapped the already-active tab - dispatch "pop to root" event
      const event = new CustomEvent('popToRoot', { detail: { path } });
      window.dispatchEvent(event);
    } else {
      // Navigate to the new tab
      navigate(path);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-brand-surface/90 backdrop-blur-md border-t border-slate-700 pb-safe pt-2 px-6 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto h-16">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavClick(item.path)}
            className={`flex flex-col items-center space-y-1 w-16 transition-colors ${isActive(item.path) ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <item.icon size={24} strokeWidth={isActive(item.path) ? 3 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
