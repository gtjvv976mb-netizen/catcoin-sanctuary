// Builds launch-sheet-2/launch-sheet.json from the FINAL CATS list (cats-a/b/c.json, transcribed from the task),
// StonkFun's pairs list, the image manifest and the editor's on-chain mint re-read. Re-runs the repo's content rules
// on the final text and re-queries Jupiter for every ticker.
import fs from "node:fs";
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const D = `${SP}/launch-sheet-2`;
const R = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, displaySafe, TICKER, normalize } = await import(`${R}/bots/lib/content-rules.mjs`);
const J = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const cats = ["a", "b", "c"].flatMap((x) => J(`${D}/SHEET/cats-${x}.json`));
const why = J(`${D}/SHEET/why.json`);
const PAIRS = J(`${SP}/stockcats/stonkfun-pairs.json`).data.pairs;
const pairsMeta = J(`${SP}/stockcats/stonkfun-pairs.json`).meta;
const IMG = Object.fromEntries(J(`${D}/images/results.json`).map((r) => [r.ticker, r]));
const MINTS = J(`${D}/EDITOR/mints.out.json`);
const mintRow = Object.fromEntries(MINTS.rows.map((r) => [r.mint, r]));
const X = J(`${SP}/launch-sheet/launch-sheet.json`);
const byMint = Object.fromEntries(PAIRS.map((p) => [p.mint, p]));
const TAB = { backpack: "Sunrise", prestock: "PreStocks", tessera: "Tessera" };
const ISSUER = { backpack: "Backpack Securities", prestock: "PreStocks", tessera: "Tessera" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alnum = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

async function jup(q) {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      if (res.status === 429) { await sleep(3000); continue; }
      const arr = await res.json().catch(() => []);
      return { status: res.status, arr: Array.isArray(arr) ? arr : [] };
    } catch { await sleep(1500); }
  }
  return { status: 0, arr: [] };
}
const verifiedTok = (x) => x.isVerified === true || (Array.isArray(x.tags) && x.tags.includes("verified"));

