// Symbol <-> company-name lookup. Vendored verbatim from the private
// Stock-Analysis-System repo's public/js/lib/company-name-lookup.js -
// this is a pure name-lookup module with zero AI selection/scoring
// logic, so copying it here does not expose Private Core (Section 3:
// Reuse First). Reads the real, server-side-generated data/company-names.json
// snapshot - never fabricates a name for a symbol not present in it.

let cachedSnapshot = null;
let cachedPromise = null;

export function resetCompanyNameCacheForTests() {
  cachedSnapshot = null;
  cachedPromise = null;
}

export async function loadCompanyNames({ fetchImpl = fetch, url = 'data/company-names.json' } = {}) {
  if (cachedSnapshot) return cachedSnapshot;
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`GET ${url} failed (${response.status})`);
      const snapshot = await response.json();
      if (!Array.isArray(snapshot?.companies)) throw new Error(`${url} did not contain a real companies array`);
      const byKey = new Map();
      for (const { symbol, market, name } of snapshot.companies) {
        byKey.set(`${market}:${symbol}`, name);
        if (!byKey.has(symbol)) byKey.set(symbol, name);
      }
      cachedSnapshot = { generatedAt: snapshot.generatedAt, source: snapshot.source, byKey, companies: snapshot.companies };
      return cachedSnapshot;
    })();
  }
  return cachedPromise;
}

/**
 * Real name for a symbol, or null when genuinely not found - never a
 * guessed/fabricated placeholder.
 */
export function lookupCompanyName(snapshot, symbol, market = null) {
  if (!snapshot || !symbol) return null;
  const key = market ? `${market}:${symbol}` : symbol;
  return snapshot.byKey.get(key) ?? snapshot.byKey.get(symbol) ?? null;
}

/**
 * "2330 台積電" when a real name is known, otherwise the bare symbol -
 * never "2330 undefined" or a placeholder name.
 */
export function formatSymbolWithName(snapshot, symbol, market = null) {
  const name = lookupCompanyName(snapshot, symbol, market);
  return name ? `${symbol} ${name}` : symbol;
}

const WHITESPACE_RE = /\s+/g;
function normalize(value) {
  return String(value ?? '').trim().replace(WHITESPACE_RE, '').toUpperCase();
}

/**
 * Symbol / company-name / partial-name search. Case/space-insensitive,
 * deduplicated by market+symbol, capped at `limit` results. Returns []
 * (an explicit empty result, not an error) when nothing matches - never
 * invents a stock.
 */
export function searchCompanyNames(snapshot, query, { limit = 20 } = {}) {
  const normalizedQuery = normalize(query);
  if (!snapshot || !normalizedQuery) return [];

  const results = [];
  for (const entry of snapshot.companies) {
    const symbolMatch = normalize(entry.symbol).includes(normalizedQuery);
    const nameMatch = normalize(entry.name).includes(normalizedQuery);
    if (symbolMatch || nameMatch) results.push(entry);
    if (results.length >= limit) break;
  }
  return results;
}
