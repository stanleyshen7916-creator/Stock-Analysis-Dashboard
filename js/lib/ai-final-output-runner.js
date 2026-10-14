// AI Final Output orchestration (M8-12, Section 14, Issue #154; M8.X,
// Issue #159's follow-up spec Section 13), ported to run in the browser
// so the Dashboard can show the real 5-question research output
// directly. This is the SAME logic scripts/generate-ai-final-output.mjs
// already ran server-side - moved here so both the Node CLI script and
// the browser call one shared implementation (no second engine, no
// duplicated orchestration).
//
// Answers the 5 required questions from real, already-computed data
// only - never a fabricated narrative:
//   ① which stocks are investable (real decisionState === INVESTABLE_CANDIDATE)
//   ② why (real matchedSignalLabels per symbol, from the unmodified engine)
//   ③ a reasonable target price (real Target Price + its real calculation basis)
//   ④ which stocks are NOT recommended, with real triggered counter-evidence
//   ⑤ does the algorithm need adjustment - answered ONLY from real
//      runAlgorithmValidation() measurements, never a guess

import { fetchMarketTop50 } from './market-top50-source.js';
import { fetchMarketDailySince } from '../../vendor/calc/bulk-market-data-reader.js';
import { groupRecordsBySymbol } from '../../vendor/calc/universe.js';
import { buildStockRecommendation } from './recommendation-engine.js';
import { runAlgorithmValidation } from './algorithm-validation-runner.js';

// Real bug fix (M8.X, Issue #159's follow-up spec): buildStockRecommendation()
// needs history ENDING at calculationDate, not starting from it - Donchian/
// MACD/etc. all look BACKWARD from "today". The original script fetched
// market_daily with sinceDate=calculationDate (records ON/AFTER today
// only), which would return next to nothing against real Production and
// silently make every recommendation UNAVAILABLE. Matches
// compute-market-top50.mjs's own LOOKBACK_CALENDAR_DAYS - bumped from 60
// to 120 (2026-09-23) once the merged multi-candidate Target Range engine
// (src/analysis/target-range.js) showed 60 calendar days (~39-43 trading
// rows) silently starves its 60-trading-row Structural Resistance/
// Fibonacci candidates, degenerating back into a bare Donchian pass-
// through - see that file's own comment for the real 6669/緯穎 case this
// produced.
const LOOKBACK_CALENDAR_DAYS = 120;

// Target Price now comes from computeTargetRange()'s multi-candidate
// confluence engine (real Structural Resistance / Donchian Reference /
// Measured Move / Fibonacci Extension - see src/analysis/target-range.js),
// not a single hardcoded Donchian Channel source - this describes whichever
// real candidate(s) actually formed the zone TargetRangeLow came from,
// never a fixed label.
const TARGET_SOURCE_LABEL = {
  STRUCTURAL_RESISTANCE: '前波高點阻力',
  DONCHIAN_REFERENCE: 'Donchian Channel 參考高點',
  MEASURED_MOVE: 'Measured Move 型態投射',
  FIBONACCI_EXTENSION: 'Fibonacci 延伸（未經驗證，僅供參考）'
};
function describeTargetPriceBasis(targetRange) {
  const zone = targetRange?.confluenceZones?.[0];
  if (!zone) return '資料不足';
  const labels = [...new Set(zone.sourceTypes.map((type) => TARGET_SOURCE_LABEL[type] ?? type))];
  return labels.join('、');
}

