# The StonkFun launcher in the CIA repo: what exists and what "Adopt a cat" can reuse

Researched 2026-09-25, 17:35–17:55 UTC. The work was read-only. Nothing was signed or sent, and no key was made except the throwaway keypairs the repo's own code generates.

- **Repo:** `/home/user/Cat-Intelligence-Agency`, branch `claude/blissful-franklin-dc4fbg`.
  - HEAD is `5f573e5`. The working tree was clean before and after this research.
  - Commits read: `bcf791f`, `86a0ade`, `523565d`, `6335ae9`, `486717d` ("WIP launcher") and `5f573e5` ("Stage 0").
  - Also read: `stash@{0}`.

**Labels.** Each claim is marked with one of two labels:
- **VERIFIED** means I saw it in code, in a fixture, in a test run, on chain or in a live API answer.
- **INFERRED** means reasoning that has not been checked.

**Where the evidence is.** It is under `…/scratchpad/adopt/raw/launcher/`, abbreviated `R/` below. The full path is `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/launcher/`.

---

## 0. TL;DR

1. **A working LaunchLab builder already exists.** VERIFIED.
   - It is `bots/cashcat/stonkfun.mjs`. It builds exactly the `initialize_with_token_2022` that StonkFun adopts: 16 accounts, the StonkFun standard platform id and the curve rule placed last.
   - It prices each launch from StonkFun's live `/launchlab/pricing` and checks every number on chain before building.
   - It re-encodes 6 real StonkFun launches byte for byte, and its tests pass.
   - I re-ran it live today. SPYx, TSLAx, a prestock (ANTHROPIC) and two Backpack tokens all simulated with no error: 91k–106k CU, a payer cost of 0.00856–0.00867 SOL, and v0 transactions of 864–896 bytes.
2. **It has never launched anything.** VERIFIED.
   - The README says "nothing has launched".
   - Commit `486717d` says "No security review has run yet" and "Nothing deploys from this branch".
3. **The launcher's signer model is the opposite of what adoption needs.** VERIFIED.
   - Every launch needs **two signatures**: the payer and the new mint's keypair.
   - The extension signs only with its own autopilot key. It **refuses to offer Phantom**, because nobody checked whether Phantom keeps the mint's co-signature on a v0 transaction (`CASHCAT_SIGNER_NOTE` in `src/lib/cashcat-tab.mjs`).
   - Letting the adopter's own wallet sign is the main piece still to be built.
4. **The allow-lists refuse most of the planned cats.** VERIFIED.
   - The code pairs only with the **24 xStocks**. Backpack and prestock quotes are refused on purpose: no issuer allow-list, and a transfer fee.
   - On chain, the 7 prestocks carry a **TransferFeeConfig of 1% now and 3% from epoch 1043**. They also have a permanent delegate and freeze authority held by one key (`WV9P…`).
   - `STOCK_CAT_NOTES` ships **empty**, so every pair is refused at `pair_terms_missing`. That includes all 24 cats drafted in `launch-sheet.json`.
5. **The metadata builder leaves out website and X.** VERIFIED.
   - It writes pump.fun's shape with no socials.
   - StonkFun's own launches write `extensions.{website,twitter}` and `properties.links`, and StonkFun's token API shows those links.
   - The one likely hand-built adopted launch in the samples (VOLTAGENT) put `website`/`twitter` at the top level of its JSON. StonkFun's record for it shows `links: {}`.
6. **The public mainnet RPC refuses every browser Origin with HTTP 403.** VERIFIED for `catcoinsanctuary.com`, `example.com` and `*.github.io`.
   - A static site therefore needs an RPC provider whose key can safely sit in the browser, or it needs the wallet to send.
   - StonkFun's public API answers `Access-Control-Allow-Origin: *`, with a rate limit of 300.
7. **Content rules pass for all 24 drafted cats, apart from the research gate.** VERIFIED.
   - All 24 names, tickers and stories pass `checkProposal`, the Jupiter-verified ticker check and the site validator.
   - The only refusal is `pair_terms_missing`.
   - The sheet's disclosure names the company (for example "Not affiliated with State Street"). The repo's `pairDisclosure` deliberately names only the xStock symbol.

---

## 1. Inventory of the commits and the stash

| Ref | What it is | Relevant to adoption? |
|---|---|---|
| `5f573e5` Stage 0 (15:26) | The stock-cat launch journals `prepare_first` refusals. `build.mjs` HOSTS_CALLED gains `api.mainnet-beta.solana.com`. The README host table is tested both ways. | Minor |
| `486717d` WIP launcher (14:22) | The stock-cat launcher (see below). 62 files, +12,013 lines. Fixtures `fixtures/bots/stonkfun/2026-09-25/`. Its message says: "Not done: the worker/popup wiring, tests and copy; 34 of 36 test files pass. No security review has run yet." VERIFIED | **Core** |
| `6335ae9`, `523565d` | Docs only (`docs/coinmarketcat-lessons.md`): cat-coin market-cap funnel and price history. | No |
| `86a0ade`, `bcf791f` | CoinMarketCat trading agent: cat-coin preset, lessons. | No |
| `stash@{0}` "SOL-hop route + cat scout (unreviewed)" | Based on `523565d`. Changes `src/lib/jupiter-swap.mjs` (+401), `agent-runner.mjs`, `agent-strategy.mjs` and `tx.mjs`. Its untracked parent `6f96bec` adds `src/lib/agent-scout.mjs` and Jupiter fixtures. It is CoinMarketCat's Jupiter USDC→cat-coin routing through one SOL hop plus a "scout". No launcher code. VERIFIED (`git diff stash@{0}^1 stash@{0} --stat`) | Only indirect: its Jupiter route checks could guard an optional SOL→stock dev buy, which is not in scope |

