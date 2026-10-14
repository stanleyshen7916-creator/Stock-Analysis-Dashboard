// Actual Holding Risk Monitoring (M6, "M5 → M7 Autonomous Execution
// Specification v1.0", Sections 12-13). Composes ONLY already-existing,
// already-verified classification functions (technical-summary.js,
// risk-analysis.js, the vendored signal-engine.js) - never a second set
// of technical-signal rules. "Deterioration"/"reversal" is detected by
// calling the SAME classify* function at two points in time (today's full
// records vs the records truncated to N days ago - the exact "slice to
// replay as of an earlier date" technique src/analysis/simulation.js
// already established for M5), never a new formula.
//
// "近" (near) Target/Risk Price uses ATR(14)-based proximity
// (|price - level| <= ATR) - the standard volatility-normalized "how
// close is close" measure in technical analysis, already computed
// elsewhere in this codebase (risk-analysis.js, chart-series.js), not an
// arbitrary percentage invented for this feature. See Issue #146.
//
// Every output state carries the literal list of triggered conditions
// (Section 13: "禁止只顯示「AI 認為應該賣出」") - never a black-box verdict.

import {
  classifyTrend,
  classifyMovingAverageRelationship,
  classifyRsi,
  classifyMomentum,
  classifyVolatility
} from './technical-summary.js';
import { classifyVolumeAnomaly } from './risk-analysis.js';
import { buildAtrSeries } from './chart-series.js';
import { generateTechnicalSignals } from '../../vendor/calc/signal-engine.js';
import { sma, rsi as rsiIndicator, macd as macdIndicator } from '../../vendor/calc/indicators.js';

const TECHNICAL_LOOKBACK_DAYS = 5; // matches technical-summary.js's own MOMENTUM_PERIOD

const RISK_REASON_LABEL = {
  RISK_PRICE_BREACHED: '現價已跌破 Risk Price',
  TARGET_PRICE_REACHED: '現價已達到 Target Price',
  NEAR_RISK_PRICE: '現價接近 Risk Price（價差在 ATR 一倍範圍內）',
  NEAR_TARGET_PRICE: '現價接近 Target Price（價差在 ATR 一倍範圍內）',
  TREND_DETERIORATED: '趨勢轉弱（股價與20日均線關係轉為偏空）',
  MA_RELATIONSHIP_DETERIORATED: '均線排列轉弱（MA5/MA20 關係轉為偏空）',
  RSI_REVERSAL_FROM_OVERBOUGHT: 'RSI 自超買區間回落',
  MOMENTUM_DETERIORATED: `近${TECHNICAL_LOOKBACK_DAYS}日動能轉弱`,
  MACD_BEARISH_REVERSAL: 'MACD 由偏多轉偏空',
  VOLUME_ANOMALY: '成交量異常放大',
  VOLATILITY_EXPANDING: '波動度擴張',
  REVENUE_DETERIORATED: '月營收年增率轉為負值'
};

/**
 * @returns {{riskPriceBreached: boolean|null, targetPriceReached: boolean|null, nearRiskPrice: boolean|null, nearTargetPrice: boolean|null, reasons: string[]}}
 */
export function assessPriceRisk({ currentPrice, targetPrice, riskPrice, atr }) {
  const hasCurrent = Number.isFinite(currentPrice);
  const result = { riskPriceBreached: null, targetPriceReached: null, nearRiskPrice: null, nearTargetPrice: null, reasons: [] };
  if (!hasCurrent) return result;

  if (Number.isFinite(riskPrice)) {
    result.riskPriceBreached = currentPrice <= riskPrice;
    if (result.riskPriceBreached) result.reasons.push(RISK_REASON_LABEL.RISK_PRICE_BREACHED);
    if (Number.isFinite(atr) && atr > 0) {
      result.nearRiskPrice = !result.riskPriceBreached && Math.abs(currentPrice - riskPrice) <= atr;
      if (result.nearRiskPrice) result.reasons.push(RISK_REASON_LABEL.NEAR_RISK_PRICE);
    }
  }
  if (Number.isFinite(targetPrice)) {
    result.targetPriceReached = currentPrice >= targetPrice;
    if (result.targetPriceReached) result.reasons.push(RISK_REASON_LABEL.TARGET_PRICE_REACHED);
    if (Number.isFinite(atr) && atr > 0) {
      result.nearTargetPrice = !result.targetPriceReached && Math.abs(currentPrice - targetPrice) <= atr;
      if (result.nearTargetPrice) result.reasons.push(RISK_REASON_LABEL.NEAR_TARGET_PRICE);
    }
  }
  return result;
}

