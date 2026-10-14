// Algorithm Configuration table (M7 Phase 1, Section 18, Issue #148).
//
// Read-only. Every value here is a literal transcription of the real,
// already-shipped Locked Baseline constants in composite-score.js,
// layer-score.js, target-price.js and expected-return.js - this module
// computes nothing and duplicates no calculation logic (Section 3: "不得
// 建立第二套相同計算邏輯"). It exists only so the Algorithm Configuration
// dashboard view can display those already-locked numbers without
// re-deriving them.
//
// Section 18 explicitly allows Weight/Threshold to become editable in a
// later phase, but forbids touching core code directly. Phase 1 ships the
// read-only table only - editability (with Section 19 safety checks and
// Section 20 version history) is deferred to Phase 2 and is NOT built
// here. "version"/"lastUpdated" below are real git history for the source
// file (checked via `git log -1 --format=%ad -- <file>` on 2026-08-25),
// not invented - there is no algorithm-version system yet (that is
// Section 20 / Phase 2 work), so "version" honestly reads "Locked
// Baseline (unversioned)" for every row rather than fabricating a v1.0.
//
// "validationStatus" is deliberately NOT a blanket "validated" - it
// reflects the real, current state of scripts/validate-algorithm.mjs
// (Section 16/17): Stock Selection performance and the >30% Rule
// correlation ARE measured (though still INSUFFICIENT_SAMPLE as of
// 2026-08-25, since market_daily history is only ~5 trading days deep -
// see docs/MARKET_UNIVERSE.md), while per-indicator accuracy (Section 17)
// is not yet wired into that script.

const UNVERSIONED = 'Locked Baseline (unversioned - Section 20 versioning is Phase 2)';
const NOT_YET_INDICATOR_VALIDATED = 'NOT YET VALIDATED (Section 17 per-indicator accuracy not yet wired into validate-algorithm.mjs)';
const MEASURED_INSUFFICIENT_SAMPLE = 'MEASUREMENT BUILT (Section 16, validate-algorithm.mjs) - INSUFFICIENT_SAMPLE as of 2026-08-25 (market_daily history too shallow, see docs/MARKET_UNIVERSE.md)';

