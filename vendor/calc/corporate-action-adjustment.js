// Deterministic Taiwan corporate-action adjustment engine.
//
// Scope: this module computes adjustment factors and applies them to a
// price/volume series. It does not fetch data from TWSE/TPEx - that is the
// ingestion layer's job (Issue #16). Every formula here is sourced from
// TWSE/TPEx's own published ex-rights/ex-dividend and capital-reduction
// reference-price methodology; see docs/TAIWAN_ADJUSTED_PRICE_METHODOLOGY.md
// for the full derivation, sources, and worked examples.
//
// Project engine is the authoritative calculation source (Strategy C):
// third-party data (e.g. FinMind) may only be used to cross-check, never to
// replace this calculation.

const PRICE_DECIMALS = 2; // matches raw TWSE/TPEx quote precision (NTD, 2dp)
const FACTOR_DECIMALS = 8; // internal precision for chained multiplication

function round(value, decimals) {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function requireFinitePositive(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`${name} must be a positive finite number`);
  return n;
}

function requireFiniteNonNegative(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`${name} must be a non-negative finite number`);
  return n;
}

// ---------------------------------------------------------------------------
// Event validation
// ---------------------------------------------------------------------------

const SUPPORTED_EVENT_TYPES = new Set([
  'cash_dividend',
  'stock_dividend',
  'rights_issue',
  'capital_reduction',
  'split',
  'reverse_split',
  'other'
]);

/**
 * Validates the provenance/shape fields every event must carry, regardless
 * of type. Type-specific parameters are validated separately by each
 * compute*Factor function, since each type requires different fields.
 *
 * Backward compatible with the original contract: symbol, effectiveDate,
 * eventType, source are always required. `factor` remains supported as a
 * direct input for eventType 'other' (or as a legacy pre-computed value),
 * but is no longer required for the formula-driven event types below.
 */
export function validateEvent(event) {
  if (!event || typeof event !== 'object') throw new TypeError('event must be an object');
  for (const key of ['symbol', 'effectiveDate', 'eventType', 'source']) {
    if (event[key] == null || event[key] === '') throw new Error(`missing ${key}`);
  }
  if (!SUPPORTED_EVENT_TYPES.has(event.eventType)) {
    throw new RangeError(`unsupported eventType "${event.eventType}"; see docs/TAIWAN_ADJUSTED_PRICE_METHODOLOGY.md for supported categories and how to flag an unsupported one instead of guessing`);
  }
  if (event.eventType === 'other' || event.factor != null) {
    if (!Number.isFinite(Number(event.factor)) || Number(event.factor) <= 0) {
      throw new RangeError('factor must be positive finite number');
    }
    return { ...event, factor: Number(event.factor) };
  }
  return { ...event };
}

// ---------------------------------------------------------------------------
// Per-event factor/share-count-ratio computation
//
// Every function returns { factor, shareCountRatio, referencePrice }:
//   factor           - adjustedPrice / previousClose, applied to OHLC
//   shareCountRatio  - sharesAfter / sharesBefore, applied to volume
//   referencePrice   - the official ex-rights/ex-dividend reference price,
//                       kept for provenance/traceability, not itself stored
//                       as the adjusted price (the row's own raw close is
//                       multiplied by the cumulative factor instead - see
//                       applyAdjustment).
// ---------------------------------------------------------------------------

/**
 * General combined ex-rights/ex-dividend reference-price formula (TWSE/TPEx
 * official methodology):
 *
 *   referencePrice = (previousClose - cashDividendPerShare
 *                      + subscriptionPrice * rightsRatio)
 *                    / (1 + stockDividendRatio + rightsRatio)
 *
 * Every dividend/rights case in this module is this same formula with the
 * unused parameters at their neutral value (0 for amounts/ratios). This
 * mirrors TWSE/TPEx's own combined-event calculation rather than
 * approximating it by multiplying independently-computed factors, which
 * would NOT reproduce the official number when cash and stock dividends (or
 * dividends and rights issues) share the same ex-date - see "Same-Day
 * Multiple Events" in the methodology doc.
 */
function combinedDividendRightsFactor(previousClose, {
  cashDividendPerShare = 0,
  stockDividendRatio = 0,
  subscriptionPrice = 0,
  rightsRatio = 0
} = {}) {
  const base = requireFinitePositive(previousClose, 'previousClose');
  const cash = requireFiniteNonNegative(cashDividendPerShare, 'cashDividendPerShare');
  const stockRatio = requireFiniteNonNegative(stockDividendRatio, 'stockDividendRatio');
  const subPrice = requireFiniteNonNegative(subscriptionPrice, 'subscriptionPrice');
  const rights = requireFiniteNonNegative(rightsRatio, 'rightsRatio');
  if (cash >= base) throw new RangeError('cashDividendPerShare must be less than previousClose');

  const referencePrice = (base - cash + (subPrice * rights)) / (1 + stockRatio + rights);
  const factor = referencePrice / base;
  const shareCountRatio = 1 + stockRatio + rights;
  return { factor, shareCountRatio, referencePrice };
}

