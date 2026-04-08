/**
 * @fileoverview Amber Signer Service -- NIP-46 remote signing via Android Amber app.
 *
 * Implements the CLIENT-INITIATED NIP-46 connection flow for delegating Nostr
 * signing operations to the Amber app on Android. This allows users who already
 * have a Nostr identity in Amber to use it with On-Chain Disc Golf without
 * exposing their private key.
 *
 * Connection flow:
 * 1. App generates an ephemeral keypair
 * 2. App opens a `nostrconnect://` deep link to launch Amber
 * 3. User approves the connection in Amber
 * 4. App and Amber communicate via Kind 24133 events on a shared relay
 * 5. All signing and encryption requests are sent to Amber via NIP-04 encrypted messages
 *
 * Supported NIP-46 methods:
 * - `get_public_key` -- Retrieve the user's actual Nostr pubkey
 * - `sign_event` -- Sign an arbitrary Nostr event template
 * - `nip04_encrypt` / `nip04_decrypt` -- NIP-04 encryption/decryption
 *
 * @see https://github.com/nicklucas/amber -- Amber Android signer app
 * @see NIP-46 https://github.com/nostr-protocol/nips/blob/master/46.md
 * @see NIP-04 (used for NIP-46 message encryption between client and signer)
 */

import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip04, Event } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const pool = new SimplePool();

// Default relay for Amber communication (can be overridden)
const DEFAULT_AMBER_RELAY = 'wss://relay.damus.io';

// Connection timeout (10 seconds)
const CONNECTION_TIMEOUT_MS = 10000;

/** Result of an Amber connection attempt */
export interface AmberConnectionResult {
    /** The user's actual Nostr public key (hex, from Amber) */
    userPubkey: string;
    /** Ephemeral client secret key used for this NIP-46 session */
    ephemeralSk: Uint8Array;
    /** Relay URL used for NIP-46 communication with Amber */
    relay: string;
}

/**
 * Generate nostrconnect:// URI for Amber deep-linking
 * Format: nostrconnect://<client-pubkey>?relay=<relay-url>&metadata=<encoded-metadata>
 */
export const generateNostrConnectURI = (clientPubkey: string, relay: string): string => {
    const metadata = {
        name: 'OnChainDiscGolf',
        description: 'Disc Golf Scorekeeping & Payments',
        icons: ['https://onchaindiscgolf.com/icon-512.png']
    };

    const encodedMetadata = encodeURIComponent(JSON.stringify(metadata));
    return `nostrconnect://${clientPubkey}?relay=${encodeURIComponent(relay)}&metadata=${encodedMetadata}`;
};

/**
 * Wait for NIP-46 response from Amber
 */
const waitForAmberResponse = async (
    requestEventId: string,
    clientSk: Uint8Array,
    remotePubkey: string,
    relay: string,
    timeoutMs: number = CONNECTION_TIMEOUT_MS
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const sub = pool.subscribeMany(
            [relay],
            [{ kinds: [24133], '#p': [getPublicKey(clientSk)] }] as any,
            {
                async onevent(event: Event) {
                    try {
                        // Decrypt the response
                        const decryptedContent = await nip04.decrypt(clientSk, remotePubkey, event.content);
                        const response = JSON.parse(decryptedContent);

                        // Check if this is the response we're waiting for
                        if (response.id && response.result !== undefined) {
                            sub.close();

                            if (response.error) {
                                reject(new Error(response.error));
                            } else {
                                resolve(response);
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to decrypt Amber response:', e);
                    }
                }
            }
        );

        setTimeout(() => {
            sub.close();
            reject(new Error('Amber response timeout. Please ensure Amber app is open and connection is approved.'));
        }, timeoutMs);
    });
};

/**
 * Send NIP-46 request to Amber
 */
const sendAmberRequest = async (
    method: string,
    params: any[],
    clientSk: Uint8Array,
    remotePubkey: string,
    relay: string
): Promise<any> => {
    const requestId = Math.random().toString(36).substring(7);
    const requestContent = {
        id: requestId,
        method,
        params
    };

    // Encrypt the request using NIP-04 (as required by NIP-46)
    const encryptedContent = await nip04.encrypt(clientSk, remotePubkey, JSON.stringify(requestContent));

    // Create and publish the request event (kind 24133)
    const requestEvent = finalizeEvent({
        kind: 24133,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', remotePubkey]],
        content: encryptedContent
    }, clientSk);

    // Publish to relay
    await Promise.any(pool.publish([relay], requestEvent));

    // Wait for response
    const response = await waitForAmberResponse(requestEvent.id, clientSk, remotePubkey, relay);
    return response.result;
};

/**
 * Initialize connection with Amber app
 * 
 * Flow:
 * 1. Generate ephemeral client keypair
 * 2. Create nostrconnect:// URI
 * 3. Open URI (launches Amber app)
 * 4. User approves in Amber
 * 5. Request user's public key
 * 6. Return connection details
 */
