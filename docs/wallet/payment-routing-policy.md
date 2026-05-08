# Payment Routing Policy

This document is the product source of truth for outgoing payment routing in On-Chain Disc Golf.

## Goals

- Prefer Breez for normal public-beta payments when the in-app Breez wallet is initialized and funded.
- Avoid silently spending from a surprising wallet when Breez has enough balance but a payment fails.
- Allow explicit user-selected fallbacks for quick sends.
- Keep the app backend-free and Nostr/Bitcoin-native.
- Clearly distinguish last-resort Cashu DM delivery from completed Lightning settlement.

## Round and tournament payouts

`routePayment()` in `services/paymentRouter.ts` uses this order:

1. Breez, when initialized and funded for the payout amount.
   - First tries Breez Lightning-address payment.
   - If that fails, resolves LNURL itself and pays the invoice with Breez.
   - If Breez is funded but all Breez attempts fail, the payout fails and the host must retry. The router must not silently switch to Cashu/NWC in this case.
2. Fallback wallet Lightning payment, only when Breez is unavailable or underfunded.
   - The supplied `cashuPaymentFn` calls `wallet.sendFunds(...)`, so the active wallet mode determines whether the fallback spend comes from Cashu or a configured NWC wallet.
   - Kind 0 `lud16` is preferred for the recipient Lightning address.
   - If no usable `lud16` is available, the router falls back to the recipient's `npub@npubx.cash` address.
3. Cashu DM, only as the last resort when Lightning fallback fails and a Cashu token can be created.
   - The token is sent through NIP-17 Gift Wrap.
   - Results from this path must set `requiresManualClaim: true`.
   - UI must tell the host that the recipient needs to manually claim/import the token.
4. Failed state.
   - If every route fails, the round should not finalize automatically; the host should see the failed payout and retry after fixing funding/connectivity.

## Quick QR send policy

`getPreferredSendWallet()` in `utils/walletSelection.ts` controls the Wallet screen quick-scan button when the balance tile is in "All" mode.

- Explicit user preferences are honored when the selected wallet exists/configured and has balance.
- In automatic mode, prefer funded Breez first, then configured/funded NWC, then funded Cashu.
- If no wallet has spendable balance, default to Cashu because it is the built-in wallet and can show the clearest funding path.

## UI copy rules

- Breez payments should be labeled as `Lightning (Breez)`.
- Fallback Lightning payments should be labeled as `Lightning (Fallback Wallet)` unless the UI has enough context to name Cashu or NWC specifically.
- `npub.cash` gateway payments should be labeled as `Lightning (npub.cash)`.
- Cashu DM payments should be labeled as `eCash DM (Manual Claim)` and accompanied by copy explaining that the recipient must claim/import the token.

## Test coverage

The policy is covered by:

- `services/paymentRouter.test.ts`
  - Breez success.
  - Breez direct failure with Breez invoice retry success.
  - Funded Breez all-fail state with no silent Cashu fallback.
  - Underfunded Breez fallback to fallback-wallet Lightning payment.
  - `npub.cash` fallback.
  - Cashu DM manual-claim fallback.
  - All-fail state.
  - Display labels for fallback and manual-claim routes.
- `utils/walletSelection.test.ts`
  - Explicit Breez/Cashu/NWC selections.
  - Auto Breez-first preference.
  - NWC fallback when Breez is unavailable/unfunded.
  - Cashu fallback and empty-wallet default.
