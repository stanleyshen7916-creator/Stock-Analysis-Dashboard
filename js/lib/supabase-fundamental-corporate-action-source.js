// Dashboard Data Adapter for fundamentals/corporate_actions - Phase 7.
// Mirrors supabase-market-data-source.js's pattern exactly: anon key only,
// never calls MOPS/TWSE/TPEx directly. Requires
// supabase/migrations/008_dashboard_anon_read_corporate_actions_fundamentals.sql
// to be applied to production (an explicit anon-read SELECT-only policy,
// not a stray default privilege - see that migration's own comment); until
// then these queries return 401/403 in production, which the caller
// surfaces as an error rather than fabricating empty/default data.

export function buildFundamentalsQueryUrl({ url, symbol, limit = 2 }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({
    symbol: `eq.${symbol}`,
    order: 'reporting_period.desc',
    limit: String(limit)
  });
  return `${base}/rest/v1/fundamentals?${params.toString()}`;
}

export function buildCorporateActionsQueryUrl({ url, symbol, limit = 10 }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({
    symbol: `eq.${symbol}`,
    order: 'effective_date.desc',
    limit: String(limit)
  });
  return `${base}/rest/v1/corporate_actions?${params.toString()}`;
}

const FUNDAMENTAL_NUMERIC_FIELDS = ['eps', 'netIncome', 'equity', 'bookValuePerShare', 'dividendPerShare', 'revenue', 'price'];

export function normalizeFundamentalsRow(row) {
  const record = {
    symbol: String(row?.symbol ?? '').toUpperCase(),
    market: row?.market ?? '',
    reportingPeriod: row?.reporting_period ?? '',
    unit: row?.unit ?? '',
    source: row?.source ?? '',
    sourceTimestamp: row?.source_timestamp ?? null
  };
  const columnByField = {
    eps: 'eps', netIncome: 'net_income', equity: 'equity',
    bookValuePerShare: 'book_value_per_share', dividendPerShare: 'dividend_per_share',
    revenue: 'revenue', price: 'price'
  };
  for (const field of FUNDAMENTAL_NUMERIC_FIELDS) {
    const column = columnByField[field];
    if (row?.[column] != null) record[field] = Number(row[column]);
  }
  return record;
}

export function normalizeCorporateActionRow(row) {
  return {
    symbol: String(row?.symbol ?? '').toUpperCase(),
    market: row?.market ?? '',
    effectiveDate: row?.effective_date ?? '',
    eventType: row?.event_type ?? '',
    factor: row?.factor != null ? Number(row.factor) : undefined,
    source: row?.source ?? '',
    sourceTimestamp: row?.source_timestamp ?? null
  };
}

// Issue #179: the shared `fundamentals` table holds two reporting-period
// granularities with incompatible string sort order - monthly revenue rows
// ("YYYY-MM", e.g. "2026-07") from mops-monthly-revenue.js, and quarterly
// XBRL financial-statement rows ("YYYY-Qn", e.g. "2026-Q2") from
// mops-xbrl-financial-statement.js, whose own header comment already
// flagged this: "any future integration into the shared `fundamentals`
// table needs to account for mixed monthly/quarterly reportingPeriod
// labels; not addressed here." Ordering by reporting_period.desc as a
// plain string sorts "2026-Q2" ahead of "2026-07" (the character 'Q'
// compares greater than any digit), so a quarterly row with no revenue
// value can land at periods[0] even when a real, more recent monthly
// revenue figure exists a few rows behind it - confirmed live in
// Production for symbol 1102 (docs/ISSUE179_FUNDAMENTAL_PANEL_EXECUTION_REPORT.md).
// Every current consumer (renderFundamentalPanel's "X 月營收" label,
// computeMomRevenueGrowth, computeYoyRevenueGrowth's own reportingPeriod
// regex check) already assumes monthly-only periods, so this is filtered
// here once, at the shared fetch, rather than in each caller.
const MONTHLY_REPORTING_PERIOD_PATTERN = /^\d{4}-\d{2}$/;

/**
 * Fetches the most recent MONTHLY reporting periods for one symbol (newest
 * first) - quarterly XBRL rows sharing the same table are excluded (see
 * above). Never throws on "no data" - returns an empty array, since most
 * symbols have no MOPS-sourced fundamental data yet (only TWSE-listed "sii"
 * companies, and only revenue - see docs/FUNDAMENTAL_ANALYSIS.md). Default
 * limit of 13 (v0.3.0, Issue #92) is enough to reach a same-month YoY
 * comparison and populate a multi-period Revenue Trend list when
 * Production has that much history - still bounded, never unbounded, and
 * computeYoyRevenueGrowth/the trend list both degrade gracefully to
 * whatever depth is actually available when it doesn't.
 */
