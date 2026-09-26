// Final pre-launch re-check for the launch sheet. Read-only against the repo.
// Loads the editor's final 24 coins, re-runs the repo's content rules, re-checks the ticker on
// Jupiter and on StonkFun, maps each coin to its live StonkFun pair and its image, and writes
// sheet-check.out.json. The sheet itself is written by build-sheet.mjs.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
const rules = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const final = JSON.parse(fs.readFileSync(path.join(DIR, "EDITOR/final.json"), "utf8")).final;
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "images/manifest.json"), "utf8"));
const pairsLive = JSON.parse(fs.readFileSync(path.join(DIR, "stonkfun-site/pairs-ready.json"), "utf8")).data.pairs;

const SF = {
  SPYx: "SPYX", QQQx: "QQQX", GLDx: "GLDX", TSLAx: "TSLAX", NVDAx: "NVDAX", AAPLx: "APPLX", MSFTx: "MSFTX",
  GOOGLx: "GOOGLX", AMZNx: "AMZNX", METAx: "METAX", COINx: "COINX", HOODx: "HOODX", MSTRx: "MSTRX", CRCLx: "CRCLX",
  SPCXx: "SPCXX", PLTRx: "PLTRX", GMEx: "GMEX", STRCx: "STRCX", MCDx: "MCDX", "BRK.Bx": "BRKX", KOx: "KOX",
  INTCx: "INTCX", VIDAx: "VIDAX", DFDVx: "DFDV",
};
const CAT_MEMES = ["POPCAT", "MEW", "MICHI", "GRUMPY", "KITTY", "CAT", "CATS", "NYAN", "MOG", "SCHRODINGER", "MANEKI", "BONGO", "SMUDGE", "KEYBOARDCAT", "PUSSY", "CATWIF", "WIF"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      const text = await r.text();
      if (r.ok) return { status: r.status, body: JSON.parse(text) };
      last = { status: r.status, error: text.slice(0, 200) };
    } catch (e) { last = { status: 0, error: e.message }; }
    await sleep(1500 * (i + 1));
  }
  return last;
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { bytes: b.length, width: b.readUInt32BE(16), height: b.readUInt32BE(20), isPng: b.slice(1, 4).toString() === "PNG" };
}

// Control: StonkFun search must find a symbol we know exists, or a zero result means nothing.
const control = await getJson("https://www.stonkfun.xyz/api/public/v1/tokens?q=AGI");
const controlOk = control.status === 200 && (control.body?.data?.tokens ?? []).some((t) => String(t.symbol).toUpperCase() === "AGI");

