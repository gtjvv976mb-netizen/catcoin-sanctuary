## Scores

| Design | Live-path safety | Real coverage | Implementation risk / reviewability | Honesty & conventions | Total |
|---|---|---|---|---|---|
| 1 safety-first | 9 | 5 | 5 | 8 | **27 (winner)** |
| 2 coverage-first | 8 | 7 | 3 | 8 | 26 |
| 3 simplicity-first | 7 | 2 | 8 | 3 | 20 (rejected: wrong reading) |

**What I checked in the code and the scratchpad**
- **Design 3 misreads how the agent buys, so I rejected it.**
  - The agent's `quote()` always sends `onlyDirectRoutes=true` (jupiter-swap.mjs:161).
  - `checkQuote` refuses any hop that isn't direct with `route_not_direct` (:231-236).
  - Design 3 says "7 of the default ten quoted a $25 buy under 2%". Those figures are `anyRoute`, the multi-hop quotes in routes2.json.
  - The direct quotes in routes.json tell a different story: 9 of its 10 seats (MEW, KITTY, SC, PEPECAT, RKC, MASK, VIBECOIN, OIIAOIIA, GIKO) answer `NO_ROUTES_FOUND`. Every model buy of them would end in `jupiter_no_route`, so its real coverage is POPCAT alone.
- **Design 2's chain claims hold up** (chainread.json):
  - 78 mints read at slot 450,324,013.
  - 64 pass, 10 are refused for TransferFeeConfig, 4 have a live mint authority.
  - For INBRED, Jupiter's audit says safe (`jupSafe:true`) but the chain shows `mint_authority_live`. So Jupiter's audit can only ever be a pre-filter.
- **Direct routes are the real limit.** Of the 64 chain-passing coins, 5 have a direct USDC route: POPCAT 0.50%, VIBE 1.06%, CATTY 1.11%, CATWIF 2.47%, CATCOIN 95%. With USDT, the only direct route is LEVERCAT at 93.6%. All three designs agree on this.
- **Design 2 scans inside `tick()`.** `tick()` holds `busy` and runs inside `exclusive` (agent-runner:612-613). A list read with a 30 s timeout there would skip the next ticks, and with them the stop-loss checks. Designs 1 and 3 scan outside the tick, which is correct.
- **Design 1 has two slips:**
  - It quotes the list as 5,251,022 bytes. The two recorded reads are 5,232,631 and 5,232,902 bytes.
  - Its tests "ZCAT → `scout_buy_impact`" and "$CWIF passes" can't happen in its own gate order: both are TransferFeeConfig coins, refused at the chain gate before any quote.
- **Design 1's fresh `readFacts` that bypasses the cache adds nothing:**
  - An authority set to None cannot be set again.
  - Pausable is not in `ALLOWED_MINT_EXTENSIONS` (token2022.mjs:69-78).
  - `describeMint` already returns both authorities (:320-321), so a check on the cached facts is enough.
- **All three keep `allowedPairs: pairsNow()`**, so the regexes in test-hawk-no-key (:256-260) still match.

**The plan:** Design 1's gates, route probe, two-scan confirmation and arm sentence. Added from Design 3: one derived spec as the single source of membership, sells of held coins, `candles:false`, and the `mintAdmission` helper. Added from Design 2: the liquidity ≤ mcap rule, counts-only funnel in the model context, and a route note for each pinned coin.

**What the owner will see today.** With the six preset coins still ticked, the scout admits nothing new, because POPCAT is already pinned. With the pins cleared, it admits POPCAT alone. The UI must say why:
- Almost every cat coin trades against SOL.
- The check before signing accepts only a direct swap with the settlement token.
- Allowing one SOL hop is a separate, security-sensitive design, and this plan does not do it.

---

# Implementation plan: CoinMarketCat cat-coin scout

## 1. Files and exports

**New `src/lib/agent-scout.mjs`.** It is pure apart from the injected `http`, `jupiter`, `rpc` and `clock`. It names no host and uses `URLS.jupiterVerified` from bots/lib/verified.mjs. It has no `fetch(`, no `chrome.`, no `console.`, no signing, and never uses the word "seed".

