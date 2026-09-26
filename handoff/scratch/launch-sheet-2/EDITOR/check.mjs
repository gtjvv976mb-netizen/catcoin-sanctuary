import fs from "node:fs";
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const R = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER, normalize } = await import(`${R}/bots/lib/content-rules.mjs`);
const S = await import(`${R}/src/lib/stockcats.mjs`);
const { verifiedIndex, tickerFree } = await import(`${R}/bots/cashcat/tickers.mjs`);
const { copycatOf } = await import(`${R}/bots/popcat/established.mjs`);
const { siteRefusals } = await import(`${R}/bots/cashcat/invent.mjs`);
const { ROWS, notesFor } = await import(`${SP}/launch-sheet/EDITOR/rows.mjs`);
const { ownTermsFor } = await import("./terms.mjs");
const F = JSON.parse(fs.readFileSync("final.json"));
const X = JSON.parse(fs.readFileSync(`${SP}/launch-sheet/launch-sheet.json`));
const PAIRS = JSON.parse(fs.readFileSync(`${SP}/stockcats/stonkfun-pairs.json`)).data.pairs;
const notes = notesFor(S.STOCK_PAIRS);
const xstockTerms = S.STOCK_PAIRS.flatMap((p) => [...S.pairTerms(p, notes), ...(ROWS[p.symbol]?.extra ?? [])]);
const own = Object.fromEntries(F.map((c) => [c.k, ownTermsFor(c.k)]));
const alnum = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG","PUSS","MEOW","PURR","GINGER","NEKO","WIF","CATWIF","CWIF","MANEKI","SC","LION","LEO","ROAR","MANE","FATCAT","SIMBA","TOSHI","HOBBES","KEYCAT","SCHRODI","QCAT","LAWYERCAT","NOTACAT","CATCOIN","GARF","PUFF","BONK"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function jup(q) {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      if (res.status === 429) { await sleep(3000); continue; }
      const arr = await res.json().catch(() => []);
      return { status: res.status, arr: Array.isArray(arr) ? arr : [] };
    } catch (e) { await sleep(1500); }
  }
  return { status: 0, arr: [] };
}
const vres = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified"); const vlist = await vres.json(); const vidx = verifiedIndex(vlist);
const verifiedTok = (x) => x.isVerified === true || (Array.isArray(x.tags) && x.tags.includes("verified"));
const allPairSyms = new Set(PAIRS.map((p) => alnum(p.symbol)));
const only = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const out = [];
for (const c of F) {
  if (only && !only.has(c.k)) continue;
  const others = [...new Set([...xstockTerms, ...F.filter((o) => o.k !== c.k).flatMap((o) => own[o.k])])].filter((t) => !own[c.k].some((o) => normalize(o) === normalize(t)));
  const pairSym = c.disc.match(/^A cat coin priced in (\S+?)\./)[1];
  const pairRows = PAIRS.filter((p) => p.symbol === pairSym);
  const o = { k: c.k, name: c.name, ticker: c.ticker, changed: c.changed,
    lengths: { name: c.name.length, blurb: c.blurb.length, description: c.description.length },
    limitsOk: c.name.length <= 32 && c.description.length <= 280,
    tickerFormat: TICKER.test(c.ticker), memeTicker: MEME.has(c.ticker), tickerIsPairSymbol: allPairSyms.has(alnum(c.ticker)),
    ownRootInTicker: [pairSym, ...own[c.k].filter((t) => /^[A-Z0-9&]{2,6}$/.test(t))].map(alnum).filter((r) => r.length >= 2 && alnum(c.ticker).includes(r)),
    otherXstockRootInTicker: S.STOCK_PAIRS.map((p) => alnum(p.root)).filter((x) => x.length >= 3).filter((x) => alnum(c.ticker).includes(x)),
    disclosure: { endsRight: c.description.endsWith(" No intrinsic value; not financial advice.") && c.description.endsWith(c.disc), pairSym, pairListed: pairRows.length > 0, pairLaunchable: pairRows.map((p) => [p.mint, p.category, p.launchable, p.launchLabReady, p.tokenProgram]) },
    officialWord: /\bofficial/i.test(c.description),
  };
  o.checkProposal_blurb = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.displaySafe = displaySafe({ name: c.name, symbol: c.ticker });
  o.checkFields_name_symbol_blurb_look = checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look });
  o.checkFields_description = checkFields({ description: c.description });
  o.checkFields_disclosureOnly = checkFields({ description: c.disc });
  o.descriptionHitsAllFromDisclosure = JSON.stringify(o.checkFields_description.violations) === JSON.stringify(o.checkFields_disclosureOnly.violations);
  o.checkProposal_fullDescriptionAsTagline = checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description });
  o.checkTerms_own = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, { stock: own[c.k] });
  o.ownTermCount = own[c.k].length;
  o.checkTerms_otherPairs = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { other_pair: others });
  o.checkTerms_launchClaims = checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, { launch_claim: S.LAUNCH_CLAIMS });
  o.siteRefusals = siteRefusals({ name: c.name, symbol: c.ticker, tagline: c.blurb, trend: { title: "cat", source: "google-trends" } });
  o.tickerFree = tickerFree(vidx, { name: c.name, symbol: c.ticker });
  o.copycatOf = copycatOf({ name: c.name, symbol: c.ticker }) ?? null;
  const jt = await jup(c.ticker); await sleep(350);
  o.jupTicker = { status: jt.status, results: jt.arr.length, symbolMatches: jt.arr.filter((x) => alnum(x.symbol) === alnum(c.ticker)).map((x) => ({ symbol: x.symbol, name: x.name, verified: verifiedTok(x), id: x.id, holders: x.holderCount })) };
  o.jupTicker.verifiedSymbolMatch = o.jupTicker.symbolMatches.some((x) => x.verified);
  if (c.changed.includes("name") || c.changed.includes("ticker")) {
    const first = c.name.split(" ")[0];
    const jn = await jup(first); await sleep(350);
    o.jupFirstWord = { q: first, status: jn.status, results: jn.arr.length, symbolOrNameMatches: jn.arr.filter((x) => alnum(x.symbol) === alnum(first) || normalize(x.name) === normalize(first)).map((x) => ({ symbol: x.symbol, name: x.name, verified: verifiedTok(x), holders: x.holderCount })) };
  }
  out.push(o);
}
fs.writeFileSync(only ? "check-partial.out.json" : "check.out.json", JSON.stringify({ checkedAt: new Date().toISOString(), verifiedListSize: vidx.size, out }, null, 1));
for (const o of out) {
  const flags = [];
  if (!o.limitsOk) flags.push("LIMITS");
  if (!o.tickerFormat) flags.push("TICKERFMT");
  if (o.memeTicker) flags.push("MEME");
  if (o.tickerIsPairSymbol) flags.push("PAIRSYM");
  if (o.ownRootInTicker.length) flags.push("OWNROOT:" + o.ownRootInTicker);
  if (o.otherXstockRootInTicker.length) flags.push("XROOT:" + o.otherXstockRootInTicker);
  if (!o.disclosure.endsRight || !o.disclosure.pairListed) flags.push("DISC");
  if (o.officialWord) flags.push("OFFICIAL");
  if (!o.checkProposal_blurb.ok) flags.push("PROPOSAL:" + JSON.stringify(o.checkProposal_blurb.violations));
  if (!o.displaySafe.ok) flags.push("DISPLAY");
  if (!o.checkFields_name_symbol_blurb_look.ok) flags.push("FIELDS:" + JSON.stringify(o.checkFields_name_symbol_blurb_look.violations));
  if (!o.descriptionHitsAllFromDisclosure) flags.push("DESC!=DISC:" + JSON.stringify(o.checkFields_description.violations));
  if (!o.checkTerms_own.ok) flags.push("OWN:" + JSON.stringify(o.checkTerms_own.violations));
  if (!o.checkTerms_otherPairs.ok) flags.push("OTHER:" + JSON.stringify(o.checkTerms_otherPairs.violations));
  if (!o.checkTerms_launchClaims.ok) flags.push("CLAIM:" + JSON.stringify(o.checkTerms_launchClaims.violations));
  if (o.siteRefusals.length) flags.push("SITE:" + o.siteRefusals);
  if (!o.tickerFree.ok) flags.push("TICKERFREE:" + JSON.stringify(o.tickerFree.reasons));
  if (o.copycatOf) flags.push("COPYCAT");
  if (o.jupTicker.status !== 200) flags.push("JUPSTATUS" + o.jupTicker.status);
  if (o.jupTicker.symbolMatches.length) flags.push("JUPSYM:" + JSON.stringify(o.jupTicker.symbolMatches));
  if (o.jupFirstWord?.symbolOrNameMatches?.length) flags.push("JUPFIRST:" + o.jupFirstWord.symbolOrNameMatches.map((x) => `${x.symbol}/${x.name}/${x.verified ? "VERIFIED" : "unverified"}/${x.holders}`).join(";"));
  console.log(o.k.padEnd(12), o.ticker.padEnd(11), o.lengths.description, flags.join("  "));
}
