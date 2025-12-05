/**
 * Breez SDK Service
 * 
 * Wrapper for Breez SDK (Spark/Nodeless implementation)
 * Provides self-custodial Lightning wallet functionality.
 * 
 * SDK Package: @breeztech/breez-sdk-spark
 * Documentation: https://sdk-doc-spark.breez.technology/
 * 
 * Features:
 * - Send payments via Bolt11, LNURL-Pay, Lightning address
 * - Receive payments via Bolt11, static Lightning address
 * - On-chain interoperability
 * - WebAssembly support for web/Capacitor apps
 */

import { getSeedFromMnemonic, retrieveMnemonicEncrypted, hasStoredMnemonic } from './mnemonicService';

// ============================================================================
// CUSTOM LIGHTNING ADDRESS GENERATION
// ============================================================================
// 
// ⚠️⚠️⚠️ CRITICAL WARNING - DO NOT MODIFY ⚠️⚠️⚠️
// 
// The following word lists and address generation algorithm are IMMUTABLE.
// They determine users' permanent Lightning addresses derived from their mnemonic.
// 
// CONSEQUENCES OF MODIFICATION:
// - Changing word lists = Users get DIFFERENT addresses for same mnemonic
// - Changing algorithm = Existing users CANNOT receive payments
// - Changing domain = ALL existing addresses become INVALID
// - Users would LOSE access to funds sent to their old addresses
// 
// The address generation is DETERMINISTIC by design:
// Same mnemonic → Same address FOREVER
// 
// This is similar to how Bitcoin addresses are derived from seeds.
// You wouldn't change Bitcoin's derivation path, don't change this either.
// 
// If you need new features, ADD them separately. DO NOT modify existing logic.
// 
// Last verified working: December 2024
// ============================================================================

/**
 * ⚠️ FROZEN WORD LIST - DO NOT ADD, REMOVE, OR REORDER ⚠️
 * 
 * These disc golf themed words are used for deterministic address generation.
 * The array indices are used to select words based on mnemonic-derived seeds.
 * 
 * ANY CHANGE to this array (including order) will cause existing users
 * to receive different Lightning addresses, breaking their ability to
 * receive payments.
 * 
 * Array length: 27 words (DO NOT CHANGE)
 */
const DISC_GOLF_WORDS = [
    'ace', 'birdie', 'doink', 'shank', 'yoink', 'huck', 'stable', 
    'meathook', 'flippy', 'drive', 'putt', 'hyzer', 'anhyzer', 
    'disc', 'chain', 'basket', 'eagle', 'bogey', 'par', 'throw',
    'grip', 'rip', 'crush', 'bomb', 'flick', 'roller', 'skip'
] as const; // `as const` to prevent accidental mutations

/**
 * ⚠️ FROZEN WORD LIST - DO NOT ADD, REMOVE, OR REORDER ⚠️
 * 
 * These nature themed words are used for deterministic address generation.
 * The array indices are used to select words based on mnemonic-derived seeds.
 * 
 * ANY CHANGE to this array (including order) will cause existing users
 * to receive different Lightning addresses, breaking their ability to
 * receive payments.
 * 
 * Array length: 28 words (DO NOT CHANGE)
 */
const NATURE_WORDS = [
    'oak', 'pine', 'river', 'creek', 'meadow', 'forest', 'stone', 
    'wind', 'leaf', 'trail', 'hawk', 'wolf', 'bear', 'ironleaf',
    'cedar', 'maple', 'birch', 'fern', 'moss', 'brook', 'ridge',
    'peak', 'vale', 'glen', 'grove', 'dusk', 'dawn', 'storm'
] as const; // `as const` to prevent accidental mutations

/**
 * ⚠️ CRITICAL: DETERMINISTIC ADDRESS GENERATION - DO NOT MODIFY ⚠️
 * 
 * Generates a deterministic custom Lightning address from a seed/mnemonic.
 * Format: [disc golf word][nature word][2 digits]@breez.fun
 * 
 * THIS FUNCTION MUST PRODUCE THE SAME OUTPUT FOR THE SAME INPUT FOREVER.
 * 
 * The algorithm uses character codes from the mnemonic words to seed
 * the selection of display words. This ensures:
 * 1. Same mnemonic always produces same address
 * 2. Different mnemonics produce different addresses (high probability)
 * 3. Address is human-readable and memorable
 * 
 * DO NOT CHANGE:
 * - The loop logic or iteration bounds
 * - The mathematical operations (charCodeAt, modulo, etc.)
 * - The seed variable calculations
 * - The word selection logic
 * - The domain suffix (@breez.fun)
 * - The string concatenation format
 * 
 * @param mnemonic - The user's BIP-39 mnemonic (12 or 24 words)
 * @returns Custom lightning address string (e.g., "crushcreek81@breez.fun")
 * 
 * @example
 * // Same mnemonic ALWAYS returns same address
 * generateCustomLightningAddress("word1 word2 ...") // → "aceoak42@breez.fun"
 * generateCustomLightningAddress("word1 word2 ...") // → "aceoak42@breez.fun" (identical)
 */
