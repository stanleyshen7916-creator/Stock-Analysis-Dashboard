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
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

const EXPECTED_TABS = ['總覽','技術分析','基本面','籌碼分析','財務分析','產業分析','波浪分析','AI 選股流程','歷史推薦','預測追蹤','相關新聞'];

async function checkViewport(page, label) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(`http://127.0.0.1:${page.__qaPort}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('[data-page="analysis"]');
  await page.waitForTimeout(700);

  const input = page.locator('#analysis-symbol');
  if (await input.count()) {
    await input.fill('2330');
    await page.click('#analysis-search');
    await page.waitForTimeout(1500);
  }

  const problems = [];
  const tabs = page.locator('#page-analysis .stock-tab');
  if (await tabs.count() !== 11) problems.push(`expected 11 stock tabs, found ${await tabs.count()}`);

  const overviewContent = await page.textContent('#analysis-tab-content') ?? '';
  const overviewSvg = await page.locator('#analysis-tab-content svg').count();
  if (!overviewSvg) problems.push('Overview K 線走勢 has no graphical SVG chart');
  if (overviewContent.includes('近期日線資料')) problems.push('Overview incorrectly contains the detailed daily OHLCV table');

  if (await tabs.count() >= 2) {
    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    const technicalContent = await page.textContent('#analysis-tab-content') ?? '';
    if (!technicalContent.includes('近期日線資料')) problems.push('Technical Analysis does not contain the daily OHLCV section');
    if (!technicalContent.includes('日期') || !technicalContent.includes('開盤') || !technicalContent.includes('收盤')) problems.push('Technical Analysis daily OHLCV table headers are incomplete');
  }

  for (let i = 0; i < Math.min(await tabs.count(), EXPECTED_TABS.length); i += 1) {
    await tabs.nth(i).click();
    await page.waitForTimeout(180);
    const active = await tabs.nth(i).getAttribute('class') ?? '';
    const content = await page.textContent('#analysis-tab-content') ?? '';
    if (!active.includes('active')) problems.push(`tab ${EXPECTED_TABS[i]} did not become active`);
    if (!content.trim()) problems.push(`tab ${EXPECTED_TABS[i]} rendered blank content`);
    if (content.includes('載入中')) problems.push(`tab ${EXPECTED_TABS[i]} remained in loading state`);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const realErrors = errors.filter((e) => !e.includes('favicon'));
  console.log(`${label}: chart=${overviewSvg > 0} tabs=${await tabs.count()} overflow=${overflow} consoleErrors=${realErrors.length} problems=${problems.length}`);
  if (realErrors.length) console.log(realErrors.join('\n'));
  if (problems.length) console.log(problems.map((p) => `  - ${p}`).join('\n'));
  return { realErrors, overflow, problems };
}

async function run() {
  const { server, port } = await startStaticServer(rootDir);
  const browser = await chromium.launch();
  let failed = false;
  for (const [label, viewport] of [['Desktop', { width: 1280, height: 900 }], ['Mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    page.__qaPort = port;
    const result = await checkViewport(page, label);
    if (result.realErrors.length || result.overflow || result.problems.length) failed = true;
    await page.close();
  }
  await browser.close();
  server.close();
  if (failed) { console.error('STOCK ANALYSIS QA FAILED'); process.exit(1); }
  console.log('STOCK ANALYSIS QA PASSED');
}

run().catch((err) => { console.error(err); process.exit(1); });
