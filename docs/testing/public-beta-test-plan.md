# Public beta test plan

Use this as the central test plan for every public beta candidate of On-Chain Disc Golf. The goal is to prove the beta is safe enough for casual Android users to install, onboard, keep score, join rounds by QR/deep link, use Breez-first wallet/payment flows, recover from normal interruptions, and preserve control of their Nostr/Bitcoin-native data without relying on a project-operated backend.

## Beta scope and assumptions

- Primary beta platform: Android APK distributed directly and through Zapstore.
- Primary wallet path: Breez SDK Spark first; Cashu/NWC remain secondary or explicitly gated by configuration.
- Identity/data architecture: Nostr-native identity and sync through public relays; no project-operated backend for app data.
- Target users: casual disc golfers who may not already understand Lightning, Nostr, seed phrases, or APK sideloading.
- Funds used in testing: tiny amounts only. Never paste or store mnemonics, private keys, API keys, wallet credentials, or raw logs containing secrets.

## Release gates

A beta candidate may ship only if all P0 issues are closed, P1 issues have either been closed or explicitly accepted by PM/product, and the four release gates below are green.

### Android install gate

Required evidence:

- Signed release APK installs and updates successfully on at least one physical Android device.
- Zapstore metadata points to the expected package ID, version name/code, APK URL, and checksum.
- App launches from the distributed APK without a blank screen or crash.
- Android back button, keyboard behavior, splash screen, icon, camera permission, and deep-link handling are acceptable.

Blocking examples:

- P0: APK cannot be installed, app crashes on launch, wrong package ID, broken signing/update path.
- P1: QR camera permission flow is confusing but recoverable, keyboard blocks required onboarding input, Zapstore metadata mismatch.

### Wallet/payment gate

Required evidence:

- Breez readiness state is visible to the user and retryable after transient failures.
- Receive/create invoice path works in the intended beta environment.
- Payment status updates do not duplicate, hang indefinitely, or falsely report settlement.
- Wallet failure states tell the user what to do next without exposing secrets.
- NWC/Cashu options remain disabled, clearly labeled, or verified for the release scope.

Blocking examples:

- P0: user funds can be lost, payments falsely finalize, seed/private key exposure, irrecoverable wallet initialization failure for normal installs.
- P1: Breez readiness routinely requires app restart, payment status is ambiguous after refresh, wallet error copy causes unsafe user behavior.

### Onboarding gate

Required evidence:

- New user can complete first-run onboarding without prior Nostr/Lightning knowledge.
- Existing user can import or resume identity through the supported beta path.
- Backup/recovery instructions are clear and do not ask users to share secrets.
- Offline or relay-degraded states are understandable during onboarding.

Blocking examples:

- P0: onboarding dead-end, identity loss, backup exports unusable, secret displayed or logged unsafely.
- P1: onboarding copy implies a backend account exists, recovery flow lacks confirmation, relay failure gives no actionable next step.

### Scorekeeping gate

Required evidence:

- User can create a round, add/select players, enter scores, edit score mistakes, and finalize the round.
- Score totals, payout preview, and final results stay internally consistent.
- Active round state survives app backgrounding, refresh, offline/reconnect, and Android process interruption within beta expectations.
- Round join links/QR codes route users to the correct round/tournament context.

Blocking examples:

- P0: scores disappear or corrupt, wrong winner/payout calculation, finalize publishes irreversibly wrong results, QR join sends users to the wrong round.
- P1: score edit works only before refresh, offline banner hides scoring controls, finalization UX is unclear but data remains safe.

## Bug severity definitions

### P0 — Stop ship / emergency fix

A bug is P0 if it can cause fund loss, secret exposure, unrecoverable identity or round-data loss, incorrect irreversible settlement/finalization, APK install/launch failure for normal beta users, or a security/privacy violation. No public beta release ships with an open P0.

Examples:

- App crashes before onboarding or wallet access.
- Mnemonic/private key/API key is displayed in logs, telemetry, screenshots, or support text.
- Payment shown as settled when it failed or settled to the wrong recipient.
- Scorekeeping corruption changes final results or payouts after finalization.
- Backup restore cannot recover the identity/wallet data it claims to protect.

### P1 — Beta blocker unless explicitly accepted

A bug is P1 if a core beta flow is unreliable, confusing enough to block casual users, or likely to cause support burden, but it does not create immediate fund/secret/data-loss risk. P1 issues should be fixed before public beta unless PM/product explicitly accepts them as known issues with clear mitigation.

Examples:

- Breez initialization often fails until retry or app restart.
- QR join fails on common Android camera/deep-link paths.
- Offline/resume loses unsynced local changes that can still be reconstructed.
- Onboarding language sends users to the wrong wallet/recovery action.
- Zapstore listing is installable but metadata/release notes are materially wrong.

### P2 — Non-blocking polish / follow-up

A bug is P2 if it is cosmetic, low-frequency, or affects non-core beta behavior without blocking install, onboarding, scorekeeping, wallet safety, QR join, offline/resume, or backup/recovery. P2 issues can ship when tracked and communicated if user-visible.

