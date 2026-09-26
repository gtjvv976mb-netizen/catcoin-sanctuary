// Records the real mainnet answers the cat-sanctuary tests replay. Run once, 2026-09-25.
import fs from "node:fs";
const url = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (r.status === 429) { await sleep(2500 * (a + 1)); continue; }
    const j = await r.json();
    if (j.error && (j.error.code === 429 || /too many/i.test(j.error.message))) { await sleep(2500 * (a + 1)); continue; }
    await sleep(350);
    return { method, params, readAt: new Date().toISOString(), ...(j.error ? { error: j.error } : { result: j.result }) };
  }
  throw new Error("rate limited");
}
const TX = (sig) => rpc("getTransaction", [sig, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" }]);
const samples = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/stonkfun/launch-samples.json", "utf8")).launches;
const pump = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/pumpfun/create-v2-samples.json", "utf8")).samples;
const out = { endpoint: url, note: "Real mainnet answers, recorded 2026-09-25 by the sanctuary's data engineer from the public RPC. Each answer keeps its own readAt, its method and params, and the result or the error exactly as returned.", launches: [], pumpfun: [], wallets: {} };
for (const s of samples) out.launches.push(await TX(s.signature));
out.pumpfun.push(await TX(pump[0].signature));
// Two real launch wallets: the GOOGLx launcher's whole history, and a window of the GMEx launcher's.
for (const [w, launch, span] of [["8MwvKAAYCq258pUuT4ndQFjbwTyDZ8qHdGG6RzNdr43b", "592bMtm5uBjURtt3jgSmxqkP1zqqDPxTp1b3X6mkwekwcSQWSNdRV9PPSVqqnFDLd4LoHjmE23xqzR54NSg753xi", 1000], ["45ByChvJhwVFBP9pzZDvsByfoepRnmRMRNhXE6SD2Wjc", "2VJ6Eqt9VpFx9thFeZM5hWfW7NihiQMwCsBNtCXWTpdJBp8cXzDL2Y9ApiW1LE2nxTFFHN8dLxBPzXGkV7WVsxcj", 4]]) {
  // Find the launch in the wallet's history by paging back.
  let before, all = [];
  for (let p = 0; p < 5; p++) {
    const page = await rpc("getSignaturesForAddress", [w, { limit: 1000, commitment: "finalized", ...(before ? { before } : {}) }]);
    all.push(...page.result); if (page.result.length < 1000 || page.result.some((x) => x.signature === launch)) break; before = page.result.at(-1).signature;
  }
  const i = all.findIndex((x) => x.signature === launch);
  const win = span >= 1000 ? all : all.slice(Math.max(0, i - span), i + span + 1);
  const txs = [];
  for (const s of win) txs.push(await TX(s.signature));
  out.wallets[w] = { launch, note: span >= 1000 ? "the wallet's whole history on the day it was read" : `a window of ${win.length} signatures around the launch, as the wallet's history listed them`, signatures: win, readAt: new Date().toISOString(), transactions: txs };
  console.log(w, all.length, i, win.length, txs.map((t) => (t.error ? "ERR" + t.error.code : t.result ? `${t.result.version}${t.result.meta.err ? "!" : ""}` : "null")).join(" "));
}
fs.writeFileSync("recorded.json", JSON.stringify(out));
console.log("launches", out.launches.map((t) => t.result ? t.result.version : t.error?.code).join(","), "pump", out.pumpfun[0].result?.version);
