// Full-market company name lookup (2026-09-23 "名稱" audit) - reads the
// `companies` table (supabase/migrations/022_companies.sql, populated
// daily by scripts/sync-companies.mjs), anon key only. Small enough
// (~2000 rows) to fetch in full once per page load and cache client-side,
// rather than one request per symbol.

const PAGE_SIZE = 1000; // PostgREST's default max rows per response.

export function buildCompaniesQueryUrl({ url, offset = 0, limit = PAGE_SIZE }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ select: 'symbol,market,name', order: 'symbol.asc', offset: String(offset), limit: String(limit) });
  return `${base}/rest/v1/companies?${params.toString()}`;
}

/**
 * @returns {Promise<Array<{symbol: string, market: string, name: string}>>}
 */
export async function fetchCompanyDirectoryRows({ url, anonKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');

  const rows = [];
  let offset = 0;
  for (;;) {
    const response = await fetchImpl(buildCompaniesQueryUrl({ url, offset }), { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`companies query failed (${response.status}): ${body}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

/**
 * key = `${market}:${symbol}` -> name, plus a symbol-only fallback key for
 * callers that don't track market (most Dashboard UI only ever displays
 * one market's worth of a given code in practice).
 * @param {Array<{symbol:string, market:string, name:string}>} rows
 * @returns {Map<string, string>}
 */
export function buildCompanyNameLookup(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.symbol || !row?.name) continue;
    const symbol = String(row.symbol).toUpperCase();
    if (row.market) map.set(`${row.market}:${symbol}`, row.name);
    if (!map.has(symbol)) map.set(symbol, row.name);
  }
  return map;
}
