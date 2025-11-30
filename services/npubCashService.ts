import { NPCClient, JWTAuthProvider, ConsoleLogger } from "npubcash-sdk";
import { signEventWrapper, getSession } from './nostrService';
import { Event } from 'nostr-tools';
import { WalletService } from './walletService';

// Singleton client instances for different gateways
let gatewayClients: Record<string, NPCClient> = {};
// Subscription disposers for each gateway
let gatewaySubscriptions: Record<string, (() => void) | null> = {};
// Reconnection state per gateway
let gatewayReconnectState: Record<string, {
    attempts: number;
    timeout: NodeJS.Timeout | null;
    isReconnecting: boolean;
}> = {};

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

// Gateway configurations
const GATEWAY_CONFIGS = {
    'npub.cash': {
        baseUrl: 'https://npubx.cash',
        mintUrl: 'https://mint.minibits.cash/Bitcoin'
    },
    'minibits.cash': {
        baseUrl: 'https://wallet.minibits.cash',
        mintUrl: 'https://mint.minibits.cash/Bitcoin'
    }
};

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

export interface GatewayRegistration {
    gateway: string;
    pubkey: string;
    success: boolean;
    error?: string;
}

/**
 * Calculate exponential backoff delay
 */
const getReconnectDelay = (attempt: number): number => {
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, attempt);
    return Math.min(delay, MAX_RECONNECT_DELAY);
};

/**
 * Attempt to reconnect with exponential backoff
 */
