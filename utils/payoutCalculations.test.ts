import { describe, it, expect } from 'vitest';
import { Player, PayoutConfig } from '../types';
import {
  getTopHeavyDistribution,
  getLinearDistribution,
  calculatePayouts,
} from './payoutCalculations';

const player = (id: string, totalScore: number): Player => ({
  id,
  name: id,
  handicap: 0,
  paid: true,
  paysEntry: true,
  paysAce: false,
  scores: {},
  totalScore,
  isCurrentUser: false,
});

const config = (overrides: Partial<PayoutConfig>): PayoutConfig => ({
  mode: 'percentage-based',
  gradient: 'top-heavy',
  percentageThreshold: 30,
  acePotRedistribution: 'forfeit',
  ...overrides,
});

const sumValues = (m: Map<string, number>) =>
  Array.from(m.values()).reduce((a, b) => a + b, 0);

describe('getTopHeavyDistribution', () => {
  it('returns [1.0] for 1 winner', () => {
    expect(getTopHeavyDistribution(1)).toEqual([1.0]);
  });

  it('returns hardcoded ratios for 2 winners', () => {
    expect(getTopHeavyDistribution(2)).toEqual([0.75, 0.25]);
  });

  it('returns hardcoded ratios for 3 winners', () => {
    expect(getTopHeavyDistribution(3)).toEqual([0.6, 0.25, 0.15]);
  });

  it('returns hardcoded ratios for 4 winners', () => {
    expect(getTopHeavyDistribution(4)).toEqual([0.5, 0.25, 0.15, 0.1]);
  });

  it('returns hardcoded ratios for 5 winners', () => {
    expect(getTopHeavyDistribution(5)).toEqual([0.45, 0.25, 0.15, 0.1, 0.05]);
  });

  it('produces a normalized monotonically decreasing array for 6+ winners', () => {
    const dist = getTopHeavyDistribution(6);
    expect(dist).toHaveLength(6);
    expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 10);
    for (let i = 1; i < dist.length; i++) {
      expect(dist[i]).toBeLessThan(dist[i - 1]);
    }
  });
});

describe('getLinearDistribution', () => {
  it('returns [1.0] for 1 winner', () => {
    expect(getLinearDistribution(1)).toEqual([1.0]);
  });

  it('returns [0.5, 0.333, 0.167] for 3 winners', () => {
    const dist = getLinearDistribution(3);
    expect(dist[0]).toBeCloseTo(0.5, 5);
    expect(dist[1]).toBeCloseTo(1 / 3, 5);
    expect(dist[2]).toBeCloseTo(1 / 6, 5);
  });

  it('sums to 1.0 for n in 2..10', () => {
    for (let n = 2; n <= 10; n++) {
      const sum = getLinearDistribution(n).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });
});

describe('calculatePayouts', () => {
  const players3 = [player('a', 50), player('b', 60), player('c', 70)];

  it('winner-take-all when no config arg', () => {
    const out = calculatePayouts(players3, 1000);
    expect(out.size).toBe(1);
    expect(out.get('a')).toBe(1000);
  });

  it('winner-take-all when totalPot=0', () => {
    const out = calculatePayouts(
      players3,
      0,
      config({ mode: 'percentage-based', gradient: 'top-heavy' }),
    );
    expect(out.size).toBe(1);
    expect(out.get('a')).toBe(0);
  });

  it('explicit mode=winner-take-all gives full pot to lowest score', () => {
    const out = calculatePayouts(players3, 500, config({ mode: 'winner-take-all' }));
    expect(out.size).toBe(1);
    expect(out.get('a')).toBe(500);
  });

  it('top-heavy: pot=100, 3 winners → [60, 25, 15] and sums exactly to pot', () => {
    // 3 players × percentageThreshold 100 → 3 winners (all of them)
    const out = calculatePayouts(
      players3,
      100,
      config({ percentageThreshold: 100, gradient: 'top-heavy' }),
    );
    expect(out.get('a')).toBe(60);
    expect(out.get('b')).toBe(25);
    expect(out.get('c')).toBe(15);
    expect(sumValues(out)).toBe(100);
  });

  it('floor remainder lands on the last winner', () => {
    // pot 1001, 3 players, top-heavy, threshold 100
    // floor(1001*0.6)=600, floor(1001*0.25)=250, last absorbs 1001-600-250=151
    const out = calculatePayouts(
      players3,
      1001,
      config({ percentageThreshold: 100, gradient: 'top-heavy' }),
    );
    expect(out.get('a')).toBe(600);
    expect(out.get('b')).toBe(250);
    expect(out.get('c')).toBe(151);
    expect(sumValues(out)).toBe(1001);
  });

  it('all values are non-negative integers (integer-sats invariant)', () => {
    const players = Array.from({ length: 7 }, (_, i) => player(`p${i}`, 50 + i));
    const out = calculatePayouts(
      players,
      1234567,
      config({ percentageThreshold: 50, gradient: 'top-heavy' }),
    );
    for (const v of out.values()) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(sumValues(out)).toBe(1234567);
  });

  it('percentageThreshold uses Math.ceil: 7 × 30% → 3 winners', () => {
    const players = Array.from({ length: 7 }, (_, i) => player(`p${i}`, 50 + i));
    const out = calculatePayouts(
      players,
      1000,
      config({ percentageThreshold: 30, gradient: 'top-heavy' }),
    );
    expect(out.size).toBe(3);
  });

  it('percentageThreshold ceil: 7 × 15% → 2 winners', () => {
    const players = Array.from({ length: 7 }, (_, i) => player(`p${i}`, 50 + i));
    const out = calculatePayouts(
      players,
      1000,
      config({ percentageThreshold: 15, gradient: 'top-heavy' }),
    );
    expect(out.size).toBe(2);
  });

  it('percentageThreshold ceil: 7 × 14% → 1 winner', () => {
    const players = Array.from({ length: 7 }, (_, i) => player(`p${i}`, 50 + i));
    const out = calculatePayouts(
      players,
      1000,
      config({ percentageThreshold: 14, gradient: 'top-heavy' }),
    );
    expect(out.size).toBe(1);
  });

  it('Math.max(1, ...) floor: 1 player + threshold 30 → still 1 winner', () => {
    const out = calculatePayouts(
      [player('solo', 50)],
      1000,
      config({ percentageThreshold: 30, gradient: 'top-heavy' }),
    );
    expect(out.size).toBe(1);
    expect(out.get('solo')).toBe(1000);
  });

  it('handles tied scores: paid winners count and sum are still correct', () => {
    const tied = [player('a', 50), player('b', 50), player('c', 60)];
    const out = calculatePayouts(
      tied,
      300,
      config({ percentageThreshold: 100, gradient: 'top-heavy' }),
    );
    expect(out.size).toBe(3);
    expect(sumValues(out)).toBe(300);
  });

  it('linear/equal-split branch: 4 winners share equally, last absorbs remainder', () => {
    // The else-branch in calculatePayouts is equal split, NOT a linear gradient.
    // pot=103, 4 winners, equal: floor(103/4)=25 each, last gets 103-25*3=28
    const players = Array.from({ length: 4 }, (_, i) => player(`p${i}`, 50 + i));
    const out = calculatePayouts(
      players,
      103,
      config({ percentageThreshold: 100, gradient: 'linear' }),
    );
    expect(out.get('p0')).toBe(25);
    expect(out.get('p1')).toBe(25);
    expect(out.get('p2')).toBe(25);
    expect(out.get('p3')).toBe(28);
    expect(sumValues(out)).toBe(103);
  });
});
