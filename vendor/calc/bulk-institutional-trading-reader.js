// Bulk institutional_trading reader for the M4 Top-50 batch job - same
// "one small number of paginated requests, not one REST call per symbol"
// pattern as bulk-market-data-reader.js/bulk-fundamentals-reader.js.

const PAGE_SIZE = 1000; // PostgREST's default max rows per response.

/**
 * @param {object} params
 * @param {string} params.url - Supabase project URL.
 * @param {string} params.apiKey - service-role key (server-side batch job only).
 * @param {string} params.tradingDate - 'YYYY-MM-DD', the one date to fetch.
 * @param {Function} [params.fetchImpl]
 * @returns {Promise<Array<object>>} every institutional_trading row for that date.
 */
export async function fetchInstitutionalTradingForDate({ url, apiKey, tradingDate, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase API key is required');
  if (!tradingDate) throw new Error('tradingDate is required');

  const base = String(url).replace(/\/$/, '');
  const rows = [];
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      trading_date: `eq.${tradingDate}`,
      order: 'symbol.asc',
      offset: String(offset),
      limit: String(PAGE_SIZE)
    });
    const response = await fetchImpl(`${base}/rest/v1/institutional_trading?${params.toString()}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`institutional_trading bulk query failed (${response.status}): ${body}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function numOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

function netOrNull(buy, sell) {
  if (!Number.isFinite(buy) || !Number.isFinite(sell)) return null;
  return buy - sell;
}

/**
 * Symbol -> real net institutional flow ({foreignNet, investmentTrustNet,
 * dealerNet}), ready for src/chips/signals.js's generateChipSignals(). A
 * symbol missing from `rows` (or with a null buy/sell pair) is simply
 * absent from the map - buildStockRecommendation() already treats a
 * missing institutionalFlow as "no chip data", never a guessed neutral.
 * @param {Array<object>} rows - fetchInstitutionalTradingForDate()'s raw rows.
 * @returns {Map<string, {foreignNet: number|null, investmentTrustNet: number|null, dealerNet: number|null}>}
 */
export function buildInstitutionalFlowMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const symbol = String(row?.symbol ?? '').toUpperCase();
    if (!symbol) continue;
    map.set(symbol, {
      foreignNet: netOrNull(numOrNull(row.foreign_buy), numOrNull(row.foreign_sell)),
      investmentTrustNet: netOrNull(numOrNull(row.investment_trust_buy), numOrNull(row.investment_trust_sell)),
      dealerNet: netOrNull(numOrNull(row.dealer_buy), numOrNull(row.dealer_sell))
    });
  }
  return map;
}
