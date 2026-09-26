const qs = process.argv.slice(2);
for (const q of qs) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
  const arr = await r.json();
  const m = arr.filter(t => String(t.symbol).toLowerCase() === q.toLowerCase());
  console.log(q, r.status, "results", arr.length, "symbolMatches", m.length, "verifiedMatch", m.some(t=>t.isVerified===true), m.slice(0,3).map(t=>`${t.symbol}|${t.name}|v=${t.isVerified}`).join("; "));
}
