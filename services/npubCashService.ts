/**
 * @fileoverview npub.cash Service -- Gateway integration for Lightning address payments via Cashu.
 *
 * Manages connections to npub.cash and other Cashu gateway services that allow
 * receiving Lightning payments without running a Lightning node. When someone
 * pays a user's `npub@npubx.cash` Lightning address, the gateway converts the
 * payment into Cashu eCash tokens that the app can claim.
 *
 * Features:
 * - Multi-gateway support (npub.cash, minibits.cash, eNuts)
 * - WebSocket subscriptions for real-time quote updates (payment notifications)
 * - Automatic reconnection with exponential backoff (up to 10 attempts)
 * - JWT authentication via Nostr event signing (NIP-98 style)
 * - Gateway registration (sets preferred mint URL)
 * - HTTP polling fallback for manual refresh
 *
 * The primary gateway is npub.cash (via npubx.cash API endpoint), which provides
 * Lightning address resolution and Cashu token minting via Minibits mint.
 *
 * @see https://npub.cash -- npub.cash gateway service
 */

import { NPCClient, JWTAuthProvider, ConsoleLogger } from "npubcash-sdk";
import { signEventWrapper, getSession } from './nostrService';
import { Event } from 'nostr-tools';
import { WalletService } from './walletService';

// Singleton client instance for npub.cash (legacy)
let clientInstance: NPCClient | null = null;

// Legacy reconnection state variables
let subscriptionDisposer: (() => void) | null = null;
let reconnectAttempts = 0;
let isReconnecting = false;
let reconnectTimeout: NodeJS.Timeout | null = null;

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

/** A Cashu mint quote from a gateway representing a pending or completed payment */
export interface NpubCashQuote {
    /** Unique quote identifier from the gateway */
    quoteId: string;
    /** Mint URL where tokens can be claimed */
    mintUrl: string;
    /** Amount in satoshis */
    amount: number;
    /** Quote state: 'UNPAID', 'PAID', 'ISSUED' */
    state: string;
    /** Lightning invoice (Bolt11) associated with this quote */
    request: string;
}

/** Result of registering with a Cashu gateway */
export interface GatewayRegistration {
    /** Gateway identifier (e.g., 'npub.cash', 'minibits.cash') */
    gateway: string;
    /** User's pubkey used for registration */
    pubkey: string;
    /** Whether registration succeeded */
    success: boolean;
    /** Error message if registration failed */
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
 * Subscribe to real-time quote updates for all registered gateways.
 *
 * Always subscribes to npub.cash as the primary gateway, plus any
 * additional successfully registered gateways. Uses WebSocket connections
 * with automatic reconnection on failure.
 *
 * @param onUpdate - Callback when a quote is updated (receives quoteId and gateway name)
 * @param onError - Optional error handler for WebSocket failures
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

    // ALWAYS try to subscribe to npub.cash - it's the primary gateway
    // Don't depend on registration status since that can fail for various reasons
    const gatewaysToSubscribe = ['npub.cash'];
    
    // Also check for any other successfully registered gateways
    const registrations = checkGatewayRegistration();
    registrations.forEach(r => {
        if (r.success && !gatewaysToSubscribe.includes(r.gateway)) {
            gatewaysToSubscribe.push(r.gateway);
        }
    });

    console.log(`📡 Subscribing to ${gatewaysToSubscribe.length} gateways: ${gatewaysToSubscribe.join(', ')}`);

    // Subscribe to each gateway
    gatewaysToSubscribe.forEach(gatewayName => {
        subscribeToGatewayUpdates(gatewayName, onUpdate, onError);
    });

    // Return disposer that unsubscribes from all
    return () => {
        gatewaysToSubscribe.forEach(gatewayName => {
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
 * Legacy function for backward compatibility -- subscribes to all gateways
 * but presents a single-gateway callback interface.
 *
 * @param onUpdate - Callback when a quote is updated (receives quoteId only)
 * @param onError - Optional error handler
 * @returns Disposer function to unsubscribe
 * @deprecated Use subscribeToAllGatewayUpdates for multi-gateway support
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
 * Unsubscribe from all gateway WebSocket connections and clean up reconnection state.
 * Called on logout or when the wallet tab is unmounted.
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
 * Fetch all PAID quotes from npub.cash (HTTP fallback for manual refresh).
 *
 * Retrieves all quotes and filters for the 'PAID' state, which indicates
 * payments ready to be claimed as Cashu tokens. Auth errors are handled
 * gracefully (common for new accounts with no payment history).
 *
 * @returns Array of paid quotes, or empty array on failure
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
        console.log('ℹ️ npub.cash: No session available');
        return { gateway: 'npub.cash', pubkey: '', success: false, error: 'No session' };
    }

    try {
        console.log('🔄 [npub.cash] Starting registration...');
        
        // Get or create the client
        const client = getClient();
        
        // Use the SDK's settings API to set the mint URL
        // This registers the user's npub with the npub.cash service
        console.log('🔄 [npub.cash] Setting mint URL...');
        await client.settings.setMintUrl('https://mint.minibits.cash/Bitcoin');

        // Use the session pubkey as the registration identifier
        const pubkey = session.pk;
        
        console.log(`✅ [npub.cash] Registered successfully with pubkey: ${pubkey.slice(0, 8)}...`);
        return { gateway: 'npub.cash', pubkey, success: true };

    } catch (e: any) {
        console.error('❌ [npub.cash] Registration failed:', e.message || e);
        return { gateway: 'npub.cash', pubkey: '', success: false, error: e.message || 'Unknown error' };
    }
};

/**
 * Register static Cashu keys with Minibits gateway
 * Note: Minibits doesn't have a public registration API, so we just mark as "available"
 * since we're using their mint directly
 */
export const registerWithMinibits = async (): Promise<GatewayRegistration> => {
    const session = getSession();
    if (!session) {
        console.log('ℹ️ minibits.cash: No session available');
        return { gateway: 'minibits.cash', pubkey: '', success: false, error: 'No session' };
    }

    try {
        console.log('🔄 [minibits.cash] Checking mint connectivity...');
        
        // Just verify we can connect to the mint
        const walletService = new WalletService('https://mint.minibits.cash/Bitcoin');
        const connected = await walletService.connect();

        if (!connected) {
            throw new Error('Could not connect to Minibits mint');
        }

        // Use session pubkey as identifier
        const pubkey = session.pk;
        
        console.log(`✅ [minibits.cash] Mint connected, registration successful`);
        return { gateway: 'minibits.cash', pubkey, success: true };

    } catch (e: any) {
        console.error('❌ [minibits.cash] Registration failed:', e.message || e);
        return { gateway: 'minibits.cash', pubkey: '', success: false, error: e.message || 'Unknown error' };
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
 * Register with all supported gateways in parallel.
 *
 * Attempts registration with npub.cash, minibits.cash, and eNuts concurrently.
 * Results are stored in localStorage for use by the subscription system.
 *
 * @returns Array of registration results (one per gateway)
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
 * Check which gateways the user is registered with (reads from localStorage).
 *
 * @returns Array of gateway registration records, or empty array if none
 */
export const checkGatewayRegistration = (): GatewayRegistration[] => {
    const stored = localStorage.getItem('gateway_registrations');
    return stored ? JSON.parse(stored) : [];
};
