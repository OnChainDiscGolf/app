# On-Chain Disc Golf

## What This Is
A PWA that combines disc golf scorekeeping with automatic Bitcoin Lightning settlement. Players create rounds, track scores, and entry fees + payouts are handled automatically via self-custodial wallets.

## Development Philosophy
- **Top Priority:** Seamless, trustless integration of scoring and payments.
- **Interoperability First:** Data must work if a user takes their keys to Damus, Amethyst, or Snort. Avoid custom event Kinds unless absolutely necessary.
- **Clean State:** Building for production. Do not write speculative fallback code or backwards-compatibility shims unless there is a concrete need.
- **Protocol Expertise Required:** This app operates at the intersection of Bitcoin, Lightning, Cashu eCash, and Nostr. Understand the protocols before making changes.

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
  AppContext.tsx      # Composition layer - wires domain contexts + cross-cutting actions
  AuthContext.tsx     # Identity: keypair, login methods, auth source (incl. Amber signer)
  WalletContext.tsx   # Multi-wallet state: Cashu/NWC/Breez, transactions, payment detection
  ProfileContext.tsx  # User profile, stats, contacts, recent players
  RoundContext.tsx    # Active round, players, scoring, Nostr sync
  TournamentContext.tsx # Tournament state, live leaderboard, card assignments
  OnboardingContext.tsx
  NetworkContext.tsx  # Online/offline detection, relay connectivity, reconnection events
utils/
  payoutCalculations.ts # Payout distribution algorithms (top-heavy, linear)
  geohash.ts           # Geohash encoding, prefix generation, haversine distance
  qrUrls.ts            # Join URL builder/parser for QR codes (rounds & tournaments)
  breezPaymentUtils.ts # Breez payment helper utilities
  invoiceValidation.ts # Lightning invoice validation
  transactionFilters.ts # Transaction list filtering logic
  walletSelection.ts   # Wallet selection/routing helpers
pages/               # Route-level components (large pages split into subdirectories)
  home/              # Round setup & management
    Home.tsx         # Orchestrator (~1195 lines): state, effects, view routing
    HomeMenuView.tsx, HomeSetupView.tsx, HomeSelectPlayersView.tsx,
    HomeCustomizeView.tsx, HomeScanPlayerView.tsx, HomeSettingsView.tsx,
    SuccessOverlay.tsx
    homeTypes.ts     # Shared prop interfaces
  wallet/            # Wallet UI
    Wallet.tsx       # Orchestrator (~5139 lines): all state + view JSX
    WalletOverlays.tsx, WalletHelpModals.tsx, WalletModeSwitcher.tsx
    walletConstants.ts # Color mappings, wallet order
  profile/           # User profile & stats
    Profile.tsx      # Orchestrator (~458 lines): state, effects, view routing
    ProfileGuestView.tsx, ProfileMainView.tsx, ProfileSettingsView.tsx, ProfileLoadingView.tsx
    profileTypes.ts  # Shared prop interfaces
  events/            # Event discovery (nearby + friends + mine)
    Events.tsx       # Orchestrator: geolocation, relay queries, tab routing
    EventsNearbyView.tsx, EventsFriendsView.tsx, EventsMineView.tsx
    eventsTypes.ts   # Shared prop interfaces
  tournament/        # Tournament/league mode (multi-card coordination)
    Tournament.tsx   # Orchestrator: state, effects, view routing
    TournamentLobbyView.tsx, TournamentSetupView.tsx, TournamentRegistrationView.tsx,
    TournamentCardAssignmentView.tsx, TournamentLeaderboardView.tsx
    tournamentTypes.ts # Shared prop interfaces
  Scorecard.tsx      # Active round scoring
  Finalization.tsx   # Round finalization & payouts
  Onboarding.tsx     # New user flow
  ProfileSetup.tsx, RoundDetails.tsx, RoundHistory.tsx, InviteHandler.tsx
  JoinHandler.tsx    # Handles /join/round/:id and /join/tournament/:id URLs
services/             # Business logic layer
  nostrService.ts     # Nostr event publishing/fetching
  breezService.ts     # Breez Lightning SDK wrapper
  walletService.ts    # Cashu wallet operations
  nwcService.ts       # Nostr Wallet Connect (uses NIP-04)
  paymentRouter.ts    # Routes payments across wallet types
  depositPollingService.ts # Polls for deposit confirmations
  npubCashService.ts  # npub.cash integration
  geocodeService.ts   # Nominatim (OpenStreetMap) geocoding for tournament location search
  giftWrapService.ts  # NIP-17 gift wrap for P2P payments
  mnemonicService.ts  # BIP39 seed phrase management
  backupService.ts    # Encrypted backup/restore
  feedbackService.ts  # Error capture & feedback
  capacitorService.ts # Native platform bridge
  notificationService.ts # Centralized push notifications (native + web)
  actionQueueService.ts  # Offline action queue with retry on reconnect
  amberSigner.ts      # Amber (Android) Nostr signer
  nativeQrScanner.ts  # Native QR code scanning
  priceService.ts     # BTC price fetching
