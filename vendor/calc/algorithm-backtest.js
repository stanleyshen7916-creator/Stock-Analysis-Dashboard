// Candidate backtest comparison (M7 Phase 2, Section 21, Issue #150).
//
// Section 21's only allowed flow: candidate version -> simulate/backtest
// -> compare old vs new -> Stanley decides. This module never scores
// anything itself - it relabels the SAME already-computed observations
// (decisionState under the live threshold vs under the candidate
// threshold, both produced by the caller via expected-return.js's own
// unmodified classifyDecisionState()) and reuses
// summarizeStockSelectionPerformance() from algorithm-validation.js
// unmodified for both groupings - no new statistics logic, no second
// scoring engine.
//
// A weight-based candidate cannot be honestly backtested against real
// history today: market_top50 only persists the FINAL composite score/
// decision state per prediction (Section 11), not the per-layer
// fundamental/technical/chip scores a weight change would need to
// recompute. This is a real, current data limitation - reported
// honestly via isBacktestableCandidate() rather than faking a
// comparison for weight candidates.
//
// Deliberately import-free, matching every other src/analysis/*.js
// module: summarizeStockSelectionPerformance (algorithm-validation.js)
// is injected by the caller rather than imported directly, so this file
// stays a flat, dependency-free copy safe for byte-for-byte vendoring.

export function isBacktestableCandidate(version) {
  return version?.newThreshold != null && version?.newWeights == null;
}

/**
 * @param {Array<{expectedReturnPercent: number|null, subsequentReturnPercent: number|null}>} observations
 * @param {(expectedReturnPercent: number, threshold: number) => string} classifyDecisionState - the real, unmodified function from expected-return.js.
 * @param {number} threshold
 * @returns {Array<{decisionState: string, subsequentReturnPercent: number|null}>}
 */
export function reclassifyObservations(observations, classifyDecisionState, threshold) {
  return observations.map((o) => ({
    ...o,
    decisionState: classifyDecisionState(o.expectedReturnPercent, threshold)
  }));
}

export function countReclassified(liveObservations, candidateObservations) {
  if (liveObservations.length !== candidateObservations.length) throw new RangeError('liveObservations and candidateObservations must be the same length (same underlying predictions)');
  let count = 0;
  for (let i = 0; i < liveObservations.length; i += 1) {
    if (liveObservations[i].decisionState !== candidateObservations[i].decisionState) count += 1;
  }
  return count;
}

/**
 * @param {object} params
 * @param {Array} params.observations - same shape validate-algorithm.mjs already builds: {expectedReturnPercent, subsequentReturnPercent}.
 * @param {(expectedReturnPercent: number, threshold: number) => string} params.classifyDecisionState - real, unmodified expected-return.js function.
 * @param {(observations: Array) => object} params.summarizeStockSelectionPerformance - real, unmodified algorithm-validation.js function, injected by the caller (this file never imports another src/analysis/*.js module).
 * @param {number} params.liveThreshold - the live EXPECTED_RETURN_THRESHOLD (30), supplied by the caller, never re-guessed here.
 * @param {number} params.candidateThreshold
 */
export function buildThresholdBacktest({ observations, classifyDecisionState, summarizeStockSelectionPerformance, liveThreshold, candidateThreshold }) {
  const liveObservations = reclassifyObservations(observations, classifyDecisionState, liveThreshold);
  const candidateObservations = reclassifyObservations(observations, classifyDecisionState, candidateThreshold);
  return Object.freeze({
    liveSummary: summarizeStockSelectionPerformance(liveObservations),
    candidateSummary: summarizeStockSelectionPerformance(candidateObservations),
    reclassifiedCount: countReclassified(liveObservations, candidateObservations),
    sampleSize: observations.length
  });
}
