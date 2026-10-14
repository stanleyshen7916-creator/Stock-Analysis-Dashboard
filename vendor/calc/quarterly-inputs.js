// Point-in-time quarterly fundamental inputs for the recommendation engine's
// long-reserved EPS / net income / ROE signal slots (src/fundamental/
// signals.js), from quarterly_financials (MOPS t163sb04/t163sb05, 2016+).
//
// "Point in time": on `date` only a quarter whose statutory filing deadline
// has passed is known (available_on = deadline + 1: Q1 5/16, Q2 8/15,
// Q3 11/15, Q4 4/1 of the next year - conservative, most firms file
// earlier). MOPS reports year-to-date figures, so a single quarter is
// YTD(n) - YTD(n-1) of the same fiscal year (Q1 = its YTD).
//
//   epsGrowth       - latest single-quarter EPS vs the same quarter a year earlier
//   netIncomeGrowth - the same for parent net income
//   roe             - trailing four quarters' parent net income / latest parent equity
// Growth is relative (x / |base| - 1 style) when the base is non-zero, else
// the plain difference - the signals only use the sign. Any input that
// cannot be computed from real rows is null (the engine then emits no
// signal for it), never a guessed value.
//
// Import-free, so it is also vendored to the dashboard (scripts/sync-dashboard-vendor.mjs).

const keyOf = (year, quarter) => year * 4 + (quarter - 1);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function singleQuarter(byKey, key, field) {
  const row = byKey.get(key);
  const ytd = num(row?.[field]);
  if (ytd === null || !Number.isFinite(ytd)) return null;
  if (row.fiscal_quarter === 1) return ytd;
  const prev = num(byKey.get(key - 1)?.[field]);
  return prev === null || !Number.isFinite(prev) ? null : ytd - prev;
}

function growth(current, base) {
  if (current === null || base === null) return null;
  return base !== 0 ? (current - base) / Math.abs(base) : current - base;
}

function parentEquity(row) {
  const parent = num(row?.equity_parent);
  if (parent !== null) return parent;
  const total = num(row?.total_equity);
  return total === null ? null : total - (num(row?.non_controlling_interest) ?? 0);
}

/**
 * @param {Array<object>} rows - one symbol's quarterly_financials rows (any order).
 * @param {string} date - 'YYYY-MM-DD'; only quarters with available_on <= date are used.
 * @returns {{epsGrowth, netIncomeGrowth, roe, fiscalYear, fiscalQuarter, availableOn}|null}
 */
export function quarterlyFundamentalInputs(rows, date) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const byKey = new Map();
  let latest = null;
  for (const row of rows) {
    const key = keyOf(Number(row.fiscal_year), Number(row.fiscal_quarter));
    byKey.set(key, { ...row, fiscal_quarter: Number(row.fiscal_quarter) });
    if (row.available_on && row.available_on <= date && (latest === null || key > latest)) latest = key;
  }
  if (latest === null) return null;
  const known = (key) => byKey.has(key) && byKey.get(key).available_on <= date;
  const q = (key, field) => (known(key) ? singleQuarter(byKey, key, field) : null);

  const eps = q(latest, 'eps_ytd');
  const netIncome = q(latest, 'net_income_parent_ytd');
  const ttm = [0, 1, 2, 3].map((d) => q(latest - d, 'net_income_parent_ytd'));
  const equity = parentEquity(byKey.get(latest));
  const row = byKey.get(latest);
  return {
    epsGrowth: growth(eps, q(latest - 4, 'eps_ytd')),
    netIncomeGrowth: growth(netIncome, q(latest - 4, 'net_income_parent_ytd')),
    roe: ttm.every((x) => x !== null) && equity !== null && equity > 0 ? ttm.reduce((s, x) => s + x, 0) / equity : null,
    fiscalYear: Number(row.fiscal_year),
    fiscalQuarter: row.fiscal_quarter,
    availableOn: row.available_on
  };
}
