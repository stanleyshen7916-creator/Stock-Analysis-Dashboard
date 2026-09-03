// TEMPORARY diagnostic probe for Issue #5 (verify whether the Dashboard's
// own fetchFundamentals() is exposed to the same mixed monthly/quarterly
// reporting_period sort defect fixed in the private repo (Issue #179)).
// Read-only, anon key only (same non-secret key already in config.js).
// To be removed before the final commit.
const url = 'https://kvffithbxqstrpbausbo.supabase.co';
const anonKey = 'sb_publishable_tt4X-E1hjMyg5DGXoiK_0Q_EtoNxLc4';

async function get(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  return response.json();
}

const top50 = await get('market_top50?select=symbol,market,calculation_date&order=calculation_date.desc&limit=50');
console.log('top50 sample size:', top50.length);

let affected = 0;
for (const row of top50) {
  const fundamentals = await get(`fundamentals?symbol=eq.${row.symbol}&market=eq.${row.market}&order=reporting_period.desc&limit=3`);
  if (fundamentals.length === 0) continue;
  const first = fundamentals[0];
  const isQuarterly = /^\d{4}-Q\d$/.test(first.reporting_period);
  if (isQuarterly) {
    affected += 1;
    const epsMissing = first.eps == null;
    const bvpsMissing = first.book_value_per_share == null;
    if (epsMissing || bvpsMissing) {
      console.log(`NULL-FIELDS: ${row.symbol} (${row.market}) top=${JSON.stringify({ p: first.reporting_period, eps: first.eps, bvps: first.book_value_per_share })} full=${JSON.stringify(fundamentals.map((f) => ({ p: f.reporting_period, eps: f.eps, bvps: f.book_value_per_share, revenue: f.revenue })))}`);
    }
  }
}
console.log(`checked ${top50.length} Top50 symbols, ${affected} have a quarterly row at periods[0]; NULL-FIELDS lines above show where eps/book_value_per_share is actually missing on that top row despite an older row possibly having it`);
