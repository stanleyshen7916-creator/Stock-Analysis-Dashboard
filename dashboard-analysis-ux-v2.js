// Individual-stock analysis UX v2.
// Presentation-only: never changes Production values or calculation logic.
(() => {
  const STYLE_ID = 'analysis-ux-v2-style';
  const LABELS = new Map([
    ['Production 分析結果', '正式分析結果'],
    ['Production calculation version', '正式計算版本'],
    ['目前正式模型分數', '目前正式模型分數'],
    ['Fundamental', '基本面'],
    ['Technical', '技術面'],
    ['Chip', '籌碼面'],
    ['AI Score', 'AI 綜合評分'],
    ['Recommendation Reason', '分析判斷依據'],
    ['Source:', '資料來源：'],
    ['Data as of:', '資料截至：'],
    ['Production calculation version:', '正式計算版本：'],
    ['資料狀態', '資料狀態'],
    ['最新行情', '最新行情'],
    ['基本面', '基本面資料'],
    ['行情筆數', '行情資料量'],
    ['證據強度', '證據強度'],
    ['目前資料缺口', '資料完整性'],
    ['適合週期', '適合投資週期'],
    ['預期報酬', '預期報酬'],
    ['參考價', '參考價'],
    ['目標價', '目標價'],
    ['風險價', '風險價'],
    ['決策', '分析結論'],
    ['Technical Indicators', '技術指標'],
    ['Recommendation', '分析建議']
  ]);

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #analysis-production-panel{margin-top:14px!important;border:1px solid #dce5f0!important;border-radius:14px!important;background:#fff!important;box-shadow:0 5px 18px rgba(28,53,87,.06)!important;overflow:hidden}
      #analysis-production-panel>h3{margin:0!important;padding:16px 20px!important;font-size:19px!important;font-weight:800!important;color:#17345f!important;border-bottom:1px solid #e7edf5!important;background:linear-gradient(90deg,#f5f9ff,#fff)!important}
      #analysis-production-panel>.stock-panel-sub{margin:0!important;padding:10px 20px!important;font-size:12px!important;color:#6b7c93!important;background:#fbfcfe!important;border-bottom:1px solid #eef2f7!important}
      #analysis-production-panel .stock-grid-main{display:grid!important;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)!important;gap:16px!important;margin:0!important;padding:16px 20px!important}
      #analysis-production-panel .stock-grid-main>div{min-width:0!important}
      #analysis-production-panel .stock-grid-main>div:first-child{border:1px solid #e2e9f2!important;border-radius:12px!important;padding:6px 12px!important;background:#fcfdff!important}
      #analysis-production-panel .stock-grid-main>div:nth-child(2){border:1px solid #dce8f7!important;border-radius:12px!important;padding:6px 12px!important;background:linear-gradient(180deg,#f8fbff,#fff)!important}
      #analysis-production-panel .stock-table{width:100%!important;border-collapse:separate!important;border-spacing:0!important}
      #analysis-production-panel .stock-table tr{border-bottom:1px solid #edf1f6!important}
      #analysis-production-panel .stock-table th{width:42%!important;text-align:left!important;padding:10px 8px!important;color:#667892!important;font-weight:700!important;font-size:13px!important}
      #analysis-production-panel .stock-table td{text-align:right!important;padding:10px 8px!important;color:#18365f!important;font-weight:800!important;font-size:14px!important}
      #analysis-production-panel .stock-grid-main>div:first-child .stock-table tr:nth-child(4) td{color:#ef4444!important;font-size:16px!important}
      #analysis-production-panel .stock-grid-main>div:first-child .stock-table tr:nth-child(5) td{color:#10a56f!important;font-size:16px!important}
      #analysis-production-panel .stock-grid-main>div:first-child .stock-table tr:nth-child(6) td{color:#0b9a91!important}
      #analysis-production-panel .stock-grid-main>div:nth-child(2) h3{padding:8px 8px 10px!important;margin:0!important;color:#173f72!important;font-size:15px!important}
      #analysis-production-panel .stock-grid-main>div:nth-child(2) .stock-table th{width:48%!important}
      #analysis-production-panel .stock-grid-main>div:nth-child(2) .stock-table tr:nth-child(2) td{color:#0b8eea!important}
      #analysis-production-panel .stock-grid-main>div:nth-child(2) .stock-table tr:nth-child(3) td{color:#7351d4!important}
      #analysis-production-panel .stock-grid-secondary{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;padding:0 20px 16px!important;margin:0!important}
      #analysis-production-panel .stock-grid-secondary .stock-panel{margin:0!important;min-height:92px!important;border:1px solid #e2e9f2!important;border-radius:11px!important;padding:12px 13px!important;background:#fff!important}
      #analysis-production-panel .stock-grid-secondary .stock-panel h3{margin:0 0 7px!important;font-size:13px!important;color:#385779!important}
      #analysis-production-panel .stock-grid-secondary .stock-empty{font-size:12px!important;line-height:1.7!important;color:#4e6380!important}
      #analysis-production-panel>div[style*="margin-top:12px"]{margin:0 20px 12px!important;padding:12px 14px!important;border:1px solid #f0dca8!important;border-radius:10px!important;background:#fff9e9!important}
      #analysis-production-panel>div[style*="margin-top:12px"] h3{margin:0 0 7px!important;font-size:14px!important;color:#9a6a00!important}
      #analysis-production-panel>div[style*="margin-top:8px"]{margin:0 20px 14px!important;padding:12px 14px!important;border-left:4px solid #2563eb!important;border-radius:8px!important;background:#f3f8ff!important}
      #analysis-production-panel>div[style*="margin-top:8px"] h3{margin:0 0 6px!important;font-size:14px!important;color:#24508b!important}
      #analysis-production-panel .stock-footer-note{padding:10px 20px!important;border-top:1px solid #eef2f7!important;background:#fafcff!important;color:#7a8aa0!important;font-size:10px!important}
      @media(max-width:900px){#analysis-production-panel .stock-grid-main{grid-template-columns:1fr!important}.stock-grid-secondary{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:560px){#analysis-production-panel .stock-grid-secondary{grid-template-columns:1fr!important}#analysis-production-panel>h3{font-size:16px!important;padding:13px 14px!important}#analysis-production-panel .stock-grid-main{padding:12px!important}#analysis-production-panel .stock-grid-secondary{padding:0 12px 12px!important}}
    `;
    document.head.appendChild(style);
  }

  function translateText(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const value = node.nodeValue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (LABELS.has(trimmed)) node.nodeValue = value.replace(trimmed, LABELS.get(trimmed));
      else if (/^Source:\s*/.test(trimmed)) node.nodeValue = value.replace(/^Source:\s*/, '資料來源：');
      else if (/^Data as of:\s*/.test(trimmed)) node.nodeValue = value.replace(/^Data as of:\s*/, '資料截至：');
      else if (/^Production calculation version:\s*/.test(trimmed)) node.nodeValue = value.replace(/^Production calculation version:\s*/, '正式計算版本：');
    }
  }

  function stylePriceRows() {
    const panel = document.querySelector('#analysis-production-panel');
    if (!panel) return;
    const rows = panel.querySelectorAll('.stock-grid-main>div:first-child .stock-table tr');
    rows.forEach((row) => {
      const label = row.querySelector('th')?.textContent?.trim();
      const value = row.querySelector('td');
      if (!value) return;
      value.classList.remove('ux-target-price','ux-risk-price');
      if (label === '目標價') value.classList.add('ux-target-price');
      if (label === '風險價') value.classList.add('ux-risk-price');
    });
  }

  function emphasizeTechnical() {
    const panel = document.querySelector('#analysis-production-panel');
    if (!panel) return;
    const rows = [...panel.querySelectorAll('.stock-grid-main>div:nth-child(2) .stock-table tr')];
    const row = rows.find((r) => ['技術面','Technical'].includes(r.querySelector('th')?.textContent?.trim()));
    if (row) row.classList.add('ux-technical-factor');
  }

  function run() {
    addStyle();
    translateText();
    stylePriceRows();
    emphasizeTechnical();
  }

  const observer = new MutationObserver(() => run());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true }); else run();
  observer.observe(document.documentElement, { childList:true, subtree:true });
  setTimeout(() => observer.disconnect(), 15000);
})();
