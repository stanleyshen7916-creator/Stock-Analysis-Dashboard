// Dashboard adapter for quarterly_financials (m4-v4, 2026-09-29): one
// symbol's recent quarters, from which the Stock Detail page derives the
// point-in-time EPS / net income / ROE inputs (vendor/calc/
// quarterly-inputs.js) exactly as the nightly batch does. Anon key only.

export function buildQuarterlyRowsQueryUrl({ url, symbol, limit = 12 }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({
    select: 'market,symbol,fiscal_year,fiscal_quarter,net_income_parent_ytd,eps_ytd,equity_parent,total_equity,non_controlling_interest,available_on',
    symbol: `eq.${String(symbol).toUpperCase()}`,
    order: 'fiscal_year.desc,fiscal_quarter.desc',
    limit: String(limit)
  });
  return `${base}/rest/v1/quarterly_financials?${params.toString()}`;
}

/** The last `limit` filed quarters (12 = three years: latest, year-ago and a trailing four). */
export async function fetchRecentQuarterlyRows({ url, anonKey, symbol, limit = 12, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  const response = await fetchImpl(buildQuarterlyRowsQueryUrl({ url, symbol, limit }), { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  if (!response.ok) throw new Error(`quarterly_financials query failed (${response.status}): ${await response.text()}`);
  return response.json();
}