/**
 * Capital reduction (減資) recovery-price formula. Two official cases:
 *   - Cash refund:        recoveryPrice = (preClose - cashRefundPerShare) / reductionRatio
 *   - Loss compensation:  recoveryPrice = preClose / reductionRatio
 * `reductionRatio` = sharesAfter / sharesBefore (e.g. a 20% reduction is
 * 0.8). `cashRefundPerShare` defaults to 0, which collapses to the
 * loss-compensation case.
 */
function capitalReductionFactor(previousClose, { reductionRatio, cashRefundPerShare = 0 } = {}) {
  const base = requireFinitePositive(previousClose, 'previousClose');
  const ratio = requireFinitePositive(reductionRatio, 'reductionRatio');
  const refund = requireFiniteNonNegative(cashRefundPerShare, 'cashRefundPerShare');
  if (refund >= base) throw new RangeError('cashRefundPerShare must be less than previousClose');

  const referencePrice = (base - refund) / ratio;
  const factor = referencePrice / base;
  return { factor, shareCountRatio: ratio, referencePrice };
}

/**
 * True when an event carries a direct, pre-computed factor rather than the
 * type-specific raw parameters this module derives a factor from. This is
 * the escape hatch for eventType 'other' (which has no formula here at
 * all), and is also accepted for the formula-driven types as a documented
 * manual/legacy override - e.g. a factor already cross-checked against
 * TWSE's own published result. shareCountRatio must be supplied alongside
 * it (defaulting to 1, "assume no share-count change") since it cannot be
 * derived from an opaque factor.
 */
function hasDirectFactor(event) {
  return event.factor != null;
}

function directFactorResult(event) {
  return {
    factor: event.factor,
    shareCountRatio: event.shareCountRatio != null ? requireFinitePositive(event.shareCountRatio, 'shareCountRatio') : 1,
    referencePrice: null
  };
}

/**
 * Computes { factor, shareCountRatio, referencePrice } for one validated
 * event, given the previous trading day's raw close (the official
 * methodology's base price). Throws for any event type/parameter
 * combination this module does not (yet) support, rather than guessing.
 */
export function computeEventFactor(event, { previousClose }) {
  const e = validateEvent(event);
  if (hasDirectFactor(e)) return directFactorResult(e);

  switch (e.eventType) {
    case 'cash_dividend':
      return combinedDividendRightsFactor(previousClose, { cashDividendPerShare: e.cashDividendPerShare });
    case 'stock_dividend':
      return combinedDividendRightsFactor(previousClose, { stockDividendRatio: e.stockDividendRatio });
    case 'rights_issue':
      return combinedDividendRightsFactor(previousClose, { subscriptionPrice: e.subscriptionPrice, rightsRatio: e.rightsRatio });
    case 'split':
      // Taiwan has no distinct "stock split" filing; it is executed as a
      // stock dividend. splitRatio = new shares per existing share (e.g. 2
      // for a 1-for-2 split) maps to stockDividendRatio = splitRatio - 1.
      return combinedDividendRightsFactor(previousClose, { stockDividendRatio: requireFinitePositive(e.splitRatio, 'splitRatio') - 1 });
    case 'reverse_split':
      // Executed as a capital reduction via share consolidation (股份合併).
      // mergeRatio = sharesAfter / sharesBefore (e.g. 0.5 for a 2-for-1
      // reverse split) maps directly to reductionRatio.
      return capitalReductionFactor(previousClose, { reductionRatio: e.mergeRatio });
    case 'capital_reduction':
      return capitalReductionFactor(previousClose, { reductionRatio: e.reductionRatio, cashRefundPerShare: e.cashRefundPerShare });
    // 'other' is not listed here: validateEvent() already requires a valid
    // factor whenever eventType is 'other' (or throws), so hasDirectFactor
    // above always short-circuits before reaching this switch for it.
    default:
      throw new RangeError(`unsupported eventType "${e.eventType}"`);
  }
}

// ---------------------------------------------------------------------------
// Same-day combination
// ---------------------------------------------------------------------------

const DIVIDEND_RIGHTS_TYPES = new Set(['cash_dividend', 'stock_dividend', 'rights_issue', 'split']);

