// Thin browser wrapper (M7 Phase 1, Issue #148) - re-exports the vendored,
// import-free src/analysis/algorithm-config.js unchanged, matching the
// simulation.js/holding-risk.js wrapper convention already used in this
// directory. No browser-specific logic needed here: the Algorithm
// Configuration table is static, read-only data, not derived from any
// per-symbol fetch.
export { getAlgorithmConfiguration } from '../../vendor/calc/algorithm-config.js';
