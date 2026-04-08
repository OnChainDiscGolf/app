import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.mock is hoisted to the top of the file before any imports.
//
// Note: paymentRouter imports `sendGiftWrap` from `./nostrService`, NOT from
// `./giftWrapService`. There are two `sendGiftWrap` implementations in the
// codebase — the legacy 2-arg version in nostrService.ts and a 5-arg version
// in giftWrapService.ts. paymentRouter uses the legacy one, which handles
// session lookup + relay selection internally via getSession() and getRelays().
vi.mock('./nostrService', () => ({
  fetchProfile: vi.fn(),
  sendGiftWrap: vi.fn(),
  getMagicLightningAddress: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock('./breezService', () => ({
  isBreezInitialized: vi.fn(),
  getBreezBalance: vi.fn(),
  payLightningAddress: vi.fn(),
  payInvoice: vi.fn(),
}));

import { routePayment } from './paymentRouter';
import * as nostrService from './nostrService';
import * as breezService from './breezService';

const mockedNostr = vi.mocked(nostrService);
const mockedBreez = vi.mocked(breezService);

const HEX_PUBKEY = '0'.repeat(64);

const recipient = (overrides: Partial<{ pubkey: string; amountSats: number; name: string }> = {}) => ({
  pubkey: HEX_PUBKEY,
  amountSats: 1000,
  name: 'Alice',
  ...overrides,
});

/**
 * Default fetch mock — happy-path LNURL resolution. Individual tests can
 * override before calling routePayment.
 */
const installHappyFetch = () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = url.toString();
    if (u.includes('/.well-known/lnurlp/')) {
      return new Response(JSON.stringify({
        callback: 'https://example.com/cb',
        minSendable: 1000,
        maxSendable: 100_000_000,
        metadata: '[]',
      }));
    }
    if (u.startsWith('https://example.com/cb')) {
      return new Response(JSON.stringify({ pr: 'lnbc1mock_invoice' }));
    }
    throw new Error(`unmocked fetch: ${u}`);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  installHappyFetch();
  // Default profile has a kind 0 lud16, so source = 'kind0'.
  mockedNostr.fetchProfile.mockResolvedValue({ lud16: 'alice@getalby.com' } as never);
});

describe('routePayment 4-tier cascade', () => {
  it('Tier 1a — Breez initialized + funded + direct pay succeeds', async () => {
    mockedBreez.isBreezInitialized.mockReturnValue(true);
    mockedBreez.getBreezBalance.mockResolvedValue({ balanceSats: 10_000 } as never);
    mockedBreez.payLightningAddress.mockResolvedValue({
      success: true,
      paymentHash: 'hash-1',
      feeSats: 1,
    } as never);

    const result = await routePayment(recipient(), vi.fn());

    expect(result.success).toBe(true);
    expect(result.method).toBe('breez');
    expect(result.txId).toBe('hash-1');
    expect(mockedBreez.payLightningAddress).toHaveBeenCalledOnce();
    expect(mockedBreez.payInvoice).not.toHaveBeenCalled();
  });

  it('Tier 1b — direct pay fails, LNURL → Breez payInvoice succeeds', async () => {
    mockedBreez.isBreezInitialized.mockReturnValue(true);
    mockedBreez.getBreezBalance.mockResolvedValue({ balanceSats: 10_000 } as never);
    mockedBreez.payLightningAddress.mockResolvedValue({
      success: false,
      error: 'address rejected',
    } as never);
    mockedBreez.payInvoice.mockResolvedValue({
      success: true,
      paymentHash: 'hash-2',
      feeSats: 2,
    } as never);

    const result = await routePayment(recipient(), vi.fn());

    expect(result.success).toBe(true);
    expect(result.method).toBe('breez');
    expect(result.txId).toBe('hash-2');
    expect(mockedBreez.payInvoice).toHaveBeenCalledWith('lnbc1mock_invoice');
  });

  it('Tier 1c — Breez funded but BOTH attempts fail, MUST NOT cascade to Cashu', async () => {
    mockedBreez.isBreezInitialized.mockReturnValue(true);
    mockedBreez.getBreezBalance.mockResolvedValue({ balanceSats: 10_000 } as never);
    mockedBreez.payLightningAddress.mockResolvedValue({
      success: false,
      error: 'address rejected',
    } as never);
    mockedBreez.payInvoice.mockResolvedValue({
      success: false,
      error: 'route not found',
    } as never);
    const cashuPaymentFn = vi.fn();

    const result = await routePayment(recipient(), cashuPaymentFn);

    expect(result.success).toBe(false);
    expect(result.method).toBe('breez');
    expect(result.error).toMatch(/address rejected|Breez payment failed/);
    // Critical: no silent fallback when Breez is funded
    expect(cashuPaymentFn).not.toHaveBeenCalled();
  });

  it('Tier 2 — Breez balance too low → Cashu LNURL melt via cashuPaymentFn', async () => {
    mockedBreez.isBreezInitialized.mockReturnValue(true);
    mockedBreez.getBreezBalance.mockResolvedValue({ balanceSats: 0 } as never);
    const cashuPaymentFn = vi.fn().mockResolvedValue(true);

    const result = await routePayment(recipient(), cashuPaymentFn);

    expect(result.success).toBe(true);
    expect(result.method).toBe('lnurl');
    expect(cashuPaymentFn).toHaveBeenCalledWith('lnbc1mock_invoice');
    expect(mockedBreez.payLightningAddress).not.toHaveBeenCalled();
  });

  it('Tier 3 — no lud16 in profile, falls to npub.cash gateway', async () => {
    mockedBreez.isBreezInitialized.mockReturnValue(false);
    mockedNostr.fetchProfile.mockResolvedValue({} as never);
    const cashuPaymentFn = vi.fn().mockResolvedValue(true);

    const result = await routePayment(recipient(), cashuPaymentFn);

    expect(result.success).toBe(true);
    expect(result.method).toBe('npubcash');
    expect(cashuPaymentFn).toHaveBeenCalledOnce();
  });

  it('Tier 4 — Cashu melt fails → DM fallback with createCashuTokenFn', async () => {
    mockedBreez.isBreezInitialized.mockReturnValue(false);
    const cashuPaymentFn = vi.fn().mockResolvedValue(false);
    const createCashuTokenFn = vi.fn().mockResolvedValue('cashuAtoken123');

    const result = await routePayment(recipient(), cashuPaymentFn, createCashuTokenFn);

    expect(result.success).toBe(true);
    expect(result.method).toBe('cashu_dm');
    expect(result.requiresManualClaim).toBe(true);
    expect(createCashuTokenFn).toHaveBeenCalledWith(1000);
    // Verify the legacy 2-arg sendGiftWrap signature from nostrService.ts.
    // Pinning the exact shape so any future drift (e.g., a refactor that
    // switches to giftWrapService's 5-arg version) trips this test loudly.
    expect(mockedNostr.sendGiftWrap).toHaveBeenCalledWith(
      HEX_PUBKEY,         // recipientPubkey
      expect.any(String), // content (JSON-encoded cashu_payment)
    );
  });

  it('All tiers fail → method=failed', async () => {
    mockedBreez.isBreezInitialized.mockReturnValue(false);
    // LNURL invoice resolution succeeds but Cashu melt fails, and no DM fn provided.
    const cashuPaymentFn = vi.fn().mockResolvedValue(false);

    const result = await routePayment(recipient(), cashuPaymentFn);

    expect(result.success).toBe(false);
    expect(result.method).toBe('failed');
  });
});
