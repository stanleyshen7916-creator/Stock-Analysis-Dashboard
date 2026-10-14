// Research-only Portfolio (v0.4.0, Issue #103; transactionDate/
// transactionAmount added MVP-2, Issue #126) - records what the user holds
// (Symbol, Shares, Average Cost, and optionally the simulated Transaction
// Amount/Date) so later work can compute Current Price/Unrealized P&L/
// Return/Weight and a research-use sell price/reason against it.
// Explicitly no brokerage/trading API integration - per the v0.4.0 spec,
// this phase only builds a personal record, never executes or tracks real
// trades.
//
// Same injectable-storage/graceful-degradation contract as
// public/js/lib/watchlist.js: persists to an optional Web Storage-shaped
// `storage` when provided, degrading to pure in-memory (never throwing)
// when storage is unavailable, full, or holds corrupted data.
//
// transactionDate/transactionAmount are additive and optional - a position
// without them (the original v0.4.0 shape) round-trips through add()/
// list()/storage with no extra keys at all, so every pre-existing test's
// exact-shape `assert.deepEqual` keeps passing unchanged and an
// already-persisted browser's positions from before this issue stay valid.

const STORAGE_KEY = 'stock-analysis-portfolio';
// M6 ("M5 → M7 Autonomous Execution Specification v1.0", Section 10):
// "實際持股最多 5 檔" - a hard ceiling on actual holdings, not a minimum.
const MAX_POSITIONS = 5;

function isValidTransactionDate(value) {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  // A simulated transaction cannot be dated in the future - reject rather
  // than silently accepting an impossible entry date.
  return !Number.isNaN(parsed) && parsed <= Date.now();
}

function isValidPosition(position) {
  const base = Boolean(position)
    && typeof position.symbol === 'string' && position.symbol.length > 0
    && Number.isFinite(position.shares) && position.shares > 0
    && Number.isFinite(position.averageCost) && position.averageCost > 0;
  if (!base) return false;
  if ('transactionAmount' in position && !(Number.isFinite(position.transactionAmount) && position.transactionAmount > 0)) return false;
  if ('transactionDate' in position && !isValidTransactionDate(position.transactionDate)) return false;
  return true;
}

function normalizePosition({ symbol, shares, averageCost, transactionDate, transactionAmount }) {
  const position = {
    symbol: String(symbol).trim().toUpperCase(),
    shares: Number(shares),
    averageCost: Number(averageCost)
  };
  // Only set when actually provided - never a fabricated null placeholder,
  // matching this project's normalize-record convention elsewhere
  // (e.g. src/fundamental/normalize.js).
  if (transactionDate != null) position.transactionDate = String(transactionDate);
  if (transactionAmount != null) position.transactionAmount = Number(transactionAmount);
  return position;
}

// Loads any previously persisted positions. Never throws - corrupted or
// unexpectedly-shaped data falls back to null ("nothing usable found"),
// letting the caller's `initial` list stand instead of crashing the
// dashboard over a supplementary feature.
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

export function createPortfolio(initial = [], { storage } = {}) {
  const persisted = storage ? loadFromStorage(storage) : null;
  let positions = (persisted ?? initial.map(normalizePosition)).filter(isValidPosition);

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {
      // Storage unavailable/full - the in-memory list (and this session's
      // UI) is unaffected; it just won't survive the next reload.
    }
  }

  return {
    /**
     * Adds or updates a position. Re-adding an already-held symbol
     * replaces it rather than duplicating it - a user re-entering the
     * same symbol almost certainly means "update my holding," not "track
     * it twice." Throws on invalid input (missing symbol, non-positive
     * shares/cost, or - if provided - a non-positive transactionAmount or
     * a future transactionDate) rather than silently coercing or
     * defaulting it.
     *
     * @param {object} [meta] - optional, additive. Omit entirely (or omit
     *   individual keys) for the original v0.4.0 behavior.
     * @param {string} [meta.transactionDate] - ISO date string, must not be in the future.
     * @param {number} [meta.transactionAmount] - total simulated transaction amount (positive).
     */
    add(symbol, shares, averageCost, meta = {}) {
      const position = normalizePosition({ symbol, shares, averageCost, transactionDate: meta.transactionDate, transactionAmount: meta.transactionAmount });
      if (!isValidPosition(position)) {
        throw new Error('Invalid position: symbol, a positive share count, and a positive average cost are required (and, if provided, a positive transaction amount and a not-in-the-future transaction date)');
      }
      const isReplacement = positions.some((p) => p.symbol === position.symbol);
      if (!isReplacement && positions.length >= MAX_POSITIONS) {
        throw new Error(`Actual holdings are limited to ${MAX_POSITIONS} positions`);
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
    has(symbol) {
      return positions.some((p) => p.symbol === String(symbol).trim().toUpperCase());
    },
    list() { return [...positions]; }
  };
}
