// Checker pass for ANTHROPIC (prestock). Re-runs every rule on the three drafts and on the fixed pick.
import fs from "node:fs";
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DIR = `${SP}/launch-sheet-2`;
const R = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER, normalize } = await import(`${R}/bots/lib/content-rules.mjs`);
const S = await import(`${R}/src/lib/stockcats.mjs`);
const { verifiedIndex, tickerFree } = await import(`${R}/bots/cashcat/tickers.mjs`);
const { copycatOf } = await import(`${R}/bots/popcat/established.mjs`);
const { siteRefusals } = await import(`${R}/bots/cashcat/invent.mjs`);
const { ROWS, notesFor } = await import(`${SP}/launch-sheet/EDITOR/rows.mjs`);

const PAIR = "ANTHROPIC";
const DISC_DRAFT = "A cat coin priced in ANTHROPIC. Not affiliated with Anthropic or StonkFun. No intrinsic value; not financial advice.";
const DISC_FIX = "A cat coin priced in ANTHROPIC. Not affiliated with Anthropic, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { id: "draft1", name: "Cotta the Terracotta Cat", ticker: "COTTAPAW", disc: DISC_DRAFT,
    blurb: "Cotta, a sleek terracotta-orange cat with golden eyes, sits by the garden bench all day and gives a slow blink to anyone hard at work nearby.",
    look: "Solid rust or terracotta orange short-haired house cat with no markings, sleek build, golden eyes, wears nothing." },
  { id: "draft2", name: "Nudge the Ginger Cat", ticker: "NUDGEPAW", disc: DISC_DRAFT,
    blurb: "Nudge, a brick-orange cat with round copper eyes, taps pebbles off the potting bench one paw at a time, then sits back looking very pleased.",
    look: "Solid brick-orange ginger house cat with no markings, round face, copper eyes, wears nothing." },
  { id: "draft3", name: "Ember the Loaf Cat", ticker: "EMBERLOAF", disc: DISC_DRAFT,
    blurb: "Ember, a solid ginger cat the colour of warm clay, curls into a tidy loaf on the sunny wall, twitches her tail in her dreams and purrs at every hello.",
    look: "Solid clay-orange ginger house cat with no markings, compact loaf-shaped build, gold eyes, wears nothing." },
  { id: "pick", name: "Cotta the Terracotta Cat", ticker: "COTTAPAW", disc: DISC_FIX,
    blurb: "Cotta, a sleek terracotta-orange cat with golden eyes, sits by the garden bench all day and gives a slow blink to anyone hard at work nearby.",
    look: "Solid rust or terracotta orange short-haired house cat with no markings, sleek build, golden eyes, wears nothing." },
  { id: "alt-fixed", name: "Nudge the Ginger Cat", ticker: "NUDGEPAW", disc: DISC_FIX,
    blurb: "Nudge, a brick-orange cat with round copper eyes, taps pebbles off the potting bench one paw at a time, then sits back looking very pleased.",
    look: "Solid brick-orange ginger house cat with no markings, round face, copper eyes, wears nothing." },
];

// The stock's own terms: the drafter's list plus the co-founders and executives, and product names.
const own = ["ANTHROPIC", "Anthropic", "Anthropic PBC", "Anthropic PreStocks", "Claude", "Clawd", "Claude Code", "Claude Desktop", "Opus", "Sonnet", "Haiku",
  "Cowork", "Artifacts", "Constitutional", "Mythos", "MCP", "Amodei", "Dario", "Daniela", "Dario Amodei", "Daniela Amodei", "Jared Kaplan", "Kaplan",
  "Sam McCandlish", "McCandlish", "Tom Brown", "Chris Olah", "Olah", "Jack Clark", "Ben Mann", "Mike Krieger", "Krieger", "Krishna Rao", "Boris Cherny", "Cherny",
  "Cat Wu", "Catherine Wu", "Rieseberg", "Felix Rieseberg", "buddy", "desk buddy", "chonk", "desk pet", "ESP32", "M5Stick", "PreStocks", "PreStock", "prestock", "pre-IPO", "SPV"];

