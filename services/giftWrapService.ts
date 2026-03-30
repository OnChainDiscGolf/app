/**
 * @fileoverview Gift Wrap Service -- NIP-17/NIP-59 three-layer encrypted messaging.
 *
 * Implements the NIP-59 Gift Wrap protocol for sending private messages
 * between Nostr users. This is used for P2P eCash transfers (Cashu tokens
 * via DM), payment requests, and payment confirmations.
 *
 * The three encryption layers provide metadata-resistant communication:
 *
 * 1. **Rumor (unsigned)** -- The actual message content. Not signed to prevent
 *    the recipient from proving authorship to a third party.
 *
 * 2. **Seal (Kind 13)** -- The rumor encrypted with NIP-44 to the recipient,
 *    signed by the sender. Has a randomized timestamp for metadata resistance.
 *
 * 3. **Gift Wrap (Kind 1059)** -- The seal encrypted with an ephemeral key.
 *    Only reveals the recipient (via `p` tag), not the sender. Randomized timestamp.
 *
 * All encryption uses NIP-44 (ChaCha20-Poly1305) via nostr-tools v2.
 *
 * @see NIP-59 https://github.com/nostr-protocol/nips/blob/master/59.md
 * @see NIP-17 https://github.com/nostr-protocol/nips/blob/master/17.md
 * @see NIP-44 https://github.com/nostr-protocol/nips/blob/master/44.md
 */

import { Event, getPublicKey, generateSecretKey, finalizeEvent } from 'nostr-tools';
import { nip44 } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import { getPool } from './nostrService';

// Random timestamp within a day
const randomNow = () => {
    const now = Math.floor(Date.now() / 1000);
    const randomOffset = Math.floor(Math.random() * (24 * 60 * 60)); // Random seconds in a day
    return now - randomOffset;
};

/**
 * Create a rumor (unsigned event)
 */
const createRumor = (content: string, senderPubkey: string, kind: number = 14): Partial<Event> => {
    return {
        kind,
        created_at: Math.floor(Date.now() / 1000),
        content,
        tags: [],
        pubkey: senderPubkey,
    };
};

/**
 * Create a seal (kind 13) - rumor encrypted to recipient's pubkey
 */
const createSeal = async (
    rumor: Partial<Event>,
    senderSecretKey: Uint8Array,
    recipientPubkey: string
): Promise<Event> => {
    const rumorJson = JSON.stringify(rumor);

    // Encrypt rumor to recipient using NIP-44
    const ciphertext = await nip44.v2.encrypt(rumorJson, nip44.v2.utils.getConversationKey(senderSecretKey, recipientPubkey));

    const sealTemplate = {
        kind: 13,
        created_at: randomNow(),
        content: ciphertext,
        tags: [],
        pubkey: getPublicKey(senderSecretKey),
    };

    return finalizeEvent(sealTemplate, senderSecretKey);
};

/**
 * Create a gift wrap (kind 1059) - seal encrypted with ephemeral key
 */
const createGiftWrap = async (
    seal: Event,
    recipientPubkey: string
): Promise<Event> => {
    // Generate random ephemeral keypair
    const ephemeralSk = generateSecretKey();
    const ephemeralPk = getPublicKey(ephemeralSk);

    const sealJson = JSON.stringify(seal);

    // Encrypt seal to recipient using ephemeral key
    const ciphertext = await nip44.v2.encrypt(sealJson, nip44.v2.utils.getConversationKey(ephemeralSk, recipientPubkey));

    const giftWrapTemplate = {
        kind: 1059,
        created_at: randomNow(),
        content: ciphertext,
        tags: [['p', recipientPubkey]], // Only recipient hint
        pubkey: ephemeralPk,
    };

    return finalizeEvent(giftWrapTemplate, ephemeralSk);
};

/**
 * Send a gift-wrapped (NIP-59) message to a recipient.
 *
 * Constructs all three layers (rumor -> seal -> gift wrap) and publishes
 * the gift wrap to the provided relays. At least one relay must accept
 * the event or an error is thrown.
 *
 * @param content - Message content (plaintext, will be encrypted)
 * @param senderSecretKey - Sender's Nostr secret key (for signing the seal)
 * @param recipientPubkey - Recipient's public key (hex)
 * @param relays - Relay URLs to publish the gift wrap to
 * @param kind - Inner event kind (default: 14 for NIP-17 chat message)
 * @throws {Error} If publishing fails on all relays
 */
