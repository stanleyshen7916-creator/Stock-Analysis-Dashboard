import { signUp, signIn, signOut, getStoredSession } from './auth.js';
import { fetchTop50Snapshot, fetchTop50RowHistory, fetchMarketDaily, fetchFundamentals } from './data.js';
import { buildObservationList } from './observation-list.js';
import { OBSERVATION_LIST_HORIZONS } from './horizons.js';
import { loadCompanyNames, formatSymbolWithName, searchCompanyNames } from './company-name-lookup.js';
import { createPortfolio } from './portfolio.js';
import { runHistoricalDataStatus } from './historical-data-status.js';

const content = document.getElementById('page-content');
const portfolio = createPortfolio({ storage: window.localStorage });
let namesSnapshot = null;
let top50Cache = null;

function fmtNum(value, digits = 2) { return Number.isFinite(value) ? Number(value).toFixed(digits) : '—'; }
function fmtPct(value) { return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—'; }
function fmtDate(value) { return value || '—'; }
function symbolLabel(symbol, market) { return namesSnapshot ? formatSymbolWithName(namesSnapshot, symbol, market) : symbol; }
function decisionLabel(state) {
  return { INVESTABLE_CANDIDATE: '可投資候選', OBSERVATION: '觀察', NOT_QUALIFIED: '不符合條件', UNAVAILABLE: '資料不足' }[state] ?? state;
}
function changeLabel(type) {
  return { NEW: '新增', UPGRADED: '升級', DOWNGRADED: '降級', REMOVED: '移除', UNCHANGED: '維持', RISK_INCREASED: '風險上升', RISK_DECREASED: '風險下降', TARGET_REVISED: '目標價調整', DATA_INSUFFICIENT: '資料不足' }[type] ?? type;
}

// The 5-tier score label + thresholds are exactly as given in the
// GPT-confirmed UX prototype's own legend (≥90/80-89/70-79/60-69/<60) -
// a display-only bucketing of the already-real AI Score, never an
// invented new scoring formula.
function scoreTier(score) {
  if (!Number.isFinite(score)) return { label: '資料不足', cls: 'tier-watch' };
  if (score >= 90) return { label: '強烈觀察', cls: 'tier-strong' };
  if (score >= 80) return { label: '值得觀察', cls: 'tier-good' };
  if (score >= 70) return { label: '持續觀察', cls: 'tier-ongoing' };
  if (score >= 60) return { label: '觀察', cls: 'tier-watch' };
  return { label: '降低關注', cls: 'tier-low' };
}

function unavailable(note) {
  return `<div class="unavailable-note">資料尚未串接：${note}</div>`;
}

async function ensureTop50() {
  if (!top50Cache) top50Cache = await fetchTop50Snapshot();
  return top50Cache;
}

// --- Auth UI ---------------------------------------------------------

function renderAuthBox() {
  const session = getStoredSession();
  const statusEl = document.getElementById('auth-status');
  const formEl = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  if (session?.user) {
    statusEl.style.display = '';
    statusEl.textContent = `已登入：${session.user.email}`;
    formEl.hidden = true;
    logoutBtn.hidden = false;
  } else {
    statusEl.style.display = 'none';
    formEl.hidden = false;
    logoutBtn.hidden = true;
  }
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const session = await signIn({ email, password });
    if (!session) throw new Error('登入失敗：此帳號可能需要先完成 Email 驗證');
    renderAuthBox(); top50Cache = null; router();
  } catch (err) { alert(err.message); }
});
document.getElementById('signup-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  if (!email || !password) { alert('請先輸入 Email 與密碼再註冊'); return; }
  try {
    await signUp({ email, password });
    alert('註冊成功。若 Supabase 專案要求 Email 驗證，請至信箱完成驗證後再登入。');
  } catch (err) { alert(err.message); }
});
document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut(); renderAuthBox(); top50Cache = null; router();
});

// --- Search ------------------------------------------------------------

