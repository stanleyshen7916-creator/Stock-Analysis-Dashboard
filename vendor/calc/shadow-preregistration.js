// Pre-registered judgment of the shadow tracking (registered 2026-10-01, the
// day before tracking starts; Stanley approved). Written down BEFORE any
// live result exists so the verdict cannot be fitted to the outcome later.
// Full text and rationale: docs/SHADOW_TRACKING_PREREGISTRATION.md.
//
// Subject: ENHANCED_TOP150_AI_FUNDAMENTAL_INDUSTRY_NEUTRAL (the dashboard's
// AI 增強指數). Its active return = its cumulative return minus that of
// TOP150_CAP_WEIGHTED (same universe, plain market-cap weights), both net of
// costs, in percentage points.
//
// Backtest expectation (scripts/backtest-fundamental-upgrade.mjs, m4-v4,
// 2016-2026, 4 rebalance phases): active +1.20..+1.61 %/year (median ~1.4),
// tracking error 1.90..2.04 %/year (~2.0).
//
// Rules, evaluated at any as-of date, t = years since the first entry:
//   t < 0.5                          TOO_EARLY  - numbers shown, no verdict
//   active < 1.4 t - 2 x 2.0 x sqrt(t) ALERT    - below the backtest's 2-sigma band
//   0.5 <= t < 1, otherwise          CONSISTENT
//   t >= 1: annualized active >= 0   CONSISTENT
//           annualized active <= -2  ALERT      - re-examine the AI score
//           otherwise                WATCH
//   control (PRODUCTION_TOP10) ahead of the AI index by more than 10
//   percentage points, t >= 0.5     ALERT      - the model's judgment is in doubt
// Import-free; vendored for the dashboard.

export const PREREGISTRATION = Object.freeze({
  registeredOn: '2026-10-01',
  subject: 'ENHANCED_TOP150_AI_FUNDAMENTAL_INDUSTRY_NEUTRAL',
  reference: 'TOP150_CAP_WEIGHTED',
  control: 'PRODUCTION_TOP10',
  expectedActivePerYear: 1.4,
  trackingErrorPerYear: 2.0,
  minYearsForVerdict: 0.5,
  annualizedAlertBelow: -2,
  controlLeadAlertAbove: 10
});

const YEAR_MS = 365.25 * 86400000;

/**
 * @param {{subjectReturn, referenceReturn, controlReturn?, startDate, asOfDate}} input - cumulative % returns since startDate.
 * @returns {{status: 'TOO_EARLY'|'CONSISTENT'|'WATCH'|'ALERT', years, active, lowerBand, annualizedActive, reasons: string[]}}
 */
export function judgeShadow({ subjectReturn, referenceReturn, controlReturn = null, startDate, asOfDate }) {
  const p = PREREGISTRATION;
  const years = Math.max(0, (Date.parse(`${asOfDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / YEAR_MS);
  const active = subjectReturn - referenceReturn;
  const lowerBand = p.expectedActivePerYear * years - 2 * p.trackingErrorPerYear * Math.sqrt(years);
  const annualizedActive = years > 0 ? active / years : null;
  const base = { years, active, lowerBand, annualizedActive };
  if (years < p.minYearsForVerdict) return { status: 'TOO_EARLY', ...base, reasons: [`未滿 ${p.minYearsForVerdict} 年，不判定`] };
  const reasons = [];
  if (active < lowerBand) reasons.push(`超額 ${active.toFixed(2)} 個百分點低於回測預期下限 ${lowerBand.toFixed(2)}`);
  if (controlReturn != null && controlReturn - subjectReturn > p.controlLeadAlertAbove) reasons.push(`對照組領先 ${(controlReturn - subjectReturn).toFixed(2)} 個百分點（> ${p.controlLeadAlertAbove}）`);
  if (years >= 1 && annualizedActive <= p.annualizedAlertBelow) reasons.push(`年化超額 ${annualizedActive.toFixed(2)} ≤ ${p.annualizedAlertBelow}`);
  if (reasons.length) return { status: 'ALERT', ...base, reasons };
  if (years >= 1 && annualizedActive < 0) return { status: 'WATCH', ...base, reasons: [`年化超額 ${annualizedActive.toFixed(2)} 介於 ${p.annualizedAlertBelow} 與 0 之間`] };
  return { status: 'CONSISTENT', ...base, reasons: ['與回測預期一致'] };
}
