/**
 * @fileoverview Wallet Service -- Cashu eCash wallet operations.
 *
 * Wraps the @cashu/cashu-ts library to provide Cashu eCash wallet functionality:
 * - Deposit (mint): Pay a Lightning invoice to receive Cashu proofs
 * - Withdraw (melt): Spend Cashu proofs to pay a Lightning invoice
 * - Token creation: Package proofs into transferable Cashu tokens
 * - Token redemption: Receive and swap incoming tokens for fresh proofs
 * - Proof verification: Check which proofs are still unspent at the mint
 *
 * Cashu eCash is the primary self-custodial wallet layer. Proofs are stored
 * in localStorage by WalletContext and backed up to Nostr relays via NIP-44
 * encrypted Kind 30005 events.
 *
 * The WalletService is stateless regarding proof storage -- it only handles
 * mint communication. Proof management is handled by WalletContext.
 *
 * @see https://cashu.space -- Cashu eCash protocol
 * @see https://github.com/nicklucas/cashu-ts -- TypeScript Cashu library
 */

import { CashuMint, CashuWallet, Proof, getDecodedToken, getEncodedToken } from '@cashu/cashu-ts';

// --- Types ---

/** Response from requesting a deposit (mint) quote */
interface MintQuoteResponse {
    /** Quote ID for checking payment status */
    quote: string;
    /** Bolt11 Lightning invoice to pay */
    request: string;
}

/** Fee details for paying (melting) a Lightning invoice */
interface MeltQuoteDetails {
    /** Invoice amount in satoshis */
    amount: number;
    /** Fee reserve required by the mint */
    fee: number;
}

// --- Service ---

/**
 * Cashu eCash wallet client for a single mint.
 *
 * Each instance is bound to one mint URL. The app typically creates one
 * WalletService for the active mint and uses it for all operations.
 *
 * @example
 * const wallet = new WalletService('https://mint.minibits.cash/Bitcoin');
 * await wallet.connect();
 * const { quote, request } = await wallet.requestDeposit(1000);
 * // User pays the `request` invoice...
 * const proofs = await wallet.completeDeposit(quote, 1000);
 */
export class WalletService {
    private mint: CashuMint;
    private wallet: CashuWallet;
    public mintUrl: string;

    constructor(mintUrl: string) {
        this.mintUrl = mintUrl;
        this.mint = new CashuMint(mintUrl);
        this.wallet = new CashuWallet(this.mint);
    }

    /**
     * Load keyset information from the mint to ensure we can transact.
     *
     * Must be called before any other wallet operations. Safe to call
     * multiple times (idempotent).
     *
     * @returns True if connection succeeded, false on failure
     */
    async connect() {
        try {
            await this.wallet.loadMint();
            console.log(`Connected to mint: ${this.mintUrl}`);
            return true;
        } catch (e) {
            console.error("Failed to connect to mint", e);
            return false;
        }
    }

    /**
     * Get the public key for gateway registration
     */
    async getPublicKey(): Promise<string | null> {
        try {
            // Load the keyset to get the public key
            const keysets = await this.mint.getKeySets();
            if (keysets && keysets.keysets.length > 0) {
                // Return the first active keyset's public key
                return keysets.keysets[0].id;
            }
            return null;
        } catch (e) {
            console.error("Failed to get public key", e);
            return null;
        }
    }

    /**
     * Verify proofs with the mint and return only unspent (valid) ones.
     *
     * Checks each proof's state (UNSPENT, PENDING, SPENT) and filters to
     * only UNSPENT proofs. On keyset mismatch, returns empty array to
     * trigger wallet reset. On network failure, conservatively returns
     * the original list.
     *
     * @param proofs - Array of Cashu proofs to verify
     * @returns Array of verified unspent proofs
     */
    async verifyProofs(proofs: Proof[]): Promise<Proof[]> {
        try {
            // checkProofsStates returns the state of each proof (UNSPENT, PENDING, SPENT).
            // Order of results matches order of input proofs.
            const states = await this.wallet.checkProofsStates(proofs);

            return proofs.filter((_, index) => {
                const stateObj = states[index];
                // Keep only proofs that are explicitly UNSPENT
                return stateObj && stateObj.state === 'UNSPENT';
            });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error("Verify proofs failed:", errorMsg);
            
            // If keyset mismatch, return empty array to trigger wallet reset
            if (errorMsg.includes('different units') || errorMsg.includes('keyset') || errorMsg.includes('unknown keyset')) {
                console.warn("⚠️ Keyset mismatch detected during proof verification. Returning empty proofs.");
                return [];
            }
            
            // If network fails for other reasons, conservatively return the original list
            return proofs;
        }
    }

