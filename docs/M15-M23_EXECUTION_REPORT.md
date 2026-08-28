# M15-M23 Execution Report

Per `Stock Analysis Dashboard｜M15-M23 Claude Code 執行規格 v1.0`. This repo
started as a README-only placeholder (`UX Prototype v0.1` description, no
code) - this execution builds the real, functional static site and wires it
to live Production Data, following the LOCKED UX in that spec's Section 2
without redesigning it.

## Completed

- **M15 - Dashboard Production Data Wiring**: homepage (`#/overview`) reads
  real `market_top50` via `js/data.js`'s `fetchTop50Snapshot()`. Symbol +
  company name both always present (`data/company-names.json` +
  `js/company-name-lookup.js`); search supports both symbol and company
  name (`#global-search`).
- **M16 - AI Observation List**: `js/observation-list.js` builds all six
  horizons (當沖/短期/短中期/中期/中長期/長期) directly from
  `observation_horizons` persisted on `market_top50` - not recomputed
  client-side. Each entry shows rank/symbol+name/horizon/AI Score/current
  price/target price/expected return/recommendation/reason/updated-at, plus
  status (NEW/UPGRADED/維持/DOWNGRADED/REMOVED via `changeType`).
- **M17 - Daily Recommendation Change**: `js/recommendation-change.js`
  (vendored pure diff) compares each symbol's two most recent real
  `market_top50` rows. Shown per-entry (original vs new score/target,
  change badge) on the homepage's "今日 AI 推薦變化" section and inline in
  the Observation List - never overwrites the original recommendation, only
  displays the diff alongside it.
- **M18/M19 - AI Selection Engine Result + Process page**: `#/selection-flow`
  reads the `score_breakdown` field (Fundamental/Technical raw score →
  weight → weighted score → Composite Score, real numbers from the private
  repo's actual weights) and `recommendation_reason` (real triggered
  signals). Chip is explicitly disclosed as unavailable (no fabricated
  score) - see Known Limitations for the spec's illustrative 9-dimension
  table vs. what this project has actually verified.
- **M20 - Individual Stock Analysis**: `#/stock/:market/:symbol` - price
  history (`market_daily`, last 60 days), fundamentals (`fundamentals`,
  including real P/E and P/B computed from public financial data), AI
  Score/Target/Risk recommendation history (`market_top50` history for that
  symbol), data source and timestamp. Reached from any symbol/company-name
  link across the app - a real separate navigation view, not merged into
  the homepage.
- **M21 - My Portfolio**: `#/portfolio` - symbol/name/shares/cost/purchase
  date/note input (`js/portfolio.js`, `localStorage` only), showing market
  value/P&L/return% (computed from real `market_top50.reference_price` when
  the symbol is currently listed there) and AI Score/target/recommendation.
  No broker API, no order placement anywhere in this repo.
- **M22 - Historical Data status**: `#/historical` -
  `js/historical-data-status.js` (vendored from the private repo's own
  status runner) shows real earliest/latest date, total rows, and 5-/10-year
  coverage per market from `market_daily` - reports honestly when coverage
  is short of target, never inflates it.
- **M23 - Production QA**: see below.

## Changed Files

New (this repo was README-only before):
`index.html`, `css/style.css`, `js/app.js`, `js/auth.js`, `js/data.js`,
`js/config.js`, `js/observation-list.js`, `js/horizons.js`,
`js/recommendation-change.js` (vendored), `js/company-name-lookup.js`
(vendored), `js/historical-data-status.js` (vendored), `js/portfolio.js`,
`data/company-names.json` (copied snapshot), `package.json`,
`scripts/qa-live-dashboard.mjs`, `.github/workflows/qa-live-dashboard.yml`.
Updated: `README.md`.

**Companion change in the private `stock-analysis-system` repo** (branch
`feature/m11-m23-production-readiness`, not this repo): migration 013
(`market_top50_observation_traceability.sql`) and an extension to
`compute-market-top50.mjs`/`recommendation-engine.js` to persist
`observation_horizons`/`score_breakdown`/`recommendation_reason` - required
for M16/M18/M19 above to have real data to read. **Not yet applied to
Production** (see Known Limitations - this is a hard dependency).

## Data Sources

