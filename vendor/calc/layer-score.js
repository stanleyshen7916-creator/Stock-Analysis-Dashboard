export function scoreTechnicalSignals(signals) {
  return boundedScore(50 + scoreSignals(signals, {
    price_above_sma: 10, price_above_ema: 10, rsi_oversold: 5, rsi_overbought: -5,
    macd_bullish: 15, macd_bearish: -15, above_bollinger_upper: -5, below_bollinger_lower: 5
  }));
}

export function scoreFundamentalSignals(signals) {
  return boundedScore(50 + scoreSignals(signals, {
    eps_growth_positive: 15, eps_growth_negative: -15,
    revenue_growth_positive: 15, revenue_growth_negative: -15,
    net_income_growth_positive: 15, net_income_growth_negative: -15,
    roe_positive: 10, roe_non_positive: -10
  }));
}

export function scoreChipSignals(signals) {
  return boundedScore(50 + scoreSignals(signals, {
    foreign_net_buy: 10, foreign_net_sell: -10,
    investment_trust_net_buy: 10, investment_trust_net_sell: -10,
    dealer_net_buy: 5, dealer_net_sell: -5,
    margin_balance_increasing: -5, margin_balance_decreasing: 5
  }));
}

function scoreSignals(signals, weights) {
  if (!Array.isArray(signals)) throw new TypeError('signals must be an array');
  return signals.reduce((sum, signal) => sum + (weights[signal] ?? 0), 0);
}

function boundedScore(value) {
  return Math.max(0, Math.min(100, value));
}

// Continuous fundamental score (research candidate, 2026-09-29): the same
// four inputs and relative weights (15/15/15/10) as scoreFundamentalSignals,
// but graded by size instead of sign, so companies stop piling up at the
// 100 cap. score = 50 + 50 x sum(weight x tanh(value / scale)) / sum(weights):
// 0..100 is reached only in the limit. The scales were fixed BEFORE any
// backtest (not fitted): a 30% revenue change, a 50% EPS or net income change
// and a 10% ROE each earn ~76% of their weight. A missing input contributes 0
// (neutral), never a guess.
export const CONTINUOUS_FUNDAMENTAL_SPEC = Object.freeze({
  revenueGrowth: { weight: 15, scale: 0.30 },
  epsGrowth: { weight: 15, scale: 0.50 },
  netIncomeGrowth: { weight: 15, scale: 0.50 },
  roe: { weight: 10, scale: 0.10 }
});

export function scoreFundamentalContinuous(inputs = {}) {
  let sum = 0, totalWeight = 0;
  for (const [name, { weight, scale }] of Object.entries(CONTINUOUS_FUNDAMENTAL_SPEC)) {
    totalWeight += weight;
    const value = inputs?.[name];
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    sum += weight * Math.tanh(value / scale);
  }
  return 50 + (50 * sum) / totalWeight;
}
