// Read-only feasibility check of the REVISED kit text templates (SPEC rev, findings 21-26) against the same rules
// text.mjs applies: checkFields + pair terms + LAUNCH_CLAIMS + other pairs on the cat's own words, checkFields on the
// disclosure (brand/endorsement/financial_promise excused), hype list, X weighting (<= 276), bio <= 160.
// Input: adopt/raw/kits/base-inventory.json (50 drafted cats). Output: adopt/raw/revise/text-v2-check.out.json
import fs from "node:fs";
import { checkFields, checkTerms, normalize } from "/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs";
import { LAUNCH_CLAIMS } from "/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs";
const ADOPT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt";
const base = JSON.parse(fs.readFileSync(`${ADOPT}/raw/kits/base-inventory.json`, "utf8"));
const held = new Set(JSON.parse(fs.readFileSync("/home/user/cat-sanctuary/data/held.json", "utf8")).held.map((h) => h.ticker));
const RANGES = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const URL_RE = /\bhttps?:\/\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|xyz|fun|app)(?:\/\S*)?/gi;
const xw = (t) => { let n = 0; const rest = t.replace(URL_RE, () => { n += 23; return ""; }); for (const ch of rest) { const cp = ch.codePointAt(0); n += RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2; } return n; };
const STOP = new Set(["inc","corp","corporation","company","co","ltd","plc","group","holdings","holding","the","and","of","formerly","llc","trust","fund","etf","class","shares","share","stock","preferred","pbc","nv","n.v.","limited","sa","ag","se","incorporated"]);
function pairTerms(r) {
  const root = r.stock.replace(/x$/, "");
  const words = String(r.company).replace(/[(),]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase().replace(/\.$/, "")) && normalize(w).replace(/ /g, "").length >= 3);
  const pn = String(r.stonkfunPairName ?? "").split(/\s+/).filter((w) => normalize(w).replace(/ /g, "").length >= 3);
  const rc = r.realCat?.name ? [r.realCat.name] : [];
  return [...new Set([r.stock, root, r.stonkfunSymbol, ...pn, ...words, ...rc].filter(Boolean))];
}
const ALL_TERMS = base.rows.map((r) => ({ stock: r.stock, terms: [r.stock, r.stock.replace(/x$/, ""), r.stonkfunSymbol].filter((t) => normalize(t).replace(/ /g, "").length >= 3) }));
const HYPE = ["moon","mooning","pump","pumping","gem","100x","1000x","10x","early","lfg","wagmi","millionaire","rich","gains","profit","returns","guaranteed","safe","rugproof","rug proof","locked","burned","backed","send it","next","ape in","buy now","don't miss","last chance"];
const hype = (t) => HYPE.filter((h) => ` ${normalize(t)} `.includes(` ${normalize(h)} `));
const BRAND = "Catcoin Sanctuary"; const mask = (t) => String(t).split(BRAND).join("Sanctuary");
const DISC_OK = new Set(["brand", "endorsement", "financial_promise"]);
const firstSentence = (s) => (String(s).match(/^.*?[.!?](?=\s|$)/) ?? [s])[0];
// ---- revised templates (the SPEC's section 3.3, rev) ----
const HOOK_WAIT = (k) => `${k.name}: a memecoin up for adoption at ${BRAND}. Not launched yet; anything called ${k.ticker} before then is not it.`;
const HOOK_ADOPT = (k) => `I launched ${k.name}, a memecoin. I'm its creator, so fees may come to me.`;
const WAIT = (k) => [HOOK_WAIT(k), k.line, k.url, k.disc];
const ADOPT_ = (k) => [HOOK_ADOPT(k), k.line, `CA ${k.mint}`, k.url, k.disc];
const BIO = [
  (k) => `${k.name}, a memecoin (no real cat) adopted at ${BRAND}. Run by its adopter. ${k.short}`,
  (k) => `${k.name}, a memecoin adopted at ${BRAND}. Run by its adopter. ${k.short}`,
  (k) => `A memecoin adopted at ${BRAND}. Run by its adopter. ${k.short}`,
  (k) => `A memecoin. Run by its adopter. ${k.short}`,
];
function assemble(fn, k) {
  for (const disc of [k.full, k.core, k.short]) for (const line of [k.story, firstSentence(k.story), null]) {
    const text = fn({ ...k, disc, line }).filter(Boolean).join("\n"); const w = xw(text);
    if (w <= 276) return { text, w, story: line === k.story ? "full" : line ? "first" : "none", disc: disc === k.full ? "full" : disc === k.core ? "core" : "short" };
  }
  const text = fn({ ...k, disc: k.short, line: null }).filter(Boolean).join("\n"); return { text, w: xw(text), over: true };
}
const rows = [];
for (const r of base.rows) {
  const d = r.draft; if (!d?.name) continue;
  const XSTOCK_ISSUER = process.env.XSTOCK_ISSUER ?? "";
  let full = r.category === "xstock" && XSTOCK_ISSUER ? String(d.disclosure).replace(/ or StonkFun\./, `, ${XSTOCK_ISSUER} or StonkFun.`) : d.disclosure;
  if (r.category === "prestock" && process.env.PRESTOCK_PHRASE) full = String(full).replace(/^A cat coin priced in ([^.]*?)\./, (m, sym) => `A cat coin priced in the ${sym} ${process.env.PRESTOCK_PHRASE}.`); const core = String(full).replace(/^A cat coin priced in [^.]*?\.(?= )\s*/, "");
  const short = core.replace("not financial advice", "NFA");
  const k = { short, name: d.name, ticker: d.ticker, story: d.story, full, core, url: `https://catcoinsanctuary.com/cat/${d.ticker.toLowerCase()}`, mint: "M".repeat(44) };
  const pw = assemble(WAIT, k), pa = assemble(ADOPT_, k);
  const bio = BIO.map((f) => f(k)).find((b) => b.length <= 160) ?? null;
  const own = { hookW: mask(HOOK_WAIT(k)), hookA: mask(HOOK_ADOPT(k)), bioHook: bio ? mask(bio.slice(0, bio.length - short.length)) : "" };
  const cf = checkFields(own).violations; const ct = checkTerms(own, { pair_term: pairTerms(r), launch_claim: LAUNCH_CLAIMS }).violations;
  const co = checkTerms(own, { other_pair: ALL_TERMS.filter((t) => t.stock !== r.stock).flatMap((t) => t.terms) }).violations;
  const du = [...checkFields({ d: full }).violations, ...checkFields({ d: short }).violations].filter((v) => !DISC_OK.has(v.rule));
  const hy = [...hype(pw.text), ...hype(pa.text), ...hype(bio ?? "")];
  const cashtagWaiting = /\$[A-Za-z]/.test(pw.text);
  const coinWord = { waiting: /coin/i.test(mask(pw.text)), adopted: /coin/i.test(mask(pa.text)), bio: bio ? /coin/i.test(mask(bio)) : false };
  rows.push({ ticker: d.ticker, stock: r.stock, category: r.category, held: held.has(d.ticker), waitingW: pw.w, waitingStory: pw.story, waitingDisc: pw.disc, adoptedW: pa.w, adoptedStory: pa.story, adoptedDisc: pa.disc, waitingText: pw.text, adoptedText: pa.text, bioLen: bio?.length ?? null, bio,
    ownWordHits: [...cf, ...ct], otherPairHits: co, disclosureUnexpected: du, hype: hy, cashtagWaiting, coinWord,
    pass: !pw.over && !pa.over && !!bio && cf.length === 0 && ct.length === 0 && du.length === 0 && hy.length === 0 && !cashtagWaiting && coinWord.waiting && coinWord.adopted && coinWord.bio });
}
const summary = { drafted: rows.length, pass: rows.filter((x) => x.pass).length, fails: rows.filter((x) => !x.pass).map((x) => ({ t: x.ticker, w: x.waitingW, a: x.adoptedW, bio: x.bioLen, hits: x.ownWordHits, hype: x.hype, du: x.disclosureUnexpected })),
  maxWaiting: Math.max(...rows.map((x) => x.waitingW)), maxAdopted: Math.max(...rows.map((x) => x.adoptedW)), maxBio: Math.max(...rows.map((x) => x.bioLen ?? 0)),
  storyUse: rows.reduce((m, x) => (m[`w:${x.waitingStory}+${x.waitingDisc}/a:${x.adoptedStory}+${x.adoptedDisc}`] = (m[`w:${x.waitingStory}+${x.waitingDisc}/a:${x.adoptedStory}+${x.adoptedDisc}`] || 0) + 1, m), {}),
  bioVariants: rows.reduce((m, x) => { const v = x.bio?.includes("no real cat") ? "withCharity" : x.bio ? "noCharity" : "none"; m[v] = (m[v] || 0) + 1; return m; }, {}),
  otherPairHits: rows.filter((x) => x.otherPairHits.length).map((x) => [x.ticker, x.otherPairHits]) };
fs.writeFileSync(`${ADOPT}/raw/revise/text-v2-check${process.env.XSTOCK_ISSUER ? "-issuer-" + process.env.XSTOCK_ISSUER.replace(/\W+/g, "_") : ""}${process.env.PRESTOCK_PHRASE ? "-prestock" : ""}.out.json`, JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
