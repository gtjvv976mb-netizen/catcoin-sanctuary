# Stock cats: implementation plan (one cat coin per xStock, launched on StonkFun from CoinMarketCat's tab)

Checked against the repo at 6335ae9 (clean) and the live reads in `launcher-design/raw/` (2026-09-25, 13:04–13:10Z). `stockcats/stock-cats.md` does not exist yet, so nothing below uses it.

## 1. What the check found

**Claims that held:**
- The no-key:292 regex survives new arguments placed before `mintKeys`; `signAsMint` has one call site; the `=== 15` and `SAFE_LINK` pins exist; `www.stonkfun.xyz` is not in `HOSTS_CALLED`.
- The SPYx fixture spends 8,673,900 lamports and 98,816 CU. The config.mjs:53 comment says "101,883"; fix it.
- All six sampled launched mints read `null` for both mint and freeze authority.
- `/tokens/{mint}` returns `data.launch.{mint,pool,creator,launchpad,mode}`.
- `describeMint` already returns what the quote checks need, and the agent does not exclude CashCat's launches.

**Missed by both designs: the brand rule can be dodged with camelCase.** `wordHits` splits camelCase and only rejoins halves that are both 3 or more letters long. `"SpaceX Cat"`, `"McDonald's Cat"`, `"OpenAI Cat"` and `"JPMorgan Cat"` all pass `checkFields` today. SPCXx and MCDx are pairs.

**Design 1:**
- Its Phantom path breaks test-hawk-no-key:306 ("the tab holds no bridge") and changes `engine.signSendConfirm`.
- The coin's description names the product ("Tesla xStock").
- Pairs can launch with no CEO or mascot terms, though `FAMOUS_PEOPLE` has no per-company list and no rule knows mascots.
- "test-engine" should be test-hawk-engine.mjs.

**Design 2:**
- It auto-signs a batch over about 12 days before any extension v0 StonkFun transaction has been simulated or has landed.
- It needs the model (2 calls per stock), and the batch must stay in step with CashCat's auto mode.
- Its research gate and its symbol-only disclosure are right.

| (1–5, 5 best) | Safety | Owner effort | Honesty/conventions | Implementation risk (5 = low) |
|---|---|---|---|---|
| Design 1 | 4 | 2 | 3 | 3 |
| Design 2 | 3 | 4 | 4 | 2 |

**The plan takes** Design 1's manual launches, prepare binding, deterministic names, quote checks, adoption and `own_launch`, and Design 2's research gate, symbol-only disclosure, all-pairs rules and `quoteList`. It leaves out Phantom and the batch.

## 2. Scope, and which xStocks can be quotes

- **One cat per xStock**, for the 24 that StonkFun lists as launchable and LaunchLab-ready.
- **Launches are manual**, one at a time, signed by the autopilot wallet, with no dev buy and no later buying or selling. CashCat's pump.fun path is unchanged.
- **The other 514 quote assets are shown as a count only**, with the reasons: not on the official list, a transfer fee (prestocks and tessera), crypto (13 Backpack listings), and no issuer allow-list.

**All 24 passed every `planStonkfunLaunch` check at 13:04Z:**
- the pair was ready by mint;
- the pricing named LaunchLab, StonkFun's platform and the launch shape, with no vesting and `cpmmCreatorFeeOn` 0;
- the GlobalConfig on chain had `quote_mint` equal to the stock and `curve_type` 0;
- the curve-rule PDA existed.

**Every mint reads the same way:**
- Token-2022, 8 decimals, not paused, default state initialized, no transfer fee, a null hook, and the on-chain symbol equal to the official one.
- The same authorities on all 24:

  | Authority | Address |
  |---|---|
  | mint | `7pt9tkctJPK7PPNQJ77GKg8ZffSF6QxoMiCFYHxrtaCj` |
  | freeze/pause | `JDq14BWvqCRFNu1krb12bcRpbGtJZ1FLEakMw6FdxJNs` |
  | permanent delegate/metadata | `5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq` |
  | scaled-UI | `S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS` |

Only SPYx has a recorded simulation, and it is legacy, not v0.

**The 15 built-in xStocks can be quotes today** (`XSTOCK_BUILTIN`). How the brand rule treats their names:

| Brand rule | Stocks |
|---|---|
| Refuses the name | NVDAx, GOOGLx, TSLAx, COINx, AMZNx, HOODx, AAPLx (StonkFun: APPLX), METAx, MSFTx |
| Misses the name | SPYx, QQQx, CRCLx (Circle), MSTRx (MicroStrategy), GLDx (Gold) |
| Can be dodged | SPCXx (SpaceX) |

