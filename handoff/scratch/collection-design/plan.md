# The CIA's StonkFun cat collection: plan

A read-only review of `/home/user/Cat-Intelligence-Agency` at commit `486717d`. The repo was not changed.

## A. Verification

**Confirmed**
- **Repo state.** The WIP is committed (`486717d`) and the working tree is clean.
- **Two test files fail today.**
  - `test-cats-stockcats`: 117/1. `prepare_first` (`cashcat-tab.mjs:725`) runs outside the journaling `try`.
  - `test-hawk-manifest`: 49/3. The README host rows are missing.
- **Budgets.** `test-site` passes 345/0. Home is 2.69 MB of 3.5 MB; the floor is 1.84 MB of 2.5 MB.
- **Who launched a token.** In the live LaunchLab IDL, `initialize_with_token_2022` is signed only by `payer`[0] and `base_mint`[6]. `creator`[1] does not sign. The discriminator is `25be7ede2c9aab11`. **Only the fee payer proves who launched a token.**
- **The launcher's signing.** `cashcat-tab` uses only `fences().{rpc,wallet,ready,signSendConfirm}`, which is `engine.agentFences()` (`engine.mjs:1574`; signing at `:811`).
- **Lookup tables.** `txcheck.mjs:39` refuses lookup tables, so agency launches never use them.
- **test-site pins:**
  - `config.js` has exactly 3 keys.
  - `<input>`, `<select>`, `<form>` and `fetch(` are banned.
  - No address-shaped static text (`:500`), so mints must render at runtime.
  - `rosterOrder` reads `{ cat, t }` literals.
  - Template-literal assets escape `homeLoads`.
- **Vendor.** The closure holds (venue-pumpfun → jupiter, oracle, curve → strategy → trade-policy; token2022). No bot imports a dropped module.
- **Kitten art.**
  - Max alpha is 254, and every figure starts at y ≥ 38, so pixel (0,0) is the pure background.
  - Sampling one pixel per 14.6-px cell gives a **clean 44×63 sprite** with a blank sign (`collection-design/ginger-reduced.png`).
  - The sign is about 35 cells wide, so at cell size a ticker fits only about 4 characters.

**Missed by both designs**
1. **The popup still reads the engine.** Its wallet and autopilot cards read `status.autopilot` from `engine.status()` (`background.mjs:318`, `popup.mjs:244`). The balance lives in the engine (`:298-331`). About 40 `ensureEngine()` calls exist mainly to load config.
2. **Dropping console URLs can lock users out.** `normalizeConfig` throws on an unlisted `consoleUrl` (`config.mjs:489`). Dropping the legacy `claudedotcompany.com/hawk` URLs needs a migration.
3. **Deleting `docs/coinmarketcat-lessons.md` drops the two newest commits** (history keeps them).
4. **The collection starts small.** With one cat per stock (ever) and 24 pairs, one install makes **at most 24 cats**. Both designs build for 500–1,000.

**Wrong or risky**
- **D1:**
  - Three camera levels, districts, signposts and per-district wander are too much surface for 24 cats.
  - Its plots sit outside the default view.
- **D2:**
  - Billboarding in the vertex shader breaks clicks, because `InstancedMesh.raycast` uses the CPU `instanceMatrix`.
  - A Points LOD layer is unneeded.
  - It gives atlas cells as "64×64"; they are about 44×63.
  - It "resolves" v0 lookups instead of refusing them.
  - Its logo comparison includes the ticker, which Skia and Chrome rasterise differently.
  - It puts a Collection hotspot on the desk where Snipurr is still painted.

**Scores** (1–5, higher is better; for risk, 5 = lowest)

| | Safety | Honesty | Perf/size | Impl. risk | Total |
|---|---|---|---|---|---|
| D1 neighbourhood | 5: instruction whitelist, no lookup tables, classifies outside the sign | 4 | 4 | 2 | 15 |
| D2 gallery-first | 4 | 5: runtime list, "how a cat gets here", no agency mode | 3 | 3 | 15 |

**Synthesis:**
- From D2: the data model, the gallery and the honesty copy.
- From D1: the proof, the classifier, the matrix billboards and the ring slots.
- Dropped: levels, districts and LOD.

## B. Stages

