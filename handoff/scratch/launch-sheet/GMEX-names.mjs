import { writeFileSync } from "node:fs";
const D = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
for (const q of ["Save Point", "SAVEPOINT", "Player Two", "PLAYER2", "Little Yowl", "YOWL", "SAVEPAWS", "PLAYERTWO", "LILYOWL"]) {
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const t = await res.text(); writeFileSync(`${D}/GMEX-jupname-${q.replace(/\s+/g,"_")}.json`, t);
  const arr = JSON.parse(t);
  console.log(q, res.status, arr.length, JSON.stringify(arr.map(x => ({ s: x.symbol, n: x.name, v: x.isVerified, tags: x.tags, mcap: x.mcap ? Math.round(x.mcap) : null }))));
}
