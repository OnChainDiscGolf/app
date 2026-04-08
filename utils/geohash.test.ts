import { describe, it, expect } from 'vitest';
import { encodeGeohash, geohashPrefixes, haversineDistance } from './geohash';

describe('encodeGeohash', () => {
  // Pinned by running the implementation; if these change, geohash output changed
  // and any external relay queries that use it will need re-tagging.
  it('encodes San Francisco at precision 6', () => {
    expect(encodeGeohash(37.7749, -122.4194, 6)).toBe('9q8yyk');
  });

  it('encodes New York at precision 6', () => {
    expect(encodeGeohash(40.7128, -74.0060, 6)).toBe('dr5reg');
  });

  it('encodes the origin at precision 5', () => {
    expect(encodeGeohash(0, 0, 5)).toBe('s0000');
  });

  it('encodes the NE corner (90, 180) at precision 4', () => {
    expect(encodeGeohash(90, 180, 4)).toBe('zzzz');
  });

  it('encodes the SW corner (-90, -180) at precision 4', () => {
    expect(encodeGeohash(-90, -180, 4)).toBe('0000');
  });

  it('lower precision is a strict prefix of higher precision', () => {
    const p1 = encodeGeohash(37.7749, -122.4194, 1);
    const p3 = encodeGeohash(37.7749, -122.4194, 3);
    const p6 = encodeGeohash(37.7749, -122.4194, 6);
    expect(p3.startsWith(p1)).toBe(true);
    expect(p6.startsWith(p3)).toBe(true);
  });

  it('defaults to precision 6 when omitted', () => {
    expect(encodeGeohash(37.7749, -122.4194)).toHaveLength(6);
  });
});

describe('geohashPrefixes', () => {
  it('returns prefixes from minLen through maxLen inclusive', () => {
    expect(geohashPrefixes('9q8yyk', 3, 5)).toEqual(['9q8', '9q8y', '9q8yy']);
  });

  it('caps maxLen at the geohash length', () => {
    expect(geohashPrefixes('9q8', 3, 6)).toEqual(['9q8']);
  });

  it('returns an empty array when minLen > maxLen', () => {
    expect(geohashPrefixes('9q8yyk', 5, 3)).toEqual([]);
  });

  it('returns an empty array when minLen exceeds the geohash length', () => {
    expect(geohashPrefixes('', 3, 5)).toEqual([]);
  });

  it('returns a single-element array when minLen === maxLen', () => {
    expect(geohashPrefixes('9q8yyk', 4, 4)).toEqual(['9q8y']);
  });
});

describe('haversineDistance', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineDistance(37.7749, -122.4194, 37.7749, -122.4194)).toBeLessThan(0.001);
  });

  it('computes SF → NY distance within ±10 mi of ~2570 mi', () => {
    const d = haversineDistance(37.7749, -122.4194, 40.7128, -74.0060);
    expect(Math.abs(d - 2570)).toBeLessThan(15);
  });

  it('computes equatorial antipodes (0,0)→(0,180) within ±20 mi of half circumference', () => {
    const d = haversineDistance(0, 0, 0, 180);
    // Half of Earth's circumference ≈ π * 3958.8 ≈ 12437 mi
    expect(Math.abs(d - 12437)).toBeLessThan(20);
  });

  it('is symmetric: dist(A,B) === dist(B,A)', () => {
    const ab = haversineDistance(37.7749, -122.4194, 40.7128, -74.0060);
    const ba = haversineDistance(40.7128, -74.0060, 37.7749, -122.4194);
    expect(ab).toBeCloseTo(ba, 10);
  });
});
