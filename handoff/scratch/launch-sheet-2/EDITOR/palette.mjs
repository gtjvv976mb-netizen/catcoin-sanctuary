import fs from "node:fs";
const NAMED={white:"#f7f3ec",black:"#1d1a1c",ginger:"#e0823a",orange:"#e0823a",cream:"#f1dcc0",grey:"#9a9aa2",gray:"#9a9aa2",silver:"#c9cbd0",blue:"#7f8aa0",brown:"#6b4a33",chocolate:"#5a3a28",lilac:"#b8aab4",fawn:"#d6b995",cinnamon:"#b9764a",golden:"#d9a64e",tan:"#c49a6c",smoke:"#6f6c77",seal:"#4a3527",caramel:"#c48a4f",amber:"#e0a030"};
const XC={SNOWCURL:["#f4f4f2","","solid"],SOCKFOOT:["#5c5e63","#f4f2ee","tabby"],HALFSMILE:["#9a9aa2","#f7f3ec","bicolor"],COUCHCAP:["#7a5a3e","#f4efe6","tabby"],HARRUMPH:["#8a8580","","solid"],PEWTER:["#c9cbd0","#6f7278","tabby"],WARMSPOT:["#1d1a1c","#f7f3ec","tuxedo"],MOATCAT:["#f7f3ec","#e0823a","calico"]};
const P=JSON.parse(fs.readFileSync("/home/user/cat-sanctuary/data/planned.json")).cats;
const X=JSON.parse(fs.readFileSync("../../launch-sheet/launch-sheet.json"));
const hex=v=>v&&v.startsWith("#")?v:NAMED[v]||"";
const rows=[];
for(const r of X){const p=P.find(c=>c.ticker===r.ticker); let c=p?[hex(p.coat.base),hex(p.coat.second),p.coat.pattern.replace("bicolour","bicolor")]:XC[r.ticker]; rows.push(["X",r.ticker,...c]);}
const B=JSON.parse(fs.readFileSync(process.argv[2]||"base.json"));
for(const [k,n,t,d,l,c] of B) rows.push(["B",k+"/"+t,c[0],c[1],c[2]]);
const hsl=h=>{const r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let H=0,S=0,L=(mx+mn)/2;if(mx!==mn){const d=mx-mn;S=L>0.5?d/(2-mx-mn):d/(mx+mn);H=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;H*=60;}return [Math.round(H),+S.toFixed(2),+L.toFixed(2)];};
const fam=h=>{const [H,S,L]=hsl(h);if(L<0.2)return "black";if(L>0.88&&S<0.5)return "white";if(S<0.15)return L<0.45?"darkgrey":"grey";if(H<25)return L<0.4?"brown":"red";if(H<45)return L<0.35?"brown":L>0.75?"cream":S>0.5&&L<0.65?"ginger":"tan";if(H<70)return L>0.75?"cream":"gold";return S<0.3?(H>180?"bluegrey":"greengrey"):"other";};
rows.forEach(r=>r.push(fam(r[2])));
rows.sort((a,b)=>(a[4]+a[5]).localeCompare(b[4]+b[5]));
for(const r of rows) console.log(r[4].padEnd(8),r[5].padEnd(9),r[0],r[1].padEnd(24),r[2],r[3],hsl(r[2]).join(","));
const cnt={};rows.forEach(r=>{const k=r[4]+"/"+r[5];cnt[k]=(cnt[k]||0)+1});console.log(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(e=>e.join(":")).join("  "));
