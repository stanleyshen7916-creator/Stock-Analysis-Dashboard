(() => {
  // The Dashboard typography baseline intentionally increases readable text size.
  // index.html previously added a 1.3333 body zoom on top of that baseline,
  // which expands the CSS viewport and causes horizontal overflow on the
  // 1280px Desktop QA viewport. The CSS declaration is !important, so the
  // runtime override must also be important. Presentation-only; no data logic.
  const install = () => {
    document.body.style.setProperty('zoom', '1', 'important');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
