// Candidate Algorithm Version store (M7 Phase 2, Sections 19-21, Issue
// #150). Same injectable-storage/graceful-degradation contract as
// watchlist.js/portfolio.js/simulation.js: persists to an optional Web
// Storage-shaped `storage` when provided, degrades to pure in-memory
// (never throwing) when storage is unavailable, full, or holds corrupted
// data. See Issue #150's Evidence Audit for why this is client-side
// rather than a new Production table (no Production Schema Change).
//
// This store never reads or writes the live algorithm's real constants
// (composite-score.js/layer-score.js/target-price.js/expected-return.js)
// - it only holds proposed, not-yet-decided candidate records. Promoting
// a candidate to "live" is a manual code change Stanley makes outside
// this app (Section 21).

import { buildCandidateVersion, withValidationResult, nextVersionLabel } from '../../vendor/calc/algorithm-version.js';

export { buildCandidateVersion, withValidationResult, nextVersionLabel };

const STORAGE_KEY = 'stock-analysis-algorithm-versions';
// "v1.0" is the implicit label for the currently-live Locked Baseline
// itself (never an entry in this store - it's not a candidate, it's what
// candidates are proposed against).
const LIVE_BASELINE_VERSION = 'v1.0';

function isValidVersionRecord(record) {
  return Boolean(record)
    && typeof record.version === 'string' && record.version.length > 0
    && typeof record.change === 'string' && record.change.length > 0
    && typeof record.reason === 'string' && record.reason.length > 0
    && typeof record.changedDate === 'string' && record.changedDate.length > 0;
}

function loadFromStorage(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isValidVersionRecord);
  } catch {
    return null;
  }
}

export function createAlgorithmVersionStore(initial = [], { storage } = {}) {
  const persisted = storage ? loadFromStorage(storage) : null;
  let versions = (persisted ?? initial.filter(isValidVersionRecord)).filter(isValidVersionRecord);

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(versions));
    } catch {
      // Storage unavailable/full - the in-memory list (and this session's UI) is unaffected.
    }
  }

  return {
    /** The most recent version label to propose the next candidate against - LIVE_BASELINE_VERSION if none exist yet. */
    latestVersionLabel() {
      return versions.length > 0 ? versions[versions.length - 1].version : LIVE_BASELINE_VERSION;
    },
    /**
     * Proposes a new candidate version against the current latest
     * version. Throws (never silently saves) on a Section 19
     * safety-check failure via buildCandidateVersion() - weights must
     * sum to 100%, thresholds must be finite numbers.
     */
    propose({ change, reason, newWeights, previousWeights, newThreshold, previousThreshold, changedBy, changedDate }) {
      const candidate = buildCandidateVersion({
        previousVersion: this.latestVersionLabel(),
        change, reason, newWeights, previousWeights, newThreshold, previousThreshold, changedBy, changedDate
      });
      versions.push(candidate);
      persist();
      return [...versions];
    },
    /** Attaches a real backtest comparison result to an existing candidate - never mutates it in place, replaces the stored entry with the new object (Section 20: history is never overwritten). */
    attachValidationResult(version, result) {
      const index = versions.findIndex((v) => v.version === version);
      if (index === -1) throw new Error(`No candidate version "${version}" exists`);
      versions[index] = withValidationResult(versions[index], result);
      persist();
      return [...versions];
    },
    remove(version) {
      versions = versions.filter((v) => v.version !== version);
      persist();
      return [...versions];
    },
    list() { return [...versions]; }
  };
}
