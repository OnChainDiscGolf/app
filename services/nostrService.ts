/**
 * @fileoverview Nostr Service -- Core Nostr protocol operations for the entire app.
 *
 * This is the primary interface to the Nostr network. It handles:
 *
 * **Identity & Authentication:**
 * - Keypair generation (random, BIP-39/NIP-06 mnemonic, nsec import)
 * - NIP-46 remote signing (Bunker URL) and NIP-46 Amber signer
 * - Session management (localStorage-backed)
 * - Signing/encryption wrappers that delegate to local key, NIP-46, or Amber
 *
 * **Publishing:**
 * - Kind 0 profiles (with NIP-65 relay list auto-publish)
 * - Kind 1 text notes (round results sharing)
 * - Kind 3 contact lists (merge-update, preserves petnames)
 * - Kind 30001 rounds (parameterized replaceable, d-tag = round ID)
 * - Kind 30002 scores (parameterized replaceable, d-tag = round ID)
 * - Kind 30003 tournaments (with geohash `g` tags for location discovery)
 * - Kind 30005 wallet backups (NIP-44 self-encrypted)
 * - Kind 30078 app data (NIP-78, recent players list)
 * - Kind 10002 relay lists (NIP-65)
 *
 * **Subscriptions & Fetching:**
 * - Real-time round/tournament score subscriptions
 * - Profile fetching with 3s timeout for fast UX
 * - Batch profile fetching (up to 250 contacts)
 * - Tournament discovery (nearby via geohash, friends via p-tags)
 * - Gift Wrap (NIP-17/NIP-59) send/receive/unwrap
 * - NIP-04 direct messages (for feedback service)
 * - NIP-57 nutzap subscriptions
 * - Historical Gift Wrap recovery
 *
 * **Encryption:**
 * - NIP-04 (legacy, for NWC and NIP-46 only)
 * - NIP-44 (for wallet backups, app data, Gift Wraps)
 * - Wrappers handle local vs NIP-46 vs Amber delegation transparently
 *
 * **Media:**
 * - NIP-98 authenticated uploads to nostr.build
 *
 * @see NIP-06 (mnemonic key derivation)
 * @see NIP-17/NIP-59 (Gift Wrap encrypted messaging)
 * @see NIP-44 (versioned encryption)
 * @see NIP-46 (remote signing / Nostr Connect)
 * @see NIP-65 (relay list metadata)
 * @see NIP-78 (application-specific data)
 * @see NIP-98 (HTTP Auth for media uploads)
 */

import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip19, Filter, Event, nip04, nip44 } from 'nostr-tools';
import { NOSTR_KIND_PROFILE, NOSTR_KIND_CONTACTS, NOSTR_KIND_ROUND, NOSTR_KIND_SCORE, NOSTR_KIND_TOURNAMENT, NOSTR_KIND_APP_DATA, NOSTR_KIND_GIFT_WRAP, Player, RoundSettings, UserProfile, DisplayProfile, Proof, Mint, WalletTransaction, TournamentSettings } from '../types';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';
import { generateNostrConnectURI, signEventWithAmber, nip04EncryptWithAmber, nip04DecryptWithAmber } from './amberSigner';
import {
    generateNewIdentity,
    deriveNostrKeyFromMnemonic,
    validateMnemonic,
    storeMnemonicEncrypted,
    setAuthSource,
    setUnifiedSeed,
    AuthSource
} from './mnemonicService';

// Default relays - Optimized for robustness, profile discovery, and payment applications
// Using 8 well-connected, free, and geographically distributed relays for maximum reliability
const DEFAULT_RELAYS = [
    'wss://relay.damus.io',       // Most popular relay, extremely well-connected
    'wss://relay.primal.net',     // Primal's relay, excellent indexing and uptime
    'wss://nos.lol',              // Very popular, fast, and stable
    'wss://relay.nostr.band',     // Excellent search/indexing, great for profile discovery
    'wss://purplepag.es',         // Optimized for profile/metadata discovery (Kind 0, 10002 only)
    'wss://relay.snort.social',   // Reliable, well-maintained by Snort team
    'wss://nostr.wine',           // Free tier, well-connected across the network
    'wss://relay.nostr.net',      // Stable general-purpose relay
];

// Relays that only accept metadata events (Kind 0, 3, 10002) - don't publish notes here
const METADATA_ONLY_RELAYS = new Set([
    'wss://purplepag.es',
]);

// Load relays from storage or use defaults
let activeRelays: string[] = [...DEFAULT_RELAYS];
try {
    const saved = localStorage.getItem('cdg_relays');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
            activeRelays = parsed;
        }
    }
} catch (e) {
    console.warn("Failed to load relays from storage", e);
}

// Track whether relay list (NIP-65) has been published this session
let relayListPublished = false;

const pool = new SimplePool();

// Publish event to multiple relays, waiting for all to respond (with timeout)
// Returns count of successful relay publishes
const publishToRelays = async (relays: string[], event: Event): Promise<number> => {
    if (relays.length === 0) throw new Error('No relays to publish to');

    const promises = pool.publish(relays, event).map(p =>
        Promise.race([
            p.then(() => true as const),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Relay timeout')), 5000))
        ])
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter(r => r.status === 'fulfilled').length;

    if (successes === 0) {
        const errors = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r, i) => `${relays[i]}: ${r.reason?.message || 'Unknown'}`);
        console.error('Failed to publish to any relay:', errors);
        throw new Error(`Failed to publish to any relay`);
    }

    console.log(`Nostr: published to ${successes}/${relays.length} relays`);
    return successes;
};

// Polyfill/Helper for Promise.any
const promiseAny = <T>(promises: Iterable<Promise<T>>): Promise<T> => {
    return new Promise((resolve, reject) => {
        const promiseList = Array.from(promises);
        if (promiseList.length === 0) {
            reject(new Error("No promises to execute"));
            return;
        }

        let rejectedCount = 0;
        const errors: any[] = [];

        promiseList.forEach((p, index) => {
            p.then(resolve).catch((error) => {
                errors[index] = error;
                rejectedCount++;
                if (rejectedCount === promiseList.length) {
                    console.error("All Nostr publish promises rejected. Errors:", errors);
                    reject(new Error(`All promises rejected. First error: ${errors[0]?.message || 'Unknown error'}`));
                }
            });
        });
    });
};

// --- Helper for list (Improved Robustness) ---

/**
 * Query events from multiple relays with deduplication and configurable timeout.
 *
 * Subscribes to all provided relays, collects events (deduplicated by ID),
 * and resolves when all relays have sent EOSE or the timeout expires.
 *
 * @param relays - Relay URLs to query (falls back to DEFAULT_RELAYS if empty)
 * @param filters - Nostr filter objects (kinds, authors, tags, etc.)
 * @param timeoutMs - Maximum wait time in ms (default: 6000, use 3000 for profiles)
 * @returns Deduplicated array of matching events
 */
export const listEvents = async (relays: string[], filters: Filter[], timeoutMs: number = 6000): Promise<Event[]> => {
    // Ensure we have valid relays
    const targetRelays = (relays && relays.length > 0) ? relays : DEFAULT_RELAYS;

    return new Promise((resolve) => {
        const events = new Map<string, Event>();
        let eoseCount = 0;
        const totalRelays = targetRelays.length;
        let isResolved = false;

        const finish = () => {
            if (isResolved) return;
            isResolved = true;
            try {
                sub.close();
            } catch (e) { /* ignore close errors */ }
            const result = Array.from(events.values());
            resolve(result);
        };

        const sub = pool.subscribeMany(targetRelays, filters as any, {
            onevent(event) {
                if (!events.has(event.id)) {
                    events.set(event.id, event);
                }
            },
            oneose() {
                eoseCount++;
                // We wait for ALL relays to EOSE or timeout to ensure we don't miss data from slower relays
                if (eoseCount >= totalRelays) {
                    finish();
                }
            }
        });

        // Configurable timeout - default 6s, but can be reduced for faster queries like profile fetching
        setTimeout(() => {
            if (!isResolved) {
                finish();
            }
        }, timeoutMs);
    });
};

// --- Relay Management ---

/** Get the current list of active relay URLs */
export const getRelays = () => activeRelays;

/**
 * Get relays that accept regular notes (excludes metadata-only relays like purplepag.es).
 *
 * @returns Filtered relay list suitable for Kind 1, Kind 30001, etc.
 */
export const getWriteRelays = (): string[] => {
    return activeRelays.filter(r => !METADATA_ONLY_RELAYS.has(r));
};

const saveRelays = (relays: string[]) => {
    activeRelays = relays;
    relayListPublished = false; // Re-publish NIP-65 on next note/profile publish
    localStorage.setItem('cdg_relays', JSON.stringify(activeRelays));
};

/**
 * Add a relay URL to the active relay list and persist to localStorage.
 * Automatically prepends wss:// if no protocol is specified.
 *
 * @param url - Relay URL to add
 */
export const addRelay = (url: string) => {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('wss://') && !cleanUrl.startsWith('ws://')) {
        cleanUrl = 'wss://' + cleanUrl;
    }
    if (!activeRelays.includes(cleanUrl)) {
        saveRelays([...activeRelays, cleanUrl]);
    }
};

