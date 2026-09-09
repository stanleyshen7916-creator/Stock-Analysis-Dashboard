(() => {
  const NAMES = {
    '6669':'緯穎','8046':'南電','3037':'欣興','1310':'台苯','1413':'宏洲',
    '3008':'大立光','1436':'華友聯','1309':'台達化','3189':'景碩','1312':'國喬',
    '1304':'台聚','1231':'聯華食','1435':'中福','1316':'上曜','1414':'東和',
    '1434':'福懋','2345':'智邦','1338':'廣華-KY','1256':'鮮活果汁-KY','1203':'味王',
    '1218':'泰山','00990A':'主動元大AI新經濟','3661':'世芯-KY','1325':'恆大','1210':'大成',
    '3450':'聯鈞','2356':'英業達','1337':'再生-KY','1409':'新纖','1410':'南染',
    '1305':'華夏','1342':'八貫','2376':'技嘉','2408':'南亞科','1308':'亞聚',
    '1313':'聯成','3443':'創意','1225':'福懋油','1326':'台化','1303':'南亞',
    '1339':'昭輝','2308':'台達電','1213':'好樂迪','1307':'三芳','1418':'東華',
    '1314':'中石化','1417':'嘉裕','1340':'勝悅-KY','1101':'台泥','2317':'鴻海'
  };
  const install = () => {
    const table = document.querySelector('#top50-table');
    const head = document.querySelector('#page-top50 table thead tr');
    if (!table || !head) return;
    if (!head.querySelector('[data-top50-name-column]')) {
      const th = document.createElement('th');
      th.dataset.top50NameColumn = '1';
      th.textContent = '股票名稱';
      const marketTh = [...head.children].find(x => x.textContent.trim() === '市場');
      if (marketTh) head.insertBefore(th, marketTh); else head.appendChild(th);
    }
    [...table.querySelectorAll('tr')].forEach(row => {
      const code = row.querySelector('.link-stock')?.textContent?.trim();
      if (!code || row.querySelector('[data-top50-name-cell]')) return;
      const td = document.createElement('td');
      td.dataset.top50NameCell = '1';
      td.textContent = NAMES[code] || '股票名稱待資料主檔同步';
      const marketCell = [...row.children].find(x => ['TWSE','OTC'].includes(x.textContent.trim()));
      if (marketCell) row.insertBefore(td, marketCell); else row.appendChild(td);
    });
  };
  const start = () => {
    install();
    new MutationObserver(install).observe(document.body, {childList:true, subtree:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