**Launcher files at HEAD.** All VERIFIED. The line counts come from `wc -l`.

- `bots/cashcat/stonkfun.mjs` (227 lines): PDAs, account decoders, the instruction encoder and decoder, and the planner.
- `bots/lib/verified.mjs` (186): pinned program, platform and discriminator constants, API URLs, and the metadata URI form.
- `bots/lib/solana.mjs` (119): PDA helper, borsh writers, bounds-checked reader, and `readMessage` (the compiled-message reader).
- `bots/lib/txcheck.mjs` (157): the pre-sign check `checkLaunchMessage` and `checkSimulation`.
- `bots/cashcat/metadata.mjs` (135): the metadata document plus Pinata pin and read-back.
- `bots/cashcat/config.mjs` (122):
  - `MAX_LAUNCH_SPEND_LAMPORTS.stonkfun = 15_000_000` (0.015 SOL);
  - `COMPUTE_LIMITS.stonkfun = 250_000`;
  - fences.
- `bots/cashcat/launch.mjs` (322): the bot's run. It uses legacy `Transaction` objects and includes `onchainLaunches`, which counts a wallet's launches on chain.
- `bots/lib/content-rules.mjs` (348), `bots/lib/catdetect.mjs` (77), `bots/cashcat/tickers.mjs` (43): the content rules.
- `src/lib/stockcats.mjs` (265): the stock-cat rules, `pairDisclosure` and `quoteRefusals`.
- `src/lib/stock-cat-notes.mjs` (37): the research rows. It ships `[]`.
- `src/lib/cashcat-tab.mjs` (925): the extension pipeline, including `VENUE_RUN.stonkfun`, `stockPrepare`, `stockLaunch` and `stockCheckAdoption`.
- `src/lib/tx.mjs`:
  - `buildUnsignedTransaction` builds a v0 message with no lookup tables;
  - `sameMessage` compares messages.
- `src/lib/session-wallet.mjs` `createMintKeys`: the ephemeral mint keypair. It signs its own slot once, then is dropped.
- `src/background.mjs` lines 833–842: the `stonkfun` client. It **refuses the public RPC** (clause `no_rpc`).
- `src/popup/stockcats.mjs` (219): the popup UI.
- Tests:
  - `test-bots-stonkfun.mjs`, 37 checks;
  - `test-bots-txcheck.mjs`, 41;
  - `test-bots-content.mjs`, 124;
  - `test-cats-stockcats.mjs`, 118.
  - I ran all four at HEAD and every check passed. Output: `R/run-test-*.txt`.
  - A full-suite log from 15:25 in the scratchpad (`…/scratchpad/npmtest-gate0.log`) reports "36/36 test files passed". I believe it came from the Stage-0 tree. INFERRED from the timestamps.

---

## 2. What the launcher builds

### 2.1 The transaction

All VERIFIED: `stonkfun.mjs`, `src/lib/tx.mjs`, `cashcat-tab.mjs` `buildCheckSimulate`, and `launch.mjs` `buildLaunchTx`.

- **Format.**
  - The extension builds a **v0** `VersionedTransaction` with no address lookup tables. `readMessage` refuses a lookup table by name.
  - The bot builds a **legacy** `Transaction`.
- **Signers.** Exactly 2: the payer, then the new mint.
  - `txcheck.signersMustBe(msg, wallet, [mint])`.
  - `createMintKeys.signAsMint` insists on `[payer, mint]` in that order.
- **Instructions,** in order:
  1. `ComputeBudget.SetComputeUnitLimit(250_000)`.
  2. `ComputeBudget.SetComputeUnitPrice`.
     - In the extension this is 10,000 µ-lamports per CU, from `PRIORITY_FEE_LAMPORTS = 2_500` divided by 250,000 CU (`computeUnitPriceFor`).
     - In the bot it is `priorityMicroLamports`, default 10,000.
     - The check allows at most 2 compute-budget instructions, a limit of at most 1.4M and a price of at most 200,000 µL.
  3. LaunchLab `initialize_with_token_2022`, discriminator `25be7ede2c9aab11`.
- **Nothing else is allowed.** There is no System or token transfer, no memo, no other program and no dev buy. `checkLaunchMessage` requires exactly one non-compute-budget instruction.
- **Payer cost.**
  - The cost is the rent for the pool state, the two vaults and the Token-2022 mint with metadata, plus 2 × 5,000 lamports in signature fees and 2,500 lamports of priority fee.
  - The recorded simulations came to 0.0086739 SOL, and my runs today to 0.00856–0.00867 SOL (§6). VERIFIED.
  - Another agent's decode of a StonkFun UI launch shows `payerLamportsDelta −11,607,160`, about 0.0116 SOL, in `…/adopt/raw/chain-launch-decodes.json`. That UI launch used 600k CU at 50,000 µL and paid a 40,000-lamport fee. The UI's "~0.012 SOL" is therefore the UI's own cost, not this builder's. INFERRED.

### 2.2 Accounts: 15 from the IDL plus the curve rule

VERIFIED: `initializeAccounts`, the IDL subset `fixtures/bots/stonkfun/launchlab-idl-subset.json` (`raydium_launchpad` 0.2.0, read from on-chain IDL account `E6wT2u…`), and 6 real launches.