export async function fetchLatestFundamentals({ url, anonKey, symbol, limit = 13, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  if (!symbol) throw new Error('symbol is required');

  const requestUrl = buildFundamentalsQueryUrl({ url, symbol: String(symbol).trim().toUpperCase(), limit });
  const response = await fetchImpl(requestUrl, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`fundamentals query failed (${response.status}): ${body}`);
  }
  const rows = await response.json();
  return rows.map(normalizeFundamentalsRow).filter((record) => MONTHLY_REPORTING_PERIOD_PATTERN.test(record.reportingPeriod));
}

/**
 * Fetches recent corporate-action events for one symbol (newest first).
 * Never throws on "no data" - most symbols have none yet (only TPEx
 * cash-dividend events - see docs/CORPORATE_ACTION_DATA_SOURCES.md).
 */
export async function fetchCorporateActionEvents({ url, anonKey, symbol, limit = 10, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  if (!symbol) throw new Error('symbol is required');

  const requestUrl = buildCorporateActionsQueryUrl({ url, symbol: String(symbol).trim().toUpperCase(), limit });
  const response = await fetchImpl(requestUrl, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`corporate_actions query failed (${response.status}): ${body}`);
  }
  const rows = await response.json();
  return rows.map(normalizeCorporateActionRow);
}

const CORPORATE_ACTIONS_PAGE_SIZE = 1000; // PostgREST's default max rows per response.

/**
 * Fetches EVERY corporate_actions row (all symbols, full history - the
 * table is small; matches src/market-top50/bulk-corporate-action-reader.js's
 * server-side equivalent, anon key instead of service-role). For dashboard
 * panels that must classify/score many symbols client-side in one pass
 * (Overview horizon tiles, Portfolio, Simulation) without one REST call per
 * symbol. Never throws on "no data" - an empty table (migration not yet
 * applied, or genuinely no events) returns [].
 */
export async function fetchCorporateActionEventsBulk({ url, anonKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');

  const base = String(url).replace(/\/$/, '');
  const rows = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({ order: 'symbol.asc,effective_date.asc', offset: String(offset), limit: String(CORPORATE_ACTIONS_PAGE_SIZE) });
    const response = await fetchImpl(`${base}/rest/v1/corporate_actions?${params.toString()}`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`corporate_actions bulk query failed (${response.status}): ${body}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < CORPORATE_ACTIONS_PAGE_SIZE) break;
    offset += CORPORATE_ACTIONS_PAGE_SIZE;
  }
  return rows.map(normalizeCorporateActionRow);
}

/**
 * Symbol -> normalized events, from fetchCorporateActionEventsBulk()'s
 * output. A symbol with no events is simply absent from the map - callers
 * already default a missing entry to [] at the call site.
 */
export function buildCorporateActionEventsMap(events) {
  const map = new Map();
  for (const event of events) {
    if (!event.symbol) continue;
    if (!map.has(event.symbol)) map.set(event.symbol, []);
    map.get(event.symbol).push(event);
  }
  return map;
}

/**
 * Month-over-month revenue growth rate, only when both the latest and the
 * immediately preceding reporting period are present and the prior value
 * is a positive number - never fabricated from a single period or a
 * non-adjacent one. `periods` must already be sorted newest-first (as
 * fetchLatestFundamentals returns).
 */
export function computeMomRevenueGrowth(periods) {
  if (!Array.isArray(periods) || periods.length < 2) return null;
  const [latest, previous] = periods;
  if (latest?.revenue == null || previous?.revenue == null) return null;
  if (!Number.isFinite(previous.revenue) || previous.revenue <= 0) return null;
  return (latest.revenue - previous.revenue) / previous.revenue;
}

/**
 * Year-over-year revenue growth: the latest period vs. the period exactly
 * 12 months earlier, matched by `reportingPeriod` label (e.g. "2026-07" ->
 * "2025-07") rather than by array index - MOPS ingestion can have gaps, so
 * assuming index 12 is "12 months ago" could silently compare the wrong
 * two periods. `null` (never fabricated) when that period was not fetched
 * (Production may not have 12+ months of history yet) or its revenue isn't
 * a positive number, same convention as computeMomRevenueGrowth.
 * `periods` must already be sorted newest-first (as fetchLatestFundamentals
 * returns) and should include enough history to reach 12 months back.
 */
export function computeYoyRevenueGrowth(periods) {
  if (!Array.isArray(periods) || periods.length < 2) return null;
  const [latest] = periods;
  if (latest?.revenue == null || !/^\d{4}-\d{2}$/.test(latest.reportingPeriod ?? '')) return null;
  const [year, month] = latest.reportingPeriod.split('-').map(Number);
  const targetPeriod = `${year - 1}-${String(month).padStart(2, '0')}`;
  const priorYear = periods.find((p) => p.reportingPeriod === targetPeriod);
  if (!priorYear || priorYear.revenue == null) return null;
  if (!Number.isFinite(priorYear.revenue) || priorYear.revenue <= 0) return null;
  return (latest.revenue - priorYear.revenue) / priorYear.revenue;
}
