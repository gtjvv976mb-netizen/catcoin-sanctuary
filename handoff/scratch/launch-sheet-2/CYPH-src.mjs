const u = "https://www.prnewswire.com/news-releases/leap-therapeutics-rebrands-as-cypherpunk-expands-leadership-team-to-drive-new-zcash-treasury-strategy-302612466.html";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research script)" } });
const h = await r.text();
const t = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
console.log("status", r.status, "len", t.length);
const i = t.search(/Leap Therapeutics, Inc\.|rebrand/i);
console.log("LEAD ::", t.slice(Math.max(0, i - 100), i + 1200));
for (const k of ["privacy", "treasury", "Zcash", "encrypt", "digital cash", "shielded"]) {
  const re = new RegExp(k, "gi"); let m, n = 0;
  while ((m = re.exec(t)) && n < 2) { console.log(k, "::", t.slice(Math.max(0, m.index - 150), m.index + 220)); n++; }
}
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|jaguar|leopard|mascot|pet|pets)\b/gi) || []).join(","));
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["CYPHuMmCL1GxJWa2tsPhLKykC7GrHJTCHwbXD4g5uawK", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
console.log("owner", v?.owner);
for (const e of info?.extensions ?? []) console.log("ext", e.extension, e.extension === "tokenMetadata" ? JSON.stringify({ name: e.state.name, symbol: e.state.symbol }) : JSON.stringify(e.state));
console.log("hasTransferFee", (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig"), "freezeAuthority", info?.freezeAuthority, "decimals", info?.decimals);
