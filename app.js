// Classic-script bootstrap for the ES module runtime.
// Keep index.html compatible with GitHub Pages and local static hosting.
import('./app-runtime.js').catch((err) => {
  console.error('Dashboard runtime failed to start:', err);
});
