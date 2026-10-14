// Bulk reader for market_top50's own history (M7 Phase 1, Issue #148) -
// every row M4's daily batch job has ever written is a real, dated
// prediction record (Section 8's "must keep a record, not just the final
// result" requirement is already satisfied by market_top50 itself - this
// just reads it back). Paginated the same way
// src/market-top50/bulk-market-data-reader.js reads market_daily - not
// one request per calculation_date.

const PAGE_SIZE = 1000;

export function normalizeTop50Row(row) {
  return {
    calculationDate: row?.calculation_date ?? '',
    market: row?.market ?? '',
    symbol: String(row?.symbol ?? '').toUpperCase(),
    rank: Number(row?.rank),
    decisionState: row?.decision_state ?? 'UNAVAILABLE',
    referencePrice: row?.reference_price == null ? null : Number(row.reference_price),
    targetPrice: row?.target_price == null ? null : Number(row.target_price),
    riskPrice: row?.risk_price == null ? null : Number(row.risk_price),
    expectedReturnPercent: row?.expected_return_pct == null ? null : Number(row.expected_return_pct),
    dataStatus: row?.data_status ?? 'UNAVAILABLE',
    dataAsOf: row?.data_as_of ?? null
  };
}

/**
 * @returns {Promise<Array<object>>} every market_top50 row ever written, normalized.
 */
export async function fetchAllTop50History({ url, apiKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase API key is required');

  const base = String(url).replace(/\/$/, '');
  const rows = [];
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      order: 'calculation_date.asc,symbol.asc',
      offset: String(offset),
      limit: String(PAGE_SIZE)
    });
    const response = await fetchImpl(`${base}/rest/v1/market_top50?${params.toString()}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`market_top50 bulk query failed (${response.status}): ${body}`);
    }
    const page = await response.json();
    rows.push(...page.map(normalizeTop50Row));
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}
