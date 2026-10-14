// Market Top 50 dashboard adapter (M4, Issue #133) - reads the
// server-computed market_top50 table with the anon key only, same
// pattern as supabase-market-data-source.js. Never computes a ranking
// itself, never calls TWSE/TPEx directly - it only reads what the
// server-side batch job (scripts/compute-market-top50.mjs) already wrote.
//
// Two-step query, not a single order+limit=50: a calculation_date can
// legitimately have fewer than 50 rows (not every date fields 50
// qualifying symbols), so a single "order by calculation_date desc, rank
// asc, limit 50" could silently splice in rows from an OLDER date once
// the newest date's own rows run out. Resolving the latest calculation_date
// first, then fetching every row for exactly that date, avoids that.

export function buildLatestCalculationDateQueryUrl({ url }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ select: 'calculation_date', order: 'calculation_date.desc', limit: '1' });
  return `${base}/rest/v1/market_top50?${params.toString()}`;
}

export function buildMarketTop50ByDateQueryUrl({ url, calculationDate }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ calculation_date: `eq.${calculationDate}`, order: 'rank.asc' });
  return `${base}/rest/v1/market_top50?${params.toString()}`;
}

export function buildPreviousCalculationDateQueryUrl({ url, beforeDate }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ select: 'calculation_date', calculation_date: `lt.${beforeDate}`, order: 'calculation_date.desc', limit: '1' });
  return `${base}/rest/v1/market_top50?${params.toString()}`;
}

function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function normalizeMarketTop50Row(row) {
  return {
    calculationDate: row?.calculation_date ?? '',
    market: row?.market ?? '',
    symbol: String(row?.symbol ?? '').toUpperCase(),
    rank: Number(row?.rank),
    decisionState: row?.decision_state ?? 'UNAVAILABLE',
    referencePrice: numberOrNull(row?.reference_price),
    targetPrice: numberOrNull(row?.target_price),
    riskPrice: numberOrNull(row?.risk_price),
    expectedReturnPercent: numberOrNull(row?.expected_return_pct),
    recommendationScore: numberOrNull(row?.recommendation_score),
    evidenceStrength: row?.evidence_strength ?? null,
    dataStatus: row?.data_status ?? 'UNAVAILABLE',
    dataAsOf: row?.data_as_of ?? null,
    source: row?.source ?? '',
    calculationVersion: row?.calculation_version ?? '',
    observationHorizons: row?.observation_horizons ?? null,
    recommendationReason: Array.isArray(row?.recommendation_reason) ? row.recommendation_reason : null,
    // Not yet populated server-side (no company-name column in market_top50
    // yet) - always null today; wired ahead of time so the frontend needs
    // no further change once the batch job starts writing it.
    companyName: row?.company_name ?? null,
    // Risk Tier / 強勢股 (Phase-2 roadmap item, 2026-09-23) - see
    // scripts/compute-market-top50.mjs's buildTop50Row and
    // public/js/lib/risk-analysis.js's classifyRiskTier/classifyMomentumFlag.
    riskTier: row?.risk_tier ?? 'UNKNOWN',
    momentumFlag: row?.momentum_flag ?? null,
    historicalVolatilityPercent: numberOrNull(row?.historical_volatility_pct),
    maxDrawdownPercent: numberOrNull(row?.max_drawdown_pct)
  };
}

/**
 * @returns {Promise<{calculationDate: string|null, rows: Array<object>}>} rows already normalized, ordered by rank asc.
 */
export async function fetchMarketTop50({ url, anonKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');

  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const latestResponse = await fetchImpl(buildLatestCalculationDateQueryUrl({ url }), { headers });
  if (!latestResponse.ok) {
    const body = await latestResponse.text();
    throw new Error(`market_top50 latest-date query failed (${latestResponse.status}): ${body}`);
  }
  const latestRows = await latestResponse.json();
  const calculationDate = latestRows[0]?.calculation_date ?? null;
  if (!calculationDate) return { calculationDate: null, rows: [] };

  const response = await fetchImpl(buildMarketTop50ByDateQueryUrl({ url, calculationDate }), { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`market_top50 query failed (${response.status}): ${body}`);
  }
  const rows = await response.json();
  return { calculationDate, rows: rows.map(normalizeMarketTop50Row) };
}

/**
 * The real calculation_date immediately before `beforeDate` (skips
 * weekends/holidays automatically - whatever the Daily Agent's own real
 * run history actually is, never assumed to be "yesterday"). Returns an
 * empty result, never a fabricated placeholder, when there is no earlier
 * date yet (e.g. day one of this table's history).
 * @returns {Promise<{calculationDate: string|null, rows: Array<object>}>}
 */
export async function fetchPreviousMarketTop50({ url, anonKey, beforeDate, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  if (!beforeDate) throw new Error('beforeDate is required');

  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const prevDateResponse = await fetchImpl(buildPreviousCalculationDateQueryUrl({ url, beforeDate }), { headers });
  if (!prevDateResponse.ok) {
    const body = await prevDateResponse.text();
    throw new Error(`market_top50 previous-date query failed (${prevDateResponse.status}): ${body}`);
  }
  const prevDateRows = await prevDateResponse.json();
  const calculationDate = prevDateRows[0]?.calculation_date ?? null;
  if (!calculationDate) return { calculationDate: null, rows: [] };

  const response = await fetchImpl(buildMarketTop50ByDateQueryUrl({ url, calculationDate }), { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`market_top50 query failed (${response.status}): ${body}`);
  }
  const rows = await response.json();
  return { calculationDate, rows: rows.map(normalizeMarketTop50Row) };
}