/** Remove a relay URL from the active list and persist to localStorage */
export const removeRelay = (url: string) => {
    saveRelays(activeRelays.filter(r => r !== url));
};

/** Reset relays to the default hardcoded list */
export const resetRelays = () => {
    saveRelays([...DEFAULT_RELAYS]);
};

// --- Key Management & Auth ---

/**
 * Get the current Nostr session from localStorage.
 *
 * @returns Session object with auth method, public key, and optional secret key, or null if not logged in
 */
export const getSession = () => {
    const method = localStorage.getItem('auth_method');
    const pk = localStorage.getItem('nostr_pk');
    const sk = localStorage.getItem('nostr_sk');

    if (!method || !pk) return null;
    return {
        method: method as 'local' | 'nip46' | 'amber',
        pk,
        sk: sk ? hexToBytes(sk) : undefined
    };
};

/**
 * Generate a new random Nostr keypair and store in localStorage.
 *
 * @deprecated Use generateNewProfileFromMnemonic() for new users (supports unified backup).
 * @returns Object with public key and secret key
 */
export const generateNewProfile = () => {
    const secret = generateSecretKey();
    const pk = getPublicKey(secret);
    const skHex = bytesToHex(secret);

    localStorage.setItem('nostr_sk', skHex);
    localStorage.setItem('nostr_pk', pk);
    localStorage.setItem('auth_method', 'local');

    return { pk, sk: secret };
};

/**
 * Generate a new identity from a BIP-39 mnemonic (NIP-06)
 * This is the PRIMARY method for new users going forward.
 * 
 * The mnemonic will be used for BOTH:
 * 1. Nostr key derivation (m/44'/1237'/0'/0/0)
 * 2. Breez wallet initialization
 * 
 * @returns Object with mnemonic, public key, and private key
 */
export const generateNewProfileFromMnemonic = (): {
    mnemonic: string;
    pk: string;
    sk: Uint8Array;
} => {
    // Generate new identity with mnemonic
    const identity = generateNewIdentity();
    
    // Store keys in localStorage (same as before)
    localStorage.setItem('nostr_sk', identity.privateKeyHex);
    localStorage.setItem('nostr_pk', identity.publicKey);
    localStorage.setItem('auth_method', 'local');
    
    // Store encrypted mnemonic and set auth source
    storeMnemonicEncrypted(identity.mnemonic, identity.publicKey, false);
    setAuthSource('mnemonic');
    setUnifiedSeed(true); // Same mnemonic for Nostr + Breez
    
    console.log('🔑 New identity generated from mnemonic');
    console.log(`📍 Derivation path: m/44'/1237'/0'/0/0`);
    
    return {
        mnemonic: identity.mnemonic,
        pk: identity.publicKey,
        sk: identity.privateKey
    };
};

/**
 * Login with an existing mnemonic (recovery flow)
 * Derives Nostr keys using NIP-06 standard
 * 
 * @param mnemonic - 12 or 24 word BIP-39 mnemonic
 * @returns Object with public key and private key
 */
export const loginWithMnemonic = (mnemonic: string): {
    pk: string;
    sk: Uint8Array;
} => {
    // Validate mnemonic
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }
    
    // Derive keys from mnemonic
    const keys = deriveNostrKeyFromMnemonic(mnemonic);
    
    // Store keys
    localStorage.setItem('nostr_sk', keys.privateKeyHex);
    localStorage.setItem('nostr_pk', keys.publicKey);
    localStorage.setItem('auth_method', 'local');
    
    // Store encrypted mnemonic
    storeMnemonicEncrypted(mnemonic, keys.publicKey, false);
    setAuthSource('mnemonic');
    setUnifiedSeed(true);
    
    console.log('🔑 Logged in with mnemonic');
    
    return {
        pk: keys.publicKey,
        sk: keys.privateKey
    };
};

/**
 * Login with an existing nsec (bech32-encoded private key).
 *
 * Decodes the nsec, derives the public key, and stores both in localStorage.
 * Sets auth source to 'nsec' and unified seed to false (Breez needs separate mnemonic).
 *
 * @param nsec - bech32-encoded Nostr secret key (nsec1...)
 * @returns Object with public key and secret key
 * @throws {Error} If the nsec is invalid
 */
export const loginWithNsec = (nsec: string) => {
    try {
        const { type, data } = nip19.decode(nsec);
        if (type !== 'nsec') throw new Error('Invalid nsec');

        const sk = data as Uint8Array;
        const pk = getPublicKey(sk);
        const skHex = bytesToHex(sk);

        localStorage.setItem('nostr_sk', skHex);
        localStorage.setItem('nostr_pk', pk);
        localStorage.setItem('auth_method', 'local');
        
        // Mark as nsec login - Breez wallet will need separate mnemonic
        setAuthSource('nsec');
        setUnifiedSeed(false);

        return { pk, sk };
    } catch (e) {
        console.error(e);
        throw new Error('Invalid nsec format');
    }
};

// --- NIP-46 Implementation ---

const waitForNip46Response = async (id: string, relays: string[], timeoutMs = 10000): Promise<any> => {
    return new Promise((resolve, reject) => {
        const sub = pool.subscribeMany(relays, [{ kinds: [24133], '#e': [id] }] as any, {
            onevent(event) {
                resolve(event);
                sub.close();
            }
        });
        setTimeout(() => {
            sub.close();
            reject(new Error("NIP-46 Response Timeout"));
        }, timeoutMs);
    });
};

/**
 * Login via NIP-46 remote signer (Bunker URL).
 *
 * Connects to a remote signer via an ephemeral keypair and Nostr relays.
 * The remote signer holds the user's actual private key; this app only
 * gets signing capabilities via the NIP-46 protocol.
 *
 * @param bunkerUrl - NIP-46 bunker URL (bunker://pubkey?relay=...&secret=...)
 * @returns Object with the user's public key
 * @throws {Error} If connection fails or remote signer rejects
 *
 * @see NIP-46 https://github.com/nostr-protocol/nips/blob/master/46.md
 */
export const loginWithNip46 = async (bunkerUrl: string) => {
    try {
        if (!bunkerUrl.startsWith('bunker://')) throw new Error('Invalid Bunker URL');
        const url = new URL(bunkerUrl);
        const remotePubkey = url.pathname.replace('//', '');
        const relays = url.searchParams.getAll('relay');

        if (!remotePubkey || relays.length === 0) throw new Error('Invalid Bunker URL: Missing remote pubkey or relays');

        // Generate local ephemeral key
        const secret = generateSecretKey();
        const localPubkey = getPublicKey(secret);
        const ephemeralSkHex = bytesToHex(secret);

        // Save ephemeral session details
        localStorage.setItem('nostr_ephemeral_sk', ephemeralSkHex);
        localStorage.setItem('nostr_remote_pk', remotePubkey);
        localStorage.setItem('nostr_remote_relays', JSON.stringify(relays));

        // Perform Connect Handshake
        const id = Math.random().toString(36).substring(7);
        const reqContent = { id, method: 'connect', params: [localPubkey] };

        const encryptedContent = await nip04.encrypt(secret, remotePubkey, JSON.stringify(reqContent));

        const eventTemplate = {
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', remotePubkey]],
            content: encryptedContent
        };

        const event = finalizeEvent(eventTemplate, secret);
        await promiseAny(pool.publish(relays, event));

        // Optimistically ask for get_public_key
        const id2 = Math.random().toString(36).substring(7);
        const reqContent2 = { id: id2, method: 'get_public_key', params: [] };
        const encryptedContent2 = await nip04.encrypt(secret, remotePubkey, JSON.stringify(reqContent2));

        const eventTemplate2 = {
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', remotePubkey]],
            content: encryptedContent2
        };

        const event2 = finalizeEvent(eventTemplate2, secret);
        await promiseAny(pool.publish(relays, event2));

        console.log("Sent NIP-46 get_public_key request, waiting for response...");
        const responseEvent = await waitForNip46Response(event2.id, relays);

        if (!responseEvent) throw new Error("No response from remote signer");

        const decryptedResponse = await nip04.decrypt(secret, remotePubkey, responseEvent.content);
        const parsedResponse = JSON.parse(decryptedResponse);

        if (parsedResponse.error) throw new Error(parsedResponse.error);

        const userPubkey = parsedResponse.result;
        if (!userPubkey) throw new Error("Could not retrieve public key from remote signer");

        // Success
        localStorage.setItem('nostr_pk', userPubkey);
        localStorage.setItem('auth_method', 'nip46');
        localStorage.removeItem('nostr_sk'); // Clear local signing key if any

        return { pk: userPubkey };

    } catch (e) {
        console.error("NIP-46 Login Failed:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to connect to remote signer");
    }
};

// --- Amber (NIP-46) Implementation ---

/**
 * Initiate login via Amber Android signer app (NIP-46).
 *
 * Opens a nostrconnect:// deep link to launch Amber. The user approves
 * the connection in Amber and returns to the app. Call completeAmberLogin()
 * when the user returns with their pubkey.
 *
 * @param relay - Relay for NIP-46 communication (default: relay.damus.io)
 * @returns Object with `pending: true` (connection completes asynchronously)
 * @throws {Error} If deep link creation fails
 */
