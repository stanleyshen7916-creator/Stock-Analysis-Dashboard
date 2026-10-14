// M9 (Long-Term Historical Data & Trend Analysis) Long-Term Metrics
// (Section 11/12) - pure functions over already-fetched market_daily
// records (ascending by tradingDate, same shape every other src/analysis/
// module already expects). No network calls. Every metric honestly
// reports INSUFFICIENT_DATA rather than a guessed/padded value when the
// real history doesn't reach far enough back (Section 12: "期間不足時：
// 資料不足，不得補值").
//
// No new arbitrary thresholds invented: every formula below is a
// standard, textbook definition (period return, CAGR, peak-to-trough
// drawdown, annualized volatility from daily log returns, calendar-year
// return) - the same "no invented numbers" discipline this project has
// applied to every prior analysis module (Donchian Channel, MACD, ATR,
// MIN_SAMPLE_SIZE=30, ...).

const TRADING_DAYS_PER_YEAR = 252; // standard convention, matches this project's own annualization precedent nowhere contradicted elsewhere.
const LONG_TERM_TREND_MA_PERIOD = 200; // the canonical "long-term trend" moving average - same role SMA20 already plays for the short-term Trend signal in technical-summary.js's classifyTrend(), applied at the standard long-term period instead of a new one invented for this module.

// Deliberately not imported from src/indicators/index.mjs's own sma():
// this file is byte-copied verbatim into public/vendor/calc/ (Issue #41's
// established vendor-sync mechanism does no import-path rewriting), the
// same reason every other already-vendored src/analysis/*.js file is
// self-contained with zero cross-file imports. A plain windowed average
// is not a second calculation engine - there is no formula here to
// diverge from indicators/index.mjs's own (identical) implementation.
function simpleMovingAverage(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const window = values.slice(i - period + 1, i + 1);
    if (window.every(Number.isFinite)) out[i] = window.reduce((a, b) => a + b, 0) / period;
  }
  return out;
}

function isoDateYearsBefore(dateString, years) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

/**
 * Finds the record on or immediately after a target date - the standard
 * way to anchor an "N years ago" price when the exact calendar date
 * wasn't a trading day (weekend/holiday).
 */
function findRecordOnOrAfter(records, targetDate) {
  return records.find((r) => r.tradingDate >= targetDate) ?? null;
}

/**
 * @param {Array<{tradingDate: string, close: number}>} records - ascending by tradingDate.
 * @param {number} years
 * @param {string} asOfDate - 'YYYY-MM-DD', the "today" the return is measured as of.
 */
export function computePeriodReturn(records, years, asOfDate) {
  if (!records || records.length === 0) return { status: 'INSUFFICIENT_DATA', years, returnPercent: null };
  const latest = records[records.length - 1];
  const targetDate = isoDateYearsBefore(asOfDate, years);
  // The earliest record we actually have must reach back to (or past) the
  // target date - otherwise "the oldest record we happen to have" would
  // silently stand in for "N years ago", understating how far back the
  // real history goes.
  if (records[0].tradingDate > targetDate) return { status: 'INSUFFICIENT_DATA', years, returnPercent: null };
  const anchor = findRecordOnOrAfter(records, targetDate);
  if (!anchor || anchor.tradingDate === latest.tradingDate) return { status: 'INSUFFICIENT_DATA', years, returnPercent: null };
  const returnPercent = ((latest.close - anchor.close) / anchor.close) * 100;
  return { status: 'AVAILABLE', years, returnPercent, fromDate: anchor.tradingDate, toDate: latest.tradingDate };
}

/**
 * Compound Annual Growth Rate over the full available record span, only
 * when that span reaches at least 1 year - a CAGR computed over a few
 * weeks would wildly amplify noise into a nonsensical annualized figure,
 * so it is honestly withheld rather than reported misleadingly.
 */
export function computeCAGR(records) {
  if (!records || records.length < 2) return { status: 'INSUFFICIENT_DATA', cagrPercent: null };
  const first = records[0];
  const last = records[records.length - 1];
  const years = (Date.parse(`${last.tradingDate}T00:00:00Z`) - Date.parse(`${first.tradingDate}T00:00:00Z`)) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) return { status: 'INSUFFICIENT_DATA', cagrPercent: null };
  if (first.close <= 0) return { status: 'INSUFFICIENT_DATA', cagrPercent: null };
  const cagrPercent = ((last.close / first.close) ** (1 / years) - 1) * 100;
  return { status: 'AVAILABLE', cagrPercent, years, fromDate: first.tradingDate, toDate: last.tradingDate };
}

/**
 * Standard peak-to-trough maximum drawdown over the full given series -
 * a different formula from simulation.js's computeSimulationPerformance()
 * (which measures drawdown from one fixed ENTRY price, for a specific
 * simulated position), not a duplicate of it: this measures the worst
 * decline from any running peak across an arbitrary multi-year series.
 */
