// Simulation performance & prediction-vs-reality (M5, "M5 → M7 Autonomous
// Execution Specification v1.0", Sections 4-9).
//
// Deliberately import-free (matches target-price.js/expected-return.js):
// every quantity here is derived from an already-fetched market_daily
// history array and, where a prediction is needed, the caller's own
// buildStockRecommendation() output - this module never computes a
// second Target Price/Expected Return itself. Historical "what would the
// engine have said as of date X" is achieved by the CALLER slicing
// records up to X and passing that to the existing engine
// (buildStockRecommendation() always treats records[records.length - 1]
// as "today" - see public/js/lib/recommendation-engine.js) - this module
// only provides the slicing/window helpers and the since-entry/
// prediction-outcome arithmetic, never a second recommendation engine.
//
// Never fabricates: every function returns null/'PENDING'/'UNAVAILABLE'
// (never 0, never a guessed value) wherever the underlying history is
// insufficient.

/**
 * Average Cost = Purchase Amount / Shares - the ONLY way this project
 * computes it (Section 5: "不得由 AI 猜測成本"). Throws on invalid input
 * rather than silently coercing or defaulting.
 */
export function computeAverageCost({ purchaseAmount, shares }) {
  if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
    throw new Error('purchaseAmount must be a positive number');
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    throw new Error('shares must be a positive number');
  }
  return purchaseAmount / shares;
}

/**
 * @param {Array<object>} records - normalized market_daily rows (see supabase-market-data-source.js's normalizeMarketDailyRow shape).
 * @param {string} date - 'YYYY-MM-DD', inclusive.
 */
export function sliceRecordsUpTo(records, date) {
  if (!Array.isArray(records)) return [];
  return records.filter((r) => r.tradingDate <= date);
}

/**
 * @param {Array<object>} records
 * @param {string} date - 'YYYY-MM-DD', inclusive.
 */
export function sliceRecordsSince(records, date) {
  if (!Array.isArray(records)) return [];
  return records.filter((r) => r.tradingDate >= date);
}

/**
 * Since-entry performance (Section 7): Highest/Lowest Price Since Entry,
 * Maximum Drawdown Since Entry (peak-to-trough on daily closes), current
 * Return %, and whether Target/Risk Price has been hit (high >= target /
 * low <= risk on any day since entry - these are daily OHLC bars, not
 * intraday ticks, so "hit" means the day's own high/low reached the
 * level, consistent with Target/Risk Price themselves being derived from
 * a Donchian Channel of daily highs/lows).
 *
 * @returns {object|null} null when there is no market_daily coverage on or after entryDate.
 */
export function computeSimulationPerformance({ records, entryDate, entryPrice, targetPrice = null, riskPrice = null }) {
  const since = sliceRecordsSince(records, entryDate);
  if (since.length === 0) return null;

  const highestSinceEntry = Math.max(...since.map((r) => r.high));
  const lowestSinceEntry = Math.min(...since.map((r) => r.low));
  const latest = since[since.length - 1];
  const currentPrice = latest.close;

  const hasEntryPrice = Number.isFinite(entryPrice) && entryPrice > 0;
  const pnlPerShare = hasEntryPrice ? currentPrice - entryPrice : null;
  const returnPercent = hasEntryPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : null;

  let peak = since[0].close;
  let maxDrawdownPercent = 0;
  for (const r of since) {
    if (r.close > peak) peak = r.close;
    const drawdown = ((peak - r.close) / peak) * 100;
    if (drawdown > maxDrawdownPercent) maxDrawdownPercent = drawdown;
  }

  return {
    entryDate,
    entryPrice: hasEntryPrice ? entryPrice : null,
    currentPrice,
    currentDate: latest.tradingDate,
    highestSinceEntry,
    lowestSinceEntry,
    maxDrawdownPercent,
    pnlPerShare,
    returnPercent,
    targetPriceHit: Number.isFinite(targetPrice) ? since.some((r) => r.high >= targetPrice) : null,
    riskPriceHit: Number.isFinite(riskPrice) ? since.some((r) => r.low <= riskPrice) : null
  };
}

