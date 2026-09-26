for (const q of ["GRIDDLE", "Griddle", "griddle cat"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const arr = await r.json();
  console.log(q, r.status, arr.length, JSON.stringify(arr.map(t => ({ s: t.symbol, n: t.name, v: t.isVerified, tags: t.tags, id: t.id }))));
}
