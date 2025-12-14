# 🥏 On-Chain Disc Golf

> *"We'll settle up after the round!"* — Famous last words.

**On-Chain Disc Golf** is a disc golf scorecard app with integrated Bitcoin payments. No banks. No IOUs. No "Venmo is acting weird." Automatic round settlement, instant and hassle-free.

Ironically, despite the name, all payments are actually *off-chain*. ;)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with Nostr](https://img.shields.io/badge/Built%20with-Nostr-purple.svg)](https://nostr.com)
[![Powered by Bitcoin](https://img.shields.io/badge/Powered%20by-Bitcoin-orange.svg)](https://bitcoin.org)

[![Download APK](https://img.shields.io/badge/📱_Download_APK-Android-brightgreen?style=for-the-badge)](https://github.com/OnChainDiscGolf/app/releases/latest)
[![Open Web App](https://img.shields.io/badge/🌐_Open_Web_App-PWA-blue?style=for-the-badge)](https://app.onchaindiscgolf.com)

---

## ⚠️ Early Access Software

**This app is in active development.** While we've done our best to make it reliable, bugs happen. The wallet functionality involves real Bitcoin.

**Please exercise caution:**
- Start with small amounts until you're comfortable
- Back up your nsec (secret key) — it controls your account
- Report bugs via the in-app feedback found on the gear icon. 

*Self-custody means self-responsibility. That's empowering.*

---

## 🎯 What Is This?

Think [UDisc](https://udisc.com), but with **freedom technology**:

- **🥏 Disc Golf Scorekeeping** — Track rounds with friends, just like you'd expect
- **⚡ Instant Bitcoin Settlement** — Round entries and prize pools settle automatically. No waiting. No chasing people down.
- **🔑 Self-Sovereign Identity** — Your Nostr key = your identity. No account creation. No password resets. No Big Tech overlords.
- **🌐 Serverless Architecture** — Runs on distributed Nostr relays. Nobody can shut it down. *Nobody can censor your disc golf game.*

### Why Does Disc Golf Need Bitcoin?

Every disc golfer knows the chaos:
- Tournament directors juggling cash, Venmo, and PayPal
- Payment app delays and holds
- The guy who "forgot his wallet" and will "get you next time"
- League organizers spending more time on spreadsheets, collecting payments and counting scores than throwing discs

**On-Chain Disc Golf fixes this.** Round entries are collected automatically when players join. Settlement happens instantly when the round ends. No human required.

---

## 🛠️ How It Works (The Nerdy Bit)

### The Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Identity** | [Nostr](https://nostr.com) | Decentralized identity. You own your keys, you own your account. |
| **Payments** | [Breez SDK](https://breez.technology) + [Lightning](https://lightning.network) | Self-custodial Lightning wallet built right into the app |
| **Data** | Nostr Relays | Serverless. Your rounds sync across relays worldwide. |
| **Static Address** | [Breez](https://breez.technology) | Human-readable Lightning address: `yourname@breez.tips` |

### Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. OPEN APP                                                     │
│     └─→ Nostr keypair auto-generated (or import existing)       │
│     └─→ Your nsec IS your identity. Guard it carefully.         │
│                                                                   │
│  2. RECEIVE PAYMENTS                                             │
│     └─→ Your Lightning address: yourname@breez.tips             │
│     └─→ Self-custodial via Breez SDK                            │
│     └─→ Funds arrive instantly in your wallet                   │
│                                                                   │
│  3. SEND PAYMENTS                                                │
│     └─→ Pay any Lightning address or invoice                    │
│     └─→ Direct peer-to-peer, no intermediaries                  │
│                                                                   │
│  4. JOIN A ROUND                                                 │
│     └─→ Round entry collected automatically from your balance   │
│     └─→ Round creator receives funds instantly                  │
│                                                                   │
│  5. ROUND ENDS                                                   │
│     └─→ Scores calculated, winner determined                    │
│     └─→ Prize pool distributed automatically                    │
│     └─→ No spreadsheets. No arguments. No "I'll pay you later." │
└─────────────────────────────────────────────────────────────────┘
```

### Wallet Options

1. **Breez SDK Wallet** (default) — Self-custodial Lightning wallet with `@breez.tips` address
2. **Nostr Wallet Connect (NWC)** — Connect your own Lightning wallet (Alby, etc.)
3. **Cashu eCash** — Privacy-focused eCash option for smaller amounts

---

## 📱 Install the App

**On-Chain Disc Golf is a Progressive Web App (PWA).** Install it on your phone for the best experience:

### iOS (Safari)
1. Open [app.onchaindiscgolf.com](https://app.onchaindiscgolf.com) in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**

### Android (Chrome)
1. Open [app.onchaindiscgolf.com](https://app.onchaindiscgolf.com) in Chrome
2. Tap the **menu** (three dots)
3. Tap **"Install App"** or **"Add to Home Screen"**

*Native iOS and Android apps via Capacitor are on the roadmap.*

---

## 🚀 Development

### Prerequisites
- Node.js 20+ (see `.nvmrc`)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/OnChainDiscGolf/app.git
cd app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable lint issues |
| `npm run typecheck` | Run TypeScript type checking |

### Branch Strategy

- `main` — Production (protected, requires PR)
- `develop` — Integration branch
- `feature/*` — New features
- `fix/*` — Bug fixes

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development guidelines.

---

## 🗺️ Roadmap

- [x] Core scorekeeping functionality
- [x] Breez SDK wallet integration (self-custodial)
- [x] NWC (Nostr Wallet Connect) support
- [x] Lightning address receiving via Breez
- [x] Round invites via QR code
- [x] Cashu eCash wallet option
- [ ] Native iOS/Android apps (Capacitor)
- [ ] Buy Bitcoin directly in-app
- [ ] League management tools
- [ ] Tournament brackets & prize distribution
- [ ] Player statistics & handicaps
- [ ] Course community boards

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

The short version:
1. Fork the repo
2. Create a feature branch from `develop`
3. Make your changes
4. Open a PR to `develop`

---

## 🙏 Acknowledgments

Built with love and these awesome projects:

- [Nostr](https://nostr.com) — The decentralized social protocol
- [Breez SDK](https://breez.technology) — Self-custodial Lightning infrastructure
- [Cashu](https://cashu.space) — Chaumian eCash for Bitcoin
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) — Nostr SDK for JavaScript

---

## 📜 License

MIT License — see [LICENSE](LICENSE)

---

## 💜 Support the Project

All you have to do is... PLAY DISC GOLF ON-CHAIN ⚡🥏

---

<p align="center">
  <strong>Disc golf, financial sovereignty, and digital freedom.</strong><br>
  <em>Now let's play.</em> 🥏⚡
</p>
