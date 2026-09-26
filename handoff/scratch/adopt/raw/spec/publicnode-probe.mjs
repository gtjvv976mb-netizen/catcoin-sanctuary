// READ-ONLY probe: can a browser on catcoinsanctuary.com use solana-rpc.publicnode.com for the methods the Adopt page needs?
// Methods: getLatestBlockhash, getMultipleAccounts, getBalance, simulateTransaction (sigVerify:false, replaceRecentBlockhash:true).
// No send, no signing. Origin header set as a browser would.
import fs from "node:fs";
const URL_ = "https://solana-rpc.publicnode.com";
const ORIGIN = "https://catcoinsanctuary.com";
const sim = JSON.parse(fs.readFileSync(new URL("../simulate-browser-build.json", import.meta.url)));
const tx = sim.results.find(r => r.id === "A_correct_shape").transactionBase64;
const calls = [
  ["getLatestBlockhash", [{ commitment: "confirmed" }]],
  ["getMultipleAccounts", [["4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7", "2NuVPU5ViAyQsZamVfJ1vU6Cp77WSzret4LtNTMiWFQ4", "9MHtkhfnaBGgUPxThD67t1GYbYY7urggGvsat3AXWe9g", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"], { encoding: "base64", dataSlice: { offset: 0, length: 16 } }]],
  ["getBalance", ["3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3", { commitment: "confirmed" }]],
  ["simulateTransaction", [tx, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" }]],
];
const out = { probedAt: new Date().toISOString(), rpc: URL_, origin: ORIGIN, results: [] };
// preflight
{
  const r = await fetch(URL_, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
  out.preflight = { status: r.status, acao: r.headers.get("access-control-allow-origin"), acah: r.headers.get("access-control-allow-headers"), acam: r.headers.get("access-control-allow-methods") };
}
for (const [method, params] of calls) {
  await new Promise(r => setTimeout(r, 700));
  if (method === "simulateTransaction" && params[1].sigVerify !== false) throw new Error("guard");
  const t0 = Date.now();
  const r = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json", Origin: ORIGIN }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const body = await r.json().catch(() => null);
  let summary = body;
  if (method === "simulateTransaction" && body?.result) summary = { err: body.result.value.err, unitsConsumed: body.result.value.unitsConsumed, logsHead: (body.result.value.logs || []).slice(0, 3), apiVersion: body.result.context.apiVersion };
  if (method === "getMultipleAccounts" && body?.result) summary = { owners: body.result.value.map(v => v && v.owner) };
  out.results.push({ method, status: r.status, acao: r.headers.get("access-control-allow-origin"), ms: Date.now() - t0, summary });
}
fs.writeFileSync(new URL("./publicnode-probe.out.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
