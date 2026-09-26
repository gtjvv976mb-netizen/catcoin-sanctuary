// Writes launch-sheet.json and launch-sheet.md from the editor's final coins, the image manifest,
// the live StonkFun reads in stonkfun-site/ and the re-check in sheet-check.out.json.
import fs from "node:fs";
import path from "node:path";

const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
const final = JSON.parse(fs.readFileSync(path.join(DIR, "EDITOR/final.json"), "utf8")).final;
const check = JSON.parse(fs.readFileSync(path.join(DIR, "sheet-check.out.json"), "utf8"));
const quote = JSON.parse(fs.readFileSync(path.join(DIR, "stonkfun-site/launch-quote.json"), "utf8"));
const byTicker = Object.fromEntries(check.coins.map((c) => [c.ticker, c]));
const checkedAt = check.summary.checkedAt;

const WHY = {
  PATCHPAW: "No cat link was found. SPYx is an index fund that holds hundreds of companies, so her calico coat is made of many small patches, no two alike. The issuer's spider mascot is left out.",
  WHISK100: "No cat link was found. The fund tracks the Nasdaq-100, so the cat has one long white whisker for each of the 100 holdings. The coat is chocolate brown so it does not look like the set's grey cats.",
  INGOTLOAF: "No cat link was found. GLDx is backed by physical gold, so she is a honey-golden cat in the 'loaf' pose, shaped like a little bar.",
  SNOWCURL: "She follows the white cat avatar in Tesla's 2026 Pet Mode update: solid white, tail up and curled at the tip, one paw raised to her face. The balloon style, the badge and the feature's name are left out.",
  SOCKFOOT: "He copies the real cat in Figure 1 of NVIDIA's 2016 'AI Cat Chaser' developer-blog post: a dark-grey tabby with a white chin, white bib and four white paws, tail up, on a garden path at dawn.",
  ROSETTE: "Big-cat link: Mac OS X 10.2 was called 'Jaguar'. She is a stocky house cat with a jaguar's golden-tan coat and black rosettes, lying on an oak branch. No Apple name or artwork is used.",
  HALFSMILE: "She follows Jellie, the real grey-and-white cat with grey-green eyes who became a Minecraft cat skin (Microsoft owns Mojang). Her owner's 'grumpy smile' became the crooked grin. Jellie's name and the game are not used.",
  PORCHLIGHT: "The recurring black cat in Google's Halloween Doodle games was drawn from a Doodle artist's real black cat with yellow eyes. Only the coat and eye colour are used.",
  SUNMANE: "Big-cat link: the MGM lion, now used by Amazon MGM Studios. He is a plain tawny house cat with a mane-like ruff on his neck. The logo's ring, the roar and the lion's name are left out.",
  COUCHCAP: "Meta AI's official Make-A-Video demo ('Cat watching TV with a remote in hand') shows a fluffy brown tabby with a white chest and golden eyes on a grey sofa, holding a remote. The coin copies that cat with a normal paw and without the watermark.",
  HARRUMPH: "He is the fluffy, flat-faced, grey-taupe cat with a sulky pout from Coinbase's 2024 brand campaign. That cat's name is not used.",
  PEWTER: "She is the grey tabby pixel cat that @RobinhoodApp posted in Aug-Sep 2026: dark bars on the cheeks, white chin, pink nose. Its Robin Hood cap and tunic are left off.",
  TRINKETCAT: "No cat link was found; the company's animals are a dog and a honey badger. The company is known for adding to a reserve and holding it, so this tortoiseshell has a pile of blank pebbles that only grows.",
  TUPPENCE: "Crypto news reported a USDC ad with a fat cat in a hat, so she is tubby and wears a cap. Confidence is low because the ad itself was never found. The blue-grey coat and the tweed are our own choices.",
  WARMSPOT: "She is the tuxedo cat at the front left of the viral photo of five cats on a heated Starlink dish, the photo Starlink later used for its 'Cat 5' sticker. She is drawn alone on a plain, unmarked dish.",
  SKEINKIT: "No cat link was found. The company's software links records together, so this cream kitten ties the whole garden together with red yarn.",
  SAVEPAWS: "Fan link: the brown mackerel-tabby kitten avatar of the best-known GME fan account. Only the plain coat is used: no headband, no roar, no yarn and no name. 'Save point' is an ordinary video-game term.",
  EVERLOOP: "No cat link was found; the mascots are a honey badger and a dog. STRC is a perpetual preferred share with no maturity date, so she sleeps curled in an endless ring.",
  MILKWEED: "McDonald's ran a 2026 Happy Meal with a licensed white cartoon cat. Only the white coat is kept. The odd eyes, pink nose, long fur and realistic body make Milkweed clearly a different cat, and there is no bow and no brand colours.",
  MOATCAT: "She follows Cam the Cat, a Squishmallows plush made by Jazwares, a Berkshire subsidiary: a white calico with one ginger ear, one black ear and one black front leg. She is drawn as a real cat, not a plush. 'Moat' is an ordinary investing word.",
  TUMBLES: "Coca-Cola's own 2014 press release on the Diet Coke 'Kittens' ad says the kittens multiply until the room overflows, so she is a kitten who collects a pile of kittens. The ginger coat is our own choice.",
  BRACKEN: "Intel's official codename 'Wildcat Lake' (Core 5 320), so he is a house cat with a wildcat's grey-brown striped coat and a black-ringed tail.",
  TRILLBY: "No cat link was found. The company makes AI agents that answer calls and chats, so Trillby is a talkative colourpoint cat, the type best known for chatting, who chirps back.",
  LATCHKEY: "No cat link was found. The company calls itself a Solana treasury vehicle, so this ginger-and-white cat dozes on a strongbox with one paw on the key.",
};

