import fs from "node:fs";
import { proveLaunch, checkLaunchAccounts, IX, GLOBAL_CONFIG_DISC } from "/home/user/cat-sanctuary/scripts/lib/chain.mjs";
import { createHash } from "node:crypto";
const rec = JSON.parse(fs.readFileSync("recorded.json", "utf8"));
for (const [n, h] of Object.entries({ initialize_with_token_2022: IX.initializeWithToken2022, initialize: IX.initialize, initialize_v2: IX.initializeV2, buy_exact_in: IX.buyExactIn })) console.log(n, createHash("sha256").update("global:" + n).digest().subarray(0, 8).toString("hex") === h);
console.log("GlobalConfig", createHash("sha256").update("account:GlobalConfig").digest().subarray(0, 8).toString("hex") === GLOBAL_CONFIG_DISC);
const mints = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/stonkfun/2026-09-25/launched-mints.json", "utf8")).accounts;
const ax = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/stonkfun/2026-09-25/accounts-xstocks.json", "utf8")).accounts;
const acc = (a) => { const m = [...mints, ...ax].find((x) => x.address === a); return m ? { owner: m.owner, lamports: m.lamports, data: [m.dataBase64, "base64"] } : null; };
for (const t of rec.launches) {
  const r = t.result; const payer = r.transaction.message.accountKeys[0];
  const p = proveLaunch(r, { wallet: payer });
  console.log(t.params[0].slice(0, 6), JSON.stringify(p).slice(0, 300));
  if (p.ok) console.log("  accounts:", JSON.stringify(checkLaunchAccounts(p.launch, acc(p.launch.mint), acc(p.launch.globalConfig))));
}
console.log("pump", JSON.stringify(proveLaunch(rec.pumpfun[0].result, { wallet: rec.pumpfun[0].result.transaction.message.accountKeys[0] })));
console.log("failed", JSON.stringify(proveLaunch(rec.failed.transaction.result, { wallet: "45ByChvJhwVFBP9pzZDvsByfoepRnmRMRNhXE6SD2Wjc" })));
for (const [w, h] of Object.entries(rec.wallets)) for (const t of h.transactions) console.log(w.slice(0, 5), t.params[0].slice(0, 6), t.error ? "ERR " + t.error.code : JSON.stringify(proveLaunch(t.result, { wallet: w })).slice(0, 160));
