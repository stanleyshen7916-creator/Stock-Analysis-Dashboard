export function generateFundamentalSignals({ epsGrowth = null, revenueGrowth = null, netIncomeGrowth = null, roe = null }) {
  const signals = [];
  if (epsGrowth !== null) signals.push(epsGrowth > 0 ? 'eps_growth_positive' : 'eps_growth_negative');
  if (revenueGrowth !== null) signals.push(revenueGrowth > 0 ? 'revenue_growth_positive' : 'revenue_growth_negative');
  if (netIncomeGrowth !== null) signals.push(netIncomeGrowth > 0 ? 'net_income_growth_positive' : 'net_income_growth_negative');
  if (roe !== null) signals.push(roe > 0 ? 'roe_positive' : 'roe_non_positive');
  return signals;
}
