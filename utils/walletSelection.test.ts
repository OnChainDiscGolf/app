import { describe, it, expect } from 'vitest';
import { getPreferredSendWallet, WalletSelectionInputs } from './walletSelection';

const inputs = (overrides: Partial<WalletSelectionInputs> = {}): WalletSelectionInputs => ({
  defaultQuickSendWallet: 'auto',
  walletBalances: { breez: 0, nwc: 0, cashu: 0 },
  nwcString: null,
  hasBreezWallet: false,
  ...overrides,
});

describe('getPreferredSendWallet — explicit user preference', () => {
  it('honors explicit nwc when NWC is configured and funded', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          defaultQuickSendWallet: 'nwc',
          walletBalances: { breez: 0, nwc: 500, cashu: 0 },
          nwcString: 'nostr+walletconnect://...',
        }),
      ),
    ).toBe('nwc');
  });

  it('falls through when explicit nwc has zero balance', () => {
    // NWC empty, Cashu has balance → auto picks Cashu
    expect(
      getPreferredSendWallet(
        inputs({
          defaultQuickSendWallet: 'nwc',
          walletBalances: { breez: 0, nwc: 0, cashu: 100 },
          nwcString: 'nostr+walletconnect://...',
        }),
      ),
    ).toBe('cashu');
  });

  it('falls through when explicit breez but hasBreezWallet=false', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          defaultQuickSendWallet: 'breez',
          walletBalances: { breez: 1000, nwc: 0, cashu: 100 },
          hasBreezWallet: false,
        }),
      ),
    ).toBe('cashu');
  });

  it('honors explicit cashu when funded', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          defaultQuickSendWallet: 'cashu',
          walletBalances: { breez: 0, nwc: 0, cashu: 100 },
        }),
      ),
    ).toBe('cashu');
  });
});

describe('getPreferredSendWallet — auto-select cascade', () => {
  it('auto: prefers Breez when Breez and NWC are both configured and funded', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          walletBalances: { breez: 1000, nwc: 100, cashu: 1000 },
          nwcString: 'nostr+walletconnect://...',
          hasBreezWallet: true,
        }),
      ),
    ).toBe('breez');
  });

  it('auto: prefers Breez when NWC empty but Breez funded', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          walletBalances: { breez: 1000, nwc: 0, cashu: 1000 },
          nwcString: null,
          hasBreezWallet: true,
        }),
      ),
    ).toBe('breez');
  });

  it('auto: prefers Cashu when only Cashu funded', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          walletBalances: { breez: 0, nwc: 0, cashu: 100 },
        }),
      ),
    ).toBe('cashu');
  });

  it('all empty → defaults to Cashu', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          walletBalances: { breez: 0, nwc: 0, cashu: 0 },
        }),
      ),
    ).toBe('cashu');
  });

  it('NWC string present but zero balance + Breez funded → Breez (priority order)', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          walletBalances: { breez: 1000, nwc: 0, cashu: 0 },
          nwcString: 'nostr+walletconnect://...',
          hasBreezWallet: true,
        }),
      ),
    ).toBe('breez');
  });

  it('auto: falls back to NWC when Breez is unavailable and NWC is configured and funded', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          walletBalances: { breez: 0, nwc: 500, cashu: 100 },
          nwcString: 'nostr+walletconnect://...',
          hasBreezWallet: true,
        }),
      ),
    ).toBe('nwc');
  });

  it('NWC funded but no NWC string → does not pick NWC', () => {
    expect(
      getPreferredSendWallet(
        inputs({
          walletBalances: { breez: 0, nwc: 500, cashu: 100 },
          nwcString: null,
        }),
      ),
    ).toBe('cashu');
  });
});
