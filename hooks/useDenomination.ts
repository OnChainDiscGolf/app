/**
 * @file useDenomination.ts
 * @description Hook for managing the user's preferred currency denomination
 * (sats or USD) and formatting amounts accordingly. Persists the preference
 * to localStorage and fetches BTC price from the price service when USD mode
 * is active, refreshing every 5 minutes.
 */

import { useState, useEffect, useCallback } from 'react';
import { getBtcPrice, satsToUsd } from '../services/priceService';

/** Supported denomination types. */
export type Denomination = 'sats' | 'usd';

/** localStorage key for persisting the denomination preference. */
const STORAGE_KEY = 'cdg_denomination';

/**
 * Hook for app-wide denomination preference and amount formatting.
 *
 * Manages the user's preferred denomination (`'sats'` or `'usd'`), persists
 * it to localStorage, and provides a `formatAmount` function that converts
 * satoshi values to the appropriate display string.
 *
 * When USD mode is active, fetches the current BTC price on mount and
 * refreshes it every 5 minutes via `getBtcPrice()`.
 *
 * @returns An object containing:
 *   - `denomination` - Current denomination setting.
 *   - `setDenomination` - Function to change the denomination (persists to localStorage).
 *   - `formatAmount` - Formatter: `(sats, opts?) => string`. Supports `compact` and `showBoth` options.
 *   - `unitLabel` - Display label for the current unit (`'sats'` or `'USD'`).
 *   - `btcPrice` - Current BTC price in USD, or `null` if unavailable.
 *
 * @example
 * ```tsx
 * const { formatAmount } = useDenomination();
 * formatAmount(1000);              // "1,000 sats" or "$0.85"
 * formatAmount(1000, { compact: true }); // "1,000" or "$0.85"
 * ```
 */
export const useDenomination = () => {
  const [denomination, setDenominationState] = useState<Denomination>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Denomination) || 'sats';
  });

  const [btcPrice, setBtcPrice] = useState<number | null>(null);

  // Fetch price on mount and when switching to USD
  useEffect(() => {
    if (denomination === 'usd') {
      getBtcPrice().then(price => {
        if (price) setBtcPrice(price);
      });
    }
  }, [denomination]);

  // Also refresh price periodically when in USD mode
  useEffect(() => {
    if (denomination !== 'usd') return;
    const interval = setInterval(() => {
      getBtcPrice().then(price => {
        if (price) setBtcPrice(price);
      });
    }, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [denomination]);

  const setDenomination = useCallback((d: Denomination) => {
    setDenominationState(d);
    localStorage.setItem(STORAGE_KEY, d);
    if (d === 'usd') {
      getBtcPrice().then(price => {
        if (price) setBtcPrice(price);
      });
    }
  }, []);

  /**
   * Format a sats amount according to the user's preference.
   * @param sats - amount in satoshis
   * @param opts - options
   *   - compact: omit the unit label (e.g., "1,000" instead of "1,000 sats")
   *   - showBoth: show both denominations (e.g., "1,000 sats (~$0.85)")
   */
  const formatAmount = useCallback((sats: number, opts?: { compact?: boolean; showBoth?: boolean }) => {
    if (denomination === 'usd' && btcPrice) {
      const usdStr = satsToUsd(sats, btcPrice);
      if (opts?.showBoth) {
        return `${usdStr} (${sats.toLocaleString()} sats)`;
      }
      return usdStr;
    }
    if (opts?.compact) {
      return sats.toLocaleString();
    }
    return `${sats.toLocaleString()} sats`;
  }, [denomination, btcPrice]);

  /**
   * Get just the unit label
   */
  const unitLabel = denomination === 'usd' && btcPrice ? 'USD' : 'sats';

  return {
    denomination,
    setDenomination,
    formatAmount,
    unitLabel,
    btcPrice,
  };
};
