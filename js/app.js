import { fetchSymbolDailySeries, computeLatestPriceChange } from './lib/supabase-market-data-source.js';
import { fetchLatestFundamentals, fetchCorporateActionEvents, fetchCorporateActionEventsBulk, buildCorporateActionEventsMap, computeMomRevenueGrowth, computeYoyRevenueGrowth } from './lib/supabase-fundamental-corporate-action-source.js';
import {
  buildCandlestickSeries,
  buildVolumeSeries,
  buildMovingAverageSeries,
  buildRsiSeries,
  buildBollingerBandsSeries,
  buildEmaSeries,
  buildMacdSeries,
  buildAtrSeries,
  buildStochasticSeries,
  buildObvSeries,
  buildSummary
} from './lib/chart-series.js';
import { getMarketStatus, getDataFreshness } from './lib/market-status.js';
import { aggregateTimeframe } from './lib/timeframe.js';
import { createWatchlist } from './lib/watchlist.js';
import { createPortfolio } from './lib/portfolio.js';
import { computeUnrealizedPnl, computeReturnPercent, computePortfolioWeights } from './lib/portfolio-metrics.js';
import { buildTechnicalSummary, classifyTrend, classifyRsi, classifyMovingAverageRelationship, classifyMomentum, classifyVolume } from './lib/technical-summary.js';
import { buildDataQuality } from './lib/data-quality.js';
import { buildAnalysisSummary } from './lib/analysis-workspace.js';
import { buildRiskAssessment } from './lib/risk-analysis.js';
import { buildStockRecommendation } from './lib/recommendation-engine.js';
import { fetchMarketTop50, fetchPreviousMarketTop50 } from './lib/market-top50-source.js';
import { fetchAiScoreRanking } from './lib/ai-score-ranking-source.js';
import { fetchEnhancedIndexAllocation, industryName } from './lib/enhanced-index-source.js';
import { fetchShadowPerformance } from './lib/shadow-performance-source.js';
import { judgeShadow, PREREGISTRATION } from '../vendor/calc/shadow-preregistration.js';
import { fetchCompanyDirectoryRows, buildCompanyNameLookup } from './lib/company-directory-source.js';
import { fetchMarketOverview, formatMarketOverviewCards } from './lib/market-overview-source.js';
import { computeOverviewChanges } from './lib/overview-changes.js';
import { computeHoldingSimulation, computeSellSimulation } from './lib/holding-simulation.js';
import { fetchMarketDailySince } from '../vendor/calc/bulk-market-data-reader.js';
import { groupRecordsBySymbol } from '../vendor/calc/universe.js';
import { ETF_PRIORITY_SYMBOLS } from '../vendor/calc/priority-universe.js';
import { computeEtfMetrics } from './lib/etf-metrics.js';
import { fetchLatestEtfNav, computeOfficialPremium } from './lib/etf-nav-source.js';
import { fetchLatestEtfHoldings } from './lib/etf-holdings-source.js';
import { createSimulationList, computeSimulationPerformance, evaluatePredictionOutcomes, sliceRecordsUpTo, classifySimulationOutcome, SIMULATION_OUTCOME } from './lib/simulation.js';
import { computeHoldingRiskFromRecords, RISK_STATE_LABEL } from './lib/holding-risk.js';
import { getAlgorithmConfiguration } from './lib/algorithm-config.js';
import { createAlgorithmVersionStore } from './lib/algorithm-version-store.js';
import { runAlgorithmValidation, SIGNAL_METADATA } from './lib/algorithm-validation-runner.js';
import { generateAiFinalOutput } from './lib/ai-final-output-runner.js';
import { runLongTermTrendAnalysis } from './lib/long-term-trend-runner.js';
import { runHistoricalDataStatus } from './lib/historical-data-status-runner.js';
import { computeYearlyReturns } from '../vendor/calc/long-term-metrics.js';
import { buildAdjustedRecommendationRecords } from '../vendor/calc/corporate-action-adjustment.js';
import { quarterlyFundamentalInputs } from '../vendor/calc/quarterly-inputs.js';
import { fetchRecentQuarterlyRows } from './lib/quarterly-financials-source.js';
import { fetchLatestInstitutionalFlow } from './lib/institutional-flow-source.js';
import { fetchRecentMaterialInformation } from './lib/material-information-source.js';
import { createDashboardChart, renderDashboardChart, setSeriesVisibility } from './chart-render.js';
import { summarizeSimRun, missedWeekdays, taipeiToday, buildReturnChart, buildLinesChart, mergeReturnSeries, symbolContributions, tradeActivity, portfolioComposition, predictionVsActual, predictionSummary, weekAndMonthReturns, sessionsBeatingBenchmark, recentTrades, pickHeadlineRuns } from './lib/ai-simulation-summary.js';

const SYMBOL_PATTERN = /^[0-9A-Za-z]{4,6}$/;
const MA_SHORT_PERIOD = 5;
const MA_LONG_PERIOD = 20;
const RSI_PERIOD = 14;

const el = {
  form: document.getElementById('search-form'),
  input: document.getElementById('symbol-input'),
  runtimeModeBadge: document.getElementById('runtime-mode-badge'),
  marketStatus: document.getElementById('market-status'),
  latestTradingDate: document.getElementById('latest-trading-date'),
  aiModeBadge: document.getElementById('ai-mode-badge'),
  loading: document.getElementById('state-loading'),
  empty: document.getElementById('state-empty'),
  error: document.getElementById('state-error'),
  stale: document.getElementById('state-stale'),
  summaryCard: document.getElementById('summary-card'),
  summarySymbol: document.getElementById('summary-symbol'),
  summaryName: document.getElementById('summary-name'),
  summaryMarket: document.getElementById('summary-market'),
  summaryClose: document.getElementById('summary-close'),
  summaryChange: document.getElementById('summary-change'),
  summaryVolume: document.getElementById('summary-volume'),
  summaryDate: document.getElementById('summary-date'),
  summaryOpen: document.getElementById('summary-open'),
  summaryHigh: document.getElementById('summary-high'),
  summaryLow: document.getElementById('summary-low'),
  summaryProvenance: document.getElementById('summary-provenance'),
  summarySource: document.getElementById('summary-source'),
  summaryFreshness: document.getElementById('summary-freshness'),
  summaryDataStatus: document.getElementById('summary-data-status'),
  summaryCalcStatus: document.getElementById('summary-calc-status'),
  summaryAnalysisStatus: document.getElementById('summary-analysis-status'),
  holdingPurchasePriceInput: document.getElementById('holding-purchase-price-input'),
  holdingSharesInput: document.getElementById('holding-shares-input'),
  holdingCurrentPriceInput: document.getElementById('holding-current-price-input'),
  holdingSimulationReset: document.getElementById('holding-simulation-reset'),
  holdingSimulationPrompt: document.getElementById('holding-simulation-prompt'),
  holdingSimulationError: document.getElementById('holding-simulation-error'),
  holdingSimulationResult: document.getElementById('holding-simulation-result'),
  holdingTotalInvested: document.getElementById('holding-total-invested'),
  holdingCurrentMarketValue: document.getElementById('holding-current-market-value'),
  holdingCurrentPnl: document.getElementById('holding-current-pnl'),
  holdingCurrentReturn: document.getElementById('holding-current-return'),
  sellSuggestionPanel: document.getElementById('sell-suggestion-panel'),
  sellSuggestionEmpty: document.getElementById('sell-suggestion-empty'),
  sellSuggestionBody: document.getElementById('sell-suggestion-body'),
  sellSuggestionPrice: document.getElementById('sell-suggestion-price'),
  sellSuggestionPrompt: document.getElementById('sell-suggestion-prompt'),
  sellSuggestionEstimate: document.getElementById('sell-suggestion-estimate'),
  sellSuggestionReturn: document.getElementById('sell-suggestion-return'),
  sellSuggestionPnl: document.getElementById('sell-suggestion-pnl'),
  sellSuggestionStrategy: document.getElementById('sell-suggestion-strategy'),
  sellSuggestionExplanation: document.getElementById('sell-suggestion-explanation'),
  chartSection: document.getElementById('chart-section'),
  priceChartContainer: document.getElementById('price-chart'),
  indicatorNote: document.getElementById('indicator-note'),
  watchlist: document.getElementById('watchlist'),
  watchlistToggle: document.getElementById('watchlist-toggle'),
  watchlistHint: document.getElementById('watchlist-hint'),
  portfolioForm: document.getElementById('portfolio-form'),
  portfolioSymbolInput: document.getElementById('portfolio-symbol-input'),
  portfolioSharesInput: document.getElementById('portfolio-shares-input'),
  portfolioAmountInput: document.getElementById('portfolio-amount-input'),
  portfolioDateInput: document.getElementById('portfolio-date-input'),
  portfolioError: document.getElementById('portfolio-error'),
  portfolioList: document.getElementById('portfolio-list'),
  comparisonForm: document.getElementById('comparison-form'),
  comparisonSymbolInput: document.getElementById('comparison-symbol-input'),
  comparisonError: document.getElementById('comparison-error'),
  comparisonList: document.getElementById('comparison-list'),
  screeningForm: document.getElementById('screening-form'),
  screeningCriterionSelect: document.getElementById('screening-criterion-select'),
  screeningNote: document.getElementById('screening-note'),
  screeningList: document.getElementById('screening-list'),
  indicatorToggles: document.querySelectorAll('[data-indicator]'),
  technicalSummary: document.getElementById('technical-summary'),
  technicalSummaryText: document.getElementById('technical-summary-text'),
  fundamentalPanel: document.getElementById('fundamental-panel'),
  fundamentalPeriod: document.getElementById('fundamental-period'),
  fundamentalRevenue: document.getElementById('fundamental-revenue'),
  fundamentalMom: document.getElementById('fundamental-mom'),
  fundamentalYoy: document.getElementById('fundamental-yoy'),
  fundamentalTrend: document.getElementById('fundamental-trend'),
  fundamentalSource: document.getElementById('fundamental-source'),
  corporateActionPanel: document.getElementById('corporate-action-panel'),
  corporateActionList: document.getElementById('corporate-action-list'),
  materialInformationPanel: document.getElementById('material-information-panel'),
  materialInformationEmpty: document.getElementById('material-information-empty'),
  materialInformationList: document.getElementById('material-information-list'),
  riskPanel: document.getElementById('risk-panel'),
  riskVolatility: document.getElementById('risk-volatility'),
  riskDrawdown: document.getElementById('risk-drawdown'),
  riskVolumeAnomaly: document.getElementById('risk-volume-anomaly'),
  riskDataQuality: document.getElementById('risk-data-quality'),
  riskCorporateAction: document.getElementById('risk-corporate-action'),
  analysisWorkspace: document.getElementById('analysis-workspace'),
  analysisTrigger: document.getElementById('analysis-trigger'),
  analysisResult: document.getElementById('analysis-result'),
  analysisFacts: document.getElementById('analysis-facts'),
  analysisCalculations: document.getElementById('analysis-calculations'),
  analysisInterpretation: document.getElementById('analysis-interpretation'),
  analysisDisclaimer: document.getElementById('analysis-disclaimer'),
  recommendationPanel: document.getElementById('recommendation-panel'),
  recommendationResult: document.getElementById('recommendation-result'),
  recommendationTargetPrice: document.getElementById('recommendation-target-price'),
  recommendationVerdict: document.getElementById('recommendation-verdict'),
  recommendationMatchedSignals: document.getElementById('recommendation-matched-signals'),
  recommendationCounterEvidence: document.getElementById('recommendation-counter-evidence'),
  recommendationDisclaimer: document.getElementById('recommendation-disclaimer'),
  horizonEvidenceStrength: document.getElementById('horizon-evidence-strength'),
  horizonList: document.getElementById('horizon-list'),
  horizonLiquidity: document.getElementById('horizon-liquidity'),
  expectedReturnDecisionState: document.getElementById('expected-return-decision-state'),
  expectedReturnDetail: document.getElementById('expected-return-detail'),
  marketTop50Meta: document.getElementById('market-top50-meta'),
  marketTop50Error: document.getElementById('market-top50-error'),
  marketTop50Empty: document.getElementById('market-top50-empty'),
  marketTop50TableWrap: document.getElementById('market-top50-table-wrap'),
  marketTop50Tbody: document.getElementById('market-top50-tbody'),
  simulationForm: document.getElementById('simulation-form'),
  simulationSymbolInput: document.getElementById('simulation-symbol-input'),
  simulationObservationDateInput: document.getElementById('simulation-observation-date-input'),
  simulationPurchaseDateInput: document.getElementById('simulation-purchase-date-input'),
  simulationAmountInput: document.getElementById('simulation-amount-input'),
  simulationSharesInput: document.getElementById('simulation-shares-input'),
  simulationNoteInput: document.getElementById('simulation-note-input'),
  simulationError: document.getElementById('simulation-error'),
  simulationList: document.getElementById('simulation-list'),
  algorithmConfigTbody: document.getElementById('algorithm-config-tbody'),
  algorithmVersionForm: document.getElementById('algorithm-version-form'),
  algorithmVersionChangeInput: document.getElementById('algorithm-version-change-input'),
  algorithmVersionReasonInput: document.getElementById('algorithm-version-reason-input'),
  algorithmVersionTypeSelect: document.getElementById('algorithm-version-type-select'),
  algorithmVersionThresholdNewInput: document.getElementById('algorithm-version-threshold-new-input'),
  algorithmVersionWeightFields: document.getElementById('algorithm-version-weight-fields'),
  algorithmVersionWeightFundamentalInput: document.getElementById('algorithm-version-weight-fundamental-input'),
  algorithmVersionWeightTechnicalInput: document.getElementById('algorithm-version-weight-technical-input'),
  algorithmVersionWeightChipInput: document.getElementById('algorithm-version-weight-chip-input'),
  algorithmVersionChangedByInput: document.getElementById('algorithm-version-changed-by-input'),
  algorithmVersionError: document.getElementById('algorithm-version-error'),
  algorithmVersionList: document.getElementById('algorithm-version-list'),
  algorithmValidationLoading: document.getElementById('algorithm-validation-loading'),
  algorithmValidationEmpty: document.getElementById('algorithm-validation-empty'),
  algorithmValidationError: document.getElementById('algorithm-validation-error'),
  algorithmValidationBody: document.getElementById('algorithm-validation-body'),
  algorithmValidationSummary: document.getElementById('algorithm-validation-summary'),
  algorithmValidationIndicatorTbody: document.getElementById('algorithm-validation-indicator-tbody'),
  algorithmValidationHorizonTbody: document.getElementById('algorithm-validation-horizon-tbody'),
  aiFinalOutputLoading: document.getElementById('ai-final-output-loading'),
  aiFinalOutputEmpty: document.getElementById('ai-final-output-empty'),
  aiFinalOutputError: document.getElementById('ai-final-output-error'),
  aiFinalOutputBody: document.getElementById('ai-final-output-body'),
  aiFinalOutputInvestable: document.getElementById('ai-final-output-investable'),
  aiFinalOutputNotRecommended: document.getElementById('ai-final-output-not-recommended'),
  aiFinalOutputVerdict: document.getElementById('ai-final-output-verdict'),
  longTermTrendPanel: document.getElementById('long-term-trend-panel'),
  longTermTrendLoading: document.getElementById('long-term-trend-loading'),
  longTermTrendEmpty: document.getElementById('long-term-trend-empty'),
  longTermTrendError: document.getElementById('long-term-trend-error'),
  longTermTrendBody: document.getElementById('long-term-trend-body'),
  longTermTrendSummary: document.getElementById('long-term-trend-summary'),
  longTermTrendMetricsTbody: document.getElementById('long-term-trend-metrics-tbody'),
  longTermTrendYearlyList: document.getElementById('long-term-trend-yearly-list'),
  historicalDataStatusLoading: document.getElementById('historical-data-status-loading'),
  historicalDataStatusError: document.getElementById('historical-data-status-error'),
  historicalDataStatusBody: document.getElementById('historical-data-status-body'),
  historicalDataStatusUpdated: document.getElementById('historical-data-status-updated'),
  // Redesign (2026-09-18): sidebar shell + Overview/Stock Detail pages.
  sidebarNav: document.getElementById('sidebar-nav'),
  pageOverview: document.getElementById('page-overview'),
  pageDashboard: document.getElementById('page-dashboard'),
  pagePortfolio: document.getElementById('page-portfolio'),
  pagePerformance: document.getElementById('page-performance'),
  pageStock: document.getElementById('page-stock'),
  pageChanges: document.getElementById('page-changes'),
  pageLegacy: document.getElementById('page-legacy'),
  pageMarket: document.getElementById('page-market'),
  pageResearch: document.getElementById('page-research'),
  pageEtf: document.getElementById('page-etf'),
  etfLoading: document.getElementById('etf-loading'),
  etfError: document.getElementById('etf-error'),
  etfBody: document.getElementById('etf-body'),
  etfSummary: document.getElementById('etf-summary'),
  etfTbody: document.getElementById('etf-tbody'),
  overviewLoading: document.getElementById('overview-loading'),
  overviewEmpty: document.getElementById('overview-empty'),
  overviewError: document.getElementById('overview-error'),
  overviewBody: document.getElementById('overview-body'),
  overviewKpiGrid: document.getElementById('overview-kpi-grid'),
  overviewChangesLoading: document.getElementById('overview-changes-loading'),
  overviewChangesEmpty: document.getElementById('overview-changes-empty'),
  overviewChangesBody: document.getElementById('overview-changes-body'),
  overviewChangesSummary: document.getElementById('overview-changes-summary'),
  overviewChangesTbody: document.getElementById('overview-changes-tbody'),
  overviewChangesNew: document.getElementById('overview-changes-new'),
  overviewChangesUpgraded: document.getElementById('overview-changes-upgraded'),
  overviewChangesDowngraded: document.getElementById('overview-changes-downgraded'),
  overviewChangesRemoved: document.getElementById('overview-changes-removed'),
  overviewHorizonGrid: document.getElementById('overview-horizon-grid'),
  overviewTop10Filters: document.getElementById('overview-top10-filters'),
  overviewTop10Tbody: document.getElementById('overview-top10-tbody'),
  overviewMarketIndex: document.getElementById('overview-market-index'),
  overviewMarketTurnover: document.getElementById('overview-market-turnover'),
  overviewMarketInstitutional: document.getElementById('overview-market-institutional'),
  overviewMarketMargin: document.getElementById('overview-market-margin'),
  overviewMarketShort: document.getElementById('overview-market-short'),
  overviewAiScoreLoading: document.getElementById('overview-ai-score-loading'),
  overviewAiScoreTieNote: document.getElementById('overview-ai-score-tie-note'),
  enhancedIndexLoading: document.getElementById('enhanced-index-loading'),
  enhancedIndexEmpty: document.getElementById('enhanced-index-empty'),
  enhancedIndexBody: document.getElementById('enhanced-index-body'),
  enhancedIndexSummary: document.getElementById('enhanced-index-summary'),
  decisionRecommendTbody: document.getElementById('decision-recommend-tbody'),
  decisionRecommendCount: document.getElementById('decision-recommend-count'),
  decisionRecommendSub: document.getElementById('decision-recommend-sub'),
  decisionWatchCount: document.getElementById('decision-watch-count'),
  decisionWatchSub: document.getElementById('decision-watch-sub'),
  decisionOverlapCount: document.getElementById('decision-overlap-count'),
  decisionOverlapSub: document.getElementById('decision-overlap-sub'),
  enhancedIndexTbody: document.getElementById('enhanced-index-tbody'),
  overviewAiScoreEmpty: document.getElementById('overview-ai-score-empty'),
  overviewAiScoreBody: document.getElementById('overview-ai-score-body'),
  overviewAiScoreTbody: document.getElementById('overview-ai-score-tbody'),
  scoreGaugeLoading: document.getElementById('score-gauge-loading'),
  scoreGaugeEmpty: document.getElementById('score-gauge-empty'),
  scoreGaugeTotal: document.getElementById('score-gauge-total'),
  scoreGaugeBody: document.getElementById('score-gauge-body')
};

// Redesign (2026-09-18): minimal client-side page switch, same `hidden`-
// toggling idiom already used for state banners elsewhere in this file -
// no new pattern, no router/history library. #page-legacy holds every
// pre-redesign panel unchanged; #page-overview/#page-stock are new.
const PAGE_CONTAINERS = { dashboard: el.pageDashboard, portfolio: el.pagePortfolio, performance: el.pagePerformance, overview: el.pageOverview, stock: el.pageStock, changes: el.pageChanges, legacy: el.pageLegacy, market: el.pageMarket, research: el.pageResearch, etf: el.pageEtf };

function switchPage(pageId) {
  if (pageId === 'etf') renderEtfPageOnce();
  for (const [id, container] of Object.entries(PAGE_CONTAINERS)) {
    container.hidden = id !== pageId;
  }
  for (const item of el.sidebarNav.querySelectorAll('.sidebar-nav__item')) {
    item.classList.toggle('sidebar-nav__item--active', item.dataset.navPage === pageId);
  }
}

for (const button of el.sidebarNav.querySelectorAll('[data-nav-target]')) {
  button.addEventListener('click', () => switchPage(button.dataset.navTarget));
}

// Overview "明細說明" links - same switchPage as the sidebar, plus scroll to top.
for (const button of document.querySelectorAll('[data-goto-page]')) {
  button.addEventListener('click', () => {
    switchPage(button.dataset.gotoPage);
    window.scrollTo(0, 0);
  });
}

// Stage C (C11): additive runtime-mode indicator only - reads what
// config.js already resolved (?runtime=local|cloud, defaulting to cloud),
// never decides the mode itself. Cloud stays visually neutral (matches the
// existing badge--unknown look); Local gets its own accent color so it's
// unmistakable which data source is live.
function renderRuntimeModeBadge() {
  const mode = (window.APP_CONFIG || {}).RUNTIME_MODE || 'cloud';
  el.runtimeModeBadge.textContent = `環境：${mode === 'local' ? 'LOCAL（本機）' : 'CLOUD（雲端）'}`;
  el.runtimeModeBadge.className = `badge ${mode === 'local' ? 'badge--open' : 'badge--unknown'}`;
}
renderRuntimeModeBadge();

// Stage E (E02): the Daily Agent's AI analysis step now records which mode
// actually ran (`run-local-ai-analysis.mjs`, market_data_import_runs,
// dataset='ai_analysis') so the Dashboard can show the truth instead of
// implying AI success. Cloud mode never has this table populated - that's
// UNAVAILABLE, not an error. Local mode before the first Agent run is the
// same honest UNAVAILABLE, never a guessed/optimistic default.
async function renderAiModeBadge() {
  const config = window.APP_CONFIG || {};
  const setBadge = (label, cls) => {
    el.aiModeBadge.textContent = `AI：${label}`;
    el.aiModeBadge.className = `badge ${cls}`;
  };
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  // market_data_import_runs is local-runtime-only (migration 017) - Cloud
  // never has it, and querying it there always 401s (confirmed 2026-09-19).
  // Skip the guaranteed-failing request rather than generate console noise
  // just to arrive at the same honest UNAVAILABLE result.
  if (config.RUNTIME_MODE !== 'local') { setBadge('UNAVAILABLE', 'badge--unknown'); return; }
  try {
    const params = 'dataset=eq.ai_analysis&select=status,data_date,finished_at&order=data_date.desc,finished_at.desc&limit=1';
    const response = await fetch(`${config.SUPABASE_URL}/rest/v1/market_data_import_runs?${params}`, {
      headers: { apikey: config.SUPABASE_ANON_KEY, Authorization: `Bearer ${config.SUPABASE_ANON_KEY}` }
    });
    if (!response.ok) { setBadge('UNAVAILABLE', 'badge--unknown'); return; }
    const rows = await response.json();
    const latest = rows[0];
    if (!latest) { setBadge('UNAVAILABLE', 'badge--unknown'); return; }
    if (latest.status === 'LOCAL_MODEL') setBadge('LOCAL MODEL', 'badge--open');
    else if (latest.status === 'FALLBACK') setBadge('FALLBACK', 'badge--closed');
    else setBadge('UNAVAILABLE', 'badge--unknown');
  } catch {
    setBadge('UNAVAILABLE', 'badge--unknown');
  }
}
renderAiModeBadge();

let chartHandles = null;
let currentSymbol = null;
let currentRecords = [];
let timeframe = 'D';
// Latest computed indicator series for the currently-loaded symbol/timeframe
// - reused by the Analysis Workspace so it never recomputes anything, only
// reads values that are already on screen.
let latestIndicators = null;
// Latest fundamentals/corporate-action fetch results for the currently-
// loaded symbol - null while loading/unavailable, [] when confirmed empty.
// Reused by the Analysis Workspace for the same reason.
let latestFundamentals = null;
let latestCorporateActions = null;
// Latest 三大法人 net flow for the loaded symbol ({ tradingDate, flow }) -
// null while loading, on failure, or when the symbol has no row.
let latestInstitutionalFlow = null;
// Point-in-time quarterly EPS / net income / ROE inputs (m4-v4) for the
// current symbol, or null (not loaded, no filed quarter, or fetch failed -
// then those fundamental signals stay empty, never guessed).
let latestQuarterlyInputs = null;
// Recent 重大訊息 rows for the loaded symbol - null while loading/failed,
// [] when confirmed none. Display-only (消息面 is never scored).
let latestMaterialInformation = null;
// Latest buildStockRecommendation() output for the currently-loaded
// symbol - reused by the Holding Simulation panel's "AI 建議售出價格" so
// it reads the SAME already-computed Target Price rather than triggering
// a second computation. null while loading/unavailable.
let latestRecommendation = null;
// Some environments (private browsing, storage disabled by policy) throw on
// merely accessing window.localStorage, not just on getItem/setItem - guard
// the access itself so an unavailable watchlist store degrades to
// in-memory-only (v0.4.0, Issue #96) rather than blocking the whole page.
function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
// Full-market symbol -> name cache (2026-09-23 "名稱" audit) - populated
// once at boot from the `companies` table (public/js/lib/company-
// directory-source.js), covers every searchable/watchable symbol, not
// just Market Top 50 members. Starts empty (never null) so every lookup
// site can call getCachedCompanyName() unconditionally; each already
// falls back to showing the bare symbol/"—" until the cache resolves.
let companyNameCache = new Map();

function getCachedCompanyName(symbol, market) {
  if (!symbol) return null;
  const upper = String(symbol).toUpperCase();
  if (market) {
    const byMarket = companyNameCache.get(`${market}:${upper}`);
    if (byMarket) return byMarket;
  }
  return companyNameCache.get(upper) ?? null;
}

