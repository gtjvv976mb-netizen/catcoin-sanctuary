# Cat Sanctuary: StonkFun launch sheet 2 (67 cats)

This sheet covers the cats priced in Backpack-listed stocks and funds (60) and in pre-IPO tokens (7). The 24 xStock cats are in the first sheet (`../launch-sheet/launch-sheet.md`). Every cat stays "not launched yet" in the garden until you launch it by hand on stonkfun.xyz/launch. Image paths below are relative to `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet-2/`. The same data, with the full basis, coat colours, on-chain pair data and check output, is in `launch-sheet.json`.

## Before you start

1. **The form, top to bottom.** I re-read the live /launch page on 2026-09-25 at about 20:40 UTC: the fee choice(s) at the top, then **Token name** (max 32 characters), **Symbol** (max 10), **Token image** (PNG, JPEG or WebP, square, up to 2 MB), **Project links** (optional, saved permanently; a blank Website links to StonkFun), then **Quote token** (tabs xStocks, PreStocks, Tessera, Sunrise, Currencies, Leverage, Collectibles, Solana, Custom). There is still no description box. Each entry below follows that order.
2. **Fees and dev buy.** What the top of the form shows depends on the venue StonkFun is using when you launch. If it shows **Launch on: LaunchLab** with a Fee model / Holder rewards tax, choose Standard / **None**, as in the first sheet. If it shows **Pool fee**, the form says 1% is "the default, and the lowest cost to traders" (about 0.5% to the creator); 2% sends about 1.5% to the creator and costs traders more. Leave **Dev buy** empty. The first sheet's other tips still apply: check the Launch summary before approving, and open the new token's page after each launch before starting the next.
3. **Images.** Each cat has a 1024×1024 PNG (1.08–1.40 MB, all under the 2 MB limit) and a `-512.jpg` fallback beside it. Checked by eye: each shows one cat, with no text and no logos. Small differences from the text: Lidnap (DELL) sits instead of lying flat, Pinrow (DRAM) has chip-style pins around its base, and Satchel's (FWDI) points came out a light fawn-ginger.
4. **Every pair is live and ready.** In StonkFun's pairs list (generated 12:39 UTC today) all 69 pairs these cats use are launchable, LaunchLab-ready and Token-2022. I re-fetched the live list at 20:51 UTC and none of the 69 had changed.
5. **Backpack ('Sunrise') quote tokens** have no transfer fee (on-chain re-read today), but each issuer holds a permanent delegate, a pause switch (not paused) and freeze authority, so the issuer can move, pause or freeze the quote token.
6. **Pre-IPO quote tokens charge a transfer fee** each time they move, so every buy or sell of a cat paired with one pays it on the quote side, on top of the pool fee. The five PreStocks-only pairs (ANTHROPIC, ANDURIL, POLYMARKET, NEURALINK, FIGUREAI) and the PreStocks OPENAI and KALSHI pairs take **1% now and 3% from epoch 1043**. When I read the chain at 20:47 UTC it was epoch 1042, slot 320,270 of 432,000, so 3% starts around 09:00–10:00 UTC on 26 Sep 2026. The Tessera OPENAI and KALSHI pairs take 0.2% and have no permanent delegate. None of these tokens is company stock: PreStocks are SPV-backed, Tessera is a share-backed loan participation.
7. **Always paste the mint.** OPENAI and KALSHI each have two real pairs, so you pick one. MRNA, GPRO, AMC and HTZ share their symbol with custom look-alike tokens; the mints below are the Backpack ones.
8. **Your calls.** OPENAI and KALSHI: which pair (Tessera 0.2% fee, or PreStocks 1% rising to 3%). DJT: the disclaimer names the company by its short name, TMTG, because its legal name contains a person's name. SCHH: its cat rests on a weak link (a rescue's photo for the company's volunteers); the notes' fallback is a brick-red or slate-grey look. WEBULL: "rise and dip like a chart" describes stripes and promises nothing, but you may prefer a softer line.
9. **Checks.** At 20:50 UTC I re-ran the repo's content rules on the final text of all 67 and searched Jupiter for every symbol: 67/67 pass. checkProposal and displaySafe are clean for every name, symbol and story, and checkFields is clean on name, symbol, story and look. On the full description, checkFields flags only the required disclaimer (the company or "stonkfun" as a brand, "affiliated", "financial advice"), the same three hits as the disclaimer alone. No symbol matches any token on Jupiter, verified or not. Across both sheets' 91 coins there are no repeated names or symbols. Each entry's full check record is in `launch-sheet.json`.

## Index

**Backpack stocks and funds (Sunrise tab)**

| # | Pair | Symbol | Token name |
|---|---|---|---|
| 1 | MU | `MEMOPAW` | Memo the Pastel Calico |
| 2 | ROBOSTRATEGY | `GIMBALPAW` | Gimbal the Helper Cat |
| 3 | SKHY | `CLOCKPAW` | Clockout the Ginger Cat |
| 4 | SNDK | `KEEPSAKE` | Keepsake the Silver-Tipped Cat |
| 5 | DRAM | `PINROW` | Pinrow the Glossy Cat |
| 6 | TTWO | `PUZZLEPAW` | Puzzle the Silver Cat |
| 7 | NBIS | `SAFFWHISK` | Saffron the Long-Whisker Cat |
| 8 | MRNA | `NOTEPAW` | Courier the Ribbon Tabby |
| 9 | LLY | `APOTHECAT` | Thyme the Apothecary Cat |
| 10 | MRVL | `COBBLEPAW` | Cobble the Street Tabby |
| 11 | GPRO | `SCUFFPAW` | Scuff the Tabby-and-White Cat |
| 12 | AMC | `KERNELPAW` | Kernel the Butter-Patch Cat |
| 13 | NIKE | `TREADPAW` | Tread the Soft-Step Cat |
| 14 | SPHR | `TOUSLE` | Tousle the Curly-Ruff Cat |
| 15 | HTZ | `GLINTPAW` | Glint the Silver-Sedan Cat |
| 16 | RDDT | `HUBBUB` | Hubbub the Stubby Tabby Cat |
| 17 | COST | `BOXWOOD` | Boxwood the Big Calico |
| 18 | DELL | `LIDNAP` | Lidnap the Tortie Cat |
| 19 | DJT | `PAWPOST` | Tack the Noticeboard Cat |
| 20 | IBM | `TALLYSPOT` | Tally the Sand-Spotted Cat |
| 21 | LMT | `VELVETPAW` | Velvet the Shadow-Spot Cat |
| 22 | QUBT | `PRISMPAW` | Prism the Silver Beam Cat |
| 23 | RBLX | `TARTANPAW` | Tartan the Yellow-Tie Cat |
| 24 | HIMS | `BURLYPAW` | Burly the Honey-and-White Cat |
| 25 | LULU | `SUNSTRETCH` | Sunstretch the Red Tabby Cat |
| 26 | PFIZER | `INKCAP` | Inkcap the Round Garden Cat |
| 27 | RIVN | `NIGHTSEAT` | Nightseat the Black Cat |
| 28 | SHOP | `KIOSKPAW` | Kiosk the Spotted Ginger Cat |
| 29 | SNAP | `SANDSTEP` | Sandstep the Tawny Cat |
| 30 | UPS | `WAYBILL` | Waybill the Label-Bib Cat |
| 31 | PENG | `WHIRRPAW` | Whirr the Blue-Grey Cat |
| 32 | BOEING | `WINDSOCK` | Windsock the Ginger Tabby Cat |
| 33 | AMBA | `VIGNETPAW` | Vignette the Seal-Point Cat |
| 34 | WEBULL | `CANDLEWICK` | Candlewick the Barred Tabby Cat |
| 35 | JNJ | `JOWLS` | Jowls the Big Grey Cat |
| 36 | BABA | `LACQUER` | Lacquer the Sleek Black Cat |
| 37 | GRND | `STRPNOSE` | Stripenose the Tuxedo Cat |
| 38 | MGM | `SORRELPAW` | Sorrel the Sand-Fawn Cat |
| 39 | DNUT | `SUGARSOOT` | Sugarsoot the Sparkle-Black Cat |
| 40 | WEN | `GRIDDLE` | Griddle the Grill-Stripe Cat |
| 41 | DKNG | `ROOKIEPAW` | Rookie the Chestnut Cat |
| 42 | FLWS | `CORSAGE` | Corsage the White Kitten |
| 43 | SCHH | `RAFTERPAW` | Rafter the Peach-Patch Cat |
| 44 | PTN | `UMBERPAW` | Umber the Deep-Brown Cat |
| 45 | FLY | `PUMICE` | Pumice the Moon-Dust Cat |
| 46 | BROS | `JITTERPAW` | Jitter the Beanie Cat |
| 47 | AMD | `STUBTAIL` | Stubtail the Tufted Cat |
| 48 | FWDI | `CASENAP` | Satchel the Ginger-Point Cat |
| 49 | LUV | `PAPRIKA` | Paprika the Ruddy Kitten |
| 50 | WULF | `SNUGPAW` | Snug the Graphite Cat |
| 51 | RUM | `HEARTHBIB` | Hearthbib the Fluffy Cat |
| 52 | USO | `AMBERDROP` | Amberdrop the Tortie Cat |
| 53 | CYPH | `DROWSEPAW` | Drowse the Dark-Ruffed Cat |
| 54 | BB | `CURFEWPAW` | Curfew the Seal-Brown Cat |
| 55 | URA | `LICHENPAW` | Lichen the Sage-Grey Cat |
| 56 | COPX | `RUSTLEPAW` | Rustle the Burnished Tabby |
| 57 | IONQ | `ICICLEPAW` | Icicle the Blue-Point Cat |
| 58 | ARM | `RIMESTRIPE` | Rimestripe the Blue Tabby Cat |
| 59 | CRWV | `CABLETAIL` | Cabletail the Charcoal Tabby |
| 60 | IREN | `MILLRACE` | Millrace the Blue-Grey Cat |

