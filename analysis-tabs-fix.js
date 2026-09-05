/* Final integration guard for the individual-stock analysis page. */
(function () {
  'use strict';
  function install() {
    const page = document.querySelector('#page-analysis');
    if (!page) return false;
    if (!document.getElementById('analysis-tabs-integration-fix')) {
      const style = document.createElement('style');
      style.id = 'analysis-tabs-integration-fix';
      style.textContent = `
        #page-analysis .stock-analysis-page > .stock-grid-main,
        #page-analysis .stock-analysis-page > .stock-grid-secondary,
        #page-analysis .stock-analysis-page > .stock-panel:not(#analysis-tab-content){display:none!important}
        #analysis-tab-content{display:block!important}
        #analysis-tab-content section{min-width:0}
        #analysis-tab-content h3{font-size:18px;margin:0 0 10px;color:#17283f}
        #analysis-tab-content .analysis-tab-grid{display:grid;gap:12px;margin-bottom:12px}
        #analysis-tab-content .analysis-tab-grid.two{grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr)}
        #analysis-tab-content .analysis-tab-grid>section{background:#fff;border:1px solid #dfe7f1;border-radius:10px;padding:14px 16px}
        #analysis-tab-content .analysis-chart{height:300px;background:linear-gradient(to bottom,transparent 24.5%,#edf2f7 25%,transparent 25.5%,transparent 49.5%,#edf2f7 50%,transparent 50.5%,transparent 74.5%,#edf2f7 75%,transparent 75.5%);border-radius:6px;overflow:hidden}
        #analysis-tab-content .analysis-chart svg{width:100%;height:100%;display:block}
        #analysis-tab-content .wide-table{min-width:720px}
        @media(max-width:800px){#analysis-tab-content .analysis-tab-grid.two{grid-template-columns:1fr!important}#analysis-tab-content .analysis-chart{height:250px}#analysis-tab-content .stock-table-wrap{overflow-x:auto;max-width:100%}}
      `;
      document.head.appendChild(style);
    }
    const tabs = [...page.querySelectorAll('.stock-tab')];
    tabs.forEach((tab, i) => {
      tab.type = 'button';
      tab.setAttribute('aria-controls', 'analysis-tab-content');
      tab.onclick = (event) => {
        event.preventDefault();
        tabs.forEach((t, j) => t.classList.toggle('active', i === j));
        const names=['overview','technical','fundamental','chips','financial','industry','wave','engine','history','prediction','news'];
        window.StockAnalysisTabsV2?.setTab(names[i]);
      };
    });
    return true;
  }
  function boot() { if (!install()) setTimeout(boot, 400); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