export const generateCustomLightningAddress = (mnemonic: string): string => {
    // ⚠️ DO NOT MODIFY THIS FUNCTION - See warnings above
    
    // Use mnemonic words to create deterministic but unique address
    const words = mnemonic.split(' ');
    
    // Use character codes from first few words to seed selection
    // ⚠️ These calculations MUST remain unchanged
    let seed1 = 0;
    let seed2 = 0;
    let seed3 = 0;
    
    for (let i = 0; i < Math.min(4, words.length); i++) {
        const word = words[i];
        for (let j = 0; j < word.length; j++) {
            if (i < 2) {
                seed1 += word.charCodeAt(j) * (j + 1);
            } else {
                seed2 += word.charCodeAt(j) * (j + 1);
            }
            seed3 += word.charCodeAt(j);
        }
    }
    
    // Select words deterministically - DO NOT CHANGE modulo operations
    const discGolfWord = DISC_GOLF_WORDS[seed1 % DISC_GOLF_WORDS.length];
    const natureWord = NATURE_WORDS[seed2 % NATURE_WORDS.length];
    const twoDigits = String(seed3 % 100).padStart(2, '0');
    
    // ⚠️ Domain suffix MUST remain "@breez.fun" - changing breaks all addresses
    return `${discGolfWord}${natureWord}${twoDigits}@breez.fun`;
};

// ============================================================================
// TYPES
// ============================================================================

export interface BreezBalance {
    /** Balance in satoshis */
    balanceSats: number;
    /** Pending incoming payments */
    pendingReceiveSats: number;
    /** Pending outgoing payments */
    pendingSendSats: number;
}

export interface BreezPayment {
    id: string;
    paymentType: 'send' | 'receive';
    amountSats: number;
    feeSats: number;
    timestamp: number;
    description?: string;
    bolt11?: string;
    preimage?: string;
    status: 'pending' | 'complete' | 'failed';
}

export interface BreezInvoice {
    bolt11: string;
    paymentHash: string;
    amountSats: number;
    description: string;
    expiry: number;
}

export interface BreezPaymentResult {
    success: boolean;
    paymentHash?: string;
    preimage?: string;
    feeSats?: number;
    error?: string;
}

export interface BreezConfig {
    apiKey: string;
    environment: 'production' | 'staging';
    workingDir?: string;
}

// ============================================================================
// STATE
// ============================================================================

let sdkInstance: any = null;
let isInitialized = false;
let staticLightningAddress: string | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================
// 
// SDK Integration Notes for Future Developers:
// 
// This service uses the Breez SDK Spark (nodeless) implementation.
// Package: @breeztech/breez-sdk-spark
// Docs: https://sdk-doc-spark.breez.technology/
// 
// IMPORTANT API STRUCTURE (as of SDK v0.5.x):
// 
// 1. The SDK uses a `connect()` function that takes a ConnectRequest object:
//    {
//      config: Config,        // From defaultConfig(network)
//      seed: Seed,            // { type: 'mnemonic', mnemonic: string }
//      storageDir: string     // Path for IndexedDB storage
//    }
// 
// 2. The seed MUST be in the format: { type: 'mnemonic', mnemonic: string }
//    DO NOT try to convert the mnemonic to bytes/entropy manually.
// 
// 3. The SDK methods available on the instance include:
//    - getInfo({ ensureSynced: boolean }) → { balanceSats, tokenBalances }
//    - sendPayment({ bolt11 }) → Payment result
//    - receivePayment({ amountMsat, description }) → Invoice
//    - lnurlPay({ data, amountMsat }) → LNURL payment
//    - parseInput(string) → Parsed input type
// 
// If you update the SDK version, verify these APIs still work the same way.
// ============================================================================

// Store mnemonic for address generation
// ⚠️ This is stored in memory only, not persisted here (mnemonic is in mnemonicService)
let storedMnemonic: string | null = null;

/**
 * Initialize Breez SDK with mnemonic
 * 
 * IMPORTANT: This function handles connection to Breez Lightning services.
 * The initialization flow is critical and has been tested to work correctly.
 * 
 * Key requirements:
 * - API key must be a valid Breez PEM certificate (see constants.ts)
 * - Mnemonic must be valid BIP-39 (12 or 24 words)
 * - Network should match API key permissions (production = mainnet)
 * 
 * @param mnemonic - 12/24 word BIP-39 mnemonic
 * @param config - Breez SDK configuration with API key
 */