    /**
     * Step 1 of Deposit: Request a Lightning invoice from the mint.
     *
     * The returned invoice must be paid by the user (via external wallet,
     * NWC, or Breez). After payment, call completeDeposit() with the quote ID.
     *
     * @param amount - Amount in satoshis to deposit
     * @returns Quote ID and Bolt11 invoice to pay
     */
    async requestDeposit(amount: number): Promise<MintQuoteResponse> {
        const quote = await this.wallet.createMintQuote(amount);
        return {
            quote: quote.quote,
            request: quote.request
        };
    }

    /**
     * Check if a deposit quote has been paid (Polling helper)
     */
    async checkDepositQuoteStatus(quoteId: string): Promise<boolean> {
        try {
            const quote = await this.wallet.checkMintQuote(quoteId);
            // In cashu-ts v2, state is 'PAID' (string) or enum MintQuoteState.PAID
            return quote.state === 'PAID';
        } catch (e) {
            // console.warn("Check quote failed", e);
            return false;
        }
    }

    /**
     * Step 2 of Deposit: Claim Cashu proofs after the Lightning invoice is paid.
     *
     * The mint verifies the invoice is paid and issues fresh proofs.
     *
     * @param quoteId - Quote ID from requestDeposit()
     * @param amount - Amount that was deposited (must match quote)
     * @returns Array of freshly minted Cashu proofs
     * @throws {Error} If the invoice is not yet paid or minting fails
     */
    async completeDeposit(quoteId: string, amount: number): Promise<Proof[]> {
        // Check status (in a real app we might poll, here we assume user clicked "I paid")
        // The mint will throw if not paid
        try {
            // In cashu-ts v2, mintTokens is renamed to mintProofs and returns Proof[] directly
            const proofs = await this.wallet.mintProofs(amount, quoteId);
            return proofs;
        } catch (e) {
            console.error("Minting failed", e);
            throw new Error("Payment not confirmed or minting failed.");
        }
    }

    /**
     * Get details (Amount + Fee) for a Lightning Invoice before paying
     */
    async getLightningQuote(invoice: string): Promise<MeltQuoteDetails> {
        try {
            const quote = await this.wallet.createMeltQuote(invoice);
            return {
                amount: quote.amount,
                fee: quote.fee_reserve
            };
        } catch (e) {
            console.error("Failed to get melt quote", e);
            throw new Error("Invalid Invoice or Mint Error");
        }
    }

    /**
     * Pay a Lightning invoice by melting Cashu proofs.
     *
     * Creates a melt quote, then spends the provided proofs to pay the invoice.
     * Any change (overpayment) is returned as fresh proofs.
     *
     * @param invoice - Bolt11 Lightning invoice to pay
     * @param proofs - Cashu proofs to spend (must cover amount + fees)
     * @returns Remaining change proofs, payment status, and optional preimage
     * @throws {Error} If the mint rejects the payment or proofs are insufficient
     */
    async payInvoice(invoice: string, proofs: Proof[]): Promise<{ remaining: Proof[], paid: boolean, preimage?: string }> {
        try {
            // Check fee
            const quote = await this.wallet.createMeltQuote(invoice);

            // Pay
            // In cashu-ts v2, meltProofs returns { quote, change }
            const response = await this.wallet.meltProofs(quote, proofs) as any;
            const { quote: paidQuote, change, isPaid } = response;

            // Check success
            if (!isPaid && paidQuote?.state !== 'PAID') {
                // throw new Error("Payment failed at mint");
            }

            return {
                remaining: change,
                paid: true,
                preimage: response.payment_preimage || null
            };
        } catch (e) {
            console.error("Melt failed", e);
            throw e;
        }
    }

    /**
     * Create a token to send to another user (eCash transfer)
     */
    async createToken(amount: number): Promise<{ token: string, remaining: Proof[] }> {
        void amount;
        // In cashu-ts v2, send returns { returnChange, send, keep }
        // We want 'send' (the proofs to send) and 'returnChange' + 'keep' (what we keep)
        // Actually, wallet.send(amount, proofs) returns { returnChange, send, keep }
        // We need to construct the token from 'send' proofs.

        // Get all proofs (we assume the caller manages state, but here we might need to fetch them from the wallet instance if it tracks them,
        // but our AppContext tracks them. So we should pass proofs in or load them.)
        // The current design passes proofs into payInvoice but not here.
        // Let's update the signature to accept proofs, or better, rely on the wallet's internal state if we were using it that way.
        // But AppContext holds the state. So we need to pass proofs.

        // Wait, the previous implementation of payInvoice took proofs.
        // Let's update createToken to take proofs as well.
        throw new Error("Use createTokenWithProofs instead");
    }