All reads are direct Supabase REST calls (`fetch()`, no SDK) against the
real Production project (`https://kvffithbxqstrpbausbo.supabase.co`, same
project the private repo's own dashboard uses) using the real
publishable/anon key already committed in `js/config.js` (not secret;
access control is Supabase RLS, not key secrecy). This repo performs no
writes to any table.

## Database

Tables read (all pre-existing, no new schema from this repo):
`market_top50` (+ 3 new columns from the private repo's migration 013),
`market_daily`, `fundamentals`. Auth uses Supabase's built-in `auth` schema
via GoTrue REST (`/auth/v1/signup`, `/auth/v1/token`, `/auth/v1/logout`) -
no custom users table.

## AI Engine

**None shipped in this repo.** Every AI Score/target price/horizon fit/
recommendation reason is read as already-computed data from
`market_top50`, written by the private repo's `compute-market-top50.mjs` +
`recommendation-engine.js`/`investment-horizon.js`. This repo contains zero
scoring, weighting, or classification logic beyond the two small, pure,
non-secret utilities vendored verbatim
(`recommendation-change.js` - a diff function; `historical-data-status.js` -
aggregate queries) - matching Stanley's confirmed Private Core + Protected
Public Dashboard architecture.

## Tests

No unit test framework in this repo yet (a static site with no computed
logic worth unit-testing beyond the two vendored pure functions, which are
already unit-tested in the private repo). Verification performed:
- `node --check` on every `.js` file - 0 syntax errors.
- Local Playwright smoke test (this sandbox's own network cannot reach
  Supabase - see QA below) against every route on desktop (1280×900) and
  mobile (390×844) viewports: 0 real console errors (only the expected,
  harmless `favicon.ico` 404), 0 horizontal overflow after a CSS fix (the
  header's search+auth controls initially overflowed the 390px viewport,
  found and fixed during this QA pass).

## QA

- **Functional**: all 12 left-nav routes render without throwing; symbol/
  company-name search dropdown wired; stock detail reachable from every
  symbol link (homepage TOP10, observation list rows, recommendation
  change rows, portfolio rows).
- **Data**: relies entirely on Production's own already-verified
  ingestion/validation (private repo's M11-M14); this repo adds no new
  data-quality logic beyond honestly rendering `AVAILABLE`/`UNAVAILABLE`
  states and empty-result messages (never a fabricated placeholder).
- **Calculation**: none performed client-side (see AI Engine above) beyond
  P/E = close/EPS and P/B = close/book value per share on the stock detail
  page - standard public-domain ratios, not proprietary scoring.
- **Responsive**: Desktop 1280×900 and Mobile 390×844 verified via local
  Playwright (screenshots reviewed); iPad-width (768-1024px) covered by the
  same `max-width: 820px`/`1100px` CSS breakpoints but not independently
  screenshotted this pass.
- **Console**: 0 real errors on either viewport (see Tests above).
- **Live Production QA (`.github/workflows/qa-live-dashboard.yml`)**:
  **written but not yet run** - `workflow_dispatch` requires the workflow
  file to exist on the repository's default branch first (GitHub platform
  requirement, same limitation this project has hit before for other new
  workflow files), and this repo's default branch does not yet include
  this PR's changes. Must be dispatched once this PR merges - flagged here
  rather than silently skipped.

## Historical Coverage

Not independently re-measured by this repo (see M22 above - the
`#/historical` page reads it live). Per the private repo's own most recent
real measurement (2026-08-27, `historical-data-quality-qa.yml` run
`33058123185`): **43,760 real `market_daily` rows**, TWSE/TPEx both present,
3/3 integrity checks passing. Full earliest/latest/coverage-percent figures
are visible live on this dashboard's own `#/historical` page once deployed.

## Known Limitations

1. **Hard dependency on private-repo migration 013**: `observation_horizons`/
   `score_breakdown`/`recommendation_reason` do not exist on `market_top50`
   until Stanley applies `stock-analysis-system`'s migration 013. Until
   then, `#/observation` and `#/selection-flow` will show empty
   results for every symbol (honestly, not a crash) - confirmed live via a
   real `market-top50.yml` dispatch that failed with `PGRST204` before this
   column existed.
2. **Auth cutover not yet applied**: `stock-analysis-system`'s migration 012
   (Supabase Auth RLS gate) is written but deliberately not applied yet
   (applying it before this dashboard is deployed and confirmed working
   would break the current, still-live single-repo dashboard). Until then,
   this app also works without logging in.
3. **AI Selection Process traceability is 2 dimensions, not the spec's
   illustrative 9**: the private repo's actual, verified scoring engine
   only computes Fundamental and Technical scores (Chip has no verified
   data source and is honestly disclosed as unavailable, weight 0). The
   spec's illustrative table (Technical/Fundamental/Wave/Momentum/Trend/
   Volume/Valuation/Risk/Market Environment) does not correspond to 9
   separately-computed real scores in this project - Technical's real
   internal signals (SMA/EMA/RSI/MACD/Bollinger/Donchian/ATR/volume status)
   are disclosed via `recommendation_reason` instead of being split into
   separate top-level scores, since splitting them would require changing
   the private repo's scoring engine itself - out of this dashboard-wiring
   task's scope, and never fabricated to match the spec's table shape.
4. **No charting library**: `#/stock` shows a real OHLCV table (last 60
   days) rather than a candlestick chart - `lightweight-charts` (already a
   dependency in the private repo) was not added here to keep this repo's
   dependency surface minimal for a first pass; a real, honest limitation,
   not a placeholder.
5. **策略／參數, 市場分析, 產業分析, 回測驗證, 報告中心, 系統設定** left-nav
   items show an explicit "not yet built" message - the spec's Sections
   4-12 do not define required content for these, so nothing was
   fabricated to fill them; the nav items themselves are present (Section
   2's inventory is not reduced).
6. **`company-names.json` is a manually-copied snapshot**, not
   automatically synced from the private repo's own weekly
   `update-company-names.yml` run - a real, disclosed gap (would need a
   cross-repo push credential, a separate manual setup step for Stanley).
7. **Live Production QA workflow not yet run** - see QA section above.
8. **Supabase Auth email confirmation**: if the connected Supabase project
   requires email confirmation before first login (a project-level setting
   this session cannot see or change), sign-up alone will not be enough to
   log in immediately - the login box's error message surfaces this
   honestly rather than looping silently.
9. **GitHub Pages not yet enabled**: a one-time manual step for Stanley
   (Settings → Pages → Deploy from branch) - see README.

## Git

- Repository: `stanleyshen7916-creator/Stock-Analysis-Dashboard`
- Branch: `feature/m15-m23-dashboard-data`
- This is the repo's first real commit beyond its initial README-only
  state.
- Companion, required change in `stanleyshen7916-creator/Stock-Analysis-System`
  on branch `feature/m11-m23-production-readiness` (migration 013 +
  `compute-market-top50.mjs` extension) - must be reviewed/applied
  alongside this PR, not independently.
- PR: opened against this repo's default branch, **not merged** by Claude
  Code per spec Section 19 - awaiting GPT's Code Review → QA Review → UX
  Acceptance → Production Acceptance.
