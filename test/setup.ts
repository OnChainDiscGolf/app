import { Buffer } from 'buffer';
import { webcrypto } from 'node:crypto';
import { vi } from 'vitest';

// Buffer polyfill — repo has 'buffer' in deps for browser polyfill, but happy-dom
// doesn't expose it as a global. nostr-tools and Cashu may transitively need it.
if (!globalThis.Buffer) globalThis.Buffer = Buffer as unknown as typeof globalThis.Buffer;

// Web Crypto polyfill — nip44 needs crypto.subtle. happy-dom usually provides it,
// this is defensive in case a future env change breaks that.
if (!globalThis.crypto) (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;

// Defensive Breez SDK stub — paymentRouter imports breezService which imports the
// SDK. We mock breezService at the test-file level, but this guarantees no test
// can accidentally pull WASM into the test env.
vi.mock('@breeztech/breez-sdk-spark', () => ({}));
