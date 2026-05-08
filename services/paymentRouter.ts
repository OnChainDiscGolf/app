/**
 * @fileoverview Payment Router Service -- Smart 4-tier payment routing for round settlements.
 *
 * Implements a cascading payment strategy that tries multiple methods to ensure
 * payouts reach recipients regardless of their wallet setup:
 *
 * **Priority Order:**
 * 1. **Breez SDK** (self-custodial Lightning) -- If initialized with sufficient balance
 * 2. **LNURL via lud16** -- Resolve recipient's Kind 0 profile Lightning address
 * 3. **npub.cash fallback** -- Use `npub@npubx.cash` if no lud16 in profile
 * 4. **Cashu DM** -- Send eCash token via NIP-17 Gift Wrap as last resort
 *
 * The router also provides:
 * - LNURL resolution (independent of Breez SDK)
 * - Bolt11 invoice generation from LNURL callbacks
 * - Batch payout processing with progress callbacks
 * - Lightning address validation
 * - Payment method display formatting
 *
 * @see breezService.ts -- Tier 1: Self-custodial Lightning
 * @see walletService.ts -- Tier 2/3: Cashu melt for LNURL/npub.cash invoices
 * @see giftWrapService.ts -- Tier 4: Cashu token via encrypted DM
 */

import { fetchProfile, sendGiftWrap, getMagicLightningAddress } from './nostrService';
import { 
    isBreezInitialized,
    getBreezBalance,
    payLightningAddress as breezPayLightningAddress,
    payInvoice as breezPayInvoice
} from './breezService';
import { nip19 } from 'nostr-tools';

// =============================================================================
// LNURL RESOLUTION (Works independently of Breez SDK)
// =============================================================================

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

// =============================================================================
// TYPES
// =============================================================================

/** Result of a payment attempt, including which method succeeded or why it failed */
export interface PaymentResult {
    /** Whether the payment was successfully delivered */
    success: boolean;
    /** Which payment method was used (or 'failed' if all methods exhausted) */
    method: 'breez' | 'lnurl' | 'npubcash' | 'cashu_dm' | 'failed';
    /** Transaction ID or payment hash (if available) */
    txId?: string;
    /** Routing fee paid in satoshis (if available) */
    feeSats?: number;
    /** Error message if payment failed */
    error?: string;
    /**
     * True when the recipient must take a manual action to claim funds (e.g.,
     * `cashu_dm` sends an eCash token via Gift Wrap that the recipient has to
     * import). The host should be warned so they don't assume delivery is final.
     */
    requiresManualClaim?: boolean;
}

/** A recipient in a batch payout (e.g., round settlement) */
export interface PayoutRecipient {
    /** Recipient's Nostr public key (hex) */
    pubkey: string;
    /** Amount to pay in satoshis */
    amountSats: number;
    /** Display name for logging/UI */
    name?: string;
}

// =============================================================================
// LNURL RESOLUTION (Works without Breez SDK)
// =============================================================================

/**
 * Resolve a Lightning address and get a payment invoice
 * This works independently of Breez SDK
 */
export const resolveAndGetInvoice = async (
    lightningAddress: string,
    amountSats: number,
    comment?: string
): Promise<string | null> => {
    try {
        // Step 1: Resolve the Lightning address
        const resolved = await resolveLightningAddress(lightningAddress);
        if (!resolved) {
            console.warn(`Failed to resolve Lightning address: ${lightningAddress}`);
            return null;
        }

        // Step 2: Check amount bounds
        if (amountSats < resolved.minSendable) {
            console.warn(`Amount ${amountSats} below minimum ${resolved.minSendable}`);
            return null;
        }
        if (amountSats > resolved.maxSendable) {
            console.warn(`Amount ${amountSats} above maximum ${resolved.maxSendable}`);
            return null;
        }

        // Step 3: Get invoice from callback
        const invoice = await getInvoiceFromLnurl(resolved.callback, amountSats, comment);
        return invoice;

    } catch (error) {
        console.error('Error resolving Lightning address:', error);
        return null;
    }
};