| # | Account | Flags in the compiled message | Value |
|---|---|---|---|
| 0 | payer | signer, writable | adopter wallet |
| 1 | creator | merged with payer, so signer and writable. **The IDL does not require the creator to sign.** | same wallet. StonkFun forwards the creator share to this account (see §8) |
| 2 | global_config | ro | per quote, from `pricing.curve.configId`. SPYx = `B7ctMMdGvy46Am56myTtzfkNzt9kWZVTNGM2BWrJ9adg`, TSLAx = `Fny7wPYnkeR5AU285YLSJv9giQUbxDA2DpXQAinTe2nR` |
| 3 | platform_config | ro | StonkFun standard platform `4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7`. The reward (taxed) platform `6BwHHD…` is refused |
| 4 | authority | ro | PDA(["vault_auth_seed"]) = `WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh` |
| 5 | pool_state | w | PDA(["pool", base_mint, quote_mint]) |
| 6 | base_mint | **signer**, w | fresh keypair |
| 7 | quote_mint | ro | the cat's stock |
| 8 | base_vault | w | PDA(["pool_vault", pool, base_mint]) |
| 9 | quote_vault | w | PDA(["pool_vault", pool, quote_mint]) |
| 10 | base_token_program | ro | Token-2022 |
| 11 | quote_token_program | ro | the quote mint's owner, **read on chain**. Token-2022 for xStocks and prestocks; some Backpack tokens use classic SPL Token (PSG simulated OK) |
| 12 | system_program | ro | |
| 13 | event_authority | ro | PDA(["__event_authority"]) = `2DPAtwB8L12vrMRExbLuyGnC7n2J5LNoZQSejeQGpwkr` |
| 14 | program | ro | `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj` |
| 15 | platform curve rule | ro, **last** | PDA(["platform_curve_rule", platform, global_config]). SPYx = `QYZp1YzqEHU67ngXphF9LAkxkxWGvpWEv3rXh4yDbWA` |

### 2.3 Arguments (borsh)

VERIFIED: `encodeInitialize`, `STONKFUN_SHAPE`, and the re-encode test.

- **`MintParams`:**
  - `decimals = 6`;
  - `name` of at most 32 bytes, `symbol` of at most 10 bytes and `uri` of at most 200 bytes. The encoder refuses anything longer with `too_long`.
- **`CurveParams::Constant`:**
  - `supply = 1_000_000_000_000_000` raw, which is 1B tokens;
  - `total_base_sell = 793_100_000_000_000` (79.31%);
  - `total_quote_fund_raising = pricing.raise.raw`, a raw amount in the **quote's** decimals, priced when requested;
  - `migrate_type = 1`, meaning cpmm.
- **`VestingParams`:** 0, 0, 0.
- **`amm_fee_on`:** `pricing.curve.cpmmCreatorFeeOn`. It was 0 in every plan I saw.
- **`transfer_fee_extension_param`:** `None`, written as tag 0 followed by 10 zero bytes. That matches real StonkFun launches byte for byte.
- **On-chain curve rule for SPYx** (decoded in `R/decoded-accounts-2026-09-24.txt`):
  - It constrains fields 0, 1, 2, 3 (supply 1e15), 4 (sell 793.1e12), 6, 7, 8, 9 (=1) and 10.
  - It does **not** constrain field 5. That field is presumably the raise. INFERRED.
  - So a wrong raise would still pass on chain, but StonkFun would not adopt the pool. INFERRED, consistent with the developer page text in `…/adopt/raw/developers-build-yourself-code.txt`, captured by another agent.

### 2.4 How the planner prices and proves a launch

`planStonkfunLaunch`, VERIFIED:

1. Look the quote up in the caller's `quoteList`. The default is the bot's 15 xStocks; stock cats pass the 24-entry `STONKFUN_XSTOCKS`.
2. `GET /api/public/v1/stats` must say `launchLabEnabled: true`.
3. `GET /pairs?launchable=true&launchLabReady=true` must list the mint as launchable and ready.
4. `GET /launchlab/pricing?quoteMint=` must return a curve with `programId` equal to LaunchLab, `platform.standard` equal to the pinned platform, a ConstantCurve migrating to cpmm, the pinned supply, sell amount and decimals, zero vesting, and a raise that is a positive integer. `curveRule.standard` must equal the curve-rule PDA.
5. One `getMultipleAccounts` read of the platform, config, rule and quote mint. Then:
   - each of the first three must be owned by LaunchLab;
   - the platform's on-chain name must be "StonkFun";
   - the config's `quote_mint` must equal the quote and its `curve_type` must be 0;
   - the rule's platform and config must match;
   - the quote mint must be owned by Token or Token-2022.
6. It returns a frozen plan. The plan includes `quoteMintAccount`, the bytes it read, so the caller can check the stock further (`quoteRefusals`).
7. The extension plans again at launch time and refuses with `plan_changed` if the config, rule, platform or token program changed. A changed raise is recorded, not refused.

### 2.5 The metadata document and URI

VERIFIED from `metadata.mjs` and `verified.mjs`.

- **Document, `buildUserDocument(venue: "stonkfun")`:**
  - fields `{ name, symbol, description, image, showName: true, createdOn: "https://www.stonkfun.xyz" }`;
  - the description is the tagline, then " — ", then `pairDisclosure(pair)`;
  - **no website and no twitter**, by design ("no website, no socials").
- **URI:**
  - `https://gateway.pinata.cloud/ipfs/<cid>`;
  - pinned with the owner's Pinata JWT, then read back and compared field by field before use.

**StonkFun's own launches** use a different shape, for example BLEP CAT and MedPad. VERIFIED from `R/meta-67Yo….json` and `R/meta-E331….json`.

- The URI is `https://gateway.irys.xyz/<id>`, which is Arweave.
- The JSON is `{ name, symbol, description: "<name> was launched on StonkFun.", image, external_url, extensions: { website, twitter }, properties: { category, files: [...], links: { website, twitter } } }`.
- StonkFun's `/tokens/<mint>` shows those links (`R/token-GjauK….json`, `R/token-FMWVA….json`).

