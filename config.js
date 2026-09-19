// Production Supabase public configuration.
// Cloud is the default and remains the rollback target.
// Local mode is explicitly opt-in: ?runtime=local&key=<local publishable/anon key>
const params = new URLSearchParams(window.location.search);
const localMode = params.get('runtime') === 'local';
const localKey = params.get('key') || window.LOCAL_RUNTIME_CONFIG?.SUPABASE_ANON_KEY || '';
if (localMode && !localKey) {
  throw new Error('Local runtime requested but no publishable/anon key was supplied. Use ?runtime=local&key=<key from supabase status>.');
}
window.APP_CONFIG = localMode
  ? { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: localKey }
  : {
      SUPABASE_URL: 'https://kvffithbxqstrpbausbo.supabase.co',
      SUPABASE_ANON_KEY: 'sb_publishable_tt4X-E1hjMyg5DGXoiK_0Q_EtoNxLc4'
    };

window.STOCK_ANALYSIS_RUNTIME = localMode ? 'LOCAL' : 'CLOUD';

(() => {
  const scripts = [
    ['analysis-tabs-v2.js?v=20260905-tabs-v2', false],
    ['analysis-tabs-fix.js?v=20260905-tabs-fix-v2', false],
    ['stock-analysis-production.js?v=20260907-production-v1', false],
    ['dashboard-ux-acceptance-v1.js?v=20260909-ux-v1', false],
    ['dashboard-data-pages-v2.js?v=20260909-data-pages-v2', false],
    ['dashboard-top50-layout-v1.js?v=20260909-top50-layout-v1', false],
    ['dashboard-top50-names-v1.js?v=20260909-top50-names-v1', false],
    ['dashboard-reference-v5.js?v=20260915-reference-v5', false],
    ['dashboard-reference-v5-portfolio-fix.js?v=20260915-portfolio-fix', false],
    ['individual-analysis-reference-v6.js?v=20260915-analysis-v6', false],
    ['dashboard-desktop-overflow-fix-v1.js?v=20260914-overflow-v1', false]
  ];
  scripts.forEach(([src, async]) => { const s=document.createElement('script'); s.src=src; s.async=async; document.head.appendChild(s); });
})();
