# On-Chain Disc Golf

## What This Is
A PWA that combines disc golf scorekeeping with automatic Bitcoin Lightning settlement. Players create rounds, track scores, and entry fees + payouts are handled automatically via self-custodial wallets.

## Tech Stack
- **Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4
- **Mobile:** Capacitor 7 (iOS/Android shells in `android/`, `ios/`)
- **Identity:** Nostr protocol (nostr-tools v2) for decentralized identity & data
- **Payments:** Breez SDK Spark (Lightning), Cashu eCash, NWC (Nostr Wallet Connect)
- **Build:** PWA-first, deployed on Vercel

## Project Structure
```
App.tsx              # Root component, routing, layout
index.tsx            # React entry point
types.ts             # All TypeScript interfaces/types
constants.ts         # App constants (game defaults, Breez API key)
context/
  AppContext.tsx      # Composition layer (~710 lines) - wires domain contexts + cross-cutting actions
  AuthContext.tsx     # Identity: keypair, login methods, auth source
  WalletContext.tsx   # Multi-wallet state: Cashu/NWC/Breez, transactions, payment detection
  ProfileContext.tsx  # User profile, stats, contacts, recent players
  RoundContext.tsx    # Active round, players, scoring, Nostr sync
  OnboardingContext.tsx
utils/
  payoutCalculations.ts # Payout distribution algorithms (top-heavy, linear)
pages/               # Route-level components
  Home.tsx            # Round setup & management (4180 lines)
  Wallet.tsx          # Wallet UI (5687 lines - largest file)
  Scorecard.tsx       # Active round scoring
  Profile.tsx         # User profile & stats
  Finalization.tsx    # Round finalization & payouts
  Onboarding.tsx      # New user flow
  ProfileSetup.tsx    # Profile creation
  RoundDetails.tsx    # Round info view
  RoundHistory.tsx    # Past rounds
  InviteHandler.tsx   # QR invite handler
services/             # Business logic layer
  nostrService.ts     # Nostr event publishing/fetching
  breezService.ts     # Breez Lightning SDK wrapper
  walletService.ts    # Cashu wallet operations
  nwcService.ts       # Nostr Wallet Connect (uses NIP-04)
  paymentRouter.ts    # Routes payments across wallet types
  npubCashService.ts  # npub.cash integration
  giftWrapService.ts  # NIP-17 gift wrap for P2P payments
  mnemonicService.ts  # BIP39 seed phrase management
  backupService.ts    # Encrypted backup/restore
  feedbackService.ts  # Error capture & feedback
  capacitorService.ts # Native platform bridge
  amberSigner.ts      # Amber (Android) Nostr signer
  nativeQrScanner.ts  # Native QR code scanning
  priceService.ts     # BTC price fetching
components/           # Shared UI components
hooks/                # useQrScanner, useSwipeBack
```

## Commands
- `npm run dev` - Dev server on port 3000
- `npm run build` - Production build
- `npm run typecheck` - TypeScript validation
- `npm run lint` / `npm run lint:fix` - ESLint

## Current Build Status
- **Build:** Succeeds (Vite compiles fine)
- **TypeScript:** Passes clean (0 errors)
- **Chunk warnings:** Main bundle is 1.5MB, needs code splitting

## Protocol Rules (CRITICAL)
- **NIP-44** for all new internal encryption (wallet proofs, backups)
- **NIP-17 Gift Wrap** for all P2P eCash transfers (never Kind 4 DMs)
- **NIP-04 only** for NWC (nwcService.ts) and NIP-46 remote signing - legacy exception
- **nostr-tools v2** syntax only
- **Interoperability first** - data must work if user takes keys to Damus/Amethyst/Snort

## Key Architectural Notes
- AppContext.tsx is a composition layer that wires AuthContext, WalletContext, ProfileContext, and RoundContext together. Cross-cutting actions (createRound, finalizeRound, logout) live here. `useApp()` provides backward-compatible access to all state.
- Wallet.tsx (5687 lines) and Home.tsx (4180 lines) are oversized page components
- No test suite exists
- KeypairAnimations.tsx (1641 lines) sits in root - appears to be a standalone animation demo
- Breez SDK requires WASM - custom Vite plugin handles copying/serving the .wasm file
- The Breez API key (PEM cert) is in constants.ts - should be moved to env vars