const out = [];
for (const c of final) {
  const stockSym = Object.keys(SF).find((k) => c.stock.startsWith(k));
  const sfSym = SF[stockSym];
  const pair = pairsLive.find((p) => p.symbol === sfSym);
  const mintsInText = [...c.stock.matchAll(/\bXs[1-9A-HJ-NP-Za-km-z]{30,44}\b/g)].map((m) => m[0]);
  const disclosureRe = /A cat coin priced in \S+?\. Not affiliated with .+ or StonkFun\. No intrinsic value; not financial advice\.$/;
  const dm = c.description.match(disclosureRe);
  const story = dm ? c.description.slice(0, dm.index).trim() : null;
  const disclosure = dm ? dm[0] : null;

  const proposal = rules.checkProposal({ name: c.name, symbol: c.ticker, tagline: story });
  const fieldsStory = rules.checkFields({ name: c.name, symbol: c.ticker, story, look: c.look });
  const fieldsDesc = rules.checkFields({ description: c.description });
  const fieldsDisc = rules.checkFields({ description: disclosure });
  const disp = rules.displaySafe({ name: c.name, symbol: c.ticker });

  const jupT = await getJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
  const jupList = Array.isArray(jupT.body) ? jupT.body : [];
  const jupSame = jupList.filter((t) => String(t.symbol ?? "").toUpperCase() === c.ticker);
  const sfT = await getJson(`https://www.stonkfun.xyz/api/public/v1/tokens?q=${encodeURIComponent(c.ticker)}`);
  const sfList = sfT.body?.data?.tokens ?? [];
  const sfSame = sfList.filter((t) => String(t.symbol ?? "").toUpperCase() === c.ticker);
  const sfName = await getJson(`https://www.stonkfun.xyz/api/public/v1/tokens?q=${encodeURIComponent(c.name)}`);
  const sfNameSame = (sfName.body?.data?.tokens ?? []).filter((t) => String(t.name ?? "").trim().toLowerCase() === c.name.toLowerCase());

  const img = manifest.find((m) => m.ticker === c.ticker);
  const png = img ? pngSize(img.png) : null;
  const root = stockSym.replace(/x$/, "").replace(".B", "").toUpperCase();

  out.push({
    stock: stockSym, stonkfunSymbol: sfSym, name: c.name, ticker: c.ticker,
    pair: pair ? { symbol: pair.symbol, name: pair.name, mint: pair.mint, launchable: pair.launchable, launchLabReady: pair.launchLabReady, symbolAmbiguous: pair.symbolAmbiguous } : null,
    mintMatchesStockText: mintsInText.length ? mintsInText.every((m) => m === pair?.mint) : "no mint in stock text",
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, story: story?.length ?? null },
    endsWithDisclosure: !!dm,
    disclosureNamesStock: disclosure ? disclosure.includes(`priced in ${stockSym}.`) : false,
    tickerFormat: rules.TICKER.test(c.ticker),
    tickerNotCatMeme: !CAT_MEMES.includes(c.ticker),
    tickerNoRoot: !c.ticker.includes(root) && !c.ticker.includes(sfSym),
    checkProposal: proposal,
    checkFields_name_symbol_story_look: fieldsStory,
    displaySafe: disp,
    checkFields_fullDescription: fieldsDesc,
    checkFields_disclosureOnly: fieldsDisc,
    descriptionViolationsAllFromDisclosure: JSON.stringify(fieldsDesc.violations.map((v) => [v.rule, v.term])) === JSON.stringify(fieldsDisc.violations.map((v) => [v.rule, v.term])),
    jupiter: { status: jupT.status, results: jupList.length, sameSymbol: jupSame.map((t) => ({ id: t.id, name: t.name, isVerified: !!t.isVerified })), verifiedSameSymbol: jupSame.filter((t) => t.isVerified).length },
    stonkfunSearch: { status: sfT.status, results: sfList.length, sameSymbol: sfSame.map((t) => ({ mint: t.mint, name: t.name })), nameStatus: sfName.status, sameName: sfNameSame.map((t) => ({ mint: t.mint, symbol: t.symbol })) },
    image: img ? { png: img.png, jpg512: img.jpg512, jobId: img.job_id, resultUrl: img.result_url, ...png, under2MB: png.bytes <= 2 * 1024 * 1024, square: png.width === png.height } : null,
  });
  await sleep(300);
}

const summary = {
  checkedAt: new Date().toISOString(),
  stonkfunSearchControl: { query: "AGI", ok: controlOk, status: control.status },
  count: out.length,
  allPairsLive: out.every((o) => o.pair && o.pair.launchable && o.pair.launchLabReady),
  allMintsMatch: out.every((o) => o.mintMatchesStockText !== false),
  allProposalOk: out.every((o) => o.checkProposal.ok),
  allFieldsOk: out.every((o) => o.checkFields_name_symbol_story_look.ok && o.displaySafe.ok),
  allDescViolationsFromDisclosure: out.every((o) => o.descriptionViolationsAllFromDisclosure),
  allLengthsOk: out.every((o) => o.lengths.name <= 32 && o.lengths.ticker <= 10 && o.lengths.description <= 280),
  allDisclosure: out.every((o) => o.endsWithDisclosure && o.disclosureNamesStock),
  allTickerRules: out.every((o) => o.tickerFormat && o.tickerNotCatMeme && o.tickerNoRoot),
  jupiterVerifiedClashes: out.filter((o) => o.jupiter.verifiedSameSymbol > 0).map((o) => o.ticker),
  jupiterErrors: out.filter((o) => o.jupiter.status !== 200).map((o) => o.ticker),
  stonkfunSymbolTaken: out.filter((o) => o.stonkfunSearch.sameSymbol.length).map((o) => o.ticker),
  stonkfunNameTaken: out.filter((o) => o.stonkfunSearch.sameName.length).map((o) => o.name),
  stonkfunErrors: out.filter((o) => o.stonkfunSearch.status !== 200 || o.stonkfunSearch.nameStatus !== 200).map((o) => o.ticker),
  allImagesOk: out.every((o) => o.image && o.image.isPng && o.image.square && o.image.under2MB),
  uniqueTickers: new Set(out.map((o) => o.ticker)).size === out.length,
  uniqueNames: new Set(out.map((o) => o.name.toLowerCase())).size === out.length,
  uniquePairs: new Set(out.map((o) => o.stonkfunSymbol)).size === out.length,
};
fs.writeFileSync(path.join(DIR, "sheet-check.out.json"), JSON.stringify({ summary, coins: out }, null, 1));
console.log(JSON.stringify(summary, null, 1));