**VOLTAGENT, the likely hand-built launch:**

- Its metadata is on Pinata, with top-level `twitter`/`website`.
- It was adopted: launchpad `launchlab`, mode `standard`, image shown.
- But StonkFun shows `"links": {}` (`R/token-EjY6….json`, `R/meta-bafkrei….json`).
- Its instruction's transfer-fee tail bytes are non-zero. That suggests a non-StonkFun encoder, so I treat it as hand-built. INFERRED.
- Whether StonkFun would read `extensions` or `properties.links` from a **hand-built** launch is unknown. See the open questions.

---

## 3. The check before any signature, and after the simulation

`bots/lib/txcheck.mjs`, VERIFIED.

**`checkLaunchMessage(message, { wallet, mint, venue: "stonkfun", coin, plan })`**

- It reads the **compiled** message, which is what the signatures cover, and refuses lookup tables.
- The fee payer must be the wallet, and the signers must be exactly `{wallet, mint}`.
- Only compute-budget instructions are allowed besides the launch instruction, with their caps.
- There must be exactly one LaunchLab instruction, and the plan's platform must be the standard one.
- The accounts must match the derived ones index by index, flags included (payer and creator merged).
- The decoded arguments must match: name, symbol and uri equal the coin; decimals, supply, sell amount and migrate type equal the StonkFun shape; the raise equals the plan's; no vesting; `transferFeeTag = 0`; `cpmmCreatorFeeOn` equals the plan's.
- Each refusal names its clause, for example `accounts`, `raise` or `transfer_fee`.

**`checkSimulation(sim, { walletBefore, walletAfter, maxSpendLamports: 15_000_000, mustLog: "Instruction: InitializeWithToken2022" })`**

- There must be no error.
- The spend must be at most the budget, and the wallet must not gain.
- The required log line must appear.

**`sameMessage(unsigned, signed)`** in `src/lib/tx.mjs`

- It compares the message bytes after a wallet signs and refuses if the wallet changed anything.
- It is already used on Phantom's `signTransaction` result (`src/background.mjs:407` and `src/lib/engine.mjs:822`).

**Launch record and adoption check** in the extension (`cashcat-tab.mjs`)

- A "sending" journal entry is written before signing.
- After landing, the code reads the transaction back: the fee payer must be the wallet, the cost comes from the balance change, and the new mint must have no mint or freeze authority.
- `stockCheckAdoption` compares StonkFun's `/tokens/<mint>` with the journal:
  - `launch.mint`;
  - `launch.pool` equals PDA(mint, quote);
  - `launch.creator` equals the payer;
  - `launchpad` equals "launchlab";
  - `mode` equals "standard";
  - `token.quote.mint` equals the pair.
- A 404 answer means "not adopted yet".

---

## 4. What is verified against real fixtures

All VERIFIED. The tests were re-run today, with output in `R/run-test-*.txt`.

**`fixtures/bots/stonkfun/` (read 2026-09-24)**

- The IDL subset: discriminator equals sha256("global:initialize_with_token_2022")[0..8], and there are 15 accounts and 5 arguments.
- 6 real standard-platform launches (`launch-samples.json`): all 16 accounts re-derive, flags included.
  - Every launch with the zero-filled tail re-encodes byte for byte (5 of 5).
  - Two of the launches are paired with xStocks (GMEx, GOOGLx). One is paired with the ANTHROPIC **prestock** and one with WSOL.
- The platform configs decode to name "StonkFun", `feeRate` 10,000 (1%), `creatorFeeRate` 0 and `creatorScale` 0, `restrictCurveParam` 1, `platformCpCreator` = `5CEbue…`, which is StonkFun's wallet. The SPYx GlobalConfig and curve rule decode too.
- The planner works against the recorded API answers, and 14 tampered answers are each refused by name.
- The recorded 2026-09-24 legacy simulation is rebuilt byte for byte from the recorded plan.

**`fixtures/bots/stonkfun/2026-09-25/`**

- Stats, the pairs list with readiness, **pricing for all 24 xStocks**, and the on-chain accounts for all 24.
- `test-bots-stonkfun` confirms "all 24 plan against the recorded answers".
- `xstocks-official-24.json` holds the official xstocks.com rows.
- Two v0 simulations of the extension's own build, for SPYx and PLTRx.
- `api-token-adopted.json`, a third-party "test" GLDX launch, and `api-token-not-found.json`, a 404.
- `launched-mints.json`: the mints of the 6 samples, read on chain.

**`test-cats-stockcats` (118 checks)** covers:

- the 24 pairs against the recordings;
- the research gate;
- every rule clause;
- the stock's mint (`quoteRefusals`);
- a launch in a LaunchLab chain double;
- being armed only by a check;
- the caps;
- re-planning, hostile bytes and the owner's RPC;
- adoption;
- never auto and never a dev buy.

**Not verified anywhere:**

- a real signed launch;
- adoption by StonkFun of a launch built by this code;
- any wallet other than the autopilot session key;
- the creator-fee forwarding;
- a security review.

VERIFIED as absent: the README and commit text say so.

---

## 5. Content rules and disclosure a cat must pass

The code is `bots/lib/content-rules.mjs`, `catdetect.mjs`, `tickers.mjs`, `src/lib/stockcats.mjs`, and `site/assets/launches.js`/`callouts.js`. VERIFIED.

### 5.1 Fixed rules: `checkProposal({name, symbol, tagline, trend})`

**List clauses:**

