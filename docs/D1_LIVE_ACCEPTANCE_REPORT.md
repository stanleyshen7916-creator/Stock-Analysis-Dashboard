# D1 Live Acceptance Report

## Executive Result

Audited `main` (HEAD `b2a3f27`) against Issue #9's locked homepage UX baseline and the D1 checklist. Found two real, concrete gaps and fixed both with the smallest correct change:

1. **A real, currently-red CI defect** (not a sandbox artifact — confirmed on GitHub Actions with full internet access): the Individual Stock Analysis page's Overview tab never renders its K-line SVG chart, because `stock-analysis-production.js` intercepted every `#analysis-search` click in the capturing phase and called `event.stopImmediatePropagation()`, silently preventing `analysis-tabs-v2.js`/`analysis-tabs-fix.js`'s own click handlers (which populate `#analysis-tab-content`, including the chart) from ever running. **Fixed** by removing the `stopImmediatePropagation()` call — all three listeners now coexist and fire independently against their own, non-overlapping DOM targets.
2. **A homepage-IA violation of Issue #9's explicit requirement**: the homepage's bottom-grid contained a fixed "AI 選股流程" (AI selection workflow) panel showing the literal flow diagram (市場資料→技術面→基本面→產業→AI評分→觀察清單) directly on the homepage. Issue #9 explicitly requires: *"Remove any fixed homepage block whose purpose is merely explaining the AI selection workflow; workflow remains a secondary page."* **Fixed** by removing that panel from the homepage (the `AI 選股流程` nav item and its full secondary page, `#page-engine`, are untouched and remain reachable).

No architecture, data pipeline, or scoring-engine change was made. No mock/fabricated data was introduced. No second scoring/indicator/recommendation engine was created. `stock-analysis-system` was not modified.

> **Update: real-Production CI now confirms both fixes.** GPT's D1 review (on PR #40) correctly flagged that no GitHub Actions run existed against the PR's head SHA — root cause: `qa-live-dashboard.yml` only triggered on `workflow_dispatch`/`push`-to-`main`, never on a pull request, so no PR in this repo could ever get pre-merge CI evidence. Fixed by adding a `pull_request` trigger (commit `6461d26`). A manually-dispatched run against the first fix commit then surfaced a second, real, non-flaky-by-luck issue: `chart=false` on Desktop but `chart=true` on Mobile in the *same* job. Root cause: `config.js` still loaded the superseded `analysis-tabs-v2.js` alongside its own replacement `analysis-tabs-fix.js`, so removing `stopImmediatePropagation()` let *three* independent fetch/render pipelines (v2, fix, production) fire concurrently on every search instead of two — enough extra concurrent Supabase load that a cold connection could push completion past the QA script's wait window on whichever viewport ran first. Fixed by removing the `analysis-tabs-v2.js` load (commit `901894c`) — `analysis-tabs-fix.js` is explicitly self-contained and already a complete superset. The `pull_request`-triggered run against this PR's actual merge ref (`pull/40/merge`, run `34321448116`) now shows: **`Desktop: chart=true tabs=11 overflow=false consoleErrors=0 problems=0`**, **`Mobile: chart=true tabs=11 overflow=false consoleErrors=0 problems=0`**, `STOCK ANALYSIS QA PASSED`, and `qa:live-dashboard` also PASSED on both viewports. This is real, non-mocked, real-Production confirmation — see the fully revised Individual Stock QA and Final Status sections below.

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

**Fix (part 1)**: removed the `event.stopImmediatePropagation()` call. `stock-analysis-production.js`'s own listener (still capture-phase, still first to run) no longer blocks the other click handlers on the same button.

**Verification (part 1)** (local Playwright, mocked Supabase REST responses so the real fetch→render pipeline runs end-to-end without needing live Production connectivity):

```
svgCount: 1 tabCount: 11
overview snippet: K 線走勢Production OHLCV；本區只呈現真正 K 線。最新行情日期2026-03-31開盤99.23...
console errors: 0
```

This confirmed the mechanism was fixed, but a manually-dispatched **real-CI** run against this exact commit (`f875e82`, run `34321155199`) then showed a subtler, real timing defect:

