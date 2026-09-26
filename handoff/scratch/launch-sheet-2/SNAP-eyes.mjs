// Extract the same "others" list as SNAP-pick-final.mjs and test candidate eye words.
import fs from "node:fs";
const src = fs.readFileSync(new URL("./SNAP-pick-final.mjs", import.meta.url), "utf8")
  .replace(/const coins = \[[\s\S]*?\n\];\n/, "const coins = [];\n")
  .replace(/const r = await fetch[\s\S]*$/, "export { others, own, checkProposal, checkFields, checkTerms, S };\n");
fs.writeFileSync(new URL("./SNAP-eyes-lib.mjs", import.meta.url), src);
const { others, own, checkProposal, checkFields, checkTerms, S } = await import("./SNAP-eyes-lib.mjs");
const base = "Sandstep, a lean tawny shorthair with a cream chest, dark-tipped tail and EYES eyes, trots across the little garden footbridge every dusk.";
const DISC = " A cat coin priced in SNAP. Not affiliated with Snap Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const all = (b) => { const v = []; for (const t of others) { const r = checkTerms({ blurb: b }, { other_pair: [t] }); if (!r.ok) v.push(t); } return v; };
console.log("Brown from:", others.filter((t) => /^brown$/i.test(t)));
for (const e of ["honey-brown", "honey", "honey-colored", "toffee", "caramel", "tawny-gold", "warm yellow", "yellow-brown", "golden-brown", "honey-hued"]) {
  const b = base.replace("EYES", e);
  console.log(JSON.stringify({ e, blurb: b.length, desc: (b + DISC).length, proposal: checkProposal({ name: "Sandstep the Tawny Cat", symbol: "SANDSTEP", tagline: b }).violations,
    fields: checkFields({ blurb: b }).violations, own: checkTerms({ blurb: b }, { stock: own }).violations, launch: checkTerms({ blurb: b }, { l: S.LAUNCH_CLAIMS }).violations, otherPairHits: all(b) }));
}
