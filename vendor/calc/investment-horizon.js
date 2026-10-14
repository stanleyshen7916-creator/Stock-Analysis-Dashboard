// 投資週期分類與個股適配分析 (MVP-3, Issue #128) - classifies a symbol's
// suitable holding horizon (當沖/中短期/長期) from already-verified signals
// only. Per Stanley's spec, no horizon may ever be decided by a single
// indicator - each requires 2+ already-verified signals to agree, and any
// horizon whose required signals aren't all known is reported as
// insufficient data, never silently marked unsuitable or guessed.
//
// Deliberately import-free (matches target-price.js/recommendation.js):
// every signal here is already computed by the caller via the existing
// tested modules (technical-summary.js's classify* functions,
// fundamental/signals.js's generateFundamentalSignals()) - this module
// only combines them into a horizon verdict, never recomputing or
// inventing a new signal.
//
// Rules (all reuse already-established, documented thresholds - RSI 70/30,
// the ATR/Volume 1.2x/0.8x ratios - never a newly-invented one):
//   當沖 (day trading)   - needs volatility EXPANDING AND volume
//                          ABOVE_AVERAGE (movement + liquidity to enter/
//                          exit intraday).
//   長期 (long-term)     - needs volatility STABLE/CONTRACTING AND at
//                          least one positive fundamental growth signal
//                          (long-term holding relies more on fundamentals
//                          than short-term technicals).
//   中短期 (short/medium) - needs trend and momentum non-FLAT and in
//                          agreement (both UP or both DOWN) - the middle
//                          ground between the other two.
//
// Liquidity is deliberately NOT a classifier input here - see Issue #128's
// evidence audit (docs/KNOWN_LIMITATIONS.md): no validated absolute
// liquidity threshold exists anywhere in this codebase or its docs, so
// average daily volume/trading value is disclosed as a Fact by the caller,
// never hard-classified into LOW/MEDIUM/HIGH without a cited basis.

function isKnown(status) {
  return status != null && status !== 'UNKNOWN';
}

function classifyDayTrading(volatilityStatus, volumeStatus) {
  if (!isKnown(volatilityStatus) || !isKnown(volumeStatus)) {
    return { suitable: null, matchedConditions: [], unmatchedConditions: [], insufficientData: true };
  }
  const matched = [];
  const unmatched = [];
  if (volatilityStatus === 'EXPANDING') matched.push('volatility_expanding'); else unmatched.push('volatility_not_expanding');
  if (volumeStatus === 'ABOVE_AVERAGE') matched.push('volume_above_average'); else unmatched.push('volume_not_above_average');
  return { suitable: matched.length === 2, matchedConditions: matched, unmatchedConditions: unmatched, insufficientData: false };
}

function classifyLongTerm(volatilityStatus, fundamentalSignals) {
  const hasFundamentalEvidence = Array.isArray(fundamentalSignals) && fundamentalSignals.length > 0;
  if (!isKnown(volatilityStatus) || !hasFundamentalEvidence) {
    return { suitable: null, matchedConditions: [], unmatchedConditions: [], insufficientData: true };
  }
  const matched = [];
  const unmatched = [];
  if (volatilityStatus === 'STABLE' || volatilityStatus === 'CONTRACTING') matched.push('volatility_stable_or_contracting'); else unmatched.push('volatility_expanding');
  if (fundamentalSignals.includes('revenue_growth_positive')) matched.push('fundamental_growth_signal'); else unmatched.push('fundamental_growth_signal_absent');
  return { suitable: matched.length === 2, matchedConditions: matched, unmatchedConditions: unmatched, insufficientData: false };
}

function classifyShortMediumTerm(trend, momentum) {
  if (!isKnown(trend) || !isKnown(momentum)) {
    return { suitable: null, matchedConditions: [], unmatchedConditions: [], insufficientData: true };
  }
  const aligned = trend !== 'FLAT' && momentum !== 'FLAT' && trend === momentum;
  return {
    suitable: aligned,
    matchedConditions: aligned ? ['trend_momentum_aligned'] : [],
    unmatchedConditions: aligned ? [] : ['trend_momentum_not_aligned'],
    insufficientData: false
  };
}

/**
 * @param {object} params
 * @param {string} [params.volatilityStatus] - classifyVolatility() output: EXPANDING/CONTRACTING/STABLE/UNKNOWN.
 * @param {string} [params.volumeStatus] - classifyVolume() output: ABOVE_AVERAGE/BELOW_AVERAGE/AVERAGE/UNKNOWN.
 * @param {string} [params.trend] - classifyTrend() output: UP/DOWN/FLAT/UNKNOWN.
 * @param {string} [params.momentum] - classifyMomentum() output: UP/DOWN/FLAT/UNKNOWN.
 * @param {string[]} [params.fundamentalSignals] - generateFundamentalSignals() output.
 * @returns {{evidenceStrength: 'HIGH'|'MEDIUM'|'LOW', knownCoreSignalCount: number, horizons: object}}
 */
export function classifyInvestmentHorizon({
  volatilityStatus = 'UNKNOWN', volumeStatus = 'UNKNOWN', trend = 'UNKNOWN', momentum = 'UNKNOWN', fundamentalSignals = []
}) {
  const coreSignals = [volatilityStatus, volumeStatus, trend, momentum];
  const knownCoreSignalCount = coreSignals.filter(isKnown).length;
  const evidenceStrength = knownCoreSignalCount >= 4 ? 'HIGH' : knownCoreSignalCount >= 2 ? 'MEDIUM' : 'LOW';

  return {
    evidenceStrength,
    knownCoreSignalCount,
    horizons: {
      DAY_TRADING: classifyDayTrading(volatilityStatus, volumeStatus),
      LONG_TERM: classifyLongTerm(volatilityStatus, fundamentalSignals),
      SHORT_MEDIUM_TERM: classifyShortMediumTerm(trend, momentum)
    }
  };
}