const ALGORITHM_CONFIGURATION = Object.freeze([
  Object.freeze({
    parameter: 'Composite Score - Fundamental Weight',
    formula: 'compositeScore = fundamental*w_f + technical*w_t + chip*w_c',
    weight: 1, threshold: null,
    dataSource: 'src/analysis/composite-score.js (DEFAULT_WEIGHTS.fundamental)',
    version: UNVERSIONED, lastUpdated: '2026-09-29',
    validationStatus: 'CALIBRATED 2026-09-29: weight (scripts/backtest-weight-calibration.mjs) and quarterly EPS/net income/ROE inputs (scripts/backtest-fundamental-upgrade.mjs), both by pre-registered in-sample rules; 20-session rank IC full market 0.0299 (t 4.94, out-of-sample 0.0250), top 150 0.0372 (t 3.84, out-of-sample 0.0615)'
  }),
  Object.freeze({
    parameter: 'Composite Score - Technical Weight',
    formula: 'compositeScore = fundamental*w_f + technical*w_t + chip*w_c',
    weight: 0, threshold: null,
    dataSource: 'src/analysis/composite-score.js (DEFAULT_WEIGHTS.technical)',
    version: UNVERSIONED, lastUpdated: '2026-09-29',
    validationStatus: 'WEIGHT 0 since 2026-09-29: every technical weight above 0 lowered the composite rank IC (2016-2026); kept as reference data (ETFs still score on it)'
  }),
  Object.freeze({
    parameter: 'Composite Score - Chip Weight',
    formula: 'compositeScore = fundamental*w_f + technical*w_t + chip*w_c (chip = reference data only, weight 0)',
    weight: 0, threshold: null,
    dataSource: 'src/analysis/composite-score.js (DEFAULT_WEIGHTS.chip)',
    version: UNVERSIONED, lastUpdated: '2026-09-27',
    validationStatus: 'REJECTED 2026-09-27: 2016-2026 backtest (next-session entry) - single-day 三大法人 flow quintile spread t = 0.02 / 0.96 / 0.45 at 5/10/20 days; weight set to 0, kept as reference data'
  }),
  Object.freeze({
    parameter: 'Risk Gate - High Risk Threshold',
    formula: 'riskScore >= threshold -> status "high_risk" (gated)',
    weight: null, threshold: 70,
    dataSource: 'src/analysis/composite-score.js (applyRiskGate)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Risk Gate - Fundamental Weak Threshold',
    formula: 'fundamentalScore < threshold -> status "fundamental_weak" (gated)',
    weight: null, threshold: 30,
    dataSource: 'src/analysis/composite-score.js (applyRiskGate)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Risk Gate - Positive Verdict Threshold',
    formula: 'compositeScore >= threshold -> status "positive"',
    weight: null, threshold: 75,
    dataSource: 'src/analysis/composite-score.js (applyRiskGate)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Risk Gate - Neutral Verdict Threshold',
    formula: 'compositeScore >= threshold -> status "neutral"',
    weight: null, threshold: 55,
    dataSource: 'src/analysis/composite-score.js (applyRiskGate)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Technical Signal - SMA (price above SMA)',
    formula: 'signal "price_above_sma" adds weight to technical layer score (base 50)',
    weight: 10, threshold: null,
    dataSource: 'src/analysis/layer-score.js (scoreTechnicalSignals)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Technical Signal - EMA (price above EMA)',
    formula: 'signal "price_above_ema" adds weight to technical layer score (base 50)',
    weight: 10, threshold: null,
    dataSource: 'src/analysis/layer-score.js (scoreTechnicalSignals)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Technical Signal - RSI (oversold/overbought)',
    formula: 'signal "rsi_oversold" +weight / "rsi_overbought" -weight on technical layer score',
    weight: 5, threshold: null,
    dataSource: 'src/analysis/layer-score.js (scoreTechnicalSignals)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Technical Signal - MACD (bullish/bearish)',
    formula: 'signal "macd_bullish" +weight / "macd_bearish" -weight on technical layer score',
    weight: 15, threshold: null,
    dataSource: 'src/analysis/layer-score.js (scoreTechnicalSignals)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Technical Signal - Bollinger Bands (breakout)',
    formula: 'signal "above_bollinger_upper" -weight / "below_bollinger_lower" +weight on technical layer score',
    weight: 5, threshold: null,
    dataSource: 'src/analysis/layer-score.js (scoreTechnicalSignals)',
    version: UNVERSIONED, lastUpdated: '2026-08-18',
    validationStatus: NOT_YET_INDICATOR_VALIDATED
  }),
  Object.freeze({
    parameter: 'Target Price / Risk Price - Donchian Channel Period',
    formula: 'Target Price = N-day rolling high, Risk Price = N-day rolling low (Donchian Channel)',
    weight: null, threshold: 20,
    dataSource: 'src/analysis/target-price.js (DEFAULT_PERIOD) / src/indicators/index.mjs (donchianChannel)',
    version: UNVERSIONED, lastUpdated: '2026-08-25',
    validationStatus: 'INDIRECTLY MEASURED via Target Price hit-rate at 5/10/20 trading days (Section 16, simulation.js evaluateTargetPriceAtHorizon) - INSUFFICIENT_SAMPLE as of 2026-08-25'
  }),
  Object.freeze({
    parameter: 'Expected Return - Investable Candidate Threshold (>30% Rule)',
    formula: 'Expected Return % = (Target Price - Reference Price) / Reference Price * 100; > threshold -> INVESTABLE_CANDIDATE',
    weight: null, threshold: 30,
    dataSource: 'src/analysis/expected-return.js (EXPECTED_RETURN_THRESHOLD)',
    version: UNVERSIONED, lastUpdated: '2026-08-25',
    validationStatus: MEASURED_INSUFFICIENT_SAMPLE
  })
]);

/**
 * @returns {Array<object>} a NEW array (never the frozen internal one) so callers can never mutate the Locked Baseline's displayed values.
 */
export function getAlgorithmConfiguration() {
  return ALGORITHM_CONFIGURATION.map((row) => ({ ...row }));
}