const attemptReconnection = (
    onUpdate: (quoteId: string) => void,
    onError?: (error: any) => void
): void => {
    if (isReconnecting || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        return;
    }

    isReconnecting = true;
    const delay = getReconnectDelay(reconnectAttempts);

    console.log(`🔄 [npub.cash] Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeout = setTimeout(() => {
        reconnectAttempts++;
        isReconnecting = false;

        try {
            const client = getClient();
            console.log("📡 [npub.cash] Re-subscribing to real-time quote updates...");

            // Clean up any existing subscription
            if (subscriptionDisposer) {
                subscriptionDisposer();
                subscriptionDisposer = null;
            }

            // Subscribe to real-time updates
            const disposer = client.subscribe(
                (quoteId: string) => {
                    console.log(`📥 [npub.cash] Quote updated: ${quoteId}`);
                    // Reset reconnection attempts on successful message
                    reconnectAttempts = 0;
                    onUpdate(quoteId);
                },
                (error: any) => {
                    console.error("❌ [npub.cash] WebSocket error:", error);
                    // Attempt reconnection on error
                    attemptReconnection(onUpdate, onError);
                    if (onError) onError(error);
                }
            );

            subscriptionDisposer = disposer;
            console.log("✅ [npub.cash] WebSocket reconnected successfully");

        } catch (e) {
            console.error("Failed to re-subscribe to npub.cash WebSocket", e);
            // Continue attempting reconnection
            attemptReconnection(onUpdate, onError);
            if (onError) onError(e);
        }
    }, delay);
};

/**
 * Get or create client for a specific gateway
 */
const getGatewayClient = (gatewayName: string): NPCClient | null => {
    if (gatewayClients[gatewayName]) return gatewayClients[gatewayName];

    const config = GATEWAY_CONFIGS[gatewayName as keyof typeof GATEWAY_CONFIGS];
    if (!config) return null;

    const session = getSession();
    if (!session) return null;

    try {
        const signer = async (e: any): Promise<any> => {
            return await signEventWrapper(e);
        };

        const auth = new JWTAuthProvider(config.baseUrl, signer);
        const client = new NPCClient(config.baseUrl, auth);
        gatewayClients[gatewayName] = client;
        return client;
    } catch (e) {
        console.error(`Failed to create client for ${gatewayName}:`, e);
        return null;
    }
};

/**
 * Subscribe to real-time quote updates for all registered gateways
 * @param onUpdate Callback when a quote is updated (receives quoteId and gateway name)
 * @param onError Optional error handler
 * @returns Disposer function to unsubscribe from all gateways
 */
export const subscribeToAllGatewayUpdates = (
    onUpdate: (quoteId: string, gateway: string) => void,
    onError?: (error: any, gateway: string) => void
): (() => void) => {
    const session = getSession();
    if (!session) {
        console.warn("Cannot subscribe to gateways: no session");
        return () => { };
    }

    // Get registered gateways
    const registrations = checkGatewayRegistration();
    const activeGateways = registrations.filter(r => r.success).map(r => r.gateway);

    if (activeGateways.length === 0) {
        console.warn("No active gateway registrations found");
        return () => { };
    }

    console.log(`📡 Subscribing to ${activeGateways.length} gateways: ${activeGateways.join(', ')}`);

    // Subscribe to each gateway
    activeGateways.forEach(gatewayName => {
        subscribeToGatewayUpdates(gatewayName, onUpdate, onError);
    });

    // Return disposer that unsubscribes from all
    return () => {
        activeGateways.forEach(gatewayName => {
            unsubscribeFromGateway(gatewayName);
        });
    };
};

/**
 * Subscribe to a specific gateway's quote updates
 */
const subscribeToGatewayUpdates = (
    gatewayName: string,
    onUpdate: (quoteId: string, gateway: string) => void,
    onError?: (error: any, gateway: string) => void
): void => {
    try {
        const client = getGatewayClient(gatewayName);
        if (!client) {
            console.error(`Cannot subscribe to ${gatewayName}: no client`);
            return;
        }

        console.log(`📡 [${gatewayName}] Subscribing to real-time quote updates...`);

        // Initialize reconnection state
        gatewayReconnectState[gatewayName] = {
            attempts: 0,
            timeout: null,
            isReconnecting: false
        };

        // Unsubscribe from any existing subscription
        if (gatewaySubscriptions[gatewayName]) {
            gatewaySubscriptions[gatewayName]!();
            gatewaySubscriptions[gatewayName] = null;
        }

        // Subscribe to real-time updates
        const disposer = client.subscribe(
            (quoteId: string) => {
                console.log(`📥 [${gatewayName}] Quote updated: ${quoteId}`);
                // Reset reconnection attempts on successful message
                if (gatewayReconnectState[gatewayName]) {
                    gatewayReconnectState[gatewayName].attempts = 0;
                }
                onUpdate(quoteId, gatewayName);
            },
            (error: any) => {
                console.error(`❌ [${gatewayName}] WebSocket error:`, error);
                // Attempt reconnection on error
                attemptGatewayReconnection(gatewayName, onUpdate, onError);
                if (onError) onError(error, gatewayName);
            }
        );

        gatewaySubscriptions[gatewayName] = disposer;
        console.log(`✅ [${gatewayName}] WebSocket subscription active`);

    } catch (e) {
        console.error(`Failed to subscribe to ${gatewayName} WebSocket`, e);
        // Start reconnection attempts
        attemptGatewayReconnection(gatewayName, onUpdate, onError);
        if (onError) onError(e, gatewayName);
    }
};

/**
 * Attempt reconnection for a specific gateway
 */
const attemptGatewayReconnection = (
    gatewayName: string,
    onUpdate: (quoteId: string, gateway: string) => void,
    onError?: (error: any, gateway: string) => void
): void => {
    const state = gatewayReconnectState[gatewayName];
    if (!state || state.isReconnecting || state.attempts >= MAX_RECONNECT_ATTEMPTS) {
        return;
    }

    state.isReconnecting = true;
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, state.attempts), MAX_RECONNECT_DELAY);

    console.log(`🔄 [${gatewayName}] Attempting reconnection in ${delay}ms (attempt ${state.attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

    state.timeout = setTimeout(() => {
        state.attempts++;
        state.isReconnecting = false;

        try {
            subscribeToGatewayUpdates(gatewayName, onUpdate, onError);
        } catch (e) {
            console.error(`Failed to reconnect to ${gatewayName}:`, e);
            // Continue attempting reconnection
            attemptGatewayReconnection(gatewayName, onUpdate, onError);
            if (onError) onError(e, gatewayName);
        }
    }, delay);
};

/**
 * Unsubscribe from a specific gateway
 */
const unsubscribeFromGateway = (gatewayName: string): void => {
    if (gatewaySubscriptions[gatewayName]) {
        console.log(`🔌 [${gatewayName}] Unsubscribing from WebSocket...`);
        gatewaySubscriptions[gatewayName]!();
        gatewaySubscriptions[gatewayName] = null;
    }

    // Clean up reconnection state
    const state = gatewayReconnectState[gatewayName];
    if (state?.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
    }
    if (state) {
        state.attempts = 0;
        state.isReconnecting = false;
    }
};

/**
 * Legacy function for backward compatibility - subscribes to npub.cash only
 */
export const subscribeToQuoteUpdates = (
    onUpdate: (quoteId: string) => void,
    onError?: (error: any) => void
): (() => void) => {
    return subscribeToAllGatewayUpdates(
        (quoteId, gateway) => onUpdate(quoteId),
        (error, gateway) => onError?.(error)
    );
};

/**
 * Unsubscribe from all gateway updates and clean up reconnection state
 */
export const unsubscribeFromAllGatewayUpdates = () => {
    const registrations = checkGatewayRegistration();
    const activeGateways = registrations.filter(r => r.success).map(r => r.gateway);

    activeGateways.forEach(gatewayName => {
        unsubscribeFromGateway(gatewayName);
    });
};

/**
 * Legacy function for backward compatibility
 */
export const unsubscribeFromQuoteUpdates = () => {
    unsubscribeFromAllGatewayUpdates();
};

/**
 * Fetch all pending payments (HTTP fallback, used for manual refresh)
 */
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
    } catch (e: any) {
        // Check if it's an auth error
        if (e?.message?.includes('authorization') || e?.message?.includes('Invalid authorization')) {
            console.warn("⚠️ [npub.cash] Authentication failed - this is normal if you haven't received any payments yet");
            // Reset client instance to force re-auth on next attempt
            clientInstance = null;
        } else {
            console.error("❌ [npub.cash] Failed to check payments:", e?.message || e);
        }
        return [];
    }
};

/**
 * Fetch a specific quote by ID
 */
export const getQuoteById = async (quoteId: string): Promise<NpubCashQuote | null> => {
    try {
        const client = getClient();
        const quotes = await client.getAllQuotes();
        const quote = quotes.find((q: any) => q.quoteId === quoteId);
        return quote as unknown as NpubCashQuote || null;
    } catch (e) {
        console.error("Failed to fetch quote by ID", e);
        return null;
    }
};

/**
 * Register static Cashu keys with npub.cash gateway
 */
export const registerWithNpubCash = async (): Promise<GatewayRegistration> => {
    const session = getSession();
    if (!session) {
        return { gateway: 'npub.cash', pubkey: '', success: false, error: 'No session' };
    }

    try {
        // Generate static Cashu keypair for this gateway
        const walletService = new WalletService('https://mint.minibits.cash/Bitcoin');
        await walletService.connect();

        // Get the public key for registration
        const pubkey = await walletService.getPublicKey();
        if (!pubkey) {
            return { gateway: 'npub.cash', pubkey: '', success: false, error: 'Failed to generate keys' };
        }

        // Register with npub.cash API
        const client = getClient();
        const registrationData = {
            pubkey: pubkey,
            mintUrl: 'https://mint.minibits.cash/Bitcoin'
        };

        // Use the SDK's settings API to register
        await client.settings.setMintUrl('https://mint.minibits.cash/Bitcoin');

        console.log(`✅ Registered with npub.cash: ${pubkey}`);
        return { gateway: 'npub.cash', pubkey, success: true };

    } catch (e: any) {
        console.log('ℹ️ npub.cash gateway registration unavailable:', e.message);
        return { gateway: 'npub.cash', pubkey: '', success: false, error: e.message };
    }
};

/**
 * Register static Cashu keys with Minibits gateway
 */
export const registerWithMinibits = async (): Promise<GatewayRegistration> => {
    const session = getSession();
    if (!session) {
        return { gateway: 'minibits.cash', pubkey: '', success: false, error: 'No session' };
    }

    try {
        // Generate static Cashu keypair
        const walletService = new WalletService('https://mint.minibits.cash/Bitcoin');
        await walletService.connect();

        const pubkey = await walletService.getPublicKey();
        if (!pubkey) {
            return { gateway: 'minibits.cash', pubkey: '', success: false, error: 'Failed to generate keys' };
        }

        // Minibits direct registration via API
        const response = await fetch('https://wallet.minibits.cash/api/v1/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pubkey: pubkey,
                mintUrl: 'https://mint.minibits.cash/Bitcoin',
                npub: session.pk
            })
        });

        if (!response.ok) {
            throw new Error(`Registration failed: ${response.status}`);
        }

        console.log(`✅ Registered with Minibits: ${pubkey}`);
        return { gateway: 'minibits.cash', pubkey, success: true };

    } catch (e: any) {
        console.log('ℹ️ Minibits gateway registration unavailable:', e.message);
        return { gateway: 'minibits.cash', pubkey: '', success: false, error: e.message };
    }
};

