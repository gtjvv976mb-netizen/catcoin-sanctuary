import { writeFileSync } from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/MCDX";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in MCDx. Not affiliated with McDonald's or StonkFun. No intrinsic value; not financial advice.";
const cands = [
 { name: "Milkweed the Meadow Cat", ticker: "MILKWEED", description: "Milkweed, a fluffy white cat with one blue eye and one gold eye, pounces on drifting seed fluff in the long grass, then flops in the sun like a fallen cloud. A cat coin priced in MCDx. Not affiliated with McDonald's or StonkFun. No intrinsic value; not financial advice.",
   look: "A fluffy, medium-long-haired, all-white house cat with odd eyes (one blue, one gold) and a pink nose, crouched mid-pounce in long meadow grass with seed fluff floating around. It wears no bow, collar or clothes, uses a realistic cat face and body, and has no logos or red-and-yellow colour scheme." },
 { name: "Snowdrop the Garden Cat", ticker: "SNOWDROP", description: "Snowdrop, a sleek white cat with pale green eyes and a pink nose, naps in an empty cardboard box by the herb bed and purrs whenever someone says her name. A cat coin priced in MCDx. Not affiliated with McDonald's or StonkFun. No intrinsic value; not financial advice.",
   look: "A sleek, short-haired, all-white house cat with pale green eyes and a pink nose, curled up asleep in a plain brown cardboard box beside a herb bed. The box has no print, logo or burger-box shape. The cat wears no bow, collar or clothes, and it has a realistic cat face." },
 { name: "Meringue the Porch Cat", ticker: "MERINGUE", description: "Meringue, a soft all-white cat with sky-blue eyes, waits on the warm porch step every evening and slowly blinks at the fireflies as they rise from the grass. A cat coin priced in MCDx. Not affiliated with McDonald's or StonkFun. No intrinsic value; not financial advice.",
   look: "A soft, short-haired, all-white house cat with sky-blue eyes, pink ears and a pink nose, sitting upright on a wooden porch step at dusk while small glowing fireflies drift up from the grass. It wears no bow, collar or clothes, has a realistic cat face, and there are no logos anywhere." },
];
const stockTerms = { stock: ["MCD", "MCDX", "MCDx", "McDonald's", "McDonalds", "McDonald", "Mickey D", "Maccas", "McD", "Big Mac", "Quarter Pounder", "McFlurry", "McNugget", "McCafe", "Filet-O-Fish",
  "xStock", "xStocks", "Backed", "Happy Meal", "Happy Set", "Ronald", "Grimace", "Hamburglar", "Birdie", "Fry Kids", "McCheese", "Golden Arches", "Arches", "CosMc", "Kempczinski", "Kroc",
  "Hello Kitty", "Kitty White", "Kitty", "Mimmy", "Charmmy", "Sanrio", "Godzilla", "Kaiju", "Chococat", "Cinnamoroll", "My Melody", "Kuromi", "Pompompurin", "Keroppi", "Badtz-Maru", "Pochacco",
  "Garfield", "Doraemon", "Chiikawa", "Hachiware", "Sumikko", "Neko", "Lion King", "Simba", "Mufasa", "Nala", "Aristocats", "Snowbell", "Duchess"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MOCHI","MANEKI","SC","WIF","MOG","BONK","SIGMA","PURR","MEOW","MIAO","MIAU"]);
const root = "MCD";
const results = [];
for (const c of cands) {
  const i = c.description.indexOf(" A cat coin priced in ");
  const blurb = c.description.slice(0, i);
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, descLen: c.description.length, blurbLen: blurb.length };
  out.endsWithDisclosure = c.description.endsWith(DISC);
  out.checkProposal_blurbAsTagline = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: blurb });
  out.checkProposal_fullDescAsTagline = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description });
  out.checkFields_disclosure = R.checkFields({ disclosure: DISC });
  out.checkFields_look = R.checkFields({ look: c.look }, { skip: [] });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: blurb, look: c.look }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.tickerContainsRoot = c.ticker.includes(root) || c.ticker.startsWith("MC");
  out.memeTicker = memeTickers.has(c.ticker);
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`;
  try {
    const r = await fetch(url); const txt = await r.text();
    writeFileSync(`${DIR}/jup-search-${c.ticker}.json`, txt);
    const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupUrl = url; out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified ?? null, id: t.id }));
    out.jupVerifiedSymbolMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
    out.jupAnyVerifiedInResults = arr.filter(t => t.isVerified === true).map(t => ({ symbol: t.symbol, name: t.name }));
  } catch (e) { out.jupError = String(e); }
  results.push(out);
}
writeFileSync(`${DIR}/check.out.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
