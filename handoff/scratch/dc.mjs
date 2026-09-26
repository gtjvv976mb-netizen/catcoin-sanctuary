import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
import fs from "node:fs";
const j = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/census.json"));
let pass = 0; const fail = [];
for (const c of j.cats) { const r = detectCat({ name: c.name, symbol: c.symbol }); if (r.isCat) pass++; else fail.push(`${c.symbol}/${c.name}`); }
console.log("pass", pass, "of", j.cats.length, "fail sample", fail.slice(0, 12));
const v = j.cats.filter((x) => x.verified && x.liquidityUsd >= 10000 && x.mintAuthorityDisabled && x.freezeAuthorityDisabled);
console.log("t22 among 75:", v.filter((x) => String(x.program).startsWith("Tokenz")).length, "fields:", Object.keys(j.cats[0]).join(","));