Exports:
- `SCOUT_HOSTS = [HOSTS.jupiter]`
- `SCOUT_CLAUSES`
- `SCOUT_UNMEASURED`
- `parseJupiterToken(t, now)`
- `listVerdict(row, spec, {pins})`
- `mintAdmission(account, mint)`: extracted from background.mjs:662-668
- `chainVerdict(row, account)`
- `routeVerdict({buy, sell}, {sizeRaw})`
- `rankCompare`
- `createScout({http, jupiter, rpc, clock, sleep})` → `{scan(input)}`

**`src/lib/agent-strategy.mjs`**
- New spec fields (§2), and `SCOUT_RULES` (§3).
- New functions: `scoutDialsKey(spec)`, `normalizeScoutRow(row, spec)`, `scoutedEntries(spec, scout, now)`, `withScout(spec, scout, now)`.
- `universeEntries` also resolves `spec.scouted`.
- `agentArmSentence` gets a scout branch.
- `agentStartProblems` allows empty pins when `scoutOn`.

**Other files:**
- **agent-risk.mjs:** add the `sell_only` clause.
- **agent-brain.mjs:** add `sellOnlyMints` and one line in the system prompt.
- **agent-runner.mjs:** see §6.
- **agent-market.mjs:** one line so `readCandles` skips entries with `candles === false`.
- **background.mjs, protocol.mjs, options.mjs, popup.mjs, popup.html, build.mjs, README.md:** see §6 and §8.
- **jupiter-swap.mjs:** fix the header comment at L15-16, which contradicts itself.

## 2. Spec fields

All are flat keys in `AGENT_SPEC_DEFAULTS`, parsed with `numberIn` and fenced in `AGENT_BOUNDS`. Neither `AGENT_SPEC_VERSION` nor `AGENT_STATE_VERSION` changes: bumping the state version would throw away live positions.

| Key | Default | Fence | Clauses |
|---|---|---|---|
| `scoutOn` | `false` | boolean | `scout_switch_malformed` |
| `scoutSlots` | 4 | 1–10, whole | `not_a_number`/`not_whole`/`out_of_range`; when `scoutOn` and pins + slots > 10, `universe_too_big`, naming both counts |
| `scoutMinLiquidityUsd` | 25,000 | 10,000–100,000,000 | numberIn |
| `scoutMinVolume24hUsd` | 10,000 | 1,000–100,000,000 | numberIn |
| `scoutMinAgeDays` | 14 | 7–3,650, whole | numberIn |

- In scout mode, `spec.universe` and `spec.custom` stay as the owner's **pins**.
- `scoutDialsKey(spec)` = settlementMint | maxPositionUsd | slippageBps | the 3 floors | scoutSlots.

## 3. Fixed rules (`SCOUT_RULES`, frozen; not dials)

- `verifiedOnly: true`
  - 22 unverified Token-2022 coins each report $2.27–2.57M "liquidity" against about $4.5k of market cap, with 1–7 holders.
- `liquidityNotOverMcap: true`. No verified cat trips it.
- `minHolders: 1_000`
- `maxBuyImpactPct: AGENT_MAX_BUY_IMPACT_PCT` (2), at `spec.maxPositionUsd`
- `maxRoundTripLossPct: 3`. POPCAT measured 0.51%.
- `confirmMinutes: 30`, `everyMinutes: 60`, `retryMinutes: 10`, `lapseMinutes: 180`
- `maxProbed: 12`, `probeRetries: 3`
- `minListLength: 1_000`, `maxListBytes: 16 MiB`, `listTimeoutMs: 45_000`

Jupiter's top-holder share is shown, labelled "Jupiter's", and never used as a gate: it counts pool accounts, and the public RPC answers 429 to `getTokenLargestAccounts`.

## 4. The scan algorithm (`scout.scan`)

The input comes from `runner.scoutInput()`: `{dialsKey, settlement, sizeUsd, slippageBps, pins, incumbents, floors}`.

