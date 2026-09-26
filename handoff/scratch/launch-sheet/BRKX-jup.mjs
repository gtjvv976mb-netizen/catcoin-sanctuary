for (const q of ["BRK.Bx","MOAT","SLOWPURR","MOATCAT","TWOFORDOG"]) {
  const j = await (await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`)).json();
  const arr = Array.isArray(j) ? j : (j.tokens || []);
  console.log(q, arr.length, arr.slice(0, 6).map((x) => `${x.symbol}|${x.name}|isVerified=${x.isVerified}`).join(" ; "));
}