/**
 * Get the Lightning address for a recipient
 * Priority: kind 0 lud16 → npub@npub.cash fallback
 */
export const getRecipientLightningAddress = async (pubkey: string): Promise<{
    address: string;
    source: 'kind0' | 'npubcash';
}> => {
    try {
        // Try to fetch their profile
        const profile = await fetchProfile(pubkey);

        if (profile?.lud16 && profile.lud16.includes('@')) {
            console.log(`Found lud16 in kind 0: ${profile.lud16}`);
            return {
                address: profile.lud16,
                source: 'kind0'
            };
        }

        // Fallback to npub.cash
        const npub = nip19.npubEncode(pubkey);
        const fallbackAddress = `${npub}@npubx.cash`;
        console.log(`No lud16 found, using fallback: ${fallbackAddress}`);

        return {
            address: fallbackAddress,
            source: 'npubcash'
        };

    } catch (error) {
        console.error('Error getting recipient Lightning address:', error);
        // Final fallback
        const npub = nip19.npubEncode(pubkey);
        return {
            address: `${npub}@npubx.cash`,
            source: 'npubcash'
        };
    }
};

// =============================================================================
// PAYMENT METHODS
// =============================================================================

/**
 * Pay via Breez SDK (when available)
 * Primary method when SDK is initialized and has balance
 */
const payViaBreez = async (
    lightningAddress: string,
    amountSats: number,
    comment?: string
): Promise<PaymentResult> => {
    if (!isBreezInitialized()) {
        return {
            success: false,
            method: 'breez',
            error: 'Breez SDK not initialized'
        };
    }

    const balance = await getBreezBalance();
    if (balance.balanceSats < amountSats) {
        return {
            success: false,
            method: 'breez',
            error: `Insufficient Breez balance: ${balance.balanceSats} < ${amountSats}`
        };
    }

    const result = await breezPayLightningAddress(lightningAddress, amountSats, comment);

    return {
        success: result.success,
        method: 'breez',
        txId: result.paymentHash,
        feeSats: result.feeSats,
        error: result.error
    };
};

/**
 * Pay via Cashu → Lightning (current method)
 * Uses the existing CashuWallet melt functionality
 */
const payViaCashu = async (
    invoice: string,
    cashuPaymentFn: (invoice: string) => Promise<boolean>
): Promise<PaymentResult> => {
    try {
        const success = await cashuPaymentFn(invoice);
        return {
            success,
            method: 'lnurl',
            error: success ? undefined : 'Cashu payment failed'
        };
    } catch (error) {
        return {
            success: false,
            method: 'lnurl',
            error: error instanceof Error ? error.message : 'Cashu payment failed'
        };
    }
};

/**
 * Send Cashu token via Gift Wrap DM
 * Last resort fallback when Lightning fails
 */
const sendCashuViaDm = async (
    recipientPubkey: string,
    amountSats: number,
    cashuToken: string
): Promise<PaymentResult> => {
    try {
        const message = JSON.stringify({
            type: 'cashu_payment',
            amount: amountSats,
            token: cashuToken,
            message: `You received ${amountSats} sats from an On-Chain Disc Golf round!`
        });

        await sendGiftWrap(recipientPubkey, message);

        return {
            success: true,
            method: 'cashu_dm'
        };
    } catch (error) {
        return {
            success: false,
            method: 'cashu_dm',
            error: error instanceof Error ? error.message : 'Failed to send Cashu via DM'
        };
    }
};

// =============================================================================
// MAIN PAYMENT ROUTER
// =============================================================================