const searchInput = document.getElementById('global-search');
const searchResults = document.getElementById('search-results');
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (!namesSnapshot || !query) { searchResults.hidden = true; return; }
  const matches = searchCompanyNames(namesSnapshot, query, { limit: 10 });
  if (matches.length === 0) { searchResults.hidden = true; return; }
  searchResults.innerHTML = matches.map((m) => `<div data-symbol="${m.symbol}" data-market="${m.market}">${m.symbol} ${m.name}</div>`).join('');
  searchResults.hidden = false;
});
searchResults.addEventListener('click', (event) => {
  const target = event.target.closest('[data-symbol]');
  if (!target) return;
  searchResults.hidden = true; searchInput.value = '';
  window.location.hash = `#/stock/${target.dataset.market}/${target.dataset.symbol}`;
});
document.addEventListener('click', (event) => { if (!event.target.closest('.topbar')) searchResults.hidden = true; });

// --- Shared pieces -------------------------------------------------------

function goToStock(market, symbol) { window.location.hash = `#/stock/${market}/${symbol}`; }
window.goToStock = goToStock;

function updateSidebarCounts(horizons) {
  for (const h of OBSERVATION_LIST_HORIZONS) {
    const el = document.querySelector(`i[data-count="${h.key}"]`);
    if (el) el.textContent = horizons ? (horizons[h.key] || []).length : '–';
  }
}

// --- Page renderers ------------------------------------------------------