1. `rpc()` is null → `{ok:false, clause:"scout_no_rpc"}`. Nothing is fetched.
2. `http.json(URLS.jupiterVerified, {timeoutMs:45_000, maxBytes:16 MiB})`.
   - `http` is the worker's `catHttp([HOSTS.jupiter])`, which paces at 1,100 ms, backs off, allows one retry and uses `redirect:"error"`.
   - A network error, HTTP error, `rate_limited` or `too_large` → `scout_list_unread`.
   - Not an array, or fewer than 1,000 entries → `scout_list_malformed`.
3. `parseJupiterToken`. A missing or non-finite figure becomes `null` and is named in `missing[]`, never 0 and never "disabled".
   - Symbols must match `/^[A-Za-z0-9$._-]{1,12}$/`, else the short mint is used.
   - Names have control characters stripped, are cut to 80 characters, and are used only by `detectCat`. They never reach the model.
   - Only the cat rows are kept; the 5 MB body is dropped.
4. Static gates run in the order of §5. Pinned mints are skipped and reported as "pinned".
5. Rank the survivors (`rankCompare`): held incumbents, then other incumbents, then 24h volume descending, then Jupiter liquidity descending, then mint ascending. The first 12 go on; the rest are `scout_probe_budget`.
6. Read the chain with one `rpc.getMultipleAccounts(mints)` (base64, confirmed).
   - A throw fails the whole scan with `scout_chain_unread`.
   - Otherwise `mintAdmission` and the chain gates run per mint.
7. Probe routes, one candidate at a time, through the shared `jupiter.quote({..., priority:"background"})`:
   - Buy: settlement → mint, `amountRaw = maxPositionUsd × 10^6`, then `checkQuote` with `maxPriceImpactPct` 2.
   - Sell: mint → settlement for the buy's `outRaw`, then `checkQuote` with cap 100.
   - Round-trip loss = `1 − back/in`.
   - On `rate_budget`: `sleep(2_100)`, at most 3 tries, then `scout_route_unprobed`.
   - A Jupiter 429, `rate_limited` or resting host stops probing for this scan; every candidate left is `scout_route_unprobed`.
8. Each pin gets one buy quote. This is a report only; a pin is never removed.
9. Return `{ok:true, at, dialsKey, settlementMint, sizeUsd, admitted[], pinRoutes[], funnel{counts per stage}, refused[{mint, symbol, clause}] (≤120)}`.

**When it runs.** The worker's half-minute alarm calls `agentScoutTick()` next to `agentTick()`. It uses a single-flight `scouting` promise and runs only if `runner.scoutDue(now)`:
- `scoutOn`;
- `S.status === "running"`;
- no withdrawal in progress;
- `now ≥ S.scout.nextAt`.

It never runs inside `tick()`. `AGENT.SCOUT_RUN` forces one scan. With `scoutOn` false, that scan is a preview and nothing is adopted.

**Load per scan:**
- 1 list read an hour;
- 1 RPC call;
- at most 24 quotes plus 1 per pin, at background priority;
- per-tick market load stays at 10 or fewer universe tokens.

## 5. Gates and clauses (`SCOUT_CLAUSES`)

