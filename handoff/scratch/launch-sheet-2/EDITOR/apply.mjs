import fs from "node:fs";
const { EDITS } = await import("./edits.mjs?" + Date.now());
const B = JSON.parse(fs.readFileSync("base.json"));
const out = B.map(([k, name, ticker, description, look, coat]) => {
  const i = description.indexOf(" A cat coin priced in ");
  let blurb = description.slice(0, i), disc = description.slice(i + 1);
  const e = EDITS[k] || {};
  const changed = Object.keys(e);
  name = e.name ?? name; ticker = e.ticker ?? ticker; blurb = e.blurb ?? blurb; disc = e.disc ?? disc; look = e.look ?? look; coat = e.coat ?? coat;
  return { k, name, ticker, blurb, disc, description: `${blurb} ${disc}`, look, coat: { base: coat[0], second: coat[1], pattern: coat[2], eyes: coat[3] }, changed };
});
fs.writeFileSync("final.json", JSON.stringify(out, null, 1));
fs.writeFileSync("final-base.json", JSON.stringify(out.map((o) => [o.k, o.name, o.ticker, o.description, o.look, [o.coat.base, o.coat.second, o.coat.pattern, o.coat.eyes]])));
for (const o of out) if (o.changed.length) console.log(o.k.padEnd(12), o.name.length, o.blurb.length, o.description.length, o.ticker, o.changed.join(","));
