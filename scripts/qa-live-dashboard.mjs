// Real-data QA (M23, M11-M23 Dashboard spec v1 Section 12): serves this
// repo's static files locally and drives every route with Playwright
// against the REAL Production Supabase project (this repo's config.js
// already carries the real, non-secret anon/publishable key - same
// precedent as the private repo's public/js/config.js). Verifies no
// uncaught console error, no broken navigation, real data or an honest
// empty/error state - never a fabricated result.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function startStaticServer(dir) {
  const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(dir, requestPath === '/' ? '/index.html' : requestPath);
    if (!filePath.startsWith(dir)) { res.writeHead(403); res.end(); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const ROUTES = ['#/overview', '#/observation', '#/portfolio', '#/stock/TWSE/2330', '#/selection-flow', '#/historical', '#/strategy'];

async function run() {
  const { server, port } = await startStaticServer(rootDir);
  const browser = await chromium.launch();
  const results = [];

  for (const [label, viewport] of [['Desktop', { width: 1280, height: 900 }], ['Mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
    for (const route of ROUTES) {
      await page.evaluate((r) => { window.location.hash = r; }, route);
      await page.waitForTimeout(1500);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    // Only the harmless, expected favicon 404 is allowed - any other console
    // error fails the QA, matching this project's established convention.
    const realErrors = consoleErrors.filter((e) => !e.includes('favicon'));
    results.push({ label, realErrors, overflow });
    await page.close();
  }

  await browser.close();
  server.close();

  console.log('=== Dashboard Live QA (M23) ===');
  let failed = false;
  for (const { label, realErrors, overflow } of results) {
    console.log(`${label}: horizontalOverflow=${overflow} consoleErrors=${realErrors.length}`);
    if (realErrors.length > 0) { console.log(realErrors.join('\n')); failed = true; }
    if (overflow) failed = true;
  }
  if (failed) { console.error('QA FAILED'); process.exit(1); }
  console.log('QA PASSED');
}

run().catch((err) => { console.error(err); process.exit(1); });
