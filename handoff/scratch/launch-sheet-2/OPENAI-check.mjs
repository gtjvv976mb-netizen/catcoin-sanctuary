const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in OPENAI. Not affiliated with OpenAI or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Parlor Puff the Portrait Cat", ticker: "PARLORPUFF", blurb: "Parlor Puff, a fluffy taupe tabby with a snowy ruff and big dark eyes, sits so still by the flower pots that visitors take her for a painting until she blinks." },
  { name: "Nextpaw the Guessing Cat", ticker: "NEXTPAW", blurb: "Nextpaw, a long-haired taupe tabby with a white bib and round dark eyes, always seems to know what you will say next and starts purring before you finish." },
  { name: "Mull the Thinking Cat", ticker: "MULLPAW", blurb: "Mull, a round, long-haired taupe tabby with a white ruff and snowy paws, answers every question with one slow blink after thinking it over for a long time." },
];
const stockTerms = { stock: ["OPENAI", "OpenAI", "Open AI", "OAI", "tOpenAI", "T-OpenAI", "GPT", "ChatGPT", "Chat GPT", "Sora", "DALL-E", "DALLE", "Dall", "Codex", "Altman", "Sam Altman", "Brockman", "Sutskever", "Stargate", "Strawberry", "Orion", "Simba", "Mufasa", "Disney", "Tessera", "PreStocks", "PreStock", "C2PA", "Content Credentials", "iGPT", "prestock", "pre-IPO"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MANEKI","MOG","MOGGY","OPENAI","OAI","GPT","SORA","OPEN"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: desc.replace(DISC, "") }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, mcap: t.mcap }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
// Token-2022 extension check for both OPENAI pair mints
const ext = {};
for (const mint of ["oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"]) {
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
    const j = await r.json();
    const info = j.result?.value?.data?.parsed?.info;
    ext[mint] = { owner: j.result?.value?.owner, extensions: (info?.extensions ?? []).map(e => ({ extension: e.extension, state: e.extension === "transferFeeConfig" ? { older: e.state?.olderTransferFee, newer: e.state?.newerTransferFee } : undefined })) };
  } catch (e) { ext[mint] = { error: String(e) }; }
}
console.log(JSON.stringify({ results, ext }, null, 1));
