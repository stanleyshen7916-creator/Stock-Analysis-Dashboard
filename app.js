// Dashboard bootstrap: presentation normalization + individual-stock analysis final UX.
(function installDashboardPresentationGuard() {
  const STYLE_ID = 'dashboard-presentation-v4';
  const ANALYSIS_ID = 'page-analysis';

  function installPresentationStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Global typography baseline: no visible text below 11px. */
      body{font-size:18px!important}
      .brand strong{font-size:22px!important}.brand small{font-size:13px!important}
      .nav button{font-size:17px!important}.nav-label,.nav-sub{font-size:16px!important}.status-card{font-size:14px!important}
      .topbar h1{font-size:25px!important}.topbar p{font-size:13px!important}.top-meta span,.badge{font-size:13px!important}
      .auth-form input,.auth-form button,#logout-btn{font-size:13px!important}
      .hero-title{font-size:16px!important}.hero-number{font-size:44px!important}.hero-number small,.hero-text{font-size:16px!important}.hero-text{font-size:14px!important}
      .section-head button,.panel button,.search-card button,.form-card button{font-size:14px!important}
      .signal-card h3{font-size:16px!important}.signal-row{font-size:14px!important}.data-big{font-size:40px!important}
      .section-head h2,.page-title h2{font-size:22px!important}.section-head p,.page-title p,.panel p{font-size:14px!important}.content-grid .wide .section-head h2{font-size:29px!important}
      .horizon b{font-size:14px!important}.horizon strong{font-size:31px!important}.horizon span{font-size:13px!important}
      .table-wrap table{font-size:16px!important}.table-wrap th{font-size:12px!important}.table-wrap td{font-size:16px!important}.table-wrap td:nth-child(9){font-size:13px!important}
      .score{font-size:14px!important}.status{font-size:12px!important}.change-item{font-size:13px!important}.side h2{font-size:22px!important}
      .bottom-grid h2{font-size:20px!important}.bottom-grid p,.flow{font-size:13px!important}.flow span,.flow i{font-size:12px!important}
      .market-card h2{font-size:22px!important}.market-items{font-size:13px!important}.market-score strong{font-size:44px!important}.market-score small{font-size:13px!important}
      .kpi-label{font-size:13px!important}.kpi-value{font-size:36px!important}.kpi-value.muted{font-size:24px!important}.kpi-note,.reference-section-title{font-size:12px!important}
      .empty{font-size:14px!important}.form-card label{font-size:14px!important}.score-circle{font-size:36px!important}.score-circle small{font-size:12px!important}.clean{font-size:14px!important}.score-total{font-size:66px!important}.score-total span{font-size:17px!important}.weight-row,.audit{font-size:13px!important}.status-line{font-size:14px!important}.analysis-grid table,.analysis-grid table th,.analysis-grid table td{font-size:14px!important}

      .main{padding:14px 18px 32px!important}.topbar{gap:16px!important}.topbar>div:first-child{min-width:290px!important}.top-meta{gap:8px!important}.auth-form{gap:7px!important}.kpi-strip{gap:9px!important}.kpi{padding:13px 14px!important;min-height:104px!important}
      .dashboard-overview,.content-grid{gap:11px!important}.dashboard-overview{grid-template-columns:minmax(0,1fr) 350px!important}.content-grid{grid-template-columns:minmax(0,1fr) 350px!important}
      .horizon-grid{gap:8px!important}.horizon{padding:10px 11px!important;min-height:98px!important}.market-card{padding:14px!important}.content-grid .panel{padding:13px!important}.table-wrap th,.table-wrap td{padding:9px 8px!important}.bottom-grid{gap:11px!important;margin-top:11px!important}.bottom-grid .panel{min-height:165px!important}.form-card{padding:14px!important;gap:12px!important}

      /* Individual-stock analysis final UX, based on Project Owner reference image. */
      #page-analysis{max-width:none!important}
      .stock-analysis-page{display:flex;flex-direction:column;gap:12px}
      .stock-analysis-breadcrumb{font-size:12px;color:#687995;margin:0 0 1px}
      .stock-analysis-top{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:12px;align-items:stretch}
      .stock-hero,.stock-signal{background:#fff;border:1px solid #dfe7f1;border-radius:10px;box-shadow:0 2px 8px rgba(36,50,74,.035);padding:16px 18px}
      .stock-hero-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.stock-code{font-size:28px;font-weight:800;color:#14233c}.stock-name{font-size:28px;font-weight:800;color:#14233c}.stock-market{font-size:15px;color:#73829a}.stock-industry{font-size:13px;color:#2563eb;background:#edf5ff;border-radius:999px;padding:5px 9px}
      .stock-meta{font-size:13px;color:#64748b;margin-top:6px}.stock-price-row{display:flex;align-items:baseline;gap:12px;margin:12px 0 8px}.stock-price{font-size:34px;font-weight:800;color:#17253b}.stock-price-change{font-size:17px;font-weight:800;color:#13a878}.stock-price-sub{font-size:13px;color:#748299}.stock-ohlcv{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:13px}.stock-stat b{display:block;font-size:13px;color:#6a7890;margin-bottom:5px}.stock-stat span{font-size:16px;font-weight:750;color:#182942}
      .stock-chart{margin-top:12px;height:86px;border-top:1px solid #edf1f6;position:relative;overflow:hidden}.stock-chart svg{width:100%;height:100%;display:block}.stock-chart-labels{display:flex;justify-content:space-between;font-size:11px;color:#6f7e94;margin-top:2px}
      .stock-signal-head{display:flex;align-items:center;gap:10px}.signal-icon{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#e9f8ef;color:#13a878;font-size:24px;font-weight:800}.signal-title{font-size:25px;font-weight:800;color:#0b9b67}.signal-sub{font-size:13px;color:#6c7a90;margin-top:2px}.signal-score{margin-left:auto;text-align:right}.signal-score b{display:block;font-size:36px;line-height:1;color:#119a68}.signal-score span{font-size:12px;color:#74839a}.signal-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-top:15px}.signal-grid div{font-size:13px;border-bottom:1px solid #edf1f5;padding:7px 0}.signal-grid b{float:right;color:#243650}.signal-grid .green{color:#139b73}.signal-grid .red{color:#ef4444}
      .stock-tabs{display:flex;gap:0;border-bottom:1px solid #dfe6ef;overflow-x:auto}.stock-tab{border:0;background:transparent;padding:10px 17px;font-size:14px!important;color:#53637b;white-space:nowrap;border-bottom:2px solid transparent}.stock-tab.active{color:#2563eb;font-weight:800;border-bottom-color:#2563eb}
      .stock-grid-main{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:12px}.stock-grid-secondary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .stock-panel{background:#fff;border:1px solid #dfe7f1;border-radius:10px;padding:14px 16px;min-width:0}.stock-panel h3{font-size:17px;margin:0 0 10px;color:#17283f}.stock-panel h3 .more{float:right;font-size:12px;color:#2563eb;font-weight:700}.stock-panel-sub{font-size:12px;color:#738198;margin:-4px 0 9px}
      .stock-table{width:100%;border-collapse:collapse}.stock-table th{font-size:12px;text-align:left;color:#65748c;font-weight:700;padding:7px 5px;border-bottom:1px solid #e8edf3}.stock-table td{font-size:14px;color:#25364f;padding:8px 5px;border-bottom:1px solid #eef2f6}.stock-table td:last-child{text-align:right}.stock-table .good{color:#139b73;font-weight:700}.stock-table .warn{color:#f59e0b;font-weight:700}.stock-table .bad{color:#ef4444;font-weight:700}
      .stock-reason{font-size:14px;line-height:1.65;color:#2e405c}.stock-reason li{margin:4px 0}.stock-reason .tag{display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;background:#eef6ff;color:#2563eb;margin-right:6px}
      .stock-score-bar{height:9px;background:#eaf0f6;border-radius:999px;overflow:hidden;margin:7px 0 10px}.stock-score-bar i{display:block;height:100%;background:#13a878;border-radius:999px;width:0}.stock-score-line{display:flex;justify-content:space-between;font-size:12px;color:#718099}.stock-empty{font-size:13px!important;color:#7a8799;padding:10px 0}
      .stock-news div{padding:8px 0;border-bottom:1px solid #edf1f5;font-size:13px;line-height:1.35}.stock-news small{display:block;color:#8995a7;font-size:11px;margin-top:2px}
      .stock-footer-note{font-size:11px;color:#718097;border-top:1px solid #e5eaf1;padding-top:9px}

      @media(max-width:1250px){.kpi-strip{grid-template-columns:repeat(4,1fr)!important}.dashboard-overview,.content-grid{grid-template-columns:1fr!important}.stock-analysis-top{grid-template-columns:1fr}.stock-grid-secondary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:800px){html,body{overflow-x:hidden!important}.main{padding:12px!important}.topbar>div:first-child{min-width:0!important}.kpi-strip{grid-template-columns:repeat(2,1fr)!important;gap:9px!important}.kpi{min-height:98px!important}.horizon-grid{grid-template-columns:repeat(2,1fr)!important}.horizon{min-height:94px!important}.bottom-grid{grid-template-columns:1fr!important}.topbar{display:block!important}.top-meta{justify-content:flex-start!important;margin-top:9px!important}.table-wrap{max-width:100%!important;overflow-x:auto!important}.stock-hero,.stock-signal{padding:14px}.stock-code,.stock-name{font-size:23px}.stock-price{font-size:29px}.stock-ohlcv{grid-template-columns:repeat(3,1fr);gap:8px}.stock-grid-main,.stock-grid-secondary{grid-template-columns:1fr}.stock-tabs{margin-right:-2px}.stock-panel{padding:12px}.stock-table{min-width:620px}.stock-table-wrap{overflow-x:auto}.signal-score b{font-size:31px}}
      @media(max-width:520px){.kpi-strip,.horizon-grid{grid-template-columns:1fr!important}.nav{grid-template-columns:1fr!important}.stock-ohlcv{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function installAnalysisMarkup() {
    const page = document.getElementById(ANALYSIS_ID);
    if (!page || page.dataset.finalUx === '1') return;
    page.dataset.finalUx = '1';
    page.innerHTML = `
      <div class="stock-analysis-page">
        <p class="stock-analysis-breadcrumb">首頁　&gt;　個股分析　&gt;　<span id="analysis-breadcrumb-stock">—</span></p>
        <div class="stock-analysis-top">
          <section class="stock-hero">
            <div class="stock-hero-head"><span id="analysis-symbol-display" class="stock-code">—</span><span id="analysis-name-display" class="stock-name">輸入股票</span><span id="analysis-market-display" class="stock-market">—</span><span id="analysis-industry-display" class="stock-industry">產業資料待確認</span></div>
            <div id="analysis-listing" class="stock-meta">◉ 上市公司 · 資料來源待確認</div>
            <div class="stock-price-row"><span id="analysis-price" class="stock-price">—</span><span id="analysis-change" class="stock-price-change">資料不足</span><span class="stock-price-sub" id="analysis-price-asof">最新可驗證資料</span></div>
            <div class="stock-ohlcv"><div class="stock-stat"><b>開盤</b><span id="analysis-open">—</span></div><div class="stock-stat"><b>最高</b><span id="analysis-high">—</span></div><div class="stock-stat"><b>最低</b><span id="analysis-low">—</span></div><div class="stock-stat"><b>成交量</b><span id="analysis-volume">—</span></div><div class="stock-stat"><b>成交額</b><span id="analysis-turnover">—</span></div></div>
            <div id="analysis-mini-chart" class="stock-chart"><div class="stock-empty">等待可驗證歷史行情資料</div></div><div id="analysis-chart-labels" class="stock-chart-labels"><span>—</span><span>—</span></div>
          </section>
          <aside class="stock-signal">
            <div class="stock-signal-head"><div class="signal-icon">◎</div><div><div id="analysis-decision" class="signal-title">資料不足</div><div id="analysis-decision-sub" class="signal-sub">AI 推薦狀態</div></div><div class="signal-score"><b id="analysis-ai-score">—</b><span>AI Score / 100</span></div></div>
            <div class="signal-grid"><div>適合週期 <b id="analysis-horizon">—</b></div><div>目標價 <b id="analysis-target">—</b></div><div>預期報酬 <b id="analysis-return">—</b></div><div>風險價 <b id="analysis-risk">資料不足</b></div><div>更新日期 <b id="analysis-calc-date">—</b></div><div>資料狀態 <b id="analysis-data-state">待查詢</b></div></div>
          </aside>
        </div>
        <div class="search-card stock-search-card"><input id="analysis-symbol" placeholder="輸入股票代號或公司名稱，例如 2330／台積電"><button id="analysis-search" class="primary">開始分析</button></div>
        <div class="stock-tabs"><button class="stock-tab active">總覽</button><button class="stock-tab">技術分析</button><button class="stock-tab">基本面</button><button class="stock-tab">籌碼分析</button><button class="stock-tab">財務分析</button><button class="stock-tab">產業分析</button><button class="stock-tab">波浪分析</button><button class="stock-tab">AI 選股流程</button><button class="stock-tab">歷史推薦</button><button class="stock-tab">預測追蹤</button><button class="stock-tab">相關新聞</button></div>
        <div class="stock-grid-main">
          <section class="stock-panel"><h3>K 線走勢 <span class="more">更多 ›</span></h3><div class="stock-panel-sub">目前顯示 Production 可驗證日線資料；不以模型生成價格。</div><div id="analysis-market" class="stock-table-wrap"><div class="stock-empty">尚未查詢。</div></div></section>
          <section class="stock-panel"><h3>技術指標 <span class="more">更多 ›</span></h3><div id="analysis-technical"><table class="stock-table"><tbody><tr><th>技術面綜合分數</th><td id="analysis-technical-score">資料不足</td></tr><tr><th>趨勢狀態</th><td>待驗證</td></tr><tr><th>動能</th><td>待驗證</td></tr><tr><th>波動度</th><td>待驗證</td></tr><tr><th>成交量趨勢</th><td>待驗證</td></tr></tbody></table></div></section>
        </div>
        <div class="stock-grid-main">
          <section class="stock-panel"><h3>AI 結論與觀察理由</h3><div id="analysis-conclusion" class="stock-reason stock-empty">輸入股票代號後載入。</div><div id="analysis-reasons" class="stock-reason stock-empty">等待 Production 推薦理由。</div></section>
          <section class="stock-panel"><h3>基本面重點 <span class="more">更多 ›</span></h3><div id="analysis-fundamentals"><div class="stock-empty">尚未查詢。</div></div></section>
        </div>
        <div class="stock-grid-secondary">
          <section class="stock-panel"><h3>籌碼分析</h3><div id="analysis-chips" class="stock-empty">Production 尚無可驗證籌碼指標，暫不顯示推測值。</div></section>
          <section class="stock-panel"><h3>財務趨勢</h3><div id="analysis-financial" class="stock-empty">Production 尚無足夠連續財務序列，暫不繪製趨勢。</div></section>
          <section class="stock-panel"><h3>AI 推薦變化</h3><div id="analysis-history" class="stock-empty">尚未查詢推薦歷史。</div></section>
          <section class="stock-panel"><h3>相關新聞</h3><div id="analysis-news" class="stock-news"><div class="stock-empty">目前平台尚未接入可驗證新聞來源。</div></div></section>
        </div>
        <section class="stock-panel"><h3>資料追溯</h3><div id="analysis-provenance" class="stock-empty">尚未查詢。</div><p class="stock-footer-note">本頁遵循 Data → Calculation → Indicator → Signal → Analysis → Conclusion；沒有 Production 證據的數值一律標示為資料不足。</p></section>
      </div>`;
  }

  function installRuntimeEnhancer() {
    const parseNumber = (text) => { const m = String(text || '').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
    const fmt = (v, d=2) => Number.isFinite(v) ? v.toFixed(d) : '—';
    const fmtInt = (v) => Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—';
    const enhance = () => {
      const conclusion = document.getElementById('analysis-conclusion')?.textContent || '';
      const provenance = document.getElementById('analysis-provenance')?.textContent || '';
      const market = document.querySelector('#analysis-market table tbody');
      const rows = market ? [...market.querySelectorAll('tr')] : [];
      const dataRows = rows.filter(r => r.children.length >= 6);
      const latest = dataRows[0];
      const stockInput = document.getElementById('analysis-symbol')?.value?.trim() || '';
      const symbol = stockInput.toUpperCase() || (conclusion.match(/^(\S+)/)?.[1] || '—');
      const marketName = conclusion.includes('TWSE') ? 'TWSE' : conclusion.includes('TPEx') ? 'TPEx' : 'TWSE';
      document.getElementById('analysis-symbol-display').textContent = symbol;
      document.getElementById('analysis-breadcrumb-stock').textContent = symbol;
      document.getElementById('analysis-market-display').textContent = marketName;
      const nameMap = {'2330':'台積電','2317':'鴻海','2454':'聯發科'};
      document.getElementById('analysis-name-display').textContent = nameMap[symbol] || '公司名稱由 Production 名稱資料提供';
      const score = parseNumber(conclusion.match(/AI 評分\s*([0-9.]+)/)?.[1]);
      const target = parseNumber(conclusion.match(/目標價\s*([0-9.]+)/)?.[1]);
      const ret = conclusion.match(/預期報酬\s*([+\-]?[0-9.]+%)/)?.[1];
      const decision = conclusion.match(/｜([^｜]+)｜目標價/)?.[1] || '資料不足';
      const horizon = conclusion.match(/觀察週期\s*(.+)$/)?.[1] || '—';
      document.getElementById('analysis-ai-score').textContent = Number.isFinite(score) ? String(Math.round(score)) : '—';
      document.getElementById('analysis-decision').textContent = decision;
      document.getElementById('analysis-horizon').textContent = horizon;
      document.getElementById('analysis-target').textContent = Number.isFinite(target) ? target.toFixed(2) : '—';
      document.getElementById('analysis-return').textContent = ret || '—';
      const calcDate = provenance.match(/最新計算日\s*(\d{4}-\d{2}-\d{2})/)?.[1] || '—';
      document.getElementById('analysis-calc-date').textContent = calcDate;
      document.getElementById('analysis-data-state').textContent = latest ? '可驗證' : '資料不足';
      if (latest) {
        const vals = [...latest.children].map(c => c.textContent.trim());
        const date=vals[0], open=parseNumber(vals[1]), high=parseNumber(vals[2]), low=parseNumber(vals[3]), close=parseNumber(vals[4]), vol=parseNumber(vals[5]);
        document.getElementById('analysis-price').textContent = Number.isFinite(close) ? fmt(close) : '—';
        document.getElementById('analysis-price-asof').textContent = `${date} · Production 日線資料`;
        document.getElementById('analysis-open').textContent=fmt(open);document.getElementById('analysis-high').textContent=fmt(high);document.getElementById('analysis-low').textContent=fmt(low);document.getElementById('analysis-volume').textContent=fmtInt(vol);document.getElementById('analysis-turnover').textContent='—';
        if (dataRows.length > 1) { const prev=parseNumber(dataRows[1].children[4].textContent); if(Number.isFinite(prev)&&Number.isFinite(close)){const ch=close-prev;const pct=prev?ch/prev*100:0;document.getElementById('analysis-change').textContent=`${ch>=0?'+':''}${fmt(ch)} (${ch>=0?'+':''}${pct.toFixed(2)}%)`;document.getElementById('analysis-change').style.color=ch>=0?'#13a878':'#ef4444';}}
        const pts=dataRows.slice(0,24).reverse().map(r=>parseNumber(r.children[4].textContent)).filter(Number.isFinite);
        if(pts.length>=2){const min=Math.min(...pts),max=Math.max(...pts),range=max-min||1;const w=760,h=86;const d=pts.map((v,i)=>`${(i/(pts.length-1))*w},${h-8-((v-min)/range)*(h-20)}`).join(' ');document.getElementById('analysis-mini-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="可驗證歷史收盤價趨勢"><polyline points="${d}" fill="none" stroke="#2f78d0" stroke-width="2.5"/></svg>`;document.getElementById('analysis-chart-labels').innerHTML=`<span>${dataRows.at(-1)?.children[0].textContent||'—'}</span><span>${date}</span>`;}
      }
      const fund=document.querySelector('#analysis-fundamentals table');
      if(fund){document.querySelector('#analysis-fundamentals').classList.remove('stock-empty');}
      const reasonText=provenance.match(/理由：(.+)$/)?.[1];
      if(reasonText) document.getElementById('analysis-reasons').innerHTML=`<ul>${reasonText.split('、').slice(0,3).map(r=>`<li>${r}</li>`).join('')}</ul>`;
      if(conclusion.includes('資料不足')) document.getElementById('analysis-decision').className='signal-title';
    };
    const obs=new MutationObserver(enhance); const targets=['analysis-conclusion','analysis-provenance','analysis-market','analysis-fundamentals'].map(id=>document.getElementById(id)).filter(Boolean);targets.forEach(n=>obs.observe(n,{childList:true,subtree:true,characterData:true})); setTimeout(enhance,1000); setTimeout(enhance,3000);
  }

  installPresentationStyles();
  installAnalysisMarkup();
  window.addEventListener('DOMContentLoaded', installAnalysisMarkup, { once: true });
  window.__stockAnalysisEnhancer = installRuntimeEnhancer;
})();

import('./app-runtime.js').then(() => {
  try { window.__stockAnalysisEnhancer?.(); } catch (err) { console.error('Stock analysis UX enhancer failed:', err); }
}).catch((err) => console.error('Dashboard runtime failed to start:', err));
