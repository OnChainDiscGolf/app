/**
 * @file Button.tsx
 * @description Reusable button component with variant styling (primary,
 * secondary, danger, ghost) and optional full-width mode. Extends native
 * HTML button attributes.
 */

import React from 'react';

/**
 * Props for the {@link Button} component.
 *
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement>
 * @property variant - Visual style variant. Defaults to `'primary'`.
 * @property fullWidth - Whether the button stretches to fill its container. Defaults to `false`.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

/**
 * Styled button component with four visual variants.
 *
 * - **primary** - Emerald green with shadow (default, used for CTAs)
 * - **secondary** - Dark surface with border (used for secondary actions)
 * - **danger** - Red (used for destructive actions)
 * - **ghost** - Transparent with hover effect (used for subtle actions)
 *
 * Includes `active:scale-95` press feedback and disabled state handling.
 *
 * @param props - Standard button HTML attributes plus variant and fullWidth.
 * @returns A styled `<button>` element.
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-4 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 hover:bg-emerald-400",
    secondary: "bg-brand-surface text-white border border-slate-600 hover:bg-slate-700",
    danger: "bg-red-500 text-white hover:bg-red-600",
    ghost: "bg-transparent text-slate-400 hover:text-white"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};