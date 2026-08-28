// M15/M16/M17 (M11-M23 Dashboard spec v1): six-horizon AI Observation
// List, built entirely from data already persisted on market_top50 by
// the private repo's compute-market-top50.mjs (observation_horizons/
// score_breakdown/recommendation_reason - migration 013) - this module
// never recomputes a score or fetches market_daily itself, so no AI
// selection logic ships in this public repo (Private Core stays
// private).
//
// changeType (M17) is a real diff of the two most recent real
// market_top50 rows for each symbol via recommendation-change.js - a
// pure comparison function with zero scoring logic, safe to ship here.

import { OBSERVATION_LIST_HORIZONS } from './horizons.js';
import { classifyRecommendationChange } from './recommendation-change.js';

function emptyBuckets() {
  return Object.fromEntries(OBSERVATION_LIST_HORIZONS.map((h) => [h.key, []]));
}

/**
 * @param {{current: object[], previous: object[]}} snapshot - fetchTop50Snapshot() result.
 * @returns {Record<string, object[]>} one array per horizon key, in OBSERVATION_LIST_HORIZONS order.
 */
export function buildObservationList({ current, previous }) {
  const horizons = emptyBuckets();
  const previousByKey = new Map((previous ?? []).map((row) => [`${row.market}:${row.symbol}`, row]));

  for (const row of current ?? []) {
    if (row.data_status !== 'AVAILABLE' || !row.observation_horizons) continue;
    const key = `${row.market}:${row.symbol}`;
    const change = classifyRecommendationChange(previousByKey.get(key) ?? null, row);

    const entry = {
      symbol: row.symbol,
      market: row.market,
      rank: row.rank,
      decisionState: row.decision_state,
      aiScore: row.recommendation_score,
      currentPrice: row.reference_price,
      targetPrice: row.target_price,
      riskPrice: row.risk_price,
      expectedReturnPercent: row.expected_return_pct,
      aiReason: row.recommendation_reason ?? [],
      changeType: change.changeType,
      scoreChange: change.scoreChange,
      originalScore: change.originalScore,
      targetChange: change.targetChange,
      originalTarget: change.originalTarget,
      updatedAt: row.updated_at
    };

    for (const { key: horizonKey } of OBSERVATION_LIST_HORIZONS) {
      if (row.observation_horizons[horizonKey]) horizons[horizonKey].push(entry);
    }
  }

  for (const key of Object.keys(horizons)) {
    horizons[key].sort((a, b) => (b.aiScore ?? -Infinity) - (a.aiScore ?? -Infinity));
  }

  return horizons;
}
