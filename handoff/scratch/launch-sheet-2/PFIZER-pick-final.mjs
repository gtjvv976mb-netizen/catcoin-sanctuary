const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in PFIZER. Not affiliated with Pfizer, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["PFIZER", "Pfizer", "Pfizer Inc", "PFE", "PFEx", "PFZ", "Pfizer Japan", "Pfizer Animal Health", "Charles Pfizer", "Charles Erhart", "Erhart",
  "Albert Bourla", "Bourla", "AMR", "AMR Cat", "AMRcat", "Antimicrobial", "Zoetis", "Revolution", "Convenia", "Selamectin", "Cefovecin", "Viagra", "Lipitor", "Comirnaty",
  "Paxlovid", "BioNTech", "Wyeth", "Hospira", "Seagen", "Pharmacia", "Upjohn", "Viatris", "Xeljanz", "Eliquis", "Prevnar", "Ibrance", "Chantix", "Celebrex", "Zoloft",
  "Advil", "Centrum", "Helix", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Puma", "Jaguar", "Lions", "Hello Kitty", "Kitty", "Sanrio", "Garfield", "Pusheen",
  "Doraemon", "Tateda", "Kazuhiro Tateda", "Toho", "vaccine", "pill", "cure", "Chiikawa", "Hachiware", "Health Answers", "penicillin", "antibiotic", "medicine", "germ"] };
const c = { name: "Inkcap the Round Garden Cat", ticker: "INKCAP",
  blurb: "Inkcap, a round cream-white cat with a charcoal cap between pink ears, charcoal back patches and olive-gold eyes, dozes by the mushroom ring.",
  look: "A normal four-legged, plump, round house cat. Cream-white coat with a charcoal-black cap of fur on the head, split between pink ears, charcoal patches on the back and hip, and a charcoal tail with a white tip that curls up into a hook. Olive-gold eyes and a small pink nose. Wears nothing." };
const coat = { base: "#FDF3EA", second: "#544A49", pattern: "bicolor", eyes: "#C2A140" };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, lookLen: c.look.length,
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /PF|PFE|PFZ|FIZ|AMR|ZOET/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC),
  coatValid: /^#[0-9A-F]{6}$/i.test(coat.base) && /^#[0-9A-F]{6}$/i.test(coat.second) && /^#[0-9A-F]{6}$/i.test(coat.eyes) && ["solid","tabby","tuxedo","calico","point","spotted","bicolor","tortie"].includes(coat.pattern) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_look = R.checkFields({ look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, hits: arr.map(t => `${t.symbol}${t.isVerified ? "(verified)" : ""}`),
  symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
o.description = desc;
console.log(JSON.stringify(o, null, 1));
fs.writeFileSync("PFIZER-pick.json", JSON.stringify({ symbol: "PFIZER", pair: "PFIZER", pairMint: "PFER6ENqP8r8NF3CqVt4mFowxsin3V5MLidBNQFCC3x", name: c.name, ticker: c.ticker, description: desc, look: c.look, coat, token: { status: "planned" } }) + "\n");
