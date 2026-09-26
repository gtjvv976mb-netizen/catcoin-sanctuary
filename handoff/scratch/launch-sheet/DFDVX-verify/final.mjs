import { writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DFDVx. Not affiliated with DeFi Development Corp. or StonkFun. No intrinsic value; not financial advice.";
const tagline = "Latchkey, a sturdy brown tabby with white socks, naps curled on a little iron-banded strongbox in the garden shed, the brass key tucked under her chin.";
const pick = { name: "Latchkey the Vault Cat", ticker: "LATCHKEY", description: `${tagline} ${DISC}`, look: "A sturdy brown mackerel-tabby house cat with four white socks, curled asleep on top of a small wooden strongbox with iron bands, an old brass key tucked under her chin." };
const stockTerms = { stock: ["DFDV","DFDVX","DFDVx","DFDVSOL","dfdvSOL","DeFi Development","DeFi Development Corp","DeFi Dev Corp","DeFi Dev","DeFi","DevCorp","DDC","xStock","xStocks","Backed","Backed Finance","Solana","SOL","CHAD","DisclaimerCoin","DONT","Disclaimer","Joseph Onorati","Onorati","Parker White","Treasury Accelerator","SOL Per Share","SPS","CTV","BONK","Kraken","ZeroStack","Janover"] };
const o = { ...pick, lengths: { name: pick.name.length, ticker: pick.ticker.length, description: pick.description.length, tagline: tagline.length },
  tickerFormat: R.TICKER.test(pick.ticker), endsWithDisclosure: pick.description.endsWith(DISC),
  checkProposal: R.checkProposal({ name: pick.name, symbol: pick.ticker, tagline }),
  checkFields_description: R.checkFields({ description: pick.description }),
  checkFields_look: R.checkFields({ look: pick.look }),
  checkTerms_stock: R.checkTerms({ name: pick.name, symbol: pick.ticker, tagline, look: pick.look }, stockTerms),
  altName_ifVaultClash: { name: "Latchkey the Keeper Cat", len: "Latchkey the Keeper Cat".length, checkProposal: R.checkProposal({ name: "Latchkey the Keeper Cat", symbol: "LATCHKEY", tagline }) } };
const r = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=LATCHKEY"); const t = await r.text();
writeFileSync("jup-LATCHKEY-final.json", t);
const arr = JSON.parse(t); o.jup = { status: r.status, results: (Array.isArray(arr)?arr:arr.tokens||[]).length };
writeFileSync("final.out.json", JSON.stringify(o, null, 1)); console.log(JSON.stringify(o, null, 1));
