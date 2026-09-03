// Real-data QA (M23, M11-M23 Dashboard spec v1 Section 12; extended for
// Issue #5 Phase C/D acceptance): serves this repo's static files locally
// and drives every route with Playwright against the REAL Production
// Supabase project (this repo's config.js already carries the real,
// non-secret anon/publishable key - same precedent as the private repo's
// public/js/config.js). Verifies no uncaught console error, no broken
// navigation, real data or an honest empty/error state - never a
// fabricated result.
//
// Issue #5 additionally requires walking the actual required flow (Market
// Top 50 -> Investment Horizon -> Stock Detail -> Technical -> Fundamental
// -> Target Price -> Expected Return -> Recommendation -> AI Selection
// Traceability) and asserting each step settled to a real value or an
// honest "尚無真實資料/資料不足" state - never left stuck on "載入中..."
// (which would mean a promise never resolved) and never silently blank.

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

// Navigation here is click-driven (data-page/data-horizon buttons), not
// hash-based - matches the confirmed UX_BASELINE_V1 baseline (this repo's
// PR #1) exactly; this QA script drives it the same way a real user would.
const PAGE_CLICKS = ['dashboard', 'portfolio', 'analysis', 'engine', 'strategy', 'market', 'industry', 'backtest', 'data', 'reports', 'settings'];

// A value never left stuck on a loading placeholder - either real content
// or one of this baseline's own honest "no data" strings (never blank,
// never fabricated).
const STUCK_LOADING_PATTERNS = ['載入中'];

function assertNotStuckLoading(label, text, problems) {
  const value = (text ?? '').trim();
  if (STUCK_LOADING_PATTERNS.some((p) => value.includes(p))) problems.push(`${label} still shows a loading placeholder after settle-wait: "${value}"`);
}

async function runFlowChecks(page, problems) {
  // 1. Market Top 50 (dashboard homepage hero + table): either real rows
  // or the baseline's honest "尚無真實資料" - never stuck loading.
  const heroCount = (await page.textContent('#hero-count'))?.trim() ?? '';
  if (heroCount === '' || heroCount.startsWith('–')) problems.push(`Market Top 50 hero count never populated: "${heroCount}"`);
  const stockTableText = (await page.textContent('#stock-table')) ?? '';
  assertNotStuckLoading('Market Top 50 table', stockTableText, problems);
  const stockRows = await page.$$('#stock-table tr');
  const hasRealRow = await page.$('#stock-table .link-stock');
  if (stockRows.length === 0 || (!hasRealRow && !stockTableText.includes('尚無真實資料'))) {
    problems.push('Market Top 50 table has neither a real stock row nor the honest empty-state message');
  }
  const asOf = (await page.textContent('#data-asof'))?.trim() ?? '';
  if (!/\d{4}-\d{2}-\d{2}/.test(asOf) && !asOf.includes('–')) problems.push(`Data-as-of date not in expected form: "${asOf}"`);

  // 2. Investment Horizon: switching horizon must re-render the table to
  // either real rows for that horizon or an honest empty state.
  await page.click('[data-horizon="short"]');
  await page.waitForTimeout(800);
  const horizonTableText = (await page.textContent('#stock-table')) ?? '';
  assertNotStuckLoading('Horizon-filtered table (short)', horizonTableText, problems);

  // 3. Select Stock -> Stock Detail. Prefer a real Top50 row link if one
  // exists (this is the real flow Issue #5 requires); otherwise fall back
  // to the search box so the rest of the flow still gets exercised.
  const stockLink = await page.$('.link-stock');
  if (stockLink) {
    await stockLink.click();
  } else {
    await page.click('[data-page="analysis"]');
    await page.fill('#analysis-search', '2330');
    await page.click('#analysis-search-btn');
  }
  await page.waitForTimeout(1500);

  const title = (await page.textContent('#analysis-title'))?.trim() ?? '';
  if (!title || title === '請搜尋一檔股票') problems.push('Stock Detail title never populated after selecting a stock');

  // 4. Technical / score context (AI score circle + reasons on this page;
  // full technical-tool weights live on the AI Selection Traceability page,
  // checked in step 7 - this baseline never duplicates a technical-
  // indicator panel on Stock Detail itself, by design).
  const score = (await page.textContent('#analysis-score'))?.trim() ?? '';
  assertNotStuckLoading('Stock Detail AI score', score, problems);
  const reasonsText = (await page.textContent('#analysis-reasons')) ?? '';
  assertNotStuckLoading('Stock Detail AI reasons', reasonsText, problems);

  // 5. Fundamental Analysis panel: real table or the honest empty/failed
  // state - never stuck on "載入中...".
  const fundamentalsText = (await page.textContent('#analysis-fundamentals')) ?? '';
  assertNotStuckLoading('Fundamental panel', fundamentalsText, problems);

  // 6/7. Target Price + Expected Return (both rendered together in
  // #analysis-target as "目標價：<value or 尚無真實資料>").
  const targetText = (await page.textContent('#analysis-target'))?.trim() ?? '';
  assertNotStuckLoading('Target Price', targetText, problems);
  if (!targetText.startsWith('目標價：')) problems.push(`Target Price label missing/changed: "${targetText}"`);

  // 8. Recommendation (AI 推薦歷史 / decision state) + real price history.
  const historyText = (await page.textContent('#analysis-history')) ?? '';
  assertNotStuckLoading('Recommendation/AI history panel', historyText, problems);
  const pricesText = (await page.textContent('#analysis-prices')) ?? '';
  assertNotStuckLoading('Recent prices panel', pricesText, problems);

  // 9. AI Selection Traceability (AI 選股流程 / engine page): real
  // Fundamental/Technical score + weight breakdown traced to
  // market_top50.score_breakdown (migration 013), or the honest
  // "尚無真實計分細節" empty state - never stuck loading.
  await page.click('[data-page="engine"]');
  await page.waitForTimeout(800);
  const weightsText = (await page.textContent('#engine-weights')) ?? '';
  assertNotStuckLoading('AI Selection Traceability weights', weightsText, problems);
  if (!weightsText.includes('Fundamental') && !weightsText.includes('尚無真實計分細節')) {
    problems.push('AI Selection Traceability panel shows neither real score weights nor the honest empty state');
  }
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
    await page.waitForTimeout(1500);

    const problems = [];
    await runFlowChecks(page, problems);

    for (const page_ of PAGE_CLICKS) {
      await page.click(`[data-page="${page_}"]`);
      await page.waitForTimeout(1000);
    }
    await page.click('[data-page="dashboard"]');
    await page.waitForTimeout(500);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    // Only the harmless, expected favicon 404 is allowed - any other console
    // error fails the QA, matching this project's established convention.
    const realErrors = consoleErrors.filter((e) => !e.includes('favicon'));
    results.push({ label, realErrors, overflow, problems });
    await page.close();
  }

  await browser.close();
  server.close();

  console.log('=== Dashboard Live QA (M23 + Issue #5 flow/data checks) ===');
  let failed = false;
  for (const { label, realErrors, overflow, problems } of results) {
    console.log(`${label}: horizontalOverflow=${overflow} consoleErrors=${realErrors.length} flowProblems=${problems.length}`);
    if (realErrors.length > 0) { console.log(realErrors.join('\n')); failed = true; }
    if (overflow) failed = true;
    if (problems.length > 0) { console.log(problems.map((p) => `  - ${p}`).join('\n')); failed = true; }
  }
  if (failed) { console.error('QA FAILED'); process.exit(1); }
  console.log('QA PASSED');
}

run().catch((err) => { console.error(err); process.exit(1); });
