import { fetchTop50Snapshot, fetchTop50RowHistory, fetchMarketDaily, fetchFundamentals } from './lib/data.js';
import { buildObservationList } from './lib/observation-list.js';
import { OBSERVATION_LIST_HORIZONS } from './lib/horizons.js';
import { loadCompanyNames, lookupCompanyName, searchCompanyNames } from './lib/company-name-lookup.js';
import { runHistoricalDataStatus } from './lib/historical-data-status.js';
import { signIn, signUp, signOut, getStoredSession } from './lib/auth.js';

(async () => {
  const AHS = window.StockDashboard = {};
  const HORIZON_KEY_MAP = { intraday: 'DAY_TRADING', short: 'SHORT_TERM', shortmid: 'SHORT_MEDIUM_TERM', mid: 'MEDIUM_TERM', midlong: 'MEDIUM_LONG_TERM', long: 'LONG_TERM' };
  const horizons = { intraday: '當沖（0–1日）', short: '短期（2週內）', shortmid: '短中期（3–6個月）', mid: '中期（6–12個月）', midlong: '中長期（12–36個月）', long: '長期（36個月以上）' };
  let namesSnapshot = null, snapshot = null, horizonsData = null, allEntries = [];

  const el = (selector) => document.querySelector(selector);
  const setText = (selector, value) => { const node = el(selector); if (node) node.textContent = value; };
  const setHTML = (selector, value) => { const node = el(selector); if (node) node.innerHTML = value; };
  const fmtNum = (value, digits = 2) => Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
  const fmtPct = (value) => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '—';
  const tierLabel = (score) => !Number.isFinite(score) ? '資料不足' : score >= 90 ? '強烈觀察' : score >= 80 ? '值得觀察' : score >= 70 ? '持續觀察' : score >= 60 ? '觀察' : '降低關注';
  const decisionLabel = (state) => ({ INVESTABLE_CANDIDATE: '可投資候選', OBSERVATION: '觀察', NOT_QUALIFIED: '不符合條件', UNAVAILABLE: '資料不足' }[state] ?? state ?? '—');
  const changeLabel = (type) => ({ NEW: '新增', UPGRADED: '升級', DOWNGRADED: '降級', REMOVED: '移除', UNCHANGED: '維持', RISK_INCREASED: '風險上升', RISK_DECREASED: '風險下降', TARGET_REVISED: '目標價調整', DATA_INSUFFICIENT: '資料不足' }[type] ?? type);
  const nameOnly = (symbol, market) => (namesSnapshot ? lookupCompanyName(namesSnapshot, symbol, market) : null) || symbol;
  const symbolWithName = (symbol, market) => { const name = namesSnapshot ? lookupCompanyName(namesSnapshot, symbol, market) : null; return name ? `${symbol} ${name}` : symbol; };
  const isoDateDaysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  function horizonLabelFor(entry) {
    if (!horizonsData) return '—';
    for (const h of OBSERVATION_LIST_HORIZONS) if ((horizonsData[h.key] || []).some((x) => x.symbol === entry.symbol && x.market === entry.market)) return h.label;
    return '—';
  }

  function renderStocksTable(list, forcedHorizonLabel) {
    const node = el('#stock-table'); if (!node) return;
    if (!list?.length) { node.innerHTML = '<tr><td colspan="10" class="empty">尚無真實資料</td></tr>'; return; }
    node.innerHTML = list.map((e, i) => `<tr><td>${i + 1}</td><td><button class="link-stock" data-symbol="${e.symbol}" data-market="${e.market}">${e.symbol}</button></td><td>${nameOnly(e.symbol, e.market)}</td><td>${forcedHorizonLabel || horizonLabelFor(e)}</td><td><span class="score">${fmtNum(e.aiScore, 0)}</span></td><td>${fmtNum(e.currentPrice)}</td><td>${fmtNum(e.targetPrice)}</td><td>${fmtPct(e.expectedReturnPercent)}</td><td>${(e.aiReason || []).slice(0, 2).join('、') || '—'}</td><td><span class="status">${tierLabel(e.aiScore)}</span></td></tr>`).join('');
  }

  function renderChangesList(changed) {
    const node = el('#changes'); if (!node) return;
    if (!changed?.length) { node.className = 'empty'; node.textContent = '今日無真實變化'; return; }
    node.className = '';
    node.innerHTML = changed.slice(0, 12).map((e) => `<div class="change-item"><b class="${e.changeType === 'UPGRADED' ? 'change-up' : e.changeType === 'DOWNGRADED' ? 'change-down' : ''}">${e.symbol}</b><span>${nameOnly(e.symbol, e.market)}<br><small>${Number.isFinite(e.originalScore) ? fmtNum(e.originalScore, 0) : '—'} → ${fmtNum(e.aiScore, 0)} · ${decisionLabel(e.decisionState)}</small></span><strong>${changeLabel(e.changeType)}</strong></div>`).join('');
  }

  function renderHorizonGrid() {
    for (const [shortKey, realKey] of Object.entries(HORIZON_KEY_MAP)) {
      const btn = document.querySelector(`.horizon[data-horizon="${shortKey}"]`); if (!btn) continue;
      const list = horizonsData?.[realKey] ?? [];
      const avg = list.length ? list.reduce((sum, e) => sum + (e.aiScore ?? 0), 0) / list.length : null;
      btn.querySelector('strong').textContent = String(list.length);
      btn.querySelector('span').textContent = `檔　平均分 ${Number.isFinite(avg) ? fmtNum(avg, 0) : '–'}`;
    }
  }

  function renderDashboardMeta(entries, changedList) {
    setText('#hero-count', `${entries.length}`);
    const total = snapshot?.current?.length ?? 0;
    const available = snapshot?.current?.filter((r) => r.data_status === 'AVAILABLE').length ?? 0;
    const pct = total ? (available / total) * 100 : null;
    setText('#data-completeness', `資料完整度：${Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '待確認'}`);
    setText('#system-status', '● 系統正常');
  }

  async function loadAnalysis(symbol, market) {
    setText('#analysis-conclusion', `${symbolWithName(symbol, market)}（${market}）｜載入中...`);
    setText('#analysis-provenance', '資料追溯：載入中...');
    setHTML('#analysis-fundamentals', '<div class="empty">載入中...</div>');
    setHTML('#analysis-market', '<div class="empty">載入中...</div>');
    const [dailyResult, fundamentalResult, historyResult] = await Promise.allSettled([
      fetchMarketDaily(symbol, market, isoDateDaysAgo(60)), fetchFundamentals(symbol, market), fetchTop50RowHistory(symbol, market, 30)
    ]);
    const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
    const row = (snapshot?.current ?? []).find((r) => r.symbol === symbol && r.market === market) ?? history[0] ?? null;
    const score = row?.recommendation_score;
    const target = row?.target_price;
    const horizonLabels = row?.observation_horizons ? OBSERVATION_LIST_HORIZONS.filter((h) => row.observation_horizons[h.key]).map((h) => h.label).join('、') : '';
    const reasons = row?.recommendation_reason ?? [];
    setText('#analysis-conclusion', row ? `AI 評分 ${fmtNum(score, 0)}｜${decisionLabel(row.decision_state)}｜目標價 ${target != null ? fmtNum(target) : '尚無真實資料'}｜觀察週期 ${horizonLabels || '不在目前觀察清單'}` : '尚無真實推薦資料');
    setText('#analysis-provenance', `推薦歷史：${history.length ? `${history.length} 筆真實紀錄；最新計算日 ${history[0]?.calculation_date ?? '—'}` : '尚無真實推薦紀錄'}${reasons.length ? `｜理由：${reasons.slice(0, 3).join('、')}` : ''}`);
    if (fundamentalResult.status === 'fulfilled') {
      const f = fundamentalResult.value[0] ?? null, daily = dailyResult.status === 'fulfilled' ? dailyResult.value : [], latest = daily.at(-1) ?? null;
      const per = latest && f?.eps ? latest.close / f.eps : null;
      const pbr = latest && f?.book_value_per_share ? latest.close / f.book_value_per_share : null;
      setHTML('#analysis-fundamentals', f ? `<table><tbody><tr><th>期間</th><td>${f.reporting_period ?? '—'}</td></tr><tr><th>EPS</th><td>${fmtNum(f.eps)}</td></tr><tr><th>本益比</th><td>${Number.isFinite(per) ? fmtNum(per) : '資料不足'}</td></tr><tr><th>股價淨值比</th><td>${Number.isFinite(pbr) ? fmtNum(pbr) : '資料不足'}</td></tr><tr><th>資料來源</th><td>${f.source ?? '—'}</td></tr></tbody></table>` : '<div class="empty">尚無真實基本面資料</div>');
    } else setHTML('#analysis-fundamentals', `<div class="empty">基本面資料讀取失敗：${fundamentalResult.reason?.message ?? '未知錯誤'}</div>`);
    if (dailyResult.status === 'fulfilled') {
      const rows = dailyResult.value;
      setHTML('#analysis-market', rows.length ? `<div class="table-wrap" style="max-height:280px;overflow-y:auto"><table><thead><tr><th>日期</th><th>開盤</th><th>最高</th><th>最低</th><th>收盤</th><th>成交量</th></tr></thead><tbody>${rows.slice().reverse().map((r) => `<tr><td>${r.trading_date}</td><td>${fmtNum(r.open)}</td><td>${fmtNum(r.high)}</td><td>${fmtNum(r.low)}</td><td>${fmtNum(r.close)}</td><td>${r.volume ?? '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">尚無真實股價資料</div>');
    } else setHTML('#analysis-market', `<div class="empty">股價資料讀取失敗：${dailyResult.reason?.message ?? '未知錯誤'}</div>`);
  }

  async function runAnalysisSearch(query, marketHint) {
    const trimmed = String(query || '').trim(); if (!trimmed) return;
    let symbol = trimmed.toUpperCase(), market = marketHint || null;
    if (!market && namesSnapshot) { const matches = searchCompanyNames(namesSnapshot, trimmed, { limit: 1 }); if (matches[0]) { symbol = matches[0].symbol; market = matches[0].market; } }
    if (!market) market = (snapshot?.current ?? []).find((r) => r.symbol === symbol)?.market ?? 'TWSE';
    await loadAnalysis(symbol, market);
  }

  function renderEngineDetail(row) {
    const breakdown = row?.score_breakdown;
    if (!breakdown) { setText('#engine-score', '–'); setHTML('#engine-breakdown', '<div class="empty">尚無真實計分細節</div>'); return; }
    setText('#engine-score', fmtNum(breakdown.composite_score, 1));
    setHTML('#engine-breakdown', `<div class="weight-row"><span>Fundamental（基本面）</span><b>${fmtNum(breakdown.fundamental?.score, 0)}</b><em>${fmtNum((breakdown.fundamental?.weight ?? 0) * 100, 0)}%</em><strong>${fmtNum(breakdown.fundamental?.weighted_score)}</strong></div><div class="weight-row"><span>Technical（技術面）</span><b>${fmtNum(breakdown.technical?.score, 0)}</b><em>${fmtNum((breakdown.technical?.weight ?? 0) * 100, 0)}%</em><strong>${fmtNum(breakdown.technical?.weighted_score)}</strong></div><p class="kpi-note">決策：${decisionLabel(row.decision_state)}。目前僅呈現 Production 已驗證的 Fundamental／Technical 維度。</p>`);
  }

  function populateEngineSelect() {
    const input = el('#engine-symbol'); if (!input) return;
    const rows = (snapshot?.current ?? []).filter((r) => r.data_status === 'AVAILABLE' && r.score_breakdown);
    if (input.tagName === 'SELECT') {
      input.innerHTML = '<option value="">請選擇</option>' + rows.map((r) => `<option value="${r.market}:${r.symbol}">${symbolWithName(r.symbol, r.market)}</option>`).join('');
      input.onchange = () => { const [market, symbol] = input.value.split(':'); renderEngineDetail(rows.find((r) => r.market === market && r.symbol === symbol)); };
    } else if (rows.length) input.value = rows[0].symbol;
    renderEngineDetail(rows[0] ?? null);
  }

  async function loadDataPage() {
    const node = el('#data-content'); if (!node) return;
    node.innerHTML = '<div class="empty">載入中...</div>';
    try { const status = await runHistoricalDataStatus({ url: window.APP_CONFIG.SUPABASE_URL, apiKey: window.APP_CONFIG.SUPABASE_ANON_KEY }); node.innerHTML = `<h3>歷史資料涵蓋（真實查詢）</h3><p>TWSE：${status.twse.earliestDate ?? '—'} ～ ${status.twse.latestDate ?? '—'}，${status.twse.totalRows ?? '—'} 筆。</p><p>TPEx：${status.tpex.earliestDate ?? '—'} ～ ${status.tpex.latestDate ?? '—'}，${status.tpex.totalRows ?? '—'} 筆。</p>`; }
    catch (err) { node.innerHTML = `<div class="empty">讀取失敗：${err.message}</div>`; }
  }

  function showPage(page) {
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active-page'));
    const target = el(`#page-${page}`) || el('#page-dashboard'); target?.classList.add('active-page');
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    if (page === 'data') loadDataPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showHorizon(h) {
    showPage('dashboard');
    document.querySelectorAll('.nav-sub').forEach((b) => b.classList.toggle('active-sub', b.dataset.horizon === h));
    document.querySelectorAll('.horizon').forEach((b) => b.classList.toggle('selected', b.dataset.horizon === h));
    const title = document.querySelector('.content-grid .section-head h2'); if (title) title.textContent = `AI ${horizons[h]}觀察清單`;
    renderStocksTable((horizonsData?.[HORIZON_KEY_MAP[h]] ?? []).slice(0, 10), horizons[h].replace(/（.*）/, ''));
  }

  document.addEventListener('click', (event) => {
    const pageBtn = event.target.closest('[data-page]'); if (pageBtn) { showPage(pageBtn.dataset.page); return; }
    const horizonBtn = event.target.closest('[data-horizon]'); if (horizonBtn) { showHorizon(horizonBtn.dataset.horizon); return; }
    const stockBtn = event.target.closest('.link-stock'); if (stockBtn) { showPage('analysis'); const input = el('#analysis-symbol'); if (input) input.value = stockBtn.dataset.symbol; runAnalysisSearch(stockBtn.dataset.symbol, stockBtn.dataset.market); }
  });
  el('#analysis-search')?.addEventListener('click', () => runAnalysisSearch(el('#analysis-symbol')?.value));
  el('#analysis-symbol')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') runAnalysisSearch(event.target.value); });
  el('#engine-run')?.addEventListener('click', () => { const symbol = String(el('#engine-symbol')?.value || '').trim().toUpperCase(); const row = (snapshot?.current ?? []).find((r) => r.symbol === symbol); renderEngineDetail(row); });

  async function reloadData() {
    try {
      snapshot = await fetchTop50Snapshot();
      if (snapshot.asOfDate) { horizonsData = buildObservationList(snapshot); allEntries = [...new Map(Object.values(horizonsData).flat().map((e) => [`${e.market}:${e.symbol}`, e])).values()]; }
      else { horizonsData = {}; allEntries = []; }
    } catch (err) {
      snapshot = null; horizonsData = {}; allEntries = [];
      setText('#system-status', '● 資料連線異常');
      setHTML('#stock-table', `<tr><td colspan="10" class="empty">Production Data 讀取失敗：${err.message}</td></tr>`);
      setHTML('#changes', `<div class="empty">讀取失敗：${err.message}</div>`);
      return;
    }
    if (snapshot?.asOfDate) {
      const changed = allEntries.filter((e) => e.changeType !== 'UNCHANGED');
      renderStocksTable(allEntries.filter((e) => Number.isFinite(e.aiScore)).sort((a, b) => b.aiScore - a.aiScore).slice(0, 10));
      renderChangesList(changed); renderDashboardMeta(allEntries, changed);
    } else { renderStocksTable([]); renderChangesList([]); }
    renderHorizonGrid(); populateEngineSelect();
  }

  function renderAuthBox() {
    const session = getStoredSession(), form = el('#login-form'), logout = el('#logout-btn');
    if (!form || !logout) return;
    form.hidden = Boolean(session?.user); logout.hidden = !session?.user;
  }
  el('#login-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { const session = await signIn({ email: el('#login-email').value, password: el('#login-password').value }); if (!session) return alert('登入失敗：請確認帳號或 Email 驗證狀態'); renderAuthBox(); await reloadData(); } catch (err) { alert(err.message); } });
  el('#signup-btn')?.addEventListener('click', async () => { try { await signUp({ email: el('#login-email').value, password: el('#login-password').value }); alert('註冊成功。若需要 Email 驗證，請先完成驗證。'); } catch (err) { alert(err.message); } });
  el('#logout-btn')?.addEventListener('click', async () => { await signOut(); renderAuthBox(); await reloadData(); });

  AHS.showPage = showPage; AHS.horizons = horizons;
  renderAuthBox();
  try { namesSnapshot = await loadCompanyNames(); } catch { namesSnapshot = null; }
  await reloadData();
})();
