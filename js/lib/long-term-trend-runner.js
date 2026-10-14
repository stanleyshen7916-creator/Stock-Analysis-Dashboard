// M9 (Long-Term Historical Data & Trend Analysis, Sections 10-13) - runs
// directly in the browser against real Production market_daily/
// corporate_actions with the anon key (read-only), the same "if the
// underlying computation is already anon-key-safe, run it client-side"
// precedent M8.X established for Algorithm Validation/AI Final Output.
//
// Composes only already-existing, unmodified pieces - no second engine:
//   - src/analysis/long-term-metrics.js (M9) -> public/vendor/calc/long-term-metrics.js
//   - src/corporate-action/index.mjs's applyAdjustment() (M6/Phase 7) -> public/vendor/calc/corporate-action-adjustment.js
//   - fetchCorporateActionEvents() (Phase 7's existing corporate-action reader)

import { computeLongTermMetrics } from '../../vendor/calc/long-term-metrics.js';
import { applyAdjustment } from '../../vendor/calc/corporate-action-adjustment.js';
import { fetchCorporateActionEvents } from './supabase-fundamental-corporate-action-source.js';

const PAGE_SIZE = 1000; // PostgREST's default max rows per response - same pagination pattern as bulk-market-data-reader.js.

/**
 * Paginated fetch of every real market_daily row for one symbol, ascending
 * by trading_date - up to 10 years of daily rows (~2,500 trading days)
 * comfortably needs pagination, unlike the Stock Detail chart's bounded
 * fetchSymbolDailySeries() (default limit 180).
 */
async function fetchFullSymbolHistory({ url, anonKey, symbol, fetchImpl = fetch }) {
  const base = String(url).replace(/\/$/, '');
  const rows = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({ symbol: `eq.${symbol}`, order: 'trading_date.asc', offset: String(offset), limit: String(PAGE_SIZE) });
    const response = await fetchImpl(`${base}/rest/v1/market_daily?${params.toString()}`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (!response.ok) throw new Error(`market_daily query failed (${response.status}): ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows.map((row) => ({ tradingDate: row.trading_date, open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: Number(row.volume) }));
}

/**
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.apiKey - anon/publishable key, read-only.
 * @param {string} params.symbol
 * @param {Function} [params.fetchImpl]
 */
export async function runLongTermTrendAnalysis({ url, apiKey, symbol, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase anon key is required');
  if (!symbol) throw new Error('symbol is required');

  const normalizedSymbol = String(symbol).trim().toUpperCase();
  let records;
  try {
    records = await fetchFullSymbolHistory({ url, anonKey: apiKey, symbol: normalizedSymbol, fetchImpl });
  } catch (err) {
    return { symbol: normalizedSymbol, recordCount: 0, series: [], metrics: null, skipReason: err.message };
  }

  if (records.length === 0) {
    return { symbol: normalizedSymbol, recordCount: 0, series: [], metrics: null, skipReason: null };
  }

  // Corporate-action adjustment (Section 9): real events for this symbol,
  // applied unchanged via M6/Phase 7's own applyAdjustment(). A fetch
  // failure or zero real events still yields a real raw series - the
  // adjusted fields simply equal the raw ones (factor 1), never blocking
  // the whole panel on an optional layer. Every real event currently
  // stored is eventType 'other' with a direct pre-computed factor (Issue
  // #67's TPEx ex-rights/ex-dividend parser - see
  // src/corporate-action/providers/tpex-exright-daily.js's own comment on
  // why a direct factor is used rather than re-deriving one from raw
  // dividend/ratio components) - normalizeCorporateActionRow()'s real
  // output shape (symbol/market/effectiveDate/eventType/factor/source) is
  // passed straight through, unchanged, never re-guessed here.
  let events = [];
  try {
    events = await fetchCorporateActionEvents({ url, anonKey: apiKey, symbol: normalizedSymbol, limit: 100, fetchImpl });
  } catch {
    events = [];
  }
  const series = applyAdjustment(records, events);

  const metrics = computeLongTermMetrics(records);

  return { symbol: normalizedSymbol, recordCount: records.length, series, metrics, skipReason: null };
}
