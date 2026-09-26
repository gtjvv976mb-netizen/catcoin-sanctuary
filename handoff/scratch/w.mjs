import fs from "node:fs";
const r=(f)=>fs.readFileSync(f,"utf8");
const seen=new Set(),todo=["assets/ui/main.js"];
import path from "node:path";
while(todo.length){const f=todo.pop(); if(seen.has(f))continue; seen.add(f); const t=r(f);
for(const m of t.matchAll(/(?:from\s*|import\s*\(?\s*)["'](\.[^"']+)["']/g)){todo.push(path.posix.normalize(path.posix.join(path.posix.dirname(f),m[1])));}}
let n=0;for(const f of seen){if(/^assets\/(ui|world)\/|^assets\/(residents|collection)\.js$/.test(f))n+=fs.statSync(f).size}
console.log(n/1024, 652);
