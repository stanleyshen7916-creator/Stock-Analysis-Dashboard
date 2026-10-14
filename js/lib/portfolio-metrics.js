// Portfolio metrics (v0.4.0, Issue #105) - deterministic functions computed
// only from a position (already recorded, Issue #103) and its current
// price (already fetched from Production market_daily elsewhere). Never
// fabricates a value: every function returns null wherever the current
// price - or, for Weight, the total portfolio market value - is not
// actually known, rather than guessing.

/**
 * Unrealized profit/loss for one position: (currentPrice - averageCost) *
 * shares. null when currentPrice isn't known yet.
 */
export function computeUnrealizedPnl(position, currentPrice) {
  if (currentPrice == null) return null;
  return (currentPrice - position.averageCost) * position.shares;
}

/**
 * Return (%) of one position relative to its average cost. null when
 * currentPrice isn't known, or averageCost is not a positive number (the
 * data-entry validation in portfolio.js already guarantees averageCost >
 * 0 for any recorded position, but this stays defensive rather than
 * assuming that invariant holds forever).
 */
export function computeReturnPercent(position, currentPrice) {
  if (currentPrice == null || !(position.averageCost > 0)) return null;
  return ((currentPrice - position.averageCost) / position.averageCost) * 100;
}

/**
 * Current market value of one position: currentPrice * shares. null when
 * currentPrice isn't known.
 */
export function computeMarketValue(position, currentPrice) {
  if (currentPrice == null) return null;
  return currentPrice * position.shares;
}

/**
 * Weight (%) of each position within the total market value of ONLY the
 * positions whose current price is actually known - a position missing a
 * price is excluded from both the numerator and the denominator, never
 * assigned a guessed weight and never silently folded into another
 * position's share. When every position's price is known, weights sum to
 * ~100%; when some are missing, they sum to ~100% of the *priced* subset
 * only - the caller is expected to make that partial-coverage caveat
 * visible, not this pure function's job.
 *
 * @param {Array<{symbol: string, shares: number}>} positions
 * @param {Map<string, number>} currentPriceBySymbol - symbol -> current price, entries only for symbols whose price is known.
 * @returns {Map<string, number|null>} symbol -> weight percent, or null when that symbol's price is unknown.
 */
export function computePortfolioWeights(positions, currentPriceBySymbol) {
  const marketValueBySymbol = new Map(
    positions.map((position) => [position.symbol, computeMarketValue(position, currentPriceBySymbol.get(position.symbol) ?? null)])
  );
  let totalMarketValue = 0;
  for (const marketValue of marketValueBySymbol.values()) {
    if (marketValue != null) totalMarketValue += marketValue;
  }

  const weightBySymbol = new Map();
  for (const [symbol, marketValue] of marketValueBySymbol) {
    weightBySymbol.set(symbol, marketValue != null && totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : null);
  }
  return weightBySymbol;
}
