
import { CashuMint, CashuWallet, Proof, getDecodedToken } from '@cashu/cashu-ts';

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
    private mintUrl: string;

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
    async payInvoice(invoice: string, proofs: Proof[]): Promise<{ remaining: Proof[], paid: boolean }> {
        try {
            // Check fee
            const quote = await this.wallet.createMeltQuote(invoice);
            
            // Pay
            // In cashu-ts v2, meltTokens is renamed to meltProofs
            const { isPaid, change } = await this.wallet.meltProofs(quote, proofs);
            
            if (!isPaid) throw new Error("Payment failed at mint");

            return {
                remaining: change,
                paid: true
            };
        } catch (e) {
            console.error("Melt failed", e);
            throw e;
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
}
