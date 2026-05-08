# Android beta APK release checklist

Use this checklist for every public beta Android APK/Zapstore release. It is written so a release owner who did not build the original app can follow it from a clean checkout.

## Scope

- App: On-Chain Disc Golf
- Android package/application ID: `app.onchain.discgolf`
- Android project: `android/`
- Web build output synced into Capacitor: `dist/`
- Current release channel: APK uploaded to GitHub/release storage and Zapstore metadata updated
- Backend assumption: no project-operated backend; verify Nostr/Bitcoin-native flows against public relays and wallet providers only

## Prerequisites

- Clean git working tree or a deliberate release branch with only intended changes.
- Node dependencies installed with `npm ci`.
- Android Studio/SDK installed with JDK 17 available.
- Access to the release signing keystore and its passwords outside the repo. Never commit or paste keystore passwords, mnemonics, API keys, wallet credentials, or private keys.
- Zapstore publisher access and the current app listing metadata.
- A physical Android device or emulator for smoke testing. Prefer a physical device for Breez/Amber/wallet-intent testing.

## 1. Pre-release checks

1. Confirm the target version and release notes with PM/product.
2. Start from the release branch or the exact commit to ship.
3. Confirm the working tree is clean:
   ```bash
   git status --short
   ```
4. Install exact dependencies:
   ```bash
   npm ci
   ```
5. Run the standard quality gates:
   ```bash
   npm run typecheck
   npm run lint
   npm run test:run
   npm run build
   ```
6. If any gate fails, stop and fix before creating release artifacts.

## 2. Version bump

1. Update the Android release version in `android/app/build.gradle`:
   - Increment `defaultConfig.versionCode` by 1 from the previously published APK.
   - Set `defaultConfig.versionName` to the PM-approved semantic beta version.
2. Keep `package.json` version in sync only if the web/PWA release process uses it for this release. If not, leave it alone rather than making a cosmetic bump.
3. Record the exact values in release notes, for example:
   - `versionCode: 3`
   - `versionName: 1.2.0-beta.1`
4. Re-run:
   ```bash
   npm run typecheck
   npm run test:run
   npm run build
   ```

## 3. Build and sync Capacitor Android project

1. Build the web app and sync native assets:
   ```bash
   npm run cap:build:android
   ```
   This runs the production Vite build and `npx cap sync android`.
2. Inspect the native project status:
   ```bash
   git status --short
   ```
3. If Capacitor changed native files under `android/`, verify the changes are expected for this release.

## 4. Create the unsigned release APK

From the repo root:

```bash
cd android
./gradlew clean :app:assembleRelease
cd ..
```

Expected unsigned APK path:

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

If Gradle already produces a signed `app-release.apk` because a release signing config has been added later, still verify its certificate fingerprint and skip only the manual signing step that duplicates it.

## 5. Sign and align the APK

The repo currently does not store signing secrets or a release signing config. Keep signing material outside git and use local paths/environment variables.

Example manual signing flow:

```bash
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export BUILD_TOOLS_VERSION="<installed-build-tools-version>"
export KEYSTORE_PATH="/absolute/path/to/release.keystore"
export KEY_ALIAS="<release-key-alias>"

"$ANDROID_HOME/build-tools/$BUILD_TOOLS_VERSION/zipalign" -p -f 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  android/app/build/outputs/apk/release/on-chain-disc-golf-release-aligned.apk

"$ANDROID_HOME/build-tools/$BUILD_TOOLS_VERSION/apksigner" sign \
  --ks "$KEYSTORE_PATH" \
  --ks-key-alias "$KEY_ALIAS" \
  --out android/app/build/outputs/apk/release/on-chain-disc-golf-<versionName>-<versionCode>.apk \
  android/app/build/outputs/apk/release/on-chain-disc-golf-release-aligned.apk

"$ANDROID_HOME/build-tools/$BUILD_TOOLS_VERSION/apksigner" verify --verbose --print-certs \
  android/app/build/outputs/apk/release/on-chain-disc-golf-<versionName>-<versionCode>.apk
```

Do not put real passwords in shell history. Prefer interactive prompts, a local password manager, or CI-provided secret handling.

## 6. Artifact naming and checksums

1. Use a deterministic filename:
   ```text
   on-chain-disc-golf-android-v<versionName>-<versionCode>.apk
   ```
2. Generate checksums:
   ```bash
   sha256sum android/app/build/outputs/apk/release/on-chain-disc-golf-android-v<versionName>-<versionCode>.apk \
     > android/app/build/outputs/apk/release/on-chain-disc-golf-android-v<versionName>-<versionCode>.apk.sha256
   ```