/**
 * Combines every event sharing one symbol+effectiveDate into a single
 * { factor, shareCountRatio } per the deterministic ordering rule:
 *
 *   1. capital_reduction / reverse_split events apply first (in the order
 *      given - TWSE only publishes one reduction per date in practice, but
 *      ties are broken by array order for determinism), each producing its
 *      own recovery price which becomes the base for what follows.
 *   2. All cash_dividend / stock_dividend / rights_issue / split events on
 *      the same date are combined into ONE call to the combined formula
 *      (not multiplied as independent factors - see module docstring).
 *   3. 'other' events always compose by simple multiplication, since this
 *      module has no formula for them; an 'other' event sharing a date with
 *      a formula-driven event is a genuinely unsupported combination and
 *      throws rather than guessing how to combine them.
 */
export function combineSameDayEvents(events, previousClose) {
  const validatedEvents = events.map(validateEvent);
  // Events carrying an explicit factor (eventType 'other', or a manual/
  // legacy override on any type) are never combined mathematically with a
  // formula-driven event - see hasDirectFactor.
  const directEvents = validatedEvents.filter(hasDirectFactor);
  const formulaEvents = validatedEvents.filter((e) => !hasDirectFactor(e));
  const capitalEvents = formulaEvents.filter((e) => e.eventType === 'capital_reduction' || e.eventType === 'reverse_split');
  const dividendEvents = formulaEvents.filter((e) => DIVIDEND_RIGHTS_TYPES.has(e.eventType));

  if (directEvents.length > 0 && (capitalEvents.length > 0 || dividendEvents.length > 0)) {
    throw new Error('combining a direct-factor event with a formula-driven event on the same effective date is not supported - provide a single pre-combined direct-factor event instead');
  }

  let base = previousClose;
  let cumulativeFactor = 1;
  let cumulativeShareCountRatio = 1;

  for (const event of capitalEvents) {
    const result = computeEventFactor(event, { previousClose: base });
    cumulativeFactor *= result.factor;
    cumulativeShareCountRatio *= result.shareCountRatio;
    base = result.referencePrice; // the next event's base is this event's outcome
  }

  if (dividendEvents.length > 0) {
    const merged = dividendEvents.reduce((acc, event) => {
      if (event.cashDividendPerShare != null) acc.cashDividendPerShare += Number(event.cashDividendPerShare);
      if (event.stockDividendRatio != null) acc.stockDividendRatio += Number(event.stockDividendRatio);
      if (event.splitRatio != null) acc.stockDividendRatio += Number(event.splitRatio) - 1;
      if (event.subscriptionPrice != null && event.rightsRatio != null) {
        // weighted subscription price across possibly multiple rights events
        const priorRights = acc.rightsRatio;
        const nextRights = Number(event.rightsRatio);
        acc.subscriptionPrice = priorRights + nextRights === 0
          ? 0
          : ((acc.subscriptionPrice * priorRights) + (Number(event.subscriptionPrice) * nextRights)) / (priorRights + nextRights);
        acc.rightsRatio += nextRights;
      }
      return acc;
    }, { cashDividendPerShare: 0, stockDividendRatio: 0, subscriptionPrice: 0, rightsRatio: 0 });

    const result = combinedDividendRightsFactor(base, merged);
    cumulativeFactor *= result.factor;
    cumulativeShareCountRatio *= result.shareCountRatio;
  }

  for (const event of directEvents) {
    const result = directFactorResult(event);
    cumulativeFactor *= result.factor;
    cumulativeShareCountRatio *= result.shareCountRatio;
  }

  return { factor: cumulativeFactor, shareCountRatio: cumulativeShareCountRatio };
}

// ---------------------------------------------------------------------------
// Series adjustment
// ---------------------------------------------------------------------------

/**
 * Applies deterministic adjustment to a raw OHLCV series given corporate
 * action events. Preserves raw fields untouched and adds:
 *   adjustedOpen, adjustedHigh, adjustedLow, adjustedClose, adjustedVolume,
 *   adjustmentFactor, shareCountRatio
 *
 * Calculation order (see docs/TAIWAN_ADJUSTED_PRICE_METHODOLOGY.md
 * "Precision"): events are validated and grouped by effective date first;
 * same-day events combine per combineSameDayEvents(); the cumulative
 * factor/shareCountRatio for each row is the product of every date group's
 * result for effective dates strictly after that row's trading date,
 * computed at full floating-point precision; rounding to storage precision
 * (2dp for price, integer for volume) happens only at the very end, once
 * per row - never on intermediate factors.
 */