async function renderOverview() {
  content.innerHTML = '<div class="empty">載入中...</div>';
  let snapshot;
  try { snapshot = await ensureTop50(); } catch (err) { content.innerHTML = `<div class="notice error">Production Data 讀取失敗：${err.message}</div>`; updateSidebarCounts(null); return; }
  if (!snapshot.asOfDate) { content.innerHTML = '<div class="notice">market_top50 尚無真實資料，無法顯示觀察清單。</div>'; updateSidebarCounts(null); return; }

  const horizons = buildObservationList(snapshot);
  updateSidebarCounts(horizons);
  const allEntries = [...new Map(Object.values(horizons).flat().map((e) => [`${e.market}:${e.symbol}`, e])).values()];
  const strong = allEntries.filter((e) => e.aiScore >= 90).length;
  const good = allEntries.filter((e) => e.aiScore >= 80 && e.aiScore < 90).length;
  const ongoing = allEntries.filter((e) => e.aiScore >= 70 && e.aiScore < 80).length;
  const changed = allEntries.filter((e) => e.changeType !== 'UNCHANGED');
  const top10 = allEntries.filter((e) => Number.isFinite(e.aiScore)).sort((a, b) => b.aiScore - a.aiScore).slice(0, 10);
  const positions = portfolio.list();

  content.innerHTML = `
    <section class="kpis">
      <article><small>本週 AI 觀察總數</small><strong>${allEntries.length} <em>檔</em></strong></article>
      <article><small>強烈觀察（≥90）</small><strong class="red">${strong} <em>檔</em></strong></article>
      <article><small>值得觀察（80–89）</small><strong class="orange">${good} <em>檔</em></strong></article>
      <article><small>持續觀察（70–79）</small><strong class="green">${ongoing} <em>檔</em></strong></article>
      <article><small>今日推薦變化</small><strong>${changed.length} <em>檔</em></strong></article>
      <article><small>AI 推薦平均報酬</small>${unavailable('尚無週滾動統計')}</article>
      <article><small>模型勝率（90天）</small>${unavailable('尚無週滾動統計')}</article>
    </section>

    <section class="grid-main">
      <div class="left-col">
        <section class="card">
          <div class="title-row"><div><h2>AI 本週投資觀察總覽</h2><small>更新日期：${fmtDate(snapshot.asOfDate)}</small></div><button onclick="location.hash='#/observation'">查看完整清單 →</button></div>
          <div class="periods">
            ${OBSERVATION_LIST_HORIZONS.map((h, i) => {
              const list = horizons[h.key] || [];
              const highScore = list.filter((e) => e.aiScore >= 80).length;
              const avgReturn = list.filter((e) => Number.isFinite(e.expectedReturnPercent)).reduce((sum, e, _, arr) => sum + e.expectedReturnPercent / arr.length, 0);
              return `<a href="#/observation/${h.key}"><article class="p${i + 1}">
                <span>${h.label}　${h.periodLabel}</span>
                <strong>${list.length}</strong>
                <small>高評分 ${highScore}<br>${list.length > 0 ? `平均預估報酬 ${fmtPct(avgReturn)}` : '尚無資料'}</small>
              </article></a>`;
            }).join('')}
          </div>
        </section>

        <section class="card">
          <div class="title-row"><h2>AI 本週強力觀察 TOP 10</h2></div>
          <div class="table-wrap">
          ${top10.length === 0 ? '<div class="empty">尚無真實資料</div>' : `
          <table><thead><tr><th>#</th><th>代號</th><th>名稱</th><th>期間</th><th>AI 評分</th><th>現價</th><th>目標價</th><th>預估報酬</th><th>AI 觀察理由</th><th>狀態</th><th></th></tr></thead><tbody>
            ${top10.map((e, i) => {
              const tier = scoreTier(e.aiScore);
              const horizonLabel = OBSERVATION_LIST_HORIZONS.find((h) => (horizons[h.key] || []).some((x) => x.symbol === e.symbol && x.market === e.market))?.label ?? '—';
              return `<tr class="symbol-row" onclick="goToStock('${e.market}','${e.symbol}')">
                <td>${i + 1}</td><td>${e.symbol}</td><td>${namesSnapshot ? (namesSnapshot.byKey.get(e.symbol) ?? '—') : '—'}</td>
                <td>${horizonLabel}</td><td><strong class="score">${fmtNum(e.aiScore, 0)}</strong></td>
                <td>${fmtNum(e.currentPrice)}</td><td>${fmtNum(e.targetPrice)}</td><td class="green">${fmtPct(e.expectedReturnPercent)}</td>
                <td>${(e.aiReason || []).slice(0, 2).join('、') || '—'}</td><td><mark class="badge ${tier.cls}">${tier.label}</mark></td><td>↗</td>
              </tr>`;
            }).join('')}
          </tbody></table>
          <div class="legend">● 強烈觀察（≥90）　● 值得觀察（80–89）　● 持續觀察（70–79）　● 觀察（60–69）　● 降低關注（&lt;60）</div>`}
          </div>
        </section>

        <div class="bottom-grid">
          <section class="card"><h2>報告中心 <small>（本週重點）</small></h2>${unavailable('週績效統計（AI 選股績效／策略勝率／平均持有報酬）尚未建置')}</section>
          <section class="card"><h2>本週市場總覽數據</h2>${unavailable('加權指數／成交金額／三大法人等市場總經資料非本平台既有資料來源')}</section>
        </div>
      </div>

      <aside class="right-col">
        <section class="card sentiment"><h2>市場整體狀態</h2>${unavailable('市場情緒指數／產業輪動尚未建置真實計算來源')}</section>

        <section class="card changes">
          <h2>今日 AI 推薦變化</h2>
          <div class="change-tabs">全部（${changed.length}）　新增（${allEntries.filter((e) => e.changeType === 'NEW').length}）　升級（${changed.filter((e) => e.changeType === 'UPGRADED').length}）　降級（${changed.filter((e) => e.changeType === 'DOWNGRADED').length}）</div>
          ${changed.length === 0 ? '<div class="empty">今日無真實變化</div>' : `<ul>
            ${changed.slice(0, 12).map((e) => `<li onclick="goToStock('${e.market}','${e.symbol}')"><span>${symbolLabel(e.symbol, e.market)}　${Number.isFinite(e.originalScore) ? fmtNum(e.originalScore, 0) : '—'} → ${fmtNum(e.aiScore, 0)}</span><span class="badge ${e.changeType}">${changeLabel(e.changeType)}</span></li>`).join('')}
          </ul>`}
        </section>

        <section class="card"><h2>產業強弱輪動 <small>（近20日）</small></h2>${unavailable('產業分類與輪動計算尚未建置')}</section>
        <section class="card"><h2>近期重要事件</h2>${unavailable('事件行事曆尚未建置')}</section>

        <section class="card"><h2>我的持股摘要</h2>${positions.length === 0 ? '<div class="empty">尚未輸入持股，<a href="#/portfolio">前往新增</a></div>' : `<p>共 ${positions.length} 檔持股。<a href="#/portfolio">查看完整持股</a></p>`}</section>
      </aside>
    </section>`;
}

