/**
 * @file walletConstants.ts
 *
 * Shared constants for the Wallet page module.
 *
 * Defines color palettes for each wallet type (Breez/Cashu/NWC) used by
 * the balance display, mode switcher, gradient backgrounds, and glow effects.
 * Also provides the canonical wallet ordering and a helper to determine
 * adjacent wallet colors for smooth gradient transitions.
 */

/** Color palette per wallet mode, used for gradients, borders, and glow effects. */
export const WALLET_COLORS = {
    breez: {
        primary: 'rgb(59, 130, 246)',    // blue-500
        glow: 'rgba(59, 130, 246, 0.2)',
        glowStrong: 'rgba(59, 130, 246, 0.25)',
        border: 'rgba(59, 130, 246, 0.3)'
    },
    cashu: {
        primary: 'rgb(16, 185, 129)',    // emerald-500
        glow: 'rgba(16, 185, 129, 0.2)',
        glowStrong: 'rgba(16, 185, 129, 0.25)',
        border: 'rgba(16, 185, 129, 0.3)'
    },
    nwc: {
        primary: 'rgb(168, 85, 247)',    // purple-500
        glow: 'rgba(168, 85, 247, 0.2)',
        glowStrong: 'rgba(168, 85, 247, 0.25)',
        border: 'rgba(168, 85, 247, 0.3)'
    },
    all: {
        primary: 'rgb(249, 115, 22)',    // orange-500
        glow: 'rgba(249, 115, 22, 0.2)',
        glowStrong: 'rgba(249, 115, 22, 0.25)',
        border: 'rgba(249, 115, 22, 0.3)'
    },
    none: {
        primary: 'transparent',
        glow: 'transparent',
        glowStrong: 'transparent',
        border: 'rgba(100, 116, 139, 0.3)'
    }
};

/** Canonical left-to-right ordering of wallet types in the switcher. */
export const WALLET_ORDER: Array<'breez' | 'cashu' | 'nwc'> = ['breez', 'cashu', 'nwc'];

/**
 * Returns the wallet type that sits to the LEFT of the current selection in the switcher.
 * Used for the gradient glow transition when switching between wallet views.
 */
export const getLeftGlowColor = (currentMode: 'breez' | 'cashu' | 'nwc'): 'breez' | 'cashu' | 'none' => {
    const currentIndex = WALLET_ORDER.indexOf(currentMode);
    if (currentIndex === 0) return 'none'; // Breez is leftmost, nothing to the left
    if (currentIndex === 1) return 'breez'; // Cashu: Breez is to the left
    return 'cashu'; // NWC: Cashu is to the left (Breez "disappears")
};