export const loginWithAmber = async (relay: string = 'wss://relay.damus.io') => {
    try {
        // Generate ephemeral keypair for Amber connection
        const ephemeralSk = generateSecretKey();
        const clientPubkey = getPublicKey(ephemeralSk);
        const ephemeralSkHex = bytesToHex(ephemeralSk);

        // Create nostrconnect:// URI
        const connectURI = generateNostrConnectURI(clientPubkey, relay);

        // Save session info
        localStorage.setItem('amber_ephemeral_sk', ephemeralSkHex);
        localStorage.setItem('amber_relay', relay);
        localStorage.setItem('amber_pending', 'true'); // Flag to check when user returns

        // Open Amber app via deep-link
        window.location.href = connectURI;

        // Return pending state - the actual connection will complete when user returns
        return { pending: true };

    } catch (e) {
        console.error("Amber Login Failed:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to connect to Amber");
    }
};

/**
 * Complete the Amber login after the user returns from the Amber app.
 *
 * @param userPubkey - The user's public key (obtained from Amber)
 * @returns Object with the user's public key
 * @throws {Error} If no pending Amber session exists
 */
export const completeAmberLogin = async (userPubkey: string) => {
    const ephemeralSkHex = localStorage.getItem('amber_ephemeral_sk');
    const relay = localStorage.getItem('amber_relay');

    if (!ephemeralSkHex || !relay) {
        throw new Error('Amber session not found');
    }

    // Save the connection
    localStorage.setItem('nostr_pk', userPubkey);
    localStorage.setItem('amber_remote_pk', userPubkey);
    localStorage.setItem('auth_method', 'amber');
    localStorage.removeItem('amber_pending');
    localStorage.removeItem('nostr_sk'); // Clear any local keys

    return { pk: userPubkey };
};

/**
 * Log out by clearing all auth-related localStorage keys.
 *
 * Removes local keys, NIP-46 session data, and Amber session data.
 * Does NOT clear mnemonic storage (that's handled by mnemonicService.clearMnemonicStorage).
 */
export const logout = () => {
    localStorage.removeItem('nostr_sk');
    localStorage.removeItem('nostr_pk');
    localStorage.removeItem('auth_method');
    localStorage.removeItem('nostr_ephemeral_sk');
    localStorage.removeItem('nostr_remote_pk');
    localStorage.removeItem('nostr_remote_relays');
    // Amber-specific cleanup
    localStorage.removeItem('amber_ephemeral_sk');
    localStorage.removeItem('amber_remote_pk');
    localStorage.removeItem('amber_relay');
    localStorage.removeItem('amber_pending');
};

// --- Wrappers for Auth & Encryption ---

const getAuthContext = () => {
    const session = getSession();
    if (!session) throw new Error("Not authenticated");

    if (session.method === 'local' && session.sk) {
        return { type: 'local' as const, sk: session.sk, pk: session.pk };
    } else if (session.method === 'nip46') {
        const ephemeralSkHex = localStorage.getItem('nostr_ephemeral_sk');
        const remotePubkey = localStorage.getItem('nostr_remote_pk');
        const relaysStr = localStorage.getItem('nostr_remote_relays');

        if (!ephemeralSkHex || !remotePubkey || !relaysStr) throw new Error("Missing NIP-46 session data");

        return {
            type: 'nip46' as const,
            ephemeralSk: hexToBytes(ephemeralSkHex),
            remotePubkey,
            relays: JSON.parse(relaysStr) as string[]
        };
    } else if (session.method === 'amber') {
        const ephemeralSkHex = localStorage.getItem('amber_ephemeral_sk');
        const remotePubkey = localStorage.getItem('amber_remote_pk');
        const relay = localStorage.getItem('amber_relay');

        if (!ephemeralSkHex || !remotePubkey || !relay) throw new Error("Missing Amber session data");

        return {
            type: 'amber' as const,
            ephemeralSk: hexToBytes(ephemeralSkHex),
            remotePubkey,
            relay
        };
    }
    throw new Error("Unknown auth method");
};

/**
 * Sign a Nostr event template using the current auth method.
 *
 * Transparently delegates to:
 * - Local signing (finalizeEvent) for local key users
 * - Amber remote signing for Amber users
 * - NIP-46 remote signing for Bunker users
 *
 * @param template - Unsigned event template (kind, tags, content, created_at)
 * @returns Fully signed Nostr event with id, pubkey, and sig
 * @throws {Error} If not authenticated or signing fails
 */
export const signEventWrapper = async (template: any) => {
    const ctx = getAuthContext();

    if (ctx.type === 'local') {
        return finalizeEvent(template, ctx.sk);
    } else if (ctx.type === 'amber') {
        // Use Amber signer
        return await signEventWithAmber(template, ctx.ephemeralSk, ctx.remotePubkey, ctx.relay);
    } else {
        // NIP-46 bunker
        const id = Math.random().toString(36).substring(7);
        const reqContent = {
            id,
            method: 'sign_event',
            params: [JSON.stringify(template)]
        };

        const encryptedContent = await nip04.encrypt(ctx.ephemeralSk, ctx.remotePubkey, JSON.stringify(reqContent));

        const reqEvent = finalizeEvent({
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', ctx.remotePubkey]],
            content: encryptedContent
        }, ctx.ephemeralSk);

        await promiseAny(pool.publish(ctx.relays, reqEvent));

        const responseEvent = await waitForNip46Response(reqEvent.id, ctx.relays);
        const decryptedResponse = await nip04.decrypt(ctx.ephemeralSk, ctx.remotePubkey, responseEvent.content);
        const parsedResponse = JSON.parse(decryptedResponse);

        if (parsedResponse.error) throw new Error(parsedResponse.error);

        return JSON.parse(parsedResponse.result);
    }
};

const encryptWrapper = async (recipientPubkey: string, plaintext: string): Promise<string> => {
    const ctx = getAuthContext();
    if (ctx.type === 'local') {
        return nip04.encrypt(ctx.sk, recipientPubkey, plaintext);
    } else if (ctx.type === 'amber') {
        return await nip04EncryptWithAmber(recipientPubkey, plaintext, ctx.ephemeralSk, ctx.remotePubkey, ctx.relay);
    } else {
        // NIP-46 nip04_encrypt
        const id = Math.random().toString(36).substring(7);
        const reqContent = {
            id,
            method: 'nip04_encrypt',
            params: [recipientPubkey, plaintext]
        };

        const encryptedRequest = await nip04.encrypt(ctx.ephemeralSk, ctx.remotePubkey, JSON.stringify(reqContent));

        const reqEvent = finalizeEvent({
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', ctx.remotePubkey]],
            content: encryptedRequest
        }, ctx.ephemeralSk);

        await promiseAny(pool.publish(ctx.relays, reqEvent));

        const responseEvent = await waitForNip46Response(reqEvent.id, ctx.relays);
        const decryptedResponse = await nip04.decrypt(ctx.ephemeralSk, ctx.remotePubkey, responseEvent.content);
        const parsedResponse = JSON.parse(decryptedResponse);

        if (parsedResponse.error) throw new Error(parsedResponse.error);
        return parsedResponse.result;
    }
};

const decryptWrapper = async (senderPubkey: string, ciphertext: string): Promise<string> => {
    const ctx = getAuthContext();
    if (ctx.type === 'local') {
        return nip04.decrypt(ctx.sk, senderPubkey, ciphertext);
    } else if (ctx.type === 'amber') {
        return await nip04DecryptWithAmber(senderPubkey, ciphertext, ctx.ephemeralSk, ctx.remotePubkey, ctx.relay);
    } else {
        // NIP-46 nip04_decrypt
        const id = Math.random().toString(36).substring(7);
        const reqContent = {
            id,
            method: 'nip04_decrypt',
            params: [senderPubkey, ciphertext]
        };

        const encryptedRequest = await nip04.encrypt(ctx.ephemeralSk, ctx.remotePubkey, JSON.stringify(reqContent));

        const reqEvent = finalizeEvent({
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', ctx.remotePubkey]],
            content: encryptedRequest
        }, ctx.ephemeralSk);

        await promiseAny(pool.publish(ctx.relays, reqEvent));

        const responseEvent = await waitForNip46Response(reqEvent.id, ctx.relays);
        const decryptedResponse = await nip04.decrypt(ctx.ephemeralSk, ctx.remotePubkey, responseEvent.content);
        const parsedResponse = JSON.parse(decryptedResponse);

        if (parsedResponse.error) throw new Error(parsedResponse.error);
        return parsedResponse.result;
    }
};
// --- NIP-44 Wrappers ---

const getConversationKeyWrapper = async (peerPubkey: string): Promise<Uint8Array> => {
    const ctx = getAuthContext();
    if (ctx.type === 'local') {
        return nip44.v2.utils.getConversationKey(ctx.sk, peerPubkey);
    } else {
        throw new Error("NIP-44 not yet supported over NIP-46 (requires remote signer support)");
    }
};

