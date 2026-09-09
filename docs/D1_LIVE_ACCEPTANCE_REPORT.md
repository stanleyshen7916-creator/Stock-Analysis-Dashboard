# D1 Live Acceptance Report

## Executive Result

Audited `main` (HEAD `b2a3f27`) against Issue #9's locked homepage UX baseline and the D1 checklist. Found two real, concrete gaps and fixed both with the smallest correct change:

1. **A real, currently-red CI defect** (not a sandbox artifact — confirmed on GitHub Actions with full internet access): the Individual Stock Analysis page's Overview tab never renders its K-line SVG chart, because `stock-analysis-production.js` intercepted every `#analysis-search` click in the capturing phase and called `event.stopImmediatePropagation()`, silently preventing `analysis-tabs-v2.js`/`analysis-tabs-fix.js`'s own click handlers (which populate `#analysis-tab-content`, including the chart) from ever running. **Fixed** by removing the `stopImmediatePropagation()` call — all three listeners now coexist and fire independently against their own, non-overlapping DOM targets.
2. **A homepage-IA violation of Issue #9's explicit requirement**: the homepage's bottom-grid contained a fixed "AI 選股流程" (AI selection workflow) panel showing the literal flow diagram (市場資料→技術面→基本面→產業→AI評分→觀察清單) directly on the homepage. Issue #9 explicitly requires: *"Remove any fixed homepage block whose purpose is merely explaining the AI selection workflow; workflow remains a secondary page."* **Fixed** by removing that panel from the homepage (the `AI 選股流程` nav item and its full secondary page, `#page-engine`, are untouched and remain reachable).

No architecture, data pipeline, or scoring-engine change was made. No mock/fabricated data was introduced. No second scoring/indicator/recommendation engine was created. `stock-analysis-system` was not modified.

## Environment

- Repository: `stanleyshen7916-creator/Stock-Analysis-Dashboard`, branch `fix/d1-homepage-live-qa-gaps` (base `main` @ `b2a3f27`).
- This session's sandbox has an outbound-network policy that returns HTTP 403 on `CONNECT` to `kvffithbxqstrpbausbo.supabase.co` (confirmed via the agent-proxy's own diagnostic endpoint — a `connect_rejected: gateway answered 403` entry, not a code or configuration issue). This makes it impossible to run this repo's own live-Production QA scripts (`npm run qa:live-dashboard`, `npm run qa:stock-analysis`) against real Supabase from inside this session.
- To compensate, this audit used two independent, honestly-labeled evidence sources instead of ever presenting static inspection as Live QA:
  1. **Real GitHub Actions run history** (`Live Dashboard QA` workflow, which runs with full internet access) for the actual, current state of `main` before any fix.
  2. **A local Playwright harness with mocked Supabase REST responses** (`page.route('**/rest/v1/**', ...)`, network calls to real Supabase never attempted) to verify the specific fix's effect end-to-end (real browser, real DOM, real click handlers, synthetic data only) without needing real Production connectivity. This is disclosed here precisely so it is never confused with a genuine live-Production QA pass.

## Git Commit

Branch: `fix/d1-homepage-live-qa-gaps`. Files changed: `stock-analysis-production.js`, `index.html`, this report.

## Homepage QA

Static + rendered inspection against Issue #9's required priority order, cross-checked with the actual current `index.html`/`app.js`:

| Item | Status | Evidence |
|---|---|---|
| AI recommendation/observation is the first visual layer | PASS | KPI strip (AI 觀察總數/強烈觀察/值得觀察/...) is the first section in `#page-dashboard`. |
| AI TOP 10 is the primary stock-selection content | PASS | `AI 本週強力觀察 TOP 10` table is the dominant (`wide`) panel in `.content-grid`. |
| Six horizons complete | PASS | `.horizon-grid` renders all 6 (當沖/短期/短中期/中期/中長期/長期). |
| Recommendation Changes visible | PASS | `今日 AI 推薦變化` side panel present on homepage. |
| Portfolio/Holdings separated from Observation | PASS | `#page-portfolio` is a fully separate page, not mixed into the observation list. |
| Market context is supporting-only | PASS | `市場整體狀態` is a secondary aside next to the horizon grid, not the primary content. |
| No fixed homepage block for explaining the AI workflow | **FAIL → FIXED** | The bottom-grid's `AI 選股流程` flow-diagram panel was a homepage-fixed workflow explainer, contradicting Issue #9. Removed; `AI 選股流程` remains a secondary nav page (`#page-engine`). |
| Homepage still reads as an AI selection decision entry point | PASS (after fix) | Confirmed after removal — hierarchy unchanged, no other homepage block explains the model internals. |

## Six Horizon QA

All six horizon buttons/labels present in both the sidebar submenu and the dashboard `.horizon-grid`; each is wired to `data-horizon` and clickable (verified with mocked and empty-state data, no console error). Values are honestly `–`/`資料不足`-shaped placeholders until real data populates them; no fabricated counts.

## Recommendation QA

