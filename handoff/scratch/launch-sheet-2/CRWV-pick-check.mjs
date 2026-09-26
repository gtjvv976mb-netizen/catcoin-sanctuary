import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const D = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DISC = "A cat coin priced in CRWV. Not affiliated with CoreWeave, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const drafts = JSON.parse(fs.readFileSync(`${D}/launch-sheet-2/CRWV-coins.json`, "utf8"));
const fixed = { name: "Cabletail the Charcoal Tabby", ticker: "CABLETAIL",
  blurb: "Cabletail, a lean charcoal tabby whose bold black stripes run like bundled cables down to a ringed tail, threads through the flower beds and never gets tangled.",
  coat: { base: "#5E636A", second: "#16181B", pattern: "tabby", eyes: "#DDA23C" } };
const stockTerms = { stock: ["CRWV","CoreWeave","Core Weave","Coreweave Inc","Core","Weave","Weaver","Atlantic Crypto","Atlantic","Michael Intrator","Intrator","Michael","Brian Venturo","Venturo","Brannin McBee","Brannin","McBee","Peter Salanki","Salanki","Nvidia","H100","H200","GB200","Blackwell","Hopper","Weights & Biases","Weights","Biases","W&B","wandb","Marimo","OpenPipe","Monolith","Conductor","Aston Martin","Aramco","Livingston","Plano","Magnetar","Blackstone","Coatue","OpenAI","Microsoft","Backpack","Backpack Securities","Sunrise","Wormhole","CodeWeavers"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","HOBBES","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","WIF","BONK","SC","CATI","MOTHER","BOOK","KEYCAT","PUSS","BOPCAT","TABBY","CATCOIN","KITTEN","SPOT","ROAR","MIU","SCF","CHEESE","MANEKI","NEKO","LUCE","HAMMY","MANYU"]);
// names/tickers already used in both sheets
const used = [];
for (const r of JSON.parse(fs.readFileSync(`${D}/launch-sheet/launch-sheet.json`, "utf8"))) used.push({ sheet: 1, sym: r.xstock, name: r.name, ticker: r.ticker });
for (const f of fs.readdirSync(`${D}/launch-sheet-2`).filter(f => /-pick\.json$/.test(f) && !f.startsWith("CRWV"))) { try { const r = JSON.parse(fs.readFileSync(`${D}/launch-sheet-2/${f}`, "utf8")); used.push({ sheet: 2, sym: r.symbol, name: r.name, ticker: r.ticker }); } catch {} }
const all = [...drafts.map(c => ({ ...c, which: "draft" })), { ...fixed, which: "FIXED PICK" }];
const out = { disclosure: DISC, disclosureOnly_checkFields: R.checkFields({ description: DISC }), results: [] };
for (const c of all) {
  const desc = `${c.blurb} ${DISC}`;
  const r = { which: c.which, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerRegex: R.TICKER.test(c.ticker), tickerHasStockRoot: /CRWV|CORE|WEAV|CW/.test(c.ticker), catMemeTicker: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith("No intrinsic value; not financial advice."),
    checkProposal_name_symbol_blurb: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
    checkFields_name_symbol_blurb: R.checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb }),
    checkFields_fullDescription: R.checkFields({ description: desc }),
    checkProposal_fullDescriptionAsTagline: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc }),
    checkTerms_stock: R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms),
    displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }),
    sheetClash: used.filter(u => u.ticker === c.ticker || String(u.name).split(" ")[0].toLowerCase() === c.name.split(" ")[0].toLowerCase()),
    description: desc };
  for (const q of [c.ticker, c.name.split(" ")[0]]) {
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      r[`jup_${q}`] = { status: res.status, results: arr.length,
        symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
        verifiedSymbolMatch: arr.some(t => String(t.symbol).toUpperCase() === c.ticker && t.isVerified === true),
        firstFew: arr.slice(0, 6).map(t => `${t.symbol}|${t.name}|v=${t.isVerified}`) };
    } catch (e) { r[`jup_${q}`] = { error: String(e) }; }
  }
  out.results.push(r);
}
out.usedCount = used.length;
console.log(JSON.stringify(out, null, 1));