async function renderObservation(activeKey) {
  content.innerHTML = '<div class="empty">載入中...</div>';
  let snapshot;
  try { snapshot = await ensureTop50(); } catch (err) { content.innerHTML = `<div class="notice error">Production Data 讀取失敗：${err.message}</div>`; return; }
  const horizons = buildObservationList(snapshot);
  updateSidebarCounts(horizons);
  const key = activeKey && horizons[activeKey] ? activeKey : OBSERVATION_LIST_HORIZONS[0].key;

  const renderTable = (list) => list.length === 0 ? '<div class="empty">此週期目前無真實符合資料</div>' : `
    <table><thead><tr><th>排名</th><th>股票</th><th>AI 評分</th><th>狀態</th><th>現價</th><th>目標價</th><th>預估報酬</th><th>推薦</th><th>原因</th><th>變化</th><th>更新時間</th></tr></thead><tbody>
      ${list.map((e, i) => { const tier = scoreTier(e.aiScore); return `<tr class="symbol-row" onclick="goToStock('${e.market}','${e.symbol}')">
        <td>${i + 1}</td><td>${symbolLabel(e.symbol, e.market)}</td><td><strong class="score">${fmtNum(e.aiScore, 0)}</strong></td><td><mark class="badge ${tier.cls}">${tier.label}</mark></td>
        <td>${fmtNum(e.currentPrice)}</td><td>${fmtNum(e.targetPrice)}</td><td class="green">${fmtPct(e.expectedReturnPercent)}</td>
        <td>${decisionLabel(e.decisionState)}</td><td>${(e.aiReason || []).join('、') || '—'}</td>
        <td><span class="badge ${e.changeType}">${changeLabel(e.changeType)}</span></td><td>${e.updatedAt ? new Date(e.updatedAt).toLocaleString('zh-TW') : '—'}</td>
      </tr>`; }).join('')}
    </tbody></table>`;

  content.innerHTML = `
    <div class="card">
      <div class="title-row"><h2>AI 觀察清單</h2><small>更新日期：${fmtDate(snapshot.asOfDate)}</small></div>
      <div class="tabs">${OBSERVATION_LIST_HORIZONS.map((h) => `<button data-key="${h.key}" class="${h.key === key ? 'active' : ''}">${h.label}（${h.periodLabel}）</button>`).join('')}</div>
      <div class="table-wrap">${renderTable(horizons[key] || [])}</div>
    </div>`;

  content.querySelectorAll('.tabs button').forEach((btn) => btn.addEventListener('click', () => { window.location.hash = `#/observation/${btn.dataset.key}`; }));
}

