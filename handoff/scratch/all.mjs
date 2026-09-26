import {listCats,draft,weightedLength} from "/home/user/cat-sanctuary/scripts/announce.mjs";
import fs from "node:fs";
const p=JSON.parse(fs.readFileSync("/home/user/cat-sanctuary/data/planned.json"));
let bad=0,max=0;for(const c of listCats(p)){const d=draft(c);if(!d.ok){bad++;console.log("HELD",c.key,JSON.stringify(d.violations))}else{max=Math.max(max,...d.posts.map(x=>weightedLength(x.text)));if(!d.posts[0].text.includes(c.story.split(".")[0].slice(0,20)))console.log("NOLORE",c.key)}}
console.log({bad,max});
for(const k of ["PATCHPAW","WHISK100","CHIK"]){const c=listCats(p).find(x=>x.key===k);if(c)console.log("----",JSON.stringify(draft(c).posts.map(x=>x.text),null,1))}
