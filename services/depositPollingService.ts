/**
 * @file depositPollingService.ts
 * @description Tiered-backoff poller for Lightning deposit confirmation.
 *
 * Extracted from Wallet.tsx so the polling cadence (2s → 3s → 5s) and
 * stop/cleanup behavior can be tested without rendering. The component owns
 * the React effect lifecycle and binds onPaid to its own state setters.
 *
 * Cadence (matches the original effect):
 * - First 30 seconds:  poll every 2s
 * - 30s – 2 min:       poll every 3s
 * - After 2 min:       poll every 5s
 */

const THIRTY_SECONDS_MS = 30 * 1000;
const TWO_MINUTES_MS = 2 * 60 * 1000;
const FAST_DELAY_MS = 2000;
const MEDIUM_DELAY_MS = 3000;
const SLOW_DELAY_MS = 5000;

/** Test seam: replace setTimeout/clearTimeout/Date.now with an in-memory fake. */
export interface DepositPollerScheduler {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

export interface DepositPollerOptions {
  /** Returns true when the deposit has been paid. Called repeatedly. */
  checkPaid: () => Promise<boolean>;
  /** Called once when checkPaid returns true. The poller stops afterwards. */
  onPaid: () => Promise<void> | void;
  /** Optional error sink for unexpected throws inside checkPaid/onPaid. */
  onError?: (err: unknown) => void;
  /** Defaults to the global setTimeout/clearTimeout/Date.now. */
  scheduler?: DepositPollerScheduler;
}

export interface DepositPoller {
  start(): void;
  stop(): void;
}

const defaultScheduler: DepositPollerScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

/**
 * Compute the delay until the next poll based on elapsed time.
 * Exported for direct unit testing.
 */
export function nextPollDelayMs(elapsedMs: number): number {
  if (elapsedMs < THIRTY_SECONDS_MS) return FAST_DELAY_MS;
  if (elapsedMs < TWO_MINUTES_MS) return MEDIUM_DELAY_MS;
  return SLOW_DELAY_MS;
}

export function createDepositPoller(opts: DepositPollerOptions): DepositPoller {
  const scheduler = opts.scheduler ?? defaultScheduler;
  let startTime = 0;
  let pendingHandle: unknown = null;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    let isPaid = false;
    try {
      isPaid = await opts.checkPaid();
    } catch (err) {
      opts.onError?.(err);
    }
    if (stopped) return;

    if (isPaid) {
      try {
        await opts.onPaid();
      } catch (err) {
        opts.onError?.(err);
      }
      stopped = true;
      return;
    }

    const elapsed = scheduler.now() - startTime;
    const delay = nextPollDelayMs(elapsed);
    pendingHandle = scheduler.setTimeout(() => {
      pendingHandle = null;
      void tick();
    }, delay);
  };

  return {
    start(): void {
      if (startTime !== 0) return; // already started
      startTime = scheduler.now();
      void tick();
    },
    stop(): void {
      stopped = true;
      if (pendingHandle !== null) {
        scheduler.clearTimeout(pendingHandle);
        pendingHandle = null;
      }
    },
  };
}