const encryptInternal = async (recipientPubkey: string, plaintext: string): Promise<string> => {
    const ctx = getAuthContext();
    if (ctx.type === 'local') {
        const conversationKey = nip44.v2.utils.getConversationKey(ctx.sk, recipientPubkey);
        return nip44.v2.encrypt(plaintext, conversationKey);
    } else {
        // Try NIP-46 nip44_encrypt
        const id = Math.random().toString(36).substring(7);
        const reqContent = {
            id,
            method: 'nip44_encrypt',
            params: [recipientPubkey, plaintext]
        };

        const encryptedRequest = await nip04.encrypt(ctx.ephemeralSk, ctx.remotePubkey, JSON.stringify(reqContent));

        const reqEvent = finalizeEvent({
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', ctx.remotePubkey]],
            content: encryptedRequest
        }, ctx.ephemeralSk);

        await promiseAny(pool.publish(ctx.relays, reqEvent));

        const responseEvent = await waitForNip46Response(reqEvent.id, ctx.relays);
        const decryptedResponse = await nip04.decrypt(ctx.ephemeralSk, ctx.remotePubkey, responseEvent.content);
        const parsedResponse = JSON.parse(decryptedResponse);

        if (parsedResponse.error) throw new Error(parsedResponse.error);
        return parsedResponse.result;
    }
};

const decryptInternal = async (senderPubkey: string, ciphertext: string): Promise<string> => {
    const ctx = getAuthContext();
    if (ctx.type === 'local') {
        const conversationKey = nip44.v2.utils.getConversationKey(ctx.sk, senderPubkey);
        return nip44.v2.decrypt(ciphertext, conversationKey);
    } else {
        // Try NIP-46 nip44_decrypt
        const id = Math.random().toString(36).substring(7);
        const reqContent = {
            id,
            method: 'nip44_decrypt',
            params: [senderPubkey, ciphertext]
        };

        const encryptedRequest = await nip04.encrypt(ctx.ephemeralSk, ctx.remotePubkey, JSON.stringify(reqContent));

        const reqEvent = finalizeEvent({
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', ctx.remotePubkey]],
            content: encryptedRequest
        }, ctx.ephemeralSk);

        await promiseAny(pool.publish(ctx.relays, reqEvent));

        const responseEvent = await waitForNip46Response(reqEvent.id, ctx.relays);
        const decryptedResponse = await nip04.decrypt(ctx.ephemeralSk, ctx.remotePubkey, responseEvent.content);
        const parsedResponse = JSON.parse(decryptedResponse);

        if (parsedResponse.error) throw new Error(parsedResponse.error);
        return parsedResponse.result;
    }
};

// --- Media Upload (NIP-98 / Blossom) ---

/**
 * Upload a profile image to nostr.build using NIP-98 HTTP Auth.
 *
 * Signs a Kind 27235 auth event and includes it as a Bearer token
 * in the upload request. Uses the current session's signing method.
 *
 * @param file - Image file to upload
 * @returns URL of the uploaded image
 * @throws {Error} If upload fails or response is invalid
 *
 * @see NIP-98 https://github.com/nostr-protocol/nips/blob/master/98.md
 */
export const uploadProfileImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const url = 'https://nostr.build/api/v2/upload/files';

    // Construct NIP-98 HTTP Auth Event
    const event = await signEventWrapper({
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['u', url],
            ['method', 'POST']
        ],
        content: '',
    });

    const authHeader = `Nostr ${btoa(JSON.stringify(event))}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': authHeader
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.data && data.data.length > 0 && data.data[0].url) {
        return data.data[0].url;
    }

    throw new Error("Invalid response from upload server");
};

/**
 * Upload profile image using an explicit private key (for onboarding flow)
 * Uses NIP-98 HTTP Auth with the provided key instead of getSession()
 */
export const uploadProfileImageWithKey = async (file: File, secretKey: Uint8Array): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const url = 'https://nostr.build/api/v2/upload/files';

    // Construct NIP-98 HTTP Auth Event using explicit key
    const event = finalizeEvent({
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['u', url],
            ['method', 'POST']
        ],
        content: '',
    }, secretKey);

    const authHeader = `Nostr ${btoa(JSON.stringify(event))}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': authHeader
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.data && data.data.length > 0 && data.data[0].url) {
        return data.data[0].url;
    }

    throw new Error("Invalid response from upload server");
};

// --- Publishing ---

/**
 * Publish a Kind 0 profile metadata event to all relays.
 *
 * Also ensures the NIP-65 relay list is published for discoverability.
 * Publishes to all relays including metadata-only (purplepag.es).
 *
 * @param profile - User profile data (name, about, picture, lud16, nip05, pdga)
 * @returns The published event
 */
export const publishProfile = async (profile: UserProfile) => {
    const metadata: Record<string, string | undefined> = {
        name: profile.name,
        display_name: profile.name,
        displayName: profile.name,
        about: profile.about,
        picture: profile.picture,
        nip05: profile.nip05,
        lud16: profile.lud16,
    };
    
    // Only include PDGA if set (keeps kind 0 clean)
    if (profile.pdga) {
        metadata.pdga = profile.pdga;
    }

    const event = await signEventWrapper({
        kind: NOSTR_KIND_PROFILE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(metadata),
    });

    // Publish profile to all relays (including metadata-only like purplepag.es)
    await publishToRelays(getRelays(), event);

    // Ensure NIP-65 relay list is published for discoverability
    await ensureRelayListPublished();

    return event;
};

export const publishProfileWithKey = async (profile: UserProfile, secretKey: Uint8Array) => {
    const metadata: Record<string, string | undefined> = {
        name: profile.name,
        display_name: profile.name,
        displayName: profile.name,
        about: profile.about,
        picture: profile.picture,
        nip05: profile.nip05,
        lud16: profile.lud16,
    };
    
    // Only include PDGA if set
    if (profile.pdga) {
        metadata.pdga = profile.pdga;
    }

    const event = finalizeEvent({
        kind: NOSTR_KIND_PROFILE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(metadata),
    }, secretKey);

    await promiseAny(pool.publish(getRelays(), event));
    return event;
};

/**
 * Publish a Kind 30001 round event (parameterized replaceable, d-tag = round ID).
 *
 * Tags all players with `p` tags for notification discovery.
 *
 * @param round - Round settings to publish
 * @returns The published event
 */
export const publishRound = async (round: RoundSettings) => {
    const content = JSON.stringify({
        name: round.name,
        courseName: round.courseName,
        entryFeeSats: round.entryFeeSats,
        acePotFeeSats: round.acePotFeeSats,
        date: round.date,
        holeCount: round.holeCount,
        isFinalized: round.isFinalized
    });

    const tags = [
        ['d', round.id],
        ['t', 'discgolf'],
        ['client', 'On-Chain Disc Golf']
    ];

    // Tag all players so they can be notified
    if (round.players && round.players.length > 0) {
        round.players.forEach(pubkey => {
            tags.push(['p', pubkey]);
        });
    }

    const event = await signEventWrapper({
        kind: NOSTR_KIND_ROUND,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: content,
    });

    await promiseAny(pool.publish(getRelays(), event));
    return event;
};

/**
 * Publish NIP-65 relay list (Kind 10002) so other clients know where to find this user's notes.
 * Without this, clients using the outbox model won't discover notes from this pubkey.
 */
export const publishRelayList = async (): Promise<Event> => {
    const tags = activeRelays.map(relay => {
        if (METADATA_ONLY_RELAYS.has(relay)) {
            return ['r', relay, 'read'];
        }
        return ['r', relay];
    });

    const event = await signEventWrapper({
        kind: 10002,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
    });

    // Publish to ALL relays including metadata-only (purplepag.es accepts Kind 10002)
    await publishToRelays(activeRelays, event);
    relayListPublished = true;
    return event;
};

/**
 * Ensure relay list has been published this session (lazy, only publishes once)
 */
const ensureRelayListPublished = async () => {
    if (!relayListPublished) {
        try {
            await publishRelayList();
        } catch (e) {
            console.warn('Failed to publish relay list:', e);
        }
    }
};

/**
 * Publish a Kind 1 text note to Nostr (for sharing round results, etc.)
 */
export const publishNote = async (content: string, tags?: string[][]): Promise<Event> => {
    const event = await signEventWrapper({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['t', 'discgolf'],
            ['client', 'On-Chain Disc Golf'],
            ...(tags || [])
        ],
        content,
    });

    // Publish to write-capable relays (excludes metadata-only relays like purplepag.es)
    await publishToRelays(getWriteRelays(), event);

    // Ensure NIP-65 relay list is published for discoverability
    await ensureRelayListPublished();

    return event;
};

/**
 * Publish a Kind 30002 score event for a round (parameterized replaceable, d-tag = round ID).
 *
 * Validates the event signature before publishing. Each player publishes
 * their own score event, which other clients can verify.
 *
 * @param roundId - The round's d-tag identifier
 * @param scores - Hole-by-hole scores keyed by hole number
 * @param totalScore - Aggregate score
 * @returns The published event
 * @throws {Error} If event validation fails
 */