- **Branch:** `pivot/collection`, from `486717d`.
- **After every stage:** `npm test` is green, plus `test-cats-browser` when the popup changed.
- **Merging:** nothing merges to main before the Stage 5 art gate, because a push to main redeploys the site and the extension zips.

### Stage 0: a green baseline
- In `stockLaunch`, move the `rec` check inside the journaling `try`, so `prepare_first` is journaled with the requested `pairMint`.
- Add the three README host rows and the plan's §9 `https://*/*` reason.
- **Tests:** stockcats 118/0, manifest 52/0.

### Stage 1: remove the trader cats

**1a. Carve out what is kept (nothing deleted yet)**
- **`src/lib/launch-signer.mjs`:**
  - `createLaunchSigner({sessionSigner, rpc, secondaryRpc, clock, timers})` returns `{rpc, wallet, ready, signSendConfirm, refresh, autopilotView}`.
  - Port from the engine: `signSendConfirm`/`awaitConfirmed` (sameMessage, both RPCs, read-back), `refreshSigner` and the balance.
  - Its `fences()` keeps `agentFences`' shape.
- **`src/lib/model-key.mjs`:** `callTool`, `listModels`, `resolveModel` and the key under the **same** storage key, `coinmarketcat:agent:api-key`. A new `MODEL.{SET_API_KEY,CLEAR_API_KEY,LIST_MODELS}` group.
- **`background.mjs`:**
  - `ensureConfig()` replaces `ensureEngine()` in the cat handlers.
  - `publicStatus()` is built from `autopilotView()` plus the bridge.
  - `consoleStatus()` keeps only the bridge fields.
- **Tests:**
  - New `test-launch-signer.mjs`, ported from `test-hawk-engine`: tampered, both RPCs, failed/expired/pending, read-back.
  - New `test-cats-model.mjs`, from `test-agent-brain`'s key/model sections.
  - `test-cats-cashcat` and `test-cats-stockcats:297` use the new signer; `test-hawk-no-key` names it.

**1b–1d. Delete and trim**

| Path | Verdict | Why |
|---|---|---|
| `src/lib/agent-{market,risk,runner,strategy,brain}.mjs`, `fixtures/agent/*`, `test-agent-{market,risk,runner,strategy,brain}.mjs`, `docs/coinmarketcat-lessons.md` | delete | The trading agent, including the WIP `own_launch`: `test-agent-runner §7b`, the `ownLaunches` line, `test-cats-cashcat §11`. |
| `test-agent-no-leak.mjs` | merge into `test-cats-no-leak` | Keep the key hygiene and "no model id" checks. |
| `engine.mjs`, `xstock-lane.mjs`, `xstock-discovery.mjs`, `jupiter-swap.mjs`, `fixtures/xstock-pools/*`, `test-hawk-{engine,xstock-venue}.mjs` | delete, after 1a | Snipurr and the xStock/Jupiter trading venue. |
| `vendor/executor/{entry-sizing, network-fee-budget, snipe-book, snipe-entry, snipe-lane, snipe-policy, snipe-shadow, snipe-venue, shadow-sink, grade-entry-gates}.mjs`, `test-snipe-*.mjs` | delete | Snipurr only. `MODULES` and `PROVENANCE.json` are trimmed in the same commit. |
| `rpc.mjs` `createLogsFeed`; `tx.mjs` `fillFromTransaction`, `tokenAmountOf`, `toTransactionInstruction` | trim | Dead code. |
| `config.mjs` lanes, arm sentences, `RECORD`, `STYLE_PRESETS`, quoteMints, canary, `signerMode`, `rpcWsUrl`, snipe imports | trim | `normalizeConfig` drops old `hawk:config` fields and maps a legacy `consoleUrl` to the default. |
| `protocol.mjs` `AGENT`, `ARM`, `DISARM`, `HARD_STOP`, `PAUSE`, `FORGET_POSITION`, `CLEAR_STOCK_CANARY` | trim | Nothing sends them. |
| `background.mjs` engine/agent/Jupiter imports, `feedFactoryFor`, badge lanes, `verifyCustomMints`, lane cases, the sweep's `liveHeld` guard | trim | Sweep always recovers tokens left behind by old positions. |
| `popup.*` / `options.*` / `welcome.*` | edit / edit / rewrite | Popup: the agent card, journal, Snipurr tab and arming go, and the `agent` tab becomes `coinmarketcat` (4 tabs). Options: the model key, picker and RPC stay. Welcome: RPC, Phantom, autopilot, then optional keys. |
| `manifest.json` `wss://*/*` and `claudedotcompany.com/hawk*`, plus those `CONSOLE_URLS` | delete | Only Snipurr's feed and console used them. |
| `build.mjs` | trim | Snipurr in `CAT_SPRITES`; the wss reason; the dexscreener, geckoterminal and (data)api.jup.ag rows; the agent clause in the lite-api row. |
| Storage clean-up | add | `onInstalled` (update) deletes `hawk:state`, `hawk:shadow` and `coinmarketcat:agent:{spec,state}`. |
| Snipurr's sprite, screen and agent art in `site/` and `brand/`; root `icons/coinmarketcat-*.png` (unreferenced) | delete | |
| `hq3d.js ROSTER`, `#agent-snipurr`, floor spot, roster, `tpl-snipurr`, `crt-snp`, SNP in `cases.js`, `floor.js SPRITE`/`CASE_ID`, `package.mjs CATS` | edit | Six agency cats. The prose waits for Stage 5. |
| README L679–1198 | delete | Salvage L1099 as "The autopilot wallet". |

