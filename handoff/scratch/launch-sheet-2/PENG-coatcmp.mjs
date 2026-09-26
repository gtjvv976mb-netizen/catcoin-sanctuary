import fs from "node:fs";
const dir = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/";
const coats = [];
const walk = (o, src) => { if (!o || typeof o !== "object") return; if (o.coat && o.coat.base) coats.push({ src, name: o.name, ticker: o.ticker, ...o.coat }); for (const v of Object.values(o)) walk(v, src); };
walk(JSON.parse(fs.readFileSync(dir + "launch-sheet/launch-sheet.json", "utf8")), "xstocks");
for (const f of fs.readdirSync(dir + "launch-sheet-2").filter(f => f.endsWith("-pick.json"))) { try { walk(JSON.parse(fs.readFileSync(dir + "launch-sheet-2/" + f, "utf8")), f.replace("-pick.json", "")); } catch {} }
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const d = (a, b) => { const [x, y] = [hex(a), hex(b)]; return Math.round(Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])); };
const seen = new Set(); const uniq = coats.filter(c => { const k = c.src + c.ticker; if (seen.has(k)) return false; seen.add(k); return true; });
console.log("coats:", uniq.length);
for (const cand of [{ name: "Whirr", base: "#6E7B8B", second: "#56626F", pattern: "solid", eyes: "#3FD16A" }, { name: "Cache", base: "#B9BEC4", second: "#3A3D42", pattern: "tabby", eyes: "#C8733A" }, { name: "Porchlight(white)", base: "#F7F5EF", second: "#E6DFCF", pattern: "solid", eyes: "#E8C45A" }]) {
  const near = uniq.map(c => ({ src: c.src, name: c.name, pat: c.pattern, base: c.base, second: c.second, eyes: c.eyes, dBase: d(cand.base, c.base), dSecond: d(cand.second, c.second), dEyes: d(cand.eyes, c.eyes) })).sort((a, b) => a.dBase - b.dBase).slice(0, 5);
  console.log("\n==", cand.name, cand.pattern); for (const n of near) console.log(JSON.stringify(n));
}
