const tickers = process.argv.slice(2);
for (const t of tickers) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(t)}`);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.tokens || []);
  const same = arr.filter((x) => String(x.symbol).toLowerCase() === t.toLowerCase());
  const verified = same.filter((x) => x.isVerified);
  console.log(t, "| status", r.status, "| results", arr.length, "| same-symbol", same.length, "| same-symbol verified", verified.length,
    same.slice(0, 5).map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}/mcap=${Math.round(x.mcap||0)}`).join("; "));
}