export function applyAdjustment(prices, events) {
  if (!Array.isArray(prices)) throw new TypeError('prices must be an array');

  const validated = (events ?? []).map(validateEvent);
  const byDate = new Map();
  for (const event of validated) {
    const key = String(event.effectiveDate);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(event);
  }

  // Rows sorted by trading date so each event group can look up "the close
  // of the last trading day before the ex-date" (除權息前收盤價), the fixed
  // base price the official formula uses. This is a SINGLE value per event
  // group, not something that varies per row - the same computed factor
  // then applies uniformly to every row before that date, which is what
  // keeps the adjusted series internally consistent (this is the entire
  // point of a backward-adjusted series: returns between any two pre-event
  // days must be unchanged by the adjustment).
  const sortedRows = [...prices]
    .filter((row) => row && row.close != null)
    .map((row) => ({ tradingDate: String(row.tradingDate), close: Number(row.close) }))
    .sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));

  function basePriceBefore(effectiveDate) {
    let candidate = null;
    for (const row of sortedRows) {
      if (row.tradingDate >= effectiveDate) break;
      candidate = row.close;
    }
    return candidate;
  }

  const dateGroups = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([effectiveDate, groupEvents]) => {
      const basePrice = basePriceBefore(effectiveDate);
      if (basePrice == null) {
        // No row in this series precedes the event's effective date, so the
        // official formula's base price cannot be resolved from this
        // series. Per the no-fabrication rule, this event contributes no
        // adjustment rather than guessing a base price.
        return { effectiveDate, factor: 1, shareCountRatio: 1, unresolved: true };
      }
      const combined = combineSameDayEvents(groupEvents, basePrice);
      return { effectiveDate, factor: combined.factor, shareCountRatio: combined.shareCountRatio, unresolved: false };
    });

  return prices.map((row) => {
    if (!row || row.close == null) return row;
    const date = String(row.tradingDate);
    const applicableGroups = dateGroups.filter((group) => group.effectiveDate > date);

    let factor = 1;
    let shareCountRatio = 1;
    for (const group of applicableGroups) {
      factor *= group.factor;
      shareCountRatio *= group.shareCountRatio;
    }

    return {
      ...row,
      adjustedOpen: row.open != null ? round(Number(row.open) * factor, PRICE_DECIMALS) : undefined,
      adjustedHigh: row.high != null ? round(Number(row.high) * factor, PRICE_DECIMALS) : undefined,
      adjustedLow: row.low != null ? round(Number(row.low) * factor, PRICE_DECIMALS) : undefined,
      adjustedClose: round(Number(row.close) * factor, PRICE_DECIMALS),
      adjustedVolume: row.volume != null ? Math.round(Number(row.volume) * shareCountRatio) : undefined,
      adjustmentFactor: round(factor, FACTOR_DECIMALS),
      shareCountRatio: round(shareCountRatio, FACTOR_DECIMALS)
    };
  });
}

// ---------------------------------------------------------------------------
// Recommendation-engine convenience wrapper
// ---------------------------------------------------------------------------

/**
 * For consumers that only need a single OHLCV series to feed a calculation
 * (recommendation-engine.js's buildStockRecommendation, the Target Range/
 * indicator engines) rather than the raw+adjusted pair applyAdjustment
 * returns for charting. Substitutes close/open/high/low/volume with their
 * adjusted equivalents (a no-op, factor 1, for any row on or after every
 * known event's effective date, so today's real, currently-traded price is
 * never altered); falls back to the raw value only when the adjusted field
 * is undefined (a raw row with a missing open/high/low).
 *
 * Kept in this file (not src/market-data/adjusted-series.js, which
 * re-exports it) so it stays part of this deliberately import-free module -
 * see scripts/sync-dashboard-vendor.mjs's SYNCED_FILES comment on why every
 * file in that list must have zero internal imports to be safely vendored
 * byte-for-byte into public/vendor/calc/ for browser use.
 *
 * This is the fix for Phase-1 roadmap item "股票分割真正還原": without it, a
 * stock's own real historical split (e.g. 6669/緯穎, 2026-09-02, ~3:1) sits
 * inside the technical lookback window as a raw, un-adjusted price cliff,
 * corrupting Donchian/Structural Resistance/Fibonacci candidates that
 * assume a continuous series.
 */
export function buildAdjustedRecommendationRecords(rawRecords, events = []) {
  if (!events.length) return rawRecords;
  const adjusted = applyAdjustment(rawRecords, events);
  return adjusted.map((row) => ({
    ...row,
    close: row.adjustedClose ?? row.close,
    open: row.adjustedOpen ?? row.open,
    high: row.adjustedHigh ?? row.high,
    low: row.adjustedLow ?? row.low,
    volume: row.adjustedVolume ?? row.volume
  }));
}
