// This is a vendored copy of src/indicators/index.mjs - the single
// project-owned indicator engine (Strategy C) - so the public/ directory is a
// self-contained, deployable static site (it must not reach outside itself
// for imports) without maintaining a second, separately-coded copy of the
// formulas (Issue #41). Do not hand-edit it - regenerate with
// `npm run sync:dashboard-vendor`; tests/dashboard-vendor-sync.test.js fails
// the build if it drifts from the canonical source.
import { sma, ema, rsi, macd, bollingerBands, atr, stochastic, obv } from '../../vendor/calc/indicators.js';

function toBusinessDay(tradingDate) {
  const [year, month, day] = tradingDate.split('-').map(Number);
  return { year, month, day };
}

export function buildCandlestickSeries(records) {
  return records.map((record) => ({
    time: toBusinessDay(record.tradingDate),
    open: record.open,
    high: record.high,
    low: record.low,
    close: record.close
  }));
}

export function buildVolumeSeries(records) {
  return records.map((record) => ({
    time: toBusinessDay(record.tradingDate),
    value: record.volume,
    color: record.close >= record.open ? '#26a69a' : '#ef5350'
  }));
}

/**
 * Only returns a series once there is enough history for the requested
 * period; the UI must not render a partially-computed MA line.
 */
export function buildMovingAverageSeries(records, period) {
  if (records.length < period) return [];
  const closes = records.map((record) => record.close);
  return toLineSeries(records, sma(closes, period));
}

/**
 * Only returns a series once there is enough history for the requested
 * period; the UI must not render a partially-computed RSI line.
 */
export function buildRsiSeries(records, period = 14) {
  if (records.length <= period) return [];
  const closes = records.map((record) => record.close);
  return toLineSeries(records, rsi(closes, period));
}

/**
 * EMA20 (v0.3.0, Issue #94) - TA-Lib cross-checked at this exact period
 * (docs/TA_LIB_CROSSCHECK.md's `ema20`). Only returns a series once there
 * is enough history for the requested period, same guard as the other
 * series here.
 */
export function buildEmaSeries(records, period = 20) {
  if (records.length < period) return [];
  const closes = records.map((record) => record.close);
  return toLineSeries(records, ema(closes, period));
}

function toLineSeries(records, values) {
  return records
    .map((record, index) => ({ time: toBusinessDay(record.tradingDate), value: values[index] }))
    .filter((point) => point.value !== null);
}

/**
 * Bollinger Bands (period 20, 2 standard deviations, matching MA_LONG_PERIOD).
 * upper/middle/lower always become non-null together (same window guard in
 * the engine), so they share the same set of timestamps once populated.
 * Only returns non-empty arrays once there is enough history.
 */
export function buildBollingerBandsSeries(records, period = 20, multiplier = 2) {
  if (records.length < period) return { upper: [], middle: [], lower: [] };
  const closes = records.map((record) => record.close);
  const { upper, middle, lower } = bollingerBands(closes, period, multiplier);
  return {
    upper: toLineSeries(records, upper),
    middle: toLineSeries(records, middle),
    lower: toLineSeries(records, lower)
  };
}

/**
 * MACD (12/26/9, the standard default periods). The three lines populate at
 * different points in the history (signal needs the macd line to exist
 * first, histogram needs both), so each is filtered independently rather
 * than assuming a shared length.
 */
export function buildMacdSeries(records, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (records.length < slowPeriod) return { macd: [], signal: [], histogram: [] };
  const closes = records.map((record) => record.close);
  const result = macd(closes, fastPeriod, slowPeriod, signalPeriod);
  return {
    macd: toLineSeries(records, result.macd),
    signal: toLineSeries(records, result.signal),
    histogram: toLineSeries(records, result.histogram)
  };
}

/**
 * Average True Range (period 14, the conventional default).
 */
export function buildAtrSeries(records, period = 14) {
  if (records.length <= period) return [];
  const values = atr(
    records.map((r) => r.high),
    records.map((r) => r.low),
    records.map((r) => r.close),
    period
  );
  return toLineSeries(records, values);
}

/**
 * Stochastic Oscillator / KD (9,3,3 - the conventional Taiwan "KD" default,
 * matching the engine's own default signature).
 */
export function buildStochasticSeries(records, kPeriod = 9, dPeriod = 3, smoothK = 3) {
  if (records.length < kPeriod) return { k: [], d: [] };
  const result = stochastic(
    records.map((r) => r.high),
    records.map((r) => r.low),
    records.map((r) => r.close),
    kPeriod,
    dPeriod,
    smoothK
  );
  return { k: toLineSeries(records, result.k), d: toLineSeries(records, result.d) };
}

/**
 * On-Balance Volume - cumulative from the first bar in the fetched series,
 * so its absolute value is only meaningful relative to itself within this
 * window, never compared across different fetch windows.
 */
export function buildObvSeries(records) {
  if (records.length === 0) return [];
  const values = obv(records.map((r) => r.close), records.map((r) => r.volume));
  return toLineSeries(records, values);
}

export function buildSummary(records) {
  if (records.length === 0) return null;
  const latest = records[records.length - 1];
  const previous = records.length > 1 ? records[records.length - 2] : null;
  const change = previous ? latest.close - previous.close : 0;
  const changePercent = previous && previous.close !== 0 ? (change / previous.close) * 100 : 0;
  return {
    symbol: latest.symbol,
    market: latest.market,
    latestTradingDate: latest.tradingDate,
    latestOpen: latest.open,
    latestHigh: latest.high,
    latestLow: latest.low,
    latestClose: latest.close,
    change,
    changePercent,
    volume: latest.volume,
    // Straight passthrough of what the data source actually reported for
    // the latest bar - never fabricated. Undefined/missing when the
    // upstream row didn't carry these fields, so the UI can omit them
    // rather than invent a value.
    source: latest.source,
    sourceTimestamp: latest.sourceTimestamp,
    lastCheckedAt: latest.lastCheckedAt
  };
}
