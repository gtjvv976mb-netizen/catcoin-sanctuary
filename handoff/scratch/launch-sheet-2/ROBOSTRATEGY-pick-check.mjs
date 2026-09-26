const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in ROBOSTRATEGY. Not affiliated with RoboStrategy, Inc. or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["ROBOSTRATEGY", "RoboStrategy", "Robo Strategy", "Robo", "BOT", "Bots", "Robot", "Robots", "Robotics", "tBOT", "BOTx", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Figure AI", "Figure", "Apptronik", "Dyna", "Dyna Robotics", "Standard Bots", "Path Robotics", "Dexmate", "Coco Robotics", "Maven Robotics", "REK", "GMI",
  "Mechanism Capital", "Mechanism", "Mech", "Mechs", "Andrew Kang", "Kang", "Nyan", "Nyan Heroes", "Heroes", "9 Lives Interactive", "FP Strategies", "Physical AI",
  "intelligence in motion", "Computershare", "humanoid", "embodied AI", "Nasdaq", "Android", "Cyborg", "Droid", "Ratchet", "Clank", "Lombax", "Fraggle"] };
const coins = [
  { id: "A", name: "Sprocket the Steel-Grey Cat", ticker: "SPROCKPAW", blurb: "Sprocket, a sleek steel-grey shorthair with copper eyes, walks the garden in neat, even steps and sits by the same rose at the same time each morning." },
  { id: "B", name: "Gearpaw the Helper Cat", ticker: "GEARPAW", blurb: "Gearpaw, a gunmetal and white tuxedo cat with green eyes, copies whatever the gardener does, patting the soil and nudging pots into tidy rows." },
  { id: "C", name: "Rivet the Silver-Point Cat", ticker: "RIVETPAW", blurb: "Rivet, a pale silver cat with steel-grey ears, paws and tail and ice-blue eyes, naps by the tool shed with a low, steady purr like a small motor." },
  { id: "P", name: "Gimbal the Helper Cat", ticker: "GIMBALPAW", blurb: "Gimbal, a gunmetal and white tuxedo cat with green eyes, copies the sanctuary gardener, patting the soil and nudging pots into tidy rows." },
];
const memes = new Set(["POPCAT","MEW","MICHI","MOG","MANEKI","GRUMPY","KITTY","CAT","CATS","NYAN","SC","CATWIF","MOGGY","BILLY","GIGA","WIF","SIMON","KEYCAT","MUMU","HAPPY","SCAT","CATI","CATDOG","PAWS","PAW","GARF"]);
const out = [];
for (const c of coins) {
  const description = `${c.blurb} ${DISC}`;
  const r = { id: c.id, name: c.name, ticker: c.ticker, nameLength: c.name.length, blurbLength: c.blurb.length, descriptionLength: description.length, description };
  r.endsWithDisclosure = description.endsWith(DISC);
  r.tickerFormat = R.TICKER.test(c.ticker);
  r.notStockTickerOrRoot = !/BOT|ROBO/.test(c.ticker);
  r.knownCatMeme = memes.has(c.ticker);
  r.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  r.checkFields_blurb = R.checkFields({ description: c.blurb });
  r.checkFields_fullDescription = R.checkFields({ description });
  r.checkFields_disclaimerOnly = R.checkFields({ description: DISC });
  r.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  r.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await res.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    r.jup = { status: res.status, results: arr.length, symbols: arr.map(t => `${t.symbol}${t.isVerified ? "(verified)" : ""}`),
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
    r.jup.verifiedMatch = r.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { r.jupError = String(e); }
  out.push(r);
}
console.log(JSON.stringify(out, null, 1));