- `real_person`: the famous-people list, plus "Firstname Lastname" built from `FIRST_NAMES`;
- `brand`: about 250 brands, teams, characters and tokens, for example `stonkfun`, `popcat`, `mew`, `nyan cat`, `hello kitty`;
- `endorsement`: official, partner, affiliated, verified, labs, inc, and similar;
- `tragedy`, `minors`, `sexual` (includes `catgirl`);
- `hate`: plain words plus salted hashes;
- `identity`, `politics`;
- `financial_promise`: guaranteed, profit, returns, 100x, "financial advice", and similar;
- `link`: any scheme, `www.`, `t.me/` or `word.com`, `.fun` and similar.

**How matching works:**

- Text is normalized with NFKC; invisible characters are stripped, accents removed, Cyrillic, Greek and small-caps look-alikes mapped, and leet digits mapped.
- camelCase is split, and meme affixes are handled (`wif`, `inu`, `coin`, cat words and so on).
- Spelt-out letters and split words are caught.
- Each field is also read whole, without the camelCase split. This closes the `SpaceX`, `OpenAI` and `McDonald's` gaps that `486717d` fixed.

**Format clauses:**

- `ticker_format`: `^[A-Z0-9]{2,10}$`.
- `name_format`: 3–32 characters, only letters, digits and `' - . ! &`, Latin script only.
- `tagline_format`: 10–160 characters, no control or format characters, Latin only.
- `not_cat`: the name must carry a cat word, such as cat, kitty, kitten, meow, neko, calico or tabby, or have one glued on.

**Other checks:**

- `tickerFree`: the ticker and the name must not equal those of a Jupiter-verified token (3,695 tokens today) or copy an established cat coin (Popcat's copycat list).
- `siteRefusals`: the site's `launches.js` validator. Name ≤ 32, tagline ≤ 160, no HTML, no link scheme.

### 5.2 Stock-cat clauses: `stockCatRefusals(draft, pair, …)`

- `pair_unknown`: the stock is not one of the 24 xStocks.
- **`pair_terms_missing`**: no research row in `STOCK_CAT_NOTES`. The file **ships empty**.
- `pair_term` and `other_pair`: the draft names this pair or any other of the 24. The terms are the symbol, the root ticker, StonkFun's own symbol and name, words of 3 or more letters from the official name, and the row's people, mascots and brands.
- `pair_ticker`: the ticker starts or ends with the pair's root, or contains the root of any xStock of 3 or more characters.
- `launch_claim`: stock, xstock, share, equity, backed, dividend, collateral, dev buy, no dev, fair launch, stealth, renounced, lp burned, locked.
- `name_taken`: the name or ticker of an earlier stock cat. This is only tracked in one browser's journal.
- `art`: a kitten or background the repo's logo renderer does not know. This does not apply to predetermined images.
- Optional model review with the owner's Anthropic key (`cashcat-draft.mjs reviewStock`).

### 5.3 The disclosure the repo writes

`pairDisclosure(pair)`, VERIFIED:

> "Not financial advice. A cat coin paired on StonkFun with {SYMx}, a tokenised stock: it is not the stock, and is not affiliated with, endorsed by or connected to the company or fund {SYMx} tracks, {SYMx}'s issuer, or StonkFun."

- It names only the xStock symbol, never the company.
- The coin description is the tagline, " — ", then this text. "Made with CashCat" is forbidden.

**X-post text rules** can be reused from `site/assets/callouts.js`. VERIFIED.

- `DRAFT_MAX = 200` characters, one line.
- The text must open with "Name ($TICKER): " and end with a fixed disclosure.
- `DRAFT_BANNED` forbids buy, sell, ape, moon, gem, pump, dump, profit, gain, guarantee, safe, price, mcap, lfg, "send it" and `\d+x`.

### 5.4 The 24 drafted cats run through these rules

Script and output: `R/check-sheet-rules.mjs` and `R/check-sheet-rules.out.json`. VERIFIED.

- **LaunchLab byte limits:** all 24 fit. Names are at most 32 bytes and tickers at most 10.
- **`checkProposal`** on name, ticker and story (as the tagline): **0 of 24 refused**. Every story is 117–160 characters.
- **`tickerFree`** against Jupiter's verified list as read today: 0 refused.
- **`siteRefusals`:** 0 refused.
- **`stockCatRefusals` as shipped:** **24 of 24 refused**, every one with `pair_terms_missing` only.
- **With placeholder "none found" rows** for all 24 pairs, which removes only the research gate: 0 refused.
  - Real rows would add the people, mascots and brands from `…/scratchpad/stockcats/notes/*.md`.
  - They could then trigger `pair_term` or `other_pair`. INFERRED.
- **The sheet's full description** (story plus the sheet's own disclosure) trips `checkFields`. This is expected.
  - It hits `brand` (tesla, apple, amazon, stonkfun…), `endorsement:affiliated` and `financial_promise:"financial advice"` on all 24.
  - The repo never runs list rules on the fixed disclosure; it checks only name, ticker and tagline.
  - But the sheet's disclosure **names the company**, and the repo's design forbids that. A policy decision is needed.

---

## 6. Simulation evidence