| Stage | Clauses |
|---|---|
| Scan-level (nothing is adopted) | `scout_no_rpc`, `scout_list_unread`, `scout_list_malformed`, `scout_chain_unread`, `scout_stale_spec` |
| Static (Jupiter's figures) | `scout_not_verified`, `not_a_cat_coin` (detectCat), `scout_copycat` (`copycatOf` from bots/popcat/established.mjs, which has no imports), `scout_settlement` (WSOL/USDC/USDT), `scout_unmeasured`, `scout_thin`, `scout_liquidity_over_mcap`, `scout_quiet`, `scout_too_new`, `scout_few_holders`, `scout_probe_budget` |
| Chain (the owner's RPC; the only authority) | `scout_mint_unreadable` (no account, not a mint, not initialized), `scout_mint_unsupported` (`assertTradeableExtensions` fails, or paused), `scout_jupiter_disagrees` (chain decimals or program differ from Jupiter's), `scout_mint_authority`, `scout_freeze_authority` |
| Route (the agent's own `checkQuote`) | `scout_no_direct_route`, `scout_buy_impact`, `scout_round_trip`, `scout_route_unprobed` |
| Reading stored state | `scout_row_malformed` |

- `unconfirmed` and `slots_full` are statuses, not refusals.
- The admitted row carries the chain's decimals and program, never Jupiter's.

**New clauses outside the scout:**
- **Risk and brain:** `sell_only`, added to `RISK_CLAUSES` and to `validateDecision`. It refuses a buy of a held mint outside the universe; a sell or hold of it is allowed.
- **Trade time:** `mint_authority_live` and `freeze_authority_live` (AgentError). They check the cached `readFacts` result, only on buys of `source:"scout"` entries.

## 6. Runner integration

**One membership source**
```js
const specNow = () => spec.scoutOn ? withScout(spec, S.scout, clock()) : spec;
```
- `withScout` returns a frozen `{...spec, universe:[...pins, ...buyable], scouted: entries}`.
- `buyable` comes from `scoutedEntries`, whose conditions are all listed in §7.
- `universeEntries(specNow())` and `allowedPairsFor(specNow())` then work unchanged.

**Readers that switch from `spec` to `specNow()`**
- `pairsNow` (L273)
- `entryFor` (L368)
- `contextFor.market` (L516)
- `brain.decide` `universeMints` (L544), plus `sellOnlyMints` = held mints outside the universe
- `planOrders` (L563)
- `tokensToPrice` (L601), which also prices leftover benchmark-basket mints with `candles:false`
- the benchmark basket (L667)
- the start journal and `status().spec.universeEntries` (L733, L827)

The arm sentence and `saveSpec` keep using the owner's `spec`.

**New methods**
- `scoutInput()` and `scoutDue(now)`.
- `adoptScout(result)`, inside `exclusive`:
  - `dialsKey` or settlement no longer matches → journal `scout_stale_spec` and discard the result.
  - A failed result → set `error` and `triedAt`, `nextAt = now + 10 min`, and keep the rows. They lapse 180 minutes after `lastGoodAt`.
  - A good result:
    - each admitted row keeps its earlier `admittedSince` if it was also admitted in the previous good scan; otherwise `admittedSince = now`;
    - seat incumbents first, then by rank, up to `scoutSlots`;
    - set `lastGoodAt = now`, `nextAt = now + 60 min`;
    - journal one funnel line, plus "X joins" and "Y leaves (reason): sell only";
    - persist.
  - The report goes under its own storage key, `coinmarketcat:agent:scout`.

**State and spec saves**
- `freshAgentState()` gains `scout: {at:null, lastGoodAt:null, nextAt:0, dialsKey:null, settlementMint:null, rows:[], error:null}`. The shallow merge on load gives old saved states this default.
- `saveSpec`: a change to `scoutDialsKey` or `scoutOn` clears `S.scout.rows` and sets `nextAt = now`.

**Model context**
- `market` holds one row per `universeEntries(specNow())`. Each row gains `source` and `directPool: {buyImpactPct, roundTripLossPct, sizeUsd, at}`, or `null` with a `why`. That goes for pins too, for example MEW with "no direct USDC pool".
- Scouted rows add `jupiter: {holders, topHoldersPct, ageDays, note:"Jupiter's figures, not read on chain"}` and `chain: {mintAuthority:null, freezeAuthority:null, readAt}`.
- Each held mint outside the universe gets `{mint, symbol, sellOnly:true, why}`.
- `scout: {on, at, funnel counts}`, with no names.
- `limits` gains the dials, read-only.

**`think()`**: when `specNow().universe` is empty, `noteOnce("scout:empty")` and return before `nextBrainAt` moves. There is no paid call.

**`liveArmability`** gains `scout_scanned`: with `scoutOn` set, a good scan in the last 180 minutes is required.

**Worker (background.mjs)**
- `scoutHttp = catHttp([HOSTS.jupiter])`.
- `scout = createScout({http: scoutHttp, jupiter, rpc: () => config?.rpcUrl ? hostRpc() : null})`, built next to `market` (L626).
- `agentScoutTick` is called from `onAlarm` (L983).
- New `case AGENT.SCOUT_RUN`.
- `agentStatus()` adds `scout: {...a.status().scout, report, rules: SCOUT_RULES, unmeasured: SCOUT_UNMEASURED}`.
- `verifyCustomMints` uses `mintAdmission`, and its bare `fetch` (L677) becomes `scoutHttp.json(URLS.jupiterSearch(mint))`.

**protocol.mjs**: `SCOUT_RUN: "hawk:agent:scout-run"`. It carries nothing and returns the report.

## 7. Live-safety chain for a scouted buy

1. The coin was admitted by a good scan: chain facts read over the owner's RPC, both authorities null, extensions allowed, and a direct route within 2% and a round trip within 3%, both at the current cap.
2. `scoutedEntries` re-checks every stored row with `normalizeScoutRow` on each read. The row counts only if all of these hold:
   - it is seated;
   - it has been admitted since at least 30 minutes before the latest good scan;
   - `lastGoodAt` is at most 180 minutes old;
   - `dialsKey` and settlement match the spec;
   - it is not a pin, the settlement token or WSOL.
3. `validateDecision`: the mint must be in the universe, otherwise `not_in_universe` or `sell_only`.
4. `planOrders`: the same test, plus every existing cap.
5. `assertPairAllowed(pairsNow())`, before the quote.
6. Live: `readFacts` gives `mint_unreadable`, `mint_mismatch` or `mint_unsupported`; then the new `mint_authority_live` / `freeze_authority_live`, buys only.
7. The settlement and SOL balance checks, then the quote and `checkQuote` (direct only, 2%).
8. `checkSwapTransaction({..., allowedPairs: pairsNow()})`, computed again at that moment.
9. `checkWritableCustody` (only the two ATAs), then `simulateGuard`, then `exact_input`, then `checkSafeAfter` on both accounts.
10. `S.inflight` is persisted, then `signSendConfirm` is called once.

**What cannot happen:**
- Neither the model nor the report can add a pair.
- Jupiter's figures alone can never admit a coin.
- A failed scan can never add a coin.
- A sell is never blocked by the scout: held mints keep their sell-back pair, and the stop loss, take profit and breaker keep running.

## 8. UI and copy

**Options.** A new "Scout" field right after Tokens:
- a checkbox, "Let the scout fill free slots with cat coins it finds (off by default)";
- the four number dials as `AGENT_LIMITS`-style `ag_<key>` rows;
- a "Scout now" button;
- the last report, read-only: the funnel line, the admitted rows (symbol, short mint, impact, round trip, "confirmed" or "waiting for a second scan"), the top refusal counts, and pin notes such as "MEW: no direct USDC pool — every buy is refused".
- Help text should follow Design 1's paragraph and end: "Most cat coins trade against SOL, and the agent signs only direct swaps with its settlement token, so few pass the last rule."
- With no RPC set: "Set an RPC: the scout reads every coin on chain, in paper too."

**Popup.** Add `<div class="k">Scout</div><div id="agScout" class="list small">` after `#agDecisions`:
- a funnel and next-scan line, or "off", or the error;
- a "sell only" tag in `#agPositions` for coins that left the universe.

**Arm sentence (scout mode).** Design 1's sentence with the pins, the dials, the fixed rules and "and up to N more cat coins the scout admits". Rotation does not disarm; any dial change does.

**`SCOUT_UNMEASURED`:**
> "Liquidity, volume, holders, top-holder share and age are Jupiter's figures; only each mint's decimals, program, authorities and extensions are read on chain, and pool depth is one quote at your per-token cap. Whether admitted coins trade well is unmeasured. A cat coin is a cat by its name."

**Hosts** (build.mjs `HOSTS_CALLED`, and the README rows at L635 and L643, word for word):
- `lite-api.jup.ag` (who: "CashCat, CoinMarketCat"): "…and a custom CoinMarketCat mint must be a cat coin by its name there; CoinMarketCat's scout reads the verified list for cat coins, hourly while it runs".
- `api.jup.ag`: "quotes, swaps and fallback prices, keyless; the scout's quotes of each candidate's direct pool".
- README L670: add the scout.
- `HOST_PERMISSION_REASONS` is unchanged.

**README.** A "The scout" paragraph with dated figures, citing the fixtures. Update the fixture lines at L762, L800 and L1308. The site gets no coin names and no counts.

## 9. Fixtures to record (house shape `{note:"GET … — live answer, trimmed to …; nothing else edited", capturedAt, status, …}`)

1. **`fixtures/agent/jupiter-verified-cats.json`**
   - GET `https://lite-api.jup.ag/tokens/v2/tag?query=verified`.
   - Keep every row `detectCat` passes (91 on 2026-09-25), plus JUP, WIF and USDC, as full objects without `icon`.
   - Record `count` (3,693), `bytes` and `cacheControl`.
2. **`fixtures/agent/jupiter-search-cat-cluster.json`**
   - GET `https://lite-api.jup.ag/tokens/v2/search?query=AgavbLZybMxhDsjR2i3d48vCnzThpGZfZ9osFdkQ8eGz,GCXVUyF78tCko4JS3d4wXpjHoNNMW22mTcEXnL4hpump,FE9LVt68GdduUHiXXrPqHZ91ehKMpZGTa3Kb3bdNpump` (Neko, OGCAT, $SMEOW).
3. **`fixtures/agent/scout-mints.json`**
   - POST `https://api.mainnet-beta.solana.com` with `getMultipleAccounts` (base64, confirmed): `{readAt, rpc, slot, accounts:{mint:{owner,lamports,data}}}`.
   - Mints:
     - POPCAT `7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr`
     - VIBE `DFVeSFxNohR5CVuReaXSz6rGuJ62LsKhxFpWsDbbjups`
     - CATWIF `5pYB12kEhfhSFXJjZ7JtyqDpt6uUqhsF6iu6Ee9spump`
     - ZCAT `HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR` (TransferFeeConfig)
     - INBRED `EjzzyCSiLqjFDprpZj8e1zjXmcTG5HPGFRSEoWcJWHh9` (mint authority, which Jupiter calls disabled)
     - CASHCAT `CashcatZMRn4Jv8sPQZUSsbTLi2PcPe1ssqbHcnaJqSS`
   - The freeze-authority case reuses the USDC bytes in cats-verified.json.
4. **`fixtures/agent/jupiter-direct-quotes-cats.json`**
   - GET `https://api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=<mint>&amount=25000000&slippageBps=100&swapMode=ExactIn&onlyDirectRoutes=true&restrictIntermediateTokens=true&instructionVersion=V2`.
   - Mints: POPCAT (pass), CATWIF (impact 2.47%), CATCOIN `9i3NFMa9pqR3suCUhyX3nQE1dy6i5wXafDtppUxYpump` (95%), MEW (400 `NO_ROUTES_FOUND`).
   - Also the POPCAT → USDC sell-back at the buy's `outAmount`.
   - Also one USDC → MEW quote without `onlyDirectRoutes`, as the `route_not_direct` proof.

## 10. Tests

**New `test-agent-scout.mjs`** (house style; the network double routes per host; fake clock and sleep):
1. Parse the recorded list: count, and 91 cats computed from the file.
2. Missing is missing: `scout_unmeasured`, with the field named.
3. Cats only; CATWIF → `scout_copycat`.
4. Liquidity alone never admits: the cluster → `scout_not_verified`; forced to verified → `scout_liquidity_over_mcap` and `scout_few_holders`.
5. Each dial and fixed rule at its edge.
6. Chain gates on the recorded bytes: ZCAT → `scout_mint_unsupported`; INBRED and CASHCAT → `scout_mint_authority`; USDC bytes → `scout_freeze_authority`; a doctored hint → `scout_jupiter_disagrees`; a null account → `scout_mint_unreadable`.
7. Route gates, called directly on the recorded quotes: MEW → `scout_no_direct_route`; CATWIF → `scout_buy_impact`; a doctored sell → `scout_round_trip`; three `rate_budget` answers → `scout_route_unprobed`; a 429 stops probing; every probe uses `priority:"background"`.
8. Fail closed, one case per scan-level clause.
9. Ranking is deterministic, incumbents are kept, the budget is 12.
10. Confirmation and lapse: a second scan 5 minutes later is not enough, 31 minutes later is; after 181 minutes the rows lapse.
11. `SCOUT_CLAUSES` walked both ways with `saw()`.
12. `SCOUT_UNMEASURED` is present.

**Updates to existing tests**
- **test-agent-strategy:**
  - defaults and fences for the 5 fields, including `scout_switch_malformed` and pins + slots giving `universe_too_big`;
  - `normalizeScoutRow`/`withScout` refuse tampered, stale, lapsed and mismatched rows;
  - `allowedPairsFor(withScout(...))` gains exactly the seated, confirmed pairs;
  - §5: the scout sentence names the rules, `variants` gains every dial, and a rotation leaves the sentence unchanged.
- **test-agent-risk:** `sell_only` joins `RISK_CLAUSES` and §9; the sell of a held mint outside the universe is accepted; §8 checks `SCOUT_RULES` cannot be moved.
- **test-agent-brain:** `sellOnlyMints` buy → `sell_only`; a scouted but unadmitted mint → `not_in_universe`.
- **test-agent-market:** an entry with `candles:false` is priced but gets no GeckoTerminal request.
- **test-agent-runner:**
  - still exactly 3 GeckoTerminal fetches, and no scan inside `tick`;
  - a stopped agent fetches nothing and is not `scoutDue`;
  - `adoptScout` → `ctx.market` and `ctx.limits`;
  - rotation → a sell-only row, the model's sell fills, its buy is refused;
  - §13: an unseated scouted mint → `pair_not_allowed` on the recorded USDC → POPCAT transaction;
  - a live scouted buy with an authority set in the double → `mint_authority_live`, while the sell still goes through;
  - `S.scout` survives a reload at `v:1`;
  - an empty universe → no model call.
- **test-agent-no-leak:** twelve AGENT messages (adds scout-run); agent-scout.mjs added at L101.
- **test-hawk-no-key:** `AGENT_FILES` gets `agent-scout.mjs: []`; assert it has no `fetch(`; add a check that every `src/lib/agent-*.mjs` is a key of `AGENT_FILES`.
- **test-hawk-manifest:** agent-scout.mjs added to `catFiles`; `SCOUT_HOSTS` added to `called`.
- **test-hawk-bundle:** scout entry point, plus a source-vs-bundle funnel probe on the fixture.
- **test-site:** fix the stale "majors preset" header.

## Owner decisions I made

- **Scout off by default.** It needs an RPC even in paper, and the default paper agent has none.
- **Preset left as it is.** 5 of its 6 coins have no direct USDC or USDT route today. They are marked "no direct pool" rather than removed. Trimming the preset is a one-line follow-up.
- **Direct routes only.** Allowing one SOL hop (which would open MEW, KITTY, RKC and drooling, each measured under 2%) is left to a separate design.
- **Floors:** liquidity $25k, 24h volume $10k, age 14 days, 4 slots. Fixed: 1,000 holders, 2% buy impact, 3% round trip, Jupiter-verified only.
- **Timing:** a scan every hour, a retry after 10 minutes, lapse after 3 hours, two scans at least 30 minutes apart.
- **The list host is `lite-api.jup.ag`**, through the bots' paced client. If it is retired the scout fails closed. `api.jup.ag` served the same list today (`v2.hdr`); switching is one constant.
- **Top-holder share is shown, not used as a gate.**
- **The model may now sell (never buy) a held coin that has left the universe**, custom mints included.