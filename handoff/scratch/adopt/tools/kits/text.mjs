// Generates the text half of every cat's adoption kit (X post, X bio, X profile fields, metadata description)
// from fixed templates, and holds each piece to the repo's content rules (read-only import).
// Input: adopt/raw/kits/base-inventory.json. Output: adopt/raw/kits/text-checks.json
import fs from "node:fs";
import { checkFields, checkTerms, normalize, wordsOf } from "/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs";
import { LAUNCH_CLAIMS } from "/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs";

const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const base = JSON.parse(fs.readFileSync(`${SP}/adopt/raw/kits/base-inventory.json`, "utf8"));
const SITE = "https://catcoinsanctuary.com";

/* ---- X weighted length, twitter-text 3.1.0 config v3 (adopt/raw/kits/twitter-text-3.1.0-configs.js):
   URLs count 23; code points in [0,4351],[8192,8205],[8208,8223],[8242,8247] weigh 1; everything else 2. */
const RANGES = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const URL_RE = /\bhttps?:\/\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|xyz|fun|app)(?:\/\S*)?/gi;
export function xWeighted(text) {
  let n = 0; let rest = text;
  rest = rest.replace(URL_RE, () => { n += 23; return ""; });
  for (const ch of rest) { const cp = ch.codePointAt(0); n += RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2; }
  return n;
}

/* ---- words a cat's own text may not carry: its pair's names (as stockcats.mjs pairTerms does for xStocks) */
const STOP = new Set(["inc", "corp", "corporation", "company", "co", "ltd", "plc", "group", "holdings", "holding", "the", "and", "of", "formerly", "llc",
  "trust", "fund", "etf", "class", "shares", "share", "stock", "preferred", "pbc", "nv", "n.v.", "limited", "sa", "ag", "se", "incorporated"]);
function pairTerms(r) {
  const root = r.stock.replace(/x$/, "");
  const words = String(r.company).replace(/[(),]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase().replace(/\.$/, "")) && normalize(w).replace(/ /g, "").length >= 3);
  const pn = String(r.stonkfunPairName ?? "").split(/\s+/).filter((w) => normalize(w).replace(/ /g, "").length >= 3);
  const rc = r.realCat?.name ? [r.realCat.name] : [];
  return [...new Set([r.stock, root, r.stonkfunSymbol, ...pn, ...words, ...rc].filter(Boolean))];
}
const ALL_TERMS = base.rows.map((r) => ({ stock: r.stock, terms: [r.stock, r.stock.replace(/x$/, ""), r.stonkfunSymbol].filter((t) => normalize(t).replace(/ /g, "").length >= 3) }));

/* ---- no-hype list (not in the repo rules; the task's "no promises") */
const HYPE = ["moon", "mooning", "pump", "pumping", "gem", "100x", "1000x", "10x", "early", "lfg", "wagmi", "millionaire", "rich", "gains", "profit", "returns", "guaranteed", "safe", "rugproof", "rug proof", "locked", "burned", "backed", "send it", "next", "ape in", "buy now", "don't miss", "last chance"];
const hypeHits = (text) => HYPE.filter((h) => ` ${normalize(text)} `.includes(` ${normalize(h)} `));

/* ---- the templates (fixed words; only {fields} vary). One newline between lines: every character counts. */
const BRAND = "Catcoin Sanctuary";
const discCore = (disc) => String(disc).replace(/^A cat coin priced in [^.]*?\.(?= )\s*/, "");
const T = {
  // posted by the adopter from the success screen (mint known)
  postAdopted: (k) => [`I adopted ${k.name} at ${BRAND}. $${k.ticker}`, k.storyLine, `CA ${k.mint}`, k.url, k.disc],
  // "help this cat find a home" share button on a planned cat's page (no mint yet)
  postWaiting: (k) => [`${k.name} is up for adoption at ${BRAND}. $${k.ticker}`, k.storyLine, k.url, k.disc],
  bio: [
    (k) => `${k.name}, adopted at ${BRAND}. ${k.discFull}`,
    (k) => `${k.name}, adopted at ${BRAND}. ${k.discCore}`,
    (k) => `${k.name} of ${BRAND}. ${k.discCore}`,
    (k) => `Adopted at ${BRAND}. ${k.discCore}`,
    (k) => k.discCore,
  ],
};
const HOOK_ADOPTED = (k) => `I adopted ${k.name} at ${BRAND}. $${k.ticker}`;
const HOOK_WAITING = (k) => `${k.name} is up for adoption at ${BRAND}. $${k.ticker}`;
/* "Catcoin Sanctuary" is the site's fixed name, not the cat's words: "catcoin" reads as cat+coin and so hits COINx's
   pair term COIN under checkTerms (VERIFIED by this script's first run). It is masked before the checks. */