export const sendGiftWrap = async (
    content: string,
    senderSecretKey: Uint8Array,
    recipientPubkey: string,
    relays: string[],
    kind: number = 14 // Default to chat message
): Promise<void> => {
    try {
        const senderPubkey = getPublicKey(senderSecretKey);
        console.log('🎁 [GiftWrap] Starting...');
        console.log('   From:', senderPubkey.slice(0, 8) + '...');
        console.log('   To:', recipientPubkey.slice(0, 8) + '...');
        console.log('   Kind:', kind);

        // Step 1: Create rumor (unsigned event)
        const rumor = createRumor(content, senderPubkey, kind);
        console.log('   ✓ Rumor created');

        // Step 2: Create seal (encrypted rumor, signed by sender)
        const seal = await createSeal(rumor, senderSecretKey, recipientPubkey);
        console.log('   ✓ Seal created (kind 13)');

        // Step 3: Create gift wrap (encrypted seal with ephemeral key)
        const giftWrap = await createGiftWrap(seal, recipientPubkey);
        console.log('   ✓ Gift wrap created (kind 1059)');
        console.log('   Event ID:', giftWrap.id);
        console.log('   Ephemeral pubkey:', giftWrap.pubkey.slice(0, 8) + '...');
        console.log('   p-tag recipient:', giftWrap.tags.find(t => t[0] === 'p')?.[1]?.slice(0, 8) + '...');

        // Step 4: Publish to relays
        console.log(`   Publishing to ${relays.length} relays...`);
        const pool = getPool();
        const results = await Promise.allSettled(
            relays.map(async (relay) => {
                try {
                    await pool.publish([relay], giftWrap);
                    console.log(`   ✓ Published to ${relay}`);
                    return relay;
                } catch (e) {
                    console.log(`   ✗ Failed on ${relay}:`, e);
                    throw e;
                }
            })
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`🎁 [GiftWrap] Published to ${successful}/${relays.length} relays`);
        
        if (successful === 0) {
            throw new Error('Failed to publish to any relay');
        }

        console.log(`✅ Gift wrap sent! Event ID: ${giftWrap.id}`);
    } catch (error) {
        console.error('❌ Failed to send gift wrap:', error);
        throw new Error('Failed to send encrypted message');
    }
};

/**
 * Unwrap a received gift wrap event to extract the original rumor.
 *
 * Performs two decryption steps:
 * 1. Decrypt gift wrap content with recipient's key + ephemeral pubkey -> seal
 * 2. Decrypt seal content with recipient's key + sender's pubkey -> rumor
 *
 * @param giftWrapEvent - The Kind 1059 gift wrap event from a relay
 * @param recipientSecretKey - Recipient's secret key for decryption
 * @returns The original unsigned rumor event with sender's pubkey and content
 * @throws {Error} If decryption fails (wrong recipient, corrupted data)
 */
export const unwrapGiftWrap = async (
    giftWrapEvent: Event,
    recipientSecretKey: Uint8Array
): Promise<Partial<Event>> => {
    try {
        // Step 1: Decrypt gift wrap to get seal
        const sealJson = await nip44.v2.decrypt(
            giftWrapEvent.content,
            nip44.v2.utils.getConversationKey(recipientSecretKey, giftWrapEvent.pubkey)
        );
        const seal = JSON.parse(sealJson) as Event;

        // Step 2: Decrypt seal to get rumor
        const rumorJson = await nip44.v2.decrypt(
            seal.content,
            nip44.v2.utils.getConversationKey(recipientSecretKey, seal.pubkey)
        );
        const rumor = JSON.parse(rumorJson) as Partial<Event>;

        return rumor;
    } catch (error) {
        console.error('Failed to unwrap gift wrap:', error);
        throw new Error('Failed to decrypt message');
    }
};

/**
 * Subscribe to incoming gift wrap events for a user on specified relays.
 *
 * Automatically unwraps each received gift wrap and passes the rumor
 * content and sender pubkey to the callback. Used by WalletContext to
 * listen for incoming Cashu token payments and payment requests.
 *
 * @param userPubkey - The user's public key (used as relay filter)
 * @param userSecretKey - The user's secret key (for decryption)
 * @param relays - Relay URLs to subscribe on
 * @param onMessage - Callback invoked with each unwrapped rumor and sender pubkey
 * @returns Cleanup function to close the subscription
 */
export const subscribeToGiftWraps = (
    userPubkey: string,
    userSecretKey: Uint8Array,
    relays: string[],
    onMessage: (rumor: Partial<Event>, senderPubkey: string) => void
): (() => void) => {
    const pool = getPool();

    const sub = pool.subscribeMany(relays, [
        {
            kinds: [1059],
            '#p': [userPubkey],
        },
    ], {
        onevent: async (event: Event) => {
            try {
                const rumor = await unwrapGiftWrap(event, userSecretKey);
                // The sender's pubkey is in the rumor
                const senderPubkey = rumor.pubkey || '';
                onMessage(rumor, senderPubkey);
            } catch (error) {
                console.error('Failed to process gift wrap:', error);
            }
        },
        oneose: () => {
            console.log('Gift wrap subscription established');
        },
    });

    // Return cleanup function
    return () => {
        sub.close();
    };
};
