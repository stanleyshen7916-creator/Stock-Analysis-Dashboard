// Analysis Workspace (Issue #84) - assembles a single traceable summary
// from data that is ALREADY verified and already rendered elsewhere on the
// page (Stock Detail, technical summary, fundamentals panel, corporate-
// action panel, data quality). It never fetches, computes, or infers
// anything new - only restates what is already on screen, organized into
// three explicitly separated tiers so a reader can tell what is observed
// from what is derived from what is a rule-based reading of it:
//
//   Fact          - directly observed values (a number/date the source
//                   actually reported).
//   Calculation   - a value computed by an already-verified formula
//                   (MA/RSI/MoM growth - see docs/CALCULATION_ENGINE.md).
//   Interpretation - a fixed-rule classification of the above (e.g. "RSI
//                   in the overbought range"). Never a buy/sell signal,
//                   never a composite score, never generated text - see
//                   buildTechnicalSummary() in technical-summary.js, which
//                   this reuses rather than re-deriving.
//
// No AI investment conclusion is produced here, per Issue #84's explicit
// scope boundary.

const EVENT_TYPE_LABEL = {
  cash_dividend: '現金股利', stock_dividend: '股票股利', rights_issue: '現金增資',
  capital_reduction: '減資', split: '股票分割', reverse_split: '反分割', other: '除權息'
};

function lastValue(series) {
  return series && series.length > 0 ? series[series.length - 1].value : null;
}

/**
 * @param {object} params
 * @param {object} params.summary - buildSummary() output for the current symbol.
 * @param {object} params.indicators - { records, ma5, ma20, rsi } for the current symbol/timeframe.
 * @param {object|null} params.technicalSummary - buildTechnicalSummary() output (already computed).
 * @param {Array|null} params.fundamentals - fetched fundamentals periods (see data-quality.js status convention).
 * @param {number|null} params.momGrowth - computeMomRevenueGrowth() output, if available.
 * @param {Array|null} params.corporateActions - fetched corporate-action events.
 * @param {object|null} params.dataQuality - buildDataQuality() output.
 * @returns {object|null} null when there is no summary to build from.
 */
export function buildAnalysisSummary({ summary, indicators, technicalSummary, fundamentals, momGrowth, corporateActions, dataQuality }) {
  if (!summary) return null;

  const facts = [];
  const calculations = [];
  const interpretation = [];

  facts.push(`${summary.symbol}（${summary.market}）最新交易日 ${summary.latestTradingDate}：收盤 ${summary.latestClose.toFixed(2)}，開盤 ${summary.latestOpen.toFixed(2)}，最高 ${summary.latestHigh.toFixed(2)}，最低 ${summary.latestLow.toFixed(2)}，成交量 ${summary.volume.toLocaleString('en-US')}`);
  if (summary.source) {
    facts.push(`資料來源：${summary.source}${summary.sourceTimestamp ? `（${summary.sourceTimestamp}）` : ''}`);
  }

  if (fundamentals && fundamentals.length > 0 && fundamentals[0].revenue != null) {
    const latest = fundamentals[0];
    facts.push(`最新月營收（${latest.reportingPeriod}）：${latest.revenue.toLocaleString('en-US')} 千元，資料來源：${latest.source}`);
    if (momGrowth !== null) {
      calculations.push(`月營收 MoM 成長率：${momGrowth >= 0 ? '+' : ''}${(momGrowth * 100).toFixed(2)}%`);
    }
  } else if (dataQuality && dataQuality.fundamentalsStatus === 'UNAVAILABLE') {
    facts.push('月營收資料：此股票代號目前無已驗證的月營收資料（非缺失，是尚未涵蓋）');
  } else if (dataQuality && dataQuality.fundamentalsStatus === 'UNKNOWN') {
    facts.push('月營收資料：讀取中或讀取失敗，暫無法確認');
  }

  if (corporateActions && corporateActions.length > 0) {
    for (const event of corporateActions) {
      facts.push(`公司行動：${event.effectiveDate} ${EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}${event.factor != null ? `，參考價比例 ${event.factor.toFixed(4)}` : ''}`);
    }
  } else if (dataQuality && dataQuality.corporateActionsStatus === 'UNAVAILABLE') {
    facts.push('公司行動事件：此股票代號目前無已驗證的公司行動事件（非缺失，是尚未涵蓋）');
  } else if (dataQuality && dataQuality.corporateActionsStatus === 'UNKNOWN') {
    facts.push('公司行動事件：讀取中或讀取失敗，暫無法確認');
  }

  if (indicators) {
    const ma5 = lastValue(indicators.ma5);
    const ma20 = lastValue(indicators.ma20);
    const rsiValue = lastValue(indicators.rsi);
    if (ma5 != null) calculations.push(`MA5：${ma5.toFixed(2)}`);
    if (ma20 != null) calculations.push(`MA20：${ma20.toFixed(2)}`);
    if (rsiValue != null) calculations.push(`RSI14：${rsiValue.toFixed(2)}`);
  }

  if (technicalSummary) {
    interpretation.push(technicalSummary.analysis);
  }

  if (dataQuality) {
    calculations.push(`資料完整性：共 ${dataQuality.recordCount} 筆日線資料，最新交易日 ${dataQuality.latestTradingDate}`);
    if (dataQuality.missingFields.length > 0) {
      interpretation.push(`資料品質提醒：缺少以下追溯欄位：${dataQuality.missingFields.join('、')}`);
    }
  }

  return {
    facts,
    calculations,
    interpretation,
    disclaimer: '本摘要僅整理現有已驗證資料與技術指標數值，非投資建議，不構成買賣訊號，亦非 AI 生成的投資結論。'
  };
}
