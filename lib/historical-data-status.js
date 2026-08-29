// M22 (M11-M23 Dashboard spec v1): Historical Data status. Vendored
// verbatim from the private repo's public/js/lib/historical-data-status-runner.js
// (Section 3: Reuse First - the same real earliest/latest/count queries
// against market_daily, never a second aggregation approach). Cheap,
// bounded aggregate queries (min/max/count) only - never a full-table
// row fetch.

async function supabaseGet(url, apiKey, queryString, { asCount = false, fetchImpl = fetch } = {}) {
  const headers = { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${apiKey}` };
  if (asCount) headers.Prefer = 'count=exact';
  const res = await fetchImpl(`${url}/rest/v1/${queryString}`, { headers });
  if (!res.ok) throw new Error(`${queryString.split('?')[0]} query failed (${res.status}): ${await res.text()}`);
  const body = await res.json();
  const totalCount = asCount && res.headers?.get ? Number(res.headers.get('content-range')?.split('/')[1] ?? 'NaN') : null;
  return { body, totalCount };
}

async function marketCoverage({ url, apiKey, market, fetchImpl }) {
  const [{ body: minRows }, { body: maxRows }, { totalCount }] = await Promise.all([
    supabaseGet(url, apiKey, `market_daily?market=eq.${market}&select=trading_date&order=trading_date.asc&limit=1`, { fetchImpl }),
    supabaseGet(url, apiKey, `market_daily?market=eq.${market}&select=trading_date&order=trading_date.desc&limit=1`, { fetchImpl }),
    supabaseGet(url, apiKey, `market_daily?market=eq.${market}&select=trading_date&limit=1`, { asCount: true, fetchImpl })
  ]);
  const earliestDate = minRows[0]?.trading_date ?? null;
  const latestDate = maxRows[0]?.trading_date ?? null;

  let latestDateRows = [];
  if (latestDate) {
    const { body } = await supabaseGet(url, apiKey, `market_daily?market=eq.${market}&trading_date=eq.${latestDate}&select=symbol,open,high,low,close,volume`, { fetchImpl });
    latestDateRows = body;
  }
  const spotCheckFailures = latestDateRows.filter((r) => !(r.high >= r.low && r.open >= 0 && r.close >= 0 && r.volume >= 0)).length;

  return {
    market, earliestDate, latestDate,
    totalRows: totalCount,
    symbolCountOnLatestDate: latestDateRows.length,
    dataQuality: latestDateRows.length === 0 ? 'NO_DATA' : spotCheckFailures === 0 ? 'PASS' : 'FAIL'
  };
}

function coveragePercent(earliestDate, years, now) {
  if (!earliestDate) return null;
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return earliestDate <= cutoffDate ? 100 : null;
}

export async function runHistoricalDataStatus({ url, apiKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase key is required');

  const now = new Date();
  const [twse, tpex] = await Promise.all([
    marketCoverage({ url, apiKey, market: 'TWSE', fetchImpl }),
    marketCoverage({ url, apiKey, market: 'TPEx', fetchImpl })
  ]);

  return {
    twse: { ...twse, coverage5YPercent: coveragePercent(twse.earliestDate, 5, now), coverage10YPercent: coveragePercent(twse.earliestDate, 10, now) },
    tpex: { ...tpex, coverage5YPercent: coveragePercent(tpex.earliestDate, 5, now), coverage10YPercent: coveragePercent(tpex.earliestDate, 10, now) },
    totalRows: (twse.totalRows ?? 0) + (tpex.totalRows ?? 0),
    lastUpdated: now.toISOString()
  };
}
