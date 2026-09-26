const u = "https://newsroom.snap.com/wallis-annenberg-wildlife-crossing-lens";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research script)" } });
const h = await r.text();
const t = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&rsquo;|&#8217;/g, "'").replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"').replace(/\s+/g, " ");
console.log("status", r.status, "len", t.length);
const title = (h.match(/<title>([^<]*)<\/title>/i) || [])[1]; console.log("TITLE ::", title);
for (const k of ["mountain lion", "P-22", "tawny", "coat", "October", "2022", "Lens"]) {
  const re = new RegExp(k, "gi"); let m, n = 0;
  while ((m = re.exec(t)) && n < 3) { console.log(k, "::", t.slice(Math.max(0, m.index - 200), m.index + 250)); n++; }
}
const imgs = [...h.matchAll(/(?:src|content)="(https?:[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi)].map(m => m[1]);
console.log("IMGS", [...new Set(imgs)].slice(0, 15).join("\n"));
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["SNAPcESrvnH8yUdgeMF6xm1hym9b6hW6s8YeqeHdZFz", { encoding: "jsonParsed" }] }) });
const j = await rpc.json(); const info = j.result.value.data.parsed.info;
console.log("owner", j.result.value.owner);
for (const e of info.extensions) if (e.extension !== "tokenMetadata") console.log(e.extension, JSON.stringify(e.state));
const md = info.extensions.find(e=>e.extension==="tokenMetadata")?.state;
console.log("tokenMetadata", JSON.stringify({ name: md?.name, symbol: md?.symbol }));
console.log("freezeAuthority", info.freezeAuthority, "mintAuthority", info.mintAuthority, "decimals", info.decimals);