function isoDateDaysBefore(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

// M8-12's algorithm-verdict answer (⑤) is a relative comparison, not an
// invented numeric threshold: does the algorithm's own top category
// (INVESTABLE_CANDIDATE) actually outperform BOTH categories it
// demoted, using the same real measurement runAlgorithmValidation()
// already produces? This is the most basic, defensible test of whether
// a ranking algorithm's own ranking means anything in real data.
function deriveAlgorithmVerdict(stockSelection) {
  if (!stockSelection) return { verdict: '資料不足，無法判斷', reason: 'market_top50 尚無可驗證的預測紀錄。' };
  const investable = stockSelection.INVESTABLE_CANDIDATE;
  const observation = stockSelection.OBSERVATION;
  const notQualified = stockSelection.NOT_QUALIFIED;
  if (investable.status !== 'AVAILABLE') {
    return { verdict: '資料不足，無法判斷', reason: `INVESTABLE_CANDIDATE 樣本數僅 ${investable.sampleSize}（需達 30 筆以上才具統計意義），尚不足以判斷演算法是否有效。` };
  }
  const observationOk = observation.status !== 'AVAILABLE' || investable.averageReturnPercent > observation.averageReturnPercent;
  const notQualifiedOk = notQualified.status !== 'AVAILABLE' || investable.averageReturnPercent > notQualified.averageReturnPercent;
  if (investable.averageReturnPercent <= (notQualified.status === 'AVAILABLE' ? notQualified.averageReturnPercent : -Infinity)) {
    return { verdict: '必須修正', reason: `真實資料顯示，演算法列為「可投資候選」的標的，平均後續報酬（${investable.averageReturnPercent.toFixed(2)}%）並未優於被列為「不符合條件」的標的（${notQualified.averageReturnPercent.toFixed(2)}%） - 排序邏輯與真實表現不符。` };
  }
  if (observationOk && notQualifiedOk) {
    return { verdict: '維持', reason: `真實資料顯示，「可投資候選」的平均後續報酬（${investable.averageReturnPercent.toFixed(2)}%）確實優於「觀察」與「不符合條件」兩類，演算法排序與真實表現一致。` };
  }
  return { verdict: '建議修正', reason: `真實資料顯示部分不一致：「可投資候選」未能同時優於「觀察」與「不符合條件」兩類的平均後續報酬，建議進一步檢視，但證據尚不足以判定「必須修正」。` };
}

/**
 * @param {object} params
 * @param {string} params.url - Supabase project URL.
 * @param {string} params.apiKey - anon/publishable key (never writes anything, never a service-role key).
 * @param {Function} [params.fetchImpl]
 */
export async function generateAiFinalOutput({ url, apiKey, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!apiKey) throw new Error('Supabase anon key is required');

  let calculationDate, rows;
  try {
    ({ calculationDate, rows } = await fetchMarketTop50({ url, anonKey: apiKey, fetchImpl }));
  } catch (err) {
    return { calculationDate: null, investable: [], notRecommended: [], algorithmVerdict: { verdict: '資料不足，無法判斷', reason: 'market_top50 尚不存在。' }, skipReason: err.message };
  }
  if (!calculationDate || rows.length === 0) {
    return { calculationDate: null, investable: [], notRecommended: [], algorithmVerdict: { verdict: '資料不足，無法判斷', reason: 'market_top50 尚無資料。' }, skipReason: null };
  }

  const available = rows.filter((r) => r.dataStatus === 'AVAILABLE');
  // Scoped to just this run's Top-50 symbols, not the whole market - same
  // fix and same reason as algorithm-validation-runner.js's neededSymbols
  // (see that file's comment): unscoped, a 60-day window still means
  // every symbol in the market, not just the ~50 this panel looks up.
  const neededSymbols = new Set(available.map((r) => r.symbol));
  const marketDailyRows = available.length > 0 ? await fetchMarketDailySince({ url, apiKey, sinceDate: isoDateDaysBefore(calculationDate, LOOKBACK_CALENDAR_DAYS), symbols: neededSymbols, fetchImpl }) : [];
  const recordsBySymbol = groupRecordsBySymbol(marketDailyRows);

  const withRecommendation = available.map((row) => {
    const records = recordsBySymbol.get(`${row.market}:${row.symbol}`) ?? [];
    const recommendation = records.length > 0 ? buildStockRecommendation(records, null) : null;
    return { row, recommendation };
  });

  const investable = withRecommendation
    .filter(({ row }) => row.decisionState === 'INVESTABLE_CANDIDATE')
    .map(({ row, recommendation }) => ({
      symbol: row.symbol, market: row.market,
      referencePrice: row.referencePrice, targetPrice: row.targetPrice, expectedReturnPercent: row.expectedReturnPercent,
      targetPriceCalculationBasis: recommendation?.targetPrice?.status === 'AVAILABLE' ? describeTargetPriceBasis(recommendation.targetPrice.targetRange) : '資料不足',
      matchedSignalLabels: recommendation?.matchedSignalLabels ?? []
    }));

  const notRecommended = withRecommendation
    .filter(({ row }) => row.decisionState !== 'INVESTABLE_CANDIDATE')
    .map(({ row, recommendation }) => ({
      symbol: row.symbol, market: row.market, decisionState: row.decisionState,
      triggeredConditions: recommendation?.counterEvidence ?? ['資料不足，無法列出實際觸發條件']
    }));

  const validation = await runAlgorithmValidation({ url, apiKey, fetchImpl });
  const algorithmVerdict = deriveAlgorithmVerdict(validation.stockSelection);

  return { calculationDate, investable, notRecommended, algorithmVerdict, skipReason: null };
}
