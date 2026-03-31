# On-Chain Disc Golf

> *"We'll settle up after the round!"* — Famous last words.

A disc golf scorecard app with integrated Bitcoin payments. Entry fees are collected when players join, and payouts settle automatically when the round ends. No banks, no IOUs, no chasing people down.

Ironically, despite the name, all payments are actually *off-chain*. ;)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with Nostr](https://img.shields.io/badge/Built%20with-Nostr-purple.svg)](https://nostr.com)
[![Powered by Bitcoin](https://img.shields.io/badge/Powered%20by-Bitcoin-orange.svg)](https://bitcoin.org)

[![Download APK](https://img.shields.io/badge/Download_APK-Android-brightgreen?style=for-the-badge)](https://github.com/OnChainDiscGolf/app/releases/latest/download/on-chain-disc-golf-v1.1.0.apk)
[![Open Web App](https://img.shields.io/badge/Open_Web_App-PWA-blue?style=for-the-badge)](https://app.onchaindiscgolf.com)

---

## How It Works

1. **Open the app** — A Nostr keypair is your identity. No sign-up, no passwords.
2. **Create a round** — Set up the course, invite players via QR code, configure entry fees.
3. **Play and score** — Track scores hole-by-hole with real-time sync across all players.
4. **Round ends** — Payouts are calculated and distributed instantly to each player's wallet.

### Wallet Options

| Wallet | What it is |
|--------|------------|
| **Breez Lightning** | Self-custodial Lightning wallet built into the app |
| **Cashu eCash** | Privacy-focused eCash tokens for instant transfers |
| **Nostr Wallet Connect** | Bridge to your existing wallet (Alby, Zeus, etc.) |

---

## Features

- **Scorekeeping** — Rounds and tournaments with real-time multiplayer scoring via Nostr
- **Automatic Settlement** — Entry fees collected on join, prize pools distributed on finalization
- **Tournaments** — Multi-card coordination with live leaderboard and configurable payouts
- **Event Discovery** — Find nearby tournaments by location, see what friends are playing
- **QR Code Join** — Scan to join a round or tournament instantly, with deep link support
- **Offline Resilience** — Action queue retries failed publishes when connectivity returns
- **Self-Sovereign** — Your Nostr keys are your account. Works with any Nostr client.

---

## Install

**Web (recommended):** Open [app.onchaindiscgolf.com](https://app.onchaindiscgolf.com) and add to your home screen.

**Android:** [Download the APK](https://github.com/OnChainDiscGolf/app/releases/latest/download/on-chain-disc-golf-v1.1.0.apk) and install it directly. Or browse [all releases](https://github.com/OnChainDiscGolf/app/releases).

---

## Development

Requires Node.js 20+ (see `.nvmrc`).

```bash
git clone https://github.com/OnChainDiscGolf/app.git
cd app
npm install
npm run dev
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy and PR guidelines.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4 |
| **Identity & Data** | Nostr protocol via nostr-tools v2 |
| **Payments** | Breez SDK Spark, Cashu eCash, Nostr Wallet Connect |
| **Mobile** | Capacitor 7 (Android/iOS) |
| **Deployment** | PWA on Vercel |

---

## Contributing

1. Fork the repo
2. Create a feature branch from `develop`
3. Open a PR to `develop`

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  <strong>Disc golf, financial sovereignty, and digital freedom.</strong><br>
  <em>Now let's play.</em>
</p>
