for (const q of process.argv.slice(2)) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  console.log("==", q, r.status, arr.length, arr.map(t => `${t.symbol}|${t.name}|${t.isVerified ? "V" : "-"}`).join(" ; ").slice(0, 700));
}