**Pre-IPO (PreStocks and Tessera tabs)**

| # | Pair | Symbol | Token name |
|---|---|---|---|
| 61 | OPENAI | `PARLORPUFF` | Parlor Puff the Portrait Cat |
| 62 | KALSHI | `SQUINTPAW` | Squint the Weathervane Tabby |
| 63 | ANTHROPIC | `COTTAPAW` | Cotta the Terracotta Cat |
| 64 | ANDURIL | `HOVERPAW` | Hover the Cinnamon Cat |
| 65 | POLYMARKET | `HUNCHPAW` | Hunch the Cream Tabby |
| 66 | NEURALINK | `SILKSTRIPE` | Silk the Pinstripe Cat |
| 67 | FIGUREAI | `KNITPAW` | Knit the Woolly Grey Cat |

## Backpack stocks and funds (60 cats, Sunrise tab)

### 1. MU → MEMOPAW

- **Token name:** `Memo the Pastel Calico`
- **Symbol:** `MEMOPAW`
- **Token image:** `images/MEMOPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1` into the search box and pick **MU** (listed as "Micron").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Memo, a plush white cat with a blue-grey cap over her ears and a peach dab on her brow, sits by the shed window and never forgets a face. A cat coin priced in MU. Not affiliated with Micron Technology, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the employee's pet that Micron's own account posted for National Pet Day 2025: a pale dilute calico with a blue-grey cap. 'Never forgets a face' is the only nod to memory.
- **Pair note:** StonkFun: MU (Micron), category backpack ('Sunrise'), launchable true, LaunchLab-ready true, symbolAmbiguous false, Token-2022. I re-read the mint on-chain on 2026-09-25: there is no transferFeeConfig, so no transfer fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 2. ROBOSTRATEGY → GIMBALPAW

- **Token name:** `Gimbal the Helper Cat`
- **Symbol:** `GIMBALPAW`
- **Token image:** `images/GIMBALPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `BoTx8y9ynfdxf5ZjWtCoBVkff52qKA82ysaLU8ZM6d8T` into the search box and pick **ROBOSTRATEGY** (listed as "BOT").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Gimbal, a gunmetal and white tuxedo cat with green eyes, copies the sanctuary gardener, patting the soil and nudging pots into tidy rows. A cat coin priced in ROBOSTRATEGY. Not affiliated with RoboStrategy, Inc. or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No real cat link (the only one is a trademarked game), so the look comes from robotics: a gunmetal tuxedo that copies the gardener, the way robots learn by imitation.
- **Pair note:** StonkFun: ROBOSTRATEGY (name 'BOT'), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority, and a transferHook authority with no hook program set.

### 3. SKHY → CLOCKPAW

- **Token name:** `Clockout the Ginger Cat`
- **Symbol:** `CLOCKPAW`
- **Token image:** `images/CLOCKPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `SKHYhSjuRWHgikq8eRKbtBbpABgJSkd7ytQV14i9EQ3` into the search box and pick **SKHY** (listed as "SKHYNIX").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Clockout, a fluffy ginger tabby with faint forehead stripes and big dark eyes, wears a teal collared shirt and trots home the moment work ends. A cat coin priced in SKHY. Not affiliated with SK hynix, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the office-worker cat in SK hynix's own newsroom and YouTube shorts: a ginger tabby in a teal collared shirt, kept because the source cat wears it.
- **Pair note:** StonkFun: SKHY (SKHYNIX), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 4. SNDK → KEEPSAKE

- **Token name:** `Keepsake the Silver-Tipped Cat`
- **Symbol:** `KEEPSAKE`
- **Token image:** `images/KEEPSAKE.png`
- **Quote token:** open the **Sunrise** tab, paste `SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH` into the search box and pick **SNDK** (listed as "SANDISK").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Keepsake, a silver-tipped white longhair with dark-rimmed eyes, naps on a red blanket by the lamp and remembers every lap she knows. A cat coin priced in SNDK. Not affiliated with Sandisk Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the white longhair cats in Sandisk's own 'CATS!' ads: a flat-faced, silver-tipped white longhair napping on the ad's red blanket.
- **Pair note:** StonkFun: SNDK (SANDISK), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 5. DRAM → PINROW

- **Token name:** `Pinrow the Glossy Cat`
- **Symbol:** `PINROW`
- **Token image:** `images/PINROW.png`
- **Quote token:** open the **Sunrise** tab, paste `DRAMjSWR7HRfJKjRkvQWYL2bcaejaVhuxEcjf4pAY4Cw` into the search box and pick **DRAM**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Pinrow, a glossy jet-black shorthair with silver whiskers and copper eyes, lies long and flat along the top of the garden wall. A cat coin priced in DRAM. Not affiliated with Roundhill Investments, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. Memory chips are glossy black packages with silver pins and copper wiring, so a glossy black cat with silver whiskers and copper eyes lies flat like a chip.
- **Pair note:** StonkFun: DRAM, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 6. TTWO → PUZZLEPAW

- **Token name:** `Puzzle the Silver Cat`
- **Symbol:** `PUZZLEPAW`
- **Token image:** `images/PUZZLEPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo` into the search box and pick **TTWO**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Puzzle, a light silver-grey cat with white cheek tufts and a white bib, lines up fallen petals in neat rows of three. A cat coin priced in TTWO. Not affiliated with Take-Two Interactive Software, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the grey cat character in the company's Zynga puzzle game: light silver-grey with a white muzzle, cheek tufts and bib. The cartoon clothes are left out.
- **Pair note:** StonkFun: TTWO, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 7. NBIS → SAFFWHISK

