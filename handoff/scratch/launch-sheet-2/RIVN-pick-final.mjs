const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in RIVN. Not affiliated with Rivian Automotive, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["RIVN", "RIV", "Rivian", "Rivian Automotive", "Rivn", "RIVNx", "R1S", "R1T", "R2", "R3", "R3X", "EDV", "Gear Guard", "GearGuard", "Yeti",
  "RJ Scaringe", "Scaringe", "Robert Scaringe", "RJ", "Pepper", "Nash", "Avi", "Pamela", "Hamish", "Lucky", "Gizmo", "Benny", "Leia", "Miso", "Churro", "Yuzu",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Electric Adventure Vehicle", "Adventure", "Adventurous", "Keep the World Adventurous Forever",
  "Launch Green", "Compass Yellow", "Rivian Blue", "Limestone", "Forest Green", "Glacier White", "El Cap Granite", "Granite", "Midnight", "Red Canyon", "Storm Blue",
  "LA Silver", "Camp Kitchen", "Treehouse", "Normal Illinois", "Amazon", "Volkswagen", "Mainstream Motors", "Pet Comfort", "Pet Mode", "Rivian Adventure Network", "RAN", "Waypoints", "Tesla", "Lucid"] };
const c = { name: "Nightseat the Black Cat", ticker: "NIGHTSEAT",
  blurb: "Nightseat, a sleek black shorthair with gold-green eyes and an aqua patterned collar, always takes the highest perch in the garden.",
  look: "A normal four-legged, slim, solid black shorthair with tall upright ears, long whiskers and gold-green eyes, wearing a light-aqua patterned collar with a small ring. It follows the cat in the company's National Pet Day photo, which wears that collar; the high perch nods to the car headrest that cat lies on." };
const coat = { base: "#1B1C1F", second: "#2E3034", pattern: "solid", eyes: "#CFC24C" };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /RIV|RVN/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
o.coatHex = Object.entries(coat).filter(([k]) => k !== "pattern").every(([, v]) => /^#[0-9A-F]{6}$/.test(v));
o.description = desc; o.look = c.look; o.coat = coat;
fs.writeFileSync(new URL("./RIVN-pick.json", import.meta.url), JSON.stringify({ symbol: "RIVN", pair: "RIVN", pairMint: "RcZmt84VMJv9bDhKqmw1uWDahYrUT468VwAChTnfD8p",
  name: c.name, ticker: c.ticker, description: desc, look: c.look, coat, token: { status: "planned" } }) + "\n");
console.log(JSON.stringify(o, null, 1));
