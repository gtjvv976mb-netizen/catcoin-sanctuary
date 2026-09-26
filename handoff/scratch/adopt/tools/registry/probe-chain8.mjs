// READ-ONLY: can one getMultipleAccounts with a dataSlice read name/symbol/uri of 100 LaunchLab mints at once?
import fs from "node:fs"; import { createRequire } from "node:module";
import { rpc, log, OUT } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey } = require("@solana/web3.js");
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain8.out.json", JSON.stringify({ r, log }, null, 1)));
const cur = JSON.parse(fs.readFileSync(OUT + "gpa-standard-current-epoch.json", "utf8")).result;
const mints = cur.slice(0, 100).map(x => new PublicKey(Buffer.from(x.account.data[0], "base64").subarray(0, 32)).toBase58());
const t0 = Date.now();
const res = await rpc("getMultipleAccounts", [mints, { encoding: "base64", commitment: "finalized", dataSlice: { offset: 302, length: 200 } }], { save: "mints-metadata-slice-100" });
const rd = (b, p) => { if (p + 4 > b.length) return [null, p]; const n = b.readUInt32LE(p); if (p + 4 + n > b.length) return [null, p]; return [b.subarray(p + 4, p + 4 + n).toString("utf8"), p + 4 + n]; };
let ok = 0, truncated = 0; const sample = [];
for (const [i, a] of res.value.entries()) {
  if (!a) continue; const b = Buffer.from(a.data[0], "base64");
  let [name, p1] = rd(b, 0); let [symbol, p2] = name === null ? [null, 0] : rd(b, p1); let [uri] = symbol === null ? [null] : rd(b, p2);
  if (uri !== null) ok++; else truncated++;
  if (sample.length < 5) sample.push({ mint: mints[i], name, symbol, uri });
}
r.result = { ms: Date.now() - t0, bytesJson: JSON.stringify(res).length, decodedFully: ok, truncatedOrOther: truncated, sample };
console.log(JSON.stringify(r, null, 1));
