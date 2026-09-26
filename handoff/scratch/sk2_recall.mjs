import fs from "node:fs";
import { classifyTheme } from "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/themes/classifier/themes.mjs";
const D = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/themes/classifier";
const labels = JSON.parse(fs.readFileSync(`${D}/labels.json`));
const map = { "finance-crypto-word": "crypto-finance", "other-animal": "other-animal" };
const norm = (t) => map[t] ?? t;
const FOLD = new Set(["brand", "crude", "internet-meme"]);
const res = {};
for (const l of labels) {
  const gold = norm(l.theme);
  let pred = classifyTheme({ name: l.name ?? "", symbol: l.symbol ?? "" }).theme;
  if (FOLD.has(pred)) pred = "none";
  const k = `${l.src}|${gold}`;
  res[k] ??= { n: 0, tp: 0, misses: [] };
  res[k].n++; if (pred === gold) res[k].tp++; else if (res[k].misses.length < 6) res[k].misses.push(`${l.name}|${l.symbol}->${pred}`);
}
const golds = [...new Set(labels.map((l) => norm(l.theme)))];
console.log([...new Set(labels.map((l) => l.src))], golds);
for (const g of golds) {
  const a = res[`launch|${g}`] ?? { n: 0, tp: 0 }, b = res[`graduated|${g}`] ?? { n: 0, tp: 0 , misses: []};
  console.log(g.padEnd(16), "launch recall", `${a.tp}/${a.n}`, " grad recall", `${b.tp}/${b.n}`, (b.misses||[]).join("; ").slice(0, 200));
}