async function renderPortfolio() {
  const positions = portfolio.list();
  let snapshot = null;
  try { snapshot = await ensureTop50(); } catch { /* rendered without live prices below */ }
  const byKey = new Map((snapshot?.current ?? []).map((r) => [`${r.market}:${r.symbol}`, r]));

  const rows = positions.map((p) => {
    const marketRow = p.market ? byKey.get(`${p.market}:${p.symbol}`) : [...byKey.values()].find((r) => r.symbol === p.symbol);
    const currentPrice = marketRow?.reference_price ?? null;
    const marketValue = Number.isFinite(currentPrice) ? currentPrice * p.shares : null;
    const costBasis = p.averageCost * p.shares;
    const pnl = Number.isFinite(marketValue) ? marketValue - costBasis : null;
    const returnPct = Number.isFinite(pnl) ? (pnl / costBasis) * 100 : null;
    return { p, marketRow, currentPrice, marketValue, pnl, returnPct };
  });

  content.innerHTML = `
    <div class="card">
      <h2>新增持股</h2>
      <form id="portfolio-form" class="inline">
        <div><label>股票代號</label><input name="symbol" required /></div>
        <div><label>股票名稱</label><input name="name" /></div>
        <div><label>持有股數</label><input name="shares" type="number" step="1" required /></div>
        <div><label>成本價格</label><input name="averageCost" type="number" step="0.01" required /></div>
        <div><label>購買日期</label><input name="purchaseDate" type="date" /></div>
        <div><label>備註</label><input name="note" /></div>
        <button type="submit" class="btn primary">新增</button>
      </form>
    </div>
    <div class="card" style="margin-top:10px;">
      <h2>我的持股（非交易系統，不含任何下單功能）</h2>
      <div class="table-wrap">
      ${rows.length === 0 ? '<div class="empty">尚未輸入任何持股</div>' : `
      <table><thead><tr><th>股票</th><th>股數</th><th>成本價</th><th>目前價格</th><th>市值</th><th>損益</th><th>報酬率</th><th>AI Score</th><th>目標價</th><th>建議</th><th></th></tr></thead><tbody>
        ${rows.map(({ p, marketRow, currentPrice, marketValue, pnl, returnPct }) => `
          <tr>
            <td>${p.name ? `${p.symbol} ${p.name}` : symbolLabel(p.symbol, p.market)}</td>
            <td>${p.shares}</td><td>${fmtNum(p.averageCost)}</td>
            <td>${Number.isFinite(currentPrice) ? fmtNum(currentPrice) : '無資料'}</td>
            <td>${Number.isFinite(marketValue) ? fmtNum(marketValue) : '—'}</td>
            <td class="${pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : ''}">${Number.isFinite(pnl) ? fmtNum(pnl) : '—'}</td>
            <td class="${returnPct > 0 ? 'pos' : returnPct < 0 ? 'neg' : ''}">${Number.isFinite(returnPct) ? fmtPct(returnPct) : '—'}</td>
            <td>${marketRow ? fmtNum(marketRow.recommendation_score, 0) : '無資料'}</td>
            <td>${marketRow ? fmtNum(marketRow.target_price) : '無資料'}</td>
            <td>${marketRow ? decisionLabel(marketRow.decision_state) : '無資料'}</td>
            <td><button class="btn" data-remove="${p.symbol}">移除</button></td>
          </tr>`).join('')}
      </tbody></table>`}
      </div>
    </div>`;

  document.getElementById('portfolio-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      portfolio.add({ symbol: form.get('symbol'), name: form.get('name') || null, shares: Number(form.get('shares')), averageCost: Number(form.get('averageCost')), purchaseDate: form.get('purchaseDate') || null, note: form.get('note') || null });
      renderPortfolio();
    } catch (err) { alert(err.message); }
  });
  content.querySelectorAll('[data-remove]').forEach((btn) => btn.addEventListener('click', () => { portfolio.remove(btn.dataset.remove); renderPortfolio(); }));
}

function isoDateDaysAgo(days) { return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); }

