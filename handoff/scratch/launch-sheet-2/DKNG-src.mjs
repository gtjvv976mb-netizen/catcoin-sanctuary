const u = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=DraftKings&redirects=1";
const r = await fetch(u, { headers: { "user-agent": "cat-sanctuary-research/1.0 (research script)" } });
const j = await r.json();
const p = Object.values(j.query.pages)[0];
const t = p.extract.replace(/\s+/g, " ");
console.log("status", r.status, "title", p.title, "len", t.length);
console.log("LEAD ::", t.slice(0, 900));
for (const k of ["fantasy", "sportsbook", "sports betting", "casino", "lottery", "Jackpocket", "roulette", "logo", "crown", "Predictions"]) {
  const re = new RegExp(k, "gi"); let m, n = 0;
  while ((m = re.exec(t)) && n < 2) { console.log(k, "::", t.slice(Math.max(0, m.index - 150), m.index + 220)); n++; }
}
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|jaguar|mascot)\b/gi) || []).join(","));
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json();
const v = jj?.result?.value; const info = v?.data?.parsed?.info;
console.log("\nMINT owner", v?.owner);
for (const e of info?.extensions ?? []) console.log(e.extension, JSON.stringify(e.extension === "tokenMetadata" ? { name: e.state?.name, symbol: e.state?.symbol } : e.state));
console.log("freezeAuthority", info?.freezeAuthority, "mintAuthority", info?.mintAuthority, "decimals", info?.decimals);
