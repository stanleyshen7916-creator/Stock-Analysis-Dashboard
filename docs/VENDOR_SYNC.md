# Vendor-sync policy: pure calculation functions copied from the private repo

## Why this exists

The Production scoring/decision logic (`recommendation-engine.js`,
`investment-horizon.js`, etc.) lives exclusively in the private
`stock-analysis-system` repo and is never shipped here - see this repo's
README, "Architecture: Private Core stays private".

A small number of **pure, non-scoring** functions are the one exception:
they read already-fetched real data (OHLCV from `market_daily`, or an
already-computed `market_top50` row) and produce a *derived, presentation-
layer* value - a moving average for a chart, a diff between two real
recommendation rows - never a new scoring decision. These are copied
("vendor-synced") verbatim into this repo's `lib/` folder so the Dashboard
can render them without a network round-trip to a calculation service that
doesn't exist for this project's scale.

Vendor-synced files today:

| File | Source in `stock-analysis-system` | Purpose |
|---|---|---|
| `lib/indicators.js` | `src/indicators/index.mjs` | MA/EMA/RSI/MACD/Bollinger/ATR/Stochastic for the 個股分析 indicator panel |
| `lib/recommendation-change.js` | `lib/recommendation-change.js` (M17) | Diffs two real `market_top50` rows into a change classification |
| `lib/observation-list.js` | (M15/M16 spec) | Builds the six-horizon list from already-computed rows |

## The drift problem

Because the two repos have no shared package and no cross-repo CI trigger,
a vendored file can silently go stale in two directions:

1. **Copy-paste mistake** at sync time - the copy doesn't actually match
   its source. *This is automatically caught* for `lib/indicators.js` by
   `scripts/qa-indicator-vendor-sync.mjs` (`npm run qa:indicator-vendor-sync`,
   also run in `qa-live-dashboard.yml` on every push to `main`).
2. **Private-repo-side change with no re-sync** - someone fixes a formula
   bug in `stock-analysis-system`'s `src/indicators/index.mjs` and forgets
   this repo exists. *This is NOT automatically caught* - the private repo
   is not publicly fetchable from this repo's CI without adding a
   cross-repo credential, which is disproportionate machinery for ~7 pure
   functions. Catching this half of the drift is a manual discipline: when
   you touch `src/indicators/index.mjs` in the private repo, check this
   table for files that need a matching update here.

## Re-sync procedure (when the private repo's `src/indicators/index.mjs` changes)

1. In `stock-analysis-system`, copy the changed function(s) verbatim into
   this repo's `lib/indicators.js`, and update the `source commit` SHA in
   that file's header comment (`git log -1 --format=%H -- src/indicators/index.mjs`).
2. Regenerate the golden fixture from the private repo's real functions
   (run this **in the private repo**, then copy the JSON output into this
   repo's `lib/indicators-vendor-sync-fixture.json`):
   ```js
   // Run inside stock-analysis-system with: node -e "<paste this>"
   import('./src/indicators/index.mjs').then(m => {
     const { sma, ema, rsi, macd, bollingerBands, atr, stochastic } = m;
     // Use the SAME fixed input already committed in
     // lib/indicators-vendor-sync-fixture.json's "input" field - do not
     // invent a new one, or the fixture stops being a stable regression check.
     const { close, high, low } = /* paste the existing fixture's .input here */;
     console.log(JSON.stringify({ input: { close, high, low, volume: [] }, expected: {
       sma20: sma(close, 20), ema20: ema(close, 20), rsi14: rsi(close, 14),
       macd: macd(close), bollinger20: bollingerBands(close, 20, 2),
       atr14: atr(high, low, close, 14), stochastic: stochastic(high, low, close, 9, 3, 3)
     }}, null, 2));
   });
   ```
3. Run `npm run qa:indicator-vendor-sync` in this repo - it must pass.
4. Commit `lib/indicators.js` and `lib/indicators-vendor-sync-fixture.json`
   together in the same PR.

## Non-goal

This mechanism proves "the vendored copy matches the fixture I generated
from the private repo at sync time." It does not, and cannot without new
cross-repo infrastructure, continuously prove "the vendored copy still
matches whatever the private repo looks like today." Re-read this table
whenever `src/indicators/index.mjs` changes in the private repo.
