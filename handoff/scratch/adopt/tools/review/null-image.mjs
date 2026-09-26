// READ-ONLY: for sampled adopted launches, read each mint's TokenMetadata URI (getMultipleAccounts dataSlice 302..)
// and compare with StonkFun's imageUrl, to see which metadata hosts StonkFun fails to resolve.
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(new URL("../../raw/review/feed-recorded.out.json", import.meta.url)));
const mints = d.launches.map(x => x.mint);
const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [mints, { encoding: "base64", dataSlice: { offset: 302, length: 260 } }] }) });
const j = await r.json();
const rows = j.result.value.map((v, i) => {
  const b = Buffer.from(v.data[0], "base64"); let o = 0; const s = () => { const n = b.readUInt32LE(o); o += 4; const t = b.subarray(o, o + n).toString("utf8"); o += n; return t; };
  let name, symbol, uri; try { name = s(); symbol = s(); uri = s(); } catch { }
  const l = d.launches[i]; return { mint: mints[i], stock: l.stock, name, symbol, uri, imageUrl: l.stonkfun.imageUrl, tokenStatus: l.stonkfun.status };
});
fs.writeFileSync(new URL("../../raw/review/null-image.out.json", import.meta.url), JSON.stringify(rows, null, 1));
for (const x of rows.filter(x => !x.imageUrl)) console.log(x.stock, x.symbol, x.uri);
console.log("uri hosts:", JSON.stringify(rows.reduce((a, x) => { const h = (x.uri || "").split("/")[2]; a[h] = (a[h] || 0) + 1; return a; }, {})));
