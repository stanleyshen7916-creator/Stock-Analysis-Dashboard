// Dashboard bootstrap: presentation normalization runs before the ES module runtime.
// Keep index.html compatible with GitHub Pages and local static hosting.
(function installDashboardPresentationGuard() {
  const STYLE_ID = 'dashboard-presentation-v3';

  function installPresentationStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Typography baseline v3: every visible dashboard text is >= 12px. */
      body { font-size: 18px !important; }
      .brand strong { font-size: 22px !important; }
      .brand small { font-size: 13px !important; }
      .nav button { font-size: 17px !important; }
      .nav-label, .nav-sub { font-size: 16px !important; }
      .status-card { font-size: 14px !important; }
      .topbar h1 { font-size: 25px !important; }
      .topbar p { font-size: 13px !important; }
      .top-meta span, .badge { font-size: 13px !important; }
      .auth-form input, .auth-form button, #logout-btn { font-size: 13px !important; }

      .hero-title { font-size: 16px !important; }
      .hero-number { font-size: 44px !important; }
      .hero-number small { font-size: 16px !important; }
      .hero-text { font-size: 14px !important; }
      .section-head button, .panel button, .search-card button, .form-card button { font-size: 14px !important; }
      .signal-card h3 { font-size: 16px !important; }
      .signal-row { font-size: 14px !important; }
      .data-big { font-size: 40px !important; }
      .section-head h2, .page-title h2 { font-size: 22px !important; }
      .section-head p, .page-title p, .panel p { font-size: 14px !important; }
      .content-grid .wide .section-head h2 { font-size: 29px !important; }
      .horizon b { font-size: 14px !important; }
      .horizon strong { font-size: 31px !important; }
      .horizon span { font-size: 13px !important; }
      .table-wrap table { font-size: 16px !important; }
      .table-wrap th { font-size: 12px !important; }
      .table-wrap td { font-size: 16px !important; }
      .table-wrap td:nth-child(9) { font-size: 13px !important; }
      .score { font-size: 14px !important; }
      .status { font-size: 12px !important; }
      .change-item { font-size: 13px !important; }
      .side h2 { font-size: 22px !important; }
      .bottom-grid h2 { font-size: 20px !important; }
      .bottom-grid p { font-size: 13px !important; }
      .flow { font-size: 13px !important; }
      .flow span, .flow i { font-size: 12px !important; }
      .market-card h2 { font-size: 22px !important; }
      .market-items { font-size: 13px !important; }
      .market-score strong { font-size: 44px !important; }
      .market-score small { font-size: 13px !important; }
      .kpi-label { font-size: 13px !important; }
      .kpi-value { font-size: 36px !important; }
      .kpi-value.muted { font-size: 24px !important; }
      .kpi-note { font-size: 12px !important; }
      .reference-section-title { font-size: 13px !important; }
      .empty { font-size: 14px !important; }
      .form-card label { font-size: 14px !important; }
      .score-circle { font-size: 36px !important; }
      .score-circle small { font-size: 12px !important; }
      .clean { font-size: 14px !important; }
      .score-total { font-size: 66px !important; }
      .score-total span { font-size: 17px !important; }
      .weight-row { font-size: 13px !important; }
      .audit { font-size: 13px !important; }
      .status-line { font-size: 14px !important; }
      .analysis-grid table { font-size: 14px !important; }
      .analysis-grid table th, .analysis-grid table td { font-size: 14px !important; }

      /* Rebalance the existing reference layout for the larger type scale. */
      .main { padding: 14px 18px 32px !important; }
      .topbar { gap: 16px !important; }
      .topbar > div:first-child { min-width: 290px !important; }
      .top-meta { gap: 8px !important; }
      .auth-form { gap: 7px !important; }
      .kpi-strip { gap: 9px !important; }
      .kpi { padding: 13px 14px !important; min-height: 104px !important; }
      .dashboard-overview, .content-grid { gap: 11px !important; }
      .dashboard-overview { grid-template-columns: minmax(0, 1fr) 350px !important; }
      .content-grid { grid-template-columns: minmax(0, 1fr) 350px !important; }
      .horizon-grid { gap: 8px !important; }
      .horizon { padding: 10px 11px !important; min-height: 98px !important; }
      .market-card { padding: 14px !important; }
      .content-grid .panel { padding: 13px !important; }
      .table-wrap th, .table-wrap td { padding: 9px 8px !important; }
      .bottom-grid { gap: 11px !important; margin-top: 11px !important; }
      .bottom-grid .panel { min-height: 165px !important; }
      .form-card { padding: 14px !important; gap: 12px !important; }

      @media (max-width: 1250px) {
        .kpi-strip { grid-template-columns: repeat(4, 1fr) !important; }
        .dashboard-overview, .content-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 800px) {
        html, body { overflow-x: hidden !important; }
        .main { padding: 12px !important; }
        .topbar > div:first-child { min-width: 0 !important; }
        .kpi-strip { grid-template-columns: repeat(2, 1fr) !important; gap: 9px !important; }
        .kpi { min-height: 98px !important; }
        .horizon-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .horizon { min-height: 94px !important; }
        .bottom-grid { grid-template-columns: 1fr !important; }
        .topbar { display: block !important; }
        .top-meta { justify-content: flex-start !important; margin-top: 9px !important; }
        .table-wrap { max-width: 100% !important; overflow-x: auto !important; }
      }
      @media (max-width: 520px) {
        .kpi-strip, .horizon-grid { grid-template-columns: 1fr !important; }
        .nav { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // app.js is loaded after the reference <style>, so append immediately and
  // make the presentation contract active before app-runtime renders data.
  installPresentationStyles();
})();

import('./app-runtime.js').catch((err) => {
  console.error('Dashboard runtime failed to start:', err);
});
