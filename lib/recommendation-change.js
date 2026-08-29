// M17 (M11-M23 Unified Spec v2.0) - Daily Recommendation Re-evaluation.
// Compares two real market_top50 rows for the same symbol (yesterday's
// calculation_date vs today's, or "no prior row" for a symbol appearing
// for the first time) and classifies what changed. Deliberately import-
// free and pure: every field it reads already exists on market_top50
// (Section 26's Recommendation Data Contract reused, not a second table -
// see 009_market_top50.sql) - this module only diffs and classifies two
// already-computed rows, never recomputes a score/price itself.
//
// A material-change threshold (not a fixed dollar amount, which would be
// meaningless across share prices from NT$10 to NT$1000+) is applied as a
// percentage of the PRIOR value - 1% for price fields, matching no
// invented formula: it is simply "did this real number move by a
// non-trivial fraction of itself", the same relative-comparison logic
// this project already uses for MoM/YoY revenue growth
// (supabase-fundamental-corporate-action-source.js).

const MATERIAL_PRICE_CHANGE_FRACTION = 0.01;

const DECISION_STATE_RANK = { INVESTABLE_CANDIDATE: 3, OBSERVATION: 2, NOT_QUALIFIED: 1, UNAVAILABLE: 0 };

function isMaterialChange(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false;
  if (previous === 0) return current !== 0;
  return Math.abs(current - previous) / Math.abs(previous) >= MATERIAL_PRICE_CHANGE_FRACTION;
}

/**
 * @param {object|null} previousRow - the same symbol's prior market_top50
 *   row (most recent calculation_date before `currentRow`'s), or null if
 *   this symbol has no earlier row at all.
 * @param {object|null} currentRow - today's market_top50 row for this
 *   symbol, or null if the symbol no longer appears in today's ranking.
 * @returns {{changeType: string, scoreChange: number|null, targetChange: number|null,
 *   riskChange: number|null, originalScore: number|null, currentScore: number|null,
 *   originalTarget: number|null, currentTarget: number|null,
 *   originalRisk: number|null, currentRisk: number|null}}
 */
export function classifyRecommendationChange(previousRow, currentRow) {
  const currentUnavailable = !currentRow || currentRow.data_status !== 'AVAILABLE';
  const previousUnavailable = previousRow != null && previousRow.data_status !== 'AVAILABLE';

  const originalScore = previousRow?.recommendation_score ?? null;
  const currentScore = currentRow?.recommendation_score ?? null;
  const originalTarget = previousRow?.target_price ?? null;
  const currentTarget = currentRow?.target_price ?? null;
  const originalRisk = previousRow?.risk_price ?? null;
  const currentRisk = currentRow?.risk_price ?? null;

  const scoreChange = Number.isFinite(originalScore) && Number.isFinite(currentScore) ? currentScore - originalScore : null;
  const targetChange = Number.isFinite(originalTarget) && Number.isFinite(currentTarget) ? currentTarget - originalTarget : null;
  const riskChange = Number.isFinite(originalRisk) && Number.isFinite(currentRisk) ? currentRisk - originalRisk : null;

  const base = { scoreChange, targetChange, riskChange, originalScore, currentScore, originalTarget, currentTarget, originalRisk, currentRisk };

  if (!currentRow) return { ...base, changeType: 'REMOVED' };
  if (!previousRow) return { ...base, changeType: 'NEW' };
  if (currentUnavailable || previousUnavailable) return { ...base, changeType: 'DATA_INSUFFICIENT' };

  const previousRank = DECISION_STATE_RANK[previousRow.decision_state] ?? 0;
  const currentRank = DECISION_STATE_RANK[currentRow.decision_state] ?? 0;
  if (currentRank > previousRank) return { ...base, changeType: 'UPGRADED' };
  if (currentRank < previousRank) return { ...base, changeType: 'DOWNGRADED' };

  const riskMoved = isMaterialChange(originalRisk, currentRisk);
  if (riskMoved) {
    // A lower risk (stop) price is the favorable direction (more room
    // before the risk rule would trigger); a higher one is unfavorable -
    // same convention holding-risk.js/simulation.js already use.
    return { ...base, changeType: currentRisk < originalRisk ? 'RISK_DECREASED' : 'RISK_INCREASED' };
  }

  if (isMaterialChange(originalTarget, currentTarget)) return { ...base, changeType: 'TARGET_REVISED' };

  return { ...base, changeType: 'UNCHANGED' };
}