`AI 本週強力觀察 TOP 10` table exists with the correct columns (代號/名稱/週期/AI評分/現價/目標區間/預期報酬/AI觀察理由/狀態) and an honest `載入中…`/empty-state row when unpopulated (per the existing `qa-live-dashboard.mjs` script's own `assertNotStuckLoading` check, which already enforces this — confirmed still intact, unmodified). Recommendation → Individual Stock Analysis navigation path exists (`.link-stock` rows link into `#page-analysis`).

## Portfolio QA

`#page-portfolio` is a separate page with its own add-holding form and table, independent of the Observation List/TOP 10 — separation requirement satisfied. Not modified in this PR.

## Individual Stock QA

**This is where the real defect was found and fixed.** Real GitHub Actions run of `npm run qa:stock-analysis` against the pre-fix `main` (run `34184622932`, job `101930352678`, 2026-09-08) reported:

```
Desktop: chart=false tabs=11 overflow=false consoleErrors=0 problems=1
  - Overview K 線走勢 has no graphical SVG chart
Mobile: chart=false tabs=11 overflow=false consoleErrors=0 problems=1
  - Overview K 線走勢 has no graphical SVG chart
STOCK ANALYSIS QA FAILED
```

Root cause traced by reading `stock-analysis-production.js`, `analysis-tabs-v2.js`, and `analysis-tabs-fix.js` together: `stock-analysis-production.js` installs a `document.addEventListener('click', ..., true)` (capture phase) on the search flow that calls `event.stopImmediatePropagation()` whenever `#analysis-search` is clicked. Because `analysis-tabs-v2.js` and `analysis-tabs-fix.js` both bind their own data-loading logic to the *same* `#analysis-search` button via plain (bubble-phase) `addEventListener`, the capturing listener firing first and calling `stopImmediatePropagation()` **permanently prevented those two scripts' click handlers from ever executing** — meaning `#analysis-tab-content` (the 11-tab Overview/Technical/etc. panel, including the K-line chart) never received real data and stayed frozen at its initial empty-state render for the lifetime of the page, regardless of what symbol was searched.

**Fix**: removed the `event.stopImmediatePropagation()` call. `stock-analysis-production.js`'s own listener (still capture-phase, still first to run) no longer blocks the other two — all three now populate their own distinct, non-overlapping DOM targets (`#analysis-production-panel` vs. `#analysis-tab-content`) independently.

**Verification** (local Playwright, mocked Supabase REST responses so the real fetch→render pipeline runs end-to-end without needing live Production connectivity):

```
svgCount: 1 tabCount: 11
overview snippet: K 線走勢Production OHLCV；本區只呈現真正 K 線。最新行情日期2026-03-31開盤99.23...
console errors: 0
```

All 11 tabs present (總覽/技術分析/基本面/籌碼分析/財務分析/產業分析/波浪分析/AI 選股流程/歷史推薦/預測追蹤/相關新聞), each clickable, none blank, none stuck loading, no console errors — matching `qa-stock-analysis-executable.mjs`'s own assertions, now satisfied.

## 11 Tabs QA

Verified via the mocked-data harness above: `tabCount: 11`, all clickable, `#analysis-tab-content` updates on each click with tab-specific content (Overview chart, Technical indicators + OHLCV table, Fundamental, Chips honest-unavailable state, Financial, Industry honest-unavailable state, Wave, AI 選股流程 breakdown, History, Prediction, News honest-unavailable state) — none blank, none JS-erroring.

## Responsive QA

Local Playwright, all 7 required viewports, homepage + full nav click-through, mocked empty-state Supabase responses (`[]` for every REST call — this exercises the honest-empty-state rendering path, not live data):

| Viewport | Horizontal overflow | Console errors |
|---|---|---|
| Desktop 1920×1080 | false | 0 |
| Desktop 1440×900 | false | 0 |
| Desktop 1280×800 | false | 0 |
| Tablet 1024×1366 | false | 0 |
| Tablet 768×1024 | false | 0 |
| Mobile 390×844 | false | 0 |
| Mobile 375×812 | false | 0 |

No overflow or console errors introduced by either fix, at any required breakpoint.

## Console QA

0 console errors / page errors across every check run in this audit (both the mocked-live-data verification and the 7-viewport empty-state sweep). The repository's own `qa-live-dashboard.mjs`/`qa-stock-analysis-executable.mjs` scripts independently enforce the same bar in real CI (they were unmodified and will re-run automatically once this branch's CI executes with real internet access).

## Data QA

- Stock Symbol, Trading Date, OHLCV, AI Score, Recommendation, Target, Risk, Expected Return: all sourced from real Production fields per the existing `lib/data.js`/`analysis-tabs-fix.js`/`stock-analysis-production.js` fetch calls (`market_daily`, `fundamentals`, `market_top50`, `stock_analysis_results`, `corporate_actions`) — no hardcoded or fabricated value found anywhere in the diff or the surrounding code read during this audit.
- Unavailable states remain honest placeholders (`資料不足` / `尚無可驗證資料` / `尚未查詢`), never silently coerced to `0` — confirmed unchanged by this PR, and re-confirmed by the empty-state responsive sweep above (no crash, no fabricated number appeared anywhere across all 7 viewports when every REST call returned `[]`).

## Production Boundary QA