components/           # Shared UI components
  Icons.tsx          # Icon components used throughout the app
  BottomNav.tsx      # Bottom navigation bar
  OfflineBanner.tsx  # Connectivity status banner
  PaymentRequestModal.tsx # One-tap payment request UI
  NotificationPreferences.tsx # Notification settings toggles
  JoinQrCode.tsx     # Reusable QR code display for round/tournament join URLs
  MnemonicBackup.tsx # Seed phrase backup flow
  FundingGuide.tsx   # Step-by-step wallet funding instructions
  RoundSummaryModal.tsx, SplashScreen.tsx, Logo.tsx, Button.tsx,
  FeedbackModal.tsx, DiscGolfBasketLoader.tsx, GuidedTour.tsx,
  InfoModal.tsx, LightningStrike.tsx
hooks/                # useQrScanner, useSwipeBack, useNotificationPreferences, useDenomination
scripts/              # Tooling (feedback_digest.py — feedback analysis)
```

## Commands
- `npm run dev` - Dev server on port 3000
- `npm run build` - Production build
- `npm run typecheck` - TypeScript validation
- `npm run lint` / `npm run lint:fix` - ESLint
- `npm run test` - Run tests (Vitest, watch mode)
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage
- `npm run cap:sync` - Sync Capacitor native projects
- `npm run cap:android` / `npm run cap:ios` - Build and open in native IDE

## Current Build Status
- **Build:** Succeeds (Vite compiles fine)
- **TypeScript:** Passes clean (0 errors)
- **Tests:** Vitest suite with ~105 unit tests across utils/ and services/
- **Chunk warnings:** Main bundle is 1.5MB, needs code splitting

## Protocol Rules (CRITICAL)
- **NIP-44** for all new internal encryption (wallet proofs, backups)
- **NIP-17 Gift Wrap** for all P2P eCash transfers (never Kind 4 DMs)
- **NIP-04 only** for NWC (nwcService.ts) and NIP-46 remote signing - legacy exception
- **nostr-tools v2** syntax only
- **Interoperability first** - data must work if user takes keys to Damus/Amethyst/Snort

## Key Architectural Notes
- AppContext.tsx is a composition layer that wires AuthContext, WalletContext, ProfileContext, RoundContext, and TournamentContext together. Cross-cutting actions (createRound, finalizeRound, createTournament, finalizeTournament, logout) live here. `useApp()` provides backward-compatible access to all state.
- NetworkContext.tsx monitors online/offline state and relay connectivity. OfflineBanner renders in Layout.
- Large pages are split into subdirectories (pages/home/, pages/wallet/, pages/profile/) with orchestrator + view sub-components. Orchestrators own all hooks/state; sub-components receive props. Re-exported via index.tsx for lazy loading.
- Wallet.tsx is the largest file (~5139 lines). Helper components extracted (WalletOverlays, WalletHelpModals, WalletModeSwitcher), but view JSX kept inline due to 100+ state variables.
- TournamentContext.tsx manages tournament state and live leaderboard. Subscribes to scores across all cards simultaneously via a single Nostr filter. Each card is a standard Kind 30001 round — existing scoring/subscription logic works unchanged. Kind 30003 is the tournament coordination event.
- Tournament supports 3 card assignment modes: director-assigns (manual), random (Fisher-Yates shuffle), player's-choice (self-select). Tournament routes: /tournament, /tournament/create.
- Events tab (/events) provides tournament discovery via 3 sub-tabs: Nearby (geohash `g` tags on Kind 30003 events, queried via relay `#g` filters), Friends (`#p` tag queries against contacts/recentPlayers), Mine (user's own tournaments). Tournaments with location data publish `g` tags at multiple precision levels (3-6 chars) for relay-side filtering. Bottom nav: Play, Events, Wallet, Profile.
- notificationService.ts dispatches push notifications via Capacitor (native) or Web Notification API (PWA). Preferences stored in localStorage.
- actionQueueService.ts queues failed Nostr publishes for retry on reconnection. Use publishXxxWithRetry() wrappers for resilient publishing.
- QR code join flow: All QR codes encode `https://app.onchaindiscgolf.com/join/{round|tournament}/{id}?p={pubkey}` URLs. JoinHandler.tsx at `/join/:type/:id` fetches the event from Nostr and shows join UI. Deep linking via Android App Links and iOS Universal Links. setupDeepLinkHandler() in Layout routes `/join/*` URLs to React Router.
- Payment request flow: When host confirms cardmates with entry fees, Lightning invoices are generated via `depositFunds()` (supports Cashu, NWC, and Breez) and sent to each player via NIP-17 Gift Wrap DMs. Player's app detects `type: 'payment_request'` in the Gift Wrap listener, dispatches a custom event, and PaymentRequestModal shows a one-tap "Pay" button. Player pays via `sendFunds()` which routes transparently through any wallet type. On success, a `payment_confirmation` Gift Wrap is sent back to the host. Cashu token fallback exists if Lightning fails.
- `sendFunds()` in WalletContext supports all three wallet types (Cashu, NWC, Breez). `depositFunds()` and `checkDepositStatus()` also support all three.
- Auth supports multiple methods: generated keypair, imported nsec, NIP-46 remote signing, and Amber (Android) external signer.
- Breez SDK requires WASM - custom Vite plugin handles copying/serving the .wasm file. The Breez API key (PEM cert) is loaded from `VITE_BREEZ_API_KEY` env var (see `.env.example`).
- KeypairAnimations.tsx (1577 lines) in root is a disc-in-basket animation component.
