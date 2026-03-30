/**
 * @file geohash.ts
 * @description Geospatial utility functions with zero external dependencies.
 *
 * - {@link encodeGeohash} - Encodes lat/lng into a geohash string using the
 *   standard binary interleaving algorithm (longitude bits first).
 * - {@link geohashPrefixes} - Generates prefix strings at multiple precision
 *   levels for Nostr relay `#g` tag queries.
 * - {@link haversineDistance} - Calculates great-circle distance between two
 *   coordinates using the Haversine formula, returned in miles.
 *
 * All algorithms are standard implementations without dependencies.
 */

/** Base32 character set used by the geohash encoding scheme (Gustavo Niemeyer variant). */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a latitude/longitude pair into a geohash string.
 *
 * Uses the standard geohash algorithm: alternately bisect the longitude
 * and latitude ranges, encoding 5 bits per character into Base32.
 *
 * Precision reference (approximate cell dimensions):
 * - 3 chars -> ~78 km (~48 mi)
 * - 4 chars -> ~20 km (~12 mi)
 * - 5 chars -> ~2.4 km (~1.5 mi)
 * - 6 chars -> ~610 m
 *
 * @param lat - Latitude in decimal degrees (-90 to 90).
 * @param lng - Longitude in decimal degrees (-180 to 180).
 * @param precision - Number of geohash characters to produce. Defaults to 6.
 * @returns The geohash string of the specified precision.
 */
export const encodeGeohash = (lat: number, lng: number, precision: number = 6): string => {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true; // alternate: longitude first, then latitude

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
};

/**
 * Generate geohash prefix strings at multiple precision levels.
 *
 * Useful for building Nostr `#g` tag filter arrays that cover a range
 * of spatial resolutions (e.g., city-level through neighborhood-level).
 *
 * @param geohash - Full geohash string to derive prefixes from.
 * @param minLen - Shortest prefix length (inclusive).
 * @param maxLen - Longest prefix length (inclusive, capped at geohash length).
 * @returns Array of prefix strings from shortest to longest.
 *
 * @example
 * ```ts
 * geohashPrefixes("9q8yyk", 3, 5) // ["9q8", "9q8y", "9q8yy"]
 * ```
 */
export const geohashPrefixes = (geohash: string, minLen: number, maxLen: number): string[] => {
  const prefixes: string[] = [];
  const upper = Math.min(maxLen, geohash.length);
  for (let i = minLen; i <= upper; i++) {
    prefixes.push(geohash.substring(0, i));
  }
  return prefixes;
};

/**
 * Calculate the great-circle distance between two geographic coordinates
 * using the Haversine formula.
 *
 * The Haversine formula accounts for Earth's curvature by computing:
 *   `a = sin^2(dLat/2) + cos(lat1) * cos(lat2) * sin^2(dLng/2)`
 *   `distance = 2R * atan2(sqrt(a), sqrt(1-a))`
 *
 * @param lat1 - Latitude of the first point in decimal degrees.
 * @param lng1 - Longitude of the first point in decimal degrees.
 * @param lat2 - Latitude of the second point in decimal degrees.
 * @param lng2 - Longitude of the second point in decimal degrees.
 * @returns Distance in miles (using Earth radius of 3958.8 mi).
 */
export const haversineDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
