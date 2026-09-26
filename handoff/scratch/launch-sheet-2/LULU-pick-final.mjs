const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const P = JSON.parse(fs.readFileSync(new URL("./LULU-pick.json", import.meta.url), "utf8")).pick;
const DISC = "A cat coin priced in LULU. Not affiliated with lululemon athletica, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["LULU", "LULUx", "lululemon", "lululemon athletica", "athletica", "lulu", "lemon", "lemon cat", "lululemoncat", "lululemonthekitty",
  "Chip Wilson", "Wilson", "Calvin McDonald", "McDonald", "Heidi O'Neill", "O'Neill", "ONeill", "Heidi", "Align", "Nulu", "Define", "Energy Bra", "Flow Y", "Big-Ass Bag",
  "Ivivva", "Geoff McFetridge", "McFetridge", "Hannah Frankson", "Frankson", "Mickey", "Minnie", "Disney", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Lunar New Year", "Year of the Tiger", "tiger", "leopard", "Wella", "Hello Kitty", "Sanrio", "Garfield", "Pusheen", "Doraemon", "Scuba", "Swiftly", "Wunder", "Wunder Train", "Softstreme", "Pace Breaker", "ABC", "omega"] };
const blurb = P.description.slice(0, P.description.indexOf(DISC)).trim();
const hex = /^#[0-9A-F]{6}$/i;
const lum = (h) => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const o = { name: P.name, ticker: P.ticker, nameLen: P.name.length, descLen: P.description.length, blurbLen: blurb.length,
  tickerFormat: R.TICKER.test(P.ticker), tickerHasStockRoot: /LULU|LEMON|ATHL|ALIGN|NULU/.test(P.ticker), endsWithDisclaimer: P.description.endsWith(DISC),
  coatValid: ["base", "second", "eyes"].every(k => hex.test(P.coat[k])) && ["solid","tabby","tuxedo","calico","point","spotted","bicolor","tortie"].includes(P.coat.pattern),
  contrast: { eyesVsBase_new: cr(P.coat.eyes, P.coat.base), eyesVsBase_drafted: cr("#C0702E", P.coat.base), stripesVsBase: cr(P.coat.second, P.coat.base) } };
o.checkProposal_blurb = R.checkProposal({ name: P.name, symbol: P.ticker, tagline: blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: P.name, symbol: P.ticker, tagline: P.description });
o.checkFields_description = R.checkFields({ description: P.description });
o.checkFields_look = R.checkFields({ look: P.look });
o.checkTerms_coinText = R.checkTerms({ name: P.name, symbol: P.ticker, blurb }, stockTerms);
o.checkTerms_fullDescription = R.checkTerms({ description: P.description }, stockTerms);
o.checkTerms_look = R.checkTerms({ look: P.look }, stockTerms);
o.displaySafe = R.displaySafe({ name: P.name, symbol: P.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${P.ticker}`); const a = await r.json();
o.jup = { status: r.status, results: a.length, symbolMatches: a.filter(t => String(t.symbol).toUpperCase() === P.ticker).length, verifiedAny: a.filter(t => t.isVerified).map(t => t.symbol), nameNear: a.filter(t => /sunstretch/i.test(t.name)).map(t => ({ symbol: t.symbol, name: t.name, holders: t.holderCount, isVerified: t.isVerified ?? false, launchpad: t.launchpad })) };
console.log(JSON.stringify(o, null, 1));
