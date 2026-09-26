// REVIEW PROBE (read-only). For all 91 cats: StonkFun /pricing, chain reads of rule+config, and a
// simulateTransaction (sigVerify:false, replaceRecentBlockhash:true) of EXACTLY the SPEC.md 1.3 recipe:
// legacy, [SetComputeUnitLimit 250_000, SetComputeUnitPrice 20_000], init_with_token_2022, 63-byte arweave-shaped URI.
// Nothing is signed or sent. Mint addresses are throwaway public keys (secrets never used).
import fs from "node:fs"; import { createRequire } from "node:module";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } = require("@solana/web3.js");
const RPC = "https://api.mainnet-beta.solana.com";
const ALLOWED = new Set(["getMultipleAccounts","getBalance","getLatestBlockhash","simulateTransaction","getAccountInfo"]);
let last = 0;
async function rpc(method, params) {
  if (!ALLOWED.has(method)) throw new Error("not allowed " + method);
  if (method === "simulateTransaction" && params[1]?.sigVerify !== false) throw new Error("guard");
  for (let a = 0; a < 6; a++) {
    const w = Math.max(0, last + 650 - Date.now()); if (w) await new Promise(r => setTimeout(r, w)); last = Date.now();
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 4000 * (a + 1))); continue; }
    const j = await res.json(); if (j.error) { if (/429|Too many/i.test(JSON.stringify(j.error))) { await new Promise(r => setTimeout(r, 4000 * (a + 1))); continue; } throw new Error(method + JSON.stringify(j.error)); }
    return j.result;
  }
  throw new Error("rate limited");
}
const API = "https://www.stonkfun.xyz/api/public/v1";
let lastApi = 0;
async function api(p) { const w = Math.max(0, lastApi + 350 - Date.now()); if (w) await new Promise(r => setTimeout(r, w)); lastApi = Date.now();
  const r = await fetch(API + p, { headers: { Origin: "https://catcoinsanctuary.com" } }); return { status: r.status, body: await r.json().catch(() => null) }; }
