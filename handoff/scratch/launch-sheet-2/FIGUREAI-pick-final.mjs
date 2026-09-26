const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const blurb = "Knit, a plush pale ash-grey tabby with a soft woolly coat and faint ribbed stripes, pads between the flowerpots so carefully that none ever tips over.";
const look = "A plush, woolly-coated pale ash-grey house cat with faint, low-contrast ribbed tabby stripes, gold eyes, soft careful paws, normal four-legged build; it wears nothing.";
const name = "Knit the Woolly Grey Cat", symbol = "KNITPAW";
const DISC = "A cat coin priced in FIGUREAI. Not affiliated with Figure AI, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const description = `${blurb} ${DISC}`;
const out = {
  lengths: { name: name.length, blurb: blurb.length, description: description.length },
  checkProposal: R.checkProposal({ name, symbol, tagline: blurb }),
  checkFields_look: R.checkFields({ name, symbol, blurb, look }),
  checkFields_fullDescription: R.checkFields({ description }),
  checkFields_disclosureOnly: R.checkFields({ description: DISC }),
  checkProposal_fullDescription: R.checkProposal({ name, symbol, tagline: description }),
  sp_probe: R.checkTerms({ blurb }, { x: ["S&P"] }), sp_norm: R.normalize("S&P"),
  sp_probe_words: ["Knit, a plush pale ash-grey tabby", "with a soft woolly coat", "and faint ribbed stripes, pads", "between the flowerpots", "so carefully that none ever tips over."].map((t) => [t, R.checkTerms({ t }, { x: ["S&P"] }).ok]),
  description,
};
console.log(JSON.stringify(out, null, 1));
