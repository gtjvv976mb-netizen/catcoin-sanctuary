const tickers = process.argv.slice(2);
for (const t of tickers) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
  const j = await r.json();
  const same = (Array.isArray(j) ? j : []).filter((x) => String(x.symbol).toLowerCase() === t.toLowerCase());
  console.log(t, "http", r.status, "results", Array.isArray(j) ? j.length : "?", "| symbol matches:", same.length, "| verified matches:", same.filter((x) => x.isVerified).length,
    same.slice(0, 5).map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}/mcap=${Math.round(x.mcap ?? 0)}`).join(" ; "));
}
