import { signUp, signIn, signOut, getStoredSession } from './auth.js';
import { fetchTop50Snapshot, fetchTop50RowHistory, fetchMarketDaily, fetchFundamentals } from './data.js';
import { buildObservationList } from './observation-list.js';
import { OBSERVATION_LIST_HORIZONS } from './horizons.js';
import { loadCompanyNames, formatSymbolWithName, searchCompanyNames, lookupCompanyName } from './company-name-lookup.js';
import { createPortfolio } from './portfolio.js';
import { runHistoricalDataStatus } from './historical-data-status.js';

const content = document.getElementById('page-content');
const portfolio = createPortfolio({ storage: window.localStorage });
let namesSnapshot = null;
let top50Cache = null; // { asOfDate, previousDate, current, previous }

function fmtNum(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}
function fmtPct(value) {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—';
}
function fmtDate(value) {
  return value ? value : '—';
}
function symbolLabel(symbol, market) {
  return namesSnapshot ? formatSymbolWithName(namesSnapshot, symbol, market) : symbol;
}
function decisionLabel(state) {
  return { INVESTABLE_CANDIDATE: '可投資候選', OBSERVATION: '觀察', NOT_QUALIFIED: '不符合條件', UNAVAILABLE: '資料不足' }[state] ?? state;
}
function changeLabel(type) {
  return { NEW: '新增', UPGRADED: '升級', DOWNGRADED: '降級', REMOVED: '移除', UNCHANGED: '維持', RISK_INCREASED: '風險上升', RISK_DECREASED: '風險下降', TARGET_REVISED: '目標價調整', DATA_INSUFFICIENT: '資料不足' }[type] ?? type;
}

function stockLink(symbol, market) {
  return `<a href="#/stock/${market}/${symbol}">${symbolLabel(symbol, market)}</a>`;
}

async function ensureTop50() {
  if (!top50Cache) top50Cache = await fetchTop50Snapshot();
  return top50Cache;
}

// --- Auth UI --------------------------------------------------------------

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
    renderAuthBox();
    top50Cache = null;
    router();
  } catch (err) {
    alert(err.message);
  }
});
document.getElementById('signup-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  if (!email || !password) { alert('請先輸入 Email 與密碼再註冊'); return; }
  try {
    await signUp({ email, password });
    alert('註冊成功。若 Supabase 專案要求 Email 驗證，請至信箱完成驗證後再登入。');
  } catch (err) {
    alert(err.message);
  }
});
document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  renderAuthBox();
  top50Cache = null;
  router();
});

// --- Search -----------------------------------------------------------

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
  searchResults.hidden = true;
  searchInput.value = '';
  window.location.hash = `#/stock/${target.dataset.market}/${target.dataset.symbol}`;
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('#top-bar')) searchResults.hidden = true;
});

// --- Page renderers ---------------------------------------------------

