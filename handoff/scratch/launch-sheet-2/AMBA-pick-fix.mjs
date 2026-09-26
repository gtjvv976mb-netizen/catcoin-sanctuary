const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in AMBA. Not affiliated with Ambarella, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["AMBA", "AMBAx", "Ambarella", "Ambarella Inc", "Amba", "Amber", "Ambar", "Fermi", "Feng-Ming", "Fermi Wang", "Wang", "Les Kohn", "Kohn", "CVflow", "CV3", "CV2", "CV25", "S6LM", "Oculii", "VisLab", "Cooper", "GoPro", "Hero", "Dropcam", "Nest", "Garmin", "DJI", "Phantom", "Harmonic", "Axis", "Bosch", "Inceptio", "Alberto Broggi", "Broggi", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Santa Clara", "Canopy", "KeepTruckin", "Gauzy"],
  otherPairs: ["IREN", "Iris", "Iris Energy"] };
const c = { name: "Sepia the Seal-Point Cat", ticker: "SEPIAPAW",
  blurb: "Sepia, a cream seal-point cat with a dark brown mask, ears, paws and tail, gazes out from the porch step with wide sky-blue eyes and a slow blink.",
  look: "A normal four-legged cream cat with seal-point colouring: a dark brown mask, ears, paws and tail, and wide sky-blue eyes. It is based on a camera's dark lens ring around a bright eye, and the warm brown of an old photograph. It wears nothing." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descBytes: Buffer.byteLength(desc), endsWithDisclaimer: desc.endsWith(DISC),
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /AMBA|AMB|CVF/.test(c.ticker) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
o.jup = {};
for (const q of [c.ticker, "SEPIA"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jup[q] = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  o.jup[q].verifiedMatch = o.jup[q].symbolMatches.some(t => t.isVerified === true);
}
o.description = desc; o.look = c.look;
console.log(JSON.stringify(o, null, 1));
