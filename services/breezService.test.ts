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
});
