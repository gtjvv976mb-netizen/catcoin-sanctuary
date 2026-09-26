import { readFileSync, writeFileSync } from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/INTCX";
const R = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, checkTerms, TICKER } = await import(R + "/bots/lib/content-rules.mjs");
const { verifiedIndex, tickerFree } = await import(R + "/bots/cashcat/tickers.mjs");
const { copycatOf } = await import(R + "/bots/popcat/established.mjs");
const { stockCatRefusals, STOCK_PAIRS } = await import(R + "/src/lib/stockcats.mjs");
const { BACKGROUNDS } = await import(R + "/bots/cashcat/logo-layout.mjs");
const cands = JSON.parse(readFileSync(DIR + "/candidates.json", "utf8"));
const DISC = "A cat coin priced in INTCx. Not affiliated with Intel or StonkFun. No intrinsic value; not financial advice.";
const STOCK_TERMS = ["INTC", "INTCX", "INTCx", "Intel", "Intel xStock", "xStock", "Backed", "Intel Inside", "Pentium", "Celeron", "Xeon", "Core Ultra", "vPro", "Optane", "Gaudi", "Altera", "Mobileye",
  "Update Cat", "UpdateMeow", "Update Meow", "NCSA", "Waffles", "Cole and Marmalade", "Marmalade", "Audrey Plonk",
  "Wildcat", "Wildcat Lake", "Tiger Lake", "Panther Lake", "Jaguar Shores", "Lion Cove", "Cougar Point", "Panther Point", "Tiger Point", "Bobcat Peak", "Panther", "Tiger", "Jaguar", "Lion", "Cougar", "Bobcat",
  "Bunny People", "Leopold", "Gelsinger", "Lip-Bu Tan", "Noyce", "Morris"];
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","CWIF","SC","MANEKI","CATWIF","WIF"]);
let vIdx = null;
{
  const r = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
  const raw = await r.text();
  writeFileSync(DIR + "/jup-verified-list.json", raw);
  const list = JSON.parse(raw); vIdx = verifiedIndex(list);
  writeFileSync(DIR + "/jup-verified-count.json", JSON.stringify({ status: r.status, count: list.length, fetchedAt: new Date().toISOString() }));
}
const pair = STOCK_PAIRS.find((p) => p.symbol === "INTCx");
const notes = [{ mint: pair.mint, people: ["Lip-Bu Tan", "Pat Gelsinger", "Audrey Plonk"], mascots: ["Update Cat", "UpdateMeow", "Bunny People", "Waffles the Cat", "Cole and Marmalade"], brands: ["Intel", "Intel Inside", "Core", "Pentium", "Xeon", "Wildcat Lake", "Tiger Lake", "Panther Lake", "Jaguar Shores", "Lion Cove"],
  catFacts: [{ text: "Update Cat, Intel and NCSA #UpdateMeow campaign, 31 Oct 2018", source: "https://www.staysafeonline.org/press/intel-ncsa-team-up-remind-cool-cats-updatemeow", readAt: "2026-09-25" },
             { text: "Code Name Products formerly Wildcat Lake, launch Q2'26", source: "https://www.intel.com/content/www/us/en/products/sku/246018/intel-core-5-processor-320-6m-cache-up-to-4-60-ghz/specifications.html", readAt: "2026-09-25" }],
  searchedAt: "2026-09-25", method: "web + Intel ARK + NCSA press release" }];
const out = [];
for (const c of cands) {
  const tagline = c.description.endsWith(" " + DISC) ? c.description.slice(0, -DISC.length - 1) : null;
  const q = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(c.ticker));
  const raw = await q.text();
  writeFileSync(`${DIR}/jup-search-${c.ticker}.json`, raw);
  let arr = []; try { arr = JSON.parse(raw); } catch {}
  const exact = arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker.toUpperCase());
  out.push({
    name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, tagline: tagline?.length },
    tickerFormat: TICKER.test(c.ticker),
    disclosureVerbatimAtEnd: !!tagline,
    memeTicker: MEME.has(c.ticker),
    tickerHasINTC: /INTC|INTEL/.test(c.ticker),
    checkProposal: checkProposal({ name: c.name, symbol: c.ticker, tagline }),
    checkFieldsFullDescription: checkFields({ description: c.description }),
    checkTermsStockWords: checkTerms({ name: c.name, symbol: c.ticker, tagline }, { pair_term: STOCK_TERMS }),
    jupiterSearch: { status: q.status, results: arr.length, exactSymbol: exact.map((t) => ({ symbol: t.symbol, name: t.name, id: t.id, isVerified: t.isVerified, tags: t.tags })), verifiedExact: exact.filter((t) => t.isVerified).length },
    tickerFree: tickerFree(vIdx, { name: c.name, symbol: c.ticker }),
    copycatOf: copycatOf({ name: c.name, symbol: c.ticker }) ?? null,
    stockCatRefusals: stockCatRefusals({ name: c.name, symbol: c.ticker, tagline, kitten: "greytabby", background: Object.keys(BACKGROUNDS)[0], pairMint: pair.mint }, pair, { notes, verifiedIndex: vIdx }),
  });
}
writeFileSync(DIR + "/check-results.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
