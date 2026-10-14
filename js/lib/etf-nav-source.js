// Dashboard adapter for etf_nav_daily (ETF 專區 step 2a) - the nightly
// snapshot of TWSE's ETF NAV feed (scripts/import-etf-nav.mjs). Anon key
// only. Takes each symbol's newest row; a symbol the feed has not covered
// yet is simply absent (the page shows "—"), never an older guess.

export function buildEtfNavQueryUrl({ url, symbols, sinceDate }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({
    select: 'trading_date,symbol,market_price,estimated_nav,estimated_premium_pct,previous_nav,snapshot_time',
    symbol: `in.(${[...symbols].join(',')})`,
    trading_date: `gte.${sinceDate}`,
    order: 'trading_date.desc',
    limit: '1000'
  });
  return `${base}/rest/v1/etf_nav_daily?${params.toString()}`;
}

const numberOrNull = (value) => (value === null || value === undefined || value === '' ? null : Number(value));

export function normalizeEtfNavRow(row) {
  return {
    tradingDate: row?.trading_date ?? '',
    symbol: String(row?.symbol ?? '').toUpperCase(),
    marketPrice: numberOrNull(row?.market_price),
    estimatedNav: numberOrNull(row?.estimated_nav),
    estimatedPremiumPct: numberOrNull(row?.estimated_premium_pct),
    previousNav: numberOrNull(row?.previous_nav),
    snapshotTime: row?.snapshot_time ?? null
  };
}

/** @returns {Promise<Map<string, object>>} symbol -> newest normalized row */
export async function fetchLatestEtfNav({ url, anonKey, symbols, sinceDate, fetchImpl = fetch }) {
  const response = await fetchImpl(buildEtfNavQueryUrl({ url, symbols, sinceDate }), { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  if (!response.ok) throw new Error(`etf_nav_daily request failed: ${response.status}`);
  const latest = new Map();
  for (const row of (await response.json()).map(normalizeEtfNavRow)) {
    if (!latest.has(row.symbol)) latest.set(row.symbol, row); // rows arrive newest first
  }
  return latest;
}

/**
 * Official premium(+)/discount(-) % for the NAV date: previousNav is the
 * previous business day's official NAV, so it is compared with that day's
 * close - the last market_daily record strictly before the feed date.
 * @param {Array<{tradingDate: string, close: number}>} rawRecords ascending, un-adjusted
 */
export function computeOfficialPremium(navRow, rawRecords) {
  if (!navRow || !Number.isFinite(navRow.previousNav) || navRow.previousNav <= 0) return null;
  const prior = [...rawRecords].reverse().find((r) => r.tradingDate < navRow.tradingDate);
  if (!prior || !Number.isFinite(prior.close)) return null;
  return { date: prior.tradingDate, nav: navRow.previousNav, close: prior.close, premiumPct: (prior.close / navRow.previousNav - 1) * 100 };
}
