// Supabase Auth (GoTrue) via plain REST calls - no @supabase/supabase-js
// SDK dependency, matching the private repo's own established
// convention of calling Supabase's REST endpoints directly with fetch()
// rather than adding an SDK (see e.g.
// stock-analysis-system/public/js/lib/supabase-market-data-source.js).
//
// This gates Production Data behind a real login once Stanley applies
// stock-analysis-system's migration 012 (public_dashboard_auth_gate),
// per the confirmed Private Core + Protected Public Dashboard
// architecture. Before that migration is applied, market_daily/
// market_top50/corporate_actions/fundamentals are still anon-readable
// (today's real state), so the app also works pre-login - the session
// object below is simply attached to every Supabase REST call when
// present, upgrading anon-role requests to authenticated-role ones.
//
// This is a personal, single-user platform (Stanley), not a multi-tenant
// SaaS - there is no per-user data model, only "is this request
// authenticated at all".

const SESSION_KEY = 'sad_auth_session_v1';

function authUrl(path) {
  return `${window.APP_CONFIG.SUPABASE_URL}/auth/v1${path}`;
}

function authHeaders(extra = {}) {
  return { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...extra };
}

async function parseAuthResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error_description || body?.msg || body?.error || `Auth request failed (${response.status})`);
  }
  return body;
}

function storeSession(tokenResponse) {
  if (!tokenResponse?.access_token) return null;
  const session = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + (tokenResponse.expires_in ?? 3600) * 1000,
    user: tokenResponse.user ?? null
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * @returns {Promise<object>} the real Supabase Auth user object.
 */
export async function signUp({ email, password }) {
  const response = await fetch(authUrl('/signup'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email, password }) });
  return parseAuthResponse(response);
}

/**
 * @returns {Promise<object|null>} the stored session, or null if this
 *   Supabase project requires email confirmation before first login
 *   (a real, honestly-reportable state - never guessed past).
 */
export async function signIn({ email, password }) {
  const response = await fetch(authUrl('/token?grant_type=password'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email, password }) });
  const tokenResponse = await parseAuthResponse(response);
  return storeSession(tokenResponse);
}

export async function signOut() {
  const session = getStoredSession();
  clearSession();
  if (!session?.accessToken) return;
  try {
    await fetch(authUrl('/logout'), { method: 'POST', headers: authHeaders({ Authorization: `Bearer ${session.accessToken}` }) });
  } catch {
    // Best-effort server-side revoke; the local session is already cleared either way.
  }
}

async function refreshSession(session) {
  const response = await fetch(authUrl('/token?grant_type=refresh_token'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ refresh_token: session.refreshToken }) });
  if (!response.ok) {
    clearSession();
    return null;
  }
  const tokenResponse = await response.json();
  return storeSession(tokenResponse);
}

/**
 * Returns a real, currently-valid session (refreshing it first if the
 * stored access token has expired), or null when no one is logged in -
 * callers fall back to the anon key, never a fabricated session.
 */
export async function getActiveSession() {
  const session = getStoredSession();
  if (!session) return null;
  if (Date.now() < session.expiresAt - 60_000) return session;
  return refreshSession(session);
}

/**
 * The Authorization header value to use for a Supabase REST/data call:
 * the real logged-in user's access token if a valid session exists,
 * otherwise the anon/publishable key (today's real access level for
 * every table until migration 012 is applied).
 */
export async function currentBearerToken() {
  const session = await getActiveSession();
  return session?.accessToken ?? window.APP_CONFIG.SUPABASE_ANON_KEY;
}
