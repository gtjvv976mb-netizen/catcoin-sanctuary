// Read-only: length and rule check of the revised permanent metadata description (SPEC rev section 3.3):
// "{story} {disclosure full, with xStocks/PreStocks naming} {tail}". Output: raw/revise/desc-v2-check.out.json
import fs from "node:fs";
import { checkFields } from "/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs";
const ADOPT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt";
const base = JSON.parse(fs.readFileSync(`${ADOPT}/raw/kits/base-inventory.json`, "utf8"));
const TAIL = "A memecoin; it can lose all of its value. Launched by its adopter's own wallet; Catcoin Sanctuary does not vet adopters.";
const OK = new Set(["brand", "endorsement", "financial_promise"]);
const rows = [];
for (const r of base.rows) {
  const d = r.draft; if (!d?.name) continue;
  let full = d.disclosure;
  if (r.category === "xstock") full = full.replace(/ or StonkFun\./, ", xStocks or StonkFun.");
  if (r.category === "prestock") full = full.replace(/^A cat coin priced in ([^.]*?)\./, (m, s) => `A cat coin priced in the ${s} PreStocks token.`);
  const desc = `${d.story} ${full} ${TAIL}`;
  const hits = checkFields({ tail: TAIL.replace("Catcoin Sanctuary", "Sanctuary") }).violations.filter((v) => !OK.has(v.rule));
  rows.push({ ticker: d.ticker, len: desc.length, bytes: Buffer.byteLength(desc), hits });
}
const lens = rows.map((x) => x.len);
const out = { tail: TAIL, n: rows.length, min: Math.min(...lens), max: Math.max(...lens), over400: rows.filter((x) => x.len > 400).map((x) => [x.ticker, x.len]), tailHits: rows[0].hits };
fs.writeFileSync(`${ADOPT}/raw/revise/desc-v2-check.out.json`, JSON.stringify({ generatedAt: new Date().toISOString(), ...out, rows }, null, 1));
console.log(JSON.stringify(out, null, 1));