const out = [];
const problems = [];
for (const [i, c] of cats.entries()) {
  const cut = c.description.indexOf(" A cat coin priced in ");
  const story = c.description.slice(0, cut);
  const disclosure = c.description.slice(cut + 1);
  const pairSym = disclosure.match(/^A cat coin priced in (\S+?)\. /)[1];
  const mints = [...new Set(c.stock.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? [])].filter((m) => byMint[m]);
  const pairs = mints.map((m) => byMint[m]);
  if (!pairs.length) problems.push(`${c.ticker}: no pair mint found in stock text`);
  for (const p of pairs) if (p.symbol !== pairSym) problems.push(`${c.ticker}: pair symbol ${p.symbol} != disclosure ${pairSym}`);
  const img = IMG[c.ticker];
  if (!img) problems.push(`${c.ticker}: no image`);
  const pngBytes = fs.statSync(img.png).size;
  const hdr = Buffer.alloc(24); const fd = fs.openSync(img.png, "r"); fs.readSync(fd, hdr, 0, 24, 0); fs.closeSync(fd);
  const size = `${hdr.readUInt32BE(16)}x${hdr.readUInt32BE(20)}`;
  const group = pairs.some((p) => p.category === "backpack") ? "backpack" : "pre-ipo";
  const pairInfo = pairs.map((p) => {
    const m = mintRow[p.mint];
    return {
      mint: p.mint, symbol: p.symbol, name: p.name, category: p.category, categoryLabel: p.categoryLabel,
      formTab: TAB[p.category], issuer: ISSUER[p.category],
      launchable: p.launchable, launchLabReady: p.launchLabReady, symbolAmbiguous: p.symbolAmbiguous,
      tokenProgram: p.tokenProgram, tokenProgramName: p.tokenProgram.startsWith("Tokenz") ? "Token-2022" : "SPL Token", decimals: p.decimals,
      onChain: m ? {
        readAt: `epoch ${MINTS.epoch.epoch}, slot ${MINTS.epoch.slotIndex} of ${MINTS.epoch.slotsInEpoch} (editor re-read, 2026-09-25)`,
        transferFee: m.fee ? { bps: m.fee.older[1], sinceEpoch: m.fee.older[0], nextBps: m.fee.newer[1], nextFromEpoch: m.fee.newer[0] } : null,
        permanentDelegate: m.exts.includes("permanentDelegate"), pausable: m.exts.includes("pausableConfig"), paused: m.paused ?? null,
        freezeAuthority: m.freeze, extensions: m.exts,
      } : null,
    };
  });
  // Re-run the content rules on the final text.
  const rc = {
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, story: story.length },
    limitsOk: c.name.length <= 32 && c.description.length <= 280 && TICKER.test(c.ticker),
    disclosureOk: /^A cat coin priced in \S+\. Not affiliated with .+ or StonkFun\. No intrinsic value; not financial advice\.$/.test(disclosure),
    noOfficial: !/\bofficial/i.test(c.description + " " + c.name),
    tickerNotPairSymbol: !pairs.some((p) => alnum(c.ticker).includes(alnum(p.symbol)) || alnum(p.symbol).includes(alnum(c.ticker))),
    checkProposal: checkProposal({ name: c.name, symbol: c.ticker, tagline: story }),
    displaySafe: displaySafe({ name: c.name, symbol: c.ticker }),
    checkFields_name_ticker_story_look: checkFields({ name: c.name, symbol: c.ticker, blurb: story, look: c.look }),
    checkFields_description: checkFields({ description: c.description }),
  };
  rc.descriptionFlagsOnlyDisclosure = JSON.stringify(rc.checkFields_description.violations) === JSON.stringify(checkFields({ description: disclosure }).violations);
  const jt = await jup(c.ticker); await sleep(300);
  const sm = jt.arr.filter((x) => alnum(x.symbol) === alnum(c.ticker));
  rc.jupiter = { query: c.ticker, status: jt.status, results: jt.arr.length, exactSymbolMatches: sm.map((x) => ({ symbol: x.symbol, name: x.name, verified: verifiedTok(x), holders: x.holderCount })), verifiedSymbolMatch: sm.some(verifiedTok) };
  const ok = rc.limitsOk && rc.disclosureOk && rc.noOfficial && rc.tickerNotPairSymbol && rc.checkProposal.ok && rc.displaySafe.ok !== false && rc.checkFields_name_ticker_story_look.ok && rc.descriptionFlagsOnlyDisclosure && jt.status === 200 && !rc.jupiter.verifiedSymbolMatch;
  rc.ok = ok;
  if (!ok) problems.push(`${c.ticker}: recheck not ok`);
  if (!why[c.ticker]) problems.push(`${c.ticker}: no whyLook`);
  const single = pairs.length === 1 ? pairs[0] : null;
  out.push({
    order: i + 1,
    group,
    groupLabel: group === "backpack" ? "Backpack stocks and funds (StonkFun 'Sunrise' tab)" : "Pre-IPO (StonkFun 'PreStocks' / 'Tessera' tabs)",
    stock: c.stock,
    stonkfunSymbol: pairSym,
    stonkfunPairName: [...new Set(pairs.map((p) => p.name))].join(" / "),
    pairMint: single ? single.mint : null,
    pairChoices: pairInfo,
    category: [...new Set(pairs.map((p) => p.category))].join(" or "),
    categoryLabel: [...new Set(pairs.map((p) => p.categoryLabel))].join(" or "),
    launchable: pairs.every((p) => p.launchable),
    launchLabReady: pairs.every((p) => p.launchLabReady),
    symbolAmbiguous: pairs.some((p) => p.symbolAmbiguous),
    tokenProgram: [...new Set(pairs.map((p) => p.tokenProgram))].join(" / "),
    name: c.name,
    ticker: c.ticker,
    description: c.description,
    story,
    disclosure,
    look: c.look,
    basis: c.basis,
    whyLook: why[c.ticker],
    coat: c.coat,
    note: c.note,
    image: img.png,
    imageJpg512: img.jpg512,
    imageJobId: img.job_id,
    imageUrl: img.url,
    imageBytes: pngBytes,
    imageSize: size,
    form: {
      tokenName: c.name,
      symbol: c.ticker,
      tokenImage: img.png,
      website: "the cat's Cat Sanctuary page if it is live; otherwise leave blank (StonkFun then links to itself)",
      x: "optional",
      telegram: "optional",
      quoteToken: single
        ? { tab: TAB[single.category], search: single.mint, pick: `${single.symbol} (${single.name})` }
        : { tab: pairs.map((p) => TAB[p.category]).join(" or "), choices: pairs.map((p) => ({ tab: TAB[p.category], search: p.mint, pick: `${p.symbol} (${ISSUER[p.category]})` })), decide: "the owner picks one mint; see note" },
      devBuy: "none (leave empty)",
      descriptionBox: "none on StonkFun's form: use the description on the cat's page and in posts",
    },
    checks: c.checks,
    recheck: rc,
  });
}
// Cross-sheet uniqueness (24 xStocks + 67).
const allNames = [...X.map((x) => x.name), ...out.map((x) => x.name)];
const allTickers = [...X.map((x) => x.ticker), ...out.map((x) => x.ticker)];
const dup = (a) => a.filter((v, i) => a.findIndex((w) => normalize(w) === normalize(v)) !== i);
const summary = {
  builtAt: new Date().toISOString(),
  pairsListGeneratedAt: pairsMeta.generatedAt,
  cats: out.length,
  backpack: out.filter((x) => x.group === "backpack").length,
  preIpo: out.filter((x) => x.group === "pre-ipo").length,
  dualPairCats: out.filter((x) => x.pairMint === null).map((x) => x.ticker),
  recheckOk: out.filter((x) => x.recheck.ok).length,
  duplicateNames91: dup(allNames), duplicateTickers91: dup(allTickers), total91: allNames.length,
  withTransferFeeQuote: out.filter((x) => x.pairChoices.some((p) => p.onChain?.transferFee)).map((x) => x.ticker),
  problems,
};
fs.writeFileSync(`${D}/launch-sheet.json`, JSON.stringify(out, null, 1) + "\n");
fs.writeFileSync(`${D}/SHEET/build.summary.json`, JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify(summary, null, 1));
