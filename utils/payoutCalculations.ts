import { Player, PayoutConfig } from '../types';

// Helper to generate top-heavy distribution percentages
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

// Helper to generate linear (flat but steep) distribution percentages
// This creates a LINEAR gradient rather than exponential, but still favors top positions
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

// Helper function to calculate payout distribution based on configuration
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