/**
 * Route a payment to a recipient.
 *
 * Outgoing payment policy:
 * - If Breez SDK is initialized AND has sufficient balance, **all** outgoing
 *   payments go through Breez. This is independent of the host's `walletMode`
 *   (which only governs which wallet generates *receive* invoices). If Breez is
 *   funded but the payment still fails, we surface the failure rather than
 *   silently falling back to Cashu — the host can retry.
 * - If Breez is unavailable or unfunded, fall back to the legacy Cashu→LNURL
 *   melt path via the supplied `cashuPaymentFn` (which respects walletMode).
 * - As an absolute last resort, send a Cashu token via NIP-17 Gift Wrap. This
 *   path is marked `requiresManualClaim` so the host knows the recipient must
 *   take action.
 *
 * @param recipient - Recipient details (pubkey, amount)
 * @param cashuPaymentFn - Function to execute Cashu → Lightning payment (legacy fallback)
 * @param createCashuTokenFn - Function to create Cashu token for DM fallback
 */
export const routePayment = async (
    recipient: PayoutRecipient,
    cashuPaymentFn: (invoice: string) => Promise<boolean>,
    createCashuTokenFn?: (amount: number) => Promise<string>
): Promise<PaymentResult> => {
    console.log(`🔀 Routing payment of ${recipient.amountSats} sats to ${recipient.name || recipient.pubkey.substring(0, 8)}...`);

    // Step 1: Get recipient's Lightning address
    const { address, source } = await getRecipientLightningAddress(recipient.pubkey);
    console.log(`📍 Lightning address: ${address} (source: ${source})`);

    const comment = `On-Chain Disc Golf payout to ${recipient.name || 'player'}`;

    // -------------------------------------------------------------------------
    // Step 2: Breez is the primary outgoing rail when initialized AND funded.
    // -------------------------------------------------------------------------
    if (isBreezInitialized()) {
        const balance = await getBreezBalance();

        if (balance.balanceSats >= recipient.amountSats) {
            console.log(`⚡ Breez funded (${balance.balanceSats} sats) — attempting Breez payment...`);

            // 2a: Try Breez's built-in lightning-address pay path.
            const breezResult = await payViaBreez(address, recipient.amountSats, comment);
            if (breezResult.success) {
                console.log('✅ Breez payment successful!');
                return breezResult;
            }
            console.log(`⚠️ Breez direct pay failed: ${breezResult.error}. Retrying via LNURL → Breez payInvoice...`);

            // 2b: Some lightning addresses (notably npub.cash) need manual LNURL
            // resolution before Breez can pay. Resolve invoice ourselves, then
            // pay it through Breez. This still uses Breez funds — never Cashu.
            const invoice = await resolveAndGetInvoice(address, recipient.amountSats, comment);
            if (invoice) {
                const result = await breezPayInvoice(invoice);
                if (result.success) {
                    console.log('✅ Breez (LNURL invoice) payment successful!');
                    return {
                        success: true,
                        method: 'breez',
                        txId: result.paymentHash,
                        feeSats: result.feeSats
                    };
                }
                console.log(`⚠️ Breez payInvoice failed: ${result.error}`);
            } else {
                console.log('⚠️ LNURL invoice resolution failed.');
            }

            // Breez was funded but every Breez attempt failed. Do NOT silently
            // fall through to Cashu — the host should know and retry.
            return {
                success: false,
                method: 'breez',
                error: breezResult.error || 'Breez payment failed (LNURL resolution or invoice payment)'
            };
        }

        console.log(`⚠️ Breez initialized but underfunded (${balance.balanceSats} < ${recipient.amountSats}) — falling back to Cashu paths.`);
    } else {
        console.log('⚠️ Breez SDK not initialized — falling back to Cashu paths.');
    }

    // -------------------------------------------------------------------------
    // Step 3: Legacy Cashu → LNURL melt fallback. Only reached if Breez is
    // unavailable or unfunded. Honors the host's walletMode via cashuPaymentFn.
    // -------------------------------------------------------------------------
    console.log('⚡ Attempting LNURL payment via fallback wallet...');
    const fallbackInvoice = await resolveAndGetInvoice(
        address,
        recipient.amountSats,
        comment
    );

    if (fallbackInvoice) {
        const cashuResult = await payViaCashu(fallbackInvoice, cashuPaymentFn);
        if (cashuResult.success) {
            console.log('✅ Fallback LNURL payment successful!');
            return {
                ...cashuResult,
                method: source === 'kind0' ? 'lnurl' : 'npubcash'
            };
        }
        console.log(`⚠️ Fallback LNURL payment failed: ${cashuResult.error}`);
    }

    // -------------------------------------------------------------------------
    // Step 4: Last-resort Cashu DM. Marked requiresManualClaim so the host
    // sees a clear warning instead of treating it as a normal payout.
    // -------------------------------------------------------------------------
    if (createCashuTokenFn) {
        console.log('📨 Falling back to Cashu DM (recipient must manually claim)...');
        try {
            const token = await createCashuTokenFn(recipient.amountSats);
            const dmResult = await sendCashuViaDm(recipient.pubkey, recipient.amountSats, token);

            if (dmResult.success) {
                console.log('⚠️ Cashu DM sent — recipient must claim manually.');
                return { ...dmResult, requiresManualClaim: true };
            }
        } catch (error) {
            console.error('Failed to create Cashu token for DM:', error);
        }
    }

    // All methods failed
    console.error('❌ All payment methods failed');
    return {
        success: false,
        method: 'failed',
        error: 'All payment methods failed'
    };
};

