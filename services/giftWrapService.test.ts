import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Event } from 'nostr-tools';

vi.mock('./nostrService', () => ({
  getPool: vi.fn(),
}));

import { sendGiftWrap, unwrapGiftWrap } from './giftWrapService';
import { getPool } from './nostrService';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

const TEST_RELAYS = ['wss://relay.test'];

interface PoolFake {
  publish: ReturnType<typeof vi.fn>;
  subscribeMany: ReturnType<typeof vi.fn>;
}

const installPool = (publishImpl: (relays: string[], event: Event) => Promise<void>): {
  pool: PoolFake;
  captured: Event[];
} => {
  const captured: Event[] = [];
  const publish = vi.fn(async (relays: string[], event: Event) => {
    captured.push(event);
    return publishImpl(relays, event);
  });
  const pool: PoolFake = { publish, subscribeMany: vi.fn() };
  vi.mocked(getPool).mockReturnValue(pool as never);
  return { pool, captured };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('giftWrapService', () => {
  it('round-trips: sender → recipient unwraps to original content', async () => {
    const aliceSk = generateSecretKey();
    const alicePk = getPublicKey(aliceSk);
    const bobSk = generateSecretKey();
    const bobPk = getPublicKey(bobSk);

    const { captured } = installPool(async () => undefined);

    await sendGiftWrap('hello bob', aliceSk, bobPk, TEST_RELAYS);

    expect(captured).toHaveLength(1);
    const rumor = await unwrapGiftWrap(captured[0], bobSk);
    expect(rumor.content).toBe('hello bob');
    expect(rumor.pubkey).toBe(alicePk);
  });

  it('wrong recipient cannot decrypt', async () => {
    const aliceSk = generateSecretKey();
    const bobSk = generateSecretKey();
    const bobPk = getPublicKey(bobSk);
    const charlieSk = generateSecretKey();

    const { captured } = installPool(async () => undefined);
    await sendGiftWrap('secret for bob', aliceSk, bobPk, TEST_RELAYS);

    await expect(unwrapGiftWrap(captured[0], charlieSk)).rejects.toThrow();
  });

  it('throws when publishing fails on every relay', async () => {
    const aliceSk = generateSecretKey();
    const bobPk = getPublicKey(generateSecretKey());

    installPool(async () => {
      throw new Error('relay down');
    });

    await expect(
      sendGiftWrap('msg', aliceSk, bobPk, ['wss://r1', 'wss://r2', 'wss://r3']),
    ).rejects.toThrow(/encrypted message/);
  });

  it('does NOT throw when at least one relay accepts the publish', async () => {
    const aliceSk = generateSecretKey();
    const bobSk = generateSecretKey();
    const bobPk = getPublicKey(bobSk);

    let callCount = 0;
    const { captured } = installPool(async () => {
      callCount++;
      // Reject the first two, accept the third
      if (callCount < 3) throw new Error('relay rejected');
    });

    await expect(
      sendGiftWrap('partial success', aliceSk, bobPk, [
        'wss://r1', 'wss://r2', 'wss://r3',
      ]),
    ).resolves.toBeUndefined();

    // The same gift wrap is published once per relay; assert at least one was captured
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('default rumor kind is 14, but explicit kind is honored', async () => {
    const aliceSk = generateSecretKey();
    const bobSk = generateSecretKey();
    const bobPk = getPublicKey(bobSk);

    // Default kind
    let captured = installPool(async () => undefined).captured;
    await sendGiftWrap('default kind', aliceSk, bobPk, TEST_RELAYS);
    let rumor = await unwrapGiftWrap(captured[0], bobSk);
    expect(rumor.kind).toBe(14);

    // Explicit kind
    captured = installPool(async () => undefined).captured;
    await sendGiftWrap('custom kind', aliceSk, bobPk, TEST_RELAYS, 1);
    rumor = await unwrapGiftWrap(captured[0], bobSk);
    expect(rumor.kind).toBe(1);
  });
});