const TREND_RANK = { UP: 2, FLAT: 1, DOWN: 0, UNKNOWN: null };
const MA_RELATIONSHIP_RANK = { BULLISH: 2, NEUTRAL: 1, BEARISH: 0, UNKNOWN: null };
const MOMENTUM_RANK = { UP: 2, FLAT: 1, DOWN: 0, UNKNOWN: null };

function rankDeteriorated(rankMap, past, now) {
  const pastRank = rankMap[past];
  const nowRank = rankMap[now];
  if (pastRank == null || nowRank == null) return null;
  return nowRank < pastRank;
}

/**
 * Pure - takes already-classified categorical states at two points in
 * time (today vs TECHNICAL_LOOKBACK_DAYS ago), never raw records. Easy to
 * unit test without fabricating OHLCV fixtures for every case; see
 * computeHoldingRiskFromRecords() below for the composition that actually
 * derives these categories from real market_daily history.
 */
export function assessTechnicalRisk({ trendNow, trendPast, maRelationshipNow, maRelationshipPast, rsiNow, rsiPast, momentumNow, momentumPast, macdNow, macdPast, volumeAnomaly, volatility }) {
  const reasons = [];
  const flags = {};

  flags.trendDeteriorated = rankDeteriorated(TREND_RANK, trendPast, trendNow);
  if (flags.trendDeteriorated) reasons.push(RISK_REASON_LABEL.TREND_DETERIORATED);

  flags.maRelationshipDeteriorated = rankDeteriorated(MA_RELATIONSHIP_RANK, maRelationshipPast, maRelationshipNow);
  if (flags.maRelationshipDeteriorated) reasons.push(RISK_REASON_LABEL.MA_RELATIONSHIP_DETERIORATED);

  flags.rsiReversalFromOverbought = rsiPast === 'OVERBOUGHT' && rsiNow !== 'OVERBOUGHT' && rsiNow !== 'UNKNOWN' ? true : (rsiPast == null || rsiPast === 'UNKNOWN' || rsiNow == null || rsiNow === 'UNKNOWN' ? null : false);
  if (flags.rsiReversalFromOverbought) reasons.push(RISK_REASON_LABEL.RSI_REVERSAL_FROM_OVERBOUGHT);

  flags.momentumDeteriorated = rankDeteriorated(MOMENTUM_RANK, momentumPast, momentumNow);
  if (flags.momentumDeteriorated) reasons.push(RISK_REASON_LABEL.MOMENTUM_DETERIORATED);

  flags.macdBearishReversal = macdPast === 'macd_bullish' && macdNow === 'macd_bearish' ? true : (macdPast == null || macdNow == null ? null : false);
  if (flags.macdBearishReversal) reasons.push(RISK_REASON_LABEL.MACD_BEARISH_REVERSAL);

  flags.volumeAnomaly = volumeAnomaly === 'ANOMALY' ? true : (volumeAnomaly == null || volumeAnomaly === 'UNKNOWN' ? null : false);
  if (flags.volumeAnomaly) reasons.push(RISK_REASON_LABEL.VOLUME_ANOMALY);

  flags.volatilityExpanding = volatility === 'EXPANDING' ? true : (volatility == null || volatility === 'UNKNOWN' ? null : false);
  if (flags.volatilityExpanding) reasons.push(RISK_REASON_LABEL.VOLATILITY_EXPANDING);

  return { ...flags, reasons };
}

/**
 * Only Revenue Growth has real Production coverage today (EPS/Net
 * Income/Equity are not yet wired to Production - see
 * recommendation-engine.js's own header comment for this pre-existing,
 * documented gap). Those three always render UNAVAILABLE, never guessed.
 */
export function assessFundamentalRisk({ yoyRevenueGrowth }) {
  const reasons = [];
  const revenueDeteriorated = Number.isFinite(yoyRevenueGrowth) ? yoyRevenueGrowth < 0 : null;
  if (revenueDeteriorated) reasons.push(RISK_REASON_LABEL.REVENUE_DETERIORATED);
  return {
    revenueDeteriorated,
    epsDeteriorated: 'UNAVAILABLE',
    profitDeteriorated: 'UNAVAILABLE',
    equityDeteriorated: 'UNAVAILABLE',
    reasons
  };
}

const RISK_STATE = { EXIT_REVIEW: 'EXIT_REVIEW', RISK: 'RISK', OBSERVE: 'OBSERVE', HOLD: 'HOLD' };
export const RISK_STATE_LABEL = {
  EXIT_REVIEW: '建議重新檢視（EXIT_REVIEW）',
  RISK: '風險提高（RISK）',
  OBSERVE: '觀察中（OBSERVE）',
  HOLD: '持有（HOLD）'
};

