// Dashboard adapter for shadow_portfolio_performance - 影子追蹤實績
// (2026-09-29): each shadow strategy's cumulative result since tracking
// began (scripts/shadow-portfolio.mjs). Latest as-of date only; anon key.

export const SHADOW_STRATEGY_LABELS = {
  ENHANCED_TOP150_AI_FUNDAMENTAL_INDUSTRY_NEUTRAL: 'AI 增強指數（首頁建議配置）',
  ENHANCED_TOP150_AI_CONTINUOUS_INDUSTRY_NEUTRAL: 'AI 增強指數（連續評分版，候選）',
  ENHANCED_TOP150_EP_INDUSTRY_NEUTRAL: '增強指數（本益比倒數）',
  ENHANCED_TOP50_RESEARCH_SET_INDUSTRY_NEUTRAL: '增強指數（研究因子、前 50 大）',
  RESEARCH_SET_TOP100_CAP_N30_MAX10: '研究因子前 30 檔（單檔上限 10%）',
  RESEARCH_SET_TOP100_CAP_N30: '研究因子前 30 檔（市值加權）',
  PRODUCTION_TOP10: '對照：預期報酬觀察名單前 10 檔',
  TOP150_CAP_WEIGHTED: '基準：市值前 150 大（市值加權，AI 增強指數的比較基準）',
  TOP100_CAP_WEIGHTED: '基準：市值前 100 大（市值加權）'
};
export const SHADOW_STRATEGY_ORDER = Object.keys(SHADOW_STRATEGY_LABELS);

const numberOrNull = (v) => (v === null || v === undefined ? null : Number(v));

export async function fetchShadowPerformance({ url, anonKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  const base = String(url).replace(/\/$/, '');
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
  const latest = await fetchImpl(`${base}/rest/v1/shadow_portfolio_performance?select=as_of_date&order=as_of_date.desc&limit=1`, { headers });
  if (!latest.ok) throw new Error(`shadow_portfolio_performance latest-date query failed (${latest.status})`);
  const asOfDate = (await latest.json())[0]?.as_of_date ?? null;
  if (!asOfDate) return { asOfDate: null, rows: [] };
  const response = await fetchImpl(`${base}/rest/v1/shadow_portfolio_performance?as_of_date=eq.${asOfDate}&select=*`, { headers });
  if (!response.ok) throw new Error(`shadow_portfolio_performance query failed (${response.status})`);
  const rows = (await response.json()).map((r) => ({
    strategy: r.strategy, label: SHADOW_STRATEGY_LABELS[r.strategy] ?? r.strategy, startDate: r.start_date, rebalances: Number(r.rebalances),
    returnPercent: numberOrNull(r.return_pct), benchmarkReturnPercent: numberOrNull(r.benchmark_return_pct), excessPercent: numberOrNull(r.excess_pct)
  }));
  rows.sort((a, b) => SHADOW_STRATEGY_ORDER.indexOf(a.strategy) - SHADOW_STRATEGY_ORDER.indexOf(b.strategy));
  return { asOfDate, rows };
}
