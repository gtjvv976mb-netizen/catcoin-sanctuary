const u = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=Ambarella,_Inc.&redirects=1";
const r = await fetch(u, { headers: { "user-agent": "cat-sanctuary-research/1.0 (research script)" } });
const j = await r.json();
const p = Object.values(j.query.pages)[0];
const t = p.extract.replace(/\s+/g, " ");
console.log("status", r.status, "title", p.title, "len", t.length);
console.log("LEAD ::", t.slice(0, 900));
for (const k of ["security camera", "dashcam", "dash cam", "night", "computer vision", "video", "radar", "automotive", "semiconductor", "image"]) {
  const re = new RegExp(k, "gi"); let m, n = 0;
  while ((m = re.exec(t)) && n < 2) { console.log(k, "::", t.slice(Math.max(0, m.index - 150), m.index + 200)); n++; }
}
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|jaguar|leopard|mascot|pet|pets)\b/gi) || []).join(","));
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["AMBAHqGPjjtJaHPPSuvPu2mPCJdkGZpmhHQa5pkXbxrM", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
console.log("owner", v?.owner);
for (const e of info?.extensions ?? []) console.log("ext", e.extension, e.extension === "tokenMetadata" ? JSON.stringify({ name: e.state.name, symbol: e.state.symbol }) : JSON.stringify(e.state));
console.log("hasTransferFee", (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig"), "freezeAuthority", info?.freezeAuthority, "decimals", info?.decimals);