async function loadCompanyNameCache() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  try {
    const rows = await fetchCompanyDirectoryRows({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    companyNameCache = buildCompanyNameLookup(rows);
  } catch {
    // Every consumer already falls back to showing the bare symbol/"—" -
    // a failed/unavailable directory must never block the rest of the app.
    return;
  }
  // Re-paint anything already rendered with a symbol-only placeholder now
  // that names are available, without re-fetching any of its own data.
  if (currentSymbol) el.summaryName.textContent = getCachedCompanyName(currentSymbol) ?? '';
  renderWatchlist();
  renderComparisonList();
  renderPortfolio();
  renderSimulationList();
}

const watchlist = createWatchlist([], { storage: getBrowserStorage() });
const portfolio = createPortfolio([], { storage: getBrowserStorage() });
const simulationList = createSimulationList([], { storage: getBrowserStorage() });
const algorithmVersionStore = createAlgorithmVersionStore([], { storage: getBrowserStorage() });
// MA/RSI/Volume are visible by default (the locked, already-shipped view).
// Bollinger Bands/MACD/ATR/Stochastic/OBV (Issue #84) and EMA20 (Issue #94)
// default to hidden - available on request without changing what a
// first-time visitor sees.
const indicatorVisibility = { ma5: true, ma20: true, rsi: true, volume: true, bb: false, ema: false, macd: false, atr: false, stoch: false, obv: false };

function setState({ loading = false, empty = false, error = null, stale = false, showResults = false }) {
  el.loading.hidden = !loading;
  el.empty.hidden = !empty;
  el.stale.hidden = !stale;
  el.error.hidden = !error;
  if (error) el.error.textContent = error;
  el.summaryCard.hidden = !showResults;
  el.chartSection.hidden = !showResults;
  el.technicalSummary.hidden = !showResults;
  el.analysisWorkspace.hidden = !showResults;
  el.recommendationPanel.hidden = !showResults;
  if (!showResults) {
    el.fundamentalPanel.hidden = true;
    el.corporateActionPanel.hidden = true;
    el.riskPanel.hidden = true;
    // A prior symbol's analysis result must never linger once results are
    // hidden (loading a new symbol, or an error/empty state) - the next
    // "開始分析" click always rebuilds it from the newly-loaded symbol only.
    el.analysisResult.hidden = true;
    el.recommendationResult.hidden = true;
    // Stage D bug found and fixed 2026-09-19: score-gauge-body/-total (the
    // "AI 綜合評分" card added in this week's redesign) were never reset
    // here like recommendationResult above - a prior symbol's score/
    // dimension cards stayed visible, unlabeled as stale, until the new
    // symbol's renderRecommendationForCurrentSymbol() finished (now
    // auto-triggered, so this became visible in normal use rather than
    // only under a manual-click timing that happened to mostly hide it).
    // Confirmed via Playwright: searching 2330→0050→0056→00981A in
    // sequence showed each symbol's PREVIOUS one's score before this fix.
    //
    // Stage E (E01): explicit Loading/Ready/Empty state machine for this
    // card, matching every other auto-rendered panel's contract instead of
    // silently blank-until-populated. Reset to Loading here; renderScore-
    // Dimensions moves it to Ready, and the no-recommendation branch in
    // renderRecommendationForCurrentSymbol moves it to Empty.
    el.scoreGaugeTotal.textContent = '';
    el.scoreGaugeBody.replaceChildren();
    el.scoreGaugeLoading.hidden = false;
    el.scoreGaugeEmpty.hidden = true;
    el.scoreGaugeTotal.hidden = true;
    el.scoreGaugeBody.hidden = true;
    // Same staleness bug class as scoreGaugeBody above, for the "AI 建議
    // 售出價格" panel added this round: without this reset, a new
    // symbol's still-loading recommendation would leave the PREVIOUS
    // symbol's Target Price/strategy visible and unlabeled as stale until
    // the new one finishes computing.
    latestRecommendation = null;
    renderSellSuggestion();
  }
}

// This is a session-hours heuristic (Asia/Taipei, Mon-Fri 09:00-13:30), not
// an authoritative trading-day status - it does not consult the
// trading_calendar table, so market holidays are not accounted for. Labeled
// as an estimate in the UI for that reason.
function updateMarketStatusBadge() {
  const status = getMarketStatus(new Date());
  el.marketStatus.textContent = status === 'OPEN' ? '市場狀態（估算）：盤中' : '市場狀態（估算）：休市';
  el.marketStatus.title = '依台北時間交易時段（週一至週五 09:00-13:30）估算，未考慮國定假日等休市日。';
  el.marketStatus.className = `badge ${status === 'OPEN' ? 'badge--open' : 'badge--closed'}`;
}

const FRESHNESS_LABEL = { FRESH: '資料為近期', STALE: '資料可能過期', UNKNOWN: '' };

function renderSummary(summary, freshness) {
  el.summarySymbol.textContent = summary.symbol;
  el.summaryName.textContent = getCachedCompanyName(summary.symbol, summary.market) ?? '';
  el.summaryMarket.textContent = summary.market;
  el.summaryClose.textContent = summary.latestClose.toFixed(2);
  const sign = summary.change > 0 ? '+' : '';
  el.summaryChange.textContent = `${sign}${summary.change.toFixed(2)} (${sign}${summary.changePercent.toFixed(2)}%)`;
  el.summaryChange.className = `summary-card__change ${summary.change >= 0 ? 'summary-card__change--up' : 'summary-card__change--down'}`;
  el.summaryVolume.textContent = summary.volume.toLocaleString('en-US');
  el.summaryDate.textContent = summary.latestTradingDate;
  el.summaryOpen.textContent = summary.latestOpen.toFixed(2);
  el.summaryHigh.textContent = summary.latestHigh.toFixed(2);
  el.summaryLow.textContent = summary.latestLow.toFixed(2);
  el.latestTradingDate.textContent = `最新交易日：${summary.latestTradingDate}`;
  el.watchlistToggle.textContent = watchlist.has(summary.symbol) ? '移除自選' : '加入自選';
  updateWatchlistCurrent();

  // Holding Simulation panel: a new symbol always starts from a clean
  // slate (never carries over a previous symbol's purchase price/shares/
  // stale P&L) - 目前股價 pre-fills with this symbol's real current
  // close, editable for simulation per Section 3's "預設值＝系統目前股
  // 價，可編輯，修改只作用於本次模擬".
  el.holdingPurchasePriceInput.value = '';
  el.holdingSharesInput.value = '';
  el.holdingCurrentPriceInput.value = summary.latestClose;
  renderHoldingSimulation();

  // Data source/provenance is only shown when the source actually reported
  // it - never fabricated when a field is missing.
  const hasSource = Boolean(summary.source);
  el.summaryProvenance.hidden = !hasSource;
  if (hasSource) {
    el.summarySource.textContent = `資料來源：${summary.source}`;
    const label = FRESHNESS_LABEL[freshness] ?? '';
    el.summaryFreshness.textContent = label;
    el.summaryFreshness.hidden = !label;
  }

  // Stage E (E05, Traceability UI): renderSummary only ever runs once
  // loadSymbol() already confirmed real OHLC rows exist for this symbol,
  // so Data Status is honestly AVAILABLE here - a truly missing symbol
  // shows #state-empty instead and never reaches this function. Calculation
  // Status and Analysis Status reset to their honest "not yet" state on
  // every new symbol - each is set to its real outcome by the function that
  // actually computes it (runRecommendation / runAnalysis below).
  el.summaryDataStatus.textContent = `資料狀態：可用（AVAILABLE）${freshness === 'STALE' ? '，可能過期' : ''}`;
  el.summaryCalcStatus.textContent = '計算狀態：計算中…';
  el.summaryAnalysisStatus.textContent = '分析狀態：尚未執行';
}

function renderIndicatorNote({ ma5, ma20, rsi }) {
  const missing = [];
  if (ma5.length === 0) missing.push(`MA${MA_SHORT_PERIOD}`);
  if (ma20.length === 0) missing.push(`MA${MA_LONG_PERIOD}`);
  if (rsi.length === 0) missing.push('RSI');
  el.indicatorNote.hidden = missing.length === 0;
  if (missing.length > 0) {
    el.indicatorNote.textContent = `資料筆數不足，暫不顯示部分技術指標：${missing.join('、')}`;
  }
}

// Verified Data -> Verified Indicator -> Verified Signal -> Analysis. The
// analysis text is assembled by buildTechnicalSummary() from fixed rules
// and templates, not generated - see public/js/lib/technical-summary.js.
function renderTechnicalSummary({ records, ma5, ma20, rsi, atr }) {
  const summary = buildTechnicalSummary({ records, ma5, ma20, rsi, atr });
  el.technicalSummaryText.textContent = summary ? summary.analysis : '';
}

const EVENT_TYPE_LABEL = {
  cash_dividend: '現金股利', stock_dividend: '股票股利', rights_issue: '現金增資',
  capital_reduction: '減資', split: '股票分割', reverse_split: '反分割', other: '除權息'
};

// Latest monthly revenue only - not all symbols have MOPS-sourced data yet
// (only TWSE-listed "sii" companies - see docs/FUNDAMENTAL_ANALYSIS.md).
// MoM/YoY growth and the Revenue Trend list (v0.3.0, Issue #92) only render
// as much as this project has actually ingested for this symbol - never
// padded with fabricated periods.
function renderFundamentalPanel(periods) {
  if (!periods.length || periods[0].revenue == null) {
    el.fundamentalPanel.hidden = true;
    return;
  }
  const [latest] = periods;
  el.fundamentalPanel.hidden = false;
  el.fundamentalPeriod.textContent = `${latest.reportingPeriod} 月營收`;
  el.fundamentalRevenue.textContent = `${latest.revenue.toLocaleString('en-US')} 千元`;

  const mom = computeMomRevenueGrowth(periods);
  el.fundamentalMom.hidden = mom === null;
  if (mom !== null) {
    const sign = mom > 0 ? '+' : '';
    el.fundamentalMom.textContent = `較上月：${sign}${(mom * 100).toFixed(2)}%`;
    el.fundamentalMom.className = `side-panel__note ${mom >= 0 ? 'side-panel__note--up' : 'side-panel__note--down'}`;
  }

  const yoy = computeYoyRevenueGrowth(periods);
  el.fundamentalYoy.hidden = yoy === null;
  if (yoy !== null) {
    const sign = yoy > 0 ? '+' : '';
    el.fundamentalYoy.textContent = `較去年同月：${sign}${(yoy * 100).toFixed(2)}%`;
    el.fundamentalYoy.className = `side-panel__note ${yoy >= 0 ? 'side-panel__note--up' : 'side-panel__note--down'}`;
  }

  const trendPeriods = periods.filter((p) => p.revenue != null);
  el.fundamentalTrend.hidden = trendPeriods.length < 2;
  if (trendPeriods.length >= 2) {
    el.fundamentalTrend.replaceChildren();
    for (const period of trendPeriods) {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = period.reportingPeriod;
      const detail = document.createElement('span');
      detail.textContent = `${period.revenue.toLocaleString('en-US')} 千元`;
      item.append(label, detail);
      el.fundamentalTrend.append(item);
    }
  }

  el.fundamentalSource.textContent = `資料來源：${latest.source}`;
}

// Recent corporate-action events - most symbols have none yet (only TPEx
// cash-dividend events - see docs/CORPORATE_ACTION_DATA_SOURCES.md).
function renderCorporateActionPanel(events) {
  if (!events.length) {
    el.corporateActionPanel.hidden = true;
    return;
  }
  el.corporateActionPanel.hidden = false;
  el.corporateActionList.replaceChildren();
  for (const event of events) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${event.effectiveDate} ${EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}`;
    const detail = document.createElement('span');
    detail.textContent = event.factor != null ? `參考價比例 ${event.factor.toFixed(4)}` : '';
    item.append(label, detail);
    el.corporateActionList.append(item);
  }
}

function renderMaterialInformationPanel(rows) {
  el.materialInformationPanel.hidden = false;
  el.materialInformationEmpty.hidden = rows.length > 0;
  el.materialInformationList.replaceChildren();
  for (const row of rows) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${row.announcementDate} ${row.announcementTime}`;
    const detail = document.createElement('span');
    detail.textContent = row.clause ? `${row.subject}（${row.clause}）` : row.subject;
    item.append(label, detail);
    el.materialInformationList.append(item);
  }
}

const VOLUME_ANOMALY_LABEL = { ANOMALY: '偵測到異常放量', NORMAL: '正常', UNKNOWN: '資料不足，無法判斷' };
const DATA_QUALITY_RISK_LABEL = { ELEVATED: '偏高（缺少追溯欄位）', LOW: '偏低', UNKNOWN: '資料不足，無法判斷' };
const CORPORATE_ACTION_RISK_LABEL = { RECENT_EVENT: '近期有公司行動事件（可能影響價格連續性）', NONE: '近期無公司行動事件', UNKNOWN: '資料不足，無法判斷' };

// Risk Analysis (v0.3.0, Issue #88) - auto-renders alongside the other Stock
// Detail panels (unlike the explicitly-triggered Analysis Workspace). Reads
// only currentRecords/latestFundamentals/latestCorporateActions, which are
// already fetched/verified elsewhere - buildDataQuality() here is a cheap,
// pure re-derivation from that already-fetched state, not a new fetch or
// recalculation of anything. Called once right after the chart renders
// (records-only metrics available immediately) and again once
// loadSupplementaryPanels() resolves, so the data-quality/corporate-action
// rows update from UNKNOWN once that data arrives - never blocking the
// primary price/chart render.
function renderRiskPanel() {
  if (!currentRecords.length) {
    el.riskPanel.hidden = true;
    return;
  }
  const dataQuality = buildDataQuality({ records: currentRecords, fundamentals: latestFundamentals, corporateActions: latestCorporateActions });
  // Volatility/drawdown on ex-rights adjusted prices, like the score and
  // target price: a split is not a crash (sample audit 2026-09-28: 6669's
  // 2026-09-02 3:1 split showed as 381% volatility and a -73% drawdown).
  const adjustedRecords = buildAdjustedRecommendationRecords(currentRecords, latestCorporateActions ?? []);
  const risk = buildRiskAssessment({ records: adjustedRecords, dataQuality, corporateActions: latestCorporateActions });
  if (!risk) {
    el.riskPanel.hidden = true;
    return;
  }
  el.riskPanel.hidden = false;
  el.riskVolatility.textContent = risk.historicalVolatility != null ? `${risk.historicalVolatility.toFixed(2)}%` : '資料不足';
  el.riskDrawdown.textContent = risk.maxDrawdown != null ? `${risk.maxDrawdown.toFixed(2)}%` : '資料不足';
  el.riskVolumeAnomaly.textContent = VOLUME_ANOMALY_LABEL[risk.volumeAnomaly];
  el.riskDataQuality.textContent = DATA_QUALITY_RISK_LABEL[risk.dataQualityRisk];
  el.riskCorporateAction.textContent = CORPORATE_ACTION_RISK_LABEL[risk.corporateActionRisk];
}

function renderListItems(container, items) {
  container.replaceChildren();
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    container.append(li);
  }
}

// Stage D (2026-09-19 UX audit, docs/STAGE_D_DASHBOARD_UX_AUDIT.md): the
// score/Target-Price/4-dimension breakdown - the number most users open
// this page for - used to only render as a side effect of clicking 開始分析
// (which really exists for the separate Analysis Workspace text below).
// Split out so it can render automatically once fundamentals settle,
// matching every other panel's auto-render behavior, while 開始分析 keeps
// its original, still-intentional job (see runAnalysis below): the Fact/
// Calculation/Interpretation workspace, not the score.
function renderRecommendationForCurrentSymbol() {
  if (!currentSymbol || !currentRecords.length) return;
  const momGrowth = latestFundamentals && latestFundamentals.length ? computeMomRevenueGrowth(latestFundamentals) : null;
  const yoyGrowth = latestFundamentals && latestFundamentals.length ? computeYoyRevenueGrowth(latestFundamentals) : null;
  runRecommendation(currentRecords, yoyGrowth ?? momGrowth);
}

// Explicit user action (開始分析) - assembles the Analysis Workspace
// summary from data/indicators already computed for the symbol currently
// on screen. See analysis-workspace.js for the Fact/Calculation/
// Interpretation separation this renders unchanged. (The score/Target-
// Price render this used to also trigger now happens automatically - see
// renderRecommendationForCurrentSymbol above - but is re-run here too so
// 開始分析 still reflects the latest fundamentals if they settled after
// the automatic render.)
function runAnalysis() {
  if (!currentSymbol || !latestIndicators) return;

  // buildSummary() from currentRecords (always the raw daily series) so this
  // matches exactly what the summary card at the top of the page shows -
  // latestIndicators.records is timeframe-aggregated (D/W/M) and would
  // disagree with it whenever a non-daily timeframe is selected.
  const summary = buildSummary(currentRecords);
  const technicalSummary = buildTechnicalSummary(latestIndicators);
  const dataQuality = buildDataQuality({ records: currentRecords, fundamentals: latestFundamentals, corporateActions: latestCorporateActions });
  const momGrowth = latestFundamentals && latestFundamentals.length ? computeMomRevenueGrowth(latestFundamentals) : null;
  const yoyGrowth = latestFundamentals && latestFundamentals.length ? computeYoyRevenueGrowth(latestFundamentals) : null;

  const result = buildAnalysisSummary({
    summary, indicators: latestIndicators, technicalSummary,
    fundamentals: latestFundamentals, momGrowth, corporateActions: latestCorporateActions, dataQuality
  });
  if (!result) {
    el.summaryAnalysisStatus.textContent = '分析狀態：資料不足';
    return;
  }

  renderListItems(el.analysisFacts, result.facts);
  renderListItems(el.analysisCalculations, result.calculations);
  renderListItems(el.analysisInterpretation, result.interpretation);
  el.analysisDisclaimer.textContent = result.disclaimer;
  el.analysisResult.hidden = false;
  el.summaryAnalysisStatus.textContent = '分析狀態：已產生';

  // Re-render in case fundamentals settled between the automatic render
  // (renderRecommendationForCurrentSymbol, called from
  // loadSupplementaryPanels) and this click - momGrowth/yoyGrowth above
  // are already the freshest values available.
  runRecommendation(currentRecords, yoyGrowth ?? momGrowth);
}

// Why no Target Price, from the target-range engine's own result (sample
// audit 2026-09-28: 2330/2454/2308 showed "history too short" while having
// years of data - the real reason was a new high with no resistance above,
// or a risk/reward below the gate).
function targetUnavailableReason(targetPrice) {
  const range = targetPrice?.targetRange;
  if (range?.status === 'CONDITIONAL' && range.riskReward?.low != null) {
    return `上方目標區的風險報酬比 ${range.riskReward.low.toFixed(2)} 未達門檻 ${range.riskReward.minRequired}（上漲空間相對下方支撐距離不足）`;
  }
  if (range?.candidates?.length && range.candidates.every((c) => !c.included && c.exclusionReason === 'WRONG_DIRECTION')) {
    return '股價已高於近期所有壓力與延伸目標（位於近期高點），上方暫無可作為目標價的價位';
  }
  if (range?.entryReference != null && range?.invalidationPrice != null && !(range.entryReference > range.invalidationPrice)) {
    return '股價已跌至近期支撐（Risk Price）以下，原多方結構失效';
  }
  return '近期歷史資料不足以計算';
}

const targetPriceStatusNote = (targetPrice) => `Target Price／Risk Price 暫不提供：${targetUnavailableReason(targetPrice)}；非 0 或猜測值。`;

// Issue #130 - decision-state badge CSS class per state, kept explicit
// (not derived from the state string) so a future state name change can't
// silently break styling.
const DECISION_STATE_BADGE_CLASS = {
  INVESTABLE_CANDIDATE: 'badge--investable-candidate',
  OBSERVATION: 'badge--observation',
  NOT_QUALIFIED: 'badge--not-qualified',
  UNAVAILABLE: 'badge--unavailable'
};

// Risk Tier / 強勢股 (Phase-2 roadmap item, 2026-09-23) - see
// scripts/compute-market-top50.mjs and public/js/lib/risk-analysis.js's
// classifyRiskTier/classifyMomentumFlag for how these are actually computed.
const RISK_TIER_BADGE_CLASS = {
  LOW: 'badge--risk-low',
  MEDIUM: 'badge--risk-medium',
  HIGH: 'badge--risk-high',
  UNKNOWN: 'badge--risk-unknown'
};
const RISK_TIER_LABEL = {
  LOW: '低波動',
  MEDIUM: '中波動',
  HIGH: '高波動',
  UNKNOWN: '資料不足'
};

// Builds the risk-tier badge cell shared by the Top10/AI評分TOP10/Market
// Top50 tables - the underlying real annualized volatility number is
// always shown alongside the tier label (never a bare, unexplained badge),
// and a real momentum_flag=true additionally appends a 強勢 badge.
function buildRiskTierCell(row) {
  const td = document.createElement('td');
  const tierBadge = document.createElement('span');
  tierBadge.className = `badge ${RISK_TIER_BADGE_CLASS[row.riskTier] ?? RISK_TIER_BADGE_CLASS.UNKNOWN}`;
  tierBadge.textContent = Number.isFinite(row.historicalVolatilityPercent)
    ? `${RISK_TIER_LABEL[row.riskTier] ?? row.riskTier}（${row.historicalVolatilityPercent.toFixed(1)}%）`
    : RISK_TIER_LABEL.UNKNOWN;
  td.append(tierBadge);
  if (row.momentumFlag === true) {
    const momentumBadge = document.createElement('span');
    momentumBadge.className = 'badge badge--momentum';
    momentumBadge.textContent = '強勢';
    momentumBadge.style.marginLeft = '0.3rem';
    td.append(momentumBadge);
  }
  return td;
}

function renderExpectedReturn(expectedReturn, targetPrice = null) {
  // UNAVAILABLE with a real reference price is "no target price", not missing data.
  el.expectedReturnDecisionState.textContent = expectedReturn.decisionState === 'UNAVAILABLE' && expectedReturn.referencePrice != null
    ? '暫無目標價（UNAVAILABLE）'
    : expectedReturn.decisionStateLabel;
  el.expectedReturnDecisionState.className = `badge ${DECISION_STATE_BADGE_CLASS[expectedReturn.decisionState] ?? ''}`;

  const lines = [];
  lines.push(expectedReturn.referencePrice != null
    ? `Reference Price：${expectedReturn.referencePrice.toFixed(2)}（${expectedReturn.referenceDate}，來源：${expectedReturn.referenceSource ?? '未知'}）`
    : 'Reference Price：資料不足');
  lines.push(expectedReturn.status === 'AVAILABLE'
    ? `Expected Return：${expectedReturn.expectedReturnPercent >= 0 ? '+' : ''}${expectedReturn.expectedReturnPercent.toFixed(2)}%（門檻 >20% 才標示可投資候選）`
    : `Expected Return：暫不提供（${expectedReturn.referencePrice == null ? 'Reference Price 尚未就緒' : `沒有 Target Price：${targetUnavailableReason(targetPrice)}`}），非 0 或猜測值`);
  renderListItems(el.expectedReturnDetail, lines);
}

// Redesign (2026-09-18): the 個股分析 page's 4-dimension card row. Reuses
// buildStockRecommendation()'s existing return value only - no second
// scoring calculation. 籌碼面 is reference data only (weight 0): it shows
// the real chip score/signals when an institutional_trading row exists;
// 消息面 is display-only (重大訊息 panel), never scored.
// Which filed quarter the fundamental score used (m4-v4), shown so the
// score can be checked against MOPS; growth is year on year, ROE trailing
// four quarters. Missing inputs say so rather than show a number.
function fundamentalBasisNote(inputs) {
  const pct = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%` : '無資料');
  if (!inputs) return '依據：月營收成長率；季報 EPS／淨利／ROE 無已公布資料';
  return `依據：月營收成長率＋${inputs.fiscalYear}Q${inputs.fiscalQuarter} 季報（EPS 年增 ${pct(inputs.epsGrowth)}、淨利年增 ${pct(inputs.netIncomeGrowth)}、ROE 近四季 ${pct(inputs.roe)}）`;
}

function renderScoreDimensions(recommendation) {
  const { scores, weightsUsed, instrumentType } = recommendation;
  const isEtf = instrumentType === 'ETF';
  // Stage E (E01): Ready state - hide Loading/Empty, show the real content.
  el.scoreGaugeLoading.hidden = true;
  el.scoreGaugeEmpty.hidden = true;
  el.scoreGaugeTotal.hidden = false;
  el.scoreGaugeBody.hidden = false;
  el.scoreGaugeTotal.textContent = Number.isFinite(scores.compositeScore) ? `${scores.compositeScore.toFixed(1)} / 100` : '—';

  const cards = [
    {
      title: '基本面分析',
      available: !isEtf,
      weightPercent: Number(((weightsUsed?.fundamental ?? 0) * 100).toFixed(1)),
      score: scores.fundamentalScore,
      note: isEtf ? 'ETF：基本面不適用（NOT_APPLICABLE），非 0 分' : fundamentalBasisNote(latestQuarterlyInputs)
    },
    // Stocks: reference data only since 2026-09-29 (weight 0) - shown greyed
    // with its real score and signals. ETFs: the technical layer is the score.
    isEtf
      ? { title: '技術面分析', available: true, weightPercent: Number(((weightsUsed?.technical ?? 0) * 100).toFixed(1)), score: scores.technicalScore, note: null }
      : { title: '技術面分析', available: false, note: `參考分數 ${Number.isFinite(scores.technicalScore) ? scores.technicalScore.toFixed(1) : '—'}（${(recommendation.technicalSignalLabels ?? []).join('、') || '無訊號'}）｜僅供參考，不計入總分：2016～2026 年回測顯示技術面權重越高，綜合評分預測力越弱` },
    // Reference data only (weight 0 since 2026-09-27) - shown greyed, with
    // the real chip score and signals when they exist.
    recommendation.chipDataAvailable
      ? { title: '籌碼面分析', available: false, note: `參考分數 ${scores.chipScore}（${(recommendation.chipSignalLabels ?? []).join('、') || '無訊號'}）｜僅供參考，不計入總分：回測顯示單日三大法人買賣超無顯著預測力` }
      : isEtf
        ? { title: '籌碼面分析', available: false, note: 'ETF：籌碼參考分數為股票專屬指標，不適用（NOT_APPLICABLE）｜不計入總分' }
        : { title: '籌碼面分析', available: false, note: '此標的無三大法人買賣超資料｜籌碼面僅供參考，不計入總分' },
    { title: '消息面分析', available: false, note: latestMaterialInformation?.length
      ? `近期 ${latestMaterialInformation.length} 則重大訊息（列於下方「重大訊息」），僅顯示、不計入總分`
      : '重大訊息僅顯示、不判斷利多／利空，不計入總分' }
  ];

  el.scoreGaugeBody.replaceChildren();
  for (const card of cards) {
    const div = document.createElement('div');
    div.className = `dimension-card${card.available ? '' : ' dimension-card--unavailable'}`;

    const title = document.createElement('div');
    title.className = 'dimension-card__title';
    const titleText = document.createElement('span');
    titleText.textContent = card.title;
    title.append(titleText);
    if (card.available) {
      const weightSpan = document.createElement('span');
      weightSpan.className = 'side-panel__label';
      weightSpan.textContent = `權重 ${card.weightPercent}%`;
      title.append(weightSpan);
    }
    div.append(title);

    if (card.available) {
      const scoreP = document.createElement('p');
      scoreP.className = 'side-panel__value';
      scoreP.textContent = Number.isFinite(card.score) ? card.score.toFixed(1) : '—';
      div.append(scoreP);
      if (card.note) {
        const noteP = document.createElement('p');
        noteP.className = 'side-panel__note';
        noteP.textContent = card.note;
        div.append(noteP);
      }
    } else {
      const noteP = document.createElement('p');
      noteP.className = 'side-panel__note';
      noteP.textContent = card.note;
      div.append(noteP);
    }
    el.scoreGaugeBody.append(div);
  }
}

// Adjusts `records` for any real corporate-action event (split/dividend/
// capital reduction) before scoring - latestCorporateActions is already
// fetched/normalized by loadSupplementaryPanels (same ambient-state pattern
// buildDataQuality/buildRiskAssessment above already use). Without this, a
// stock's own real historical split sits in the lookback window as a raw,
// un-adjusted price cliff - the exact bug behind the real 6669/緯穎 case
// ("AI 建議售價為7800，目前售價為2150"), now fixed at the same root cause as
// the Market Top50/AI 評分 TOP10 batch (scripts/compute-market-top50.mjs).
// Taiwan ETF/ETN codes are the 00xx(xx) range; no common stock uses it.
// ETFs get the engine's ETF mode (technical layer only, stock-only
// fundamentals shown as not applicable) instead of a neutral 50 standing in
// for a revenue they don't have (sample audit 2026-09-28: 0050/00878).
const instrumentTypeOf = (symbol) => (/^00\d{2,4}[A-Z]?$/.test(String(symbol ?? '').toUpperCase()) ? 'ETF' : 'STOCK');

function runRecommendation(records, revenueGrowth) {
  const adjustedRecords = buildAdjustedRecommendationRecords(records, latestCorporateActions ?? []);
  const recommendation = buildStockRecommendation(adjustedRecords, revenueGrowth, { institutionalFlow: latestInstitutionalFlow?.flow ?? null, instrumentType: instrumentTypeOf(currentSymbol), quarterlyFundamentals: latestQuarterlyInputs });
  if (!recommendation) {
    // Stage E (E01): honest Empty state instead of silently leaving the
    // card on Loading forever - buildStockRecommendation returns null
    // when there isn't enough history to compute anything, which is a
    // real, distinct outcome from "still waiting" or "computed".
    el.scoreGaugeLoading.hidden = true;
    el.scoreGaugeEmpty.hidden = false;
    el.summaryCalcStatus.textContent = '計算狀態：資料不足';
    latestRecommendation = null;
    renderSellSuggestion();
    return;
  }
  latestRecommendation = recommendation;
  renderScoreDimensions(recommendation);
  el.summaryCalcStatus.textContent = '計算狀態：已完成';

  const targetPriceLines = [];
  if (recommendation.targetPrice.status === 'AVAILABLE') {
    const { targetPrice, riskPrice, provenance } = recommendation.targetPrice;
    targetPriceLines.push(`Target Price（近 ${provenance.period} 日高點）：${targetPrice.toFixed(2)}`);
    targetPriceLines.push(`Risk Price（近 ${provenance.period} 日低點）：${riskPrice.toFixed(2)}`);
    targetPriceLines.push(`計算依據：Donchian Channel，區間 ${provenance.windowStartDate} ～ ${provenance.windowEndDate}，最新收盤 ${provenance.latestClose}`);
  } else {
    targetPriceLines.push(targetPriceStatusNote(recommendation.targetPrice));
  }
  renderListItems(el.recommendationTargetPrice, targetPriceLines);

  // Expected Return decision gate (Issue #130, Stanley's explicit >30%
  // lock) - reuses the SAME targetPriceResult above, never a second
  // Target Price calculation. Rendered as its own badge + detail list so
  // the >30%/<=30%/UNAVAILABLE states are unambiguous in Browser QA.
  renderExpectedReturn(recommendation.expectedReturn, recommendation.targetPrice);

  el.recommendationVerdict.textContent = recommendation.verdictLabel;
  renderListItems(el.recommendationMatchedSignals, recommendation.matchedSignalLabels.length ? recommendation.matchedSignalLabels : ['目前無已驗證訊號符合任何既定條件']);
  renderListItems(el.recommendationCounterEvidence, recommendation.counterEvidence);
  el.recommendationDisclaimer.textContent = recommendation.disclaimer;

  // MVP-3 (Issue #128) - 投資週期分類與個股適配分析. Every horizon requires
  // 2+ already-verified signals to agree (never a single indicator, see
  // src/analysis/investment-horizon.js); a horizon with insufficient
  // underlying data renders "資料不足", never a guessed suitability.
  el.horizonEvidenceStrength.textContent = recommendation.investmentHorizon.evidenceStrengthLabel;
  const horizonLines = Object.values(recommendation.investmentHorizon.horizons).map((horizon) => {
    if (horizon.insufficientData) return `${horizon.label}：資料不足，暫無法判斷`;
    const status = horizon.suitable ? '符合條件' : '不符合條件';
    const conditions = horizon.suitable ? horizon.matchedConditionLabels : horizon.unmatchedConditionLabels;
    return `${horizon.label}：${status}（${conditions.join('、')}）`;
  });
  renderListItems(el.horizonList, horizonLines);
  const liquidity = recommendation.liquidity;
  el.horizonLiquidity.textContent = liquidity
    ? `流動性參考（近 ${liquidity.lookback} 日）：日均量 ${Math.round(liquidity.averageDailyVolume).toLocaleString('en-US')} 股，日均成交金額約 ${Math.round(liquidity.averageDailyValue).toLocaleString('en-US')} 元（僅供參考，本系統未設定分級門檻）`
    : '流動性參考：資料不足（近期歷史資料未滿 20 日）';

  el.recommendationResult.hidden = false;
  renderSellSuggestion();
}

// ============================================================================
// Stock Detail — 持倉與模擬輸入 / AI 建議售出價格 (front-end-only
// simulation; Section 17 of the execution spec: never persisted, never
// writes to any database, never modifies Production market data, no
// broker/order API). All arithmetic lives in holding-simulation.js
// (pure, unit-tested) - this section only reads the 3 inputs, calls it,
// and renders the result.
// ============================================================================

const HOLDING_INVALID_REASON_MESSAGE = {
  PURCHASE_PRICE_NOT_POSITIVE: '平均購入金額必須大於 0。',
  SHARES_NOT_POSITIVE: '股數必須大於 0。',
  CURRENT_PRICE_NOT_POSITIVE: '目前股價必須大於 0。'
};

function formatSignedNtd(value) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.round(Math.abs(value)).toLocaleString('en-US')} 元`;
}

