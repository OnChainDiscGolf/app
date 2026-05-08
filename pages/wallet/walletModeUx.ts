export type WalletModeId = 'breez' | 'cashu' | 'nwc';

export interface WalletModeUxStatus {
  hasBreezWallet: boolean;
  hasCashuMint: boolean;
  isNwcConnected: boolean;
}

export interface WalletModeUxOption {
  id: WalletModeId;
  label: string;
  shortLabel: string;
  badge?: string;
  description: string;
  status: string;
  actionLabel: string;
  isConfigured: boolean;
}

export interface WalletModeUxOptions {
  primary: WalletModeUxOption;
  advanced: WalletModeUxOption[];
  scorekeepingOnly: string;
}

export const getWalletModeUxOptions = ({
  hasBreezWallet,
  hasCashuMint,
  isNwcConnected,
}: WalletModeUxStatus): WalletModeUxOptions => ({
  primary: {
    id: 'breez',
    label: 'Breez Lightning',
    shortLabel: 'Breez',
    badge: 'Recommended',
    description: 'Best for casual rounds: automatic Lightning payments, self-custody, and the smoothest score-to-settlement flow.',
    status: hasBreezWallet ? 'ready for Lightning payments' : 'setup needed: create a Lightning wallet backup first',
    actionLabel: hasBreezWallet ? 'Use Breez' : 'Set up Breez',
    isConfigured: hasBreezWallet,
  },
  advanced: [
    {
      id: 'cashu',
      label: 'Cashu eCash',
      shortLabel: 'Cashu',
      description: 'Privacy-focused eCash for advanced users and fallback/manual-claim payments.',
      status: hasCashuMint ? 'mint ready' : 'setup needed: add a mint before receiving eCash',
      actionLabel: hasCashuMint ? 'Use Cashu' : 'Add a mint',
      isConfigured: hasCashuMint,
    },
    {
      id: 'nwc',
      label: 'Connect existing wallet',
      shortLabel: 'NWC',
      description: 'Use an existing Lightning wallet that supports Nostr Wallet Connect, like Alby or Zeus.',
      status: isNwcConnected ? 'external wallet connected' : 'setup needed: paste a connection string from your wallet',
      actionLabel: isNwcConnected ? 'Use connected wallet' : 'Connect wallet',
      isConfigured: isNwcConnected,
    },
  ],
  scorekeepingOnly: 'Just keeping score? You can start or join a round without setting up payments and settle later.',
});