const LL = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj");
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
const PAYER = new PublicKey("3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3");
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, LL)[0];
const u8 = (n) => Buffer.from([n]); const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const str = (s) => { const d = Buffer.from(s, "utf8"); const l = Buffer.alloc(4); l.writeUInt32LE(d.length); return Buffer.concat([l, d]); };
const inv = JSON.parse(fs.readFileSync(new URL("../../kits-inventory.json", import.meta.url)));
const OUT = new URL("../../raw/review/verify-91.out.json", import.meta.url);
const out = { startedAt: new Date().toISOString(), recipe: "legacy; CU limit 250000; CU price 20000; init; uri=https://arweave.net/+43", stats: null, rows: [] };
out.stats = (await api("/stats")).body?.data?.config;
const pairs = (await api("/pairs?launchable=true&launchLabReady=true")).body?.data?.pairs ?? [];
const pairByMint = new Map(pairs.map(p => [p.mint, p]));
out.pairsCount = pairs.length;
const bal = (await rpc("getBalance", [PAYER.toBase58(), { commitment: "confirmed" }])).value;
const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
const fakeUri = "https://arweave.net/" + "A".repeat(43);
for (const cat of inv.cats) {
  const quote = cat.quote.mint; const row = { cat: cat.id, stock: cat.stock, category: cat.category, quote };
  const pair = pairByMint.get(quote); row.pairListed = !!pair; row.pairTokenProgram = pair?.tokenProgram;
  const pr = await api(`/launchlab/pricing?quoteMint=${quote}`); row.pricingStatus = pr.status;
  const p = pr.body?.data; if (!p) { row.error = pr.body; out.rows.push(row); continue; }
  const derivedRule = pda([Buffer.from("platform_curve_rule"), new PublicKey(PLATFORM).toBuffer(), new PublicKey(p.curve.configId).toBuffer()]).toBase58();
  row.pricing = { configId: p.curve.configId, rule: p.curveRule.standard, ruleEqPda: p.curveRule.standard === derivedRule, platform: p.platform.standard, programId: p.curve.programId,
    curveType: p.curve.curveType, migrateType: p.curve.migrateType, baseDecimals: p.curve.baseDecimals, supply: p.curve.supply, totalSellA: p.curve.totalSellA, raw: p.raise.raw, vesting: p.curve.vesting, cpmmCreatorFeeOn: p.curve.cpmmCreatorFeeOn, quoteTokenProgram: p.quote.tokenProgram, observedAt: p.prices.observedAt };
  const name = String(cat.draft?.name || (cat.id + " the Longest Named Cat Ok")).slice(0, 32); const symbol = String(cat.draft?.ticker || cat.id).slice(0, 10);
  const nameB = Buffer.from(name).length <= 32 ? name : name.slice(0, 28);
  const mint = Keypair.generate().publicKey; const qm = new PublicKey(quote); const qtp = new PublicKey(p.quote.tokenProgram);
  const pool = pda([Buffer.from("pool"), mint.toBuffer(), qm.toBuffer()]);
  const keys = [
    { pubkey: PAYER, isSigner: true, isWritable: true }, { pubkey: PAYER, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(p.curve.configId), isSigner: false, isWritable: false }, { pubkey: new PublicKey(PLATFORM), isSigner: false, isWritable: false },
    { pubkey: pda([Buffer.from("vault_auth_seed")]), isSigner: false, isWritable: false }, { pubkey: pool, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: true, isWritable: true }, { pubkey: qm, isSigner: false, isWritable: false },
    { pubkey: pda([Buffer.from("pool_vault"), pool.toBuffer(), mint.toBuffer()]), isSigner: false, isWritable: true },
    { pubkey: pda([Buffer.from("pool_vault"), pool.toBuffer(), qm.toBuffer()]), isSigner: false, isWritable: true },
    { pubkey: new PublicKey(T22), isSigner: false, isWritable: false }, { pubkey: qtp, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: pda([Buffer.from("__event_authority")]), isSigner: false, isWritable: false }, { pubkey: LL, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(p.curveRule.standard), isSigner: false, isWritable: false },
  ];
  const data = Buffer.concat([Buffer.from("25be7ede2c9aab11", "hex"), u8(p.curve.baseDecimals), str(nameB), str(symbol), str(fakeUri),
    u8(0), u64(p.curve.supply), u64(p.curve.totalSellA), u64(p.raise.raw), u8(1), u64(0), u64(0), u64(0), u8(p.curve.cpmmCreatorFeeOn), u8(0), Buffer.alloc(10)]);
  const tx = new Transaction({ feePayer: PAYER, recentBlockhash: blockhash })
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }))
    .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }))
    .add(new TransactionInstruction({ programId: LL, keys, data }));
  const wire = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  row.txBytes = wire.length; row.name = nameB; row.symbol = symbol;
  try {
    const sim = await rpc("simulateTransaction", [wire.toString("base64"), { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed", accounts: { encoding: "base64", addresses: [PAYER.toBase58()] } }]);
    const v = sim.value; const after = v.accounts?.[0]?.lamports;
    row.sim = { err: v.err, cu: v.unitsConsumed, payerCost: after == null ? null : bal - after, init: (v.logs || []).some(l => l.includes("Instruction: InitializeWithToken2022")), errLogs: (v.logs || []).filter(l => /Error|error|failed/.test(l)).slice(0, 6) };
  } catch (e) { row.sim = { rpcError: String(e) }; }
  out.rows.push(row); console.error(cat.id, row.pricing.ruleEqPda, JSON.stringify(row.sim?.err), row.sim?.cu, row.sim?.payerCost);
}
// chain: rule + config owners for all
const addrs = [...new Set(out.rows.flatMap(r => r.pricing ? [r.pricing.rule, r.pricing.configId] : []))];
out.accounts = {};
for (let i = 0; i < addrs.length; i += 100) {
  const m = await rpc("getMultipleAccounts", [addrs.slice(i, i + 100), { encoding: "base64", commitment: "confirmed", dataSlice: { offset: 0, length: 0 } }]);
  m.value.forEach((v, j) => { out.accounts[addrs[i + j]] = v ? v.owner : null; });
}
const pc = await rpc("getAccountInfo", [PLATFORM, { encoding: "base64", commitment: "confirmed" }]);
const b = Buffer.from(pc.value.data[0], "base64");
// restrictGlobalConfig/restrictCurveParam offsets per tools/accounts.mjs layout
let o = 8 + 8 + 32 + 32 + 8 + 8 + 8 + 8 + 64 + 256 + 256 + 32 + 8 + 32 + 32 + 8 + 32;
out.platform = { owner: pc.value.owner, restrictGlobalConfig: b[o], restrictCurveParam: b[o + 1] };
out.summary = { n: out.rows.length, simOk: out.rows.filter(r => r.sim && r.sim.err === null && r.sim.init).length, simFail: out.rows.filter(r => !r.sim || r.sim.err !== null).map(r => [r.cat, r.sim?.err ?? r.sim?.rpcError ?? r.error]),
  ruleMismatch: out.rows.filter(r => r.pricing && !r.pricing.ruleEqPda).map(r => r.cat), maxCu: Math.max(...out.rows.map(r => r.sim?.cu ?? 0)), maxBytes: Math.max(...out.rows.map(r => r.txBytes ?? 0)),
  costRange: [Math.min(...out.rows.map(r => r.sim?.payerCost ?? Infinity)), Math.max(...out.rows.map(r => r.sim?.payerCost ?? 0))],
  ownersNotLL: Object.entries(out.accounts).filter(([, v]) => v !== LL.toBase58()),
  shapeDeviations: out.rows.filter(r => r.pricing && (r.pricing.platform !== PLATFORM || r.pricing.curveType !== "ConstantCurve" || r.pricing.migrateType !== "cpmm" || r.pricing.baseDecimals !== 6 || r.pricing.supply !== "1000000000000000" || r.pricing.totalSellA !== "793100000000000" || r.pricing.cpmmCreatorFeeOn !== 0 || r.pricing.quoteTokenProgram !== r.pairTokenProgram)).map(r => r.cat) };
out.finishedAt = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ stats: out.stats, pairs: out.pairsCount, platform: out.platform, summary: out.summary }, null, 1));
