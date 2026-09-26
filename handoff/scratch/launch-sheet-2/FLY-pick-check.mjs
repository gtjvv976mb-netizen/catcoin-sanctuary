const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in FLY. Not affiliated with Firefly Aerospace, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["FLY", "Firefly", "Firefly Aerospace", "Fire fly", "firefl", "Alpha", "Eclipse", "Blue Ghost", "Ghost", "Elytra", "SciTec", "Reaver", "Lightning", "Miranda", "Duckner", "duck", "ducky", "rubber duck", "Jason Kim", "Kim", "Markusic", "Tom Markusic", "Polyakov", "Max Polyakov", "Northrop", "Northrop Grumman", "Grumman", "Cedar Park", "Leander", "Briggs", "Ocula", "Victus", "Victus Nox", "Backpack", "Backpack Securities", "Sunrise", "Ghost Riders", "Noise of Summer", "To The Black", "DREAM", "Fly the Lightning", "glow", "glowing", "lightning bug", "glowworm", "blink", "lantern", "flicker", "ember", "spark", "flame", "fire", "Serenity", "Browncoat"] };
const coins = JSON.parse(fs.readFileSync("FLY-coins.json", "utf8"));
const looks = {
  PUMICE: "A plain pale ash-grey shorthair, moon-dust or lunar-soil grey, with honey-gold eyes. Normal four-legged house cat, wears nothing.",
  LIFTPAW: "A white-and-smoke-grey bicolor: white legs, chest and face, with a smoky grey saddle like a launch plume. Copper eyes. Normal four-legged house cat, wears nothing.",
  CRATERPAW: "A silver spotted tabby with round charcoal spots, like a cratered moon. Green eyes. Normal four-legged house cat, wears nothing.",
};
const jup = async (q) => { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []); return { status: r.status, arr }; };
const out = { disclosureOnly: R.checkFields({ disclosure: DISC }), disclosureTerms: R.checkTerms({ disclosure: DISC }, stockTerms), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const look = looks[c.ticker];
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descOk: desc.length <= 280, nameOk: c.name.length <= 32,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /FLY|FIRE|ALPHA|GHOST|ECLIP|ELYTRA|DUCK/.test(c.ticker), endsWithDisclosure: desc.endsWith(DISC),
    coatOk: /^#[0-9A-Fa-f]{6}$/.test(c.coat.base) && /^#[0-9A-Fa-f]{6}$/.test(c.coat.second) && /^#[0-9A-Fa-f]{6}$/.test(c.coat.eyes) && ["solid","tabby","tuxedo","calico","point","spotted","bicolor","tortie"].includes(c.coat.pattern) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const j = await jup(c.ticker);
  o.jup = { status: j.status, results: j.arr.length, symbolMatches: j.arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  const first = c.name.split(" ")[0];
  const jn = await jup(first);
  o.jupNameWord = { query: first, status: jn.status, results: jn.arr.length, symbolOrNameHits: jn.arr.filter(t => String(t.symbol).toUpperCase() === first.toUpperCase() || String(t.name).toLowerCase() === first.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, mcap: t.mcap, id: t.id })) };
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