async function renderStock(market, symbol) {
  content.innerHTML = '<div class="empty">載入中...</div>';
  if (!symbol) { content.innerHTML = '<div class="notice">請由搜尋框或觀察清單選擇一檔股票。</div>'; return; }
  try {
    const [dailyRows, fundamentalRows, top50History] = await Promise.all([
      fetchMarketDaily(symbol, market, isoDateDaysAgo(60)),
      fetchFundamentals(symbol, market),
      fetchTop50RowHistory(symbol, market, 30)
    ]);
    const latest = dailyRows[dailyRows.length - 1] ?? null;
    const latestFundamental = fundamentalRows[0] ?? null;
    const per = latest && latestFundamental?.eps ? latest.close / latestFundamental.eps : null;
    const pbr = latest && latestFundamental?.book_value_per_share ? latest.close / latestFundamental.book_value_per_share : null;

    content.innerHTML = `
      <div class="card"><h2>${symbolLabel(symbol, market)}（${market}）</h2>
        ${latest ? `<div class="kpis"><article><small>最新收盤價</small><strong>${fmtNum(latest.close)}</strong></article><article><small>最新交易日</small><strong style="font-size:16px;">${latest.trading_date}</strong></article><article><small>資料來源</small><strong style="font-size:14px;">${latest.source ?? '—'}</strong></article></div>` : '<div class="notice">近期無真實市場資料</div>'}
      </div>
      <section class="grid-main" style="grid-template-columns:1fr 1fr; margin-top:10px;">
        <div class="card">
          <h2>基本面（最新一期：${latestFundamental?.reporting_period ?? '—'}）</h2>
          ${latestFundamental ? `<table><tbody>
            <tr><th>EPS</th><td>${fmtNum(latestFundamental.eps)}</td></tr>
            <tr><th>淨利</th><td>${fmtNum(latestFundamental.net_income, 0)}</td></tr>
            <tr><th>股東權益</th><td>${fmtNum(latestFundamental.equity, 0)}</td></tr>
            <tr><th>本益比 (P/E)</th><td>${Number.isFinite(per) ? fmtNum(per) : '資料不足'}</td></tr>
            <tr><th>股價淨值比 (P/B)</th><td>${Number.isFinite(pbr) ? fmtNum(pbr) : '資料不足'}</td></tr>
            <tr><th>資料來源</th><td>${latestFundamental.source}（${latestFundamental.source_timestamp ?? '—'}）</td></tr>
          </tbody></table>` : '<div class="empty">尚無真實基本面資料</div>'}
        </div>
        <div class="card">
          <h2>AI 推薦歷史</h2>
          ${top50History.length === 0 ? '<div class="empty">尚無真實推薦紀錄</div>' : `<div class="table-wrap"><table><thead><tr><th>日期</th><th>AI 評分</th><th>目標價</th><th>風險價</th><th>建議</th></tr></thead><tbody>
            ${top50History.map((r) => `<tr><td>${r.calculation_date}</td><td>${fmtNum(r.recommendation_score, 0)}</td><td>${fmtNum(r.target_price)}</td><td>${fmtNum(r.risk_price)}</td><td>${decisionLabel(r.decision_state)}</td></tr>`).join('')}
          </tbody></table></div>`}
        </div>
      </section>
      <div class="card" style="margin-top:10px;">
        <h2>近期股價（近 60 日內真實交易資料）</h2>
        ${dailyRows.length === 0 ? '<div class="empty">尚無真實股價資料</div>' : `<div class="table-wrap" style="max-height:300px; overflow-y:auto;">
        <table><thead><tr><th>日期</th><th>開盤</th><th>最高</th><th>最低</th><th>收盤</th><th>成交量</th></tr></thead><tbody>
          ${dailyRows.slice().reverse().map((r) => `<tr><td>${r.trading_date}</td><td>${fmtNum(r.open)}</td><td>${fmtNum(r.high)}</td><td>${fmtNum(r.low)}</td><td>${fmtNum(r.close)}</td><td>${r.volume}</td></tr>`).join('')}
        </tbody></table></div>`}
      </div>`;
  } catch (err) {
    content.innerHTML = `<div class="notice error">Production Data 讀取失敗：${err.message}</div>`;
  }
}

