// Reasonable Target Price Range (replaces target-price.js's naive
// "Target = Donchian Upper" - see STOCK_ANALYSIS_TARGET_RANGE_CALCULATION_RULES_v1.0.md,
// which explicitly forbids that pattern: "Donchian Upper 只能是候選參考，不得直接等同 Target").
//
// Five candidate sources (the spec's own §2, §12 "do not add more"):
//   A. Structural Resistance / Previous High - a longer-window swing high,
//      genuinely distinct from the short Donchian window below.
//   B. Donchian Reference - the existing short-window channel, kept ONLY as
//      one candidate input, never returned as the Target itself.
//   C. Measured Move - BreakoutPrice + PatternHeight, only when a real
//      breakout above the short Donchian channel is actually observed at
//      the latest bar (no breakout = no measured-move candidate, never a
//      guessed one).
//   D. Fibonacci Extension - C + (B-A) x ratio over a detected ABC swing.
//      Deliberately tagged confidenceTier: 'LOW' throughout this module -
//      see the credibility review this module's PR is based on: Malkiel and
//      Merrill both found no reliable evidence a golden-ratio level behaves
//      differently from an arbitrary percentage, and the one quantitative
//      study found (Presto Research, statistical-arbitrage 2022) never
//      benchmarked Fibonacci ratios against arbitrary ones. Included as a
//      candidate per the spec, never weighted as equally trustworthy as the
//      other four until a backtest proves otherwise.
//   E. ATR - never a target source. Only annotates whether the resulting
//      range is unusually narrow/wide relative to recent volatility.
//
// Confluence clustering (spec §4/§5): candidates within CONFLUENCE_TOLERANCE
// of each other are grouped into one zone - never averaged (the spec's own
// "108/110/111 becomes a 108-111 zone, not 109.67" example). TargetRangeLow/
// High are the nearest/next validated zone above the entry reference.
//
// Risk/Reward Gate (spec §6): status is VALID only when RR_low clears
// minRiskReward. That threshold is NOT validated - the spec explicitly says
// it must be chosen by comparing 1.0/1.5/2.0 (etc.) via backtest, so the
// default here (1.0, the least restrictive) is a placeholder, not a tuned
// value; callers should not treat a VALID status as anything more than
// "the calculation ran and cleared the most permissive possible bar."
//
// Deliberately import-free (matches target-price.js's own convention): the
// caller computes donchianChannel()/atr() once and passes the arrays in, so
// no indicator math is duplicated and this module stays vendorable
// byte-for-byte into public/vendor/calc/.

const DEFAULT_PERIOD = 20; // short/near-term window, matches the existing Donchian default
const DEFAULT_STRUCTURAL_PERIOD = 60; // ~1 quarter of trading days - a genuinely longer window than DEFAULT_PERIOD
const DEFAULT_FIBONACCI_LOOKBACK = 60;
const DEFAULT_MIN_RISK_REWARD = 1.0; // placeholder - see header comment, not backtest-tuned
const CONFLUENCE_TOLERANCE_PCT = 0.015; // candidates within 1.5% of each other cluster into one zone
const FIBONACCI_RATIOS = [1.0, 1.272, 1.618, 2.0]; // spec §2D's own listed candidates, no others added

function lastFinite(values, upTo) {
  for (let i = upTo; i >= 0; i -= 1) if (Number.isFinite(values[i])) return values[i];
  return null;
}

function windowHighLow(highs, lows, endIndex, period) {
  const start = Math.max(0, endIndex - period + 1);
  const hs = highs.slice(start, endIndex + 1);
  const ls = lows.slice(start, endIndex + 1);
  if (!hs.every(Number.isFinite) || !ls.every(Number.isFinite) || hs.length < period) return null;
  return { high: Math.max(...hs), low: Math.min(...ls), startIndex: start };
}

// Candidate A: Structural Resistance / Previous High - the highest high over
// a longer, genuinely distinct window from the short Donchian channel.
function structuralResistanceCandidate({ records, highs, latestIndex, structuralPeriod }) {
  const window = windowHighLow(highs, highs, latestIndex, structuralPeriod);
  if (!window) return null;
  return {
    sourceType: 'STRUCTURAL_RESISTANCE',
    formula: `max(High[t-${structuralPeriod - 1}..t])`,
    sourceWindow: { period: structuralPeriod, startDate: records[window.startIndex].tradingDate, endDate: records[latestIndex].tradingDate },
    value: window.high,
    confidenceTier: 'HIGH'
  };
}

// Candidate B: Donchian Reference - the already-computed short channel,
// included ONLY as one candidate among several, per the spec's explicit ban
// on returning it directly as the Target.
function donchianReferenceCandidate({ records, donchianUpper, latestIndex, period }) {
  const value = donchianUpper[latestIndex];
  if (value == null) return null;
  const startIndex = Math.max(0, latestIndex - period + 1);
  return {
    sourceType: 'DONCHIAN_REFERENCE',
    formula: `DonchianUpper(${period}) = max(High[t-${period - 1}..t])`,
    sourceWindow: { period, startDate: records[startIndex].tradingDate, endDate: records[latestIndex].tradingDate },
    value,
    confidenceTier: 'HIGH'
  };
}