function statCard(label, value) {
  return `<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

async function renderOverview() {
  content.innerHTML = '<div class="empty">載入中...</div>';
  let snapshot;
  try {
    snapshot = await ensureTop50();
  } catch (err) {
    content.innerHTML = `<div class="notice error">Production Data 讀取失敗：${err.message}</div>`;
    return;
  }
  if (!snapshot.asOfDate) {
    content.innerHTML = '<div class="notice">market_top50 尚無真實資料，無法顯示觀察清單。</div>';
    return;
  }
  const horizons = buildObservationList(snapshot);
  const allEntries = [...new Map(Object.values(horizons).flat().map((e) => [`${e.market}:${e.symbol}`, e])).values()];
  const investable = snapshot.current.filter((r) => r.decision_state === 'INVESTABLE_CANDIDATE').length;
  const observation = snapshot.current.filter((r) => r.decision_state === 'OBSERVATION').length;
  const notQualified = snapshot.current.filter((r) => r.decision_state === 'NOT_QUALIFIED').length;
  const unavailable = snapshot.current.filter((r) => r.decision_state === 'UNAVAILABLE').length;
  const changed = allEntries.filter((e) => !['UNCHANGED', 'NEW'].includes(e.changeType));
  const top10 = allEntries.filter((e) => Number.isFinite(e.aiScore)).sort((a, b) => b.aiScore - a.aiScore).slice(0, 10);
  const positions = portfolio.list();

  content.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr;">
      <div class="card">
        <h2>AI 本週投資觀察總覽（更新日期：${fmtDate(snapshot.asOfDate)}）</h2>
        <div class="stat-row">
          ${statCard('納入觀察清單', allEntries.length)}
          ${statCard('可投資候選', investable)}
          ${statCard('觀察中', observation)}
          ${statCard('不符合條件', notQualified)}
          ${statCard('資料不足', unavailable)}
        </div>
      </div>

      <div class="card">
        <h2>六大投資週期</h2>
        <div class="grid grid-6">
          ${OBSERVATION_LIST_HORIZONS.map((h) => `
            <a href="#/observation/${h.key}" style="text-decoration:none; color:inherit;">
              <div class="card" style="text-align:center;">
                <div style="font-size:12px;color:var(--text-muted);">${h.periodLabel}</div>
                <div style="font-size:20px;font-weight:700;">${(horizons[h.key] || []).length}</div>
                <div>${h.label}</div>
              </div>
            </a>`).join('')}
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <h2>AI 強力觀察 TOP 10</h2>
          ${top10.length === 0 ? '<div class="empty">尚無真實資料</div>' : `<table><thead><tr><th>股票</th><th>AI Score</th><th>目前價格</th><th>目標價</th><th>預期報酬</th><th>建議</th></tr></thead><tbody>
            ${top10.map((e) => `<tr class="symbol-row" onclick="location.hash='#/stock/${e.market}/${e.symbol}'"><td>${symbolLabel(e.symbol, e.market)}</td><td>${fmtNum(e.aiScore, 1)}</td><td>${fmtNum(e.currentPrice)}</td><td>${fmtNum(e.targetPrice)}</td><td>${fmtPct(e.expectedReturnPercent)}</td><td>${decisionLabel(e.decisionState)}</td></tr>`).join('')}
          </tbody></table>`}
        </div>

        <div class="card">
          <h2>今日 AI 推薦變化</h2>
          ${changed.length === 0 ? '<div class="empty">今日無真實變化</div>' : `<table><thead><tr><th>股票</th><th>變化</th><th>分數變化</th><th>目標價變化</th></tr></thead><tbody>
            ${changed.slice(0, 15).map((e) => `<tr class="symbol-row" onclick="location.hash='#/stock/${e.market}/${e.symbol}'"><td>${symbolLabel(e.symbol, e.market)}</td><td><span class="badge ${e.changeType}">${changeLabel(e.changeType)}</span></td><td>${Number.isFinite(e.scoreChange) ? fmtNum(e.scoreChange, 1) : '—'}</td><td>${Number.isFinite(e.targetChange) ? fmtNum(e.targetChange) : '—'}</td></tr>`).join('')}
          </tbody></table>`}
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <h2>市場整體環境</h2>
          <p>依真實 market_top50 決策狀態分布（非市場指數，僅為本平台觀察清單的真實統計）：可投資候選 ${investable} 檔、觀察中 ${observation} 檔、不符合條件 ${notQualified} 檔、資料不足 ${unavailable} 檔。</p>
        </div>
        <div class="card">
          <h2>我的持股摘要</h2>
          ${positions.length === 0 ? '<div class="empty">尚未輸入持股，<a href="#/portfolio">前往新增</a></div>' : `<p>共 ${positions.length} 檔持股。<a href="#/portfolio">查看完整持股</a></p>`}
        </div>
      </div>

      <div class="card">
        <h2>報告／摘要</h2>
        <p>${fmtDate(snapshot.asOfDate)} 觀察清單共 ${allEntries.length} 檔，其中 ${changed.filter((e) => e.changeType === 'UPGRADED').length} 檔升級、${changed.filter((e) => e.changeType === 'DOWNGRADED').length} 檔降級、${allEntries.filter((e) => e.changeType === 'NEW').length} 檔新增。所有分數／目標價均為既有規則式引擎計算結果，非 AI 生成文字。</p>
      </div>
    </div>`;
}

