// Observation List for M5 Simulation ("M5 → M7 Autonomous Execution
// Specification v1.0", Section 5) - records which stocks Stanley chose to
// simulate and when, so later work can replay the existing recommendation
// engine against real market_daily history as of any date. Explicitly no
// brokerage/trading API integration - this is a personal research record,
// never a real or automated trade.
//
// Same injectable-storage/graceful-degradation contract as
// public/js/lib/watchlist.js and portfolio.js: persists to an optional
// Web Storage-shaped `storage` when provided, degrading to pure in-memory
// (never throwing) when storage is unavailable, full, or holds corrupted
// data.

import { computeAverageCost, computeSimulationPerformance, evaluatePredictionOutcomes, sliceRecordsUpTo, PREDICTION_HORIZONS_TRADING_DAYS, classifySimulationOutcome, SIMULATION_OUTCOME } from '../../vendor/calc/simulation.js';

// Re-exported so app.js's Simulation panel can reach the daily-analysis
// functions through this one lib module (matching the layering every
// other public/js/lib/*.js file already uses - app.js never imports
// vendor/calc/* directly).
export { computeSimulationPerformance, evaluatePredictionOutcomes, sliceRecordsUpTo, PREDICTION_HORIZONS_TRADING_DAYS, classifySimulationOutcome, SIMULATION_OUTCOME };

const STORAGE_KEY = 'stock-analysis-simulation';
// Section 5/9: "可建立 5～10 檔模擬觀察股" - a hard ceiling, not a minimum
// (Stanley must be able to add the 1st entry before reaching 5).
const MAX_ENTRIES = 10;

function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && parsed <= Date.now();
}

function isValidEntry(entry) {
  return Boolean(entry)
    && typeof entry.symbol === 'string' && entry.symbol.length > 0
    && isValidDateString(entry.observationDate)
    && isValidDateString(entry.purchaseDate)
    && Number.isFinite(entry.purchaseAmount) && entry.purchaseAmount > 0
    && Number.isFinite(entry.shares) && entry.shares > 0
    && Number.isFinite(entry.averageCost) && entry.averageCost > 0;
}

function normalizeEntry({ symbol, observationDate, purchaseDate, purchaseAmount, shares, note }) {
  const entry = {
    symbol: String(symbol).trim().toUpperCase(),
    observationDate: String(observationDate),
    purchaseDate: String(purchaseDate),
    purchaseAmount: Number(purchaseAmount),
    shares: Number(shares),
    averageCost: computeAverageCost({ purchaseAmount: Number(purchaseAmount), shares: Number(shares) })
  };
  // Only set when actually provided - never a fabricated empty-string placeholder.
  if (note != null && String(note).trim().length > 0) entry.note = String(note).trim();
  return entry;
}

function loadFromStorage(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isValidEntry);
  } catch {
    return null;
  }
}

export function createSimulationList(initial = [], { storage } = {}) {
  const persisted = storage ? loadFromStorage(storage) : null;
  let entries = (persisted ?? initial.filter(isValidEntry)).filter(isValidEntry);

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage unavailable/full - the in-memory list (and this session's UI) is unaffected.
    }
  }

  return {
    /**
     * Adds an observation entry. Re-adding an already-observed symbol
     * replaces it (matches portfolio.js's convention) rather than
     * duplicating it. Throws on invalid input or when MAX_ENTRIES would
     * be exceeded by a genuinely NEW symbol - never silently drops or
     * truncates the list.
     */
    add(symbol, observationDate, purchaseDate, purchaseAmount, shares, meta = {}) {
      const normalizedSymbol = String(symbol).trim().toUpperCase();
      const isReplacement = entries.some((e) => e.symbol === normalizedSymbol);
      if (!isReplacement && entries.length >= MAX_ENTRIES) {
        throw new Error(`Observation List is limited to ${MAX_ENTRIES} entries`);
      }
      const entry = normalizeEntry({ symbol, observationDate, purchaseDate, purchaseAmount, shares, note: meta.note });
      if (!isValidEntry(entry)) {
        throw new Error('Invalid observation entry: symbol, a valid observationDate/purchaseDate (not in the future), a positive purchaseAmount, and a positive share count are required');
      }
      entries = entries.filter((e) => e.symbol !== entry.symbol);
      entries.push(entry);
      persist();
      return [...entries];
    },
    remove(symbol) {
      const normalizedSymbol = String(symbol).trim().toUpperCase();
      entries = entries.filter((e) => e.symbol !== normalizedSymbol);
      persist();
      return [...entries];
    },
    has(symbol) {
      return entries.some((e) => e.symbol === String(symbol).trim().toUpperCase());
    },
    list() { return [...entries]; }
  };
}
