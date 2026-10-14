// ETF 專區 metrics (step 1, 2026-09-29) - descriptive only, computed from
// data already verified elsewhere (market_daily OHLCV, corporate_actions).
// ETFs have no revenue/EPS, so the AI composite score and the Target
// Price engine do not apply; this module ranks and recommends nothing.
// Same rule as risk-analysis.js: null when there is not enough history,
// never a fabricated value.
//
// Inputs:
//   adjusted - records adjusted for splits and cash dividends
//              (buildAdjustedRecommendationRecords), so period returns are
//              total returns rather than price-only returns.
//   raw      - the same rows un-adjusted, used only for traded value
//              (the adjusted volume is rescaled, the NT$ traded is not).

import { computeHistoricalVolatility, classifyRiskTier } from './risk-analysis.js';

// Trading-day lengths for the period-return columns.
export const ETF_RETURN_PERIODS = { m1: 21, m3: 63, m6: 126, y1: 252 };
const TREND_MA_PERIOD = 60;
const TURNOVER_LOOKBACK = 20;
// A one-day move this large in an adjusted ETF series almost always means
// a split or reverse split the corporate_actions feed did not capture - the
// row is flagged rather than shown as a real return.
export const ETF_SUSPECT_DAILY_MOVE_PCT = 25;

function periodReturn(records, days) {
  if (records.length <= days) return null;
  const start = records[records.length - 1 - days].close;
  const end = records[records.length - 1].close;
  return start > 0 && end > 0 ? (end / start - 1) * 100 : null;
}

function maxDrawdownPct(records) {
  let peak = -Infinity;
  let worst = 0;
  for (const { close } of records) {
    if (close > peak) peak = close;
    if (peak > 0) worst = Math.min(worst, (close / peak - 1) * 100);
  }
  return worst;
}

function largestDailyMovePct(records) {
  let largest = 0;
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1].close;
    if (prev > 0) largest = Math.max(largest, Math.abs(records[i].close / prev - 1) * 100);
  }
  return largest;
}

/**
 * @param {{adjusted: Array<{tradingDate: string, close: number}>, raw: Array<{close: number, volume: number}>}} input
 *   both ascending by tradingDate.
 * @returns {object|null} null when there are no records at all.
 */
export function computeEtfMetrics({ adjusted, raw = adjusted }) {
  if (!Array.isArray(adjusted) || adjusted.length === 0) return null;
  const latest = adjusted[adjusted.length - 1];
  const returns = Object.fromEntries(Object.entries(ETF_RETURN_PERIODS).map(([key, days]) => [key, periodReturn(adjusted, days)]));

  const oneYear = adjusted.slice(-(ETF_RETURN_PERIODS.y1 + 1));
  const hasFullYear = adjusted.length > ETF_RETURN_PERIODS.y1;

  let ma60 = null;
  if (adjusted.length >= TREND_MA_PERIOD) {
    ma60 = adjusted.slice(-TREND_MA_PERIOD).reduce((sum, r) => sum + r.close, 0) / TREND_MA_PERIOD;
  }

  const turnoverRows = raw.slice(-TURNOVER_LOOKBACK).filter((r) => Number.isFinite(r.close) && Number.isFinite(r.volume));
  const avgTurnover = turnoverRows.length === TURNOVER_LOOKBACK
    ? turnoverRows.reduce((sum, r) => sum + r.close * r.volume, 0) / TURNOVER_LOOKBACK
    : null;

  const volatility = computeHistoricalVolatility(adjusted);
  const largestMove = largestDailyMovePct(oneYear);

  return {
    latestDate: latest.tradingDate,
    latestClose: raw[raw.length - 1]?.close ?? latest.close,
    tradingDays: adjusted.length,
    returns,
    // Over the last year only; null (not a partial-window figure) for an
    // ETF listed less than a year ago, so newer funds are not flattered.
    maxDrawdown1y: hasFullYear ? maxDrawdownPct(oneYear) : null,
    volatility,
    riskTier: classifyRiskTier(volatility),
    trend: ma60 == null ? 'UNKNOWN' : latest.close >= ma60 ? 'ABOVE_MA60' : 'BELOW_MA60',
    avgTurnover20: avgTurnover,
    suspectDiscontinuity: largestMove >= ETF_SUSPECT_DAILY_MOVE_PCT
  };
}
