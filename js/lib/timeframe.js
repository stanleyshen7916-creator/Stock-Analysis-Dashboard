function dateKey(value) { return String(value).slice(0, 10); }

export function aggregateTimeframe(records, timeframe = 'D') {
  if (timeframe === 'D') return [...records];
  const buckets = new Map();
  for (const row of records) {
    const date = new Date(`${dateKey(row.tradingDate)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    let key;
    if (timeframe === 'W') {
      const day = date.getUTCDay(); const mondayOffset = (day + 6) % 7;
      date.setUTCDate(date.getUTCDate() - mondayOffset); key = date.toISOString().slice(0,10);
    } else if (timeframe === 'M') {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-01`;
    } else throw new RangeError('unsupported timeframe');
    const current = buckets.get(key);
    if (!current) buckets.set(key, { ...row, tradingDate: key });
    else {
      current.high = Math.max(current.high, row.high); current.low = Math.min(current.low, row.low);
      current.close = row.close; current.volume += Number(row.volume) || 0;
    }
  }
  return [...buckets.values()].sort((a,b) => String(a.tradingDate).localeCompare(String(b.tradingDate)));
}