const NOTE = {
  AAPLx: "StonkFun lists AAPLx as APPLX (\"APPLE\"); check the mint.",
  GLDx: "StonkFun shows this pair's name as \"GOLD\".",
  DFDVx: "StonkFun's symbol for this pair is DFDV, with no X at the end.",
  CRCLx: "An unverified Solana token already uses TUPPENCE (HnU8E8dza4kx7PPd5ZC7HAxqeD5UATvdbkrD5DNHpump). The rule blocks only verified tokens, so this passes, but a ticker search will show that token too.",
  STRCx: "StonkFun's search for EVERLOOP also returns LEVERLOOP ('Leveraged Cat Loop', launched 2026-09-17 against LEVERCAT). That is a different ticker, but it is one letter longer and is also a cat.",
  KOx: "The image shows three more kittens in the hammock, which the look allows.",
  AMZNx: "The sundial in the image has faint hour lines and a small scroll. They are decoration, not letters.",
  GMEx: "If launch-sheet-2 is launched later, rename its TTWO coin (SAVEPAW / 'Savepoint the Silver Cat') rather than this one.",
  GLDx_extra: "Nine unverified tokens use the name or ticker INGOT; none uses INGOTLOAF.",
  MSTRx: "Fourteen unverified TRINKET/TRIN tokens exist; none is a cat and none uses TRINKETCAT.",
  PLTRx: "One unverified SKEIN token exists (Skein Privacy); it uses a different ticker.",
  "BRK.Bx": "StonkFun lists this pair as BRKX.",
};

const sheet = final.map((c, i) => {
  const k = byTicker[c.ticker];
  const disclosure = c.description.match(/A cat coin priced in \S+?\. Not affiliated with .+ or StonkFun\. No intrinsic value; not financial advice\.$/)[0];
  const story = c.description.slice(0, c.description.length - disclosure.length).trim();
  const notes = [NOTE[k.stock], k.stock === "GLDx" ? NOTE.GLDx_extra : null].filter(Boolean);
  return {
    order: i + 1,
    stock: c.stock,
    xstock: k.stock,
    stonkfunSymbol: k.stonkfunSymbol,
    stonkfunPairName: k.pair.name,
    quoteMint: k.pair.mint,
    name: c.name,
    ticker: c.ticker,
    description: c.description,
    story,
    disclosure,
    look: c.look,
    basis: c.basis,
    whyLook: WHY[c.ticker],
    image: k.image.png,
    imageJpg512: k.image.jpg512,
    imageJobId: k.image.jobId,
    imageUrl: k.image.resultUrl,
    imageBytes: k.image.bytes,
    imageSize: `${k.image.width}x${k.image.height}`,
    form: {
      launchOn: "LaunchLab (fixed)",
      feeModel: "Standard: Holder rewards tax = None",
      devBuy: "none (leave empty)",
      tokenName: c.name,
      symbol: c.ticker,
      tokenImage: k.image.png,
      website: "the cat's Cat Sanctuary page if it is live; otherwise leave blank (StonkFun then links to itself)",
      x: "optional",
      telegram: "optional",
      quoteToken: `${k.stonkfunSymbol} (${k.pair.name}) ${k.pair.mint}`,
      descriptionBox: "none on StonkFun's form",
    },
    notes,
    checks: c.checks,
    finalRecheck: {
      checkedAt,
      pair: k.pair,
      mintMatchesStockText: k.mintMatchesStockText,
      lengths: k.lengths,
      endsWithDisclosure: k.endsWithDisclosure,
      tickerFormat: k.tickerFormat, tickerNotCatMeme: k.tickerNotCatMeme, tickerNoRoot: k.tickerNoRoot,
      checkProposal: k.checkProposal,
      displaySafe: k.displaySafe,
      checkFields_name_symbol_story_look: k.checkFields_name_symbol_story_look,
      checkFields_fullDescription: k.checkFields_fullDescription,
      checkFields_disclosureOnly: k.checkFields_disclosureOnly,
      descriptionViolationsAllFromDisclosure: k.descriptionViolationsAllFromDisclosure,
      jupiter: k.jupiter,
      stonkfun: k.stonkfunSearch,
    },
  };
});
fs.writeFileSync(path.join(DIR, "launch-sheet.json"), JSON.stringify(sheet, null, 1) + "\n");

