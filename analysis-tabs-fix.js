/* Individual-stock analysis production runtime.
 * This file is intentionally self-contained so the 11 tabs do not depend on
 * timing/order between the presentation bootstrap and other dashboard code.
 */
(function () {
  'use strict';

  const TABS = ['總覽','技術分析','基本面','籌碼分析','財務分析','產業分析','波浪分析','AI 選股流程','歷史推薦','預測追蹤','相關新聞'];
  const KEYS = ['overview','technical','fundamental','chips','financial','industry','wave','engine','history','prediction','news'];
  const state = { symbol: '', market: 'TWSE', daily: [], funds: [], recs: [], corp: [], loaded: false };

  const q = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '—' : v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v, d = 2) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—';
  const pct = (v, d = 1) => Number.isFinite(Number(v)) ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(d)}%` : '—';
  const token = () => { try { return JSON.parse(localStorage.getItem('sad_auth_session_v1') || '{}').accessToken || ''; } catch (_) { return ''; } };
  const get = async (path) => {
    const r = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${token() || window.APP_CONFIG.SUPABASE_ANON_KEY}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const root = () => {
    const page = q('#page-analysis');
    if (!page) return null;
    let r = q('#analysis-tab-content');
    if (!r) { r = document.createElement('section'); r.id = 'analysis-tab-content'; r.className = 'stock-panel analysis-tab-root'; const tabs = page.querySelector('.stock-tabs'); if (tabs) tabs.insertAdjacentElement('afterend', r); }
    return r;
  };
  const last = () => state.daily[state.daily.length - 1] || null;
  const previous = () => state.daily[state.daily.length - 2] || null;

  function chart(rows) {
    if (!rows.length) return '<div class="stock-empty">尚無可驗證歷史行情資料。</div>';
    const w = 900, h = 300, p = 28;
    let lo = Infinity, hi = -Infinity;
    rows.forEach(r => { lo = Math.min(lo, Number(r.low)); hi = Math.max(hi, Number(r.high)); });
    const range = hi - lo || 1;
    let out = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="日線 K 線">`;
    rows.forEach((r, i) => {
      const x = p + i / Math.max(rows.length - 1, 1) * (w - 2 * p);
      const open = h-p-(Number(r.open)-lo)/range*(h-2*p), close = h-p-(Number(r.close)-lo)/range*(h-2*p);
      const high = h-p-(Number(r.high)-lo)/range*(h-2*p), low = h-p-(Number(r.low)-lo)/range*(h-2*p);
      const up = Number(r.close) >= Number(r.open), c = up ? '#13a878' : '#ef4444';
      const bw = Math.max(3, Math.min(10, (w-2*p)/rows.length*.65)), top = Math.min(open, close), bh = Math.max(2, Math.abs(open-close));
      out += `<line x1="${x}" x2="${x}" y1="${high}" y2="${low}" stroke="${c}" stroke-width="1.5"/><rect x="${x-bw/2}" y="${top}" width="${bw}" height="${bh}" fill="${c}"/>`;
    });
    return out + '</svg>';
  }

  function table(rows, head) {
    let s = '<div class="stock-table-wrap" style="overflow-x:auto;max-width:100%"><table class="stock-table">';
    if (head) s += '<thead><tr>' + head.map(x => `<th>${esc(x)}</th>`).join('') + '</tr></thead>';
    s += '<tbody>' + rows.map(r => '<tr>' + r.map(x => `<td>${esc(x)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
    return s;
  }

  function overview() {
    const l = last(), p = previous();
    const change = l && p ? Number(l.close) - Number(p.close) : null;
    const changePct = change != null && Number(p.close) ? change / Number(p.close) * 100 : null;
    return `<div class="analysis-tab-grid two">
      <section><h3>K 線走勢</h3><p class="stock-panel-sub">Production OHLCV；本區只呈現真正 K 線圖。</p><div class="analysis-chart">${chart(state.daily.slice(-60))}</div></section>
      <section><h3>最新行情</h3>${table([
        ['日期', l && l.trading_date], ['開盤', l && num(l.open)], ['最高', l && num(l.high)], ['最低', l && num(l.low)], ['收盤', l && num(l.close)],
        ['漲跌', change == null ? '—' : `${num(change)} (${pct(changePct,2)})`], ['成交量', l && Number(l.volume).toLocaleString('en-US')], ['資料來源', l && l.source]
      ])}</section></div>
      <section><h3>資料狀態</h3><p class="stock-empty">${state.daily.length ? `已載入 ${state.daily.length} 筆 Production 日線資料，最新交易日 ${esc(l.trading_date)}。` : '尚無可驗證資料。'}</p></section>`;
  }

  function rsi(rows, period = 14) {
    if (rows.length <= period) return null;
    let gain = 0, loss = 0;
    for (let i=1;i<=period;i++) { const d=Number(rows[i].close)-Number(rows[i-1].close); if(d>=0)gain+=d;else loss-=d; }
    let ag=gain/period, al=loss/period;
    for(let i=period+1;i<rows.length;i++){const d=Number(rows[i].close)-Number(rows[i-1].close);ag=(ag*(period-1)+Math.max(d,0))/period;al=(al*(period-1)+Math.max(-d,0))/period;}
    return al===0?100:100-100/(1+ag/al);
  }
  function ema(values, period) {
    if (values.length < period) return null;
    let x=values.slice(0,period).reduce((s,v)=>s+v,0)/period, k=2/(period+1);
    for(let i=period;i<values.length;i++) x=values[i]*k+x*(1-k);
    return x;
  }
  function technical() {
    const closes=state.daily.map(r=>Number(r.close)).filter(Number.isFinite), l=last(), R=rsi(state.daily,14), e12=ema(closes,12), e26=ema(closes,26), macd=e12!=null&&e26!=null?e12-e26:null;
    const t=state.daily.slice(-20), ma20=t.length?t.reduce((s,r)=>s+Number(r.close),0)/t.length:null, sd=t.length?Math.sqrt(t.reduce((s,r)=>s+Math.pow(Number(r.close)-ma20,2),0)/t.length):null;
    return `<div class="analysis-tab-grid two"><section><h3>K 線技術圖</h3><p class="stock-panel-sub">以 Production OHLCV 計算；可由原始日線重算。</p><div class="analysis-chart">${chart(state.daily.slice(-90))}</div></section>
      <section><h3>技術指標</h3>${table([
        ['RSI (14)',num(R,1),R==null?'待驗證':R>=70?'偏高':R<=30?'偏低':'中性'], ['MACD (12,26)',num(macd,2),macd==null?'待驗證':macd>=0?'正值':'負值'],
        ['MA20',num(ma20),ma20==null?'待驗證':'可驗證'], ['布林上軌',num(ma20!=null&&sd!=null?ma20+2*sd:null)], ['布林下軌',num(ma20!=null&&sd!=null?ma20-2*sd:null)], ['最新收盤',num(l&&l.close)]
      ])}</section></div><section><h3>近期日線資料</h3>${table(state.daily.slice(-30).reverse().map(r=>[r.trading_date,num(r.open),num(r.high),num(r.low),num(r.close),Number(r.volume).toLocaleString('en-US')]),['日期','開盤','最高','最低','收盤','成交量'])}</section>`;
  }
  function fundamental() {
    const f=state.funds[0], l=last(), per=f&&Number(f.eps)&&l?Number(l.close)/Number(f.eps):null, pbr=f&&Number(f.book_value_per_share)&&l?Number(l.close)/Number(f.book_value_per_share):null;
    return `<section><h3>基本面重點</h3>${table([
      ['報告期間',f&&f.reporting_period],['EPS',f&&num(f.eps)],['本益比',per==null?'資料不足':num(per)],['股價淨值比',pbr==null?'資料不足':num(pbr)],['每股股利',f&&num(f.dividend_per_share)],['營收',f&&num(f.revenue)],['淨利',f&&num(f.net_income)],['股東權益',f&&num(f.equity)],['資料來源',f&&f.source]
    ])}</section><section><h3>歷期基本面</h3>${table(state.funds.map(x=>[x.reporting_period,num(x.eps),num(x.revenue),num(x.net_income),num(x.equity),num(x.book_value_per_share)]),['期間','EPS','營收','淨利','股東權益','每股淨值'])}</section>`;
  }
  function chips() { return `<section><h3>籌碼分析</h3><p class="stock-empty">Production 目前沒有三大法人、融資融券或主力分點欄位，本區不產生推測值。</p>${table([['可驗證籌碼資料','目前無'],['公司行動紀錄',`${state.corp.length} 筆`],['說明','corporate_actions 不等同籌碼指標']])}</section>`; }
  function financial() { return `<section><h3>財務趨勢</h3><p class="stock-panel-sub">Production fundamentals 歷期資料，不以缺漏期間插值。</p>${table(state.funds.map(x=>[x.reporting_period,num(x.revenue),num(x.net_income),num(x.eps),num(x.equity)]),['期間','營收','淨利','EPS','股東權益'])}</section>`; }
  function industry() { const name=q('#analysis-name-display')?.textContent || state.symbol; return `<section><h3>產業分析</h3><p class="stock-empty">目前 Production fundamentals 未提供獨立產業分類欄位；不以模型猜測。</p>${table([['公司',name],['市場',state.market],['財務紀錄',`${state.funds.length} 筆`]])}</section>`; }
  function wave() {
    const a=state.daily.slice(-60), c=a.map(r=>Number(r.close)).filter(Number.isFinite); if(c.length<10)return '<section><h3>波浪分析</h3><p class="stock-empty">連續日線資料不足。</p></section>';
    return `<div class="analysis-tab-grid two"><section><h3>價格波段</h3><div class="analysis-chart">${chart(a)}</div></section><section><h3>客觀區間摘要</h3>${table([['60日區間報酬',pct((c[c.length-1]-c[0])/c[0]*100,2)],['區間最高',num(Math.max(...c))],['區間最低',num(Math.min(...c))],['最新收盤',num(c[c.length-1])],['方法','價格序列描述；非主觀波浪判讀']])}</section></div>`;
  }
  function engine() {
    const r=state.recs[0], b=r&&r.score_breakdown; return `<div class="analysis-tab-grid two"><section><h3>AI 選股流程</h3>${table([['推薦狀態',r&&r.decision_state],['AI Score',r&&num(r.recommendation_score,0)],['排名',r&&r.rank],['資料狀態',r&&r.data_status],['Evidence Strength',r&&r.evidence_strength],['Calculation Version',r&&r.calculation_version]])}</section><section><h3>評分拆解</h3>${b?table([['Fundamental',num(b.fundamental&&b.fundamental.score,1)],['Fundamental weight',pct(Number(b.fundamental&&b.fundamental.weight)*100,0)],['Technical',num(b.technical&&b.technical.score,1)],['Technical weight',pct(Number(b.technical&&b.technical.weight)*100,0)],['Composite',num(b.composite_score,1)]]):'<p class="stock-empty">尚無 score_breakdown。</p>'}</section></div><section><h3>推薦理由</h3><ul class="stock-reason">${((r&&r.recommendation_reason)||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
  }
  function history() { return `<section><h3>歷史推薦</h3>${table(state.recs.map(r=>[r.calculation_date,r.rank,r.decision_state,num(r.recommendation_score,0),num(r.reference_price),num(r.target_price),pct(r.expected_return_pct),r.data_as_of]),['計算日','排名','狀態','Score','參考價','目標價','預期報酬','資料日'])}</section>`; }
  function prediction() { const r=state.recs[0],l=last(); return `<div class="analysis-tab-grid two"><section><h3>預測追蹤</h3>${table([['推薦計算日',r&&r.calculation_date],['資料基準日',r&&r.data_as_of],['參考價',r&&num(r.reference_price)],['目標價',r&&num(r.target_price)],['預期報酬',r&&pct(r.expected_return_pct)],['實際最新收盤',l&&num(l.close)]])}</section><section><h3>預測成熟度</h3><p class="stock-empty">預測準確率需等待成熟樣本，不以未成熟資料代替勝率。</p></section></div>`; }
  function news() { return '<section><h3>相關新聞</h3><p class="stock-empty">Production 尚未接入可驗證新聞來源，不顯示外部或模型生成新聞。</p></section>'; }

  const views={overview,technical,fundamental,chips,financial,industry,wave,engine,history,prediction,news};
  function render(key){const r=root();if(!r)return;r.innerHTML=views[key]?views[key]():'';r.dataset.tab=key;}
  function setTab(i){let idx=typeof i==='string'?KEYS.indexOf(i):Number(i);if(idx<0)idx=0;document.querySelectorAll('#page-analysis .stock-tab').forEach((t,j)=>{t.classList.toggle('active',j===idx);t.setAttribute('aria-selected',j===idx?'true':'false');});render(KEYS[idx]);}

  async function load() {
    const input=q('#analysis-symbol'), display=q('#analysis-symbol-display');
    const raw=(input&&input.value.trim())||(display&&display.textContent.trim());
    if(!raw || raw==='—' || raw==='輸入股票') return;
    state.symbol=raw.toUpperCase().replace(/\s.*$/,'');
    const market=(q('#analysis-market-display')?.textContent||'TWSE').trim(); state.market=/^(TWSE|TPEx|TPEX)$/i.test(market)?market.toUpperCase()==='TPEX'?'TPEx':market.toUpperCase(): 'TWSE';
    const since=new Date(Date.now()-365*86400000).toISOString().slice(0,10), x=encodeURIComponent(state.symbol), m=encodeURIComponent(state.market);
    const results=await Promise.allSettled([
      get(`market_daily?symbol=eq.${x}&market=eq.${m}&trading_date=gte.${since}&order=trading_date.asc`),
      get(`fundamentals?symbol=eq.${x}&market=eq.${m}&order=reporting_period.desc&limit=12`),
      get(`market_top50?symbol=eq.${x}&market=eq.${m}&order=calculation_date.desc&limit=30`),
      get(`corporate_actions?symbol=eq.${x}&market=eq.${m}&order=ex_date.desc&limit=30`)
    ]);
    state.daily=results[0].status==='fulfilled'?results[0].value:[]; state.funds=results[1].status==='fulfilled'?results[1].value:[]; state.recs=results[2].status==='fulfilled'?results[2].value:[]; state.corp=results[3].status==='fulfilled'?results[3].value:[]; state.loaded=true;
    if(display)display.textContent=state.symbol; const crumb=q('#analysis-breadcrumb-stock');if(crumb)crumb.textContent=state.symbol;
    const l=last();
    if(l){ q('#analysis-price')&&(q('#analysis-price').textContent=num(l.close)); const p=previous(),ch=p?(Number(l.close)-Number(p.close)):null,cp=p&&Number(p.close)?ch/Number(p.close)*100:null; q('#analysis-change')&&(q('#analysis-change').textContent=ch==null?'資料不足':`${ch>=0?'+':''}${num(ch)} (${pct(cp,2)})`); q('#analysis-open')&&(q('#analysis-open').textContent=num(l.open)); q('#analysis-high')&&(q('#analysis-high').textContent=num(l.high)); q('#analysis-low')&&(q('#analysis-low').textContent=num(l.low)); q('#analysis-volume')&&(q('#analysis-volume').textContent=Number(l.volume).toLocaleString('en-US')); q('#analysis-price-asof')&&(q('#analysis-price-asof').textContent=`${l.trading_date} · ${l.source||'Production'}`); }
    const r=state.recs[0]; if(r){q('#analysis-ai-score')&&(q('#analysis-ai-score').textContent=num(r.recommendation_score,0));q('#analysis-decision')&&(q('#analysis-decision').textContent=r.decision_state||'資料不足');q('#analysis-target')&&(q('#analysis-target').textContent=num(r.target_price));q('#analysis-return')&&(q('#analysis-return').textContent=pct(r.expected_return_pct));q('#analysis-calc-date')&&(q('#analysis-calc-date').textContent=r.calculation_date||'—');q('#analysis-data-state')&&(q('#analysis-data-state').textContent=r.data_status||'—');}
    else {q('#analysis-ai-score')&&(q('#analysis-ai-score').textContent='—');q('#analysis-decision')&&(q('#analysis-decision').textContent='資料不足');}
    setTab(q('#analysis-tab-content')?.dataset.tab || 'overview');
  }

  function bind() {
    const page=q('#page-analysis'); if(!page)return false;
    const tabs=[...page.querySelectorAll('.stock-tab')]; if(!tabs.length)return false;
    tabs.forEach((tab,i)=>{tab.type='button';tab.onclick=(ev)=>{ev.preventDefault();setTab(i);};});
    const btn=q('#analysis-search'); if(btn&&!btn.dataset.prodBound){btn.dataset.prodBound='1';btn.addEventListener('click',()=>load().catch(err=>{const r=root();if(r)r.innerHTML=`<p class="stock-empty">個股資料讀取失敗：${esc(err.message)}</p>`;}));}
    if(q('#analysis-symbol')&&!q('#analysis-symbol').dataset.prodEnter){q('#analysis-symbol').dataset.prodEnter='1';q('#analysis-symbol').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();load().catch(()=>{});}});}
    return true;
  }
  function boot(){if(!bind()){setTimeout(boot,250);return;} if(!state.loaded)load().catch(()=>{});}
  window.StockAnalysisTabsV2={setTab,load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
