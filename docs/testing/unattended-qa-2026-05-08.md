# Unattended QA report — 2026-05-08

Branch: `beta/readiness-foundation`  
PR: https://github.com/OnChainDiscGolf/app/pull/4

## Summary

I completed the unattended QA pass in three layers:

- Browser/PWA smoke test.
- Native Android debug APK build.
- Real Pixel 6 device smoke test over wireless ADB.

The no-funds Android path now has real-device coverage through launch, onboarding, wallet view, no-entry-fee round creation, players/QR, payment/start, score entry, and next-hole navigation.

I did **not** move sats or run real Breez send/receive flows. Breez initialization was skipped in this QA build because the Breez API key was not configured.

## Android SDK / build status

Initial blocker: Gradle was pointed at `/usr/lib/android-sdk`, which is a minimal system-owned SDK missing Android platform/build-tools packages.

Resolution:

- Found a full user-writable SDK at `~/Android/Sdk`.
- Updated `android/local.properties` locally to:

```properties
sdk.dir=/home/garrett/Android/Sdk
```

- Rebuilt successfully with that SDK.

Successful native build:

```text
./gradlew :app:assembleDebug
```

Debug APK produced:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

No sudo was needed.

## Physical Android device status

USB still failed at Linux enumeration earlier in the session, with errors like:

- `device descriptor read/64, error -32`
- `device not accepting address ..., error -71`
- `unable to enumerate USB device`

However, wireless debugging worked.

Discovered device:

```text
192.168.1.161:34753  Pixel_6
```

ADB connection succeeded over Wi-Fi.

Existing package on phone:

```text
app.onchain.discgolf
```

Install attempt for the normal debug APK was blocked by signature mismatch because the phone already had `app.onchain.discgolf` installed with a different signing key. I did **not** uninstall the existing app because that could wipe app data/keys.

For safe side-by-side testing, I temporarily built a QA package with:

```text
applicationIdSuffix ".debug"
```

Installed package:

```text
app.onchain.discgolf.debug
```

The temporary Gradle change was reverted locally after testing. The real app package was left untouched.

## Real Android smoke coverage

Device: Pixel 6 over wireless ADB

Package tested: `app.onchain.discgolf.debug`

Screenshots/logs: local raw artifacts under `qa-output/android-device/` (ignored by git)

### Launch / first run

Result: app launched successfully; no crash.

Observed:

- Android showed a compatibility warning on launch: native libraries are not 16 KB page-size compatible.
- Notification permission prompt appeared; I denied notifications for unattended testing.
- App loaded to the expected onboarding/landing screen.

Important finding:

- The app should be checked for Android 15/16 KB page-size readiness. The warning appears to come from bundled native libraries, likely barcode/MLKit-related.

### Onboarding

Result: passed.

Flow:

- Tapped `Just Keep Score`.
- App created/used a local profile and landed on Play home.
- Guided tour appeared and could be skipped.

### Wallet page

Result: passed with warnings.

Observed:

- Wallet screen rendered.
- Balance showed 0 sats.
- Beta safety note visible.
- Funding guide card, Send, and Receive buttons visible.
- No visible crash/error state in the UI.

Notable logcat warnings:

```text
Breez SDK not yet initialized, balance pending...
Breez initialization skipped: API key is missing. Configure the Breez API key, then retry.
[WalletContext] Breez init returned false
```

This is expected for a QA build without Breez credentials, but it means real Breez wallet behavior remains untested.

Visual notes:

- Wallet overview subtitle truncates on device.
- A right-side orange/bordered wallet element appeared partially clipped/overflowing off-screen.
- Bottom navigation is close to the Android gesture bar.

### Events/location permission state

Result: screen handled denied location state without crash.

Observed:

- Events screen showed: `Location permission denied. Enable it in your browser settings.`

Native-app copy issue:

- “browser settings” is web-specific wording. On Android this should say something like “device settings” or “app settings.”

### No-entry-fee round setup

Result: passed.

Flow:

- Opened Create Round.
- Entered a QA course name.
- Selected `No Entry Fee`.
- Advanced to Players.

Notes:

