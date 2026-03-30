/**
 * @fileoverview Bitcoin Price Service -- BTC/USD price feed with caching.
 *
 * Fetches the current BTC price from mempool.space's public API and caches
 * it for 5 minutes. Used throughout the wallet UI to display sats-to-USD
 * conversions. Falls back to stale cache on network failure.
 *
 * Design goals:
 * - Minimal network usage (5-min cache is plenty for a disc golf app)
 * - Graceful degradation (stale cache > null > crash)
 * - No API key required (mempool.space is free and Bitcoin-native)
 *
 * @see https://mempool.space/docs/api/rest#get-price
 */

/** Cache duration: 5 minutes in milliseconds */
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - plenty fresh for a disc golf app

/** Internal price cache structure */
interface PriceCache {
  usd: number;
  timestamp: number;
}

/** Module-level cached price (null = never fetched) */
let cachedPrice: PriceCache | null = null;

/**
 * Get the current BTC price in USD.
 *
 * Uses mempool.space as the primary source (Bitcoin-native, reliable, no API key).
 * Returns a cached value if still within the 5-minute freshness window;
 * otherwise fetches a new price. On failure, returns stale cache if available,
 * or null if no price has ever been fetched.
 *
 * @returns The BTC price in USD, or null if unavailable
 *
 * @example
 * const price = await getBtcPrice();
 * if (price) console.log(`1 BTC = $${price}`);
 */
export const getBtcPrice = async (): Promise<number | null> => {
  // Return cached if still fresh
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_DURATION) {
    console.log('💰 Using cached BTC price:', cachedPrice.usd);
    return cachedPrice.usd;
  }

  try {
    console.log('💰 Fetching BTC price from mempool.space...');
    const response = await fetch('https://mempool.space/api/v1/prices', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.USD && typeof data.USD === 'number') {
      cachedPrice = {
        usd: data.USD,
        timestamp: Date.now()
      };
      console.log('💰 BTC price updated:', data.USD);
      return data.USD;
    }

    throw new Error('Invalid price data');
  } catch (error) {
    console.warn('💰 Price fetch failed:', error);
    
    // Return stale cache if available (better than nothing)
    if (cachedPrice) {
      console.log('💰 Using stale cached price:', cachedPrice.usd);
      return cachedPrice.usd;
    }
    
    return null;
  }
};

/**
 * Convert satoshis to USD string
 * @param sats - Amount in satoshis
 * @param btcPrice - Current BTC price in USD
 * @returns Formatted USD string (e.g., "$0.67")
 */
export const satsToUsd = (sats: number, btcPrice: number): string => {
  const btc = sats / 100_000_000;
  const usd = btc * btcPrice;
  
  // Always use 2 decimal places for consistency
  if (usd >= 1000) {
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    return `$${usd.toFixed(2)}`;
  }
};

/**
 * Get the age of the cached price
 * @returns Human readable string or null if no cache
 */
export const getCacheAge = (): string | null => {
  if (!cachedPrice) return null;
  
  const ageMs = Date.now() - cachedPrice.timestamp;
  const ageSec = Math.floor(ageMs / 1000);
  
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  return `${ageMin}m ago`;
};

