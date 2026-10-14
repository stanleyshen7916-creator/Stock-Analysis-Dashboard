// Algorithm candidate versioning (M7 Phase 2, Sections 19-21, Issue #150).
//
// A candidate version is a PROPOSAL, never the live algorithm. The real
// Locked Baseline constants in composite-score.js/layer-score.js/
// target-price.js/expected-return.js are never read or written by this
// module - Section 21 draws the line at "AI 可以提出候選版本"; promoting
// one to live is a manual code change Stanley makes outside this app, not
// a button here. This module only builds, validates, and versions the
// candidate record itself.
//
// Deliberately import-free (matches simulation.js/algorithm-validation.js
// pattern) so it stays trivially vendorable byte-for-byte.

// Section 19: "權重總和錯誤，無法儲存" - weights must sum to 100% (1.0).
const WEIGHT_SUM_TOLERANCE = 1e-9;

export function validateWeightSum(weights) {
  const values = Object.values(weights ?? {});
  if (values.length === 0 || !values.every((value) => Number.isFinite(value) && value >= 0)) {
    return { valid: false, message: '⚠️ 權重總和錯誤，無法儲存' };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    return { valid: false, message: '⚠️ 權重總和錯誤，無法儲存' };
  }
  return { valid: true, message: null };
}

// Generic numeric/range check (Section 19) - min/max are the caller's own
// domain bounds (e.g. a 0-100 score threshold), never invented here.
export function validateThresholdRange({ value, min, max, label }) {
  if (!Number.isFinite(value)) return { valid: false, message: `${label ?? '門檻'}必須為數字` };
  if (value < min || value > max) return { valid: false, message: `${label ?? '門檻'}必須介於 ${min} 與 ${max} 之間` };
  return { valid: true, message: null };
}

// The one logical (not merely range) check with real grounding in the
// shipped code: composite-score.js's applyRiskGate evaluates the
// "positive" threshold before the "neutral" one against the SAME
// compositeScore, so a neutral threshold at or above the positive
// threshold makes the neutral band unreachable - not an invented rule,
// just the actual sequential-gate structure already in the codebase.
export function validateRiskGateOrdering({ positiveThreshold, neutralThreshold }) {
  if (!Number.isFinite(positiveThreshold) || !Number.isFinite(neutralThreshold)) {
    return { valid: false, message: '門檻必須為數字' };
  }
  if (neutralThreshold >= positiveThreshold) {
    return { valid: false, message: '⚠️ neutral 門檻必須小於 positive 門檻，否則 neutral 區間永遠無法觸發' };
  }
  return { valid: true, message: null };
}

// M8-11 (Issue #154): the exact required message when a candidate fails
// any of the "does this actually make sense" safety checks below -
// distinct from Section 19's weight-sum message, since these checks are
// about the candidate's real backtested EFFECT, not just its numeric
// shape.
export const ALGORITHM_SAFETY_ERROR = '⚠️ 演算法設定錯誤，無法套用。';

/**
 * Sanity-bounds a candidate's real backtested effect against
 * degenerate outcomes M8-11 explicitly calls out: a threshold so loose
 * every symbol qualifies, or so strict none do. Never blocks on a
 * backtest that doesn't exist yet (candidateSummary null) - there is
 * nothing to sanity-check before a real backtest has run.
 * @param {Record<string, {sampleSize: number, status: string, averageReturnPercent: number|null}>|null} candidateSummary - an algorithm-backtest.js buildThresholdBacktest() result's candidateSummary, keyed by decision state.
 */
export function validateNotDegenerate(candidateSummary) {
  if (!candidateSummary) return { valid: true, message: null };
  const totalSampleSize = Object.values(candidateSummary).reduce((sum, s) => sum + s.sampleSize, 0);
  if (totalSampleSize === 0) return { valid: true, message: null };

  const investableCount = candidateSummary.INVESTABLE_CANDIDATE?.sampleSize ?? 0;
  const observationCount = candidateSummary.OBSERVATION?.sampleSize ?? 0;
  if (investableCount === totalSampleSize) {
    return { valid: false, message: ALGORITHM_SAFETY_ERROR }; // 不造成全部股票可投資
  }
  if (investableCount === 0 && observationCount === 0) {
    return { valid: false, message: ALGORITHM_SAFETY_ERROR }; // 不造成全部股票不可投資
  }
  return { valid: true, message: null };
}

/**
 * M8-11's "回測結果優於或至少不劣於 baseline" gate - a candidate whose
 * own real backtested average return for INVESTABLE_CANDIDATE is worse
 * than the live algorithm's is flagged, never silently accepted as an
 * improvement. Only compares when BOTH sides have a real, AVAILABLE
 * measurement - never guesses a verdict from an insufficient sample.
 * @param {object|null} candidateSummary
 * @param {object|null} liveSummary - same shape, the live algorithm's own measured performance.
 */
