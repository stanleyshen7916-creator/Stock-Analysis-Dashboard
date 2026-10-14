const STORAGE_KEY = 'stock-analysis-watchlist';

// Loads any previously persisted symbol list. Never throws - corrupted or
// unexpectedly-shaped data (a user editing localStorage directly, a future
// format change) falls back to null (meaning "nothing usable was found"),
// letting the caller's `initial` list stand instead of crashing the
// dashboard over a supplementary feature.
function loadFromStorage(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : null;
  } catch {
    return null;
  }
}

/**
 * `storage` is an optional injectable Web Storage-shaped object (same
 * dependency-injection pattern already used for `fetchImpl` elsewhere in
 * this codebase, for testability) - when provided, the watchlist persists
 * across reloads; when omitted, behavior is unchanged from before (pure
 * in-memory, cleared on reload). A storage that is unavailable (private
 * browsing, disabled), full (quota exceeded), or holding corrupted data
 * degrades to in-memory-only for the rest of the session rather than
 * throwing - a user's watchlist is a convenience, not something that may
 * ever break the primary stock-lookup flow.
 */
export function createWatchlist(initial = [], { storage } = {}) {
  const persisted = storage ? loadFromStorage(storage) : null;
  const symbols = new Set((persisted ?? initial).map((s) => String(s).toUpperCase()));

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify([...symbols]));
    } catch {
      // Storage unavailable/full - the in-memory list (and this session's
      // UI) is unaffected; it just won't survive the next reload.
    }
  }

  return {
    add(symbol) { symbols.add(String(symbol).toUpperCase()); persist(); return [...symbols]; },
    remove(symbol) { symbols.delete(String(symbol).toUpperCase()); persist(); return [...symbols]; },
    has(symbol) { return symbols.has(String(symbol).toUpperCase()); },
    list() { return [...symbols]; }
  };
}
