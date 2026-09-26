import fs from "node:fs";
const rules = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const [sheetPath, tick] = [process.argv[2], process.argv[3].split(",")];
const sheet = JSON.parse(fs.readFileSync(sheetPath));
const out = {};
for (const c of sheet.filter((s) => tick.includes(s.ticker))) {
  const trib = c.tribute || "";
  out[c.ticker] = { lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, story: c.story.length },
    endsWithDisclosure: c.description.endsWith(c.disclosure), hasTribute: !trib || c.description.includes(trib),
    checkProposal: rules.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.story }),
    displaySafe: rules.displaySafe({ name: c.name, symbol: c.ticker }),
    checkFields_story_look: rules.checkFields({ name: c.name, symbol: c.ticker, story: c.story, look: c.look }),
    fullDescExtra: rules.checkFields({ description: c.description }).violations.filter((v) => !rules.checkFields({ description: `${trib} ${c.disclosure}` }).violations.some((w) => w.term === v.term)) };
}
console.log(JSON.stringify(out, null, 1));