- **Token name:** `Saffron the Long-Whisker Cat`
- **Symbol:** `SAFFWHISK`
- **Token image:** `images/SAFFWHISK.png`
- **Quote token:** open the **Sunrise** tab, paste `NBiSF3UaVUFtRzHwAfxyHsBCAZWGEKnMpewAE4oh7BG` into the search box and pick **NBIS**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Saffron, a burnt-orange tabby with black stripes, white brows and very long white whiskers, stares down the garden sprinkler at dusk. A cat coin priced in NBIS. Not affiliated with Nebius Group N.V., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (the AI tiger in Nebius's own blog) becomes a house cat: a burnt-orange striped coat, white brows and very long white whiskers.
- **Pair note:** StonkFun: NBIS, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 8. MRNA → NOTEPAW

- **Token name:** `Courier the Ribbon Tabby`
- **Symbol:** `NOTEPAW`
- **Token image:** `images/NOTEPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `MRNAzXzhNcaEXJPibHEn8cd4vyekCDiivTyEwswLUCT` into the search box and pick **MRNA** (listed as "MODERNA").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Courier, a silver tabby with looping ribbon-like swirls on each flank, carries folded notes from the potting shed to the pond and never drops one. A cat coin priced in MRNA. Not affiliated with Moderna, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. Messenger RNA carries instructions, so a silver classic tabby with ribbon-like swirls carries folded notes.
- **Pair note:** StonkFun lists two MRNA pairs (symbolAmbiguous true): launch against the backpack pair MODERNA (MRNAzX…LUCT), not the custom pair 'Moderna Inc.' (5DQw…jcra). The backpack pair is launchable and LaunchLab-ready, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 9. LLY → APOTHECAT

- **Token name:** `Thyme the Apothecary Cat`
- **Symbol:** `APOTHECAT`
- **Token image:** `images/APOTHECAT.png`
- **Quote token:** open the **Sunrise** tab, paste `LLYuwZ33keFihgwoxXsBawy31AiRFLFSva32TYq5TvD` into the search box and pick **LLY**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Thyme, a smoky sage-grey mackerel tabby with olive eyes, dozes among old glass jars and pots of rosemary in the garden's herb bed. A cat coin priced in LLY. Not affiliated with Eli Lilly and Company, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. The company grew out of a drugstore, so a sage-grey tabby dozes among apothecary jars and herbs.
- **Pair note:** StonkFun: LLY, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 10. MRVL → COBBLEPAW

- **Token name:** `Cobble the Street Tabby`
- **Symbol:** `COBBLEPAW`
- **Token image:** `images/COBBLEPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `MRVLSjkR2ceUBukujaD3xCyHP1H3B2SzpsNTZF546jo` into the search box and pick **MRVL**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Cobble, a lean brown-grey mackerel tabby with a nicked ear and green-gold eyes, came in off the back lanes and walks the wall at dusk. A cat coin priced in MRVL. Not affiliated with Marvell Technology, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Marvell's own switch-chip codename is 'AlleyCat', so this is an ordinary brown-grey street tabby with a nicked ear. The codename itself is not used.
- **Pair note:** StonkFun: MRVL, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 11. GPRO → SCUFFPAW

- **Token name:** `Scuff the Tabby-and-White Cat`
- **Symbol:** `SCUFFPAW`
- **Token image:** `images/SCUFFPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `GPRR2u6NS5yBQHWGauoJ9HXgjrTH8dDsrBfTV5zAYvDH` into the search box and pick **GPRO**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Scuff, a sturdy brown tabby with a white nose stripe, white chest and white paws, zooms down a sloping Cat Sanctuary path and slides to a halt. A cat coin priced in GPRO. Not affiliated with GoPro, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the skateboarding cat in a video on GoPro's own YouTube channel: a sturdy brown tabby with a white nose stripe, chest and paws.
- **Pair note:** StonkFun lists GPRO under several pairs (symbolAmbiguous true). Launch against the backpack mint GPRR2u6…AYvDH, not the three custom 'GPRO' / 'GoPro' pairs (one is a pump.fun copy of the Backpack name). The backpack pair is launchable and LaunchLab-ready, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 12. AMC → KERNELPAW

- **Token name:** `Kernel the Butter-Patch Cat`
- **Symbol:** `KERNELPAW`
- **Token image:** `images/KERNELPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `AMC1qwR9KhiyrQBRPrxnfo4JfMeMZqEBvt5tgTytNNoc` into the search box and pick **AMC**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Kernel, a fluffy cream-white cat with butter-yellow patches and honey-gold eyes, naps in a buttery patch of sun on the garden bench. A cat coin priced in AMC. Not affiliated with AMC Entertainment, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** The only cat links are trademarked characters, so the look comes from cinema popcorn: a fluffy cream cat with butter-yellow patches.
- **Pair note:** StonkFun lists AMC under several pairs (symbolAmbiguous true). Launch against the backpack mint AMC1qwR9…NNoc, not the custom 'AMC' (9jaZ…VpkN) or 'A Meme Coin' pairs. The backpack pair is launchable and LaunchLab-ready, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 13. NIKE → TREADPAW

- **Token name:** `Tread the Soft-Step Cat`
- **Symbol:** `TREADPAW`
- **Token image:** `images/TREADPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `NKEda5nHhNGgjrE9nDdMvaEmkmJ96qqxzBVZEcKmjSg` into the search box and pick **NIKE**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Tread, a wiry jet-black shorthair with a soft matte coat, graphite-grey paw pads and gold eyes, pads silent circuits of the garden pond at dawn. A cat coin priced in NIKE. Not affiliated with NIKE, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No usable cat. A black-nubuck, graphite-matte shoe colourway gives a wiry matte-black cat with graphite paw pads; the colourway's name is never used.
- **Pair note:** StonkFun: NIKE, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 14. SPHR → TOUSLE

- **Token name:** `Tousle the Curly-Ruff Cat`
- **Symbol:** `TOUSLE`
- **Token image:** `images/TOUSLE.png`
- **Quote token:** open the **Sunrise** tab, paste `SPHRp8cZaSQBTp1KMNP4V1X821SXhXWt4Q2yLdyHzju` into the search box and pick **SPHR**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Tousle, a tawny-gold cat with a thick curly russet ruff and honey eyes, lounges in the white garden flowers like it's her stage. A cat coin priced in SPHR. Not affiliated with Sphere Entertainment Co., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (the lion in Sphere's own show) becomes a tawny-gold house cat with a curly russet ruff instead of a mane.
- **Pair note:** StonkFun: SPHR, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 15. HTZ → GLINTPAW

- **Token name:** `Glint the Silver-Sedan Cat`
- **Symbol:** `GLINTPAW`
- **Token image:** `images/GLINTPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `HTZsLG4zqaNvWMwXSLHH3GG5KyJpKwpBRsKVdMG6hvzP` into the search box and pick **HTZ** (listed as "Hertz").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Glint, a sleek silver-grey shorthair with a glossy just-washed coat and copper eyes, sunbathes on warm stones in the sanctuary garden. A cat coin priced in HTZ. Not affiliated with Hertz Global Holdings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. Car rental suggests a freshly washed silver car, so a glossy silver-grey cat with copper eyes.
- **Pair note:** StonkFun marks HTZ as ambiguous. Launch against the backpack mint HTZsLG4…hvzP, not the custom pump token 'Hertz Global Holdings Inc' (EnA5…pump). The backpack pair is launchable and LaunchLab-ready, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 16. RDDT → HUBBUB

- **Token name:** `Hubbub the Stubby Tabby Cat`
- **Symbol:** `HUBBUB`
- **Token image:** `images/HUBBUB.png`
- **Quote token:** open the **Sunrise** tab, paste `RDDTGbhHwVXfyCvQMXzzowKjf5qrYBZAnehoXW83ooh` into the search box and pick **RDDT**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Hubbub, a short-legged brown tabby with a cream bib and white toe tips, trots between the garden benches to hear every lively chat. A cat coin priced in RDDT. Not affiliated with Reddit, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the short-legged rescue cat from the spinning-cat meme that Reddit's own blog named 'Top Shelf Meme': a brown tabby with a cream bib and white toes.
- **Pair note:** StonkFun: RDDT, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority. Do not confuse it with the unrelated custom pair 'r/snoofi'.

### 17. COST → BOXWOOD

- **Token name:** `Boxwood the Big Calico`
- **Symbol:** `BOXWOOD`
- **Token image:** `images/BOXWOOD.png`
- **Quote token:** open the **Sunrise** tab, paste `CZEB3WNZuF2Yz1z2H81RcCk8T7fsw82KB33zqamASVsg` into the search box and pick **COST**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Boxwood, a big broad-chested calico with cardboard-tan and black patches on white, naps on a tall stack of boxes in the garden shed. A cat coin priced in COST. Not affiliated with Costco Wholesale, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link (the licensed character sold in its stores is not used). Bulk boxed goods give a big white calico with cardboard-tan patches, napping on stacked boxes.
- **Pair note:** StonkFun: COST, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 18. DELL → LIDNAP

- **Token name:** `Lidnap the Tortie Cat`
- **Symbol:** `LIDNAP`
- **Token image:** `images/LIDNAP.png`
- **Quote token:** open the **Sunrise** tab, paste `DELL2aRKQz7DMq5DrKLtkn47ZCnbxXPZXrSGbkmd13wy` into the search box and pick **DELL**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Lidnap, a small chocolate-and-red tortie with copper eyes, folds flat as a closed laptop lid on the warm potting-shed windowsill. A cat coin priced in DELL. Not affiliated with Dell Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No usable cat (the old webcam kitten is a third-party meme tied to a private person), so a small chocolate-and-red tortie folds flat as a closed laptop lid.
- **Pair note:** StonkFun: DELL, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 19. DJT → PAWPOST

- **Token name:** `Tack the Noticeboard Cat`
- **Symbol:** `PAWPOST`
- **Token image:** `images/PAWPOST.png`
- **Quote token:** open the **Sunrise** tab, paste `DJTu7vi8norVzdVAffgvb39VP7wjKeTsgaMBJrzfxvoF` into the search box and pick **DJT**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Tack, a sleek ginger tabby with swirled rust stripes and green eyes, stamps a paw print on every note pinned to the garden noticeboard. A cat coin priced in DJT. Not affiliated with TMTG, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** The coat follows the one cat tied to the stock, an AI 'orange tabby' image posted on the company's platform, made sleek. The noticeboard nods to a posting platform; nothing political is used.
- **Pair note:** StonkFun: DJT, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority. The owner decides whether the TMTG short name in the disclaimer is acceptable.

### 20. IBM → TALLYSPOT

- **Token name:** `Tally the Sand-Spotted Cat`
- **Symbol:** `TALLYSPOT`
- **Token image:** `images/TALLYSPOT.png`
- **Quote token:** open the **Sunrise** tab, paste `BMKdM4yUxX12moFqVk195k7coMbaybd4RUKCUdm7D1Sk` into the search box and pick **IBM**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Tally, a lean sandy-gold cat with black spots, dark tear-marks and a white-tipped tail, counts the pond's goldfish each morning and never misses one. A cat coin priced in IBM. Not affiliated with IBM, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (IBM's own spotted-big-cat codename for a database server) becomes a lean sandy-gold spotted cat with tear-marks. Counting nods to business machines.
- **Pair note:** StonkFun: IBM, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 21. LMT → VELVETPAW

