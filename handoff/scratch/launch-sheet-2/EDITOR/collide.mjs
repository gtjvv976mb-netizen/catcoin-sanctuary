import fs from "node:fs";
const X = JSON.parse(fs.readFileSync("../../launch-sheet/launch-sheet.json"));
const B = JSON.parse(fs.readFileSync(process.argv[2] || "base.json"));
const all = [...X.map(r => ({set:"X", k:r.stonkfunSymbol, name:r.name, t:r.ticker, story:r.story})),
             ...B.map(([k,name,t,d]) => ({set:"B", k, name, t, story:d.split(" A cat coin priced")[0]}))];
const lev=(a,b)=>{const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=1;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];};
const first = n => n.split(/[\s-]/)[0].toLowerCase().replace(/[^a-z]/g,"");
const out=[];
for (let i=0;i<all.length;i++) for (let j=i+1;j<all.length;j++){
  const a=all[i], b=all[j]; const r=[];
  if (a.t===b.t) r.push("SAME TICKER");
  if (a.t.includes(b.t)||b.t.includes(a.t)) r.push("ticker contains");
  let p=0; while(p<Math.min(a.t.length,b.t.length)&&a.t[p]===b.t[p])p++; if(p>=4) r.push("ticker prefix "+a.t.slice(0,p));
  let s=0; while(s<Math.min(a.t.length,b.t.length)&&a.t[a.t.length-1-s]===b.t[b.t.length-1-s])s++; if(s>=4 && !a.t.endsWith("PAW")) r.push("ticker suffix "+a.t.slice(-s));
  const L=lev(a.t,b.t); if(L<=3 && L/Math.max(a.t.length,b.t.length)<0.45) r.push("ticker lev "+L);
  const fa=first(a.name), fb=first(b.name);
  if (fa===fb) r.push("SAME FIRST NAME "+fa);
  let q=0; while(q<Math.min(fa.length,fb.length)&&fa[q]===fb[q])q++; if(q>=4 && fa!==fb) r.push("name prefix "+fa.slice(0,q));
  if (fa.length>=4 && fb.length>=4 && (fa.includes(fb)||fb.includes(fa)) && fa!==fb) r.push("name contains");
  const Ln=lev(fa,fb); if (fa!==fb && Ln<=3 && Ln/Math.max(fa.length,fb.length)<0.45) r.push("name lev "+Ln);
  // shared distinctive words in names (excluding 'the','cat', colour words)
  const stop=new Set(["the","cat","tabby","kitten","black","white","grey","and"]);
  const wa=new Set(a.name.toLowerCase().split(/[\s-]+/).filter(w=>!stop.has(w))), wb=b.name.toLowerCase().split(/[\s-]+/).filter(w=>!stop.has(w)&&wa.has(w));
  if (wb.length) r.push("shared name word "+wb.join(","));
  if (r.length) out.push(`${a.set}:${a.k} ${a.name}/${a.t}  <>  ${b.set}:${b.k} ${b.name}/${b.t} :: ${r.join("; ")}`);
}
console.log(out.join("\n"));
