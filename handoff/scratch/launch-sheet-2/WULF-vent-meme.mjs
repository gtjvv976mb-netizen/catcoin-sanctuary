for (const q of ["VENT", "cat in vent", "vent cat", "DIGBY", "LAKEGLASS", "WARMVENT", "WARM"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  console.log("==", q, r.status, arr.length);
  for (const t of arr.filter(t => /vent|digby|lakeglass|warm/i.test(t.symbol + " " + t.name)).slice(0, 10)) console.log(JSON.stringify({ s: t.symbol, n: t.name, v: t.isVerified, mcap: t.mcap, fdv: t.fdv, holders: t.holderCount, liq: t.liquidity, organic: t.organicScoreLabel, created: t.firstPool?.createdAt, tags: t.tags }));
}