3. Record in release notes:
   - Git commit hash
   - `versionCode`
   - `versionName`
   - APK filename
   - SHA-256 checksum
   - Build machine OS/JDK/Android Gradle plugin versions if useful for debugging rebuilds

## 7. Smoke test the release APK

Install the signed APK on a test device:

```bash
adb install -r android/app/build/outputs/apk/release/on-chain-disc-golf-android-v<versionName>-<versionCode>.apk
```

Smoke-test at minimum:

1. App launches without a blank screen or crash.
2. New user onboarding completes.
3. Nostr identity flow works:
   - create/import/login path expected for the release
   - relay connectivity status is sane
   - app data can publish/fetch without a project-operated backend
4. Disc golf core flow works:
   - create a round
   - add/select players
   - enter scores
   - finalize a round
5. Wallet/payment flow works for beta scope:
   - Breez wallet readiness is visible and retryable
   - receive/create invoice path works in the intended test environment
   - payment detection/status updates do not duplicate or hang
   - NWC options remain disabled unless configured
6. QR/deep-link flow works:
   - create/display join QR
   - scan/open a join link on Android
7. Offline/online behavior is acceptable:
   - offline banner appears when disconnected
   - reconnect does not lose active round state
8. Basic Android integration works:
   - back button behavior is acceptable
   - keyboard does not cover critical form inputs
   - splash screen/icon look correct

If a smoke test uses real sats, keep amounts tiny and document the transaction externally without exposing wallet secrets.

## 8. Upload release assets

Upload these files to the chosen release location, usually the GitHub release or other PM-approved artifact host:

- Signed APK: `on-chain-disc-golf-android-v<versionName>-<versionCode>.apk`
- SHA-256 file: `on-chain-disc-golf-android-v<versionName>-<versionCode>.apk.sha256`
- Release notes/changelog snippet

Before publishing, download the uploaded APK once and verify the checksum matches the local checksum.

## 9. Zapstore metadata update

Update the Zapstore listing with:

1. App name: `On-Chain Disc Golf`.
2. Package ID: `app.onchain.discgolf`.
3. New version name and version code.
4. APK download URL and SHA-256 checksum.
5. Short release notes focused on user-visible beta changes.
6. Screenshots/icons only if they changed or Zapstore requires refresh.
7. Privacy/backend note: self-custodial wallet flows, Nostr/Bitcoin-native architecture, no project-operated backend for app data.

After saving metadata, view the public/listing preview and confirm:

- APK link resolves.
- Version shown matches `android/app/build.gradle`.
- Install/update path is visible to beta users.
- Release notes do not mention private implementation details or secrets.

## 10. Post-publish verification

1. Install/update from the Zapstore path on a clean Android profile or second device.
2. Confirm the installed app reports/behaves as the new release.
3. Repeat the launch + onboarding + Breez readiness + round creation smoke path from the distributed APK, not the local build.
4. Tag or record the shipped git commit if that is part of the PM release process.
5. Post the release summary with:
   - version
   - APK URL
   - checksum
   - smoke-test result
   - known issues

## Rollback and rebuild notes

### If the APK was uploaded but not announced

1. Remove or replace the release asset.
2. Rebuild from the corrected commit with a new `versionCode`. Do not reuse a published or user-installable `versionCode`.
3. Re-upload the corrected APK and checksum.
4. Update Zapstore metadata before announcing.

### If the Zapstore listing points to a bad APK

1. Update the listing to hide the release or point back to the last known-good APK if Zapstore supports it.
2. Communicate the known issue and advise users not to install/update until the replacement is live.
3. Build a fixed APK with a higher `versionCode`.
4. Replace metadata with the fixed APK URL/checksum.
5. Verify install/update from Zapstore again before announcing the fix.

### If users already installed a bad APK

1. Do not ask users to paste wallet secrets, mnemonics, private keys, or raw logs containing credentials.
2. Identify whether user funds, Nostr identity, or local round data could be affected.
3. Ship a fixed APK with a higher `versionCode` so Android treats it as an upgrade.
4. Include clear user-facing recovery guidance in release notes.
5. If the safest path is to revert code, rebuild from the last known-good commit plus only the required version bump.

### Reproducible rebuild record

For every release, keep this minimum rebuild record in the release notes or PM tracker:

```text
Release owner:
Release date:
Git commit:
versionName:
versionCode:
Node version:
npm version:
JDK version:
Android SDK/build-tools version:
Build command: npm run cap:build:android && (cd android && ./gradlew clean :app:assembleRelease)
Signed APK SHA-256:
Smoke-test device/Android version:
Smoke-test result:
```
