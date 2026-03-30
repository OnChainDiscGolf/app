/**
 * @file payoutCalculations.ts
 * @description Payout distribution algorithms for disc golf round prize pools.
 *
 * Supports two distribution strategies:
 * - **Top-heavy**: Winner gets a disproportionately large share, using
 *   hardcoded ratios for 2-5 players and a harmonic decay formula
 *   `weight = 1 / (rank + 1)` for larger groups.
 * - **Linear**: Equal step-down distribution using weights `numWinners - rank`,
 *   producing a straight-line gradient favoring top positions.
 *
 * The main entry point is {@link calculatePayouts} which sorts players by
 * score, determines the number of winners from a percentage threshold,
 * and distributes the pot using the chosen gradient. Rounding loss is
 * given to the last-place winner.
 */

import { Player, PayoutConfig } from '../types';

/**
 * Generate top-heavy payout distribution percentages.
 *
 * For 2-5 winners, returns hardcoded ratios that give the winner 50-75% of
 * the pot. For larger groups, uses harmonic decay: `weight(rank) = 1 / (rank + 1)`,
 * normalized so all weights sum to 1.0.
 *
 * @param numWinners - Number of players receiving payouts.
 * @returns Array of percentages (summing to ~1.0) ordered by rank (index 0 = 1st place).
 *
 * @example
 * ```ts
 * getTopHeavyDistribution(3) // [0.60, 0.25, 0.15]
 * ```
 */
export function getTopHeavyDistribution(numWinners: number): number[] {
  if (numWinners <= 1) return [1.0];

  // Standard top-heavy distributions for common small player counts
  // Adjusted to be more "loaded at the top"
  const distributions: Record<number, number[]> = {
    2: [0.75, 0.25],                  // Winner takes 3x second place
    3: [0.60, 0.25, 0.15],            // Winner takes >2x second place
    4: [0.50, 0.25, 0.15, 0.10],      // Winner takes half the pot
    5: [0.45, 0.25, 0.15, 0.10, 0.05] // Winner takes nearly half
  };

  if (distributions[numWinners]) {
    return distributions[numWinners];
  }

  // For larger groups, use a steeper decay formula: weight = 1 / (rank + 1)
  // This is steeper than the previous (rank + 1.5)
  const weights = [];
  let totalWeight = 0;
  for (let i = 0; i < numWinners; i++) {
    const weight = 1 / (i + 1.0);
    weights.push(weight);
    totalWeight += weight;
  }

  return weights.map(w => w / totalWeight);
}

/**
 * Generate linear payout distribution percentages.
 *
 * Each position receives a linearly decreasing weight: `weight(rank) = numWinners - rank`.
 * For 3 winners, weights are [3, 2, 1], producing percentages [50%, 33%, 17%].
 * Still favors top positions but with a constant step-down rather than exponential decay.
 *
 * @param numWinners - Number of players receiving payouts.
 * @returns Array of percentages (summing to ~1.0) ordered by rank (index 0 = 1st place).
 *
 * @example
 * ```ts
 * getLinearDistribution(3) // [0.5, 0.333, 0.167]
 * ```
 */
export function getLinearDistribution(numWinners: number): number[] {
  if (numWinners <= 1) return [1.0];

  // Linear distribution with steep gradient
  // Each position gets incrementally less, but the decrease is constant (linear)
  // Example for 3 winners: if we use weights [3, 2, 1] then percentages are [50%, 33%, 17%]

  const weights = [];
  let totalWeight = 0;

  for (let i = 0; i < numWinners; i++) {
    // Linear decay: start high and decrease by a constant amount
    // Weight = (numWinners - rank)
    const weight = numWinners - i;
    weights.push(weight);
    totalWeight += weight;
  }

  return weights.map(w => w / totalWeight);
}

/**
 * Calculate the payout distribution for a finished round.
 *
 * Players are sorted by `totalScore` ascending (lowest score wins in disc golf).
 * The number of paid positions is determined by `config.percentageThreshold`
 * (default 30%), meaning the top 30% of players split the pot. If no config
 * is provided or `totalPot` is zero, the winner takes all.
 *
 * Distribution modes:
 * - `'winner-take-all'` - First place gets everything.
 * - `'top-heavy'` - Uses {@link getTopHeavyDistribution} percentages.
 * - Any other (linear) - Equal per-winner share.
 *
 * Rounding loss from `Math.floor()` is absorbed by the last-place winner.
 *
 * @param players - Array of players with `id` and `totalScore`.
 * @param totalPot - Total prize pool in sats.
 * @param config - Optional payout configuration (mode, gradient, threshold).
 * @returns A Map from player ID to payout amount in sats.
 */
export function calculatePayouts(
  players: Player[],
  totalPot: number,
  config?: PayoutConfig
): Map<string, number> {
  if (!config || totalPot === 0) {
    // Default: winner takes all
    const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);
    return new Map([[sortedPlayers[0].id, totalPot]]);
  }

  // Sort players by score (ascending - lower is better)
  const sortedPlayers = [...players].sort((a, b) => a.totalScore - b.totalScore);

  if (config.mode === 'winner-take-all') {
    return new Map([[sortedPlayers[0].id, totalPot]]);
  }

  // Calculate number of winners based on percentage
  const numWinners = Math.max(1, Math.ceil(players.length * ((config.percentageThreshold || 30) / 100)));
  const winners = sortedPlayers.slice(0, numWinners);

  const payouts = new Map<string, number>();

  if (config.gradient === 'top-heavy') {
    const percentages = getTopHeavyDistribution(winners.length);

    // Distribute based on percentages, tracking remainder to avoid rounding loss
    let distributed = 0;
    winners.forEach((player, idx) => {
      if (idx === winners.length - 1) {
        // Last winner gets the remainder
        payouts.set(player.id, totalPot - distributed);
      } else {
        const amount = Math.floor(totalPot * percentages[idx]);
        payouts.set(player.id, amount);
        distributed += amount;
      }
    });
  } else {
    // Linear: Equal distribution
    const amountPerWinner = Math.floor(totalPot / winners.length);
    let distributed = 0;
    winners.forEach((player, idx) => {
      if (idx === winners.length - 1) {
        payouts.set(player.id, totalPot - distributed);
      } else {
        payouts.set(player.id, amountPerWinner);
        distributed += amountPerWinner;
      }
    });
  }

  return payouts;
}
