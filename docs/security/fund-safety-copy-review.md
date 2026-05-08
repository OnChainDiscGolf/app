# Fund-safety copy review

Task: B5 — Fund-safety copy pass

## Scope reviewed

- Wallet main transaction list and wallet beta warning copy (`pages/wallet/Wallet.tsx`)
- Recovery phrase backup and encrypted Nostr backup copy (`components/MnemonicBackup.tsx`)
- Funding guide payment timing copy (`components/FundingGuide.tsx`)
- Profile setup private key warning (`pages/ProfileSetup.tsx`)
- Related wallet-mode copy from B4 (`pages/wallet/walletModeUx.ts`, `pages/wallet/WalletModeSwitcher.tsx`)
- Payment request modal status copy (`components/PaymentRequestModal.tsx`)

## Changes made

- Added explicit transaction status badges for complete, pending, and failed wallet history rows so settlement states are visually and textually distinct.
- Added a wallet-page beta safety note: self-custodial, beta, try small amounts first, save the recovery phrase, and treat pending/failed payments as unresolved until complete.
- Clarified that QR backups should be stored offline like the recovery phrase.
- Clarified that encrypted Nostr backups still require the user-chosen password, and the app cannot recover funds if both the password and phrase are lost.
- Corrected profile setup nsec copy so it says the nsec controls Nostr identity, not the Breez wallet funds, and does not replace the wallet recovery phrase.
- Softened funding guide timing claims from “arrives instantly/seconds” to “most payments arrive in seconds,” with guidance to wait for clear success if pending.

## Manual review notes

- No updated copy promises that the project, app operator, or relays can recover funds without the user’s phrase/password.
- Backup wording now distinguishes local/offline phrase and QR backups from password-encrypted Nostr backups.
- Failed/pending/complete states now have separate labels and colors in transaction history.
- Beta warning is present in the wallet surface without blocking or discouraging normal use.

## Follow-up candidates outside this card

- Consider extracting transaction status badge copy/styles into a small tested helper if transaction-history UI grows.
- Consider a future UX pass on the large wallet page to reduce duplicated receive/funding copy.
