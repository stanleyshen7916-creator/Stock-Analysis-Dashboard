// AI 模擬投資 summary (2026-10-19, Stanley's request): turns the sim_runs /
// sim_daily / sim_orders rows the AI 智慧選股 panel already reads into the
// headline numbers (NAV, return vs 大盤 and 0050, realized / unrealized P&L, max
// drawdown), the points of the return-vs-0050 line chart, and a staleness
// check for active runs. Pure functions - no DOM, no fetch - so they can be
// tested in node. Never fabricates a number: anything missing comes back null.

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const sum = (values) => values.reduce((total, v) => total + v, 0);

// 大盤 (2026-10-26, Stanley: the comparison is the market, 0050 only for
// reference): the TAIEX total return index's return from the run's start,
// written into sim_daily.feedback.market by scripts/ai-simulation.mjs.
export const marketPctOf = (day) => num(day?.feedback?.market?.returnPct);
export const benchmarkPctOf = (day) => num(day?.benchmark_return_pct);

export function summarizeSimRun({ run, days = [], orders = [] }) {
  const ordered = [...days].sort((a, b) => String(a.trading_date).localeCompare(String(b.trading_date)));
  const last = ordered.at(-1) ?? null;
  // The first sim_daily row is the decision day before the first open
  // (all cash); the run has "started" once a trading session followed it.
  const started = ordered.length > 1;
  const returnPct = started ? num(last?.return_pct) : null;
  const benchmarkReturnPct = started ? num(last?.benchmark_return_pct) : null;
  const marketReturnPct = started ? marketPctOf(last) : null;
  // excess = account minus 大盤; 0050 is shown for reference only
  const excessPct = returnPct !== null && marketReturnPct !== null ? returnPct - marketReturnPct : null;

  const closed = orders.filter((o) => o.side === 'SELL' && o.status === 'FILLED' && num(o.detail?.pnl) !== null);
  const realizedPnl = closed.length ? sum(closed.map((o) => num(o.detail.pnl))) : 0;
  const holdings = Array.isArray(last?.holdings) ? last.holdings : [];
  const holdingPnls = holdings.map((h) => num(h.pnl)).filter((v) => v !== null);
  const unrealizedPnl = holdings.length === 0 ? 0 : holdingPnls.length === holdings.length ? sum(holdingPnls) : null;

  let peak = null;
  let maxDrawdownPct = null;
  for (const day of ordered) {
    const nav = num(day.nav);
    if (nav === null) continue;
    peak = peak === null ? nav : Math.max(peak, nav);
    const drawdown = peak > 0 ? ((nav - peak) / peak) * 100 : 0;
    maxDrawdownPct = maxDrawdownPct === null ? drawdown : Math.min(maxDrawdownPct, drawdown);
  }

  return {
    runId: run.run_id,
    accountClass: run.account_class,
    label: run.account_class === 'STOCK' ? '一般股票帳戶' : 'ETF 帳戶',
    shadow: isShadowRun(run),
    rulesVersion: num(run.rules?.version),
    winRatePct: closed.length ? (closed.filter((o) => num(o.detail.pnl) > 0).length / closed.length) * 100 : null,
    status: run.status,
    startDate: run.start_date,
    endDate: run.end_date,
    initialCash: num(run.initial_cash),
    started,
    lastDate: last?.trading_date ?? null,
    sessions: Math.max(0, ordered.length - 1),
    nav: num(last?.nav),
    cash: num(last?.cash),
    returnPct,
    benchmarkReturnPct,
    marketReturnPct,
    excessPct,
    realizedPnl,
    unrealizedPnl,
    closedTrades: closed.length,
    winningTrades: closed.filter((o) => num(o.detail.pnl) > 0).length,
    maxDrawdownPct: started ? maxDrawdownPct : null,
    holdingsCount: holdings.length,
    pendingOrders: orders.filter((o) => o.status === 'PENDING').length
  };
}

