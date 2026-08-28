// Production Data reads for the Public Dashboard - plain Supabase REST
// calls (no SDK), using the current session's bearer token (real login
// once migration 012 is applied to stock-analysis-system, anon key
// otherwise - see auth.js). Read-only: this repo never writes to
// Production tables (Section 3/14 - no service-role key is ever shipped
// here).

import { currentBearerToken } from './auth.js';

async function supabaseGet(path) {
  const token = await currentBearerToken();
  const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET ${path.split('?')[0]} failed (${response.status}): ${body}`);
  }
  return response.json();
}

async function latestCalculationDate(before = null) {
  const filter = before ? `&calculation_date=lt.${before}` : '';
  const rows = await supabaseGet(`market_top50?select=calculation_date&order=calculation_date.desc&limit=1${filter}`);
  return rows[0]?.calculation_date ?? null;
}

/**
 * @returns {Promise<{asOfDate: string|null, previousDate: string|null, current: object[], previous: object[]}>}
 *   `current`/`previous` are the real market_top50 rows for those two
 *   most recent calculation_dates (empty arrays when none exist yet -
 *   never fabricated).
 */
export async function fetchTop50Snapshot() {
  const asOfDate = await latestCalculationDate();
  if (!asOfDate) return { asOfDate: null, previousDate: null, current: [], previous: [] };

  const previousDate = await latestCalculationDate(asOfDate);
  const [current, previous] = await Promise.all([
    supabaseGet(`market_top50?calculation_date=eq.${asOfDate}&order=rank.asc`),
    previousDate ? supabaseGet(`market_top50?calculation_date=eq.${previousDate}&order=rank.asc`) : Promise.resolve([])
  ]);
  return { asOfDate, previousDate, current, previous };
}

export async function fetchTop50RowHistory(symbol, market, limit = 30) {
  return supabaseGet(`market_top50?symbol=eq.${encodeURIComponent(symbol)}&market=eq.${market}&order=calculation_date.desc&limit=${limit}`);
}

export async function fetchMarketDaily(symbol, market, sinceDate) {
  return supabaseGet(`market_daily?symbol=eq.${encodeURIComponent(symbol)}&market=eq.${market}&trading_date=gte.${sinceDate}&order=trading_date.asc`);
}

export async function fetchFundamentals(symbol, market) {
  return supabaseGet(`fundamentals?symbol=eq.${encodeURIComponent(symbol)}&market=eq.${market}&order=reporting_period.desc`);
}
