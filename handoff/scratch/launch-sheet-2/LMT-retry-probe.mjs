const r = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=VELVET");
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
console.log(r.status, arr.length, Object.keys(arr[0]??{}).join(","));
console.log(arr.slice(0,3).map(t=>({s:t.symbol,n:t.name,v:t.isVerified,tags:t.tags})));
