import { finalizeEvent, nip04, generateSecretKey, getPublicKey, Event } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { SimplePool } from 'nostr-tools';

// Re-using the pool from nostrService might be better, but for now creating a local one or we can export the one from nostrService.
// To avoid circular deps, let's create a lightweight pool here or accept it in constructor.
const pool = new SimplePool();

export interface NWCConnection {
    pubkey: string;
    relay: string;
    secret: string; // The 'secret' from the connection string (optional in older specs, but usually present)
    lud16?: string;
}

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
        this.secret = secret;

        this.connection = { pubkey, relay, secret, lud16: lud16 || undefined };
    }

    async getBalance(): Promise<number> {
        if (!this.connection) throw new Error("NWC not connected");

        const result = await this.executeCommand('get_balance', {});
        return result.balance ? Math.floor(result.balance / 1000) : 0; // NWC usually returns msats
    }

    async payInvoice(invoice: string): Promise<{ preimage: string }> {
        if (!this.connection) throw new Error("NWC not connected");

        const result = await this.executeCommand('pay_invoice', { invoice });
        return { preimage: result.preimage };
    }

    async makeInvoice(amountSats: number, description?: string): Promise<{ invoice: string, paymentHash: string }> {
        if (!this.connection) throw new Error("NWC not connected");
        const result = await this.executeCommand('make_invoice', {
            amount: amountSats * 1000, // msats
            description
        });
        return { invoice: result.invoice, paymentHash: result.payment_hash };
    }

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
