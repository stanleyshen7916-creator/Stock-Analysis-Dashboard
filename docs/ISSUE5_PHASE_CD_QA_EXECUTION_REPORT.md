# Issue #5 — MVP v0.1.0 Dashboard Phase C/D QA Execution Report

Branch: `qa/mvp-v0.1-phase-cd` (base: `main` @ `3c146a2`)
Date: 2026-09-03
Related: Stock-Analysis-System #181 / #184 / #171

## Objective

Execute real Production QA of the complete required MVP research flow
(Market Top 50 → Investment Horizon → Stock Detail → Technical →
Fundamental → Target Price → Expected Return → Recommendation → AI
Selection Traceability) against the live Supabase project, fix any
genuine defect found, and never redesign the Locked Baseline UX
(`UX_BASELINE_V1.md`, PR #1) or fabricate data.

## Execution

1. **Baseline smoke QA** (existing `qa-live-dashboard.mjs`, unmodified) run
   against `main` to confirm the starting state: 0 console errors, 0
   horizontal overflow, all 11 pages navigable, Desktop 1280×900 + Mobile
   390×844. (Run 33738403149.)
2. **CI infrastructure defect found and fixed**: `qa-live-dashboard.yml`'s
   `Setup Node.js` step used `cache: npm`, which requires a committed
   lockfile to compute its cache key. This repo has never had one (`git
   log --all -- package-lock.json` returns nothing on any branch),
   producing an intermittent, then deterministic, `Dependencies lock file
   is not found` failure. Root-caused (not "flaky" - confirmed
   deterministic after a second identical failure with the exact-same
   error text) and fixed: generated `package-lock.json`, switched the
   install step to `npm ci`, added `.gitignore` for `node_modules/`.
   Verified locally (`rm -rf node_modules && npm ci`) and via re-dispatch
   (run 33738880243 - success). Commit `1bf0778`.
3. **Fundamentals mixed reporting_period defect investigated - ruled out
   as a false positive**: a diagnostic probe (removed after evidence
   capture, commits `074badb`/`ef54f68`/`389b4d4`) found that
   `fetchFundamentals()[0]` resolves to a quarterly (`YYYY-Qn`) row for
   45/50 Top50 symbols, the same surface pattern as the private repo's
   Issue #179 defect. Ground-truth evidence (run 33752963929) showed `eps`
   IS populated with a real value on every one of those top rows (e.g.
   symbol 1436: `eps=0.45`) - it correctly resolves to the latest
   completed quarter, exactly what the Stock Detail Fundamental panel
   needs (it renders `eps`/`book_value_per_share`, never `revenue`).
   `book_value_per_share` is null on every period returned for these
   symbols, including older rows - a genuine upstream MOPS XBRL
   ingestion gap, not caused by row selection. Applying Issue #179's fix
   (filter to monthly-only periods) here would have actively broken EPS
   display, since `eps` only exists on quarterly rows. **No code change
   made** - `lib/data.js` is correct as-is for this panel's actual field
   usage.
4. **Extended live QA to verify real flow/data correctness**, not just
   console/overflow (the existing script's only prior checks).
   `scripts/qa-live-dashboard.mjs` gained `runFlowChecks()`: walks the
   real required flow and asserts every panel settles to either a real
   Production value or one of the baseline's own honest empty-state
   strings (`尚無真實資料` / `資料不足` / `尚無真實計分細節`) - never left
   stuck on `載入中...` (a hung/never-resolved fetch) and never silently
   blank. Commit `d992522`.
5. Ran the extended QA against real Production on both required
   viewports (run 33753314639).
6. Ran `npm audit` and a syntax/secret-leak sweep across the repo.

## Test Results (exact, from the cited runs)

- **Extended flow-correctness QA (run [33753314639](https://github.com/stanleyshen7916-creator/Stock-Analysis-Dashboard/actions/runs/33753314639), commit `d992522`)**:
  ```
  === Dashboard Live QA (M23 + Issue #5 flow/data checks) ===
  Desktop: horizontalOverflow=false consoleErrors=0 flowProblems=0
  Mobile: horizontalOverflow=false consoleErrors=0 flowProblems=0
  QA PASSED
  ```
- **`npm audit`**: 0 vulnerabilities (3 total dependencies: `playwright` devDependency tree).
- **Syntax check**: `node --check` on every tracked `.js`/`.mjs` file - all pass.
- **Secret-leak sweep**: `grep -rniE "service_role|SUPABASE_SERVICE|secret[_-]?key"` across all JS/HTML - no matches (this repo ships only the anon/publishable key, per its Protected Public Dashboard design).
- **Migration 012/013 re-confirmation** (via the private repo's PR #184, same day): Migration 013 APPLIED, Migration 012 NOT APPLIED - `lib/auth.js`'s `currentBearerToken()` correctly falls back to the anon key with no stored session, matching that state.

## Production Evidence

- Real Top50 rows render with populated `observation_horizons`/
  `score_breakdown`/`recommendation_reason` (migration 013 columns),
  confirmed both by the flow-check QA settling without a stuck-loading
  problem and by the private repo's independent Production verification
  (PR #184).
- `#data-asof` renders a real `YYYY-MM-DD` calculation date from
  `market_top50`, not a placeholder.
- AI Selection Traceability page (`#engine-weights`) renders real
  Fundamental/Technical scores, weights, and weighted scores computed
  server-side by `compute-market-top50.mjs`'s `buildScoreBreakdown()` -
  Chip is honestly disclosed as unavailable (0% weight), never
  fabricated.

## QA Result

**PASS** for the full required flow, both viewports:

| Check | Desktop 1280×900 | Mobile 390×844 |
|---|---|---|
| Horizontal overflow | PASS (false) | PASS (false) |
| Console errors | PASS (0) | PASS (0) |
| Market Top 50 real/honest data | PASS | PASS |
| Investment Horizon filter | PASS | PASS |
| Stock Detail settle | PASS | PASS |
| Fundamental panel settle | PASS | PASS |
| Target Price / Expected Return | PASS | PASS |
| Recommendation / history | PASS | PASS |
| AI Selection Traceability | PASS | PASS |
| No fabricated data (code review) | PASS | PASS |
| npm audit | PASS (0 vulnerabilities) | - |
| Secret leak sweep | PASS (none found) | - |

## Problems Found and Fixed

1. **CI: missing `package-lock.json`** causing `cache: npm` to fail
   deterministically - fixed (commit `1bf0778`).
2. **QA gap: existing script never asserted data correctness**, only
   console/overflow - fixed by extending it (commit `d992522`), not by
   replacing or redesigning it.

## Problems Investigated, No Fix Needed

- Fundamentals `reporting_period` mixed-granularity sort: confirmed NOT
  a live defect for this Dashboard's actual field usage (see Execution
  step 3). No regression risk from leaving `lib/data.js` unchanged.

## Remaining Limitations (honestly disclosed, not blockers of this Phase)

- `book_value_per_share` is not yet populated in Production for any
  symbol sampled - a pre-existing MOPS XBRL ingestion gap in the private
  repo, out of this Dashboard-repo QA's scope; the panel already
  discloses this honestly ("資料不足") rather than fabricating a P/B
  ratio.
- No dedicated raw technical-indicator panel (MA/RSI/MACD/KD/Bollinger/
  ATR values) on Stock Detail - by the confirmed Locked Baseline design,
  only the composite Technical score/weight (traced to real EMA20/RSI14/
  MACD/Bollinger inputs in the private repo's `recommendation-engine.js`)
  is surfaced, on the AI Selection Traceability page. Not a defect;
  adding a new panel would be a Locked Baseline UX change, out of this
  execution's scope.
- Migration 012 remains NOT APPLIED (expected, required by the absolute
  prohibition on applying it in this workstream) - Auth UI precondition
  correctly not yet satisfied; the app correctly continues to operate on
  the anon key.
- No unit test framework in this repo (previously documented in
  `docs/M15-M23_EXECUTION_REPORT.md`) - this is a static site with only
  two vendored pure functions; the real verification path for this repo
  is the live Production QA exercised here, not synthetic unit tests.

## Acceptance Status

**Phase C/D QA scope: PASS.** The complete required flow works against
real Production data with honest empty/error states throughout, on both
required viewports, with clean console/overflow/security checks.

Overall Dashboard MVP v0.1.0 acceptance additionally depends on
Migration 012 (external, Stanley-only decision, correctly not applied
here) and the cross-repo Gate 3-4-5 / #181 final acceptance step - not
claimed DONE here; see the System repo's `docs/GATE3_GATE4_GATE5_EXECUTION_REPORT.md`
and PR #171 for that status.
