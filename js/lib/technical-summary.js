// Deterministic, rule-based technical summary built only from already-
// verified indicator series (MA5/MA20/RSI14, computed in chart-series.js)
// and the raw OHLCV records fetched from Supabase. No AI inference, no
// buy/sell recommendation.
//
// Data -> Indicator -> Signal -> Analysis:
//   Data:       records (verified market_daily rows)
//   Indicator:  ma5 / ma20 / rsi series (already computed elsewhere)
//   Signal:     the classify* functions below - fixed numeric thresholds
//   Analysis:   fixed Chinese template text assembled from the signals,
//               not generated or guessed - see docs/CALCULATION_ENGINE.md

const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;
const MOMENTUM_PERIOD = 5; // matches the project's existing MA_SHORT_PERIOD
const VOLUME_LOOKBACK = 20; // matches the project's existing MA_LONG_PERIOD
const VOLUME_ABOVE_RATIO = 1.2;
const VOLUME_BELOW_RATIO = 0.8;
const VOLATILITY_LOOKBACK = 20; // matches VOLUME_LOOKBACK
const VOLATILITY_EXPANDING_RATIO = 1.2; // matches VOLUME_ABOVE_RATIO
const VOLATILITY_CONTRACTING_RATIO = 0.8; // matches VOLUME_BELOW_RATIO

function lastValue(series) {
  return series && series.length > 0 ? series[series.length - 1].value : null;
}

export function classifyTrend(latestClose, latestMa20) {
  if (latestClose == null || latestMa20 == null) return 'UNKNOWN';
  if (latestClose > latestMa20) return 'UP';
  if (latestClose < latestMa20) return 'DOWN';
  return 'FLAT';
}

export function classifyMovingAverageRelationship(latestMa5, latestMa20) {
  if (latestMa5 == null || latestMa20 == null) return 'UNKNOWN';
  if (latestMa5 > latestMa20) return 'BULLISH';
  if (latestMa5 < latestMa20) return 'BEARISH';
  return 'NEUTRAL';
}

export function classifyRsi(latestRsi) {
  if (latestRsi == null) return 'UNKNOWN';
  if (latestRsi >= RSI_OVERBOUGHT) return 'OVERBOUGHT';
  if (latestRsi <= RSI_OVERSOLD) return 'OVERSOLD';
  return 'NEUTRAL';
}

export function classifyMomentum(records, period = MOMENTUM_PERIOD) {
  if (!records || records.length <= period) return 'UNKNOWN';
  const latest = records[records.length - 1].close;
  const past = records[records.length - 1 - period].close;
  if (past === 0) return 'UNKNOWN';
  const changePercent = ((latest - past) / past) * 100;
  if (changePercent > 0) return 'UP';
  if (changePercent < 0) return 'DOWN';
  return 'FLAT';
}

export function classifyVolume(records, lookback = VOLUME_LOOKBACK) {
  if (!records || records.length < lookback) return 'UNKNOWN';
  const window = records.slice(records.length - lookback);
  const latestVolume = records[records.length - 1].volume;
  const averageVolume = window.reduce((sum, r) => sum + r.volume, 0) / lookback;
  if (averageVolume === 0) return 'UNKNOWN';
  if (latestVolume >= averageVolume * VOLUME_ABOVE_RATIO) return 'ABOVE_AVERAGE';
  if (latestVolume <= averageVolume * VOLUME_BELOW_RATIO) return 'BELOW_AVERAGE';
  return 'AVERAGE';
}

// ATR isn't comparable in absolute terms across different-priced stocks (a
// $500 stock and a $10 stock have naturally different ATR magnitudes), so
// - unlike RSI's fixed 0-100 thresholds - volatility is classified against
// its OWN recent history, the same self-referential ratio pattern already
// established by classifyVolume above.
export function classifyVolatility(atr, lookback = VOLATILITY_LOOKBACK) {
  if (!atr || atr.length < lookback) return 'UNKNOWN';
  const window = atr.slice(atr.length - lookback);
  const latestAtr = atr[atr.length - 1].value;
  const averageAtr = window.reduce((sum, a) => sum + a.value, 0) / lookback;
  if (averageAtr === 0) return 'UNKNOWN';
  if (latestAtr >= averageAtr * VOLATILITY_EXPANDING_RATIO) return 'EXPANDING';
  if (latestAtr <= averageAtr * VOLATILITY_CONTRACTING_RATIO) return 'CONTRACTING';
  return 'STABLE';
}

