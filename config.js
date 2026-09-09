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
    ['dashboard-data-pages-v2.js?v=20260909-data-pages-v2', false]
  ];
  scripts.forEach(([src, async]) => { const s=document.createElement('script'); s.src=src; s.async=async; document.head.appendChild(s); });
})();
