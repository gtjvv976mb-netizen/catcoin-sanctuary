// Read-only: runs the CIA repo's own content rules (HEAD 5f573e5) over the 24 drafted cats in
// launch-sheet.json. Nothing is written except this script's stdout (redirected by the caller).
import fs from "node:fs";
const REPO = "/home/user/Cat-Intelligence-Agency";
const R = await import(`${REPO}/bots/lib/content-rules.mjs`);
const S = await import(`${REPO}/src/lib/stockcats.mjs`);
const { verifiedIndex, tickerFree } = await import(`${REPO}/bots/cashcat/tickers.mjs`);
const { siteRefusals } = await import(`${REPO}/bots/cashcat/invent.mjs`);
const { buildUserDocument } = await import(`${REPO}/bots/cashcat/metadata.mjs`);
const { detectCat } = await import(`${REPO}/bots/lib/catdetect.mjs`);

const sheet = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/launch-sheet.json", "utf8"));
const vIndex = verifiedIndex(JSON.parse(fs.readFileSync(new URL("./jupiter-verified-2026-09-25.json", import.meta.url), "utf8")));

const bytes = (s) => Buffer.byteLength(String(s ?? ""), "utf8");
const out = [];
for (const row of sheet) {
  const pair = S.pairByMint(row.quoteMint);
  const draftBase = { name: row.name, symbol: row.ticker, tagline: row.story, kitten: "calico", background: Object.keys((await import(`${REPO}/bots/cashcat/logo-layout.mjs`)).BACKGROUNDS)[0], pairMint: row.quoteMint, source: "typed" };
  const r = {
    order: row.order, xstock: row.xstock, name: row.name, ticker: row.ticker,
    pairKnown: Boolean(pair),
    bytes: { name: bytes(row.name), ticker: bytes(row.ticker), story: row.story.length, description: row.description.length },
    launchlabLimitsOk: bytes(row.name) <= 32 && bytes(row.ticker) <= 10,
    detectCat: detectCat({ name: row.name, symbol: row.ticker, description: row.description }).isCat,
    checkProposal: R.checkProposal({ name: row.name, symbol: row.ticker, tagline: row.story, trend: "cat" }).violations.map((v) => `${v.rule}:${v.term}@${v.field}`),
    checkFieldsDescription: R.checkFields({ description: row.description }).violations.map((v) => `${v.rule}:${v.term}`),
    launchClaimsInDescription: R.checkTerms({ description: row.description }, { launch_claim: S.LAUNCH_CLAIMS }).violations.map((v) => v.term),
    tickerFree: tickerFree(vIndex, { name: row.name, symbol: row.ticker }).reasons,
    site: siteRefusals({ name: row.name, symbol: row.ticker, tagline: row.story, trend: { title: "cat", source: "google-trends" } }),
  };
  if (pair) {
    // 1) as the repo ships (STOCK_CAT_NOTES is empty)
    r.stockCatRefusals_asShipped = S.stockCatRefusals(draftBase, pair, { verifiedIndex: vIndex }).map((x) => x.clause);
    // 2) with a placeholder "none found" research row for EVERY pair, so only the non-research clauses remain
    const placeholderNotes = S.STOCK_PAIRS.map((p) => ({ mint: p.mint, people: [], mascots: [], brands: [], catFacts: [], searchedAt: "2026-09-25", method: "placeholder for this check only" }));
    r.stockCatRefusals_placeholderRows = S.stockCatRefusals(draftBase, pair, { notes: placeholderNotes, verifiedIndex: vIndex }).map((x) => x.message);
    r.repoPairDisclosure = S.pairDisclosure(pair);
    r.repoDocument = buildUserDocument({ name: row.name, symbol: row.ticker, tagline: row.story, imageUri: "https://example.invalid/img.png", venue: "stonkfun", disclosure: S.pairDisclosure(pair) });
    r.repoDescriptionLength = r.repoDocument.description.length;
  }
  r.sheetDisclosure = row.disclosure;
  out.push(r);
}
const summary = {
  rows: out.length,
  launchlabLimitsFail: out.filter((r) => !r.launchlabLimitsOk).map((r) => r.ticker),
  checkProposalFail: out.filter((r) => r.checkProposal.length).map((r) => `${r.ticker}: ${r.checkProposal.join(", ")}`),
  descriptionFieldFail: out.filter((r) => r.checkFieldsDescription.length).map((r) => `${r.ticker}: ${r.checkFieldsDescription.join(", ")}`),
  launchClaimInDescription: out.filter((r) => r.launchClaimsInDescription.length).map((r) => `${r.ticker}: ${r.launchClaimsInDescription.join(", ")}`),
  tickerTaken: out.filter((r) => r.tickerFree.length).map((r) => `${r.ticker}: ${r.tickerFree.join(" | ")}`),
  siteFail: out.filter((r) => r.site.length).map((r) => `${r.ticker}: ${r.site.join(" | ")}`),
  refusedAsShipped: out.filter((r) => (r.stockCatRefusals_asShipped ?? []).length).length,
  asShippedClauses: [...new Set(out.flatMap((r) => r.stockCatRefusals_asShipped ?? []))],
  placeholderRowRefusals: out.filter((r) => (r.stockCatRefusals_placeholderRows ?? []).length).map((r) => `${r.ticker}: ${r.stockCatRefusals_placeholderRows.join(" | ")}`),
};
console.log(JSON.stringify({ summary, rows: out }, null, 1));