function readHoldingInputs() {
  const parse = (raw) => (raw === '' ? NaN : Number(raw));
  return {
    averagePurchasePrice: parse(el.holdingPurchasePriceInput.value),
    shares: parse(el.holdingSharesInput.value),
    currentPrice: parse(el.holdingCurrentPriceInput.value)
  };
}

function renderHoldingSimulation() {
  const { averagePurchasePrice, shares, currentPrice } = readHoldingInputs();

  // "尚未輸入" (Section 12) - distinct from an invalid value once the
  // user HAS started typing. Only checks the two fields the user must
  // supply themselves; 目前股價 is pre-filled from the real current price.
  if (el.holdingPurchasePriceInput.value === '' && el.holdingSharesInput.value === '') {
    el.holdingSimulationPrompt.hidden = false;
    el.holdingSimulationError.hidden = true;
    el.holdingSimulationResult.hidden = true;
    return;
  }

  const result = computeHoldingSimulation({ averagePurchasePrice, shares, currentPrice });
  if (result.status !== 'AVAILABLE') {
    el.holdingSimulationPrompt.hidden = true;
    el.holdingSimulationError.hidden = false;
    el.holdingSimulationError.textContent = HOLDING_INVALID_REASON_MESSAGE[result.reason] ?? '輸入格式不正確，暫無法模擬。';
    el.holdingSimulationResult.hidden = true;
    return;
  }

  el.holdingSimulationPrompt.hidden = true;
  el.holdingSimulationError.hidden = true;
  el.holdingTotalInvested.textContent = `${Math.round(result.totalInvested).toLocaleString('en-US')} 元`;
  el.holdingCurrentMarketValue.textContent = `${Math.round(result.currentMarketValue).toLocaleString('en-US')} 元`;
  el.holdingCurrentPnl.textContent = formatSignedNtd(result.currentPnl);
  el.holdingCurrentPnl.className = result.currentPnl >= 0 ? 'value--up' : 'value--down';
  el.holdingCurrentReturn.textContent = formatSignedPercent(result.currentReturnPercent);
  el.holdingCurrentReturn.className = result.currentReturnPercent >= 0 ? 'value--up' : 'value--down';
  el.holdingSimulationResult.hidden = false;
}

// AI 建議售出價格 - the SAME Target Price runRecommendation() already
// computed (latestRecommendation), never a second calculation. The price
// itself is shown as soon as it's available, independent of whether the
// user has entered holding inputs yet; the estimated return/P&L sub-
// section needs those inputs too and shows its own prompt until they're
// entered (Section 7's "預估報酬率/預估損益" both require 平均購入價格
// and 股數).
function renderSellSuggestion() {
  if (!latestRecommendation) {
    el.sellSuggestionPanel.hidden = false;
    el.sellSuggestionEmpty.hidden = false;
    el.sellSuggestionBody.hidden = true;
    return;
  }

  const targetPriceResult = latestRecommendation.targetPrice;
  if (targetPriceResult.status !== 'AVAILABLE') {
    el.sellSuggestionPanel.hidden = false;
    el.sellSuggestionEmpty.hidden = false;
    el.sellSuggestionEmpty.textContent = `目前無法取得建議售出價格（${targetUnavailableReason(targetPriceResult)}），非 0 或猜測值。`;
    el.sellSuggestionBody.hidden = true;
    return;
  }

  el.sellSuggestionPanel.hidden = false;
  el.sellSuggestionEmpty.hidden = true;
  el.sellSuggestionBody.hidden = false;

  const { targetPrice, riskPrice, provenance } = targetPriceResult;
  el.sellSuggestionPrice.textContent = `NT$ ${targetPrice.toFixed(2)}`;

  const { averagePurchasePrice, shares } = readHoldingInputs();
  const sellSimulation = computeSellSimulation({ averagePurchasePrice, shares, suggestedSellPrice: targetPrice });
  if (sellSimulation.status === 'AVAILABLE') {
    el.sellSuggestionPrompt.hidden = true;
    el.sellSuggestionEstimate.hidden = false;
    el.sellSuggestionReturn.textContent = formatSignedPercent(sellSimulation.estimatedReturnPercent);
    el.sellSuggestionReturn.className = sellSimulation.estimatedReturnPercent >= 0 ? 'value--up' : 'value--down';
    el.sellSuggestionPnl.textContent = formatSignedNtd(sellSimulation.estimatedPnl);
    el.sellSuggestionPnl.className = sellSimulation.estimatedPnl >= 0 ? 'value--up' : 'value--down';
  } else {
    el.sellSuggestionPrompt.hidden = false;
    el.sellSuggestionEstimate.hidden = true;
  }

  // 建議策略 (Section 8) - only real, already-computed fields; never an
  // invented duration or a fabricated third "take-profit" price distinct
  // from Target Price (see the execution report's Reference Deviation
  // Notes for why - no such calculation exists in this codebase).
  const strategyLines = [
    `短期目標（Target Price）：${targetPrice.toFixed(2)} 元`,
    `停損／風險價（Risk Price）：${riskPrice.toFixed(2)} 元`
  ];
  const horizons = latestRecommendation.investmentHorizon?.horizons ?? {};
  const suitableHorizons = Object.values(horizons).filter((h) => !h.insufficientData && h.suitable);
  strategyLines.push(
    suitableHorizons.length > 0
      ? `建議持有期間：${suitableHorizons.map((h) => h.label).join('、')}（依既有投資週期分類器，至少 2 個已驗證訊號同意）`
      : '建議持有期間：資料不足，暫無法判斷（需至少 2 個已驗證訊號同意才分類，不勉強）'
  );
  renderListItems(el.sellSuggestionStrategy, strategyLines);

  el.sellSuggestionExplanation.textContent = `建議售出價格＝既有 Recommendation Engine 的 Target Price（近 ${provenance.period} 日 Donchian Channel 上緣，純技術面價格計算），非另一套演算法、非 AI 自行生成的理由。`;
}

function resetHoldingSimulation() {
  el.holdingPurchasePriceInput.value = '';
  el.holdingSharesInput.value = '';
  el.holdingCurrentPriceInput.value = currentRecords.length ? currentRecords[currentRecords.length - 1].close : '';
  renderHoldingSimulation();
  renderSellSuggestion();
}

for (const input of [el.holdingPurchasePriceInput, el.holdingSharesInput, el.holdingCurrentPriceInput]) {
  input.addEventListener('input', () => {
    renderHoldingSimulation();
    renderSellSuggestion();
  });
}
el.holdingSimulationReset.addEventListener('click', resetHoldingSimulation);

// Supplementary to the core price/chart flow - a failure here (e.g. before
// migration 008's anon-read policy is applied to production) must never
// break symbol search; it just leaves both panels hidden. Not awaited by
// loadSymbol(), so a search for a new symbol can start before this one's
// two requests settle - each response is checked against currentSymbol
// before touching the DOM, so a slower, now-stale response (e.g. from the
// previously searched symbol) can never overwrite the panels after a
// newer search has already moved on.
async function loadSupplementaryPanels(symbol, config) {
  try {
    const periods = await fetchLatestFundamentals({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol, fetchImpl: window.fetch.bind(window) });
    if (currentSymbol === symbol) {
      renderFundamentalPanel(periods);
      latestFundamentals = periods;
    }
  } catch (err) {
    if (currentSymbol === symbol) {
      el.fundamentalPanel.hidden = true;
      latestFundamentals = null;
    }
  }

  try {
    const events = await fetchCorporateActionEvents({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol, fetchImpl: window.fetch.bind(window) });
    if (currentSymbol === symbol) {
      renderCorporateActionPanel(events);
      latestCorporateActions = events;
    }
  } catch (err) {
    if (currentSymbol === symbol) {
      el.corporateActionPanel.hidden = true;
      latestCorporateActions = null;
    }
  }

  // Same as the nightly batch (m4-v4): the latest quarter public as of
  // today (Taipei). Best-effort - a failure leaves the quarterly signals out.
  try {
    const quarters = await fetchRecentQuarterlyRows({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol, fetchImpl: window.fetch.bind(window) });
    const taipeiToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    if (currentSymbol === symbol) latestQuarterlyInputs = quarterlyFundamentalInputs(quarters, taipeiToday);
  } catch {
    if (currentSymbol === symbol) latestQuarterlyInputs = null;
  }

  // Best-effort: a failure just leaves the chip layer unavailable (weights
  // renormalized), exactly as the daily batch degrades.
  try {
    const result = await fetchLatestInstitutionalFlow({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol, fetchImpl: window.fetch.bind(window) });
    if (currentSymbol === symbol) latestInstitutionalFlow = result;
  } catch {
    if (currentSymbol === symbol) latestInstitutionalFlow = null;
  }

  try {
    const rows = await fetchRecentMaterialInformation({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol, fetchImpl: window.fetch.bind(window) });
    if (currentSymbol === symbol) {
      latestMaterialInformation = rows;
      renderMaterialInformationPanel(rows);
    }
  } catch {
    if (currentSymbol === symbol) {
      latestMaterialInformation = null;
      el.materialInformationPanel.hidden = true;
    }
  }

  // Data-quality-risk and corporate-action-risk rows depend on fundamentals/
  // corporate-action state that only just settled above (records-only
  // metrics were already shown by the renderRiskPanel() call in
  // loadSymbol()) - re-render now that both have resolved, one way or
  // the other, guarded by the same staleness check as the panels above.
  if (currentSymbol === symbol) renderRiskPanel();

  // Stage D: auto-render the score/Target-Price/4-dimension breakdown now
  // that fundamentals have settled (same staleness guard as the panels
  // above) - see renderRecommendationForCurrentSymbol's comment for why.
  if (currentSymbol === symbol) renderRecommendationForCurrentSymbol();

  // M9's Long-Term Trend panel does its own full paginated history fetch
  // (potentially thousands of rows) - deliberately not awaited here
  // either, same fire-and-forget + staleness-guard contract as the two
  // panels above, so a slow long-term fetch never blocks a new search.
  renderLongTermTrend(symbol);
}

const TECHNICAL_STATUS_LABEL = { UP: '偏多', DOWN: '偏空', FLAT: '持平', UNKNOWN: '資料不足' };

// Fetches one symbol's last price/daily change (v0.4.0, Issue #98),
// technical status (Issue #100), RSI status (v0.5.0, Issue #109), MA
// relationship / momentum / volume status (v0.5.0, Issue #111), and data
// freshness (Issue #100) from a single ascending fetch (same shape the main
// chart already uses, just a smaller window): price/change from the last
// two records (computeLatestPriceChange, unchanged), each signal from its
// already-verified classify*()+build*Series() pair (all unchanged, the
// same functions Stock Detail's own Technical Summary uses), freshness
// from getDataFreshness() (unchanged). Returns null when Supabase isn't
// configured, the fetch fails, or the symbol has no market_daily rows yet -
// callers show a "資料不足" fallback rather than fabricating a value.
// Shared by the Watchlist chip renderer (Issue #98/#100), the Comparison
// panel (Issue #107), and the Screening panel (Issue #109/#111) so all
// three read identical numbers for the same symbol from one verified
// pipeline, not three independently-written ones. Volatility (ATR-based)
// is deliberately NOT included here - classifyVolatility() needs an ATR
// series ~20 values long (≈34 raw records), more than this fetch's 30-row
// window provides; widening it would enlarge every call site's query for
// a signal only Screening #111 evidence-audited as wanted. See Issue #111.
async function fetchWatchlistStyleMetrics(symbol) {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return null;

  const records = await fetchSymbolDailySeries({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol, limit: 30, fetchImpl: window.fetch.bind(window) });
  if (!records.length) return null;

  const priceChange = computeLatestPriceChange([records[records.length - 1], records[records.length - 2]]);
  const ma5 = buildMovingAverageSeries(records, MA_SHORT_PERIOD);
  const ma20 = buildMovingAverageSeries(records, MA_LONG_PERIOD);
  const latestMa5 = ma5.length ? ma5[ma5.length - 1].value : null;
  const latestMa20 = ma20.length ? ma20[ma20.length - 1].value : null;
  const trend = classifyTrend(records[records.length - 1].close, latestMa20);
  const maRelationship = classifyMovingAverageRelationship(latestMa5, latestMa20);
  const rsi = buildRsiSeries(records, RSI_PERIOD);
  const latestRsi = rsi.length ? rsi[rsi.length - 1].value : null;
  const rsiStatus = classifyRsi(latestRsi);
  const momentum = classifyMomentum(records);
  const volumeStatus = classifyVolume(records);
  const freshness = getDataFreshness({ latestTradingDate: records[records.length - 1].tradingDate });

  return { priceChange, trend, maRelationship, rsiStatus, momentum, volumeStatus, freshness };
}

// Renders one chip's last price/daily change, technical status, and data
// freshness as child <span>s appended after the chip's symbol text - the
// button's click handler still fires from any click inside it (event
// bubbling), so this never changes the chip's existing click-to-load
// behavior. A failed fetch, or a symbol with no market_daily rows yet,
// leaves the chip as bare symbol text rather than fabricating anything,
// and never blocks any other chip, since each fetch is independent.
function renderWatchlistChipDetails(button, symbol) {
  const priceEl = document.createElement('span');
  priceEl.className = 'watchlist-chip__price';
  button.append(priceEl);
  const statusEl = document.createElement('span');
  statusEl.className = 'watchlist-chip__status';
  button.append(statusEl);
  // Freshness is an independent data-quality note, not part of the trend
  // signal - kept in its own span so it never inherits the trend's
  // up/down color (a red "資料可能過期" would misleadingly read as part of
  // a negative trend rather than a separate staleness caveat).
  const freshnessEl = document.createElement('span');
  freshnessEl.className = 'watchlist-chip__status';
  button.append(freshnessEl);

  fetchWatchlistStyleMetrics(symbol)
    .then((metrics) => {
      if (!metrics) return;
      const { priceChange, trend, freshness } = metrics;

      if (priceChange) {
        const sign = priceChange.change > 0 ? '+' : '';
        priceEl.textContent = ` ${priceChange.latestClose.toFixed(2)} (${sign}${priceChange.changePercent.toFixed(2)}%)`;
        priceEl.classList.add(priceChange.change >= 0 ? 'watchlist-chip__change--up' : 'watchlist-chip__change--down');
      }

      statusEl.textContent = ` · ${TECHNICAL_STATUS_LABEL[trend]}`;
      if (trend === 'UP') statusEl.classList.add('watchlist-chip__change--up');
      else if (trend === 'DOWN') statusEl.classList.add('watchlist-chip__change--down');

      if (freshness === 'STALE') freshnessEl.textContent = `，${FRESHNESS_LABEL.STALE}`;
    })
    .catch(() => {});
}

function renderWatchlist() {
  el.watchlist.replaceChildren();
  for (const symbol of watchlist.list()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'watchlist-chip';
    button.dataset.symbol = symbol;
    const name = getCachedCompanyName(symbol);
    button.textContent = name ? `${symbol}（${name}）` : symbol;
    button.addEventListener('click', () => {
      el.input.value = symbol;
      loadSymbol(symbol);
    });
    el.watchlist.append(button);
    renderWatchlistChipDetails(button, symbol);
  }
  updateWatchlistCurrent();
}

// The watchlist is the user's saved list, not the stock on screen - mark
// the chip for the current symbol and say so when it isn't in the list,
// so a different chip is never read as the selected stock.
function updateWatchlistCurrent() {
  for (const chip of el.watchlist.querySelectorAll('.watchlist-chip')) {
    const isCurrent = chip.dataset.symbol === currentSymbol;
    chip.classList.toggle('watchlist-chip--current', isCurrent);
    if (isCurrent) chip.setAttribute('aria-current', 'true');
    else chip.removeAttribute('aria-current');
  }
  const count = watchlist.list().length;
  if (count === 0) el.watchlistHint.textContent = '尚無自選股，可按個股名稱旁的「加入自選」';
  else if (currentSymbol && !watchlist.has(currentSymbol)) el.watchlistHint.textContent = `目前查詢的 ${currentSymbol} 不在清單中`;
  else el.watchlistHint.textContent = '';
}

// Market Top 50 (M4, Issue #133) - an independent workspace, not gated
// behind the per-symbol search flow: loads once on page start, reading
// the server-computed market_top50 table directly (the dashboard never
// computes a ranking itself - see public/js/lib/market-top50-source.js).
// Allowed interactions only (Section 15): click a row to open it in the
// existing Stock Detail flow, or add it to the Watchlist - never a
// buy/sell button, no broker/trading feature of any kind.
const DECISION_STATE_TABLE_LABEL = {
  INVESTABLE_CANDIDATE: '可投資候選',
  OBSERVATION: '觀察中',
  NOT_QUALIFIED: '不符合條件',
  UNAVAILABLE: '資料不足'
};
const DATA_STATUS_LABEL = { AVAILABLE: '正常', UNAVAILABLE: '資料不足' };

function formatPrice(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function renderMarketTop50Rows(rows) {
  el.marketTop50Tbody.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.dataset.symbol = row.symbol;

    const cells = [
      String(row.rank),
      row.symbol,
      row.companyName ?? '—',
      formatPrice(row.referencePrice),
      formatPrice(row.targetPrice),
      formatPercent(row.expectedReturnPercent)
    ];
    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }

    const decisionTd = document.createElement('td');
    const decisionBadge = document.createElement('span');
    decisionBadge.className = `badge ${DECISION_STATE_BADGE_CLASS[row.decisionState] ?? ''}`;
    decisionBadge.textContent = DECISION_STATE_TABLE_LABEL[row.decisionState] ?? row.decisionState;
    decisionTd.append(decisionBadge);
    tr.append(decisionTd);

    tr.append(buildRiskTierCell(row));

    const scoreTd = document.createElement('td');
    scoreTd.textContent = Number.isFinite(row.recommendationScore) ? row.recommendationScore.toFixed(1) : '—';
    tr.append(scoreTd);

    const dataStatusTd = document.createElement('td');
    dataStatusTd.textContent = DATA_STATUS_LABEL[row.dataStatus] ?? row.dataStatus;
    tr.append(dataStatusTd);

    const dataAsOfTd = document.createElement('td');
    dataAsOfTd.textContent = row.dataAsOf ?? '—';
    tr.append(dataAsOfTd);

    // M8.2/M8.3 (Section 9, Issue #156): the real per-row provenance
    // (market_daily's own `source` field, e.g. "TWSE-openapi") - not the
    // generic panel-level description above, and never fabricated when
    // absent (an UNAVAILABLE row has no reference record to source from).
    const sourceTd = document.createElement('td');
    sourceTd.textContent = row.source || '—';
    tr.append(sourceTd);

    const actionTd = document.createElement('td');
    const watchlistButton = document.createElement('button');
    watchlistButton.type = 'button';
    watchlistButton.className = 'secondary-button';
    watchlistButton.textContent = watchlist.has(row.symbol) ? '已加入自選' : '加入自選';
    watchlistButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!watchlist.has(row.symbol)) watchlist.add(row.symbol);
      renderWatchlist();
      watchlistButton.textContent = '已加入自選';
    });
    actionTd.append(watchlistButton);
    tr.append(actionTd);

    tr.addEventListener('click', () => {
      el.input.value = row.symbol;
      loadSymbol(row.symbol);
    });

    el.marketTop50Tbody.append(tr);
  }
}

