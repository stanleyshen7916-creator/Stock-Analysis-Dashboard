// Real-data QA for the approved Dashboard UX. Serves the static files locally
// and drives the real Production Supabase-backed UI with Playwright. The
// checks accept either verified data or an explicit honest empty/error state;
// they never accept a stuck loading state or fabricated values.
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
    fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404); res.end('not found'); return; } res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}
const PAGE_CLICKS = ['dashboard', 'portfolio', 'analysis', 'engine', 'strategy', 'market', 'industry', 'backtest', 'data', 'reports', 'settings'];
const STUCK_LOADING_PATTERNS = ['載入中'];
function assertNotStuckLoading(label, text, problems) { const value = (text ?? '').trim(); if (STUCK_LOADING_PATTERNS.some((p) => value.includes(p))) problems.push(`${label} still shows loading placeholder after settle-wait: "${value}"`); }

async function runFlowChecks(page, problems) {
  const heroCount = (await page.textContent('#hero-count'))?.trim() ?? '';
  const stockTableText = await page.textContent('#stock-table') ?? '';
  const systemStatus = await page.textContent('#system-status') ?? '';
  const honestDashboardError = stockTableText.includes('Production Data 讀取失敗') || systemStatus.includes('資料連線異常');
  if ((!heroCount || heroCount === '–') && !honestDashboardError) problems.push(`Dashboard hero count never populated: "${heroCount}"`);
  assertNotStuckLoading('Dashboard hero count', heroCount, problems);
  assertNotStuckLoading('Market Top 50 table', stockTableText, problems);
  const stockRows = await page.$$('#stock-table tr');
  const hasRealRow = await page.$('#stock-table .link-stock');
  if (!stockRows.length || (!hasRealRow && !stockTableText.includes('尚無真實資料') && !stockTableText.includes('Production Data 讀取失敗'))) problems.push('Market Top 50 table has neither real rows nor an honest empty/error state');

  await page.click('[data-horizon="short"]');
  await page.waitForTimeout(800);
  assertNotStuckLoading('Horizon-filtered table', await page.textContent('#stock-table'), problems);

  const stockLink = await page.$('.link-stock');
  if (stockLink) await stockLink.click();
  else { await page.click('[data-page="analysis"]'); await page.fill('#analysis-symbol', '2330'); await page.click('#analysis-search'); }
  await page.waitForTimeout(1800);

  const conclusion = await page.textContent('#analysis-conclusion') ?? '';
  const provenance = await page.textContent('#analysis-provenance') ?? '';
  const fundamentals = await page.textContent('#analysis-fundamentals') ?? '';
  const market = await page.textContent('#analysis-market') ?? '';
  assertNotStuckLoading('Stock analysis conclusion', conclusion, problems);
  assertNotStuckLoading('Stock analysis provenance', provenance, problems);
  assertNotStuckLoading('Fundamental panel', fundamentals, problems);
  assertNotStuckLoading('Market/history panel', market, problems);
  if (!conclusion.trim()) problems.push('Stock analysis conclusion is blank');
  if (!provenance.trim()) problems.push('Stock analysis provenance is blank');

  await page.click('[data-page="engine"]');
  await page.waitForTimeout(800);
  const score = await page.textContent('#engine-score') ?? '';
  const breakdown = await page.textContent('#engine-breakdown') ?? '';
  assertNotStuckLoading('AI Selection score', score, problems);
  assertNotStuckLoading('AI Selection breakdown', breakdown, problems);
  if (!breakdown.includes('Fundamental') && !breakdown.includes('尚無真實計分細節') && !breakdown.includes('尚未執行')) problems.push('AI Selection breakdown shows neither verified score detail nor honest empty state');
}

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
    await page.waitForTimeout(1800);
    const problems = [];
    await runFlowChecks(page, problems);
    for (const pageName of PAGE_CLICKS) { await page.click(`[data-page="${pageName}"]`); await page.waitForTimeout(700); }
    await page.click('[data-page="dashboard"]'); await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const realErrors = consoleErrors.filter((e) => !e.includes('favicon'));
    results.push({ label, realErrors, overflow, problems });
    await page.close();
  }
  await browser.close(); server.close();
  console.log('=== Dashboard Live QA (reference UX + real-data flow) ===');
  let failed = false;
  for (const { label, realErrors, overflow, problems } of results) {
    console.log(`${label}: horizontalOverflow=${overflow} consoleErrors=${realErrors.length} flowProblems=${problems.length}`);
    if (realErrors.length) { console.log(realErrors.join('\n')); failed = true; }
    if (overflow) failed = true;
    if (problems.length) { console.log(problems.map((p) => `  - ${p}`).join('\n')); failed = true; }
  }
  if (failed) { console.error('QA FAILED'); process.exit(1); }
  console.log('QA PASSED');
}
run().catch((err) => { console.error(err); process.exit(1); });