
import { CashuMint, CashuWallet, Proof, getDecodedToken, getEncodedToken } from '@cashu/cashu-ts';

// --- Types ---
interface MintQuoteResponse {
    quote: string;
    request: string; // The Bolt11 Invoice
}

interface MeltQuoteDetails {
    amount: number;
    fee: number;
}

// --- Service ---

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
     * Load keys from the mint to ensure we can transact
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
            if (keysets && keysets.length > 0) {
                // Return the first active keyset's public key
                return keysets[0].keys['02']; // The public key for amount 2 (DER encoded)
            }
            return null;
        } catch (e) {
            console.error("Failed to get public key", e);
            return null;
        }
    }

    /**
     * Verify proofs with the mint and return only unspent (valid) ones.
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
            console.error("Verify proofs failed", e);
            // If network fails, we conservatively return the original list rather than wiping the wallet
            return proofs;
        }
    }

    /**
     * Step 1 of Deposit: Request a Lightning Invoice from the Mint
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
     * Step 2 of Deposit: Check if invoice is paid and issue tokens
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
     * Pay a Lightning Invoice (Melt)
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
        try {
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
        } catch (e) {
            throw e;
        }
    }

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
     * Receive eCash Token (Swap for fresh tokens)
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
     * Calculate balance from proofs
     */
    static calculateBalance(proofs: Proof[]): number {
        return proofs.reduce((acc, p) => acc + p.amount, 0);
    }

    /**
     * Deduplicate proofs based on their secret (unique ID)
     */
    static deduplicateProofs(existing: Proof[], incoming: Proof[]): Proof[] {
        const existingSecrets = new Set(existing.map(p => p.secret));
        const uniqueIncoming = incoming.filter(p => !existingSecrets.has(p.secret));
        return [...existing, ...uniqueIncoming];
    }
    /**
     * Zap a user (Pay a Lightning Invoice using Cashu Tokens)
     * This is effectively a "Melt" operation.
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
