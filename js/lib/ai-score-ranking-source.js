// Dashboard adapter for market_ai_score_ranking - the AI 評分排行 (2026-09-23),
// a SEPARATE ranking by recommendation_score, independent of market_top50's
// expected-return-driven selection/rank (see scripts/compute-market-top50.mjs's
// computeAiScoreRanking() for why). Anon key only, same two-step
// latest-date-then-rows pattern as market-top50-source.js, so a
// calculation_date with fewer than TOP_N qualifying rows never silently
// splices in an older date's rows.

export function buildLatestAiScoreDateQueryUrl({ url }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ select: 'calculation_date', order: 'calculation_date.desc', limit: '1' });
  return `${base}/rest/v1/market_ai_score_ranking?${params.toString()}`;
}

export function buildAiScoreRankingByDateQueryUrl({ url, calculationDate }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ calculation_date: `eq.${calculationDate}`, order: 'rank.asc' });
  return `${base}/rest/v1/market_ai_score_ranking?${params.toString()}`;
}

function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function normalizeAiScoreRankingRow(row) {
  return {
    calculationDate: row?.calculation_date ?? '',
    market: row?.market ?? '',
    symbol: String(row?.symbol ?? '').toUpperCase(),
    companyName: row?.company_name ?? null,
    rank: Number(row?.rank),
    recommendationScore: numberOrNull(row?.recommendation_score),
    referencePrice: numberOrNull(row?.reference_price),
    targetPrice: numberOrNull(row?.target_price),
    decisionState: row?.decision_state ?? null,
    expectedReturnPercent: numberOrNull(row?.expected_return_pct),
    calculationVersion: row?.calculation_version ?? '',
    riskTier: row?.risk_tier ?? 'UNKNOWN',
    momentumFlag: row?.momentum_flag ?? null,
    historicalVolatilityPercent: numberOrNull(row?.historical_volatility_pct),
    maxDrawdownPercent: numberOrNull(row?.max_drawdown_pct)
  };
}

/**
 * @returns {Promise<{calculationDate: string|null, rows: Array<object>}>} rows already normalized, ordered by rank asc.
 */
export async function fetchAiScoreRanking({ url, anonKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');

  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const latestResponse = await fetchImpl(buildLatestAiScoreDateQueryUrl({ url }), { headers });
  if (!latestResponse.ok) {
    const body = await latestResponse.text();
    throw new Error(`market_ai_score_ranking latest-date query failed (${latestResponse.status}): ${body}`);
  }
  const latestRows = await latestResponse.json();
  const calculationDate = latestRows[0]?.calculation_date ?? null;
  if (!calculationDate) return { calculationDate: null, rows: [] };

  const response = await fetchImpl(buildAiScoreRankingByDateQueryUrl({ url, calculationDate }), { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`market_ai_score_ranking query failed (${response.status}): ${body}`);
  }
  const rows = await response.json();
  return { calculationDate, rows: rows.map(normalizeAiScoreRankingRow) };
}
