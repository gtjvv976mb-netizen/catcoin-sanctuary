// DJT checker retry (2026-09-25): content rules, stock terms, lengths, ticker, Jupiter, mint RPC.
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("node:fs");
const pairs = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/stockcats/stonkfun-pairs.json", "utf8"));
const pair = pairs.data.pairs.find((p) => p.symbol === "DJT");

const DISC_FULL = "A cat coin priced in DJT. Not affiliated with Trump Media & Technology Group, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const DISC_TMTG = "A cat coin priced in DJT. Not affiliated with TMTG, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";

const stockTerms = { stock: ["DJT", "DJTx", "Trump", "Donald", "Donald Trump", "Donald J Trump", "Trump Media", "Trump Media & Technology Group", "Truth", "Truth Social", "TruthSocial", "Truths", "TruthFi", "Truth.Fi", "Truth+",
  "Digital World", "DWAC", "Devin Nunes", "Nunes", "Kevin McGurn", "McGurn", "Boris Epshteyn", "Epshteyn", "Andy Litinsky", "Litinsky", "Wes Moss", "Moss",
  "MAGA", "Make America Great Again", "Springfield", "Haitian", "Haiti", "immigrant", "migrant", "rifle", "gun", "duck", "ducks", "lion", "plane", "jet", "hat", "cap", "red hat",
  "Mar-a-Lago", "Mar a Lago", "Palm Beach", "Sarasota", "Rumble", "Sunrise", "Wormhole", "Orange", "Orange Man", "Don", "Donny", "Trumpet", "POTUS", "Patriot", "America", "American", "Eagle", "Freedom",
  "Echo", "Echo chamber", "Amazon Echo", "Alexa", "gossip", "soapbox", "rant", "lecture", "hair", "comb", "tariff", "rally"] };

const memeTickers = new Set(["POPCAT", "MEW", "MICHI", "GRUMPY", "KITTY", "CAT", "CATS", "NYAN", "KITTEN", "TABBY", "MOG", "MANEKI", "HOBBES", "WIF", "BONK", "CATWIF", "PURR", "MEOW", "SIMON", "GIKO", "BOOK", "NUB",
  "SNOWBALL", "GINGER", "MAGA", "TRUMP", "DJT", "TRUTH", "TMTG", "MAGACAT", "TRUMPCAT", "CHILLCAT", "SCHRODINGER", "CATGIRL", "MOCHI", "CATDOG", "GME", "PEPE", "SC", "LUCE", "ZEREBRO"]);

const coins = [
  { id: "draft1", name: "Marmalade the Town Crier Cat", ticker: "TOWNCRIER", blurb: "Marmalade, a lean ginger tabby with rust stripes and gold eyes, meows the morning gossip from the garden gate to all who pass.", disc: DISC_FULL },
  { id: "draft2", name: "Soapbox the Ginger Tabby", ticker: "SOAPPAW", blurb: "Soapbox, a fluffy ginger tabby with a cream chin and copper eyes, stands on an old crate to lecture the sparrows at length.", disc: DISC_FULL },
  { id: "draft3", name: "Echo the Noticeboard Cat", ticker: "PAWPOST", blurb: "Echo, a stocky ginger tabby with swirled stripes and green eyes, stamps a paw print on each note on the garden noticeboard.", disc: DISC_FULL },
  { id: "pick", name: "Tack the Noticeboard Cat", ticker: "PAWPOST",
    blurb: "Tack, a sleek ginger tabby with swirled rust stripes and green eyes, stamps a paw print on every note pinned to the garden noticeboard.", disc: DISC_TMTG,
    look: "A normal four-legged, sleek, short-haired house cat. Ginger (red) classic tabby coat with swirled darker rust stripes on the sides and a ringed tail, and clear green eyes. Wears nothing: no accessories of any kind." },
];

const out = { pair, disclaimerFull: R.checkFields({ disclaimer: DISC_FULL }), disclaimerTMTG: R.checkFields({ disclaimer: DISC_TMTG }), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${c.disc}`;
  const o = { id: c.id, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, nameOK: c.name.length <= 32, descOK: desc.length <= 280,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /DJT|TRUMP|TMTG|TRUTH|MAGA|DON|DWAC/.test(c.ticker), endsWithDisclaimer: desc.endsWith(c.disc), memeTicker: memeTickers.has(c.ticker) };
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkFields_fullDescription = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  o.checkFields_withoutDisclaimer = R.checkFields({ name: c.name, symbol: c.ticker, story: c.blurb, ...(c.look ? { look: c.look } : {}) });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, story: c.blurb, ...(c.look ? { look: c.look } : {}) }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.description = desc;
  out.coins.push(o);
}

// Jupiter: one search per distinct ticker.
out.jupiter = {};
for (const t of [...new Set(coins.map((c) => c.ticker))]) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const matches = arr.filter((x) => String(x.symbol).toUpperCase() === t);
    out.jupiter[t] = { status: r.status, results: arr.length, allSymbols: arr.map((x) => `${x.symbol}${x.isVerified ? "(verified)" : ""}`),
      symbolMatches: matches.map((x) => ({ symbol: x.symbol, name: x.name, isVerified: x.isVerified, id: x.id })), verifiedSymbolMatch: matches.some((x) => x.isVerified === true) };
  } catch (e) { out.jupiter[t] = { error: String(e) }; }
}

// Fresh mint read for the pair note.
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [pair.mint, { encoding: "jsonParsed" }] }) });
  const j = await rpc.json(); const info = j?.result?.value?.data?.parsed?.info;
  out.mint = { status: rpc.status, owner: j?.result?.value?.owner, extensions: (info?.extensions ?? []).map((e) => e.extension),
    transferFeeConfig: (info?.extensions ?? []).find((e) => e.extension === "transferFeeConfig")?.state ?? null,
    pausable: (info?.extensions ?? []).find((e) => e.extension === "pausableConfig")?.state ?? null,
    transferHook: (info?.extensions ?? []).find((e) => e.extension === "transferHook")?.state ?? null };
} catch (e) { out.mint = { error: String(e) }; }

console.log(JSON.stringify(out, null, 1));
