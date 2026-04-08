/**
 * @file invoiceValidation.ts
 * @description Pure validation core for Lightning bolt11 invoice input.
 *
 * Extracted from Wallet.tsx so the input parsing + balance check can be tested
 * without rendering. The debounce timer and React state setters stay in the
 * component; this module is the math.
 */

export interface InvoiceValidationResult {
  /** True if the input is recognized as a bolt11 invoice (case-insensitive `lnbc` prefix). */
  isLightningInvoice: boolean;
  /** Decoded amount in sats, or null if not a recognized invoice or quote failed. */
  amount: number | null;
  /** Fee in sats from the lightning quote, or null. */
  fee: number | null;
  /** True when balance ≥ amount + fee. False if not an invoice or insufficient. */
  isSufficient: boolean;
}

/**
 * Parse and validate a Lightning bolt11 invoice input string.
 *
 * @param input - The user's send-input string. Trimmed elsewhere.
 * @param walletBalance - Current wallet balance in sats.
 * @param getLightningQuote - Injected dependency that returns `{ amount, fee }`
 *   for a bolt11 invoice. Tests pass a fake; the component passes the
 *   AppContext-provided helper.
 */
export async function parseAndValidateInvoice(
  input: string,
  walletBalance: number,
  getLightningQuote: (invoice: string) => Promise<{ amount: number; fee: number }>,
): Promise<InvoiceValidationResult> {
  if (!input || !input.toLowerCase().startsWith('lnbc')) {
    return { isLightningInvoice: false, amount: null, fee: null, isSufficient: false };
  }

  try {
    const { amount, fee } = await getLightningQuote(input);
    return {
      isLightningInvoice: true,
      amount,
      fee,
      isSufficient: walletBalance >= amount + fee,
    };
  } catch {
    return { isLightningInvoice: true, amount: null, fee: null, isSufficient: false };
  }
}