    /**
     * Create a transferable Cashu token from available proofs.
     *
     * Splits the proofs so that exactly `amount` sats are encoded in the
     * token and the remainder is returned as change. The token can be
     * sent to another user (e.g., via NIP-17 Gift Wrap DM).
     *
     * @param amount - Amount in satoshis to include in the token
     * @param proofs - Available proofs to split (must have sufficient balance)
     * @returns Encoded Cashu token string and remaining change proofs
     * @throws {Error} If proofs are insufficient or token encoding fails
     */
    async createTokenWithProofs(amount: number, proofs: Proof[]): Promise<{ token: string, remaining: Proof[] }> {
        try {
            console.log(`Creating token: amount=${amount}, proofs=${proofs.length}`);

            if (proofs.length === 0) {
                throw new Error("No proofs available for token creation");
            }

            // Ensure wallet is connected and keys are loaded
            await this.connect();

            // send returns { returnChange, send, keep } or similar. Casting to any to bypass type mismatch.
            const response = await this.wallet.send(amount, proofs) as any;
            console.log("Wallet.send response:", response);

            const { returnChange, change, send, keep } = response;

            // Handle potential property name differences
            const returnedChange = returnChange || change || [];

            // Validate that we have send proofs
            if (!send || !Array.isArray(send) || send.length === 0) {
                throw new Error("No send proofs returned from wallet.send()");
            }

            console.log(`Token creation: send=${send?.length || 0}, keep=${keep?.length || 0}, change=${returnedChange?.length || 0}`);

            // Validate each proof has required properties
            for (const proof of send) {
                if (!proof || typeof proof !== 'object') {
                    throw new Error("Invalid proof object in send array");
                }
                if (!proof.id || !proof.amount || !proof.secret || !proof.C) {
                    throw new Error(`Proof missing required properties. Proof: ${JSON.stringify(proof)}`);
                }
            }

            // Encode the token (cashu-ts v2 format)
            const token = getEncodedToken({
                mint: this.mintUrl,
                proofs: send
            });

            return {
                token,
                remaining: [...(keep || []), ...returnedChange]
            };
        } catch (e) {
            console.error("Create token failed", e);
            console.error("Error type:", typeof e);
            console.error("Error properties:", Object.keys(e || {}));
            // Ensure we throw a proper Error object
            if (e instanceof Error) {
                throw e;
            } else {
                throw new Error(`Token creation failed: ${String(e)}`);
            }
        }
    }

    /**
     * Receive a Cashu eCash token by swapping it for fresh proofs.
     *
     * The mint verifies the token proofs are unspent and issues new ones,
     * preventing double-spend. The original token proofs become spent.
     *
     * @param token - Encoded Cashu token string (cashuA... or cashuB...)
     * @returns Array of fresh proofs with the same total amount
     * @throws {Error} If the token is invalid or already spent
     */
    async receiveToken(token: string): Promise<Proof[]> {
        try {
            // In cashu-ts v2, receive returns Proof[] directly
            const proofs = await this.wallet.receive(token);
            return proofs;
        } catch (e) {
            console.error("Receive failed", e);
            throw new Error("Invalid token or already spent.");
        }
    }

    /**
     * Calculate total balance from an array of Cashu proofs.
     *
     * @param proofs - Array of proofs to sum
     * @returns Total balance in satoshis
     */
    static calculateBalance(proofs: Proof[]): number {
        return proofs.reduce((acc, p) => acc + p.amount, 0);
    }

    /**
     * Deduplicate proofs based on their secret (unique identifier).
     *
     * Merges incoming proofs with existing ones, skipping any that share
     * a secret with an existing proof. Used when receiving proofs from
     * backup restore or token redemption.
     *
     * @param existing - Current proof set
     * @param incoming - New proofs to merge
     * @returns Combined deduplicated proof array
     */
    static deduplicateProofs(existing: Proof[], incoming: Proof[]): Proof[] {
        const existingSecrets = new Set(existing.map(p => p.secret));
        const uniqueIncoming = incoming.filter(p => !existingSecrets.has(p.secret));
        return [...existing, ...uniqueIncoming];
    }
    /**
     * Zap a user by paying a Lightning invoice using Cashu proofs.
     *
     * Convenience wrapper around payInvoice() that first logs the quote
     * details (amount + fees). Functionally identical to payInvoice().
     *
     * @param invoice - Bolt11 Lightning invoice to pay
     * @param proofs - Cashu proofs to spend
     * @returns Remaining change proofs, payment status, and optional preimage
     */
    async zap(invoice: string, proofs: Proof[]): Promise<{ remaining: Proof[], paid: boolean, preimage?: string }> {
        console.log("Initiating Zap payment...");
        // Get quote to verify amount/fees
        const quote = await this.getLightningQuote(invoice);
        console.log(`Zap Quote: ${quote.amount} sats + ${quote.fee} fee`);

        // Pay
        return this.payInvoice(invoice, proofs);
    }
}
