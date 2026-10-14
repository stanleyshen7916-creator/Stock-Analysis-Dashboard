// AI 推薦股票與合理目標價格 (Issue #124, MVP-1) - the browser-side
// orchestration layer. Every calculation is one of the already-vendored,
// already-unit-tested pure functions in public/vendor/calc/ - this module
// only computes the raw indicator/signal inputs those functions need from
// records already fetched for the current symbol (no new network fetch)
// and composes them in sequence, the same way chart-series.js already
// composes the vendored indicator engine for the chart panes.
//
// Data -> Indicator -> Signal -> Score -> Verdict/Target Price/Counter-
// Evidence, matching this project's existing Data -> Indicator -> Signal ->
// Analysis convention (technical-summary.js) one layer further.
//
// Evidence gaps are always surfaced, never silently defaulted:
//  - Chip (籌碼面, real daily 三大法人買賣超 passed in as `institutionalFlow`)
//    is REFERENCE DATA ONLY since 2026-09-27: its weight is 0 (see
//    composite-score.js). chipDataAvailable/chipScore/chipSignalLabels
//    still report the real data for display; a symbol/day without a real
//    row reports chipDataAvailable: false - never a guessed neutral score.
//  - EPS/淨利/ROE are not yet wired to Production (the MOPS XBRL parser,
//    Issue #119, is built but not yet connected to a live import path) -
//    only revenue growth (already fetched for the Fundamental panel) feeds
//    the fundamental score here.
//  - ETF instruments do not receive stock-only fundamental factors. For an
//    ETF, the same tested technical layer and composite-score bands are used,
//    while unavailable stock-only layers are explicitly excluded and their
//    weights are normalized to the available technical layer.

import { sma, ema, rsi, macd, bollingerBands, donchianChannel } from '../../vendor/calc/indicators.js';
import { generateTechnicalSignals } from '../../vendor/calc/signal-engine.js';
import { generateFundamentalSignals } from '../../vendor/calc/fundamental-signals.js';
import { scoreTechnicalSignals, scoreFundamentalSignals } from '../../vendor/calc/layer-score.js';
import { calculateCompositeScore, defaultWeights } from '../../vendor/calc/composite-score.js';
import { atr } from '../../vendor/calc/indicators.js';
import { computeTargetRange } from '../../vendor/calc/target-range.js';
import { buildRecommendation } from '../../vendor/calc/recommendation.js';
import { generateChipSignals } from '../../vendor/calc/chip-signals.js';
import { scoreChipSignals } from '../../vendor/calc/layer-score.js';
import { classifyInvestmentHorizon } from '../../vendor/calc/investment-horizon.js';
import { computeExpectedReturn } from '../../vendor/calc/expected-return.js';
import { buildAtrSeries } from './chart-series.js';
import { classifyVolatility, classifyVolume, classifyTrend, classifyMomentum } from './technical-summary.js';

const TREND_SMA_PERIOD = 20;
const TREND_EMA_PERIOD = 20;
const RSI_PERIOD = 14;
const MACD_FAST = 12, MACD_SLOW = 26, MACD_SIGNAL = 9;
const BOLLINGER_PERIOD = 20, BOLLINGER_MULTIPLIER = 2;
const DONCHIAN_PERIOD = 20;

const ATR_PERIOD_FOR_TARGET_SANITY = 14;

// Maps the new multi-candidate computeTargetRange() output onto the legacy
// single-Target-Price shape every existing caller still reads (app.js,
// holding-risk.js, ai-final-output-runner.js, algorithm-validation-runner.js,
// and the Production DB's target_price/risk_price columns) - changing that
// shape everywhere, plus the DB schema, is out of scope for this fix (see
// STOCK_ANALYSIS_TARGET_RANGE_CALCULATION_RULES_v1.0.md's own scope: it
// specifies the calculation engine, not a UI/schema redesign).
//
// targetPrice maps to targetRangeLow (the nearer, more conservative bound) -
// both the existing "partial profit-taking" sell-reason trigger and the
// Expected Return decision gate should fire on the FIRST validated target
// being reached, not require waiting for the outer bound. riskPrice is an
// unchanged concept (still the Donchian-based invalidation/support level).
//
// status only maps to 'AVAILABLE' when the new engine's own Risk/Reward
// gate actually clears (status 'VALID') - CONDITIONAL (a range exists but
// doesn't clear the RR bar) now correctly reports as unavailable to every
// existing caller, rather than the old code showing ANY Donchian upper
// regardless of risk/reward. The full new result (candidates, confluence
// zones, RR gate, ATR sanity) is preserved under `targetRange` for future
// UI/DB work, never discarded.
function mapTargetRangeToLegacyShape(targetRangeResult, { period }) {
  if (targetRangeResult.status !== 'VALID') {
    return { status: 'UNAVAILABLE', targetPrice: null, riskPrice: null, provenance: null, targetRange: targetRangeResult };
  }
  return {
    status: 'AVAILABLE',
    targetPrice: targetRangeResult.targetRangeLow,
    riskPrice: targetRangeResult.invalidationPrice,
    provenance: {
      method: 'MULTI_CANDIDATE_CONFLUENCE',
      period,
      windowStartDate: targetRangeResult.candidates.find((c) => c.included)?.sourceWindow?.startDate ?? null,
      windowEndDate: targetRangeResult.provenance.asOfDate,
      latestClose: targetRangeResult.entryReference
    },
    targetRange: targetRangeResult
  };
}

