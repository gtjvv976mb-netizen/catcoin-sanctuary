import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/EDITOR";
const R = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER, normalize } = await import(`${R}/bots/lib/content-rules.mjs`);
const S = await import(`${R}/src/lib/stockcats.mjs`);
const { verifiedIndex, tickerFree } = await import(`${R}/bots/cashcat/tickers.mjs`);
const { copycatOf } = await import(`${R}/bots/popcat/established.mjs`);
const { COINS } = await import(`${DIR}/coins.mjs`);
const { ROWS, notesFor } = await import(`${DIR}/rows.mjs`);
const NOJUP = process.argv.includes("--nojup");

const notes = notesFor(S.STOCK_PAIRS);
let vidx = null;
if (!NOJUP) {
  const r = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
  const list = await r.json();
  fs.writeFileSync(`${DIR}/jup-verified-list.json`, JSON.stringify(list));
  vidx = verifiedIndex(list);
}
const MEME = new Set(["POPCAT", "MEW", "MICHI", "GRUMPY", "KITTY", "CAT", "CATS", "NYAN", "KITTEN", "TABBY", "MOCHI", "MOG", "PUSS", "MEOW", "PURR", "GINGER", "NEKO", "WIF", "CATWIF", "MANEKI", "LION", "LEO", "ROAR", "MANE", "FATCAT", "ARCAT", "BEANCAT", "USDCAT", "CASHCAT", "PIXELCAT", "ROBINCAT"]);
const alnum = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function jup(q, tag) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const raw = await r.text();
    if (r.status === 429) { await sleep(2500); continue; }
    fs.writeFileSync(`${DIR}/jup-${tag}.json`, raw);
    let arr = []; try { arr = JSON.parse(raw); } catch {}
    return { status: r.status, arr: Array.isArray(arr) ? arr : [] };
  }
  return { status: 429, arr: [] };
}
const verifiedTok = (x) => x.isVerified === true || (Array.isArray(x.tags) && x.tags.includes("verified"));

