// Wires real Production Data into the GPT UX baseline (docs/UX_BASELINE_V1.md,
// this repo's PR #1, branch feature/dashboard-ux-mvp) - per that baseline's own
// Implementation Constraint, this file does not redesign the UX; it replaces
// the baseline's UX-mock arrays/static panels with real Supabase reads and
// honestly discloses anything with no verified data source (never a
// fabricated placeholder number).
import { fetchTop50Snapshot, fetchTop50RowHistory, fetchMarketDaily, fetchFundamentals } from './lib/data.js';
import { buildObservationList } from './lib/observation-list.js';
import { OBSERVATION_LIST_HORIZONS } from './lib/horizons.js';
import { loadCompanyNames, lookupCompanyName, searchCompanyNames } from './lib/company-name-lookup.js';
import { createPortfolio } from './lib/portfolio.js';
import { runHistoricalDataStatus } from './lib/historical-data-status.js';
import { signIn, signUp, signOut, getStoredSession } from './lib/auth.js';

(async () => {
  const AHS = window.StockDashboard = {};
  const portfolio = createPortfolio({ storage: window.localStorage });

  // Baseline's short horizon keys -> the real six LOCKED horizon keys
  // persisted by the private repo's investment-horizon.js (lib/horizons.js).
  const HORIZON_KEY_MAP = { intraday: 'DAY_TRADING', short: 'SHORT_TERM', shortmid: 'SHORT_MEDIUM_TERM', mid: 'MEDIUM_TERM', midlong: 'MEDIUM_LONG_TERM', long: 'LONG_TERM' };
  const horizons = { intraday: '當沖（0–1日）', short: '短期（2週內）', shortmid: '短中期（3–6個月）', mid: '中期（6–12個月）', midlong: '中長期（12–36個月）', long: '長期（36個月以上）' };
  const pageNames = { strategy: '策略／參數', market: '市場分析', industry: '產業分析', backtest: '回測驗證', data: '資料中心', reports: '報告中心', settings: '系統設定' };

  let namesSnapshot = null;
  let snapshot = null;
  let horizonsData = null;
  let allEntries = [];

  function fmtNum(value, digits = 2) { return Number.isFinite(value) ? Number(value).toFixed(digits) : '—'; }
  function fmtPct(value) { return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '—'; }
  function tierLabel(score) {
    if (!Number.isFinite(score)) return '資料不足';
    if (score >= 90) return '強烈觀察';
    if (score >= 80) return '值得觀察';
    if (score >= 70) return '持續觀察';
    if (score >= 60) return '觀察';
    return '降低關注';
  }
  function decisionLabel(state) {
    return { INVESTABLE_CANDIDATE: '可投資候選', OBSERVATION: '觀察', NOT_QUALIFIED: '不符合條件', UNAVAILABLE: '資料不足' }[state] ?? state ?? '—';
  }
  function changeLabel(type) {
    return { NEW: '新增', UPGRADED: '升級', DOWNGRADED: '降級', REMOVED: '移除', UNCHANGED: '維持', RISK_INCREASED: '風險上升', RISK_DECREASED: '風險下降', TARGET_REVISED: '目標價調整', DATA_INSUFFICIENT: '資料不足' }[type] ?? type;
  }
  function nameOnly(symbol, market) {
    const name = namesSnapshot ? lookupCompanyName(namesSnapshot, symbol, market) : null;
    return name || symbol;
  }
  function symbolWithName(symbol, market) {
    const name = namesSnapshot ? lookupCompanyName(namesSnapshot, symbol, market) : null;
    return name ? `${symbol} ${name}` : symbol;
  }
  function isoDateDaysAgo(days) { return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); }

  function horizonLabelFor(entry) {
    if (!horizonsData) return '—';
    for (const h of OBSERVATION_LIST_HORIZONS) {
      if ((horizonsData[h.key] || []).some((x) => x.symbol === entry.symbol && x.market === entry.market)) return h.label;
    }
    return '—';
  }

  // --- Dashboard rendering (real data replacing the baseline's mock arrays) ---

  function renderStocksTable(list, forcedHorizonLabel) {
    const el = document.querySelector('#stock-table');
    if (!el) return;
    if (!list || list.length === 0) { el.innerHTML = '<tr><td colspan="10" class="empty">尚無真實資料</td></tr>'; return; }
    el.innerHTML = list.map((e, i) => `<tr>
      <td>${i + 1}</td>
      <td><button class="link-stock" data-symbol="${e.symbol}" data-market="${e.market}">${e.symbol}</button></td>
      <td>${nameOnly(e.symbol, e.market)}</td>
      <td>${forcedHorizonLabel || horizonLabelFor(e)}</td>
      <td><span class="score">${fmtNum(e.aiScore, 0)}</span></td>
      <td>${fmtNum(e.currentPrice)}</td>
      <td>${fmtNum(e.targetPrice)}</td>
      <td>${fmtPct(e.expectedReturnPercent)}</td>
      <td>${(e.aiReason || []).slice(0, 2).join('、') || '—'}</td>
      <td><span class="status">${tierLabel(e.aiScore)}</span></td>
    </tr>`).join('');
  }

  function renderChangesList(changed) {
    const el = document.querySelector('#changes');
    if (!el) return;
    if (!changed || changed.length === 0) { el.className = 'empty'; el.textContent = '今日無真實變化'; return; }
    el.className = '';
    el.innerHTML = changed.slice(0, 12).map((e) => `<div class="change-item">
      <b class="${e.changeType === 'UPGRADED' ? 'change-up' : e.changeType === 'DOWNGRADED' ? 'change-down' : ''}">${e.symbol}</b>
      <span>${nameOnly(e.symbol, e.market)}<br><small>${Number.isFinite(e.originalScore) ? fmtNum(e.originalScore, 0) : '—'} → ${fmtNum(e.aiScore, 0)} · ${decisionLabel(e.decisionState)}</small></span>
      <strong>${changeLabel(e.changeType)}</strong>
    </div>`).join('');
  }

  function renderHorizonGrid() {
    for (const [shortKey, realKey] of Object.entries(HORIZON_KEY_MAP)) {
      const btn = document.querySelector(`.horizon[data-horizon="${shortKey}"]`);
      if (!btn) continue;
      const strongEl = btn.querySelector('strong');
      const spanEl = btn.querySelector('span');
      if (!horizonsData) { strongEl.textContent = '–'; spanEl.textContent = '檔　平均分 –'; continue; }
      const list = horizonsData[realKey] ?? [];
      const avg = list.length > 0 ? list.reduce((sum, e) => sum + (e.aiScore ?? 0), 0) / list.length : null;
      strongEl.textContent = String(list.length);
      spanEl.textContent = `檔　平均分 ${Number.isFinite(avg) ? fmtNum(avg, 0) : '–'}`;
    }
  }

  function renderHeroAndSignals(entries, changedList) {
    document.querySelector('#hero-count').innerHTML = `${entries.length} <small>檔</small>`;
    const up = changedList.filter((e) => e.changeType === 'UPGRADED').length;
    const down = changedList.filter((e) => e.changeType === 'DOWNGRADED').length;
    const same = Math.max(entries.length - changedList.length, 0);
    document.querySelector('#signal-up').textContent = `↑ ${up}`;
    document.querySelector('#signal-same').textContent = `→ ${same}`;
    document.querySelector('#signal-down').textContent = `↓ ${down}`;
    document.querySelector('#signal-up-note').textContent = up > 0 ? '較前次評分上升' : '今日無升級';
    document.querySelector('#signal-down-note').textContent = down > 0 ? '較前次評分下降' : '今日無降級';

    const total = snapshot?.current?.length ?? 0;
    const available = snapshot?.current?.filter((r) => r.data_status === 'AVAILABLE').length ?? 0;
    const pct = total > 0 ? (available / total) * 100 : null;
    document.querySelector('#data-completeness').textContent = Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '–%';
    document.querySelector('#data-completeness-bar').style.width = Number.isFinite(pct) ? `${pct}%` : '0%';
    document.querySelector('#data-asof').textContent = `最新交易日：${snapshot?.asOfDate ?? '–'}`;
  }

  // --- Portfolio (real localStorage positions + real current prices) ---

  function renderPortfolio() {
    const list = document.querySelector('#portfolio-list');
    if (!list) return;
    const positions = portfolio.list();
    if (positions.length === 0) { list.className = 'empty'; list.textContent = '尚未輸入持股。'; return; }
    list.className = '';
    const byKey = new Map((snapshot?.current ?? []).map((r) => [`${r.market}:${r.symbol}`, r]));
    list.innerHTML = positions.map((p) => {
      const row = p.market ? byKey.get(`${p.market}:${p.symbol}`) : [...byKey.values()].find((r) => r.symbol === p.symbol);
      const price = row?.reference_price ?? null;
      const marketValue = Number.isFinite(price) ? price * p.shares : null;
      const costBasis = p.averageCost * p.shares;
      const pnl = Number.isFinite(marketValue) ? marketValue - costBasis : null;
      const returnPct = Number.isFinite(pnl) ? (pnl / costBasis) * 100 : null;
      return `<div class="change-item">
        <b class="${pnl > 0 ? 'change-up' : pnl < 0 ? 'change-down' : ''}">${p.symbol}</b>
        <span>${p.name || nameOnly(p.symbol, p.market)}　股數 ${p.shares}　成本 ${fmtNum(p.averageCost)}<br>
        <small>現價 ${Number.isFinite(price) ? fmtNum(price) : '無資料'}　市值 ${Number.isFinite(marketValue) ? fmtNum(marketValue, 0) : '—'}　損益 ${Number.isFinite(pnl) ? fmtNum(pnl, 0) : '—'}${Number.isFinite(returnPct) ? `（${fmtPct(returnPct)}）` : ''}　AI評分 ${row ? fmtNum(row.recommendation_score, 0) : '無資料'}</small></span>
        <strong class="remove-position" data-remove="${p.symbol}">移除</strong>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-remove]').forEach((el) => el.addEventListener('click', () => { portfolio.remove(el.dataset.remove); renderPortfolio(); }));
  }

  document.querySelector('#add-portfolio')?.addEventListener('click', () => {
    const symbolInput = document.querySelector('#portfolio-input');
    const sharesInput = document.querySelector('#portfolio-shares');
    const costInput = document.querySelector('#portfolio-cost');
    try {
      portfolio.add({ symbol: symbolInput.value, shares: Number(sharesInput.value), averageCost: Number(costInput.value) });
      symbolInput.value = ''; sharesInput.value = ''; costInput.value = '';
      renderPortfolio();
    } catch (err) { alert(err.message); }
  });

  // --- Individual Stock Analysis (real search + real price/fundamentals/history) ---

  // G5-06: uses Promise.allSettled (not Promise.all) so one failed fetch
  // (e.g. a transient Supabase timeout on fundamentals) never blanks the
  // other two panels that succeeded - each panel renders from its own
  // settled result independently, matching the spec's "不得因單一市場資料
  // 失敗造成整個 Dashboard 崩潰" requirement. A real gap found and fixed
  // during this Gate's QA pass, not a hypothetical.
  async function loadAnalysis(symbol, market) {
    document.querySelector('#analysis-title').textContent = `${symbolWithName(symbol, market)}（${market}）`;
    document.querySelector('#analysis-fundamentals').innerHTML = '<div class="empty">載入中...</div>';
    document.querySelector('#analysis-history').innerHTML = '<div class="empty">載入中...</div>';
    document.querySelector('#analysis-prices').innerHTML = '<div class="empty">載入中...</div>';
    document.querySelector('#analysis-score').textContent = '–';
    document.querySelector('#analysis-target').textContent = '目標價：載入中...';
    document.querySelector('#analysis-horizon').textContent = '觀察週期：載入中...';
    document.querySelector('#analysis-reasons').innerHTML = '<li>載入中...</li>';

    const [dailyResult, fundamentalResult, historyResult] = await Promise.allSettled([
      fetchMarketDaily(symbol, market, isoDateDaysAgo(60)),
      fetchFundamentals(symbol, market),
      fetchTop50RowHistory(symbol, market, 30)
    ]);

    if (historyResult.status === 'fulfilled') {
      const top50History = historyResult.value;
      const top50Row = (snapshot?.current ?? []).find((r) => r.symbol === symbol && r.market === market) ?? top50History[0] ?? null;
      document.querySelector('#analysis-score').textContent = top50Row ? fmtNum(top50Row.recommendation_score, 0) : '–';
      document.querySelector('#analysis-target').textContent = `目標價：${top50Row?.target_price != null ? fmtNum(top50Row.target_price) : '尚無真實資料'}`;
      const horizonLabels = top50Row?.observation_horizons ? OBSERVATION_LIST_HORIZONS.filter((h) => top50Row.observation_horizons[h.key]).map((h) => h.label).join('、') : '';
      document.querySelector('#analysis-horizon').textContent = `觀察週期：${horizonLabels || '不在目前觀察清單'}`;
      const reasons = top50Row?.recommendation_reason ?? [];
      document.querySelector('#analysis-reasons').innerHTML = reasons.length > 0 ? reasons.map((r) => `<li>${r}</li>`).join('') : '<li>尚無真實觸發訊號資料</li>';
      document.querySelector('#analysis-history').innerHTML = top50History.length > 0 ? `<div class="table-wrap"><table><thead><tr><th>日期</th><th>AI評分</th><th>目標價</th><th>建議</th></tr></thead><tbody>
        ${top50History.map((r) => `<tr><td>${r.calculation_date}</td><td>${fmtNum(r.recommendation_score, 0)}</td><td>${fmtNum(r.target_price)}</td><td>${decisionLabel(r.decision_state)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">尚無真實推薦紀錄</div>';
    } else {
      document.querySelector('#analysis-target').textContent = '目標價：讀取失敗';
      document.querySelector('#analysis-horizon').textContent = '觀察週期：讀取失敗';
      document.querySelector('#analysis-reasons').innerHTML = '<li>讀取失敗</li>';
      document.querySelector('#analysis-history').innerHTML = `<div class="empty">AI 推薦歷史讀取失敗：${historyResult.reason.message}</div>`;
    }

    if (fundamentalResult.status === 'fulfilled') {
      const dailyRows = dailyResult.status === 'fulfilled' ? dailyResult.value : [];
      const latest = dailyRows[dailyRows.length - 1] ?? null;
      const latestFundamental = fundamentalResult.value[0] ?? null;
      const per = latest && latestFundamental?.eps ? latest.close / latestFundamental.eps : null;
      const pbr = latest && latestFundamental?.book_value_per_share ? latest.close / latestFundamental.book_value_per_share : null;
      document.querySelector('#analysis-fundamentals').innerHTML = latestFundamental ? `<table><tbody>
        <tr><th>期間</th><td>${latestFundamental.reporting_period ?? '—'}</td></tr>
        <tr><th>EPS</th><td>${fmtNum(latestFundamental.eps)}</td></tr>
        <tr><th>本益比 (P/E)</th><td>${Number.isFinite(per) ? fmtNum(per) : '資料不足'}</td></tr>
        <tr><th>股價淨值比 (P/B)</th><td>${Number.isFinite(pbr) ? fmtNum(pbr) : '資料不足'}</td></tr>
        <tr><th>資料來源</th><td>${latestFundamental.source ?? '—'}</td></tr>
      </tbody></table>` : '<div class="empty">尚無真實基本面資料</div>';
    } else {
      document.querySelector('#analysis-fundamentals').innerHTML = `<div class="empty">基本面資料讀取失敗：${fundamentalResult.reason.message}</div>`;
    }

    if (dailyResult.status === 'fulfilled') {
      const dailyRows = dailyResult.value;
      document.querySelector('#analysis-prices').innerHTML = dailyRows.length > 0 ? `<div class="table-wrap" style="max-height:280px;overflow-y:auto;"><table><thead><tr><th>日期</th><th>開盤</th><th>最高</th><th>最低</th><th>收盤</th><th>成交量</th></tr></thead><tbody>
        ${dailyRows.slice().reverse().map((r) => `<tr><td>${r.trading_date}</td><td>${fmtNum(r.open)}</td><td>${fmtNum(r.high)}</td><td>${fmtNum(r.low)}</td><td>${fmtNum(r.close)}</td><td>${r.volume}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">尚無真實股價資料</div>';
    } else {
      document.querySelector('#analysis-prices').innerHTML = `<div class="empty">股價資料讀取失敗：${dailyResult.reason.message}</div>`;
    }
  }

  async function runAnalysisSearch(query, marketHint) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return;
    let symbol = trimmed.toUpperCase();
    let market = marketHint || null;
    if (!market && namesSnapshot) {
      const matches = searchCompanyNames(namesSnapshot, trimmed, { limit: 1 });
      if (matches[0]) { symbol = matches[0].symbol; market = matches[0].market; }
    }
    if (!market) {
      const row = (snapshot?.current ?? []).find((r) => r.symbol === symbol);
      market = row?.market ?? 'TWSE';
    }
    await loadAnalysis(symbol, market);
  }

  document.querySelector('#analysis-search-btn')?.addEventListener('click', () => runAnalysisSearch(document.querySelector('#analysis-search').value));
  document.querySelector('#analysis-search')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); runAnalysisSearch(event.target.value); } });

  // --- AI Selection Flow (real score_breakdown, only Fundamental/Technical real) ---

  function renderEngineDetail(row) {
    const scoreEl = document.querySelector('#engine-score');
    const weightsEl = document.querySelector('#engine-weights');
    const decisionEl = document.querySelector('#engine-decision');
    if (!row?.score_breakdown) { scoreEl.textContent = '–'; weightsEl.className = 'empty'; weightsEl.textContent = '尚無真實計分細節'; decisionEl.textContent = '–'; return; }
    const b = row.score_breakdown;
    scoreEl.textContent = fmtNum(b.composite_score, 1);
    decisionEl.textContent = decisionLabel(row.decision_state);
    weightsEl.className = '';
    weightsEl.innerHTML = `
      <div class="weight-row"><span>Fundamental（基本面分析）</span><b>${fmtNum(b.fundamental.score, 0)}</b><em>${fmtNum(b.fundamental.weight * 100, 0)}%</em><strong>${fmtNum(b.fundamental.weighted_score)}</strong></div>
      <div class="weight-row"><span>Technical（技術分析）</span><b>${fmtNum(b.technical.score, 0)}</b><em>${fmtNum(b.technical.weight * 100, 0)}%</em><strong>${fmtNum(b.technical.weighted_score)}</strong></div>
      <div class="weight-row"><span>Chip（籌碼分析）</span><b>不可用</b><em>0%</em><strong>0</strong></div>
      <p style="font-size:11px;color:#6d7e8e;margin-top:8px;">目前僅 Fundamental／Technical 為 Production 真實計算維度；趨勢／動能／估值／市場環境／風險修正等其餘工具尚無驗證資料來源，誠實標示為未啟用（權重 0%），非虛構分數。</p>`;
  }

  function populateEngineSelect() {
    const select = document.querySelector('#engine-symbol');
    if (!select) return;
    const rows = (snapshot?.current ?? []).filter((r) => r.data_status === 'AVAILABLE' && r.score_breakdown);
    select.innerHTML = '<option value="">請選擇</option>' + rows.map((r) => `<option value="${r.market}:${r.symbol}">${symbolWithName(r.symbol, r.market)}</option>`).join('');
    select.onchange = () => {
      const [market, symbol] = select.value.split(':');
      renderEngineDetail(rows.find((r) => r.market === market && r.symbol === symbol));
    };
    if (rows.length > 0) { select.value = `${rows[0].market}:${rows[0].symbol}`; renderEngineDetail(rows[0]); }
    else { renderEngineDetail(null); }
  }

  // --- 資料中心 (real historical coverage, extends the baseline's generic page) ---

  const GENERIC_DATA_DEFAULT = '<h3>資料與驗證</h3><p>GitHub 負責前端與資料收集流程；Production Database 保存市場資料。AI 分析結果必須可追溯至資料、計算、評分與結論。</p>';

  async function loadHistoricalIntoGeneric() {
    const panel = document.querySelector('#generic-data-panel');
    if (!panel) return;
    panel.innerHTML = '<h3>歷史資料涵蓋（真實查詢）</h3><div class="empty">載入中...</div>';
    try {
      const status = await runHistoricalDataStatus({ url: window.APP_CONFIG.SUPABASE_URL, apiKey: window.APP_CONFIG.SUPABASE_ANON_KEY });
      const line = (m, label) => `<div class="status-line">${label}：${m.earliestDate ?? '—'} ～ ${m.latestDate ?? '—'}（共 ${m.totalRows ?? '—'} 筆，最新日期 ${m.symbolCountOnLatestDate} 檔，${m.dataQuality === 'PASS' ? '品質檢查通過' : m.dataQuality === 'NO_DATA' ? '無資料' : '品質檢查未通過'}）</div>`;
      panel.innerHTML = `<h3>歷史資料涵蓋（真實查詢）</h3>${line(status.twse, 'TWSE')}${line(status.tpex, 'TPEx')}`;
    } catch (err) {
      panel.innerHTML = `<h3>歷史資料涵蓋（真實查詢）</h3><div class="empty">讀取失敗：${err.message}</div>`;
    }
  }

  // --- Auth (G3-02: Supabase Auth login/logout, gated behind the private
  // repo's migration 012 once applied - currentBearerToken() in lib/auth.js
  // already upgrades every data.js/historical-data-status.js request to
  // the real session's access token when one exists, so no data-layer
  // change is needed here beyond reloading after login/logout state
  // changes. Added to the baseline's existing .top-meta topbar area - the
  // smallest slot that already exists for status-style controls, not a
  // new page or a redesigned topbar.) ---

  function renderAuthBox() {
    const session = getStoredSession();
    const statusEl = document.querySelector('#auth-status');
    const formEl = document.querySelector('#login-form');
    const logoutBtn = document.querySelector('#logout-btn');
    if (!statusEl || !formEl || !logoutBtn) return;
    if (session?.user) {
      statusEl.hidden = false;
      statusEl.textContent = `已登入：${session.user.email}`;
      formEl.hidden = true;
      logoutBtn.hidden = false;
    } else {
      statusEl.hidden = true;
      formEl.hidden = false;
      logoutBtn.hidden = true;
    }
  }

  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector('#login-email').value;
    const password = document.querySelector('#login-password').value;
    try {
      const session = await signIn({ email, password });
      if (!session) { alert('登入失敗：此帳號可能需要先完成 Email 驗證'); return; }
      renderAuthBox();
      await reloadData();
    } catch (err) { alert(err.message); }
  });
  document.querySelector('#signup-btn')?.addEventListener('click', async () => {
    const email = document.querySelector('#login-email').value;
    const password = document.querySelector('#login-password').value;
    if (!email || !password) { alert('請先輸入 Email 與密碼再註冊'); return; }
    try {
      await signUp({ email, password });
      alert('註冊成功。若 Supabase 專案要求 Email 驗證，請至信箱完成驗證後再登入。');
    } catch (err) { alert(err.message); }
  });
  document.querySelector('#logout-btn')?.addEventListener('click', async () => {
    await signOut();
    renderAuthBox();
    await reloadData();
  });

  // --- Router / navigation (structure unchanged from the confirmed baseline) ---

  function showPage(page) {
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active-page'));
    const target = document.querySelector(`#page-${page}`) || document.querySelector('#page-generic');
    target.classList.add('active-page');
    if (target.id === 'page-generic') {
      document.querySelector('#generic-title').textContent = pageNames[page] || '功能';
      document.querySelector('#generic-desc').textContent = '此功能已建立 UX 入口，下一階段由資料層與分析引擎載入實際結果。';
      if (page === 'data') loadHistoricalIntoGeneric();
      else document.querySelector('#generic-data-panel').innerHTML = GENERIC_DATA_DEFAULT;
    }
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showHorizon(h) {
    document.querySelectorAll('.nav-sub').forEach((b) => b.classList.toggle('active-sub', b.dataset.horizon === h));
    const title = document.querySelector('.section-head h2');
    if (title) title.textContent = `AI ${horizons[h]}觀察清單`;
    document.querySelectorAll('.horizon').forEach((b) => b.classList.toggle('selected', b.dataset.horizon === h));
    const realKey = HORIZON_KEY_MAP[h];
    const list = (horizonsData?.[realKey] ?? []).slice(0, 10);
    renderStocksTable(list, horizons[h].replace(/（.*）/, ''));
  }

  document.addEventListener('click', (event) => {
    const pageBtn = event.target.closest('[data-page]');
    if (pageBtn) { showPage(pageBtn.dataset.page); return; }
    const horizonBtn = event.target.closest('[data-horizon]');
    if (horizonBtn) { showPage('dashboard'); showHorizon(horizonBtn.dataset.horizon); return; }
    const stockBtn = event.target.closest('.link-stock');
    if (stockBtn) {
      showPage('analysis');
      document.querySelector('#analysis-search').value = stockBtn.dataset.symbol;
      runAnalysisSearch(stockBtn.dataset.symbol, stockBtn.dataset.market);
    }
  });

  AHS.showPage = showPage;
  AHS.horizons = horizons;

  // --- Data loading: real Production Data, never fall back to mock arrays.
  // Callable again after login/logout so a real authenticated session
  // (once migration 012 is applied) is reflected without a page reload. ---

  async function reloadData() {
    try {
      snapshot = await fetchTop50Snapshot();
      if (snapshot.asOfDate) {
        horizonsData = buildObservationList(snapshot);
        allEntries = [...new Map(Object.values(horizonsData).flat().map((e) => [`${e.market}:${e.symbol}`, e])).values()];
      } else {
        horizonsData = null;
        allEntries = [];
      }
    } catch (err) {
      snapshot = null;
      horizonsData = null;
      allEntries = [];
      document.querySelector('#system-status').textContent = '● 資料連線異常';
      document.querySelector('#stock-table').innerHTML = `<tr><td colspan="10" class="empty">Production Data 讀取失敗：${err.message}</td></tr>`;
      document.querySelector('#changes').className = 'empty';
      document.querySelector('#changes').textContent = `讀取失敗：${err.message}`;
    }

    if (snapshot?.asOfDate) {
      const changedList = allEntries.filter((e) => e.changeType !== 'UNCHANGED');
      const top10 = allEntries.filter((e) => Number.isFinite(e.aiScore)).sort((a, b) => b.aiScore - a.aiScore).slice(0, 10);
      renderStocksTable(top10);
      renderChangesList(changedList);
      renderHeroAndSignals(allEntries, changedList);
    } else if (snapshot) {
      document.querySelector('#system-status').textContent = '● 尚無真實資料';
      renderStocksTable([]);
      document.querySelector('#changes').className = 'empty';
      document.querySelector('#changes').textContent = '今日無真實變化';
    }

    renderHorizonGrid();
    populateEngineSelect();
    renderPortfolio();
  }

  // --- Init ---

  renderAuthBox();
  try { namesSnapshot = await loadCompanyNames(); } catch { /* search/name display degrades to bare symbols */ }
  await reloadData();
})();
