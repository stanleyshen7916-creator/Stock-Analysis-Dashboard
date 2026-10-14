// AI Second-Decision recommendation verdict + counter-evidence (Issue #124,
// MVP-1). Deterministic, rule-based - the same "AI = Signal -> Analysis,
// never a generative model" architecture already locked in by Issue #84
// (see docs/CALCULATION_ENGINE.md's Analysis Workspace section and
// public/js/lib/technical-summary.js's own header comment: "If AI-generated
// explanation is ever added, it may only consume already-verified signals
// as input... must never compute or alter a signal itself"). No LLM/AI SDK
// exists anywhere in this codebase; adding one would itself require a new
// secret (a Stop Condition). This module implements Stanley's "AI
// Cross-check / 反證" requirement entirely within the existing lock.

const FUNDAMENTAL_WEAK_THRESHOLD = 30;
const POSITIVE_THRESHOLD = 75;
const NEUTRAL_THRESHOLD = 55;

function classifyVerdict({ compositeScore, fundamentalScore, instrumentType }) {
  if (instrumentType === 'ETF') {
    if (compositeScore >= POSITIVE_THRESHOLD) return 'positive';
    if (compositeScore >= NEUTRAL_THRESHOLD) return 'neutral';
    return 'negative';
  }
  if (fundamentalScore < FUNDAMENTAL_WEAK_THRESHOLD) return 'fundamental_weak';
  if (compositeScore >= POSITIVE_THRESHOLD) return 'positive';
  if (compositeScore >= NEUTRAL_THRESHOLD) return 'neutral';
  return 'negative';
}

function buildCounterEvidence({ technicalSignals, fundamentalSignals, verdict, targetPriceResult, latestClose, instrumentType }) {
  const notes = [];

  if (technicalSignals.includes('rsi_overbought') && (verdict === 'positive' || verdict === 'neutral')) {
    notes.push('RSI 已達超買區間：若判斷偏多，需留意短線動能可能已過度延伸，存在拉回風險。');
  }
  if (technicalSignals.includes('rsi_oversold') && (verdict === 'negative' || verdict === 'fundamental_weak')) {
    notes.push('RSI 已達超賣區間：若判斷偏空，需留意短線可能出現技術性反彈。');
  }
  if (targetPriceResult?.status === 'AVAILABLE' && Number.isFinite(latestClose)) {
    if (latestClose >= targetPriceResult.targetPrice) notes.push(`現價（${latestClose}）已達或超過近 ${targetPriceResult.provenance.period} 日 Target Price（${targetPriceResult.targetPrice}）：追高需留意上檔壓力，短期進一步上漲空間可能有限。`);
    if (latestClose <= targetPriceResult.riskPrice) notes.push(`現價（${latestClose}）已跌破近 ${targetPriceResult.provenance.period} 日 Risk Price（${targetPriceResult.riskPrice}）：原有支撐已失守，原判斷可能需要重新檢視。`);
  }
  if (instrumentType === 'ETF') {
    notes.push('ETF 不套用股票專屬 EPS／淨利／ROE／月營收基本面因子；本次評分僅使用已驗證技術訊號，基本面權重明確排除。');
  } else if (fundamentalSignals.length === 0) {
    notes.push('目前無可用的基本面訊號（本期無月營收成長率，亦無已公布的季報 EPS／淨利／ROE）：本次評分的基本面因子僅為中性假設，信心度較低，可能因證據不足而低估或高估真實體質。');
  }
  if (instrumentType !== 'ETF') {
    notes.push('技術面僅供參考、不計入綜合評分（自 2026-09-29 起）：2016～2026 年權重校準回測顯示，技術面權重越高、綜合評分的預測力越弱；綜合評分改為完全依據基本面後，預測力約提升一倍。');
    notes.push('籌碼面（三大法人買賣超）僅供參考、不計入綜合評分：2016～2026 年回測（隔日進場）顯示單日買賣超對後續報酬無顯著預測力。');
  }
  if (notes.length === 0) notes.push('目前已驗證訊號未觸發既定反證規則，惟仍建議自行覆核基本面與籌碼面等本系統尚未涵蓋的構面。');
  return notes;
}

export function buildRecommendation({
  compositeScore, fundamentalScore, technicalScore,
  technicalSignals = [], fundamentalSignals = [],
  targetPriceResult = null, latestClose = null,
  instrumentType = 'STOCK'
}) {
  if (![compositeScore, fundamentalScore, technicalScore].every(Number.isFinite)) {
    throw new TypeError('compositeScore, fundamentalScore and technicalScore must be finite numbers');
  }
  const normalizedInstrumentType = String(instrumentType).toUpperCase();
  const verdict = classifyVerdict({ compositeScore, fundamentalScore, instrumentType: normalizedInstrumentType });
  // Chip signals are reference-only (weight 0), so never listed as a reason.
  // Only signals that count toward the score are reasons: for stocks the
  // fundamental layer (technical and chip are reference only since
  // 2026-09-29 / 2026-09-27); for ETFs the technical layer is the score.
  const matchedSignals = instrumentType === 'ETF' ? [...technicalSignals] : [...fundamentalSignals];
  const counterEvidence = buildCounterEvidence({ technicalSignals, fundamentalSignals, verdict, targetPriceResult, latestClose, instrumentType: normalizedInstrumentType });
  return { verdict, matchedSignals, counterEvidence };
}