**Kept:**
- **Wallet and signing:** `session-wallet` (keystore, unlock, fund, sweep, Export), the rest of `tx`/`rpc`, the Phantom bridge, `shims`.
- **The launcher:** `cashcat-tab`, `stockcats`, `stock-cat-notes`, `cashcat-draft`, `cashcat-logo`.
- **The other cats and bots:** `popcat-tab`, `crying-cat`, `bots/**`, `fixtures/bots/**`.
- **Vendor:** the closure, plus `pumpfun-xstock-quote.json`.
- **Config:** `XSTOCK_BUILTIN`, `STONKFUN_XSTOCKS`, `XSTOCK_AUTHORITIES`, $CIA `config.js`.
- **Storage:** every kept storage key.

**Tests for Stage 1:**
- Delete the obsolete test files.
- Edit `test-hawk-{autopilot,session-wallet,bundle,no-key,manifest}`, `test-cats-browser` (4 tabs), `test-cats-stockcats:394` and `test-downloads`.
- In `test-hawk-autopilot`, a clean-up test checks that the 4 keys are gone and the kept keys are byte-identical.
- In `test-site`:
  - Drop the `agent-strategy`, `snipe-policy` and `RECORD` imports and their sections.
  - Six `CATS`, roster entries and floor stations.
  - `rosterOrder` at `t = ±0.75, ±2.25, ±3.75`.
  - Six kit hashes.

