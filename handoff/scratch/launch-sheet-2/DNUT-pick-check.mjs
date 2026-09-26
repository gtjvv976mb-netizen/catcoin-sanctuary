import fs from "fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DNUT. Not affiliated with Krispy Kreme, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DNUT", "DNUTx", "KKD", "Krispy Kreme", "Krispy", "Kreme", "Skreme", "Krispy Skreme", "Krispy Kreme Doughnuts", "Original Glazed", "Hot Now", "Hot Light",
  "Doughnut Theatre", "Insomnia", "Insomnia Cookies", "Abra Cat Dabra", "Abra", "Dabra", "Scaredy Cat", "Scaredy", "Black Cat Choco", "Choco", "Enchanted Cauldron", "Bewitched Broomstick",
  "Spooky Sprinkle", "Haunted House", "Boo Batter", "Spooky Spider", "Hello Kitty", "Sanrio", "Kuromi", "Cinnamoroll", "Pochacco", "My Melody", "Pompompurin",
  "Cringer", "Battle Cat", "He-Man", "He Man", "Masters of the Universe", "Grayskull", "Skeletor", "Pokemon", "Meowth", "Pikachu", "Jigglypuff", "Charmander",
  "Kit Kat", "KitKat", "Charlesworth", "Josh Charlesworth", "Alison Holder", "Holder", "Vernon Rudolph", "Rudolph", "JAB", "Donut", "Doughnut", "Doughnuts",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Mister Donut", "Black Thunder Cat", "Lucky Friday"] };
const MEME = ["POPCAT","MEW","MICHI","MANEKI","GRUMPY","NYAN","KITTY","CATWIF","MOG","TOSHI","KEYCAT","SC","CAT","CATS","MEOW","MEOWCAT","PURR","KITTEN","SIGMA","CHEESE","BONKCAT","SOLCAT","CATI","GME","WIF","SIMON","MOCHI","HEHE","BILLY","GIGA","NEKO","ZEUS","SMOL","MOODENG","PNUT","RETARDIO"];
const coins = [
 {id:"RINGLET", name:"Ringlet the Lime-Eyed Cat", ticker:"RINGLET", blurb:"Ringlet, a sleek black cat with bright lime-green eyes and a small white muzzle, naps curled in a perfect round ring on the warm garden step.", look:"Sleek black shorthair, lime-green eyes, small white muzzle; normal four-legged house cat; wears nothing."},
 {id:"SUGARSOOT", name:"Sugarsoot the Sparkle-Black Cat", ticker:"SUGARSOOT", blurb:"Sugarsoot, a fluffy black cat whose coat glints like sugar in the sun, with lime-green eyes and a white chin, sniffs the sweet morning air.", look:"Fluffy black cat with a glinting, sugar-sparkle coat, lime-green eyes, white chin; normal four-legged house cat; wears nothing."},
 {id:"SUGARSOOT-fix", name:"Sugarsoot the Sparkle-Black Cat", ticker:"SUGARSOOT", blurb:"Sugarsoot, a short-haired black cat whose coat glints like sugar in the sun, with lime-green eyes and a small white muzzle, sniffs the sweet morning air.", look:"A normal four-legged short-haired house cat with a black coat that glints like sugar crystals in sunlight, lime-green eyes and a small white muzzle. It wears nothing."},
 {id:"DUSKGLAZE", name:"Duskglaze the Black Cat", ticker:"DUSKGLAZE", blurb:"Duskglaze, a velvet-black shorthair with big lime-green eyes, a white muzzle and long white whiskers, strolls the garden path each evening.", look:"Velvet-black shorthair, big lime-green eyes, white muzzle, long white whiskers; normal four-legged house cat; wears nothing."},
];
// sibling sheets
const base = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const sib = [];
for (const f of fs.readdirSync(base+"/launch-sheet-2").filter(f=>f.endsWith("-pick.json") && !f.startsWith("DNUT"))) { try { const j = JSON.parse(fs.readFileSync(base+"/launch-sheet-2/"+f)); sib.push({src:f, ticker:j.ticker, name:j.name}); } catch {} }
try { const s = JSON.parse(fs.readFileSync(base+"/launch-sheet/launch-sheet.json")); const arr = Array.isArray(s)?s:(s.coins||s.sheet||s.rows||Object.values(s)); for (const c of arr) sib.push({src:"launch-sheet.json", ticker:c.ticker, name:c.name}); } catch (e) { sib.push({err:e.message}); }
const out = { sheet1Exists: fs.existsSync(base+"/launch-sheet/launch-sheet.json"), siblingCount: sib.length, coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { id:c.id, name:c.name, ticker:c.ticker, nameLen:c.name.length, blurbLen:c.blurb.length, descLen:desc.length, descOk: desc.length<=280, nameOk: c.name.length<=32,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /DNUT|KRISP|KREME|KKD|DONUT|DOUGH/.test(c.ticker), endsWithDisclosure: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name:c.name, symbol:c.ticker, tagline:c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name:c.name, symbol:c.ticker, tagline:desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  o.checkFields_blurb_look = R.checkFields({ blurb:c.blurb, look:c.look });
  o.checkTerms_stock = R.checkTerms({ name:c.name, symbol:c.ticker, tagline:c.blurb, look:c.look }, stockTerms);
  o.checkTerms_disclosureOnly = R.checkTerms({ disclosure: DISC }, stockTerms);
  o.displaySafe = R.displaySafe({ name:c.name, symbol:c.ticker });
  o.memeTicker = MEME.includes(c.ticker);
  const nameWords = c.name.toLowerCase().split(/[^a-z]+/).filter(w => w.length>3 && !["the","cat","black"].includes(w));
  o.siblingClash = sib.filter(s => s.ticker === c.ticker || (s.name && nameWords.some(w => s.name.toLowerCase().includes(w))));
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jup = { status:r.status, results:arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name:t.name, symbol:t.symbol, isVerified:t.isVerified, id:t.id, holderCount:t.holderCount, mcap:t.mcap })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  o.jup.anyVerifiedInResults = arr.filter(t=>t.isVerified).map(t=>t.symbol);
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
