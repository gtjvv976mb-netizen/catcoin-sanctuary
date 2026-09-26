const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in ARM. Not affiliated with Arm Holdings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const pick = { name: "Rimestripe the Blue Tabby Cat", ticker: "RIMESTRIPE", blurb: "Rimestripe, a lean pale silver-blue tabby with slate-blue stripes and a frost-white face, pads the same loop round the pond each dusk." };
const stockTerms = { stock: ["ARM","Arm","Arm Holdings","Arm Holdings plc","Holdings","Arms","Rene Haas","Haas","SoftBank","Masayoshi Son","Cortex","Neoverse","Mali","Immortalis","Ethos","Kleidi","Valhall","Panthor","Panther","Ice Cave","IceCave","Phoenix","RealtimeUK","Unity","Unite","Mengot","Cambridge","Acorn","RISC","Exynos","Samsung","Cheetah","Lion","Leopard","Lynx","Tiger","Tigress","Mousr","Garfield","Backpack","Backpack Securities","Sunrise","Wormhole","OnlyMarms","Marms"] };
const desc = `${pick.blurb} ${DISC}`;
const out = { pick, description: desc, nameLen: pick.name.length, descLen: desc.length, tickerLen: pick.ticker.length,
  tickerRegex: R.TICKER.test(pick.ticker), containsARM: /ARM/.test(pick.ticker),
  checkProposal: R.checkProposal({ name: pick.name, symbol: pick.ticker, tagline: pick.blurb }),
  checkFields_nameTickerBlurb: R.checkFields({ name: pick.name, symbol: pick.ticker, blurb: pick.blurb }),
  checkTerms_stock: R.checkTerms({ name: pick.name, symbol: pick.ticker, blurb: pick.blurb, description: desc.replace(/Arm Holdings|ARM\b/g, "") }, stockTerms),
  checkFields_fullDescription: R.checkFields({ description: desc }),
  checkProposal_fullDescriptionAsTagline: R.checkProposal({ name: pick.name, symbol: pick.ticker, tagline: desc }),
  displaySafe: R.displaySafe({ name: pick.name, symbol: pick.ticker }) };
const res = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=RIMESTRIPE"); const arr = await res.json();
out.jupiter = { status: res.status, results: (Array.isArray(arr) ? arr : []).length };
console.log(JSON.stringify(out, null, 1));
