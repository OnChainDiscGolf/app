import { beforeEach, describe, expect, it, vi } from 'vitest';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const CONFIG = { apiKey: 'test-api-key', environment: 'production' as const };

const mockBreezSdk = (connectImpl: ReturnType<typeof vi.fn>) => {
  vi.doMock('@breeztech/breez-sdk-spark/web', () => ({
    default: vi.fn().mockResolvedValue(undefined),
    defaultConfig: vi.fn((network: string) => ({ network })),
    connect: connectImpl,
  }));
};

describe('breezService initialization readiness', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deduplicates concurrent Breez initialization attempts', async () => {
    const sdkInstance = {
      getLightningAddress: vi.fn().mockResolvedValue({ lightningAddress: 'aceoak42@breez.fun' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const connect = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(sdkInstance), 10))
    );
    mockBreezSdk(connect);

    const { initializeBreez, disconnectBreez, isBreezInitialized } = await import('./breezService');

    const [first, second] = await Promise.all([
      initializeBreez(MNEMONIC, CONFIG),
      initializeBreez(MNEMONIC, CONFIG),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(isBreezInitialized()).toBe(true);

    await disconnectBreez();
  });

  it('allows retry after a failed Breez initialization', async () => {
    const sdkInstance = {
      getLightningAddress: vi.fn().mockResolvedValue({ lightningAddress: 'aceoak42@breez.fun' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(sdkInstance);
    mockBreezSdk(connect);

    const { initializeBreez, disconnectBreez, isBreezInitialized } = await import('./breezService');

    await expect(initializeBreez(MNEMONIC, CONFIG)).resolves.toBe(false);
    expect(isBreezInitialized()).toBe(false);

    await expect(initializeBreez(MNEMONIC, CONFIG)).resolves.toBe(true);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(isBreezInitialized()).toBe(true);

    await disconnectBreez();
  });

  it('does not reconnect after Breez is already initialized', async () => {
    const sdkInstance = {
      getLightningAddress: vi.fn().mockResolvedValue({ lightningAddress: 'aceoak42@breez.fun' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const connect = vi.fn().mockResolvedValue(sdkInstance);
    mockBreezSdk(connect);

    const { initializeBreez, disconnectBreez, isBreezInitialized } = await import('./breezService');

    await expect(initializeBreez(MNEMONIC, CONFIG)).resolves.toBe(true);
    await expect(initializeBreez(MNEMONIC, CONFIG)).resolves.toBe(true);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(isBreezInitialized()).toBe(true);

    await disconnectBreez();
  });

  it('fails fast without connecting when mnemonic is missing', async () => {
    const connect = vi.fn();
    mockBreezSdk(connect);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { initializeBreez, isBreezInitialized } = await import('./breezService');

    await expect(initializeBreez('', CONFIG)).resolves.toBe(false);

    expect(connect).not.toHaveBeenCalled();
    expect(isBreezInitialized()).toBe(false);
    expect(warnSpy.mock.calls.flat().join('\n')).toContain('Breez initialization skipped');
  });

  it('fails fast without connecting when the Breez API key is missing', async () => {
    const connect = vi.fn();
    mockBreezSdk(connect);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { initializeBreez, isBreezInitialized } = await import('./breezService');

    await expect(initializeBreez(MNEMONIC, { ...CONFIG, apiKey: '' })).resolves.toBe(false);

    expect(connect).not.toHaveBeenCalled();
    expect(isBreezInitialized()).toBe(false);
    expect(warnSpy.mock.calls.flat().join('\n')).toContain('Breez initialization skipped');
  });

  it('redacts mnemonic and API key from Breez initialization failure logs', async () => {
    const secretApiKey = 'pem-secret-api-key';
    const error = new Error(`connect failed for ${MNEMONIC} using ${secretApiKey}`);
    error.stack = `Error: connect failed\n    at ${MNEMONIC}\n    with ${secretApiKey}`;

    const connect = vi.fn().mockRejectedValue(error);
    mockBreezSdk(connect);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { initializeBreez } = await import('./breezService');

    await expect(initializeBreez(MNEMONIC, { ...CONFIG, apiKey: secretApiKey })).resolves.toBe(false);

    const logged = [...errorSpy.mock.calls, ...logSpy.mock.calls]
      .flat()
      .map(value => value instanceof Error ? `${value.message}\n${value.stack}` : String(value))
      .join('\n');

    expect(logged).not.toContain(MNEMONIC);
    expect(logged).not.toContain(secretApiKey);
    expect(logged).toContain('[REDACTED]');
  });
});