- **Token name:** `Velvet the Shadow-Spot Cat`
- **Symbol:** `VELVETPAW`
- **Token image:** `images/VELVETPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `LMT3i1BHgixFqPUgcyteJhnEz2dpy9i3cYy4pi9BoeV` into the search box and pick **LMT**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Velvet, a sleek glossy-black shorthair whose coat shows faint darker rosettes in bright sun, watches the pond with round golden eyes. A cat coin priced in LMT. Not affiliated with Lockheed Martin, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (a Lockheed pod's export name means 'panther') becomes a glossy black cat whose ghost rosettes show only in bright sun.
- **Pair note:** StonkFun: LMT, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 22. QUBT → PRISMPAW

- **Token name:** `Prism the Silver Beam Cat`
- **Symbol:** `PRISMPAW`
- **Token image:** `images/PRISMPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `QUBTAD8C9bMU9LvmMNgKPhrmBGbHvxpu6vfWQtThxxw` into the search box and pick **QUBT**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Prism, a sleek silver cat with small dark spots and ice-blue eyes, chases the rainbow dots a glass prism casts on the garden wall. A cat coin priced in QUBT. Not affiliated with Quantum Computing Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link (only a person's physics papers). Photonics, the business, gives a silver spotted cat chasing the light dots from a prism.
- **Pair note:** StonkFun: QUBT, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 23. RBLX → TARTANPAW

- **Token name:** `Tartan the Yellow-Tie Cat`
- **Symbol:** `TARTANPAW`
- **Token image:** `images/TARTANPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `RBLXDGRD64AtRamHMFVcjqne3Ar7NLWtFtYNtsrf1cE` into the search box and pick **RBLX**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Tartan, a sleek jet-black cat with round lemon-yellow eyes, wears a yellow plaid necktie and sits up straight on the sunny garden bench. A cat coin priced in RBLX. Not affiliated with Roblox Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows a 2013 cat item from Roblox's own account: a slim black cat with round yellow eyes and a yellow plaid tie, kept because the source cat wears it.
- **Pair note:** StonkFun: RBLX, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 24. HIMS → BURLYPAW

- **Token name:** `Burly the Honey-and-White Cat`
- **Symbol:** `BURLYPAW`
- **Token image:** `images/BURLYPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `HiMSSzzwkZkrXJ4PGVJRdtfLaANeAztjjcgk5Dxe7Lwx` into the search box and pick **HIMS**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Burly, a stocky, muscular honey-and-white shorthair with a broad white chest and white paws, meets the weekly delivery box at the gate. A cat coin priced in HIMS. Not affiliated with Hims & Hers Health, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** The muscular build follows the company's own 2021 flexing text-art cat; the coat comes from the business, orders delivered to the door: a stocky honey-and-white cat.
- **Pair note:** StonkFun: HIMS, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 25. LULU → SUNSTRETCH

- **Token name:** `Sunstretch the Red Tabby Cat`
- **Symbol:** `SUNSTRETCH`
- **Token image:** `images/SUNSTRETCH.png`
- **Quote token:** open the **Sunrise** tab, paste `LULUmT9VMttkfAJE236LXJcYJ2tTP7nunrSWR5G1BdS` into the search box and pick **LULU**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Sunstretch, a red-orange tabby with bold black stripes and copper eyes, starts each day with one long stretch on the warm garden path. A cat coin priced in LULU. Not affiliated with lululemon athletica, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (the 2022 red tiger-print Lunar New Year collection) becomes a red-orange tabby with bold black stripes. The stretch nods to athletic wear.
- **Pair note:** StonkFun: LULU, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 26. PFIZER → INKCAP

- **Token name:** `Inkcap the Round Garden Cat`
- **Symbol:** `INKCAP`
- **Token image:** `images/INKCAP.png`
- **Quote token:** open the **Sunrise** tab, paste `PFER6ENqP8r8NF3CqVt4mFowxsin3V5MLidBNQFCC3x` into the search box and pick **PFIZER**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Inkcap, a round cream-white cat with a charcoal cap between pink ears, charcoal back patches and olive-gold eyes, dozes by the mushroom ring. A cat coin priced in PFIZER. Not affiliated with Pfizer, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the cat that hosts Pfizer Japan's own children's video on antimicrobial resistance: a round cream cat with a charcoal cap, back patches and a hooked tail.
- **Pair note:** StonkFun: PFIZER, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 27. RIVN → NIGHTSEAT

- **Token name:** `Nightseat the Black Cat`
- **Symbol:** `NIGHTSEAT`
- **Token image:** `images/NIGHTSEAT.png`
- **Quote token:** open the **Sunrise** tab, paste `RcZmt84VMJv9bDhKqmw1uWDahYrUT468VwAChTnfD8p` into the search box and pick **RIVN**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Nightseat, a sleek black shorthair with gold-green eyes and an aqua patterned collar, always takes the highest perch in the garden. A cat coin priced in RIVN. Not affiliated with Rivian Automotive, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the black cat in Rivian's own National Pet Day story: slim, gold-green eyes and an aqua patterned collar, kept because the source cat wears it.
- **Pair note:** StonkFun: RIVN, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 28. SHOP → KIOSKPAW

- **Token name:** `Kiosk the Spotted Ginger Cat`
- **Symbol:** `KIOSKPAW`
- **Token image:** `images/KIOSKPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `SH55hfaipFAbwT42nQYhRoM5o5t61QpkmJ6p62vXB3m` into the search box and pick **SHOP**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Kiosk, a plump ginger cat with rust-red spots and green-gold eyes, sits on the garden stall counter and bats the brass bell for each visitor. A cat coin priced in SHOP. Not affiliated with Shopify, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. In-person checkout at a counter gives a plump spotted ginger cat on a stall counter beside a brass bell.
- **Pair note:** StonkFun: SHOP, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 29. SNAP → SANDSTEP

- **Token name:** `Sandstep the Tawny Cat`
- **Symbol:** `SANDSTEP`
- **Token image:** `images/SANDSTEP.png`
- **Quote token:** open the **Sunrise** tab, paste `SNAPcESrvnH8yUdgeMF6xm1hym9b6hW6s8YeqeHdZFz` into the search box and pick **SNAP**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Sandstep, a lean tawny shorthair with a cream chest, dark-tipped tail and honey eyes, trots across the little garden footbridge every dusk. A cat coin priced in SNAP. Not affiliated with Snap Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (Snap's own AR lens of mountain lions) becomes a lean tawny house cat with a cream chest and a dark tail tip.
- **Pair note:** StonkFun: SNAP, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 30. UPS → WAYBILL

- **Token name:** `Waybill the Label-Bib Cat`
- **Symbol:** `WAYBILL`
- **Token image:** `images/WAYBILL.png`
- **Quote token:** open the **Sunrise** tab, paste `UPSqUeMHcWbkdg784XuBUEF9DtySSnW9ur5LAVdcuB9` into the search box and pick **UPS**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Waybill, a slate-grey cat with a square white bib like a shipping label and four white socks, waits by the garden gate each morning. A cat coin priced in UPS. Not affiliated with United Parcel Service, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. Package shipping gives a slate-grey cat with a square white bib like a shipping label; the brand's brown is avoided.
- **Pair note:** StonkFun: UPS, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 31. PENG → WHIRRPAW

- **Token name:** `Whirr the Blue-Grey Cat`
- **Symbol:** `WHIRRPAW`
- **Token image:** `images/WHIRRPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `PENGTDQeQSXEjKcYw3CTQi9qznxcTHXAA7LMfUNrxLV` into the search box and pick **PENG**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Whirr, a smoky blue-grey shorthair with bright green eyes, purrs a steady low hum and keeps one eye open over the garden all night long. A cat coin priced in PENG. Not affiliated with Penguin Solutions, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link (the mascot is a penguin). AI server racks give a smoky blue-grey cat with status-light green eyes and a steady purring hum.
- **Pair note:** StonkFun: PENG, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. Do not pick the unrelated custom pairs PENGU or PENGUIN. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 32. BOEING → WINDSOCK

- **Token name:** `Windsock the Ginger Tabby Cat`
- **Symbol:** `WINDSOCK`
- **Token image:** `images/WINDSOCK.png`
- **Quote token:** open the **Sunrise** tab, paste `BArimz1PcKZr8PcPh3tcZ2dg4S7FJLk3cw6R5F8GsHKg` into the search box and pick **BOEING**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Windsock, a ginger tabby with a white chest, white paws and a striped orange tail, sits on the shed to watch which way the wind blows. A cat coin priced in BOEING. Not affiliated with The Boeing Company, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the ginger-and-white kitten that Boeing's own @BoeingAirplanes account posted in 2023. A windsock is a generic airfield object.
- **Pair note:** StonkFun: BOEING (on-chain symbol BA), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 33. AMBA → VIGNETPAW

- **Token name:** `Vignette the Seal-Point Cat`
- **Symbol:** `VIGNETPAW`
- **Token image:** `images/VIGNETPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `AMBAHqGPjjtJaHPPSuvPu2mPCJdkGZpmhHQa5pkXbxrM` into the search box and pick **AMBA**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Vignette, a cream seal-point cat with a dark brown mask, ears, paws and tail, gazes out of the deep shade with wide sky-blue eyes. A cat coin priced in AMBA. Not affiliated with Ambarella, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. In camera imaging a vignette is the dark edge around a bright picture, so a pale cream seal-point cat with dark points.
- **Pair note:** StonkFun: AMBA, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 34. WEBULL → CANDLEWICK

- **Token name:** `Candlewick the Barred Tabby Cat`
- **Symbol:** `CANDLEWICK`
- **Token image:** `images/CANDLEWICK.png`
- **Quote token:** open the **Sunrise** tab, paste `BULL151gUXcFV5wXEUqu9Am2L7Qt4bTJRLRuAUjkcspC` into the search box and pick **WEBULL**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Candlewick, a brown tabby with dark side bars that rise and dip like a chart, sits on the garden wall watching every flicker. A cat coin priced in WEBULL. Not affiliated with Webull Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No usable cat. A trading platform's charts give a brown tabby with dark side bars, named after a chart candle's wick.
- **Pair note:** StonkFun: WEBULL (on-chain symbol BULL), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 35. JNJ → JOWLS

- **Token name:** `Jowls the Big Grey Cat`
- **Symbol:** `JOWLS`
- **Token image:** `images/JOWLS.png`
- **Quote token:** open the **Sunrise** tab, paste `JNJg1znKdF712Phe7L7z52AATAvEjEytBdN2w8Lnh1Y` into the search box and pick **JNJ**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Jowls, a heavy round-cheeked grey shorthair with sleepy half-shut eyes and a thick ruff, sits as still as an old photo on the garden wall. A cat coin priced in JNJ. Not affiliated with Johnson & Johnson, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the big jowly cat in an archive photo on J&J's own heritage page. The photo is black and white, so the grey shade and eye colour are guesses.
- **Pair note:** StonkFun: JNJ, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 36. BABA → LACQUER

- **Token name:** `Lacquer the Sleek Black Cat`
- **Symbol:** `LACQUER`
- **Token image:** `images/LACQUER.png`
- **Quote token:** open the **Sunrise** tab, paste `BABANGA4JE7Kkam4nTrALAwAVgsNJUuFJnnkF7S16BZp` into the search box and pick **BABA**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Lacquer, a sleek jet-black shorthair with a mirror-glossy coat and bright gold eyes, sits tall on the garden gatepost to greet each visitor. A cat coin priced in BABA. Not affiliated with Alibaba Group, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the company's marketplace black-cat mascot, described as 'a sleek and fashionable black cat', in generic words only.
- **Pair note:** StonkFun: BABA, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 37. GRND → STRPNOSE

- **Token name:** `Stripenose the Tuxedo Cat`
- **Symbol:** `STRPNOSE`
- **Token image:** `images/STRPNOSE.png`
- **Quote token:** open the **Sunrise** tab, paste `GRNDYDpqwpCm6jVxpbh4xT5AM4r3p391qYsKTHqgaET2` into the search box and pick **GRND**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Stripenose, a black tuxedo shorthair with a thin white nose stripe, white bib and olive-green eyes, greets every neighbour on the garden path. A cat coin priced in GRND. Not affiliated with Grindr Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows a real missing tuxedo cat that was put on a dating-app profile (The Argus, 2023): a black tuxedo with a thin white nose stripe.
- **Pair note:** StonkFun: GRND, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 38. MGM → SORRELPAW

- **Token name:** `Sorrel the Sand-Fawn Cat`
- **Symbol:** `SORRELPAW`
- **Token image:** `images/SORRELPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `MGMuubtUEirmkhfEQdmGUh4pr7HuUdMWcZXFtpPbVJD` into the search box and pick **MGM**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Sorrel, a sleek sand-fawn cat with a pale cream belly and dark-rimmed ears, creeps low through the tall reeds by the pond. A cat coin priced in MGM. Not affiliated with MGM Resorts International, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (MGM's 2019 lioness logo) becomes a sleek sand-fawn house cat with no mane.
- **Pair note:** StonkFun: MGM, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 39. DNUT → SUGARSOOT

- **Token name:** `Sugarsoot the Sparkle-Black Cat`
- **Symbol:** `SUGARSOOT`
- **Token image:** `images/SUGARSOOT.png`
- **Quote token:** open the **Sunrise** tab, paste `DNUTsCvKbKwu2RM72cUuW3TD9YpzArzACcqYQssjPLSk` into the search box and pick **DNUT**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Sugarsoot, a sleek black cat whose coat glints like sugar in the sun, with lime-green eyes and a white muzzle, sniffs the sweet morning air. A cat coin priced in DNUT. Not affiliated with Krispy Kreme, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows Krispy Kreme's own 2021 black-cat Halloween doughnut: a black coat that glints like sanding sugar, lime-green eyes and a white muzzle.
- **Pair note:** StonkFun: DNUT, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 40. WEN → GRIDDLE

- **Token name:** `Griddle the Grill-Stripe Cat`
- **Symbol:** `GRIDDLE`
- **Token image:** `images/GRIDDLE.png`
- **Quote token:** open the **Sunrise** tab, paste `WENAZ2WyPbmgvUcKfQ8hyMDfBQP9bZ65hsZ5KTFrRGZ` into the search box and pick **WEN**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Griddle, a toast-brown tabby with dark grill-bar stripes and leaf-green eyes, dozes on the warm patio bricks of the Cat Sanctuary. A cat coin priced in WEN. Not affiliated with The Wendy's Company, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** The only cat link is a trademarked toy, so a burger grill gives a toast-brown tabby with grill-bar stripes.
- **Pair note:** StonkFun: WEN, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 41. DKNG → ROOKIEPAW

- **Token name:** `Rookie the Chestnut Cat`
- **Symbol:** `ROOKIEPAW`
- **Token image:** `images/ROOKIEPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow` into the search box and pick **DKNG**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Rookie, a chestnut-brown shorthair with a thin white stripe down his chest and white toes, chases rolling acorns across the garden lawn. A cat coin priced in DKNG. Not affiliated with DraftKings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No usable cat. Fantasy football gives a chestnut coat with a white chest stripe like a football's laces, and a cat chasing acorns like a ball.
- **Pair note:** StonkFun: DKNG, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 42. FLWS → CORSAGE

- **Token name:** `Corsage the White Kitten`
- **Symbol:** `CORSAGE`
- **Token image:** `images/CORSAGE.png`
- **Quote token:** open the **Sunrise** tab, paste `FLWSojG1gB5VStYR3Sb4nQFRt43UBYkqih1j2CpVLqgd` into the search box and pick **FLWS**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Corsage, a round-faced white kitten with a thick, ruffled coat as crisp as fresh carnations, sits among pink and lavender blooms and purrs. A cat coin priced in FLWS. Not affiliated with 1-800-Flowers, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the company's own cat-shaped arrangement of white carnations: a fluffy white kitten among pink and lavender blooms.
- **Pair note:** StonkFun: FLWS, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 43. SCHH → RAFTERPAW

- **Token name:** `Rafter the Peach-Patch Cat`
- **Symbol:** `RAFTERPAW`
- **Token image:** `images/RAFTERPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `SCHHJ3jRdSjeFEVAaLrnYdx3Brphn92Ys7z1qkiCtPX` into the search box and pick **SCHH**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Rafter, a slim grey tabby-and-white cat with green-gold eyes and a faint peach hip patch, naps along a beam of the garden pergola. A cat coin priced in SCHH. Not affiliated with Schwab Asset Management, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A weak community link (a rescue's photo of tabby-and-white cats for the company's volunteers) gives a slim grey tabby-and-white cat; the pergola beam nods to property.
- **Pair note:** StonkFun: SCHH, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 44. PTN → UMBERPAW

- **Token name:** `Umber the Deep-Brown Cat`
- **Symbol:** `UMBERPAW`
- **Token image:** `images/UMBERPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `PTNzAfFAB4LvoUQEUUGrFMyUoRLExMYjH6CcfyQfsVP` into the search box and pick **PTN**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Umber, a sleek shorthair with a deep umber-brown coat that looks almost black in the shade and warm copper eyes, naps under the bay tree. A cat coin priced in PTN. Not affiliated with Palatin Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. The company's drugs target MC1R, the receptor behind dark pigment, so a deep umber-brown cat.
- **Pair note:** StonkFun: PTN, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 45. FLY → PUMICE

- **Token name:** `Pumice the Moon-Dust Cat`
- **Symbol:** `PUMICE`
- **Token image:** `images/PUMICE.png`
- **Quote token:** open the **Sunrise** tab, paste `FLYRq3en8r2Z69gN3KyAnDrvnitEJNkwPYY7favinHeD` into the search box and pick **FLY**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Pumice, a pale ash-grey shorthair flecked with darker grey, rolls in the dry garden path and leaves soft grey paw prints on every stone. A cat coin priced in FLY. Not affiliated with Firefly Aerospace, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link (the mascot is a duck). Moon landers give a moon-dust grey cat flecked like pumice, leaving soft paw prints.
- **Pair note:** StonkFun: FLY, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 46. BROS → JITTERPAW

- **Token name:** `Jitter the Beanie Cat`
- **Symbol:** `JITTERPAW`
- **Token image:** `images/JITTERPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `BRVaZKg6J9iF2BEsdpsxJ9NyvN9PPxPZuoQUX2v8qqkk` into the search box and pick **BROS** (listed as "Dutch Bros Inc").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Jitter, a scruffy black cat with big yellow eyes and a pink nose, wears a rust-orange knit beanie and grins at the first frosty autumn morning. A cat coin priced in BROS. Not affiliated with Dutch Bros, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the black cat in an orange knit beanie on the company's own October 2023 sticker; the beanie stays because the cat wears it.
- **Pair note:** StonkFun: BROS (Dutch Bros Inc), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 47. AMD → STUBTAIL

- **Token name:** `Stubtail the Tufted Cat`
- **Symbol:** `STUBTAIL`
- **Token image:** `images/STUBTAIL.png`
- **Quote token:** open the **Sunrise** tab, paste `AMD8XwJXgQ9WV45Wyj9yFLejxzf2J6VM1PJY8bJEjeES` into the search box and pick **AMD** (listed as "Advanced Micro Devices").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Stubtail, a tawny-grey spotted cat with a short bobbed tail, tufted ear tips and a white chin, naps on the woodpile and swats at bees. A cat coin priced in AMD. Not affiliated with Advanced Micro Devices, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (AMD's own 'Bobcat' CPU-core codename) becomes a tawny-grey spotted house cat with a bobbed tail and ear tufts.
- **Pair note:** StonkFun: AMD (Advanced Micro Devices), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 48. FWDI → CASENAP

- **Token name:** `Satchel the Ginger-Point Cat`
- **Symbol:** `CASENAP`
- **Token image:** `images/CASENAP.png`
- **Quote token:** open the **Sunrise** tab, paste `FWDtiB5fXHdVAewPqvHPL2dh4aBC1C6GacQbePoQXKjz` into the search box and pick **FWDI** (listed as "Forward Industries, Inc").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Satchel, a small cream cat with a ginger face, ears, paws and tail and blue eyes, naps in an old carrying case by the greenhouse door. A cat coin priced in FWDI. Not affiliated with Forward Industries, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. The company's long-running carrying-case business gives a cream flame-point cat napping in a soft-sided case.
- **Pair note:** StonkFun: FWDI (Forward Industries, Inc), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 49. LUV → PAPRIKA

- **Token name:** `Paprika the Ruddy Kitten`
- **Symbol:** `PAPRIKA`
- **Token image:** `images/PAPRIKA.png`
- **Quote token:** open the **Sunrise** tab, paste `LUV9GB51PNZNRyzzyYK3rtqFfvDvWtRiXZ34wVq2HrX` into the search box and pick **LUV** (listed as "Southwest Airlines Co.").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Paprika, a ruddy-orange kitten with a softly ticked fluffy coat, tall ears and a cream chin, watches the garden sparrows. A cat coin priced in LUV. Not affiliated with Southwest Airlines, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the headline kitten in Southwest's own National Cat Day travel video: a ruddy, ticked, fluffy kitten with tall ears and a cream chin.
- **Pair note:** StonkFun: LUV (Southwest Airlines Co.), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 50. WULF → SNUGPAW

- **Token name:** `Snug the Graphite Cat`
- **Symbol:** `SNUGPAW`
- **Token image:** `images/SNUGPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `WULFeyfrj1VJKD9HhRTcW8R4g5HefUA11HDEdBv2WxD` into the search box and pick **WULF** (listed as "TeraWulf").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Snug, a sleek graphite-grey shorthair with pale gold eyes, spends every afternoon stretched out on the warm air grate beside the potting shed. A cat coin priced in WULF. Not affiliated with TeraWulf, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link (the brand animal is a wolf). Warm, humming data centres give a graphite-grey cat stretched out on a warm air grate.
- **Pair note:** StonkFun: WULF (TeraWulf), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 51. RUM → HEARTHBIB

- **Token name:** `Hearthbib the Fluffy Cat`
- **Symbol:** `HEARTHBIB`
- **Token image:** `images/HEARTHBIB.png`
- **Quote token:** open the **Sunrise** tab, paste `RUMsPfFZFnN1ZmGANwP7FNMJMjKH4m9RiMePrtVtLe7` into the search box and pick **RUM** (listed as "RUM Group Inc.").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Hearthbib, a fluffy brown tabby with a white bib, white front legs and pale green eyes, stands up on her hind legs by the stone hearth. A cat coin priced in RUM. Not affiliated with RUM Group (Rumble), Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the cat in a licensed clip on Rumble's official YouTube channel: a fluffy brown tabby-and-white cat standing on its hind legs by a stone hearth.
- **Pair note:** StonkFun: RUM (RUM Group Inc.), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 52. USO → AMBERDROP

- **Token name:** `Amberdrop the Tortie Cat`
- **Symbol:** `AMBERDROP`
- **Token image:** `images/AMBERDROP.png`
- **Quote token:** open the **Sunrise** tab, paste `USNv3NkKA27Dh4nsHJDPhW4VoEcTQmjoZyJt2dqdwFu` into the search box and pick **USO** (listed as "United Sates Oil Fund, LP").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Amberdrop, a glossy black tortoiseshell shorthair with honey-gold patches and green-gold eyes, dozes in the sunny herb bed. A cat coin priced in USO. Not affiliated with United States Oil Fund, LP, USCF, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. As the brief says, an oil fund is a glossy black cat; honey-gold tortie patches add crude's amber tones.
- **Pair note:** StonkFun: USO, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. Do not pick the unrelated custom pump token UOTF. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 53. CYPH → DROWSEPAW

- **Token name:** `Drowse the Dark-Ruffed Cat`
- **Symbol:** `DROWSEPAW`
- **Token image:** `images/DROWSEPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `CYPHuMmCL1GxJWa2tsPhLKykC7GrHJTCHwbXD4g5uawK` into the search box and pick **CYPH**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Drowse, a big tawny longhair with a dark brown ruff and bright green eyes, sleeps through the busy afternoon and wakes for supper. A cat coin priced in CYPH. Not affiliated with Cypherpunk Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (the armoured lion in the company's own posts) becomes a big tawny longhair with the art's dark brown ruff; the unhurried sleeper echoes the posts' calm lion.
- **Pair note:** StonkFun: CYPH, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 54. BB → CURFEWPAW

- **Token name:** `Curfew the Seal-Brown Cat`
- **Symbol:** `CURFEWPAW`
- **Token image:** `images/CURFEWPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `BBosJLw8ZzoATiEyywiifx7AgmrD2Cm3XjFWbhbRhChy` into the search box and pick **BB** (listed as "BlackBerry").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Curfew, a sturdy seal-brown cat with a white bib, white socks and brass-gold eyes, walks the garden each night and checks every gate is shut. A cat coin priced in BB. Not affiliated with BlackBerry, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No usable cat (only licensed sticker characters), so security, the business, gives a seal-brown tuxedo who checks every gate at night.
- **Pair note:** StonkFun: BB (BlackBerry), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 55. URA → LICHENPAW

- **Token name:** `Lichen the Sage-Grey Cat`
- **Symbol:** `LICHENPAW`
- **Token image:** `images/LICHENPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `URARfsinxCRw4JpvQhuT4CxavdZXZEMjv9ZwWmWpwag` into the search box and pick **URA** (listed as "Global X Uranium ETF").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Lichen, a soft pale green-grey shorthair with bright lime-green eyes, curls up on the mossy garden rocks and purrs through every afternoon nap. A cat coin priced in URA. Not affiliated with Global X, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. It follows the brief's own example, uranium as a pale green-grey cat, with lime-green eyes.
- **Pair note:** StonkFun: URA (Global X Uranium ETF), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 56. COPX → RUSTLEPAW

- **Token name:** `Rustle the Burnished Tabby`
- **Symbol:** `RUSTLEPAW`
- **Token image:** `images/RUSTLEPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `CzLTZppPdZtTjyq3WGpHLstoc3GLhu7zH5Zg6xUa6Gv5` into the search box and pick **COPX** (listed as "Global X Copper Miners ETF").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Rustle, a burnished ginger tabby with dark rust-brown stripes and green eyes, pads through the tall grass and pounces on falling leaves. A cat coin priced in COPX. Not affiliated with Global X, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. Copper miners give a burnished red-orange tabby with dark rust-brown stripes.
- **Pair note:** StonkFun: COPX (Global X Copper Miners ETF), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 57. IONQ → ICICLEPAW

- **Token name:** `Icicle the Blue-Point Cat`
- **Symbol:** `ICICLEPAW`
- **Token image:** `images/ICICLEPAW.png`
- **Quote token:** open the **Sunrise** tab, paste `NQ5hSuXQZrbnrwcDVk2qN73njjd3E3v3badYHnj5thF` into the search box and pick **IONQ** (listed as "IonQ").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Icicle, an ice-white cat with slate-blue ears, mask, paws and tail and bright blue eyes, sits so still by the cold spring that moths land by him. A cat coin priced in IONQ. Not affiliated with IonQ, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link ('Walking Cat' is a physics term). Laser-cooled ions held very still give an icy blue-point cat who sits motionless.
- **Pair note:** StonkFun: IONQ, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 58. ARM → RIMESTRIPE

- **Token name:** `Rimestripe the Blue Tabby Cat`
- **Symbol:** `RIMESTRIPE`
- **Token image:** `images/RIMESTRIPE.png`
- **Quote token:** open the **Sunrise** tab, paste `ARMbSB1MBRQrY6PNMao1HdQ431VafC6JRJCsGZ2Yv3iJ` into the search box and pick **ARM** (listed as "Arm Holdings").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Rimestripe, a lean pale silver-blue tabby with slate-blue stripes and a frost-white face, pads the same loop round the pond each dusk. A cat coin priced in ARM. Not affiliated with Arm Holdings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** A big-cat link (the ice-blue tiger in Arm's own 2015 graphics demo) becomes a silver-blue tabby that walks the same loop, as in the demo.
- **Pair note:** StonkFun: ARM ('Arm Holdings'), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority. The scaled-UI authority is a separate key (per the drafter).

### 59. CRWV → CABLETAIL

- **Token name:** `Cabletail the Charcoal Tabby`
- **Symbol:** `CABLETAIL`
- **Token image:** `images/CABLETAIL.png`
- **Quote token:** open the **Sunrise** tab, paste `CRWVJeR2yEZuDUKYfGuKCHvLz8ywn4LGvovHfy5WiFmi` into the search box and pick **CRWV** (listed as "CoreWeave").
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Cabletail, a lean charcoal tabby whose bold black stripes run like bundled cables, threads through the flower beds and never gets tangled. A cat coin priced in CRWV. Not affiliated with CoreWeave, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. Data-centre fibre cabling gives a lean charcoal tabby with bold stripes like bundled cables.
- **Pair note:** StonkFun: CRWV ('CoreWeave'), backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 6 decimals. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

### 60. IREN → MILLRACE

- **Token name:** `Millrace the Blue-Grey Cat`
- **Symbol:** `MILLRACE`
- **Token image:** `images/MILLRACE.png`
- **Quote token:** open the **Sunrise** tab, paste `RENzhrJQgmAnfcLhU1U5XwAMc6TC15UA6jCbPBaasnj` into the search box and pick **IREN**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Millrace, a plush blue-grey tabby with rippling stripes and pale green eyes, sits by the mill stream watching the water turn the wooden wheel. A cat coin priced in IREN. Not affiliated with IREN Limited, Backpack Securities or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. The first data centre ran on hydro power at a former pulp mill, so a plush blue-grey 'river water' tabby by a mill stream.
- **Pair note:** StonkFun: IREN, backpack ('Sunrise'), launchable true, LaunchLab-ready true, not ambiguous, Token-2022. On-chain re-read 2026-09-25: no transferFeeConfig, so no fee. The issuer holds a permanentDelegate, pausable (not paused) and freeze authority.

## Pre-IPO (7 cats, PreStocks and Tessera tabs)

### 61. OPENAI → PARLORPUFF

- **Token name:** `Parlor Puff the Portrait Cat`
- **Symbol:** `PARLORPUFF`
- **Token image:** `images/PARLORPUFF.png`
- **Quote token:** pick **one** of the two OPENAI pairs (see the pair note):
  - **Tessera** tab: paste `oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ` and pick **OPENAI** (Tessera; transfer fee 0.2%)
  - **PreStocks** tab: paste `PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF` and pick **OPENAI** (PreStocks; transfer fee 1%, 3% from epoch 1043)
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Parlor Puff, a fluffy taupe tabby with a snowy ruff and big dark eyes, sits so still by the flower pots that visitors take her for a painting. A cat coin priced in OPENAI. Not affiliated with OpenAI, Tessera, PreStocks or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the real cat OpenAI's own X account posted in February 2024: a fluffy, flat-faced taupe tabby with a white ruff, muzzle and paws and near-black eyes.
- **Pair note:** StonkFun lists TWO OPENAI pairs (symbolAmbiguous true), so the owner must pick by mint. Both are launchable and LaunchLab-ready, both are Token-2022, and both have 9 decimals. (1) Tessera oPAi…kjTZ: transfer fee 20 bps (0.2%) since epoch 987, freeze authority, no permanent delegate. (2) PreStocks Prewe…rpgF: transfer fee 100 bps (1%) now, rising to 300 bps (3%) from epoch 1043. It also has a permanent delegate, pausable (not paused) and freeze authority. I re-read both mints on-chain on 2026-09-25 at epoch 1042, slot 313,110 of 432,000, so the 3% fee starts about 13 hours later. Neither token is equity: Tessera is a share-backed loan participation, PreStocks is SPV-backed.

### 62. KALSHI → SQUINTPAW

- **Token name:** `Squint the Weathervane Tabby`
- **Symbol:** `SQUINTPAW`
- **Token image:** `images/SQUINTPAW.png`
- **Quote token:** pick **one** of the two KALSHI pairs (see the pair note):
  - **Tessera** tab: paste `TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ` and pick **KALSHI** (Tessera; transfer fee 0.2%)
  - **PreStocks** tab: paste `PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua` and pick **KALSHI** (PreStocks; transfer fee 1%, 3% from epoch 1043)
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Squint, a stout brown-grey tabby with a striped brow and gold eyes, frowns at the clouds by the Cat Sanctuary weathervane, weighing rain or shine. A cat coin priced in KALSHI. Not affiliated with Kalshi, Tessera, PreStocks or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the unnamed tabby in Kalshi's own 2026 'Free Groceries' poster: a stout taupe mackerel tabby with a stern, gold-eyed frown. The weathervane suits a cat that guesses the weather.
- **Pair note:** StonkFun lists TWO KALSHI pairs (symbolAmbiguous true), so the owner must pick by mint. Both are launchable and LaunchLab-ready, both are Token-2022, and both have 9 decimals. (1) Tessera TKLS…mubeZ: 20 bps (0.2%) fee since epoch 922, freeze authority, no permanent delegate. (2) PreStocks PreL…eRua: 100 bps (1%) fee now, rising to 300 bps (3%) from epoch 1043 (about 13 hours after the 2026-09-25 re-read at epoch 1042, slot 313,110). It also has a permanent delegate, pausable (not paused) and freeze authority. Neither token is Kalshi equity.

### 63. ANTHROPIC → COTTAPAW

- **Token name:** `Cotta the Terracotta Cat`
- **Symbol:** `COTTAPAW`
- **Token image:** `images/COTTAPAW.png`
- **Quote token:** open the **PreStocks** tab, paste `Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw` into the search box and pick **ANTHROPIC**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Cotta, a sleek terracotta-orange cat with bright yellow eyes, lounges on the sanctuary garden bench and gives a sleepy wink to anyone hard at work. A cat coin priced in ANTHROPIC. Not affiliated with Anthropic, PreStocks or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Takes the one colour (#C55531) of the cat sprite in Anthropic's own desk-companion firmware: a plain terracotta cat with no markings.
- **Pair note:** StonkFun: ANTHROPIC, prestock, launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 9 decimals. On-chain re-read 2026-09-25: transfer fee 100 bps (1%) since epoch 1039, rising to 300 bps (3%) from epoch 1043, which starts about 13 hours after the read (epoch 1042, slot 313,110 of 432,000). The drafters found the maximum fee uncapped. There is also a permanent delegate, pausable (not paused) and freeze authority. This is an SPV exposure token, not shares.

### 64. ANDURIL → HOVERPAW

- **Token name:** `Hover the Cinnamon Cat`
- **Symbol:** `HOVERPAW`
- **Token image:** `images/HOVERPAW.png`
- **Quote token:** open the **PreStocks** tab, paste `PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB` into the search box and pick **ANDURIL**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Hover, a lean cinnamon shorthair with a cream chin and gold eyes, leaps after the dragonflies around the birdbath and seems to hang in the air. A cat coin priced in ANDURIL. Not affiliated with Anduril Industries, PreStocks or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No real cat link (the only lead, 'Team Lynx', is a partner's vehicle name), so the look comes from autonomous flying machines: a lean cinnamon cat leaping after dragonflies.
- **Pair note:** StonkFun: ANDURIL, prestock, launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 9 decimals. On-chain re-read 2026-09-25: transfer fee 100 bps (1%) since epoch 1039, rising to 300 bps (3%) from epoch 1043 (about 13 hours later). The drafters found the maximum fee uncapped. There is also a permanent delegate, pausable (not paused) and freeze authority. This is an SPV exposure token, not Anduril shares.

### 65. POLYMARKET → HUNCHPAW

- **Token name:** `Hunch the Cream Tabby`
- **Symbol:** `HUNCHPAW`
- **Token image:** `images/HUNCHPAW.png`
- **Quote token:** open the **PreStocks** tab, paste `Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP` into the search box and pick **POLYMARKET**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Hunch, a fluffy cream-ginger tabby with a round face and big copper eyes, sits by the Cat Sanctuary gate at dawn guessing which path visitors take. A cat coin priced in POLYMARKET. Not affiliated with Polymarket, PreStocks or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** Follows the kitten photo on Polymarket's own closed market 'First cat to $1b?': a fluffy cream-ginger tabby with copper eyes. Guessing which path visitors take nods to forecasting.
- **Pair note:** StonkFun: POLYMARKET, prestock, launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 9 decimals. Do not confuse it with the custom memecoin pair 'Polycat'. On-chain re-read 2026-09-25: transfer fee 100 bps (1%) now, rising to 300 bps (3%) from epoch 1043 (about 13 hours later). The drafters found it uncapped. There is also a permanent delegate, pausable (not paused) and freeze authority.

### 66. NEURALINK → SILKSTRIPE

- **Token name:** `Silk the Pinstripe Cat`
- **Symbol:** `SILKSTRIPE`
- **Token image:** `images/SILKSTRIPE.png`
- **Quote token:** open the **PreStocks** tab, paste `PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S` into the search box and pick **NEURALINK**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Silk, a sleek lilac tabby with hair-thin darker pinstripes and a white chin, slips between the fence rails so neatly she never bends a leaf. A cat coin priced in NEURALINK. Not affiliated with Neuralink, PreStocks or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link, so the look comes from the business: hair-thin electrode threads become hair-thin pinstripes. The lilac coat keeps it apart from the garden's many grey tabbies.
- **Pair note:** StonkFun: NEURALINK, prestock, launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 9 decimals. On-chain re-read 2026-09-25: transfer fee 100 bps (1%) since epoch 1039, rising to 300 bps (3%) from epoch 1043 (about 13 hours later). The drafters found it uncapped. There is also a permanent delegate, pausable (not paused) and freeze authority.

### 67. FIGUREAI → KNITPAW

- **Token name:** `Knit the Woolly Grey Cat`
- **Symbol:** `KNITPAW`
- **Token image:** `images/KNITPAW.png`
- **Quote token:** open the **PreStocks** tab, paste `PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd` into the search box and pick **FIGUREAI**.
- **Description** (for the cat's page and posts; StonkFun has no box for it):
  > Knit, a plush pale ash-grey tabby with a soft woolly coat and faint ribbed stripes, pads between the flowerpots so carefully that none ever tips over. A cat coin priced in FIGUREAI. Not affiliated with Figure AI, PreStocks or StonkFun. No intrinsic value; not financial advice.
- **Why it looks like this:** No cat link. The machine is covered in soft knit textiles, so a plush pale ash-grey cat with faint ribbed stripes and careful paws.
- **Pair note:** StonkFun: FIGUREAI, prestock, launchable true, LaunchLab-ready true, not ambiguous, Token-2022, 9 decimals. On-chain re-read 2026-09-25: transfer fee 100 bps (1%) since epoch 1039, rising to 300 bps (3%) from epoch 1043 (about 13 hours later). The drafters found it uncapped. There is also a permanent delegate, pausable (not paused) and freeze authority.
