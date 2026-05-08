import { describe, expect, it, vi } from 'vitest';
import { collectLogs, initErrorCapture, sanitizeDiagnosticMessage } from './feedbackService';

describe('feedbackService diagnostic sanitization', () => {
  it('redacts mnemonic, private key, token, and invoice fields before feedback capture', () => {
    const message = sanitizeDiagnosticMessage([
      'payment failed',
      {
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        privateKeyHex: 'a'.repeat(64),
        token: 'cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vbWludC5leGFtcGxlLmNvbSIsInByb29mcyI6W3sic2VjcmV0IjoiYmFyIn1dfV19',
        invoice: 'lnbc1'.padEnd(80, 'q'),
        nested: {
          paymentHash: 'b'.repeat(64),
          pubkey: 'c'.repeat(64),
        },
      },
    ]);

    expect(message).toContain('[REDACTED:mnemonic]');
    expect(message).toContain('[REDACTED:privateKeyHex]');
    expect(message).toContain('[REDACTED:token]');
    expect(message).toContain('[REDACTED:invoice]');
    expect(message).toContain('[REDACTED:paymentHash]');
    expect(message).toContain('[REDACTED:hex]');
    expect(message).not.toContain('abandon abandon');
    expect(message).not.toContain('cashuA');
    expect(message).not.toContain('lnbc1');
    expect(message).not.toContain('a'.repeat(64));
    expect(message).not.toContain('b'.repeat(64));
    expect(message).not.toContain('c'.repeat(64));
  });

  it('redacts sensitive standalone strings and handles circular objects', () => {
    const circular: Record<string, unknown> = { ok: true };
    circular.self = circular;

    const message = sanitizeDiagnosticMessage([
      'nwc string nostr+walletconnect://client?secret=' + 'd'.repeat(64),
      'nsec1'.padEnd(70, 'x'),
      circular,
    ]);

    expect(message).toContain('[REDACTED:nwc]');
    expect(message).toContain('[REDACTED:nsec]');
    expect(message).toContain('[Circular]');
    expect(message).not.toContain('nostr+walletconnect://');
    expect(message).not.toContain('nsec1');
    expect(message).not.toContain('d'.repeat(64));
  });

  it('captures sanitized console errors for feedback logs', () => {
    const originalError = console.error;
    const originalWarn = console.warn;

    try {
      console.error = vi.fn();
      console.warn = vi.fn();
      initErrorCapture();

      console.error('payment failed', {
        token: 'cashuA'.padEnd(80, 'q'),
        invoice: 'lnbc1'.padEnd(80, 'q'),
        nested: { privateKey: 'd'.repeat(64) },
      });

      const logs = collectLogs(false);
      const captured = logs.errors?.at(-1)?.message ?? '';

      expect(captured).toContain('[REDACTED:token]');
      expect(captured).toContain('[REDACTED:invoice]');
      expect(captured).toContain('[REDACTED:privateKey]');
      expect(captured).not.toContain('cashuA');
      expect(captured).not.toContain('lnbc1');
      expect(captured).not.toContain('d'.repeat(64));
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });
});