const rent = quote.launchLabRentSol;
const t = checkedAt.slice(0, 16).replace("T", " ") + " UTC";
const md = [];
md.push(`# Cat Sanctuary: StonkFun launch sheet (24 cats)`);
md.push("");
md.push(`Everything below was re-checked live on ${t}. Each cat is one launch on stonkfun.xyz/launch, paired with its own xStock. Image paths are relative to \`${DIR}/\`. The same data, with sources and full check output, is in \`launch-sheet.json\`.`);
md.push("");
md.push(`## 5 launch tips (from StonkFun's own pages)`);
md.push("");
md.push(`1. **Cost and fees.** Every xStock launch now goes through LaunchLab. Today's quote from StonkFun (\`/api/launch-quote\`) shows a platform launch fee of ${quote.launchLabFeeSol} SOL for LaunchLab, and the form's cost line reads "network rent only — no platform fee": about ${rent.standard} SOL per standard launch, or ${rent.devBuyExtra} SOL more with a dev buy. Trading pays a 1% pool fee. The form says "approximately 0.5% of every trade … accrues to the creator and is forwarded to your wallet automatically once it clears a minimum — there is nothing to claim." It also warns: "Creator fees are approximate and depend on trading that may never happen. A token can lose all of its value." Check the Launch summary before every approval.`);
md.push(`2. **Choose Standard: set "Holder rewards tax" to None.** A reward token writes a 1% or 3% transfer tax into the mint, and it "cannot be changed after launch". The creator also gets no separate fee ("treated like any other holder"). Standard means no tax and the ~0.5% creator share. It also keeps the coins free of anything that reads like a payout.`);
md.push(`3. **A dev buy is paid in SOL but bought in the stock.** The form converts the SOL to the xStock and spends it as the curve's first trade in the same approval. It warns that "the share of supply it fills is settled on-chain, not previewed here." This sheet assumes no dev buy, so leave that box empty. If you do make one, you hold your own coin, and you only see how much it bought after it lands.`);
md.push(`4. **Use the form, and confirm each coin before the next.** StonkFun's API page says a hand-built LaunchLab pool is "adopted" only if it matches StonkFun's own launch exactly: config, supply, platform id and curve-rule account. If anything is off, the pool still trades on Raydium, but StonkFun never records it: no token page and no fee forwarding. Launches made through the form are recorded directly. After each one, the "Token is live" panel shows the Mint and Pool. Open the token page, or \`/api/public/v1/tokens/<mint>\`, which should show \`launchpad: "launchlab"\`, then move on.`);
md.push(`5. **What you type is permanent, and there is no description box.** "Image and metadata are stored permanently on Arweave", project links are "Saved in the token's permanent metadata", and liquidity is "permanently locked with Burn & Earn". The form asks only for name, symbol, image and links, so the description and its disclosure cannot go on StonkFun. Put them on each cat's Cat Sanctuary page and in any launch post. Put that page in Website only once it is live; if you leave Website blank, the coin links to StonkFun.`);
md.push("");
md.push(`## The form, top to bottom (the same for every cat)`);
md.push("");
md.push(`I checked the order on the live /launch page and in its code (2026-09-25). The form says "Name, symbol, logo and a quote token are required".`);
md.push("");
md.push(`1. **Launch on:** LaunchLab. This is fixed; there is nothing to pick.`);
md.push(`2. **Fee model / Holder rewards tax:** choose **None** (a Standard token).`);
md.push(`3. **Dev buy:** leave empty.`);
md.push(`4. **Token name:** at most 32 characters.`);
md.push(`5. **Symbol:** at most 10 characters.`);
md.push(`6. **Token image:** PNG, JPEG or WebP, square, up to 2 MB. Use the cat's 1024×1024 PNG (1.1–1.3 MB each). The \`-512.jpg\` next to it is a smaller fallback.`);
md.push(`7. **Project links:** Website is the cat's Cat Sanctuary page if it is live, otherwise blank. X and Telegram are optional. All of them are permanent.`);
md.push(`8. **Quote token:** open the **xStocks** tab, paste the mint below into "Search … tokens by symbol, name or address", and pick the one match.`);
md.push(`9. **Launch summary → Launch token.** Check the cost line, approve in your wallet, then check the coin (tip 4).`);
md.push("");
md.push(`## The 24 cats`);
for (const s of sheet) {
  const k = s.finalRecheck;
  const brandTerm = k.checkFields_fullDescription.violations.find((v) => v.rule === "brand")?.term;
  const jupLine = k.jupiter.sameSymbol.length ? `${k.jupiter.sameSymbol.length} unverified token with that symbol, 0 verified` : `no token with that symbol`;
  md.push("");
  md.push(`### ${s.order}. ${s.xstock} → ${s.ticker}`);
  md.push("");
  md.push(`- **Token name:** \`${s.name}\``);
  md.push(`- **Symbol:** \`${s.ticker}\``);
  md.push(`- **Token image:** \`images/${s.ticker}.png\``);
  md.push(`- **Quote token:** **${s.stonkfunSymbol}** (listed as "${s.stonkfunPairName}"), mint \`${s.quoteMint}\``);
  md.push(`- **Description** (for the cat's page and posts; StonkFun has no box for it):`);
  md.push(`  > ${s.description}`);
  md.push(`- **Why it looks like this:** ${s.whyLook}`);
  md.push(`- **Checks:** checkProposal \`${JSON.stringify(k.checkProposal)}\`. checkFields on the full description flags only the required disclosure (${k.checkFields_fullDescription.violations.map((v) => `${v.rule} "${v.term}"`).join(", ")}). Jupiter: ${jupLine}. StonkFun: symbol and name not used yet. Lengths: name ${k.lengths.name}/32, ticker ${k.lengths.ticker}/10, description ${k.lengths.description}/280.`);
  for (const n of s.notes) md.push(`- **Note:** ${n}`);
}
md.push("");
md.push(`## What the checks cover`);
md.push("");
md.push(`- **Pairs:** all 24 pairs are live on StonkFun as launchable and LaunchLab-ready, and each mint matches the one in the research. Tickers, names and pairs are all different from each other.`);
md.push(`- **Content rules:** the repo's \`checkProposal({name, symbol, tagline: story})\`, \`displaySafe\` and \`checkFields(name, symbol, story, look)\` pass for every coin. \`checkFields\` on each full description flags only the words of the required disclosure: the company or StonkFun name, "affiliated" and "financial advice". Running the disclosure alone gives the same flags.`);
md.push(`- **Tickers:** no ticker matches a verified Solana token on Jupiter, a known cat-meme ticker or any xStock root. None is already used on StonkFun. As a control, a StonkFun search for "AGI" did find that coin, so the empty searches are real.`);
md.push(`- **Images:** every image is a 1024×1024 PNG under 2 MB.`);
md.push(`- **One gap:** the repo's own stock-cat gate (\`stockCatRefusals\`) still refuses every pair with \`pair_terms_missing\` until research rows are written. That blocks only the extension's tab, not a launch by hand.`);
md.push("");
md.push(`Nothing has been launched or uploaded, and the repo was not changed.`);
fs.writeFileSync(path.join(DIR, "launch-sheet.md"), md.join("\n") + "\n");
console.log("ok", sheet.length, md.join("\n").length);
