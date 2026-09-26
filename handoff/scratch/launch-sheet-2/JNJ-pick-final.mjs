import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const pair = JSON.parse(fs.readFileSync(`${SP}/stockcats/stonkfun-pairs.json`, "utf8")).data.pairs.find((p) => p.symbol === "JNJ");
const DISC = `A cat coin priced in ${pair.symbol}. Not affiliated with Johnson & Johnson, Backpack Securities or StonkFun. No intrinsic value; not financial advice.`;
const stockTerms = { stock: ["JNJ", "J&J", "JandJ", "JJ", "Johnson", "Johnson & Johnson", "Johnson and Johnson", "Janssen", "Ethicon", "DePuy", "Synthes", "Acuvue", "Abiomed", "Shockwave", "Auris", "Monarch", "Velys", "Ottava",
  "Kenvue", "Band-Aid", "BandAid", "Band Aid", "Tylenol", "Neutrogena", "Listerine", "Aveeno", "Zyrtec", "Motrin", "Benadryl", "No More Tears", "Stelara", "Darzalex", "Tremfya", "Xarelto", "Carvykti", "Rybrevant", "Spravato",
  "Hello Kitty", "Kitty", "Sanrio", "Kilmer", "Fred Kilmer", "Frederick Kilmer", "Joyce Kilmer", "Tom Rutgers", "Tom", "Rutgers", "Red Cross", "Red Cross Messenger", "Messenger", "Robert Wood Johnson", "Duato", "Joaquin Duato", "Gorsky",
  "New Brunswick", "Credo", "Our Credo", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "talc", "baby powder", "Iris Grossman", "Grossman", "alligator"] };
const c = { name: "Jowls the Big Grey Cat", ticker: "JOWLS",
  blurb: "Jowls, a heavy round-cheeked grey shorthair with sleepy half-shut eyes and a thick ruff, sits as still as an old photo on the garden wall.",
  look: "A normal four-legged, big, heavy-set grey shorthair house cat: broad head, round heavy jowls, small wide-set ears, sleepy half-shut golden eyes, full whisker pads, a thick dense coat and a deep, slightly darker ruff on the chest. Solid grey, no markings. Wears nothing." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerFormat: R.TICKER.test(c.ticker),
  tickerHasStockRoot: /JNJ|JANDJ|^JJ/.test(c.ticker), endsWithDisclosure: desc.endsWith(DISC) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_descriptionMinusDisclosure = R.checkFields({ description: desc.replace(DISC, "").trim() });
o.checkFields_look = R.checkFields({ look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, returned: arr.map((t) => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })), symbolMatches: arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker).length };
o.jup.verifiedMatch = arr.some((t) => String(t.symbol).toUpperCase() === c.ticker && t.isVerified === true);
o.description = desc;
console.log(JSON.stringify(o, null, 1));
