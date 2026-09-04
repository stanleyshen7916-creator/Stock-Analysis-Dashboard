// Dashboard bootstrap: presentation normalization runs before the ES module runtime.
// Keep index.html compatible with GitHub Pages and local static hosting.
(function installDashboardPresentationGuard() {
  const STYLE_ID = 'dashboard-presentation-v2';

  function installPresentationStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Typography baseline: all visible dashboard text is >= 10px. */
      body { font-size: 15px !important; }
      .brand strong { font-size: 18px !important; }
      .brand small { font-size: 11px !important; }
      .nav button { font-size: 14px !important; }
      .nav-label, .nav-sub { font-size: 13px !important; }
      .status-card { font-size: 12px !important; }
      .topbar h1 { font-size: 21px !important; }
      .topbar p { font-size: 11px !important; }
      .top-meta span, .badge { font-size: 11px !important; }
      .auth-form input, .auth-form button, #logout-btn { font-size: 11px !important; }

      .hero-title { font-size: 13px !important; }
      .hero-number { font-size: 37px !important; }
      .hero-number small { font-size: 13px !important; }
      .hero-text { font-size: 12px !important; }
      .section-head button, .panel button, .search-card button, .form-card button { font-size: 12px !important; }
      .signal-card h3 { font-size: 13px !important; }
      .signal-row { font-size: 12px !important; }
      .data-big { font-size: 33px !important; }
      .section-head h2, .page-title h2 { font-size: 18px !important; }
      .section-head p, .page-title p, .panel p { font-size: 12px !important; }
      .content-grid .wide .section-head h2 { font-size: 24px !important; }
      .horizon b { font-size: 12px !important; }
      .horizon strong { font-size: 26px !important; }
      .horizon span { font-size: 11px !important; }
      .table-wrap table { font-size: 13px !important; }
      .table-wrap th { font-size: 10px !important; }
      .table-wrap td { font-size: 13px !important; }
      .table-wrap td:nth-child(9) { font-size: 11px !important; }
      .score { font-size: 12px !important; }
      .status { font-size: 10px !important; }
      .change-item { font-size: 11px !important; }
      .side h2 { font-size: 18px !important; }
      .bottom-grid h2 { font-size: 17px !important; }
      .bottom-grid p { font-size: 11px !important; }
      .flow { font-size: 11px !important; }
      .flow span, .flow i { font-size: 10px !important; }
      .market-card h2 { font-size: 18px !important; }
      .market-items { font-size: 11px !important; }
      .market-score strong { font-size: 37px !important; }
      .market-score small { font-size: 11px !important; }
      .kpi-label { font-size: 11px !important; }
      .kpi-value { font-size: 30px !important; }
      .kpi-value.muted { font-size: 20px !important; }
      .kpi-note { font-size: 10px !important; }
      .reference-section-title { font-size: 11px !important; }
      .empty { font-size: 12px !important; }
      .form-card label { font-size: 12px !important; }
      .score-circle { font-size: 30px !important; }
      .score-circle small { font-size: 10px !important; }
      .clean { font-size: 12px !important; }
      .score-total { font-size: 55px !important; }
      .score-total span { font-size: 14px !important; }
      .weight-row { font-size: 11px !important; }
      .audit { font-size: 11px !important; }
      .status-line { font-size: 12px !important; }
      .analysis-grid table { font-size: 12px !important; }

      /* Rebalance the existing reference layout for the larger type scale. */
      .main { padding: 12px 16px 26px !important; }
      .topbar { gap: 12px !important; }
      .topbar > div:first-child { min-width: 250px !important; }
      .top-meta { gap: 7px !important; }
      .auth-form { gap: 6px !important; }
      .kpi-strip { gap: 8px !important; }
      .kpi { padding: 11px 12px !important; min-height: 92px !important; }
      .dashboard-overview, .content-grid { gap: 10px !important; }
      .dashboard-overview { grid-template-columns: minmax(0, 1fr) 340px !important; }
      .content-grid { grid-template-columns: minmax(0, 1fr) 340px !important; }
      .horizon-grid { gap: 7px !important; }
      .horizon { padding: 9px 10px !important; min-height: 88px !important; }
      .market-card { padding: 13px !important; }
      .content-grid .panel { padding: 12px !important; }
      .table-wrap th, .table-wrap td { padding: 8px 7px !important; }
      .bottom-grid { gap: 10px !important; margin-top: 10px !important; }
      .bottom-grid .panel { min-height: 142px !important; }

      @media (max-width: 1250px) {
        .kpi-strip { grid-template-columns: repeat(4, 1fr) !important; }
        .dashboard-overview, .content-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 800px) {
        .main { padding: 10px !important; }
        .kpi-strip { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
        .kpi { min-height: 90px !important; }
        .horizon-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .horizon { min-height: 86px !important; }
        .bottom-grid { grid-template-columns: 1fr !important; }
        .topbar { display: block !important; }
        .top-meta { justify-content: flex-start !important; margin-top: 8px !important; }
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
