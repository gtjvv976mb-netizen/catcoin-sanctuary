// Read-only: do the words the critique proposes ("memecoin", "cat coin", "creator", "independent adopter",
// "can lose all of its value") trip CIA's content rules (checkFields) or the COINx pair term (checkTerms)?
import fs from "node:fs";
import { checkFields, checkTerms } from "/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs";
import { LAUNCH_CLAIMS } from "/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs";
const samples = {
  memecoin: "Patchpaw the Calico, a memecoin adopted at Sanctuary.",
  catcoinSpace: "Patchpaw the Calico, a cat coin adopted at Sanctuary.",
  loseAll: "This coin can lose all of its value and may never be traded.",
  independent: "Launched by an independent adopter, not by Sanctuary.",
  creatorShare: "StonkFun may pay its creator a share of trading fees.",
  notCharity: "Not an animal charity; no real cat.",
  issuerX: "Not affiliated with NVIDIA, Backed Assets (xStocks) or StonkFun.",
  prestock: "A cat coin priced in the ANTHROPIC PreStock token.",
};
const out = {};
for (const [k, text] of Object.entries(samples)) {
  out[k] = {
    text,
    fields: checkFields({ text }).violations ?? checkFields({ text }),
    coinxPairTerm: checkTerms({ text }, { pair_term: ["COINx", "COIN", "Coinbase"] }).violations,
    launchClaims: checkTerms({ text }, { launch_claim: LAUNCH_CLAIMS }).violations,
  };
}
const dest = new URL("../../raw/revise/coin-word-check.out.json", import.meta.url);
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