/**
 * Process multiple payouts in batch
 * 
 * @param recipients - Array of payout recipients
 * @param cashuPaymentFn - Function to execute Cashu payments
 * @param createCashuTokenFn - Function to create Cashu tokens
 * @param onProgress - Callback for progress updates
 */
export const processPayouts = async (
    recipients: PayoutRecipient[],
    cashuPaymentFn: (invoice: string) => Promise<boolean>,
    createCashuTokenFn?: (amount: number) => Promise<string>,
    onProgress?: (completed: number, total: number, current: PayoutRecipient) => void
): Promise<{
    results: Map<string, PaymentResult>;
    successCount: number;
    failCount: number;
    totalPaid: number;
}> => {
    const results = new Map<string, PaymentResult>();
    let successCount = 0;
    let failCount = 0;
    let totalPaid = 0;

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        // Progress callback
        if (onProgress) {
            onProgress(i, recipients.length, recipient);
        }

        // Route the payment
        const result = await routePayment(
            recipient,
            cashuPaymentFn,
            createCashuTokenFn
        );

        results.set(recipient.pubkey, result);

        if (result.success) {
            successCount++;
            totalPaid += recipient.amountSats;
        } else {
            failCount++;
        }

        // Small delay between payments to avoid rate limiting
        if (i < recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`📊 Payout summary: ${successCount}/${recipients.length} successful, ${totalPaid} sats paid`);

    return {
        results,
        successCount,
        failCount,
        totalPaid
    };
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a Lightning address is valid/reachable
 */
export const validateLightningAddress = async (address: string): Promise<boolean> => {
    try {
        const resolved = await resolveLightningAddress(address);
        return resolved !== null;
    } catch {
        return false;
    }
};

/**
 * Format payment method for display
 */
export const formatPaymentMethod = (method: PaymentResult['method']): string => {
    switch (method) {
        case 'breez':
            return 'Lightning (Breez)';
        case 'lnurl':
            return 'Lightning (Fallback Wallet)';
        case 'npubcash':
            return 'Lightning (npub.cash)';
        case 'cashu_dm':
            return 'eCash DM (Manual Claim)';
        case 'failed':
            return 'Failed';
        default:
            return 'Unknown';
    }
};

/**
 * Get icon for payment method (for UI)
 */
export const getPaymentMethodIcon = (method: PaymentResult['method']): string => {
    switch (method) {
        case 'breez':
        case 'lnurl':
        case 'npubcash':
            return '⚡';
        case 'cashu_dm':
            return '📨';
        case 'failed':
            return '❌';
        default:
            return '❓';
    }
};