| When | Built by | Quote | Payer | Result | Evidence |
|---|---|---|---|---|---|
| 2026-09-24 | bot, legacy tx | SPYx | `FFWtrEQ4…rrhF` (third party, funded) | err null, 98,816 CU, spend 8,673,900 lamports | `fixtures/bots/stonkfun/simulate-initialize.json` |
| 2026-09-25 13:50Z | extension, v0 | SPYx | same | err null, 98,272 CU, spend 8,673,900 | `…/2026-09-25/simulate-initialize-v0-SPYx.json` |
| 2026-09-25 13:50Z | extension, v0 | PLTRx | same | err null, 92,704 CU, spend 8,673,900 | `…/simulate-initialize-v0-PLTRx.json` |
| **2026-09-25 17:47Z** (mine) | `planStonkfunLaunch` (live API and chain), `initializeIx`, `buildUnsignedTransaction` v0, `checkLaunchMessage` passed | SPYx, sheet row 1 "Patchpaw the Calico"/PATCHPAW | same | err null, 100,845 CU, 8,623,100 lamports, 867 B | `R/fresh-sim.out.json` |
| same | same | TSLAx, row 4 SNOWCURL | same | err null, 105,719 CU, 8,638,340, 870 B | same |
| same | same, with a one-row `quoteList` to get past the 24-xStock list | **ANTHROPIC prestock** (`Pren1Fv…`) | same | err null, 100,394 CU, 8,668,820, 864 B | same |
| same | same | **Backpack MU** (Token-2022) | same | err null, 97,422 CU, 8,607,860, 864 B | same |
| same | same | **Backpack PSG** (classic SPL Token) | same | err null, 91,482 CU, 8,557,060, 896 B | same |

How these simulations were run. VERIFIED.

- `sigVerify: false`, and `replaceRecentBlockhash: true` for my runs.
- The mint was a random 32-byte address, so no key existed for it.
- The URI was an Irys-length placeholder: `https://gateway.irys.xyz/` plus 44 characters.
- My wrapper refuses `sendTransaction`.
- The request log shows only stats, pairs, pricing, `getMultipleAccounts`, `getBalance` and `simulateTransaction`: 30 requests in all (`R/fresh-sim.requests.json`).

What the logs show:

- Every run logs `InitializeWithToken2022`, then Token-2022 `InitializeMint2`, `TokenMetadata Initialize`, `MintTo` and `SetAuthority`.
- They also log "Warning: Mint has a permanent delegate, so tokens in this account may be seized at any time", which comes from the quote vault.

Live pricing at 17:46Z. VERIFIED.

- The starting market cap is about **$3,381** and graduation about **$49,678**, whatever the quote.
- The raw raise was:
  - SPYx 1,326,281,432 (8 decimals, about 13.26 SPYx);
  - TSLAx 2,759,785,183;
  - ANTHROPIC 9,846,007,460 (9 decimals);
  - MU 9,486,116 (6 decimals).

What these simulations do **not** show:

- that a wallet can sign the transaction;
- that the mint's signature survives the wallet;
- that StonkFun adopts the pool;
- that links appear on StonkFun.

---

## 7. What is unfinished or unsafe for "Adopt a cat"

**Unfinished in the repo.** VERIFIED unless marked.

1. **Signing by an outside wallet does not exist.**
   - Launches are signed only by the extension's autopilot key (`preflight` refuses with `no_autopilot`).
   - Phantom is explicitly not offered for launches (`CASHCAT_SIGNER_NOTE`).
   - The existing Phantom bridge (`src/injected.mjs`) uses `provider.signTransaction` and then `sameMessage`. That pattern could be reused.
   - Phantom's docs (saved at `R/ph-lighthouse.md` and `R/ph-sending-a-transaction.md`) say two relevant things:
     - Phantom may add Lighthouse assertion instructions, so "the transaction onchain will be different from what you originally submitted";
     - `signTransaction` is "not supported in the wallet standard implementation and may be removed".
   - A mint signature applied **before** the wallet signs would be invalidated if the wallet rewrites the message. INFERRED.
2. **The research gate is empty.** `STOCK_CAT_NOTES = []`, so all 24 xStock pairs are refused (§5.4). The notes exist only as markdown in `…/scratchpad/stockcats/notes/`.
3. **Only 24 xStocks are allowed.**
   - `resolveQuote` and `pairByMint` refuse everything else.
   - `otherQuotes` lists Backpack ("no official issuer list and no issuer allow-list here") and prestock ("prestocks carry a transfer fee") as reasons, never as pairs.
   - `XSTOCK_AUTHORITIES` holds only the xStock issuer's keys, so `quoteRefusals` refuses every Backpack and prestock mint with `quote_issuer`. Prestocks also get `quote_transfer_fee`, and BOT gets `quote_symbol` (`R/read-quote-mints.out.json`).
   - StonkFun lists 24 xStock, 76 Backpack and 7 prestock pairs, all launchable and LaunchLab-ready (`…/scratchpad/stockcats/stonkfun-pairs.json`).
4. **Metadata has no website or X, and uploads need the owner's Pinata JWT.**
   - The JWT is a secret and cannot be used by adopters. It is fine for pre-pinning each cat's kit once. INFERRED.
5. **One cat per stock and day caps live in one browser's `chrome.storage` journal.**
   - A public site needs a global "first confirmed launch wins" read from chain.
   - The repo's `onchainLaunches` counts **one known wallet's** launches, so it does not fit adopters, whose wallets are unknown in advance. INFERRED.
6. **The model review needs an Anthropic key.** A static site has none. The kit is fixed and could be reviewed ahead of time instead. INFERRED.
7. **The planner imports `src/lib/config.mjs`,** which pulls in the whole executor snipe lane. See §9.
8. **RPC.**
   - The extension refuses the public RPC for planning.
   - The public mainnet RPC answers **403 "Access forbidden" to any request with an Origin header**: catcoinsanctuary.com, example.com and github.io were tried. It answers 200 without one (`R/rpc-origin-matrix.txt`, `R/rpc-cors-headers.txt`).
9. **No security review and no live launch.**

**Unsafe or risky for adopters.**

