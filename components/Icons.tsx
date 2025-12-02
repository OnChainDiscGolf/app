import React from 'react';
import {
  Wallet,
  Plus,
  PlusCircle,
  QrCode,
  Users,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
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
  Search,
  User,
  BarChart3,
  Bug,
  MessageSquare,
  Send,
  CreditCard,
  Link2
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

// Custom iOS Share Icon - Arrow pointing up from box
const IOSShare = ({ size = 24, className = "", strokeWidth = 2 }: { size?: number, className?: string, strokeWidth?: number }) => (
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
    className={`lucide lucide-ios-share ${className}`}
  >
    {/* Box/tray at bottom */}
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />

    {/* Arrow shaft */}
    <line x1="12" y1="3" x2="12" y2="15" />

    {/* Arrow head */}
    <polyline points="7 8 12 3 17 8" />
  </svg>
);

// Cheeky Smirk Face - for when the host keeps the pot!
const SmirkFace = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-smirk ${className}`}
  >
    {/* Face circle */}
    <circle cx="12" cy="12" r="10" />
    
    {/* Left eye - normal */}
    <circle cx="9" cy="10" r="1" fill="currentColor" />
    
    {/* Right eye - winking */}
    <path d="M14 9.5c.5.5 1 .5 1.5 0" />
    
    {/* Smirk mouth - asymmetric smile */}
    <path d="M8 15c1 1.5 3 2 5 1.5s2.5-1.5 3-2.5" />
  </svg>
);

// Custom Bitcoin Icon - Official ₿ symbol
const Bitcoin = ({ size = 24, className = "", strokeWidth = 2 }: { size?: number, className?: string, strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="-10.5 0 32 32"
    fill="currentColor"
    className={`${className}`}
  >
    <path d="M11.28 18.6c0-1.44-0.72-2.72-1.84-3.48 0.68-0.64 1.080-1.52 1.080-2.52 0-1.84-1.44-3.36-3.24-3.44v-1.48c0-0.48-0.4-0.84-0.84-0.84s-0.84 0.4-0.84 0.84v1.48h-0.56v-1.48c0-0.48-0.4-0.84-0.84-0.84s-0.84 0.4-0.84 0.84v1.48h-2.52c-0.44 0-0.84 0.36-0.84 0.84s0.4 0.84 0.84 0.84h0.8v10.32h-0.8c-0.44 0-0.84 0.36-0.84 0.84s0.4 0.84 0.84 0.84h2.44v1.48c0 0.48 0.4 0.84 0.84 0.84s0.84-0.4 0.84-0.84v-1.48h0.56v1.48c0 0.48 0.4 0.84 0.84 0.84s0.84-0.4 0.84-0.84v-1.48c2.32-0.12 4.080-1.96 4.080-4.24zM7.040 10.84c0.96 0 1.76 0.8 1.76 1.76s-0.8 1.76-1.76 1.76h-3.68v-3.52h3.68zM7.040 21.16h-3.68v-5.080h3.72c1.4 0 2.52 1.12 2.52 2.52s-1.16 2.56-2.56 2.56z" />
  </svg>
);

// Custom Cashew Nut Icon - for Cashu wallet (scaled to match Lucide icon sizes)
const Cashew = ({ size = 24, className = "", strokeWidth = 2 }: { size?: number, className?: string, strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth / 2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-cashew ${className}`}
  >
    {/* Scale up and center the cashew to fill the viewBox like other Lucide icons */}
    <g transform="translate(12, 12) scale(2.2) translate(-12, -7.5) scale(-1,1) translate(-24,0)">
      <path 
        d="M9.39961786,5.16239885 L9.790122,5.33671324 C11.2461411,5.98665534 12.909875,5.98665534 14.365894,5.33671324 L15.2027995,4.96313291 C15.8731908,4.66388165 16.6592414,4.96475012 16.9584927,5.63514143 C16.9905732,5.70700902 17.0162078,5.78158367 17.0350944,5.85798656 C17.2583783,6.76124615 16.8295087,7.69921353 16.0002677,8.12122407 L13.2508222,9.52044928 C11.8861907,10.2149263 10.2711695,10.2122957 8.90880767,9.51337663 L8.58835113,9.34897597 C7.49151241,8.78627564 6.89469218,7.5698063 7.12092165,6.35798656 C7.28699849,5.4683801 8.1427989,4.88184346 9.03240536,5.0479203 C9.15887933,5.07153119 9.28213245,5.10995537 9.39961786,5.16239885 Z M9.07800802,6.42713768 C10.998008,7.22713768 13.158008,7.22713768 15.078008,6.42713768"
        transform="translate(12.083585, 7.443400) rotate(-75) translate(-12.083585, -7.443400)"
      />
    </g>
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
  Back: ChevronLeft,
  Chart: TrendingUp,
  Zap,
  History,
  Check: CheckCircle,
  Close: XCircle,
  More: MoreVertical,
  Send: ArrowUpRight,
  SendMessage: Send,
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
  Dollar: DollarSign,
  UserPlus,
  Search,
  User,
  ChevronDown,
  Bitcoin,
  IOSShare,
  SmirkFace,
  BarChart: BarChart3,
  Bug,
  Feedback: MessageSquare,
  CreditCard,
  Link: Link2,
  Cashew,
};