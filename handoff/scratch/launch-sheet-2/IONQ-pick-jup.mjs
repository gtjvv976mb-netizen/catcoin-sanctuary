const qs = process.argv.slice(2);
for (const q of qs) {
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const up = q.toUpperCase();
  console.log(JSON.stringify({ q, status: res.status, results: arr.length,
    symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === up).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, tags: t.tags, id: t.id })),
    verified: arr.filter(t => t.isVerified).map(t => `${t.symbol}:${t.name}`) }));
}