const out = [];
for (const c of COINS) {
  const pair = S.STOCK_PAIRS.find((p) => p.symbol === c.pair);
  const description = `${c.body} ${c.disc}`;
  const own = [...new Set([...S.pairTerms(pair, notes), ...ROWS[c.pair].extra, "xStock", "xStocks", "Backed", "Kraken"])];
  const others = S.STOCK_PAIRS.filter((p) => p.mint !== pair.mint).flatMap((p) => [...S.pairTerms(p, notes)]);
  const earlier = COINS.filter((o) => o !== c).map((o) => ({ name: o.name, symbol: o.ticker }));
  const draft = S.stockDraft({ name: c.name, symbol: c.ticker, tagline: c.body }, pair);
  const r = {
    pair: c.pair, name: c.name, ticker: c.ticker, changed: c.changed,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: description.length, story: c.body.length },
    limitsOk: c.name.length <= 32 && c.ticker.length <= 10 && description.length <= 280 && c.body.length <= 160,
    tickerFormat: TICKER.test(c.ticker), memeTicker: MEME.has(c.ticker),
    disclosureShape: c.disc === `A cat coin priced in ${c.pair}. ` + c.disc.slice(`A cat coin priced in ${c.pair}. `.length) && c.disc.endsWith("No intrinsic value; not financial advice.") && /Not affiliated with .+ or StonkFun\./.test(c.disc),
    checkProposal: checkProposal({ name: c.name, symbol: c.ticker, tagline: c.body }),
    displaySafe: displaySafe({ name: c.name, symbol: c.ticker }),
    checkFields_story_look: checkFields({ name: c.name, symbol: c.ticker, story: c.body, look: c.look }),
    checkFields_fullDescription: checkFields({ description }),
    checkFields_disclosureOnly: checkFields({ description: c.disc }),
    checkTerms_own: checkTerms({ name: c.name, symbol: c.ticker, story: c.body, look: c.look }, { stock: own }),
    checkTerms_look_otherPairs: checkTerms({ look: c.look }, { other_pair: others }),
    checkTerms_look_launchClaims: checkTerms({ look: c.look }, { launch_claim: S.LAUNCH_CLAIMS }),
    stockCatRefusals_allRows: S.stockCatRefusals(draft, pair, { notes, earlier, verifiedIndex: vidx }).map((x) => x.message),
    stockCatRefusals_shippedNotes: S.stockCatRefusals(draft, pair, { earlier, verifiedIndex: vidx }).map((x) => x.message),
    copycatOf: copycatOf({ name: c.name, symbol: c.ticker }) ?? null,
    tickerFree: vidx ? tickerFree(vidx, { name: c.name, symbol: c.ticker }) : null,
  };
  r.disclosureHitsOnlyFromDisclosure = JSON.stringify(r.checkFields_fullDescription.violations) === JSON.stringify(r.checkFields_disclosureOnly.violations);
  if (!NOJUP) {
    const t = await jup(c.ticker, `T-${c.ticker}`);
    const same = t.arr.filter((x) => String(x.symbol).toLowerCase() === c.ticker.toLowerCase());
    r.jupiterTicker = { url: `https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`, status: t.status, results: t.arr.length, sameSymbol: same.length, sameSymbolVerified: same.filter(verifiedTok).length,
      sameSymbolRows: same.slice(0, 5).map((x) => `${x.symbol} | ${x.name} | ${x.id} | verified=${verifiedTok(x)}`) };
    await sleep(900);
    const firstWord = c.name.split(" the ")[0];
    const n = await jup(firstWord, `N-${firstWord.replace(/\W+/g, "_")}`);
    const nameHits = n.arr.filter((x) => normalize(x.name) === normalize(firstWord) || normalize(x.name) === normalize(c.name) || normalize(x.symbol) === normalize(firstWord).replace(/ /g, ""));
    r.jupiterName = { query: firstWord, status: n.status, results: n.arr.length, exactNameOrSymbol: nameHits.length, verified: nameHits.filter(verifiedTok).length,
      rows: nameHits.slice(0, 6).map((x) => `${x.symbol} | ${x.name} | verified=${verifiedTok(x)}`) };
    await sleep(900);
  }
  out.push(r);
}

