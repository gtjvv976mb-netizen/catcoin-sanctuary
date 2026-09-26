import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
for (const q of ["Purrline", "Trillby", "Lantern", "PURR", "Purrline the Answering Cat", "Trillby the Chirping Cat"]) {
  const raw = await (await fetch("https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(q))).json();
  fs.writeFileSync(`${DIR}/VIDAX-jupname-${q.replace(/\s+/g, "_")}.json`, JSON.stringify(raw, null, 2));
  const arr = Array.isArray(raw) ? raw : [];
  console.log(q, "->", arr.length, arr.slice(0, 12).map((t) => `${t.symbol}|${t.name}${t.isVerified ? "(verified)" : ""}`).join(" ; "));
}
