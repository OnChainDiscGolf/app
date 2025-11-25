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

export interface NpubCashQuote {
    quoteId: string;
    mintUrl: string;
    amount: number;
    state: string;
    request: string;
}

export const checkPendingPayments = async (): Promise<NpubCashQuote[]> => {
    const session = getSession();
    if (!session) return [];

    try {
        const client = getClient();
        console.log("Checking for pending npub.cash payments...");

        // Fetch all quotes
        // TODO: We could optimize this with getQuotesSince if we track last check time
        const quotes = await client.getAllQuotes();
        console.log(`Fetched ${quotes.length} quotes from npub.cash`);

        // Filter for PAID quotes
        // We cast to any because the SDK types might be strict but we want to be sure
        const paidQuotes = quotes.filter((q: any) => q.state === 'PAID');

        console.log(`Found ${paidQuotes.length} PAID quotes`);
        return paidQuotes as unknown as NpubCashQuote[];
    } catch (e) {
        console.error("Failed to check npub.cash payments", e);
        return [];
    }
};