async function renderMarketTop50() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    el.marketTop50Error.textContent = '尚未設定 Supabase 連線資訊，請於 public/js/config.js 填入 SUPABASE_URL 與 SUPABASE_ANON_KEY。';
    el.marketTop50Error.hidden = false;
    return;
  }

  try {
    const { calculationDate, rows } = await fetchMarketTop50({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    if (!calculationDate || rows.length === 0) {
      el.marketTop50Empty.hidden = false;
      return;
    }

    const availableCount = rows.filter((row) => row.dataStatus === 'AVAILABLE').length;
    el.marketTop50Meta.textContent = `計算日期：${calculationDate}｜資料來源：TWSE／TPEx 每日行情（market_daily）批次計算｜共 ${rows.length} 檔（${availableCount} 檔資料充足）`;
    el.marketTop50Meta.hidden = false;

    // Display-order only - every fetched row is still shown (no slicing),
    // so sorting by expected return here is a pure reorder, not a selection
    // change (Market Top 50's own rank/selection stays governed by the
    // existing decision-state/expected-return ranking contract).
    const sortedByReturn = rows.slice().sort((a, b) => (Number.isFinite(b.expectedReturnPercent) ? b.expectedReturnPercent : -Infinity) - (Number.isFinite(a.expectedReturnPercent) ? a.expectedReturnPercent : -Infinity));
    renderMarketTop50Rows(sortedByReturn);
    el.marketTop50TableWrap.hidden = false;
  } catch (err) {
    // A short, static message in the DOM - never the raw server error text
    // (which can be a long unbroken JSON string with no wrap points, e.g. a
    // 404 body) directly, so it can never force the page wider than the
    // viewport on mobile. The underlying failed network request is still
    // visible in the browser's own Network tab/console for debugging.
    el.marketTop50Error.textContent = 'Market Top 50 載入失敗，暫時無法顯示排行資料。';
    el.marketTop50Error.hidden = false;
  }
}

// ============================================================================
// Redesign (2026-09-18): Overview page. Reuses fetchMarketTop50 (already
// used by renderMarketTop50 above) and runAlgorithmValidation (already used
// by renderAlgorithmValidation below) - no new fetch/scoring logic, just new
// aggregation/presentation of data this app already fetches elsewhere.
// ============================================================================

const HORIZON_TILE_LABEL = { DAY_TRADING: '當沖', SHORT_MEDIUM_TERM: '中短期', LONG_TERM: '長期' };
// Decorative only (icon + accent color) - purely presentational, no data implied.
const HORIZON_TILE_ICON = {
  DAY_TRADING: { icon: '⚡', iconClass: 'horizon-tile__icon--day' },
  SHORT_MEDIUM_TERM: { icon: '🕐', iconClass: 'horizon-tile__icon--mid' },
  LONG_TERM: { icon: '📅', iconClass: 'horizon-tile__icon--long' }
};
const HORIZON_TILE_ORDER = ['DAY_TRADING', 'SHORT_MEDIUM_TERM', 'LONG_TERM'];

// Top10 horizon filter tabs - reuses the same 3 real categories/labels as
// the "本週投資觀察" tiles (HORIZON_TILE_LABEL/HORIZON_TILE_ORDER), just a
// second view of the same already-fetched observation_horizons field, not
// a new classification. 'ALL' shows the unfiltered top 10 by rank.
const TOP10_FILTER_ORDER = ['ALL', ...HORIZON_TILE_ORDER];
const TOP10_FILTER_LABEL = { ALL: '全部', ...HORIZON_TILE_LABEL };
let overviewTop10Rows = [];
let overviewTop10Filter = 'ALL';
// Set by clicking an "AI 選股總覽" KPI tile - a second, independent filter
// dimension (decision_state) that combines with the horizon tab above via
// AND, not a replacement for it.
let overviewTop10DecisionFilter = 'INVESTABLE_CANDIDATE';

// "AI 選股總覽" KPI grid (強烈觀察=INVESTABLE_CANDIDATE／價值觀察=OBSERVATION／
// 持續觀察=NOT_QUALIFIED, confirmed 2026-09-23) - reuses the platform's one
// existing, audited decision_state classification, never a new one. Total
// counts every row regardless of data_status (UNAVAILABLE rows are still
// "observed", just without enough data for a verdict). Average expected
// return is a real mean over rows with a finite expected_return_pct only -
// never padded with UNAVAILABLE/NOT_QUALIFIED nulls as 0%.
function renderOverviewKpiGrid(rows) {
  const counts = { INVESTABLE_CANDIDATE: 0, OBSERVATION: 0, NOT_QUALIFIED: 0, UNAVAILABLE: 0 };
  for (const row of rows) counts[row.decisionState] = (counts[row.decisionState] ?? 0) + 1;
  const returns = rows.map((row) => row.expectedReturnPercent).filter((value) => Number.isFinite(value));
  const avgReturn = returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null;

  document.querySelector('#overview-kpi-total [data-value]').textContent = `${rows.length} 檔`;
  document.querySelector('#overview-kpi-strong [data-value]').textContent = `${counts.INVESTABLE_CANDIDATE} 檔`;
  document.querySelector('#overview-kpi-value-watch [data-value]').textContent = `${counts.OBSERVATION} 檔`;
  document.querySelector('#overview-kpi-continued [data-value]').textContent = `${counts.NOT_QUALIFIED} 檔`;
  document.querySelector('#overview-kpi-avg-return [data-value]').textContent = avgReturn == null ? '資料不足' : `${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(1)}%`;
  document.querySelector('#overview-kpi-total [data-sub]').textContent = `含 ${counts.UNAVAILABLE} 檔資料不足`;
}

function updateOverviewKpiActiveState() {
  for (const button of el.overviewKpiGrid.querySelectorAll('.kpi-tile')) {
    button.classList.toggle('kpi-tile--active', overviewTop10DecisionFilter !== 'ALL' && button.dataset.decisionFilter === overviewTop10DecisionFilter);
  }
}

for (const button of document.querySelectorAll('#overview-kpi-grid .kpi-tile')) {
  button.addEventListener('click', () => {
    const target = button.dataset.decisionFilter;
    overviewTop10DecisionFilter = (target !== 'ALL' && overviewTop10DecisionFilter === target) ? 'ALL' : target;
    updateOverviewKpiActiveState();
    renderOverviewTop10Rows();
  });
}
// key = `${market}:${symbol}` -> the real change object computeOverviewChanges()
// produced (same day-over-day diff the "今日 AI 推薦變化" table shows) -
// populated once by renderOverviewPage before either consumer renders, so
// there is exactly one place that computes this, never a second copy.
let overviewChangeByKey = new Map();

function matchedHorizonLabel(observationHorizons) {
  if (!observationHorizons) return '—';
  const labels = HORIZON_TILE_ORDER.filter((key) => observationHorizons[key] === true).map((key) => HORIZON_TILE_LABEL[key]);
  return labels.length > 0 ? labels.join('／') : '—';
}

// Colored pill for the 投資期間 column - reuses the exact same 3-category
// color scheme as the horizon-tile icons (day/mid = blue, long = orange),
// so the same real category always reads the same color everywhere on the
// page. A symbol matching more than one category (or none) gets a neutral
// pill rather than an invented blended color.
const HORIZON_PILL_CLASS = { DAY_TRADING: 'horizon-pill--day', SHORT_MEDIUM_TERM: 'horizon-pill--mid', LONG_TERM: 'horizon-pill--long' };
function horizonPillClass(observationHorizons) {
  if (!observationHorizons) return 'horizon-pill--neutral';
  const matched = HORIZON_TILE_ORDER.filter((key) => observationHorizons[key] === true);
  return matched.length === 1 ? HORIZON_PILL_CLASS[matched[0]] : 'horizon-pill--neutral';
}

function changeArrow(market, symbol) {
  const change = overviewChangeByKey.get(`${market}:${symbol}`);
  if (change?.type === 'UPGRADED') return { text: '▲', className: 'value--up' };
  if (change?.type === 'DOWNGRADED') return { text: '▼', className: 'value--down' };
  return { text: '—', className: '' };
}

function renderOverviewTop10Filters() {
  el.overviewTop10Filters.replaceChildren();
  for (const key of TOP10_FILTER_ORDER) {
    const count = key === 'ALL' ? overviewTop10Rows.length : overviewTop10Rows.filter((row) => row.observationHorizons?.[key] === true).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filterbtn ${key === overviewTop10Filter ? 'filterbtn--active' : ''}`;
    button.textContent = `${TOP10_FILTER_LABEL[key]} (${count})`;
    button.addEventListener('click', () => {
      overviewTop10Filter = key;
      renderOverviewTop10Filters();
      renderOverviewTop10Rows();
    });
    el.overviewTop10Filters.append(button);
  }
}

function renderOverviewTop10Rows() {
  let filtered = overviewTop10Filter === 'ALL'
    ? overviewTop10Rows
    : overviewTop10Rows.filter((row) => row.observationHorizons?.[overviewTop10Filter] === true);
  // AI 選股總覽 KPI tile filter (decision_state) - independent dimension,
  // combined with the horizon tab above via AND.
  if (overviewTop10DecisionFilter !== 'ALL') {
    filtered = filtered.filter((row) => row.decisionState === overviewTop10DecisionFilter);
  }
  // Which 10 symbols appear is decided ONLY by rank/filter above (the
  // audited, compliant Market Top 50 ordering). Display-sorted by expected
  // return (matching this section's title, "AI 本週「預期報酬」強力觀察
  // TOP 10") - a pure reorder of the already-selected 10, never a
  // selection change, so it can't reintroduce the compositeScore-as-
  // selection-key issue fixed earlier (Selection Pipeline audit item #2).
  const visible = filtered.slice(0, 10)
    .slice()
    .sort((a, b) => (Number.isFinite(b.expectedReturnPercent) ? b.expectedReturnPercent : -Infinity) - (Number.isFinite(a.expectedReturnPercent) ? a.expectedReturnPercent : -Infinity));

  el.overviewTop10Tbody.replaceChildren();
  for (const row of visible) {
    const tr = document.createElement('tr');
    for (const text of [String(row.rank), row.symbol, row.companyName ?? '—']) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    const horizonTd = document.createElement('td');
    const horizonPill = document.createElement('span');
    horizonPill.className = `horizon-pill ${horizonPillClass(row.observationHorizons)}`;
    horizonPill.textContent = matchedHorizonLabel(row.observationHorizons);
    horizonTd.append(horizonPill);
    tr.append(horizonTd);
    tr.append(buildRiskTierCell(row));
    const returnTd = document.createElement('td');
    returnTd.className = Number.isFinite(row.expectedReturnPercent) ? (row.expectedReturnPercent >= 0 ? 'value--up' : 'value--down') : '';
    returnTd.textContent = formatPercent(row.expectedReturnPercent);
    tr.append(returnTd);
    for (const text of [formatPrice(row.referencePrice), formatPrice(row.targetPrice)]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    const reasonTd = document.createElement('td');
    reasonTd.textContent = row.recommendationReason && row.recommendationReason.length > 0 ? row.recommendationReason.join('、') : '—';
    tr.append(reasonTd);
    const changeTd = document.createElement('td');
    const arrow = changeArrow(row.market, row.symbol);
    changeTd.textContent = arrow.text;
    if (arrow.className) changeTd.className = arrow.className;
    tr.append(changeTd);
    tr.addEventListener('click', () => {
      el.input.value = row.symbol;
      switchPage('stock');
      loadSymbol(row.symbol);
    });
    el.overviewTop10Tbody.append(tr);
  }
}

// rows: the full Market Top 50 list (already rank-ordered), NOT pre-sliced
// to 10 - each filter tab picks its own top 10 within that horizon, same
// contract change-of-scope as the approved mockup's filter tabs, using
// only the real observation_horizons field already computed server-side.
function renderOverviewTop10(rows) {
  overviewTop10Rows = rows;
  overviewTop10Filter = 'ALL';
  overviewTop10DecisionFilter = 'INVESTABLE_CANDIDATE';
  updateOverviewKpiActiveState();
  renderOverviewTop10Filters();
  renderOverviewTop10Rows();
  const candidates = rows.filter((row) => row.decisionState === 'INVESTABLE_CANDIDATE');
  decisionWatch = { total: candidates.length, symbols: candidates.slice(0, 10).map((row) => ({ symbol: row.symbol, name: row.companyName })) };
  updateDecisionSummary();
}

// Horizon tiles: applies the SAME buildStockRecommendation() the Stock
// Detail page uses to every Market Top 50 symbol (revenueGrowth omitted -
// fetching monthly fundamentals for up to 50 symbols is out of scope
// tonight; classifyInvestmentHorizon still returns honest per-category
// results with fundamentalSignals empty, never a guess). One bounded
// fetch via fetchMarketDailySince's symbols allow-list (tonight's earlier
// fix) instead of the whole market - reusing that fix, not the unbounded
// call it replaced.

async function renderOverviewHorizonTiles(top50Rows, config) {
  el.overviewHorizonGrid.replaceChildren();
  const counts = { DAY_TRADING: 0, SHORT_MEDIUM_TERM: 0, LONG_TERM: 0 };
  let insufficientTotal = 0;

  try {
    const symbols = new Set(top50Rows.map((row) => row.symbol));
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 200); // comfortably covers every horizon rule's lookback (ATR/SMA/momentum), same order of magnitude as the Stock Detail page's own per-symbol fetch.
    const [rows, corporateActionEvents] = await Promise.all([
      fetchMarketDailySince({
        url: config.SUPABASE_URL,
        apiKey: config.SUPABASE_ANON_KEY,
        sinceDate: since.toISOString().slice(0, 10),
        symbols,
        fetchImpl: window.fetch.bind(window)
      }),
      // Best-effort: a fetch failure here must never block horizon
      // classification - degrades to every symbol un-adjusted, same as
      // before this fix (Phase-1 roadmap item "股票分割真正還原").
      fetchCorporateActionEventsBulk({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) }).catch(() => [])
    ]);
    const bySymbol = groupRecordsBySymbol(rows);
    const corporateActionEventsMap = buildCorporateActionEventsMap(corporateActionEvents);
    for (const row of top50Rows) {
      const rawRecords = bySymbol.get(`${row.market}:${row.symbol}`) ?? [];
      if (rawRecords.length === 0) continue;
      const records = buildAdjustedRecommendationRecords(rawRecords, corporateActionEventsMap.get(row.symbol) ?? []);
      const recommendation = buildStockRecommendation(records, null);
      if (!recommendation) continue;
      let anySuitable = false;
      for (const key of HORIZON_TILE_ORDER) {
        const horizon = recommendation.investmentHorizon.horizons[key];
        if (horizon && !horizon.insufficientData && horizon.suitable) {
          counts[key] += 1;
          anySuitable = true;
        }
      }
      if (!anySuitable) insufficientTotal += 1;
    }
  } catch {
    // Horizon tiles are a supplementary breakdown of data already shown in
    // the KPI tiles/TOP-10 table above - a failure here degrades to an
    // honest empty grid rather than blocking the rest of the Overview page.
  }

  for (const key of HORIZON_TILE_ORDER) {
    const tile = document.createElement('div');
    tile.className = 'horizon-tile';
    const head = document.createElement('div');
    head.className = 'horizon-tile__head';
    const icon = document.createElement('span');
    icon.className = `horizon-tile__icon ${HORIZON_TILE_ICON[key].iconClass}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = HORIZON_TILE_ICON[key].icon;
    const label = document.createElement('div');
    label.className = 'horizon-tile__label';
    label.textContent = HORIZON_TILE_LABEL[key];
    head.append(icon, label);
    const count = document.createElement('div');
    count.className = 'horizon-tile__count';
    count.textContent = `${counts[key]} 檔`;
    tile.append(head, count);
    el.overviewHorizonGrid.append(tile);
  }
  const note = document.createElement('p');
  note.className = 'side-panel__note';
  note.textContent = `${insufficientTotal} 檔資料不足，暫無法判斷投資週期（需至少 2 個已驗證訊號同意才分類，不勉強）。一檔股票可能同時符合多個週期。`;
  el.overviewHorizonGrid.append(note);
}

const CHANGE_TYPE_BADGE_CLASS = { NEW: 'badge--investable-candidate', UPGRADED: 'badge--open', DOWNGRADED: 'badge--closed', REMOVED: 'badge--unavailable' };

// "今日 AI 推薦變化" - a real day-over-day diff of Market Top 50's own
// recommendation_score between today's calculation_date and the actual
// previous one (fetchPreviousMarketTop50 resolves it for real, never
// assumes "yesterday"). Purely additive to the KPI/TOP-10 sections above
// - reuses the same rows already fetched for those, only fetches one more
// (bounded) snapshot for the comparison.
async function renderOverviewChanges(currentRows, currentCalculationDate, config) {
  try {
    const { calculationDate: previousCalculationDate, rows: previousRows } = await fetchPreviousMarketTop50({
      url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, beforeDate: currentCalculationDate, fetchImpl: window.fetch.bind(window)
    });
    el.overviewChangesLoading.hidden = true;
    if (!previousCalculationDate) {
      el.overviewChangesEmpty.hidden = false;
      return;
    }

    const changes = computeOverviewChanges(currentRows, previousRows);
    const newCount = changes.filter((c) => c.type === 'NEW').length;
    const upgradedCount = changes.filter((c) => c.type === 'UPGRADED').length;
    const downgradedCount = changes.filter((c) => c.type === 'DOWNGRADED').length;
    const removedCount = changes.filter((c) => c.type === 'REMOVED').length;
    el.overviewChangesSummary.textContent = `比較 ${previousCalculationDate} → ${currentCalculationDate}：共 ${changes.length} 檔變化（新進 ${newCount}、升級 ${upgradedCount}、降級 ${downgradedCount}、移除 ${removedCount}）。`;
    el.overviewChangesNew.textContent = `${newCount} 檔`;
    el.overviewChangesUpgraded.textContent = `${upgradedCount} 檔`;
    el.overviewChangesDowngraded.textContent = `${downgradedCount} 檔`;
    el.overviewChangesRemoved.textContent = `${removedCount} 檔`;

    // Shared with the TOP-10 table's 變化 column (same computeOverviewChanges
    // output, not a second diff) - Top10 already rendered synchronously
    // before this async fetch resolved, so refresh its 變化 cells now.
    overviewChangeByKey = new Map(changes.map((c) => [`${c.market}:${c.symbol}`, c]));
    renderOverviewTop10Rows();

    el.overviewChangesTbody.replaceChildren();
    // Display-order only (same "sort what's already selected" rule as
    // Top10/Market Top 50 above) - every computed change is still shown.
    const changesByScore = changes.slice().sort((a, b) => (Number.isFinite(b.currentScore) ? b.currentScore : -Infinity) - (Number.isFinite(a.currentScore) ? a.currentScore : -Infinity));
    for (const change of changesByScore) {
      const tr = document.createElement('tr');
      const symbolTd = document.createElement('td');
      symbolTd.textContent = change.symbol;
      const nameTd = document.createElement('td');
      nameTd.textContent = change.companyName ?? '—';
      const typeTd = document.createElement('td');
      const typeBadge = document.createElement('span');
      typeBadge.className = `badge ${CHANGE_TYPE_BADGE_CLASS[change.type] ?? ''}`;
      typeBadge.textContent = change.typeLabel;
      typeTd.append(typeBadge);
      const prevTd = document.createElement('td');
      prevTd.textContent = change.previousScore == null ? '—' : change.previousScore.toFixed(1);
      const currTd = document.createElement('td');
      currTd.textContent = change.currentScore == null ? '—' : change.currentScore.toFixed(1);
      const descTd = document.createElement('td');
      descTd.textContent = change.description;
      tr.append(symbolTd, nameTd, typeTd, prevTd, currTd, descTd);
      tr.addEventListener('click', () => {
        el.input.value = change.symbol;
        switchPage('stock');
        loadSymbol(change.symbol);
      });
      el.overviewChangesTbody.append(tr);
    }
    el.overviewChangesBody.hidden = false;
  } catch {
    // Supplementary to the KPI/TOP-10 sections above - a failure here
    // must never block the rest of the Overview page.
    el.overviewChangesLoading.hidden = true;
    el.overviewChangesEmpty.hidden = false;
  }
}

// "AI 評分 TOP 10" (2026-09-23) - a SEPARATE ranking by recommendation_score
// (market_ai_score_ranking, computed by scripts/compute-market-top50.mjs's
// computeAiScoreRanking()), deliberately independent of the Top10/Market
// Top50 section above (which sorts by expected return only). Found via a
// real case (2330: compositeScore 58.8, expected return only +1.0%) that
// never appeared anywhere on the Overview page despite a strong AI score -
// this section is where it's now visible. "雙達標" flags a row that ALSO
// clears the same >=20% expected-return bar (expected-return.js's
// EXPECTED_RETURN_THRESHOLD) "強烈觀察"/INVESTABLE_CANDIDATE
// uses elsewhere - informational only, never fed back into any ranking.
// 「AI 增強指數建議配置」(2026-09-28) - the enhanced-index rule's nightly
// allocation (enhanced_index_allocation, written by
// scripts/shadow-portfolio.mjs). Shows the 20 heaviest names with their
// over/underweight versus plain market-cap weight; the full list stays in
// the table. Additive: a failure never blocks the rest of the page.
const ENHANCED_INDEX_STRATEGY = 'ENHANCED_TOP150_AI_FUNDAMENTAL_INDUSTRY_NEUTRAL';
const ENHANCED_INDEX_ROWS_SHOWN = 20;
// ① 強力推薦投資 = the enhanced index's 10 largest overweights (weight minus
// market-cap weight). The user picked this rule because the enhanced index
// is the only backtest-validated method here; the panel says the validation
// covers the whole allocation, not these 10 alone.
const DECISION_RECOMMEND_COUNT = 10;
const TILT_EPSILON = 0.00005;
// null = not loaded yet; the summary strip fills in as each source arrives.
let decisionRecommend = null;
let decisionWatch = null;

function renderDecisionRecommend(rows, calculationDate) {
  const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : '—');
  const picks = rows
    .map((row) => ({ ...row, tilt: row.weight - row.indexWeight }))
    .filter((row) => Number.isFinite(row.tilt) && row.tilt > TILT_EPSILON)
    .sort((a, b) => b.tilt - a.tilt)
    .slice(0, DECISION_RECOMMEND_COUNT);
  el.decisionRecommendTbody.replaceChildren();
  picks.forEach((row, i) => {
    const tr = document.createElement('tr');
    const cells = [
      String(i + 1), row.symbol, row.companyName ?? '—', industryName(row.industry), pct(row.weight),
      `+${(row.tilt * 100).toFixed(2)} 百分點`, pct(row.indexWeight),
      Number.isFinite(row.factorScore) ? `前 ${Math.max(1, Math.round((1 - row.factorScore) * 100))}%` : '—',
      Number.isFinite(row.compositeScore) ? row.compositeScore.toFixed(1) : '—'
    ];
    cells.forEach((text, k) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (k === 5) td.className = 'kpi-tile__value--up';
      tr.append(td);
    });
    const overlapTd = document.createElement('td');
    overlapTd.dataset.overlapSymbol = row.symbol;
    overlapTd.textContent = '—';
    tr.append(overlapTd);
    tr.addEventListener('click', () => {
      el.input.value = row.symbol;
      switchPage('stock');
      loadSymbol(row.symbol);
    });
    el.decisionRecommendTbody.append(tr);
  });
  decisionRecommend = { calculationDate, symbols: picks.map((row) => ({ symbol: row.symbol, name: row.companyName })) };
  updateDecisionSummary();
}

function markDecisionRecommendUnavailable() {
  el.decisionRecommendCount.textContent = '資料不足';
  el.decisionRecommendSub.textContent = '每日批次尚未產生建議配置';
}

function updateDecisionSummary() {
  if (decisionRecommend) {
    el.decisionRecommendCount.textContent = `${decisionRecommend.symbols.length} 檔`;
    el.decisionRecommendSub.textContent = `增強指數加碼幅度最大的個股｜配置日期 ${decisionRecommend.calculationDate}`;
  }
  if (decisionWatch) {
    el.decisionWatchCount.textContent = `${decisionWatch.total} 檔`;
    el.decisionWatchSub.textContent = `可投資候選（預期報酬 ≥ 20%）｜下方列出前 ${Math.min(10, decisionWatch.total)} 名`;
  }
  if (!decisionRecommend || !decisionWatch) return;
  const watchSymbols = new Set(decisionWatch.symbols.map((item) => item.symbol));
  const overlap = decisionRecommend.symbols.filter((item) => watchSymbols.has(item.symbol));
  el.decisionOverlapCount.textContent = `${overlap.length} 檔`;
  el.decisionOverlapSub.textContent = overlap.length > 0
    ? overlap.map((item) => `${item.symbol} ${item.name ?? ''}`.trim()).join('、')
    : '今日 ① 與 ② 沒有重疊';
  for (const td of el.decisionRecommendTbody.querySelectorAll('[data-overlap-symbol]')) {
    const isOverlap = watchSymbols.has(td.dataset.overlapSymbol);
    td.replaceChildren();
    if (isOverlap) {
      const badge = document.createElement('span');
      badge.className = 'badge badge--investable-candidate';
      badge.textContent = '是';
      td.append(badge);
    } else {
      td.textContent = '—';
    }
  }
}

// 影子追蹤實績 (回測／研究報告 page, 2026-09-29): forward-only results of the
// shadow strategies (shadow_portfolio_performance). Before the first tracked
// session the panel keeps its static "starts 2026-10-02" note. Looks its
// elements up directly so it needs no entry in `el`; additive, never throws.
async function renderShadowPerformance(config) {
  const empty = document.getElementById('shadow-performance-empty');
  const body = document.getElementById('shadow-performance-body');
  const summary = document.getElementById('shadow-performance-summary');
  const tbody = document.getElementById('shadow-performance-tbody');
  if (!empty || !body || !summary || !tbody) return;
  try {
    const { asOfDate, rows } = await fetchShadowPerformance({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    if (!asOfDate || rows.length === 0) return;
    const pct = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '—');
    // Pre-registered verdict (docs/SHADOW_TRACKING_PREREGISTRATION.md, registered 2026-10-01).
    const byStrategy = new Map(rows.map((r) => [r.strategy, r]));
    const subject = byStrategy.get(PREREGISTRATION.subject), reference = byStrategy.get(PREREGISTRATION.reference);
    let verdict = '事前登記判定：尚無受評策略或比較基準的資料';
    if (subject && reference && Number.isFinite(subject.returnPercent) && Number.isFinite(reference.returnPercent)) {
      const j = judgeShadow({ subjectReturn: subject.returnPercent, referenceReturn: reference.returnPercent, controlReturn: byStrategy.get(PREREGISTRATION.control)?.returnPercent ?? null, startDate: subject.startDate, asOfDate });
      const label = { TOO_EARLY: '太早，不判定', CONSISTENT: '與回測一致', WATCH: '觀察', ALERT: '警覺' }[j.status];
      verdict = `事前登記判定（2026-10-01 登記）：${label}｜AI 增強指數相對前 150 大市值加權 ${j.active >= 0 ? '+' : ''}${j.active.toFixed(2)} 個百分點（追蹤 ${(j.years * 12).toFixed(1)} 個月；${j.reasons.join('；')}）`;
    }
    summary.textContent = `資料截至 ${asOfDate}｜累積報酬含交易成本，自各策略首次進場日起算｜${verdict}`;
    tbody.replaceChildren();
    for (const row of rows) {
      const tr = document.createElement('tr');
      [row.label, row.startDate, String(row.rebalances), pct(row.returnPercent), pct(row.benchmarkReturnPercent), pct(row.excessPercent)].forEach((text, k) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (k === 5 && Number.isFinite(row.excessPercent)) td.className = row.excessPercent >= 0 ? 'kpi-tile__value--up' : 'kpi-tile__value--down';
        tr.append(td);
      });
      tbody.append(tr);
    }
    empty.hidden = true;
    body.hidden = false;
  } catch {
    // keeps the static note
  }
}

// 每月可信度稽核 (回測／研究報告 page, 2026-10-01): the last 6 monthly audits
// (scripts/monthly-audit.mjs -> platform_audit_runs, local database only).
// Every mismatch is shown; additive, never throws.
async function renderAuditRuns(config) {
  const empty = document.getElementById('audit-runs-empty');
  const body = document.getElementById('audit-runs-body');
  const tbody = document.getElementById('audit-runs-tbody');
  if (!empty || !body || !tbody) return;
  try {
    const base = String(config.SUPABASE_URL).replace(/\/$/, '');
    const response = await window.fetch(`${base}/rest/v1/platform_audit_runs?select=*&order=audit_month.desc&limit=6`, { headers: { apikey: config.SUPABASE_ANON_KEY, Authorization: `Bearer ${config.SUPABASE_ANON_KEY}` } });
    if (!response.ok) return;
    const runs = await response.json();
    if (runs.length === 0) return;
    const shadowLabel = { NO_DATA: '尚無實績', TOO_EARLY: '太早，不判定', CONSISTENT: '與回測一致', WATCH: '觀察', ALERT: '警覺' };
    const kindLabel = { quote: '股價', revenue: '月營收' };
    tbody.replaceChildren();
    for (const run of runs) {
      const mismatches = Array.isArray(run.mismatches) ? run.mismatches : [];
      const cells = [
        run.audit_month,
        `${run.sample_passed}/${run.sample_size}`,
        shadowLabel[run.shadow_status] ?? run.shadow_status,
        run.pipeline_runs ? `${run.pipeline_success}/${run.pipeline_runs}` : '—',
        mismatches.length ? mismatches.map((m) => `${kindLabel[m.kind] ?? m.kind} ${m.symbol ?? ''} ${m.date ?? m.period ?? ''}：${(m.diffs ?? []).join('；')}`).join('\n') : '無'
      ];
      const tr = document.createElement('tr');
      cells.forEach((text, k) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (k === 4) td.style.whiteSpace = 'pre-line';
        if (k === 2) td.title = run.shadow_detail ?? '';
        tr.append(td);
      });
      tbody.append(tr);
    }
    empty.hidden = true;
    body.hidden = false;
  } catch {
    // keeps the static note
  }
}

