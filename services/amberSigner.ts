/**
 * Amber Signer Service
 * 
 * NIP-46 remote signing integration for Amber (Android Nostr signer app)
 * Uses CLIENT-INITIATED connection flow with nostrconnect:// URI deep-linking
 */

import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip04, Event } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const pool = new SimplePool();

// Default relay for Amber communication (can be overridden)
const DEFAULT_AMBER_RELAY = 'wss://relay.damus.io';

// Connection timeout (10 seconds)
const CONNECTION_TIMEOUT_MS = 10000;

export interface AmberConnectionResult {
    userPubkey: string;
    ephemeralSk: Uint8Array;
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
 * Simplified Amber connection that returns to app after approval
 * This version waits for the user's pubkey after they approve
 */
export const connectWithAmber = async (
    remotePubkey: string,  // User provides this OR we get from NIP-05
    relay: string = DEFAULT_AMBER_RELAY
): Promise<AmberConnectionResult> => {
    try {
        // Generate ephemeral keypair
        const ephemeralSk = generateSecretKey();
        const clientPubkey = getPublicKey(ephemeralSk);

        // Create connect URI
        const connectURI = generateNostrConnectURI(clientPubkey, relay);

        // Open Amber
        window.open(connectURI, '_self');

        // Wait for user to return and send get_public_key request
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Request public key from Amber
        const userPubkey = await sendAmberRequest('get_public_key', [], ephemeralSk, remotePubkey, relay);

        return {
            userPubkey,
            ephemeralSk,
            relay
        };

    } catch (error) {
        console.error('Amber connection failed:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to connect to Amber');
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
 * Disconnect from Amber (cleanup localStorage)
 */
export const disconnectAmber = (): void => {
    localStorage.removeItem('amber_ephemeral_sk');
    localStorage.removeItem('amber_remote_pk');
    localStorage.removeItem('amber_relay');
    localStorage.removeItem('auth_method');
    localStorage.removeItem('nostr_pk');
};
