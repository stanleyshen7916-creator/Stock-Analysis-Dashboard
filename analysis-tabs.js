/* Individual-stock analysis tab controller.
 * Read-only Production data; no fabricated market values.
 */
(function () {
  'use strict';

  const TAB_DEFS = [
    ['總覽', 'overview'], ['技術分析', 'technical'], ['基本面', 'fundamental'], ['籌碼分析', 'chips'],
    ['財務分析', 'financial'], ['產業分析', 'industry'], ['波浪分析', 'wave'], ['AI 選股流程', 'engine'],
    ['歷史推薦', 'history'], ['預測追蹤', 'prediction'], ['相關新聞', 'news']
  ];
  const SESSION_KEY = 'sad_auth_session_v1';
  let state = { symbol: '', market: 'TWSE', daily: [], funds: [], recommendations: [], corp: [] };
  let wired = false;

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '—').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = (v, d = 2) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—';
  const integer = (v) => Number.isFinite(Number(v)) ? Math.round(Number(v)).toLocaleString('en-US') : '—';
  const pct = (v, d = 1) => Number.isFinite(Number(v)) ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(d)}%` : '—';
  const latest = () => state.daily[state.daily.length - 1] || null;
  const prev = () => state.daily[state.daily.length - 2] || null;
  const sessionToken = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}').accessToken || ''; } catch { return ''; } };

  async function get(path) {
    const headers = { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${sessionToken() || window.APP_CONFIG.SUPABASE_ANON_KEY}` };
    const r = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/${path}`, { headers });
    if (!r.ok) throw new Error(`${r.status} ${path.split('?')[0]}`);
    return r.json();
  }

  function currentSymbol() {
    const input = $('#analysis-symbol');
    const displayed = $('#analysis-symbol-display')?.textContent?.trim();
    return (input?.value?.trim() || displayed || '').toUpperCase().replace(/\s.*$/, '');
  }

  function companyName(symbol) {
    return ({ '2330':'台積電', '2317':'鴻海', '2454':'聯發科' })[symbol] || $('#analysis-name-display')?.textContent || symbol;
  }

  function tabRoot() {
    let root = $('#analysis-tab-content');
    if (!root) {
      const tabs = $('.stock-tabs');
      if (!tabs) return null;
      root = document.createElement('section');
      root.id = 'analysis-tab-content';
      root.className = 'stock-panel analysis-tab-root';
      tabs.insertAdjacentElement('afterend', root);
    }
    return root;
  }

  function chartSVG(rows, candle = false) {
    if (!rows.length) return '<div class="stock-empty">尚無可驗證歷史行情資料。</div>';
    const w = 900, h = 300, pad = 28;
    const min = Math.min(...rows.map(r => Number(r.low))), max = Math.max(...rows.map(r => Number(r.high))), range = max - min || 1;
    const x = (i) => pad + (i / Math.max(rows.length - 1, 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((Number(v) - min) / range) * (h - pad * 2);
    if (!candle) {
      const points = rows.map((r,i) => `${x(i).toFixed(1)},${y(r.close).toFixed(1)}`).join(' ');
      return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="歷史收盤價走勢"><polyline points="${points}" fill="none" stroke="#2f78d0" stroke-width="3"/></svg>`;
    }
    const bw = Math.max(3, Math.min(12, (w - pad * 2) / rows.length * .62));
    const candles = rows.map((r,i) => {
      const cx=x(i), yo=y(r.open), yc=y(r.close), yh=y(r.high), yl=y(r.low), top=Math.min(yo,yc), bh=Math.max(2,Math.abs(yo-yc));
      const up=Number(r.close)>=Number(r.open), fill=up?'#13a878':'#ef4444';
      return `<line x1="${cx}" x2="${cx}" y1="${yh}" y2="${yl}" stroke="${fill}" stroke-width="1.5"/><rect x="${cx-bw/2}" y="${top}" width="${bw}" height="${bh}" fill="${fill}" rx="1"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="日線 K 線"><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="#dce4ef"/>${candles}</svg>`;
  }

  function metricRows(rows) {
    return rows.map(([a,b,c='']) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td><td class="${c}">${c ? esc(c) : ''}</td></tr>`).join('');
  }

  function renderOverview() {
    const l=latest(), p=prev();
    const change=l&&p ? Number(l.close)-Number(p.close) : null;
    const changePct=l&&p&&Number(p.close) ? change/Number(p.close)*100 : null;
    return `<div class="analysis-tab-grid two">
      <section><h3>K 線走勢 <span class="more">${state.daily.length} 個交易日</span></h3><p class="stock-panel-sub">Production 日線 OHLCV；此區只呈現價格走勢，不以日資料表取代 K 線。</p><div class="analysis-chart">${chartSVG(state.daily.slice(-60), true)}</div><div class="analysis-axis"><span>${esc(state.daily[Math.max(0,state.daily.length-60)]?.trading_date)}</span><span>${esc(l?.trading_date)}</span></div></section>
      <section><h3>最新行情</h3><table class="stock-table"><tbody>${metricRows([['日期',l?.trading_date],['開盤',num(l?.open)],['最高',num(l?.high)],['最低',num(l?.low)],['收盤',num(l?.close)],['漲跌',change==null?'—':`${num(change)} (${pct(changePct,2)})`],['成交量',integer(l?.volume)],['資料來源',l?.source]])}</tbody></table></section>
    </div><div class="analysis-tab-grid two"><section><h3>成交量</h3><div class="volume-bars">${state.daily.slice(-30).map(r=>`<i style="height:${Math.max(8,Math.min(100,Number(r.volume||0)/(Math.max(...state.daily.slice(-30).map(x=>Number(x.volume)||0))||1)*100))}%"></i>`).join('')}</div></section><section><h3>資料狀態</h3><p class="stock-empty">${state.daily.length ? `已載入 ${state.daily.length} 筆 Production 日線資料，最新交易日 ${esc(l?.trading_date)}。` : '尚無可驗證資料。'}</p></section></div>`;
  }

  function calcRSI(rows, period=14) {
    if (rows.length <= period) return null;
    let gains=0, losses=0;
    for(let i=1;i<=period;i++){const d=Number(rows[i].close)-Number(rows[i-1].close); if(d>=0) gains+=d; else losses-=d;}
    let ag=gains/period, al=losses/period;
    for(let i=period+1;i<rows.length;i++){const d=Number(rows[i].close)-Number(rows[i-1].close); ag=(ag*(period-1)+Math.max(d,0))/period; al=(al*(period-1)+Math.max(-d,0))/period;}
    return al===0 ? 100 : 100-(100/(1+ag/al));
  }
  function ema(values, period) { if(values.length<period) return null; let e=values.slice(0,period).reduce((a,b)=>a+b,0)/period, k=2/(period+1); for(let i=period;i<values.length;i++) e=values[i]*k+e*(1-k); return e; }
  function renderTechnical() {
    const closes=state.daily.map(r=>Number(r.close)).filter(Number.isFinite), l=latest();
    const rsi=calcRSI(state.daily,14), e12=ema(closes,12), e26=ema(closes,26), macd=e12!=null&&e26!=null?e12-e26:null;
    const tail=state.daily.slice(-20), mean=tail.length?tail.reduce((s,r)=>s+Number(r.close),0)/tail.length:null;
    const sd=tail.length?Math.sqrt(tail.reduce((s,r)=>s+(Number(r.close)-mean)**2,0)/tail.length):null;
    const upper=mean!=null&&sd!=null?mean+2*sd:null, lower=mean!=null&&sd!=null?mean-2*sd:null;
    const avgVol=tail.length?tail.reduce((s,r)=>s+Number(r.volume||0),0)/tail.length:null;
    const volTrend=l&&avgVol&&Number(l.volume)>avgVol?'高於20日均量':'低於/接近20日均量';
    return `<div class="analysis-tab-grid two"><section><h3>K 線技術圖</h3><p class="stock-panel-sub">以 Production OHLCV 計算；公式結果可由原始日線重算。</p><div class="analysis-chart">${chartSVG(state.daily.slice(-90),true)}</div></section><section><h3>技術指標</h3><table class="stock-table"><tbody>${metricRows([['RSI (14)',num(rsi,1),rsi==null?'待驗證':rsi>=70?'偏高':rsi<=30?'偏低':'中性'],['MACD (12,26)',num(macd,2),macd==null?'待驗證':macd>=0?'正值':'負值'],['MA20',num(mean),mean==null?'待驗證':'可驗證'],['布林上軌',num(upper),'20日 ± 2σ'],['布林下軌',num(lower),'20日 ± 2σ'],['成交量趨勢',volTrend,'Production'],['最新收盤',num(l?.close),'Production']])}</tbody></table></section></div><section><h3>近期日線資料</h3><div class="stock-table-wrap"><table class="stock-table wide-table"><thead><tr><th>日期</th><th>開盤</th><th>最高</th><th>最低</th><th>收盤</th><th>成交量</th></tr></thead><tbody>${state.daily.slice(-20).reverse().map(r=>`<tr><td>${esc(r.trading_date)}</td><td>${num(r.open)}</td><td>${num(r.high)}</td><td>${num(r.low)}</td><td>${num(r.close)}</td><td>${integer(r.volume)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderFundamental() {
    const f=state.funds[0], l=latest();
    const per=f&&f.eps&&l ? Number(l.close)/Number(f.eps) : null, pbr=f&&f.book_value_per_share&&l ? Number(l.close)/Number(f.book_value_per_share) : null;
    return `<div class="analysis-tab-grid two"><section><h3>基本面重點</h3><table class="stock-table"><tbody>${metricRows([['報告期間',f?.reporting_period],['EPS',num(f?.eps)],['本益比（依最新收盤）',per==null?'資料不足':num(per)],['股價淨值比',pbr==null?'資料不足':num(pbr)],['每股股利',num(f?.dividend_per_share)],['營收',num(f?.revenue)],['淨利',num(f?.net_income)],['股東權益',num(f?.equity)],['資料來源',f?.source]])}</tbody></table></section><section><h3>資料品質</h3><p class="stock-empty">目前以 Production fundamentals 最新報告期為準。若欄位為空，不以估算值補齊。</p><p class="stock-empty">已取得 ${state.funds.length} 筆基本面紀錄。</p></section></div><section><h3>歷期基本面</h3><div class="stock-table-wrap"><table class="stock-table wide-table"><thead><tr><th>期間</th><th>EPS</th><th>營收</th><th>淨利</th><th>股東權益</th><th>每股淨值</th></tr></thead><tbody>${state.funds.map(x=>`<tr><td>${esc(x.reporting_period)}</td><td>${num(x.eps)}</td><td>${num(x.revenue)}</td><td>${num(x.net_income)}</td><td>${num(x.equity)}</td><td>${num(x.book_value_per_share)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderChips() {
    return `<section><h3>籌碼分析</h3><p class="stock-empty">目前 Production schema 沒有三大法人、融資融券、主力分點等籌碼欄位，因此本頁不產生推測數值。</p><table class="stock-table"><tbody>${metricRows([['可驗證來源','目前無可用籌碼資料'],['除權息／公司行動紀錄',`${state.corp.length} 筆`],['資料來源','corporate_actions 僅作事件追溯，不等同籌碼指標']])}</tbody></table></section>`;
  }

  function renderFinancial() {
    const rows=state.funds.slice().reverse();
    return `<section><h3>財務趨勢</h3><p class="stock-panel-sub">以 Production fundamentals 歷期資料呈現；不以缺漏期間插值。</p><div class="analysis-chart financial-chart"><svg viewBox="0 0 900 280" preserveAspectRatio="none">${rows.length>1?`<polyline points="${rows.map((r,i)=>`${60+i*(780/Math.max(1,rows.length-1))},${230-(Number(r.revenue||0)/(Math.max(...rows.map(x=>Number(x.revenue)||0))||1))*190}`).join(' ')}" fill="none" stroke="#2f78d0" stroke-width="3"/>`:''}</svg></div><table class="stock-table"><thead><tr><th>期間</th><th>營收</th><th>淨利</th><th>EPS</th><th>股東權益</th></tr></thead><tbody>${state.funds.map(r=>`<tr><td>${esc(r.reporting_period)}</td><td>${num(r.revenue)}</td><td>${num(r.net_income)}</td><td>${num(r.eps)}</td><td>${num(r.equity)}</td></tr>`).join('')}</tbody></table></section>`;
  }

  function renderIndustry() {
    const f=state.funds[0];
    return `<section><h3>產業分析</h3><p class="stock-empty">Production fundamentals 目前未提供獨立產業分類欄位。公司所屬產業不可由模型猜測，因此此區維持資料不足。</p><table class="stock-table"><tbody>${metricRows([['公司',companyName(state.symbol)],['市場',state.market],['可驗證財務紀錄',`${state.funds.length} 筆`],['最新報告期',f?.reporting_period]])}</tbody></table></section>`;
  }

  function renderWave() {
    const rows=state.daily.slice(-60), closes=rows.map(r=>Number(r.close)).filter(Number.isFinite);
    if(closes.length<10) return '<section><h3>波浪分析</h3><div class="stock-empty">至少需要足夠連續日線資料才能進行可驗證的波段描述。</div></section>';
    const first=closes[0], last=closes.at(-1), change=(last-first)/first*100;
    return `<div class="analysis-tab-grid two"><section><h3>價格波段</h3><div class="analysis-chart">${chartSVG(rows,false)}</div></section><section><h3>客觀趨勢摘要</h3><table class="stock-table"><tbody>${metricRows([['60日區間報酬',pct(change,2)],['區間最高',num(Math.max(...closes))],['區間最低',num(Math.min(...closes))],['最新收盤',num(last)],['分析方法','價格序列描述；非主觀 Elliott 波浪定義']])}</tbody></table></section></div>`;
  }

  function renderEngine() {
    const r=state.recommendations[0], b=r?.score_breakdown;
    return `<div class="analysis-tab-grid two"><section><h3>AI 選股流程</h3><table class="stock-table"><tbody>${metricRows([['推薦狀態',r?.decision_state],['AI Score',num(r?.recommendation_score,0)],['排名',r?.rank],['資料狀態',r?.data_status],['Evidence Strength',r?.evidence_strength],['Calculation Version',r?.calculation_version]])}</tbody></table></section><section><h3>評分拆解</h3>${b?`<table class="stock-table"><tbody>${metricRows([['Fundamental score',num(b.fundamental?.score,1)],['Fundamental weight',pct(Number(b.fundamental?.weight)*100,0)],['Technical score',num(b.technical?.score,1)],['Technical weight',pct(Number(b.technical?.weight)*100,0)],['Composite',num(b.composite_score,1)])}</tbody></table>`:'<div class="stock-empty">Production 尚無可驗證 score_breakdown。</div>'}</section></div><section><h3>推薦理由</h3><ul class="stock-reason">${(r?.recommendation_reason||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>尚無 Production 推薦理由。</li>'}</ul></section>`;
  }

  function renderHistory() {
    return `<section><h3>歷史推薦</h3><p class="stock-panel-sub">market_top50 真實計算紀錄。</p><table class="stock-table wide-table"><thead><tr><th>計算日</th><th>排名</th><th>狀態</th><th>Score</th><th>參考價</th><th>目標價</th><th>預期報酬</th><th>資料日</th></tr></thead><tbody>${state.recommendations.map(r=>`<tr><td>${esc(r.calculation_date)}</td><td>${esc(r.rank)}</td><td>${esc(r.decision_state)}</td><td>${num(r.recommendation_score,0)}</td><td>${num(r.reference_price)}</td><td>${num(r.target_price)}</td><td>${pct(r.expected_return_pct,1)}</td><td>${esc(r.data_as_of)}</td></tr>`).join('')||'<tr><td colspan="8">尚無推薦歷史。</td></tr>'}</tbody></table></section>`;
  }

  function renderPrediction() {
    const r=state.recommendations[0], l=latest();
    return `<div class="analysis-tab-grid two"><section><h3>預測追蹤</h3><table class="stock-table"><tbody>${metricRows([['推薦計算日',r?.calculation_date],['資料基準日',r?.data_as_of],['參考價',num(r?.reference_price)],['目標價',num(r?.target_price)],['預期報酬',pct(r?.expected_return_pct,1)],['實際最新收盤',num(l?.close)]])}</tbody></table></section><section><h3>成熟度</h3><p class="stock-empty">預測準確率需等待足夠成熟樣本後才可計算。未成熟資料不以勝率代替。</p></section></div>`;
  }

  function renderNews() {
    return `<section><h3>相關新聞</h3><div class="stock-empty">目前 Dashboard Production 資料層尚未接入可驗證新聞來源，因此不顯示外部新聞或模型生成新聞摘要。</div></section>`;
  }

  function render(name='overview') {
    const root=tabRoot(); if(!root) return;
    const views={overview:renderOverview,technical:renderTechnical,fundamental:renderFundamental,chips:renderChips,financial:renderFinancial,industry:renderIndustry,wave:renderWave,engine:renderEngine,history:renderHistory,prediction:renderPrediction,news:renderNews};
    root.innerHTML=views[name]?views[name]():'';
    root.dataset.tab=name;
  }

  function setActive(index) {
    const tabs=document.querySelectorAll('.stock-tab'); tabs.forEach((t,i)=>{t.classList.toggle('active',i===index);t.setAttribute('aria-selected',i===index?'true':'false');});
    render(TAB_DEFS[index]?.[1]||'overview');
  }

  async function loadData() {
    const symbol=currentSymbol(); if(!symbol) return;
    state.symbol=symbol; state.market=$('#analysis-market-display')?.textContent?.trim()||'TWSE';
    const since=new Date(Date.now()-365*86400000).toISOString().slice(0,10);
    const q=encodeURIComponent(symbol);
    const results=await Promise.allSettled([
      get(`market_daily?symbol=eq.${q}&market=eq.${encodeURIComponent(state.market)}&trading_date=gte.${since}&order=trading_date.asc`),
      get(`fundamentals?symbol=eq.${q}&market=eq.${encodeURIComponent(state.market)}&order=reporting_period.desc&limit=12`),
      get(`market_top50?symbol=eq.${q}&market=eq.${encodeURIComponent(state.market)}&order=calculation_date.desc&limit=30`),
      get(`corporate_actions?symbol=eq.${q}&market=eq.${encodeURIComponent(state.market)}&order=effective_date.desc&limit=30`)
    ]);
    state.daily=results[0].status==='fulfilled'?results[0].value:[];
    state.funds=results[1].status==='fulfilled'?results[1].value:[];
    state.recommendations=results[2].status==='fulfilled'?results[2].value:[];
    state.corp=results[3].status==='fulfilled'?results[3].value:[];
    render($('#analysis-tab-content')?.dataset.tab||'overview');
  }

  function wire() {
    const tabs=document.querySelectorAll('.stock-tab');
    if(!tabs.length) return false;
    tabs.forEach((tab,i)=>{tab.type='button';tab.onclick=(e)=>{e.preventDefault();setActive(i);};});
    const search=$('#analysis-search'); if(search&&!search.dataset.tabsWired){search.dataset.tabsWired='1';search.addEventListener('click',()=>setTimeout(loadData,400));}
    const input=$('#analysis-symbol'); if(input&&!input.dataset.tabsWired){input.dataset.tabsWired='1';input.addEventListener('keydown',e=>{if(e.key==='Enter')setTimeout(loadData,400);});}
    if(!wired){wired=true;setTimeout(loadData,800);}
    return true;
  }

  function boot(){
    if(!wire()) { setTimeout(boot,500); return; }
    setActive(0);
    const page=$('#page-analysis'); if(page&&!page.dataset.tabsObserver){page.dataset.tabsObserver='1';new MutationObserver(()=>wire()).observe(page,{childList:true,subtree:true});}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.StockAnalysisTabs={reload:loadData,setTab:(name)=>{const i=TAB_DEFS.findIndex(x=>x[1]===name);if(i>=0)setActive(i);}};
})();