// 參數自我校準 (回測／研究報告 page, 2026-10-02): the latest nightly
// parameter_calibration_reports row (scripts/parameter-calibration.mjs,
// local database only). Suggestions only; additive, never throws.
async function renderCalibrationReport(config) {
  const empty = document.getElementById('calibration-empty');
  const body = document.getElementById('calibration-body');
  const summary = document.getElementById('calibration-summary');
  const tbody = document.getElementById('calibration-tbody');
  if (!empty || !body || !summary || !tbody) return;
  try {
    const base = String(config.SUPABASE_URL).replace(/\/$/, '');
    const response = await window.fetch(`${base}/rest/v1/parameter_calibration_reports?select=*&order=report_date.desc&limit=1`, { headers: { apikey: config.SUPABASE_ANON_KEY, Authorization: `Bearer ${config.SUPABASE_ANON_KEY}` } });
    if (!response.ok) return;
    const [report] = await response.json();
    if (!report) return;
    const methodLabel = { DONCHIAN_10: '近 10 日最低價', DONCHIAN_20: '近 20 日最低價', DONCHIAN_40: '近 40 日最低價', DONCHIAN_60: '近 60 日最低價', ATR_2: '收盤價−2×ATR', ATR_3: '收盤價−3×ATR' };
    const regimeLabel = { LOW: '低波動', MID: '中等波動', HIGH: '高波動' };
    const decisionLabel = { KEEP: '維持', SUGGEST_CHANGE: '建議調整', INSUFFICIENT_DATA: '樣本不足' };
    const pctText = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '—');
    const ppText = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}` : '—');
    const configText = (c) => (c ? `${methodLabel[c.riskMethod] ?? c.riskMethod}、門檻 ${Number(c.minRiskReward).toFixed(1)}｜超額 ${ppText(c.meanEdgePct)} 個百分點／筆｜先達目標 ${pctText(c.targetFirstRate)}（隨機基準 ${pctText(c.impliedTargetRate)}）、先破風險價 ${pctText(c.riskFirstRate)}｜訊號 ${c.signals} 筆` : '—');
    tbody.replaceChildren();
    for (const [label, rep, live] of [['一般股票', report.stock, report.live?.STOCK], ['ETF', report.etf, report.live?.ETF]]) {
      const v = rep?.volatility?.current;
      const overall = rep?.overall, regime = rep?.currentRegime;
      const cells = [
        label,
        v ? `${regimeLabel[v.regime] ?? '—'}（年化 ${Number(v.medianVol).toFixed(1)}%）` : '—',
        `${decisionLabel[overall?.decision] ?? '—'}／${decisionLabel[regime?.decision] ?? '—'}\n${(overall?.reasons ?? []).join('；')}`,
        configText(overall?.production),
        configText(overall?.best),
        live && live.matured ? `已到期 ${live.matured}／${live.predictions} 筆：先達目標 ${pctText(live.targetFirstRate)}、先破風險價 ${pctText(live.riskFirstRate)}、平均 ${ppText(live.meanExitReturnPct)}%` : `已記錄 ${live?.predictions ?? 0} 筆，尚未滿 20 個交易日`
      ];
      const tr = document.createElement('tr');
      cells.forEach((text, k) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (k === 2) td.style.whiteSpace = 'pre-line';
        tr.append(td);
      });
      tbody.append(tr);
    }
    const w = report.stock?.window;
    summary.textContent = `報告日 ${report.report_date}｜評估期間 ${w?.from ?? '—'} ～ ${w?.to ?? '—'}（${w?.decisionDates ?? 0} 個決策日，持有 20 個交易日）｜正式參數未變更：風險價＝近 20 日最低價、風險報酬門檻 1.0`;
    empty.hidden = true;
    body.hidden = false;
  } catch {
    // keeps the static note
  }
}

// 買進／賣出 (2026-10-26, Stanley's request): every trade table shows the
// action as a coloured pill - buy blue, sell orange, so it never reads as
// the green / red of profit and loss; a cancelled order is greyed out.
function tradeActionCell(o, { cancelled = true } = {}) {
  const text = o.side === 'BUY' ? '買進' : '賣出';
  const isCancelled = cancelled && o.status === 'CANCELLED';
  return { text: isCancelled ? `${text}（取消）` : text, cls: `trade-action trade-action--${o.side === 'BUY' ? 'buy' : 'sell'}${isCancelled ? ' trade-action--cancelled' : ''}` };
}

// Orders waiting for the next open, as a line of 買進／賣出 pills; null when none.
function renderPendingOrders(entries, make) {
  const pending = entries.flatMap(({ orders, summary }) => orders.filter((o) => o.status === 'PENDING').map((o) => ({ o, summary })));
  if (!pending.length) return null;
  const p = make('p', '下一交易日開盤預定：', 'side-panel__note trade-pending');
  for (const { o, summary } of pending) {
    const { text, cls } = tradeActionCell(o);
    const item = make('span', null, 'trade-pending__item');
    item.append(`${summary.label.replace('帳戶', '')} `, make('span', text, cls), ` ${o.symbol} ${o.detail?.name ?? ''}（${o.reason}）`);
    p.append(item);
  }
  return p;
}

// AI 模擬投資 (AI 智慧選股 page, 2026-10-03): the paper-trading accounts
// written nightly by scripts/ai-simulation.mjs (sim_runs / sim_orders /
// sim_daily, local database only). Additive, never throws.
// Headline tiles for one paper-trading account (public/js/lib/ai-simulation-summary.js).
function renderSimSummary(s, make, extra = null) {
  const money = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('zh-TW') : '—');
  const signedMoney = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${Math.round(x).toLocaleString('zh-TW')}` : '—');
  const pct = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '—');
  const tone = (x) => (Number.isFinite(x) && Math.abs(x) > 1e-9 ? (x > 0 ? 'kpi-tile__value--up' : 'kpi-tile__value--down') : '');
  const tiles = [
    ['淨值', `NT$${money(s.nav)}`, '', s.started ? `資料日 ${s.lastDate}（第 ${s.sessions} 個交易日）` : `待 ${s.startDate} 開盤成交`],
    ['累積報酬', pct(s.returnPct), tone(s.returnPct), `起始 NT$${money(s.initialCash)}`],
    ['同期大盤', pct(s.marketReturnPct), tone(s.marketReturnPct), Number.isFinite(s.marketReturnPct) ? `加權報酬指數（含息）｜0050 參考 ${pct(s.benchmarkReturnPct)}` : `大盤資料待更新｜0050 參考 ${pct(s.benchmarkReturnPct)}`],
    ['超額報酬', Number.isFinite(s.excessPct) ? `${s.excessPct >= 0 ? '+' : ''}${s.excessPct.toFixed(2)} pt` : '—', tone(s.excessPct), '帳戶報酬 − 大盤'],
    ['已實現損益', signedMoney(s.realizedPnl), tone(s.realizedPnl), s.closedTrades ? `賣出 ${s.closedTrades} 筆，獲利 ${s.winningTrades} 筆` : '尚無賣出'],
    ['未實現損益', signedMoney(s.unrealizedPnl), tone(s.unrealizedPnl), `持股 ${s.holdingsCount} 檔｜現金 NT$${money(s.cash)}`],
    ['最大回檔', Number.isFinite(s.maxDrawdownPct) ? `${s.maxDrawdownPct.toFixed(2)}%` : '—', s.maxDrawdownPct < -1e-9 ? 'kpi-tile__value--down' : '', s.pendingOrders ? `待成交委託 ${s.pendingOrders} 筆` : '淨值從高點的最大跌幅'],
    // home page (執行績效總覽, 2026-10-20): win rate and this week / month
    ...(extra ? [
      ['交易勝率', Number.isFinite(s.winRatePct) ? `${s.winRatePct.toFixed(0)}%` : '—', '', s.closedTrades ? `已賣出 ${s.closedTrades} 筆中獲利 ${s.winningTrades} 筆` : '尚無賣出'],
      ...[['本週', extra.week], ['本月', extra.month]].map(([label, p]) => [`${label}表現`, p ? pct(p.returnPct) : '—', p ? tone(p.returnPct) : '', p ? `大盤 ${pct(p.marketPct)}｜自 ${p.from.slice(5).replace('-', '/')} 收盤` : `${label}尚無交易日`]),
      ['勝過大盤的交易日', extra.beat ? `${extra.beat.beat}/${extra.beat.total}` : '—', '', '當日帳戶漲跌優於大盤']
    ] : [])
  ];
  const grid = make('div', null, 'kpi-grid kpi-grid--compact sim-kpi-grid');
  for (const [label, value, cls, sub] of tiles) {
    const tile = make('div', null, 'kpi-tile kpi-tile--static');
    tile.append(make('span', label, 'kpi-tile__label'), make('span', value, `kpi-tile__value ${cls}`.trim()), make('span', sub, 'kpi-tile__sub'));
    grid.append(tile);
  }
  return grid;
}

// Cumulative return vs 0050 as a small inline SVG (no chart library needed
// for six to twenty points). Returns null before the first session.
function renderSimReturnChart(days) {
  const chart = buildReturnChart(days);
  if (!chart) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const node = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
    if (text != null) n.textContent = text;
    return n;
  };
  const figure = document.createElement('figure');
  figure.className = 'sim-chart';
  const svg = node('svg', { viewBox: `0 0 ${chart.width} ${chart.height}`, role: 'img', 'aria-label': '累積報酬與同期大盤、0050 走勢' });
  for (const tick of chart.yTicks) {
    svg.append(node('line', { x1: chart.plot.left, x2: chart.plot.right, y1: tick.y, y2: tick.y, class: 'sim-chart__grid' }));
    svg.append(node('text', { x: chart.plot.left - 6, y: tick.y + 4, 'text-anchor': 'end', class: 'sim-chart__label' }, `${tick.value.toFixed(1)}%`));
  }
  svg.append(node('line', { x1: chart.plot.left, x2: chart.plot.right, y1: chart.zeroY, y2: chart.zeroY, class: 'sim-chart__zero' }));
  const every = Math.max(1, Math.ceil(chart.xLabels.length / 8));
  chart.xLabels.forEach((label, i) => {
    if (i % every === 0 || i === chart.xLabels.length - 1) svg.append(node('text', { x: label.x, y: chart.height - 8, 'text-anchor': 'middle', class: 'sim-chart__label' }, label.text));
  });
  if (chart.benchmark) svg.append(node('polyline', { points: chart.benchmark, class: 'sim-chart__line sim-chart__line--benchmark' }));
  if (chart.market) svg.append(node('polyline', { points: chart.market, class: 'sim-chart__line sim-chart__line--market' }));
  if (chart.strategy) svg.append(node('polyline', { points: chart.strategy, class: 'sim-chart__line sim-chart__line--strategy' }));
  const caption = document.createElement('figcaption');
  caption.className = 'sim-chart__legend';
  caption.innerHTML = '<span class="sim-chart__key sim-chart__key--strategy"></span>帳戶累積報酬　<span class="sim-chart__key sim-chart__key--market"></span>同期大盤　<span class="sim-chart__key sim-chart__key--benchmark"></span>0050（參考）';
  figure.append(svg, caption);
  return figure;
}

async function renderAiSimulation(config) {
  const empty = document.getElementById('ai-sim-empty');
  const body = document.getElementById('ai-sim-body');
  const loading = document.getElementById('perf-loading');
  const perfBody = document.getElementById('perf-body');
  if (!empty || !body) return;
  const showEmpty = () => {
    if (loading) loading.hidden = true;
    empty.hidden = false;
    for (const prefix of ['dash', 'pf']) {
      const [pageLoading, pageEmpty] = [`${prefix}-loading`, `${prefix}-empty`].map((id) => document.getElementById(id));
      if (pageLoading) pageLoading.hidden = true;
      if (pageEmpty) pageEmpty.hidden = false;
    }
  };
  try {
    const base = String(config.SUPABASE_URL).replace(/\/$/, '');
    const headers = { apikey: config.SUPABASE_ANON_KEY, Authorization: `Bearer ${config.SUPABASE_ANON_KEY}` };
    const get = async (q) => { const r = await window.fetch(`${base}/rest/v1/${q}`, { headers }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
    const runs = await get('sim_runs?select=*&order=run_id.asc');
    if (runs.length === 0) { showEmpty(); return; }
    const money = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x)).toLocaleString('zh-TW') : '—');
    const signed = (x, d = 2) => (Number.isFinite(Number(x)) ? `${Number(x) >= 0 ? '+' : ''}${Number(x).toFixed(d)}` : '—');
    const rate = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '—');
    const make = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
    const table = (head, rows, colorCol = -1) => {
      const wrap = make('div', null, 'table-scroll');
      const t = make('table', null, 'data-table data-table--wrap');
      const tr = make('tr');
      head.forEach((h) => tr.append(make('th', h)));
      const thead = make('thead'); thead.append(tr);
      const tbody = make('tbody');
      for (const row of rows) {
        const r = make('tr');
        row.forEach((cell, k) => {
          // a { text, cls } cell is a labelled pill (買進／賣出, see tradeActionCell)
          const pill = typeof cell === 'object' && cell !== null;
          const td = make('td', pill ? null : cell);
          if (pill) td.append(make('span', cell.text, cell.cls));
          if (k === colorCol && typeof cell === 'string' && /^[+-]/.test(cell) && cell !== '—') td.className = cell.startsWith('-') ? 'kpi-tile__value--down' : 'kpi-tile__value--up';
          r.append(td);
        });
        tbody.append(r);
      }
      t.append(thead, tbody); wrap.append(t);
      return wrap;
    };
    body.replaceChildren();
    const loaded = await Promise.all(runs.map(async (run) => {
      const [days, orders] = await Promise.all([
        get(`sim_daily?select=*&run_id=eq.${run.run_id}&order=trading_date.asc`),
        get(`sim_orders?select=*&run_id=eq.${run.run_id}&order=id.asc`)
      ]);
      return { run, days, orders, summary: summarizeSimRun({ run, days, orders }) };
    }));
    // Current round first (active, newest start), finished rounds below and
    // collapsed - the headline is "how is the round in progress doing".
    loaded.sort((a, b) => (a.run.status === b.run.status ? String(b.run.start_date).localeCompare(String(a.run.start_date)) || String(a.run.account_class).localeCompare(String(b.run.account_class)) : a.run.status === 'ACTIVE' ? -1 : 1));
    const today = taipeiToday();
    // Home page (執行績效總覽): headline round, holdings, latest trades, shadow rounds, data status
    const headlineIds = renderPerformanceOverview(loaded, { make, table, money, signed, today });
    renderPerformanceDashboard(loaded, { make, table, money, today });
    renderPortfolioPage(loaded, { make, table, money });
    renderPredictionCheck(loaded, { make, table });
    // Detail: every round folded, newest first (the headline round's tiles and chart are already above)
    for (const { run, days, orders, summary } of loaded) {
      const last = days.at(-1);
      const finished = run.status === 'FINISHED';
      const pctOf = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '—');
      const section = make('details', null, 'sim-details');
      section.append(make('summary', `${summary.shadow ? 'Shadow・' : ''}${summary.label}（${run.start_date} ～ ${run.end_date}，${finished ? '已結束' : '進行中'}${summary.rulesVersion ? `，第 ${summary.rulesVersion} 版規則` : ''}）　報酬 ${pctOf(summary.returnPct)}｜大盤 ${pctOf(summary.marketReturnPct)}｜0050 ${pctOf(summary.benchmarkReturnPct)}`));
      body.append(section);
      if (!headlineIds.has(run.run_id)) {
        section.append(renderSimSummary(summary, make));
        const chart = renderSimReturnChart(days);
        if (chart) section.append(chart);
      }
      const principles = run.rules?.principles;
      if (principles) {
        section.append(make('p', `異動原則（第 ${run.rules.version} 版，模擬期間不變更）`, 'side-panel__note'));
        const ul = make('ul');
        Object.entries(principles).forEach(([code, text]) => ul.append(make('li', `${code}　${text}`)));
        section.append(ul);
      }
      const verification = days[0]?.feedback?.verification;
      if (verification && !verification.error) {
        section.append(make('p', `AI 評分公式驗證（${days[0].trading_date}）：獨立重算與正式評分一致 ${verification.formulaMatches}/${verification.universe} 檔${verification.rawChecked ? `；買進個股的四項輸入由原始月營收／季報重算，一致 ${verification.rawMatches}/${verification.rawChecked} 檔` : ''}${[...(verification.formulaMismatches ?? []).map((m) => `${m.symbol} 正式 ${m.production}／重算 ${m.hand}`), ...(verification.rawMismatches ?? []).map((m) => `${m.symbol} ${m.fields.join('、')} 不一致`)].map((t) => `｜${t}`).join('')}`, 'side-panel__source'));
      }
      const outcome = days.at(-1)?.feedback?.outcome;
      if (outcome && !outcome.error) {
        section.append(make('p', `評分與實際報酬：候選 ${outcome.n} 檔，排名相關係數 ${outcome.rankCorrelation == null ? '—' : outcome.rankCorrelation.toFixed(3)}（${outcome.backtestReference}）｜${outcome.bands.map((b) => `${b.range} 分 ${b.n} 檔平均 ${signed(b.meanReturnPct)}%`).join('、')}`, 'side-panel__source'));
      }
      if (last) {
        const f = last.feedback ?? {};
        const started = days.length > 1;
        section.append(make('p', started
          ? `資料日 ${last.trading_date}｜淨值 NT$${money(last.nav)}（報酬 ${signed(last.return_pct)}%）｜同期大盤 ${last.feedback?.market ? `${signed(last.feedback.market.returnPct)}%` : '—'}｜0050 參考 ${signed(last.benchmark_return_pct)}%｜現金 NT$${money(last.cash)}｜持股 ${last.holdings.length} 檔`
          : `起始資金 NT$${money(run.initial_cash)}｜已依 ${last.trading_date} 收盤後資料下單，${run.start_date} 開盤成交`, 'side-panel__source'));
        if (started) {
          section.append(make('p', `參數驗證（第 ${f.day ?? '—'} 個交易日）：有平台目標價／風險價的買進 ${f.withLevels ?? 0} 筆，觸及風險價 ${f.riskHits ?? 0} 筆（${rate(f.actualRiskRate)}；歷史同期 ${rate(f.expectedRiskRate)}）、達目標價 ${f.targetHits ?? 0} 筆（${rate(f.actualTargetRate)}；歷史同期 ${rate(f.expectedTargetRate)}）${f.ordersForNext?.length ? `｜下一交易日預定：${f.ordersForNext.join('、')}` : ''}`, 'side-panel__note'));
        }
        if (last.holdings.length) {
          section.append(table(['代號', '名稱', '股數', '成本', '收盤', '市值', '損益', '目標價', '風險價'], last.holdings.map((h) => [
            h.symbol, h.name ?? '—', money(h.shares), money(h.cost), String(h.lastClose), money(h.marketValue), signed(h.pnl, 0), h.target ?? '—', h.risk ?? '—'
          ]), 6));
        }
      }
      if (orders.length) {
        section.append(make('p', '交易紀錄', 'side-panel__note'));
        section.append(table(['決策日', '成交日', '動作', '代號', '名稱', '股數', '價格', '原則', '原因', '狀態', '損益'], orders.map((o) => [
          o.decision_date, o.exec_date ?? '—', tradeActionCell(o, { cancelled: false }), o.symbol, o.detail?.name ?? '—',
          o.status === 'FILLED' ? money(o.shares) : '—', o.price == null ? '—' : String(o.price), o.detail?.rule ?? '—', o.reason,
          { PENDING: '待開盤成交', FILLED: '已成交', CANCELLED: `取消（${o.detail?.cancelReason ?? ''}）` }[o.status], o.detail?.pnl == null ? '—' : signed(o.detail.pnl, 0)
        ]), 10));
      }
      if (days.length > 1) {
        section.append(make('p', '每日淨值', 'side-panel__note'));
        section.append(table(['日期', '淨值', '報酬', '大盤', '0050（參考）', '持股數', '當日說明'], days.map((d) => [d.trading_date, money(d.nav), `${signed(d.return_pct)}%`, d.feedback?.market ? `${signed(d.feedback.market.returnPct)}%` : '—', d.benchmark_return_pct == null ? '—' : `${signed(d.benchmark_return_pct)}%`, String(d.holdings.length), [d.feedback?.note, ...(d.feedback?.deferred ?? []), ...(d.feedback?.skipped ?? []), ...(d.feedback?.waitingForData ?? []), ...(d.feedback?.events ?? []).filter((e) => e.type !== 'DATA_GAP_WAIT').map((e) => `${e.symbol} 除權息入帳 ${money(e.amount)} 元`)].filter(Boolean).join('；') || '—']), 2));
      }
    }
    empty.hidden = true;
    body.hidden = false;
    if (loading) loading.hidden = true;
    if (perfBody) perfBody.hidden = false;
  } catch {
    showEmpty();
  }
}

// 執行績效總覽 (home page, 2026-10-20): the headline round's KPI tiles
// (fee0b7e's renderSimSummary plus win rate / week / month), its return
// chart, merged holdings, latest trades, shadow rounds and data status.
// Returns the run_ids shown as the headline so the detail list does not
// repeat their tiles.
function renderPerformanceOverview(loaded, { make, table, money, signed, today }) {
  const headlineBox = document.getElementById('perf-headline');
  const status = document.getElementById('perf-status');
  const holdingsBox = document.getElementById('perf-holdings');
  const tradesBox = document.getElementById('perf-trades');
  const shadowPanel = document.getElementById('perf-shadow-panel');
  const shadowBox = document.getElementById('perf-shadow');
  if (!headlineBox || !status || !holdingsBox || !tradesBox) return new Set();
  const { headline, shadow } = pickHeadlineRuns(loaded);
  const pct = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '—');

  // data status: the latest processed session of each active round, with the weekday-based staleness estimate
  status.replaceChildren();
  const active = loaded.filter((e) => e.run.status === 'ACTIVE');
  const lastDates = [...new Set(active.map((e) => e.summary.lastDate).filter(Boolean))].sort();
  const latest = lastDates.at(-1) ?? null;
  const missed = latest ? missedWeekdays(latest, today) : null;
  const stale = missed > 0;
  status.className = `perf-status${stale ? ' perf-status--stale' : ''}`;
  status.append(
    make('span', `模擬資料日 ${latest ?? '—'}`, 'perf-status__item perf-status__item--strong'),
    make('span', active.length ? `進行中 ${active.length} 個帳戶${lastDates.length > 1 ? `（資料日不一致：${lastDates.join('、')}）` : ''}` : '目前沒有進行中的回合', 'perf-status__item'),
    make('span', stale ? `⚠ 之後約 ${missed} 個交易日尚未處理（以週一至週五估算，未扣國定假日）；通常是正式機排程未執行，恢復後會依序補算` : '每個交易日收盤後由正式機排程更新', 'perf-status__item')
  );

  headlineBox.replaceChildren();
  for (const { run, days, summary } of headline) {
    const panel = make('section', null, 'side-panel side-panel--primary');
    panel.append(make('h2', `${summary.label}　${run.start_date} ～ ${run.end_date}（${run.status === 'FINISHED' ? '已結束' : `進行中，第 ${summary.sessions} 個交易日`}）`));
    panel.append(renderSimSummary(summary, make, { ...weekAndMonthReturns(days, today), beat: sessionsBeatingBenchmark(days) }));
    const chart = renderSimReturnChart(days);
    if (chart) panel.append(chart);
    headlineBox.append(panel);
  }

  // holdings of the headline round, both accounts in one table
  holdingsBox.replaceChildren();
  const holdingRows = headline.flatMap(({ days, summary }) => (days.at(-1)?.holdings ?? []).map((h) => {
    const pnlPct = Number(h.cost) > 0 && Number.isFinite(Number(h.pnl)) ? (Number(h.pnl) / Number(h.cost)) * 100 : null;
    return [summary.label.replace('帳戶', ''), h.symbol, h.name ?? '—', money(h.shares), money(h.cost), money(h.marketValue), signed(h.pnl, 0), pct(pnlPct), h.buyDate ?? '—', h.risk ?? '—', h.target ?? '—'];
  }));
  holdingsBox.append(holdingRows.length
    ? table(['帳戶', '代號', '名稱', '股數', '成本', '市值', '損益', '報酬', '買進日', '風險價', '目標價'], holdingRows, 6)
    : make('p', '目前沒有持股。', 'side-panel__note'));
  const pending = renderPendingOrders(headline, make);
  if (pending) holdingsBox.append(pending);

  // latest trades of the headline round
  tradesBox.replaceChildren();
  const trades = recentTrades(headline, 12);
  tradesBox.append(trades.length
    ? table(['成交日', '帳戶', '動作', '代號', '名稱', '股數', '價格', '原則', '原因', '損益'], trades.map((o) => [
      o.exec_date ?? '—', o.accountLabel.replace('帳戶', ''), tradeActionCell(o), o.symbol, o.detail?.name ?? '—',
      o.status === 'FILLED' ? money(o.shares) : '—', o.price == null ? '—' : String(o.price), o.detail?.rule ?? '—',
      o.status === 'CANCELLED' ? `${o.reason}：${o.detail?.cancelReason ?? ''}` : o.reason, o.detail?.pnl == null ? '—' : signed(o.detail.pnl, 0)
    ]), 9)
    : make('p', '尚無成交紀錄。', 'side-panel__note'));
  tradesBox.append(make('p', '完整交易紀錄見下方「明細」。', 'side-panel__source'));

  // shadow rounds next to the official round over the same sessions
  if (shadowPanel && shadowBox) {
    shadowBox.replaceChildren();
    if (shadow.length) {
      const officialByClass = new Map(headline.map((e) => [e.run.account_class, e]));
      shadowBox.append(table(['帳戶', '期間', '規則', '資料日', '報酬', '同期大盤', '超額', '正式回合同期', '最大回檔', '勝率'], shadow.map(({ run, days, summary }) => {
        const official = officialByClass.get(run.account_class);
        // the official round over the shadow round's own sessions (from the shadow round's starting row)
        const base = official && days[0] ? official.days.filter((d) => d.trading_date <= days[0].trading_date).at(-1) : null;
        const officialLast = official?.days.at(-1);
        const same = base && officialLast && base !== officialLast ? (Number(officialLast.nav) / Number(base.nav) - 1) * 100 : null;
        return [summary.label.replace('帳戶', ''), `${run.start_date} ～ ${run.end_date}`, `第 ${summary.rulesVersion ?? '—'} 版${run.rules?.levels?.riskMethod === 'NONE' ? '＋不設停利停損' : run.rules?.levels ? `＋風險價 ${{ ATR_2: '收盤−2×ATR', ATR_3: '收盤−3×ATR' }[run.rules.levels.riskMethod] ?? run.rules.levels.riskMethod}` : ''}`, summary.lastDate ?? '—', pct(summary.returnPct), pct(summary.marketReturnPct),
          Number.isFinite(summary.excessPct) ? `${summary.excessPct >= 0 ? '+' : ''}${summary.excessPct.toFixed(2)} pt` : '—', pct(same),
          Number.isFinite(summary.maxDrawdownPct) ? `${summary.maxDrawdownPct.toFixed(2)}%` : '—', Number.isFinite(summary.winRatePct) ? `${summary.winRatePct.toFixed(0)}%` : '—'];
      }), 6));
      shadowPanel.hidden = false;
    } else {
      shadowPanel.hidden = true;
    }
  }
  return new Set(headline.map((e) => e.run.run_id));
}

