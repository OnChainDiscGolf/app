# Unattended QA report — 2026-05-08

Branch: `beta/readiness-foundation`  
Latest tested commit: `1d8ebfb` (`copy: soften funding guide fee and timing claims`)  
PR: https://github.com/OnChainDiscGolf/app/pull/4

## Summary

I could not run on the plugged-in Android device because Linux/ADB could not enumerate the USB device. I did complete all safe unattended coverage available from this workstation:

- Verified web/lint/type/test/build gates.
- Ran Capacitor Android sync successfully.
- Attempted native Android debug APK assembly and identified the local SDK blocker.
- Ran browser/PWA smoke testing through onboarding, wallet, funding guide, receive selector, no-entry-fee round creation, solo scorecard, scoring, and profile.
- Found and fixed one fund-safety copy issue in `components/FundingGuide.tsx`.

## Physical Android device status

`adb devices -l` returned no attached devices. After restarting ADB, it still returned none.

Kernel USB logs showed repeated enumeration failures:

- `device descriptor read/64, error -32`
- `device not accepting address ..., error -71`
- `unable to enumerate USB device`

This means the phone was not visible to ADB at all, not merely unauthorized. Likely causes: charge-only/bad cable, bad hub/port, phone USB mode issue, or a device-side prompt/connection problem.

## Android SDK / APK build status

Capacitor sync succeeded:

- `npx cap sync android` copied web assets and found 9 Capacitor Android plugins.

Native APK assembly was attempted with `android/local.properties` set to `/usr/lib/android-sdk`, but the installed SDK is incomplete and system-owned:

- `/usr/lib/android-sdk` only has `platform-tools`.
- Missing `platforms;android-35` and `build-tools;34.0.0`.
- No `sdkmanager` was available in PATH or under the SDK.
- SDK root is not writable by the current user.

APK build blocker:

```text
Failed to install the following Android SDK packages as some licences have not been accepted.
  build-tools;34.0.0 Android SDK Build-Tools 34
  platforms;android-35 Android SDK Platform 35
```

## Verification passed

After the copy fix, these checks passed:

- `git diff --check`
- `npm run lint -- --quiet`
- `npm run typecheck`
- `npm run test:run` — 13 files / 121 tests passing
- `npm run build`

Build still emits the existing large-chunk warning for bundled dependencies, but completes successfully.

## Browser/PWA smoke coverage

Target: `http://127.0.0.1:5173/` using local Vite dev server.

### Landing page

Result: passed, no JS errors.

Observed:

- Landing page loaded after brief profile sync.
- CTAs visible: Get Started, Just Keep Score, I already have an account.
- Minor visual polish: headline wraps as “On-Chain Disc / Golf” on desktop-sized browser; footer/body copy is low contrast.

### Score-only onboarding / home

Result: passed, no JS errors.

Flow:

- Clicked `Just Keep Score`.
- App created a local profile and landed on Play home.
- Guided tour appeared and could be skipped.

Note: tour overlay works but sits close to bottom nav and can feel crowded.

### Wallet page / B4-B5 UX

Result: passed, no JS errors.

Observed:

- Wallet page shows 0 sats and the beta safety note.
- Wallet overview copy says Breez recommended and score-without-payments-anytime.
- Funding card, Send, Receive are visible.
- Recent Activity empty state appears.

Notes:

- Wallet overview subtitle can truncate visually in the card, depending on viewport.
- Receive selector’s distinction between “choose this wallet” and “set default” could be clearer in a future UX pass.

### Funding guide

Result: passed after copy fix, no JS errors.

Flow:

- Opened `Fund with Cash App or Strike`.
- Reviewed Cash App and Strike tabs.
- Confirmed updated Strike copy appears in browser:
  - “Strike offers a simple Lightning experience in supported regions.”
  - “Fees and regional availability may vary.”

Issue found/fixed:

- Prior copy said “under a minute,” “Free Lightning sends,” “lowest fees,” and “0.3% fees.”
- Fixed in commit `1d8ebfb` to avoid over-promising third-party fee/timing behavior.

### No-entry-fee round creation

Result: passed, no JS errors.

Flow:

- Opened Create Round.
- Entered course: `Hermes QA Test Course`.
- Selected `No Entry Fee`.
- Proceeded to Players.
- Showed join QR code successfully.
- Confirmed cardmates with just the host.
- Started round.

Notes:

- If `Next` is clicked with no course, nothing visibly happens. A visible validation message would improve clarity.
- One-player flow works, but a helper like “You can continue solo or invite players” would make the solo path clearer.

### Solo scorecard

Result: passed, no JS errors.

Flow:

- Started a no-entry-fee solo round.
- Added a score on hole 1.
- Navigated to hole 2.
- Score state persisted/displayed.

Notes:

- Scorecard is usable.
- Active score display starts as a dash, which may be unclear to new users.
- No course name/round context is visible on the active scorecard surface.
- Lots of empty vertical space on desktop-sized browser; should be checked on real mobile.

### Profile

Result: passed, no JS errors.

Observed:

- Profile loaded.
- Public key displayed.
- Private key stayed masked.
- Edit Profile / Detailed Stats / Log Out controls visible.

## Follow-ups

### Blocker: physical Android device not available to ADB

Severity: High for B2/device wallet smoke test.

The phone did not enumerate at the Linux USB layer, so I could not install/run the APK or collect device logcat/screenshots.

Next action when near the computer:

1. Use a known data-capable USB cable.
2. Plug directly into the laptop, avoiding the hub if possible.
3. Unlock phone.
4. Set USB mode to File Transfer / Android Auto if prompted.
5. Confirm Developer Options → USB debugging is enabled.
6. Accept the RSA debugging prompt.
7. Run `adb devices -l` again.

### Blocker: Android SDK incomplete for native APK build

Severity: Medium/High for unattended Android builds.

Needed setup:

- Install Android SDK command-line tools or Android Studio.
- Install/accept:
  - `platforms;android-35`
  - `build-tools;34.0.0`
- Ensure `ANDROID_HOME` or `android/local.properties` points at a writable SDK.

### Minor UX: landing/tour visual polish

Severity: Low.

- Landing headline wraps awkwardly on desktop-sized viewport.
- Tour overlay can feel crowded with bottom nav.

### Minor UX: validation clarity on Round Setup

Severity: Low/Medium.

Clicking Next with an empty course field produced no visible feedback in the browser test. If this is intentional disabled behavior, the button should look disabled or show a validation message.

### Minor UX: wallet selector default semantics

Severity: Low/Medium.

The Receive selector works, but the difference between selecting a wallet for this action and setting it as default could be clearer.

## Safe testing not performed

Skipped because it requires physical device visibility and/or human approval:

- Installing APK on Android device.
- Breez SDK behavior inside Android WebView.
- Camera/QR permission flow on Android.
- External Lightning wallet handoff.
- Real send/receive with tiny funds.
- Any action that would spend sats or move real funds.
