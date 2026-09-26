const tick = process.argv.slice(2);
for (const t of tick) {
  try {
    const r = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(t));
    const j = await r.json();
    const same = j.filter(x => String(x.symbol).toLowerCase() === t.toLowerCase());
    console.log(t, "status", r.status, "results", j.length, "sameSymbol", same.length, "verifiedSame", same.filter(x => x.isVerified).length,
      JSON.stringify(same.slice(0,5).map(x => ({s:x.symbol,n:x.name,v:x.isVerified,mcap:x.mcap,tags:x.tags}))));
  } catch (e) { console.log(t, "ERR", e.message); }
}
