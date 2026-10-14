export function generateChipSignals({ foreignNet = null, investmentTrustNet = null, dealerNet = null, marginBalanceChange = null }) {
  const signals = [];
  if (Number.isFinite(foreignNet)) signals.push(foreignNet > 0 ? 'foreign_net_buy' : foreignNet < 0 ? 'foreign_net_sell' : 'foreign_neutral');
  if (Number.isFinite(investmentTrustNet)) signals.push(investmentTrustNet > 0 ? 'investment_trust_net_buy' : investmentTrustNet < 0 ? 'investment_trust_net_sell' : 'investment_trust_neutral');
  if (Number.isFinite(dealerNet)) signals.push(dealerNet > 0 ? 'dealer_net_buy' : dealerNet < 0 ? 'dealer_net_sell' : 'dealer_neutral');
  if (Number.isFinite(marginBalanceChange)) signals.push(marginBalanceChange > 0 ? 'margin_balance_increasing' : marginBalanceChange < 0 ? 'margin_balance_decreasing' : 'margin_balance_neutral');
  return signals;
}
