const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in GPRO. Not affiliated with GoPro, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["GPRO", "GPR", "GoPro", "Go Pro", "GoPro Inc", "Hero", "Karma", "Quik", "Fusion", "Session", "Chesty", "Volta", "Enduro", "Be a Hero",
  "Didga", "Dollwet", "Robert Dollwet", "Woodman", "Nick Woodman", "Kalanick", "Cory Kalanick", "Fresno", "fireman", "firefighter", "fire", "rescue",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Insta360", "Oscar", "skateboard", "skateboarding", "skate", "Laser Cats", "lion", "lions", "camera", "action cam", "Max", "Mission"] };
const cands = [
  { name: "Scuff the Tabby-and-White Cat", ticker: "SCUFFPAW", blurb: "Scuff, a sturdy brown tabby with a white nose stripe, white chest and white paws, zooms down a sloping Cat Sanctuary path and slides to a halt." },
  { name: "Scuff the Tabby-and-White Cat", ticker: "SCUFFPAW", blurb: "Scuff, a sturdy brown tabby with a white nose stripe, white chest and white paws, zooms down the sloping path in the Cat Sanctuary and slides to a halt." },
  { name: "Thistle the White-Socked Cat", ticker: "THISTLEPAW", blurb: "Thistle, a dark-striped brown tabby with a snowy bib and white socks, walks the Cat Sanctuary wall and leans down to peer right at you." },
];
const out = { discLen: DISC.length, disclosureOnly: R.checkFields({ description: DISC }), results: [] };
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { ...c, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisc: desc.endsWith(DISC), tickerFmt: R.TICKER.test(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkFields_full = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  o.checkFields_blurb = R.checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb });
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  for (const q of [c.ticker, c.name.split(" ")[0]]) {
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      o[`jup_${q}`] = { status: r.status, results: arr.length,
        symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
      o[`jup_${q}`].verifiedSymbolMatch = o[`jup_${q}`].symbolMatches.some(t => t.isVerified === true);
    } catch (e) { o[`jup_${q}`] = { error: String(e) }; }
  }
  o.description = desc;
  out.results.push(o);
}
console.log(JSON.stringify(out, null, 1));
