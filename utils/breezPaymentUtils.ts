/**
 * @file breezPaymentUtils.ts
 * @description Pure helpers for Breez send/receive flows.
 *
 * Extracted from Wallet.tsx so the input-validation and parse/prepare orchestration
 * can be tested without rendering or hitting the Breez SDK. The Wallet component
 * still owns all React state; this module is the math.
 */

/** Subset of breezService.parseInput's return shape that we care about. */
export interface ParsedBreezInput {
  type: 'bolt11Invoice' | 'lightningAddress' | 'unknown';
  amountMsat?: number;
  description?: string;
  address?: string;
}

/** Subset of breezService.prepareSendPayment's return shape that we care about. */
export interface PreparedBreezPayment {
  paymentMethod: {
    type: string;
    lightningFeeSats: number;
  };
  bolt11?: string;
  amountSats?: number;
}

export interface BreezSendPreparation {
  parsed: ParsedBreezInput;
  prepared: PreparedBreezPayment | null;
  feeSats: number | null;
}

/**
 * Validate a string as a positive integer sat amount for Breez invoice creation.
 *
 * Rejects: empty, non-numeric, zero, negative, decimals, leading whitespace
 * (the caller should have trimmed already), and `NaN` (parseInt returns NaN
 * for inputs like `'abc'`). Returns the parsed integer on success or `null`.
 */
export function validateBreezInvoiceAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  // Reject anything that isn't pure digits — parseInt('100.5') would silently
  // give 100, hiding decimals from the caller.
  if (!/^\d+$/.test(amountStr)) return null;
  const n = parseInt(amountStr, 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

/**
 * Parse a Breez send input and, if it's a bolt11 invoice, prepare the payment
 * to retrieve fee details.
 *
 * @param input - The user's send-input string. Trimmed by the caller.
 * @param parseFn - DI seam: typically `breezService.parseInput`.
 * @param prepareFn - DI seam: typically `breezService.prepareSendPayment`.
 * @returns A preparation object, or `null` if the input couldn't be parsed.
 */
export async function prepareBreezSend(
  input: string,
  parseFn: (input: string) => Promise<ParsedBreezInput | null>,
  prepareFn: (input: string) => Promise<PreparedBreezPayment | null>,
): Promise<BreezSendPreparation | null> {
  const parsed = await parseFn(input);
  if (!parsed) return null;

  if (parsed.type !== 'bolt11Invoice') {
    return { parsed, prepared: null, feeSats: null };
  }

  let prepared: PreparedBreezPayment | null = null;
  try {
    prepared = await prepareFn(input);
  } catch {
    return { parsed, prepared: null, feeSats: null };
  }

  const feeSats =
    prepared && prepared.paymentMethod.type === 'bolt11Invoice'
      ? prepared.paymentMethod.lightningFeeSats
      : null;

  return { parsed, prepared, feeSats };
}
