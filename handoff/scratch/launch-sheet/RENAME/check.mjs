import fs from "node:fs";
const rules = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const D=new URL(".",import.meta.url).pathname;
const plan=JSON.parse(fs.readFileSync(D+"plan.json"));
const sheet=JSON.parse(fs.readFileSync(D+"../launch-sheet.json"));
const out={};
for(const [x,p] of Object.entries(plan)){
  const c=sheet.find(s=>s.xstock===x);
  const trib=`Fan tribute to ${p.company}'s cat. Not affiliated with or endorsed by ${p.company}.`;
  const description=`${p.story} ${trib} ${c.disclosure}`;
  out[x]={description,lengths:{name:p.name.length,ticker:p.ticker.length,description:description.length,story:p.story.length},
   checkProposal:rules.checkProposal({name:p.name,symbol:p.ticker,tagline:p.story}),
   displaySafe:rules.displaySafe({name:p.name,symbol:p.ticker}),
   checkFields_story_look:rules.checkFields({name:p.name,symbol:p.ticker,story:p.story,look:c.look}),
   checkFields_fullDescription:rules.checkFields({description}),
   checkFields_tributeAndDisclosure:rules.checkFields({description:`${trib} ${c.disclosure}`})};
}
console.log(JSON.stringify(out,null,1));
