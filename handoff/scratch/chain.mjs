import fs from "node:fs";
import { describeMint, parseMintExtensions, assertTradeableExtensions, TOKEN_2022_PROGRAM } from "/home/user/Cat-Intelligence-Agency/vendor/executor/token2022.mjs";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const c = JSON.parse(fs.readFileSync(new URL("./census.json", import.meta.url)));
const safe = r => r.mintAuthorityDisabled===true && r.freezeAuthorityDisabled===true;
const B = c.cats.filter(r => (r.liquidityUsd??0) >= 1e4 && r.verified);   // include not-safe-per-Jupiter to see chain view
const mints = B.map(r=>r.mint);
const res = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [mints, { encoding: "base64", commitment: "confirmed" }] }) });
const text = await res.text();
console.log("status", res.status, "bytes", text.length);
const j = JSON.parse(text);
if (!j.result) { console.log(text.slice(0, 400)); process.exit(0); }
console.log("slot", j.result.context.slot);
const out = { slot: j.result.context.slot, at: new Date().toISOString(), rows: [] };
let pass = 0; const fails = {};
B.forEach((r, i) => {
  const a = j.result.value[i];
  const acct = a ? { owner: a.owner, lamports: a.lamports, data: a.data } : null;
  let d, why = null;
  try { d = describeMint(acct, r.mint); } catch (e) { why = "mint_unreadable: " + e.message; }
  if (d) {
    if (!d.initialized) why = "not_initialized";
    else if (d.program === TOKEN_2022_PROGRAM) { try { assertTradeableExtensions(parseMintExtensions(Buffer.from(a.data[0], "base64")), r.mint); } catch (e) { why = "extension: " + e.message.replace(/mint \S+ /, ""); } }
    if (!why && d.paused) why = "paused";
    if (!why && d.mintAuthority) why = "mint_authority_live";
    if (!why && d.freezeAuthority) why = "freeze_authority_live";
    if (!why && d.decimals !== r.decimals) why = `decimals_differ jup ${r.decimals} chain ${d.decimals}`;
    if (!why && d.program !== r.program) why = "program_differs";
  }
  const chainNameCat = d?.metadataName ? detectCat({ name: d.metadataName, symbol: d.metadataSymbol ?? "" }).isCat : null;
  out.rows.push({ mint: r.mint, symbol: r.symbol, program: d?.program, ext: d?.extensionNames, jupSafe: safe(r), why, chainName: d?.metadataName ?? null, chainNameCat, liq: r.liquidityUsd, vol: r.vol24h });
  if (!why) pass++; else { const k = why.split(":")[0].split(" ")[0]; fails[k] = (fails[k] ?? 0) + 1; }
});
console.log("verified >=10k:", B.length, "(jupSafe", B.filter(safe).length, ") chain pass:", pass, "fails", fails);
for (const x of out.rows.filter(x=>x.why)) console.log("FAIL", x.symbol.padEnd(10), x.jupSafe ? "jupSafe" : "jupUnsafe", x.why, (x.ext??[]).join(","));
const t22 = out.rows.filter(x=>x.program===TOKEN_2022_PROGRAM);
console.log("T22 rows", t22.length, "ext sets:", [...new Set(t22.map(x=>(x.ext??[]).join("+")))]);
console.log("T22 with on-chain metadata name:", t22.filter(x=>x.chainName).length, "chain name is cat:", t22.filter(x=>x.chainNameCat).length, "not cat:", t22.filter(x=>x.chainName && !x.chainNameCat).map(x=>`${x.symbol}='${x.chainName}'`).join(", "));
fs.writeFileSync(new URL("./chainread.json", import.meta.url), JSON.stringify(out, null, 1));
