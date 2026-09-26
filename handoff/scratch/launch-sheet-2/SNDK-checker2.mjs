const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const c = {name:"Keepsake the Silver-Tipped Cat",ticker:"KEEPSAKE",blurb:"Keepsake, a silver-tipped white longhair with dark-rimmed eyes, naps on a red blanket by the lamp and remembers every lap she knows."};
const stockTerms = { stock: ["SNDK","SNDKx","Sandisk","SanDisk","Sandisk Corporation","Sand","Disk","Backpack","Backpack Securities","Sunrise","Wormhole","Extreme","Extreme Portable","Ultra","iXpand","Memory Man","Memory Zone","Space to Hold More","More More More","CALLEN","Liz","Pokemon","Mew","Mewtwo","David Goeckeler","Goeckeler","Western Digital","WD","My Passport","Kioxia","Maneki","maneki-neko","Snowball","Snowbell"] };
console.log("checkTerms name/symbol/blurb:", JSON.stringify(R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms)));
console.log("checkProposal:", JSON.stringify(R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb })));
for (const q of ["KEEPSAKE","keepsake"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const j = await r.json(); const arr = Array.isArray(j)?j:(j.tokens??[]);
  console.log("jup", q, r.status, arr.length, JSON.stringify(arr.slice(0,5).map(t=>[t.symbol,t.name,t.isVerified])));
}
const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH", { encoding: "jsonParsed" }] }) });
const j = await r.json(); const v = j?.result?.value; const p = v?.data?.parsed?.info;
console.log("owner", v?.owner, "extensions", JSON.stringify((p?.extensions??[]).map(e=>e.extension)));
const tf = (p?.extensions??[]).find(e=>e.extension==="transferFeeConfig"); console.log("transferFeeConfig", JSON.stringify(tf ?? null));
const pz = (p?.extensions??[]).find(e=>e.extension==="pausableConfig"); console.log("pausable", JSON.stringify(pz?.state ?? null));
const th = (p?.extensions??[]).find(e=>e.extension==="transferHook"); console.log("transferHook", JSON.stringify(th?.state ?? null));
const pd = (p?.extensions??[]).find(e=>e.extension==="permanentDelegate"); console.log("permanentDelegate", JSON.stringify(pd?.state ?? null));
const ds = (p?.extensions??[]).find(e=>e.extension==="defaultAccountState"); console.log("defaultAccountState", JSON.stringify(ds?.state ?? null));
