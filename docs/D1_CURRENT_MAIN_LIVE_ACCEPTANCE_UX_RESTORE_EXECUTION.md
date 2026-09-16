# D1 — Current Main Live Acceptance + UX Direct Restore

## Objective
Bring the Dashboard from the current Main state to a directly verifiable Project Owner MVP state. This is an execution task, not a redesign.

## Current authoritative baseline
- Product: AI 智慧選股研究平台
- Core Production model: Technical 50% / Fundamental 30% / Chip 20%.
- Golden Test Case: 2330, 0050, 0056, 00981A.
- Dashboard: presentation layer; do not move core calculations into Dashboard.
- ETF fundamental semantics: `NOT_APPLICABLE`.
- Main Core M4 merge: `3c9706a9`.
- Do not restore the obsolete 40/35/25 weight baseline.

## Execution order
1. Inspect current `main` rendering path: `index.html -> styles.css -> JS -> runtime -> DOM`.
2. Identify all active and legacy rendering scripts, inline overrides, duplicate tab implementations, historical fixes and conflicting CSS.
3. Establish one authoritative rendering path. Remove/disable obsolete overrides only where verified safe.
4. Restore Screen A directly to the Project Owner reference baseline.
5. Restore Screen B directly to the Project Owner reference baseline.
6. Preserve Production data, calculation outputs, 50/30/20 model semantics, Golden symbols and ETF `NOT_APPLICABLE`.
7. Preserve all 11 Individual Analysis tabs and their current functional behavior.
8. Run automated tests and browser runtime QA.
9. Verify exact viewports: 1920x1080, 1440x900, 1280x720, 768x1024, 390x844.
10. Verify each Golden symbol individually: 2330, 0050, 0056, 00981A.
11. Verify console critical errors = 0 and horizontal overflow = 0.
12. Capture browser screenshots/evidence for Screen A and Screen B at desktop and mobile.
13. Confirm no production data/calculation regression.
14. Commit using Conventional Commit.
15. Open PR with Purpose / Changes / Impact / Test Method / Test Result / Known Limitations / Related Issue.
16. Wait for GPT review; do not merge before review.
17. After GPT APPROVE, Claude merges to `main` and verifies Pages deployment.

## Acceptance Criteria
- [ ] Screen A matches Owner reference structure, hierarchy, navigation, typography, spacing and layout.
- [ ] Screen B matches Owner reference structure, hierarchy, tabs, charts and analysis presentation.
- [ ] No legacy runtime override can replace the authoritative UI.
- [ ] 11 Individual Analysis tabs remain functional.
- [ ] Production data and calculations are unchanged.
- [ ] Production weight semantics remain Technical 50% / Fundamental 30% / Chip 20% with existing effective-weight behavior when data is unavailable.
- [ ] ETF Fundamental remains `NOT_APPLICABLE`.
- [ ] 5 exact viewports pass.
- [ ] 4 Golden symbols pass.
- [ ] Console critical errors = 0.
- [ ] Horizontal overflow = 0.
- [ ] Screenshot evidence exists for both reference screens.
- [ ] PR CI is green.
- [ ] GPT review completed before merge.
- [ ] GitHub Pages deployment is verified after merge.

## Important correction to legacy Issue #71
Issue #71 contains obsolete acceptance text referring to 40/35/25. The current Production baseline is 50/30/20 and supersedes that historical wording. Do not modify the Production model back to 40/35/25 for UX acceptance.

## Definition of DONE
DONE only when code is merged to `main`, CI is green, Pages deployment is verified, browser evidence demonstrates both screens, all Golden symbols and 11 tabs pass, and no known critical issue remains.

Otherwise status is IN PROGRESS or BLOCKED.