// Candidate C: Measured Move - only fires on an actual observed breakout
// (latest close above the short Donchian channel); otherwise there is
// nothing to measure a move from, so no candidate is produced (never a
// guessed pattern height).
function measuredMoveCandidate({ records, donchianUpper, donchianLower, latestIndex, period }) {
  // The channel is compared as of YESTERDAY (latestIndex - 1), not today -
  // donchianChannel() is self-inclusive (today's own high is already part
  // of today's own upper band), so today's close can only exceed today's
  // own channel if close > high, which is impossible. A real breakout is
  // "today's close cleared the pattern that existed BEFORE today's bar."
  if (latestIndex < 1) return null;
  const patternHigh = donchianUpper[latestIndex - 1];
  const patternLow = donchianLower[latestIndex - 1];
  const breakoutPrice = records[latestIndex].close;
  if (patternHigh == null || patternLow == null || breakoutPrice == null) return null;
  if (!(breakoutPrice > patternHigh)) return null; // no breakout observed at T - no candidate
  const patternHeight = patternHigh - patternLow;
  const startIndex = Math.max(0, latestIndex - 1 - period + 1);
  return {
    sourceType: 'MEASURED_MOVE',
    formula: 'Target = BreakoutPrice + PatternHeight, PatternHeight = PatternHigh - PatternLow (pattern measured as of the bar before the breakout)',
    sourceWindow: { period, startDate: records[startIndex].tradingDate, endDate: records[latestIndex - 1].tradingDate },
    value: breakoutPrice + patternHeight,
    confidenceTier: 'HIGH'
  };
}

// Candidate D: Fibonacci Extension over a detected A(impulse low)->B(impulse
// high)->C(retracement low) swing within the lookback window. If no B exists
// strictly after A, or the window is too short, this returns no candidates
// at all rather than forcing a low-quality guess.
function fibonacciExtensionCandidates({ records, highs, lows, latestIndex, lookback }) {
  const start = Math.max(0, latestIndex - lookback + 1);
  if (latestIndex - start + 1 < lookback) return [];
  let aIndex = start;
  for (let i = start; i <= latestIndex; i += 1) if (lows[i] < lows[aIndex]) aIndex = i;
  let bIndex = null;
  for (let i = aIndex + 1; i <= latestIndex; i += 1) {
    if (!Number.isFinite(highs[i])) continue;
    if (bIndex == null || highs[i] > highs[bIndex]) bIndex = i;
  }
  if (bIndex == null || bIndex === aIndex) return []; // no impulse structure found
  let cIndex = null;
  for (let i = bIndex + 1; i <= latestIndex; i += 1) {
    if (!Number.isFinite(lows[i])) continue;
    if (cIndex == null || lows[i] < lows[cIndex]) cIndex = i;
  }
  const a = lows[aIndex];
  const b = highs[bIndex];
  const c = cIndex == null ? records[latestIndex].close : lows[cIndex]; // no retracement yet: use latest close as C
  if (![a, b, c].every(Number.isFinite)) return [];
  return FIBONACCI_RATIOS.map((ratio) => ({
    sourceType: 'FIBONACCI_EXTENSION',
    formula: `FibTarget(${ratio}) = C + (B - A) x ${ratio}`,
    sourceWindow: {
      period: lookback,
      aDate: records[aIndex].tradingDate,
      bDate: records[bIndex].tradingDate,
      cDate: cIndex == null ? records[latestIndex].tradingDate : records[cIndex].tradingDate
    },
    value: c + (b - a) * ratio,
    confidenceTier: 'LOW', // see module header - weak academic support, never treated as equal to the other candidates
    ratio
  }));
}

function validateCandidate(candidate, { entryReference }) {
  if (candidate.value <= entryReference) return { ...candidate, included: false, exclusionReason: 'WRONG_DIRECTION' };
  if (!Number.isFinite(candidate.value)) return { ...candidate, included: false, exclusionReason: 'INVALID_VALUE' };
  return { ...candidate, included: true, exclusionReason: null };
}

// Confluence clustering (spec §4 Step 3): group candidates within tolerance
// of each other into zones. Never an average across all candidates - each
// zone's low/high are the min/max of its own members only.
function clusterConfluence(candidates) {
  const sorted = [...candidates].sort((a, b) => a.value - b.value);
  const zones = [];
  for (const candidate of sorted) {
    const last = zones.at(-1);
    if (last && candidate.value <= last.high * (1 + CONFLUENCE_TOLERANCE_PCT)) {
      last.high = Math.max(last.high, candidate.value);
      last.low = Math.min(last.low, candidate.value);
      last.members.push(candidate);
    } else {
      zones.push({ low: candidate.value, high: candidate.value, members: [candidate] });
    }
  }
  return zones.map((zone) => ({ ...zone, memberCount: zone.members.length, sourceTypes: zone.members.map((m) => m.sourceType) }));
}

