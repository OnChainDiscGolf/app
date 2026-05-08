# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Vitest test harness with ~105 unit tests across utils/ and services/
- Amber (Android) signer flow with auth-method-aware onboarding UX

### Changed
- Breez is now the explicit primary outgoing rail in paymentRouter
- Replaced keypair animations with on-brand disc-in-basket animations
- Extracted pure utility modules from Wallet.tsx for testability

## [1.1.0] - 2026-03-30

### Added
- Tournament mode with multi-card coordination, live leaderboard, and configurable payouts
- Events tab with nearby/friends/mine tournament discovery via geohash
- QR code join flow with deep linking (Android App Links, iOS Universal Links)
- Offline resilience via action queue with retry on reconnect
- Denomination setting (USD/sats) with app-wide formatting
- "Just Keep Score" quick start on welcome screen
- Post-round sharing as Nostr note
- Course name input with auto-suggest from recent courses
- On-chain Bitcoin receive via exchange deposit (Coinbase, Robinhood, etc.)
- Step-by-step funding guide for Cash App, Strike, and other wallets
- Scorecard help and settings modals
- Zapstore app store listing

### Changed
- Split monolithic AppContext into domain contexts (Auth, Wallet, Profile, Round, Tournament, Network)
- Lazy-load all routes for better performance
- Welcome screen redesigned to lead with value prop, not tech stack
- Breez API key moved to environment variable
- TypeScript CI gate enforced

### Fixed
- Payout logic, fund safety, and scoring edge cases
- Handicap controls redesigned on player tiles
- Backup confirmation now allows manual write-down
- Navigation to homepage after dismissing round summary

## [1.0.0] - 2025-12-14

### Changed
- CI workflow triggers on develop branch
- Java 17 compatibility for Gradle builds

## [0.1.0] - 2025-12-14

### Added
- Disc golf scorekeeping with real-time multiplayer sync via Nostr
- Cashu eCash wallet with multi-mint proof management
- Nostr Wallet Connect (NWC) integration
- Breez SDK Spark Lightning wallet
- Automatic entry fee collection and payout distribution
- Nostr-based identity (keypair generation, nsec import, NIP-46 remote signing)
- NIP-17 Gift Wrap for P2P eCash transfers
- NIP-44 encryption for wallet proofs and backups
- npub.cash integration for Lightning address payments
- Pull-to-refresh wallet balance
- QR code scanning for payments and round invites
- Instant invite flow with ephemeral keys
- Player handicaps, starting hole selection, penalty tracking
- Round history and player statistics
- BIP39 seed phrase backup/restore
- Profile with PDGA number, NIP-05, Lightning address
- PWA with service worker and home screen install
- Capacitor shells for Android and iOS
- Animated splash screen and disc golf basket loader
- Guided tour and help modals
- GitHub Actions CI for Android APK builds

[Unreleased]: https://github.com/OnChainDiscGolf/app/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/OnChainDiscGolf/app/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/OnChainDiscGolf/app/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/OnChainDiscGolf/app/releases/tag/v0.1.0
