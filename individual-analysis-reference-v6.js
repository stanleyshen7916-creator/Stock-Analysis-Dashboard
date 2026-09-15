// Individual Analysis Reference UX v6
// Presentation-only layer. Reuses Production-persisted values already rendered by the
// existing stock-analysis runtime; never calculates or mutates analysis results.
(() => {
  'use strict';
  const STYLE_ID = 'individual-analysis-reference-v6-style';
  const HERO_ID = 'analysis-reference-v6-hero';
  const esc = (v) => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #page-analysis.v6-analysis { padding-top: 2px !important; }
      #page-analysis.v6-analysis > .page-title,
      #page-analysis.v6-analysis > .search-card { display:none !important; }
      #${HERO_ID}{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;margin:0 0 14px}
      .v6-analysis-main,.v6-analysis-score{background:#fff;border:1px solid #dfe7f1;border-radius:14px;box-shadow:0 3px 12px rgba(36,50,74,.06)}
      .v6-analysis-main{padding:20px 22px}
      .v6-breadcrumb{font-size:12px;color:#718097;margin-bottom:9px}
      .v6-stock-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .v6-stock-symbol{font-size:36px;font-weight:900;color:#173b73;letter-spacing:-.5px}
      .v6-stock-name{font-size:28px;font-weight:900;color:#17283f}
      .v6-market{font-size:12px;font-weight:800;color:#2563eb;background:#edf5ff;border-radius:999px;padding:5px 9px}
      .v6-status{font-size:12px;font-weight:800;color:#139b73;background:#eafaf4;border-radius:999px;padding:5px 9px}
      .v6-price-row{display:flex;align-items:baseline;gap:12px;margin-top:13px}
      .v6-price{font-size:42px;font-weight:900;color:#152b4c}
      .v6-change{font-size:18px;font-weight:900}
      .v6-asof{font-size:12px;color:#718097}
      .v6-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid #edf1f5}
      .v6-metric label{display:block;font-size:12px;color:#718097;margin-bottom:4px}.v6-metric strong{font-size:19px;color:#203655}
      .v6-analysis-score{padding:20px}
      .v6-score-label{font-size:13px;color:#718097}.v6-score{font-size:50px;line-height:1.05;font-weight:900;color:#2563eb;margin:7px 0}
      .v6-decision{font-size:17px;font-weight:900;color:#139b73;margin-bottom:13px}
      .v6-score-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid #edf1f5;padding-top:12px}
      .v6-score-grid div{display:flex;justify-content:space-between;font-size:13px;color:#63738b}.v6-score-grid strong{color:#203655}
      .v6-searchbar{display:flex;gap:10px;margin:0 0 12px}.v6-searchbar input{flex:1;min-width:0}.v6-searchbar button{white-space:nowrap}
      #page-analysis.v6-analysis .stock-tabs{background:#fff;border:1px solid #dfe7f1;border-radius:12px 12px 0 0;padding:0 8px;margin:0;border-bottom:0;overflow-x:auto;white-space:nowrap}
      #page-analysis.v6-analysis .stock-tab{font-size:14px!important;padding:14px 13px!important}
      #page-analysis.v6-analysis #analysis-tab-content{border-radius:0 0 12px 12px!important;margin-top:0!important;border-top:0!important}
      #page-analysis.v6-analysis #analysis-production-panel{border-radius:12px!important;border:1px solid #dfe7f1!important;box-shadow:0 3px 12px rgba(36,50,74,.05)!important}
      @media(max-width:1100px){#${HERO_ID}{grid-template-columns:1fr}.v6-metrics{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:700px){.v6-stock-symbol{font-size:29px}.v6-stock-name{font-size:22px}.v6-price{font-size:34px}.v6-metrics{grid-template-columns:repeat(2,1fr)}.v6-analysis-main{padding:16px}.v6-analysis-score{padding:16px}}
    `;
    document.head.appendChild(s);
  }

  async function companyName(symbol, market) {
    try {
      const r = await fetch('data/company-names.json');
      if (!r.ok) return symbol;
      const j = await r.json();
      const item = (j.companies || []).find(x => String(x.symbol) === String(symbol) && String(x.market) === String(market));
      return item?.name || symbol;
    } catch { return symbol; }
  }

  function text(id, fallback='—') { return document.querySelector(id)?.textContent?.trim() || fallback; }
  function colorFor(v) { const n=Number(String(v).replace('%','')); return Number.isFinite(n)&&n<0?'#ef4444':'#139b73'; }

  async function render() {
    const page = document.querySelector('#page-analysis');
    if (!page) return;
    addStyles();
    page.classList.add('v6-analysis');
    let hero = document.getElementById(HERO_ID);
    if (!hero) {
      hero = document.createElement('section');
      hero.id = HERO_ID;
      hero.innerHTML = `
        <div class="v6-analysis-main">
          <div class="v6-breadcrumb">首頁　&gt;　個股分析　&gt;　<span id="v6-breadcrumb-symbol">—</span></div>
          <div class="v6-stock-title"><span id="v6-symbol" class="v6-stock-symbol">—</span><span id="v6-name" class="v6-stock-name">讀取中…</span><span id="v6-market" class="v6-market">TWSE</span><span id="v6-status" class="v6-status">Production</span></div>
          <div class="v6-price-row"><span id="v6-price" class="v6-price">—</span><span id="v6-change" class="v6-change">—</span><span id="v6-asof" class="v6-asof">行情日期 —</span></div>
          <div class="v6-metrics"><div class="v6-metric"><label>開盤</label><strong id="v6-open">—</strong></div><div class="v6-metric"><label>最高</label><strong id="v6-high">—</strong></div><div class="v6-metric"><label>最低</label><strong id="v6-low">—</strong></div><div class="v6-metric"><label>成交量</label><strong id="v6-volume">—</strong></div><div class="v6-metric"><label>資料狀態</label><strong id="v6-data">—</strong></div></div>
        </div>
        <aside class="v6-analysis-score"><div class="v6-score-label">AI Production Score</div><div id="v6-score" class="v6-score">—</div><div id="v6-decision" class="v6-decision">—</div><div class="v6-score-grid"><div><span>目標價</span><strong id="v6-target">—</strong></div><div><span>風險價</span><strong id="v6-risk">—</strong></div><div><span>預期報酬</span><strong id="v6-return">—</strong></div><div><span>計算日</span><strong id="v6-calc">—</strong></div></div></aside>`;
      page.insertBefore(hero, page.firstChild);
    }
    const symbol = text('#analysis-symbol-display', text('#analysis-symbol','—')).replace(/\s.*$/,'');
    const market = text('#analysis-market-display','TWSE');
    const name = await companyName(symbol, market);
    const change = text('#analysis-change');
    document.getElementById('v6-symbol').textContent = symbol;
    document.getElementById('v6-name').textContent = name;
    document.getElementById('v6-market').textContent = market;
    document.getElementById('v6-breadcrumb-symbol').textContent = symbol;
    document.getElementById('v6-price').textContent = text('#analysis-price');
    document.getElementById('v6-change').textContent = change;
    document.getElementById('v6-change').style.color = colorFor(change);
    document.getElementById('v6-asof').textContent = text('#analysis-price-asof','行情日期 —');
    document.getElementById('v6-open').textContent = text('#analysis-open');
    document.getElementById('v6-high').textContent = text('#analysis-high');
    document.getElementById('v6-low').textContent = text('#analysis-low');
    document.getElementById('v6-volume').textContent = text('#analysis-volume');
    document.getElementById('v6-data').textContent = text('#analysis-data-state');
    document.getElementById('v6-score').textContent = text('#analysis-ai-score');
    document.getElementById('v6-decision').textContent = text('#analysis-decision');
    document.getElementById('v6-target').textContent = text('#analysis-target');
    document.getElementById('v6-risk').textContent = text('#analysis-risk');
    document.getElementById('v6-return').textContent = text('#analysis-return');
    document.getElementById('v6-calc').textContent = text('#analysis-calc-date');
  }

  function install() {
    const run = () => render().catch(() => {});
    run();
    const observer = new MutationObserver(() => { if (document.querySelector('#page-analysis')) run(); });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    document.addEventListener('click', e => { if (e.target.closest('#analysis-search,.link-stock')) setTimeout(run, 700); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();
