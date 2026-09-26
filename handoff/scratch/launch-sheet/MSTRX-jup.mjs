const tickers = ["STASH","STASHCAT","STASHPAW","STASHY","COFFER","COFFERCAT","COFFERPAW","TALLY","TALLYCAT","TALLYTAB","TALLYPAW"];
for (const t of tickers) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const m = arr.filter(x => String(x.symbol).toLowerCase() === t.toLowerCase()).map(x => `${x.symbol}|${x.name}|verified=${x.isVerified}|mcap=${Math.round(x.mcap||0)}`);
  console.log(t, r.status, "results", arr.length, "symbolMatches", JSON.stringify(m));
}
