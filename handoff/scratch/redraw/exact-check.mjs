import fs from "node:fs";
const R = "/home/user/Cat-Intelligence-Agency";
const rules = await import(`${R}/bots/lib/content-rules.mjs`);
const S = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
const T = ["HARRUMPH","PEWTER","SNOWCURL","MOATCAT","COUCHCAP","WARMSPOT","SOCKFOOT","HALFSMILE"];
const sheet = JSON.parse(fs.readFileSync(`${S}/launch-sheet.json`, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url){ for (let i=0;i<3;i++){ try{ const r=await fetch(url,{signal:AbortSignal.timeout(45000)}); const t=await r.text(); if(r.ok) return {status:r.status, body:JSON.parse(t)}; if(r.status!==429) return {status:r.status}; }catch(e){} await sleep(2000);} return {status:0}; }
const control = await get("https://www.stonkfun.xyz/api/public/v1/tokens?q=AGI");
const controlOk = (control.body?.data?.tokens??[]).some(t=>String(t.symbol).toUpperCase()==="AGI");
const out = { checkedAt: new Date().toISOString(), stonkfunControlAGI: controlOk, cats: {} };
for (const t of T) {
  const e = sheet.find(x=>x.ticker===t);
  const story = e.story, disc = e.disclosure;
  const r = {
    lengths: { name: e.name.length, ticker: t.length, description: e.description.length, story: story.length },
    endsWithDisclosure: e.description.endsWith(disc), hasTribute: e.description.includes(e.tribute),
    checkProposal: rules.checkProposal({ name: e.name, symbol: t, tagline: story }),
    displaySafe: rules.displaySafe({ name: e.name, symbol: t }),
    checkFields_name_symbol_story_look: rules.checkFields({ name: e.name, symbol: t, story, look: e.look }),
    checkFields_fullDescription: rules.checkFields({ description: e.description }),
    checkFields_disclosureOnly: rules.checkFields({ description: e.tribute + " " + disc }),
  };
  r.descriptionViolationsAllFromDisclosure = JSON.stringify(r.checkFields_fullDescription.violations)===JSON.stringify(r.checkFields_disclosureOnly.violations);
  const j = await get(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`); const jl = Array.isArray(j.body)?j.body:[];
  const same = jl.filter(x=>String(x.symbol).toUpperCase()===t);
  r.jupiter = { status: j.status, results: jl.length, sameSymbol: same.length, verifiedSameSymbol: same.filter(x=>x.isVerified).length };
  const sf = await get(`https://www.stonkfun.xyz/api/public/v1/tokens?q=${t}`);
  const sn = await get(`https://www.stonkfun.xyz/api/public/v1/tokens?q=${encodeURIComponent(e.name)}`);
  r.stonkfun = { status: sf.status, sameSymbol: (sf.body?.data?.tokens??[]).filter(x=>String(x.symbol).toUpperCase()===t).length, nameStatus: sn.status, sameName: (sn.body?.data?.tokens??[]).filter(x=>String(x.name).trim().toLowerCase()===e.name.toLowerCase()).length };
  out.cats[t]=r; await sleep(800);
}
fs.writeFileSync("exact-check.out.json", JSON.stringify(out,null,1));
for (const [t,r] of Object.entries(out.cats)) console.log(t, JSON.stringify(r.lengths), r.endsWithDisclosure, r.checkProposal.ok, r.displaySafe.ok, JSON.stringify(r.checkFields_name_symbol_story_look.violations), r.descriptionViolationsAllFromDisclosure, JSON.stringify(r.checkFields_fullDescription.violations.map(v=>v.rule+':'+v.term)), JSON.stringify(r.jupiter), JSON.stringify(r.stonkfun));
console.log("control", controlOk);