export function validateNotWorseThanBaseline(candidateSummary, liveSummary) {
  const candidate = candidateSummary?.INVESTABLE_CANDIDATE;
  const live = liveSummary?.INVESTABLE_CANDIDATE;
  if (candidate?.status !== 'AVAILABLE' || live?.status !== 'AVAILABLE') {
    return { valid: true, message: null }; // not enough real data yet to compare - not a failure, just not yet checkable
  }
  if (candidate.averageReturnPercent < live.averageReturnPercent) {
    return { valid: false, message: ALGORITHM_SAFETY_ERROR };
  }
  return { valid: true, message: null };
}

/**
 * M8-11's full safety check, run before a candidate could ever be
 * considered for promotion (Section 21 - promotion itself is always a
 * manual, out-of-band code change; this only gates what this app is
 * willing to call "safe"). Combines Section 19's weight-sum check (if
 * weights are involved) with the two new real-effect checks above.
 * Returns the FIRST failure found, never silently continues past one.
 */
export function validateAlgorithmSafety({ newWeights = null, candidateSummary = null, liveSummary = null }) {
  if (newWeights) {
    const weightCheck = validateWeightSum(newWeights);
    if (!weightCheck.valid) return weightCheck;
  }
  const degenerateCheck = validateNotDegenerate(candidateSummary);
  if (!degenerateCheck.valid) return degenerateCheck;
  const baselineCheck = validateNotWorseThanBaseline(candidateSummary, liveSummary);
  if (!baselineCheck.valid) return baselineCheck;
  return { valid: true, message: null };
}

// Section 20: "v1.0/v1.1/v1.2..." - always increments the minor number,
// never overwrites or reuses a version string.
export function nextVersionLabel(previousVersion) {
  const match = /^v(\d+)\.(\d+)$/.exec(previousVersion ?? '');
  if (!match) return 'v1.1';
  const [, major, minor] = match;
  return `v${major}.${Number(minor) + 1}`;
}

/**
 * Builds one Section 20 version record. Throws (never silently saves) on
 * a Section 19 safety-check failure - weights must sum to 100% when
 * provided, thresholds must be finite numbers when provided.
 *
 * @param {object} params
 * @param {string} params.previousVersion - the version this candidate is based on, e.g. "v1.0".
 * @param {string} params.change - short description of what changed.
 * @param {string} params.reason - why this change is being proposed (Section 21: AI must explain reason).
 * @param {object|null} [params.previousWeights] - e.g. { fundamental: 0.40, technical: 0.35, chip: 0.25 }.
 * @param {object|null} [params.newWeights] - same shape as previousWeights; validated to sum to 1.
 * @param {object|null} [params.previousThreshold] - e.g. { name: 'expectedReturnThreshold', value: 30 }.
 * @param {object|null} [params.newThreshold] - same shape as previousThreshold.
 * @param {string} [params.changedBy] - free text; this is a single-user, unauthenticated app, so this is never inferred, only what the caller supplies.
 * @param {string} params.changedDate - ISO date string, supplied by the caller (never guessed by this module).
 */
export function buildCandidateVersion({ previousVersion, change, reason, previousWeights = null, newWeights = null, previousThreshold = null, newThreshold = null, changedBy = 'Stanley (未填寫)', changedDate }) {
  if (typeof change !== 'string' || change.trim() === '') throw new Error('change is required');
  if (typeof reason !== 'string' || reason.trim() === '') throw new Error('reason is required');
  if (typeof changedDate !== 'string' || changedDate.trim() === '') throw new Error('changedDate is required');

  if (newWeights != null) {
    const weightCheck = validateWeightSum(newWeights);
    if (!weightCheck.valid) throw new Error(weightCheck.message);
  }
  if (newThreshold != null && !Number.isFinite(newThreshold.value)) {
    throw new Error('newThreshold.value must be a finite number');
  }

  return Object.freeze({
    version: nextVersionLabel(previousVersion),
    change,
    reason,
    previousWeights: previousWeights ? { ...previousWeights } : null,
    newWeights: newWeights ? { ...newWeights } : null,
    previousThreshold: previousThreshold ? { ...previousThreshold } : null,
    newThreshold: newThreshold ? { ...newThreshold } : null,
    // Section 21: a candidate is never auto-applied, and its backtest
    // comparison hasn't run yet at creation time - never fabricated as
    // already "validated".
    validationResult: 'NOT_YET_VALIDATED',
    changedBy,
    changedDate
  });
}

/**
 * Returns a NEW version record with a real backtest comparison result
 * attached - never mutates the input (Section 20: history is never
 * overwritten in place).
 * @param {object} version - a buildCandidateVersion() result.
 * @param {{summary: string, oldAverageReturnPercent: number|null, newAverageReturnPercent: number|null, sampleSize: number}} result
 */
export function withValidationResult(version, result) {
  return Object.freeze({ ...version, validationResult: result });
}