const HORIZON_STATUS = { AVAILABLE: 'AVAILABLE', PENDING: 'PENDING', UNAVAILABLE: 'UNAVAILABLE' };

/**
 * Prediction vs Reality at a fixed N-trading-day horizon (Section 8/16):
 * Actual Future High/Low and Actual Future Close over the window
 * (predictionDate, predictionDate + tradingDaysAfter], and whether the
 * Target Price (and, if supplied, Risk Price) predicted as of
 * predictionDate was hit within that window.
 *
 * - UNAVAILABLE when the prediction itself had no Target Price (never
 *   evaluated against a guessed target).
 * - PENDING when fewer than tradingDaysAfter trading days have actually
 *   elapsed yet - never guessed forward.
 *
 * `riskPrice` is optional (M8-6, Issue #154) - existing callers that
 * don't pass it get `riskPriceHit`/`firstRiskHitDate` as null, unchanged
 * from before this was added.
 *
 * @param {Array<object>} records - the symbol's full known history (spanning both before and after predictionDate).
 * @param {number} [riskPrice]
 */
export function evaluateTargetPriceAtHorizon({ records, predictionDate, targetPrice, tradingDaysAfter, riskPrice = null }) {
  if (!Number.isFinite(targetPrice)) {
    return { status: HORIZON_STATUS.UNAVAILABLE, tradingDaysAfter, actualFutureHigh: null, actualFutureLow: null, actualFutureClose: null, actualDate: null, targetPriceHit: null, riskPriceHit: null, firstTargetHitDate: null, firstRiskHitDate: null };
  }

  const window = sliceRecordsSince(records, predictionDate)
    .filter((r) => r.tradingDate > predictionDate)
    .slice(0, tradingDaysAfter);

  if (window.length < tradingDaysAfter) {
    return { status: HORIZON_STATUS.PENDING, tradingDaysAfter, actualFutureHigh: null, actualFutureLow: null, actualFutureClose: null, actualDate: null, targetPriceHit: null, riskPriceHit: null, firstTargetHitDate: null, firstRiskHitDate: null };
  }

  const actualFutureHigh = Math.max(...window.map((r) => r.high));
  const actualFutureLow = Math.min(...window.map((r) => r.low));
  const actualFutureClose = window[window.length - 1].close;
  const targetHitDay = window.find((r) => r.high >= targetPrice) ?? null;
  const riskHitDay = Number.isFinite(riskPrice) ? window.find((r) => r.low <= riskPrice) ?? null : null;
  return {
    status: HORIZON_STATUS.AVAILABLE,
    tradingDaysAfter,
    actualFutureHigh,
    actualFutureLow,
    actualFutureClose,
    actualDate: window[window.length - 1].tradingDate,
    targetPriceHit: actualFutureHigh >= targetPrice,
    riskPriceHit: Number.isFinite(riskPrice) ? actualFutureLow <= riskPrice : null,
    firstTargetHitDate: targetHitDay?.tradingDate ?? null,
    firstRiskHitDate: riskHitDay?.tradingDate ?? null
  };
}

// Fixed evaluation horizons (Section 16: "至少分析 5/10/20 Trading Days") -
// not user-configurable, so every prediction record is comparable
// apples-to-apples.
export const PREDICTION_HORIZONS_TRADING_DAYS = [5, 10, 20];

/**
 * Convenience wrapper evaluating all of PREDICTION_HORIZONS_TRADING_DAYS
 * at once (Section 8's "Prediction vs Reality" record).
 * @returns {Record<number, object>} keyed by trading-day horizon.
 */
export function evaluatePredictionOutcomes({ records, predictionDate, targetPrice, riskPrice = null }) {
  const outcomes = {};
  for (const horizon of PREDICTION_HORIZONS_TRADING_DAYS) {
    outcomes[horizon] = evaluateTargetPriceAtHorizon({ records, predictionDate, targetPrice, tradingDaysAfter: horizon, riskPrice });
  }
  return outcomes;
}

