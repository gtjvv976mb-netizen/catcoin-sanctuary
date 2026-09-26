const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const PAIRS = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/stockcats/stonkfun-pairs.json";
const DISC = "A cat coin priced in DELL. Not affiliated with Dell Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DELL","Dell","Dell Technologies","Dell Technologies Inc","Dell Inc","PCs Limited","Michael Dell","Michael","Susan Dell","Jeff Clarke","Round Rock",
  "EMC","VMware","Alienware","XPS","Inspiron","Latitude","Vostro","OptiPlex","Precision","PowerEdge","PowerStore","PowerScale","Wyse","Dell Pro","Dell Premium",
  "Dude","Dell Dude","Ben Curtis","Steven","Reallusion","Live Cam Avatar","Live Cam","Cam Avatar","Avatar","Webcam Central","Webcam","Rod Ponton","Ponton","lawyer",
  "not a cat","I'm not a cat","Zoom","Skype","filter","ChemBark","sad kitten","Backpack","Backpack Securities","Sunrise","Wormhole","Texas","court","attorney"] };
const coins = [
  { id: "coin1-draft", name: "Frostpuff the Fold-Eared Cat", ticker: "FROSTPUFF",
    blurb: "Frostpuff, a fluffy white cat with faint silver brow stripes, folded ears, a pink nose and big teal eyes, peeks out from the garden hedge.",
    look: "Follows the coat of the white kitten avatar in the BBC screenshot, in plain words: fluffy white, faint silver-grey forehead stripes, small folded ears, teal eyes, pink nose. A normal four-legged cat that wears nothing." },
  { id: "coin1-fixed", name: "Frostpuff the Fold-Eared Cat", ticker: "FROSTPUFF",
    blurb: "Frostpuff, a fluffy white cat with faint silver brow stripes, folded ears, a pink nose and big grey-green eyes, peeks from the garden hedge.",
    look: "A normal four-legged, fluffy house cat that wears nothing: a white coat with faint silver-grey tabby stripes on the brow, small folded-down ears, grey-green eyes and a pink nose." },
  { id: "coin2", name: "Lidnap the Gunmetal Cat", ticker: "LIDNAP",
    blurb: "Lidnap, a sleek gunmetal-grey shorthair with a silver bib and pale blue eyes, folds flat as a closed laptop lid on the warm garden bench.",
    look: "From the business (laptops and PCs), with no brands: a sleek gunmetal-grey shorthair with a silver chest, like a metal laptop lid. A normal four-legged cat that wears nothing." },
  { id: "coin3", name: "Whirr the Smoke-Black Cat", ticker: "WHIRR",
    blurb: "Whirr, a lean smoke-black shorthair with ice-blue eyes, purrs like a soft cooling fan while napping on the sunny stone wall by the shed.",
    look: "From the business (servers and data-center hardware), with no brands: a lean smoke-black cat with a grey undercoat and ice-blue eyes, like a dark server rack with blue status lights. A normal four-legged cat that wears nothing." },
];
const memeBlock = new Set(["POPCAT","MEW","MICHI","MOG","NUB","GRUMPY","NYAN","NYANCAT","KITTY","CAT","CATS","KITTEN","MANEKI","MANEKINEKO","WIF","CATWIF","CATWIFHAT","MEOW","PURR","TABBY","SIMON","SIMONSCAT","GIKO","SMOL","LILBUB","MARU","HOBBES","BONGO","BONGOCAT","BINGUS","FLOPPA","MAXWELL","OIIA","OIIAOIIA","SCHRODI","CATGIRL","PUSS","KEYBOARD","SNOWBALL","GARFIELD","PUSHEEN","TOM","FELIX","MOCHI","LAWYERCAT","NOTACAT","IMNOTACAT","ZOOMCAT","CATLAWYER","HUHCAT","SMUDGE","POPDOG","MIHARU","NEKO","KITTEH","GME CAT","PAJAMAS","HAPPYCAT","BANANACAT","BILLY"]);
async function jup(q) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []); return { status: r.status, arr };
}
const out = { checkedAt: new Date().toISOString(), disclaimer: DISC, disclaimerOnly: R.checkFields({ description: DISC }), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { id: c.id, name: c.name, ticker: c.ticker, description: desc,
    lengths: { name: c.name.length, blurb: c.blurb.length, description: desc.length },
    withinLimits: c.name.length <= 32 && desc.length <= 280, endsWithDisclaimer: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /DELL|DEL/.test(c.ticker), catMemeBlocklist: memeBlock.has(c.ticker) };
  o.checkProposal_nameTickerBlurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_look = R.checkFields({ look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const t = await jup(c.ticker);
  const sm = t.arr.filter((x) => String(x.symbol).toUpperCase() === c.ticker);
  o.jupiter = { status: t.status, results: t.arr.length, symbolMatches: sm.map((x) => ({ name: x.name, id: x.id, isVerified: x.isVerified })), verifiedMatch: sm.some((x) => x.isVerified === true) };
  const nm = c.name.split(" ")[0];
  const n = await jup(nm);
  o.jupiterNameWord = { query: nm, status: n.status, results: n.arr.length, hits: n.arr.slice(0, 8).map((x) => `${x.symbol} | ${x.name} | verified=${x.isVerified}`) };
  out.coins.push(o);
}
out.pair = JSON.parse(fs.readFileSync(PAIRS, "utf8")).data.pairs.filter((p) => p.symbol === "DELL");
try {
  const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["DELL2aRKQz7DMq5DrKLtkn47ZCnbxXPZXrSGbkmd13wy", { encoding: "jsonParsed" }] }) });
  const j = await r.json(); const v = j.result?.value;
  out.rpc = { status: r.status, owner: v?.owner, type: v?.data?.parsed?.type,
    extensions: (v?.data?.parsed?.info?.extensions ?? []).map((e) => e.extension),
    transferFeeConfig: (v?.data?.parsed?.info?.extensions ?? []).some((e) => e.extension === "transferFeeConfig"),
    paused: (v?.data?.parsed?.info?.extensions ?? []).find((e) => e.extension === "pausableConfig")?.state?.paused,
    permanentDelegate: (v?.data?.parsed?.info?.extensions ?? []).find((e) => e.extension === "permanentDelegate")?.state?.delegate,
    transferHookProgram: (v?.data?.parsed?.info?.extensions ?? []).find((e) => e.extension === "transferHook")?.state?.programId ?? null,
    mintAuthority: v?.data?.parsed?.info?.mintAuthority, freezeAuthority: v?.data?.parsed?.info?.freezeAuthority };
} catch (e) { out.rpc = { error: String(e) }; }
console.log(JSON.stringify(out, null, 1));
