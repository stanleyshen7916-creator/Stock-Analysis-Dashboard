// Locked priority cohort for AI/ETF investment research.
// This is an inclusion layer only: scoring remains the existing
// recommendation engine and ranking contract.
export const AI_PRIORITY_SYMBOLS = [
  '2330','2454','2303','3661','3443','3035','2317','2382','3231','6669',
  '2345','3017','3324','3037','8046','3189','3363','4979','3450','3081',
  '2308','1513','1503','2408','2344','3260','3711','6239','2376','2356',
  '2357','2379','3008','4966','5274'
];

export const ETF_PRIORITY_SYMBOLS = [
  '0050','006208','0056','0052','00881','00935','00962',
  '00990A','00405A','00981A','00401A'
];

export const PRIORITY_SYMBOLS = [...new Set([...AI_PRIORITY_SYMBOLS, ...ETF_PRIORITY_SYMBOLS])];

export function isPrioritySymbol(symbol) {
  return PRIORITY_SYMBOLS.includes(String(symbol).trim().toUpperCase());
}