/**
 * EXIT_REVIEW > RISK > OBSERVE > HOLD (Section 13) - a fixed, traceable
 * severity ordering, never a single black-box "AI judgment". `reasons` is
 * the literal union of every triggered condition across all three risk
 * dimensions.
 */
export function assessHoldingRisk({ priceRisk, technicalRisk, fundamentalRisk }) {
  const reasons = [...priceRisk.reasons, ...technicalRisk.reasons, ...fundamentalRisk.reasons];
  const triggeredTechnicalCount = technicalRisk.reasons.length;

  let state;
  if (priceRisk.riskPriceBreached) {
    state = RISK_STATE.EXIT_REVIEW;
  } else if (priceRisk.nearRiskPrice || triggeredTechnicalCount >= 2 || fundamentalRisk.revenueDeteriorated) {
    state = RISK_STATE.RISK;
  } else if (priceRisk.nearTargetPrice || triggeredTechnicalCount === 1) {
    state = RISK_STATE.OBSERVE;
  } else {
    state = RISK_STATE.HOLD;
  }

  return { state, stateLabel: RISK_STATE_LABEL[state], reasons };
}

/**
 * The composition function: derives every categorical input above from
 * real market_daily history (+ optional yoyRevenueGrowth already fetched
 * elsewhere) and calls the pure functions above. This is the one place
 * that touches raw records/indicators - reusing the vendored indicator
 * engine and existing classify* functions exactly as recommendation-engine.js
 * already does, never a second engine.
 *
 * @param {Array<object>} records - the holding's OHLCV history, oldest first.
 * @param {number|null} targetPrice
 * @param {number|null} riskPrice
 * @param {number|null} yoyRevenueGrowth
 */
export function computeHoldingRiskFromRecords({ records, targetPrice, riskPrice, yoyRevenueGrowth = null }) {
  if (!Array.isArray(records) || records.length === 0) return null;

  const latestIndex = records.length - 1;
  const pastIndex = latestIndex - TECHNICAL_LOOKBACK_DAYS;
  const pastRecords = pastIndex >= 0 ? records.slice(0, pastIndex + 1) : null;

  const closes = records.map((r) => r.close);
  const sma20 = sma(closes, 20);
  const atrSeries = buildAtrSeries(records, 14);
  const latestAtr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1].value : null;

  const trendNow = classifyTrend(closes[latestIndex], sma20[latestIndex]);
  const trendPast = pastRecords ? classifyTrend(closes[pastIndex], sma20[pastIndex]) : 'UNKNOWN';

  const sma5 = sma(closes, 5);
  const maRelationshipNow = classifyMovingAverageRelationship(sma5[latestIndex], sma20[latestIndex]);
  const maRelationshipPast = pastRecords ? classifyMovingAverageRelationship(sma5[pastIndex], sma20[pastIndex]) : 'UNKNOWN';

  const rsiSeries = rsiIndicator(closes, 14);
  const rsiNow = classifyRsi(rsiSeries[latestIndex]);
  const rsiPast = pastRecords ? classifyRsi(rsiSeries[pastIndex]) : 'UNKNOWN';

  const momentumNow = classifyMomentum(records);
  const momentumPast = pastRecords ? classifyMomentum(pastRecords) : 'UNKNOWN';

  const macdResult = macdIndicator(closes, 12, 26, 9);
  const macdSignals = generateTechnicalSignals({ close: closes, sma: [], ema: [], rsi: [], macd: { line: macdResult.macd, signal: macdResult.signal }, bollingerBands: { middle: [], upper: [], lower: [] } });
  const macdNow = macdSignals[latestIndex]?.signals.includes('macd_bullish') ? 'macd_bullish' : macdSignals[latestIndex]?.signals.includes('macd_bearish') ? 'macd_bearish' : null;
  const macdPast = pastRecords ? (macdSignals[pastIndex]?.signals.includes('macd_bullish') ? 'macd_bullish' : macdSignals[pastIndex]?.signals.includes('macd_bearish') ? 'macd_bearish' : null) : null;

  const volumeAnomaly = classifyVolumeAnomaly(records);
  const volatility = classifyVolatility(atrSeries);

  const priceRisk = assessPriceRisk({ currentPrice: closes[latestIndex], targetPrice, riskPrice, atr: latestAtr });
  const technicalRisk = assessTechnicalRisk({ trendNow, trendPast, maRelationshipNow, maRelationshipPast, rsiNow, rsiPast, momentumNow, momentumPast, macdNow, macdPast, volumeAnomaly, volatility });
  const fundamentalRisk = assessFundamentalRisk({ yoyRevenueGrowth });

  return { ...assessHoldingRisk({ priceRisk, technicalRisk, fundamentalRisk }), priceRisk, technicalRisk, fundamentalRisk };
}
