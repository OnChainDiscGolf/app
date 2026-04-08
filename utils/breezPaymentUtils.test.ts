import { describe, it, expect, vi } from 'vitest';
import {
  validateBreezInvoiceAmount,
  prepareBreezSend,
  ParsedBreezInput,
  PreparedBreezPayment,
} from './breezPaymentUtils';

describe('validateBreezInvoiceAmount', () => {
  it('accepts a positive integer string', () => {
    expect(validateBreezInvoiceAmount('100')).toBe(100);
  });

  it('rejects "0"', () => {
    expect(validateBreezInvoiceAmount('0')).toBeNull();
  });

  it('rejects negative numbers', () => {
    expect(validateBreezInvoiceAmount('-5')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(validateBreezInvoiceAmount('abc')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(validateBreezInvoiceAmount('')).toBeNull();
  });

  it('rejects decimal input (no fractional sats)', () => {
    expect(validateBreezInvoiceAmount('100.5')).toBeNull();
  });
});

describe('prepareBreezSend', () => {
  const bolt11Parsed: ParsedBreezInput = { type: 'bolt11Invoice' };
  const addressParsed: ParsedBreezInput = {
    type: 'lightningAddress',
    address: 'alice@getalby.com',
  };
  const bolt11Prepared: PreparedBreezPayment = {
    paymentMethod: { type: 'bolt11Invoice', lightningFeeSats: 7 },
  };

  it('returns parsed + prepared + feeSats for a bolt11 invoice', async () => {
    const parseFn = vi.fn().mockResolvedValue(bolt11Parsed);
    const prepareFn = vi.fn().mockResolvedValue(bolt11Prepared);

    const result = await prepareBreezSend('lnbc1...', parseFn, prepareFn);

    expect(result).toEqual({
      parsed: bolt11Parsed,
      prepared: bolt11Prepared,
      feeSats: 7,
    });
    expect(parseFn).toHaveBeenCalledWith('lnbc1...');
    expect(prepareFn).toHaveBeenCalledWith('lnbc1...');
  });

  it('returns null when parseFn returns null', async () => {
    const parseFn = vi.fn().mockResolvedValue(null);
    const prepareFn = vi.fn();

    const result = await prepareBreezSend('garbage', parseFn, prepareFn);

    expect(result).toBeNull();
    expect(prepareFn).not.toHaveBeenCalled();
  });

  it('does not call prepareFn for non-bolt11 inputs (e.g. lightning address)', async () => {
    const parseFn = vi.fn().mockResolvedValue(addressParsed);
    const prepareFn = vi.fn();

    const result = await prepareBreezSend('alice@getalby.com', parseFn, prepareFn);

    expect(result).toEqual({
      parsed: addressParsed,
      prepared: null,
      feeSats: null,
    });
    expect(prepareFn).not.toHaveBeenCalled();
  });

  it('returns parsed but null prepared/feeSats when prepareFn rejects', async () => {
    const parseFn = vi.fn().mockResolvedValue(bolt11Parsed);
    const prepareFn = vi.fn().mockRejectedValue(new Error('SDK busy'));

    const result = await prepareBreezSend('lnbc1...', parseFn, prepareFn);

    expect(result).toEqual({
      parsed: bolt11Parsed,
      prepared: null,
      feeSats: null,
    });
  });

  it('returns null fee when prepared.paymentMethod is not bolt11Invoice', async () => {
    const parseFn = vi.fn().mockResolvedValue(bolt11Parsed);
    const prepareFn = vi.fn().mockResolvedValue({
      paymentMethod: { type: 'spark', lightningFeeSats: 99 },
    } as PreparedBreezPayment);

    const result = await prepareBreezSend('lnbc1...', parseFn, prepareFn);

    expect(result?.feeSats).toBeNull();
  });
});
