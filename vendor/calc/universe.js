// Market Universe selection (M4 v1.1 Section 5, Issue #133) - derives
// "today's" candidate symbol list directly from Production market_daily
// rows already bulk-fetched by the caller. Deliberately import-free (same
// convention as src/analysis/*.js): pure functions over already-fetched
// rows, no network calls, no hardcoded symbol list of any kind - the
// spec's own literal counter-example (`const stocks = ["2330", ...]`) is
// exactly what this module exists to avoid.
//
// Section 5's confirmed evidence (docs/MARKET_UNIVERSE.md): TWSE and TPEx
// do NOT share a single "latest trading_date" - each market's own latest
// date must be resolved independently, never assumed to be the same day.

/**
 * @param {Array<{market: string, tradingDate: string}>} rows
 * @returns {Record<string, string>} e.g. { TWSE: '2026-08-21', TPEx: '2026-08-24' }
 */
export function resolveLatestTradingDateByMarket(rows) {
  const latest = {};
  for (const row of rows) {
    const current = latest[row.market];
    if (!current || row.tradingDate > current) latest[row.market] = row.tradingDate;
  }
  return latest;
}

/**
 * Groups already-fetched rows into one ascending-by-date series per
 * (market, symbol) - the exact shape buildStockRecommendation() expects as
 * its `records` argument. A Map, not a plain object, since symbol codes
 * are untrusted external strings (avoids prototype-pollution-shaped keys).
 * @param {Array<object>} rows - normalized market_daily rows (see supabase-market-data-source.js's normalizeMarketDailyRow shape).
 * @returns {Map<string, Array<object>>} keyed by `${market}:${symbol}`.
 */
export function groupRecordsBySymbol(rows) {
  const bySymbol = new Map();
  for (const row of rows) {
    const key = `${row.market}:${row.symbol}`;
    if (!bySymbol.has(key)) bySymbol.set(key, []);
    bySymbol.get(key).push(row);
  }
  for (const records of bySymbol.values()) {
    records.sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
  }
  return bySymbol;
}

/**
 * The Market Universe itself: one entry per (market, symbol) that actually
 * traded on that market's own latest verified trading_date - never a
 * fabricated or hardcoded list, always derived from what Production
 * actually reported today. A symbol with only OLDER rows (delisted,
 * suspended, or simply absent from today's feed) is correctly excluded -
 * it is not "insufficient data", it is not part of today's universe at all.
 * @param {Array<object>} rows - normalized market_daily rows.
 * @param {Record<string, string>} [latestByMarket] - defaults to resolveLatestTradingDateByMarket(rows).
 * @returns {Array<{market: string, symbol: string}>}
 */
export function selectUniverseSymbols(rows, latestByMarket = resolveLatestTradingDateByMarket(rows)) {
  const seen = new Set();
  const universe = [];
  for (const row of rows) {
    if (row.tradingDate !== latestByMarket[row.market]) continue;
    const key = `${row.market}:${row.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    universe.push({ market: row.market, symbol: row.symbol });
  }
  return universe;
}
