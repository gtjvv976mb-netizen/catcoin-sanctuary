import { readFileSync, writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const S = await import("/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs");
const T = await import("/home/user/Cat-Intelligence-Agency/bots/cashcat/tickers.mjs");
const DISC = "A cat coin priced in AMZNx. Not affiliated with Amazon or StonkFun. No intrinsic value; not financial advice.";
const c = { name: "Sunmane the Garden Cat", ticker: "SUNMANE", story: "Sunmane, a sturdy tawny cat with a fluffy ruff like a little mane, naps in the warmest patch of the garden and pads his rounds at dusk." };
const description = `${c.story} ${DISC}`;
const idx = T.verifiedIndex(JSON.parse(readFileSync("jup-verified-list.json", "utf8")));
const pair = S.STOCK_PAIRS.find(p => p.symbol === "AMZNx");
const notesRow = { mint: pair.mint, people: ["Jeff Bezos", "Andy Jassy", "Bezos", "Jassy"], mascots: ["Leo the Lion", "Leo", "Hello Kitty"],
  brands: ["Amazon MGM Studios", "MGM", "Metro-Goldwyn-Mayer", "Prime", "Prime Video", "Alexa", "Kindle", "Echo", "Kuiper", "Amazon Leo", "AmazonHelp", "Whiskas", "Amazon Kids", "Ember", "Smile", "Amazon Pay"],
  catFacts: [{ text: "x", source: "https://en.wikipedia.org/wiki/Leo_the_Lion_(MGM)", readAt: "2026-09-25" }], searchedAt: "2026-09-25", method: "checker simulation" };
const r = { name: c.name, ticker: c.ticker, description, nameLen: c.name.length, tickerLen: c.ticker.length, descLen: description.length, storyLen: c.story.length, endsWithDisclosure: description.endsWith(DISC) };
r.checkProposal_story = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.story });
r.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: description });
r.stockCatRefusals = S.stockCatRefusals(S.stockDraft({ name: c.name, symbol: c.ticker, tagline: c.story }, pair), pair, { notes: [notesRow], verifiedIndex: idx });
r.tickerFree = T.tickerFree(idx, { name: c.name, symbol: c.ticker });
const j = JSON.parse(readFileSync("jup-search-SUNMANE.json", "utf8")); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
r.jupSearch = { results: arr.length, symbols: arr.map(t => `${t.symbol}${t.isVerified ? "(V)" : ""}`), verifiedExact: arr.filter(t => String(t.symbol).toLowerCase() === "sunmane" && t.isVerified === true) };
writeFileSync("recheck.out.json", JSON.stringify(r, null, 1));
console.log(JSON.stringify(r, null, 1));
