for (const q of ["HENNA","RUSTLE","FLINT","HENNAPAW","RUSTLEPAW","FLINTPAW"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const j = await r.json(); const a = Array.isArray(j) ? j : (j.tokens ?? []);
  console.log(q, r.status, a.length, JSON.stringify(a.filter(t => String(t.symbol).toUpperCase() === q).map(t => [t.symbol, t.name, t.isVerified])), "| verified any:", JSON.stringify(a.filter(t=>t.isVerified).map(t=>[t.symbol,t.name]).slice(0,5)));
}