function availableEtfWeights() {
  return { fundamental: 0, technical: 1, chip: 0 };
}

const VERDICT_LABEL = {
  positive: '符合條件（綜合評分偏多）',
  neutral: '中性（綜合評分居中）',
  negative: '不符合條件（綜合評分偏空）',
  fundamental_weak: '不符合條件（基本面訊號偏弱）'
};

function buildSellReason({ verdict, targetPrice, latestClose }) {
  if (targetPrice.status === 'AVAILABLE' && Number.isFinite(latestClose)) {
    if (latestClose >= targetPrice.targetPrice) return `現價（${latestClose}）已達或超過近 ${targetPrice.provenance.period} 日 Target Price（${targetPrice.targetPrice}）：可考慮分批獲利了結。`;
    if (latestClose <= targetPrice.riskPrice) return `現價（${latestClose}）已跌破近 ${targetPrice.provenance.period} 日 Risk Price（${targetPrice.riskPrice}）：原持有邏輯的支撐已失守，建議重新檢視。`;
  }
  if (verdict === 'negative' || verdict === 'fundamental_weak') return '綜合評分轉弱（符合條件不足），建議重新評估是否續抱。';
  return '目前未觸發既定賣出訊號，建議依原計畫持續觀察。';
}

const SIGNAL_LABEL = {
  price_above_sma: `收盤價高於 SMA${TREND_SMA_PERIOD}`,
  price_above_ema: `收盤價高於 EMA${TREND_EMA_PERIOD}`,
  rsi_oversold: 'RSI 超賣',
  rsi_overbought: 'RSI 超買',
  macd_bullish: 'MACD 偏多（快線 > 慢線）',
  macd_bearish: 'MACD 偏空（快線 < 慢線）',
  above_bollinger_upper: '收盤價高於布林通道上緣',
  below_bollinger_lower: '收盤價低於布林通道下緣',
  revenue_growth_positive: '月營收成長率為正',
  // Quarterly signals (m4-v4): the latest filed quarter vs the same quarter a year earlier; ROE over the trailing four quarters.
  eps_growth_positive: '最新季報 EPS 年增',
  eps_growth_negative: '最新季報 EPS 年減',
  net_income_growth_positive: '最新季報淨利年增',
  net_income_growth_negative: '最新季報淨利年減',
  roe_positive: 'ROE（近四季）為正',
  roe_non_positive: 'ROE（近四季）≤ 0',
  revenue_growth_negative: '月營收成長率為負',
  foreign_net_buy: '外資買超',
  foreign_net_sell: '外資賣超',
  foreign_neutral: '外資買賣超持平',
  investment_trust_net_buy: '投信買超',
  investment_trust_net_sell: '投信賣超',
  investment_trust_neutral: '投信買賣超持平',
  dealer_net_buy: '自營商買超',
  dealer_net_sell: '自營商賣超',
  dealer_neutral: '自營商買賣超持平'
};

const ATR_PERIOD = 14;
const LIQUIDITY_LOOKBACK = 20;
const HORIZON_LABEL = { DAY_TRADING: '當沖', LONG_TERM: '長期', SHORT_MEDIUM_TERM: '中短期' };
const EVIDENCE_STRENGTH_LABEL = { HIGH: '證據強度：高', MEDIUM: '證據強度：中', LOW: '證據強度：低' };
const HORIZON_CONDITION_LABEL = {
  volatility_expanding: '波動度擴張（ATR 高於近20日均值 1.2 倍以上）',
  volatility_not_expanding: '波動度未擴張',
  volatility_stable_or_contracting: '波動度穩定或收斂',
  volume_above_average: '成交量高於近20日均量',
  volume_not_above_average: '成交量未高於近20日均量',
  fundamental_growth_signal: '月營收成長率為正',
  fundamental_growth_signal_absent: '無正向月營收成長訊號',
  trend_momentum_aligned: '趨勢與動能方向一致',
  trend_momentum_not_aligned: '趨勢與動能方向不一致或持平'
};

