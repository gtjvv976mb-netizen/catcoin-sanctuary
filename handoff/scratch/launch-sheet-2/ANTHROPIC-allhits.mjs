import fs from "node:fs";
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DIR = `${SP}/launch-sheet-2`;
const R = "/home/user/Cat-Intelligence-Agency";
const { checkTerms, normalize } = await import(`${R}/bots/lib/content-rules.mjs`);
const S = await import(`${R}/src/lib/stockcats.mjs`);
const { ROWS, notesFor } = await import(`${SP}/launch-sheet/EDITOR/rows.mjs`);
const notes = notesFor(S.STOCK_PAIRS);
const src = new Map();
for (const p of S.STOCK_PAIRS) for (const t of [...S.pairTerms(p, notes)]) src.set(t, (src.get(t) ?? "") + ` ${p.symbol}(row)`);
for (const p of S.STOCK_PAIRS) for (const t of ROWS[p.symbol]?.extra ?? []) src.set(t, (src.get(t) ?? "") + ` ${p.symbol}(extra)`);
for (const f of fs.readdirSync(DIR).filter((f) => /^[A-Z0-9]+-(pick-)?check\.mjs$/.test(f) && !f.startsWith("ANTHROPIC"))) {
  const m = fs.readFileSync(`${DIR}/${f}`, "utf8").match(/stock(?:Terms)?\s*[:=]\s*(?:\{\s*stock:\s*)?(\[[^\]]*\])/);
  if (!m) continue;
  try { for (const t of Function(`return ${m[1]}`)()) src.set(t, (src.get(t) ?? "") + ` ${f.replace(/-.*/, "")}`); } catch {}
}
const texts = JSON.parse(process.argv[2]);
for (const [k, t] of Object.entries(texts)) {
  const hits = [];
  for (const [term, from] of src) if (!checkTerms({ x: t }, { o: [term] }).ok) hits.push(`${term} <-${from}`);
  console.log(k, JSON.stringify(hits));
}
