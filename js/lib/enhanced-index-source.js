// Dashboard adapter for enhanced_index_allocation - 「AI 增強指數建議配置」
// (2026-09-28): the nightly allocation of the enhanced-index rule written by
// scripts/shadow-portfolio.mjs. Anon key only; same two-step
// latest-date-then-rows pattern as ai-score-ranking-source.js, so a partial
// date never splices in an older date's rows.

export function buildLatestAllocationDateQueryUrl({ url, strategy }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ select: 'calculation_date', strategy: `eq.${strategy}`, order: 'calculation_date.desc', limit: '1' });
  return `${base}/rest/v1/enhanced_index_allocation?${params.toString()}`;
}

export function buildAllocationByDateQueryUrl({ url, strategy, calculationDate }) {
  const base = String(url).replace(/\/$/, '');
  const params = new URLSearchParams({ strategy: `eq.${strategy}`, calculation_date: `eq.${calculationDate}`, order: 'weight.desc', limit: '1000' });
  return `${base}/rest/v1/enhanced_index_allocation?${params.toString()}`;
}

const numberOrNull = (value) => (value === null || value === undefined ? null : Number(value));

export function normalizeAllocationRow(row) {
  return {
    calculationDate: row?.calculation_date ?? '',
    strategy: row?.strategy ?? '',
    market: row?.market ?? '',
    symbol: String(row?.symbol ?? '').toUpperCase(),
    companyName: row?.company_name ?? null,
    industry: row?.industry ?? null,
    indexWeight: numberOrNull(row?.index_weight),
    weight: numberOrNull(row?.weight),
    factorScore: numberOrNull(row?.factor_score),
    compositeScore: numberOrNull(row?.composite_score)
  };
}

// Official TWSE/TPEx industry codes (shared scheme), verified 2026-09-28
// against the companies each code contains in TWSE t187ap03_L (e.g. 24:
// 2330 台積電, 17: 2881 富邦金, 22: 1707 葡萄王, 35: 2072 世紀風電).
export const INDUSTRY_NAMES = {
  '01': '水泥', '02': '食品', '03': '塑膠', '04': '紡織纖維', '05': '電機機械', '06': '電器電纜', '08': '玻璃陶瓷', '09': '造紙',
  10: '鋼鐵', 11: '橡膠', 12: '汽車', 14: '建材營造', 15: '航運', 16: '觀光餐旅', 17: '金融保險', 18: '貿易百貨', 20: '其他',
  21: '化學', 22: '生技醫療', 23: '油電燃氣', 24: '半導體', 25: '電腦及週邊設備', 26: '光電', 27: '通信網路', 28: '電子零組件',
  29: '電子通路', 30: '資訊服務', 31: '其他電子', 35: '綠能環保', 36: '數位雲端', 37: '運動休閒', 38: '居家生活', 91: '存託憑證'
};
export const industryName = (code) => (code == null ? '—' : INDUSTRY_NAMES[code] ?? code);

/**
 * @returns {Promise<{calculationDate: string|null, rows: Array<object>}>} normalized rows, heaviest weight first.
 */
export async function fetchEnhancedIndexAllocation({ url, anonKey, strategy, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
  const latest = await fetchImpl(buildLatestAllocationDateQueryUrl({ url, strategy }), { headers });
  if (!latest.ok) throw new Error(`enhanced_index_allocation latest-date query failed (${latest.status}): ${await latest.text()}`);
  const calculationDate = (await latest.json())[0]?.calculation_date ?? null;
  if (!calculationDate) return { calculationDate: null, rows: [] };
  const response = await fetchImpl(buildAllocationByDateQueryUrl({ url, strategy, calculationDate }), { headers });
  if (!response.ok) throw new Error(`enhanced_index_allocation query failed (${response.status}): ${await response.text()}`);
  return { calculationDate, rows: (await response.json()).map(normalizeAllocationRow) };
}