- **Transfer-fee quotes.**
  - All 7 prestocks have TransferFeeConfig. The older fee is 100 bps from epoch 1039 and the newer is **300 bps from epoch 1043**, with no maximum (`R/transfer-fee-decoded.txt`). VERIFIED.
  - Slot 450,423,627 ÷ 432,000 is about epoch 1042.6, so 3% is roughly a day away. INFERRED.
  - Every buy and sell of such a pool loses 1–3% of the quote leg to the issuer's fee. Pool accounting against a fee-on-transfer quote is untested by this repo, though a real StonkFun launch paired with ANTHROPIC exists and my simulation succeeded.
- **Issuer powers over the pool's quote vault.**
  - The xStock issuer holds the permanent delegate, freeze and pause keys (`XSTOCK_AUTHORITIES`).
  - The prestock keys are `WV9PJN7X…`.
  - Backpack has per-mint mint authorities, with freeze and permanent delegate held by `2cVYpag…`.
  - The simulation log itself warns that the vault's tokens "may be seized at any time". VERIFIED.
- **Squatting and front-running.**
  - The kit (name, ticker, image, URI) is public. Anyone can launch the same kit first, from any wallet.
  - "First confirmed launch wins" therefore rewards bots unless the win rule checks something only an adopter could have, for example a wallet that registered on the site. INFERRED.
  - Also, with no atomic dev buy on the hand-built path, the adopter's own first buy can be sniped. StonkFun's API path bundles the dev buy atomically, per its developer page captured by another agent. INFERRED.
- **Adoption can silently fail.**
  - If the raise, config or rule differs from StonkFun's builder, the pool trades on Raydium but is never recorded. The creator then gets **no fee forwarding**, per StonkFun's page (§2.3).
  - The builder guards against this by using pricing verbatim and planning again at launch time.
- **Creator fees.**
  - On chain, `creatorFeeRate` and `creatorScale` are 0, and `platformCpCreator` is StonkFun's wallet. VERIFIED.
  - Any creator share is StonkFun's off-chain forwarding to the pool's `creator` account. The repo labels this "Not verified; nothing is claimed".

---

## 8. What StonkFun's developer page says

This section cites another agent's capture, `…/adopt/raw/developers-build-yourself-code.txt`. I read it but did not re-fetch it.

- Hand-built launches are "adopted" within a minute or two.
- An adopted launch is "indistinguishable from an API-created one". The "pool's own `creator` account is who gets paid, so a standard launch forwards its creator share to your wallet without you registering anything."
- StonkFun's own API path is different. `/launches/prepare` returns an **unsigned payment transaction** that the creator signs, then `/launches/submit` lands the payment, mint, pool and liquidity (and an optional dev buy) in one atomic bundle.
- That path needs only **one** signature from the creator's wallet, so the two-signature problem disappears. The trade-off is that StonkFun builds what the user pays for, so the repo's `checkLaunchMessage` could not check the launch itself. INFERRED. Another agent owns this topic.

---

## 9. Reusing the modules in a browser

VERIFIED facts:

- **Everything is ES modules** (`package.json` `"type": "module"`).
- **Dependencies:**
  - `@solana/web3.js` **1.98.4** (the v1 API, not @solana/kit);
  - `bs58` 4.0.1;
  - `buffer` 6.0.3;
  - `@noble/hashes` 1.8.0;
  - `@noble/curves` 1.9.7;
  - built with `esbuild` 0.25.9.
- **It already runs in a browser.** `build.mjs` bundles these modules for Chrome MV3 with `platform: "browser"`, an injected `Buffer` global (`src/shims/buffer-inject.mjs`) and a `node:crypto` shim (`src/shims/node-crypto.mjs`, sha256 only through @noble). Any other `node:` import fails the build by name.
- The local gitignored `dist/background.js`, built at 15:13, already contains the LaunchLab discriminator `25be7ede2c9aab11`.
- **Trial bundle.** Using the repo's own `buildOptions`, output in `R/bundle/`:

| Entry | Minified size | Build result |
|---|---|---|
| `stonkfun.mjs` only | 336,059 B | 0 errors, 0 warnings |
| stonkfun + txcheck + tx + content-rules + catdetect + stockcats + createMintKeys + describeMint | 432,376 B | 0 errors, 0 warnings |

- Even `stonkfun.mjs` on its own pulls in **15 vendor/executor snipe modules**. The cause is its `import { XSTOCK_BUILTIN } from "../../src/lib/config.mjs"`. `txcheck.mjs` also imports `bots/cashcat/pumpfun.mjs`.

| Module | Browser-ready? | Node-only parts and caveats |
|---|---|---|
| `bots/cashcat/stonkfun.mjs` | yes, with the Buffer inject | uses `Buffer`. Its import of `src/lib/config.mjs` drags in the snipe lane: move the default xStock list out or pass `quoteList` in |
| `bots/lib/solana.mjs` | yes, with Buffer | none besides that |
| `bots/lib/verified.mjs` | yes | pure constants |
| `bots/lib/txcheck.mjs` | yes | imports `pumpfun.mjs`, pump.fun code that adoption does not need. Could be split per venue |
| `src/lib/tx.mjs` | yes | imports `../shims/jupiter.mjs` (browser shim). Has `buildUnsignedTransaction`, `sameMessage`, base64 helpers |
| `src/lib/session-wallet.mjs` `createMintKeys` | yes | `Keypair.generate()` in page memory; signs its slot once, then is dropped. The file also holds the autopilot keystore, which a site does not need, so copy only this function |
| `bots/lib/content-rules.mjs` | yes, with the `node:crypto` shim | imports `given-names.mjs`, 5,231 lines, which is weight. Only `hashTerm` uses crypto |
| `bots/lib/catdetect.mjs` | yes | pure |
| `src/lib/stockcats.mjs` | yes | imports config, executor, logo-layout and invent. Heavy |
| `vendor/executor/token2022.mjs` `describeMint` | yes, with the shim | uses `createHash("sha256")` |
| `bots/lib/http.mjs`, `rpc.mjs` | yes (fetch), with Buffer | the RPC client needs a browser-allowed RPC URL (§7 item 8) |
| `bots/cashcat/metadata.mjs` `pinMetadata` | technically yes | needs a Pinata **JWT**, a secret, so it must not run in the page. `buildUserDocument` is pure but lacks website and X |
| `bots/cashcat/logo.mjs`, `bots/lib/data.mjs`, `bots/cashcat/wallet.mjs` | **no** | `node:fs`, `node:path`, `@napi-rs/canvas` (native), and a key read from an env secret. Not needed for adoption |
| `bots/cashcat/launch.mjs` | no | `fs` and env, and the bot's orchestration |

