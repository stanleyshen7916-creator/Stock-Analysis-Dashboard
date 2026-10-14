// Stock Detail page's 三大法人 input (anon key; institutional_trading is
// anon-readable, 025_institutional_trading.sql). Nets buy/sell with the
// daily batch's own buildInstitutionalFlowMap (vendored, not re-derived),
// so the same symbol gets the same chip score on both surfaces.
import { buildInstitutionalFlowMap } from '../../vendor/calc/bulk-institutional-trading-reader.js';

/**
 * @returns {Promise<{tradingDate: string, flow: {foreignNet: number|null, investmentTrustNet: number|null, dealerNet: number|null}}|null>}
 *   the symbol's most recent row, or null when it has none (most ETFs,
 *   warrants, or before the first import) - never a guessed neutral flow.
 */
export async function fetchLatestInstitutionalFlow({ url, anonKey, symbol, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  if (!symbol) throw new Error('symbol is required');

  const params = new URLSearchParams({ symbol: `eq.${String(symbol).trim().toUpperCase()}`, order: 'trading_date.desc', limit: '1' });
  const response = await fetchImpl(`${String(url).replace(/\/$/, '')}/rest/v1/institutional_trading?${params.toString()}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`institutional_trading query failed (${response.status}): ${body}`);
  }
  const rows = await response.json();
  if (rows.length === 0) return null;
  const flow = buildInstitutionalFlowMap(rows).get(String(rows[0].symbol).toUpperCase());
  return flow ? { tradingDate: rows[0].trading_date, flow } : null;
}