async function renderObservation(activeKey) {
  content.innerHTML = '<div class="empty">載入中...</div>';
  let snapshot;
  try {
    snapshot = await ensureTop50();
  } catch (err) {
    content.innerHTML = `<div class="notice error">Production Data 讀取失敗：${err.message}</div>`;
    return;
  }
  const horizons = buildObservationList(snapshot);
  const key = activeKey && horizons[activeKey] ? activeKey : OBSERVATION_LIST_HORIZONS[0].key;

  const renderTable = (list) => list.length === 0 ? '<div class="empty">此週期目前無真實符合資料</div>' : `
    <table><thead><tr><th>排名</th><th>股票</th><th>AI Score</th><th>目前價格</th><th>目標價</th><th>預期報酬</th><th>推薦</th><th>原因</th><th>變化</th><th>更新時間</th></tr></thead><tbody>
      ${list.map((e, i) => `<tr class="symbol-row" onclick="location.hash='#/stock/${e.market}/${e.symbol}'">
        <td>${i + 1}</td><td>${symbolLabel(e.symbol, e.market)}</td><td>${fmtNum(e.aiScore, 1)}</td>
        <td>${fmtNum(e.currentPrice)}</td><td>${fmtNum(e.targetPrice)}</td><td>${fmtPct(e.expectedReturnPercent)}</td>
        <td>${decisionLabel(e.decisionState)}</td><td>${(e.aiReason || []).join('、') || '—'}</td>
        <td><span class="badge ${e.changeType}">${changeLabel(e.changeType)}</span></td><td>${e.updatedAt ? new Date(e.updatedAt).toLocaleString('zh-TW') : '—'}</td>
      </tr>`).join('')}
    </tbody></table>`;

  content.innerHTML = `
    <div class="card">
      <h2>AI 觀察清單（更新日期：${fmtDate(snapshot.asOfDate)}）</h2>
      <div class="tabs">
        ${OBSERVATION_LIST_HORIZONS.map((h) => `<button data-key="${h.key}" class="${h.key === key ? 'active' : ''}">${h.label}（${h.periodLabel}）</button>`).join('')}
      </div>
      <div id="observation-table">${renderTable(horizons[key] || [])}</div>
    </div>`;

  content.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => { window.location.hash = `#/observation/${btn.dataset.key}`; });
  });
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
    <div class="grid" style="grid-template-columns: 1fr;">
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
      <div class="card">
        <h2>我的持股（非交易系統，不含任何下單功能）</h2>
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
              <td>${marketRow ? fmtNum(marketRow.recommendation_score, 1) : '無資料'}</td>
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
      portfolio.add({
        symbol: form.get('symbol'), name: form.get('name') || null, shares: Number(form.get('shares')),
        averageCost: Number(form.get('averageCost')), purchaseDate: form.get('purchaseDate') || null, note: form.get('note') || null
      });
      renderPortfolio();
    } catch (err) {
      alert(err.message);
    }
  });
  content.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => { portfolio.remove(btn.dataset.remove); renderPortfolio(); });
  });
}