export function computeMaxDrawdown(records) {
  if (!records || records.length === 0) return { status: 'INSUFFICIENT_DATA', maxDrawdownPercent: null };
  let peak = records[0].close;
  let maxDrawdownPercent = 0;
  for (const r of records) {
    if (r.close > peak) peak = r.close;
    const drawdown = ((peak - r.close) / peak) * 100;
    if (drawdown > maxDrawdownPercent) maxDrawdownPercent = drawdown;
  }
  return { status: 'AVAILABLE', maxDrawdownPercent };
}

/**
 * Annualized volatility from daily log returns (stdev * sqrt(252)) - the
 * standard textbook definition, distinct from risk-analysis.js's
 * Historical Volatility (a shorter-window, differently-scoped classifier
 * for the per-symbol Risk panel) since this measures the FULL long-term
 * series, not a rolling short-term window.
 */
export function computeAnnualizedVolatility(records) {
  if (!records || records.length < 30) return { status: 'INSUFFICIENT_DATA', volatilityPercent: null };
  const logReturns = [];
  for (let i = 1; i < records.length; i += 1) {
    const prev = records[i - 1].close;
    const curr = records[i].close;
    if (prev > 0 && curr > 0) logReturns.push(Math.log(curr / prev));
  }
  if (logReturns.length < 2) return { status: 'INSUFFICIENT_DATA', volatilityPercent: null };
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
  const dailyStdDev = Math.sqrt(variance);
  const volatilityPercent = dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
  return { status: 'AVAILABLE', volatilityPercent };
}

/**
 * Each real calendar year present in the records: return = last close of
 * that year / first close of that year - 1. A year with only one
 * trading day recorded returns 0%, not INSUFFICIENT - it is a real,
 * if uninteresting, computed value, never fabricated.
 */
export function computeYearlyReturns(records) {
  if (!records || records.length === 0) return [];
  const byYear = new Map();
  for (const r of records) {
    const year = r.tradingDate.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(r);
  }
  return [...byYear.entries()].map(([year, yearRecords]) => {
    const first = yearRecords[0];
    const last = yearRecords[yearRecords.length - 1];
    const returnPercent = first.close > 0 ? ((last.close - first.close) / first.close) * 100 : null;
    return { year, returnPercent };
  }).sort((a, b) => a.year.localeCompare(b.year));
}

export function findBestWorstYear(records) {
  const yearlyReturns = computeYearlyReturns(records).filter((y) => y.returnPercent != null);
  if (yearlyReturns.length === 0) return { status: 'INSUFFICIENT_DATA', bestYear: null, worstYear: null };
  const sorted = [...yearlyReturns].sort((a, b) => b.returnPercent - a.returnPercent);
  return { status: 'AVAILABLE', bestYear: sorted[0], worstYear: sorted[sorted.length - 1] };
}

/**
 * Section 11B's 長期上升/長期盤整/長期下降/資料不足 - reuses the exact
 * same "close vs its own moving average" comparison already established
 * by technical-summary.js's classifyTrend() (close>MA=up, close<MA=down,
 * close===MA=flat), applied at the standard 200-day long-term period
 * instead of duplicating that file across the src/ <-> public/js/lib
 * layering boundary (src/ never imports from public/js/lib in this
 * codebase). No new threshold invented - the comparison itself has none.
 */
export function classifyLongTermTrend(records) {
  if (!records || records.length < LONG_TERM_TREND_MA_PERIOD) return { status: 'INSUFFICIENT_DATA', trend: 'INSUFFICIENT_DATA' };
  const closes = records.map((r) => r.close);
  const ma200Series = simpleMovingAverage(closes, LONG_TERM_TREND_MA_PERIOD);
  const latestClose = closes[closes.length - 1];
  const latestMa200 = ma200Series[ma200Series.length - 1];
  if (latestMa200 == null) return { status: 'INSUFFICIENT_DATA', trend: 'INSUFFICIENT_DATA' };
  const trend = latestClose > latestMa200 ? 'LONG_TERM_UP' : latestClose < latestMa200 ? 'LONG_TERM_DOWN' : 'LONG_TERM_FLAT';
  return { status: 'AVAILABLE', trend, latestClose, latestMa200 };
}

/**
 * Composes every Section 12 metric from one already-fetched records
 * array - the single entry point the Dashboard panel and any batch job
 * call, so all metrics are always computed consistently from the same
 * input.
 */
export function computeLongTermMetrics(records, asOfDate = records?.[records.length - 1]?.tradingDate) {
  return {
    return1Y: computePeriodReturn(records, 1, asOfDate),
    return3Y: computePeriodReturn(records, 3, asOfDate),
    return5Y: computePeriodReturn(records, 5, asOfDate),
    return10Y: computePeriodReturn(records, 10, asOfDate),
    cagr: computeCAGR(records),
    maxDrawdown: computeMaxDrawdown(records),
    volatility: computeAnnualizedVolatility(records),
    bestWorstYear: findBestWorstYear(records),
    longTermTrend: classifyLongTermTrend(records)
  };
}
