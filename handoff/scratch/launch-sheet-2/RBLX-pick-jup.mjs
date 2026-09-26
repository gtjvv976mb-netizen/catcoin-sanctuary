for (const q of ["RBLX", "TARTANPAW", "tartanpaw", "TARTAN"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
  const arr = await r.json();
  console.log(q, r.status, arr.length, JSON.stringify(arr.slice(0, 6).map(t => ({ s: t.symbol, n: t.name, v: t.isVerified, tags: t.tags }))));
}
