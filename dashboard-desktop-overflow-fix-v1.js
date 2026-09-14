(() => {
  // Desktop overflow fix v4.
  // Keep the typography baseline, remove the legacy body zoom, constrain
  // the topbar flex items, and expose a harmless deployment marker so the
  // GitHub Pages deployment is refreshed after the UX baseline is finalized.
  // Presentation-only; no data or calculation logic.
  const install = () => {
    document.documentElement.dataset.dashboardDeploy = '20260914-ux-v4';
    document.body.style.setProperty('zoom', '1', 'important');
    const style = document.createElement('style');
    style.id = 'desktop-overflow-fix-v4';
    style.textContent = `
      html, body { overflow-x: hidden !important; }
      .topbar { min-width: 0 !important; }
      .topbar > div:first-child { min-width: 0 !important; flex: 0 1 270px !important; }
      .top-meta { min-width: 0 !important; flex: 1 1 auto !important; }
    `;
    document.head.appendChild(style);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
