// Individual-stock Production display layer.
// Presentation only: all scoring/recommendation values come from
// stock_analysis_results written by Stock-Analysis-System. This file never
// calculates an AI score or recommendation.
(() => {
  const loaded = { value: false };
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
  const fmtPct = (value) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%` : '—';

  async function get(path) {
    const token = window.APP_CONFIG?.SUPABASE_ANON_KEY;
    const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`GET ${path.split('?')[0]} failed (${response.status})`);
    return response.json();
  }

  function ensureProductionPanel() {
    const page = document.querySelector('#page-analysis');
    if (!page) return null;
    let panel = document.querySelector('#analysis-production-panel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'analysis-production-panel';
    panel.className = 'stock-panel';
    panel.style.marginTop = '12px';
    const tabs = page.querySelector('.stock-tabs');
    (tabs?.parentNode ?? page).insertBefore(panel, tabs?.nextSibling ?? null);
    return panel;
  }

  function renderLoading(symbol) {
    const panel = ensureProductionPanel();
    if (panel) panel.innerHTML = `<h3>Production 分析結果</h3><div class="stock-empty">正在讀取 ${esc(symbol)} 的 Production 結果…</div>`;
  }

  function renderError(message) {
    const panel = ensureProductionPanel();
    if (panel) panel.innerHTML = `<h3>Production 分析結果</h3><div class="stock-empty">讀取失敗：${esc(message)}</div>`;
  }

  function render({ result, daily, fundamentals }) {
    const panel = ensureProductionPanel();
    if (!panel) return;
    const score = result?.recommendation_score;
    const breakdown = result?.score_breakdown ?? {};
    const gaps = result?.data_gaps ?? [];
    const latest = daily.at(-1) ?? null;
    const previous = daily.at(-2) ?? null;
    const change = latest && previous && Number(previous.close) ? ((Number(latest.close) - Number(previous.close)) / Number(previous.close)) * 100 : null;
    const latestFundamental = fundamentals[0] ?? null;
    const target = result?.target_price;
    const risk = result?.risk_price;
    const horizon = result?.observation_horizons ? Object.values(result.observation_horizons).filter((x) => x?.suitable).map((x) => x.label).filter(Boolean).join('、') : '—';

    const dataGapLabels = {
      'fundamentals.eps': 'EPS', 'fundamentals.net_income': '淨利', 'fundamentals.equity': '股東權益',
      'fundamentals.book_value_per_share': '每股淨值', 'fundamentals.revenue_growth': '營收成長率',
      'chip.production_source': '籌碼 Production 資料源', 'market_daily.latest_trading_date': '最新交易日',
      'market_daily.duplicate_dates': '行情重複日期', 'market_daily.invalid_ohlcv': '行情 OHLCV 異常'
    };

    panel.innerHTML = `
      <h3>Production 分析結果 <span class="more">${esc(result?.calculation_date)} · ${esc(result?.calculation_version)}</span></h3>
      <p class="stock-panel-sub">結果由 Analysis Engine 計算後寫入 Supabase；Dashboard 不重新計算。</p>
      <div class="stock-grid-main" style="margin-top:10px">
        <div>
          <table class="stock-table"><tbody>
            <tr><th>AI Score</th><td>${esc(fmt(score, 4))} / 100</td></tr>
            <tr><th>決策</th><td>${esc(result?.decision_state)}</td></tr>
            <tr><th>參考價</th><td>${esc(fmt(result?.reference_price))}</td></tr>
            <tr><th>目標價</th><td>${esc(fmt(target))}</td></tr>
            <tr><th>風險價</th><td>${esc(fmt(risk))}</td></tr>
            <tr><th>預期報酬</th><td>${esc(fmtPct(result?.expected_return_pct))}</td></tr>
            <tr><th>適合週期</th><td>${esc(horizon)}</td></tr>
            <tr><th>資料狀態</th><td>${esc(result?.data_status)}</td></tr>
          </tbody></table>
        </div>
        <div>
          <h3 style="margin-top:0">目前正式模型分數</h3>
          <table class="stock-table"><tbody>
            <tr><th>Fundamental</th><td>${esc(fmt(breakdown.fundamental?.score, 2))} · ${esc(breakdown.fundamental?.status)}</td></tr>
            <tr><th>Technical</th><td>${esc(fmt(breakdown.technical?.score, 2))} · ${esc(breakdown.technical?.status)}</td></tr>
            <tr><th>Chip</th><td>${esc(breakdown.chip?.score)} · ${esc(breakdown.chip?.status)}</td></tr>
            <tr><th>模型版本</th><td>${esc(breakdown.model)}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="stock-grid-secondary" style="margin-top:12px">
        <div class="stock-panel"><h3>最新行情</h3><div class="stock-empty">${latest ? `${esc(latest.trading_date)}　開 ${esc(fmt(latest.open))}　高 ${esc(fmt(latest.high))}　低 ${esc(fmt(latest.low))}　收 ${esc(fmt(latest.close))}　量 ${esc(fmt(latest.volume, 0))}　${change == null ? '—' : esc(fmtPct(change))}` : '資料不足'}</div></div>
        <div class="stock-panel"><h3>基本面</h3><div class="stock-empty">${latestFundamental ? `期間 ${esc(latestFundamental.reporting_period)}　營收 ${esc(latestFundamental.revenue ?? '—')}　EPS ${esc(latestFundamental.eps ?? '—')}` : '資料不足'}</div></div>
        <div class="stock-panel"><h3>行情筆數</h3><div class="stock-empty">${esc(daily.length)} 筆；最新 ${esc(latest?.trading_date)}</div></div>
        <div class="stock-panel"><h3>證據強度</h3><div class="stock-empty">${esc(result?.evidence_strength)}</div></div>
      </div>
      <div style="margin-top:12px"><h3>目前資料缺口</h3><div class="stock-empty">${gaps.length ? gaps.map((gap) => `<span class="stock-industry" style="display:inline-block;margin:3px">${esc(dataGapLabels[gap] ?? gap)}</span>`).join('') : '目前沒有已記錄資料缺口'}</div></div>
      <div style="margin-top:8px"><h3>Recommendation Reason</h3><div class="stock-empty">${(result?.recommendation_reason ?? []).length ? result.recommendation_reason.map(esc).join('、') : '—'}</div></div>
      <div class="stock-footer-note">Source: ${esc(result?.source)} · Data as of: ${esc(result?.data_as_of)} · Production calculation version: ${esc(result?.calculation_version)}</div>`;
  }

  async function load(symbol, market = 'TWSE') {
    renderLoading(symbol);
    try {
      const encoded = encodeURIComponent(symbol.toUpperCase());
      const [resultRows, dailyRows, fundamentals] = await Promise.all([
        get(`stock_analysis_results?symbol=eq.${encoded}&market=eq.${encodeURIComponent(market)}&order=calculation_date.desc&limit=1`),
        // IMPORTANT: fetch the newest 120 trading rows. An ascending query with
        // limit=120 returns the oldest 120 rows and makes the Dashboard display
        // stale prices (e.g. 2024-08-06) while the Production result is 2026.
        get(`market_daily?symbol=eq.${encoded}&market=eq.${encodeURIComponent(market)}&order=trading_date.desc&limit=120`),
        get(`fundamentals?symbol=eq.${encoded}&market=eq.${encodeURIComponent(market)}&order=reporting_period.desc&limit=20`)
      ]);
      const result = resultRows[0] ?? null;
      if (!result) throw new Error(`尚無 ${symbol}/${market} 的 Production 分析結果`);
      // The renderer and chart expect chronological order.
      const daily = [...dailyRows].reverse();
      render({ result, daily, fundamentals });
      document.querySelector('#analysis-data-state')?.replaceChildren(document.createTextNode(result.data_status ?? '—'));
      document.querySelector('#analysis-ai-score')?.replaceChildren(document.createTextNode(fmt(result.recommendation_score, 4)));
      document.querySelector('#analysis-decision')?.replaceChildren(document.createTextNode(result.decision_state ?? '—'));
      document.querySelector('#analysis-target')?.replaceChildren(document.createTextNode(fmt(result.target_price)));
      document.querySelector('#analysis-risk')?.replaceChildren(document.createTextNode(fmt(result.risk_price)));
      document.querySelector('#analysis-return')?.replaceChildren(document.createTextNode(fmtPct(result.expected_return_pct)));
      document.querySelector('#analysis-calc-date')?.replaceChildren(document.createTextNode(result.calculation_date ?? '—'));
      document.querySelector('#analysis-symbol-display')?.replaceChildren(document.createTextNode(symbol));
      document.querySelector('#analysis-market-display')?.replaceChildren(document.createTextNode(market));
      document.querySelector('#analysis-breadcrumb-stock')?.replaceChildren(document.createTextNode(symbol));
      if (daily.at(-1)) {
        const latest = daily.at(-1);
        [['#analysis-price', latest.close], ['#analysis-open', latest.open], ['#analysis-high', latest.high], ['#analysis-low', latest.low], ['#analysis-volume', latest.volume]].forEach(([selector, value]) => document.querySelector(selector)?.replaceChildren(document.createTextNode(fmt(value))));
        document.querySelector('#analysis-price-asof')?.replaceChildren(document.createTextNode(`行情日期 ${latest.trading_date}`));
      }
    } catch (error) {
      renderError(error.message);
    }
  }

  function install() {
    if (loaded.value) return;
    loaded.value = true;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('#analysis-search');
      if (!button) return;
      const input = document.querySelector('#analysis-symbol');
      const symbol = String(input?.value ?? '').trim().toUpperCase();
      if (!symbol) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      load(symbol, 'TWSE');
    }, true);
    const observe = () => {
      const page = document.querySelector('#page-analysis');
      if (!page) return setTimeout(observe, 100);
      ensureProductionPanel();
    };
    observe();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
