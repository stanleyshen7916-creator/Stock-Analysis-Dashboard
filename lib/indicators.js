// Vendored technical-indicator functions (VENDOR-SYNC - see docs/VENDOR_SYNC.md).
//
// Copied verbatim from the private stock-analysis-system repo:
//   source file:   src/indicators/index.mjs
//   source commit: 85f0c973c11ca34e7f116faa8f8d509cc19f612d (2026-08-26)
//
// These are pure, non-scoring presentation-layer functions (moving
// averages, RSI, MACD, Bollinger Bands, ATR, Stochastic) used ONLY to
// render technical-indicator values in the 個股分析 chart/indicator panel
// from real market_daily OHLCV already fetched from Supabase. They never
// recompute the Production recommendation score/decision - that logic
// (recommendation-engine.js) stays exclusively in the private repo and is
// never shipped here.
//
// If you change a formula here, the two repos have drifted apart. Do NOT
// edit this file in isolation:
//   1. Make the change in the private repo's src/indicators/index.mjs first.
//   2. Copy the changed function(s) here verbatim, update the source-commit
//      SHA above.
//   3. Regenerate lib/indicators-vendor-sync-fixture.json from the private
//      repo's real functions (see docs/VENDOR_SYNC.md for the exact command)
//      and confirm scripts/qa-indicator-vendor-sync.mjs still passes.
// scripts/qa-indicator-vendor-sync.mjs (run in CI on every PR) will catch a
// copy-paste mistake or a forgotten fixture update, but it CANNOT detect a
// change made only on the private-repo side that nobody re-synced here -
// that half of the drift risk is still a manual discipline, not automated.

function nums(values) {
  if (!Array.isArray(values)) throw new TypeError('values must be an array');
  return values.map((v) => (v == null ? null : Number(v)));
}
function ema(values, period) { const v=nums(values),out=Array(v.length).fill(null); if(!Number.isInteger(period)||period<1)throw new RangeError('period must be positive integer'); let seed=0,count=0,prev=null; const alpha=2/(period+1); for(let i=0;i<v.length;i++){if(!Number.isFinite(v[i])){count=0;seed=0;prev=null;continue;} if(prev==null){seed+=v[i];count++;if(count===period){prev=seed/period;out[i]=prev;}}else{prev=(v[i]-prev)*alpha+prev;out[i]=prev;}} return out; }
export function sma(values,period=20){const v=nums(values),out=Array(v.length).fill(null);if(!Number.isInteger(period)||period<1)throw new RangeError('period must be positive integer');for(let i=period-1;i<v.length;i++){const s=v.slice(i-period+1,i+1);if(s.every(Number.isFinite))out[i]=s.reduce((a,b)=>a+b,0)/period;}return out;}
export { ema };
export function rsi(values,period=14){const v=nums(values),out=Array(v.length).fill(null);if(period<1)throw new RangeError('period must be positive integer');let gains=0,losses=0,prev=null,count=0;for(let i=0;i<v.length;i++){if(!Number.isFinite(v[i])){prev=null;gains=0;losses=0;count=0;continue;}if(prev==null){prev=v[i];continue;}const d=v[i]-prev;prev=v[i];gains+=Math.max(d,0);losses+=Math.max(-d,0);count++;if(count===period){let ag=gains/period,al=losses/period;out[i]=al===0?100:100-(100/(1+ag/al));for(let j=i+1;j<v.length;j++){if(!Number.isFinite(v[j]))break;const x=v[j]-v[j-1];ag=((ag*(period-1))+Math.max(x,0))/period;al=((al*(period-1))+Math.max(-x,0))/period;out[j]=al===0?100:100-(100/(1+ag/al));}break;}}return out;}
export function macd(values,fastPeriod=12,slowPeriod=26,signalPeriod=9){const fast=ema(values,fastPeriod),slow=ema(values,slowPeriod),line=fast.map((x,i)=>x==null||slow[i]==null?null:x-slow[i]),compact=[],indices=[];line.forEach((x,i)=>{if(x!=null){compact.push(x);indices.push(i);}});const sc=ema(compact,signalPeriod),signal=Array(line.length).fill(null),histogram=Array(line.length).fill(null);indices.forEach((idx,j)=>{signal[idx]=sc[j];if(signal[idx]!=null)histogram[idx]=line[idx]-signal[idx];});return{macd:line,signal,histogram};}
export function bollingerBands(values,period=20,multiplier=2){const v=nums(values),middle=sma(v,period),upper=Array(v.length).fill(null),lower=Array(v.length).fill(null),bandwidth=Array(v.length).fill(null);for(let i=period-1;i<v.length;i++){const s=v.slice(i-period+1,i+1);if(!s.every(Number.isFinite))continue;const m=middle[i],sd=Math.sqrt(s.reduce((a,x)=>a+(x-m)**2,0)/period);upper[i]=m+multiplier*sd;lower[i]=m-multiplier*sd;bandwidth[i]=m===0?null:(upper[i]-lower[i])/m;}return{middle,upper,lower,bandwidth};}
export function atr(high,low,close,period=14){const h=nums(high),l=nums(low),c=nums(close);if(h.length!==l.length||h.length!==c.length)throw new RangeError('OHLC arrays must have equal length');const tr=Array(c.length).fill(null),out=Array(c.length).fill(null);for(let i=1;i<c.length;i++){if(!Number.isFinite(h[i])||!Number.isFinite(l[i])||!Number.isFinite(c[i])||!Number.isFinite(c[i-1]))continue;tr[i]=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]));}let sum=0,count=0,prev=null;for(let i=1;i<tr.length;i++){if(tr[i]==null){sum=0;count=0;prev=null;continue;}if(prev==null){sum+=tr[i];count++;if(count===period){prev=sum/period;out[i]=prev;}}else{prev=((prev*(period-1))+tr[i])/period;out[i]=prev;}}return out;}
export function stochastic(high,low,close,kPeriod=9,dPeriod=3,smoothK=3){const h=nums(high),l=nums(low),c=nums(close);if(h.length!==l.length||h.length!==c.length)throw new RangeError('OHLC arrays must have equal length');const rawK=Array(c.length).fill(null);for(let i=kPeriod-1;i<c.length;i++){const hs=h.slice(i-kPeriod+1,i+1),ls=l.slice(i-kPeriod+1,i+1);if(!hs.every(Number.isFinite)||!ls.every(Number.isFinite)||!Number.isFinite(c[i]))continue;const hi=Math.max(...hs),lo=Math.min(...ls);rawK[i]=hi===lo?0:100*(c[i]-lo)/(hi-lo);}return{k:sma(rawK,smoothK),d:sma(sma(rawK,smoothK),dPeriod)};}
