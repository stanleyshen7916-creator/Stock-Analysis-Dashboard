// Risk Analysis (v0.3.0, Issue #88) - deterministic, rule-based risk metrics
// computed only from data already verified elsewhere on the page
// (market_daily OHLCV, data-quality.js, corporate_actions). Same pattern as
// technical-summary.js: fixed formulas/thresholds, UNKNOWN/null when there
// is not enough data, never a fabricated or guessed value, no composite
// weighted "risk score" (that would need a product decision - out of
// Issue #88's scope).
//
// Data -> Calculation -> Risk Signal:
//   Data:        records (verified market_daily rows), dataQuality
//                (data-quality.js output), corporateActions (verified events)
//   Calculation: historical volatility, max drawdown - deterministic formulas
//   Risk Signal: volume anomaly / data quality risk / corporate action risk
//                classifications - fixed thresholds, documented below and in
//                docs/CALCULATION_ENGINE.md

const VOLATILITY_LOOKBACK = 20; // trading days, matches VOLUME_LOOKBACK/MA_LONG_PERIOD elsewhere
const TRADING_DAYS_PER_YEAR = 252; // standard annualization factor
const VOLUME_ANOMALY_RATIO = 3; // stricter than technical-summary's 1.2x "above average" - an anomaly is a much larger deviation, not routine fluctuation
const CORPORATE_ACTION_RISK_WINDOW_DAYS = 30;

/**
 * Annualized historical volatility (%) from daily log returns over the last
 * `lookback` trading days. Standard deviation of log returns * sqrt(252) is
 * the conventional annualization used across quantitative finance. Returns
 * null (not a fabricated 0) when there isn't enough history, or when any
 * close in the window is non-positive (log undefined).
 */
export function computeHistoricalVolatility(records, lookback = VOLATILITY_LOOKBACK) {
  if (!records || records.length < lookback + 1) return null;
  const window = records.slice(records.length - lookback - 1);
  const logReturns = [];
  for (let i = 1; i < window.length; i++) {
    const prevClose = window[i - 1].close;
    const close = window[i].close;
    if (!(prevClose > 0) || !(close > 0)) return null;
    logReturns.push(Math.log(close / prevClose));
  }
  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / logReturns.length;
  const dailyStdDev = Math.sqrt(variance);
  return dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
}

/**
 * Maximum drawdown (%) over the full loaded history: the largest
 * peak-to-trough decline in closing price. Returned as a negative number
 * (e.g. -18.23 means an 18.23% decline from the running peak). Returns null
 * when there are fewer than 2 records (no drawdown is measurable).
 */