/**
 * @param {object} params
 * @param {Array} params.records - OHLCV rows, oldest first, each with at least { tradingDate, close, high, low }.
 * @param {Array<number|null>} params.donchianUpper - donchianChannel(high, low, period).upper, same length/order as records.
 * @param {Array<number|null>} params.donchianLower - donchianChannel(high, low, period).lower, same length/order as records.
 * @param {Array<number|null>} [params.atrSeries] - atr(high, low, close, atrPeriod), same length/order as records. Optional - omitting it only disables the sanity-check annotation, never blocks a range from forming.
 * @param {number} [params.period] - short/near-term window (Donchian Reference, Measured Move pattern window).
 * @param {number} [params.structuralPeriod] - longer window for Structural Resistance / Previous High.
 * @param {number} [params.fibonacciLookback] - window searched for an A/B/C swing.
 * @param {number} [params.minRiskReward] - RR_low threshold for VALID (see header comment: not backtest-tuned, placeholder default 1.0).
 * @returns {object} status/targetRangeLow/targetRangeHigh/entryReference/invalidationPrice/riskReward/candidates/confluenceZones/atrSanity/provenance
 */
export function computeTargetRange({
  records,
  donchianUpper,
  donchianLower,
  atrSeries = null,
  period = DEFAULT_PERIOD,
  structuralPeriod = DEFAULT_STRUCTURAL_PERIOD,
  fibonacciLookback = DEFAULT_FIBONACCI_LOOKBACK,
  minRiskReward = DEFAULT_MIN_RISK_REWARD
}) {
  const unavailable = { status: 'UNAVAILABLE', targetRangeLow: null, targetRangeHigh: null, entryReference: null, invalidationPrice: null, riskReward: null, candidates: [], confluenceZones: [], atrSanity: null, provenance: null };
  if (!Array.isArray(records) || records.length === 0 || !Array.isArray(donchianUpper) || !Array.isArray(donchianLower)) return unavailable;

  const latestIndex = records.length - 1;
  const highs = records.map((r) => r.high);
  const lows = records.map((r) => r.low);
  const entryReference = records[latestIndex].close;
  const invalidationPrice = donchianLower[latestIndex]; // a support breakdown invalidates the long thesis - reuses the same channel, never a second calculation
  if (entryReference == null || invalidationPrice == null || !(entryReference > invalidationPrice)) return unavailable;

  const rawCandidates = [
    structuralResistanceCandidate({ records, highs, latestIndex, structuralPeriod }),
    donchianReferenceCandidate({ records, donchianUpper, latestIndex, period }),
    measuredMoveCandidate({ records, donchianUpper, donchianLower, latestIndex, period }),
    ...fibonacciExtensionCandidates({ records, highs, lows, latestIndex, lookback: fibonacciLookback })
  ].filter(Boolean);

  if (rawCandidates.length === 0) return unavailable;

  const candidates = rawCandidates.map((c) => validateCandidate(c, { entryReference }));
  const included = candidates.filter((c) => c.included);
  if (included.length === 0) {
    return { ...unavailable, entryReference, invalidationPrice, candidates };
  }

  const confluenceZones = clusterConfluence(included).sort((a, b) => a.low - b.low);
  const targetRangeLow = confluenceZones[0].low;
  const targetRangeHigh = confluenceZones.length > 1 ? confluenceZones[1].high : confluenceZones[0].high;

  const risk = entryReference - invalidationPrice;
  const riskReward = {
    risk,
    rewardLow: targetRangeLow - entryReference,
    rewardHigh: targetRangeHigh - entryReference,
    low: risk > 0 ? (targetRangeLow - entryReference) / risk : null,
    high: risk > 0 ? (targetRangeHigh - entryReference) / risk : null,
    minRequired: minRiskReward
  };

  const atr14 = atrSeries ? lastFinite(atrSeries, latestIndex) : null;
  const rangeWidth = targetRangeHigh - targetRangeLow;
  const atrSanity = atr14 == null ? null : {
    atr14,
    rangeWidth,
    rangeWidthToAtrRatio: atr14 > 0 ? rangeWidth / atr14 : null,
    // Thresholds are a sanity-check heuristic, not a validated rule (spec §2E: ATR "只是合理性檢查").
    flag: atr14 <= 0 ? null : rangeWidth < atr14 ? 'NARROW' : rangeWidth > atr14 * 5 ? 'WIDE' : 'NORMAL'
  };

  const status = riskReward.low != null && riskReward.low >= minRiskReward ? 'VALID' : 'CONDITIONAL';

  return {
    status,
    targetRangeLow,
    targetRangeHigh,
    entryReference,
    invalidationPrice,
    riskReward,
    candidates,
    confluenceZones,
    atrSanity,
    provenance: {
      method: 'MULTI_CANDIDATE_CONFLUENCE',
      asOfDate: records[latestIndex].tradingDate,
      candidateCount: included.length,
      excludedCount: candidates.length - included.length
    }
  };
}
