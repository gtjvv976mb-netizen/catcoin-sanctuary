import { writeFileSync } from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/CRCLX";
const REPO = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import(REPO + "/bots/lib/content-rules.mjs");
const { verifiedIndex, tickerFree } = await import(REPO + "/bots/cashcat/tickers.mjs");
const { copycatOf } = await import(REPO + "/bots/popcat/established.mjs");
const S = await import(REPO + "/src/lib/stockcats.mjs");
const DISC = "A cat coin priced in CRCLx. Not affiliated with Circle or StonkFun. No intrinsic value; not financial advice.";
const cands = [
 { name: "Doughball the Bowler Cat", ticker: "DOUGHBALL", description: "Doughball, a plump black-and-white cat in a tiny brown felt bowler hat, waddles between the herb beds and naps in any sunny flowerpot big enough to hold him. A cat coin priced in CRCLx. Not affiliated with Circle or StonkFun. No intrinsic value; not financial advice." },
 { name: "Tuppence the Tweed Cat", ticker: "TUPPENCE", description: "Tuppence, a tubby silver tabby in a flat tweed cap, strolls the garden path each morning, then settles on the warm bench to watch the bees go by. A cat coin priced in CRCLx. Not affiliated with Circle or StonkFun. No intrinsic value; not financial advice." },
 { name: "Porridge the Sun Hat Cat", ticker: "PORRIDGE", description: "Porridge, a chubby oat-coloured cat with a white bib and a wide straw sun hat, dozes in the pumpkin patch and wakes only when a treat bag rustles. A cat coin priced in CRCLx. Not affiliated with Circle or StonkFun. No intrinsic value; not financial advice." },
];
const vr = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
const vtxt = await vr.text(); writeFileSync(DIR + "/jup-verified-list.json", vtxt);
const vlist = JSON.parse(vtxt); const idx = verifiedIndex(vlist);
const pair = S.STOCK_PAIRS.find((p) => p.symbol === "CRCLx");
const notes = [{ mint: pair.mint, people: ["Jeremy Allaire", "Allaire", "Sean Neville"], mascots: ["Fat Cat Bat Rat", "Cat Bat Hat Fat Rat", "FatCatBatRatWifHat", "UpSideDownCat", "USDCat", "Argus Cat", "ARCAT", "BEANCAT", "Bean Cat", "CashCat"],
  brands: ["Circle", "Circle Internet Group", "USDC", "USD Coin", "EURC", "Arc", "CCTP", "Circle Mint", "Chelsea", "Chelsea FC"],
  catFacts: [{ text: "Reported USDC ad with a hat-wearing Fat Cat Bat Rat character (original ad not located)", source: "https://www.kucoin.com/news/flash/arc-chain-meme-coin-usdc-market-cap-temporarily-surpasses-4-million", readAt: "2026-09-25" }],
  searchedAt: "2026-09-25", method: "checker simulation from notes/CRCLX.md" }];
const alnum = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const memeTickers = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MOG","MANEKI","CWIF","CATWIF","WIF","FATCAT","HATCAT","ARCAT","BEANCAT","USDCAT","CASHCAT","COOL","SC"];
const out = { pair: { symbol: pair.symbol, root: pair.root, stonkfun: pair.stonkfun, stonkfunName: pair.stonkfunName, name: pair.name, mint: pair.mint }, verifiedList: { status: vr.status, size: idx.size, fetchedAt: new Date().toISOString() }, disclosureOnly: checkFields({ description: DISC }), results: [] };
for (const c of cands) {
  const endsWithDisclosure = c.description.endsWith(" " + DISC);
  const story = endsWithDisclosure ? c.description.slice(0, -DISC.length - 1) : c.description;
  const q = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(c.ticker));
  const raw = await q.text(); writeFileSync(`${DIR}/jup-search-${c.ticker}.json`, raw);
  let arr = []; try { arr = JSON.parse(raw); if (!Array.isArray(arr)) arr = arr.tokens ?? []; } catch {}
  const exact = arr.filter((t) => String(t.symbol).toLowerCase() === c.ticker.toLowerCase());
  const draft = S.stockDraft({ name: c.name, symbol: c.ticker, tagline: story }, pair);
  const r = {
    name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, story: story.length },
    limitsOk: c.name.length <= 32 && c.ticker.length <= 10 && c.description.length <= 280,
    tickerFormat: TICKER.test(c.ticker), endsWithDisclosure,
    checkProposal_story: checkProposal({ name: c.name, symbol: c.ticker, tagline: story }),
    checkFields_fullDescription: checkFields({ description: c.description }),
    checkFields_storyOnly: checkFields({ description: story }),
    displaySafe: displaySafe({ name: c.name, symbol: c.ticker }),
    stockCatRefusals: S.stockCatRefusals(draft, pair, { notes, verifiedIndex: idx }),
    tickerFree: tickerFree(idx, { name: c.name, symbol: c.ticker }),
    copycatOf: copycatOf({ name: c.name, symbol: c.ticker }) ?? null,
    containsStockRoot: ["CRCL", "CIRC", "CIRCLE", "USDC", "EURC", "ARC"].filter((x) => alnum(c.ticker).includes(x)),
    otherXstockRootsInTicker: S.STOCK_PAIRS.map((p) => alnum(p.root)).filter((x) => x.length >= 3 && alnum(c.ticker).includes(x)),
    memeTickerHit: memeTickers.filter((m) => alnum(c.ticker) === m),
    jupiterSearch: { status: q.status, results: arr.length, exactSymbol: exact.map((t) => ({ symbol: t.symbol, name: t.name, id: t.id, isVerified: t.isVerified ?? null, tags: t.tags, holderCount: t.holderCount, mcap: t.mcap, liquidity: t.liquidity })), verifiedExact: exact.filter((t) => t.isVerified === true).length },
    verifiedListNear: vlist.filter((t) => { const s = alnum(t.symbol); return s.length >= 4 && (s.includes(c.ticker) || c.ticker.includes(s)); }).map((t) => `${t.symbol}|${t.name}`).slice(0, 20),
    verifiedListNameNear: vlist.filter((t) => String(t.name).toLowerCase().includes(c.name.split(" ")[0].toLowerCase())).map((t) => `${t.symbol}|${t.name}`).slice(0, 20),
  };
  out.results.push(r);
}
writeFileSync(DIR + "/check.out.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
