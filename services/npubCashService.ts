import { NPCClient, JWTAuthProvider, ConsoleLogger } from "npubcash-sdk";
import { signEventWrapper, getSession } from './nostrService';
import { Event } from 'nostr-tools';

// Singleton client instance
let clientInstance: NPCClient | null = null;

const getClient = () => {
    if (clientInstance) return clientInstance;

    const baseUrl = "https://npubx.cash";

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

        // Log the first few quotes to see their structure and state
        if (quotes.length > 0) {
            console.log("Sample quote:", JSON.stringify(quotes[0], null, 2));
            quotes.forEach(q => console.log(`Quote ${q.quoteId}: state=${q.state}, amount=${q.amount}`));
        }

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

/**
 * Subscribe to npub.cash quote updates with a lightweight background polling mechanism.
 * This drastically reduces API calls compared to aggressive polling (30s vs 2-5s intervals).
 * 
 * @param onQuoteUpdate Callback fired when new PAID quotes are detected
 * @returns Subscription object with .close() method for cleanup
 */
export const subscribeToQuoteUpdates = (
    onQuoteUpdate: (quotes: NpubCashQuote[]) => void
): { close: () => void } => {
    let intervalId: NodeJS.Timeout | null = null;
    let isActive = true;
    let isFirstPoll = true;

    const poll = async () => {
        if (!isActive) return;

        try {
            const paidQuotes = await checkPendingPayments();

            // On first poll, process ALL existing PAID quotes (not just new ones)
            // This ensures payments received while app was closed get processed
            // The callback will handle deduplication via localStorage
            if (isFirstPoll) {
                isFirstPoll = false;
                if (paidQuotes.length > 0) {
                    console.log(`[npub.cash subscription] Initial poll found ${paidQuotes.length} PAID quotes, processing all...`);
                    onQuoteUpdate(paidQuotes);
                }
            } else {
                // On subsequent polls, only process if we found any PAID quotes
                // The callback handles deduplication, so we don't filter here
                if (paidQuotes.length > 0) {
                    console.log(`[npub.cash subscription] Found ${paidQuotes.length} PAID quotes`);
                    onQuoteUpdate(paidQuotes);
                }
            }
        } catch (e) {
            console.error("[npub.cash subscription] Poll failed:", e);
        }
    };

    // Start polling every 30 seconds (balanced for responsiveness vs API load)
    console.log("[npub.cash subscription] Starting subscription with 30s interval");
    poll(); // Initial check
    intervalId = setInterval(poll, 30 * 1000);

    return {
        close: () => {
            console.log("[npub.cash subscription] Closing subscription");
            isActive = false;
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
    };
};
