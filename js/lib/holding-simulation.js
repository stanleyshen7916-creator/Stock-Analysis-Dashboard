// Stock Detail "持倉與模擬輸入" + "AI 建議售出價格" (front-end-only
// simulation, never persisted - Section 17: no DB write, no Production
// data mutation, no broker/order API). Pure arithmetic functions over
// user-entered numbers plus the existing Recommendation Engine's own
// real Target Price - never a second Target Price calculation, never a
// guessed price. Unit: shares are entered in 張 (lots of 1,000 shares,
// the standard TWSE/TPEx convention) per the spec's own explicit
// formulas - this is a new, isolated, non-persisted field that never
// reads or writes the existing Portfolio feature's raw-share data model,
// so there is no existing unit contract being overridden.

const SHARES_PER_LOT = 1000;

/**
 * @param {number} averagePurchasePrice - price per share, NT$.
 * @param {number} shares - 張 (lots).
 * @param {number} currentPrice - price per share, NT$ (defaults to the real current price, but the user may override it for simulation).
 * @returns {{status:'AVAILABLE'|'INVALID_INPUT', reason?:string, totalInvested:number|null, currentMarketValue:number|null, currentPnl:number|null, currentReturnPercent:number|null}}
 */
export function computeHoldingSimulation({ averagePurchasePrice, shares, currentPrice }) {
  if (!Number.isFinite(averagePurchasePrice) || averagePurchasePrice <= 0) {
    return { status: 'INVALID_INPUT', reason: 'PURCHASE_PRICE_NOT_POSITIVE', totalInvested: null, currentMarketValue: null, currentPnl: null, currentReturnPercent: null };
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    return { status: 'INVALID_INPUT', reason: 'SHARES_NOT_POSITIVE', totalInvested: null, currentMarketValue: null, currentPnl: null, currentReturnPercent: null };
  }
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { status: 'INVALID_INPUT', reason: 'CURRENT_PRICE_NOT_POSITIVE', totalInvested: null, currentMarketValue: null, currentPnl: null, currentReturnPercent: null };
  }

  const totalInvested = averagePurchasePrice * shares * SHARES_PER_LOT;
  const currentMarketValue = currentPrice * shares * SHARES_PER_LOT;
  const currentPnl = currentMarketValue - totalInvested;
  // totalInvested > 0 is already guaranteed by the guards above (both
  // factors are positive), so this can never divide by zero - the
  // Number.isFinite check is defensive, not reachable in practice.
  const currentReturnPercent = totalInvested > 0 ? (currentPnl / totalInvested) * 100 : null;

  return { status: 'AVAILABLE', totalInvested, currentMarketValue, currentPnl, currentReturnPercent };
}

/**
 * @param {number} averagePurchasePrice
 * @param {number} shares - 張 (lots).
 * @param {number|null} suggestedSellPrice - the Recommendation Engine's real Target Price, or null when UNAVAILABLE.
 */
export function computeSellSimulation({ averagePurchasePrice, shares, suggestedSellPrice }) {
  if (!Number.isFinite(averagePurchasePrice) || averagePurchasePrice <= 0) return { status: 'INVALID_INPUT', estimatedReturnPercent: null, estimatedPnl: null };
  if (!Number.isFinite(shares) || shares <= 0) return { status: 'INVALID_INPUT', estimatedReturnPercent: null, estimatedPnl: null };
  if (!Number.isFinite(suggestedSellPrice)) return { status: 'TARGET_PRICE_UNAVAILABLE', estimatedReturnPercent: null, estimatedPnl: null };

  const estimatedReturnPercent = ((suggestedSellPrice - averagePurchasePrice) / averagePurchasePrice) * 100;
  const estimatedPnl = (suggestedSellPrice - averagePurchasePrice) * shares * SHARES_PER_LOT;
  return { status: 'AVAILABLE', estimatedReturnPercent, estimatedPnl };
}
