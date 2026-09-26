const R = "/home/user/Cat-Intelligence-Agency";
const sc = await import(`${R}/src/lib/stockcats.mjs`);
const { verifiedIndex } = await import(`${R}/bots/cashcat/tickers.mjs`);
const fs = await import("node:fs");
const idx = verifiedIndex(JSON.parse(fs.readFileSync(`${R}/fixtures/bots/jupiter/verified-sample.json`,"utf8")).tokens);
const notes = sc.STOCK_PAIRS.map((p) => ({ mint: p.mint, people: [], mascots: [], brands: [], catFacts: [], searchedAt: "2026-09-25", method: "test" }));
for (const p of sc.STOCK_PAIRS) {
  const s = sc.suggestNames(p, { notes, verifiedIndex: idx, count: 3 });
  console.log(p.symbol, sc.pairTerms(p, notes).join("|"), "=>", s.map((x) => `${x.name}/${x.symbol}`).join(", "));
}
const spy = sc.STOCK_PAIRS[2];
for (const d of [{ name: "SpaceX Cat", symbol: "SPCAT", tagline: "A cat on a sign by the sea." }, { name: "Tesla Cat", symbol: "TSLACAT", tagline: "A cat backed by a stock." }, { name: "Violet Ginger Cat", symbol: "SPYCAT", tagline: "A cat on a violet sign, all day." }])
  console.log(JSON.stringify(sc.stockCatRefusals({ ...d, kitten: "ginger", background: "violet" }, spy, { notes, verifiedIndex: idx }).map((r) => r.message)));
console.log(sc.pairDisclosure(spy));
console.log(JSON.stringify(sc.stockCatRefusals({ name: "Violet Ginger Cat", symbol: "VIOLGIN", tagline: "A ginger cat on a violet sign.", kitten: "ginger", background: "violet" }, spy, { verifiedIndex: idx })));
