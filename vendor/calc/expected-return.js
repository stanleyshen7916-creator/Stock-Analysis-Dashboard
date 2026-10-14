// Expected Return decision gate (Issue #130, revised G3-05) - only when
// the reasonable Target Price implies an expected return over Reference
// Price at or above 20% may a symbol be labeled INVESTABLE_CANDIDATE. 20%
// is a screening threshold, not a guarantee of return.
//
// Deliberately import-free (matches target-price.js/recommendation.js):
// this module never computes Target Price - it only reads the caller's
// already-computed computeTargetPrice() output and the latest already-
// fetched market_daily record, so Target Price is never duplicated,
// re-derived, or adjusted to force the threshold.
//
// Formula (Stanley's spec, unchanged):
//   Expected Return % = (Target Price - Reference Price) / Reference Price * 100
//
// Decision state boundaries (explicit, not left to inference; G3-05
// changed the boundary at the threshold itself from exclusive to
// inclusive per Stanley's explicit 20.00% -> INVESTABLE_CANDIDATE
// acceptance test):
//   >= 20%       -> INVESTABLE_CANDIDATE
//   [0%, 20%)    -> OBSERVATION (positive upside, does not clear the bar)
//   < 0%         -> NOT_QUALIFIED (Target Price at/below Reference Price)
//   unavailable  -> UNAVAILABLE (Target Price or Reference Price missing)

const EXPECTED_RETURN_THRESHOLD = 20;

// `threshold` defaults to the live EXPECTED_RETURN_THRESHOLD, so every
// existing call site (computeExpectedReturn below, sortRecommendations,
// hasInvestableCandidate) is completely unaffected. The optional second
// argument exists only so M7 Phase 2 (Issue #150, Section 18's "Target
// Return Threshold" becoming an editable candidate parameter) can
// backtest a candidate threshold against real history by calling this
// SAME, unmodified classification rule at a different threshold value -
// never a second decision-state engine, never a change to the live
// default.
export function classifyDecisionState(expectedReturnPercent, threshold = EXPECTED_RETURN_THRESHOLD) {
  if (!Number.isFinite(expectedReturnPercent)) return 'UNAVAILABLE';
  if (expectedReturnPercent >= threshold) return 'INVESTABLE_CANDIDATE';
  if (expectedReturnPercent >= 0) return 'OBSERVATION';
  return 'NOT_QUALIFIED';
}

/**
 * @param {object} params
 * @param {object} params.targetPriceResult - computeTargetPrice() output, read-only, never mutated or recomputed.
 * @param {object|null} params.referenceRecord - the latest verified market_daily row: { tradingDate, close, source, sourceTimestamp }.
 * @returns {{status: 'AVAILABLE'|'UNAVAILABLE', expectedReturnPercent: number|null, decisionState: string, referencePrice: number|null, referenceDate: string|null, referenceSource: string|null, referenceSourceTimestamp: string|null}}
 */
export function computeExpectedReturn({ targetPriceResult, referenceRecord }) {
  const referencePrice = referenceRecord?.close ?? null;
  const referenceDate = referenceRecord?.tradingDate ?? null;
  const referenceSource = referenceRecord?.source ?? null;
  const referenceSourceTimestamp = referenceRecord?.sourceTimestamp ?? null;

  if (targetPriceResult?.status !== 'AVAILABLE' || !Number.isFinite(referencePrice) || referencePrice <= 0) {
    return {
      status: 'UNAVAILABLE',
      expectedReturnPercent: null,
      decisionState: 'UNAVAILABLE',
      referencePrice, referenceDate, referenceSource, referenceSourceTimestamp
    };
  }

  const expectedReturnPercent = ((targetPriceResult.targetPrice - referencePrice) / referencePrice) * 100;
  return {
    status: 'AVAILABLE',
    expectedReturnPercent,
    decisionState: classifyDecisionState(expectedReturnPercent),
    referencePrice, referenceDate, referenceSource, referenceSourceTimestamp
  };
}

// Sorting contract (spec section 7/9) - built now so a future Top-50
// feature can reuse it unmodified. INVESTABLE_CANDIDATE always sorts
// first; every other known state follows, both groups ordered by Expected
// Return descending; UNAVAILABLE (no numeric return to sort by) always
// sorts last, never guessed into a numeric position.
const DECISION_STATE_RANK = { INVESTABLE_CANDIDATE: 0, OBSERVATION: 1, NOT_QUALIFIED: 1, UNAVAILABLE: 2 };

/**
 * @param {Array} items - any array; getExpectedReturn(item) must return a computeExpectedReturn() result.
 * @param {(item: any) => object} [getExpectedReturn] - defaults to item.expectedReturn.
 * @returns {Array} a NEW sorted array - items is never mutated.
 */
export function sortRecommendations(items, getExpectedReturn = (item) => item.expectedReturn) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  return [...items].sort((a, b) => {
    const returnA = getExpectedReturn(a);
    const returnB = getExpectedReturn(b);
    const rankA = DECISION_STATE_RANK[returnA?.decisionState] ?? DECISION_STATE_RANK.UNAVAILABLE;
    const rankB = DECISION_STATE_RANK[returnB?.decisionState] ?? DECISION_STATE_RANK.UNAVAILABLE;
    if (rankA !== rankB) return rankA - rankB;

    const percentA = returnA?.expectedReturnPercent;
    const percentB = returnB?.expectedReturnPercent;
    if (!Number.isFinite(percentA) && !Number.isFinite(percentB)) return 0;
    if (!Number.isFinite(percentA)) return 1;
    if (!Number.isFinite(percentB)) return -1;
    return percentB - percentA;
  });
}

/**
 * Section 7's explicit "沒有候選" message when no item reaches
 * INVESTABLE_CANDIDATE - never fabricates a candidate to avoid an empty
 * result.
 */
export function hasInvestableCandidate(sortedItems, getExpectedReturn = (item) => item.expectedReturn) {
  return sortedItems.some((item) => getExpectedReturn(item)?.decisionState === 'INVESTABLE_CANDIDATE');
}