// 投資績效儀表板 (home page, 2026-10-26, Stanley's request: 執行績效總覽
// had too much to read at a glance): for the headline round only - each
// account's return against 大盤 in words and one big number, one chart
// with both accounts, 大盤 and 0050, the stocks that made / lost the most, and
// how many buys / sells. Everything else stays on 執行績效總覽.
function renderPerformanceDashboard(loaded, { make, money, today }) {
  const box = { status: 'dash-status', accounts: 'dash-accounts', chart: 'dash-chart', movers: 'dash-movers', activity: 'dash-activity', body: 'dash-body', loading: 'dash-loading', empty: 'dash-empty' };
  for (const key of Object.keys(box)) box[key] = document.getElementById(box[key]);
  if (Object.values(box).some((n) => !n)) return;
  const { headline } = pickHeadlineRuns(loaded);
  box.loading.hidden = true;
  if (!headline.length) { box.empty.hidden = false; return; }
  const pct = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '—');
  const signedMoney = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x)).toLocaleString('zh-TW')}` : '—');
  const tone = (x) => (Number.isFinite(x) && Math.abs(x) > 1e-9 ? (x > 0 ? 'value--up' : 'value--down') : '');

  const lead = headline[0].summary;
  const lastDates = [...new Set(headline.map((e) => e.summary.lastDate).filter(Boolean))].sort();
  const latest = lastDates.at(-1) ?? null;
  const missed = latest ? missedWeekdays(latest, today) : null;
  box.status.className = `perf-status${missed > 0 ? ' perf-status--stale' : ''}`;
  box.status.replaceChildren(
    make('span', `資料日 ${latest ?? '—'}`, 'perf-status__item perf-status__item--strong'),
    make('span', `本輪 ${lead.startDate} ～ ${lead.endDate}，${lead.status === 'FINISHED' ? '已結束' : `進行中（第 ${lead.sessions} 個交易日）`}`, 'perf-status__item'),
    make('span', missed > 0 ? `⚠ 之後約 ${missed} 個交易日尚未更新（以週一至週五估算，未扣國定假日）` : '每個交易日收盤後更新', 'perf-status__item')
  );

  // one card per account: the return, the verdict against 大盤 (0050 for reference), four facts
  box.accounts.replaceChildren();
  for (const { summary: s } of headline) {
    const card = make('section', null, 'dash-card');
    card.append(make('h3', s.label, 'dash-card__title'));
    const big = make('div', null, 'dash-card__headline');
    big.append(make('span', pct(s.returnPct), `dash-card__return ${tone(s.returnPct)}`.trim()), make('span', `同期大盤 ${pct(s.marketReturnPct)}｜0050 參考 ${pct(s.benchmarkReturnPct)}`, 'dash-card__bench'));
    card.append(big);
    if (Number.isFinite(s.excessPct)) {
      const ahead = s.excessPct >= 0;
      card.append(make('p', `${ahead ? '贏過' : '輸給'}大盤 ${Math.abs(s.excessPct).toFixed(2)} 個百分點`, `dash-card__verdict dash-card__verdict--${ahead ? 'ahead' : 'behind'}`));
    } else {
      card.append(make('p', s.started ? '大盤資料待下次排程更新' : `待 ${s.startDate} 開盤成交`, 'dash-card__verdict'));
    }
    const pnl = Number.isFinite(s.nav) && Number.isFinite(s.initialCash) ? s.nav - s.initialCash : null;
    const facts = make('dl', null, 'dash-card__facts');
    for (const [label, value, cls] of [
      ['目前淨值', `NT$${money(s.nav)}`, ''],
      ['損益金額', signedMoney(pnl), tone(pnl)],
      ['最大回檔', Number.isFinite(s.maxDrawdownPct) ? `${s.maxDrawdownPct.toFixed(2)}%` : '—', ''],
      ['賣出勝率', Number.isFinite(s.winRatePct) ? `${s.winRatePct.toFixed(0)}%（${s.winningTrades}/${s.closedTrades}）` : '尚無賣出', '']
    ]) {
      const item = make('div');
      item.append(make('dt', label), make('dd', value, cls || null));
      facts.append(item);
    }
    card.append(facts);
    box.accounts.append(card);
  }

  // both accounts, 大盤 and 0050 on one chart
  box.chart.replaceChildren();
  const keys = [...headline.map((e) => e.summary.accountClass), 'market', 'benchmark'];
  const chart = buildLinesChart(mergeReturnSeries(headline), keys);
  if (chart) {
    const ns = 'http://www.w3.org/2000/svg';
    const node = (tag, attrs, text) => {
      const n = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
      if (text != null) n.textContent = text;
      return n;
    };
    const lineClass = (key) => ({ benchmark: 'benchmark', market: 'market', ETF: 'etf' })[key] ?? 'strategy';
    const figure = make('figure', null, 'sim-chart dash-chart');
    const svg = node('svg', { viewBox: `0 0 ${chart.width} ${chart.height}`, role: 'img', 'aria-label': '各帳戶累積報酬與同期大盤、0050 走勢' });
    for (const tick of chart.yTicks) {
      svg.append(node('line', { x1: chart.plot.left, x2: chart.plot.right, y1: tick.y, y2: tick.y, class: 'sim-chart__grid' }));
      svg.append(node('text', { x: chart.plot.left - 6, y: tick.y + 4, 'text-anchor': 'end', class: 'sim-chart__label' }, `${tick.value.toFixed(1)}%`));
    }
    svg.append(node('line', { x1: chart.plot.left, x2: chart.plot.right, y1: chart.zeroY, y2: chart.zeroY, class: 'sim-chart__zero' }));
    const every = Math.max(1, Math.ceil(chart.xLabels.length / 8));
    chart.xLabels.forEach((label, i) => {
      if (i % every === 0 || i === chart.xLabels.length - 1) svg.append(node('text', { x: label.x, y: chart.height - 8, 'text-anchor': 'middle', class: 'sim-chart__label' }, label.text));
    });
    // 0050 and 大盤 drawn first so the accounts sit on top
    for (const key of [...keys].reverse()) {
      if (chart.lines[key]) svg.append(node('polyline', { points: chart.lines[key], class: `sim-chart__line sim-chart__line--${lineClass(key)}` }));
    }
    const legend = make('figcaption', null, 'sim-chart__legend');
    for (const key of keys) {
      const label = { benchmark: '0050（參考）', market: '同期大盤' }[key] ?? headline.find((e) => e.summary.accountClass === key).summary.label;
      legend.append(make('span', null, `sim-chart__key sim-chart__key--${lineClass(key)}`), `${label}　`);
    }
    figure.append(svg, legend);
    box.chart.append(figure);
  } else {
    box.chart.append(make('p', '第一個交易日後才有走勢。', 'side-panel__note'));
  }

  // the three stocks that made the most and the three that lost the most
  box.movers.replaceChildren();
  const contributions = symbolContributions(headline);
  const winners = contributions.filter((c) => c.total > 0).slice(0, 3);
  const losers = contributions.filter((c) => c.total < 0).slice(-3).reverse();
  const scale = Math.max(1, ...[...winners, ...losers].map((c) => Math.abs(c.total)));
  const moverList = (title, rows) => {
    const group = make('div', null, 'dash-movers__group');
    group.append(make('h3', title, 'dash-movers__title'));
    if (!rows.length) group.append(make('p', '無', 'side-panel__note'));
    for (const c of rows) {
      const row = make('div', null, 'dash-mover');
      const label = make('span', null, 'dash-mover__label');
      label.append(`${c.name ?? c.symbol} `, make('small', `${c.symbol}・${c.account.replace('帳戶', '')}・${c.holding ? '持有中' : '已賣出'}`));
      const track = make('span', null, 'dash-mover__track');
      const fill = make('span', null, `dash-mover__bar dash-mover__bar--${c.total >= 0 ? 'up' : 'down'}`);
      fill.style.width = `${Math.max(2, (Math.abs(c.total) / scale) * 100).toFixed(1)}%`;
      track.append(fill);
      row.append(label, track, make('span', signedMoney(c.total), `dash-mover__value ${tone(c.total)}`.trim()));
      group.append(row);
    }
    return group;
  };
  box.movers.append(moverList('賺最多', winners), moverList('賠最多', losers));

  // how many buys / sells, and what is waiting for the next open
  box.activity.replaceChildren();
  for (const { summary, orders } of headline) {
    const a = tradeActivity(orders);
    const row = make('div', null, 'dash-activity__row');
    const counts = make('span', null, 'dash-activity__counts');
    const sellReasons = [['停損', a.stopLoss], ['停利', a.takeProfit], ['名次調整', a.rankExit]].filter(([, n]) => n).map(([label, n]) => `${label} ${n}`);
    counts.append(
      make('span', `買進 ${a.buys} 筆`, 'trade-action trade-action--buy'), ' ',
      make('span', `賣出 ${a.sells} 筆`, 'trade-action trade-action--sell'),
      sellReasons.length ? `（${sellReasons.join('、')}）` : '',
      a.cancelled ? `　取消 ${a.cancelled} 筆` : ''
    );
    row.append(make('span', summary.label, 'dash-activity__account'), counts);
    box.activity.append(row);
  }
  box.activity.append(renderPendingOrders(headline, make) ?? make('p', '下一交易日沒有預定買賣。', 'side-panel__note'));

  box.body.hidden = false;
}

// 預估與實際對照 (2026-10-26, Stanley's request): every filled buy of the
// headline round, the algorithm's estimate at the decision against what
// happened (predictionVsActual); per account the actual target / risk hit
// rates against the calibration's expected rates.
const PREDICTION_OUTCOME = {
  TARGET: ['達目標價賣出', 'value--up'],
  RISK: ['觸及風險價賣出', 'value--down'],
  RANK: ['名次調整賣出', ''],
  OTHER: ['其他賣出', ''],
  OPEN: ['持有中', '']
};
function renderPredictionCheck(loaded, { make, table }) {
  const box = document.getElementById('dash-predict');
  if (!box) return;
  const { headline } = pickHeadlineRuns(loaded);
  box.replaceChildren();
  if (!headline.length) return;
  const pct = (x, d = 1) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(d)}%` : '—');
  const rate = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '—');
  const all = [];
  const summaryRows = headline.map(({ summary, days, orders }) => {
    const rows = predictionVsActual([{ summary, days, orders }]);
    all.push(...rows);
    const s = predictionSummary(rows, days.at(-1)?.feedback);
    const leveled = rows.filter((r) => r.hasLevels);
    const count = (exit) => leveled.filter((r) => r.exit === exit).length;
    return [
      summary.label.replace('帳戶', ''), String(s.buys), pct(s.meanSlippagePct, 2), `${s.withLevels} 筆`,
      s.withLevels ? `${count('TARGET')} 筆（${rate(s.targetRate)}）／預估 ${rate(s.expectedTargetRate)}` : '—',
      s.withLevels ? `${count('RISK')} 筆（${rate(s.riskRate)}）／預估 ${rate(s.expectedRiskRate)}` : '—',
      s.withLevels ? `${pct(s.meanExpectedUpPct)}／${pct(s.meanExpectedDownPct)}` : '—',
      pct(s.meanActualLeveledPct), pct(s.meanActualPct)
    ];
  });
  box.append(table(['帳戶', '買進', '成交價對決策日收盤', '買進時有平台價位', '達目標價：實際／預估', '觸及風險價：實際／預估', '預估空間（目標／風險）', '有價位者實際報酬', '全部實際報酬'], summaryRows));

  // findings the table makes visible: targets passed without a sale, risk prices broken without a sale
  const passed = all.filter((r) => r.exit === 'OPEN' && r.progressPct >= 100);
  const broken = all.filter((r) => r.exit === 'OPEN' && r.progressPct !== null && r.progressPct <= 0);
  const notes = [];
  if (passed.length) notes.push(`${passed.map((r) => r.name ?? r.symbol).join('、')} 目前已高於買進時的目標價，但沒有賣出：之後每晚更新的價位取代了原本的目標價。`);
  if (broken.length) notes.push(`${broken.map((r) => r.name ?? r.symbol).join('、')} 目前已低於買進時的風險價，但仍持有：之後每晚更新的價位取代了原本的風險價。`);
  const noLevels = all.filter((r) => !r.hasLevels).length;
  if (noLevels) notes.push(`${all.length} 筆買進中有 ${noLevels} 筆在買進時沒有平台價位（風險報酬未達顯示門檻），無法對照預估。`);
  for (const n of notes) box.append(make('p', n, 'side-panel__note'));

  const details = make('details', null, 'sim-details');
  details.append(make('summary', `逐筆對照（${all.length} 筆買進）`));
  details.append(table(['帳戶', '股票', '買進日', '決策日收盤 → 成交價', '目標價（預估空間）', '風險價（預估空間）', '結果', '出場價／目前收盤', '實際報酬', '位置（風險價 0%～目標價 100%）'], all.map((r) => {
    const [label] = PREDICTION_OUTCOME[r.exit] ?? [r.exit];
    const outcome = r.exit === 'OPEN' && r.progressPct >= 100 ? '持有中（已超過目標價）' : r.exit === 'OPEN' && r.progressPct !== null && r.progressPct <= 0 ? '持有中（已低於風險價）' : label;
    return [
      r.account.replace('帳戶', ''), `${r.name ?? ''} ${r.symbol}`.trim(), r.buyDate ?? '—',
      `${r.decisionClose ?? '—'} → ${r.fill ?? '—'}（${pct(r.slippagePct, 2)}）`,
      r.target === null ? '—' : `${r.target}（${pct(r.expectedUpPct)}）`,
      r.risk === null ? '—' : `${r.risk}（${pct(r.expectedDownPct)}）`,
      outcome, r.exitPrice === null ? '—' : String(r.exitPrice), pct(r.actualPct),
      r.progressPct === null ? '—' : `${r.progressPct.toFixed(0)}%`
    ];
  }), 8));
  box.append(details);
}