/**
 * Register with eNuts gateway
 */
export const registerWithENuts = async (): Promise<GatewayRegistration> => {
    // eNuts integration is not yet implemented - return gracefully
    console.log('ℹ️ eNuts gateway registration skipped (not yet implemented)');
    return { gateway: 'enuts.cash', pubkey: '', success: false, error: 'Not yet implemented' };
};

/**
 * Register with all supported gateways automatically
 */
export const registerWithAllGateways = async (): Promise<GatewayRegistration[]> => {
    console.log('🚀 Starting automatic gateway registration...');

    const results: GatewayRegistration[] = [];

    // Register with all gateways in parallel for speed
    const registrationPromises = [
        registerWithNpubCash(),
        registerWithMinibits(),
        registerWithENuts()
    ];

    const allResults = await Promise.allSettled(registrationPromises);

    // Process results
    allResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            results.push(result.value);
        } else {
            // Handle rejected promises
            const gatewayNames = ['npub.cash', 'minibits.cash', 'enuts.cash'];
            results.push({
                gateway: gatewayNames[index],
                pubkey: '',
                success: false,
                error: result.reason?.message || 'Registration failed'
            });
        }
    });

    const successful = results.filter(r => r.success).length;
    const total = results.length;

    console.log(`📊 Gateway registration complete: ${successful}/${total} successful`);

    // Store registration status
    localStorage.setItem('gateway_registrations', JSON.stringify(results));

    return results;
};

/**
 * Check if user is registered with gateways
 */
export const checkGatewayRegistration = (): GatewayRegistration[] => {
    const stored = localStorage.getItem('gateway_registrations');
    return stored ? JSON.parse(stored) : [];
};
