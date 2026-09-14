(() => {
  // The Dashboard typography baseline intentionally increases readable text size.
  // index.html previously added a 1.3333 body zoom on top of that baseline,
  // which expands the CSS viewport and causes false/real horizontal overflow
  // on the 1280px Desktop QA viewport. Keep the typography baseline and remove
  // only the duplicate page zoom. This is presentation-only; no data or logic changes.
  const install = () => {
    document.body.style.zoom = '1';
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
