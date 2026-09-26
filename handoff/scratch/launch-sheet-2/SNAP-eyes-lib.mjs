// Checker pass for SNAP (backpack): the fixed pick (gold-brown -> honey-brown eyes; pads -> trots).
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

const PAIR = "SNAP";
const DISC = "A cat coin priced in SNAP. Not affiliated with Snap Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = [];
// The stock's own terms: the drafter's list plus the co-founders and executives, and product names.
const own = ["Snap", "Snap Inc", "Snapchat", "Snapchatter", "Snapchatters", "SNAP", "SNAPx", "SNP", "Ghostface Chillah", "Ghostface", "Chillah", "ghost", "Bitmoji", "Lens", "Lenses", "Lens Studio", "Spectacles",
  "My AI", "Snapstreak", "streak", "Snap Map", "Memories", "Stories", "Spotlight", "Discover", "Snapchat+", "Picaboo", "Zenly", "Looksery", "Sky Segmentation", "Specs",
  "Evan Spiegel", "Spiegel", "Bobby Murphy", "Murphy", "Reggie Brown", "Grace Kao", "Kao", "P-22", "P22", "Griffith", "Wallis Annenberg", "Annenberg", "Liberty Canyon",
  "Rocket Cat", "Wabisabi", "Spooky Pet", "Plush Cat Slippers", "cat burglar", "Send Chinatown Love", "Year of the Tiger", "watercolor tiger", "mountain lion", "cougar", "puma", "tiger", "wildlife crossing",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole"];

// Other pairs: the 24 xStocks (the first sheet's simulated rows, via the repo's pairTerms) and the other researched stocks' checker lists.
const notes = notesFor(S.STOCK_PAIRS);
const xstockTerms = S.STOCK_PAIRS.flatMap((p) => [...S.pairTerms(p, notes), ...(ROWS[p.symbol]?.extra ?? [])]);
const otherTerms = [];
for (const f of fs.readdirSync(DIR).filter((f) => /^[A-Z0-9]+-(pick-)?check\.mjs$/.test(f) && !f.startsWith("SNAP-"))) {
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
for (const f of fs.readdirSync(DIR).filter((f) => /-coins\d?\.json$/.test(f) && !f.startsWith("SNAP-"))) {
  const raw = fs.readFileSync(`${DIR}/${f}`, "utf8");
  for (const m of raw.matchAll(/"name"\s*:\s*"([^"]+)"\s*,\s*"ticker"\s*:\s*"([^"]+)"/g)) draftsElsewhere.push({ name: m[1], symbol: m[2], from: f });
}

export { others, own, checkProposal, checkFields, checkTerms, S };
