# 🥏 On-Chain Disc Golf

> *"We'll settle up after the round!"* — Famous last words.

**On-Chain Disc Golf** is a disc golf scorecard app with integrated Bitcoin payments. No banks. No IOUs. No "Venmo is acting weird." Just pay when you start, get paid when you finish.

Ironically, despite the name, all payments are actually *off-chain*. ;)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with Nostr](https://img.shields.io/badge/Built%20with-Nostr-purple.svg)](https://nostr.com)
[![Powered by Bitcoin](https://img.shields.io/badge/Powered%20by-Bitcoin-orange.svg)](https://bitcoin.org)

---

## ⚠️ Experimental Software

**This app is in active development.** While we've done our best to make it reliable, bugs happen. The wallet functionality involves real Bitcoin.

**Please exercise caution:**
- Don't store more sats than you're willing to lose
- Back up your nsec (secret key) — it's your money
- Test with small amounts first
- Report bugs via [GitHub Issues](https://github.com/OnChainDiscGolf/app/issues)

*You are the bank now. That's scary and liberating at the same time.*

---

## 🎯 What Is This?

Think [UDisc](https://udisc.com), but with **freedom technology**:

- **🥏 Disc Golf Scorekeeping** — Track rounds with friends, just like you'd expect
- **⚡ Instant Bitcoin Payments** — Entry fees, ace pots, and payouts. Automatic. Unstoppable.
- **🔑 Self-Sovereign Identity** — Your Nostr key = your identity. No account creation. No password resets. No Big Tech overlords.
- **🌐 Serverless Architecture** — Runs on distributed Nostr relays. Nobody can shut it down. *Nobody can censor your disc golf game.*

### Why Does Disc Golf Need Bitcoin?

Every disc golfer knows the chaos:
- Tournament directors juggling cash, Venmo, and PayPal
- Accounts flagged for "suspicious gambling activity" (it's a $5 ace pot, Mr.IRS Agent)
- The guy who "forgot his wallet" and will "get you next time"
- League organizers spending more time on spreadsheets, collecting payments and counting scores than throwing discs

**On-Chain Disc Golf fixes this.** Entry fees are collected automatically when players join. Payouts happen instantly when the round ends. No human required.

---

## 🛠️ How It Works (The Nerdy Bit)

### The Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Identity** | [Nostr](https://nostr.com) | Decentralized identity. You own your keys, you own your account. |
| **Payments** | [Cashu](https://cashu.space) eCash + [Lightning](https://lightning.network) | Instant, private, permissionless Bitcoin payments |
| **Data** | Nostr Relays | Serverless. Your rounds sync across relays worldwide. |
| **Static Address** | [npub.cash](https://npub.cash) | Lightning address derived from your Nostr pubkey |

### Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. OPEN APP                                                     │
│     └─→ Nostr keypair auto-generated (or import existing)       │
│     └─→ Your nsec IS your wallet. Guard it with your life.      │
│                                                                   │
│  2. RECEIVE PAYMENTS                                             │
│     └─→ Your Lightning address: npub...@npubx.cash              │
│     └─→ npub.cash converts incoming Lightning → Cashu eCash     │
│     └─→ Real-time WebSocket notifies you instantly              │
│                                                                   │
│  3. SEND PAYMENTS                                                │
│     └─→ Cashu tokens sent directly (peer-to-peer)               │
│     └─→ Or pay any Lightning invoice (melts eCash → Lightning)  │
│                                                                   │
│  4. JOIN A ROUND                                                 │
│     └─→ Pay entry fee automatically from Cashu balance          │
│     └─→ Round creator receives eCash instantly                  │
│                                                                   │
│  5. ROUND ENDS                                                   │
│     └─→ Scores calculated, winner determined                    │
│     └─→ Pot distributed automatically via Cashu                 │
│     └─→ No spreadsheets. No arguments. No "I'll pay you later." │
└─────────────────────────────────────────────────────────────────┘
```

### Wallet Options

1. **Built-in Cashu Wallet** (default) — eCash stored locally, backed up to Nostr
2. **Nostr Wallet Connect (NWC)** — Connect your own Lightning wallet (Alby, etc.)
3. **Breeze SDK** *(coming soon)* — Self-custodial Lightning node in your pocket

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
- [x] Cashu eCash wallet integration
- [x] NWC (Nostr Wallet Connect) support
- [x] Lightning address receiving via npub.cash
- [x] Round invites via QR code
- [ ] Native iOS/Android apps (Capacitor)
- [ ] Breeze SDK wallet option
- [ ] Buy Bitcoin directly in-app
- [ ] League management tools
- [ ] Tournament brackets & payouts
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
- [Cashu](https://cashu.space) — Chaumian eCash for Bitcoin
- [npub.cash](https://npub.cash) — Lightning ↔ Cashu bridge
- [Minibits](https://minibits.cash) — Cashu mint
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
