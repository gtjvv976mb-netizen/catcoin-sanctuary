const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in DELL. Not affiliated with Dell Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DELL", "Dell", "Dell Technologies", "Dell Technologies Inc", "Dell Inc", "PCs Limited", "Michael Dell", "Michael", "Susan Dell", "Jeff Clarke", "Round Rock",
  "EMC", "VMware", "Alienware", "XPS", "Inspiron", "Latitude", "Vostro", "OptiPlex", "Precision", "PowerEdge", "PowerStore", "PowerScale", "Wyse", "Dell Pro", "Dell Premium",
  "Dude", "Dell Dude", "Ben Curtis", "Steven", "Reallusion", "Live Cam Avatar", "Live Cam", "Cam Avatar", "Avatar", "Webcam Central", "Webcam", "Rod Ponton", "Ponton", "lawyer", "not a cat", "I'm not a cat",
  "Zoom", "Skype", "filter", "ChemBark", "sad kitten", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Texas", "court", "Scottish Fold"] };
const c = { name: "Frostpuff the Fold-Eared Cat", ticker: "FROSTPUFF",
  blurb: "Frostpuff, a fluffy white cat with faint silver brow stripes, folded ears, a pink nose and big teal eyes, peeks out from the garden hedge.",
  look: "A normal four-legged, fluffy, medium-longhair house cat that wears nothing: a white coat with faint silver-grey tabby stripes on the brow, small folded-down ears, teal eyes and a pink nose." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
  tickerFormat: R.TICKER.test(c.ticker), tickerLen: c.ticker.length, tickerHasStockRoot: /DELL|DEL/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC),
  withinLimits: c.name.length <= 32 && desc.length <= 280 };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_disclaimerOnly = R.checkFields({ description: DISC });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const memeBlock = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","KEYBOARD","MANEKINEKO","LILBUB","MARU","PUSS","MOCHI","MOODENG","FROST","FROSTY"];
o.catMemeBlocklist = memeBlock.includes(c.ticker);
async function jup(q) { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []); return { status: r.status, arr }; }
const t = await jup(c.ticker);
o.jup = { status: t.status, results: t.arr.length, symbolMatches: t.arr.filter(x => String(x.symbol).toUpperCase() === c.ticker).map(x => ({ name: x.name, isVerified: x.isVerified, id: x.id })) };
o.jup.verifiedMatch = o.jup.symbolMatches.some(x => x.isVerified === true);
const n = await jup("Frostpuff");
o.jupNameSearch = { status: n.status, results: n.arr.length, hits: n.arr.slice(0, 10).map(x => ({ symbol: x.symbol, name: x.name, isVerified: x.isVerified })) };
const pairs = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
o.pair = pairs.filter(p => p.symbol === "DELL");
o.description = desc;
console.log(JSON.stringify(o, null, 1));