/* ── collection checks ── */
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const coll = { dupTickers: [], dupNames: [], nearTickers: [], nearCallNames: [], sharedEpithets: {}, storyPhrases: {} };
for (let i = 0; i < COINS.length; i++) for (let j = i + 1; j < COINS.length; j++) {
  const a = COINS[i], b = COINS[j];
  if (alnum(a.ticker) === alnum(b.ticker)) coll.dupTickers.push([a.ticker, b.ticker]);
  if (normalize(a.name) === normalize(b.name)) coll.dupNames.push([a.name, b.name]);
  const dt = lev(a.ticker, b.ticker);
  if (dt <= 3 || a.ticker.slice(0, 5) === b.ticker.slice(0, 5)) coll.nearTickers.push([a.ticker, b.ticker, dt]);
  const ca = normalize(a.name.split(" the ")[0]).replace(/ /g, ""), cb = normalize(b.name.split(" the ")[0]).replace(/ /g, "");
  const dn = lev(ca, cb);
  if (dn <= Math.max(2, Math.floor(Math.min(ca.length, cb.length) / 3)) || ca.slice(0, 4) === cb.slice(0, 4)) coll.nearCallNames.push([a.name, b.name, dn]);
}
for (const c of COINS) { const m = c.name.match(/ the (.+)$/i); const e = m ? m[1] : "(no 'the')"; (coll.sharedEpithets[e] ??= []).push(c.name); }
coll.sharedEpithets = Object.fromEntries(Object.entries(coll.sharedEpithets).filter(([, v]) => v.length > 1));
const PHRASES = ["warm", "warmest", "nap", "naps", "sun", "stone", "stones", "step", "steps", "wall", "path", "bench", "bees", "pond", "flower bed", "flowers", "shed", "lap", "blink", "dusk", "morning", "evening", "flops", "curl", "pads", "just in case", "four white", "socks"];
for (const p of PHRASES) { const hits = COINS.filter((c) => new RegExp(`\\b${p}\\b`, "i").test(c.body)).map((c) => c.ticker); if (hits.length) coll.storyPhrases[p] = hits; }
// other launch sheet (different stocks, candidates only)
const LS2 = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet-2";
const ls2 = [];
for (const f of fs.readdirSync(LS2).filter((f) => f.endsWith("-coins.json"))) {
  try { const j = JSON.parse(fs.readFileSync(`${LS2}/${f}`, "utf8")); const a = Array.isArray(j) ? j : (j.coins ?? j.candidates ?? []); for (const x of a) if (x?.name) ls2.push({ file: f, name: x.name, ticker: x.ticker ?? x.symbol }); } catch {}
}
coll.crossSheet2 = [];
for (const c of COINS) for (const x of ls2) {
  const ca = normalize(c.name.split(" the ")[0]).replace(/ /g, ""), xa = normalize(String(x.name).split(" the ")[0]).replace(/ /g, "");
  if (alnum(c.ticker) === alnum(x.ticker) || lev(c.ticker, alnum(x.ticker)) <= 2 || lev(ca, xa) <= 2 || ca.slice(0, 5) === xa.slice(0, 5)) coll.crossSheet2.push(`${c.ticker} "${c.name}" ~ ${x.file}: ${x.ticker} "${x.name}"`);
}
fs.writeFileSync(`${DIR}/check.out.json`, JSON.stringify({ runAt: new Date().toISOString(), verifiedListSize: vidx?.size ?? null, coins: out, collection: coll }, null, 1));
// compact summary
for (const r of out) {
  const bad = [];
  if (!r.limitsOk) bad.push("LIMITS " + JSON.stringify(r.lengths));
  if (!r.tickerFormat) bad.push("TICKERFMT"); if (r.memeTicker) bad.push("MEME");
  if (!r.disclosureShape) bad.push("DISC");
  if (!r.checkProposal.ok) bad.push("checkProposal " + JSON.stringify(r.checkProposal.violations));
  if (!r.displaySafe.ok) bad.push("displaySafe " + JSON.stringify(r.displaySafe.violations));
  if (!r.checkFields_story_look.ok) bad.push("checkFields " + JSON.stringify(r.checkFields_story_look.violations));
  if (!r.disclosureHitsOnlyFromDisclosure) bad.push("fullDesc!=disc " + JSON.stringify(r.checkFields_fullDescription.violations));
  if (!r.checkTerms_own.ok) bad.push("own " + JSON.stringify(r.checkTerms_own.violations));
  if (!r.checkTerms_look_otherPairs.ok) bad.push("lookOther " + JSON.stringify(r.checkTerms_look_otherPairs.violations));
  if (!r.checkTerms_look_launchClaims.ok) bad.push("lookClaims " + JSON.stringify(r.checkTerms_look_launchClaims.violations));
  if (r.stockCatRefusals_allRows.length) bad.push("refusals " + JSON.stringify(r.stockCatRefusals_allRows));
  if (r.copycatOf) bad.push("copycat");
  if (r.jupiterTicker && r.jupiterTicker.sameSymbolVerified) bad.push("JUP VERIFIED");
  console.log(`${r.ticker.padEnd(11)} ${String(r.lengths.name).padStart(2)}/${String(r.lengths.description).padStart(3)}/${String(r.lengths.story).padStart(3)} ${bad.length ? "!! " + bad.join(" | ") : "ok"}` +
    (r.jupiterTicker ? `  jupT ${r.jupiterTicker.status} n=${r.jupiterTicker.results} same=${r.jupiterTicker.sameSymbol}` : "") +
    (r.jupiterName ? `  jupN '${r.jupiterName.query}' n=${r.jupiterName.results} exact=${r.jupiterName.exactNameOrSymbol} ver=${r.jupiterName.verified}` : ""));
}
console.log(JSON.stringify(coll, null, 1));
