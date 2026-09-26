const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DKNG. Not affiliated with DraftKings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DKNG", "DK", "DKNGx", "DraftKings", "Draft Kings", "Draft", "Kings", "King", "DraftKings Predictions", "DraftKings Sportsbook", "DraftKings Casino", "DK Network", "Crown", "Crown Cash",
  "Jason Robins", "Robins", "Matthew Kalish", "Kalish", "Paul Liberman", "Liberman", "Golden Nugget", "Nugget", "Jackpocket", "Railbird", "SBTech", "Diamond Eagle", "VSiN", "Musburger",
  "FanDuel", "Barstool", "Big Cat", "Dan Katz", "Katz", "Miss Kitty", "Kitty", "Cat Wilde", "Wilde", "Anaxi", "Play'n GO", "Pariplay", "Hellmann's", "Hellmanns", "Kate McKinnon", "McKinnon", "Mayo",
  "Lion Carnival", "Lightning Lion", "Jaguar Princess", "Rising Tiger", "Silver Lioness", "50 Lions", "Lion", "Tiger", "Jaguar", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "ESPN", "ESPN Bet",
  "NFL", "Super Bowl", "Pigskin", "Laces Out"] };
const MEME = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","MOTHER","CHEESE","SCF","MANEKI","BOOP","TOOKER","GME","KEYCAT","CATI","WAT","PAWS","PAW","LUCE","HAMMY","ZACK","MIHARU","CHOCOCAT","SIGMA"];
const coins = JSON.parse((await import("fs")).readFileSync("DKNG-coins.json","utf8"));
const coinArr = Array.isArray(coins) ? coins : (coins.coins ?? []);
const out = { disclosureOnly: R.checkFields({ disclaimer: DISC }), coins: [] };
for (const c of coinArr) {
  const blurb = c.blurb ?? c.description.replace(" " + DISC, "");
  const desc = `${blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /DK|DKNG|DRAFT|KING|CROWN/.test(c.ticker), memeTicker: MEME.includes(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC), sameAsDraft: c.description ? c.description === desc : "n/a" };
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: blurb });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_catTextOnly = R.checkFields({ name: c.name, symbol: c.ticker, blurb, lookBasis: c.lookBasis ?? "" });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb, lookBasis: c.lookBasis ?? "" }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jup = { status: r.status, results: arr.length, all: arr.slice(0,5).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })),
    symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  o.description = desc;
  out.coins.push(o);
}
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
out.mint = { owner: v?.owner, freezeAuthority: info?.freezeAuthority, mintAuthority: info?.mintAuthority, decimals: info?.decimals,
  extensions: (info?.extensions ?? []).map(e => e.extension === "tokenMetadata" ? { tokenMetadata: { name: e.state?.name, symbol: e.state?.symbol } } : { [e.extension]: e.state }) };
out.hasTransferFee = (info?.extensions ?? []).some(e => /transferFee/i.test(e.extension));
console.log(JSON.stringify(out, null, 1));
