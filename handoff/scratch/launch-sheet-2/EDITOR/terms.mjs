import fs from "node:fs";
const DIR = "..";
export function ownTermsFor(K) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(K + "-") && f.endsWith(".mjs"));
  const out = new Set();
  for (const f of files) {
    const src = fs.readFileSync(`${DIR}/${f}`, "utf8");
    for (const m of src.matchAll(/\b(?:own|ownTerms|stock|stockTerms|STOCK_TERMS|STOCK|TERMS|terms|stockWords|STOCKTERMS)\s*[:=]\s*(\[[^\]]*\])/g)) {
      try { const arr = Function(`return ${m[1]}`)(); if (Array.isArray(arr)) for (const t of arr) if (typeof t === "string" && t.trim()) out.add(t); } catch {}
    }
  }
  return [...out];
}
if (process.argv[2] === "report") {
  const B = JSON.parse(fs.readFileSync("base.json"));
  for (const [k] of B) { const t = ownTermsFor(k); console.log(k, t.length, t.slice(0, 8).join("|")); }
}
