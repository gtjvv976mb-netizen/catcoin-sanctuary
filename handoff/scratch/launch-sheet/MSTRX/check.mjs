import fs from "node:fs";
const R = "/home/user/Cat-Intelligence-Agency";
const OUT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/MSTRX";
const { checkProposal, checkTerms } = await import(`${R}/bots/lib/content-rules.mjs`);
const { stockCatRefusals, stockDraft, STOCK_PAIRS } = await import(`${R}/src/lib/stockcats.mjs`);
const { verifiedIndex } = await import(`${R}/bots/cashcat/tickers.mjs`);
const { copycatOf } = await import(`${R}/bots/popcat/established.mjs`);

const DISC = "A cat coin priced in MSTRx. Not affiliated with Strategy Inc. (MicroStrategy) or StonkFun. No intrinsic value; not financial advice.";
const cands = JSON.parse(fs.readFileSync(`${OUT}/candidates.json`, "utf8"));

let vlist = null;
try {
  const r = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
  const j = await r.json(); fs.writeFileSync(`${OUT}/jup-verified-list.json`, JSON.stringify(j));
  vlist = verifiedIndex(j);
} catch (e) { console.log("verified list error", e.message); }

const pair = STOCK_PAIRS.find((p) => p.symbol === "MSTRx");
const notes = [{ mint: pair.mint, people: ["Michael Saylor", "Saylor", "Phong Le"], mascots: ["Hank"],
  brands: ["Strategy", "MicroStrategy", "MSTR", "STRK", "STRF", "STRD", "STRC", "STRE", "Bitcoin", "Saylor"],
  catFacts: [], searchedAt: "2026-09-25", method: "checker in-memory row from notes/MSTRX.md" }];

const results = [];
for (const c of cands) {
  const q = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
  const raw = await q.text();
  fs.writeFileSync(`${OUT}/jup-search-${c.ticker}.json`, raw);
  let arr = []; try { arr = JSON.parse(raw); } catch {}
  const symHits = arr.filter((t) => String(t.symbol).toLowerCase() === c.ticker.toLowerCase());
  const verifiedHits = symHits.filter((t) => t.isVerified === true);
  const tagline = c.description.endsWith(DISC) ? c.description.slice(0, -DISC.length).trim() : null;
  const full = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description, trend: "cat" });
  const creative = checkProposal({ name: c.name, symbol: c.ticker, tagline, trend: "cat" });
  const draft = stockDraft({ name: c.name, symbol: c.ticker, tagline }, pair);
  const sc = stockCatRefusals(draft, pair, { notes, verifiedIndex: vlist });
  const lookTerms = checkTerms({ look: c.look }, { pair_term: ["MSTRx", "MSTR", "MicroStrategy", "Strategy", "Saylor", "Hank", "Bitcoin", "BTC"] });
  results.push({ ticker: c.ticker, name: c.name,
    lens: { name: c.name.length, ticker: c.ticker.length, desc: c.description.length, tagline: tagline?.length },
    tickerFormat: /^[A-Z0-9]{2,10}$/.test(c.ticker), disclosureExact: c.description.endsWith(DISC),
    jupiter: { results: arr.length, symbolMatches: symHits.map((t) => ({ symbol: t.symbol, name: t.name, id: t.id, isVerified: t.isVerified })), verifiedCollision: verifiedHits.length > 0 },
    copycat: copycatOf({ name: c.name, symbol: c.ticker }),
    checkProposal_fullDescription: full.violations, checkProposal_taglineOnly: creative.violations,
    stockCatRefusals: sc.map((x) => x.message), lookTerms: lookTerms.violations });
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
