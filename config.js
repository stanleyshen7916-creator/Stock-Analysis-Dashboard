// Production Supabase public configuration. This is a publishable/anon
// credential; never place a service-role/secret key in the repository.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://kvffithbxqstrpbausbo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_tt4X-E1hjMyg5DGXoiK_0Q_EtoNxLc4'
};

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