export const publishScore = async (roundId: string, scores: Record<number, number>, totalScore: number) => {
    const content = JSON.stringify({
        scores,
        totalScore
    });

    const event = await signEventWrapper({
        kind: NOSTR_KIND_SCORE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', roundId],
            ['t', 'scorecard']
        ],
        content: content,
    });

    // Validate event before publishing
    if (!event.id || event.id.length !== 64 || !/^[0-9a-f]+$/.test(event.id)) {
        throw new Error(`Invalid event ID: ${event.id}`);
    }
    if (!event.sig || event.sig.length !== 128 || !/^[0-9a-f]+$/.test(event.sig)) {
        throw new Error(`Invalid signature: ${event.sig}`);
    }

    console.log(`Publishing score event: ${event.id.substring(0, 8)}...`);
    await promiseAny(pool.publish(getRelays(), event));
    return event;
};

// --- Recent Players Persistence (NIP-78 App Data) ---

export const publishRecentPlayers = async (players: DisplayProfile[]) => {
    const session = getSession();
    if (!session) return; // Silent fail if not auth

    const rawData = JSON.stringify(players);
    const encryptedContent = await encryptInternal(session.pk, rawData);

    const event = await signEventWrapper({
        kind: NOSTR_KIND_APP_DATA,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', 'ocdg_recent_players'],
            ['client', 'On-Chain Disc Golf']
        ],
        content: encryptedContent,
    });

    await promiseAny(pool.publish(getRelays(), event));
    console.log("Recent players synced to Nostr.");
};

export const fetchRecentPlayers = async (pubkey: string): Promise<DisplayProfile[]> => {
    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_APP_DATA],
            authors: [pubkey],
            '#d': ['ocdg_recent_players']
        }]);

        if (events.length === 0) return [];

        const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
        const decrypted = await decryptInternal(latest.pubkey, latest.content);
        return JSON.parse(decrypted);
    } catch (e) {
        console.warn("Failed to fetch recent players from Nostr", e);
        return [];
    }
};

// --- Contacts (Kind 3) ---

/**
 * Fetch a user's Kind 3 contact list (array of followed pubkeys).
 *
 * @param pubkey - User's public key
 * @returns Array of followed pubkey hex strings
 */
export const fetchContactList = async (pubkey: string): Promise<string[]> => {
    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_CONTACTS],
            authors: [pubkey]
        }]);

        if (events.length === 0) return [];

        const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
        // Kind 3 tags are [['p', 'pubkey', 'relay', 'petname']]
        return latest.tags.filter(t => t[0] === 'p').map(t => t[1]);
    } catch (e) {
        console.warn("Failed to fetch contact list", e);
        return [];
    }
};

/**
 * Merge new pubkeys into the user's Kind 3 contact list and publish.
 *
 * Fetches the current contact list, adds new pubkeys that aren't already
 * present, and republishes. Preserves existing petnames, relay hints, and
 * content (relay map JSON).
 *
 * @param newPubkeys - Array of pubkeys to add to the contact list
 */
export const updateContactList = async (newPubkeys: string[]) => {
    const session = getSession();
    if (!session) return;

    try {
        // 1. Fetch current Kind 3 event to preserve existing tags (petnames, relays)
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_CONTACTS],
            authors: [session.pk]
        }]);

        let tags: string[][] = [];
        let content = "";

        if (events.length > 0) {
            const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
            tags = [...latest.tags];
            content = latest.content;
        }

        // 2. Merge new pubkeys
        let updated = false;
        const existingPubkeys = new Set(tags.filter(t => t[0] === 'p').map(t => t[1]));

        for (const pk of newPubkeys) {
            if (!existingPubkeys.has(pk) && pk !== session.pk) {
                tags.push(['p', pk, '', '']); // Add new contact
                updated = true;
            }
        }

        if (!updated) {
            console.log("Contact list already up to date.");
            return;
        }

        // 3. Publish updated Kind 3
        const event = await signEventWrapper({
            kind: NOSTR_KIND_CONTACTS,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: content,
        });

        await promiseAny(pool.publish(getRelays(), event));
        console.log("Contact list updated with new players.");

    } catch (e) {
        console.error("Failed to update contact list:", e);
    }
};

/**
 * Batch-fetch Kind 0 profiles for multiple pubkeys (up to 250).
 *
 * Used for populating contact list displays. Returns the most recent
 * profile for each pubkey. Skips profiles with invalid JSON.
 *
 * @param pubkeys - Array of pubkeys to fetch profiles for
 * @returns Array of display profiles with name, image, and NIP-05
 */
export const fetchProfilesBatch = async (pubkeys: string[]): Promise<DisplayProfile[]> => {
    if (pubkeys.length === 0) return [];

    // Limit to 250 contacts to avoid large query issues
    const targetKeys = pubkeys.slice(0, 250);

    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_PROFILE],
            authors: targetKeys
        }]);

        const profileMap = new Map<string, DisplayProfile>();

        events.forEach(event => {
            try {
                const content = JSON.parse(event.content);
                const profile = parseProfileContent(content);

                // Keep latest version
                if (!profileMap.has(event.pubkey) || event.created_at > (profileMap.get(event.pubkey)?.totalRoundsPlayed || 0)) {
                    // abusing totalRoundsPlayed field slightly to store timestamp locally if needed, but let's just overwrite
                    profileMap.set(event.pubkey, {
                        pubkey: event.pubkey,
                        name: profile.name,
                        image: profile.picture,
                        nip05: profile.nip05 || profile.lud16,
                        pdga: profile.pdga
                    });
                }
            } catch (e) { }
        });

        return Array.from(profileMap.values());
    } catch (e) {
        console.warn("Failed to batch fetch profiles", e);
        return [];
    }
};

// --- Wallet Sync (Backup & Restore) ---

const NOSTR_KIND_WALLET_BACKUP = 30005; // Replaceable event for wallet backup

/**
 * Publish an encrypted wallet backup to Nostr relays (Kind 30005, d-tag = cashu_wallet_backup).
 *
 * The backup contains Cashu proofs, mint configurations, transaction history,
 * and gateway registrations. Content is self-encrypted with NIP-44.
 *
 * @param proofs - Cashu proofs to back up
 * @param mints - Configured mint list
 * @param transactions - Transaction history
 * @param gatewayRegistrations - Optional gateway registration records
 * @returns The published event
 * @throws {Error} If not authenticated or publishing fails
 */
export const publishWalletBackup = async (proofs: Proof[], mints: Mint[], transactions: WalletTransaction[], gatewayRegistrations?: any[]) => {
    const session = getSession();
    if (!session) throw new Error("Not authenticated");

    console.log(`📦 [Backup] Publishing wallet backup for pubkey: ${session.pk.substring(0, 8)}...`);
    console.log(`📦 [Backup] Backup contains: ${proofs.length} proofs, ${mints.length} mints, ${transactions.length} transactions`);

    const rawData = JSON.stringify({
        proofs,
        mints,
        transactions,
        gatewayRegistrations: gatewayRegistrations || [],
        version: 2, // Include version for backward compatibility
        timestamp: Date.now()
    });

    // Encrypt content using NIP-44 (self-encryption)
    const encryptedContent = await encryptInternal(session.pk, rawData);
    console.log(`📦 [Backup] Content encrypted with NIP-44`);

    const event = await signEventWrapper({
        kind: NOSTR_KIND_WALLET_BACKUP,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', 'cashu_wallet_backup'],
            ['client', 'On-Chain Disc Golf']
        ],
        content: encryptedContent,
    });

    console.log(`📦 [Backup] Event signed: ${event.id}`);
    console.log(`📦 [Backup] Publishing to ${getRelays().length} relays...`);

    try {
        await promiseAny(pool.publish(getRelays(), event));
        console.log("✅ [Backup] Wallet backup published successfully!");
        return event;
    } catch (e) {
        console.error("❌ [Backup] Failed to publish wallet backup:", e);
        throw e;
    }
};

/**
 * Fetch and decrypt the latest wallet backup from Nostr relays.
 *
 * Queries for Kind 30005 events with d-tag 'cashu_wallet_backup', decrypts
 * the most recent one using NIP-44, and returns the wallet state.
 *
 * @param pubkey - User's public key to query backups for
 * @returns Decrypted wallet backup data, or null if no backup found
 */
export const fetchWalletBackup = async (pubkey: string): Promise<{ proofs: Proof[], mints: Mint[], transactions: WalletTransaction[], gatewayRegistrations?: any[] } | null> => {
    console.log(`🔍 [Backup] Fetching wallet backup for pubkey: ${pubkey.substring(0, 8)}...`);
    console.log(`🔍 [Backup] Querying ${getRelays().length} relays for kind ${NOSTR_KIND_WALLET_BACKUP} events...`);

    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_WALLET_BACKUP],
            authors: [pubkey],
            '#d': ['cashu_wallet_backup']
        }]);

        console.log(`🔍 [Backup] Found ${events.length} backup events`);

        if (events.length === 0) {
            console.warn("⚠️ [Backup] No wallet backup found on relays");
            return null;
        }

        // Get the latest one
        const latestBackup = events.sort((a, b) => b.created_at - a.created_at)[0];
        console.log(`🔍 [Backup] Using latest backup event: ${latestBackup.id} (created ${new Date(latestBackup.created_at * 1000).toISOString()})`);

        // Decrypt
        console.log(`🔓 [Backup] Decrypting backup content with NIP-44...`);
        const decryptedContent = await decryptInternal(latestBackup.pubkey, latestBackup.content);
        const data = JSON.parse(decryptedContent);

        console.log(`✅ [Backup] Backup decrypted successfully!`);
        console.log(`✅ [Backup] Restored: ${data.proofs?.length || 0} proofs, ${data.mints?.length || 0} mints, ${data.transactions?.length || 0} transactions, ${data.gatewayRegistrations?.length || 0} gateway registrations`);

        return {
            proofs: data.proofs || [],
            mints: data.mints || [],
            transactions: data.transactions || [],
            gatewayRegistrations: data.gatewayRegistrations || []
        };
    } catch (e) {
        console.error("❌ [Backup] Failed to fetch or decrypt wallet backup:", e);
        return null;
    }
};

