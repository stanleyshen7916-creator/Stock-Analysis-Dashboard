// Overview page "今日 AI 推薦變化" (day-over-day Market Top 50 change) -
// pure diff over two already-fetched market_top50 snapshots (today's and
// the real previous calculation_date's, from fetchPreviousMarketTop50()).
// Never generates a narrative reason ("AI 需求持續強勁" etc.) - only
// states the mechanical fact (score went from X to Y, or entered/left the
// Top 50), matching this project's "no invented reasoning" rule for
// anything the underlying data doesn't itself assert.

export const CHANGE_TYPE = Object.freeze({
  NEW: 'NEW',
  UPGRADED: 'UPGRADED',
  DOWNGRADED: 'DOWNGRADED',
  REMOVED: 'REMOVED'
});

const CHANGE_TYPE_LABEL = { NEW: '新進', UPGRADED: '升級', DOWNGRADED: '降級', REMOVED: '移除' };

function key(row) {
  return `${row.market}:${row.symbol}`;
}

function describe(type, previousScore, currentScore) {
  if (type === CHANGE_TYPE.NEW) return '新進入 Market Top 50';
  if (type === CHANGE_TYPE.REMOVED) return `移出 Market Top 50（最後評分 ${previousScore.toFixed(1)}）`;
  return `評分由 ${previousScore.toFixed(1)} ${type === CHANGE_TYPE.UPGRADED ? '升至' : '降至'} ${currentScore.toFixed(1)}`;
}

/**
 * @param {Array<{market:string, symbol:string, recommendationScore:number|null}>} currentRows - today's calculation_date rows.
 * @param {Array<{market:string, symbol:string, recommendationScore:number|null}>} previousRows - the real prior calculation_date's rows (from fetchPreviousMarketTop50).
 * @returns {Array<{market:string, symbol:string, type:string, typeLabel:string, previousScore:number|null, currentScore:number|null, description:string}>}
 */
export function computeOverviewChanges(currentRows, previousRows) {
  const previousByKey = new Map(previousRows.map((r) => [key(r), r]));
  const currentByKey = new Map(currentRows.map((r) => [key(r), r]));
  const changes = [];

  for (const row of currentRows) {
    const previous = previousByKey.get(key(row));
    if (!previous) {
      changes.push({ market: row.market, symbol: row.symbol, companyName: row.companyName ?? null, type: CHANGE_TYPE.NEW, typeLabel: CHANGE_TYPE_LABEL.NEW, previousScore: null, currentScore: row.recommendationScore, description: describe(CHANGE_TYPE.NEW, null, row.recommendationScore) });
      continue;
    }
    // A score change requires both real numbers to compare - a symbol
    // whose score is currently unavailable on either side is never
    // guessed into an UPGRADED/DOWNGRADED classification.
    if (!Number.isFinite(previous.recommendationScore) || !Number.isFinite(row.recommendationScore)) continue;
    if (row.recommendationScore > previous.recommendationScore) {
      changes.push({ market: row.market, symbol: row.symbol, companyName: row.companyName ?? null, type: CHANGE_TYPE.UPGRADED, typeLabel: CHANGE_TYPE_LABEL.UPGRADED, previousScore: previous.recommendationScore, currentScore: row.recommendationScore, description: describe(CHANGE_TYPE.UPGRADED, previous.recommendationScore, row.recommendationScore) });
    } else if (row.recommendationScore < previous.recommendationScore) {
      changes.push({ market: row.market, symbol: row.symbol, companyName: row.companyName ?? null, type: CHANGE_TYPE.DOWNGRADED, typeLabel: CHANGE_TYPE_LABEL.DOWNGRADED, previousScore: previous.recommendationScore, currentScore: row.recommendationScore, description: describe(CHANGE_TYPE.DOWNGRADED, previous.recommendationScore, row.recommendationScore) });
    }
    // Equal score: genuinely no change, correctly omitted rather than padded in.
  }

  for (const row of previousRows) {
    if (!currentByKey.has(key(row))) {
      const previousScore = Number.isFinite(row.recommendationScore) ? row.recommendationScore : null;
      changes.push({ market: row.market, symbol: row.symbol, companyName: row.companyName ?? null, type: CHANGE_TYPE.REMOVED, typeLabel: CHANGE_TYPE_LABEL.REMOVED, previousScore, currentScore: null, description: previousScore == null ? '移出 Market Top 50' : describe(CHANGE_TYPE.REMOVED, previousScore, null) });
    }
  }

  return changes;
}
