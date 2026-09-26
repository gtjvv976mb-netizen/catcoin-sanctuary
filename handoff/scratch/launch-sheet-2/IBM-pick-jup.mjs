const qs = process.argv.slice(2);
for (const q of qs) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const sym = arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase());
    console.log(q, "HTTP", r.status, "results", arr.length, "symbolMatches", JSON.stringify(sym.map(t => ({ s: t.symbol, n: t.name, v: t.isVerified, tags: t.tags }))), "verifiedAny", JSON.stringify(arr.filter(t=>t.isVerified).map(t=>t.symbol+"|"+t.name)));
  } catch (e) { console.log(q, "ERR", String(e), e.cause?.code); }
}
