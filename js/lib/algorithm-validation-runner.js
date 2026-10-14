// Algorithm Validation orchestration (M7 Phase 1, Sections 15-17, M8-7/
// M8-8/M8-9, Issue #148/#154), ported to run in the browser (M8.X,
// Issue #159's follow-up spec Section 7/11) so the Dashboard can show
// real validation results directly, not just as GitHub Actions log
// output. This is the SAME logic scripts/validate-algorithm.mjs already
// ran server-side - moved here so both the Node CLI script and the
// browser call one shared implementation (no second engine, no
// duplicated orchestration). scripts/validate-algorithm.mjs now imports
// this file directly (the same cross-directory script -> public/js/lib
// import precedent compute-market-top50.mjs already established for
// recommendation-engine.js).
//
// Read-only against market_daily/market_top50 (both anon-readable -
// migrations 004/010) - takes the anon key as a parameter, never a
// service-role key, matching the original script's least-privilege
// choice exactly.

import { fetchAllTop50History } from '../../vendor/calc/bulk-top50-history-reader.js';
import { fetchMarketDailySince } from '../../vendor/calc/bulk-market-data-reader.js';
import { groupRecordsBySymbol } from '../../vendor/calc/universe.js';
import { evaluateTargetPriceAtHorizon, PREDICTION_HORIZONS_TRADING_DAYS, sliceRecordsUpTo } from '../../vendor/calc/simulation.js';
import { summarizeStockSelectionPerformance, summarizeThresholdRuleCorrelation, summarizeIndicatorAccuracy, summarizeHorizonPerformance, summarizeAlgorithmValidationMetrics, MIN_SAMPLE_SIZE } from '../../vendor/calc/algorithm-validation.js';
import { sma, ema, rsi, macd, bollingerBands } from '../../vendor/calc/indicators.js';
import { generateTechnicalSignals } from '../../vendor/calc/signal-engine.js';
import { classifyVolatility, classifyVolume, classifyTrend, classifyMomentum } from './technical-summary.js';
import { buildAtrSeries } from './chart-series.js';
import { classifyInvestmentHorizon } from '../../vendor/calc/investment-horizon.js';

export { MIN_SAMPLE_SIZE };

// Section 16's default validation horizon for Stock Selection / >30% Rule
// (the shortest of the three required horizons - 5/10/20 trading days -
// so the newest predictions have the best chance of already having
// enough subsequent history).
const PRIMARY_HORIZON_TRADING_DAYS = PREDICTION_HORIZONS_TRADING_DAYS[0];

// M8-8 (Section 17, Issue #154): the real "5 major indicators", confirmed
// from layer-score.js's scoreTechnicalSignals() - not re-chosen here.
// Periods are the EXACT ones recommendation-engine.js already uses
// (never re-guessed): SMA20/EMA20/RSI14/MACD(12,26,9)/Bollinger(20,2).
export const SIGNAL_METADATA = [
  { name: 'price_above_sma', label: 'SMA20', direction: 'bullish' },
  { name: 'price_above_ema', label: 'EMA20', direction: 'bullish' },
  { name: 'rsi_oversold', label: 'RSI14 超賣', direction: 'bullish' },
  { name: 'rsi_overbought', label: 'RSI14 超買', direction: 'bearish' },
  { name: 'macd_bullish', label: 'MACD 黃金交叉', direction: 'bullish' },
  { name: 'macd_bearish', label: 'MACD 死亡交叉', direction: 'bearish' },
  { name: 'below_bollinger_lower', label: 'Bollinger 下軌', direction: 'bullish' },
  { name: 'above_bollinger_upper', label: 'Bollinger 上軌', direction: 'bearish' }
];

