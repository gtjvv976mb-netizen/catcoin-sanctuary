// Checker pass for MGM (Backpack Securities token). Re-runs every rule on the three drafts and on the fixed candidates.
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

const PAIR = "MGM";
const DISC = "A cat coin priced in MGM. Not affiliated with MGM Resorts International, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(`${DIR}/MGM-pick-candidates.json`, "utf8"));

const own = ["MGM", "MGM Resorts", "MGM Resorts International", "Resorts", "MGM Grand", "Grand Lion", "Leo", "Leo the Lion", "Leona", "Leona the Lioness", "Lion", "Lioness", "lions", "mane", "roar", "pride",
  "Bellagio", "Mirage", "Mandalay", "Mandalay Bay", "Park MGM", "The Park", "Excalibur", "Luxor", "Aria", "Vdara", "Cosmopolitan", "Borgata", "BetMGM", "LeoVegas", "MGM China", "Cotai", "Macau",
  "Beau Rivage", "Gold Strike", "Empire City", "National Harbor", "Springfield", "Northfield", "Delano", "NoMad", "New York-New York", "MGM Rewards", "M life",
  "Metro Goldwyn Mayer", "Goldwyn", "Mayer", "Kerkorian", "Kirk Kerkorian", "Tracinda", "Hornbuckle", "Bill Hornbuckle", "Murren", "Jim Murren", "Halkyard", "Paul Salem", "Phyllis James",
  "Siegfried", "Roy", "Siegfried Roy", "Liberty", "Maharani", "Hirah", "Justice", "Hello Kitty", "Sanrio", "Bruno Mars", "Sekhmet", "Bastet",
  "Vegas", "Las Vegas", "Strip", "Casino", "Jackpot", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Amazon MGM"];

const notes = notesFor(S.STOCK_PAIRS);
const xstockTerms = S.STOCK_PAIRS.flatMap((p) => [...S.pairTerms(p, notes), ...(ROWS[p.symbol]?.extra ?? [])]);
const otherTerms = [];
for (const f of fs.readdirSync(DIR).filter((f) => /^[A-Z0-9]+-(pick-)?check\.mjs$/.test(f) && !f.startsWith("MGM"))) {
  const src = fs.readFileSync(`${DIR}/${f}`, "utf8");
  const m = src.match(/stock(?:Terms)?\s*[:=]\s*(?:\{\s*stock:\s*)?(\[[^\]]*\])/);
  if (!m) continue;
  try { otherTerms.push(...Function(`return ${m[1]}`)()); } catch {}
}
/* Every StonkFun pair's own symbol and name (the pairs list), apart from MGM itself. */
const allPairs = JSON.parse(fs.readFileSync(`${SP}/stockcats/stonkfun-pairs.json`, "utf8")).data.pairs;
const pairWords = allPairs.filter((p) => p.symbol !== PAIR).flatMap((p) => [p.symbol, p.name]).filter((t) => normalize(t).replace(/ /g, "").length >= 3);
const ownN = own.map((o) => normalize(o));
const others = [...new Set([...xstockTerms, ...otherTerms])].filter((t) => !ownN.includes(normalize(t)));
const pairOthers = [...new Set(pairWords)].filter((t) => !ownN.includes(normalize(t)) && !["cat", "the", "coin", "token"].includes(normalize(t)));

const earlier = [];
try { for (const c of JSON.parse(fs.readFileSync(`${SP}/launch-sheet/EDITOR/final.json`, "utf8")).final) earlier.push({ name: c.name, symbol: c.ticker, coat: c.coat, from: "launch-sheet final" }); } catch {}
for (const f of fs.readdirSync(DIR).filter((f) => /-pick\.json$/.test(f) && !f.startsWith("MGM"))) {
  try { const j = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); const c = j.pick ?? j; earlier.push({ name: c.name, symbol: c.ticker, coat: c.coat, from: f }); } catch {}
}
const draftsElsewhere = [];
for (const f of fs.readdirSync(DIR).filter((f) => /-coins\d?\.json$/.test(f) && !f.startsWith("MGM"))) {
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
const MEME = new Set(["POPCAT", "MEW", "MICHI", "GRUMPY", "KITTY", "CAT", "CATS", "NYAN", "KITTEN", "TABBY", "MOCHI", "MOG", "PUSS", "MEOW", "PURR", "GINGER", "NEKO", "WIF", "CATWIF", "CWIF", "MANEKI", "SC", "LION", "LEO", "ROAR", "MANE", "FATCAT", "TUX", "PAW", "PAWS", "TOEBEANS", "BEANS", "HOBBES", "GIKO", "NUB", "CALICO", "CHROME", "HOSICO", "OIIAOIIA", "ZCAT", "SIMON"]);
const alnum = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const verifiedTok = (x) => x.isVerified === true || (Array.isArray(x.tags) && x.tags.includes("verified"));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(...hex(a).map((v, i) => v - hex(b)[i]));

const out = [];
for (const c of coins) {
  const description = `${c.blurb} ${DISC}`;
  const o = { id: c.id, name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, blurb: c.blurb.length, description: description.length },
    limitsOk: c.name.length <= 32 && description.length <= 280 && c.blurb.length <= 160,
    tickerFormat: TICKER.test(c.ticker), memeTicker: MEME.has(c.ticker),
    notStockTicker: !["MGM"].some((t) => c.ticker.includes(t)),
    disclosureEndsRight: description.endsWith(DISC),
  };
  o.checkProposal = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_withTrendCat = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb, trend: "cat" });
  o.checkProposal_fullDescription = checkProposal({ name: c.name, symbol: c.ticker, tagline: description });
  o.displaySafe = displaySafe({ name: c.name, symbol: c.ticker });
  o.checkFields_blurb_look = checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look });
  o.checkFields_fullDescription = checkFields({ description });
  o.checkTerms_ownStock = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, { stock: own });
  o.checkTerms_otherPairs = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { other_pair: others });
  o.checkTerms_allStonkfunPairNames = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { stonkfun_pair: pairOthers });
  o.checkTerms_launchClaims = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { launch_claim: S.LAUNCH_CLAIMS });
  o.otherXstockRootInTicker = S.STOCK_PAIRS.map((p) => alnum(p.root)).filter((x) => x.length >= 3).find((x) => alnum(c.ticker).includes(x)) ?? null;
  o.siteRefusals = siteRefusals({ name: c.name, symbol: c.ticker, tagline: c.blurb, trend: { title: "cat", source: "google-trends" } });
  o.tickerFree = tickerFree(vidx, { name: c.name, symbol: c.ticker });
  o.copycatOf = copycatOf({ name: c.name, symbol: c.ticker }) ?? null;
  const jt = await jup(c.ticker); await sleep(400);
  const fw = c.name.split(" ")[0];
  const jn = await jup(fw); await sleep(400);
  o.jupTicker = { status: jt.status, results: jt.arr.length, symbolMatches: jt.arr.filter((x) => alnum(x.symbol) === alnum(c.ticker)).map((x) => ({ symbol: x.symbol, name: x.name, verified: verifiedTok(x), id: x.id })) };
  o.jupTicker.verifiedSymbolMatch = o.jupTicker.symbolMatches.some((x) => x.verified);
  o.jupFirstName = { q: fw, status: jn.status, results: jn.arr.length, verifiedSymbolOrNameMatch: jn.arr.filter((x) => verifiedTok(x) && (alnum(x.symbol) === alnum(fw) || normalize(x.name) === normalize(fw))).map((x) => ({ symbol: x.symbol, name: x.name, id: x.id })) };
  o.earlierCollision = earlier.filter((e) => normalize(e.name) === normalize(c.name) || alnum(e.symbol) === alnum(c.ticker) || normalize(e.name).split(" ")[0] === normalize(c.name).split(" ")[0]);
  o.draftsElsewhereSharingFirstWordOrTicker = draftsElsewhere.filter((e) => normalize(e.name).split(" ")[0] === normalize(c.name).split(" ")[0] || alnum(e.symbol) === alnum(c.ticker));
  o.closestEarlierCoats = earlier.filter((e) => e.coat?.base).map((e) => ({ name: e.name, from: e.from, coat: e.coat, d: Math.round(dist(e.coat.base, c.coat.base) + dist(e.coat.second ?? e.coat.base, c.coat.second)) + (e.coat.pattern === c.coat.pattern ? 0 : 60) })).sort((a, b) => a.d - b.d).slice(0, 4);
  o.description = description;
  out.push(o);
}

const RPC = "https://api.mainnet-beta.solana.com";
const rpc = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const MINT = "MGMuubtUEirmkhfEQdmGUh4pr7HuUdMWcZXFtpPbVJD";
let mint = {};
try {
  const a = await rpc("getAccountInfo", [MINT, { encoding: "jsonParsed" }]);
  const info = a?.value?.data?.parsed?.info;
  mint = { owner: a?.value?.owner, decimals: info?.decimals, mintAuthority: info?.mintAuthority, freezeAuthority: info?.freezeAuthority, extensions: (info?.extensions ?? []).map((e) => ({ extension: e.extension, state: e.state })) };
  mint.epoch = (await rpc("getEpochInfo", []))?.epoch;
} catch (e) { mint.error = String(e); }
const pairs = allPairs.filter((p) => p.symbol === PAIR);

console.log(JSON.stringify({ verifiedListSize: vidx.size, othersTermCount: others.length, pairOthersCount: pairOthers.length, earlierCount: earlier.length, disclosureOnly: checkFields({ description: DISC }), out, mint, stonkfunPair: pairs }, null, 1));
