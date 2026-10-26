// Taiwan stock market (TWSE / TPEx) weekday closures, for browser and Node.
//
// Source: TWSE 115 年（2026）市場開休市日期, as reported by 經濟日報
// (https://money.udn.com/money/story/5607/9105340). Add the next year's list
// when TWSE publishes it (usually late November); dates outside the covered
// years fall back to weekdays only.
//
// Unscheduled closures (typhoons) are kept separately: they are only known
// after the fact, and some checks (e.g. score-ic's calendar holes) want to
// see them as holes unless explicitly accepted.

export const SCHEDULED_CLOSURES = Object.freeze([
  // 2026
  '2026-01-01', // 開國紀念日
  '2026-02-12', '2026-02-13', // 春節前休市（僅結算）
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', // 春節（2/20 補假）
  '2026-02-27', // 和平紀念日補假
  '2026-04-03', '2026-04-06', // 兒童節、清明節補假
  '2026-05-01', // 勞動節
  '2026-06-19', // 端午節
  '2026-09-25', // 中秋節
  '2026-09-28', // 教師節
  '2026-10-09', // 國慶日補假
  '2026-10-26', // 臺灣光復節補假
  '2026-12-25' // 行憲紀念日
]);

export const COVERED_YEARS = Object.freeze([2026]);

// Closures announced on the day (颱風假). Confirmed from the production
// database having no session and TWSE having no quotes for that day.
export const UNSCHEDULED_CLOSURES = Object.freeze([
  '2026-10-23' // 颱風停止上班上課，全日休市
]);

const ALL = new Set([...SCHEDULED_CLOSURES, ...UNSCHEDULED_CLOSURES]);

/** True when the date (YYYY-MM-DD) is a weekday that is not a known closure. */
export function isTradingDay(iso, closures = ALL) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ''))) return false;
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !closures.has(iso);
}

/** True when the closure list covers every year from `from` through `to` (YYYY-MM-DD). */
export function calendarCovers(from, to) {
  const a = Number(String(from).slice(0, 4));
  const b = Number(String(to).slice(0, 4));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  for (let y = a; y <= b; y += 1) if (!COVERED_YEARS.includes(y)) return false;
  return true;
}
