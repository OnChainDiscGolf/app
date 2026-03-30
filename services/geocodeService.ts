/**
 * @fileoverview Geocode Service -- Nominatim (OpenStreetMap) location search.
 *
 * Provides forward geocoding for tournament location selection. Uses the free
 * Nominatim API (no API key required). Results feed into geohash generation
 * for relay-side tournament discovery via `g` tags on Kind 30003 events.
 *
 * Rate limit: 1 request/second (enforced by Nominatim, not client-side).
 * Requires User-Agent header per Nominatim usage policy.
 *
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */

/**
 * A single geocoding result returned by Nominatim.
 */
export interface GeocodingResult {
  /** Human-readable place name (e.g., "Maple Hill, Leicester, MA, USA") */
  displayName: string;
  /** Latitude in decimal degrees */
  lat: number;
  /** Longitude in decimal degrees */
  lng: number;
}

/** Nominatim search endpoint -- free, no API key */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for geographic locations by free-text query.
 *
 * Returns up to 5 results from OpenStreetMap's Nominatim service.
 * Empty/whitespace-only queries short-circuit to an empty array.
 *
 * @param query - Free-text location search string (e.g., "Maple Hill disc golf")
 * @returns Array of matching locations with display name and coordinates
 *
 * @example
 * const results = await geocodeSearch("Maple Hill disc golf");
 * // [{ displayName: "Maple Hill, Leicester, MA", lat: 42.26, lng: -71.91 }]
 */
export const geocodeSearch = async (query: string): Promise<GeocodingResult[]> => {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '0',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'User-Agent': 'OnChainDiscGolf/1.0',
    },
  });

  if (!response.ok) return [];

  const data = await response.json();

  return data.map((item: any) => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
};
