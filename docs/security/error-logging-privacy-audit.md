# Error Logging Privacy Audit

Date: 2026-05-08
Scope: client-side console logging, feedback diagnostics, and local feedback payload construction.

## Summary

The feedback/error capture path now redacts high-risk secrets before storing diagnostic logs or forwarding captured console warnings/errors. Verbose console methods (`console.log`, `console.info`, `console.debug`) are gated behind development mode or an explicit local `cdg_debug_logs=true` flag so public beta builds do not emit routine payment, Nostr, Breez, Cashu, or wallet lifecycle traces.

## Audit method

- Searched TypeScript/TSX source for console logging calls.
- Searched for sensitive terms around logging and feedback payload code: mnemonic, seed, private key, secret, token, invoice, payment hash, preimage, NWC, authorization, API key, password, proofs.
- Reviewed `services/feedbackService.ts`, where logs are captured and attached to feedback DMs.
- Reviewed representative high-risk logging areas: Nostr gift wraps, Breez events/payments, npub.cash quotes, Amber connect URIs, backup/restore, and wallet proof/payment flows.

## Findings and handling

### High risk: diagnostic capture could retain secrets from warnings/errors

Status: fixed.

Captured warnings/errors are sanitized through `sanitizeDiagnosticMessage()` before entering feedback buffers and before being forwarded to the browser/native console. Object fields with sensitive key names are replaced, and common standalone sensitive strings are redacted.

### High risk: verbose public-beta console logs include payment/Nostr objects

Status: fixed at the capture surface.

The app now wraps `console.log`, `console.info`, and `console.debug` during startup. In production/public-beta builds these verbose logs are suppressed unless `localStorage.cdg_debug_logs` is explicitly set to `true`. This avoids broad, risky one-by-one logging churn while preserving opt-in diagnostics for development/support.

### Medium risk: navigation paths and user feedback text can contain pasted secrets

Status: fixed.

Navigation paths stored for feedback diagnostics are redacted. User-entered feedback text is also redacted before being copied into the structured feedback payload and readable feedback body.

### Payment identifiers

Status: intentionally minimized/redacted.

Payment identifiers such as invoices, NWC connection strings, payment hashes/preimages, and 64-byte hex values are treated as sensitive in diagnostic sanitization. Aggregate payment state such as balances, counts, booleans, and shortened public identifiers may still appear where needed for support context.

### Remaining acceptable logs

Warnings/errors are still forwarded after sanitization because they are useful for beta diagnostics. Existing source-level log statements remain numerous, but public beta builds suppress verbose methods centrally after `initErrorCapture()` runs in `App.tsx` startup.

## Verification

- Added unit coverage for secret redaction, debug log gating, navigation path redaction, and sanitized captured console errors.
- Required project verification commands were run after the fix.
