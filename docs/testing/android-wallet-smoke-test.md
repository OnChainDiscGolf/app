# Android wallet smoke test — Breez send/receive

Use this checklist for every Android beta candidate where Breez/Spark wallet behavior is in scope. The goal is to prove that a casual user can receive a small payment, send a small payment, refresh balance, see accurate transaction history, and recover safely from a failed payment without the app falsely showing success.

## Safety rules

- Use a physical Android device and a release-like APK; emulator-only runs do not satisfy this smoke test.
- Use tiny amounts only, normally 1-25 sats plus expected fees.
- Use test wallets/identities only. Do not use personal production wallets.
- Never paste mnemonics, private keys, NWC strings, Breez API keys, payment preimages, or raw logs into this document or a ticket.
- Screenshots are okay only if they do not expose secrets. Redact invoices after they expire if attaching evidence.
- If any step appears to risk fund loss or secret exposure, stop and file a P0.

## Required test record

Record this at the top of the release tracker or bug report for every run:

```text
Smoke run ID:
Tester:
Date/time:
Git commit:
APK filename/version:
Install source: direct APK / Zapstore / internal build
Device model:
Android version:
Network: Wi-Fi / cellular / mixed
Wallet mode: Breez
Breez environment/config source: production / staging / other external config
Breez config present in build: yes / no / blocked
Starting Breez balance:
External test wallet used for receive funding:
External receive target used for send test:
Amounts used:
Open bugs:
Final result: pass / fail / blocked
```

## Preconditions

### Build/config readiness preflight

Before installing the APK for any Breez-focused run, confirm the build was created with Breez configuration present:

1. Put the real Breez SDK Spark API key in local `.env.local` or CI secrets as `VITE_BREEZ_API_KEY`. Use `.env.example` only as a template; never commit or paste the real key.
2. Rebuild the web assets and Android bundle after changing the env value. Vite reads `VITE_*` values at build time, so installing an older APK will still behave as missing-config even if the local shell is now configured.
3. On the device, open Wallet -> Breez. If the APK was built without the key, the app must show: `Breez API key is not configured for this build...` and no send/receive test may proceed from that APK.
4. Record only `Breez config present: yes / no / blocked` in the test record. Do not record the key value, PEM body, screenshots containing secrets, or raw logs.

- Signed or release-like Android APK is installed and launches.
- The tester can complete onboarding with a test identity.
- Breez wallet setup is complete and the Wallet tab can be opened.
- Device has normal internet connectivity.
- External test wallet can pay a Lightning invoice or Lightning address.
- External receive target can receive from the app, either as a BOLT11 invoice or Lightning address.
- The app starts from a known state: note the current Breez balance and visible transaction count before testing.

## Pass/fail rules

The smoke test passes only if all required sections below pass.

Treat as P0 / stop-ship:

- Payment is shown as successful when the payer or recipient shows failure.
- Balance increases/decreases by the wrong amount in a way that suggests fund loss.
- The app exposes mnemonic, private key, API key, preimage, or wallet credential material.
- Transaction history fabricates a completed transaction for a failed payment.

Treat as P1 / beta blocker unless accepted:

- Breez initializes only after app restart instead of clear retry.
- Balance refresh is ambiguous or stale after a settled payment.
- Send/receive error copy does not tell a casual tester what happened or what to try next.
- Transaction history is missing entries after refresh/reopen.

## Tiny-funds manual test amounts

Use the smallest amount your external test wallet and current Breez environment will reliably route:

- Default manual receive invoice: 5 sats.
- Default manual receive address payment: 5 sats.
- Default manual send amount: 5 sats plus the displayed routing fee.
- If the external wallet rejects 5 sats, increase only to the minimum it accepts and record the reason.
- Stop before sending if the app does not show an explicit send/confirm action, the fee looks unreasonable for a tiny test, or the tester cannot verify the destination belongs to the external test wallet.

## Section A — Breez readiness and balance refresh

Expected path in app: Wallet tab -> choose/expand Breez wallet if not already selected.

1. Launch the app fresh.
2. Complete onboarding or open an existing test profile.
3. Open Wallet.
4. Select Breez if the wallet selector is not already on Breez.
5. Confirm the Breez readiness/loading/error state is visible.
6. If an initialization error is shown, tap retry once and record the result.
7. Note the displayed Breez balance.
8. Pull to refresh or use the visible refresh path if present; otherwise background and reopen the app to trigger refresh.

Expected result:

- Breez becomes ready, or failure copy is clear and retryable.
- Balance is visible in sats.
- Refresh/reopen does not reset wallet mode or show a contradictory balance.
- No secret material is displayed.

Result:

```text
A result: pass / fail / blocked
Starting balance:
Ending balance after refresh:
Notes:
```

## Section B — Receive through Breez invoice

Expected path in app: Wallet tab -> Breez -> Receive -> Invoice.

1. Open Wallet with Breez selected.
2. Open Receive.
3. Choose invoice mode if the UI offers address vs invoice.
4. Enter a tiny amount, such as 5 sats.
5. Generate the invoice.
6. Confirm a BOLT11 invoice or QR is shown.
7. Pay the invoice from an external test wallet.
8. Wait for the app to detect settlement.
9. Refresh balance or background/reopen the app.
10. Open transaction history.

Expected result:

- Invoice generation succeeds, or failure copy is actionable and safe.
- External wallet can pay the invoice.
- Breez balance increases by the received amount, subject to any expected fees/SDK behavior.
- Transaction history records an incoming/received Breez entry with the expected amount and completed status.
- Reopening the app does not duplicate the transaction.

