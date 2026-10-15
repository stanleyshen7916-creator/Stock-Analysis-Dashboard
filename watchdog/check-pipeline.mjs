import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
// Nightly-run watchdog (2026-10-15, Stanley chose it): the platform's data
// is produced by a nightly run on Stanley's PC and synced to Cloud. If that
// PC is off or the run fails, nothing on the PC can say so. This runs on
// GitHub Actions in the PUBLIC Stock-Analysis-Dashboard repo (free minutes)
// every morning, reads Cloud with the public read-only key, and opens an
// issue - which GitHub e-mails to Stanley - when the latest trading session
// is missing; it closes the issue once data is current again.
//
// Source of truth: Stock-Analysis-System/publish/dashboard-repo/ (copied in by
// scripts/publish-dashboard.mjs). No secrets: the key read here is the same
// publishable key the website ships in js/config.js.

export const CHECKS = [
  { table: 'market_daily', column: 'trading_date', label: '股價（market_daily）' },
  { table: 'market_top50', column: 'calculation_date', label: 'AI 名單（market_top50）' },
  { table: 'shadow_portfolio_performance', column: 'as_of_date', label: '影子追蹤（shadow_portfolio_performance）' }
];
export const RUN_HOUR_TAIPEI = 23; // the nightly run's data for day D lands after ~23:30 Taipei

const taipeiDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const taipeiHour = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', hour12: false }).format(d));
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** TWSE holidaySchedule rows -> closed dates ('YYYY-MM-DD'). Rows named 開始交易日 / 最後交易日 are trading days. */
export function closedDates(rows) {
  return new Set((rows ?? [])
    .filter((r) => !/開始交易|最後交易/.test(r.Name ?? ''))
    .map((r) => String(r.Date ?? ''))
    .filter((d) => /^\d{7}$/.test(d))
    .map((d) => `${Number(d.slice(0, 3)) + 1911}-${d.slice(3, 5)}-${d.slice(5, 7)}`));
}

/** The latest session whose nightly data should already exist at `now`. */
export function expectedLatestSession(now, closed = new Set()) {
  let d = taipeiDate(now);
  if (taipeiHour(now) < RUN_HOUR_TAIPEI + 1) d = addDays(d, -1);
  for (let i = 0; i < 20; i += 1) {
    if (weekday(d) !== 0 && weekday(d) !== 6 && !closed.has(d)) return d;
    d = addDays(d, -1);
  }
  return d;
}

/**
 * Stale checks. Without the holiday list, a single missing weekday could be
 * a holiday, so only a gap of 2+ weekdays is reported (stated in the result).
 */
export function evaluate({ now, closed, latest }) {
  const expected = expectedLatestSession(now, closed ?? new Set());
  const tolerance = closed ? 0 : 1;
  let allowed = expected;
  for (let k = 0; k < tolerance; k += 1) {
    allowed = addDays(allowed, -1);
    while (weekday(allowed) === 0 || weekday(allowed) === 6) allowed = addDays(allowed, -1);
  }
  const stale = CHECKS.filter((c) => !latest[c.table] || String(latest[c.table]).slice(0, 10) < allowed)
    .map((c) => ({ ...c, latest: latest[c.table] ?? null }));
  return { expected, allowed, holidayListUsed: Boolean(closed), stale, ok: stale.length === 0 };
}

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${url.split('?')[0]} -> ${r.status}`);
  return r.json();
}

function cloudConfig() {
  const src = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('CLOUD_CONFIG'));
  const url = block.match(/SUPABASE_URL:\s*'([^']+)'/)?.[1];
  const key = block.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)?.[1];
  if (!url || !key) throw new Error('Cloud URL / publishable key not found in js/config.js');
  return { url, key };
}

async function github(path, { method = 'GET', body } = {}) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }
  });
  if (!r.ok) throw new Error(`GitHub ${method} ${path} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

const LABEL = 'pipeline-watchdog';

export async function main({ now = new Date(), log = console.log } = {}) {
  const { url, key } = cloudConfig();
  const latest = {};
  for (const c of CHECKS) {
    const rows = await getJson(`${url}/rest/v1/${c.table}?select=${c.column}&order=${c.column}.desc&limit=1`, { apikey: key, Authorization: `Bearer ${key}` });
    latest[c.table] = rows[0]?.[c.column] ?? null;
  }
  let closed = null;
  try { closed = closedDates(await getJson('https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule')); } catch (err) { log(`holiday list unavailable (${err.message}); tolerating one weekday`); }
  const result = evaluate({ now, closed, latest });
  log(JSON.stringify({ latest, ...result }, null, 2));

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) return result;
  const open = await github(`/issues?state=open&labels=${LABEL}&per_page=5`);
  if (!result.ok && open.length === 0) {
    const lines = [
      `每晚排程的資料沒有更新到最新交易日 **${result.expected}**（檢查時間 ${now.toISOString()}）。`, '',
      ...result.stale.map((s) => `- ${s.label}：雲端最新為 ${s.latest ?? '無資料'}`), '',
      '可能原因：電腦未開機或未登入 Windows、Docker 未啟動、排程失敗或雲端同步失敗。',
      '處理方式：在電腦上執行 `powershell -File scripts\\local-production\\run-agent.ps1 --force`，並查看 `runtime\\logs\\agent.log`。',
      '資料恢復最新後，此 issue 會自動關閉。',
      result.holidayListUsed ? '' : '（本次未能取得證交所休市日表，只在連續兩個平日缺資料時才通報。）'
    ];
    await github('/issues', { method: 'POST', body: { title: `每晚排程未更新：缺 ${result.expected} 的資料`, body: lines.join('\n'), labels: [LABEL] } });
    log('issue opened');
  } else if (result.ok && open.length > 0) {
    for (const issue of open) {
      await github(`/issues/${issue.number}/comments`, { method: 'POST', body: { body: `資料已更新到 ${result.expected}，自動關閉。` } });
      await github(`/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
    }
    log(`closed ${open.length} issue(s)`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error('watchdog failed:', err.message); process.exitCode = 1; });
}