export const initializeAmberConnection = async (relay: string = DEFAULT_AMBER_RELAY): Promise<AmberConnectionResult> => {
    try {
        // Step 1: Generate ephemeral client keypair
        const ephemeralSk = generateSecretKey();
        const clientPubkey = getPublicKey(ephemeralSk);

        // Step 2: Create nostrconnect:// URI
        const connectURI = generateNostrConnectURI(clientPubkey, relay);

        // Step 3: Open deep-link to Amber
        console.log('Opening Amber app with URI:', connectURI);
        window.location.href = connectURI;

        // Give the user time to switch to Amber and approve
        // In practice, we need to wait for them to come back
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 4 & 5: Once user returns, get their public key
        // Note: The remote pubkey for Amber is the USER's actual pubkey
        // For Amber, we need to know this first. Typically this would be:
        // - Stored from a previous connection, OR
        // - Retrieved via a different mechanism

        // For now, we'll use a connect handshake approach
        // The user will need to return to the app after approving in Amber

        return {
            userPubkey: '', // Will be populated by separate flow
            ephemeralSk,
            relay
        };

    } catch (error) {
        console.error('Amber connection failed:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to connect to Amber');
    }
};

/**
 * Complete Amber connection flow for mobile/web.
 *
 * Handles the full connection lifecycle including deep-link navigation
 * and return handling. On mobile, redirects to Amber and stores connection
 * state in sessionStorage for when the user returns. On desktop, opens a
 * popup window and polls for completion.
 *
 * @param relay - Relay to use for NIP-46 communication (default: relay.damus.io)
 * @returns Connection result with user pubkey, or throws on failure
 * @throws {Error} If Amber connection fails, is cancelled, or times out (5 min)
 */
export const connectWithAmber = async (
    relay: string = DEFAULT_AMBER_RELAY
): Promise<AmberConnectionResult> => {
    try {
        // Generate ephemeral keypair for this connection
        const ephemeralSk = generateSecretKey();
        const clientPubkey = getPublicKey(ephemeralSk);

        // Create nostrconnect URI
        const connectURI = generateNostrConnectURI(clientPubkey, relay);

        console.log('🔗 Generated Amber connect URI:', connectURI);

        // Store connection attempt in sessionStorage for return handling
        sessionStorage.setItem('amber_connect_attempt', JSON.stringify({
            clientPubkey,
            ephemeralSk: bytesToHex(ephemeralSk),
            relay,
            timestamp: Date.now()
        }));

        // For mobile: use window.location.href to launch Amber app
        // For web: try to open in new window/tab
        if (window.navigator.userAgent.includes('Mobile')) {
            // Mobile - redirect to Amber
            window.location.href = connectURI;
            // This will navigate away - the connection will be completed when user returns
            return {
                userPubkey: '', // Will be populated on return
                ephemeralSk,
                relay
            };
        } else {
            // Desktop web - open in popup window
            const popup = window.open(connectURI, 'amber-connect', 'width=400,height=600');

            if (!popup) {
                throw new Error('Failed to open Amber connection popup. Please allow popups for this site.');
            }

            // Wait for popup to close (user completed connection)
            return new Promise((resolve, reject) => {
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);

                        // Check if connection was successful
                        const result = sessionStorage.getItem('amber_connection_result');
                        if (result) {
                            sessionStorage.removeItem('amber_connection_result');
                            const connectionData = JSON.parse(result);
                            resolve({
                                userPubkey: connectionData.userPubkey,
                                ephemeralSk,
                                relay
                            });
                        } else {
                            reject(new Error('Amber connection was cancelled or failed'));
                        }
                    }
                }, 1000);

                // Timeout after 5 minutes
                setTimeout(() => {
                    clearInterval(checkClosed);
                    if (!popup.closed) {
                        popup.close();
                    }
                    reject(new Error('Amber connection timed out'));
                }, 300000);
            });
        }

    } catch (error) {
        console.error('Amber connection failed:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to connect to Amber');
    }
};

/**
 * Wait for the NIP-46 ack from Amber after the user approves the connection.
 *
 * In the client-initiated flow (nostrconnect://), Amber publishes a Kind 24133
 * event as an ack. The event's `pubkey` field is the user's actual Nostr pubkey,
 * and the NIP-04 encrypted content contains `{"result": "ack"}`.
 *
 * @param clientSk - The ephemeral client secret key
 * @param relay - Relay to listen on for Amber's response
 * @param timeoutMs - How long to wait (default 30s — event should already be on the relay)
 * @returns The user's Nostr public key (hex)
 */
