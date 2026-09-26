const r = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=cat");
const j = await r.json();

for (const t of j) if (t.tokenProgram && t.tokenProgram !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") console.log(t.id, t.symbol, t.name, t.tokenProgram, "liq", t.liquidity, "verified", t.isVerified, "mintAuth", t.audit?.mintAuthorityDisabled, "freeze", t.audit?.freezeAuthorityDisabled);
console.log("total", j.length);
