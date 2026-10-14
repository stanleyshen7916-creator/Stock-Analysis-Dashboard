// Algorithm Validation (M7 Phase 1, "M5 → M7 Autonomous Execution
// Specification v1.0", Sections 15-17, Issue #148) - measures the
// EXISTING, unmodified recommendation algorithm's real predictions
// against real subsequent market_daily outcomes. Never adjusts the
// algorithm itself (Section 21: AI proposes, Stanley decides) - this
// module only produces the measurement.
//
// Deliberately import-free (matches every other src/analysis/*.js
// module): receives already-computed decision states / signal outcomes
// as parameters, never re-derives them. Target Price accuracy itself
// reuses src/analysis/simulation.js's evaluateTargetPriceAtHorizon()
// unmodified (the caller composes both - see scripts/validate-algorithm.mjs) -
// never a second comparison formula for the same question.
//
// Every statistic here is reported alongside its real sample size -
// 'INSUFFICIENT_SAMPLE' is a real, honest state (never silently presented
// as a confident result from too few observations). MIN_SAMPLE_SIZE (30)
// is the conventional rule-of-thumb minimum for a stable sample mean/
// proportion estimate - standard statistical practice, not a number
// invented for this feature.

export const MIN_SAMPLE_SIZE = 30;

function average(values) {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

// Standard middle-value median (even-length sets average the two middle
// values) - a real, textbook definition, not invented for this feature.
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function summarizeReturns(returns) {
  return {
    sampleSize: returns.length,
    status: returns.length >= MIN_SAMPLE_SIZE ? 'AVAILABLE' : 'INSUFFICIENT_SAMPLE',
    averageReturnPercent: average(returns),
    medianReturnPercent: median(returns)
  };
}

const DECISION_STATES = ['INVESTABLE_CANDIDATE', 'OBSERVATION', 'NOT_QUALIFIED'];

/**
 * Section 16 "Stock Selection": average subsequent return for symbols the
 * algorithm actually classified INVESTABLE_CANDIDATE, vs OBSERVATION, vs
 * NOT_QUALIFIED - checks whether the algorithm's own ranking actually
 * correlates with real outperformance, at whatever horizon the caller's
 * observations were measured at.
 * @param {Array<{decisionState: string, subsequentReturnPercent: number|null}>} observations
 */
export function summarizeStockSelectionPerformance(observations) {
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');
  const groups = Object.fromEntries(DECISION_STATES.map((state) => [state, []]));
  for (const obs of observations) {
    if (groups[obs.decisionState] && Number.isFinite(obs.subsequentReturnPercent)) {
      groups[obs.decisionState].push(obs.subsequentReturnPercent);
    }
  }
  return Object.fromEntries(DECISION_STATES.map((state) => [state, summarizeReturns(groups[state])]));
}

/**
 * Section 16 ">30% Rule": does Expected Return > threshold actually
 * correlate with a higher subsequent return than the rest? Never removes
 * or adjusts the threshold here - only measures; any change is Stanley's
 * decision (Section 21), and Section 21 explicitly forbids deleting the
 * threshold just because a single measurement looks unfavorable.
 * @param {Array<{expectedReturnPercent: number|null, subsequentReturnPercent: number|null}>} observations
 * @param {number} [threshold] - defaults to the Locked Baseline's own 30% (Issue #130), never re-invented here.
 */
export function summarizeThresholdRuleCorrelation(observations, threshold = 30) {
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');
  const above = [];
  const belowOrEqual = [];
  for (const obs of observations) {
    if (!Number.isFinite(obs.expectedReturnPercent) || !Number.isFinite(obs.subsequentReturnPercent)) continue;
    (obs.expectedReturnPercent > threshold ? above : belowOrEqual).push(obs.subsequentReturnPercent);
  }
  return { threshold, above: summarizeReturns(above), belowOrEqual: summarizeReturns(belowOrEqual) };
}

// M8-7 (Issue #154): Investment Horizon suitability categories -
// investment-horizon.js's own real classify* outputs (Issue #128),
// never re-invented here. NOT_CLASSIFIED covers "insufficient data at
// that date" (never silently dropped or guessed into a category).
const HORIZON_CATEGORIES = ['DAY_TRADING', 'SHORT_MEDIUM_TERM', 'LONG_TERM', 'NOT_CLASSIFIED'];

/**
 * Section 16/M8-7 "Investment Horizon": does a symbol's real Investment
 * Horizon classification (當沖/中短期/長期 suitability, from
 * investment-horizon.js, replayed as of the prediction date) actually
 * correlate with real subsequent performance at the horizon that
 * category itself implies (short for day-trading, longer for
 * long-term)? The caller measures each observation at whichever
 * trading-day horizon matches its own category - this function only
 * groups and averages, never picks the horizon itself.
 * @param {Array<{horizonCategory: string, subsequentReturnPercent: number|null}>} observations
 */
export function summarizeHorizonPerformance(observations) {
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');
  const groups = Object.fromEntries(HORIZON_CATEGORIES.map((category) => [category, []]));
  for (const obs of observations) {
    if (groups[obs.horizonCategory] && Number.isFinite(obs.subsequentReturnPercent)) {
      groups[obs.horizonCategory].push(obs.subsequentReturnPercent);
    }
  }
  return Object.fromEntries(HORIZON_CATEGORIES.map((category) => [category, summarizeReturns(groups[category])]));
}

/**
 * Section 17 Indicator Validation: Hit Rate (precision - of the times
 * this signal fired, how often was the subsequent move actually
 * positive), False Positive count (fired but move was not positive),
 * False Negative count (didn't fire but move was positive anyway - a
 * missed opportunity, not an error the signal claimed).
 * @param {Array<{signalFired: boolean, subsequentReturnPercent: number|null}>} observations
 */
export function summarizeIndicatorAccuracy(observations) {
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');
  let truePositive = 0, falsePositive = 0, trueNegative = 0, falseNegative = 0;
  for (const obs of observations) {
    if (!Number.isFinite(obs.subsequentReturnPercent)) continue;
    const actuallyPositive = obs.subsequentReturnPercent > 0;
    if (obs.signalFired && actuallyPositive) truePositive += 1;
    else if (obs.signalFired && !actuallyPositive) falsePositive += 1;
    else if (!obs.signalFired && actuallyPositive) falseNegative += 1;
    else trueNegative += 1;
  }
  const sampleSize = truePositive + falsePositive + trueNegative + falseNegative;
  const firedCount = truePositive + falsePositive;
  return {
    sampleSize,
    status: sampleSize >= MIN_SAMPLE_SIZE ? 'AVAILABLE' : 'INSUFFICIENT_SAMPLE',
    hitRate: firedCount > 0 ? truePositive / firedCount : null,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative
  };
}

/**
 * M8-9 (Section 16, Issue #154): the algorithm-level report - every
 * metric Section 16 names (Sample Count/Win Rate/Target Hit Rate/Risk
 * Trigger Rate/Average Return/Median Return/Max Drawdown/False Positive
 * Rate/False Negative Rate) in one place, distinct from the per-decision-
 * state (summarizeStockSelectionPerformance) and per-indicator
 * (summarizeIndicatorAccuracy) breakdowns above.
 *
 * "Max Drawdown" here is the single worst (most negative) Maximum
 * Adverse Excursion observed across every evaluated prediction - the
 * real worst-case real drawdown any one real prediction actually
 * suffered before its horizon closed, not a synthesized equity-curve
 * drawdown (these predictions are independent per-symbol horizons, not
 * a single continuously-held position).
 *
 * False Positive/Negative Rate treat the algorithm's own
 * INVESTABLE_CANDIDATE classification as the "signal" being evaluated,
 * exactly parallel to how summarizeIndicatorAccuracy scores each
 * technical signal - reuses that same TP/FP/TN/FN counting rather than a
 * second confusion-matrix implementation. Standard definitions: FPR =
 * FP / (FP + TN) (share of real non-positive outcomes the algorithm
 * still flagged investable), FNR = FN / (FN + TP) (share of real
 * positive outcomes the algorithm failed to flag).
 *
 * @param {Array<{decisionState: string, subsequentReturnPercent: number|null, targetPriceHit: boolean|null, riskPriceHit: boolean|null, maximumAdverseExcursionPercent: number|null}>} observations
 */
export function summarizeAlgorithmValidationMetrics(observations) {
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');

  const returns = observations.map((o) => o.subsequentReturnPercent).filter((v) => Number.isFinite(v));
  const targetHits = observations.map((o) => o.targetPriceHit).filter((v) => typeof v === 'boolean');
  const riskHits = observations.map((o) => o.riskPriceHit).filter((v) => typeof v === 'boolean');
  const mae = observations.map((o) => o.maximumAdverseExcursionPercent).filter((v) => Number.isFinite(v));

  const returnsSummary = summarizeReturns(returns);
  const confusion = summarizeIndicatorAccuracy(
    observations.map((o) => ({ signalFired: o.decisionState === 'INVESTABLE_CANDIDATE', subsequentReturnPercent: o.subsequentReturnPercent }))
  );
  const actualNegativeCount = confusion.falsePositive + confusion.trueNegative;
  const actualPositiveCount = confusion.falseNegative + confusion.truePositive;

  return {
    sampleSize: returnsSummary.sampleSize,
    status: returnsSummary.status,
    winRate: returns.length > 0 ? returns.filter((r) => r > 0).length / returns.length : null,
    targetHitRate: targetHits.length > 0 ? targetHits.filter(Boolean).length / targetHits.length : null,
    riskTriggerRate: riskHits.length > 0 ? riskHits.filter(Boolean).length / riskHits.length : null,
    averageReturnPercent: returnsSummary.averageReturnPercent,
    medianReturnPercent: returnsSummary.medianReturnPercent,
    maxDrawdownPercent: mae.length > 0 ? Math.min(...mae) : null,
    falsePositiveRate: actualNegativeCount > 0 ? confusion.falsePositive / actualNegativeCount : null,
    falseNegativeRate: actualPositiveCount > 0 ? confusion.falseNegative / actualPositiveCount : null
  };
}