const TREND_LABEL = {
  UP: '股價高於20日均線（偏多）',
  DOWN: '股價低於20日均線（偏空）',
  FLAT: '股價與20日均線相當',
  UNKNOWN: '資料不足，無法判斷趨勢'
};
const MA_RELATIONSHIP_LABEL = {
  BULLISH: 'MA5 高於 MA20（短期動能偏多）',
  BEARISH: 'MA5 低於 MA20（短期動能偏空）',
  NEUTRAL: 'MA5 與 MA20 相當',
  UNKNOWN: '資料不足，無法判斷均線排列'
};
const RSI_LABEL = {
  OVERBOUGHT: 'RSI14 達超買區間（≥70）',
  OVERSOLD: 'RSI14 達超賣區間（≤30）',
  NEUTRAL: 'RSI14 處於中性區間',
  UNKNOWN: '資料不足，無法判斷 RSI'
};
const MOMENTUM_LABEL = {
  UP: `近${MOMENTUM_PERIOD}日股價上漲`,
  DOWN: `近${MOMENTUM_PERIOD}日股價下跌`,
  FLAT: `近${MOMENTUM_PERIOD}日股價持平`,
  UNKNOWN: '資料不足，無法判斷動能'
};
const VOLUME_LABEL = {
  ABOVE_AVERAGE: `成交量高於${VOLUME_LOOKBACK}日均量`,
  BELOW_AVERAGE: `成交量低於${VOLUME_LOOKBACK}日均量`,
  AVERAGE: `成交量與${VOLUME_LOOKBACK}日均量相當`,
  UNKNOWN: '資料不足，無法判斷成交量狀態'
};
const VOLATILITY_LABEL = {
  EXPANDING: `波動度上升（ATR 高於${VOLATILITY_LOOKBACK}日均值）`,
  CONTRACTING: `波動度下降（ATR 低於${VOLATILITY_LOOKBACK}日均值）`,
  STABLE: `波動度與${VOLATILITY_LOOKBACK}日均值相當`,
  UNKNOWN: '資料不足，無法判斷波動度'
};

/**
 * Assembles the six required signals (trend, MA relationship, RSI status,
 * momentum, volume status, volatility status - v0.3.0 Issue #90) from
 * already-verified data/indicators, plus a fixed-template Chinese summary.
 * Returns null for an empty series, same convention as buildSummary() in
 * chart-series.js. `atr` is optional so existing callers that have not yet
 * been extended to pass it keep working (volatility -> UNKNOWN, matching
 * the insufficient-history convention).
 */
export function buildTechnicalSummary({ records, ma5, ma20, rsi, atr }) {
  if (!records || records.length === 0) return null;

  const latestClose = records[records.length - 1].close;
  const latestMa5 = lastValue(ma5);
  const latestMa20 = lastValue(ma20);
  const latestRsiValue = lastValue(rsi);

  const signals = {
    trend: classifyTrend(latestClose, latestMa20),
    maRelationship: classifyMovingAverageRelationship(latestMa5, latestMa20),
    rsiStatus: classifyRsi(latestRsiValue),
    momentum: classifyMomentum(records),
    volume: classifyVolume(records),
    volatility: classifyVolatility(atr)
  };

  const analysis = [
    TREND_LABEL[signals.trend],
    MA_RELATIONSHIP_LABEL[signals.maRelationship],
    RSI_LABEL[signals.rsiStatus],
    MOMENTUM_LABEL[signals.momentum],
    VOLUME_LABEL[signals.volume],
    VOLATILITY_LABEL[signals.volatility]
  ].join('；');

  return { signals, analysis };
}