function computeSignalFlagsAtDate({ records, date }) {
  const asOf = sliceRecordsUpTo(records, date);
  const latestIndex = asOf.length - 1;
  if (latestIndex < 0) return null;

  const closes = asOf.map((r) => r.close);
  const smaSeries = sma(closes, 20);
  const emaSeries = ema(closes, 20);
  const rsiSeries = rsi(closes, 14);
  const macdResult = macd(closes, 12, 26, 9);
  const bands = bollingerBands(closes, 20, 2);

  const signalsAtLatest = generateTechnicalSignals({
    close: closes, sma: smaSeries, ema: emaSeries, rsi: rsiSeries,
    macd: { line: macdResult.macd, signal: macdResult.signal },
    bollingerBands: { middle: bands.middle, upper: bands.upper, lower: bands.lower }
  })[latestIndex]?.signals ?? [];
  const fired = new Set(signalsAtLatest);

  const computable = {
    price_above_sma: smaSeries[latestIndex] !== null,
    price_above_ema: emaSeries[latestIndex] !== null,
    rsi_oversold: rsiSeries[latestIndex] !== null,
    rsi_overbought: rsiSeries[latestIndex] !== null,
    macd_bullish: macdResult.macd[latestIndex] !== null && macdResult.signal[latestIndex] !== null,
    macd_bearish: macdResult.macd[latestIndex] !== null && macdResult.signal[latestIndex] !== null,
    below_bollinger_lower: bands.lower[latestIndex] !== null,
    above_bollinger_upper: bands.upper[latestIndex] !== null
  };

  return Object.fromEntries(SIGNAL_METADATA.map(({ name }) => [name, { fired: fired.has(name), computable: computable[name] }]));
}

/**
 * @param {object} params
 * @param {string} params.url - Supabase project URL.
 * @param {string} params.apiKey - anon/publishable key (this function never writes anything, so never a service-role key).
 * @param {Function} [params.fetchImpl]
 */
