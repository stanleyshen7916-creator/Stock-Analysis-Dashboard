# AI Stock Selection Dashboard

Public, read-only presentation layer for Stanley's personal AI stock research
platform. This repo is intentionally presentation-only: no AI selection
logic, no scoring formulas, no private pipeline code. All Production Data is
computed and written by the private `stock-analysis-system` repo; this
dashboard only reads it back via Supabase REST.

Static site, no build step, no framework - plain HTML/CSS/ES modules,
matching the private repo's own established convention of calling Supabase
REST directly with `fetch()` rather than an SDK.

## Structure

- `index.html` - app shell (left navigation, header, single content area)
- `css/style.css` - light theme, 16:9 desktop-first, responsive to iPad/mobile
- `js/app.js` - hash router + page renderers
- `js/data.js` - Supabase REST reads (market_top50/market_daily/fundamentals)
- `js/auth.js` - Supabase Auth (GoTrue REST) sign up/in/out
- `js/observation-list.js` - builds the six-horizon Observation List from
  data already persisted by `compute-market-top50.mjs` (never recomputes a
  score client-side)
- `js/recommendation-change.js`, `js/company-name-lookup.js`,
  `js/historical-data-status.js`, `js/horizons.js` - vendored verbatim from
  the private repo (pure, non-scoring logic only - safe to ship publicly)
- `js/portfolio.js` - personal holdings, `localStorage` only, no broker API
- `data/company-names.json` - versioned snapshot of the real TWSE/TPEx
  company registry (symbol + company name), copied from the private repo's
  own committed snapshot

## Architecture: Private Core stays private

The AI Selection Engine's actual scoring/target-price/horizon-classification
logic (`recommendation-engine.js`, `investment-horizon.js`, etc.) lives only
in the private `stock-analysis-system` repo and is never shipped here.
Instead, `stock-analysis-system`'s `compute-market-top50.mjs` batch job
persists the already-computed results this dashboard needs directly onto
`market_top50` (`observation_horizons`, `score_breakdown`,
`recommendation_reason` - see that repo's migration 013). This dashboard
only reads and renders those columns.

## Auth

Supabase Auth (email/password, via the GoTrue REST API) gates Production
Data reads once the private repo's migration 012
(`public_dashboard_auth_gate.sql`) is applied - RLS then requires an
`authenticated` session for `market_daily`/`market_top50`/
`corporate_actions`/`fundamentals`. Until that migration is applied, these
tables remain anon-readable (today's real state), so the app also works
without logging in. Sign up creates a real Supabase Auth user directly from
the login box; if the Supabase project requires email confirmation, check
your inbox before the first sign-in succeeds.

## Deployment

GitHub Pages, serving this repo's root - enable it in
**Settings → Pages → Deploy from a branch → `main` / `/ (root)`** (a
one-time manual step; this app has no build step so no Actions-based
deploy workflow is needed).

## QA

`.github/workflows/qa-live-dashboard.yml` (`workflow_dispatch`) drives every
route with Playwright against the real Production Supabase project on both
a desktop and mobile viewport, checking for console errors and horizontal
overflow. This repo's `config.js` already carries the real, non-secret
anon/publishable key, so no repository secrets are required for this
workflow.

## Known Limitations

See `docs/M15-M23_EXECUTION_REPORT.md` for the full, current list.
