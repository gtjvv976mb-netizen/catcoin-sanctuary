import fs from "node:fs";
const out = "/home/user/cat-sanctuary/tests/fixtures";
const rec = JSON.parse(fs.readFileSync("recorded.json", "utf8"));
const ref = "/home/user/Cat-Intelligence-Agency/fixtures/bots/stonkfun";
const write = (name, obj) => fs.writeFileSync(`${out}/${name}`, JSON.stringify(obj, null, 1) + "\n");
const how = "Recorded 2026-09-25 from https://api.mainnet-beta.solana.com by the sanctuary's data build. Each answer is kept as the RPC gave it, with its method, params and readAt (UTC).";

write("stonkfun-launches.json", {
  captured: "2026-09-25",
  note: `${how} The six real StonkFun launches (initialize_with_token_2022 on StonkFun's standard platform config) that the Cat Intelligence Agency project found on 2026-09-24 by reading that config's history (its fixtures/bots/stonkfun/launch-samples.json keeps only their decoded instructions); here are their whole transactions. Two are priced in an xStock (GMEx: 2VJ6Eqt9…, GOOGLx: 592bMtm5…); four are not (SOL, and three other tokens). Two are v0 with a lookup table, four are legacy; three carry a dev buy.`,
  answers: rec.launches,
});
write("pumpfun-create.json", {
  captured: "2026-09-25",
  note: `${how} A real pump.fun create_v2 transaction with a buy (the first of the Cat Intelligence Agency project's fixtures/bots/pumpfun/create-v2-samples.json, read in full).`,
  answer: rec.pumpfun[0],
});
write("failed-tx.json", {
  captured: "2026-09-25",
  note: `${how} A real transaction that failed on chain (a swap), paid by the wallet that made the GMEx launch, found in that wallet's history.`,
  listed: rec.failed.signature,
  answer: rec.failed.transaction,
});
write("v1-refusal.json", {
  captured: "2026-09-25",
  note: `${how} What the RPC answers when getTransaction asks for a version-1 transaction with maxSupportedTransactionVersion 0 (the transaction was a real one seen in StonkFun's platform config history that day).`,
  answer: rec.v1,
});
const wallets = {};
for (const [w, h] of Object.entries(rec.wallets)) wallets[w] = { launch: h.launch, note: h.note, signaturesReadAt: h.readAt, signatures: h.signatures, transactions: h.transactions };
write("wallet-histories.json", {
  captured: "2026-09-25",
  note: `${how} Two real launch wallets: the GOOGLx launcher's whole history as getSignaturesForAddress (finalized) listed it, and a window of nine signatures around the GMEx launcher's launch; with every transaction in them, read with getTransaction (json, maxSupportedTransactionVersion 0, finalized).`,
  wallets,
});
const mints = JSON.parse(fs.readFileSync(`${ref}/2026-09-25/launched-mints.json`, "utf8"));
const ax = JSON.parse(fs.readFileSync(`${ref}/2026-09-25/accounts-xstocks.json`, "utf8"));
const gc = ax.accounts.filter((a) => ["GMEx GlobalConfig", "GOOGLx GlobalConfig"].includes(a.label));
if (gc.length !== 2) throw new Error("global configs missing");
write("accounts.json", {
  captured: "2026-09-25",
  note: "Copied from the Cat Intelligence Agency project (read-only), with the capture times it recorded: the mints of the six real launches (fixtures/bots/stonkfun/2026-09-25/launched-mints.json, getMultipleAccounts base64, read 2026-09-25T13:50:10.276Z at slot 450371063) and the LaunchLab GlobalConfigs of GMEx and GOOGLx (fixtures/bots/stonkfun/2026-09-25/accounts-xstocks.json, read 2026-09-25T13:50:08.022Z at slot 450371054).",
  mints: { readAt: mints.readAt, slot: mints.slot, url: mints.url, accounts: mints.accounts },
  globalConfigs: { readAt: ax.readAt, slot: ax.slot, url: ax.url, accounts: gc },
});
const xs = JSON.parse(fs.readFileSync(`${ref}/2026-09-25/xstocks-official-24.json`, "utf8"));
write("xstocks-official-24.json", { copiedFrom: "Cat Intelligence Agency project, fixtures/bots/stonkfun/2026-09-25/xstocks-official-24.json", ...xs });
console.log(fs.readdirSync(out).map((f) => `${f} ${fs.statSync(`${out}/${f}`).size}`).join("\n"));
