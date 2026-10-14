// Dashboard adapter for etf_top_holdings (ETF 專區 step 2b) - SITCA's
// monthly top-10 holdings per ETF (scripts/import-etf-holdings.mjs). Anon
// key only; latest month first, then that month's rows, so a half-imported
// newer month never mixes with an older one.

function headers(anonKey) {
  return { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
}

export function buildLatestHoldingsMonthUrl({ url }) {
  const params = new URLSearchParams({ select: 'holdings_month', order: 'holdings_month.desc', limit: '1' });
  return `${String(url).replace(/\/$/, '')}/rest/v1/etf_top_holdings?${params.toString()}`;
}

export function buildHoldingsByMonthUrl({ url, month, symbols }) {
  const params = new URLSearchParams({
    select: 'etf_symbol,rank,holding_code,holding_name,pct_of_nav',
    holdings_month: `eq.${month}`,
    etf_symbol: `in.(${[...symbols].join(',')})`,
    order: 'etf_symbol.asc,rank.asc',
    limit: '1000'
  });
  return `${String(url).replace(/\/$/, '')}/rest/v1/etf_top_holdings?${params.toString()}`;
}

/** Top-10 share of NAV and the largest holdings, as SITCA reports them. */
export function summarizeHoldings(rows) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const pct = sorted.map((r) => Number(r.pct_of_nav)).filter(Number.isFinite);
  return {
    top10Pct: pct.length ? pct.reduce((sum, x) => sum + x, 0) : null,
    holdings: sorted.map((r) => ({ rank: r.rank, code: r.holding_code, name: r.holding_name, pct: Number(r.pct_of_nav) }))
  };
}

/** @returns {Promise<{month: string|null, bySymbol: Map<string, ReturnType<typeof summarizeHoldings>>}>} */
export async function fetchLatestEtfHoldings({ url, anonKey, symbols, fetchImpl = fetch }) {
  const monthResponse = await fetchImpl(buildLatestHoldingsMonthUrl({ url }), { headers: headers(anonKey) });
  if (!monthResponse.ok) throw new Error(`etf_top_holdings request failed: ${monthResponse.status}`);
  const month = (await monthResponse.json())[0]?.holdings_month ?? null;
  if (!month) return { month: null, bySymbol: new Map() };
  const response = await fetchImpl(buildHoldingsByMonthUrl({ url, month, symbols }), { headers: headers(anonKey) });
  if (!response.ok) throw new Error(`etf_top_holdings request failed: ${response.status}`);
  const grouped = new Map();
  for (const row of await response.json()) {
    if (!grouped.has(row.etf_symbol)) grouped.set(row.etf_symbol, []);
    grouped.get(row.etf_symbol).push(row);
  }
  return { month, bySymbol: new Map([...grouped].map(([symbol, rows]) => [symbol, summarizeHoldings(rows)])) };
}
