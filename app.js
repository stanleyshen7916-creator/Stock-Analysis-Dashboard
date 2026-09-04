// Dashboard bootstrap: typography/layout normalization runs before the ES module runtime.
// Keep index.html compatible with GitHub Pages and local static hosting.
(function installDashboardPresentationGuard() {
  const STYLE_ID = 'dashboard-presentation-v2';
  const SCALE = 1.10;
  const MIN_FONT_PX = 10;

  function installLayoutStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Typography: never render dashboard text below 10px. */
      body, button, input, select, textarea { min-font-size: 10px; }

      /* Rebalance the existing reference layout for the larger type scale. */
      .main { padding: 12px 16px 26px !important; }
      .topbar { gap: 12px !important; }
      .topbar > div:first-child { min-width: 250px !important; }
      .top-meta { gap: 7px !important; }
      .kpi-strip { gap: 8px !important; }
      .kpi { padding: 11px 12px !important; min-height: 90px !important; }
      .dashboard-overview, .content-grid { gap: 10px !important; }
      .dashboard-overview { grid-template-columns: minmax(0, 1fr) 340px !important; }
      .content-grid { grid-template-columns: minmax(0, 1fr) 340px !important; }
      .horizon-grid { gap: 7px !important; }
      .horizon { padding: 9px 10px !important; min-height: 86px !important; }
      .market-card { padding: 13px !important; }
      .content-grid .panel { padding: 12px !important; }
      .bottom-grid { gap: 10px !important; margin-top: 10px !important; }
      .bottom-grid .panel { min-height: 138px !important; }

      @media (max-width: 1250px) {
        .dashboard-overview, .content-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 800px) {
        .main { padding: 10px !important; }
        .kpi-strip { gap: 8px !important; }
        .kpi { min-height: 88px !important; }
        .horizon { min-height: 84px !important; }
        .top-meta { gap: 6px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function scaleText(root = document) {
    const elements = Array.from(root.querySelectorAll('*'));
    const targets = elements.filter((el) => {
      const tag = el.tagName;
      if (!['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag) && !el.textContent.trim()) return false;
      if (el.dataset.dashboardTypographyScaled === '1') return false;
      return true;
    });

    const measurements = targets.map((el) => {
      const px = parseFloat(getComputedStyle(el).fontSize);
      return [el, Number.isFinite(px) ? px : 14];
    });

    measurements.forEach(([el, px]) => {
      const scaled = Math.max(MIN_FONT_PX, Math.round(px * SCALE * 10) / 10);
      el.style.setProperty('font-size', `${scaled}px`, 'important');
      el.dataset.dashboardTypographyScaled = '1';
    });
  }

  function start() {
    installLayoutStyles();
    scaleText();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scaleText(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

import('./app-runtime.js').catch((err) => {
  console.error('Dashboard runtime failed to start:', err);
});