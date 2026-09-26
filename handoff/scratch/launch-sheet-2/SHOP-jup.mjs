for (const q of ["PARCELPAW","TILLBELL","PATCHPAW","PATCHWORK"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const a = await r.json();
  console.log(q, r.status, a.length, JSON.stringify(a.slice(0,4).map(t=>({s:t.symbol,n:t.name,v:t.isVerified}))));
}