export function computeMaxDrawdown(records) {
  if (!records || records.length < 2) return null;
  let peak = records[0].close;
  let maxDrawdown = 0;
  for (const record of records) {
    if (record.close > peak) peak = record.close;
    if (peak > 0) {
      const drawdown = ((record.close - peak) / peak) * 100;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

/**
 * Flags today's volume as an outlier against its own recent history: latest
 * volume >= VOLUME_ANOMALY_RATIO times the average of the preceding
 * `lookback` days. This is a materially stricter multiplier than
 * technical-summary.js's "above average" (1.2x) - that threshold flags
 * routine above-average activity; this one flags a genuine outlier.
 */
export function classifyVolumeAnomaly(records, lookback = VOLATILITY_LOOKBACK, anomalyRatio = VOLUME_ANOMALY_RATIO) {
  if (!records || records.length < lookback + 1) return 'UNKNOWN';
  const window = records.slice(records.length - 1 - lookback, records.length - 1);
  const latestVolume = records[records.length - 1].volume;
  const averageVolume = window.reduce((sum, r) => sum + r.volume, 0) / lookback;
  if (averageVolume === 0) return 'UNKNOWN';
  return latestVolume >= averageVolume * anomalyRatio ? 'ANOMALY' : 'NORMAL';
}

/**
 * Reuses data-quality.js's already-computed assessment rather than
 * re-deriving it. ELEVATED when any provenance field is missing on the
 * latest row (a real traceability gap) - not when supplementary data is
 * merely UNKNOWN/still loading, since that is not itself a market_daily
 * data-quality problem.
 */
export function classifyDataQualityRisk(dataQuality) {
  if (!dataQuality) return 'UNKNOWN';
  return dataQuality.missingFields.length > 0 ? 'ELEVATED' : 'LOW';
}

/**
 * Flags a recent corporate-action event (ex-dividend/adjustment) within
 * CORPORATE_ACTION_RISK_WINDOW_DAYS of the latest trading date - not a
 * danger signal, but a caveat that a recent price-series discontinuity from
 * an adjustment (not organic market movement) may affect how other metrics
 * on this page (e.g. momentum, drawdown) should be read. corporateActions
 * follows data-quality.js's UNKNOWN/UNAVAILABLE convention: null/undefined
 * means the fetch hasn't completed or failed, [] means confirmed no events.
 */
export function classifyCorporateActionRisk(corporateActions, latestTradingDate, windowDays = CORPORATE_ACTION_RISK_WINDOW_DAYS) {
  if (corporateActions == null || !latestTradingDate) return 'UNKNOWN';
  if (corporateActions.length === 0) return 'NONE';
  const latestMs = Date.parse(latestTradingDate);
  if (Number.isNaN(latestMs)) return 'UNKNOWN';
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const hasRecentEvent = corporateActions.some((event) => {
    const eventMs = Date.parse(event.effectiveDate);
    return Number.isFinite(eventMs) && Math.abs(latestMs - eventMs) <= windowMs;
  });
  return hasRecentEvent ? 'RECENT_EVENT' : 'NONE';
}

// Risk Tier (Phase-2 roadmap item "風險分級／強勢股標示", 2026-09-23) -
// absolute volatility bucketing from computeHistoricalVolatility() above
// (annualized %, already used by the Stock Detail Risk panel), NOT
// classifyVolatility()'s EXPANDING/CONTRACTING/STABLE (that classifies the
// TREND of volatility relative to its own recent average, not how volatile
// a stock inherently is - a different question). Thresholds are this
// project's own choice, confirmed with Stanley 2026-09-23 (not a value
// derived from an external standard): <30% LOW, 30-60% MEDIUM, >=60% HIGH,
// matching typical TWSE/TPEx large-cap vs. small-cap/momentum-stock ranges.
// UNKNOWN (not a guessed tier) when there isn't enough history to compute
// historicalVolatility at all.
const RISK_TIER_LOW_MAX = 30;
const RISK_TIER_MEDIUM_MAX = 60;

export function classifyRiskTier(historicalVolatility) {
  if (!Number.isFinite(historicalVolatility)) return 'UNKNOWN';
  if (historicalVolatility < RISK_TIER_LOW_MAX) return 'LOW';
  if (historicalVolatility < RISK_TIER_MEDIUM_MAX) return 'MEDIUM';
  return 'HIGH';
}

/**
 * "強勢股" (momentum stock) flag - reuses technical-summary.js's own
 * trend (price vs 20MA) and momentum (5-day change) classifications
 * exactly as investment-horizon.js's classifyShortMediumTerm() already
 * does for its "aligned" check, never a new formula. true only when BOTH
 * are UP (not just one, and not merely non-DOWN) - a real, unambiguous
 * momentum signal. null (not false) when either input is UNKNOWN, since
 * "not enough data" must never look identical to "checked and not
 * momentum".
 */
export function classifyMomentumFlag({ trend, momentum }) {
  if (trend === 'UNKNOWN' || momentum === 'UNKNOWN' || trend == null || momentum == null) return null;
  return trend === 'UP' && momentum === 'UP';
}

/**
 * @param {object} params
 * @param {Array} params.records - market_daily rows for the current symbol, oldest first.
 * @param {object|null} params.dataQuality - buildDataQuality() output.
 * @param {Array|null} params.corporateActions - fetched corporate-action events (see data-quality.js status convention).
 * @returns {object|null} null when there is no market data at all.
 */
export function buildRiskAssessment({ records, dataQuality, corporateActions }) {
  if (!records || records.length === 0) return null;

  return {
    historicalVolatility: computeHistoricalVolatility(records),
    maxDrawdown: computeMaxDrawdown(records),
    volumeAnomaly: classifyVolumeAnomaly(records),
    dataQualityRisk: classifyDataQualityRisk(dataQuality),
    corporateActionRisk: classifyCorporateActionRisk(corporateActions, records[records.length - 1].tradingDate)
  };
}
