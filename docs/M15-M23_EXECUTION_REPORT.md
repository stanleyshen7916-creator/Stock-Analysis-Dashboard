# M15-M23 Execution Report

Per `Stock Analysis Dashboard｜M15-M23 Claude Code 執行規格 v1.0`. This repo
started as a README-only placeholder - this execution builds the real,
functional static site and wires it to live Production Data.

## UX baseline discovery and reconciliation (read this first)

This branch went through two UX passes before settling on its current
structure - documented here because it changes what "the locked UX" means
for anyone reviewing this PR:

1. **First pass**: built from the spec document's own text description of
   the UX (Section 2), with no other reference available at the time.
2. **Second pass**: while investigating, two open PRs were found in the
   private `stock-analysis-system` repo (#167: `public/ux-prototype-v2/`,
   #169: `docs/ux/AI_SELECTION_FLOW_UX_PROTOTYPE_V2.svg`) containing a real,
   GPT-reviewed HTML/CSS/SVG mockup. The build was reconciled to match that
   prototype's structure instead.
3. **Third pass (current)**: while preparing this PR for review, **PR #1 in
   this repo** (`stanleyshen7916-creator/Stock-Analysis-Dashboard#1`, branch
   `feature/dashboard-ux-mvp`) was found - a newer, this-repo-native GPT UX
   baseline (`docs/UX_BASELINE_V1.md`, `index.html`, `app.js`, `styles.css`)
   created directly against this repository. Its own doc states it is the
   baseline "後續 Claude Code 資料載入與 Production Data 串接" (subsequent
   Claude Code data loading / Production Data wiring) should build on, and
   its Implementation Constraint says explicitly: "Claude Code 不得因資料
   串接需求重新設計 UX" (Claude Code must not redesign the UX for data-wiring
   reasons). Being newer, more specific, and directly addressed to this
   task, **this superseded the private-repo prototype** as the structural
   reference. This branch was rebuilt a third time on top of PR #1's actual
   committed files.

**PR #1's own status is "Review Required / DO NOT MERGE until Stanley
confirms visual acceptance."** This branch reuses its already-committed
`index.html`/`app.js`/`styles.css` as the structural base for real data
wiring (exactly what its doc asks Claude Code to do), but does **not** merge
PR #1 itself - that visual-acceptance decision remains Stanley's alone.

## Completed

- **M15 - Dashboard Production Data Wiring**: `app.js`'s init sequence
  fetches real `market_top50` via `lib/data.js`'s `fetchTop50Snapshot()` and
  replaces every one of PR #1's mock arrays (`stocks`, `changes`, the
  horizon-grid's hardcoded counts, the hero/signal-card numbers) with real
  computed values. Symbol + company name both always present
  (`data/company-names.json` + `lib/company-name-lookup.js`); search on the
  個股分析 page supports both symbol and company name.
- **M16 - AI Observation List**: `lib/observation-list.js` builds all six
  horizons directly from `observation_horizons` persisted on `market_top50`
  - not recomputed client-side. Clicking a horizon in the sidebar now
  actually filters the TOP10 table to that horizon (PR #1's own mock click
  handler updated the section title but never filtered the table - a real
  gap in its own wiring, now completed with real per-horizon data).
- **M17 - Daily Recommendation Change**: `lib/recommendation-change.js`
  (vendored pure diff) compares each symbol's two most recent real
  `market_top50` rows. Shown in the homepage's "今日 AI 推薦變化" panel with
  real counts feeding the hero card's "今日推薦變化" (升級/維持/降級) numbers.
- **M18/M19 - AI Selection Engine Result + Process page**: AI 選股流程 page's
  "分析工具得分與權重" panel reads the real `score_breakdown` field
  (Fundamental/Technical raw score → weight → weighted score → Composite
  Score) via a real per-symbol `<select>` (PR #1's mock only showed one
  static example row - a select was added as the minimal necessary
  interactive element to view more than one real symbol). Chip is
  explicitly disclosed as unavailable; the five other illustrative
  categories in PR #1's mock table (趨勢／波浪, 動能／量價, 估值, 市場／產業環境,
  風險修正) are not fabricated - see Known Limitations.
