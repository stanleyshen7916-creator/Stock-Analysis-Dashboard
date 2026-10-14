const NUMERIC_FIELDS = ['open', 'high', 'low', 'close', 'volume'];

// Issue #176: PostgREST applies `limit` to the query's own `order`, so
// `trading_date.asc` + a bounded limit returns the OLDEST `limit` rows for
// a symbol, not the most recent ones - indistinguishable from "correct" only
// while a symbol's total row count stays under `limit`. Once the historical
// backfill (G3-1) deepened per-symbol history well past every caller's
// limit (30/60/180), every fetchSymbolDailySeries() caller silently started
// rendering stale, years-old closes (caught for real in Production - see
// docs/ISSUE176_LIVE_DASHBOARD_QA_EXECUTION_REPORT.md). Fetching
// `trading_date.desc` + limit correctly returns the most recent `limit`
// rows regardless of total history depth; the ascending order callers
// actually need for charting/indicator math is restored by the client-side
// `.sort()` in fetchSymbolDailySeries() below, unchanged.
export function buildMarketDailyQueryUrl({ url, symbol, limit = 180 }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({
    symbol: `eq.${symbol}`,
    order: 'trading_date.desc',
    limit: String(limit)
  });
  return `${base}/rest/v1/market_daily?${params.toString()}`;
}

/**
 * Newest-first, small bounded limit - for "what are the most recent N rows"
 * queries (e.g. the Watchlist's last-price/daily-change, v0.4.0 Issue #98).
 * A lighter-weight alternative to fetchSymbolDailySeries() for callers that
 * only need the latest one or two rows (no technical-indicator math), not a
 * full charting window. Same desc+limit shape already established by
 * buildFundamentalsQueryUrl/buildCorporateActionsQueryUrl - both now share
 * the same query direction as buildMarketDailyQueryUrl() above (Issue #176).
 */
export function buildLatestMarketDailyQueryUrl({ url, symbol, limit = 2 }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({
    symbol: `eq.${symbol}`,
    order: 'trading_date.desc',
    limit: String(limit)
  });
  return `${base}/rest/v1/market_daily?${params.toString()}`;
}

export function normalizeMarketDailyRow(row) {
  return {
    symbol: String(row?.symbol ?? '').toUpperCase(),
    market: row?.market ?? '',
    tradingDate: row?.trading_date ?? '',
    open: Number(row?.open),
    high: Number(row?.high),
    low: Number(row?.low),
    close: Number(row?.close),
    volume: Number(row?.volume),
    source: row?.source ?? '',
    sourceTimestamp: row?.source_timestamp ?? null,
    lastCheckedAt: row?.last_checked_at ?? null
  };
}

export function isValidDailyRow(record) {
  if (!record.symbol || !/^\d{4}-\d{2}-\d{2}$/.test(record.tradingDate)) return false;
  if (NUMERIC_FIELDS.some((field) => !Number.isFinite(record[field]) || record[field] < 0)) return false;
  if (record.high < record.low) return false;
  return true;
}

/**
 * Dashboard Data Adapter: reads normalized OHLCV rows for one symbol from
 * Supabase (market_daily) using the publishable anon key only. This is the
 * only path the dashboard uses to reach market data - it never calls
 * TWSE/TPEx directly.
 */
export async function fetchSymbolDailySeries({ url, anonKey, symbol, limit = 180, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  if (!symbol) throw new Error('symbol is required');

  const normalizedSymbol = String(symbol).trim().toUpperCase();
  const requestUrl = buildMarketDailyQueryUrl({ url, symbol: normalizedSymbol, limit });
  const response = await fetchImpl(requestUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`market_daily query failed (${response.status}): ${body}`);
  }

  const rows = await response.json();
  const records = rows.map(normalizeMarketDailyRow).filter(isValidDailyRow);
  records.sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
  return records;
}

/**
 * Fetches the most recent `limit` market_daily rows for one symbol
 * (newest-first) - for the Watchlist's per-row last-price/daily-change
 * (v0.4.0, Issue #98), not the full charting window fetchSymbolDailySeries()
 * provides. Never throws on "no data" - returns an empty array, since a
 * newly-added watchlist symbol may not have any market_daily rows yet.
 */
export async function fetchLatestMarketDailyRows({ url, anonKey, symbol, limit = 2, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  if (!symbol) throw new Error('symbol is required');

  const normalizedSymbol = String(symbol).trim().toUpperCase();
  const requestUrl = buildLatestMarketDailyQueryUrl({ url, symbol: normalizedSymbol, limit });
  const response = await fetchImpl(requestUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`market_daily query failed (${response.status}): ${body}`);
  }

  const rows = await response.json();
  const records = rows.map(normalizeMarketDailyRow).filter(isValidDailyRow);
  records.sort((a, b) => b.tradingDate.localeCompare(a.tradingDate));
  return records;
}

/**
 * Latest close + day-over-day change, from newest-first records (as
 * fetchLatestMarketDailyRows returns). Same change/changePercent formula
 * buildSummary() already uses in chart-series.js, factored out for reuse
 * here without needing the full charting window. `null` with zero records;
 * change/changePercent are 0 with only one record (no prior day to compare
 * against yet - same convention buildSummary() already uses).
 */
export function computeLatestPriceChange(records) {
  if (!records || records.length === 0) return null;
  const [latest, previous] = records;
  const change = previous ? latest.close - previous.close : 0;
  const changePercent = previous && previous.close !== 0 ? (change / previous.close) * 100 : 0;
  return { latestClose: latest.close, tradingDate: latest.tradingDate, change, changePercent };
}
