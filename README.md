# AI Stock Selection Dashboard

Public, read-only presentation layer for Stanley's personal AI stock research
platform. This repo is intentionally presentation-only: no AI selection
logic, no scoring formulas, no private pipeline code. All Production Data is
computed and written by the private `stock-analysis-system` repo; this
dashboard only reads it back via Supabase REST.

Static site, no build step, no framework - plain HTML/CSS/ES modules,
matching the private repo's own established convention of calling Supabase
REST directly with `fetch()` rather than an SDK.

## UX baseline

The visual design (`index.html`, `styles.css`, the page-navigation shape of
`app.js`) is `docs/UX_BASELINE_V1.md` - the GPT-authored, this-repo-native UX
baseline from PR #1 (branch `feature/dashboard-ux-mvp`). Per that baseline's
own Implementation Constraint, this branch does not redesign it: `app.js`
replaces PR #1's UX-mock arrays and static example panels with real
Supabase reads, and honestly discloses anything with no verified data
source instead of inventing a plausible-looking number. PR #1 itself is
explicitly "Review Required / DO NOT MERGE until Stanley confirms visual
acceptance" - this branch only reuses its already-committed files as the
structural base for data wiring; the merge decision on PR #1 remains
Stanley's.

## Structure

- `index.html` - app shell (sidebar nav, topbar, page sections) - baseline structure
- `styles.css` - baseline CSS verbatim + a documented CSS Grid overflow fix
  and a few additive rules for elements the data layer needed (symbol
  select, real-data tables)
- `app.js` - real data wiring on top of the baseline's page/click model
  (`data-page`/`data-horizon` buttons, `showPage`/`showHorizon`)
- `config.js` - Supabase URL + anon/publishable key (not secret; access
  control is Supabase RLS)
- `lib/data.js` - Supabase REST reads (market_top50/market_daily/fundamentals)
- `lib/auth.js` - Supabase Auth (GoTrue REST) sign up/in/out; implemented and
  tested but not yet wired to a UI element - the confirmed baseline has no
  login area (it explicitly removed an unclear-purpose account icon), so no
  login form was added pending explicit UX guidance once migration 012
  (Auth cutover) is applied in the private repo
- `lib/observation-list.js` - builds the six-horizon Observation List from
  data already persisted by `compute-market-top50.mjs` (never recomputes a
  score client-side)
- `lib/recommendation-change.js`, `lib/company-name-lookup.js`,
  `lib/historical-data-status.js`, `lib/horizons.js` - vendored verbatim from
  the private repo (pure, non-scoring logic only - safe to ship publicly)
- `lib/portfolio.js` - personal holdings, `localStorage` only, no broker API
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

`lib/auth.js` implements Supabase Auth (email/password, GoTrue REST) and is
ready for the private repo's migration 012 (`public_dashboard_auth_gate.sql`,
RLS gate) once applied - but is not currently wired into the UI (see
Structure above). Until migration 012 is applied, Production tables remain
anon-readable, so the app works fully without any auth UI today.

## Deployment

GitHub Pages, serving this repo's root - enable it in
**Settings → Pages → Deploy from a branch → `main` / `/ (root)`** (a
one-time manual step; this app has no build step so no Actions-based
deploy workflow is needed).

## QA

`.github/workflows/qa-live-dashboard.yml` (`workflow_dispatch`) drives every
page with Playwright against the real Production Supabase project on both
a desktop and mobile viewport, checking for console errors and horizontal
overflow. This repo's `config.js` already carries the real, non-secret
anon/publishable key, so no repository secrets are required for this
workflow.

## Known Limitations

See `docs/M15-M23_EXECUTION_REPORT.md` for the full, current list.
