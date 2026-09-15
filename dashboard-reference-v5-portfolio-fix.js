// Preserve the existing Portfolio controls while applying the v5 visual shell.
(() => {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(){
    const p=document.querySelector('#page-portfolio');
    if(!p||p.querySelector('#portfolio-add'))return;
    p.dataset.portfolioV5='1';
    p.innerHTML=`<div class="v5-page"><div class="v5-page-title"><div><h2>我的持股 Portfolio</h2><p>管理持股與成本，並與 AI 觀察清單交叉檢視。</p></div><span class="v5-tag">Personal Workspace</span></div><section class="v5-card"><h3>新增持股</h3><div class="form-card" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px"><label>代號<input id="portfolio-symbol" placeholder="例如 2330"></label><label>名稱<input id="portfolio-name" placeholder="例如 台積電"></label><label>股數<input id="portfolio-shares" type="number" min="0"></label><label>成本<input id="portfolio-cost" type="number" min="0" step="0.01"></label><button id="portfolio-add" class="primary">新增持股</button></div></section><section class="v5-card"><h3>目前持股</h3><div class="table-wrap"><table class="v5-table"><thead><tr><th>代號</th><th>名稱</th><th>股數</th><th>成本</th></tr></thead><tbody id="portfolio-table"><tr><td colspan="4">讀取中…</td></tr></tbody></table></div></section></div>`;
    bind();
  }
  function bind(){const add=document.querySelector('#portfolio-add');if(!add)return;const load=()=>{let r=[];try{r=JSON.parse(localStorage.getItem('sad_portfolio_v1')||'[]')}catch{};const t=document.querySelector('#portfolio-table');if(t)t.innerHTML=r.length?r.map(v=>`<tr><td>${esc(v.symbol)}</td><td>${esc(v.name)}</td><td>${esc(v.shares)}</td><td>${esc(v.cost)}</td></tr>`).join(''):'<tr><td colspan="4">尚未建立持股；這是正常空資料狀態。</td></tr>';};add.onclick=()=>{const symbol=document.querySelector('#portfolio-symbol')?.value.trim().toUpperCase();if(!symbol)return;let r=[];try{r=JSON.parse(localStorage.getItem('sad_portfolio_v1')||'[]')}catch{};r.push({symbol,name:document.querySelector('#portfolio-name')?.value.trim()||'',shares:Number(document.querySelector('#portfolio-shares')?.value||0),cost:Number(document.querySelector('#portfolio-cost')?.value||0)});localStorage.setItem('sad_portfolio_v1',JSON.stringify(r));load();};load();}
  function start(){render();new MutationObserver(render).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
