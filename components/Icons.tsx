import React from 'react';
import {
  Wallet,
  Plus,
  PlusCircle,
  QrCode,
  Users,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Zap,
  History,
  CheckCircle,
  XCircle,
  MoreVertical,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  Copy,
  Trash2,
  Check,
  Play,
  Key,
  LogOut,
  Shield,
  Eye,
  EyeOff,
  CircleHelp,
  Camera,
  Share2,
  RefreshCw,
  MapPin,
  DollarSign,
  UserPlus,
  Search
} from 'lucide-react';

// Custom Disc Golf Basket Icon matching Lucide style
const Basket = ({ size = 24, className = "", strokeWidth = 2 }: { size?: number, className?: string, strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-basket ${className}`}
  >
    {/* Pole */}
    <path d="M12 5v16" />

    {/* Base */}
    <path d="M8 21h8" />

    {/* Top Band */}
    <rect x="7" y="3" width="10" height="2" rx="1" />

    {/* Basket Tray / Cage */}
    <path d="M5 14h14l-1.5 5h-11z" />
    {/* Vertical cage bars */}
    <path d="M9 14l0.5 5" />
    <path d="M15 14l-0.5 5" />

    {/* Chains (Outer Curves) */}
    <path d="M7 5c0 5 2 9 5 9" />
    <path d="M17 5c0 5 -2 9 -5 9" />

    {/* Chains (Inner Curves) */}
    <path d="M9 5c0 4 1 8 3 8" />
    <path d="M15 5c0 4 -1 8 -3 8" />
  </svg>
);

// Custom Android Icon for Amber app
const Android = ({ size = 24, className = "", strokeWidth = 2 }: { size?: number, className?: string, strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-android ${className}`}
  >
    {/* Head */}
    <path d="M6 9h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />

    {/* Antennas */}
    <path d="M8 5l-1.5-2.5" />
    <path d="M16 5l1.5-2.5" />

    {/* Eyes */}
    <circle cx="10" cy="12" r="0.5" fill="currentColor" />
    <circle cx="14" cy="12" r="0.5" fill="currentColor" />

    {/* Arms */}
    <path d="M4 10v4" />
    <path d="M20 10v4" />

    {/* Legs */}
    <path d="M9 18v3" />
    <path d="M15 18v3" />
  </svg>
);

export const Icons = {
  Trophy: Basket, // Replaced Trophy with Basket
  Wallet,
  Plus: PlusCircle,
  PlusIcon: Plus,
  QrCode,
  Users,
  Next: ChevronRight,
  Prev: ChevronLeft,
  Chart: TrendingUp,
  Zap,
  History,
  Check: CheckCircle,
  Close: XCircle,
  More: MoreVertical,
  Send: ArrowUpRight,
  Receive: ArrowDownLeft,
  Settings,
  Copy,
  Trash: Trash2,
  CheckMark: Check,
  Play,
  Key,
  LogOut,
  Shield,
  Eye,
  EyeOff,
  Help: CircleHelp,
  Camera,
  Share: Share2,
  Refresh: RefreshCw,
  Android,
  Location: MapPin,
  DollarSign,
  UserPlus,
  Search
};