- **M20 - Individual Stock Analysis**: 個股分析 page - real search (symbol
  or company name) triggers real fetches: price history (`market_daily`,
  last 60 days), fundamentals (`fundamentals`, real P/E and P/B), AI
  Score/target/recommendation history (`market_top50` history for that
  symbol). PR #1's mock only had one static example card with no working
  search; the search box and button were wired to real fetches, and two
  additional real-data panels (基本面, 近期股價) were added below the
  existing two-panel grid to fit the M20 spec's required content - a
  reasonably minimal extension of a page whose own stated purpose is deep
  individual-stock analysis, not the homepage.
- **M21 - My Portfolio**: 我的持股 page - symbol/shares/cost input
  (`lib/portfolio.js`, `localStorage` only - two more input ids were added
  since PR #1's mock only wired the symbol field), showing real market
  value/P&L/return% (from `market_top50.reference_price` when the symbol is
  currently listed) and real AI Score/target/recommendation. No broker API,
  no order placement anywhere in this repo.
- **M22 - Historical Data status**: extends PR #1's generic 資料中心 page
  (which otherwise shows the same honest "UX 入口已建立/待串接" boilerplate as
  every other not-yet-built nav item) with a real panel showing
  `lib/historical-data-status.js` results - earliest/latest date, total
  rows, latest-date symbol count, and quality-check status per market from
  `market_daily`.
- **M23 - Production QA**: see below.

## Changed Files

This repo was rebuilt on top of PR #1's committed files (not this branch's
own earlier commits' file layout):
- `index.html`, `styles.css`, `app.js` - PR #1's baseline, with `app.js`
  rewritten for real data wiring and `styles.css` extended by a documented
  CSS Grid bug fix (see Known Limitations) plus a few additive rules.
- `config.js` (moved to repo root, was `js/config.js`).
- `lib/data.js`, `lib/auth.js`, `lib/observation-list.js`,
  `lib/company-name-lookup.js`, `lib/historical-data-status.js`,
  `lib/recommendation-change.js`, `lib/horizons.js`, `lib/portfolio.js`
  (moved from `js/` to `lib/` to match PR #1's root-level `app.js`).
- `data/company-names.json` (unchanged, copied snapshot).
- `scripts/qa-live-dashboard.mjs` (rewritten to drive PR #1's click-based
  navigation instead of a hash router - this repo has no hash router).
- `package.json`, `.github/workflows/qa-live-dashboard.yml` (unchanged).
- `README.md` (rewritten to describe the current structure and the PR #1
  UX-baseline relationship).

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
publishable/anon key already committed in `config.js` (not secret; access
control is Supabase RLS, not key secrecy). This repo performs no writes to
any table.

## Database

Tables read (all pre-existing, no new schema from this repo):
`market_top50` (+ 3 new columns from the private repo's migration 013),
`market_daily`, `fundamentals`. `lib/auth.js` is ready for Supabase's
built-in `auth` schema via GoTrue REST but is not currently wired into the
UI (see Known Limitations).

## AI Engine

**None shipped in this repo.** Every AI Score/target price/horizon fit/
recommendation reason is read as already-computed data from
`market_top50`, written by the private repo's `compute-market-top50.mjs` +
`recommendation-engine.js`/`investment-horizon.js`. This repo contains zero
scoring, weighting, or classification logic beyond the two small, pure,
non-secret utilities vendored verbatim (`recommendation-change.js` - a diff
function; `historical-data-status.js` - aggregate queries) - matching
Stanley's confirmed Private Core + Protected Public Dashboard architecture.

## Tests

No unit test framework in this repo (a static site with no computed logic
worth unit-testing beyond the two vendored pure functions, already
unit-tested in the private repo). Verification performed:
- `node --check` on every `.js` file - 0 syntax errors.
- Local Playwright pass with mocked Supabase REST responses (this sandbox's
  own network cannot reach the real Supabase project - see QA below): every
  page (dashboard, a filtered horizon, a real stock search, AI 選股流程 with
  a real per-symbol breakdown, portfolio add/compute, 資料中心's real
  historical-coverage numbers) verified to render real fixture data
  correctly on desktop (1280×900) and mobile (390×844), 0 console errors, 0
  horizontal overflow (after the CSS Grid fix below).

## QA

- **Functional**: all 11 left-nav pages render without throwing; horizon
  click actually filters the TOP10 table (a real gap vs. PR #1's mock,
  fixed); symbol/company-name search on 個股分析 wired to real fetches;
  stock links from the TOP10 table navigate to 個股分析 and run a real fetch
  automatically.
- **Data**: relies entirely on Production's own already-verified
  ingestion/validation (private repo's M11-M14); this repo adds no new
  data-quality logic beyond honestly rendering AVAILABLE/UNAVAILABLE states
  and empty-result messages (never a fabricated placeholder).
- **Calculation**: none performed client-side beyond P/E = close/EPS and
  P/B = close/book value per share on the stock detail page - standard
  public-domain ratios, not proprietary scoring - and simple portfolio P&L
  arithmetic (market value, cost basis, return %).
- **Responsive**: Desktop 1280×900 and Mobile 390×844 verified via local
  Playwright with mocked data (screenshots reviewed); a real CSS Grid
  overflow bug was found and fixed (see Known Limitations).
- **Console**: 0 real errors on either viewport in the mocked-data pass.
- **Live Production QA (`.github/workflows/qa-live-dashboard.yml`)**:
  rewritten for this repo's click-based navigation (no hash router).
  **Written but not yet run** - `workflow_dispatch` requires the workflow
  file to exist on the repository's default branch first (GitHub platform
  requirement, hit before on this project for other new workflow files),
  and this repo's default branch does not yet include this PR's changes.
  Must be dispatched once this PR merges.

## Historical Coverage

Not independently re-measured by this repo (see M22 above - the 資料中心 page
reads it live). Per the private repo's own most recent real measurement
(2026-08-27, `historical-data-quality-qa.yml` run `33058123185`): **43,760
real `market_daily` rows**, TWSE/TPEx both present, 3/3 integrity checks
passing. Full earliest/latest/coverage-percent figures are visible live on
this dashboard's own 資料中心 page once deployed.

## Known Limitations

1. **Hard dependency on private-repo migration 013**: `observation_horizons`/
   `score_breakdown`/`recommendation_reason` do not exist on `market_top50`
   until Stanley applies `stock-analysis-system`'s migration 013. Until
   then, 觀察清單 filtering and AI 選股流程's real breakdown will show empty
   results for every symbol (honestly, not a crash) - confirmed live via a
   real `market-top50.yml` dispatch that failed with `PGRST204` before this
   column existed.
2. **Auth not wired to a UI element**: `lib/auth.js` (Supabase Auth via
   GoTrue REST) is implemented and functional, but PR #1's confirmed
   baseline has no login area in the topbar (it explicitly removed an
   unclear-purpose account/question-mark icon). No login form was added
   here pending explicit UX guidance for where one should go, once the
   private repo's migration 012 (Auth RLS gate) is applied. Until then,
   Production tables remain anon-readable, so the app works fully without
   any auth UI.
3. **CSS Grid overflow bug found and fixed in the baseline itself**:
   `.table-wrap{overflow:auto}` sits inside `.panel` grid items with no
   `min-width:0`, so a `white-space:nowrap` table's min-content width could
   force the whole page to overflow horizontally on narrow viewports -
   present in PR #1's own CSS regardless of mock or real data, just not
   caught before since PR #1 was authored as a static mockup. Fixed with a
   one-line `min-width:0` rule (documented inline in `styles.css`) - a
   standard CSS Grid fix, not a visual/layout redesign.
4. **AI Selection Process traceability is 2 dimensions, not PR #1's mock's
   illustrative 6**: the private repo's actual, verified scoring engine
   only computes Fundamental and Technical scores (Chip has no verified
   data source and is honestly disclosed as unavailable, weight 0%). PR #1's
   mock table (技術分析/趨勢波浪/動能量價/基本面/估值/市場產業環境/風險修正) does
   not correspond to 7 separately-computed real scores in this project;
   Technical's real internal signals (SMA/EMA/RSI/MACD/Bollinger/Donchian/
   ATR/volume status) are disclosed via `recommendation_reason` instead of
   being split into separate top-level scores, since splitting them would
   require changing the private repo's scoring engine itself - out of this
   dashboard-wiring task's scope, and never fabricated to match the mock
   table's shape.
5. **"目標區間" (target range) vs. a single 目標價**: PR #1's mock TOP10 table
   header says "目標區間" (implying a low-high range, e.g. "1,200–1,280").
   The private repo's engine currently computes a single `target_price` and
   a separate `risk_price` (a downside stop level, not the lower bound of an
   upside range) - combining them into a range would misrepresent what they
   mean, so this dashboard shows a single real 目標價 value in that column
   rather than fabricating a plausible-looking range. A real target range
   would require a private-repo engine change, out of this task's scope.
6. **市場環境 (market sentiment/environment score) has no real data source**:
   PR #1's mock shows a static "76/100 中性偏多". This dashboard replaces it
   with an honest "尚未串接" disclosure rather than any number, real or
   otherwise, since no verified market-sentiment computation exists in the
   private repo.
7. **No charting library**: 個股分析 shows a real OHLCV table (last 60 days)
   rather than a candlestick chart - `lightweight-charts` (already a
   dependency in the private repo) was not added here to keep this repo's
   dependency surface minimal for a first pass; a real, honest limitation.
8. **策略／參數, 市場分析, 產業分析, 回測驗證, 報告中心, 系統設定** left-nav
   items still show PR #1's own generic "UX 入口已建立／待串接 Production
   Data" placeholder - nothing was fabricated to fill them beyond what M22
   added for 資料中心 specifically.
9. **`company-names.json` is a manually-copied snapshot**, not
   automatically synced from the private repo's own weekly
   `update-company-names.yml` run - a real, disclosed gap (would need a
   cross-repo push credential, a separate manual setup step for Stanley).
10. **Live Production QA workflow not yet run** - see QA section above.
11. **GitHub Pages not yet enabled** - a one-time manual step for Stanley
    (Settings → Pages → Deploy from branch) - see README.
12. **PR #1 (`feature/dashboard-ux-mvp`) is unmerged** - this branch reuses
    its committed files but does not merge it; Stanley's visual acceptance
    of PR #1 is a separate, still-open decision from this branch's data
    wiring.

## Git

- Repository: `stanleyshen7916-creator/Stock-Analysis-Dashboard`
- Branch: `feature/m15-m23-dashboard-data`
- Reuses committed files from PR #1 (`feature/dashboard-ux-mvp`, unmerged)
  as its structural base - see "UX baseline discovery and reconciliation"
  above.
- Companion, required change in `stanleyshen7916-creator/Stock-Analysis-System`
  on branch `feature/m11-m23-production-readiness` (migration 013 +
  `compute-market-top50.mjs` extension) - must be reviewed/applied
  alongside this PR, not independently.
- PR: opened against this repo's default branch, **not merged** by Claude
  Code per spec Section 19 - awaiting GPT's Code Review → QA Review → UX
  Acceptance → Production Acceptance.