Re-read `stock-analysis-production.js`, `analysis-tabs-fix.js`, `analysis-tabs-v2.js`, `lib/observation-list.js`, `lib/recommendation-change.js`, `lib/horizons.js` in full during root-cause tracing: every one of them only *reads* Supabase REST tables and *computes presentation-only derived values* already documented as safe in this repo's own README (e.g., RSI/EMA/MACD recomputed from raw OHLCV for display only, never written back, never used to alter a stored recommendation). None of them compute or persist an AI Score, a recommendation decision, or a target/risk price — those all come directly from `stock_analysis_results`/`market_top50` columns written by the private `stock-analysis-system` repo. No second scoring/recommendation engine exists in this repo, before or after this fix (AC-15 confirmed).

## Identified Gaps

| # | Item | Severity | Status |
|---|---|---|---|
| 1 | Overview tab's K-line chart never renders (permanent empty state) due to a cross-script event-propagation conflict | P1 — real, currently-red CI failure on `main` | **FIXED** |
| 2 | Homepage bottom-grid contained a fixed AI-selection-workflow explainer panel, contradicting Issue #9's explicit removal requirement | P2 — UX/IA violation of the locked baseline | **FIXED** |
| 3 | `analysis-tabs.js` (the pre-`v2`/`fix` original) and `corrected-dashboard.html` are committed but never loaded/referenced anywhere in the live site | Hygiene, not a live-acceptance defect | Not fixed here — flagged in Known Limitations, out of D1's "smallest correct fix" scope (deleting them is a separate, low-risk cleanup, not required for acceptance) |
| 4 | `qa-live-dashboard.mjs`/`qa-stock-analysis-executable.mjs` can only be re-validated against real Production from an environment with real internet access (this sandbox is policy-blocked) | Environment limitation, not a Dashboard defect | Documented; real CI will validate on push |

## Fixes Applied

1. `stock-analysis-production.js`: removed `event.stopImmediatePropagation()` from the `#analysis-search` capture-phase click listener (1-line removal + explanatory comment). Restores `analysis-tabs-v2.js`/`analysis-tabs-fix.js`'s own click handling, which is what populates the Overview tab's SVG chart and the other 10 tabs with real Production data.
2. `index.html`: removed the fixed "AI 選股流程" workflow-diagram panel from the homepage `.bottom-grid` (and tightened `.bottom-grid` from 3 to 2 columns to match). The same content remains fully available as the existing, unmodified `#page-engine` secondary page, reachable from the sidebar nav and from the dashboard's own "查看完整清單 →"-style links elsewhere.

Both fixes are minimal, surgical, and reversible; neither touches architecture, the data pipeline, scoring, or introduces new UI concepts beyond what Issue #9 and the existing baseline already specify.

## Remaining Issues

- `qa-live-dashboard.mjs` and `qa-stock-analysis-executable.mjs` have not been re-run against real Production from a network-unblocked environment as part of this PR (this sandbox cannot reach Supabase). They will run automatically in this repo's own `Live Dashboard QA` GitHub Actions workflow once this branch/PR triggers CI; that real run is the authoritative confirmation this report defers to, and is expected to show `chart=true` for both viewports for the first time since the regression was introduced.
- `analysis-tabs.js` (dead, unloaded) and `corrected-dashboard.html` (dead, unloaded) remain in the repository — flagged as a hygiene item, not fixed here (out of scope for "smallest correct fix").
- All items listed in `docs/M15-M23_EXECUTION_REPORT.md`'s own Known Limitations remain open and are not affected by this PR.

## Acceptance Matrix

| AC | Requirement | Status |
|---|---|---|
| AC-01 | Homepage observation-first | PASS |
| AC-02 | AI TOP 10 primary content | PASS |
| AC-03 | Six horizons complete | PASS |
| AC-04 | Recommendation Changes visible | PASS |
| AC-05 | Portfolio separated from Observation | PASS |
| AC-06 | Recommendation → Individual Stock Analysis navigation | PASS |
| AC-07 | 11 tabs operate correctly | PASS (fixed — chart now renders; all 11 tabs verified clickable/non-blank) |
| AC-08 | Production Data binding correct | PASS |
| AC-09 | No fabricated values for unavailable data | PASS |
| AC-10 | Desktop QA | PASS (1920×1080, 1440×900, 1280×800 — see Responsive QA) |
| AC-11 | Tablet QA | PASS (1024×1366, 768×1024) |
| AC-12 | Mobile QA | PASS (390×844, 375×812) |
| AC-13 | No known console errors | PASS |
| AC-14 | No horizontal overflow | PASS |
| AC-15 | No second scoring/indicator/recommendation engine | PASS |
| AC-16 | All fixes have test evidence | PASS (see Individual Stock QA + Responsive QA sections) |

## Final Status

**PASS WITH KNOWN LIMITATIONS**

(Not DONE — final acceptance is GPT's to grant. The one open limitation — real-Production CI re-validation happening on push rather than inside this session — is an environment constraint, not an unresolved Dashboard defect; both applied fixes were independently verified end-to-end against real browser/DOM behavior with mocked data standing in only for the literal Supabase network hop this sandbox cannot make.)