function computeAverageDailyLiquidity(records, lookback = LIQUIDITY_LOOKBACK) {
  if (!records || records.length < lookback) return null;
  const window = records.slice(records.length - lookback);
  const averageDailyVolume = window.reduce((sum, r) => sum + r.volume, 0) / lookback;
  const averageDailyValue = window.reduce((sum, r) => sum + r.volume * r.close, 0) / lookback;
  return { averageDailyVolume, averageDailyValue, lookback };
}

const DECISION_STATE_LABEL = {
  INVESTABLE_CANDIDATE: '可投資候選（INVESTABLE_CANDIDATE）',
  OBSERVATION: '觀察中（OBSERVATION）',
  NOT_QUALIFIED: '不符合條件（NOT_QUALIFIED）',
  UNAVAILABLE: '資料不足（UNAVAILABLE）'
};

export function buildStockRecommendation(records, revenueGrowth = null, { instrumentType = 'STOCK', institutionalFlow = null, quarterlyFundamentals = null } = {}) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const normalizedInstrumentType = String(instrumentType).toUpperCase();
  const isEtf = normalizedInstrumentType === 'ETF';

  const latestIndex = records.length - 1;
  const closes = records.map((r) => r.close);
  const highs = records.map((r) => r.high);
  const lows = records.map((r) => r.low);

  const macdResult = macd(closes, MACD_FAST, MACD_SLOW, MACD_SIGNAL);
  const bundle = {
    close: closes,
    sma: sma(closes, TREND_SMA_PERIOD),
    ema: ema(closes, TREND_EMA_PERIOD),
    rsi: rsi(closes, RSI_PERIOD),
    macd: { line: macdResult.macd, signal: macdResult.signal },
    bollingerBands: bollingerBands(closes, BOLLINGER_PERIOD, BOLLINGER_MULTIPLIER)
  };
  const technicalSignals = generateTechnicalSignals(bundle)[latestIndex]?.signals ?? [];
  const technicalScore = scoreTechnicalSignals(technicalSignals);

  // quarterlyFundamentals: point-in-time {epsGrowth, netIncomeGrowth, roe}
  // from the latest filed quarter (src/fundamental/quarterly-inputs.js), or
  // null - then those signal slots stay empty exactly as before.
  const fundamentalSignals = isEtf ? [] : generateFundamentalSignals({
    epsGrowth: quarterlyFundamentals?.epsGrowth ?? null,
    netIncomeGrowth: quarterlyFundamentals?.netIncomeGrowth ?? null,
    roe: quarterlyFundamentals?.roe ?? null,
    revenueGrowth
  });
  const fundamentalScore = isEtf ? 0 : scoreFundamentalSignals(fundamentalSignals);

  // Chip layer (三大法人買賣超) - real data source wired 2026-09-23
  // (src/chips/institutional-trading-source.js). `institutionalFlow` is
  // an already-netted {foreignNet, investmentTrustNet, dealerNet} for
  // this symbol/date, or null when no real data exists for it (most
  // symbols on most days, or the caller simply didn't pass one) - never
  // a guessed/neutral flow. chipDataAvailable only becomes true when a
  // real signal was actually derived from it.
  // Reference only since 2026-09-27: chip weight is 0 (see
  // composite-score.js DEFAULT_WEIGHTS). The chip score and its signal
  // labels are still computed and returned for display, but never enter
  // compositeScore or matchedSignals ("觀察理由").
  const chipSignals = !isEtf && institutionalFlow ? generateChipSignals(institutionalFlow) : [];
  const chipScore = chipSignals.length > 0 ? scoreChipSignals(chipSignals) : null;
  const chipDataAvailable = chipScore != null;
  const weightsUsed = isEtf ? availableEtfWeights() : defaultWeights();
  const compositeScore = calculateCompositeScore(
    { fundamental: fundamentalScore, technical: technicalScore, chip: chipDataAvailable ? chipScore : 50 },
    weightsUsed
  );

  const { upper, lower } = donchianChannel(highs, lows, DONCHIAN_PERIOD);
  const atrForTargetSanity = atr(highs, lows, closes, ATR_PERIOD_FOR_TARGET_SANITY);
  const targetRangeResult = computeTargetRange({ records, donchianUpper: upper, donchianLower: lower, atrSeries: atrForTargetSanity, period: DONCHIAN_PERIOD });
  const targetPriceResult = mapTargetRangeToLegacyShape(targetRangeResult, { period: DONCHIAN_PERIOD });

  const latestClose = records[latestIndex].close;
  const { verdict, matchedSignals, counterEvidence } = buildRecommendation({
    compositeScore, fundamentalScore, technicalScore,
    technicalSignals, fundamentalSignals,
    targetPriceResult, latestClose,
    instrumentType: normalizedInstrumentType
  });

  const atrSeries = buildAtrSeries(records, ATR_PERIOD);
  const volatilityStatus = classifyVolatility(atrSeries);
  const volumeStatus = classifyVolume(records);
  const trendStatus = classifyTrend(latestClose, bundle.sma[latestIndex]);
  const momentumStatus = classifyMomentum(records);
  const horizonResult = classifyInvestmentHorizon({ volatilityStatus, volumeStatus, trend: trendStatus, momentum: momentumStatus, fundamentalSignals });
  const horizons = Object.fromEntries(Object.entries(horizonResult.horizons).map(([key, value]) => [key, {
    ...value,
    label: HORIZON_LABEL[key] ?? key,
    matchedConditionLabels: value.matchedConditions.map((c) => HORIZON_CONDITION_LABEL[c] ?? c),
    unmatchedConditionLabels: value.unmatchedConditions.map((c) => HORIZON_CONDITION_LABEL[c] ?? c)
  }]));

  const liquidity = computeAverageDailyLiquidity(records);
  const technicalIndicators = {
    asOf: records[latestIndex].tradingDate ?? null,
    close: latestClose,
    sma20: bundle.sma[latestIndex],
    ema20: bundle.ema[latestIndex],
    rsi14: bundle.rsi[latestIndex],
    macd: { line: macdResult.macd[latestIndex], signal: macdResult.signal[latestIndex], histogram: macdResult.histogram[latestIndex] },
    bollinger: { middle: bundle.bollingerBands.middle[latestIndex], upper: bundle.bollingerBands.upper[latestIndex], lower: bundle.bollingerBands.lower[latestIndex] },
    atr14: atrSeries.at(-1)?.value ?? null,
    averageVolume20: liquidity?.averageDailyVolume ?? null,
    statuses: { trend: trendStatus, momentum: momentumStatus, volatility: volatilityStatus, volume: volumeStatus }
  };

  return {
    verdict,
    verdictLabel: VERDICT_LABEL[verdict] ?? verdict,
    matchedSignalLabels: matchedSignals.map((signal) => SIGNAL_LABEL[signal] ?? signal),
    // Reference only for stocks since 2026-09-29 (weight 0), shown on the technical card.
    technicalSignalLabels: technicalSignals.map((signal) => SIGNAL_LABEL[signal] ?? signal),
    counterEvidence,
    targetPrice: targetPriceResult,
    sellReason: buildSellReason({ verdict, targetPrice: targetPriceResult, latestClose }),
    scores: { compositeScore, fundamentalScore: isEtf ? null : fundamentalScore, technicalScore, chipScore: chipDataAvailable ? chipScore : null },
    weightsUsed,
    instrumentType: normalizedInstrumentType,
    technicalIndicators,
    chipDataAvailable,
    // Reference-only chip signal labels (e.g. 外資買超) - kept out of
    // matchedSignalLabels because they carry no weight in the score.
    chipSignalLabels: chipSignals.map((signal) => SIGNAL_LABEL[signal] ?? signal),
    investmentHorizon: {
      evidenceStrength: horizonResult.evidenceStrength,
      evidenceStrengthLabel: EVIDENCE_STRENGTH_LABEL[horizonResult.evidenceStrength] ?? horizonResult.evidenceStrength,
      horizons
    },
    liquidity,
    expectedReturn: (() => {
      const result = computeExpectedReturn({ targetPriceResult, referenceRecord: records[latestIndex] });
      return { ...result, decisionStateLabel: DECISION_STATE_LABEL[result.decisionState] ?? result.decisionState };
    })(),
    disclaimer: isEtf
      ? 'ETF 評分僅使用已驗證技術訊號；股票專屬基本面與籌碼因子明確標示為不適用／不可用，不以推測值補齊。'
      : '目標價格與評分僅依據已驗證資料與固定規則計算，非 AI 生成的投資結論，不構成買賣訊號或投資建議。'
  };
}