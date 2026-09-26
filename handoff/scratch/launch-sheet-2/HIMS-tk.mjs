for (const t of process.argv.slice(2)) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const m = arr.filter(x => String(x.symbol).toUpperCase() === t);
  console.log(t, r.status, arr.length, JSON.stringify(m.map(x => ({ s: x.symbol, n: x.name, v: x.isVerified }))));
}
