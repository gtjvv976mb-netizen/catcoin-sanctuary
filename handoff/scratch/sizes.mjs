import fs from "node:fs"; import path from "node:path";
const ROOT="/home/user/cat-sanctuary";
const seen=new Set(),todo=["assets/ui/main.js"];
const res=(s,from)=>{ if(s==="three")return "assets/vendor/three/three.module.min.js"; if(s.startsWith("three/addons/"))return "assets/vendor/three/addons/"+s.slice(13); return path.posix.normalize(path.posix.join(path.posix.dirname(from),s));};
while(todo.length){const r=todo.pop(); if(seen.has(r))continue; seen.add(r); const t=fs.readFileSync(path.join(ROOT,r),"utf8");
 for(const m of [...t.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*["']([^"']+)["']/g),...t.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)]) todo.push(res(m[1],r));}
let v=0,o=0; for(const f of seen){const s=fs.statSync(path.join(ROOT,f)).size; if(f.includes("vendor"))v+=s; else if(/^assets\/(ui|world)\/|residents|collection/.test(f)) o+=s;}
console.log("vendor",v,"own",o, "own budget", 480*1024);
