/**
 * @fileoverview NWC Service -- NIP-47 Nostr Wallet Connect bridge to external wallets.
 *
 * Implements the NIP-47 protocol for communicating with external Lightning wallets
 * (e.g., Alby, Mutiny, LNbits) via Nostr relay messages. The user provides a
 * `nostr+walletconnect://` URI from their wallet, and this service handles:
 *
 * - Parsing the connection string (pubkey, relay, client secret)
 * - Sending encrypted commands (Kind 23194) to the wallet
 * - Receiving encrypted responses (Kind 23195) from the wallet
 * - Command timeout handling (60 seconds) with payment verification fallback
 *
 * Supported NIP-47 commands:
 * - `get_balance` -- Query wallet balance (returned in msats, converted to sats)
 * - `pay_invoice` -- Pay a Bolt11 Lightning invoice
 * - `make_invoice` -- Create a new Lightning invoice for receiving
 * - `lookup_invoice` -- Check if an invoice has been paid
 *
 * NOTE: NIP-04 encryption is used per the NIP-47 spec (legacy exception).
 *
 * @see NIP-47 https://github.com/nostr-protocol/nips/blob/master/47.md
 * @see NIP-04 (used for NIP-47 request/response encryption)
 */

import { finalizeEvent, nip04, generateSecretKey, getPublicKey, Event } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { SimplePool } from 'nostr-tools';

// Separate pool to avoid circular dependency with nostrService
const pool = new SimplePool();

/** Parsed NWC connection parameters from a nostr+walletconnect:// URI */
export interface NWCConnection {
    /** Wallet's Nostr public key (hex) */
    pubkey: string;
    /** Relay URL for NWC communication */
    relay: string;
    /** Client secret key (hex) -- whitelisted by the wallet for this connection */
    secret: string;
    /** Optional Lightning address associated with this wallet */
    lud16?: string;
}

/**
 * NIP-47 Nostr Wallet Connect client.
 *
 * Manages a connection to an external Lightning wallet via Nostr relays.
 * All communication is NIP-04 encrypted between the client secret key
 * and the wallet's public key.
 *
 * @example
 * const nwc = new NWCService("nostr+walletconnect://pubkey?relay=wss://...&secret=hex");
 * const balance = await nwc.getBalance(); // Returns sats
 * await nwc.payInvoice("lnbc...");
 */
export class NWCService {
    private connection: NWCConnection | null = null;
    private walletPubkey: string = '';
    private relay: string = '';
    private secret: string = ''; // The client secret (if provided in URI) or we generate one? 
    // Actually, NWC URI: nostr+walletconnect://<pubkey>?relay=<relay>&secret=<secret>
    // The 'secret' in the URI is the CLIENT'S secret key (which the wallet has whitelisted).

    constructor(connectionString?: string) {
        if (connectionString) {
            this.parseConnectionString(connectionString);
        }
    }

    /**
     * Parse a nostr+walletconnect:// URI into connection parameters.
     *
     * URI format: `nostr+walletconnect://<wallet-pubkey>?relay=<relay>&secret=<client-sk>&lud16=<address>`
     *
     * @param uri - Full NWC connection string
     * @throws {Error} If the URI is invalid or missing required parameters
     */
    parseConnectionString(uri: string) {
        if (!uri.startsWith('nostr+walletconnect://')) throw new Error("Invalid NWC URI");

        const url = new URL(uri.replace('nostr+walletconnect://', 'https://')); // Hack to use URL parser
        const pubkey = url.hostname;
        const relay = url.searchParams.get('relay');
        const secret = url.searchParams.get('secret');
        const lud16 = url.searchParams.get('lud16');

        if (!pubkey || !relay || !secret) throw new Error("Missing required NWC parameters");

        this.walletPubkey = pubkey;
        this.relay = relay;
        this.secret = secret.trim();

        if (this.secret.length % 2 !== 0) {
            console.error("Invalid NWC Secret Length:", this.secret.length);
            throw new Error("NWC Secret must be a valid hex string (even length)");
        }

        this.connection = { pubkey, relay, secret: this.secret, lud16: lud16 || undefined };
    }

    /**
     * Query the connected wallet's balance.
     *
     * @returns Balance in satoshis (NWC returns msats, this converts)
     * @throws {Error} If not connected or the wallet returns an error
     */
    async getBalance(): Promise<number> {
        if (!this.connection) throw new Error("NWC not connected");

        const result = await this.executeCommand('get_balance', {});
        return result.balance ? Math.floor(result.balance / 1000) : 0; // NWC usually returns msats
    }