export const initializeBreez = async (
    mnemonic: string,
    config: BreezConfig
): Promise<boolean> => {
    console.log('🔌 Initializing Breez SDK...');
    console.log('📋 Config environment:', config.environment);
    console.log('🔑 API Key present:', !!config.apiKey);

    // Store mnemonic for lightning address generation
    storedMnemonic = mnemonic;

    try {
        // Import Breez SDK WASM module
        // The SDK uses WebAssembly for cryptographic operations
        console.log('📦 Loading Breez SDK WASM module...');
        const breezModule = await import('@breeztech/breez-sdk-spark/web');
        const { default: init, connect, defaultConfig } = breezModule;
        
        // Initialize WebAssembly runtime
        // This must complete before any SDK operations
        console.log('⚙️ Initializing WebAssembly...');
        await init();
        
        // Get default config and customize it with API key
        // Network must be 'mainnet' or 'testnet' (lowercase)
        console.log('⚡ Building SDK configuration...');
        const network = config.environment === 'production' ? 'mainnet' : 'testnet';
        const sdkConfig = defaultConfig(network);
        
        // Add API key to config - this authenticates with Breez services
        sdkConfig.apiKey = config.apiKey;
        
        // Create seed from mnemonic
        // ⚠️ IMPORTANT: Seed format must be { type: 'mnemonic', mnemonic: string }
        // Do NOT try to convert to bytes or use other formats
        console.log('🌱 Creating seed from mnemonic...');
        const seed = {
            type: 'mnemonic' as const,
            mnemonic: mnemonic
        };
        
        // Connect to Breez services
        // This establishes the Lightning wallet connection
        console.log('🔗 Connecting to Breez services...');
        const connectRequest = {
            config: sdkConfig,
            seed: seed,
            storageDir: config.workingDir || './breez_data'
        };
        
        sdkInstance = await connect(connectRequest);
        
        isInitialized = true;
        console.log('✅ Breez SDK initialized successfully');
        
        // Generate preferred address from mnemonic (deterministic)
        const preferredAddress = generateCustomLightningAddress(mnemonic);
        console.log('⚡ Preferred Lightning address:', preferredAddress);
        
        // Register Lightning Address with Breez backend (non-blocking)
        // This runs in background so SDK initialization returns quickly
        registerLightningAddressWithBreez(preferredAddress)
            .then(result => {
                if (result) {
                    console.log('✅ Lightning Address registered with Breez:', result.lightningAddress);
                } else {
                    // Registration failed - use local address as fallback (won't receive payments)
                    staticLightningAddress = preferredAddress;
                    console.warn('⚠️ Lightning Address registration failed, using local address (non-functional for receiving)');
                }
            })
            .catch(e => {
                console.warn('⚠️ Lightning Address registration error:', e);
                staticLightningAddress = preferredAddress;
            });
        
        // Set temporary address while registration is in progress
        staticLightningAddress = preferredAddress;
        
        return true;
    } catch (error) {
        console.error('❌ Breez SDK initialization failed:', error);
        
        // Log more details for debugging
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            // Check for common issues
            if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('DNS')) {
                console.error('🌐 Network/DNS issue detected. Check internet connection and DNS settings.');
            }
            if (error.message.includes('WASM') || error.message.includes('WebAssembly')) {
                console.error('📦 WebAssembly loading issue. Browser may not support WASM.');
            }
        }
        
        isInitialized = false;
        
        // Even if SDK fails, we can still generate a custom address for display
        // (won't be functional for receiving until SDK initializes)
        if (mnemonic) {
            staticLightningAddress = generateCustomLightningAddress(mnemonic);
            console.log('📧 Generated placeholder Lightning address:', staticLightningAddress);
        }
        
        return false;
    }
};

/**
 * Initialize Breez from stored mnemonic
 * Called on app startup if mnemonic exists
 */
export const initializeBreezFromStorage = async (
    pubkey: string,
    config: BreezConfig,
    useBreezMnemonic: boolean = false
): Promise<boolean> => {
    const mnemonic = retrieveMnemonicEncrypted(pubkey, useBreezMnemonic);

    if (!mnemonic) {
        console.log('📭 No mnemonic found in storage for Breez');
        return false;
    }

    return initializeBreez(mnemonic, config);
};

/**
 * Check if Breez SDK is initialized
 */
export const isBreezInitialized = (): boolean => {
    return isInitialized;
};

/**
 * Disconnect and cleanup Breez SDK
 */
export const disconnectBreez = async (): Promise<void> => {
    if (sdkInstance) {
        try {
            await sdkInstance.disconnect();
        } catch (error) {
            console.warn('Error disconnecting Breez SDK:', error);
        }
        sdkInstance = null;
    }
    isInitialized = false;
    staticLightningAddress = null;
    storedMnemonic = null;
    console.log('🔌 Breez SDK disconnected');
};

