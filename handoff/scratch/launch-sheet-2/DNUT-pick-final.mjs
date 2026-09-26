const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DNUT. Not affiliated with Krispy Kreme, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DNUT", "DNUTx", "KKD", "Krispy Kreme", "Krispy", "Kreme", "Skreme", "Krispy Skreme", "Krispy Kreme Doughnuts", "Original Glazed", "Hot Now", "Hot Light",
  "Doughnut Theatre", "Insomnia", "Insomnia Cookies", "Abra Cat Dabra", "Abra", "Dabra", "Scaredy Cat", "Scaredy", "Black Cat Choco", "Choco", "Enchanted Cauldron", "Bewitched Broomstick",
  "Spooky Sprinkle", "Haunted House", "Boo Batter", "Spooky Spider", "Hello Kitty", "Sanrio", "Kuromi", "Cinnamoroll", "Pochacco", "My Melody", "Pompompurin",
  "Cringer", "Battle Cat", "He-Man", "He Man", "Masters of the Universe", "Grayskull", "Skeletor", "Pokemon", "Meowth", "Pikachu", "Jigglypuff", "Charmander",
  "Kit Kat", "KitKat", "Charlesworth", "Josh Charlesworth", "Alison Holder", "Holder", "Vernon Rudolph", "Rudolph", "JAB", "Donut", "Doughnut", "Doughnuts",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Mister Donut", "Black Thunder Cat", "Lucky Friday"] };
const c = { name:"Sugarsoot the Sparkle-Black Cat", ticker:"SUGARSOOT",
  blurb:"Sugarsoot, a sleek black cat whose coat glints like sugar in the sun, with lime-green eyes and a white muzzle, sniffs the sweet morning air.",
  look:"A normal four-legged short-haired house cat with a black coat that glints like sugar crystals in sunlight, lime-green eyes and a small white muzzle. It wears nothing." };
const desc = `${c.blurb} ${DISC}`;
const o = { name:c.name, ticker:c.ticker, nameLen:c.name.length, blurbLen:c.blurb.length, descLen:desc.length, tickerFormat:R.TICKER.test(c.ticker), endsWithDisclosure:desc.endsWith(DISC) };
o.checkProposal_blurb = R.checkProposal({ name:c.name, symbol:c.ticker, tagline:c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name:c.name, symbol:c.ticker, tagline:desc });
o.checkFields_description = R.checkFields({ description:desc });
o.checkFields_blurb_look = R.checkFields({ blurb:c.blurb, look:c.look });
o.checkTerms_stock = R.checkTerms({ name:c.name, symbol:c.ticker, tagline:c.blurb, look:c.look }, stockTerms);
o.displaySafe = R.displaySafe({ name:c.name, symbol:c.ticker });
for (const q of ["SUGARSOOT", "Sugarsoot"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const j = await r.json(); const arr = Array.isArray(j) ? j : [];
  o["jup_"+q] = { status:r.status, results: arr.map(t => ({ symbol:t.symbol, name:t.name, isVerified:t.isVerified })), exactSymbol: arr.filter(t => String(t.symbol).toUpperCase()==="SUGARSOOT").length };
}
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ jsonrpc:"2.0", id:1, method:"getAccountInfo", params:["DNUTsCvKbKwu2RM72cUuW3TD9YpzArzACcqYQssjPLSk", { encoding:"jsonParsed" }] }) });
const info = (await rpc.json()).result.value; const p = info.data.parsed.info;
o.mint = { owner: info.owner, extensions: p.extensions.map(e => e.extension), hasTransferFeeConfig: p.extensions.some(e => e.extension === "transferFeeConfig"),
  paused: p.extensions.find(e => e.extension === "pausableConfig")?.state?.paused, freezeAuthority: p.freezeAuthority, mintAuthority: p.mintAuthority, decimals: p.decimals };
o.description = desc;
console.log(JSON.stringify(o, null, 1));
