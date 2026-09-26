// Checker pass for FIGUREAI (prestock). Re-runs every rule on the three drafts and on the fixed pick.
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

const PAIR = "FIGUREAI";
const DISC = "A cat coin priced in FIGUREAI. Not affiliated with Figure AI, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { id: "D1", name: "Knit the Woolly Grey Cat", ticker: "KNITPAW", look: "A plush ash-grey tabby with a woolly coat and faint ribbed stripes, careful paws, wearing nothing.",
    blurb: "Knit, a plush ash-grey tabby with a soft woolly coat and faint ribbed stripes, pads between the flowerpots so carefully that none ever tips over." },
  { id: "D2", name: "Tidy the Tuxedo Cat", ticker: "TIDYTUX", look: "A black-and-white tuxedo cat with white mittens, wearing nothing.",
    blurb: "Tidy, a black-and-white tuxedo cat with neat white mittens, carries fallen leaves one by one to a pile by the shed, then naps on the folded blankets." },
  { id: "D3", name: "Dewdrop the Soft-Paw Cat", ticker: "SOFTTOES", look: "A pale silver cat with a white chest and paws and pink toe beans, wearing nothing.",
    blurb: "Dewdrop, a pale silver cat with a white chest and extra-soft pink toe beans, taps a ladybug on a leaf so gently that it does not even fly away." },
  { id: "PICK", name: "Knit the Woolly Grey Cat", ticker: "KNITPAW",
    look: "A plush, woolly-coated pale ash-grey house cat with faint, low-contrast ribbed tabby stripes, amber eyes, soft careful paws, normal four-legged build; it wears nothing.",
    blurb: "Knit, a plush pale ash-grey tabby with a soft woolly coat and faint ribbed stripes, pads between the flowerpots so carefully that none ever tips over." },
];

const own = ["FIGUREAI", "Figure", "Figure AI", "Figure AI Inc", "Figure AI PreStocks", "FIG", "FIGU", "FIGR", "FIGAI", "PreStocks", "PreStock", "prestock", "pre-IPO", "SPV",
  "Brett", "Adcock", "Brett Adcock", "Jerry Pratt", "Pratt", "Archer", "Vettery", "Helix", "Helix 02", "BotQ", "Index", "Go-Big", "Project Go-Big", "F.03", "F03", "F.02", "F02",
  "Figure 01", "Figure 02", "Figure 03", "humanoid", "robot", "robots", "robotics", "bot", "droid", "android", "automaton", "cyborg", "mech", "machine", "BMW", "Catalyst", "Catalyst Brands",
  "Brookfield", "Parkway", "kitty litter", "litter", "Hello Kitty", "Master Plan", "palm camera", "tactile sensor", "wireless charging"];

const notes = notesFor(S.STOCK_PAIRS);
const xstockTerms = S.STOCK_PAIRS.flatMap((p) => [...S.pairTerms(p, notes), ...(ROWS[p.symbol]?.extra ?? [])]);
const otherTerms = [];
for (const f of fs.readdirSync(DIR).filter((f) => /^[A-Z0-9]+-(pick-)?check\.mjs$/.test(f) && !f.startsWith("FIGUREAI"))) {
  const src = fs.readFileSync(`${DIR}/${f}`, "utf8");
  const m = src.match(/stock(?:Terms)?\s*[:=]\s*(?:\{\s*stock:\s*)?(\[[^\]]*\])/);
  if (!m) continue;
  try { otherTerms.push(...Function(`return ${m[1]}`)()); } catch {}
}
const ownN = own.map((o) => normalize(o));
const others = [...new Set([...xstockTerms, ...otherTerms])].filter((t) => !ownN.includes(normalize(t)));

const earlier = [];
try { for (const c of JSON.parse(fs.readFileSync(`${SP}/launch-sheet/EDITOR/final.json`, "utf8")).final) earlier.push({ name: c.name, symbol: c.ticker, coat: c.coat, from: "launch-sheet final" }); } catch {}
for (const f of fs.readdirSync(DIR).filter((f) => /-pick\.json$/.test(f))) {
  try { const j = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); const c = j.pick ?? j; earlier.push({ name: c.name, symbol: c.ticker, coat: c.coat, from: f }); } catch {}
}
const draftsElsewhere = [];
for (const f of fs.readdirSync(DIR).filter((f) => /-coins\d?\.json$/.test(f) && !f.startsWith("FIGUREAI"))) {
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
const MEME = new Set(["POPCAT", "MEW", "MICHI", "GRUMPY", "KITTY", "CAT", "CATS", "NYAN", "KITTEN", "TABBY", "MOCHI", "MOG", "PUSS", "MEOW", "PURR", "GINGER", "NEKO", "WIF", "CATWIF", "CWIF", "MANEKI", "SC", "LION", "LEO", "ROAR", "MANE", "FATCAT", "TUX", "PAW", "PAWS", "TOEBEANS", "BEANS"]);
const alnum = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const verifiedTok = (x) => x.isVerified === true || (Array.isArray(x.tags) && x.tags.includes("verified"));

const out = [];
for (const c of coins) {
  const description = `${c.blurb} ${DISC}`;
  const o = { id: c.id, name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, blurb: c.blurb.length, description: description.length },
    limitsOk: c.name.length <= 32 && description.length <= 280 && c.blurb.length <= 160,
    tickerFormat: TICKER.test(c.ticker), memeTicker: MEME.has(c.ticker),
    notStockTicker: !["FIGUREAI", "FIGURE", "FIG", "FIGR"].some((t) => c.ticker.startsWith(t) || c.ticker.endsWith(t) || c.ticker.includes(t)),
    disclosureEndsRight: description.endsWith("No intrinsic value; not financial advice.") && description.includes(`A cat coin priced in ${PAIR}.`) && description.includes("Not affiliated with Figure AI, PreStocks or StonkFun."),
  };
  o.checkProposal = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_withTrendCat = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb, trend: "cat" });
  o.checkProposal_fullDescription = checkProposal({ name: c.name, symbol: c.ticker, tagline: description });
  o.displaySafe = displaySafe({ name: c.name, symbol: c.ticker });
  o.checkFields_blurb_look = checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look });
  o.checkFields_fullDescription = checkFields({ description });
  o.checkFields_disclosureOnly = checkFields({ description: DISC });
  o.checkTerms_ownStock = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, { stock: own });
  o.checkTerms_otherPairs = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { other_pair: others });
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
  o.description = description;
  out.push(o);
}

const RPC = "https://api.mainnet-beta.solana.com";
const rpc = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const MINT = "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd";
let mint = {};
try {
  const a = await rpc("getAccountInfo", [MINT, { encoding: "jsonParsed" }]);
  const info = a?.value?.data?.parsed?.info;
  mint = { owner: a?.value?.owner, decimals: info?.decimals, mintAuthority: info?.mintAuthority, freezeAuthority: info?.freezeAuthority, extensions: (info?.extensions ?? []).map((e) => ({ extension: e.extension, state: e.state })) };
  mint.epoch = (await rpc("getEpochInfo", []))?.epoch;
} catch (e) { mint.error = String(e); }
const pairs = JSON.parse(fs.readFileSync(`${SP}/stockcats/stonkfun-pairs.json`, "utf8")).data.pairs.filter((p) => p.symbol === PAIR);

console.log(JSON.stringify({ verifiedListSize: vidx.size, othersTermCount: others.length, earlierCount: earlier.length, out, mint, stonkfunPair: pairs }, null, 1));