// ============================================================================
// BALANCE & INFO
// ============================================================================

/**
 * Get wallet balance
 */
export const getBreezBalance = async (): Promise<BreezBalance> => {
    if (!isInitialized || !sdkInstance) {
        console.warn('Breez SDK not initialized');
        return {
            balanceSats: 0,
            pendingReceiveSats: 0,
            pendingSendSats: 0
        };
    }

    try {
        // Use getInfo API to get balance
        const info = await sdkInstance.getInfo({ ensureSynced: false });
        return {
            balanceSats: info.balanceSats || 0,
            pendingReceiveSats: 0, // Not available in Spark SDK
            pendingSendSats: 0     // Not available in Spark SDK
        };
    } catch (error) {
        console.error('Failed to get Breez balance:', error);
        return {
            balanceSats: 0,
            pendingReceiveSats: 0,
            pendingSendSats: 0
        };
    }
};

/**
 * Get the static Lightning address for receiving
 * This address can be published to kind 0 profile
 * 
 * Priority:
 * 1. Return cached address if available
 * 2. If SDK is initialized, fetch registered address from Breez backend
 * 3. If no registered address but have mnemonic, generate local address (won't work for receiving)
 */
export const getStaticLightningAddress = async (): Promise<string | null> => {
    // Return cached address if available
    if (staticLightningAddress) {
        return staticLightningAddress;
    }

    // If SDK is initialized, try to get registered address from Breez backend
    if (isInitialized && sdkInstance) {
        try {
            const addressInfo = await sdkInstance.getLightningAddress();
            if (addressInfo && addressInfo.lightningAddress) {
                staticLightningAddress = addressInfo.lightningAddress;
                console.log('⚡ Retrieved registered Lightning address from Breez:', staticLightningAddress);
                return staticLightningAddress;
            }
        } catch (error) {
            console.warn('Failed to get Lightning address from Breez SDK:', error);
        }
    }

    // Fallback: If we have stored mnemonic, generate address locally
    // Note: This address won't work for receiving until registered with Breez
    if (storedMnemonic) {
        staticLightningAddress = generateCustomLightningAddress(storedMnemonic);
        console.warn('⚠️ Using locally generated address (not registered with Breez):', staticLightningAddress);
        return staticLightningAddress;
    }

    console.warn('Breez: No mnemonic or SDK available for Lightning address');
    return null;
};

/**
 * Get cached static Lightning address (sync, no API call)
 */
export const getCachedLightningAddress = (): string | null => {
    return staticLightningAddress;
};

// ============================================================================
// LIGHTNING ADDRESS REGISTRATION WITH BREEZ BACKEND
// ============================================================================

/**
 * Generate a random alternative username for Lightning Address
 * Uses disc golf + nature words with a random 4-digit suffix
 * 
 * @returns A random username in format [discgolf][nature][4digits]
 */
