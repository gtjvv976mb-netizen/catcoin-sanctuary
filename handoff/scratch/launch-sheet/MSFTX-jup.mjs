for (const s of process.argv.slice(2)) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(s)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens || []);
    const same = arr.filter((x) => String(x.symbol).toLowerCase() === s.toLowerCase());
    console.log(s, "status", r.status, "results", arr.length, "same", same.length, "sameVerified", same.filter((x) => x.isVerified).length,
      same.slice(0, 4).map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}/mcap=${Math.round(x.mcap||0)}`).join("; "));
  } catch (e) { console.log(s, "ERR", e.message); }
}
