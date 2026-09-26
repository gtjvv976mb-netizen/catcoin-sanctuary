const out = {};
for (const q of ["SATCHEL", "Satchel", "CASENAP", "CASECAT", "HZAbDPfWHpzXnoYfFqWHqV2N2HBVkLodH9BHjHMhpump"]) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out[q] = { status: r.status, n: arr.length, top: arr.slice(0, 8).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, holders: t.holderCount, mcap: t.mcap })) };
  } catch (e) { out[q] = { error: String(e) }; }
}
try {
  const r = await fetch("https://efts.sec.gov/LATEST/search-index?q=%22carrying%20cases%22&ciks=0000038264&forms=10-K", { headers: { "User-Agent": "cat-sanctuary research contact@example.org" } });
  const t = await r.text(); out.sec = { status: r.status, snippet: t.slice(0, 1500) };
} catch (e) { out.sec = { error: String(e) }; }
console.log(JSON.stringify(out, null, 1));
