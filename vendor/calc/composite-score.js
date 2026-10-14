// Fundamental 1.0 / technical 0 since 2026-09-29 (Stanley's decision,
// option A of scripts/backtest-weight-calibration.mjs): across fundamental
// weights 0..1, the 20-session rank IC rose monotonically with the
// fundamental weight; the pre-registered rule (best in-sample IC averaged
// over the full market and the top 150) chose 1.0 - full-market IC
// 0.0101 -> 0.0211 (t 1.22 -> 3.59), top-150 IC 0.0104 -> 0.0238 (t 1.73 ->
// 3.60; out-of-sample 0.0315 -> 0.0583). The technical score, like chip,
// is still computed and shown as reference data only. Since m4-v4 the
// fundamental layer also uses point-in-time quarterly EPS / net income YoY
// and ROE (full-market IC 0.0299, t 4.94; scripts/backtest-fundamental-upgrade.mjs).
//
// Chip weight set to 0 on 2026-09-27 (Stanley's decision): the 2016-2026
// full-history backtest (scripts/backtest-full-history.mjs, 上市+上櫃,
// next-session entry) found single-day 三大法人 flow has no predictive
// power once it can actually be traded (quintile t 0.02 / 0.96 / 0.45 at
// 5/10/20 days) - its apparent t 7.56 came only from using flow published
// after the close. Chip scores are still computed and shown as reference
// data, but carry no weight. fundamental/technical keep their original
// 0.30 : 0.50 ratio (0.375 / 0.625), identical to the weights the engine
// already used whenever no chip data existed.
const DEFAULT_WEIGHTS = Object.freeze({ fundamental: 1, technical: 0, chip: 0 });

export function calculateCompositeScore({ fundamental, technical, chip }, weights = DEFAULT_WEIGHTS) {
  validateScore(fundamental, 'fundamental');
  validateScore(technical, 'technical');
  validateScore(chip, 'chip');
  validateWeights(weights);
  return (fundamental * weights.fundamental) + (technical * weights.technical) + (chip * weights.chip);
}

export function applyRiskGate({ compositeScore, fundamentalScore, technicalScore, chipScore, riskScore }) {
  if (![compositeScore, fundamentalScore, technicalScore, chipScore, riskScore].every(Number.isFinite)) throw new TypeError('all scores must be finite numbers');
  if (riskScore >= 70) return { status: 'high_risk', score: compositeScore, gated: true };
  if (fundamentalScore < 30) return { status: 'fundamental_weak', score: compositeScore, gated: true };
  if (compositeScore >= 75) return { status: 'positive', score: compositeScore, gated: false };
  if (compositeScore >= 55) return { status: 'neutral', score: compositeScore, gated: false };
  return { status: 'negative', score: compositeScore, gated: false };
}

export function defaultWeights() { return { ...DEFAULT_WEIGHTS }; }

function validateScore(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError(`${name} score must be between 0 and 100`);
}

function validateWeights(weights) {
  const values = [weights.fundamental, weights.technical, weights.chip];
  if (!values.every(Number.isFinite) || values.some((value) => value < 0) || Math.abs(values.reduce((a, b) => a + b, 0) - 1) > 1e-9) throw new RangeError('weights must be non-negative and sum to 1');
}
