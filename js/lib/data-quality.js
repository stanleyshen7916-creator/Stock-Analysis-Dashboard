// Data Quality assessment for the Analysis Workspace (Issue #84). Reports
// only what can be verified from the records/fetches already on screen -
// never guesses at expected trading-day counts (this dashboard has no
// access to a trading_calendar reference, so "missing days" cannot be
// distinguished from legitimate weekends/holidays without one; claiming to
// detect gaps without that reference would itself be a fabrication).

/**
 * @param {object} params
 * @param {Array} params.records - market_daily rows for the current symbol, oldest first (may be empty).
 * @param {Array|null} params.fundamentals - fetched fundamentals periods, null while loading/failed, [] when confirmed empty.
 * @param {Array|null} params.corporateActions - fetched corporate-action events, null while loading/failed, [] when confirmed empty.
 * @returns {object|null} null when there is no market data at all (nothing to assess).
 */
export function buildDataQuality({ records, fundamentals, corporateActions }) {
  if (!records || records.length === 0) return null;

  const latest = records[records.length - 1];
  const missingFields = [];
  if (latest.source == null) missingFields.push('資料來源（source）');
  if (latest.sourceTimestamp == null) missingFields.push('來源時間戳記（source_timestamp）');
  if (latest.lastCheckedAt == null) missingFields.push('最後確認時間（last_checked_at）');

  return {
    latestTradingDate: latest.tradingDate,
    recordCount: records.length,
    missingFields,
    fundamentalsStatus: statusOf(fundamentals),
    corporateActionsStatus: statusOf(corporateActions)
  };
}

// UNKNOWN: fetch hasn't completed (or failed) yet - not the same as
// confirmed-empty, so the workspace must not claim "no data exists".
// UNAVAILABLE: fetch completed and confirmed there is genuinely no data.
// AVAILABLE: fetch completed with at least one real record.
function statusOf(fetchResult) {
  if (fetchResult === null || fetchResult === undefined) return 'UNKNOWN';
  return fetchResult.length === 0 ? 'UNAVAILABLE' : 'AVAILABLE';
}
