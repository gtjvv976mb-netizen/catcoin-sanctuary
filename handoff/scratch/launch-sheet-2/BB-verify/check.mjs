const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in BB. Not affiliated with BlackBerry, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 {name:"Nightlatch the Orange Tabby Cat",ticker:"NIGHTLATCH",story:"Nightlatch, a big orange tabby with black stripes and copper eyes, walks the garden wall each night and checks that every gate is shut."},
 {name:"Murmur the Ginger Tabby Cat",ticker:"MURMURPAW",story:"Murmur, a round ginger tabby with thick black stripes and a pale chin, carries soft whispers between the flower beds and never repeats one."},
 {name:"Putter the Marmalade Cat",ticker:"PUTTERPAW",story:"Putter, a stocky marmalade tabby with a black-ringed tail and gold eyes, rides in the old garden wheelbarrow and purrs like a small, steady engine."},
];
const stockTerms = { stock: ["BB","BlackBerry","Black Berry","Berry","Berries","Bramble","CrackBerry","Research In Motion","RIM","BBM","Messenger","QNX","Cylance","Certicom","Waterloo","Giamatteo","John Chen","Lazaridis","Balsillie",
 "Garfield","Garf","Paws Inc","Odie","Arbuckle","Jim Davis","Nermal","Pooky","Lasagna","Monday","Mondays","Lazy","Angel Cat Sugar","Shimizu","Hello Kitty","Sanrio","CosCat","Cos Cat","Melfin","Marilyn",
 "Roaring Kitty","Roaring","Keith Gill","Jaguar","Land Rover","JLR","Backpack","Sunrise","Wormhole","PlayBook","KEYone","Priv","Passport","Torch","Storm","Pearl","Curve","Bold","Athena","Mercury","Secure","SecuSUITE","UEM","Spark","IVY"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","GARFIELD","GARF","ORANGE","GINGER","MARMALADE","SC","SMOG","MANEKI","BOBBY","GIGA","CHEESE","SCF","MUMU","KITTYCAT","CATI","NUB","TOBY","MOCHI","LUCE","KEYCAT","CATGPT","MOODENG"]);
// tickers already used on either sheet
const used = new Map();
function walk(dir){ for (const f of fs.readdirSync(dir,{withFileTypes:true})) { const p=dir+"/"+f.name; if (f.isDirectory()) { if (!/BB-verify/.test(p)) walk(p); } else if (/\.json$/.test(f.name) && !/^BB-/.test(f.name)) { const t=fs.readFileSync(p,"utf8"); for (const m of t.matchAll(/"(?:ticker|symbol)"\s*:\s*"([A-Z0-9]{2,10})"/g)) { if(!used.has(m[1])) used.set(m[1],new Set()); used.get(m[1]).add(p.replace(/.*scratchpad\//,"")); } } } }
const base="/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/";
walk(base+"launch-sheet"); walk(base+"launch-sheet-2");
const out = { disclosureOnly: R.checkFields({ description: DISC }), results: [] };
for (const c of coins) {
  const desc = `${c.story} ${DISC}`;
  const r = { name:c.name, ticker:c.ticker, nameLen:c.name.length, storyLen:c.story.length, descLen:desc.length, endsWithDisclosure: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasBB: c.ticker.includes("BB"), memeTicker: memeTickers.has(c.ticker),
    usedElsewhere: used.has(c.ticker) ? [...used.get(c.ticker)] : [],
    hasOfficial: /official/i.test(desc),
    checkProposal: R.checkProposal({ name:c.name, symbol:c.ticker, tagline:c.story }),
    checkFields_descBody: R.checkFields({ name:c.name, symbol:c.ticker, description:c.story }),
    checkTerms_stock: R.checkTerms({ name:c.name, symbol:c.ticker, story:c.story }, stockTerms),
    displaySafe: R.displaySafe({ name:c.name, symbol:c.ticker }),
    checkProposal_fullDesc: R.checkProposal({ name:c.name, symbol:c.ticker, tagline:desc }) };
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    r.jup = { status: res.status, results: arr.length, symbolMatches: arr.filter(t=>String(t.symbol).toUpperCase()===c.ticker).map(t=>({symbol:t.symbol,name:t.name,isVerified:t.isVerified,id:t.id})),
      near: arr.slice(0,5).map(t=>({symbol:t.symbol,name:t.name,isVerified:t.isVerified})) };
    r.jup.verifiedMatch = r.jup.symbolMatches.some(t=>t.isVerified===true);
  } catch(e) { r.jupError = String(e); }
  r.description = desc;
  out.results.push(r);
}
out.usedTickerCount = used.size;
console.log(JSON.stringify(out,null,1));
