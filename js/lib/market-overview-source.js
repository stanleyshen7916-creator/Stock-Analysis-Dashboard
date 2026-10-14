// Home "市場總覽" adapter (market overview data foundation) - reads the
// server-computed market_overview_daily table with the anon key only,
// same pattern as market-top50-source.js. Never computes index/turnover/
// institutional/margin/short figures itself, never calls TWSE/TPEx
// directly - it only reads what the collector
// (scripts/import-market-overview.mjs) already wrote.
//
// Per STOCK_ANALYSIS_PRODUCTION_DATA_CONTRACT_MARKET_OVERVIEW_v1.0.md §9,
// the display gate is evaluated PER FIELD, not once for the whole row:
// COMBINED.margin_balance_amount is always null (TPEx publishes no
// market-wide NTD margin amount - see docs/MARKET_OVERVIEW.md), which
// must not blank out the other four, fully-available fields. See
// isFieldAvailable()/formatOrDash() below, used by renderMarketOverview().

// Filters to data_status=VALID at the query level, not just at render
// time: the single latest trading_date row can be PARTIAL/UNAVAILABLE
// (e.g. today's fetch hasn't finished yet) while an older date's row is
// fully VALID. Falling back to that older VALID row - honestly labeled
// with its own real date via each card's note, never presented as
// "today's" figure - serves the Contract's own intent (show real,
// dated data) better than blanking a card just because the single most
// recent calendar date isn't ready, without ever masquerading a stale
// value as current (Contract §15).
export function buildLatestRowQueryUrl({ url, marketScope }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({
    market_scope: `eq.${marketScope}`,
    data_status: 'eq.VALID',
    order: 'trading_date.desc',
    limit: '1'
  });
  return `${base}/rest/v1/market_overview_daily?${params.toString()}`;
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    marketScope: row.market_scope,
    tradingDate: row.trading_date,
    dataStatus: row.data_status,
    weightedIndexClose: row.weighted_index_close === null ? null : Number(row.weighted_index_close),
    turnoverAmount: row.turnover_amount === null ? null : Number(row.turnover_amount),
    institutionalNetAmount: row.institutional_net_amount === null ? null : Number(row.institutional_net_amount),
    marginBalanceAmount: row.margin_balance_amount === null ? null : Number(row.margin_balance_amount),
    shortBalanceShares: row.short_balance_shares === null ? null : Number(row.short_balance_shares)
  };
}

// Reads the latest COMBINED row (turnover/institutional/margin/short) and
// the latest TWSE row (weighted index - there is no "combined index", see
// docs/MARKET_OVERVIEW.md), per the Contract §14 read list.
export async function fetchMarketOverview({ url, anonKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');

  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const [combinedResponse, twseResponse] = await Promise.all([
    fetchImpl(buildLatestRowQueryUrl({ url, marketScope: 'COMBINED' }), { headers }),
    fetchImpl(buildLatestRowQueryUrl({ url, marketScope: 'TWSE' }), { headers })
  ]);
  if (!combinedResponse.ok) throw new Error(`market_overview_daily COMBINED query failed (${combinedResponse.status}): ${await combinedResponse.text()}`);
  if (!twseResponse.ok) throw new Error(`market_overview_daily TWSE query failed (${twseResponse.status}): ${await twseResponse.text()}`);

  const [combinedRows, twseRows] = await Promise.all([combinedResponse.json(), twseResponse.json()]);
  return { combined: normalizeRow(combinedRows[0]), twse: normalizeRow(twseRows[0]) };
}

// A field is only ever shown when its own row's fetch pipeline succeeded
// (VALID) AND the specific value is non-null - never inferred from the
// other fields, and never from a PARTIAL/UNAVAILABLE row.
function isFieldAvailable(row, field) {
  return !!row && row.dataStatus === 'VALID' && row[field] !== null;
}

function formatNumber(value, { maximumFractionDigits = 0 } = {}) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits }).format(value);
}

function formatNtd(value) {
  const yi = value / 100000000; // 億
  return `${formatNumber(yi, { maximumFractionDigits: 1 })} 億`;
}

const UNAVAILABLE_NOTE = '資料不足 / 尚未更新 / 資料來源異常';

// Pure formatting - takes the fetch result, returns exactly what each of
// the 5 Home cards should show. Kept separate from DOM access so it's
// unit-testable without a browser.
export function formatMarketOverviewCards({ combined, twse }) {
  const cards = {
    index: { value: '—', note: UNAVAILABLE_NOTE },
    turnover: { value: '—', note: UNAVAILABLE_NOTE },
    institutional: { value: '—', note: UNAVAILABLE_NOTE },
    margin: { value: '—', note: UNAVAILABLE_NOTE },
    short: { value: '—', note: UNAVAILABLE_NOTE }
  };

  if (isFieldAvailable(twse, 'weightedIndexClose')) {
    cards.index = { value: formatNumber(twse.weightedIndexClose, { maximumFractionDigits: 2 }), note: `TWSE ${twse.tradingDate}` };
  }
  if (isFieldAvailable(combined, 'turnoverAmount')) {
    cards.turnover = { value: formatNtd(combined.turnoverAmount), note: `TWSE+TPEx ${combined.tradingDate}` };
  }
  if (isFieldAvailable(combined, 'institutionalNetAmount')) {
    const sign = combined.institutionalNetAmount >= 0 ? '買超 ' : '賣超 ';
    cards.institutional = { value: `${sign}${formatNtd(Math.abs(combined.institutionalNetAmount))}`, note: `TWSE+TPEx ${combined.tradingDate}` };
  }
  if (isFieldAvailable(combined, 'marginBalanceAmount')) {
    // Disclosed, not silent: TPEx publishes no market-wide margin NTD
    // amount (see docs/MARKET_OVERVIEW.md) - this figure is TWSE only.
    cards.margin = { value: formatNtd(combined.marginBalanceAmount), note: `TWSE only ${combined.tradingDate}` };
  }
  if (isFieldAvailable(combined, 'shortBalanceShares')) {
    cards.short = { value: `${formatNumber(combined.shortBalanceShares / 1000)} 張`, note: `TWSE+TPEx ${combined.tradingDate}` };
  }

  return cards;
}