// Other pairs: the 24 xStocks (the first sheet's simulated rows, via the repo's pairTerms) and the other researched stocks' checker lists.
const notes = notesFor(S.STOCK_PAIRS);
const xstockTerms = S.STOCK_PAIRS.flatMap((p) => [...S.pairTerms(p, notes), ...(ROWS[p.symbol]?.extra ?? [])]);
const otherTerms = [];
for (const f of fs.readdirSync(DIR).filter((f) => /^[A-Z0-9]+-(pick-)?check\.mjs$/.test(f) && !f.startsWith("ANTHROPIC"))) {
  const src = fs.readFileSync(`${DIR}/${f}`, "utf8");
  const m = src.match(/stock(?:Terms)?\s*[:=]\s*(?:\{\s*stock:\s*)?(\[[^\]]*\])/);
  if (!m) continue;
  try { otherTerms.push(...Function(`return ${m[1]}`)()); } catch {}
}
const others = [...new Set([...xstockTerms, ...otherTerms])].filter((t) => !own.map((o) => normalize(o)).includes(normalize(t)));

// Earlier coins: the first sheet's final picks and the other stocks' picks in this sheet.
const earlier = [];
try { for (const c of JSON.parse(fs.readFileSync(`${SP}/launch-sheet/EDITOR/final.json`, "utf8")).final) earlier.push({ name: c.name, symbol: c.ticker, from: "launch-sheet final" }); } catch {}
for (const f of fs.readdirSync(DIR).filter((f) => /-pick\.json$/.test(f))) {
  try { const c = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); earlier.push({ name: c.name, symbol: c.ticker, from: f }); } catch {}
}
const draftsElsewhere = [];
for (const f of fs.readdirSync(DIR).filter((f) => /-coins\d?\.json$/.test(f) && !f.startsWith("ANTHROPIC"))) {
  const raw = fs.readFileSync(`${DIR}/${f}`, "utf8");
  for (const m of raw.matchAll(/"name"\s*:\s*"([^"]+)"\s*,\s*"ticker"\s*:\s*"([^"]+)"/g)) draftsElsewhere.push({ name: m[1], symbol: m[2], from: f });
}

const r = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
const vlist = await r.json();
const vidx = verifiedIndex(vlist);
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
async function jup(q) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    if (res.status === 429) { await sleep(2500); continue; }
    const arr = await res.json().catch(() => []);
    return { status: res.status, arr: Array.isArray(arr) ? arr : [] };
  }
  return { status: 429, arr: [] };
}
const MEME = new Set(["POPCAT", "MEW", "MICHI", "GRUMPY", "KITTY", "CAT", "CATS", "NYAN", "KITTEN", "TABBY", "MOCHI", "MOG", "PUSS", "MEOW", "PURR", "GINGER", "NEKO", "WIF", "CATWIF", "CWIF", "MANEKI", "SC", "LION", "LEO", "ROAR", "MANE", "FATCAT"]);
const alnum = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const verifiedTok = (x) => x.isVerified === true || (Array.isArray(x.tags) && x.tags.includes("verified"));

