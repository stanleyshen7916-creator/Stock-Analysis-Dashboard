(() => {
  const AHS = window.StockDashboard = {};
  const stocks = [
    ['2330','台積電','中長期','92','1,035','1,200–1,280','+20.6%','AI需求與趨勢結構強','強烈觀察'],
    ['2454','聯發科','短中期','89','1,295','1,450–1,520','+17.4%','旗艦產品週期','強烈觀察'],
    ['3711','日月光投控','中期','87','175','195–210','+18.3%','封測需求回溫','值得觀察'],
    ['6505','台塑化','中長期','86','108','120–128','+16.7%','油價循環低檔反彈','值得觀察'],
    ['2382','廣達','短中期','86','289','320–345','+19.4%','AI伺服器需求','值得觀察'],
    ['3231','緯創','短期','85','132','145–155','+17.4%','量價突破','觀察'],
    ['2882','國泰金','中長期','84','72.8','80–85','+14.5%','金融股評價修復','觀察'],
    ['3008','大立光','中期','84','2,620','2,850–3,050','+16.4%','高階鏡頭需求','觀察'],
    ['2317','鴻海','短中期','83','172','185–198','+15.1%','電動車／AI布局','觀察'],
    ['2458','義隆','短期','83','122','135–142','+16.4%','NB晶片回溫','觀察']
  ];
  const changes = [['2330','台積電','88 → 92','升級','AI需求強、目標上修'],['3711','日月光投控','86 → 87','升級','封測需求改善'],['2882','國泰金','83 → 84','維持','金融股評價穩定'],['2454','聯發科','91 → 89','降級','短線估值壓力增加'],['2303','聯電','82 → 78','降級','產業景氣仍弱']];
  const horizons = {intraday:'當沖（0–1日）',short:'短期（2週內）',shortmid:'短中期（3–6個月）',mid:'中期（6–12個月）',midlong:'中長期（12–36個月）',long:'長期（36個月以上）'};
  const pageNames = {strategy:'策略／參數',market:'市場分析',industry:'產業分析',backtest:'回測驗證',data:'資料中心',reports:'報告中心',settings:'系統設定'};

  function renderStocks(){
    const el=document.querySelector('#stock-table'); if(!el)return;
    el.innerHTML=stocks.map((s,i)=>`<tr><td>${i+1}</td><td><button class="link-stock" data-symbol="${s[0]}">${s[0]}</button></td><td>${s[1]}</td><td>${s[2]}</td><td><span class="score">${s[3]}</span></td><td>${s[4]}</td><td>${s[5]}</td><td>${s[6]}</td><td>${s[7]}</td><td><span class="status">${s[8]}</span></td></tr>`).join('');
  }
  function renderChanges(){
    const el=document.querySelector('#changes'); if(!el)return;
    el.innerHTML=changes.map(c=>`<div class="change-item"><b class="${c[3]==='升級'?'change-up':'change-down'}">${c[0]}</b><span>${c[1]}<br><small>${c[2]} · ${c[4]}</small></span><strong>${c[3]}</strong></div>`).join('');
  }
  function showPage(page){
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page'));
    const target=document.querySelector(`#page-${page}`) || document.querySelector('#page-generic');
    target.classList.add('active-page');
    if(target.id==='page-generic'){
      document.querySelector('#generic-title').textContent=pageNames[page] || '功能';
      document.querySelector('#generic-desc').textContent='此功能已建立 UX 入口，下一階段由資料層與分析引擎載入實際結果。';
    }
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function showHorizon(h){
    document.querySelectorAll('.nav-sub').forEach(b=>b.classList.toggle('active-sub',b.dataset.horizon===h));
    const title=document.querySelector('.section-head h2');
    if(title) title.textContent=`AI ${horizons[h]}觀察清單`;
    document.querySelectorAll('.horizon').forEach(b=>b.classList.toggle('selected',b.dataset.horizon===h));
  }
  document.addEventListener('click',e=>{
    const pageBtn=e.target.closest('[data-page]');
    if(pageBtn){showPage(pageBtn.dataset.page);return;}
    const horizon=e.target.closest('[data-horizon]');
    if(horizon){showPage('dashboard');showHorizon(horizon.dataset.horizon);return;}
    const stock=e.target.closest('.link-stock');
    if(stock){showPage('analysis');document.querySelector('#analysis-search').value=stock.dataset.symbol;}
  });
  document.querySelector('#add-portfolio')?.addEventListener('click',()=>{
    const input=document.querySelector('#portfolio-input'); const list=document.querySelector('#portfolio-list');
    if(input.value.trim()) list.innerHTML=`<div class="change-item"><b>${input.value.trim()}</b><span>持股已加入研究清單<br><small>下一階段由資料層帶入即時價格與損益</small></span><strong>已建立</strong></div>`;
  });
  renderStocks();renderChanges();AHS.showPage=showPage;AHS.horizons=horizons;
})();