const waitForAmberAck = async (
    clientSk: Uint8Array,
    relay: string,
    timeoutMs: number = 30000
): Promise<string> => {
    const clientPubkey = getPublicKey(clientSk);
    return new Promise((resolve, reject) => {
        const sub = pool.subscribeMany(
            [relay],
            [{ kinds: [24133], '#p': [clientPubkey] }] as any,
            {
                async onevent(event: Event) {
                    try {
                        // The signer's (user's) pubkey is the event author
                        const signerPubkey = event.pubkey;

                        // Decrypt using our ephemeral SK and the signer's pubkey
                        const decryptedContent = await nip04.decrypt(clientSk, signerPubkey, event.content);
                        const response = JSON.parse(decryptedContent);

                        if (response.result === 'ack') {
                            sub.close();
                            resolve(signerPubkey);
                        }
                    } catch (e) {
                        // May receive unrelated events — ignore decrypt failures
                        console.warn('Failed to process potential Amber ack:', e);
                    }
                }
            }
        );

        setTimeout(() => {
            sub.close();
            reject(new Error('Amber connection timeout. Please ensure Amber is open and the connection was approved.'));
        }, timeoutMs);
    });
};

/**
 * Complete the Amber connection handshake when the user returns to the app.
 *
 * Reads the pending connection from localStorage (set by loginWithAmber in
 * nostrService.ts), subscribes to the relay for Amber's NIP-46 ack event,
 * extracts the user's pubkey, and persists the session.
 *
 * @returns Connection result if handshake succeeded, null if no pending connection or failure
 */
export const completeAmberConnection = async (): Promise<AmberConnectionResult | null> => {
    try {
        // Check if we have a pending Amber connection
        const pending = localStorage.getItem('amber_pending');
        if (!pending) return null;

        const ephemeralSkHex = localStorage.getItem('amber_ephemeral_sk');
        const relay = localStorage.getItem('amber_relay');
        if (!ephemeralSkHex || !relay) return null;

        const ephemeralSk = hexToBytes(ephemeralSkHex);

        console.log('🔄 Completing Amber connection handshake...');

        // Subscribe to relay and wait for Amber's ack event.
        // The ack is a Kind 24133 event from the signer, tagged to our client pubkey.
        // The event's .pubkey field is the user's actual Nostr pubkey.
        const userPubkey = await waitForAmberAck(ephemeralSk, relay);

        console.log('✅ Amber ack received, user pubkey:', userPubkey);

        // Persist the full session so getSession() works on subsequent reloads
        localStorage.setItem('nostr_pk', userPubkey);
        localStorage.setItem('amber_remote_pk', userPubkey);
        localStorage.setItem('auth_method', 'amber');
        localStorage.removeItem('amber_pending');
        localStorage.removeItem('nostr_sk'); // No local SK for Amber auth

        return {
            userPubkey,
            ephemeralSk,
            relay
        };
    } catch (error) {
        console.error('Failed to complete Amber connection:', error);
        return null;
    }
};

/**
 * Sign a Nostr event using Amber
 * 
 * @param template - Unsigned event template (without id, sig, pubkey)
 * @param amberContext - Connection details from initializeAmberConnection
 */
export const signEventWithAmber = async (
    template: any,
    ephemeralSk: Uint8Array,
    remotePubkey: string,
    relay: string
): Promise<Event> => {
    try {
        // Send sign_event request to Amber
        const signedEventJSON = await sendAmberRequest(
            'sign_event',
            [JSON.stringify(template)],
            ephemeralSk,
            remotePubkey,
            relay
        );

        // Parse and return signed event
        return JSON.parse(signedEventJSON);

    } catch (error) {
        console.error('Amber signing failed:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to sign event with Amber');
    }
};

/**
 * Encrypt content using Amber (NIP-04)
 */
export const nip04EncryptWithAmber = async (
    recipientPubkey: string,
    plaintext: string,
    ephemeralSk: Uint8Array,
    remotePubkey: string,
    relay: string
): Promise<string> => {
    return await sendAmberRequest(
        'nip04_encrypt',
        [recipientPubkey, plaintext],
        ephemeralSk,
        remotePubkey,
        relay
    );
};

/**
 * Decrypt content using Amber (NIP-04)
 */
export const nip04DecryptWithAmber = async (
    senderPubkey: string,
    ciphertext: string,
    ephemeralSk: Uint8Array,
    remotePubkey: string,
    relay: string
): Promise<string> => {
    return await sendAmberRequest(
        'nip04_decrypt',
        [senderPubkey, ciphertext],
        ephemeralSk,
        remotePubkey,
        relay
    );
};

/**
 * Disconnect from Amber by clearing all session-related localStorage keys.
 *
 * Should be called on logout to prevent stale Amber sessions.
 */
export const disconnectAmber = (): void => {
    localStorage.removeItem('amber_ephemeral_sk');
    localStorage.removeItem('amber_remote_pk');
    localStorage.removeItem('amber_relay');
    localStorage.removeItem('auth_method');
    localStorage.removeItem('nostr_pk');
};
