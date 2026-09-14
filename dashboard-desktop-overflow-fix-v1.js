(() => {
  // Desktop overflow fix v3.
  // Keep the typography baseline, remove the legacy body zoom, and constrain
  // the topbar flex items so their intrinsic width cannot expand the document.
  // Presentation-only; no data or calculation logic.
  const install = () => {
    document.body.style.setProperty('zoom', '1', 'important');
    const style = document.createElement('style');
    style.id = 'desktop-overflow-fix-v3';
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