```
Desktop: chart=false tabs=11 overflow=false consoleErrors=0 problems=1
  - Overview K 線走勢 has no graphical SVG chart
Mobile: chart=true tabs=11 overflow=false consoleErrors=0 problems=0
```

Same job, same commit, same code — Mobile got its chart, Desktop didn't. Root cause: `config.js` was still loading `analysis-tabs-v2.js` *alongside* its own superseding replacement `analysis-tabs-fix.js` (both bind independent click handlers and fetch/render pipelines to the same button and DOM target). With `stopImmediatePropagation()` gone, that meant *three* concurrent fetch/render pipelines (v2, fix, production) fired on every search instead of two — enough extra concurrent Supabase load that whichever viewport's browser page ran first (Desktop, in this script) hit a colder connection and didn't finish before the QA script's fixed wait window, while the second page (Mobile) benefited from a now-warm connection pool.

**Fix (part 2)**: removed the `analysis-tabs-v2.js` script injection from `config.js` — `analysis-tabs-fix.js` is explicitly self-contained (per its own file header) and already a complete superset of v2's behavior, so v2 was pure redundant load with no functional benefit.

**Verification (part 2)** — real CI, PR's actual merge ref (`pull/40/merge`, run `34321448116`, triggered automatically by the new `pull_request` workflow trigger):

```
Desktop: chart=true tabs=11 overflow=false consoleErrors=0 problems=0
Mobile: chart=true tabs=11 overflow=false consoleErrors=0 problems=0
STOCK ANALYSIS QA PASSED
```

All 11 tabs present (總覽/技術分析/基本面/籌碼分析/財務分析/產業分析/波浪分析/AI 選股流程/歷史推薦/預測追蹤/相關新聞), each clickable, none blank, none stuck loading, no console errors, on both viewports, against real Production data — `qa-stock-analysis-executable.mjs`'s own assertions now fully satisfied by real CI, not just local mocked verification.

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

1. `stock-analysis-production.js`: removed `event.stopImmediatePropagation()` from the `#analysis-search` capture-phase click listener. Restores the other scripts' own click handling on that button.
2. `config.js`: stopped loading the superseded `analysis-tabs-v2.js` (kept only `analysis-tabs-fix.js`, its self-contained replacement) — eliminates the redundant concurrent-fetch race that fix #1 alone exposed (Desktop failing while Mobile passed in the same real-CI job).
3. `index.html`: removed the fixed "AI 選股流程" workflow-diagram panel from the homepage `.bottom-grid` (and tightened `.bottom-grid` from 3 to 2 columns to match). The same content remains fully available as the existing, unmodified `#page-engine` secondary page.
4. `.github/workflows/qa-live-dashboard.yml`: added a `pull_request` trigger (previously only `workflow_dispatch`/push-to-`main`), so this and every future PR gets real-Production CI evidence on its own head/merge ref instead of never running until after merge.

All four fixes are minimal, surgical, and reversible; none touches architecture, the data pipeline, scoring, or introduces new UI concepts beyond what Issue #9 and the existing baseline already specify. Fixes #1 and #2 are both proven not just locally but by real, non-mocked GitHub Actions runs against real Production Supabase (see Individual Stock QA above) — the final run (`34321448116`) shows both `qa:live-dashboard` and `qa:stock-analysis` fully PASSED on the PR's actual merge ref.

## Remaining Issues

- `analysis-tabs.js` (dead, unloaded even before this PR) and `corrected-dashboard.html` (dead, unloaded) remain in the repository — flagged as a hygiene item, not fixed here (out of scope for "smallest correct fix").
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

(Not DONE — final acceptance is GPT's to grant. Both applied fixes are now confirmed by real, non-mocked GitHub Actions CI against real Production Supabase, run against this PR's actual merge ref, not merely by local mocked verification: `qa:live-dashboard` PASSED and `qa:stock-analysis` PASSED — `Desktop: chart=true tabs=11 overflow=false consoleErrors=0 problems=0`, `Mobile: chart=true tabs=11 overflow=false consoleErrors=0 problems=0` (run `34321448116`). The remaining open items — two dead/unloaded files, and pre-existing Known Limitations from `docs/M15-M23_EXECUTION_REPORT.md` — are hygiene/out-of-scope items, not unresolved D1 defects.)