// M8-6 (Issue #154) Simulation Validation Outcome - five states, always one
// of these, never a bare number presented as a verdict:
//   TARGET_REACHED      - Target Price was reached within the horizon
//                          (and, if Risk Price was also reached, Target
//                          was reached first - see the tie-break below).
//   RISK_TRIGGERED       - Risk Price was reached within the horizon
//                          (and reached no later than Target, if both
//                          were reached).
//   POSITIVE_NOT_TARGET  - neither hit, but the actual return at the
//                          horizon's close was positive.
//   NEGATIVE_NOT_RISK    - neither hit, and the actual return was zero
//                          or negative.
//   INSUFFICIENT_PERIOD  - the horizon result itself was PENDING/
//                          UNAVAILABLE (not enough trading days elapsed,
//                          or there was no Target Price to evaluate).
export const SIMULATION_OUTCOME = Object.freeze({
  TARGET_REACHED: 'TARGET_REACHED',
  RISK_TRIGGERED: 'RISK_TRIGGERED',
  POSITIVE_NOT_TARGET: 'POSITIVE_NOT_TARGET',
  NEGATIVE_NOT_RISK: 'NEGATIVE_NOT_RISK',
  INSUFFICIENT_PERIOD: 'INSUFFICIENT_PERIOD'
});

/**
 * Classifies one horizon's real outcome (Section 6 of the M8 spec) and
 * computes Maximum Favorable/Adverse Excursion - the best and worst
 * price the window actually reached relative to the reference price,
 * expressed as a %. Never invents an outcome from a PENDING/UNAVAILABLE
 * horizon result - that always classifies as INSUFFICIENT_PERIOD.
 *
 * Tie-break when both Target and Risk were reached in the same window
 * (real daily OHLC bars don't reveal intraday order of events): the
 * earlier trading day wins by real date comparison; a genuine same-day
 * tie resolves to RISK_TRIGGERED, the conservative reading - consistent
 * with M6's holding-risk.js precedent of risk conditions taking priority
 * in its own state machine, not an arbitrary new rule.
 *
 * @param {object} horizonResult - an evaluateTargetPriceAtHorizon() result, called WITH riskPrice for a real riskPriceHit determination.
 * @param {number} referencePrice - the price Expected Return/MFE/MAE are measured against (the prediction's own reference price).
 */
export function classifySimulationOutcome({ horizonResult, referencePrice }) {
  if (horizonResult.status !== HORIZON_STATUS.AVAILABLE) {
    return { outcome: SIMULATION_OUTCOME.INSUFFICIENT_PERIOD, actualReturnPercent: null, maximumFavorableExcursionPercent: null, maximumAdverseExcursionPercent: null };
  }
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    throw new Error('referencePrice must be a positive number');
  }

  const actualReturnPercent = ((horizonResult.actualFutureClose - referencePrice) / referencePrice) * 100;
  const maximumFavorableExcursionPercent = ((horizonResult.actualFutureHigh - referencePrice) / referencePrice) * 100;
  const maximumAdverseExcursionPercent = ((horizonResult.actualFutureLow - referencePrice) / referencePrice) * 100;

  let outcome;
  if (horizonResult.targetPriceHit && horizonResult.riskPriceHit) {
    outcome = horizonResult.firstRiskHitDate <= horizonResult.firstTargetHitDate ? SIMULATION_OUTCOME.RISK_TRIGGERED : SIMULATION_OUTCOME.TARGET_REACHED;
  } else if (horizonResult.riskPriceHit) {
    outcome = SIMULATION_OUTCOME.RISK_TRIGGERED;
  } else if (horizonResult.targetPriceHit) {
    outcome = SIMULATION_OUTCOME.TARGET_REACHED;
  } else if (actualReturnPercent > 0) {
    outcome = SIMULATION_OUTCOME.POSITIVE_NOT_TARGET;
  } else {
    outcome = SIMULATION_OUTCOME.NEGATIVE_NOT_RISK;
  }

  return { outcome, actualReturnPercent, maximumFavorableExcursionPercent, maximumAdverseExcursionPercent };
}
