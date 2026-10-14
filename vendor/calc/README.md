# Vendored calculation primitives

`indicators.js` in this directory is a byte-for-byte copy of
`src/indicators/index.mjs`, the project's single production indicator engine
(Strategy C - see `docs/CALCULATION_ENGINE.md`). It is cross-checked against
TA-Lib (Issue #42) and wrapped by the adjustment-provenance guard (Issues
#23/#18). There is no second, independently-maintained copy of these
formulas (Issue #41).

`signal-engine.js`, `layer-score.js`, `composite-score.js`,
`fundamental-signals.js`, `target-price.js`, `recommendation.js` (Issue
#124, MVP-1) and `investment-horizon.js` (Issue #128, MVP-3) are the same
kind of byte-for-byte copy of their `src/signal/`, `src/analysis/` and
`src/fundamental/` counterparts. Each is deliberately import-free in its
`src/` source specifically so a flat copy here never breaks a relative
import path - `public/js/lib/recommendation-engine.js` is the composition
root that calls them all in sequence (generateTechnicalSignals ->
scoreTechnicalSignals -> calculateCompositeScore -> buildRecommendation ->
classifyInvestmentHorizon etc.), the same way `chart-series.js` composes
the indicator engine for chart panes.

It is copied here (rather than imported across a directory boundary) so
that `public/` remains a self-contained static site deployable on its own.

**Do not hand-edit this file.** Regenerate it after changing the source:

```bash
npm run sync:dashboard-vendor
```

`tests/dashboard-vendor-sync.test.js` fails `npm test` if this copy drifts
from `src/indicators/index.mjs`.
