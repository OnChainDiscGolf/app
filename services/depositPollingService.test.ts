import { describe, it, expect, vi } from 'vitest';
import {
  createDepositPoller,
  nextPollDelayMs,
  DepositPollerScheduler,
} from './depositPollingService';

/**
 * Tiny in-memory scheduler. Lets each test advance time and run pending
 * timeouts deterministically without fighting vi.useFakeTimers' interaction
 * with promise microtasks.
 */
const makeFakeScheduler = (): DepositPollerScheduler & {
  advance(ms: number): Promise<void>;
  pendingCount(): number;
} => {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { fireAt: number; fn: () => void }>();

  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      pending.set(id, { fireAt: now + ms, fn });
      return id;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
    now: () => now,
    async advance(ms: number) {
      const target = now + ms;
      // Loop until no timeouts in window — fired callbacks may schedule new ones.
      // Sort by fireAt, fire each, await microtasks, repeat.
      while (true) {
        const due = Array.from(pending.entries())
          .filter(([, t]) => t.fireAt <= target)
          .sort((a, b) => a[1].fireAt - b[1].fireAt);
        if (due.length === 0) break;
        const [id, { fireAt, fn }] = due[0];
        now = fireAt;
        pending.delete(id);
        fn();
        // Let any pending promises (the awaited tick) resolve.
        await Promise.resolve();
        await Promise.resolve();
      }
      now = target;
    },
    pendingCount: () => pending.size,
  };
};

describe('nextPollDelayMs', () => {
  it('returns 2000 in the first 30s', () => {
    expect(nextPollDelayMs(0)).toBe(2000);
    expect(nextPollDelayMs(29_999)).toBe(2000);
  });

  it('returns 3000 between 30s and 2min', () => {
    expect(nextPollDelayMs(30_000)).toBe(3000);
    expect(nextPollDelayMs(119_999)).toBe(3000);
  });

  it('returns 5000 after 2min', () => {
    expect(nextPollDelayMs(120_000)).toBe(5000);
    expect(nextPollDelayMs(600_000)).toBe(5000);
  });
});

describe('createDepositPoller', () => {
  it('calls checkPaid immediately on start()', async () => {
    const checkPaid = vi.fn().mockResolvedValue(false);
    const onPaid = vi.fn();
    const scheduler = makeFakeScheduler();
    const poller = createDepositPoller({ checkPaid, onPaid, scheduler });

    poller.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(checkPaid).toHaveBeenCalledOnce();
    expect(onPaid).not.toHaveBeenCalled();
    poller.stop();
  });

  it('calls onPaid and stops when checkPaid returns true on first call', async () => {
    const checkPaid = vi.fn().mockResolvedValue(true);
    const onPaid = vi.fn();
    const scheduler = makeFakeScheduler();
    const poller = createDepositPoller({ checkPaid, onPaid, scheduler });

    poller.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(onPaid).toHaveBeenCalledOnce();
    expect(scheduler.pendingCount()).toBe(0);

    // Advancing time should not trigger more polls
    await scheduler.advance(60_000);
    expect(checkPaid).toHaveBeenCalledOnce();
  });

  it('schedules subsequent polls at 2s during the first 30s', async () => {
    const checkPaid = vi.fn().mockResolvedValue(false);
    const scheduler = makeFakeScheduler();
    const poller = createDepositPoller({ checkPaid, onPaid: vi.fn(), scheduler });

    poller.start();
    await Promise.resolve();
    await Promise.resolve();

    // After the first tick, one timeout pending
    expect(scheduler.pendingCount()).toBe(1);

    // Advance 2s → second poll fires
    await scheduler.advance(2000);
    expect(checkPaid).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('uses 3s cadence between 30s and 2min', async () => {
    const checkPaid = vi.fn().mockResolvedValue(false);
    const scheduler = makeFakeScheduler();
    const poller = createDepositPoller({ checkPaid, onPaid: vi.fn(), scheduler });

    poller.start();
    await Promise.resolve();
    await Promise.resolve();
    // Skip past the 30s boundary
    await scheduler.advance(31_000);
    const callsAt31s = checkPaid.mock.calls.length;

    // Now scheduler.now() === 31000. Next delay should be 3000.
    await scheduler.advance(3000);
    expect(checkPaid.mock.calls.length).toBe(callsAt31s + 1);
    poller.stop();
  });

  it('uses 5s cadence after 2min', async () => {
    const checkPaid = vi.fn().mockResolvedValue(false);
    const scheduler = makeFakeScheduler();
    const poller = createDepositPoller({ checkPaid, onPaid: vi.fn(), scheduler });

    poller.start();
    await Promise.resolve();
    await Promise.resolve();
    await scheduler.advance(125_000);
    const callsAt125s = checkPaid.mock.calls.length;

    await scheduler.advance(5000);
    expect(checkPaid.mock.calls.length).toBe(callsAt125s + 1);
    poller.stop();
  });

  it('stop() cancels pending timeouts and prevents further polls', async () => {
    const checkPaid = vi.fn().mockResolvedValue(false);
    const scheduler = makeFakeScheduler();
    const poller = createDepositPoller({ checkPaid, onPaid: vi.fn(), scheduler });

    poller.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.pendingCount()).toBe(1);

    poller.stop();
    expect(scheduler.pendingCount()).toBe(0);

    await scheduler.advance(60_000);
    expect(checkPaid).toHaveBeenCalledOnce();
  });
});
