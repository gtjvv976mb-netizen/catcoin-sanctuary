const H = { headers: { "user-agent": "CatSanctuaryResearch/1.0 (brand-safety check; contact via github)" } };
let t = "";
for (const u of ["https://en.wikipedia.org/w/index.php?title=Moderna&action=raw", "https://en.wikipedia.org/api/rest_v1/page/html/Moderna"]) {
  const r = await fetch(u, H); const b = await r.text(); console.log(u, r.status, b.length);
  if (r.ok && b.length > 5000) { t = b.replace(/<[^>]+>/g, " "); break; }
}
if (t) {
  for (const re of [/[^.\n]*messenger RNA[^.\n]*\./gi, /[^.\n]*lipid nanoparticle[^.\n]*\./gi, /[^.\n]*(freez|frozen|°C|ultra-cold)[^.\n]*\./gi, /[^.\n]*\b(cat|cats|kitten|feline|mascot)\b[^.\n]*\./gi]) {
    const m = [...t.matchAll(re)].slice(0, 3).map(x => x[0].trim().slice(0, 300)); console.log(String(re), m.length, JSON.stringify(m, null, 1));
  }
}
const mint="MRNAzXzhNcaEXJPibHEn8cd4vyekCDiivTyEwswLUCT";
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
const k = await rpc.json(); const p = k?.result?.value?.data?.parsed?.info;
console.log(JSON.stringify({ owner: k?.result?.value?.owner, decimals:p?.decimals, extensions: (p?.extensions ?? []).map(e => ({ extension: e.extension, state: ["transferFeeConfig","transferHook","scaledUiAmountConfig","pausableConfig","permanentDelegate","defaultAccountState"].includes(e.extension) ? e.state : undefined })) }));
