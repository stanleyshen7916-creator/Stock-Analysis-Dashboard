// Production Supabase public configuration.
// This is a publishable/anon credential; access control remains in Supabase RLS.
// Never put a service-role/secret key here.
//
// Stage C (local production runtime, per STOCK_ANALYSIS_STAGE_C_CLAUDE_EXECUTION_v1.0.md
// Section C11) originally kept Cloud as the default. Since 2026-09-29
// (Stanley's decision) LOCAL is the default: the dashboard is only used on
// this machine, and Cloud now keeps just the last 150 days as a light
// fallback (see scripts/local-production/sync-to-cloud.mjs retention).
// Local Supabase's standard CLI dev keys (not sensitive the way
// Cloud's are - identical on every machine running `supabase start`, valid
// only against 127.0.0.1) are safe to ship here for local-only use.
const CLOUD_CONFIG = {
  SUPABASE_URL: 'https://kvffithbxqstrpbausbo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_tt4X-E1hjMyg5DGXoiK_0Q_EtoNxLc4'
};

const LOCAL_CONFIG = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
};

// Selection order: explicit ?runtime=local|cloud query param (one-time,
// also persists the choice) > a previously persisted choice > the default
// for where the page is served: LOCAL on this machine (localhost /
// 127.0.0.1, the full database), CLOUD anywhere else - since 2026-10-14 the
// same public/ folder is published as the GitHub Pages site
// (scripts/publish-dashboard.mjs), where the local database is unreachable.
function defaultRuntimeFor(hostname) {
  return /^(localhost|127.0.0.1|[::1])$/i.test(String(hostname ?? '')) ? 'local' : 'cloud';
}

function resolveRuntimeMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('runtime');
    if (requested === 'local' || requested === 'cloud') {
      window.localStorage.setItem('stockAnalysisRuntimeMode', requested);
      return requested;
    }
    const stored = window.localStorage.getItem('stockAnalysisRuntimeMode');
    if (stored === 'local' || stored === 'cloud') return stored;
  } catch {
    // localStorage can throw (private browsing, blocked storage) - fall
    // through to the default rather than breaking config resolution.
  }
  return defaultRuntimeFor(window.location.hostname);
}

const RUNTIME_MODE = resolveRuntimeMode();
window.APP_CONFIG = {
  ...(RUNTIME_MODE === 'local' ? LOCAL_CONFIG : CLOUD_CONFIG),
  RUNTIME_MODE
};