// Shadow rounds (rules v3 onwards, 2026-10-20) run alongside the official
// round to test rule changes; they never replace it on the home page.
export function isShadowRun(run) {
  return Boolean(run?.rules?.shadow) || num(run?.rules?.version) >= 3;
}

// Monday (UTC date arithmetic on a YYYY-MM-DD string) of the week holding `date`.
function mondayOf(date) {
  const t = Date.parse(`${date}T00:00:00Z`);
  const weekday = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - weekday * 864e5).toISOString().slice(0, 10);
}

// Return over a period for the account and for 0050, from the last row
// before the period starts (or the run's starting row, if the run began
// inside the period) to the latest row. `benchmark_return_pct` is
// cumulative from the run's start, so the period figure is compounded off
// its value on the base row. Null when there is nothing to measure.
export function periodReturn(days, periodStart) {
  const ordered = [...days].filter((d) => num(d.nav) !== null).sort((a, b) => String(a.trading_date).localeCompare(String(b.trading_date)));
  if (ordered.length < 2) return null;
  const last = ordered.at(-1);
  if (String(last.trading_date) < periodStart) return null;
  const base = ordered.filter((d) => String(d.trading_date) < periodStart).at(-1) ?? ordered[0];
  if (base === last) return null;
  const returnPct = (num(last.nav) / num(base.nav) - 1) * 100;
  const compound = (pick) => {
    const b0 = pick(base), b1 = pick(last);
    return b0 !== null && b1 !== null ? ((1 + b1 / 100) / (1 + b0 / 100) - 1) * 100 : null;
  };
  const benchmarkPct = compound(benchmarkPctOf);
  const marketPct = compound(marketPctOf);
  return { from: base.trading_date, to: last.trading_date, returnPct, benchmarkPct, marketPct, excessPct: marketPct === null ? null : returnPct - marketPct };
}

// This week's (from Monday) and this month's (from the 1st) returns, as of `today` (YYYY-MM-DD).
export function weekAndMonthReturns(days, today) {
  return { week: periodReturn(days, mondayOf(today)), month: periodReturn(days, `${String(today).slice(0, 7)}-01`) };
}

// Sessions on which the account did better than 大盤 (day-over-day; `pick`
// reads the comparison's cumulative return from a row), of all sessions after the start.
export function sessionsBeatingBenchmark(days, pick = marketPctOf) {
  const ordered = [...days].sort((a, b) => String(a.trading_date).localeCompare(String(b.trading_date)));
  let beat = 0, total = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const [p, c] = [ordered[i - 1], ordered[i]];
    if ([num(p.nav), num(c.nav), pick(p), pick(c)].some((v) => v === null)) continue;
    const own = num(c.nav) / num(p.nav) - 1;
    const bench = (1 + pick(c) / 100) / (1 + pick(p) / 100) - 1;
    total += 1;
    if (own > bench) beat += 1;
  }
  return total ? { beat, total } : null;
}

// Latest trades across accounts: filled and cancelled orders, newest
// execution first (pending ones have no execution yet and are listed apart).
export function recentTrades(entries, limit = 10) {
  return entries
    .flatMap(({ summary, orders }) => orders.filter((o) => o.status !== 'PENDING').map((o) => ({ ...o, accountLabel: summary.label, shadow: summary.shadow })))
    .sort((a, b) => String(b.exec_date ?? '').localeCompare(String(a.exec_date ?? '')) || Number(b.id ?? 0) - Number(a.id ?? 0))
    .slice(0, limit);
}

// The round shown on the home page: the official (non-shadow) runs of the
// latest-starting round, active preferred; shadow runs of the same period
// listed separately.
export function pickHeadlineRuns(entries) {
  const official = entries.filter((e) => !e.summary.shadow);
  const pool = official.some((e) => e.run.status === 'ACTIVE') ? official.filter((e) => e.run.status === 'ACTIVE') : official;
  const latestStart = pool.map((e) => String(e.run.start_date)).sort().at(-1);
  const headline = pool.filter((e) => String(e.run.start_date) === latestStart).sort((a, b) => String(b.run.account_class).localeCompare(String(a.run.account_class)));
  const shadow = entries.filter((e) => e.summary.shadow && e.run.status === 'ACTIVE');
  return { headline, shadow };
}

