import { checkFields } from "/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs";
import fs from "node:fs";
const r = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launcher-design/raw/check-quotes-report.json","utf8"));
for (const x of r.xstocks) {
  const base = x.official.name.replace(/\s*xStock$/,"");
  const v = checkFields({ name: base }).violations.map(v=>v.rule+":"+v.term);
  const root = x.official.symbol.replace(/x$/,"");
  const vt = checkFields({ name: `${root} Cat` }).violations.map(v=>v.rule+":"+v.term);
  console.log(x.symbol, x.official.symbol, JSON.stringify(base), v.join(",")||"-", "| root", root, vt.join(",")||"-");
}