Result:

```text
B result: pass / fail / blocked
Invoice amount:
External payer result:
Balance before:
Balance after:
Transaction history entry present: yes / no
Duplicate entry after reopen: yes / no
Notes:
```

## Section C — Receive through Spark / Lightning address

Expected path in app: Wallet tab -> Breez -> Receive -> Address.

1. Open Wallet with Breez selected.
2. Open Receive.
3. Choose address mode if available.
4. Copy or scan the displayed Breez/Spark receive address or Lightning address.
5. Pay a tiny amount from an external test wallet.
6. Wait for the app to detect settlement.
7. Refresh balance or background/reopen the app.
8. Open transaction history.

Expected result:

- A receive address is available without exposing the seed/mnemonic.
- External wallet can pay the address in the intended beta environment, or the app clearly states why it cannot.
- Breez balance increases by the received amount, subject to expected fees/SDK behavior.
- Transaction history records the incoming Breez payment once.

Result:

```text
C result: pass / fail / blocked
Address type used: Spark / Lightning address / other
Amount:
External payer result:
Balance before:
Balance after:
Transaction history entry present: yes / no
Duplicate entry after reopen: yes / no
Notes:
```

## Section D — Send to BOLT11 invoice

Expected path in app: Wallet tab -> Breez -> Send.

1. Ensure the Breez balance is high enough for a tiny send plus fees.
2. Generate a tiny BOLT11 invoice in an external test wallet.
3. In the app, open Wallet with Breez selected.
4. Open Send.
5. Paste or scan the BOLT11 invoice.
6. Confirm the parsed amount and fee estimate look reasonable.
7. Send the payment.
8. Confirm the external wallet sees settlement.
9. Refresh balance or background/reopen the app.
10. Open transaction history.

Expected result:

- Invoice parses successfully.
- App asks for an explicit send action before spending.
- Successful payment shows clear success.
- Breez balance decreases by amount plus expected fee.
- Transaction history records an outgoing Breez payment with completed status.
- Reopening the app does not duplicate the transaction.

Result:

```text
D result: pass / fail / blocked
Invoice amount:
Fee shown:
External recipient result:
Balance before:
Balance after:
Transaction history entry present: yes / no
Duplicate entry after reopen: yes / no
Notes:
```

## Section E — Send to Lightning address

Expected path in app: Wallet tab -> Breez -> Send.

1. Ensure the Breez balance is high enough for a tiny send plus fees.
2. Prepare an external Lightning address that can receive tiny payments.
3. In the app, open Wallet with Breez selected.
4. Open Send.
5. Paste the Lightning address.
6. Enter a tiny amount if the UI asks for one.
7. Confirm the parsed destination and fee estimate look reasonable.
8. Send the payment.
9. Confirm the external wallet sees settlement.
10. Refresh balance or background/reopen the app.
11. Open transaction history.

Expected result:

- Lightning address parses/resolves successfully.
- Successful payment shows clear success.
- Breez balance decreases by amount plus expected fee.
- Transaction history records an outgoing Breez payment with completed status.

Result:

```text
E result: pass / fail / blocked
Lightning address provider:
Amount:
Fee shown:
External recipient result:
Balance before:
Balance after:
Transaction history entry present: yes / no
Notes:
```

## Section F — Failed payment behavior

Use one safe negative case. Prefer an expired or already-paid invoice over anything that might accidentally route funds.

1. Create an invoice in an external test wallet.
2. Expire it, cancel it, or pay it once externally so a second payment should fail.
3. In the app, open Wallet with Breez selected.
4. Open Send.
5. Paste the invalid/expired/already-paid invoice.
6. Attempt to parse/send.
7. Record the exact user-facing result without copying raw secret-bearing logs.
8. Refresh balance and reopen transaction history.

Expected result:

- The app shows a clear failed/invalid result.
- The app does not show success.
- Breez balance does not decrease except for an actually-settled payment verified by the external wallet.
- Transaction history does not create a completed send entry for the failed attempt.
- If a failed/pending entry appears, it is visibly failed/pending rather than completed.

Result:

```text
F result: pass / fail / blocked
Negative case used: expired invoice / already-paid invoice / invalid invoice / other
User-facing error:
Balance before:
Balance after:
Completed transaction falsely created: yes / no
Notes:
```

## Section G — Final consistency check

1. Fully close the app from Android recents.
2. Relaunch it.
3. Open Wallet with Breez selected.
4. Refresh/reopen balance if needed.
5. Review transaction history for all payments from this run.
6. Compare the app balance and history to the external wallet records.

Expected result:

- Final balance matches the starting balance plus receives minus sends/fees within expected Breez/Lightning fee behavior.
- Each successful receive/send has one corresponding transaction history entry.
- Failed payment test has no completed success entry.
- App remains usable after relaunch.

Result:

```text
G result: pass / fail / blocked
Expected final balance calculation:
Displayed final balance:
History entries match run: yes / no
Notes:
```

## Smoke test summary template

```text
Final result: pass / fail / blocked
Sections passed:
Sections failed:
Sections blocked:
P0 bugs filed:
P1 bugs filed:
P2 bugs filed:
Release gate impact: wallet/payment green / yellow / red
Tester notes:
```

## Current repository verification

This document is the repeatable checklist required for the wallet/payment gate. Repository-level verification for the checklist itself is:

```bash
npm run typecheck
```

A run of `npm run typecheck` only verifies that adding/updating this checklist did not break the TypeScript project. It does not replace the physical-device smoke run above.