**Nine more are refused today at `quote_not_xstock`.** Each is on xstocks.com/us/products (read 2026-09-25) and passed every live check:

| StonkFun | Official (name) | Mint | Brand rule |
|---|---|---|---|
| PLTRX | PLTRx (Palantir) | XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4 | misses |
| GMEX | GMEx (Gamestop) | Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc | refuses |
| STRCX | STRCx (Strategy PP Variable) | Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH | misses |
| MCDX | MCDx (McDonald's) | XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2 | **can be dodged** |
| BRKX | BRK.Bx (Berkshire Hathaway) | Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x | misses |
| KOX | KOx (Coca-Cola) | XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ | refuses |
| INTCX | INTCx (Intel) | XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM | refuses |
| VIDAX | VIDAx (Vida Global) | XsfCC9VL4DamVGNgdJpfLXB3sBVa158Gbx8sh7NzmTk | misses |
| DFDV | DFDVx (DFDV) | Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy | misses |

No rule catches ticker roots except META. Until a pair has its sourced research row, it is refused (`pair_terms_missing`). Today that is every pair.

## 3. Files and exports

1. **`bots/lib/content-rules.mjs`**
   - `wordHits` also matches against `normalize(text.replace(/['’]/g,""))` without splitting camelCase.
   - Export `checkTerms(fields, {[rule]: terms[]})`.
   - This also fixes CashCat and the bot.
2. **`src/lib/config.mjs`**
   - Add `STONKFUN_XSTOCKS`: the 15 built-ins plus the 9 above, each `{symbol, name, mint, stonkfun, source}`.
   - Add `XSTOCK_AUTHORITIES`.
   - `XSTOCK_BUILTIN` is untouched, so the trading lanes and the `=== 15` pins are unaffected.
3. **`bots/cashcat/stonkfun.mjs`**
   - `resolveQuote(choice, list = XSTOCK_BUILTIN)`.
   - `planStonkfunLaunch({…, quoteList = XSTOCK_BUILTIN})`, which also returns `quoteMintAccount`.
   - The bot's behaviour is unchanged.
4. **`bots/cashcat/metadata.mjs`**: `buildUserDocument({…, venue = "pumpfun", disclosure = null})`. For StonkFun, `createdOn` is `https://www.stonkfun.xyz`.
5. **New `src/lib/stockcats.mjs`** (pure: no host, no chrome.*, no logging, no signing)
   - `STOCKCAT_HOSTS = [HOSTS.stonkfun]`, `STOCK_PAIRS`, `STOCKCAT_LIMITS {maxPerDay: 2, fence: FENCES.maxLaunchesPerDay, prepareTtlMs: 600_000}`.
   - `pairTerms`, `stockCatRefusals`, `suggestNames`, `pairDisclosure`, `quoteRefusals(describeMint(acc), pair)`, `StockCatError`, and `stockDraftKey` (draft fields + `"stonkfun"` + pair mint).
6. **New `src/lib/stock-cat-notes.mjs`**
   - `STOCK_CAT_NOTES`, empty until it is filled from stock-cats.md.
   - Each row: `{mint, people[], mascots[], brands[], catFacts[{text, source, readAt}], searchedAt, method}`.
   - An empty `mascots` counts only when it is dated. Sources are text; nothing fetches them.
7. **`src/lib/cashcat-draft.mjs`**: `stockCatReview` uses `REVIEW_TOOL` with `{name, ticker, tagline, paired_with, must_not_reference}`. It never sees the cat facts.
8. **`src/lib/cashcat-tab.mjs`** (still the only file besides the key file that names `signAsMint`)
   - `VENUE_RUN`, per venue: `{ix, compute: COMPUTE_LIMITS[v], budget: MAX_LAUNCH_SPEND_LAMPORTS[v], mustLog}`. The log is `"Instruction: CreateV2"` for pump.fun and `"Instruction: InitializeWithToken2022"` for StonkFun.
   - `buildCheckSimulate` and `launchPipeline` take `venue = "pumpfun"`, `plan`, `pair` and `prepared`. There is one plan per launch, used for both builds.
   - `preflight` uses the budget for the venue. On StonkFun there is no dev buy, and `devBuy` refuses any venue other than pump.fun.
   - New injected `stonkfun {plan, token}` and a `stockCats` object: `list`, `refresh`, `suggest`, `draft`, `prepare`, `launch`, `checkAdoption`, `saveSettings`.
   - It uses the shared journal `cia:cashcat:journal`, so `unresolved`, `exclusions()` and the day counts all cover stock cats. Entries gain `venue`, `pair {official, stonkfun, mint}` and `pool: poolState(mint, pair.mint)`.
   - Links: `PAGES.stonkfunToken` and Solscan.
9. **`src/background.mjs`**
   - `const stonkfunHttp = catHttp([HOSTS.stonkfun]);`
   - `stonkfun.plan` = `planStonkfunLaunch({http: stonkfunHttp, rpc: catRpcFor(stonkfunHttp).rpc, quoteChoice, quoteList: STONKFUN_XSTOCKS})`, passed in before `mintKeys`.
   - `pinata.pin({…, venue})` accepts only pumpfun or stonkfun.
   - `STOCKCATS.*` messages are accepted from extension pages only.
   - `createAgentRunner({…, ownLaunches: () => cashcatTab.exclusions()})`.
10. **`src/lib/protocol.mjs`**: `cia:stockcats:` messages:
    - `list`, `refresh`
    - `suggest {pairMint}`, `draft {pairMint, idea}`, `prepare {pairMint}`
    - `launch {pairMint, preparedId, confirmTicker}`
    - `adoption {mint}`, `settings {maxPerDay}`

    It reuses CashCat's `MARK_CHECKED`.
11. **New `src/popup/stockcats.mjs`**
    - A card in CoinMarketCat's tab, drawn with `textContent` only.
    - `SAFE_LINK` adds `www\.stonkfun\.xyz\/token`.
    - The journal link at popup/cats.mjs:197 follows `e.venue`.
12. **`src/lib/agent-runner.mjs`**: refuses (`own_launch`) to buy the owner's own launches, and removes them from the universe.

## 4. Naming rules (name, ticker, tagline; no topic)

- **Existing rules still apply:** `checkProposal` (with the fix), `tickerFree`, and `siteRefusals` with the trend title "cat".
- **`pair_term`:** none of this pair's terms. The terms are:
  - the official symbol, root ticker, StonkFun symbol and StonkFun name;
  - each word of 3 or more letters in the official name, except "xStock";
  - the research row's people, mascots and brands.
- **`other_pair`:** no term of any of the other 23 pairs.
- **`pair_ticker`:** the ticker may not start or end with this pair's root or symbol (compared as alphanumerics, e.g. `BRKB`). It may not contain any pair's root of 3 or more letters.
- **`launch_claim`:** none of stock, xstock, share(s), equity, backed, dividend, collateral, dev buy, no dev, fair launch, stealth, renounced, lp burned, locked.
- **`name_taken`:** no name or ticker of an earlier stock cat.
- **`pair_terms_missing`:** the pair has no research row yet.
- **Suggestions (no model):**
  - The name is `"<Background> <Kitten> Cat"`.
  - The ticker is the first 4 letters of the background plus the first 3 of the kitten.
  - The order is seeded by the pair's mint.
  - Only names that pass every rule are shown.
  - The tagline is fixed: "A <kitten> cat on a <background> sign."
  - The logo uses bundled sprites only.
- **Disclosure** (fixed, never typed): `"Not financial advice. A cat coin paired on StonkFun with ${official}, a tokenised stock: it is not the stock, and is not affiliated with, endorsed by or connected to the company or fund ${official} tracks, ${official}'s issuer, or StonkFun."`
  - The description is the tagline, then " — ", then the disclosure.
  - "Made with" is off.
  - Cat facts appear only to the owner, labelled "Sourced fact, not an endorsement", with source and date.

## 5. Flow, arming, caps

**PREPARE** runs, in order:
1. `preflight`.
2. The rules, and the model review if a key is saved.
3. The caps.
4. `stonkfun.plan`. A refusal is reported as `plan_refused:<inner>`.
5. `quoteRefusals`.
6. A throwaway mint, then build, check and simulate with the placeholder `uriFor("stonkfun", …)`.
7. `forget`.
8. Keep `prepared[pairMint] = {id, draftKey, wallet, plan ids, at}` in worker memory only.

**The owner then sees** the accounts (platform `4E876q…` "StonkFun", pool PDA), a v0 message with 2 signers, simulated SOL and CU against 0.015 SOL, the raise, market caps labelled "StonkFun's pricing figure, not a forecast", the scaled-UI multiplier, and:
- "The issuer holds a permanent delegate and a freeze authority over this stock: it could move or freeze the pool's stock";
- "No dev buy";
- "StonkFun says it forwards a creator share off chain. Not verified; nothing is claimed."

**Arming is the prepared record plus the typed ticker, within 10 minutes.** LAUNCH refuses with:

| Clause | When |
|---|---|
| `prepare_first` | nothing was prepared |
| `prepare_stale` | the record is over 10 minutes old |
| `pair_changed` | the pair differs from the record |
| `draft_changed` | the draft differs from the record |
| `wallet_changed` | the wallet differs from the record |
| `confirm` | the typed ticker is wrong |

The popup's `confirm()` names the ticker, the pair, the wallet and the cost. A prepared record is used once, and nothing stays armed.

**The launch**, in order:
1. Plan again. A changed config, rule or token program is refused (`plan_changed`). A changed raise is only recorded.
2. The quote checks.
3. The logo.
4. Build, check and simulate with the placeholder URI.
5. Pin (`venue:"stonkfun"`).
6. Build, check and simulate with the real URI.
7. Journal `sending`.
8. `signAsMint`.
9. `p.f.signSendConfirm`.
10. Read back. If a mint or freeze authority is still set, the launch is recorded `mintClean:false` and further stock cats are blocked (`unclean_mint`) until MARK_CHECKED.

**Caps and limits:**

| Limit | Clause |
|---|---|
| 1 cat per stock | `stock_has_cat` |
| 2 launches a UTC day (fence 1–6), counting every extension launch | `stock_day_cap` |
| 0.015 SOL spend per launch | — |
| Balance of at least the budget plus the rent floor | `balance` |
| No dev buy | `no_dev_buy_on_stonkfun` |
| Never in auto mode | `manual_only` |
| No public RPC for the planner (it answers 403 to the extension) | `no_rpc` |

**CHECK_ADOPTION** (the owner starts it) reads `/tokens/<mint>`. The launch counts as adopted only when all of these match:
- `launch.mint`
- `launch.pool` = `poolState(mint, pair)`
- `launch.creator` = the payer
- `launchpad` "launchlab"
- `mode` "standard"
- `token.quote.mint` = the pair

A `not_found` answer means "not adopted yet", never a failure.

## 6. Clauses, each with a failing test

| Where | Clauses |
|---|---|
| Rules | `pair_unknown`, `pair_terms_missing`, `pair_term`, `other_pair`, `pair_ticker`, `launch_claim`, `name_taken`; the brand fix: SpaceX, McDonald's, OpenAI and JPMorgan cats are refused, and "Cat Intelligence" is still allowed |
| Quote | `quote_paused`, `quote_default_frozen`, `quote_transfer_fee`, `quote_hook`, `quote_symbol`, `quote_issuer` (≠ `XSTOCK_AUTHORITIES`) |
| Tab | `venue`, `manual_only`, `no_dev_buy_on_stonkfun`, `prepare_first`, `prepare_stale`, `pair_changed`, `draft_changed`, `wallet_changed`, `confirm`, `plan_changed`, `plan_refused`, `stock_has_cat`, `stock_day_cap`, `unclean_mint`, `no_rpc` |
| Planner (untested today) | `pairs`, `pricing`, `chain`, `quote_mint`, `too_long`, `decode` |
| Agent | `own_launch` |

## 7. Fixtures (`fixtures/bots/stonkfun/2026-09-25/`)

1. `api-stats.json`: https://www.stonkfun.xyz/api/public/v1/stats
2. `api-pairs-ready.json`: https://www.stonkfun.xyz/api/public/v1/pairs?launchable=true&launchLabReady=true
3. `pricing/<official>.json` ×24: https://www.stonkfun.xyz/api/public/v1/launchlab/pricing?quoteMint=<mint>
4. `accounts-xstocks.json`: `getMultipleAccounts` in **base64** of the platform `4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7`, the 24 configs, the 24 curve rules and the 24 quote mints. The raw copies are jsonParsed.
5. `xstocks-official-24.json`: the 24 rows of https://xstocks.com/us/products (`__NEXT_DATA__`). The extension never calls this host.
6. `launched-mints.json`: the six mints from `launch-samples.json`, in base64.
7. `api-token-adopted.json`: https://www.stonkfun.xyz/api/public/v1/tokens/<mint> for an xStock-paired launch from https://www.stonkfun.xyz/api/public/v1/launches. Also `api-token-not-found.json`, for an unused address.
8. `simulate-initialize-v0-{SPYx,PLTRx}.json`: the extension's own v0 bytes, simulated (`sigVerify:false`) on https://api.mainnet-beta.solana.com with a funded third-party payer and an unused mint. Nothing is signed.

Fixtures 1–3 and 5 are already in `raw/`. Fixtures 4 and 6–8 still need recording.

## 8. Tests

**New `test-cats-stockcats.mjs`** covers:
- the 24 pairs against the fixtures, matched by mint;
- the 15 built-ins against `XSTOCK_BUILTIN`;
- every clause in §6;
- the terms, suggestions and exact disclosure for each pair;
- that no research text reaches the document;
- a run in a LaunchLab chain double. The message must be v0 with signers `[payer, mint]`, pass `checkLaunchMessage` with `venue:"stonkfun"`, log `InitializeWithToken2022`, spend 8,673,900 lamports, write the journal fields and links, and call `signSendConfirm` once, even with CashCat's `devBuySol` at 0.05;
- hostile v0 edits, refused before `signAsMint`: reward platform, raise, vesting, transfer fee, no curve rule, an extra transfer, a lookup table;
- adoption;
- that `autoTick` never builds a LaunchLab launch.

**Existing tests to update:**
- test-bots-content (camelCase); test-bots-stonkfun (`quoteList`, planner clauses); test-bots-txcheck (v0 StonkFun passes, `lookup_tables` refused); test-cats-cashcat (pump.fun unchanged, `venue` in the journal).
- test-hawk-no-key:
  - `:298-302`: the call shapes and `VENUE_RUN`;
  - `:307-316`: `stockcats.mjs`;
  - `:332`: `bots/cashcat/stonkfun.mjs`;
  - `:306` stays as it is.
- test-hawk-manifest:113 (`STOCKCAT_HOSTS`); test-cats-no-leak (pin `stonkfunHttp`); test-cats-popcat:135 (`SAFE_LINK`); test-hawk-bundle:198-200 (new strings, popup ≤ 0.4 MB); test-agent-runner (`own_launch`); test-site (new copy).

## 9. Hosts, README and site copy

- **`HOSTS_CALLED`**: add this row, the same in the README table:
  `["www.stonkfun.xyz", "CoinMarketCat", "StonkFun's public API, keyless: whether LaunchLab launches are on, which stocks are ready to pair, a stock cat's pricing (every number checked on chain before it is built) and, when the owner asks, its launch record"]`
  The two Pinata rows add "CoinMarketCat".
- **The `https://*/*` reason**: "…CashCat's trends, verified-token list and Pinata uploads)" becomes "…CashCat's trends, verified-token list and Pinata uploads; CoinMarketCat's stock cats: StonkFun's pairs, pricing and launch records)". README:626 changes in the same commit.
- **`CASHCAT_VENUE_NOTE`**: "SOL-quoted pump.fun coins here. Stock cats, one per xStock on StonkFun, are in CoinMarketCat's tab. pump.fun coins quoted in a stock stay the agency's CashCat's."
- **Other docs**:
  - rewrite README:584-585;
  - rewrite privacy.md:40-41: StonkFun receives the stock's mint, the launched mint and the IP;
  - rewrite options/cats.mjs:29;
  - add a README section, "Stock cats (CoinMarketCat, on StonkFun)".
- **Site** (CoinMarketCat page and downloads card, pinned in test-site): "Stock cats: name one cat coin of your own for each tokenised stock StonkFun lists, check it, and launch it on StonkFun from the autopilot wallet, one at a time, with no dev buy. The stock is only the pair: a stock cat is not the stock and is not affiliated with the company."

**Order of work:** rules fix → config and planner → fixtures → stockcats module and notes → metadata → `VENUE_RUN` and txcheck → worker, protocol, popup → agent → hosts, docs, site → `npm test`.

## Owner decisions

1. **Which stocks:** the 24 xStocks, with the 9 new ones kept in a separate `STONKFUN_XSTOCKS` so the built-in list stays at 15. **Recommend yes.** Backpack's 60 stock tokens should wait for an official issuer list and an authority allow-list. Prestocks and tessera stay out while they carry transfer fees.
2. **Research gate:** a stock becomes launchable only once stock-cats.md gives its people, mascots and brands, each sourced, or a dated "none found". **Recommend yes.** No rule knows any mascot.
3. **Manual, autopilot wallet only:** no batch, no auto mode and no Phantom. **Recommend yes.** Revisit a batch only after a stock cat has read back clean and been adopted. Phantom co-signing should be its own change, with its own proof.
4. **Caps:** one cat per stock, ever, and 2 launches a UTC day across all extension launches (fence 1–6). **Recommend both.**
5. **What the coin says:** the disclosure names only the xStock symbol, not the company. Cat facts are shown to the owner only, never in the coin. "Made with" is off. **Recommend all three.**
