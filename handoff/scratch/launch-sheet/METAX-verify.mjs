import { writeFileSync } from "node:fs";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/";
const DISC = "A cat coin priced in METAx. Not affiliated with Meta Platforms, Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 { name: "Couch Captain Cat", symbol: "COUCHCAP", description: "A fluffy brown tabby with golden eyes who claims the sofa every evening, remote in paw, picks the show for the whole house and naps before the ending. A cat coin priced in METAx. Not affiliated with Meta Platforms, Inc. or StonkFun. No intrinsic value; not financial advice.",
   look: "A fluffy, medium-long-haired brown tabby cat with a white chest and muzzle, golden-yellow eyes and tufted ears. It sits upright on a grey sofa with one front paw on a small dark TV remote, like a captain at the helm." },
 { name: "Pawse Button Tabby", symbol: "PAUSEPAW", description: "One paw on the pause button, one eye on you. A tufty-eared brown tabby who stops the film whenever it is time for snacks, laps or chin scratches. A cat coin priced in METAx. Not affiliated with Meta Platforms, Inc. or StonkFun. No intrinsic value; not financial advice.",
   look: "The same fluffy brown tabby cat with a white chest and muzzle, golden-yellow eyes and tufted ears. It lies on a grey sofa pressing a button on a small dark TV remote with one front paw and looks up at the viewer with a knowing expression." },
 { name: "Clever House Cat", symbol: "CLEVERCAT", description: "Remembers where the treats live, plans the leap to the top shelf and works the TV remote. A golden-eyed brown tabby proving house cats are clever. A cat coin priced in METAx. Not affiliated with Meta Platforms, Inc. or StonkFun. No intrinsic value; not financial advice.",
   look: "A fluffy brown tabby cat with a white chest and muzzle, golden-yellow eyes and tufted ears, sitting alert and pleased on the top of a bookshelf. A small dark TV remote lies beside its front paws." },
];
const stockTerms = { stock: ["META", "METAX", "METAx", "MTA", "FB", "Meta", "Meta Platforms", "Meta xStock", "Facebook", "Instagram", "WhatsApp", "Messenger", "Threads", "Oculus",
  "Quest", "Horizon", "Llama", "Muse", "Muse Charm", "Jolly", "Pusheen", "Hello Kitty", "Sanrio", "HamCat", "Zuckerberg", "Zuck", "Mark", "Beast", "Puli", "LeCun", "Yann",
  "Make-A-Video", "MakeAVideo", "Menlo Park", "metaverse", "Reels", "Ray-Ban", "Kirby", "Labubu", "Tamagotchi", "xStock", "Backed", "cats of instagram", "Meta AI", "Connect"] };
const memeBanned = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG","MANEKI","SIGMA","WIF","MEOW","PURR","BOBO","KITTENS"];
const out = [];
for (const c of coins) {
  const r = { name: c.name, symbol: c.symbol };
  const endsWithDisc = c.description.endsWith(DISC);
  const body = endsWithDisc ? c.description.slice(0, -DISC.length).trim() : null;
  r.lengths = { name: c.name.length, symbol: c.symbol.length, description: c.description.length, body: body?.length, nameOk: c.name.length <= 32, symbolOk: c.symbol.length >= 2 && c.symbol.length <= 10, descOk: c.description.length <= 280 };
  r.disclosureExact = endsWithDisc;
  r.tickerRegex = TICKER.test(c.symbol);
  r.tickerContainsMeta = /META|FB/.test(c.symbol);
  r.memeBanned = memeBanned.includes(c.symbol);
  r.checkProposal = checkProposal({ name: c.name, symbol: c.symbol, tagline: body });
  r.displaySafe = displaySafe({ name: c.name, symbol: c.symbol });
  r.checkFields_nameSymbolBody = checkFields({ name: c.name, symbol: c.symbol, description: body, look: c.look });
  r.checkFields_fullDescription = checkFields({ description: c.description });
  r.checkTerms_stock = checkTerms({ name: c.name, symbol: c.symbol, description: body, look: c.look }, stockTerms);
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.symbol)}`;
  try {
    const res = await fetch(url); const txt = await res.text();
    writeFileSync(DIR + `METAX-jup-${c.symbol}.json`, txt);
    const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.tokens || []);
    const same = arr.filter((x) => String(x.symbol).toLowerCase() === c.symbol.toLowerCase());
    r.jupiter = { url, status: res.status, results: arr.length, sameSymbol: same.length, sameSymbolVerified: same.filter((x) => x.isVerified === true).length,
      anyVerified: arr.filter((x) => x.isVerified === true).map((x) => `${x.symbol}/${x.name}`), all: arr.map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}`) };
  } catch (e) { r.jupiter = { url, error: e.message }; }
  out.push(r);
}
writeFileSync(DIR + "METAX-verify.out.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