const out = [];
for (const c of coins) {
  const description = `${c.blurb} ${c.disc}`;
  const o = { id: c.id, name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, blurb: c.blurb.length, description: description.length },
    limitsOk: c.name.length <= 32 && description.length <= 280 && c.blurb.length <= 160,
    tickerFormat: TICKER.test(c.ticker), memeTicker: MEME.has(c.ticker),
    notStockTicker: !["ANTHROPIC", "ANTH", "ANT"].some((t) => c.ticker.startsWith(t) || c.ticker.endsWith(t)),
    disclosureEndsRight: description.endsWith("No intrinsic value; not financial advice.") && description.includes(`A cat coin priced in ${PAIR}.`),
  };
  o.checkProposal = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_withTrendCat = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb, trend: "cat" });
  o.displaySafe = displaySafe({ name: c.name, symbol: c.ticker });
  o.checkFields_blurb_look = checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look });
  o.checkFields_fullDescription = checkFields({ description });
  o.checkFields_disclosureOnly = checkFields({ description: c.disc });
  o.checkTerms_ownStock = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, { stock: own });
  o.checkTerms_otherPairs = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { other_pair: others });
  o.checkTerms_launchClaims = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { launch_claim: S.LAUNCH_CLAIMS });
  o.otherXstockRootInTicker = S.STOCK_PAIRS.map((p) => alnum(p.root)).filter((x) => x.length >= 3).find((x) => alnum(c.ticker).includes(x)) ?? null;
  o.siteRefusals = siteRefusals({ name: c.name, symbol: c.ticker, tagline: c.blurb, trend: { title: "cat", source: "google-trends" } });
  o.tickerFree = tickerFree(vidx, { name: c.name, symbol: c.ticker });
  o.copycatOf = copycatOf({ name: c.name, symbol: c.ticker }) ?? null;
  const jt = await jup(c.ticker); await sleep(400);
  const jn = await jup(c.name.split(" ")[0]); await sleep(400);
  o.jupTicker = { status: jt.status, results: jt.arr.length, symbolMatches: jt.arr.filter((x) => alnum(x.symbol) === alnum(c.ticker)).map((x) => ({ symbol: x.symbol, name: x.name, verified: verifiedTok(x), id: x.id })) };
  o.jupTicker.verifiedSymbolMatch = o.jupTicker.symbolMatches.some((x) => x.verified);
  o.jupFirstName = { q: c.name.split(" ")[0], status: jn.status, results: jn.arr.length, verifiedSymbolOrNameMatch: jn.arr.filter((x) => verifiedTok(x) && (alnum(x.symbol) === alnum(c.name.split(" ")[0]) || normalize(x.name) === normalize(c.name.split(" ")[0]))).map((x) => ({ symbol: x.symbol, name: x.name, id: x.id })) };
  o.earlierCollision = earlier.filter((e) => normalize(e.name) === normalize(c.name) || alnum(e.symbol) === alnum(c.ticker) || normalize(e.name).split(" ")[0] === normalize(c.name).split(" ")[0]);
  o.draftsElsewhereSharingFirstWordOrTicker = draftsElsewhere.filter((e) => normalize(e.name).split(" ")[0] === normalize(c.name).split(" ")[0] || alnum(e.symbol) === alnum(c.ticker));
  o.description = description;
  out.push(o);
}

// The pair's mint, again: program, transfer fee now and scheduled, extensions, epoch.
const RPC = "https://api.mainnet-beta.solana.com";
const rpc = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const MINT = "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw";
let mint = {};
try {
  const a = await rpc("getAccountInfo", [MINT, { encoding: "jsonParsed" }]);
  const info = a?.value?.data?.parsed?.info;
  const fee = (info?.extensions ?? []).find((e) => e.extension === "transferFeeConfig")?.state;
  mint = { owner: a?.value?.owner, decimals: info?.decimals, extensions: (info?.extensions ?? []).map((e) => e.extension), transferFee: fee ? { older: fee.olderTransferFee, newer: fee.newerTransferFee } : null };
  mint.epoch = (await rpc("getEpochInfo", []))?.epoch;
} catch (e) { mint.error = String(e); }
const pairs = JSON.parse(fs.readFileSync(`${SP}/stockcats/stonkfun-pairs.json`, "utf8")).data.pairs.filter((p) => p.symbol === PAIR);

console.log(JSON.stringify({ verifiedListSize: vidx.size, othersTermCount: others.length, earlierCount: earlier.length, out, mint, stonkfunPair: pairs }, null, 1));
