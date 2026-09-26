const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in BOEING. Not affiliated with The Boeing Company, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["BOEING", "Boeing", "The Boeing Company", "Boeing Airplanes", "BoeingAirplanes", "BA", "BAx", "Bo", "Bo-bo", "Lilly", "RDU", "Raleigh", "Durham",
  "Louisville", "Muhammad Ali", "Wes England", "England", "Kelly Ortberg", "Ortberg", "Lion Air", "EVA Air", "Hello Kitty", "Kitty Hawk", "Kitty", "Sanrio", "Dreamliner",
  "Jumbo", "737", "747", "757", "767", "777", "787", "MAX", "Apache", "Chinook", "Osprey", "Stingray", "Condor", "Starliner", "Peregrine", "Backpack", "Backpack Securities",
  "Sunrise", "Wormhole", "Tiger", "Lion", "Jaguar", "Panther", "Leopard", "Puma", "Tomcat", "Grumman", "Tarco", "Hint-Pot", "CBS17", "WNCN", "Fox News", "Louisville kitten"] };
const c = { name: "Windsock the Ginger Tabby Cat", ticker: "WINDSOCK",
  blurb: "Windsock, a ginger tabby with a white chest, white paws and a striped orange tail, sits by the gate to watch which way the wind blows.",
  look: "A normal four-legged, slim young house cat. Ginger (orange) mackerel tabby with darker orange stripes on the forehead, back, legs and tail, a white chest, belly and four white paws, a pink nose, big pink-lined ears and olive-gold eyes. Wears nothing." };
const coat = { base: "#D98E4C", second: "#A95F2C", pattern: "tabby", eyes: "#A8873F" };
const desc = `${c.blurb} ${DISC}`;
const hsl = (hex) => { const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255); const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, d=mx-mn;
  const s = d===0?0:d/(1-Math.abs(2*l-1)); let h=0; if(d){ if(mx===r) h=((g-b)/d)%6; else if(mx===g) h=(b-r)/d+2; else h=(r-g)/d+4; h/=6; if(h<0) h+=1; } return {h:+h.toFixed(3),s:+s.toFixed(3),l:+l.toFixed(3)}; };
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, lookLen: c.look.length,
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /BA|BOE|BOEING/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC),
  coatValid: [coat.base, coat.second, coat.eyes].every(x => /^#[0-9A-F]{6}$/i.test(x)) && ["solid","tabby","tuxedo","calico","point","spotted","bicolor","tortie"].includes(coat.pattern),
  baseHsl: hsl(coat.base) };
o.gardenGingerModel = coat.pattern === "tabby" && o.baseHsl.h > 0.03 && o.baseHsl.h < 0.12 && o.baseHsl.s > 0.45;
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_look = R.checkFields({ look: c.look });
o.checkFields_disclaimerOnly = R.checkFields({ description: DISC });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, hits: arr.map(t => `${t.symbol} / ${t.name}${t.isVerified ? " (verified)" : ""}`),
  symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
o.description = desc;
console.log(JSON.stringify(o, null, 1));
fs.writeFileSync("BOEING-pick.json", JSON.stringify({ symbol: "BOEING", pair: "BOEING", pairMint: "BArimz1PcKZr8PcPh3tcZ2dg4S7FJLk3cw6R5F8GsHKg", name: c.name, ticker: c.ticker, description: desc, look: c.look, coat, token: { status: "planned" } }) + "\n");