export async function runAlgorithmValidation({ url, apiKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase anon key is required');

  let predictions;
  try {
    predictions = await fetchAllTop50History({ url, apiKey, fetchImpl });
  } catch (err) {
    // market_top50 not existing yet in Production (migrations 009/010
    // not yet manually applied) is a real, anticipated, honestly-
    // reportable state, not a crash. Never fabricate a validation
    // result when the source table itself isn't there yet.
    return { predictionsCount: 0, evaluableCount: 0, stockSelection: null, thresholdRule: null, indicatorAccuracy: null, horizonPerformance: null, algorithmMetrics: null, skipReason: err.message };
  }

  const evaluable = predictions.filter((p) => p.dataStatus === 'AVAILABLE' && p.targetPrice != null);
  if (evaluable.length === 0) {
    return { predictionsCount: predictions.length, evaluableCount: 0, stockSelection: null, thresholdRule: null, indicatorAccuracy: null, horizonPerformance: null, algorithmMetrics: null, skipReason: null };
  }

  const earliestDate = evaluable.reduce((min, p) => (p.calculationDate < min ? p.calculationDate : min), evaluable[0].calculationDate);
  // Scoped to the symbols this validation run actually needs, not the
  // whole market: `evaluable` is already the full set of predictions
  // being validated, so anything outside it will never be looked up
  // below. Unscoped, this was fetching every symbol's full history since
  // the earliest prediction (462K+ real rows, ~3.5 minutes over the anon
  // key from a real browser) even though the vast majority of symbols
  // are irrelevant to this panel - found by loading the live Dashboard
  // and watching Algorithm Validation / AI Final Output (which calls
  // this internally, see ai-final-output-runner.js) never leave their
  // loading state within any reasonable wait.
  const neededSymbols = new Set(evaluable.map((p) => p.symbol));
  const marketDailyRows = await fetchMarketDailySince({ url, apiKey, sinceDate: earliestDate, symbols: neededSymbols, fetchImpl });
  const recordsBySymbol = groupRecordsBySymbol(marketDailyRows);

  const observations = evaluable.map((prediction) => {
    const records = recordsBySymbol.get(`${prediction.market}:${prediction.symbol}`) ?? [];
    const horizonResult = evaluateTargetPriceAtHorizon({
      records,
      predictionDate: prediction.calculationDate,
      targetPrice: prediction.targetPrice,
      tradingDaysAfter: PRIMARY_HORIZON_TRADING_DAYS,
      riskPrice: prediction.riskPrice
    });
    const referencePriceAvailable = Number.isFinite(prediction.referencePrice) && prediction.referencePrice > 0;
    const subsequentReturnPercent = horizonResult.status === 'AVAILABLE' && referencePriceAvailable
      ? ((horizonResult.actualFutureClose - prediction.referencePrice) / prediction.referencePrice) * 100
      : null;
    const maximumAdverseExcursionPercent = horizonResult.status === 'AVAILABLE' && referencePriceAvailable
      ? ((horizonResult.actualFutureLow - prediction.referencePrice) / prediction.referencePrice) * 100
      : null;
    return {
      records,
      calculationDate: prediction.calculationDate,
      decisionState: prediction.decisionState,
      expectedReturnPercent: prediction.expectedReturnPercent,
      subsequentReturnPercent,
      horizonStatus: horizonResult.status,
      targetPriceHit: horizonResult.targetPriceHit,
      riskPriceHit: horizonResult.riskPriceHit,
      maximumAdverseExcursionPercent
    };
  });

  const stockSelection = summarizeStockSelectionPerformance(observations);
  const thresholdRule = summarizeThresholdRuleCorrelation(observations);

  // M8-8: per-indicator accuracy - replay each of the 8 real signals at
  // every AVAILABLE-horizon prediction's own calculationDate.
  const signalObservations = Object.fromEntries(SIGNAL_METADATA.map(({ name }) => [name, []]));
  for (const obs of observations) {
    if (obs.horizonStatus !== 'AVAILABLE' || !Number.isFinite(obs.subsequentReturnPercent)) continue;
    const flags = computeSignalFlagsAtDate({ records: obs.records, date: obs.calculationDate });
    if (!flags) continue;
    for (const { name, direction } of SIGNAL_METADATA) {
      if (!flags[name].computable) continue;
      const subsequentReturnPercent = direction === 'bearish' ? -obs.subsequentReturnPercent : obs.subsequentReturnPercent;
      signalObservations[name].push({ signalFired: flags[name].fired, subsequentReturnPercent });
    }
  }
  const indicatorAccuracy = Object.fromEntries(SIGNAL_METADATA.map(({ name }) => [name, summarizeIndicatorAccuracy(signalObservations[name])]));

  // M8-7: does the real Investment Horizon classification correlate with
  // real subsequent performance at the horizon that category implies?
  const horizonObservations = [];
  for (let i = 0; i < evaluable.length; i += 1) {
    const prediction = evaluable[i];
    const records = observations[i].records;
    const asOf = sliceRecordsUpTo(records, prediction.calculationDate);
    if (asOf.length === 0) continue;

    const closes = asOf.map((r) => r.close);
    const ma20 = sma(closes, 20);
    const atrSeries = buildAtrSeries(asOf);
    const volatilityStatus = classifyVolatility(atrSeries);
    const volumeStatus = classifyVolume(asOf);
    const trend = classifyTrend(closes[closes.length - 1], ma20[ma20.length - 1]);
    const momentum = classifyMomentum(asOf);

    const { horizons } = classifyInvestmentHorizon({ volatilityStatus, volumeStatus, trend, momentum, fundamentalSignals: [] });
    const horizonCategory = horizons.DAY_TRADING.suitable ? 'DAY_TRADING' : horizons.SHORT_MEDIUM_TERM.suitable ? 'SHORT_MEDIUM_TERM' : 'NOT_CLASSIFIED';
    const tradingDaysAfter = horizonCategory === 'DAY_TRADING' ? 5 : 10;

    const horizonResult = evaluateTargetPriceAtHorizon({ records, predictionDate: prediction.calculationDate, targetPrice: prediction.targetPrice, tradingDaysAfter });
    const subsequentReturnPercent = horizonResult.status === 'AVAILABLE' && prediction.referencePrice
      ? ((horizonResult.actualFutureClose - prediction.referencePrice) / prediction.referencePrice) * 100
      : null;
    horizonObservations.push({ horizonCategory, subsequentReturnPercent });
  }
  const horizonPerformance = summarizeHorizonPerformance(horizonObservations);

  // M8-9: the single algorithm-level report.
  const algorithmMetrics = summarizeAlgorithmValidationMetrics(observations);

  return { predictionsCount: predictions.length, evaluableCount: evaluable.length, stockSelection, thresholdRule, indicatorAccuracy, horizonPerformance, algorithmMetrics, skipReason: null };
}