async function renderSelectionFlow() {
  content.innerHTML = '<div class="empty">載入中...</div>';
  let snapshot;
  try { snapshot = await ensureTop50(); } catch (err) { content.innerHTML = `<div class="notice error">${err.message}</div>`; return; }
  const rows = (snapshot.current ?? []).filter((r) => r.data_status === 'AVAILABLE' && r.score_breakdown);
  const investable = (snapshot.current ?? []).filter((r) => r.decision_state === 'INVESTABLE_CANDIDATE').length;
  const avgScore = rows.length > 0 ? rows.reduce((sum, r) => sum + (r.recommendation_score ?? 0), 0) / rows.length : null;

  content.innerHTML = `
    <div class="card">
      <div class="title-row"><div><h2>AI 選股流程總覽</h2><small>本次 AI 選股執行結果與各分析工具得分、權重及加權結果</small></div><small>更新日期：${fmtDate(snapshot.asOfDate)}</small></div>
      <div class="kpis">
        <article><small>執行批次</small><strong style="font-size:16px;">${snapshot.asOfDate ?? '—'}</strong></article>
        <article><small>掃描股票</small><strong>${snapshot.current.length} <em>檔</em></strong></article>
        <article><small>進入觀察清單</small><strong>${rows.length} <em>檔</em></strong></article>
        <article><small>可投資候選</small><strong>${investable} <em>檔</em></strong></article>
        <article><small>平均 AI Score</small><strong class="green">${Number.isFinite(avgScore) ? fmtNum(avgScore, 1) : '—'}</strong></article>
      </div>
    </div>

    <div class="card" style="margin-top:10px;">
      <h2>AI 選股流程</h2>
      <div class="pipeline">
        ${[['資料收集', '行情／財務／籌碼'], ['各工具分析', '技術／基本面'], ['得分計算', '原始分＋權重'], ['AI 綜合評估', 'Score／風險／目標價'], ['觀察清單產出', '六種投資期間'], ['每日追蹤', '推薦變化／回饋']]
          .map(([title, sub], i) => `<div class="step"><div class="num">${i + 1}</div><div><strong>${title}</strong><small>${sub}</small></div></div>`).join('')}
      </div>
    </div>

    <section class="grid-main" style="margin-top:10px;">
      <div class="card">
        <h2>選擇一檔股票檢視真實計分細節</h2>
        <select id="selection-symbol">
          <option value="">請選擇</option>
          ${rows.map((r) => `<option value="${r.market}:${r.symbol}">${symbolLabel(r.symbol, r.market)}</option>`).join('')}
        </select>
        <div id="selection-detail" style="margin-top:16px;"></div>
      </div>
      <div class="card">
        <h2>工具權重設定</h2>
        <p style="font-size:12px; color:#667085;">目前僅 Fundamental／Technical 為 Production 真實計算維度；規格示意的 Wave／籌碼／產業與趨勢／AI 風險評估等其餘工具尚無驗證資料來源，誠實標示為未啟用（權重 0%），非虛構分數。</p>
        <div id="weight-bars"></div>
      </div>
    </section>`;

  const select = document.getElementById('selection-symbol');
  select.addEventListener('change', (event) => {
    const [market, symbol] = event.target.value.split(':');
    const row = rows.find((r) => r.market === market && r.symbol === symbol);
    renderSelectionDetail(row);
  });
  if (rows.length > 0) { select.value = `${rows[0].market}:${rows[0].symbol}`; renderSelectionDetail(rows[0]); }
}

function renderSelectionDetail(row) {
  const detailEl = document.getElementById('selection-detail');
  const barsEl = document.getElementById('weight-bars');
  if (!row?.score_breakdown) { detailEl.innerHTML = '<div class="empty">尚無真實計分細節</div>'; barsEl.innerHTML = ''; return; }
  const b = row.score_breakdown;
  const tools = [
    { name: 'Fundamental（基本面分析）', score: b.fundamental.score, weight: b.fundamental.weight, weighted: b.fundamental.weighted_score, color: '#10a37f' },
    { name: 'Technical（技術分析）', score: b.technical.score, weight: b.technical.weight, weighted: b.technical.weighted_score, color: '#1264d6' },
    { name: 'Chip（籌碼分析）', score: null, weight: b.chip.weight, weighted: 0, color: '#9aa1ae', unavailable: true }
  ];
  detailEl.innerHTML = `
    <table><thead><tr><th>分析工具</th><th>原始得分</th><th>權重</th><th>加權得分</th></tr></thead><tbody>
      ${tools.map((t) => `<tr><td>${t.name}</td><td>${t.unavailable ? '不可用' : fmtNum(t.score, 0)}</td><td>${fmtPct(t.weight * 100)}</td><td>${t.unavailable ? '0' : fmtNum(t.weighted)}</td></tr>`).join('')}
    </tbody></table>
    <p><strong>AI Score（Composite Score）：${fmtNum(b.composite_score, 2)} / 100</strong></p>
    <p>推薦：${decisionLabel(row.decision_state)}</p>
    <p>推薦原因（真實觸發訊號）：${(row.recommendation_reason || []).join('、') || '無'}</p>`;
  barsEl.innerHTML = tools.map((t) => `
    <div class="weight-bar">
      <div class="row"><span>${t.name}</span><span>${fmtPct(t.weight * 100)}</span></div>
      <div class="track"><div class="fill" style="width:${Math.max(t.weight * 100, 2)}%; background:${t.color};"></div></div>
    </div>`).join('');
}

