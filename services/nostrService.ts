
import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip19, Filter, Event, nip04, nip44 } from 'nostr-tools';
import { NOSTR_KIND_PROFILE, NOSTR_KIND_CONTACTS, NOSTR_KIND_ROUND, NOSTR_KIND_SCORE, NOSTR_KIND_APP_DATA, NOSTR_KIND_GIFT_WRAP, Player, RoundSettings, UserProfile, DisplayProfile, Proof, Mint, WalletTransaction } from '../types';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';
import { generateNostrConnectURI, signEventWithAmber, nip04EncryptWithAmber, nip04DecryptWithAmber } from './amberSigner';

// Default relays - Optimized for profile discovery and payment applications
const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.snort.social',
    'wss://relay.nostr.net',
    'wss://relay.primal.net',
    'wss://relay.npub.bar'            // Quality relay for payment services
];

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

const pool = new SimplePool();

// Polyfill/Helper for Promise.any
const promiseAny = <T>(promises: Iterable<Promise<T>>): Promise<T> => {
    return new Promise((resolve, reject) => {
        const promiseList = Array.from(promises);
        if (promiseList.length === 0) {
            reject(new Error("No promises to execute"));
            return;
        }

        let rejectedCount = 0;

        promiseList.forEach((p) => {
            p.then(resolve).catch(() => {
                rejectedCount++;
                if (rejectedCount === promiseList.length) {
                    reject(new Error("All promises rejected"));
                }
            });
        });
    });
};

// --- Helper for list (Improved Robustness) ---

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

export const getRelays = () => activeRelays;

const saveRelays = (relays: string[]) => {
    activeRelays = relays;
    localStorage.setItem('cdg_relays', JSON.stringify(activeRelays));
};

export const addRelay = (url: string) => {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('wss://') && !cleanUrl.startsWith('ws://')) {
        cleanUrl = 'wss://' + cleanUrl;
    }
    if (!activeRelays.includes(cleanUrl)) {
        saveRelays([...activeRelays, cleanUrl]);
    }
};

export const removeRelay = (url: string) => {
    saveRelays(activeRelays.filter(r => r !== url));
};

export const resetRelays = () => {
    saveRelays([...DEFAULT_RELAYS]);
};

// --- Key Management & Auth ---

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

export const generateNewProfile = () => {
    const secret = generateSecretKey();
    const pk = getPublicKey(secret);
    const skHex = bytesToHex(secret);

    localStorage.setItem('nostr_sk', skHex);
    localStorage.setItem('nostr_pk', pk);
    localStorage.setItem('auth_method', 'local');

    return { pk, sk: secret };
};

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

// Complete Amber login after user returns from Amber app
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

// --- Publishing ---

export const publishProfile = async (profile: UserProfile) => {
    const metadata = {
        name: profile.name,
        display_name: profile.name,
        displayName: profile.name,
        about: profile.about,
        picture: profile.picture,
        nip05: profile.nip05,
        lud16: profile.lud16,
    };

    const event = await signEventWrapper({
        kind: NOSTR_KIND_PROFILE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(metadata),
    });

    await promiseAny(pool.publish(getRelays(), event));
    return event;
};

export const publishProfileWithKey = async (profile: UserProfile, secretKey: Uint8Array) => {
    const metadata = {
        name: profile.name,
        display_name: profile.name,
        displayName: profile.name,
        about: profile.about,
        picture: profile.picture,
        nip05: profile.nip05,
        lud16: profile.lud16,
    };

    const event = finalizeEvent({
        kind: NOSTR_KIND_PROFILE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(metadata),
    }, secretKey);

    await promiseAny(pool.publish(getRelays(), event));
    return event;
};

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
        ['client', 'ChainLinks']
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
            ['e', roundId],
            ['t', 'scorecard']
        ],
        content: content,
    });

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
            ['d', 'chainlinks_recent_players'],
            ['client', 'ChainLinks']
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
            '#d': ['chainlinks_recent_players']
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
                        nip05: profile.nip05 || profile.lud16
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

export const publishWalletBackup = async (proofs: Proof[], mints: Mint[], transactions: WalletTransaction[]) => {
    const session = getSession();
    if (!session) throw new Error("Not authenticated");

    console.log(`📦 [Backup] Publishing wallet backup for pubkey: ${session.pk.substring(0, 8)}...`);
    console.log(`📦 [Backup] Backup contains: ${proofs.length} proofs, ${mints.length} mints, ${transactions.length} transactions`);

    const rawData = JSON.stringify({ proofs, mints, transactions, timestamp: Date.now() });

    // Encrypt content using NIP-44 (self-encryption)
    const encryptedContent = await encryptInternal(session.pk, rawData);
    console.log(`📦 [Backup] Content encrypted with NIP-44`);

    const event = await signEventWrapper({
        kind: NOSTR_KIND_WALLET_BACKUP,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', 'cashu_wallet_backup'],
            ['client', 'ChainLinks']
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

export const fetchWalletBackup = async (pubkey: string): Promise<{ proofs: Proof[], mints: Mint[], transactions: WalletTransaction[] } | null> => {
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
        console.log(`✅ [Backup] Restored: ${data.proofs?.length || 0} proofs, ${data.mints?.length || 0} mints, ${data.transactions?.length || 0} transactions`);

        return {
            proofs: data.proofs || [],
            mints: data.mints || [],
            transactions: data.transactions || []
        };
    } catch (e) {
        console.error("❌ [Backup] Failed to fetch or decrypt wallet backup:", e);
        return null;
    }
};

// --- Subscribing / Fetching ---

export const subscribeToRound = (roundId: string, callback: (event: any) => void) => {
    const filters: Filter[] = [{
        kinds: [NOSTR_KIND_SCORE],
        '#e': [roundId],
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
        nip05: content.nip05 || ''
    };
};



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
        nip05: profile?.lud16 || profile?.nip05 || undefined
    };
};

export const getPool = () => pool;

// --- Direct Messages (NIP-04) ---

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