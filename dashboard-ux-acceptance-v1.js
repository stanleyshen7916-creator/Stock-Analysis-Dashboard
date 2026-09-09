// Dashboard UX acceptance patch v1.
// Presentation-only: no data source, calculation, recommendation, Supabase schema,
// or Analysis Repo contract is changed here.
(() => {
  const STYLE_ID = 'dashboard-ux-acceptance-v1';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Project Owner acceptance: enlarge AI TOP 10 table content. */
      #page-dashboard #stock-table{font-size:18px!important}
      #page-dashboard #stock-table th{font-size:14px!important;padding:10px 9px!important}
      #page-dashboard #stock-table td{font-size:17px!important;padding:10px 9px!important;line-height:1.45!important}
      #page-dashboard #stock-table td:nth-child(9){font-size:15px!important;line-height:1.5!important}
      #page-dashboard #stock-table .score{font-size:16px!important;min-width:34px!important;padding:4px 7px!important}
      #page-dashboard #stock-table .status{font-size:14px!important;padding:4px 8px!important}

      /* Explicit missing-data state for technical/fundamental cards. */
      #page-analysis .ux-data-state-note{
        margin-top:10px;padding:10px 12px;border-radius:8px;
        background:#fff8e8;border:1px solid #f3dfad;color:#7a5b16;
        font-size:13px!important;line-height:1.6;
      }
      #page-analysis .ux-data-state-note strong{display:block;margin-bottom:3px;color:#9a6b00;font-size:14px!important}
      #page-analysis .ux-data-state-badge{
        display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;
        background:#fff1cc;color:#9a6b00;font-size:12px!important;font-weight:700;
      }
      @media(max-width:800px){
        #page-dashboard #stock-table{font-size:16px!important}
        #page-dashboard #stock-table th{font-size:13px!important}
        #page-dashboard #stock-table td{font-size:15px!important}
        #page-dashboard #stock-table td:nth-child(9){font-size:14px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function addStateNote(host, kind) {
    if (!host || host.querySelector('.ux-data-state-note')) return;
    const note = document.createElement('div');
    note.className = 'ux-data-state-note';
    const copy = kind === 'technical'
      ? '目前尚無可驗證的技術指標數值。技術指標由 Production Analysis Engine 提供；Dashboard 不自行推算。待 Production 技術指標資料完成驗證後，這裡才會顯示數值。'
      : '目前部分基本面衍生指標尚無可驗證數值。原始資料來源為 MOPS；待最新財報同步、欄位解析與計算驗證完成後再顯示數值。';
    note.innerHTML = `<strong>資料狀態說明 <span class="ux-data-state-badge">待補齊／待驗證</span></strong>${copy}`;
    host.appendChild(note);
  }

  async function ensureOverviewChart() {
    const root = document.querySelector('#analysis-tab-content');
    if (!root || root.dataset.tab && root.dataset.tab !== 'overview') return;
    if (root.querySelector('svg')) return;

    const input = document.querySelector('#analysis-symbol');
    const symbol = String(input?.value || document.querySelector('#analysis-symbol-display')?.textContent || '').trim().toUpperCase().split(/\s+/)[0];
    const market = String(document.querySelector('#analysis-market-display')?.textContent || 'TWSE').trim() || 'TWSE';
    if (!symbol || !window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) return;

    try {
      const params = new URLSearchParams({
        symbol: `eq.${symbol}`,
        market: `eq.${market}`,
        order: 'trading_date.desc',
        limit: '60'
      });
      const response = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/market_daily?${params.toString()}`, {
        headers: { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}` }
      });
      if (!response.ok) return;
      const rows = (await response.json()).reverse().filter((r) => [r.open, r.high, r.low, r.close].every((v) => Number.isFinite(Number(v))));
      if (!rows.length || root.querySelector('svg')) return;

      const width = 900;
      const height = 300;
      const pad = 28;
      let low = Infinity;
      let high = -Infinity;
      rows.forEach((r) => { low = Math.min(low, Number(r.low)); high = Math.max(high, Number(r.high)); });
      const range = high - low || 1;
      const y = (value) => height - pad - (Number(value) - low) / range * (height - 2 * pad);
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-label', '日線 K 線');

      rows.forEach((r, i) => {
        const x = pad + i / Math.max(rows.length - 1, 1) * (width - 2 * pad);
        const open = y(r.open);
        const close = y(r.close);
        const wickHigh = y(r.high);
        const wickLow = y(r.low);
        const up = Number(r.close) >= Number(r.open);
        const stroke = up ? '#13a878' : '#ef4444';
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', x); line.setAttribute('x2', x);
        line.setAttribute('y1', wickHigh); line.setAttribute('y2', wickLow);
        line.setAttribute('stroke', stroke); line.setAttribute('stroke-width', '1.5');
        svg.appendChild(line);
        const body = document.createElementNS(ns, 'rect');
        const bodyWidth = Math.max(3, Math.min(10, (width - 2 * pad) / rows.length * 0.65));
        body.setAttribute('x', x - bodyWidth / 2);
        body.setAttribute('y', Math.min(open, close));
        body.setAttribute('width', bodyWidth);
        body.setAttribute('height', Math.max(2, Math.abs(open - close)));
        body.setAttribute('fill', stroke);
        svg.appendChild(body);
      });

      const host = root.querySelector('.analysis-chart');
      if (host) {
        host.replaceChildren(svg);
      } else {
        const section = Array.from(root.querySelectorAll('section')).find((node) => /K 線走勢/.test(node.textContent || ''));
        if (section) {
          const chartHost = document.createElement('div');
          chartHost.className = 'analysis-chart';
          chartHost.appendChild(svg);
          section.appendChild(chartHost);
        }
      }
    } catch (_) {
      // Keep the existing honest unavailable state when Production data cannot be read.
    }
  }

  function refresh() {
    const page = document.querySelector('#page-analysis');
    if (!page) return;

    const technical = page.querySelector('#analysis-technical');
    if (technical && /資料不足|待驗證/.test(technical.textContent || '')) {
      addStateNote(technical, 'technical');
    }

    const fundamentals = page.querySelector('#analysis-fundamentals');
    if (fundamentals && /資料不足/.test(fundamentals.textContent || '')) {
      addStateNote(fundamentals, 'fundamental');
    }

    ensureOverviewChart();
  }

  function install() {
    installStyles();
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(refresh, 300);
    setTimeout(refresh, 1000);
    setTimeout(refresh, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
