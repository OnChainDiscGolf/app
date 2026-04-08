import { describe, it, expect, vi } from 'vitest';
import { parseAndValidateInvoice } from './invoiceValidation';

const FAKE_BOLT11 = 'lnbc1m1...';

describe('parseAndValidateInvoice', () => {
  it('returns all-null result for empty input', async () => {
    const result = await parseAndValidateInvoice('', 1000, vi.fn());
    expect(result).toEqual({
      isLightningInvoice: false,
      amount: null,
      fee: null,
      isSufficient: false,
    });
  });

  it('returns all-null result for non-bolt11 input (e.g. Lightning address)', async () => {
    const result = await parseAndValidateInvoice('alice@getalby.com', 1000, vi.fn());
    expect(result.isLightningInvoice).toBe(false);
    expect(result.amount).toBeNull();
  });

  it('marks invoice sufficient when balance > amount + fee', async () => {
    const quote = vi.fn().mockResolvedValue({ amount: 100, fee: 5 });
    const result = await parseAndValidateInvoice(FAKE_BOLT11, 1000, quote);
    expect(result).toEqual({
      isLightningInvoice: true,
      amount: 100,
      fee: 5,
      isSufficient: true,
    });
  });

  it('marks invoice insufficient when balance < amount + fee', async () => {
    const quote = vi.fn().mockResolvedValue({ amount: 100, fee: 5 });
    const result = await parseAndValidateInvoice(FAKE_BOLT11, 50, quote);
    expect(result.isSufficient).toBe(false);
  });

  it('marks invoice sufficient at the exact boundary balance === amount + fee', async () => {
    const quote = vi.fn().mockResolvedValue({ amount: 100, fee: 5 });
    const result = await parseAndValidateInvoice(FAKE_BOLT11, 105, quote);
    expect(result.isSufficient).toBe(true);
  });

  it('returns isLightningInvoice=true with null amounts when getLightningQuote rejects', async () => {
    const quote = vi.fn().mockRejectedValue(new Error('quote failed'));
    const result = await parseAndValidateInvoice(FAKE_BOLT11, 1000, quote);
    expect(result).toEqual({
      isLightningInvoice: true,
      amount: null,
      fee: null,
      isSufficient: false,
    });
  });

  it('detects uppercase LNBC prefix (case-insensitive)', async () => {
    const quote = vi.fn().mockResolvedValue({ amount: 10, fee: 1 });
    const result = await parseAndValidateInvoice('LNBC1m1...', 100, quote);
    expect(result.isLightningInvoice).toBe(true);
  });
});
