// READ-ONLY: of pools whose epoch field is the current epoch (1042), how many were CREATED earlier?
import fs from "node:fs"; import { createRequire } from "node:module";
import { rpc, log, OUT } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey } = require("@solana/web3.js");
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain7.out.json", JSON.stringify({ r, log }, null, 1)));
const EPOCH_LEN = 432000;
const cur = JSON.parse(fs.readFileSync(OUT + "gpa-standard-current-epoch.json", "utf8")).result;
// deterministic spread: every 160th pool
const pick = cur.filter((_, i) => i % 160 === 0).slice(0, 16);
const rows = [];
for (const x of pick) {
  const s = await rpc("getSignaturesForAddress", [x.pubkey, { limit: 1000, commitment: "finalized" }]);
  if (!Array.isArray(s) || !s.length) { rows.push({ pool: x.pubkey, error: s }); continue; }
  const complete = s.length < 1000;
  const oldest = s.at(-1);
  rows.push({ pool: x.pubkey, nSigs: s.length, historyComplete: complete, oldestSlot: oldest.slot, oldestEpoch: Math.floor(oldest.slot / EPOCH_LEN), oldestTime: new Date(oldest.blockTime * 1000).toISOString(), oldestTxIndex: oldest.transactionIndex, oldestErr: !!oldest.err });
}
r.rows = rows;
r.summary = { sampled: rows.length, complete: rows.filter(x => x.historyComplete).length, createdBefore1042AmongComplete: rows.filter(x => x.historyComplete && x.oldestEpoch < 1042).length };
console.log(JSON.stringify(r, null, 1));