// --- Subscribing / Fetching ---

/**
 * Subscribe to real-time score updates for a specific round.
 *
 * @param roundId - The round's d-tag identifier
 * @param callback - Called with each incoming score event
 * @returns Subscription object with close() method
 */
export const subscribeToRound = (roundId: string, callback: (event: any) => void) => {
    const filters: Filter[] = [{
        kinds: [NOSTR_KIND_SCORE],
        '#d': [roundId],
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent(event) {
                callback(event);
            },
        }
    );
};

/**
 * Subscribe to rounds that tag a specific player (last 24 hours).
 *
 * Used to detect when the user is invited to a new round.
 *
 * @param userPubkey - Player's public key to watch for
 * @param callback - Called with each incoming round event
 * @returns Subscription object with close() method
 */
export const subscribeToPlayerRounds = (userPubkey: string, callback: (event: Event) => void) => {
    const filters: Filter[] = [{
        kinds: [NOSTR_KIND_ROUND],
        '#p': [userPubkey],
        since: Math.floor(Date.now() / 1000) - (60 * 60 * 24) // Look back 24 hours for active rounds
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent(event) {
                callback(event);
            },
        }
    );
};

// --- Round Fetching ---

const parseRoundEvent = (event: any): RoundSettings | null => {
    try {
        const content = JSON.parse(event.content);
        const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || '';
        const playerTags = event.tags?.filter((t: string[]) => t[0] === 'p').map((t: string[]) => t[1]) || [];
        return {
            id: dTag,
            eventId: event.id,
            pubkey: event.pubkey,
            name: content.name || '',
            courseName: content.courseName || '',
            entryFeeSats: content.entryFeeSats || 0,
            acePotFeeSats: content.acePotFeeSats || 0,
            date: content.date || '',
            isFinalized: content.isFinalized || false,
            holeCount: content.holeCount || 18,
            par: content.par || 54,
            players: playerTags,
            startingHole: content.startingHole || 1,
            trackPenalties: content.trackPenalties || false,
            hideOverallScore: content.hideOverallScore || false,
            useHonorSystem: content.useHonorSystem,
            payoutConfig: content.payoutConfig,
            playerHandicaps: content.playerHandicaps,
        };
    } catch {
        return null;
    }
};

/**
 * Fetch a specific round event by its d-tag ID.
 *
 * @param roundId - The round's d-tag identifier
 * @param authorPubkey - Optional author filter (for disambiguating same-ID rounds)
 * @returns Parsed RoundSettings or null if not found
 */
export const fetchRound = async (roundId: string, authorPubkey?: string): Promise<RoundSettings | null> => {
    try {
        const filter: any = { kinds: [NOSTR_KIND_ROUND], '#d': [roundId] };
        if (authorPubkey) filter.authors = [authorPubkey];

        const events = await pool.querySync(getRelays(), filter);
        if (!events || events.length === 0) return null;

        const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
        return parseRoundEvent(latest);
    } catch (e) {
        console.warn('Failed to fetch round:', e);
        return null;
    }
};

// --- Tournament Events ---

/**
 * Publish a Kind 30003 tournament event with geohash tags for location discovery.
 *
 * Tags all registered players with `p` tags and adds `g` tags at multiple
 * geohash precision levels (3-6 chars) for relay-side geographic filtering.
 *
 * @param tournament - Complete tournament settings
 * @returns The published event
 */
export const publishTournament = async (tournament: TournamentSettings) => {
    const content = JSON.stringify({
        name: tournament.name,
        courseName: tournament.courseName,
        date: tournament.date,
        holeCount: tournament.holeCount,
        par: tournament.par,
        entryFeeSats: tournament.entryFeeSats,
        acePotFeeSats: tournament.acePotFeeSats,
        maxPlayers: tournament.maxPlayers,
        cardSize: tournament.cardSize,
        cardAssignmentMode: tournament.cardAssignmentMode,
        phase: tournament.phase,
        cards: tournament.cards,
        registeredPlayers: tournament.registeredPlayers,
        payoutConfig: tournament.payoutConfig,
        playerHandicaps: tournament.playerHandicaps,
        isFinalized: tournament.isFinalized,
        latitude: tournament.latitude,
        longitude: tournament.longitude,
        geohash: tournament.geohash,
        locationName: tournament.locationName,
    });

    const tags: string[][] = [
        ['d', tournament.id],
        ['t', 'discgolf-tournament'],
        ['client', 'On-Chain Disc Golf'],
    ];

    // Tag all registered players so they can discover the tournament
    if (tournament.registeredPlayers && tournament.registeredPlayers.length > 0) {
        tournament.registeredPlayers.forEach(pubkey => {
            tags.push(['p', pubkey]);
        });
    }

    // Add geohash tags at multiple precision levels for location-based discovery
    if (tournament.geohash) {
        for (let i = 3; i <= tournament.geohash.length; i++) {
            tags.push(['g', tournament.geohash.substring(0, i)]);
        }
    }

    const event = await signEventWrapper({
        kind: NOSTR_KIND_TOURNAMENT,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content,
    });

    await promiseAny(pool.publish(getRelays(), event));
    return event;
};

export const subscribeTournament = (tournamentId: string, callback: (event: any) => void) => {
    const filters: Filter[] = [{
        kinds: [NOSTR_KIND_TOURNAMENT],
        '#d': [tournamentId],
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent(event) {
                callback(event);
            },
        }
    );
};

export const subscribeToTournamentScores = (cardRoundIds: string[], callback: (event: any) => void) => {
    if (cardRoundIds.length === 0) return { close: () => { } };

    const filters: Filter[] = [{
        kinds: [NOSTR_KIND_SCORE],
        '#d': cardRoundIds,
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent(event) {
                callback(event);
            },
        }
    );
};

// Parse a raw Kind 30003 Nostr event into TournamentSettings
const parseTournamentEvent = (event: any): TournamentSettings | null => {
    try {
        const content = JSON.parse(event.content);
        const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || '';
        return {
            id: dTag,
            eventId: event.id,
            pubkey: event.pubkey,
            name: content.name || '',
            courseName: content.courseName || '',
            date: content.date || '',
            holeCount: content.holeCount || 18,
            par: content.par || 54,
            entryFeeSats: content.entryFeeSats || 0,
            acePotFeeSats: content.acePotFeeSats || 0,
            maxPlayers: content.maxPlayers || 20,
            cardSize: content.cardSize || 4,
            cardAssignmentMode: content.cardAssignmentMode || 'random',
            phase: content.phase || 'registration',
            cards: content.cards || [],
            registeredPlayers: content.registeredPlayers || [],
            payoutConfig: content.payoutConfig,
            playerHandicaps: content.playerHandicaps,
            isFinalized: content.isFinalized || false,
            latitude: content.latitude,
            longitude: content.longitude,
            geohash: content.geohash,
            locationName: content.locationName,
        };
    } catch {
        return null;
    }
};

/**
 * Fetch a specific tournament event by its d-tag ID.
 *
 * @param tournamentId - The tournament's d-tag identifier
 * @returns Parsed TournamentSettings or null if not found
 */
export const fetchTournament = async (tournamentId: string): Promise<TournamentSettings | null> => {
    try {
        const events = await pool.querySync(
            getRelays(),
            { kinds: [NOSTR_KIND_TOURNAMENT], '#d': [tournamentId] } as any
        );

        if (!events || events.length === 0) return null;

        // Get most recent version
        const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
        return parseTournamentEvent(latest);
    } catch (e) {
        console.warn('Failed to fetch tournament:', e);
        return null;
    }
};

export const subscribeToPlayerTournaments = (userPubkey: string, callback: (event: Event) => void) => {
    const filters: Filter[] = [{
        kinds: [NOSTR_KIND_TOURNAMENT],
        '#p': [userPubkey],
        since: Math.floor(Date.now() / 1000) - (60 * 60 * 24) // Look back 24 hours
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent(event) {
                callback(event);
            },
        }
    );
};

// --- Tournament Discovery ---

/**
 * Discover tournaments near a geographic location using geohash prefix matching.
 *
 * Queries relays for Kind 30003 events with matching `g` tags at specified
 * geohash precision levels. Deduplicates by d-tag, keeping the most recent.
 *
 * @param ghPrefixes - Geohash prefixes to search (e.g., ["9x0", "9x1"])
 * @param since - Unix timestamp to search from
 * @returns Array of nearby tournament settings
 */
