// M21 (M11-M23 Dashboard spec v1): My Portfolio - a personal holdings
// record only (symbol/company name/shares/cost/purchase date/note).
// Explicitly NOT a trading system: no broker API, no order placement
// anywhere in this module or its callers (spec Section 10).
//
// Same injectable-storage/graceful-degradation contract already
// established in the private repo's public/js/lib/portfolio.js and
// watchlist.js: persists to `storage` when provided, degrades to
// in-memory (never throws) when storage is unavailable/full/corrupted.

const STORAGE_KEY = 'sad_portfolio_v1';

function isValidPosition(position) {
  return Boolean(position)
    && typeof position.symbol === 'string' && position.symbol.length > 0
    && Number.isFinite(position.shares) && position.shares > 0
    && Number.isFinite(position.averageCost) && position.averageCost > 0;
}

function normalizePosition({ symbol, name, market, shares, averageCost, purchaseDate, note }) {
  const position = {
    symbol: String(symbol).trim().toUpperCase(),
    market: market ?? null,
    shares: Number(shares),
    averageCost: Number(averageCost)
  };
  if (name != null) position.name = String(name);
  if (purchaseDate != null) position.purchaseDate = String(purchaseDate);
  if (note != null) position.note = String(note);
  return position;
}

function loadFromStorage(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(normalizePosition).filter(isValidPosition);
  } catch {
    return null;
  }
}

export function createPortfolio({ storage } = {}) {
  let positions = (storage ? loadFromStorage(storage) : null) ?? [];

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {
      // Storage unavailable/full - in-memory state for this session is unaffected.
    }
  }

  return {
    add(fields) {
      const position = normalizePosition(fields);
      if (!isValidPosition(position)) {
        throw new Error('Invalid position: symbol, a positive share count, and a positive average cost are required');
      }
      positions = positions.filter((p) => p.symbol !== position.symbol);
      positions.push(position);
      persist();
      return [...positions];
    },
    remove(symbol) {
      const normalizedSymbol = String(symbol).trim().toUpperCase();
      positions = positions.filter((p) => p.symbol !== normalizedSymbol);
      persist();
      return [...positions];
    },
    list() { return [...positions]; }
  };
}
