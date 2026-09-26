for (const t of process.argv.slice(2)) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const m = arr.filter(x => String(x.symbol).toLowerCase() === t.toLowerCase());
    console.log(t, r.status, "results", arr.length, "symMatches", m.length, "verifiedMatch", m.some(x=>x.isVerified===true), m.slice(0,3).map(x=>`${x.name}|v=${x.isVerified}`).join("; "));
  } catch (e) { console.log(t, "ERR", String(e)); }
}
