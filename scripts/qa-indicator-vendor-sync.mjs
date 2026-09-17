// Vendor-sync drift check for lib/indicators.js (docs/VENDOR_SYNC.md).
//
// lib/indicators-vendor-sync-fixture.json was generated once by running the
// PRIVATE stock-analysis-system repo's real src/indicators/index.mjs
// functions against a fixed synthetic OHLCV series (see the file header for
// the exact source commit). This script re-runs the SAME fixed input
// through this repo's vendored copy and asserts byte-identical output.
//
// What this catches: a copy-paste mistake, or an edit made to the vendored
// copy in isolation without regenerating the fixture from the private repo.
// What this CANNOT catch: a formula change made only on the private-repo
// side that nobody re-synced here - the fixture itself would need
// regenerating from the private repo to detect that half of the drift.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sma, ema, rsi, macd, bollingerBands, atr, stochastic } from '../lib/indicators.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(root, '..', 'lib', 'indicators-vendor-sync-fixture.json'), 'utf8'));
const { close, high, low } = fixture.input;

const actual = {
  sma20: sma(close, 20),
  ema20: ema(close, 20),
  rsi14: rsi(close, 14),
  macd: macd(close),
  bollinger20: bollingerBands(close, 20, 2),
  atr14: atr(high, low, close, 14),
  stochastic: stochastic(high, low, close, 9, 3, 3)
};

const expectedJson = JSON.stringify(fixture.expected);
const actualJson = JSON.stringify(actual);

if (actualJson !== expectedJson) {
  console.error('VENDOR-SYNC DRIFT DETECTED: lib/indicators.js no longer matches lib/indicators-vendor-sync-fixture.json.');
  console.error('If this change was intentional (private repo formula updated and re-synced here), regenerate the fixture from the private repo and commit it alongside this change.');
  console.error('If this change was NOT intentional, lib/indicators.js has a bug relative to its private-repo source.');
  console.error('Expected:', expectedJson);
  console.error('Actual:  ', actualJson);
  process.exitCode = 1;
} else {
  console.log('Vendor-sync check PASSED: lib/indicators.js matches the fixture generated from the private repo.');
}