export const discoverNearbyTournaments = async (ghPrefixes: string[], since: number): Promise<TournamentSettings[]> => {
    if (ghPrefixes.length === 0) return [];
    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_TOURNAMENT],
            '#g': ghPrefixes,
            since,
            limit: 50,
        } as any]);

        // Deduplicate by d-tag, keeping most recent
        const byDTag = new Map<string, any>();
        for (const ev of events) {
            const dTag = ev.tags?.find((t: string[]) => t[0] === 'd')?.[1];
            if (!dTag) continue;
            const existing = byDTag.get(dTag);
            if (!existing || ev.created_at > existing.created_at) {
                byDTag.set(dTag, ev);
            }
        }

        return Array.from(byDTag.values())
            .map(parseTournamentEvent)
            .filter((t): t is TournamentSettings => t !== null);
    } catch (e) {
        console.warn('Failed to discover nearby tournaments:', e);
        return [];
    }
};

/**
 * Discover tournaments that friends/contacts are participating in.
 *
 * Queries for Kind 30003 events tagged with any of the provided pubkeys.
 *
 * @param pubkeys - Array of friend/contact public keys
 * @param since - Unix timestamp to search from
 * @returns Array of tournament settings friends are in
 */
export const discoverFriendsTournaments = async (pubkeys: string[], since: number): Promise<TournamentSettings[]> => {
    if (pubkeys.length === 0) return [];
    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_TOURNAMENT],
            '#p': pubkeys,
            since,
            limit: 100,
        } as any]);

        // Deduplicate by d-tag, keeping most recent
        const byDTag = new Map<string, any>();
        for (const ev of events) {
            const dTag = ev.tags?.find((t: string[]) => t[0] === 'd')?.[1];
            if (!dTag) continue;
            const existing = byDTag.get(dTag);
            if (!existing || ev.created_at > existing.created_at) {
                byDTag.set(dTag, ev);
            }
        }

        return Array.from(byDTag.values())
            .map(parseTournamentEvent)
            .filter((t): t is TournamentSettings => t !== null);
    } catch (e) {
        console.warn('Failed to discover friends tournaments:', e);
        return [];
    }
};

// --- Gift Wrap ---

/**
 * Subscribe to incoming NIP-17 Gift Wrap events (Kind 1059) for the current user.
 *
 * Automatically unwraps each gift wrap using NIP-44 decryption and passes the
 * inner rumor event to the callback. Used by WalletContext for detecting incoming
 * Cashu token payments and payment requests.
 *
 * @param callback - Called with the unwrapped rumor event
 * @returns Subscription object with close() method
 */
export const subscribeToGiftWraps = (callback: (event: Event) => void) => {
    const session = getSession();
    if (!session) return { close: () => { } };

    const filters: Filter[] = [{
        kinds: [NOSTR_KIND_GIFT_WRAP],
        '#p': [session.pk],
        since: Math.floor(Date.now() / 1000) // Only listen for new ones for now
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent: async (event) => {
                try {
                    const unwrapped = await unwrapGiftWrap(event);
                    if (unwrapped) {
                        callback(unwrapped);
                    }
                } catch (e) {
                    console.warn("Failed to unwrap gift wrap", e);
                }
            },
        }
    );
};

/**
 * Subscribe to Lightning nutzaps (kind 9735)
 */
export const subscribeToNutzaps = (callback: (event: Event) => void) => {
    const session = getSession();
    if (!session) return { close: () => { } };

    const filters: Filter[] = [{
        kinds: [9735], // NIP-57 nutzap
        '#p': [session.pk], // Zaps sent to us
        since: Math.floor(Date.now() / 1000)
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent: (event) => {
                console.log("🔔 Received nutzap:", event);
                callback(event);
            },
        }
    );
};

/**
 * Subscribe to Lightning gift-wraps (kinds 23194/23195)
 */
export const subscribeToLightningGiftWraps = (callback: (event: Event) => void) => {
    const session = getSession();
    if (!session) return { close: () => { } };

    const filters: Filter[] = [{
        kinds: [23194, 23195], // Lightning gift-wrap events
        '#p': [session.pk],
        since: Math.floor(Date.now() / 1000)
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent: async (event) => {
                try {
                    console.log("⚡ Received Lightning gift-wrap:", event);
                    // These are direct Lightning payments wrapped in gift-wraps
                    // The content contains the payment details
                    const unwrapped = await unwrapGiftWrap(event);
                    if (unwrapped) {
                        callback(unwrapped);
                    }
                } catch (e) {
                    console.warn("Failed to unwrap Lightning gift-wrap", e);
                }
            },
        }
    );
};

// --- NIP-17 / Gift Wrap Helpers ---

const unwrapGiftWrap = async (event: Event): Promise<Event | null> => {
    const ctx = getAuthContext();
    if (event.kind !== NOSTR_KIND_GIFT_WRAP) return null;

    try {
        // 1. Decrypt the Gift Wrap (Kind 1059) to get the Seal
        // The content is encrypted for us (the recipient)
        const decryptedSealJson = await decryptInternal(event.pubkey, event.content);
        const seal = JSON.parse(decryptedSealJson) as Event;

        // 2. Verify Seal (Kind 13)
        // In a full implementation, we should verify the signature of the seal, 
        // but the seal is signed by the sender, which we don't know yet until we verify it?
        // Actually, the seal is signed by the SENDER.
        // We need to verify the seal's signature.
        // if (!verifyEvent(seal)) throw new Error("Invalid seal signature");

        // 3. Decrypt the Seal to get the Rumor (Kind 14)
        // The seal content is encrypted for the recipient (us) by the sender (seal.pubkey)
        const decryptedRumorJson = await decryptInternal(seal.pubkey, seal.content);
        const rumor = JSON.parse(decryptedRumorJson) as Event;

        // 4. Return the rumor (which contains the actual content)
        return rumor;

    } catch (e) {
        console.error("Error unwrapping NIP-17:", e);
        return null;
    }
};

/**
 * Fetch historical Gift Wraps from the past to recover missed payments
 * @param pubkey - User's public key
 * @param since - Unix timestamp to fetch from (e.g., 7 days ago)
 * @returns Array of unwrapped rumor events containing payment content
 */
export const fetchHistoricalGiftWraps = async (
    pubkey: string,
    since: number
): Promise<Event[]> => {
    try {
        console.log(`Fetching Gift Wraps since ${new Date(since * 1000).toISOString()}...`);

        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_GIFT_WRAP],
            '#p': [pubkey],
            since: since
        }], 8000); // 8 second timeout for historical fetch

        console.log(`Found ${events.length} Gift Wrap events, unwrapping...`);

        const unwrapped: Event[] = [];
        for (const event of events) {
            try {
                const rumor = await unwrapGiftWrap(event);
                if (rumor) {
                    unwrapped.push(rumor);
                }
            } catch (e) {
                console.warn(`Failed to unwrap Gift Wrap ${event.id.substring(0, 8)}`, e);
            }
        }

        console.log(`Successfully unwrapped ${unwrapped.length} Gift Wraps`);
        return unwrapped;
    } catch (e) {
        console.error("Failed to fetch historical Gift Wraps", e);
        return [];
    }
};

/**
 * Generate a "magic" Lightning address using npub.cash.
 *
 * Converts a hex pubkey to npub and constructs an `npub@npubx.cash` address
 * that the npub.cash gateway will resolve to a Cashu-backed Lightning endpoint.
 *
 * @param pubkey - User's Nostr public key (hex)
 * @returns Lightning address string (e.g., "npub1abc...@npubx.cash")
 */
export const getMagicLightningAddress = (pubkey: string): string => {
    try {
        const npub = nip19.npubEncode(pubkey);
        // Use npubx.cash Lightning bridge service
        return `${npub}@npubx.cash`;
    } catch (e) {
        console.error("Failed to generate magic lightning address", e);
        return "";
    }
};

/**
 * Send a NIP-17 Gift Wrap message (3-layer encrypted) to a recipient.
 *
 * Constructs: Rumor (Kind 14) -> Seal (Kind 13, NIP-44 encrypted) ->
 * Gift Wrap (Kind 1059, NIP-44 encrypted with ephemeral key).
 *
 * Used for P2P Cashu token transfers, payment requests, and payment confirmations.
 *
 * @param recipientPubkey - Recipient's Nostr public key (hex)
 * @param content - Message content (typically JSON with type, amount, token)
 * @returns The published Gift Wrap event
 * @throws {Error} If not authenticated or publishing fails
 *
 * @see NIP-17 https://github.com/nostr-protocol/nips/blob/master/17.md
 */
