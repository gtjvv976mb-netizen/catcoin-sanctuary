for (const t of (process.argv.slice(2).length ? process.argv.slice(2) : ["PEWTER"])) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const m = arr.filter(x => String(x.symbol).toLowerCase() === t.toLowerCase());
    console.log(t, r.status, "results", arr.length, "symbolMatches", m.length, "verifiedMatch", m.some(x => x.isVerified === true), JSON.stringify(m.slice(0,4).map(x => ({s:x.symbol,n:x.name,v:x.isVerified,mc:Math.round(x.mcap||0)}))));
  } catch (e) { console.log(t, "ERR", e.message); }
}
