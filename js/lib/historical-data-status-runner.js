// M9 (Section 18) 資料中心/歷史資料狀態 - runs directly in the browser
// against real Production with the anon key (read-only). Per-market
// earliest/latest/total-count queries are cheap, bounded aggregate
// queries (min/max/count), never a full-table row fetch - unlike the
// server-side scheduled Data Quality QA script
// (scripts/qa-historical-data-quality.mjs), which does scan every row
// and is deliberately kept server-side for that reason (same "batch
// scans stay server-side" precedent as compute-market-top50.mjs).
//
// This panel's own "Data Quality" field is therefore a real but
// DELIBERATELY LIGHTWEIGHT spot-check (the latest trading date's rows
// only, per market) - not a re-run of the full historical scan. It is
// labeled accordingly, never presented as equivalent to the full QA.

async function supabaseGet(url, apiKey, queryString, { asCount = false, fetchImpl = fetch } = {}) {
  const headers = { apikey: apiKey, Authorization: `Bearer ${apiKey}` };
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
  return earliestDate <= cutoffDate ? 100 : null; // per-symbol coverage %% would need historical_backfill_progress; this is the whole-table earliest-date signal only, reported honestly as null (not computed) rather than guessed when not yet backfilled that far.
}

/**
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.apiKey - anon/publishable key, read-only.
 * @param {Function} [params.fetchImpl]
 */
export async function runHistoricalDataStatus({ url, apiKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase anon key is required');

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