async function renderHistorical() {
  content.innerHTML = '<div class="empty">載入中...</div>';
  try {
    const status = await runHistoricalDataStatus({ url: window.APP_CONFIG.SUPABASE_URL, apiKey: window.APP_CONFIG.SUPABASE_ANON_KEY });
    const marketCard = (m, label) => `
      <div class="card"><h2>${label}</h2>
        <table><tbody>
          <tr><th>最早日期</th><td>${fmtDate(m.earliestDate)}</td></tr>
          <tr><th>最新日期</th><td>${fmtDate(m.latestDate)}</td></tr>
          <tr><th>總資料筆數</th><td>${m.totalRows ?? '—'}</td></tr>
          <tr><th>最新日期股票數</th><td>${m.symbolCountOnLatestDate}</td></tr>
          <tr><th>5 年涵蓋</th><td>${m.coverage5YPercent === 100 ? '已達標' : '尚未達標（誠實顯示，非隱藏不足）'}</td></tr>
          <tr><th>10 年涵蓋</th><td>${m.coverage10YPercent === 100 ? '已達標' : '尚未達標'}</td></tr>
          <tr><th>資料品質（最新日期抽查）</th><td>${m.dataQuality}</td></tr>
        </tbody></table>
      </div>`;
    content.innerHTML = `<section class="grid-main" style="grid-template-columns:1fr 1fr;">${marketCard(status.twse, 'TWSE')}${marketCard(status.tpex, 'TPEx')}</section>`;
  } catch (err) {
    content.innerHTML = `<div class="notice error">${err.message}</div>`;
  }
}

function renderPlaceholder(title) {
  content.innerHTML = `<div class="card"><h2>${title}</h2><div class="empty">此頁尚未建置，誠實標示中，非隱藏功能缺失。M15-M23 Dashboard spec v1 未要求本頁在此階段完成真實資料串接。</div></div>`;
}

// --- Router ---------------------------------------------------------

function setActiveNav(route, horizon) {
  document.querySelectorAll('#side-nav a').forEach((a) => {
    const isSub = a.classList.contains('sub');
    a.classList.toggle('active', isSub ? (a.dataset.route === route && a.dataset.horizon === horizon) : (a.dataset.route === route && !isSub));
  });
}

async function router() {
  const hash = window.location.hash.replace(/^#\//, '');
  const [route, ...rest] = hash.split('/');
  setActiveNav(route || 'overview', rest[0]);
  switch (route) {
    case '': case 'overview': return renderOverview();
    case 'observation': return renderObservation(rest[0]);
    case 'portfolio': return renderPortfolio();
    case 'stock': return renderStock(rest[0], rest[1]);
    case 'selection-flow': return renderSelectionFlow();
    case 'historical': return renderHistorical();
    case 'compare': return renderPlaceholder('股票比較');
    case 'strategy': return renderPlaceholder('策略／參數');
    case 'market': return renderPlaceholder('市場分析');
    case 'industry': return renderPlaceholder('產業分析');
    case 'backtest': return renderPlaceholder('回測驗證');
    case 'reports': return renderPlaceholder('報告中心');
    case 'settings': return renderPlaceholder('系統設定');
    default: return renderOverview();
  }
}

window.addEventListener('hashchange', router);

(async function init() {
  renderAuthBox();
  try { namesSnapshot = await loadCompanyNames(); } catch { /* search degrades gracefully */ }
  router();
})();