const generateRandomUsername = (): string => {
    const discGolfWord = DISC_GOLF_WORDS[Math.floor(Math.random() * DISC_GOLF_WORDS.length)];
    const natureWord = NATURE_WORDS[Math.floor(Math.random() * NATURE_WORDS.length)];
    const randomDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${discGolfWord}${natureWord}${randomDigits}`;
};

/**
 * Extract username from a Lightning Address
 * e.g., "crushcreek81@breez.fun" -> "crushcreek81"
 */
const extractUsername = (address: string): string => {
    return address.split('@')[0];
};

/**
 * Register a Lightning Address with Breez backend
 * 
 * This function:
 * 1. First checks if user already has a registered address
 * 2. If not, tries to register the preferred deterministic address
 * 3. If taken, generates random alternatives and retries (up to 10 attempts)
 * 
 * @param preferredAddress - The preferred address to try first (from deterministic generation)
 * @returns The registered Lightning Address info, or null if registration fails
 */
export const registerLightningAddressWithBreez = async (
    preferredAddress?: string
): Promise<{ lightningAddress: string } | null> => {
    if (!isInitialized || !sdkInstance) {
        console.warn('Breez SDK not initialized - cannot register Lightning Address');
        return null;
    }

    const MAX_ATTEMPTS = 10;

    try {
        // Step 1: Check if user already has a registered address
        console.log('⚡ Checking for existing registered Lightning Address...');
        try {
            const existingAddress = await sdkInstance.getLightningAddress();
            if (existingAddress && existingAddress.lightningAddress) {
                console.log('✅ Found existing registered address:', existingAddress.lightningAddress);
                staticLightningAddress = existingAddress.lightningAddress;
                return { lightningAddress: existingAddress.lightningAddress };
            }
        } catch (e) {
            // No existing address, continue to registration
            console.log('📝 No existing address found, proceeding to register new one');
        }

        // Step 2: Try to register preferred address first
        // Extract just the username part (before @breez.fun)
        let usernameToTry = preferredAddress 
            ? extractUsername(preferredAddress) 
            : generateRandomUsername();
        
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            console.log(`⚡ Registration attempt ${attempt}/${MAX_ATTEMPTS}: ${usernameToTry}@breez.fun`);
            
            try {
                // Check if username is available
                // Note: Breez SDK expects { username: string } not { address: string }
                const isAvailable = await sdkInstance.checkLightningAddressAvailable({
                    username: usernameToTry
                });
                
                if (isAvailable) {
                    console.log(`✅ Username "${usernameToTry}" is available, registering...`);
                    
                    // Register the username
                    // Note: Breez SDK expects { username: string } not { address: string }
                    const registrationResult = await sdkInstance.registerLightningAddress({
                        username: usernameToTry
                    });
                    
                    if (registrationResult && registrationResult.lightningAddress) {
                        console.log('✅ Successfully registered Lightning Address:', registrationResult.lightningAddress);
                        staticLightningAddress = registrationResult.lightningAddress;
                        return { lightningAddress: registrationResult.lightningAddress };
                    }
                } else {
                    console.log(`❌ Username "${usernameToTry}" is already taken`);
                }
            } catch (e) {
                console.warn(`⚠️ Error checking/registering username "${usernameToTry}":`, e);
            }
            
            // Generate a new random username for the next attempt
            usernameToTry = generateRandomUsername();
        }
        
        console.error('❌ Failed to register Lightning Address after', MAX_ATTEMPTS, 'attempts');
        return null;
        
    } catch (error) {
        console.error('❌ Lightning Address registration failed:', error);
        return null;
    }
};

// ============================================================================
// RECEIVING PAYMENTS
// ============================================================================

/**
 * Create a Bolt11 invoice for receiving a specific amount
 * 
 * @param amountSats - Amount in satoshis
 * @param description - Invoice description
 */
export const createInvoice = async (
    amountSats: number,
    description: string = 'On-Chain Disc Golf Payment'
): Promise<BreezInvoice | null> => {
    if (!isInitialized || !sdkInstance) {
        console.warn('Breez SDK not initialized');
        return null;
    }

    try {
        console.log(`📝 Creating invoice for ${amountSats} sats: "${description}"`);
        
        const receiveResponse = await sdkInstance.receivePayment({
            amountMsat: amountSats * 1000,
            description,
            useDescriptionHash: false
        });
        
        return {
            bolt11: receiveResponse.lnInvoice.bolt11,
            paymentHash: receiveResponse.lnInvoice.paymentHash,
            amountSats: amountSats,
            description: description,
            expiry: receiveResponse.lnInvoice.expiry
        };
    } catch (error) {
        console.error('Failed to create Breez invoice:', error);
        return null;
    }
};

// ============================================================================
// SENDING PAYMENTS
// ============================================================================

/**
 * Pay a Bolt11 invoice
 * 
 * Uses the two-step Breez SDK Spark payment flow:
 * 1. prepareSendPayment() - validates and prepares the payment
 * 2. sendPayment() - executes the prepared payment
 * 
 * @param bolt11 - Lightning invoice string
 */
export const payInvoice = async (bolt11: string): Promise<BreezPaymentResult> => {
    if (!isInitialized || !sdkInstance) {
        return {
            success: false,
            error: 'Breez SDK not initialized'
        };
    }

    try {
        console.log(`⚡ Paying invoice: ${bolt11.substring(0, 30)}...`);
        
        // Step 1: Prepare the payment (required by Breez SDK Spark)
        // This validates the invoice and calculates fees
        // Note: Breez SDK Spark uses 'paymentRequest' field name for bolt11 invoices
        console.log('📋 Preparing payment...');
        const prepareResponse = await sdkInstance.prepareSendPayment({
            paymentRequest: bolt11
        });
        
        console.log('✅ Payment prepared, executing...');
        
        // Step 2: Execute the payment with the prepare response
        const result = await sdkInstance.sendPayment({
            prepareResponse
        });
        
        console.log('✅ Payment sent successfully');
        
        return {
            success: true,
            paymentHash: result.payment?.paymentHash,
            preimage: result.payment?.preimage,
            feeSats: Math.floor((result.payment?.feeMsat || 0) / 1000)
        };
    } catch (error) {
        console.error('Payment failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Payment failed'
        };
    }
};

/**
 * Pay to a Lightning address (LNURL-pay)
 * 
 * Uses HTTP-based LNURL resolution since sdkInstance.parseInput() is not available
 * in the Breez SDK Spark. Flow: resolve address -> get invoice -> pay invoice.
 * 
 * @param lightningAddress - Address like user@domain.com
 * @param amountSats - Amount in satoshis
 * @param comment - Optional comment for the payment
 */
export const payLightningAddress = async (
    lightningAddress: string,
    amountSats: number,
    comment?: string
): Promise<BreezPaymentResult> => {
    if (!isInitialized || !sdkInstance) {
        return {
            success: false,
            error: 'Breez SDK not initialized'
        };
    }

    try {
        console.log(`⚡ Paying ${amountSats} sats to ${lightningAddress}`);
        
        // Step 1: Resolve lightning address to get LNURL callback
        const resolved = await resolveLightningAddress(lightningAddress);
        if (!resolved) {
            return {
                success: false,
                error: 'Failed to resolve lightning address'
            };
        }
        
        // Step 2: Validate amount bounds
        if (amountSats < resolved.minSendable) {
            return {
                success: false,
                error: `Amount ${amountSats} below minimum ${resolved.minSendable} sats`
            };
        }
        if (amountSats > resolved.maxSendable) {
            return {
                success: false,
                error: `Amount ${amountSats} above maximum ${resolved.maxSendable} sats`
            };
        }
        
        // Step 3: Get bolt11 invoice from LNURL callback
        const bolt11 = await getInvoiceFromLnurl(resolved.callback, amountSats, comment);
        if (!bolt11) {
            return {
                success: false,
                error: 'Failed to get invoice from lightning address'
            };
        }
        
        // Step 4: Pay the invoice using SDK
        return payInvoice(bolt11);
        
    } catch (error) {
        console.error('Lightning address payment failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Payment failed'
        };
    }
};

/**
 * Pay via LNURL-pay string
 * 
 * @param lnurl - LNURL string (lnurl1...)
 * @param amountSats - Amount in satoshis
 */
export const payLnurl = async (
    lnurl: string,
    amountSats: number
): Promise<BreezPaymentResult> => {
    if (!isInitialized || !sdkInstance) {
        return {
            success: false,
            error: 'Breez SDK not initialized'
        };
    }

    try {
        console.log(`⚡ Paying ${amountSats} sats via LNURL`);
        
        // Parse the LNURL
        const lnurlData = await sdkInstance.parseInput(lnurl);
        
        if (!lnurlData || lnurlData.type !== 'lnUrlPay') {
            return {
                success: false,
                error: 'Invalid LNURL'
            };
        }
        
        // Pay via LNURL
        const result = await sdkInstance.lnurlPay({
            data: lnurlData.data,
            amountMsat: amountSats * 1000
        });
        
        return {
            success: true,
            paymentHash: result.data?.paymentHash,
            preimage: result.data?.preimage,
            feeSats: Math.floor((result.data?.feeMsat || 0) / 1000)
        };
    } catch (error) {
        console.error('LNURL payment failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Payment failed'
        };
    }
};

// ============================================================================
// LNURL RESOLUTION
// ============================================================================

/**
 * Resolve a Lightning address to get payment details
 * Works even without full SDK initialization
 * 
 * @param lightningAddress - Address like user@domain.com
 */
export const resolveLightningAddress = async (
    lightningAddress: string
): Promise<{
    callback: string;
    minSendable: number;
    maxSendable: number;
    metadata: string;
} | null> => {
    try {
        const [name, domain] = lightningAddress.split('@');
        if (!name || !domain) {
            throw new Error('Invalid Lightning address format');
        }

        // Fetch LNURL-pay endpoint
        const url = `https://${domain}/.well-known/lnurlp/${name}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to resolve: ${response.status}`);
        }

        const data = await response.json();

        return {
            callback: data.callback,
            minSendable: Math.ceil(data.minSendable / 1000), // Convert msats to sats
            maxSendable: Math.floor(data.maxSendable / 1000),
            metadata: data.metadata
        };
    } catch (error) {
        console.error('Failed to resolve Lightning address:', error);
        return null;
    }
};