---

## 10. Implications for the adoption design

All of this section is INFERRED.

- **Reuse as-is:**
  - `planStonkfunLaunch`, `initializeIx` and the PDA helpers;
  - `checkLaunchMessage` and `checkSimulation`;
  - `buildUnsignedTransaction`, `sameMessage` and `createMintKeys`;
  - the `stockCheckAdoption` comparison;
  - `decodeInitialize` and `readMessage`, for an indexer that decides "first confirmed launch wins" by scanning `getSignaturesForAddress(4E876q…)` (how the fixture samples were collected) and matching the kit's name, symbol and URI and the cat's quote mint.
- **Signing order to test first:**
  1. Build and check the unsigned v0 transaction.
  2. The adopter's wallet signs with `signTransaction`, **before** the mint signs.
  3. `sameMessage` confirms the wallet changed nothing.
  4. The in-page mint keypair adds its signature.
  5. Send through a browser-allowed RPC.
  - This order avoids the "did the wallet keep the mint's signature" question.
  - It fails loudly, which is correct, if the wallet rewrites the message.
  - The alternative is StonkFun's single-signature prepare/submit API.
- **Pre-build each cat's metadata once,** in StonkFun's shape: `extensions.website` set to the cat's catcoinsanctuary.com page, `extensions.twitter`, `properties.links`, and the kit image. Store it on Arweave or Pinata. The adopter then uploads nothing and needs no secret.
- **Decisions the owner must make before 67 of the 91 cats can use this code:**
  - an allow-list for Backpack and prestock issuers;
  - whether transfer-fee quotes are acceptable;
  - how the disclosure is worded: company named or symbol only.

---

## 11. Open questions

1. Does Phantom, or Solflare or Backpack, change a v0 message in `signTransaction`, or keep a pre-existing co-signature in `signAndSendTransaction`? One way to test without mainnet risk is a dummy two-signer transaction on devnet.
2. Does StonkFun fill `links` (website, X) for a **hand-built** adopted launch whose metadata uses `extensions` or `properties.links`? VOLTAGENT's top-level keys were ignored.
3. Is the LaunchLab curve-rule field 5 the raise? Does StonkFun refuse adoption on a raise that differs slightly because it was priced minutes earlier?
4. Is it acceptable for LaunchLab pools against prestocks (transfer fee 1%, rising to 3%) and Backpack tokens to be adoptable, given the issuers' seize and freeze powers?
5. Which RPC should the static site use, given that the public one refuses browser Origins? Options: a provider key restricted to the domain, or letting the wallet send.
6. What win rule for "first confirmed launch" resists kit-squatting bots, when the kit is public?
7. Is the repo's `pairDisclosure` (symbol only) or the sheet's disclosure (names the company and says "No intrinsic value") the approved text?

---

## 12. Evidence index

In the repo:

- `bots/cashcat/stonkfun.mjs`, `bots/lib/txcheck.mjs`, `bots/lib/solana.mjs`, `bots/lib/verified.mjs`, `bots/cashcat/metadata.mjs`, `bots/cashcat/config.mjs`, `bots/lib/content-rules.mjs`, `bots/lib/catdetect.mjs`, `bots/cashcat/tickers.mjs`
- `src/lib/stockcats.mjs`, `src/lib/stock-cat-notes.mjs`, `src/lib/cashcat-tab.mjs`, `src/lib/tx.mjs`, `src/lib/session-wallet.mjs`, `src/injected.mjs`, `src/background.mjs`
- `site/assets/launches.js`, `site/assets/callouts.js`, `build.mjs`, `src/shims/*`
- `fixtures/bots/stonkfun/**`

In `R/` (`/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/launcher/`):

- `run-test-*.txt`: today's test runs.
- `decoded-accounts-2026-09-24.txt` (with `decode-rule.mjs`): platform, config and curve rule decoded.
- `check-sheet-rules.mjs` and `.out.json`: the content rules run over the 24 drafted cats.
- `fresh-sim.mjs`, `.out.json` and `.requests.json`: today's plans and simulations.
- `read-quote-mints.mjs`, `.out.json`, `rpc-quote-mints.json` and `transfer-fee-decoded.txt`: prestock and Backpack mints on chain.
- `meta-*.json` and `token-*.json` (with `hdr-token-*.txt`): metadata shapes, StonkFun records and CORS headers.
- `rpc-cors-headers.txt`, `rpc-preflight-headers.txt` and `rpc-origin-matrix.txt`: the public RPC refusing browser Origins.
- `jupiter-verified-2026-09-25.json`: 3,695 verified tokens.
- `bundle/`: the trial browser bundles and their sizes.
- `ph-lighthouse.md` and `ph-sending-a-transaction.md`: copies of Phantom's docs saved earlier in this session.

Evidence from other agents that I cited:

- `…/adopt/raw/developers-build-yourself-code.txt`
- `…/adopt/raw/chain-launch-decodes.json`