    /**
     * Pay a Bolt11 Lightning invoice via the connected wallet.
     *
     * On timeout, attempts a lookup_invoice to check if the payment actually
     * succeeded (wallets sometimes process payments after the response timeout).
     *
     * @param invoice - Bolt11 Lightning invoice string
     * @returns Object containing the payment preimage
     * @throws {Error} If payment fails or times out without confirmation
     */
    async payInvoice(invoice: string): Promise<{ preimage: string }> {
        if (!this.connection) throw new Error("NWC not connected");

        try {
            const result = await this.executeCommand('pay_invoice', { invoice });
            return { preimage: result.preimage };
        } catch (e) {
            // On timeout, check if the payment actually went through before reporting failure
            if (e instanceof Error && e.message === "NWC Timeout") {
                console.log("⏱️ NWC pay_invoice timed out, checking if payment succeeded...");
                try {
                    // Try lookup_invoice to see if it was actually paid
                    const lookupResult = await this.executeCommand('lookup_invoice', { invoice });
                    if (lookupResult?.preimage || lookupResult?.paid) {
                        console.log("✅ Payment actually succeeded despite timeout");
                        return { preimage: lookupResult.preimage || '' };
                    }
                } catch (lookupErr) {
                    console.warn("Lookup after timeout also failed:", lookupErr);
                }
                // Still no confirmation - throw the original timeout
                throw e;
            }
            throw e;
        }
    }

    /**
     * Create a new Lightning invoice for receiving a payment.
     *
     * @param amountSats - Amount to receive in satoshis (converted to msats for NWC)
     * @param description - Optional invoice description
     * @returns Object with the Bolt11 invoice string and payment hash
     * @throws {Error} If not connected or invoice creation fails
     */
    async makeInvoice(amountSats: number, description?: string): Promise<{ invoice: string, paymentHash: string }> {
        if (!this.connection) throw new Error("NWC not connected");
        const result = await this.executeCommand('make_invoice', {
            amount: amountSats * 1000, // msats
            description
        });
        return { invoice: result.invoice, paymentHash: result.payment_hash };
    }

    /**
     * Check whether an invoice has been paid.
     *
     * @param paymentHash - The payment hash of the invoice to look up
     * @returns Object indicating whether the invoice has been paid
     * @throws {Error} If not connected or lookup fails
     */
    async lookupInvoice(paymentHash: string): Promise<{ paid: boolean }> {
        if (!this.connection) throw new Error("NWC not connected");
        // Some implementations use invoice, some payment_hash. Spec says either.
        const result = await this.executeCommand('lookup_invoice', { payment_hash: paymentHash });
        return { paid: !!result.paid }; // Ensure boolean
    }

    private async executeCommand(method: string, params: any): Promise<any> {
        if (!this.connection) throw new Error("NWC not connected");

        const secretBytes = hexToBytes(this.connection.secret);
        // const clientPubkey = getPublicKey(secretBytes); // We are the client

        const payload = {
            method,
            params
        };

        const encryptedContent = await nip04.encrypt(secretBytes, this.connection.pubkey, JSON.stringify(payload));

        const eventTemplate = {
            kind: 23194, // NIP-47 Request Kind
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', this.connection.pubkey]],
            content: encryptedContent
        };

        const event = finalizeEvent(eventTemplate, secretBytes);

        // Subscribe to response BEFORE publishing
        const responsePromise = new Promise<any>((resolve, reject) => {
            const sub = pool.subscribeMany([this.connection!.relay], [{
                kinds: [23195], // NIP-47 Response Kind
                authors: [this.connection!.pubkey],
                '#e': [event.id]
            }], {
                onevent(resEvent) {
                    resolve(resEvent);
                    sub.close();
                },
                oneose() {
                    // Don't reject on EOSE, just wait for timeout
                }
            });

            setTimeout(() => {
                sub.close();
                reject(new Error("NWC Timeout"));
            }, 60000);
        });

        await Promise.any(pool.publish([this.connection.relay], event));

        const responseEvent = await responsePromise as Event;
        const decryptedContent = await nip04.decrypt(secretBytes, this.connection.pubkey, responseEvent.content);
        const response = JSON.parse(decryptedContent);

        if (response.error) {
            throw new Error(response.error.message || "NWC Error");
        }

        return response.result;
    }
}
