import { describe, expect, it } from 'vitest';
import { getWalletModeUxOptions } from './walletModeUx';

describe('getWalletModeUxOptions', () => {
  it('presents Breez as the recommended default instead of three equal technical modes', () => {
    const options = getWalletModeUxOptions({ hasBreezWallet: true, hasCashuMint: true, isNwcConnected: true });

    expect(options.primary.id).toBe('breez');
    expect(options.primary.badge).toBe('Recommended');
    expect(options.advanced.map(option => option.id)).toEqual(['cashu', 'nwc']);
    expect(options.scorekeepingOnly).toContain('score');
  });

  it('explains disabled or unconfigured modes with a recovery action', () => {
    const options = getWalletModeUxOptions({ hasBreezWallet: false, hasCashuMint: false, isNwcConnected: false });

    expect(options.primary.status).toContain('setup needed');
    expect(options.advanced.find(option => option.id === 'cashu')?.status).toContain('add a mint');
    expect(options.advanced.find(option => option.id === 'nwc')?.status).toContain('paste a connection string');
    expect(options.advanced.find(option => option.id === 'nwc')?.actionLabel).toBe('Connect wallet');
  });
});
