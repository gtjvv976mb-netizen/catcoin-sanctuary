const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Eli_Lilly_and_Company&format=json&redirects=1", {headers:{"user-agent":"research-bot/1.0"}});
const j = await r.json(); const p = Object.values(j.query.pages)[0];
const t = p.extract;
console.log("status", r.status, "title", p.title, "len", t.length);
console.log(t.slice(0, 1500));
for (const k of ["cat","feline","mascot","logo","lion","tiger","Elanco","insulin","pharmacist","red","color","colour"]) {
  const re = new RegExp("\\b"+k+"\\b","gi"); const m=[...t.matchAll(re)];
  console.log("\n##", k, m.length); for (const x of m.slice(0,3)) console.log("  ..."+t.slice(Math.max(0,x.index-120), x.index+160).replace(/\n/g," ")+"...");
}
const rpc = await fetch("https://api.mainnet-beta.solana.com", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["LLYuwZ33keFihgwoxXsBawy31AiRFLFSva32TYq5TvD",{encoding:"jsonParsed"}]})});
const rj = await rpc.json();
console.log("\nRPC", rpc.status, JSON.stringify(rj?.result?.value?.data?.parsed?.info?.extensions ?? rj, null, 1).slice(0, 3000));
