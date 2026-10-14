// Bulk market_daily reader for the M4 Top-50 batch job (Section 13,
// Issue #133) - avoids one Supabase REST call per symbol (thousands of
// round trips for a full-market scan). Fetches every row within a
// lookback window in a small number of paginated requests instead, then
// the caller groups rows locally (src/market/universe.js) - "batch
// queries + single data load + local computation", not a redesign of the
// existing per-symbol dashboard adapter (supabase-market-data-source.js),
// which stays exactly as-is for its own per-symbol use cases.

const PAGE_SIZE = 1000; // PostgREST's default max rows per response.

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
    sourceTimestamp: row?.source_timestamp ?? null
  };
}

/**
 * @param {object} params
 * @param {string} params.url - Supabase project URL.
 * @param {string} params.apiKey - service-role key (server-side batch job only, never shipped to the browser).
 * @param {string} params.sinceDate - 'YYYY-MM-DD', inclusive lower bound on trading_date.
 * @param {Iterable<string>} [params.symbols] - optional symbol allow-list (matches the
 *   `symbol` column only, not market-qualified). Omit to fetch every symbol, as every
 *   existing caller (M4/M5/M6 full-market scans) already does - this is strictly
 *   additive. Callers that only need a known, small set of symbols (e.g. the Dashboard's
 *   Algorithm Validation panel, which otherwise re-fetches the entire market's history
 *   client-side) should pass it to avoid pulling rows they will never look up.
 * @param {Function} [params.fetchImpl]
 * @returns {Promise<Array<object>>} every market_daily row with trading_date >= sinceDate
 *   (and, if `symbols` is given, symbol in that set), normalized.
 */
export async function fetchMarketDailySince({ url, apiKey, sinceDate, symbols, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase API key is required');
  if (!sinceDate) throw new Error('sinceDate is required');

  const base = String(url).replace(/\/$/, '');
  const symbolList = symbols ? [...symbols] : null;
  const symbolFilter = symbolList && symbolList.length > 0 ? `&symbol=in.(${symbolList.join(',')})` : '';
  const rows = [];
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      trading_date: `gte.${sinceDate}`,
      order: 'market.asc,symbol.asc,trading_date.asc',
      offset: String(offset),
      limit: String(PAGE_SIZE)
    });
    const response = await fetchImpl(`${base}/rest/v1/market_daily?${params.toString()}${symbolFilter}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`market_daily bulk query failed (${response.status}): ${body}`);
    }
    const page = await response.json();
    rows.push(...page.map(normalizeMarketDailyRow));
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}
