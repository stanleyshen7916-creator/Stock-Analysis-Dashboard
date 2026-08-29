// The six LOCKED Observation horizons (spec Section 2) - vendored
// verbatim from the private repo's OBSERVATION_LIST_HORIZONS
// (src/analysis/investment-horizon.js). Plain data, no scoring logic.
export const OBSERVATION_LIST_HORIZONS = Object.freeze([
  { key: 'DAY_TRADING', label: '當沖', labelEn: 'Day Trading', periodLabel: '0-1 日' },
  { key: 'SHORT_TERM', label: '短期', labelEn: 'Short Term', periodLabel: '約 2 週' },
  { key: 'SHORT_MEDIUM_TERM', label: '短中期', labelEn: 'Short-Medium Term', periodLabel: '3-6 個月' },
  { key: 'MEDIUM_TERM', label: '中期', labelEn: 'Medium Term', periodLabel: '6-12 個月' },
  { key: 'MEDIUM_LONG_TERM', label: '中長期', labelEn: 'Medium-Long Term', periodLabel: '12-36 個月' },
  { key: 'LONG_TERM', label: '長期', labelEn: 'Long Term', periodLabel: '36 個月以上' }
]);
