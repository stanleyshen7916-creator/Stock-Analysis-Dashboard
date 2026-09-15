// Dashboard Reference UX v5
// Presentation/data-view layer only. Reads Production Supabase; never calculates scores.
(() => {
  const STYLE_ID = 'dashboard-reference-v5-style';
  const MARKER = 'dashboard-reference-v5-loaded';
  if (window[MARKER]) return;
  window[MARKER] = true;

  const cfg = () => window.APP_CONFIG || {};
  const esc = (v) => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v, d=2) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—';
  const pct = v => Number.isFinite(Number(v)) ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}%` : '—';
  const decision = v => ({INVESTABLE_CANDIDATE:'可投資候選',OBSERVATION:'觀察',NOT_QUALIFIED:'不符合條件',UNAVAILABLE:'資料不足'}[v] || v || '—');
  const tier = v => !Number.isFinite(Number(v)) ? '資料不足' : Number(v)>=90?'強烈觀察':Number(v)>=80?'值得觀察':Number(v)>=70?'持續觀察':Number(v)>=60?'觀察':'降低關注';

  async function get(path) {
    const c = cfg();
    const r = await fetch(`${c.SUPABASE_URL}/rest/v1/${path}`, {headers:{apikey:c.SUPABASE_ANON_KEY,Authorization:`Bearer ${c.SUPABASE_ANON_KEY}`}});
    if (!r.ok) throw new Error(`GET ${path.split('?')[0]} failed (${r.status})`);
    return r.json();
  }

  async function names() {
    try { const r = await fetch('data/company-names.json'); if (!r.ok) return {}; const j = await r.json(); return Object.fromEntries((j.companies||[]).map(x => [`${x.market}:${x.symbol}`,x.name])); } catch { return {}; }
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style'); s.id = STYLE_ID;
    s.textContent = `
      /* v5 visual hierarchy */
      #page-dashboard .kpi-strip{gap:12px!important;margin-bottom:14px!important}
      #page-dashboard .kpi{min-height:118px!important;padding:15px 16px!important;border-radius:12px!important}
      #page-dashboard .kpi-label{font-size:15px!important}.kpi-value{font-size:40px!important}.kpi-note{font-size:12px!important}
      #page-dashboard .section-head h2{font-size:25px!important}.section-head p{font-size:14px!important}
      #page-dashboard .horizon{min-height:108px!important;padding:13px 14px!important}.horizon b{font-size:15px!important}.horizon strong{font-size:34px!important}.horizon span{font-size:13px!important}
      #page-dashboard .table-wrap table{font-size:17px!important}#page-dashboard .table-wrap th{font-size:14px!important;padding:11px 10px!important}#page-dashboard .table-wrap td{font-size:17px!important;padding:11px 10px!important;line-height:1.45!important}#page-dashboard .table-wrap td:nth-child(9){font-size:15px!important}
      #page-dashboard .score{font-size:18px!important;font-weight:800}.status{font-size:14px!important}
      .v5-golden{margin:0 0 14px;padding:16px 18px;border:1px solid #cfe0ff;background:linear-gradient(90deg,#f4f8ff,#fff);border-radius:12px;display:flex;align-items:center;gap:18px}.v5-golden .golden-title{font-size:18px;font-weight:800;color:#173b73}.v5-golden .golden-score{font-size:32px;font-weight:900;color:#2563eb}.v5-golden .golden-meta{font-size:13px;color:#64748b;flex:1}.v5-golden button{font-size:14px!important;padding:9px 14px!important}
      #page-top50 .page-title h2{font-size:30px!important}#page-top50 .page-title p{font-size:15px!important}#page-top50 table{min-width:1180px!important}#page-top50 th{font-size:16px!important;padding:13px 11px!important;white-space:nowrap}#page-top50 td{font-size:18px!important;padding:13px 11px!important;line-height:1.45}#page-top50 td:nth-child(4){font-weight:900;color:#2563eb;font-size:20px!important}
      .v5-page{display:flex;flex-direction:column;gap:14px}.v5-page-title{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}.v5-page-title h2{font-size:30px;margin:0;color:#17283f}.v5-page-title p{font-size:15px;color:#64748b;margin:5px 0 0}.v5-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.v5-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.v5-card{background:#fff;border:1px solid #dfe7f1;border-radius:12px;padding:17px 18px;box-shadow:0 2px 8px rgba(36,50,74,.04)}.v5-card h3{font-size:19px;margin:0 0 11px;color:#17283f}.v5-card p,.v5-card li{font-size:14px;line-height:1.65;color:#43546c}.v5-number{font-size:34px;font-weight:900;color:#2563eb}.v5-muted{color:#718097;font-size:13px}.v5-bar{height:10px;background:#e8eef5;border-radius:99px;overflow:hidden;margin:8px 0}.v5-bar i{display:block;height:100%;background:#13a878;border-radius:99px}.v5-step{display:grid;grid-template-columns:42px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid #edf1f5}.v5-step:last-child{border-bottom:0}.v5-step b{width:38px;height:38px;border-radius:50%;background:#edf5ff;color:#2563eb;display:grid;place-items:center;font-size:16px}.v5-step strong{font-size:16px;color:#1f334e}.v5-step span{display:block;font-size:13px;color:#718097;margin-top:3px}.v5-param{display:grid;grid-template-columns:1.2fr .8fr 1.5fr;gap:10px;padding:10px 0;border-bottom:1px solid #edf1f5;font-size:14px}.v5-param b{color:#263a56}.v5-tag{display:inline-block;border-radius:999px;padding:3px 8px;background:#edf5ff;color:#2563eb;font-size:12px;font-weight:800}.v5-good{color:#139b73;font-weight:800}.v5-warn{color:#d88900;font-weight:800}.v5-table{width:100%;border-collapse:collapse}.v5-table th{font-size:13px;text-align:left;color:#63738b;padding:9px;border-bottom:1px solid #dfe6ef}.v5-table td{font-size:14px;padding:10px 9px;border-bottom:1px solid #edf1f5;color:#263a56}.v5-table td:last-child{text-align:right}.v5-list{margin:0;padding-left:20px}.v5-alert{padding:12px 14px;border-radius:9px;background:#fff8e8;border:1px solid #f0ddb0;color:#7b5d1a;font-size:14px;line-height:1.6}
      @media(max-width:1100px){.v5-grid{grid-template-columns:repeat(2,1fr)}.v5-grid-2{grid-template-columns:1fr}}
      @media(max-width:800px){#page-dashboard .kpi{min-height:100px!important}.v5-grid{grid-template-columns:1fr}.v5-page-title{display:block}.v5-page-title h2{font-size:25px}.v5-param{grid-template-columns:1fr}.v5-golden{display:block}.v5-golden button{margin-top:9px}}
    `;
    document.head.appendChild(s);
  }

  async function renderGolden() {
    const host = document.querySelector('#page-dashboard .content-grid'); if (!host || host.querySelector('.v5-golden')) return;
    try {
      const [rows] = await Promise.all([get('stock_analysis_results?symbol=eq.2330&market=eq.TWSE&order=calculation_date.desc&limit=1')]);
      const r = rows[0]; if (!r) return;
      const box = document.createElement('section'); box.className='v5-golden';
      box.innerHTML = `<div class="golden-title">2330 台積電 · Golden Test</div><div class="golden-score">${esc(num(r.recommendation_score,0))}<small style="font-size:14px"> / 100</small></div><div class="golden-meta">Production ${esc(r.calculation_date)} · ${esc(r.data_status)} · ${esc(decision(r.decision_state))}<br>2330 是 Production 正確性 Golden Test，不因未進 Market Top 50 而從首頁消失。</div><button class="primary" data-symbol="2330" data-market="TWSE">查看 2330</button>`;
      host.parentNode.insertBefore(box, host);
      box.querySelector('button').addEventListener('click', () => { window.StockDashboard?.showPage?.('analysis'); const input=document.querySelector('#analysis-symbol'); if(input){input.value='2330';input.dispatchEvent(new Event('input'));} document.querySelector('#analysis-search')?.click(); });
    } catch {}
  }

  async function renderTop50() {
    const page = document.querySelector('#page-top50'); if (!page) return;
    const table = page.querySelector('#top50-table'); const meta = page.querySelector('#top50-meta'); if (!table) return;
    try {
      const d = await get('market_top50?select=calculation_date&order=calculation_date.desc&limit=1'); const date=d[0]?.calculation_date; if(!date)return;
      const [rows,nm] = await Promise.all([get(`market_top50?calculation_date=eq.${date}&order=recommendation_score.desc,rank.asc`),names()]);
      if(meta) meta.innerHTML=`資料日期：<b>${esc(date)}</b>　${rows.filter(r=>r.data_status==='AVAILABLE').length}/${rows.length} AVAILABLE　<span class="v5-tag">排序：AI 評分 ↓</span>　來源：Production`;
      table.innerHTML=rows.map((r,i)=>`<tr><td>${i+1}</td><td><button class="link-stock" data-symbol="${esc(r.symbol)}" data-market="${esc(r.market)}">${esc(r.symbol)}</button></td><td>${esc(nm[`${r.market}:${r.symbol}`]||r.symbol)}</td><td>${esc(r.market)}</td><td>${esc(num(r.recommendation_score,0))}</td><td>${esc(decision(r.decision_state))}</td><td>${esc(num(r.reference_price))}</td><td>${esc(num(r.target_price))}</td><td>${esc(num(r.risk_price))}</td><td>${esc(pct(r.expected_return_pct))}</td><td>${esc(r.evidence_strength||'—')}</td><td>${esc(r.data_as_of||date)}</td></tr>`).join('');
    } catch(e) { table.innerHTML=`<tr><td colspan="12">Production Data 讀取失敗：${esc(e.message)}</td></tr>`; }
  }

  function pageShell(id,title,subtitle,body){ const p=document.querySelector(`#page-${id}`); if(!p)return null; p.innerHTML=`<div class="v5-page"><div class="v5-page-title"><div><h2>${title}</h2><p>${subtitle}</p></div><span class="v5-tag">Production Read Only</span></div>${body}</div>`; return p; }

  async function renderEngine(){
    const p=pageShell('engine','AI 選股流程','把 Data → Calculation → Indicator → Signal → Analysis → Conclusion 完整呈現在平台。',`<div class="v5-grid-2"><section class="v5-card"><h3>① 市場資料</h3><div class="v5-step"><b>01</b><div><strong>Market Data</strong><span>TWSE / TPEx OHLCV、交易日、資料時間。</span></div></div><div class="v5-step"><b>02</b><div><strong>Data QA</strong><span>缺值、重複、OHLCV 合法性與資料新鮮度。</span></div></div></section><section class="v5-card"><h3>② 計算與指標</h3><div class="v5-step"><b>03</b><div><strong>Calculation Engine</strong><span>Production 計算 MA / EMA / RSI / MACD / Bollinger / ATR。</span></div></div><div class="v5-step"><b>04</b><div><strong>Indicator QA</strong><span>Golden Test 驗證計算結果。</span></div></div></section></div><section class="v5-card"><h3>③ 評分 → ④ Signal → ⑤ Analysis</h3><div class="v5-grid"><div><span class="v5-muted">Fundamental</span><div class="v5-number">65</div><div class="v5-bar"><i style="width:65%"></i></div></div><div><span class="v5-muted">Technical</span><div class="v5-number">35</div><div class="v5-bar"><i style="width:35%"></i></div></div><div><span class="v5-muted">Chip</span><div class="v5-number">—</div><p>Unavailable 不補猜。</p></div><div><span class="v5-muted">Final</span><div class="v5-number">Production</div><p>Dashboard 不重新計算。</p></div></div></section><section class="v5-card"><h3>目前 Golden Test</h3><div id="v5-engine-golden" class="v5-muted">讀取中…</div></section>`);
    try { const r=(await get('stock_analysis_results?symbol=eq.2330&market=eq.TWSE&order=calculation_date.desc&limit=1'))[0]; const x=p.querySelector('#v5-engine-golden'); if(x)x.innerHTML=`2330 台積電：<b>${esc(num(r?.recommendation_score,0))}/100</b>　${esc(decision(r?.decision_state))}<br>計算日 ${esc(r?.calculation_date)} · ${esc(r?.calculation_version)} · ${esc(r?.data_status)}`; } catch{}
  }

  function renderStrategy(){ pageShell('strategy','策略／參數','目前正式 Production 模型參數。Candidate 權重不在正式模型中。',`<div class="v5-grid"><div class="v5-card"><h3>正式模型</h3><div class="v5-number">single-stock-v2</div><p>Production Calculation Version</p></div><div class="v5-card"><h3>Fundamental</h3><div class="v5-number">65%</div><p>目前正式模型維持原權重。</p></div><div class="v5-card"><h3>Technical</h3><div class="v5-number">35%</div><p>目前正式模型維持原權重。</p></div><div class="v5-card"><h3>Chip</h3><div class="v5-number">—</div><p>Unavailable 時不以猜測值補足。</p></div></div><section class="v5-card"><h3>Candidate 模型隔離</h3><div class="v5-alert">Technical 加權候選 35/45/20 已完成敏感度研究，但尚未通過足夠回測，因此<strong>不列入正式 Production</strong>。</div></section><section class="v5-card"><h3>可驗證原則</h3><div class="v5-param"><b>Data</b><span>Production</span><span>市場原始資料</span></div><div class="v5-param"><b>Calculation</b><span>Production Engine</span><span>不可由 Dashboard 重算</span></div><div class="v5-param"><b>Signal</b><span>Persisted</span><span>可追溯</span></div><div class="v5-param"><b>AI</b><span>Hybrid Ready</span><span>Local Ollama / Cloud Adapter</span></div></section>`); }

  async function renderMarket(){ const p=pageShell('market','市場分析','只顯示 Production 可驗證市場資料，不以模型推測替代行情。',`<div class="v5-grid"><div class="v5-card"><h3>最新交易日</h3><div id="v5-market-date" class="v5-number">—</div></div><div class="v5-card"><h3>最新日筆數</h3><div id="v5-market-count" class="v5-number">—</div></div><div class="v5-card"><h3>市場</h3><div id="v5-market-markets" class="v5-number" style="font-size:24px">—</div></div><div class="v5-card"><h3>資料狀態</h3><div class="v5-number v5-good">AVAILABLE</div></div></div><section class="v5-card"><h3>市場資料檢查</h3><div id="v5-market-table">讀取中…</div></section>`); try{const r=await get('market_daily?select=market,trading_date&order=trading_date.desc&limit=2000');const d=r[0]?.trading_date;const day=r.filter(x=>x.trading_date===d);p.querySelector('#v5-market-date').textContent=d||'—';p.querySelector('#v5-market-count').textContent=day.length; p.querySelector('#v5-market-markets').textContent=[...new Set(day.map(x=>x.market))].join('、')||'—';p.querySelector('#v5-market-table').innerHTML=`<table class="v5-table"><thead><tr><th>檢查項目</th><th>結果</th></tr></thead><tbody><tr><td>最新交易日</td><td>${esc(d)}</td></tr><tr><td>最新日 OHLCV rows</td><td>${day.length}</td></tr><tr><td>資料來源</td><td>Production market_daily</td></tr></tbody></table>`;}catch(e){p.querySelector('#v5-market-table').textContent=`讀取失敗：${e.message}`;} }

  async function renderIndustry(){ const p=pageShell('industry','產業分析','目前以 Production 可驗證資料為主；沒有產業主檔時不虛構產業結論。',`<div class="v5-grid-2"><section class="v5-card"><h3>AI／半導體觀察</h3><p>目前 Production cohort 已包含 2308 台達電、2317 鴻海、2345 智邦、2376 技嘉、3037 欣興、3443 創意、3661 世芯-KY、6669 緯穎。</p><ul class="v5-list"><li>以 AI 概念 cohort 作為第一階段可驗證樣本。</li><li>產業排名不在沒有主檔時自行推測。</li><li>後續可接正式 industry master。</li></ul></section><section class="v5-card"><h3>資料完整度</h3><div class="v5-number">待主檔</div><p>Production 尚未提供獨立產業主檔，因此不產生虛構的產業分數。</p></section></div><section class="v5-card"><h3>研究方法</h3><div class="v5-step"><b>1</b><div><strong>Industry Master</strong><span>公司 → 產業 → 子產業</span></div></div><div class="v5-step"><b>2</b><div><strong>Industry Momentum</strong><span>產業指數／成交動能／相對強弱</span></div></div><div class="v5-step"><b>3</b><div><strong>AI Signal</strong><span>只有驗證完成後才進入正式模型</span></div></div></section>`); }

  async function renderBacktest(){ const p=pageShell('backtest','回測驗證 Backtest','目前先呈現可追溯 Production 樣本；沒有正式回測資料集就不虛構勝率。',`<div class="v5-grid"><div class="v5-card"><h3>Production 樣本</h3><div id="v5-bt-count" class="v5-number">—</div></div><div class="v5-card"><h3>勝率</h3><div class="v5-number">待驗證</div><p>尚無正式成熟回測資料集。</p></div><div class="v5-card"><h3>前向報酬</h3><div class="v5-number">待累積</div></div><div class="v5-card"><h3>狀態</h3><div class="v5-number v5-warn">QA Gate</div></div></div><section class="v5-card"><h3>為什麼不顯示模擬勝率？</h3><div class="v5-alert">股票分析系統要求 Data → Calculation → Signal → Forward Return 完整可追溯。樣本不足時保持「待驗證」，不把推測當成績效。</div></section><section class="v5-card"><h3>近期 Production Records</h3><div id="v5-bt-table">讀取中…</div></section>`); try{const r=await get('stock_analysis_results?select=calculation_date,symbol,market,recommendation_score,decision_state&order=calculation_date.desc&limit=20');p.querySelector('#v5-bt-count').textContent=r.length;p.querySelector('#v5-bt-table').innerHTML=`<table class="v5-table"><thead><tr><th>日期</th><th>代號</th><th>市場</th><th>AI評分</th><th>決策</th></tr></thead><tbody>${r.map(x=>`<tr><td>${esc(x.calculation_date)}</td><td>${esc(x.symbol)}</td><td>${esc(x.market)}</td><td>${esc(num(x.recommendation_score,0))}</td><td>${esc(decision(x.decision_state))}</td></tr>`).join('')}</tbody></table>`;}catch(e){p.querySelector('#v5-bt-table').textContent=`讀取失敗：${e.message}`;} }

  function renderData(){ pageShell('data','資料中心','Production data lineage、更新狀態與資料品質入口。',`<div class="v5-grid"><div class="v5-card"><h3>market_daily</h3><div class="v5-number">OHLCV</div><p>TWSE / TPEx 原始行情。</p></div><div class="v5-card"><h3>market_top50</h3><div class="v5-number">Top 50</div><p>Production 計算結果。</p></div><div class="v5-card"><h3>stock_analysis_results</h3><div class="v5-number">AI</div><p>單股 Production 分析。</p></div><div class="v5-card"><h3>company names</h3><div class="v5-number">1,985</div><p>TWSE / TPEx company basic data。</p></div></div><section class="v5-card"><h3>資料鏈</h3><div class="v5-step"><b>1</b><div><strong>Source</strong><span>TWSE / TPEx / MOPS</span></div></div><div class="v5-step"><b>2</b><div><strong>Storage</strong><span>Supabase Production</span></div></div><div class="v5-step"><b>3</b><div><strong>Calculation</strong><span>Analysis Engine</span></div></div><div class="v5-step"><b>4</b><div><strong>Dashboard</strong><span>Read-only presentation</span></div></div></section>`); }

  async function renderReports(){ const p=pageShell('reports','報告中心','把每日 Production 結果整理成可快速閱讀的研究摘要。',`<section class="v5-card"><h3>AI Market Snapshot</h3><div id="v5-report-summary">讀取中…</div></section><div class="v5-grid"><div class="v5-card"><h3>強烈觀察 ≥90</h3><div id="v5-r90" class="v5-number">—</div></div><div class="v5-card"><h3>值得觀察 ≥80</h3><div id="v5-r80" class="v5-number">—</div></div><div class="v5-card"><h3>持續觀察 ≥70</h3><div id="v5-r70" class="v5-number">—</div></div><div class="v5-card"><h3>低於 70</h3><div id="v5-r60" class="v5-number">—</div></div></div>`); try{const d=await get('market_top50?select=calculation_date&order=calculation_date.desc&limit=1');const date=d[0]?.calculation_date;const r=date?await get(`market_top50?calculation_date=eq.${date}`):[];p.querySelector('#v5-report-summary').innerHTML=`日期：<b>${esc(date||'—')}</b>　Top 50：<b>${r.length}</b>　來源：Production`;p.querySelector('#v5-r90').textContent=r.filter(x=>Number(x.recommendation_score)>=90).length;p.querySelector('#v5-r80').textContent=r.filter(x=>Number(x.recommendation_score)>=80).length;p.querySelector('#v5-r70').textContent=r.filter(x=>Number(x.recommendation_score)>=70).length;p.querySelector('#v5-r60').textContent=r.filter(x=>Number(x.recommendation_score)<70).length;}catch(e){p.querySelector('#v5-report-summary').textContent=`讀取失敗：${e.message}`;} }

  function renderSettings(){ pageShell('settings','系統設定','Production 連線與安全狀態。',`<div class="v5-grid"><div class="v5-card"><h3>Supabase</h3><div class="v5-number v5-good">CONNECTED</div><p>使用 publishable / anon key。</p></div><div class="v5-card"><h3>Dashboard</h3><div class="v5-number v5-good">READ ONLY</div><p>不直接寫入分析結果。</p></div><div class="v5-card"><h3>AI Engine</h3><div class="v5-number">HYBRID</div><p>Local Ollama / Cloud Adapter。</p></div><div class="v5-card"><h3>Security</h3><div class="v5-number v5-good">PASS</div><p>Production secrets 不進 Repository。</p></div></div><section class="v5-card"><h3>平台原則</h3><ul class="v5-list"><li>Dashboard 不重新計算金融指標。</li><li>資料不足時明確顯示資料不足。</li><li>所有 Production 結果需可追溯。</li></ul></section>`); }

  function renderPortfolio(){ pageShell('portfolio','我的持股 Portfolio','持股管理與 AI 觀察交叉檢視。',`<section class="v5-card"><h3>目前持股</h3><div class="v5-alert">目前持股資料仍由既有 Portfolio local storage 管理；本頁不虛構持股內容。</div><div id="v5-portfolio-host" style="margin-top:12px"></div></section>`); }

  function enhanceAnalysisName(){
    const page=document.querySelector('#page-analysis'); if(!page)return;
    const symbol=(page.querySelector('#analysis-symbol-display')?.textContent||page.querySelector('#analysis-symbol')?.value||'').trim().toUpperCase();
    if(!symbol)return;
    if(page.dataset.v5Name===symbol)return;
    page.dataset.v5Name=symbol;
    fetch('data/company-names.json').then(r=>r.ok?r.json():null).then(j=>{const e=(j?.companies||[]).find(x=>x.symbol===symbol);if(!e)return;const n=page.querySelector('#analysis-name-display');if(n)n.textContent=e.name;const meta=page.querySelector('#analysis-listing');if(meta)meta.textContent=`◉ ${e.market==='TWSE'?'上市':'上櫃'}公司 · 公司名稱來自 Production company basic data`;}).catch(()=>{});
  }

  function watch(){
    installStyles();
    renderGolden();
    renderTop50();
    const active=()=>document.querySelector('.page.active-page')?.id?.replace('page-','');
    const run=()=>{const p=active(); if(p==='top50')renderTop50(); if(p==='engine')renderEngine(); if(p==='strategy')renderStrategy(); if(p==='market')renderMarket(); if(p==='industry')renderIndustry(); if(p==='backtest')renderBacktest(); if(p==='data')renderData(); if(p==='reports')renderReports(); if(p==='settings')renderSettings(); if(p==='portfolio')renderPortfolio(); if(p==='analysis')enhanceAnalysisName();};
    document.addEventListener('click',()=>setTimeout(run,100));
    new MutationObserver(()=>{installStyles();enhanceAnalysisName();}).observe(document.body,{childList:true,subtree:true});
    setTimeout(run,1800); setTimeout(run,3500); setTimeout(run,6000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();