Examples:

- Minor layout clipping on one screen size where all actions remain usable.
- Copy typo that does not change meaning.
- Slow but successful refresh.
- Non-critical animation or icon issue.

## Automated test cases

Run automated checks from a clean checkout or release branch before manual beta testing:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run cap:sync
```

If the exact release build process is being verified, also run the Android release checklist in `docs/release/android-beta-release-checklist.md`.

### Automated coverage matrix

| Area | Test case | Expected result | Gate |
| --- | --- | --- | --- |
| TypeScript | `npm run typecheck` | 0 type errors | Android, onboarding, wallet, scorekeeping |
| Lint | `npm run lint` | 0 lint errors | All gates |
| Unit tests | `npm run test:run` | Existing service/utils tests pass | Wallet, scorekeeping, offline/resume, backup |
| Production build | `npm run build` | Vite production build succeeds | Android install |
| Capacitor sync | `npm run cap:sync` | Android assets/plugins sync without unexpected native changes | Android install |
| Wallet readiness | Breez service tests | Missing credentials fail safely; retry/deduplication behavior remains deterministic | Wallet/payment |
| Invoice validation | Invoice/payment utility tests | Invalid invoices are rejected; valid beta invoices parse consistently | Wallet/payment |
| Payout math | Payout calculation tests | Top-heavy/linear payouts match expected totals and recipients | Scorekeeping, wallet/payment |
| QR URL parsing | QR URL utility tests | Round/tournament join URLs parse and reject malformed inputs | QR join, scorekeeping |
| Backup crypto | Backup service tests | Export/import round-trip works and rejects bad passphrases/corrupt payloads | Backup/recovery |
| Offline queue | Action queue/network tests | Queued actions retry once online and do not duplicate | Offline/resume, scorekeeping |

### Automated test gaps to track

If a row above does not have existing automated coverage, file or keep a follow-up issue before beta launch. Missing automation is not automatically P0, but missing coverage for payout math, backup restore, invoice validation, QR parsing, or score persistence should be treated as at least P1 risk until manually verified.

## Manual test cases

Record each manual run with tester, date, app version, git commit, device model, Android version, install source, network condition, wallet mode, and pass/fail notes.

### 1. Android install and launch

Preconditions:

- Signed release APK and checksum are available.
- Tester has a physical Android device with camera access.

Steps:

1. Install the APK directly with `adb install -r` or from the published Zapstore path.
2. Confirm Android shows package `app.onchain.discgolf` and the expected version.
3. Launch the app from the launcher icon.
4. Background and reopen the app.
5. Use Android back navigation from onboarding/home/wallet/scorecard screens.

Expected result:

- APK installs or updates cleanly.
- App launches without crash/blank screen.
- No required screen is trapped by back button or keyboard behavior.
- Splash/icon look production-acceptable.

Severity guidance:

- Install/launch failure is P0.
- Broken update path, wrong version, or unusable navigation is P1 unless it causes data/fund loss.

### 2. New user onboarding

Preconditions:

- Clean app data or fresh device profile.
- Normal online connection.

Steps:

1. Launch the app as a new user.
2. Complete the default beta onboarding path.
3. Confirm the app explains identity/wallet expectations in casual-user language.
4. Deny and then allow optional permissions where available.
5. Reach the home screen with a usable profile state.

Expected result:

- User can complete onboarding without external help.
- Permission denial is recoverable.
- The app does not imply a custodial/project-hosted backend account.

### 3. Existing user resume/import

Preconditions:

- A test identity or backup created for this test only. Do not use real personal funds or production secrets.

Steps:

1. Install/reinstall the APK.
2. Use the supported beta resume/import path.
3. Confirm profile, wallet readiness state, recent players/round data, or documented subset is restored.
4. Confirm unsupported recovery paths are clearly labeled rather than silently failing.

Expected result:

- Supported recovery succeeds.
- Unsupported recovery fails safely with clear next steps.
- No secret is exposed in logs or UI beyond intentional user-owned backup display.

### 4. Breez wallet readiness and receive flow

Preconditions:

- Network online.
- Breez test configuration available outside the repo.
- Tiny-value test funds only.

Steps:

1. Open Wallet after onboarding.
2. Observe Breez readiness/loading/error state.
3. If initialization fails, tap retry once.
4. Create or display a receive invoice through the beta-supported path.
5. Pay it from an external test wallet or mark the test as environment-blocked if no test liquidity is available.
6. Refresh/reopen the app and confirm status remains consistent.

Expected result:

- Wallet readiness is visible and retryable.
- Invoice creation succeeds or fails with actionable safe copy.
- Payment detection does not duplicate transactions or hang forever without status.

### 5. Payment during round finalization

Preconditions:

- At least two test players.
- Wallet path from test 4 is ready.
- Tiny-value entry fee/payout settings.

Steps:

1. Create a paid round.
2. Enter scores for all players.
3. Review payout preview before finalizing.
4. Finalize the round.
5. Complete or simulate the supported payment path.
6. Reopen round history/details.

Expected result:

- Payout preview and final result match score totals.
- Payment state is clear and not duplicated.
- Round finalization does not corrupt scores if payment is pending/fails.

### 6. Free scorekeeping round

Preconditions:

- Wallet may be unavailable; this test proves scorekeeping is usable independently.

Steps:

1. Create a free round.
2. Add at least three players.
3. Enter scores across multiple holes.
4. Edit a previous hole score.
5. Navigate away and return to the scorecard.
6. Finalize the round and view summary/history.

Expected result:

- Scores persist and totals update correctly.
- Score edit is reflected in totals and final summary.
- Wallet unavailability does not block free scorekeeping.

### 7. QR join and deep link

Preconditions:

- Two Android devices or one physical device plus emulator/browser.
- Camera permission available.

Steps:

1. Device A creates a round or tournament and displays the join QR/link.
2. Device B scans the QR or opens the join link.
3. Device B accepts the join flow.
4. Device A confirms the joined player appears where expected.
5. Repeat once with camera permission initially denied, then allowed.

Expected result:

- QR encodes the correct round/tournament context.
- Deep link opens the app or install path as expected.
- Permission denial is recoverable.
- Joined user is not routed to the wrong event.

### 8. Offline/resume during active round

Preconditions:

- Active round with at least two players.

Steps:

1. Enter scores for several holes while online.
2. Turn on airplane mode or otherwise disconnect.
3. Confirm offline banner/state appears.
4. Enter more scores and navigate between allowed screens.
5. Background the app for at least 60 seconds.
6. Reopen while still offline, then reconnect.
7. Confirm queued/synced state after reconnect.

Expected result:

- Active round data is not lost.
- Offline state is clear.
- Reconnect does not duplicate Nostr publishes or payments.
- Any unsynced state is either synced or clearly marked.

### 9. App interruption and resume

Preconditions:

- Active round and wallet screen have both been visited.

Steps:

1. Start a round and enter scores.
2. Open Wallet and return to the scorecard.
3. Background the app.
4. Force-stop or let Android reclaim the app if practical.
5. Relaunch.
6. Confirm the previous app state or safe recovery path.

Expected result:

- User does not lose the active round.
- Wallet status reloads safely.
- Any pending action is idempotent or clearly recoverable.

### 10. Backup and recovery

Preconditions:

- Test identity/wallet only.
- No real personal wallet secrets.

Steps:

1. Create a profile and at least one completed round.
2. Create the supported encrypted backup/export.
3. Save it outside the app using the normal Android share/file flow.
4. Clear app data or install on a second test profile.
5. Restore/import the backup.
6. Confirm identity/profile and expected app data are present.
7. Try one wrong passphrase/corrupt backup case.

Expected result:

- Valid backup restores the promised data.
- Bad passphrase/corrupt payload fails safely.
- App never asks user to send backup material, mnemonics, or private keys to support.

### 11. No project-operated backend regression

Preconditions:

- Normal public relay connectivity.
- Release build or production-like environment.

Steps:

1. Complete onboarding and scorekeeping smoke tests.
2. Observe network behavior through app UI/state rather than packet logging unless needed.
3. Confirm flows rely on public Nostr relays and wallet providers, not a project-operated API for core app data.
4. Disable or degrade relay connectivity and confirm the app communicates the limitation.

Expected result:

- Core beta flows remain Nostr/Bitcoin-native.
- Relay/provider failures fail visibly and safely.
- No hidden project backend is required for scorekeeping, identity, or wallet state.

## Beta test run template

Copy this into the release tracker for each beta candidate:

```text
Beta version:
Git commit:
APK filename:
APK SHA-256:
Install source: direct APK / Zapstore
Tester:
Date:
Device model:
Android version:
Network conditions:
Wallet mode/config:

Automated checks:
- npm run typecheck:
- npm run lint:
- npm run test:run:
- npm run build:
- npm run cap:sync:

Manual checks:
- Android install and launch:
- New user onboarding:
- Existing user resume/import:
- Breez wallet readiness and receive flow:
- Payment during round finalization:
- Free scorekeeping round:
- QR join and deep link:
- Offline/resume during active round:
- App interruption and resume:
- Backup and recovery:
- No project-operated backend regression:

Open bugs:
- P0:
- P1:
- P2:

Release gate status:
- Android install gate: green / yellow / red
- Wallet/payment gate: green / yellow / red
- Onboarding gate: green / yellow / red
- Scorekeeping gate: green / yellow / red

Ship decision:
Known issues / PM acceptance:
```

## Public beta exit criteria

Before announcing public beta:

- All automated checks pass on the release candidate.
- Manual Android install, onboarding, wallet/payment, scorekeeping, QR join, offline/resume, and backup/recovery cases have been run on the signed APK.
- All P0 bugs are closed.
- All P1 bugs are closed or accepted by PM/product with clear mitigation.
- Release notes include user-visible known issues and recovery guidance.
- The Android release checklist has been completed through Zapstore/post-publish verification when publishing through Zapstore.
