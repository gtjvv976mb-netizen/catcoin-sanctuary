import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/EDITOR";
const { COINS } = await import(`${DIR}/coins.mjs`);
const { META } = await import(`${DIR}/meta.mjs`);
const res = JSON.parse(fs.readFileSync(`${DIR}/check.out.json`, "utf8"));
const NOTES = {
  INGOTLOAF: "Name search 'Ingot' finds 9 unverified tokens named or ticked INGOT/Ingot (e.g. 'Iron Ingot', 'Gold Ingot'); none is verified and none uses INGOTLOAF.",
  TRINKETCAT: "Name search 'Trinket' finds 14 unverified TRINKET/TRIN tokens (e.g. 'The mini Horse', 'Trinket The Puppet'); none is verified, none is a cat, none uses TRINKETCAT.",
  TUPPENCE: "Known caveat kept from the CRCLx sheet: one unverified token already uses the symbol TUPPENCE ('Tuppence', HnU8E8dza4kx7PPd5ZC7HAxqeD5UATvdbkrD5DNHpump, tags unknown/token-2022). The rule only blocks verified matches, so it passes, but a ticker search will also show that token.",
  SKEINKIT: "Name search 'Skein' finds 1 unverified 'SKEIN' (Skein Privacy); different ticker, not verified.",
  TUMBLES: "checkTerms(name, symbol, story, look) vs the stock's own terms flags only [{\"rule\":\"stock\",\"term\":\"Kittens\",\"field\":\"story\"},{\"rule\":\"stock\",\"term\":\"Kittens\",\"field\":\"look\"}]. 'Kittens' is in the list only because it is the ad's title. It is the ordinary plural of kitten and is the real link itself (the kitten pile), so it stays, as the KOx checker also decided. The 6 'Tumble' name matches are unverified TUMBLE tokens, none a cat; that is why the ticker is TUMBLES.",
  SAVEPAWS: "Cross-sheet note: launch-sheet-2 (other stocks, candidates only) has TTWO candidate SAVEPAW / 'Savepoint the Silver Cat', a near-duplicate of this coin. If that sheet is launched too, rename the TTWO coin, not this one.",
  PATCHPAW: "The SPYx checker's alternates LONGNAP and WICKERCAT were not needed.",
  SNOWCURL: "SNOWCURL is now the only SNOW* ticker in the set.",
};
const J = (o) => JSON.stringify(o);
const final = COINS.map((c, i) => {
  const r = res.coins[i];
  if (r.ticker !== c.ticker) throw new Error("order");
  const m = META[c.ticker];
  const description = `${c.body} ${c.disc}`;
  const lines = [];
  const jt = r.jupiterTicker, jn = r.jupiterName;
  lines.push(`Editor re-check of the final text, ${res.runAt} (EDITOR/check.mjs in launch-sheet; output EDITOR/check.out.json; raw Jupiter EDITOR/jup-T-${c.ticker}.json, jup-N-*.json, jup-verified-list.json with ${res.verifiedListSize} verified tokens).`);
  lines.push(`- Lengths: name ${r.lengths.name}/32, ticker ${r.lengths.ticker}/10, description ${r.lengths.description}/280, story ${r.lengths.story}/160. Ends exactly with the disclosure: true.`);
  lines.push(`- Ticker: /^[A-Z0-9]{2,10}$/ ${r.tickerFormat}; not a cat-meme ticker; no ${c.pair} root and no other xStock root; copycatOf ${J(r.copycatOf)}; tickerFree ${J(r.tickerFree)}.`);
  lines.push(`- checkProposal({name, symbol, tagline: story}): ${J(r.checkProposal)}. displaySafe: ${J(r.displaySafe)}. checkFields(name, symbol, story, look): ${J(r.checkFields_story_look)}.`);
  if (c.ticker !== "TUMBLES") lines.push(`- checkTerms(name, symbol, story, look) vs the stock's own terms: ${J(r.checkTerms_own)}. checkTerms(look) vs the other 23 pairs' terms: ${J(r.checkTerms_look_otherPairs)}; vs launch-claim words: ${J(r.checkTerms_look_launchClaims)}.`);
  else lines.push(`- checkTerms(look) vs the other 23 pairs' terms: ${J(r.checkTerms_look_otherPairs)}; vs launch-claim words: ${J(r.checkTerms_look_launchClaims)}.`);
  lines.push(`- stockCatRefusals (src/lib/stockcats.mjs) with simulated research rows for all 24 pairs, the other 23 coins as 'earlier' and the live verified list: ${J(r.stockCatRefusals_allRows)}. With the repo's shipped empty notes: ${J(r.stockCatRefusals_shippedNotes)}. Every pair gets this until a row is written; it blocks the extension's tab, not a hand launch.`);
  lines.push(`- checkFields(full description): ${J(r.checkFields_fullDescription)}. The disclosure alone gives the same violations (${r.disclosureHitsOnlyFromDisclosure}), so all of them come from the required wording.`);
  lines.push(`- Jupiter search ${c.ticker}: HTTP ${jt.status}, ${jt.results} results, ${jt.sameSymbol} with that symbol, ${jt.sameSymbolVerified} verified${jt.sameSymbolRows.length ? " (" + jt.sameSymbolRows.join("; ") + ")" : ""}. Name search '${jn.query}': HTTP ${jn.status}, ${jn.results} results, ${jn.exactNameOrSymbol} exact name/symbol matches, ${jn.verified} verified.`);
  if (NOTES[c.ticker]) lines.push(`- ${NOTES[c.ticker]}`);
  lines.push(`- Collection: no duplicate or near-duplicate ticker or call name among the 24. ${c.changed.length ? "Editor changes (all re-checked above): " + c.changed.join("; ") + "." : "Editor changes: none."}`);
  lines.push(`- Hard rules (judgement): no brand, ticker root, logo, mascot, character or real person; no price, return, utility, listing, endorsement or 'official'; a normal four-legged cat.`);
  return { stock: m.stock, name: c.name, ticker: c.ticker, description, look: c.look, basis: m.basis, checks: lines.join("\n") };
});
fs.writeFileSync(`${DIR}/final.json`, JSON.stringify({ final }, null, 1));
console.log(final.length, JSON.stringify(final).length);
