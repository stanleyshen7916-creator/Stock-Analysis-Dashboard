(() => {
  // Desktop overflow fix v5.
  // Keep the approved light UX baseline, remove the legacy body zoom,
  // constrain the topbar flex items, and expose a deployment marker so
  // GitHub Pages can be verified against the current main branch.
  // Presentation-only; no data or calculation logic.
  const install = () => {
    document.documentElement.dataset.dashboardDeploy = '20260914-ux-v5';
    document.documentElement.dataset.dashboardUx = 'reference-v3';
    document.body.style.setProperty('zoom', '1', 'important');
    const style = document.createElement('style');
    style.id = 'desktop-overflow-fix-v5';
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
