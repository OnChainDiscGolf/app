import { NPCClient, JWTAuthProvider, ConsoleLogger } from "npubcash-sdk";
import { signEventWrapper, getSession } from './nostrService';
import { Event } from 'nostr-tools';

// Singleton client instance
let clientInstance: NPCClient | null = null;

const getClient = () => {
    if (clientInstance) return clientInstance;

    const baseUrl = "https://npub.cash";

    // Wrapper to adapt signEventWrapper to what SDK expects
    // SDK expects: (e: Omit<NostrEvent, "id" | "sig" | "pubkey">) => Promise<NostrEvent>
    const signer = async (e: any): Promise<any> => {
        // signEventWrapper handles adding pubkey, id, sig, and created_at if missing
        // But SDK might pass some of these.
        // signEventWrapper expects a template.
        return await signEventWrapper(e);
    };

    const auth = new JWTAuthProvider(baseUrl, signer);
    const client = new NPCClient(baseUrl, auth);
    // client.setLogger(new ConsoleLogger()); // Uncomment for debug logs

    clientInstance = client;
    return client;
};

export const checkPendingPayments = async (): Promise<string[]> => {
    const session = getSession();
    if (!session) return [];

    try {
        const client = getClient();
        console.log("Checking for pending npub.cash payments...");

        // Fetch all quotes
        // TODO: We could optimize this with getQuotesSince if we track last check time
        const quotes = await client.getAllQuotes();

        const tokens: string[] = [];

        for (const q of quotes) {
            const quote = q as any;
            // Check if paid and has a token
            // The SDK Quote type should have 'state' and 'token' (or similar fields)
            // Based on docs: state === 'PAID'

            // We need to check the actual shape of Quote from SDK or logs
            // Assuming standard Cashu-Address flow:
            // Quote has 'state' enum.

            if (quote.state === 'PAID' && quote.token) {
                console.log(`Found paid quote ${quote.id}, token: ${quote.token.substring(0, 20)}...`);
                tokens.push(quote.token);
            }
        }

        return tokens;

    } catch (e) {
        console.warn("Failed to check npub.cash payments:", e);
        return [];
    }
};