/**
 * Get invoice from LNURL callback
 * 
 * @param callback - LNURL callback URL
 * @param amountSats - Amount in satoshis
 * @param comment - Optional comment
 */
export const getInvoiceFromLnurl = async (
    callback: string,
    amountSats: number,
    comment?: string
): Promise<string | null> => {
    try {
        const url = new URL(callback);
        url.searchParams.set('amount', (amountSats * 1000).toString()); // Convert to msats

        if (comment) {
            url.searchParams.set('comment', comment);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`Failed to get invoice: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'ERROR') {
            throw new Error(data.reason || 'LNURL error');
        }

        return data.pr; // Bolt11 invoice
    } catch (error) {
        console.error('Failed to get invoice from LNURL:', error);
        return null;
    }
};

// ============================================================================
// PAYMENT HISTORY
// ============================================================================

/**
 * Get payment history
 */
export const getPaymentHistory = async (): Promise<BreezPayment[]> => {
    if (!isInitialized || !sdkInstance) {
        console.warn('Breez SDK not initialized');
        return [];
    }

    try {
        const payments = await sdkInstance.listPayments({});
        return payments.map((p: any) => ({
            id: p.id || p.paymentHash,
            paymentType: p.paymentType === 'sent' ? 'send' : 'receive',
            amountSats: Math.floor((p.amountMsat || 0) / 1000),
            feeSats: Math.floor((p.feeMsat || 0) / 1000),
            timestamp: p.paymentTime || Date.now() / 1000,
            description: p.description,
            bolt11: p.bolt11,
            preimage: p.preimage,
            status: p.status === 'complete' ? 'complete' : p.status === 'failed' ? 'failed' : 'pending'
        }));
    } catch (error) {
        console.error('Failed to get payment history:', error);
        return [];
    }
};

// ============================================================================
// SYNC & EVENTS
// ============================================================================

/**
 * Sync wallet state
 * Call this when app comes to foreground
 */
export const syncBreez = async (): Promise<void> => {
    if (!isInitialized || !sdkInstance) {
        return;
    }

    try {
        await sdkInstance.sync();
        console.log('🔄 Breez wallet synced');
    } catch (error) {
        console.warn('Failed to sync Breez wallet:', error);
    }
};

/**
 * Subscribe to payment events
 * 
 * @param onPaymentReceived - Callback when payment is received
 * @param onPaymentSent - Callback when payment is sent
 */
export const subscribeToPayments = (
    onPaymentReceived: (payment: BreezPayment) => void,
    onPaymentSent: (payment: BreezPayment) => void
): (() => void) => {
    if (!isInitialized || !sdkInstance) {
        console.warn('Breez SDK not initialized - cannot subscribe to payments');
        return () => { };
    }

    try {
        // Breez SDK uses event listeners
        const listener = {
            onEvent: (event: any) => {
                if (event.type === 'invoicePaid' || event.type === 'paymentSucceeded') {
                    const payment: BreezPayment = {
                        id: event.details?.paymentHash || 'unknown',
                        paymentType: event.type === 'invoicePaid' ? 'receive' : 'send',
                        amountSats: Math.floor((event.details?.amountMsat || 0) / 1000),
                        feeSats: Math.floor((event.details?.feeMsat || 0) / 1000),
                        timestamp: Date.now() / 1000,
                        status: 'complete'
                    };
                    
                    if (payment.paymentType === 'receive') {
                        onPaymentReceived(payment);
                    } else {
                        onPaymentSent(payment);
                    }
                }
            }
        };
        
        sdkInstance.addEventListener(listener);
        
        // Return cleanup function
        return () => {
            try {
                sdkInstance.removeEventListener(listener);
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    } catch (error) {
        console.warn('Failed to subscribe to Breez payments:', error);
        return () => { };
    }
};

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Check if we can use Breez for payments
 * Returns true if SDK is initialized and has balance
 */
export const canUseBreez = async (): Promise<boolean> => {
    if (!isInitialized) {
        return false;
    }

    const balance = await getBreezBalance();
    return balance.balanceSats > 0;
};

/**
 * Format satoshis for display
 */
export const formatSats = (sats: number): string => {
    if (sats >= 1000000) {
        return `${(sats / 1000000).toFixed(2)}M sats`;
    } else if (sats >= 1000) {
        return `${(sats / 1000).toFixed(1)}k sats`;
    }
    return `${sats} sats`;
};

/**
 * Get Breez status for debugging
 */
export const getBreezStatus = (): {
    initialized: boolean;
    lightningAddress: string | null;
} => {
    return {
        initialized: isInitialized,
        lightningAddress: staticLightningAddress
    };
};

// ============================================================================
// WALLET.TSX COMPATIBILITY - Functions required by Wallet.tsx
// ============================================================================

/**
 * Get Spark address (alias for static lightning address)
 * Used by Wallet.tsx for receiving
 */
export const getSparkAddress = async (): Promise<string | null> => {
    return getStaticLightningAddress();
};

/**
 * Get Lightning address info object
 * Returns an object with lightningAddress property for Wallet.tsx compatibility
 */
export const getLightningAddress = async (): Promise<{ lightningAddress: string } | null> => {
    const address = await getStaticLightningAddress();
    if (address) {
        return { lightningAddress: address };
    }
    return null;
};

/**
 * Parse input (bolt11 invoice or lightning address)
 * Used by Wallet.tsx send flow
 */
export const parseInput = async (input: string): Promise<{
    type: 'bolt11Invoice' | 'lightningAddress' | 'unknown';
    amountMsat?: number;
    description?: string;
    address?: string;
} | null> => {
    if (!input) return null;
    
    const trimmed = input.trim().toLowerCase();
    
    // Check for bolt11 invoice
    if (trimmed.startsWith('lnbc') || trimmed.startsWith('lntb') || trimmed.startsWith('lnbcrt')) {
        // TODO: Decode invoice properly when SDK is available
        return {
            type: 'bolt11Invoice',
            amountMsat: undefined, // Would be decoded from invoice
            description: undefined
        };
    }
    
    // Check for lightning address
    if (input.includes('@') && !trimmed.startsWith('lnurl')) {
        return {
            type: 'lightningAddress',
            address: input.trim()
        };
    }
    
    // LNURL or other formats
    if (trimmed.startsWith('lnurl')) {
        // TODO: Handle LNURL when SDK is available
        return {
            type: 'unknown'
        };
    }
    
    return null;
};

/**
 * Prepare a send payment (get fee estimates, etc.)
 * Used by Wallet.tsx before executing payment
 */
export const prepareSendPayment = async (input: string): Promise<{
    paymentMethod: {
        type: string;
        lightningFeeSats: number;
    };
    bolt11?: string;
    amountSats?: number;
} | null> => {
    if (!isInitialized || !sdkInstance) {
        console.warn('Breez SDK not initialized');
        return null;
    }
    
    try {
        // Parse the input to determine type
        const parsed = await sdkInstance.parseInput(input);
        
        if (!parsed) {
            return null;
        }
        
        if (parsed.type === 'bolt11') {
            // For bolt11 invoices, we can estimate fees
            const amountMsat = parsed.invoice?.amountMsat || 0;
            return {
                paymentMethod: {
                    type: 'bolt11Invoice',
                    lightningFeeSats: Math.ceil(amountMsat / 1000 * 0.01) // ~1% fee estimate
                },
                bolt11: input,
                amountSats: Math.floor(amountMsat / 1000)
            };
        }
        
        if (parsed.type === 'lnUrlPay') {
            return {
                paymentMethod: {
                    type: 'lightningAddress',
                    lightningFeeSats: 1 // Minimal fee estimate for LNURL
                }
            };
        }
        
        return null;
    } catch (error) {
        console.error('Failed to prepare send payment:', error);
        return null;
    }
};

/**
 * Send a prepared payment
 * Used by Wallet.tsx after prepareSendPayment
 */
export const sendPayment = async (preparedPayment: any): Promise<BreezPaymentResult> => {
    if (!isInitialized || !sdkInstance) {
        return {
            success: false,
            error: 'Breez SDK not initialized'
        };
    }
    
    try {
        console.log('⚡ Sending prepared payment:', preparedPayment);
        
        // If it's a bolt11 invoice
        if (preparedPayment.bolt11) {
            return payInvoice(preparedPayment.bolt11);
        }
        
        // If it's a lightning address with amount
        if (preparedPayment.lightningAddress && preparedPayment.amountSats) {
            return payLightningAddress(
                preparedPayment.lightningAddress, 
                preparedPayment.amountSats,
                preparedPayment.comment
            );
        }
        
        return {
            success: false,
            error: 'Invalid prepared payment format'
        };
    } catch (error) {
        console.error('Send payment failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Payment failed'
        };
    }
};

/**
 * Register a Lightning address for a pubkey
 * Used by Finalization.tsx during onboarding
 * 
 * This function now properly registers the address with Breez backend
 * using the SDK's registerLightningAddress method.
 * 
 * @param pubkey - User's public key (used to derive preferred address from stored mnemonic)
 * @returns The registered Lightning Address, or null if registration fails
 */
export const registerLightningAddress = async (pubkey: string): Promise<{ lightningAddress: string } | null> => {
    // Generate preferred address from mnemonic if available
    const preferredAddress = storedMnemonic 
        ? generateCustomLightningAddress(storedMnemonic) 
        : undefined;
    
    // Use the new Breez backend registration function
    const result = await registerLightningAddressWithBreez(preferredAddress);
    
    if (result) {
        console.log('⚡ Successfully registered Lightning address with Breez:', result.lightningAddress);
        return result;
    }
    
    // Fallback: If SDK not initialized but we have a cached address, return it
    // Note: This address may not be functional until properly registered
    if (staticLightningAddress) {
        console.warn('⚠️ Returning cached address (may not be registered):', staticLightningAddress);
        return { lightningAddress: staticLightningAddress };
    }
    
    console.warn('⚡ Lightning address registration failed - SDK not initialized');
    return null;
};

