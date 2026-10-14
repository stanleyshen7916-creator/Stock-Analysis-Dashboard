export function calculateInstitutionalFlow(rows) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  return rows.map((row) => ({
    tradingDate: row.tradingDate,
    foreignNet: finiteOrNull(row.foreignBuy, row.foreignSell),
    investmentTrustNet: finiteOrNull(row.investmentTrustBuy, row.investmentTrustSell),
    dealerNet: finiteOrNull(row.dealerBuy, row.dealerSell)
  }));
}

function finiteOrNull(buy, sell) {
  if (!Number.isFinite(buy) || !Number.isFinite(sell)) return null;
  return buy - sell;
}

export function aggregateInstitutionalFlow(row) {
  const values = [row.foreignNet, row.investmentTrustNet, row.dealerNet].filter(Number.isFinite);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}