// Weekdays strictly after lastDate and strictly before today (both
// YYYY-MM-DD): sessions whose close has passed but that the run has not
// processed. Weekday-based, so Taiwan market holidays count too - callers
// label it as an estimate.
export function missedWeekdays(lastDate, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lastDate ?? '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(today ?? ''))) return null;
  const end = Date.parse(`${today}T00:00:00Z`);
  let count = 0;
  for (let t = Date.parse(`${lastDate}T00:00:00Z`) + 864e5; t < end; t += 864e5) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

// Today's date in Taipei as YYYY-MM-DD.
export function taipeiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// SVG coordinates for the cumulative-return chart (strategy vs 大盤, 0050 for reference).
// Rows without a number are skipped for that line, never drawn as 0.
export function buildReturnChart(days, options = {}) {
  const rows = days.map((d) => ({ ...d, market_return_pct: marketPctOf(d) }));
  const chart = buildLinesChart(rows, ['return_pct', 'market_return_pct', 'benchmark_return_pct'], options);
  if (!chart) return null;
  const { lines, ...rest } = chart;
  return { ...rest, strategy: lines.return_pct, market: lines.market_return_pct, benchmark: lines.benchmark_return_pct };
}

// SVG coordinates for several percentage lines over the same dated rows
// (keys = the row fields to draw). `lines` maps each key to its polyline points.
export function buildLinesChart(rows, keys, { width = 640, height = 220, padLeft = 48, padRight = 12, padTop = 12, padBottom = 28 } = {}) {
  const ordered = [...rows].sort((a, b) => String(a.trading_date).localeCompare(String(b.trading_date)));
  if (ordered.length < 2) return null;
  const values = ordered.flatMap((d) => keys.map((key) => num(d[key]))).filter((v) => v !== null);
  if (values.length === 0) return null;
  let yMin = Math.min(0, ...values);
  let yMax = Math.max(0, ...values);
  const span = yMax - yMin || 1;
  yMin -= span * 0.08;
  yMax += span * 0.08;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const x = (i) => padLeft + (ordered.length === 1 ? plotW / 2 : (i / (ordered.length - 1)) * plotW);
  const y = (v) => padTop + ((yMax - v) / (yMax - yMin)) * plotH;
  const line = (key) => ordered
    .map((d, i) => (num(d[key]) === null ? null : `${x(i).toFixed(1)},${y(num(d[key])).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  const step = (yMax - yMin) / 4;
  return {
    width,
    height,
    lines: Object.fromEntries(keys.map((key) => [key, line(key)])),
    zeroY: Number(y(0).toFixed(1)),
    plot: { left: padLeft, right: width - padRight, top: padTop, bottom: height - padBottom },
    yTicks: Array.from({ length: 5 }, (_, k) => {
      const value = yMin + step * k;
      return { value, y: Number(y(value).toFixed(1)) };
    }),
    xLabels: ordered.map((d, i) => ({ text: String(d.trading_date).slice(5).replace('-', '/'), x: Number(x(i).toFixed(1)) }))
  };
}

// 投資績效儀表板 (2026-10-26, Stanley's request): the headline accounts'
// cumulative returns, 大盤 and 0050 on one date axis, for buildLinesChart.
// `entries` = [{ summary, days }]; each account's line is keyed by its
// account class; market (大盤) and benchmark (0050) come from the first
// account that has them on a date.
export function mergeReturnSeries(entries) {
  const byDate = new Map();
  for (const { summary, days } of entries) {
    for (const d of days) {
      const row = byDate.get(d.trading_date) ?? { trading_date: d.trading_date, market: null, benchmark: null };
      row[summary.accountClass] = num(d.return_pct);
      if (row.market === null) row.market = marketPctOf(d);
      if (row.benchmark === null) row.benchmark = num(d.benchmark_return_pct);
      byDate.set(d.trading_date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.trading_date).localeCompare(String(b.trading_date)));
}

// Profit and loss per stock over the round: realized (filled sells) plus
// unrealized (the latest holdings), best first. A stock bought, sold and
// bought again is one line.
export function symbolContributions(entries) {
  const rows = new Map();
  const row = (summary, symbol, name) => {
    const key = `${summary.accountClass}:${symbol}`;
    if (!rows.has(key)) rows.set(key, { account: summary.label, symbol, name: name ?? null, realized: 0, unrealized: 0, holding: false });
    const r = rows.get(key);
    if (!r.name && name) r.name = name;
    return r;
  };
  for (const { summary, days, orders } of entries) {
    for (const o of orders) {
      if (o.side === 'SELL' && o.status === 'FILLED' && num(o.detail?.pnl) !== null) row(summary, o.symbol, o.detail?.name).realized += num(o.detail.pnl);
    }
    for (const h of days.at(-1)?.holdings ?? []) {
      const r = row(summary, h.symbol, h.name);
      r.holding = true;
      if (num(h.pnl) !== null) r.unrealized += num(h.pnl);
    }
  }
  return [...rows.values()].map((r) => ({ ...r, total: r.realized + r.unrealized })).sort((a, b) => b.total - a.total);
}

// Order counts for one account: filled buys / sells, sells by reason
// (R2 停利, R3 停損, R4 名次調整), cancelled and pending orders.
export function tradeActivity(orders) {
  const filled = orders.filter((o) => o.status === 'FILLED');
  const sells = filled.filter((o) => o.side === 'SELL');
  const byRule = (rule) => sells.filter((o) => o.detail?.rule === rule).length;
  return {
    buys: filled.filter((o) => o.side === 'BUY').length,
    sells: sells.length,
    takeProfit: byRule('R2'),
    stopLoss: byRule('R3'),
    rankExit: byRule('R4'),
    cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    pending: orders.filter((o) => o.status === 'PENDING').length
  };
}

// 投資組合 (2026-10-26, Stanley's request): what an account holds on its
// latest row - each holding's weight in the NAV, return on cost, and how
// far the close is from the platform's risk / target price - plus cash,
// biggest weight first. Null fields stay null.
export function portfolioComposition(day) {
  const nav = num(day?.nav);
  const cash = num(day?.cash);
  const holdings = (Array.isArray(day?.holdings) ? day.holdings : []).map((h) => {
    const marketValue = num(h.marketValue);
    const cost = num(h.cost);
    const pnl = num(h.pnl);
    const close = num(h.lastClose);
    const risk = num(h.risk);
    const target = num(h.target);
    return {
      symbol: h.symbol,
      name: h.name ?? null,
      shares: num(h.shares),
      cost,
      close,
      marketValue,
      pnl,
      returnPct: cost > 0 && pnl !== null ? (pnl / cost) * 100 : null,
      weightPct: nav > 0 && marketValue !== null ? (marketValue / nav) * 100 : null,
      buyDate: h.buyDate ?? null,
      heldSessions: num(h.heldSessions),
      rank: num(h.rank),
      risk,
      target,
      toRiskPct: close > 0 && risk !== null ? (risk / close - 1) * 100 : null,
      toTargetPct: close > 0 && target !== null ? (target / close - 1) * 100 : null
    };
  }).sort((a, b) => (b.weightPct ?? -1) - (a.weightPct ?? -1));
  const top = holdings.slice(0, 3).map((h) => h.weightPct).filter((v) => v !== null);
  return {
    date: day?.trading_date ?? null,
    nav,
    cash,
    cashPct: nav > 0 && cash !== null ? (cash / nav) * 100 : null,
    investedPct: nav > 0 && cash !== null ? ((nav - cash) / nav) * 100 : null,
    top3Pct: top.length ? sum(top) : null,
    holdings
  };
}
