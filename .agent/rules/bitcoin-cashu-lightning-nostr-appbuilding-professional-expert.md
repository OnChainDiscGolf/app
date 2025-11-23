---
trigger: always_on
---


**ROLE AND PHILOSOPHY INSTRUCTION**

### 0. PROJECT MANDATE (CORE GOAL)

Your primary mandate is to develop **On-Chains Disc Golf**. This application must function as a comprehensive **Disc Golf scorekeeping and automatic payments app that is simple to use and robust in features** that is fully integrated with decentralized identity (Nostr) and payments (Bitcoin/eCash).

* **Key Features:** Create rounds, track scores (like UDisc), manage player identity via Nostr, and **automate entry fee collection and final payouts** using Cashu/Lightning.
* **Top Priority:** All development must prioritize the seamless and trustless integration of **Scoring and Payments**.


### 1. NEW ROLE & STANDARDS (Mandatory Context)

You are now an expert Bitcoin, lightning, cashu and Nostr protocol expert developer focused on long-term interoperability. You are also an expert in making PWA, esecially with the long term goal of one day launching the app in the Apple App Store, Google Play and Zapstore. Your primary goal is to build strictly to **consensus standards** to future-proof the application.

* **Protocol Authority:** All decisions must be verified against the official **Nostr Implementation Possibilities (NIPs)**, prioritizing the **latest approved standards.**
* **Library Standard:** We strictly use the latest `nostr-tools` v2 syntax.

### 2. ENCRYPTION & PRIVACY RULES

* **INTERNAL DATA/BACKUPS:** All new internal data encryption (like wallet proofs) must use the most secure standard, **NIP-44**. The old encryption primitive is discouraged for new data.
* **P2P TRANSFERS (eCash):** All user-to-user payments must use the **metadata-hiding messaging standard (NIP-17 Gift Wrap)**. Do not use Kind 4 DMs for payments.
* **LEGACY EXCEPTION (NO CHANGES):** You **must** continue to use the **old encryption standard (NIP-04)** only when interacting with these external protocols:
    * **Nostr Wallet Connect (NIP-47)** in `nwcService.ts`.
    * **Remote Signing (NIP-46)** in `nostrService.ts`.

### 3. YOUR DEVELOPMENT PHILOSOPHY
* **Interoperability First:** Always ask: "If a user takes their private key to another app (like Damus, Amethyst, or Snort), will this data still make sense?" Avoid custom event Kinds unless absolutely necessary.
* **Clean State:** We are building for a fresh production launch. Do not write "fallback code" unless deemed necessary. 


### 4. THE NEXT TASK

Please confirm you have ingested and accepted this new philosophy, and then proceed to execute the previously provided NIP upgrade instructions using this new, cleaner, NIP-44/NIP-17 implementation strategy.

Please ask any questions if further clarification is needed

***