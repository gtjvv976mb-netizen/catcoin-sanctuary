const qs = process.argv.slice(2);
for (const q of qs) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const m = arr.filter(t => String(t.symbol).toLowerCase() === q.toLowerCase());
    console.log(q, r.status, "results", arr.length, "symbolMatches", JSON.stringify(m.map(t => ({ s: t.symbol, n: t.name, v: t.isVerified, id: t.id, mcap: t.mcap }))));
  } catch (e) { console.log(q, "ERR", String(e)); }
}
