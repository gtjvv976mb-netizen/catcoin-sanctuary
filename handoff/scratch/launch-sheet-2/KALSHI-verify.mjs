const qs = process.argv.slice(2);
for (const q of qs) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const m = arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase());
    console.log(q, "HTTP", r.status, "results", arr.length, "symbolMatches", m.length, "verifiedMatch", m.some(t=>t.isVerified===true));
    for (const t of arr.slice(0,8)) console.log("   ", t.symbol, "|", t.name, "| verified:", t.isVerified, "|", t.id);
  } catch (e) { console.log(q, "ERR", String(e)); }
}