async function renderStock(market, symbol) {
  content.innerHTML = '<div class="empty">載入中...</div>';
  if (!symbol) {
    content.innerHTML = '<div class="notice">請由搜尋框或觀察清單選擇一檔股票。</div>';
    return;
  }
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
      <div class="grid" style="grid-template-columns: 1fr;">
        <div class="card">
          <h2>${symbolLabel(symbol, market)}（${market}）</h2>
          ${latest ? `<div class="stat-row">
            ${statCard('最新收盤價', fmtNum(latest.close))}
            ${statCard('最新交易日', latest.trading_date)}
            ${statCard('資料來源', latest.source ?? '—')}
          </div>` : '<div class="notice">近期無真實市場資料</div>'}
        </div>

        <div class="grid grid-2">
          <div class="card">
            <h3>基本面（最新一期：${latestFundamental?.reporting_period ?? '—'}）</h3>
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
            <h3>AI 推薦歷史</h3>
            ${top50History.length === 0 ? '<div class="empty">尚無真實推薦紀錄</div>' : `
            <table><thead><tr><th>日期</th><th>AI Score</th><th>目標價</th><th>風險價</th><th>建議</th></tr></thead><tbody>
              ${top50History.map((r) => `<tr><td>${r.calculation_date}</td><td>${fmtNum(r.recommendation_score, 1)}</td><td>${fmtNum(r.target_price)}</td><td>${fmtNum(r.risk_price)}</td><td>${decisionLabel(r.decision_state)}</td></tr>`).join('')}
            </tbody></table>`}
          </div>
        </div>

        <div class="card">
          <h3>近期股價（近 60 日內真實交易資料）</h3>
          ${dailyRows.length === 0 ? '<div class="empty">尚無真實股價資料</div>' : `
          <div style="max-height:300px; overflow-y:auto;">
          <table><thead><tr><th>日期</th><th>開盤</th><th>最高</th><th>最低</th><th>收盤</th><th>成交量</th></tr></thead><tbody>
            ${dailyRows.slice().reverse().map((r) => `<tr><td>${r.trading_date}</td><td>${fmtNum(r.open)}</td><td>${fmtNum(r.high)}</td><td>${fmtNum(r.low)}</td><td>${fmtNum(r.close)}</td><td>${r.volume}</td></tr>`).join('')}
          </tbody></table></div>`}
        </div>
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

  const renderRow = (row) => {
    const b = row.score_breakdown;
    if (!b) return '<div class="notice">此股票尚無真實計分細節（migration 013 套用前無此欄位）。</div>';
    return `
      <table><thead><tr><th>分析工具</th><th>原始分數</th><th>權重</th><th>加權分數</th></tr></thead><tbody>
        <tr><td>Fundamental</td><td>${fmtNum(b.fundamental.score)}</td><td>${fmtPct(b.fundamental.weight * 100)}</td><td>${fmtNum(b.fundamental.weighted_score)}</td></tr>
        <tr><td>Technical</td><td>${fmtNum(b.technical.score)}</td><td>${fmtPct(b.technical.weight * 100)}</td><td>${fmtNum(b.technical.weighted_score)}</td></tr>
        <tr><td>Chip（籌碼面）</td><td colspan="3">目前無驗證資料來源，誠實標示為不可用（權重 ${fmtPct(b.chip.weight * 100)}，實際貢獻 0）</td></tr>
      </tbody></table>
      <p><strong>AI Selection Score（Composite Score）：${fmtNum(b.composite_score)}</strong></p>
      <p>推薦：${decisionLabel(row.decision_state)}</p>
      <p>推薦原因（真實觸發訊號）：${(row.recommendation_reason || []).join('、') || '無'}</p>
      <p style="color:var(--text-muted); font-size:12px;">說明：本平台目前僅有 Fundamental／Technical 兩個真實計算維度（Chip 尚無可驗證資料來源）。規格文件列示的 Wave/Momentum/Trend/Volume/Valuation/Risk/Market Environment 等，目前以 Technical 內部真實觸發訊號（SMA/EMA/RSI/MACD/Bollinger/Donchian/ATR/成交量狀態）呈現，未拆分為個別分數 - 拆分需要引擎變更，非本次資料接線範圍。</p>`;
  };

  content.innerHTML = `
    <div class="card">
      <h2>AI 選股流程</h2>
      <p>選擇一檔股票，檢視其 AI Selection Score 的真實可追溯計算過程。</p>
      <select id="selection-symbol">
        <option value="">請選擇</option>
        ${rows.map((r) => `<option value="${r.market}:${r.symbol}">${symbolLabel(r.symbol, r.market)}</option>`).join('')}
      </select>
      <div id="selection-detail" style="margin-top:16px;"></div>
    </div>`;

  document.getElementById('selection-symbol').addEventListener('change', (event) => {
    const [market, symbol] = event.target.value.split(':');
    const row = rows.find((r) => r.market === market && r.symbol === symbol);
    document.getElementById('selection-detail').innerHTML = row ? renderRow(row) : '';
  });
}

async function renderHistorical() {
  content.innerHTML = '<div class="empty">載入中...</div>';
  try {
    const status = await runHistoricalDataStatus({ url: window.APP_CONFIG.SUPABASE_URL, apiKey: window.APP_CONFIG.SUPABASE_ANON_KEY });
    const marketCard = (m, label) => `
      <div class="card">
        <h3>${label}</h3>
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
    content.innerHTML = `<div class="grid grid-2">${marketCard(status.twse, 'TWSE')}${marketCard(status.tpex, 'TPEx')}</div>`;
  } catch (err) {
    content.innerHTML = `<div class="notice error">${err.message}</div>`;
  }
}

function renderPlaceholder(title) {
  content.innerHTML = `<div class="card"><h2>${title}</h2><div class="empty">此頁尚未建置，誠實標示中，非隱藏功能缺失。M11-M23 Dashboard spec v1 未要求本頁在此階段完成。</div></div>`;
}

function isoDateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// --- Router -------------------------------------------------------------

function setActiveNav(route) {
  document.querySelectorAll('#side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
}

async function router() {
  const hash = window.location.hash.replace(/^#\//, '');
  const [route, ...rest] = hash.split('/');
  setActiveNav(route || 'overview');
  switch (route) {
    case '': case 'overview': return renderOverview();
    case 'observation': return renderObservation(rest[0]);
    case 'portfolio': return renderPortfolio();
    case 'stock': return renderStock(rest[0], rest[1]);
    case 'selection-flow': return renderSelectionFlow();
    case 'historical': return renderHistorical();
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
  try {
    namesSnapshot = await loadCompanyNames();
  } catch {
    // Search degrades to symbol-only matching failure is acceptable - never blocks the app.
  }
  router();
})();
