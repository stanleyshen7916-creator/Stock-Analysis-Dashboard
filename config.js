// Production Supabase public configuration - same real project the
// private Stock-Analysis-System repo's dashboard already uses
// (public/js/config.js there). This is a publishable/anon credential;
// access control is enforced by Supabase Row Level Security, not by
// keeping this value secret. Never put a service-role/secret key here.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://kvffithbxqstrpbausbo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_tt4X-E1hjMyg5DGXoiK_0Q_EtoNxLc4'
};

// Load the validated individual-stock tab controller after configuration is available.
(() => {
  const script = document.createElement('script');
  script.src = 'analysis-tabs-v2.js?v=20260905-tabs-v2';
  script.async = false;
  document.head.appendChild(script);
  const guard = document.createElement('script');
  guard.src = 'analysis-tabs-fix.js?v=20260905-tabs-fix-v2';
  guard.async = false;
  document.head.appendChild(guard);
})();