export const sendGiftWrap = async (recipientPubkey: string, content: string) => {
    // 1. Create Rumor (Kind 14)
    // The rumor is the actual message.
    const rumorTemplate = {
        kind: 14, // NOSTR_KIND_RUMOR (not defined in types yet, but it's 14)
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey]],
        content: content
    };

    // We need to sign the rumor? No, rumors are not signed. They are just serialized JSON.
    // Wait, the seal contains the SIGNED rumor? Or just the JSON?
    // NIP-17: "The inner event (rumor) is NOT signed."
    // The Seal IS signed by the SENDER.

    // 2. Create Seal (Kind 13)
    // Encrypted to Recipient from Sender (Us)
    const session = getSession();
    if (!session) throw new Error("Not logged in");

    const rumorJson = JSON.stringify(rumorTemplate);
    const encryptedRumor = await encryptInternal(recipientPubkey, rumorJson);

    const sealTemplate = {
        kind: 13,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: encryptedRumor
    };

    const sealEvent = await signEventWrapper(sealTemplate);
    const sealJson = JSON.stringify(sealEvent);

    // 3. Create Gift Wrap (Kind 1059)
    // Encrypted to Recipient from Random Ephemeral Key
    const ephemeralSecret = generateSecretKey();
    const ephemeralPubkey = getPublicKey(ephemeralSecret);

    // We need to encrypt the SEAL using NIP-44 with the ephemeral key
    const conversationKey = nip44.v2.utils.getConversationKey(ephemeralSecret, recipientPubkey);
    const encryptedSeal = nip44.v2.encrypt(sealJson, conversationKey);

    const wrapEvent = finalizeEvent({
        kind: NOSTR_KIND_GIFT_WRAP,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey]],
        content: encryptedSeal
    }, ephemeralSecret);

    await promiseAny(pool.publish(getRelays(), wrapEvent));
    console.log("Sent Gift Wrap!", wrapEvent);
    return wrapEvent;
};

// Helper: Parse Profile Content robustly
const parseProfileContent = (content: any): UserProfile => {
    return {
        name: content.display_name || content.displayName || content.name || content.username || 'Nostr User',
        about: content.about || content.bio || '',
        picture: content.picture || content.image || content.avatar || '',
        lud16: content.lud16 || content.lud06 || '',
        nip05: content.nip05 || '',
        pdga: content.pdga || undefined
    };
};



/**
 * Fetch a user's Kind 0 profile metadata from relays.
 *
 * Uses a 3-second timeout for fast UX. Returns the most recent profile
 * event if multiple versions exist.
 *
 * @param pubkey - User's public key (hex)
 * @returns Parsed profile data, or null if not found
 */
export const fetchProfile = async (pubkey: string): Promise<UserProfile | null> => {
    console.log(`Fetching profile for ${pubkey.substring(0, 8)}...`);

    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_PROFILE],
            authors: [pubkey],
        }], 3000); // 3 second timeout for faster profile loading

        if (events.length === 0) {
            console.log(`No profile found for ${pubkey.substring(0, 8)}`);
            return null;
        }

        // Get the most recent profile event
        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

        try {
            const profile = parseProfileContent(JSON.parse(latestEvent.content));
            console.log(`Profile found via WebSocket relays (TS: ${latestEvent.created_at})`);
            return profile;
        } catch (e) {
            console.warn("Failed to parse profile content", e);
            return null;
        }

    } catch (e) {
        console.warn("Failed to fetch profile from relays:", e);
        return null;
    }
};

export const fetchUserHistory = async (pubkey: string) => {
    try {
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_SCORE],
            authors: [pubkey]
        }]);
        return events;
    } catch (e) {
        console.warn("Network error fetching history:", e);
        return [];
    }
};

// --- Search / Lookup ---

/**
 * Look up a Nostr user by npub, NIP-05 address, or hex pubkey.
 *
 * Tries resolution in order: npub decode -> NIP-05 lookup -> hex pubkey.
 * After resolving the pubkey, fetches the user's profile for display info.
 *
 * @param query - Search query (npub1..., user@domain.com, or 64-char hex)
 * @returns Display profile with pubkey, name, and image, or null if not found
 */
export const lookupUser = async (query: string): Promise<DisplayProfile | null> => {
    let cleanQuery = query.trim();

    if (cleanQuery.startsWith('nostr:')) {
        cleanQuery = cleanQuery.replace('nostr:', '');
    }

    let pubkey = '';

    // 1. Try NIP-19 (npub)
    if (cleanQuery.startsWith('npub')) {
        try {
            const { type, data } = nip19.decode(cleanQuery);
            if (type === 'npub') pubkey = data as string;
        } catch (e) {
            console.warn("Invalid npub", e);
        }
    }

    // 2. Try NIP-05
    if (!pubkey && cleanQuery.includes('@') && !cleanQuery.startsWith('nsec')) {
        try {
            const parts = cleanQuery.split('@');
            if (parts.length === 2) {
                const [name, domain] = parts;
                const res = await fetch(`https://${domain}/.well-known/nostr.json?name=${name}`);
                const data = await res.json();
                if (data.names && data.names[name]) {
                    pubkey = data.names[name];
                }
            }
        } catch (e) {
            console.warn("NIP-05 lookup failed", e);
        }
    }

    // 3. Fallback: assume it's already a hex pubkey if length matches
    if (!pubkey && /^[0-9a-f]{64}$/i.test(cleanQuery)) {
        pubkey = cleanQuery;
    }

    if (!pubkey) return null;

    const profile = await fetchProfile(pubkey);

    return {
        pubkey,
        name: profile?.name || (cleanQuery.includes('@') ? cleanQuery.split('@')[0] : 'Unknown'),
        image: profile?.picture,
        nip05: profile?.lud16 || profile?.nip05 || undefined,
        pdga: profile?.pdga
    };
};

/**
 * Search for a user by their PDGA number.
 * This fetches recent kind 0 profiles from relays and checks for matching PDGA numbers.
 * Note: This only finds users who have set their PDGA in On-Chain Disc Golf or compatible apps.
 */
export const lookupByPDGA = async (pdgaNumber: string): Promise<DisplayProfile | null> => {
    const cleanNumber = pdgaNumber.trim().replace(/^#/, ''); // Remove leading # if present
    
    if (!/^\d{4,7}$/.test(cleanNumber)) {
        console.warn('Invalid PDGA number format');
        return null;
    }
    
    console.log(`🔍 Searching for PDGA #${cleanNumber}...`);
    
    try {
        // Fetch recent kind 0 profiles - we search through them for PDGA matches
        // This is a broader search since we can't filter by content on most relays
        const events = await listEvents(getRelays(), [{
            kinds: [NOSTR_KIND_PROFILE],
            limit: 500  // Get a good sample of recent profiles
        }], 5000);
        
        // Search for matching PDGA number in profile content
        for (const event of events) {
            try {
                const content = JSON.parse(event.content);
                if (content.pdga && content.pdga.toString() === cleanNumber) {
                    const profile = parseProfileContent(content);
                    console.log(`✅ Found PDGA #${cleanNumber}: ${profile.name}`);
                    return {
                        pubkey: event.pubkey,
                        name: profile.name,
                        image: profile.picture,
                        nip05: profile.nip05 || profile.lud16,
                        pdga: profile.pdga
                    };
                }
            } catch (e) {
                // Skip invalid profiles
            }
        }
        
        console.log(`❌ No profile found with PDGA #${cleanNumber}`);
        return null;
        
    } catch (e) {
        console.warn('PDGA lookup failed:', e);
        return null;
    }
};

/** Get the shared SimplePool instance for use by other services */
export const getPool = () => pool;

// --- Direct Messages (NIP-04) ---

/**
 * Send a NIP-04 encrypted direct message (Kind 4).
 *
 * Used for feedback submission. For P2P payments, use sendGiftWrap() instead
 * (NIP-17 is the preferred protocol for new encrypted messaging).
 *
 * @param recipientPubkey - Recipient's public key (hex)
 * @param content - Plaintext message (will be NIP-04 encrypted)
 * @returns The published event
 * @throws {Error} If not authenticated
 *
 * @see NIP-04 https://github.com/nostr-protocol/nips/blob/master/04.md
 */
export const sendDirectMessage = async (recipientPubkey: string, content: string) => {
    const session = getSession();
    if (!session) throw new Error("Not authenticated");

    const encryptedContent = await encryptWrapper(recipientPubkey, content);

    const event = await signEventWrapper({
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey]],
        content: encryptedContent,
    });

    await promiseAny(pool.publish(getRelays(), event));
    return event;
};

/**
 * Subscribe to incoming NIP-04 encrypted direct messages (Kind 4).
 *
 * Automatically decrypts each message and passes both the raw event and
 * decrypted content to the callback.
 *
 * @param callback - Called with the event and decrypted message content
 * @returns Subscription object with close() method
 */
export const subscribeToDirectMessages = (callback: (event: Event, decryptedContent: string) => void) => {
    const session = getSession();
    if (!session) return { close: () => { } };

    const filters: Filter[] = [{
        kinds: [4],
        '#p': [session.pk],
        since: Math.floor(Date.now() / 1000) // Only new messages
    }];

    return pool.subscribeMany(
        getRelays(),
        filters as any,
        {
            onevent(event) {
                decryptWrapper(event.pubkey, event.content).then(decrypted => {
                    callback(event, decrypted);
                }).catch(e => {
                    console.warn("Failed to decrypt DM", e);
                });
            }
        }
    );
};