### Stage 2: CoinMarketCat as the launcher (finish the WIP)
- **The tab:** CoinMarketCat's tab holds the stock-cats, wallet and autopilot cards, and nothing that trades.
- **Remaining plan §9 items:**
  - `CASHCAT_VENUE_NOTE`
  - `options/cats.mjs:29`
  - `privacy.md:40-41` (StonkFun receives the stock's mint, the launched mint and the IP)
  - README L584-585 plus a new "Stock cats" section
  - the `build.mjs` reasons
  - `test-hawk-bundle:198-200`
- **No agency mode in the public extension.** Add one line: "Stock cats you launch are yours. The agency's collection lists only cats its own listed launcher wallet paid for."
- **Extract:**
  - `adoptionMismatches` (`cashcat-tab.mjs:763-767`) into `bots/cashcat/stonkfun.mjs`.
  - `bots/lib/launchlab-scan.mjs` (paging, fail-closed limits) out of `launch.mjs onchainLaunches`.
- **Unchanged:** the research gate (`STOCK_CAT_NOTES` is empty), manual-only launching, the caps and `pairDisclosure`.
- **Tests:**
  - `test-cats-stockcats`: the note text, and adoption through the bot module.
  - `test-bots-stonkfun`: `adoptionMismatches` against the `api-token-*` fixtures.
  - `test-bots-cashcat`: `onchainLaunches` is unchanged.

### Stage 3: the collection pipeline (invisible until a wallet is listed)

**`site/assets/launchers.json`** ships as `{"launchers":[]}`.
- Each entry is `{cat:"coinmarketcat"|"cashcat", address, since, until:null}`.
- Entries are never removed; a retired one gets an `until` date.
- The `test-site` pin `LISTED_LAUNCHERS = 0` rises in the commit that lists a wallet.

**`site/assets/collection.json`**: main ships `{"collection":[]}`; floor-data holds the real one.
- Entries are `{time, creator, tx, mint, pool, name, symbol, quote:{symbol,mint}, kitten|null, background|null, adopted, mintClean}`.
- Fields are closed: no price, image or uri.

**`site/assets/collection.js`** (pure) does the following:
- Reuses the `launches.js` rules: base58 byte lengths, `HIDDEN`/`MARKUP`/`SCHEME`, time.
- Checks:
  - `symbol` is `^[A-Z0-9]{2,10}$`.
  - `quote` is in `XSTOCKS`, which is pinned equal to `STONKFUN_XSTOCKS` (so `BRK.Bx` is accepted).
  - `creator` is listed, with `since ≤ time ≤ until`.
  - The art is either both set or both null.
  - Mints are deduplicated and entries sorted.
  - `MAX_COLLECTION = 300`.
  - The pool PDA, in Node only.
- Exports:
  - `validateCollection(data, {launchers})`.
  - `tokenLinks(e)`: Solscan token, tx and launcher, plus `stonkfun.xyz/token/<mint>` **only when `adopted`**.
  - `COLLECTION_DISCLOSURE`, pinned to `pairDisclosure`'s wording.
- `collection-data.js` imports both JSON files as JSON modules.

**`bots/collection/{run,prove,art}.mjs`** gets `http`, `rpc`, `now` and `log` injected.
1. **Scan** each listed wallet with the shared scanner:
   - Only signatures newer than the cursor in `collection-state.json` (floor-data, not in `DATA_FILES`), stopping at `since`.
   - Oldest first.
   - Fail closed past 5 pages or 150 reads.
2. **Prove** each launch:
   - `meta.err` is null, `keys[0]` is the listed wallet, and there are no lookup tables.
   - `txcheck.checkLaunchMessage` passes (venue `stonkfun`, coin from `decodeInitialize`).
   - The accounts equal `initializeAccounts({payer, mint, quoteMint, globalConfig: acct[2], curveRule: acct[15]})`, which covers the platform [3], pool [5] and mint [6].
   - `acct[7]` is in `XSTOCKS`.
   - The amounts equal `STONKFUN_SHAPE`.
3. **Cross-check** with `getMultipleAccounts([mint, pool])`:
   - The metadata name and symbol equal the instruction's.
   - `mintClean` is true only if there is no mint or freeze authority.
   - The PoolState discriminator, base and quote all match.
4. **Content rules.** `checkProposal` must pass, or the job fails loudly and nothing is listed.
5. **Art.**
   - Fetch the document by CID from `gateway.pinata.cloud` (≤ 64 KB). Its name and symbol must match.
   - Fetch the image (≤ 2 MB, a 1024² PNG). If the CID is raw sha-256, the hash must match.
   - The background is pixel (0,0) within ±2 of one of the 8 background colours.
   - The kitten is compared **on an 8 px grid outside the sign rectangles**: accept an error under 2/255 when the runner-up is at least 4× worse.
   - Otherwise retry for 6 hours, then set `kitten:null`. The picture itself is never shipped.
6. **Adoption.** Call `/tokens/{mint}`, then `adoptionMismatches`. A 404 means `adopted:false`; re-check hourly for 7 days, at most 20 reads per run.
7. **Write.** Validate the whole list, write to a tmp file and rename. Never drop an entry, and fail loudly at MAX.

**Deploy wiring**
- `floor-data.mjs`: `DATA_FILES` gains `collection.json`, and the overlay gets a `collection` branch that validates against main's `launchers.json`.
- `data.mjs`: new `loadCollection`/`writeCollection`. `appendLaunch` truncates, so it is not reused.
- **`.github/workflows/collection.yml`:**
  - Runs at `41 * * * *` and on `workflow_dispatch`, main only.
  - Concurrency group `collection`, never cancelled.
  - `permissions: {}`, and the job gets `contents: write`.
  - Pinned SHAs and `persist-credentials:false`.
  - Its only secret is `SOLANA_RPC_URL`.
  - Deploys through `pages.yml` when `changed`.

**Tests for Stage 3**
- `test-bots-validators`:
  - Refusals: an unlisted creator, a time before `since`, a bad quote, bad bytes, markup, a duplicate mint, half-set art, extra fields.
  - The StonkFun link appears only when adopted.
- New `test-bots-collection`, built from the `simulate-initialize-v0-*` fixtures and the live `rEWGkqq…` read:
  - Ignored: creator-only, `meta.err`, a lookup table, an extra instruction, a wrong platform, a name mismatch, a pump.fun create.
  - The cursor, `since` and fail-closed limits.
  - A rerun gives `changed=false`; nothing is dropped; the builder stops at MAX.
- New `test-bots-art-classify`: all 64 renders × 3 tickers, ±1 noise, a non-kit image gives null, the ink background.
- `test-bots-floor-data`: the overlay branch.
- `test-bots-workflows`: add `collection.yml`; the RPC secret count goes from 2 to 3.

### Stage 4: the world and the site

**Sprites**
- `scripts/world-kittens.mjs` derives the 8 kittens (about 44×63 each, blank sign) into:
  - `brand/sprites/kittens.png` and a byte copy at `site/assets/sprites/kittens.png`: a 512×128 atlas with gutters, safe for mipmaps.
  - `kittens.json`: each kitten's rectangle, sign and feet.
- Self-host `PressStart2P-Regular.ttf` and `OFL.txt` under `site/assets/fonts/`, byte-equal to `bots/cashcat/art/font`.

**`collection-layout.js`** (pure)
- `slotFor(i)` places cats on rings at `r = 8.6 + 1.25k`, at least 1.0 apart.
- It fills the front-side arcs the default camera shows first (−26°…78°), then the flanks, then the back.
- It keeps clear of the door wedge, `KEEP_OUT`, and the agency cats' stroll boxes plus 0.6.
- Append-only: 300 slots within r ≤ 24.

**`hq3d-collection.js`** is imported after the plaza is ready; if it fails, the plaza carries on.
- **Draw calls:** three `InstancedMesh` meshes.
  - Bodies: atlas UV via `onBeforeCompile`, `alphaTest 0.5`, 0.62 × `KITTEN_H`.
  - Ticker quads: from a runtime `CanvasTexture` in the self-hosted font, at integer scale (ported `fitScale`).
  - Rugs: in the background colour, outlined for ink.
- **Billboards:** the yaw is written into `instanceMatrix` every frame, so clicks match the drawing. `frustumCulled=false`.
- **Motion and rendering:**
  - Idle bob only, frozen under reduced motion.
  - Nearest filtering for magnification, mipmaps for minification.
  - No new three addon, and nothing added to `subject`.
- **Picking:** agency cats first, then token cats (`instanceId` plus an alpha mask), then the building. On touch, the nearest head within 22 px wins. Token indices start at `kittens.length`, so the pinned `pointerup` order holds.
- **Tags:** the name, then "$TICKER · paired with SPYx · 2026-10-01". The auto-cycle shows the agency cats plus the 6 newest.
- **"Visit the collection":** a `<button>`, shown only when cats exist. It tweens the camera back, with no tween under reduced motion. `?cat=<mint>` opens a cat directly.
- **The cat's file:** `cia:dossier {token}` is built with `textContent` from `collection-view.js tokenCard()`: every field, where the art came from, and `COLLECTION_DISCLOSURE`.

**`site/collection/index.html`** (the 6th entry in `PAGES`)
- Rendered at runtime, newest first, with stock filters as `<button aria-pressed>`.
- **Each card:** the sprite and ticker, the name, "paired with SPYx", UTC time, mint, "Launcher: CoinMarketCat's wallet", `tokenLinks`, and "Not yet listed by StonkFun" when not adopted. Its id is the mint.
- **"How a cat gets here":** the listed wallets and the fee-payer rule.
- **Empty state:** "No cat coins yet. When CoinMarketCat launches one on StonkFun from the agency's launcher wallet and the chain confirms it, it appears here and joins the plaza."
- **Failed state:** "The collection could not be read."
- **Home page:** a strip under the hero with the count, the newest 4 and a link. It doubles as the fallback without WebGL.
- **Floor:** `DESK.coinmarketcat = "collection"`, and no hotspot on Snipurr's painted desk.

**Tests for Stage 4**
- New `test-world-kittens`: the derivation gives identical decoded pixels, and the hashes are pinned.
- New `test-collection-layout`: deterministic, append-only, no overlaps, the clearances hold, r ≤ 24.
- `test-site`:
  - Scan both scene modules and extend `homeLoads`.
  - **Home stays under 3.5 MB with a synthetic max-length 300-entry `collection.json`** (about 2.65 + 0.2 MB).
  - The collection page stays under 1 MB.
  - Text only; links only via `tokenLinks`; no `<input>`; the font is byte-equal.
  - The floor's picture rule now reads "drawn only from the kit's own art and the record's fields".

### Stage 5: copy, README, brand, art gate

**Home**
- New meta and OG text.
- Headline: "Five agents. Three of them are software."
- CoinMarketCat card: "The agency's StonkFun launcher · software". The CoinMarketCap non-affiliation line stays.
- The collection strip replaces the `#coinmarketcat` pitch.

**`site/coinmarketcat/`**, rewritten with these sections:
- `#how`
- `#limits`, pinned to `STOCKCAT_LIMITS` and `MAX_LAUNCH_SPEND_LAMPORTS.stonkfun`
- `#where`, covering the 24 pairs
- `#collection`
- `#risk`, covering the issuer's freeze and delegate powers
- `#faq`

**Other pages and docs**
- Console: the bridge stays; Snipurr's parts become fund and sweep.
- Downloads: "four tabs, six cats".
- Brand and docs: `brand/COPY.md` (drop §3; rewrite Agent 001, §6 and the bios), `brand/README.md`, `docs/session-wallet.md`, `docs/chrome-web-store/*` and the screenshots.
- README: intro, contents, floor, extension, privacy, hosts, install, build, vendor honesty, tests, not advice, plus a new "The collection" section.

**Art gate.** New hero, OG, workfloor, roster, banners, and a `screen-coinmarketcat` showing a launch checklist instead of a chart, all without Snipurr.
- Render the hero poster from the six-cat scene with the existing Chromium tooling.
- Repaint the workfloor and banners in Higgsfield.
- Update the `KIT` hashes and alt pins on purpose.

**Merge.** Merge stages 0–5 together with a version bump, after a security review of the launcher, `launch-signer` and the builder.

**Go-live (owner)**
1. Fill the sourced `stock-cat-notes.mjs` rows.
2. Make the first launch by hand from the dedicated wallet.
3. Open a PR that lists the wallet and sets `LISTED_LAUNCHERS=1`.
4. Run `collection.yml` by hand.
5. Calibrate the art thresholds on the real Chrome-rendered PNG and commit it as a fixture.

## C. Owner decisions

1. **Wallet(s) to list.**
   - *Recommend:* one **dedicated** autopilot keystore, used only for agency stock cats, listed with `since`.
   - Listing it publicly ties it to its funder. Accept that, or fund it through an intermediate wallet.
   - Launch from one install only: the caps live in that install's journal.
2. **CashCat's StonkFun launches.** *Recommend:* yes, once CashCat is live.
   - List its bot wallet as `cashcat`, StonkFun only. The proof is identical.
   - Its pump.fun coins stay out.
3. **Where the collection lives.** *Recommend:* `/collection/` as the list, plus the world and a strip on the home page.
   - This gives shareable `#<mint>` links, a view without WebGL, and home-page budget headroom.
   - The alternative is a `#collection` section on the home page only.
4. **Sprite style.** *Recommend:* kittens derived from the coin kit, with the ticker overlaid; the prototype is clean, and each cat matches its coin.
   - Commission sprites only if the eyeball check fails.
   - Redraw CoinMarketCat's sprite: its phone shows a rising chart.
5. **Caps and house rules.** *Recommend:* keep one cat per stock (at most 24 per wallet) and 2 a day.
   - Show unadopted launches without the StonkFun link.
   - Add the house rule "The agency does not buy or sell its own stock cats".
   - Revisit the caps after the first cats read back clean and are adopted.