- ADB text input represented spaces as `%20` in the field during this automated pass. That appears to be an ADB-input artifact, not necessarily an app bug.
- If `Next` is tapped before a course is entered, the UI still needs clearer validation/disabled-state feedback.

### Players / QR join

Result: passed.

Flow:

- Players screen opened with `Disc Golfer (You)` as host.
- `Show QR Code for Players` displayed a join QR code.
- With the QR panel expanded, `Confirm Cardmates` is pushed below the fold; scrolling reveals it.
- Confirmed cardmates with only the host.

UX note:

- One-player/solo flow works, but a short helper like “Continue solo or invite players” would make this more obvious.

### Payment / Start Round

Result: passed for no-entry-fee round.

Observed:

- Payment screen opened.
- Player listed correctly.
- `Start Round` visible.
- Started round without funds or payment prompts, as expected for `No Entry Fee`.

### Scorecard / scoring / hole navigation

Result: passed.

Flow:

- Scorecard opened on Hole 1.
- Added score using plus button.
- Score persisted/displayed as `E (3)`.
- Used next-hole arrow to navigate to Hole 2.
- Hole 2 displayed, player persisted, cumulative score state persisted, and Hole 2 input was blank/dash as expected.

Notes:

- Tapping the small Hole 2 number directly was less reliable than using the right-arrow navigation.
- Active score display starts as a dash, which may be unclear to new users.
- No course name/round context is visible on the active scorecard surface.

## Browser/PWA smoke coverage

Target: `http://127.0.0.1:5173/` using local Vite dev server.

Result: passed, no JS errors for the tested no-funds path.

Covered:

- Landing page.
- Score-only onboarding.
- Wallet page.
- Funding guide.
- Receive selector.
- No-entry-fee round creation.
- Players/QR.
- Solo scorecard.
- Score entry and navigation.
- Profile page.

## Verification passed

After the fund-safety copy fix, these checks passed:

- `git diff --check`
- `npm run lint -- --quiet`
- `npm run typecheck`
- `npm run test:run` — 13 files / 121 tests passing
- `npm run build`
- `npx cap sync android`
- `./gradlew :app:assembleDebug` using `~/Android/Sdk`

Build still emits the existing large-chunk warning for bundled dependencies, but completes successfully.

## Issues found / follow-ups

### High: 16 KB page-size compatibility warning on Pixel/API 36

The app launches, but Android warns that bundled native libraries are not 16 KB page-size compatible. This should be fixed before broad Android beta/release, especially for modern Pixel devices.

Likely area: native barcode/MLKit/vision dependencies.

### High: Breez real-wallet flow still untested

Breez init was skipped because API key/config was missing in the QA build. Real wallet testing still needs:

- Breez API key configured for Android build.
- Tiny test funds only.
- Human approval before any send/spend action.

### Medium: Tailwind CDN is loaded in native production bundle

Logcat warning:

```text
cdn.tailwindcss.com should not be used in production
```

The app should move Tailwind into the build pipeline rather than loading the CDN at runtime inside WebView.

### Medium: wallet overview visual clipping/truncation

On real Android, wallet overview copy truncates and a right-side orange card/element appears partially clipped off-screen.

### Medium: Android location denied copy says “browser settings”

Native Android copy should say “device settings” or “app settings.”

### Low/Medium: round setup validation clarity

Clicking Next without a course should show a validation message or render as disabled.

### Low/Medium: solo flow clarity

The one-player flow works, but could better explain that solo rounds are allowed.

### Low: direct hole-number taps less reliable than arrow navigation

Next arrow worked reliably. Direct tapping of the small Hole 2 button did not move during this automated pass.

## Safe testing not performed

Skipped because it requires configured credentials and/or human approval:

- Breez SDK real init with API key.
- Real receive invoice generation.
- External Lightning wallet handoff.
- Any send/receive with sats.
- Any action that would spend or move real funds.

## Cleanup state

- Temporary side-by-side Gradle app-id change was reverted.
- Existing installed package `app.onchain.discgolf` was not modified.
- QA package `app.onchain.discgolf.debug` remains installed on the phone for now and can be removed later with:

```bash
adb -s 192.168.1.161:34753 uninstall app.onchain.discgolf.debug
```