const mask = (t) => String(t ?? "").split(BRAND).join("Sanctuary");

function firstSentence(s) { const m = String(s).match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : s; }

/* Assemble a post: full disclosure with the whole story, first sentence, none; then the core disclosure the same way.
   Keep the first that fits 280 with a 4-char margin. */
function assemble(fn, k) {
  for (const disc of [k.discFull, k.discCore]) for (const line of [k.story, firstSentence(k.story), null]) {
    const parts = fn({ ...k, disc, storyLine: line }).filter((p) => p !== null && p !== undefined && p !== "");
    const text = parts.join("\n");
    const w = xWeighted(text);
    if (w <= 276) return { text, weighted: w, storyUsed: line === k.story ? "full" : line ? "first-sentence" : "none", disclosure: disc === k.discFull ? "full" : "core" };
  }
  const text = fn({ ...k, disc: k.discCore, storyLine: null }).filter(Boolean).join("\n");
  return { text, weighted: xWeighted(text), storyUsed: "none", disclosure: "core", over: true };
}

const DISC_OK_RULES = new Set(["brand", "endorsement", "financial_promise"]);
const out = [];
for (const r of base.rows) {
  const d = r.draft;
  const row = { n: r.n, stock: r.stock, status: d.status };
  if (!d.name) { row.skipped = "no picked name/ticker yet"; out.push(row); continue; }
  const k = { name: d.name, ticker: d.ticker, story: d.story, disc: d.disclosure, discFull: d.disclosure, discCore: discCore(d.disclosure), mint: "<mint, known after launch: 43-44 base58 chars>".padEnd(44, "."),
    url: `${SITE}/cat/${d.ticker.toLowerCase()}` };
  // measure with a real-length mint: base58 mints are 32-44 chars; use 44 (worst case)
  const kMeasure = { ...k, mint: "M".repeat(44) };
  const pa = assemble(T.postAdopted, kMeasure);
  const pw = assemble(T.postWaiting, k);
  const bio = T.bio.map((f) => f(k)).find((b) => b.length <= 160) ?? null;
  const bioVariant = bio ? T.bio.findIndex((f) => f(k) === bio) + 1 : null;
  const bioDisc = bio ? (bio.endsWith(k.discFull) ? k.discFull : k.discCore) : "";
  const terms = pairTerms(r);
  // what the cat's own words say (hooks + story), held to every rule
  const hookA = HOOK_ADOPTED(k), hookW = HOOK_WAITING(k);
  const bioHook = bio && bio !== bioDisc ? bio.slice(0, bio.length - bioDisc.length).trim() : "";
  const own = { hookAdopted: mask(hookA), hookWaiting: mask(hookW), story: k.story, bioHook: mask(bioHook) };
  const cf = checkFields(own);
  const ct = checkTerms(own, { pair_term: terms, launch_claim: LAUNCH_CLAIMS });
  const others = ALL_TERMS.filter((t) => t.stock !== r.stock).flatMap((t) => t.terms);
  const co = checkTerms(own, { other_pair: others });
  // the disclosure: its hits must be only the disclosure's own words
  const cd = checkFields({ disclosure: k.disc });
  const discUnexpected = cd.violations.filter((v) => !DISC_OK_RULES.has(v.rule));
  // the whole post, for the record (expected: link, the disclosure words)
  const full = checkFields({ post: mask(pa.text.replace("M".repeat(44), "CAmint")) });
  const coreCheck = checkFields({ disclosureCore: k.discCore });
  if (coreCheck.violations.some((v) => !DISC_OK_RULES.has(v.rule))) discUnexpected.push(...coreCheck.violations.filter((v) => !DISC_OK_RULES.has(v.rule)));
  const hype = [...hypeHits(pa.text), ...hypeHits(pw.text), ...hypeHits(bio ?? "")];
  Object.assign(row, {
    name: d.name, ticker: d.ticker, website: k.url, websiteLen: k.url.length, websiteToday: `${SITE}/#cat=${d.ticker}`,
    xPostAdopted: { text: pa.text.replace("M".repeat(44), "{MINT}"), weightedWith44CharMint: pa.weighted, storyUsed: pa.storyUsed, disclosure: pa.disclosure, over280: !!pa.over },
    xPostWaiting: { text: pw.text, weighted: pw.weighted, storyUsed: pw.storyUsed, disclosure: pw.disclosure, over280: !!pw.over },
    disclosureCore: k.discCore,
    xBio: bio, xBioLen: bio?.length ?? null, xBioVariant: bioVariant,
    xDisplayName: d.name, xDisplayNameLen: d.name.length,
    xHandleSuggestion: (/CAT$/i.test(d.ticker) ? d.ticker : `${d.ticker}cat`).slice(0, 15),
    metadataDescription: `${k.story} ${k.disc}`, metadataDescriptionLen: `${k.story} ${k.disc}`.length,
    checks: {
      ownWords_checkFields: cf, ownWords_pairTerms_launchClaims: ct, ownWords_otherPairs: co,
      disclosure_checkFields: cd, disclosure_unexpected: discUnexpected,
      fullPost_rules_hit: [...new Set(full.violations.map((v) => `${v.rule}:${v.term}`))],
      hype, pairTermsUsed: terms,
    },
    pass: cf.ok && ct.ok && discUnexpected.length === 0 && !pa.over && !pw.over && !!bio && hype.length === 0,
  });
  out.push(row);
}
fs.writeFileSync(`${SP}/adopt/raw/kits/text-checks.json`, JSON.stringify({ generatedAt: new Date().toISOString(), rows: out }, null, 1));
const done = out.filter((r) => !r.skipped);
console.log("drafted", done.length, "pass", done.filter((r) => r.pass).length);
for (const r of done.filter((r) => !r.pass)) console.log("FAIL", r.stock, r.ticker, JSON.stringify({ cf: r.checks.ownWords_checkFields.violations, ct: r.checks.ownWords_pairTerms_launchClaims.violations, du: r.checks.disclosure_unexpected, hype: r.checks.hype, pa: r.xPostAdopted.weightedWith44CharMint, pw: r.xPostWaiting.weighted, bio: r.xBioLen }));
for (const r of done.filter((r) => r.checks.ownWords_otherPairs.violations.length)) console.log("OTHERPAIR", r.stock, JSON.stringify(r.checks.ownWords_otherPairs.violations));
const cnt = (f) => done.reduce((m, r) => (m[f(r)] = (m[f(r)] || 0) + 1, m), {});
console.log("adopted-post story/disc", cnt((r) => r.xPostAdopted.storyUsed + "/" + r.xPostAdopted.disclosure), "waiting-post story/disc", cnt((r) => r.xPostWaiting.storyUsed + "/" + r.xPostWaiting.disclosure), "bio variant", cnt((r) => r.xBioVariant));
console.log("max weighted adopted", Math.max(...done.map((r) => r.xPostAdopted.weightedWith44CharMint)), "waiting", Math.max(...done.map((r) => r.xPostWaiting.weighted)), "bio max", Math.max(...done.map((r) => r.xBioLen)));
console.log("fullPost hits", cnt((r) => r.checks.fullPost_rules_hit.map((x) => x.split(":")[0]).sort().join(",")));