// 投資組合 (2026-10-26, Stanley's request): per headline account, how much
// is invested vs cash, each holding's weight as a bar, and a table with
// return on cost and the distance to the platform's risk / target price.
function renderPortfolioPage(loaded, { make, table, money }) {
  const [box, body, loading, empty] = ['pf-accounts', 'pf-body', 'pf-loading', 'pf-empty'].map((id) => document.getElementById(id));
  if (!box || !body || !loading || !empty) return;
  const { headline } = pickHeadlineRuns(loaded);
  loading.hidden = true;
  if (!headline.length) { empty.hidden = false; return; }
  const pct = (x, d = 2) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(d)}%` : '—');
  const share = (x) => (Number.isFinite(x) ? `${x.toFixed(1)}%` : '—');
  box.replaceChildren();
  for (const { summary, days, orders } of headline) {
    const c = portfolioComposition(days.at(-1));
    const panel = make('section', null, 'side-panel');
    panel.append(make('h2', `${summary.label}　資料日 ${c.date ?? '—'}`));
    const facts = make('div', null, 'kpi-grid kpi-grid--compact sim-kpi-grid');
    for (const [label, value, sub] of [
      ['帳戶淨值', `NT$${money(c.nav)}`, `持股 ${c.holdings.length} 檔`],
      ['持股比例', share(c.investedPct), `現金 NT$${money(c.cash)}（${share(c.cashPct)}）`],
      ['前三大持股', share(c.top3Pct), '占淨值比例，越高越集中'],
      ['待成交委託', String(orders.filter((o) => o.status === 'PENDING').length), '下一交易日開盤']
    ]) {
      const tile = make('div', null, 'kpi-tile kpi-tile--static');
      tile.append(make('span', label, 'kpi-tile__label'), make('span', value, 'kpi-tile__value'), make('span', sub, 'kpi-tile__sub'));
      facts.append(tile);
    }
    panel.append(facts);

    // weights as bars, cash last
    const bars = make('div', null, 'pf-weights');
    const scale = Math.max(1, ...c.holdings.map((h) => h.weightPct ?? 0), c.cashPct ?? 0);
    const bar = (label, sub, weight, cls) => {
      const row = make('div', null, 'dash-mover');
      const name = make('span', null, 'dash-mover__label');
      name.append(`${label} `, make('small', sub));
      const track = make('span', null, 'dash-mover__track');
      const fill = make('span', null, `dash-mover__bar ${cls}`);
      fill.style.width = `${Math.max(1, ((weight ?? 0) / scale) * 100).toFixed(1)}%`;
      track.append(fill);
      row.append(name, track, make('span', share(weight), 'dash-mover__value'));
      return row;
    };
    for (const h of c.holdings) bars.append(bar(h.name ?? h.symbol, `${h.symbol}・報酬 ${pct(h.returnPct, 1)}`, h.weightPct, 'pf-weights__bar'));
    if (Number.isFinite(c.cashPct)) bars.append(bar('現金', '尚未投入', c.cashPct, 'pf-weights__bar pf-weights__bar--cash'));
    panel.append(bars);

    if (c.holdings.length) {
      panel.append(table(['代號', '名稱', '權重', '股數', '成本', '收盤', '市值', '損益', '報酬', '買進日', '持有交易日', 'AI 名次', '距風險價', '距目標價'], c.holdings.map((h) => [
        h.symbol, h.name ?? '—', share(h.weightPct), money(h.shares), money(h.cost), h.close == null ? '—' : String(h.close), money(h.marketValue),
        Number.isFinite(h.pnl) ? `${h.pnl >= 0 ? '+' : ''}${Math.round(h.pnl).toLocaleString('zh-TW')}` : '—', pct(h.returnPct), h.buyDate ?? '—',
        h.heldSessions == null ? '—' : String(h.heldSessions), h.rank == null ? '—' : String(h.rank), pct(h.toRiskPct, 1), pct(h.toTargetPct, 1)
      ]), 7));
    } else {
      panel.append(make('p', '目前沒有持股。', 'side-panel__note'));
    }
    const pending = renderPendingOrders([{ summary, orders }], make);
    if (pending) panel.append(pending);
    box.append(panel);
  }
  body.hidden = false;
}

async function renderEnhancedIndexAllocation(config) {
  try {
    const { calculationDate, rows } = await fetchEnhancedIndexAllocation({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, strategy: ENHANCED_INDEX_STRATEGY, fetchImpl: window.fetch.bind(window) });
    el.enhancedIndexLoading.hidden = true;
    if (!calculationDate || rows.length === 0) {
      el.enhancedIndexEmpty.hidden = false;
      markDecisionRecommendUnavailable();
      return;
    }
    renderDecisionRecommend(rows, calculationDate);
    const pct = (x, digits = 2) => (Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : '—');
    const overweight = rows.filter((r) => r.weight > r.indexWeight * 1.0001).length;
    const underweight = rows.filter((r) => r.weight < r.indexWeight * 0.9999).length;
    el.enhancedIndexSummary.textContent = `資料日期 ${calculationDate}｜共 ${rows.length} 檔持有（加碼 ${overweight} 檔、減碼 ${underweight} 檔；權重降為 0 的個股不列出）｜下表為權重最高的 ${Math.min(ENHANCED_INDEX_ROWS_SHOWN, rows.length)} 檔，點擊列可開啟個股分析。`;
    el.enhancedIndexTbody.replaceChildren();
    rows.slice(0, ENHANCED_INDEX_ROWS_SHOWN).forEach((row, i) => {
      const tr = document.createElement('tr');
      const tilt = row.weight - row.indexWeight;
      const cells = [
        String(i + 1), row.symbol, row.companyName ?? '—', industryName(row.industry), pct(row.indexWeight), pct(row.weight),
        Math.abs(tilt) < 0.00005 ? '維持' : `${tilt > 0 ? '+' : ''}${(tilt * 100).toFixed(2)} 百分點`,
        Number.isFinite(row.factorScore) ? `前 ${Math.max(1, Math.round((1 - row.factorScore) * 100))}%` : '—',
        Number.isFinite(row.compositeScore) ? row.compositeScore.toFixed(1) : '—'
      ];
      cells.forEach((text, k) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (k === 6 && Math.abs(tilt) >= 0.00005) td.className = tilt > 0 ? 'kpi-tile__value--up' : 'kpi-tile__value--down';
        tr.append(td);
      });
      tr.addEventListener('click', () => {
        el.input.value = row.symbol;
        switchPage('stock');
        loadSymbol(row.symbol);
      });
      el.enhancedIndexTbody.append(tr);
    });
    el.enhancedIndexBody.hidden = false;
  } catch {
    el.enhancedIndexLoading.hidden = true;
    el.enhancedIndexEmpty.hidden = false;
    markDecisionRecommendUnavailable();
  }
}

// ETF 專區 (step 1): descriptive metrics for the locked ETF cohort, loaded
// the first time the page opens. ~400 calendar days covers the 252-trading-
// day return plus its start row; corporate actions (cash dividends, splits)
// are applied so returns are total returns. See public/js/lib/etf-metrics.js.
const ETF_LOOKBACK_CALENDAR_DAYS = 400;
const ETF_TREND_LABEL = { ABOVE_MA60: '站上', BELOW_MA60: '跌破', UNKNOWN: '資料不足' };
// Premium/discount beyond this (either way) is highlighted - buying a
// 1% premium costs about as much as a year of a typical ETF's fees.
const ETF_PREMIUM_WARN_PCT = 1;
const ETF_NAV_LOOKBACK_DAYS = 14;
let etfPageRequested = false;

function renderEtfPageOnce() {
  if (etfPageRequested) return;
  etfPageRequested = true;
  renderEtfPage();
}

async function renderEtfPage() {
  const config = window.APP_CONFIG || {};
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - ETF_LOOKBACK_CALENDAR_DAYS);
    const [rows, events, navBySymbol, holdingsResult] = await Promise.all([
      fetchMarketDailySince({ url: config.SUPABASE_URL, apiKey: config.SUPABASE_ANON_KEY, sinceDate: since.toISOString().slice(0, 10), symbols: new Set(ETF_PRIORITY_SYMBOLS), fetchImpl: window.fetch.bind(window) }),
      fetchCorporateActionEventsBulk({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) }),
      // Best-effort: the NAV table may not exist yet (e.g. Cloud before
      // migration 037) - the page still renders, those columns show "—".
      fetchLatestEtfNav({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbols: ETF_PRIORITY_SYMBOLS, sinceDate: new Date(Date.now() - ETF_NAV_LOOKBACK_DAYS * 864e5).toISOString().slice(0, 10), fetchImpl: window.fetch.bind(window) }).catch(() => new Map()),
      // Same best-effort rule for the monthly SITCA holdings (migration 038).
      fetchLatestEtfHoldings({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbols: ETF_PRIORITY_SYMBOLS, fetchImpl: window.fetch.bind(window) }).catch(() => ({ month: null, bySymbol: new Map() }))
    ]);
    const eventsBySymbol = buildCorporateActionEventsMap(events);
    const bySymbol = new Map([...groupRecordsBySymbol(rows)].map(([key, records]) => [key.split(':')[1], records]));
    const metricsBySymbol = new Map();
    for (const symbol of ETF_PRIORITY_SYMBOLS) {
      const raw = bySymbol.get(symbol) ?? [];
      const adjusted = buildAdjustedRecommendationRecords(raw, eventsBySymbol.get(symbol) ?? []);
      metricsBySymbol.set(symbol, computeEtfMetrics({ adjusted, raw }));
    }
    const benchmarkYear = metricsBySymbol.get('0050')?.returns.y1 ?? null;
    const dates = [...metricsBySymbol.values()].filter(Boolean).map((m) => m.latestDate).sort();

    el.etfTbody.replaceChildren();
    for (const symbol of ETF_PRIORITY_SYMBOLS) {
      const m = metricsBySymbol.get(symbol);
      const tr = document.createElement('tr');
      const cell = (text, className = '') => {
        const td = document.createElement('td');
        td.textContent = text;
        if (className) td.className = className;
        tr.append(td);
        return td;
      };
      const signed = (value) => cell(formatPercent(value), Number.isFinite(value) ? (value >= 0 ? 'value--up' : 'value--down') : '');
      cell(symbol);
      cell(getCachedCompanyName(symbol) ?? '—');
      if (!m) {
        cell('無資料');
        for (let i = 0; i < 13; i++) cell('—');
        el.etfTbody.append(tr);
        continue;
      }
      cell(formatPrice(m.latestClose));
      const nav = navBySymbol.get(symbol);
      const official = computeOfficialPremium(nav, bySymbol.get(symbol) ?? []);
      const premiumClass = (pct) => (Number.isFinite(pct) && Math.abs(pct) >= ETF_PREMIUM_WARN_PCT ? 'kpi-tile__value--warn' : '');
      const navTd = cell(official ? `${formatPrice(official.nav)}` : '—');
      if (official) navTd.title = `${official.date} 官方淨值（TWSE 基本市況報導）`;
      const premiumTd = cell(official ? formatPercent(official.premiumPct) : '—', premiumClass(official?.premiumPct));
      if (official) premiumTd.title = `${official.date} 收盤 ${formatPrice(official.close)} ÷ 淨值 ${formatPrice(official.nav)}`;
      const estTd = cell(nav && Number.isFinite(nav.estimatedPremiumPct) ? formatPercent(nav.estimatedPremiumPct) : '—', premiumClass(nav?.estimatedPremiumPct));
      if (nav) estTd.title = `${nav.tradingDate} ${nav.snapshotTime ?? ''} 投信預估淨值 ${formatPrice(nav.estimatedNav)}`;
      if (m.suspectDiscontinuity) {
        // An unadjusted split would show up as a fake crash or rally.
        const td = cell('價格序列疑似有未還原的分割／合併，暫不計算報酬');
        td.colSpan = 5;
      } else {
        signed(m.returns.m1);
        signed(m.returns.m3);
        signed(m.returns.m6);
        signed(m.returns.y1);
        const relative = Number.isFinite(m.returns.y1) && Number.isFinite(benchmarkYear) && symbol !== '0050' ? m.returns.y1 - benchmarkYear : null;
        cell(symbol === '0050' ? '基準' : relative == null ? '—' : `${relative >= 0 ? '+' : ''}${relative.toFixed(2)} 百分點`, relative == null ? '' : relative >= 0 ? 'value--up' : 'value--down');
      }
      if (m.suspectDiscontinuity) cell('—');
      else cell(Number.isFinite(m.maxDrawdown1y) ? `${m.maxDrawdown1y.toFixed(1)}%` : '—（上市未滿 1 年）');
      tr.append(buildRiskTierCell({ riskTier: m.riskTier, historicalVolatilityPercent: m.volatility }));
      cell(ETF_TREND_LABEL[m.trend]);
      cell(Number.isFinite(m.avgTurnover20) ? `${(m.avgTurnover20 / 1e8).toFixed(1)} 億` : '—');
      const holdings = holdingsResult.bySymbol.get(symbol);
      const holdingsTd = cell(holdings
        ? `${holdings.holdings.slice(0, 3).map((h) => `${h.name} ${h.pct.toFixed(1)}%`).join('、')}（${holdings.top10Pct.toFixed(1)}%）`
        : '—（非國內股票型或無資料）');
      holdingsTd.className = 'etf-holdings-cell';
      if (holdings) holdingsTd.title = holdings.holdings.map((h) => `${h.rank}. ${h.code} ${h.name} ${h.pct.toFixed(2)}%`).join('\n');
      tr.addEventListener('click', () => {
        el.input.value = symbol;
        switchPage('stock');
        loadSymbol(symbol);
      });
      el.etfTbody.append(tr);
    }
    el.etfSummary.textContent = `資料日期 ${dates.at(-1) ?? '—'}｜共 ${ETF_PRIORITY_SYMBOLS.length} 檔（系統追蹤的 ETF 研究清單，依原清單順序，不代表排名）｜「近 N 月」以交易日計：1 月＝21、3 月＝63、6 月＝126、1 年＝252 個交易日。${holdingsResult.month ? `｜持股資料月份 ${holdingsResult.month.slice(0, 4)}-${holdingsResult.month.slice(4)}（投信投顧公會月前十大，滑鼠移到持股欄可看完整十檔）` : ''}`;
    el.etfLoading.hidden = true;
    el.etfBody.hidden = false;
  } catch {
    el.etfLoading.hidden = true;
    el.etfError.hidden = false;
    etfPageRequested = false; // allow a retry on the next visit
  }
}

async function renderOverviewAiScoreRanking(config) {
  try {
    const { calculationDate, rows } = await fetchAiScoreRanking({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    el.overviewAiScoreLoading.hidden = true;
    if (!calculationDate || rows.length === 0) {
      el.overviewAiScoreEmpty.hidden = false;
      return;
    }

    // The score has 20 levels and many companies share the top one (every
    // fundamental signal positive = 100): say so, so rank order within a
    // tie (by revenue growth, see computeAiScoreRanking) is not over-read.
    const topScore = rows[0].recommendationScore;
    const tied = rows.filter((r) => r.recommendationScore === topScore).length;
    el.overviewAiScoreTieNote.hidden = tied < 2;
    el.overviewAiScoreTieNote.textContent = `目前最高分為 ${Number.isFinite(topScore) ? topScore.toFixed(1) : '—'} 分：已儲存的前 ${rows.length} 名中有 ${tied} 檔同分${tied >= rows.length ? '（實際同分者可能更多）' : ''}；同分者依四項基本面（營收、EPS、淨利成長幅度與 ROE 高低）的連續評分排序，排名先後不代表評分高低。`;

    el.overviewAiScoreTbody.replaceChildren();
    for (const row of rows.slice(0, 10)) {
      const tr = document.createElement('tr');
      for (const text of [String(row.rank), row.symbol, row.companyName ?? '—']) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      const scoreTd = document.createElement('td');
      scoreTd.className = 'ai-score';
      scoreTd.textContent = Number.isFinite(row.recommendationScore) ? row.recommendationScore.toFixed(1) : '—';
      tr.append(scoreTd);
      tr.append(buildRiskTierCell(row));
      for (const text of [formatPrice(row.referencePrice), formatPrice(row.targetPrice), formatPercent(row.expectedReturnPercent)]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      const decisionTd = document.createElement('td');
      const decisionBadge = document.createElement('span');
      decisionBadge.className = `badge ${DECISION_STATE_BADGE_CLASS[row.decisionState] ?? ''}`;
      decisionBadge.textContent = DECISION_STATE_TABLE_LABEL[row.decisionState] ?? row.decisionState ?? '—';
      decisionTd.append(decisionBadge);
      tr.append(decisionTd);
      const flagTd = document.createElement('td');
      if (row.decisionState === 'INVESTABLE_CANDIDATE') {
        const flag = document.createElement('span');
        flag.className = 'badge badge--investable-candidate';
        flag.textContent = '雙達標';
        flagTd.append(flag);
      } else {
        flagTd.textContent = '—';
      }
      tr.append(flagTd);
      tr.addEventListener('click', () => {
        el.input.value = row.symbol;
        switchPage('stock');
        loadSymbol(row.symbol);
      });
      el.overviewAiScoreTbody.append(tr);
    }
    el.overviewAiScoreBody.hidden = false;
  } catch {
    // Reference-only, additive section - a failure here must never block
    // the rest of the Overview page.
    el.overviewAiScoreLoading.hidden = true;
    el.overviewAiScoreEmpty.hidden = false;
  }
}

async function renderOverviewPage() {
  const config = window.APP_CONFIG || {};
  // the home page (執行績效總覽) never waits for, or fails with, the Market Top 50 read
  if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) renderAiSimulation(config);
  else for (const id of ['perf-loading', 'dash-loading', 'pf-loading']) { const l = document.getElementById(id); if (l) l.textContent = '尚未設定 Supabase 連線資訊。'; }
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    el.overviewLoading.hidden = true;
    el.overviewError.textContent = '尚未設定 Supabase 連線資訊，請於 public/js/config.js 填入 SUPABASE_URL 與 SUPABASE_ANON_KEY。';
    el.overviewError.hidden = false;
    return;
  }

  try {
    const { calculationDate, rows } = await fetchMarketTop50({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    el.overviewLoading.hidden = true;
    if (!calculationDate || rows.length === 0) {
      el.overviewEmpty.hidden = false;
      return;
    }

    renderOverviewKpiGrid(rows);
    renderOverviewTop10(rows);
    el.overviewBody.hidden = false;

    renderOverviewHorizonTiles(rows, config);
    renderOverviewChanges(rows, calculationDate, config);
    renderOverviewAiScoreRanking(config);
    renderEnhancedIndexAllocation(config);
    renderShadowPerformance(config);
    renderAuditRuns(config);
    renderCalibrationReport(config);

    // 市場總覽 - independent of the Market Top 50 rows above; never blocks
    // the rest of the page. Per-field display gate lives in
    // formatMarketOverviewCards() (public/js/lib/market-overview-source.js) -
    // honest "—" placeholders stay if the fetch fails or a field's
    // data_status isn't VALID, never a fabricated/stale number. The
    // source/date provenance goes in each span's title tooltip rather than
    // new visible markup, so no layout change is needed for it.
    fetchMarketOverview({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) })
      .then((result) => {
        const cards = formatMarketOverviewCards(result);
        for (const [key, el2] of [
          ['index', el.overviewMarketIndex],
          ['turnover', el.overviewMarketTurnover],
          ['institutional', el.overviewMarketInstitutional],
          ['margin', el.overviewMarketMargin],
          ['short', el.overviewMarketShort]
        ]) {
          el2.textContent = cards[key].value;
          el2.title = cards[key].note;
        }
      })
      .catch(() => {
        // Leave the static HTML placeholders ("—") as-is.
      });
  } catch (err) {
    el.overviewLoading.hidden = true;
    el.overviewError.textContent = 'Overview 資料載入失敗，暫時無法顯示。';
    el.overviewError.hidden = false;
  }
}

// Research-only Portfolio (v0.4.0, Issues #103/#105; MVP-2 sell price/
// reason added Issue #126) - Symbol/Shares/成交金額/成交日期 are recorded
// directly; Current Price/Unrealized P&L/Return/Weight and a research-use
// Target/Risk Price + 賣出理由 are fetched/computed here. Incremented on
// every renderPortfolio() call and captured by the async metrics fetch
// below - if a newer render starts (position added/removed/edited) while
// an older fetch is still in flight, the older one's results are discarded
// instead of overwriting the newer render's DOM with stale numbers. Same
// staleness-guard principle already used for currentSymbol elsewhere in
// this file, applied here because Weight is a cross-position calculation
// that can't just be re-run independently per row.
let portfolioRenderGeneration = 0;
const PORTFOLIO_SERIES_LIMIT = 60; // enough for Donchian(20)/MACD(26)/Bollinger(20) reliably, without the full chart-sized fetch

function renderPortfolio() {
  portfolioRenderGeneration += 1;
  const generation = portfolioRenderGeneration;

  el.portfolioList.replaceChildren();
  for (const position of portfolio.list()) {
    const item = document.createElement('li');
    item.dataset.symbol = position.symbol;
    const label = document.createElement('span');
    const positionName = getCachedCompanyName(position.symbol);
    label.textContent = `${position.symbol}${positionName ? `（${positionName}）` : ''} · ${position.shares.toLocaleString('en-US')} 股`;
    const detail = document.createElement('span');
    const dateText = position.transactionDate ? `，成交日 ${position.transactionDate}` : '';
    detail.textContent = `平均成本 ${position.averageCost.toFixed(2)}${dateText}`;
    const metricsEl = document.createElement('span');
    metricsEl.className = 'watchlist-chip__status';
    const sellInfoEl = document.createElement('span');
    sellInfoEl.className = 'watchlist-chip__status';
    const riskEl = document.createElement('span');
    riskEl.className = 'watchlist-chip__status portfolio-risk';
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'secondary-button';
    removeButton.textContent = '移除';
    removeButton.addEventListener('click', () => {
      portfolio.remove(position.symbol);
      renderPortfolio();
    });
    item.append(label, detail, metricsEl, sellInfoEl, riskEl, removeButton);
    el.portfolioList.append(item);
  }

  updatePortfolioMetrics(generation);
}

// Fetches each position's own daily series independently (a failed fetch
// for one symbol never blocks the others - Promise.allSettled, not
// Promise.all) - the same series doubles as the current price (its latest
// close) and the input to buildStockRecommendation()'s Target/Risk Price +
// 賣出理由 (MVP-1's engine, Issue #124, reused unchanged), so this is one
// fetch per position, not two. A position with no known price shows
// "資料不足" and is excluded from every other position's Weight - never
// assigned a guessed weight and never silently folded into someone else's.
async function updatePortfolioMetrics(generation) {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
  const positions = portfolio.list();
  if (!positions.length) return;

  const seriesResults = await Promise.allSettled(
    positions.map((position) => fetchSymbolDailySeries({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol: position.symbol, limit: PORTFOLIO_SERIES_LIMIT, fetchImpl: window.fetch.bind(window) }))
  );
  // M6 (Section 12): Revenue Growth is the only Fundamental Risk input
  // with real Production coverage today - fetched the same way the Stock
  // Detail's own Fundamental panel already does. A failed/empty fetch for
  // one position never blocks another, and just leaves that position's
  // Fundamental Risk UNAVAILABLE rather than guessed.
  const fundamentalsResults = await Promise.allSettled(
    positions.map((position) => fetchLatestFundamentals({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol: position.symbol, fetchImpl: window.fetch.bind(window) }))
  );
  // Same real-split fix as the Stock Detail page (Phase-1 roadmap item
  // "股票分割真正還原") - without it, a holding's own real historical split
  // sits in its lookback window as a raw price cliff and corrupts the
  // Target/Risk Price shown for an actual holding. Best-effort: a failure
  // here degrades to un-adjusted, same as before this fix.
  const corporateActionEventsMap = await fetchCorporateActionEventsBulk({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) })
    .then(buildCorporateActionEventsMap)
    .catch(() => new Map());
  if (generation !== portfolioRenderGeneration) return;

  const currentPriceBySymbol = new Map();
  const recordsBySymbol = new Map();
  seriesResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      recordsBySymbol.set(positions[index].symbol, result.value);
      currentPriceBySymbol.set(positions[index].symbol, result.value[result.value.length - 1].close);
    }
  });
  const yoyRevenueGrowthBySymbol = new Map();
  fundamentalsResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      yoyRevenueGrowthBySymbol.set(positions[index].symbol, computeYoyRevenueGrowth(result.value));
    }
  });
  const weightBySymbol = computePortfolioWeights(positions, currentPriceBySymbol);

  for (const position of positions) {
    if (generation !== portfolioRenderGeneration) return;
    const item = el.portfolioList.querySelector(`li[data-symbol="${position.symbol}"]`);
    if (!item) continue; // removed since this fetch started
    const metricsEl = item.children[2];
    const sellInfoEl = item.children[3];
    const riskEl = item.children[4];

    const currentPrice = currentPriceBySymbol.get(position.symbol) ?? null;
    if (currentPrice == null) {
      metricsEl.textContent = ' · 資料不足';
      sellInfoEl.textContent = '';
      riskEl.textContent = '';
      continue;
    }
    const pnl = computeUnrealizedPnl(position, currentPrice);
    const returnPercent = computeReturnPercent(position, currentPrice);
    const weight = weightBySymbol.get(position.symbol);
    const sign = pnl > 0 ? '+' : '';
    const weightText = weight != null ? `，權重 ${weight.toFixed(1)}%` : '';
    metricsEl.textContent = ` · 現價 ${currentPrice.toFixed(2)}，損益 ${sign}${pnl.toFixed(0)}（${sign}${returnPercent.toFixed(2)}%）${weightText}`;
    metricsEl.classList.add(pnl >= 0 ? 'watchlist-chip__change--up' : 'watchlist-chip__change--down');

    const rawRecords = recordsBySymbol.get(position.symbol);
    const records = buildAdjustedRecommendationRecords(rawRecords, corporateActionEventsMap.get(position.symbol) ?? []);
    const recommendation = buildStockRecommendation(records, null, { instrumentType: instrumentTypeOf(position.symbol) });
    if (recommendation) {
      const targetText = recommendation.targetPrice.status === 'AVAILABLE'
        ? ` · Target ${recommendation.targetPrice.targetPrice.toFixed(2)} / Risk ${recommendation.targetPrice.riskPrice.toFixed(2)}`
        : ' · Target/Risk Price 資料不足';
      const expectedReturnText = recommendation.expectedReturn.status === 'AVAILABLE'
        ? ` · Expected Return ${formatSignedPercent(recommendation.expectedReturn.expectedReturnPercent)}`
        : '';
      sellInfoEl.textContent = `${targetText}${expectedReturnText} · ${recommendation.sellReason}`;
    }

    // M6 (Section 11/12/13): Data Freshness + traceable Risk state, reused
    // entirely from the recommendation engine's own Target/Risk Price
    // (never a second Target Price calculation) plus this position's
    // real Revenue Growth (or UNAVAILABLE, never guessed).
    const freshness = getDataFreshness({ latestTradingDate: records?.[records.length - 1]?.tradingDate });
    const targetPrice = recommendation?.targetPrice?.status === 'AVAILABLE' ? recommendation.targetPrice.targetPrice : null;
    const riskPrice = recommendation?.targetPrice?.status === 'AVAILABLE' ? recommendation.targetPrice.riskPrice : null;
    const holdingRisk = records ? computeHoldingRiskFromRecords({ records, targetPrice, riskPrice, yoyRevenueGrowth: yoyRevenueGrowthBySymbol.get(position.symbol) ?? null }) : null;
    const freshnessText = freshness !== 'UNKNOWN' ? `資料新鮮度：${FRESHNESS_LABEL[freshness]}` : '資料新鮮度：資料不足';
    if (holdingRisk) {
      const reasonsText = holdingRisk.reasons.length ? `（${holdingRisk.reasons.join('、')}）` : '';
      riskEl.textContent = ` · ${freshnessText} · 風險狀態：${holdingRisk.stateLabel}${reasonsText}`;
    } else {
      riskEl.textContent = ` · ${freshnessText}`;
    }
  }
}

el.portfolioForm.addEventListener('submit', (event) => {
  event.preventDefault();
  el.portfolioError.hidden = true;

  const symbol = el.portfolioSymbolInput.value.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    el.portfolioError.textContent = '股票代號格式不正確，請輸入 4-6 碼英數字（例如 2330）。';
    el.portfolioError.hidden = false;
    return;
  }

  const shares = Number(el.portfolioSharesInput.value);
  const transactionAmount = Number(el.portfolioAmountInput.value);
  const averageCost = shares > 0 ? transactionAmount / shares : NaN;
  const transactionDate = el.portfolioDateInput.value || undefined; // optional - portfolio.js accepts omission

  try {
    portfolio.add(symbol, shares, averageCost, { transactionAmount, transactionDate });
  } catch (err) {
    el.portfolioError.textContent = err.message.includes('limited to')
      ? '實際持股已達上限（5 檔），請先移除部分項目。'
      : '請輸入正確的股數與成交金額（需大於 0），成交日期不得晚於今日。';
    el.portfolioError.hidden = false;
    return;
  }

  el.portfolioForm.reset();
  renderPortfolio();
});

// M5 Simulation ("M5 → M7 Autonomous Execution Specification v1.0",
// Sections 4-9): the Observation List itself is stored (symbol/dates/
// amounts/note - simulation.js), but every ANALYSIS field below is
// re-derived on every render from real market_daily history via the
// SAME unmodified recommendation-engine.js the rest of this dashboard
// already uses - never a second scoring engine, never a proactively-
// logged daily snapshot. "As of entry date" is obtained by slicing the
// fetched history up to purchaseDate before calling
// buildStockRecommendation() (which always treats the LAST record it is
// given as "today" - see recommendation-engine.js), so the exact same
// function call replays a real historical prediction.
const SIMULATION_SERIES_LIMIT = 180; // enough runway for both the entry-date replay and forward performance/prediction tracking across months
let simulationRenderGeneration = 0;

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return '資料不足';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// M8-6 (Issue #154): the five real Simulation Validation outcome states -
// never a bare hit/miss, always traceable to Target/Risk Price actually
// being reached (or not) within the horizon.
const SIMULATION_OUTCOME_LABEL = {
  [SIMULATION_OUTCOME.TARGET_REACHED]: '達標',
  [SIMULATION_OUTCOME.RISK_TRIGGERED]: '觸及風險價',
  [SIMULATION_OUTCOME.POSITIVE_NOT_TARGET]: '正報酬未達標',
  [SIMULATION_OUTCOME.NEGATIVE_NOT_RISK]: '負報酬未觸險',
  [SIMULATION_OUTCOME.INSUFFICIENT_PERIOD]: '尚未足期'
};

function renderSimulationList() {
  simulationRenderGeneration += 1;
  const generation = simulationRenderGeneration;

  el.simulationList.replaceChildren();
  for (const entry of simulationList.list()) {
    const li = document.createElement('li');
    li.dataset.symbol = entry.symbol;

    const header = document.createElement('div');
    header.className = 'simulation-list__line';
    const entryName = getCachedCompanyName(entry.symbol);
    header.textContent = `${entry.symbol}${entryName ? `（${entryName}）` : ''} · ${entry.shares.toLocaleString('en-US')} 股 · 觀察日 ${entry.observationDate} · 模擬買進日 ${entry.purchaseDate}（均價 ${entry.averageCost.toFixed(2)}）`;
    li.append(header);

    const bodyLine = document.createElement('div');
    bodyLine.className = 'simulation-list__line simulation-list__line--body';
    bodyLine.textContent = '載入中…';
    li.append(bodyLine);

    const performanceLine = document.createElement('div');
    performanceLine.className = 'simulation-list__line simulation-list__line--muted simulation-list__line--performance';
    li.append(performanceLine);

    const predictionLine = document.createElement('div');
    predictionLine.className = 'simulation-list__line simulation-list__line--muted simulation-list__line--prediction';
    li.append(predictionLine);

    if (entry.note) {
      const noteLine = document.createElement('div');
      noteLine.className = 'simulation-list__line simulation-list__line--muted';
      noteLine.textContent = `備註：${entry.note}`;
      li.append(noteLine);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'secondary-button';
    removeButton.textContent = '移除';
    removeButton.addEventListener('click', () => {
      simulationList.remove(entry.symbol);
      renderSimulationList();
    });
    li.append(removeButton);

    el.simulationList.append(li);
    updateSimulationEntry(entry, generation);
  }
}

async function updateSimulationEntry(entry, generation) {
  const config = window.APP_CONFIG || {};
  const li = el.simulationList.querySelector(`li[data-symbol="${entry.symbol}"]`);
  if (!li) return;
  const bodyLine = li.querySelector('.simulation-list__line--body');
  const performanceLine = li.querySelector('.simulation-list__line--performance');
  const predictionLine = li.querySelector('.simulation-list__line--prediction');

  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    bodyLine.textContent = '尚未設定 Supabase 連線資訊。';
    return;
  }

  let records;
  try {
    records = await fetchSymbolDailySeries({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol: entry.symbol, limit: SIMULATION_SERIES_LIMIT, fetchImpl: window.fetch.bind(window) });
  } catch {
    if (generation !== simulationRenderGeneration) return;
    bodyLine.textContent = '資料載入失敗，請稍後重試。';
    return;
  }
  if (generation !== simulationRenderGeneration || !li.isConnected) return;

  if (records.length === 0) {
    bodyLine.textContent = '資料不足（尚無 market_daily 資料）。';
    return;
  }

  // Corporate-action adjustment (Phase-1 roadmap item "股票分割真正還原") is
  // applied ONLY to the recommendation inputs below, never to `records`
  // itself - the P&L/現價/最高/最低 figures further down are real realized
  // transaction economics against entry.averageCost (an actual cash amount
  // the user paid) and must stay on raw, actually-traded prices. Best-
  // effort: a failure here degrades to un-adjusted, same as before this fix.
  const corporateActionEvents = await fetchCorporateActionEvents({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY, symbol: entry.symbol, fetchImpl: window.fetch.bind(window) }).catch(() => []);
  if (generation !== simulationRenderGeneration || !li.isConnected) return;

  // "As of entry date" replay - the same engine, sliced input (Section 6).
  const entryRecords = sliceRecordsUpTo(records, entry.purchaseDate);
  const entryRecommendation = entryRecords.length > 0 ? buildStockRecommendation(buildAdjustedRecommendationRecords(entryRecords, corporateActionEvents), null) : null;
  // Today's re-analysis - the same engine, full input.
  const currentRecommendation = buildStockRecommendation(buildAdjustedRecommendationRecords(records, corporateActionEvents), null);

  const latestRecord = records[records.length - 1];
  const previousRecord = records.length >= 2 ? records[records.length - 2] : null;
  const dailyChangePercent = previousRecord && previousRecord.close !== 0 ? ((latestRecord.close - previousRecord.close) / previousRecord.close) * 100 : null;

  const entryTargetPrice = entryRecommendation?.targetPrice?.status === 'AVAILABLE' ? entryRecommendation.targetPrice.targetPrice : null;
  const entryRiskPrice = entryRecommendation?.targetPrice?.status === 'AVAILABLE' ? entryRecommendation.targetPrice.riskPrice : null;
  const performance = computeSimulationPerformance({ records, entryDate: entry.purchaseDate, entryPrice: entry.averageCost, targetPrice: entryTargetPrice, riskPrice: entryRiskPrice });

  // Line 1: current price/return, Target/Risk/Expected Return, verdict + sell suggestion (Section 6).
  const priceText = `現價 ${latestRecord.close.toFixed(2)}（日漲跌 ${formatSignedPercent(dailyChangePercent)}）`;
  const targetRiskText = currentRecommendation.targetPrice.status === 'AVAILABLE'
    ? `Target ${currentRecommendation.targetPrice.targetPrice.toFixed(2)} / Risk ${currentRecommendation.targetPrice.riskPrice.toFixed(2)}`
    : 'Target/Risk 資料不足';
  const expectedReturnText = currentRecommendation.expectedReturn.status === 'AVAILABLE'
    ? `Expected Return ${formatSignedPercent(currentRecommendation.expectedReturn.expectedReturnPercent)}（${currentRecommendation.expectedReturn.decisionStateLabel}）`
    : 'Expected Return 資料不足';
  bodyLine.textContent = `${priceText} · ${targetRiskText} · ${expectedReturnText} · ${currentRecommendation.verdictLabel} · ${currentRecommendation.sellReason}`;

  // Line 2: since-entry performance (Section 7) - null-safe throughout, never fabricated.
  if (performance) {
    const pnlAmount = Number.isFinite(performance.pnlPerShare) ? performance.pnlPerShare * entry.shares : null;
    const pnlText = pnlAmount != null ? `損益 ${pnlAmount >= 0 ? '+' : ''}${pnlAmount.toFixed(0)}（${formatSignedPercent(performance.returnPercent)}）` : '損益 資料不足';
    const hitText = [
      performance.targetPriceHit != null ? `Target ${performance.targetPriceHit ? '已達成' : '尚未達成'}` : null,
      performance.riskPriceHit != null ? `Risk ${performance.riskPriceHit ? '已觸發' : '尚未觸發'}` : null
    ].filter(Boolean).join('，');
    performanceLine.textContent = `自進場：${pnlText}，最高 ${performance.highestSinceEntry.toFixed(2)}，最低 ${performance.lowestSinceEntry.toFixed(2)}，最大回檔 ${performance.maxDrawdownPercent.toFixed(2)}%${hitText ? `，${hitText}` : ''}`;
  } else {
    performanceLine.textContent = '自進場：資料不足。';
  }

  // Line 3: prediction vs reality at 5/10/20 trading days (Section 8) -
  // a real, traceable record for M7's future validation, never only the
  // final result.
  if (entryTargetPrice != null) {
    const outcomes = evaluatePredictionOutcomes({ records, predictionDate: entry.purchaseDate, targetPrice: entryTargetPrice, riskPrice: entryRiskPrice });
    const parts = Object.entries(outcomes).map(([horizon, horizonResult]) => {
      const classified = classifySimulationOutcome({ horizonResult, referencePrice: entry.averageCost });
      const label = SIMULATION_OUTCOME_LABEL[classified.outcome];
      const returnText = classified.actualReturnPercent != null ? `（${formatSignedPercent(classified.actualReturnPercent)}）` : '';
      return `${horizon}日：${label}${returnText}`;
    });
    predictionLine.textContent = `預測驗證（進場 Target ${entryTargetPrice.toFixed(2)}）：${parts.join(' · ')}`;
  } else {
    predictionLine.textContent = '預測驗證：進場當日資料不足，無法評估。';
  }
}

el.simulationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  el.simulationError.hidden = true;

  const symbol = el.simulationSymbolInput.value.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    el.simulationError.textContent = '股票代號格式不正確，請輸入 4-6 碼英數字（例如 2330）。';
    el.simulationError.hidden = false;
    return;
  }

  const observationDate = el.simulationObservationDateInput.value;
  const purchaseDate = el.simulationPurchaseDateInput.value;
  const purchaseAmount = Number(el.simulationAmountInput.value);
  const shares = Number(el.simulationSharesInput.value);
  const note = el.simulationNoteInput.value;

  try {
    simulationList.add(symbol, observationDate, purchaseDate, purchaseAmount, shares, { note });
  } catch (err) {
    el.simulationError.textContent = err.message.includes('limited to')
      ? '模擬觀察名單已達上限（10 檔），請先移除部分項目。'
      : '請輸入正確的觀察日期／買進日期（不得晚於今日）、買進金額與股數（需大於 0）。';
    el.simulationError.hidden = false;
    return;
  }

  el.simulationForm.reset();
  renderSimulationList();
});

// Comparison (v0.4.0, Issue #107): a transient, in-session list of symbols
// (no persistence - unlike the Watchlist/Portfolio, this isn't meant to
// represent standing state) shown side by side with the same Last
// Price/Daily Change/Technical Status a symbol already shows as a
// Watchlist chip - reuses fetchWatchlistStyleMetrics() unchanged rather
// than re-deriving these values, so both views can never disagree on the
// same symbol. Each row's fetch is independent; one symbol's failure or
// missing market_daily coverage never blocks another row and shows
// "資料不足" instead of a guessed value.
const comparisonSymbols = new Set();

function renderComparisonList() {
  el.comparisonList.replaceChildren();
  for (const symbol of comparisonSymbols) {
    const item = document.createElement('li');
    item.dataset.symbol = symbol;
    const label = document.createElement('span');
    const name = getCachedCompanyName(symbol);
    label.textContent = name ? `${symbol}（${name}）` : symbol;
    const metricsEl = document.createElement('span');
    metricsEl.className = 'watchlist-chip__status';
    metricsEl.textContent = ' · 載入中…';
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'secondary-button';
    removeButton.textContent = '移除';
    removeButton.addEventListener('click', () => {
      comparisonSymbols.delete(symbol);
      renderComparisonList();
    });
    item.append(label, metricsEl, removeButton);
    el.comparisonList.append(item);

    fetchWatchlistStyleMetrics(symbol)
      .then((metrics) => {
        if (!comparisonSymbols.has(symbol)) return; // removed since this fetch started
        if (!metrics) {
          metricsEl.textContent = ' · 資料不足';
          return;
        }
        const { priceChange, trend } = metrics;
        const priceText = priceChange
          ? ` ${priceChange.latestClose.toFixed(2)} (${priceChange.change > 0 ? '+' : ''}${priceChange.changePercent.toFixed(2)}%)`
          : '';
        metricsEl.textContent = `${priceText} · ${TECHNICAL_STATUS_LABEL[trend]}`;
        if (priceChange) metricsEl.classList.add(priceChange.change >= 0 ? 'watchlist-chip__change--up' : 'watchlist-chip__change--down');
      })
      .catch(() => { if (comparisonSymbols.has(symbol)) metricsEl.textContent = ' · 資料不足'; });
  }
}

el.comparisonForm.addEventListener('submit', (event) => {
  event.preventDefault();
  el.comparisonError.hidden = true;

  const symbol = el.comparisonSymbolInput.value.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    el.comparisonError.textContent = '股票代號格式不正確，請輸入 4-6 碼英數字（例如 2330）。';
    el.comparisonError.hidden = false;
    return;
  }

  comparisonSymbols.add(symbol);
  el.comparisonForm.reset();
  renderComparisonList();
});

// Screening (v0.5.0, Issue #109; extended Issue #111): filters the user's
// own Watchlist - the smallest evidence-backed "universe" to screen, since
// it already exists and already represents the symbols the user cares
// about, rather than inventing a new symbol-selection UI or an unbounded
// "all symbols" query - by an already-verified signal (classifyTrend(),
// classifyRsi(), classifyMovingAverageRelationship(), classifyMomentum(),
// classifyVolume() - all unchanged from technical-summary.js's own Signal
// layer, via the shared fetchWatchlistStyleMetrics() pipeline). No new
// calculation logic. Volatility/MACD/KD/Bollinger criteria are
// deliberately not offered - see Issue #111's evidence audit.
const SCREENING_CRITERIA = {
  'trend-up': { matches: (metrics) => metrics.trend === 'UP', label: () => `趨勢：${TECHNICAL_STATUS_LABEL.UP}` },
  'trend-down': { matches: (metrics) => metrics.trend === 'DOWN', label: () => `趨勢：${TECHNICAL_STATUS_LABEL.DOWN}` },
  'rsi-overbought': { matches: (metrics) => metrics.rsiStatus === 'OVERBOUGHT', label: () => 'RSI：超買' },
  'rsi-oversold': { matches: (metrics) => metrics.rsiStatus === 'OVERSOLD', label: () => 'RSI：超賣' },
  'ma-bullish': { matches: (metrics) => metrics.maRelationship === 'BULLISH', label: () => 'MA排列：偏多（MA5>MA20）' },
  'ma-bearish': { matches: (metrics) => metrics.maRelationship === 'BEARISH', label: () => 'MA排列：偏空（MA5<MA20）' },
  'momentum-up': { matches: (metrics) => metrics.momentum === 'UP', label: () => '動能：近5日上漲' },
  'momentum-down': { matches: (metrics) => metrics.momentum === 'DOWN', label: () => '動能：近5日下跌' },
  'volume-above': { matches: (metrics) => metrics.volumeStatus === 'ABOVE_AVERAGE', label: () => '成交量：高於均量' },
  'volume-below': { matches: (metrics) => metrics.volumeStatus === 'BELOW_AVERAGE', label: () => '成交量：低於均量' }
};

el.screeningForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.screeningList.replaceChildren();

  const symbols = watchlist.list();
  if (!symbols.length) {
    el.screeningNote.textContent = '自選股清單目前是空的，請先加入股票再進行篩選。';
    el.screeningNote.hidden = false;
    return;
  }

  const criterion = SCREENING_CRITERIA[el.screeningCriterionSelect.value];
  el.screeningNote.textContent = '篩選中…';
  el.screeningNote.hidden = false;

  // Each symbol's fetch is independent (Promise.allSettled) - one symbol's
  // failure or missing market_daily coverage never blocks the others and
  // simply excludes that symbol from matches, never a guessed match.
  const results = await Promise.allSettled(symbols.map((symbol) => fetchWatchlistStyleMetrics(symbol)));

  const matches = [];
  symbols.forEach((symbol, index) => {
    const result = results[index];
    if (result.status !== 'fulfilled' || !result.value) return;
    if (criterion.matches(result.value)) matches.push(symbol);
  });

  if (!matches.length) {
    el.screeningNote.textContent = '沒有符合條件的股票。';
    el.screeningNote.hidden = false;
    return;
  }

  el.screeningNote.hidden = true;
  for (const symbol of matches) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const name = getCachedCompanyName(symbol);
    label.textContent = name ? `${symbol}（${name}）` : symbol;
    const valueEl = document.createElement('span');
    valueEl.className = 'watchlist-chip__status';
    valueEl.textContent = ` · ${criterion.label()}`;
    item.append(label, valueEl);
    el.screeningList.append(item);
  }
});

// Re-renders the chart from the already-fetched daily series, aggregated to
// the currently selected timeframe. Kept separate from loadSymbol so
// switching timeframe does not re-fetch from Supabase.
function renderChart() {
  if (!currentRecords.length) return;

  const records = aggregateTimeframe(currentRecords, timeframe);
  const candlesticks = buildCandlestickSeries(records);
  const volume = buildVolumeSeries(records);
  const ma5 = buildMovingAverageSeries(records, MA_SHORT_PERIOD);
  const ma20 = buildMovingAverageSeries(records, MA_LONG_PERIOD);
  const rsi = buildRsiSeries(records, RSI_PERIOD);
  const bollingerBands = buildBollingerBandsSeries(records);
  const ema = buildEmaSeries(records);
  const macd = buildMacdSeries(records);
  const atr = buildAtrSeries(records);
  const stochastic = buildStochasticSeries(records);
  const obv = buildObvSeries(records);

  renderIndicatorNote({ ma5, ma20, rsi });
  renderTechnicalSummary({ records, ma5, ma20, rsi, atr });
  latestIndicators = { records, ma5, ma20, rsi, bollingerBands, ema, macd, atr, stochastic, obv };

  if (!chartHandles) {
    chartHandles = createDashboardChart(el.priceChartContainer);
  }
  renderDashboardChart(chartHandles, { candlesticks, volume, ma5, ma20, rsi, bollingerBands, ema, macd, atr, stochastic, obv });
  // Data was just replaced by setData above; re-apply the current toggle
  // state so hidden indicators stay hidden across timeframe switches and
  // symbol reloads (visibility is UI state, independent of the data).
  setSeriesVisibility(chartHandles, indicatorVisibility);
}

async function loadSymbol(rawSymbol) {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    setState({ error: '股票代號格式不正確，請輸入 4-6 碼英數字（例如 2330）。' });
    return;
  }

  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    setState({ error: '尚未設定 Supabase 連線資訊，請於 public/js/config.js 填入 SUPABASE_URL 與 SUPABASE_ANON_KEY。' });
    return;
  }

  setState({ loading: true });
  // A new search invalidates the previous symbol's supplementary data
  // immediately - the Analysis Workspace must never show fundamentals/
  // corporate-action facts for a symbol that is no longer the one on screen
  // while the new symbol's own fetch is still in flight.
  latestFundamentals = null;
  latestCorporateActions = null;
  latestInstitutionalFlow = null;
  latestQuarterlyInputs = null;
  latestMaterialInformation = null;
  el.materialInformationPanel.hidden = true;

  try {
    currentRecords = await fetchSymbolDailySeries({
      url: config.SUPABASE_URL,
      anonKey: config.SUPABASE_ANON_KEY,
      symbol,
      fetchImpl: window.fetch.bind(window)
    });
  } catch (err) {
    setState({ error: `讀取市場資料失敗：${err.message}` });
    return;
  }

  if (currentRecords.length === 0) {
    setState({ empty: true });
    return;
  }

  currentSymbol = symbol;
  updateMarketStatusBadge();

  const summary = buildSummary(currentRecords);
  const freshness = getDataFreshness({ latestTradingDate: summary.latestTradingDate });

  setState({ stale: freshness === 'STALE', showResults: true });
  renderSummary(summary, freshness);
  renderChart();
  renderRiskPanel();
  loadSupplementaryPanels(symbol, config);
}

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  switchPage('stock');
  loadSymbol(el.input.value);
});

el.watchlistToggle.addEventListener('click', () => {
  if (!currentSymbol) return;
  if (watchlist.has(currentSymbol)) watchlist.remove(currentSymbol);
  else watchlist.add(currentSymbol);
  renderWatchlist();
  el.watchlistToggle.textContent = watchlist.has(currentSymbol) ? '移除自選' : '加入自選';
});

document.querySelectorAll('[data-timeframe]').forEach((button) => {
  button.addEventListener('click', () => {
    timeframe = button.dataset.timeframe;
    document.querySelectorAll('[data-timeframe]').forEach((b) => b.classList.toggle('timeframe-button--active', b === button));
    renderChart();
  });
});

el.indicatorToggles.forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    // Visibility only - never re-fetches, re-aggregates, or recalculates
    // the underlying series. The already-computed data already sitting in
    // the chart is untouched; only the series' visible flag changes.
    indicatorVisibility[checkbox.dataset.indicator] = checkbox.checked;
    if (chartHandles) setSeriesVisibility(chartHandles, { [checkbox.dataset.indicator]: checkbox.checked });
  });
});

el.analysisTrigger.addEventListener('click', runAnalysis);

function renderAlgorithmConfiguration() {
  const rows = getAlgorithmConfiguration();
  el.algorithmConfigTbody.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const value of [row.parameter, row.formula, row.weight, row.threshold, row.dataSource, row.version, row.lastUpdated, row.validationStatus]) {
      const td = document.createElement('td');
      td.textContent = value == null ? '—' : String(value);
      tr.append(td);
    }
    el.algorithmConfigTbody.append(tr);
  }
}

// Real live composite weights, read from the same Section 18 config table
// (never re-typed or re-guessed) - used to auto-fill previousWeights when
// Stanley proposes a weight-change candidate, and as the display "current"
// value.
function getLiveCompositeWeights() {
  const rows = getAlgorithmConfiguration();
  const find = (label) => rows.find((r) => r.parameter.includes(label))?.weight ?? null;
  return { fundamental: find('Fundamental Weight'), technical: find('Technical Weight'), chip: find('Chip Weight') };
}
const LIVE_EXPECTED_RETURN_THRESHOLD = 30; // matches expected-return.js's real EXPECTED_RETURN_THRESHOLD constant.

function renderAlgorithmVersionList() {
  el.algorithmVersionList.replaceChildren();
  for (const version of algorithmVersionStore.list()) {
    const li = document.createElement('li');

    const header = document.createElement('div');
    header.className = 'simulation-list__line';
    header.textContent = `${version.version}｜${version.change}`;
    li.append(header);

    const reasonLine = document.createElement('div');
    reasonLine.className = 'simulation-list__line simulation-list__line--muted';
    reasonLine.textContent = `原因：${version.reason}`;
    li.append(reasonLine);

    const diffLine = document.createElement('div');
    diffLine.className = 'simulation-list__line simulation-list__line--muted';
    diffLine.textContent = version.newThreshold
      ? `門檻：${version.previousThreshold?.value ?? '—'} → ${version.newThreshold.value}`
      : `權重：Fundamental ${version.previousWeights?.fundamental ?? '—'}→${version.newWeights?.fundamental} / Technical ${version.previousWeights?.technical ?? '—'}→${version.newWeights?.technical} / Chip ${version.previousWeights?.chip ?? '—'}→${version.newWeights?.chip}`;
    li.append(diffLine);

    const metaLine = document.createElement('div');
    metaLine.className = 'simulation-list__line simulation-list__line--muted';
    metaLine.textContent = `填寫人：${version.changedBy}｜日期：${version.changedDate}`;
    li.append(metaLine);

    const validationLine = document.createElement('div');
    validationLine.className = 'simulation-list__line simulation-list__line--muted';
    validationLine.textContent = `回測結果：${typeof version.validationResult === 'string' ? version.validationResult : JSON.stringify(version.validationResult)}`;
    li.append(validationLine);

    if (version.newThreshold && version.validationResult === 'NOT_YET_VALIDATED') {
      const pasteForm = document.createElement('form');
      pasteForm.className = 'search-form';
      const pasteInput = document.createElement('input');
      pasteInput.type = 'text';
      pasteInput.placeholder = '貼上 npm run algorithm:backtest 的回測結果摘要';
      const pasteButton = document.createElement('button');
      pasteButton.type = 'submit';
      pasteButton.textContent = '記錄回測結果';
      pasteForm.append(pasteInput, pasteButton);
      pasteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!pasteInput.value.trim()) return;
        algorithmVersionStore.attachValidationResult(version.version, pasteInput.value.trim());
        renderAlgorithmVersionList();
      });
      li.append(pasteForm);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'secondary-button';
    removeButton.textContent = '移除';
    removeButton.addEventListener('click', () => {
      algorithmVersionStore.remove(version.version);
      renderAlgorithmVersionList();
    });
    li.append(removeButton);

    el.algorithmVersionList.append(li);
  }
}

el.algorithmVersionTypeSelect.addEventListener('change', () => {
  const isWeight = el.algorithmVersionTypeSelect.value === 'weight';
  el.algorithmVersionWeightFields.hidden = !isWeight;
  el.algorithmVersionThresholdNewInput.hidden = isWeight;
});

el.algorithmVersionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  el.algorithmVersionError.hidden = true;

  const change = el.algorithmVersionChangeInput.value.trim();
  const reason = el.algorithmVersionReasonInput.value.trim();
  const changedBy = el.algorithmVersionChangedByInput.value.trim() || undefined;
  const changedDate = new Date().toISOString().slice(0, 10);
  const isWeight = el.algorithmVersionTypeSelect.value === 'weight';

  try {
    if (isWeight) {
      const newWeights = {
        fundamental: Number(el.algorithmVersionWeightFundamentalInput.value),
        technical: Number(el.algorithmVersionWeightTechnicalInput.value),
        chip: Number(el.algorithmVersionWeightChipInput.value)
      };
      algorithmVersionStore.propose({ change, reason, previousWeights: getLiveCompositeWeights(), newWeights, changedBy, changedDate });
    } else {
      const newValue = Number(el.algorithmVersionThresholdNewInput.value);
      algorithmVersionStore.propose({
        change, reason, changedBy, changedDate,
        previousThreshold: { name: 'expectedReturnThreshold', value: LIVE_EXPECTED_RETURN_THRESHOLD },
        newThreshold: { name: 'expectedReturnThreshold', value: newValue }
      });
    }
  } catch (err) {
    el.algorithmVersionError.textContent = err.message;
    el.algorithmVersionError.hidden = false;
    return;
  }

  el.algorithmVersionForm.reset();
  el.algorithmVersionWeightFields.hidden = true;
  el.algorithmVersionThresholdNewInput.hidden = false;
  renderAlgorithmVersionList();
});

// M8.X (Issue #159's follow-up spec, Section 11): real algorithm
// validation results on the Dashboard - the SAME runAlgorithmValidation()
// scripts/validate-algorithm.mjs already ran server-side, now called
// directly in the browser (public/js/lib/algorithm-validation-runner.js)
// against market_top50/market_daily with the anon key. Never a second
// engine, never a fabricated result - a sample below MIN_SAMPLE_SIZE is
// honestly reported as INSUFFICIENT_SAMPLE (rendered as "樣本不足"),
// never presented as a confident conclusion.
const HORIZON_LABEL = { DAY_TRADING: '當沖', SHORT_MEDIUM_TERM: '中短期', LONG_TERM: '長期', NOT_CLASSIFIED: '未分類' };

async function renderAlgorithmValidation() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    el.algorithmValidationLoading.hidden = true;
    el.algorithmValidationError.textContent = '尚未設定 Supabase 連線資訊，請於 public/js/config.js 填入 SUPABASE_URL 與 SUPABASE_ANON_KEY。';
    el.algorithmValidationError.hidden = false;
    return;
  }
  try {
    const result = await runAlgorithmValidation({ url: config.SUPABASE_URL, apiKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    el.algorithmValidationLoading.hidden = true;
    if (result.evaluableCount === 0) {
      el.algorithmValidationEmpty.hidden = false;
      return;
    }

    const m = result.algorithmMetrics;
    const pct = (value) => (value != null ? `${(value * 100).toFixed(1)}%` : '資料不足');
    el.algorithmValidationSummary.textContent = `樣本數 ${m.sampleSize}（${m.status === 'AVAILABLE' ? '已達統計門檻' : '樣本不足，僅供參考'}）｜勝率 ${pct(m.winRate)}｜目標達成率 ${pct(m.targetHitRate)}｜風險觸發率 ${pct(m.riskTriggerRate)}｜報酬中位數 ${m.medianReturnPercent != null ? m.medianReturnPercent.toFixed(2) + '%' : '資料不足'}｜最大回檔 ${m.maxDrawdownPercent != null ? m.maxDrawdownPercent.toFixed(2) + '%' : '資料不足'}｜偽陽性率 ${pct(m.falsePositiveRate)}｜偽陰性率 ${pct(m.falseNegativeRate)}`;

    el.algorithmValidationIndicatorTbody.replaceChildren();
    for (const { name, label } of SIGNAL_METADATA) {
      const a = result.indicatorAccuracy[name];
      const tr = document.createElement('tr');
      for (const text of [label, String(a.sampleSize), a.status === 'AVAILABLE' ? '正常' : '樣本不足', a.hitRate != null ? `${(a.hitRate * 100).toFixed(1)}%` : '—', String(a.truePositive), String(a.falsePositive), String(a.trueNegative), String(a.falseNegative)]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      el.algorithmValidationIndicatorTbody.append(tr);
    }

    el.algorithmValidationHorizonTbody.replaceChildren();
    for (const [category, summary] of Object.entries(result.horizonPerformance)) {
      const tr = document.createElement('tr');
      for (const text of [HORIZON_LABEL[category] ?? category, String(summary.sampleSize), summary.status === 'AVAILABLE' ? '正常' : '樣本不足', summary.averageReturnPercent != null ? `${summary.averageReturnPercent.toFixed(2)}%` : '—']) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      el.algorithmValidationHorizonTbody.append(tr);
    }

    el.algorithmValidationBody.hidden = false;
  } catch {
    el.algorithmValidationLoading.hidden = true;
    el.algorithmValidationError.hidden = false;
  }
}

// M8.X (Section 13): the real Top-50-scale AI Final Output on the
// Dashboard - the SAME generateAiFinalOutput() scripts/generate-ai-
// final-output.mjs already ran server-side (M8-12), now called directly
// in the browser. Never fabricates a narrative - ①②③④ come straight
// from the unmodified recommendation engine's own fields, and ⑤ is
// sourced only from the real runAlgorithmValidation() measurement above.
async function renderAiFinalOutput() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    el.aiFinalOutputLoading.hidden = true;
    el.aiFinalOutputError.textContent = '尚未設定 Supabase 連線資訊，請於 public/js/config.js 填入 SUPABASE_URL 與 SUPABASE_ANON_KEY。';
    el.aiFinalOutputError.hidden = false;
    return;
  }
  try {
    const result = await generateAiFinalOutput({ url: config.SUPABASE_URL, apiKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    el.aiFinalOutputLoading.hidden = true;
    if (!result.calculationDate) {
      el.aiFinalOutputEmpty.hidden = false;
      return;
    }

    el.aiFinalOutputInvestable.replaceChildren();
    if (result.investable.length === 0) {
      const li = document.createElement('li');
      li.textContent = '目前無標的符合可投資候選條件（真實資料，非程式限制）。';
      el.aiFinalOutputInvestable.append(li);
    }
    for (const s of result.investable) {
      const li = document.createElement('li');
      const investableName = getCachedCompanyName(s.symbol, s.market);
      li.textContent = `${s.symbol}${investableName ? `（${investableName}）` : ''}（${s.market}）：Reference ${formatPrice(s.referencePrice)} / Target ${formatPrice(s.targetPrice)}（${s.targetPriceCalculationBasis}） / Expected Return ${formatPercent(s.expectedReturnPercent)} - ${s.matchedSignalLabels.join('、') || '（無已知訊號可列）'}`;
      el.aiFinalOutputInvestable.append(li);
    }

    el.aiFinalOutputNotRecommended.replaceChildren();
    for (const s of result.notRecommended.slice(0, 5)) {
      const li = document.createElement('li');
      const notRecommendedName = getCachedCompanyName(s.symbol, s.market);
      li.textContent = `${s.symbol}${notRecommendedName ? `（${notRecommendedName}）` : ''}（${DECISION_STATE_TABLE_LABEL[s.decisionState] ?? s.decisionState}）：${s.triggeredConditions.join('／')}`;
      el.aiFinalOutputNotRecommended.append(li);
    }

    el.aiFinalOutputVerdict.textContent = `${result.algorithmVerdict.verdict} - ${result.algorithmVerdict.reason}`;
    el.aiFinalOutputBody.hidden = false;
  } catch {
    el.aiFinalOutputLoading.hidden = true;
    el.aiFinalOutputError.hidden = false;
  }
}

// M9 (Section 10-13): 長期趨勢分析 - per-symbol, reuses the SAME
// staleness-guard pattern loadSupplementaryPanels() already established
// (currentSymbol checked before every DOM write) so a slower response
// from a previous search can never overwrite a newer one.
const LONG_TERM_TREND_LABEL = { LONG_TERM_UP: '長期上升', LONG_TERM_DOWN: '長期下降', LONG_TERM_FLAT: '長期盤整', INSUFFICIENT_DATA: '資料不足' };

function appendMetricRow(tbody, label, valueText) {
  const tr = document.createElement('tr');
  const th = document.createElement('td');
  th.textContent = label;
  const td = document.createElement('td');
  td.textContent = valueText;
  tr.append(th, td);
  tbody.append(tr);
}

async function renderLongTermTrend(symbol) {
  const config = window.APP_CONFIG || {};
  el.longTermTrendPanel.hidden = false;
  el.longTermTrendLoading.hidden = false;
  el.longTermTrendEmpty.hidden = true;
  el.longTermTrendError.hidden = true;
  el.longTermTrendBody.hidden = true;
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    if (currentSymbol !== symbol) return;
    el.longTermTrendLoading.hidden = true;
    el.longTermTrendError.textContent = '尚未設定 Supabase 連線資訊，請於 public/js/config.js 填入 SUPABASE_URL 與 SUPABASE_ANON_KEY。';
    el.longTermTrendError.hidden = false;
    return;
  }
  try {
    const result = await runLongTermTrendAnalysis({ url: config.SUPABASE_URL, apiKey: config.SUPABASE_ANON_KEY, symbol, fetchImpl: window.fetch.bind(window) });
    if (currentSymbol !== symbol) return;
    el.longTermTrendLoading.hidden = true;
    if (result.skipReason || result.recordCount === 0) {
      el.longTermTrendEmpty.hidden = false;
      return;
    }

    const m = result.metrics;
    const latestRow = result.series[result.series.length - 1];
    el.longTermTrendSummary.textContent = `真實資料筆數：${result.recordCount}｜長期趨勢（SMA200）：${LONG_TERM_TREND_LABEL[m.longTermTrend.trend] ?? m.longTermTrend.trend}｜原始收盤 ${formatPrice(latestRow.close)} / 調整後收盤 ${formatPrice(latestRow.adjustedClose)}`;

    el.longTermTrendMetricsTbody.replaceChildren();
    const pct = (r) => (r.status === 'AVAILABLE' ? `${r.returnPercent.toFixed(2)}%` : '資料不足');
    appendMetricRow(el.longTermTrendMetricsTbody, '1Y Return', pct(m.return1Y));
    appendMetricRow(el.longTermTrendMetricsTbody, '3Y Return', pct(m.return3Y));
    appendMetricRow(el.longTermTrendMetricsTbody, '5Y Return', pct(m.return5Y));
    appendMetricRow(el.longTermTrendMetricsTbody, '10Y Return', pct(m.return10Y));
    appendMetricRow(el.longTermTrendMetricsTbody, 'CAGR', m.cagr.status === 'AVAILABLE' ? `${m.cagr.cagrPercent.toFixed(2)}%` : '資料不足');
    appendMetricRow(el.longTermTrendMetricsTbody, 'Maximum Drawdown', m.maxDrawdown.status === 'AVAILABLE' ? `${m.maxDrawdown.maxDrawdownPercent.toFixed(2)}%` : '資料不足');
    appendMetricRow(el.longTermTrendMetricsTbody, 'Volatility (年化)', m.volatility.status === 'AVAILABLE' ? `${m.volatility.volatilityPercent.toFixed(2)}%` : '資料不足');
    if (m.bestWorstYear.status === 'AVAILABLE') {
      appendMetricRow(el.longTermTrendMetricsTbody, 'Best Year', `${m.bestWorstYear.bestYear.year}（${m.bestWorstYear.bestYear.returnPercent.toFixed(2)}%）`);
      appendMetricRow(el.longTermTrendMetricsTbody, 'Worst Year', `${m.bestWorstYear.worstYear.year}（${m.bestWorstYear.worstYear.returnPercent.toFixed(2)}%）`);
    } else {
      appendMetricRow(el.longTermTrendMetricsTbody, 'Best/Worst Year', '資料不足');
    }

    el.longTermTrendYearlyList.replaceChildren();
    for (const y of computeYearlyReturns(result.series)) {
      const li = document.createElement('li');
      li.textContent = `${y.year}：${y.returnPercent != null ? `${y.returnPercent.toFixed(2)}%` : '資料不足'}`;
      el.longTermTrendYearlyList.append(li);
    }

    el.longTermTrendBody.hidden = false;
  } catch {
    if (currentSymbol !== symbol) return;
    el.longTermTrendLoading.hidden = true;
    el.longTermTrendError.hidden = false;
  }
}

// M9 (Section 18): 資料中心／歷史資料狀態 - whole-market, renders once
// at page load like Market Top 50/Algorithm Validation/AI Final Output.
async function renderHistoricalDataStatus() {
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    el.historicalDataStatusLoading.hidden = true;
    el.historicalDataStatusError.textContent = '尚未設定 Supabase 連線資訊，請於 public/js/config.js 填入 SUPABASE_URL 與 SUPABASE_ANON_KEY。';
    el.historicalDataStatusError.hidden = false;
    return;
  }
  try {
    const result = await runHistoricalDataStatus({ url: config.SUPABASE_URL, apiKey: config.SUPABASE_ANON_KEY, fetchImpl: window.fetch.bind(window) });
    el.historicalDataStatusLoading.hidden = true;
    const QUALITY_LABEL = { PASS: 'PASS', FAIL: 'FAIL', NO_DATA: '尚無資料' };
    const pct = (v) => (v == null ? '未達標' : `${v}%`);
    document.getElementById('historical-data-status-twse-earliest').textContent = result.twse.earliestDate ?? '尚無資料';
    document.getElementById('historical-data-status-tpex-earliest').textContent = result.tpex.earliestDate ?? '尚無資料';
    document.getElementById('historical-data-status-twse-latest').textContent = result.twse.latestDate ?? '尚無資料';
    document.getElementById('historical-data-status-tpex-latest').textContent = result.tpex.latestDate ?? '尚無資料';
    document.getElementById('historical-data-status-twse-rows').textContent = String(result.twse.totalRows ?? 0);
    document.getElementById('historical-data-status-tpex-rows').textContent = String(result.tpex.totalRows ?? 0);
    document.getElementById('historical-data-status-twse-symbols').textContent = String(result.twse.symbolCountOnLatestDate);
    document.getElementById('historical-data-status-tpex-symbols').textContent = String(result.tpex.symbolCountOnLatestDate);
    document.getElementById('historical-data-status-twse-5y').textContent = pct(result.twse.coverage5YPercent);
    document.getElementById('historical-data-status-tpex-5y').textContent = pct(result.tpex.coverage5YPercent);
    document.getElementById('historical-data-status-twse-10y').textContent = pct(result.twse.coverage10YPercent);
    document.getElementById('historical-data-status-tpex-10y').textContent = pct(result.tpex.coverage10YPercent);
    document.getElementById('historical-data-status-twse-quality').textContent = QUALITY_LABEL[result.twse.dataQuality] ?? result.twse.dataQuality;
    document.getElementById('historical-data-status-tpex-quality').textContent = QUALITY_LABEL[result.tpex.dataQuality] ?? result.tpex.dataQuality;
    el.historicalDataStatusUpdated.textContent = `最後更新：${result.lastUpdated}`;
    el.historicalDataStatusBody.hidden = false;
  } catch {
    el.historicalDataStatusLoading.hidden = true;
    el.historicalDataStatusError.hidden = false;
  }
}

loadCompanyNameCache();
renderWatchlist();
renderPortfolio();
renderMarketTop50();
renderSimulationList();
renderAlgorithmConfiguration();
renderAlgorithmVersionList();
renderAlgorithmValidation();
renderAiFinalOutput();
renderHistoricalDataStatus();
renderOverviewPage();
