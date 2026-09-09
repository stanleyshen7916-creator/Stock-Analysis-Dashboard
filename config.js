// Production Supabase public configuration - same real project the
// private Stock-Analysis-System repo's dashboard already uses
// (public/js/config.js there). This is a publishable/anon credential;
// access control is enforced by Supabase Row Level Security, not by
// keeping this value secret. Never put a service-role/secret key here.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://kvffithbxqstrpbausbo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_tt4X-E1hjMyg5DGXoiK_0Q_EtoNxLc4'
};

// Load the validated individual-stock analysis runtime after configuration is available.
//
// D1 fix: analysis-tabs-v2.js used to load here too, alongside
// analysis-tabs-fix.js. Both bind their own independent #analysis-search
// click handler and fetch/render pipeline against the same
// #analysis-tab-content target - analysis-tabs-fix.js is explicitly the
// superseding, self-contained replacement (see its own file header), so
// running v2 as well only doubled the concurrent Supabase requests on
// every search with no functional benefit, and was the direct cause of an
// intermittent CI failure where the Overview tab's chart rendered on one
// viewport's run but not the other in the same job (the extra, redundant
// in-flight requests pushed real network completion past the QA script's
// wait window on a cold connection). Removed; analysis-tabs-fix.js alone
// is sufficient.
(() => {
  const guard = document.createElement('script');
  guard.src = 'analysis-tabs-fix.js?v=20260905-tabs-fix-v2';
  guard.async = false;
  document.head.appendChild(guard);
  const production = document.createElement('script');
  production.src = 'stock-analysis-production.js?v=20260907-production-v1';
  production.async = false;
  document.head.appendChild(production);
  const uxAcceptance = document.createElement('script');
  uxAcceptance.src = 'dashboard-ux-acceptance-v1.js?v=20260909-ux-v1';
  uxAcceptance.async = false;
  document.head.appendChild(uxAcceptance);
})();
