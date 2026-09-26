// READ-ONLY: creation txs of third-party-built pools that StonkFun adopted; compare chain time with StonkFun's createdAt.
import fs from "node:fs";
import { rpc, log, OUT } from "./rpc.mjs";
const API = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/api/tokens/";
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain3.out.json", JSON.stringify({ r, log }, null, 1)));
for (const mint of ["CuAoNRcSSwBDWVwfngbAfygvXnDEKJ3XJSPs8kMTSTNK", "2yxMaqRx3Ago77ysgmMvveLWMvToWTodEMPf3EcBmvcG", "4FvUTZNAgEwDUbuLYfB4vpZForeCcyaYT26mTqchLCRc", "FbDVeqD87Wyp5bBj5nEqGtq5A3LEEwShomPS1nVfZufz"]) {
  const api = JSON.parse(fs.readFileSync(API + mint + ".json", "utf8")).data;
  const pool = api.token.pool;
  let before = null, oldest = null, pages = 0;
  for (;;) { const s = await rpc("getSignaturesForAddress", [pool, { limit: 1000, commitment: "finalized", ...(before ? { before } : {}) }]); pages++;
    if (!Array.isArray(s) || !s.length) break; oldest = s.at(-1); if (s.length < 1000 || pages >= 8) break; before = oldest.signature; }
  let tx = await rpc("getTransaction", [oldest.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" }], { save: "tx-creation-" + mint.slice(0, 6) });
  let v0error = null;
  if (!tx || !tx.transaction) { v0error = tx?.error ?? tx; tx = await rpc("getTransaction", [oldest.signature, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "finalized" }], { save: "tx-creation-v1-" + mint.slice(0, 6) }); }
  if (!tx || !tx.transaction) { r[mint] = { v0error, v1error: tx }; continue; }
  const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const onchain = new Date(tx.blockTime * 1000).toISOString();
  r[mint] = { name: api.token.name, pool, v0error, pages, creationSig: oldest.signature, slot: tx.slot, transactionIndex: oldest.transactionIndex, version: tx.version, feePayer: keys[0], creator: api.launch.creator,
    programs: tx.transaction.message.instructions.map(ix => keys[ix.programIdIndex]),
    chainTime: onchain, launchCreatedAt: api.launch.createdAt, tokenCreatedAt: api.token.createdAt,
    launchLagSec: (Date.parse(api.launch.createdAt) - tx.blockTime * 1000) / 1000, tokenLagSec: (Date.parse(api.token.createdAt) - tx.blockTime * 1000) / 1000 };
}
console.log(JSON.stringify(r, null, 1));
