# The adoption registry for catcoinsanctuary.com: how a static site learns that a cat was adopted, by whom, and which launch wins

Researched 2026-09-25, 17:58–18:55 UTC. This is the second run of this task: the first run saved evidence but no report, and this run re-checked that evidence and added the probes marked "new".

**Everything was read-only.**
- Solana: only read methods were used (`getSlot`, `getAccountInfo`, `getMultipleAccounts`, `getProgramAccounts` with filters, `getSignaturesForAddress`, `getTransaction`, `getBlock`, `getSignatureStatuses`), at most about 2 requests per second.
- Web: only public GET or HEAD requests.
- Nothing was signed, sent or broadcast, and no private key or seed phrase was asked for or handled.
- Nothing in `/home/user/cat-sanctuary` or `/home/user/Cat-Intelligence-Agency` was changed.

**Labels.** Every claim is marked with one of these:
- **VERIFIED**: I saw it in code, in data, on chain or in a live answer.
- **INFERRED**: reasoning that has not been checked.

**Path shorthands.**

| Shorthand | Directory |
|---|---|
| `R/` | `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/registry/`, the evidence from this task |
| `A/` | `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/`, the evidence from the sibling StonkFun and launcher research |
| `T/` | `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/tools/registry/`, the probe scripts |

`T/rpc.mjs` allows only the read methods above and throttles itself.

**Sibling reports this builds on:** `…/scratchpad/adopt/research-stonkfun.md` (how a StonkFun launch is built and adopted) and `…/scratchpad/adopt/research-launcher.md` (the CIA repo's LaunchLab builder).

---

## 0. The recommendation on one screen

1. **Which launch counts (b).** A launch adopts cat C only when **everything below is read from chain**:
   - a LaunchLab pool on **StonkFun's standard platform** (`4E876…gZL7`);
   - priced in **C's stock**;
   - whose Token-2022 mint's own metadata carries **exactly C's name, ticker and C's pre-uploaded metadata URI**;
   - created by a transaction that **succeeded**, in which the pool's **`creator` is the fee payer**, so the adopter signed.

   The URI is the key. The name and ticker alone are not enough: StonkFun allows duplicates, and lookalikes are common (section 3).
2. **Which launch wins (c).** Order by the creation transaction's `(slot, transactionIndex)` at `finalized`. `getSignaturesForAddress` returns both fields (VERIFIED). Never order by StonkFun's `createdAt`: it lags 1 s to 155 s depending on the tool, which can invert the chain order (VERIFIED, section 4.5).
3. **Where the data comes from (a).**
   - The **chain is the authority**.
   - StonkFun's public API (CORS `*`) is a cheap way to discover launches and to show their status, but it has no signature, slot or URI, and it lags.
   - A sweep of **LaunchLab pools filtered by platform and `PoolState.epoch`** finds every new pool in one call of about 1 MB (VERIFIED). A dataSliced `getMultipleAccounts` then reads the name, symbol and URI of 100 mints in one 30 KB call (VERIFIED).
4. **How the site learns of it (d).**
   - A scheduled GitHub Action commits `data/adoptions.json`. The shortest cron interval is 5 minutes, and runs can be delayed or dropped at busy times (VERIFIED, GitHub docs).
   - The page covers the gap itself. The adopter's own page confirms through a **browser-usable RPC** (`solana-rpc.publicnode.com` answers `getSignatureStatuses`, `getAccountInfo` and `getSignaturesForAddress` to our Origin; the public mainnet RPC answers 403, VERIFIED).
   - Every other visitor sees "moving in" from one StonkFun `/launches?since=` read, which is chain-checked later.
5. **Abuse (e).** No server can be relied on, and adoption is free: squatting all 91 cats costs about 0.77 SOL (VERIFIED per-launch cost). Honest, serverless limits:
   - an exact kit match;
   - the creator must have signed;
   - **one accepted adoption per wallet per 24 h of chain time**, applied in chain order;
   - optionally, opening dates per cat;
   - an optional public "withheld" list.

   Say plainly that a determined attacker with many wallets can still win races.
6. **Hosting (f).**
   - The on-chain URI can never be changed: the update authority is a LaunchLab PDA, and the program has no update-metadata instruction (VERIFIED). So the owner should **pre-upload each cat's image and final metadata JSON once, before the Adopt button goes live**, and the registry should compare against those exact URIs.
   - ArDrive Turbo gives true Arweave IDs. Items of 107,520 bytes or less are free, so every JSON is free, and about 200 MB of images and banners costs about $18 (VERIFIED prices).
   - Irys is about 0.005 SOL for the same, but its IDs do not resolve on arweave.net (VERIFIED).
   - Never use GitHub Pages as the canonical URI: it can be changed and it is not permanent.
7. **Blockers.**
   - The kit URIs do not exist yet. Uploading needs the owner to pay and sign.
   - Launch sheet 2 is still being written.
   - The site's page tests forbid any request to another host.
   - The existing `proveLaunch` refuses v1 transactions, CPI launches and any launch whose payer is not a listed wallet (section 3.4).

---

## 1. Evidence index

| What | Path |
|---|---|
| API probe (token by mint 200/404/400, lists, sort and mode errors, since, CORS with our Origin, categories) | `T/probe-api.mjs`, `T/sf.mjs` → `R/api/_probe-api.out.json` and one `R/api/*.json` plus `*.meta.json` per call |
| Apex domain redirect | `R/api/apex-vs-www.txt` (new) |
| Older API answers (openapi, stats, pairs, pricing, launches by creator, token records) | `A/api/*.json` |
| Pool layout, per-quote and platform-wide `getProgramAccounts`, platform-config signature noise | `T/probe-chain.mjs` → `R/chain/_probe-chain.out.json`, `R/chain/gpa-*.json`, `R/chain/sigs-platform-1000.json` |
| Creation transaction via the pool's oldest signature, block position, mint TLV layout of 100 mints, one sweep of every StonkFun pool | `T/probe-chain2.mjs` → `R/chain/_probe-chain2.out.json`, `R/chain/sigs-pool-5J2Kd.json`, `R/chain/block-450416570-signatures.json`, `R/chain/mints-spyx-100.json`, `R/chain/gpa-all-standard-byquote.json` |
| Chain time versus StonkFun `createdAt` for 4 launches (2 third-party v1, 1 third-party legacy, 1 form) | `T/probe-chain3.mjs` → `R/chain/_probe-chain3.out.json`, `R/chain/tx-creation*.json` |
| `PoolState.epoch` histogram, current-epoch sweep, Token-2022 metadata scan refused | `T/probe-chain4.mjs` → `R/chain/_probe-chain4.out.json`, `R/chain/gpa-standard-current-epoch.json` (new) |
| Whether epoch is the creation or last-update epoch | `T/probe-chain5.mjs`, `T/probe-chain6.mjs`, `T/probe-chain7.mjs` → `R/chain/_probe-chain5/6/7.out.json` (new) |
| Name, symbol and URI of 100 mints in one sliced call | `T/probe-chain8.mjs` → `R/chain/_probe-chain8.out.json`, `R/chain/mints-metadata-slice-100.json` (new) |
| Current-epoch pools on the sanctuary's 93 pairs | `R/chain/our-pairs-current-epoch-count.json` (new) |
| Which RPCs a browser on our Origin can use | `R/chain/rpc-origin-check.txt`, `R/chain/browser-rpc-origin-matrix.txt` (new), `R/chain/publicnode-browser-reads.txt` (new), `A/launcher/rpc-origin-matrix.txt` |
| GitHub Actions schedule limits (docs page as fetched) | `R/docs/gh-events.txt`, `R/docs/gh-events.html` |
| Repo metadata of the deployed v0 | `R/docs/gh-repo.json` |
| GitHub Pages and raw.githubusercontent cache headers | `R/docs/pages-cache-headers.txt` (new) |
| Arweave and Irys prices and gateways | `R/arweave/*`, `A/arweave/*` |
| LaunchLab IDL (PoolState, events, instruction list) | `A/launchlab-idl.json` |
| StonkFun image-host handling (irys direct, others through wsrv.nl) | `A/image-host-handling-excerpt.js.txt` |
| The site pipeline read for this design | `/home/user/cat-sanctuary/scripts/build-collection.mjs`, `scripts/lib/chain.mjs`, `assets/collection.js`, `.github/workflows/{collection,pages}.yml`, `tests/page.test.mjs`, `data/*.json` (read only) |

---

## 2. (a) The sources

### 2.1 StonkFun public API

**Base and access** (all VERIFIED):
- The base URL is `https://www.stonkfun.xyz/api/public/v1`.
- The apex `https://stonkfun.xyz/…` answers **308** to `www` with **no** `access-control-allow-origin` header (`R/api/apex-vs-www.txt`). A browser `fetch` must therefore use the `www` host directly, and the page's CSP must name `https://www.stonkfun.xyz`.
- With `Origin: https://catcoinsanctuary.com`, every answer carries:
  - `access-control-allow-origin: *` and `access-control-allow-methods: GET, POST, OPTIONS`;
  - `cache-control: public, max-age=5`;
  - `x-ratelimit-limit: 300`, plus `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-Quota-Remaining-Day` and `Retry-After`, all exposed to scripts.

  Source: `R/api/tokens-origin-catcoinsanctuary.meta.json`.
- No key is needed. The OpenAPI description (`A/api/openapi.json`) lists the query parameters used below.

#### Endpoints the registry uses (all VERIFIED)

| Endpoint | Shape | Notes |
|---|---|---|
| `GET /tokens/{mint}` | `{data:{token, launch, network}, meta:{generatedAt}}` | See the key lists after this table. `R/api/token-DQVN-launchlab.json` |
| `/tokens/{mint}` for a mint with no pool | 404 `{"error":{"code":"not_found","message":"No platform pool exists for this mint."}}` | `R/api/token-404-system.json` |
| `/tokens/{mint}` for a bad mint | 400 `{"error":{"code":"invalid_request","message":"The mint must be a base58 Solana address."}}` | `R/api/token-400-bad.json` |
| `GET /tokens?quoteMint=&category=&mode=&status=&q=&sort=&page=&pageSize≤100` | `{data:{tokens:[…], pagination:{page,pageSize,total,totalPages}, network}, meta}` | List items add `transferFee:{bps}` for reward coins. SPYx had 3,619 tokens (37 pages). `category=xstock`, `backpack` and `prestock` filter correctly (100/100 each). `sort=newest` works. `R/api/tokens-quote-SPYx-newest-100.json`, `R/api/tokens-category-*.json` |
| `GET /launches?creator=&mode=&since=&page=&pageSize≤100` | `{data:{launches:[{mint,pool,name,symbol,creator,quote:{mint,symbol},launchpad,mode,logoUrl,startMarketCapUsd,targetMarketCapUsd,createdAt}], pagination}, meta}` | `since` means "Only launches at or after this time", by record time. The platform made **605 launches in one hour** (111 of them `mode=standard`), so polling it is cheap: at most 7 pages per hour. `R/api/launches-since-1h-p1.json`, `R/api/launches-since-1h-standard-p1.json`, `A/api/launches-creator-3oBC8q.json` |
| `GET /stats` | `config.launchLabEnabled:true`, `paidLaunchesEnabled:false`, and so on | `A/api/stats.json` |
| `GET /pairs?launchable=true&launchLabReady=true` | 514 pairs with `{mint,symbol,name,decimals,category,tokenProgram,launchable,symbolAmbiguous,launchLabReady}` | `A/api/pairs-ready.json` |

`/tokens/{mint}` field lists:
- `token`: `mint, pool, name, symbol, quote{mint,symbol,name,logoUrl,category,categoryLabel}, launchpad ("launchlab"), mode ("standard"|"reward"), quoteOnlyFees, imageUrl, links, market{priceUsd,marketCapUsd,fdvUsd,volume24hUsd,liquidityUsd,peakMarketCapUsd}, status ("new"…), graduationProgress, createdAt`.
- `launch`: `mint, pool, name, symbol, creator, quote{mint,symbol}, launchpad, mode, logoUrl, startMarketCapUsd, targetMarketCapUsd, createdAt`.

#### Reliability (VERIFIED)
- `?q=PATCHPAW` and `?mode=bogus` both answered **504 `FUNCTION_INVOCATION_TIMEOUT`**, a Vercel error (`R/api/tokens-q-PATCHPAW.json`, `R/api/tokens-mode-bogus.json`).
- `?sort=bogus` silently answered 200.
- So the free-text search is flaky, and the design should not depend on `q=`.

#### What the API does not have (VERIFIED from every shape above)
- No transaction signature, slot or transaction index. **It cannot order launches.**
- No metadata URI. **It cannot apply the kit rule.** `logoUrl` and `imageUrl` are the metadata JSON's `image`. Of the 100 launches in the one-hour sample, 99 carried the image host directly and 1 was a `wsrv.nl` URL that its JSON itself carried. INFERRED: the API passes `image` through unchanged. StonkFun's own UI proxies non-Irys, non-imgur hosts through `wsrv.nl` at render time (`A/image-host-handling-excerpt.js.txt`).
- Only pools that StonkFun **adopted** are listed.

#### How late the API is (VERIFIED: `R/chain/_probe-chain3.out.json`, `R/api/token-DQVN-launchlab.json`)

| Launch | Built by | Chain block time | `launch.createdAt` lag | `token.createdAt` lag |
|---|---|---|---|---|
| test / NONSOL (SPYx) | StonkFun form | 17:13:38 | +1.3 s | +264 s |
| RoxAI (NVDAx) | StonkFun form | 17:37:58 | +2.5 s | +106 s |
| Artificial Grok Investor (SPCXx) | j7tracker, v1 transaction | 17:08:21 | +133 s | +247 s |
| yippee (MSFTx) | uxento, v1 transaction | 16:47:32 | +135 s | +333 s |
| Comfy Panda (METAx) | third party, legacy transaction | 17:39:22 | +155 s | +420 s |

A launch built in the adopter's browser is a "third-party" launch. It should therefore appear in `/launches` about **2–3 minutes** after the block and in `/tokens/{mint}` about **4–7 minutes** after (INFERRED from the samples).

### 2.2 On chain

#### 2.2.1 LaunchLab `PoolState`: 429 bytes, owner `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`

Offsets were computed from the IDL (`A/launchlab-idl.json`) and checked against pool `5J2Kd…ZQ2G`, which decoded to the known NONSOL launch (`R/chain/pool-5J2Kd-account.json`, `_probe-chain.out.json`). VERIFIED.

| Offset | Field | Offset | Field |
|---|---|---|---|
| 0 | discriminator (8) | 141 | global_config |
| 8 | **epoch u64** (see below) | 173 | **platform_config** |
| 17 | status u8 (0 = on the curve) | 205 | **base_mint** |
| 18 | base_decimals u8 | 237 | **quote_mint** |
| 20 | migrate_type u8 | 269 / 301 | base_vault / quote_vault |
| 21 | supply u64 | 333 | **creator** |
| 29, 37, 45, 53, 61, 69 | total_base_sell, virtual_base, virtual_quote, real_base, real_quote, total_quote_fund_raising | 365 | token_program_flag, then amm_creator_fee_on, platform_vesting_share, padding(54) |

#### 2.2.2 Discovering new pools with `getProgramAccounts` (VERIFIED on the public RPC)

- **One quote at a time:** filters `dataSize 429`, `memcmp 237 = quote` and `memcmp 173 = 4E876…gZL7`, with `dataSlice(205,32)`. Results:

  | Quote | Pools | Time | Size |
  |---|---|---|---|
  | SPYx | 785 | 451 ms | 213 KB |
  | TSLAx | 295 | 595 ms | |
  | ANTHROPIC | 402 | 619 ms | |
  | MU | 38 | 514 ms | |

  Source: `_probe-chain.out.json`.
- **Every StonkFun standard pool in one call:** 31,415 pools across 364 quotes, 1.33 s, about 9.9 MB with a 64-byte slice (`_probe-chain2.out.json`). **9,496** of them are on the sanctuary's 93 pairs (`R/chain/our-pairs-current-epoch-count.json`).
- **`PoolState.epoch` is the epoch of the pool's last state change, not its creation epoch** (new finding).
  - 4 of 12 pools whose field reads 1042 were created in an earlier epoch. Example: `H9cpH…` was created in epoch 1039, 2026-09-20 (`_probe-chain7.out.json`).
  - 10 of 10 on-curve pools whose field reads 1041 had no transaction at all in epoch 1042 (`_probe-chain6.out.json`).
  - A pool made in epoch E therefore reads E or later, and a pool made in the current epoch reads the current epoch. This was checked on pools created in 1042, such as `5J2Kd…`, `GFJdG8…` and `1Btk8…` (INFERRED from the field's meaning, VERIFIED on the samples).
  - **So a sweep filtered on `epoch ∈ {E, E−1}` holds every pool created since the start of epoch E−1**, which is 2 to 4 days back (an epoch is 432,000 slots).
  - That sweep is small: 2,559 pools in epoch 1042, 140 ms and 1.1 MB with a 160-byte slice (base, quote, vaults, creator). 876 of those pools are on our pairs, across 66 of the 93 (`_probe-chain4.out.json`, `our-pairs-current-epoch-count.json`).
- Epoch histogram of all 31,468 pools: epochs 1027–1042, with 1,073–3,905 pools per epoch (`_probe-chain4.out.json`).

#### 2.2.3 The mint's own metadata (Token-2022 TokenMetadata extension)

- **Layout** (VERIFIED on 100 of 100 SPYx pool mints, `_probe-chain2.out.json`):
  - The extension list reads `18@166` (MetadataPointer) and `19@234` (TokenMetadata).
  - TokenMetadata's value starts at 238: update_authority (32), then mint (32), then the name length u32 **at 302**, then the name, then the symbol (u32 length and bytes), then the URI (u32 length and bytes).
  - The mint accounts are 386–439 bytes.
- **Update authority** is `WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh` (the LaunchLab authority PDA) on 100 of 100.
- **The LaunchLab IDL has no instruction that updates metadata.** Its 28 instructions: `buy_exact_in`, `buy_exact_out`, `claim_creator_fee`, … `initialize_with_token_2022`, `migrate_to_cpswap`, `update_config`, `update_platform_config`, `update_platform_curve_rule`, and so on (`A/launchlab-idl.json`). VERIFIED.
  - **The name, symbol and URI are therefore fixed forever at launch** (INFERRED from the two facts together).
- **Cheap bulk read.** `getMultipleAccounts(100 mints, dataSlice {offset:302, length:200})` decoded the name, symbol and URI of **100 of 100** mints in **253 ms and 30 KB** (VERIFIED: `_probe-chain8.out.json`). This is the registry's main filter.
  - Samples show why the URI matters. There is a "ProShares UltraPro Short QQQ / SQQQ" coin pointing its URI at `metadata.backpack.exchange/stocks/sqqq.us.json`: a lookalike of a real Backpack stock. Other launchers mint per-launch URIs, for example `wiler.fun/api/t/<mint>/metadata.json`.
- **Scanning Token-2022 for a URI directly is refused** on the public RPC: `403 "Your IP or provider is blocked from this endpoint"` (VERIFIED: `_probe-chain4.out.json`). The design never needs it.

#### 2.2.4 The creation transaction (what we need for "first")

- **Finding it:** the pool's **oldest** entry in `getSignaturesForAddress(pool)` is its creation, with `err: null`.
  - For NONSOL the oldest entry was `EkKE99…AUD`, slot 450416570, `transactionIndex` 721. `getBlock` placed the same signature at **index 721 of 1,622** in that block. VERIFIED: `_probe-chain2.out.json`, `R/chain/block-450416570-signatures.json`.
  - **Busy pools need paging.** yippee needed 3 pages of 1,000 and AGI needed 5 (VERIFIED: `_probe-chain3.out.json`).
  - INFERRED guard: skip any older entry that is not the initialize. A failed snipe or a lamport transfer to the pool address can predate the pool.
- **`transactionIndex`:** `getSignaturesForAddress` returns it on every entry (1,000 of 1,000 in `R/chain/sigs-platform-1000.json`; RPC `apiVersion` 4.3.0).
- **Order of the list:** newest slot first and, **within a slot, descending `transactionIndex`**. This held in 125 of 125 slots that had more than one signature (VERIFIED, computed over `sigs-pool-5J2Kd.json` and `sigs-platform-1000.json`).
- **v1 transactions:** third-party launchers send version-1 transactions. `getTransaction` with `maxSupportedTransactionVersion: 0` fails with `-32015 "Transaction version (1) is not supported … maxSupportedTransactionVersion: 1"`, and succeeds with `1` (VERIFIED: `R/chain/tx-creation-CuAoNR.json` against `tx-creation-v1-CuAoNR.json`).
- **Wrappers vary**, as seen in `_probe-chain3.out.json`:
  - ComputeBudget, then initialize, then ATAs, then `buy_exact_in` (the form, and Comfy Panda);
  - Raydium CLMM swaps plus initialize (uxento);
  - initialize plus j7tracker's own program `J7pour…` (j7tracker).

  In **all 4** the fee payer equals the pool's creator (VERIFIED).
- **Logs** read `Program log: Instruction: InitializeWithToken2022`. LaunchLab also emits `PoolCreateEvent {pool_state, creator, config, base_mint_param{decimals,name,symbol,uri}, curve_param, vesting_param, amm_fee_on}` by self-CPI, discriminator `e445a52e51cb9a1d` (VERIFIED from the IDL and `_probe-chain.out.json`). INFERRED: this is a second copy of name, symbol and URI if we ever want one. The mint's TokenMetadata is enough.
- **Not usable for discovery:** `getSignaturesForAddress(platform config)`. The platform config sits in every buy and sell: 1,000 signatures covered 37 seconds, **949 of them failed**, and nearly all were trades (VERIFIED: `_probe-chain.out.json`).

### 2.3 Who can read what (VERIFIED unless marked)

| Reader | StonkFun API | Public RPC `api.mainnet-beta.solana.com` | `solana-rpc.publicnode.com` | `raw.githubusercontent.com` |
|---|---|---|---|---|
| Browser on catcoinsanctuary.com | Yes (CORS `*`, `www` host only) | **No.** The preflight passes, but the POST with our Origin gets **403 "Access forbidden"** (`R/chain/rpc-origin-check.txt`, `A/launcher/rpc-origin-matrix.txt`) | **Yes** for `getSlot`, `getSignatureStatuses`, `getAccountInfo` and `getSignaturesForAddress` (ACAO `*`). **No** for `getProgramAccounts`: "Indexed requests require a personal token" (`R/chain/publicnode-browser-reads.txt`) | Yes (ACAO `*`, `max-age=300`) |
| GitHub Action (no Origin header) | Yes | Yes, including `getProgramAccounts` on LaunchLab. A 429 appeared once at about 1.6 requests per second (`_probe-chain3.out.json` log) | n/a | n/a |

Other RPCs tried from our Origin (`R/chain/browser-rpc-origin-matrix.txt`):
- `solana.drpc.org`: 400 "chain is not available on free plan".
- `rpc.ankr.com/solana`: 403, needs an API key.

---

## 3. (b) The rule that identifies a legitimate adoption

### 3.1 The predicate

A pool **P** adopts cat **C** when every clause below holds. The kit for C is fixed in advance as `{name, symbol, quoteMint, metadataUri}`.

| # | Clause | How it is checked | Why |
|---|---|---|---|
| 1 | The owner of P is the LaunchLab program, `dataSize` is 429, and `P.platform_config` is `4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7` (StonkFun **standard**, not the reward platform `6BwHH…`) | `getProgramAccounts` filter, or `getAccountInfo(P)` | Owner decision 1: a StonkFun coin with no holder tax. The standard platform's on-chain curve rule rejects a wrong shape: errors 6018 and 6025 in simulation (VERIFIED in `A/simulate-browser-build.json`). |
| 2 | `P.quote_mint` is C's stock mint | offset 237 | Owner decision 1 |
| 3 | P's base mint is a Token-2022 mint whose TokenMetadata has **name == C.name, symbol == C.symbol and uri == C.metadataUri**, compared byte for byte | sliced `getMultipleAccounts` at offset 302 | **The URI is the kit's fingerprint.** The name and ticker are not unique on StonkFun (two "RoxAI / ROX" coins on NVDAx, `A/api/tokens-q-ROX-NVDAX.json`). The URI points to our immutable JSON, so its image, description and website are ours. |
| 4 | The mint's metadata `update_authority` is `WLHv2…VVh` and its `mint` field equals the mint. Its extensions are exactly [18 MetadataPointer, 19 TokenMetadata], so there is no TransferFee. The mint and freeze authorities are None. `P.base_decimals` is 6, `P.migrate_type` is 1 and `P.supply` is 1e15. | full `getAccountInfo(mint)` and pool bytes | The metadata cannot be changed later, and this is the shape StonkFun adopts (VERIFIED: 100 of 100 mints and 6 of 6 decoded launches, in `A/chain-mint-extensions.json` and `research-stonkfun.md` §3–4). |
| 5 | `P.global_config` is a LaunchLab GlobalConfig whose quote mint is C's stock | `getAccountInfo(global_config)`, same decode as `checkLaunchAccounts` in `/home/user/cat-sanctuary/scripts/lib/chain.mjs` | Belt and braces. Configs can rotate, so accept any config for the right quote rather than one pinned id (INFERRED). |
| 6 | The creation transaction (the oldest successful signature of P that carries `InitializeWithToken2022`) is **finalized** with `err: null` | `getSignaturesForAddress(P)` paged to the oldest, then `getTransaction(maxSupportedTransactionVersion: 1)` | It gives the `(slot, transactionIndex)` used for ordering. |
| 7 | **`P.creator` is the creation transaction's fee payer**: `accountKeys[0]`, a signer | same transaction | LaunchLab's `creator` does **not** have to sign (VERIFIED: IDL flags; simulation variant D in `A/simulate-browser-build.json`). Without this clause anyone could make a cat "adopted by" a wallet that never agreed. All 6 distinct real launches examined have payer == creator: the 6 in `A/chain-launch-decodes.json`, 4 of which were re-read from their pools' oldest signatures in `_probe-chain3.out.json`. |
| 8 | P is the first pool that meets 1–7 for C, in `(slot, transactionIndex)` order, and that the limits in section 6 accept | the registry | Owner decision 4 |

The **adopter** is `P.creator`. That is also the wallet StonkFun forwards creator fees to (VERIFIED: `research-stonkfun.md` §4.1 quotes StonkFun: "the pool's own `creator` account is who gets paid").

### 3.2 Why the URI, and the alternatives considered

| Candidate rule | Result |
|---|---|
| **Exact kit: URI + name + symbol + quote + standard platform** (recommended) | Lookalikes (same name, other image or JSON) never count. Anyone can still launch the exact kit, with any tool, because the kit is public; that is acceptable under "first confirmed wins". Needs the URIs uploaded before launch (section 7). |
| Name + ticker + quote + platform only | Accepts a launch with our name and ticker but **any image and description**, for example an offensive image or a scam website, as the resident. It would also accept StonkFun-form launches. Rejected. |
| StonkFun platform id only ("launched via StonkFun") | Necessary (clause 1) but says nothing about which cat. |
| URI hosted on our own domain (`https://catcoinsanctuary.com/kit/<T>.json`) | Works as a fingerprint, but we could edit the JSON after a launch (a trust problem), and the URI is permanent while the domain is not. See section 7. |
| Memo tag such as "catcoinsanctuary adopt T" | Anyone can copy it. It proves nothing a URI does not. At most a UI nicety (INFERRED). |
| "Built by our site" | Cannot be proven without a server-held co-signing key, which is ruled out. INFERRED. |
| StonkFun-form launches of our kit (its server writes its own Irys JSON "<name> was launched on StonkFun.", so the URI differs; VERIFIED in `research-stonkfun.md` §2) | Could be accepted by a second rule: name, symbol and quote exact, **plus** the JSON's image bytes hashing to our kit image. It is **unverified** whether StonkFun re-encodes uploaded images, and our description and banner would not reach the chain. Not in v1; owner question 1. |

### 3.3 What the rule deliberately does not require

- **Any particular transaction wrapper or tool.** v0, v1, extra compute-budget, swaps, tips and CPI buys are all fine. StonkFun itself adopts pools built by uxento, j7tracker and others (VERIFIED: `research-stonkfun.md` §4.3). The pool and mint state is what counts.
- **StonkFun having recorded the pool.** This is shown as a status ("StonkFun page live" once `/tokens/{mint}` answers 200), not used as a gate. Clause 1 plus the on-chain curve rule make a mismatched pool rare. INFERRED; owner question 5.
- **A listed wallet.** Anyone can adopt, which is the owner's decision.

### 3.4 What changes against the current site pipeline (VERIFIED by reading the code)

`/home/user/cat-sanctuary/scripts/build-collection.mjs` together with `scripts/lib/chain.mjs` `proveLaunch` assumes launches by **wallets listed in `data/wallets.json`** and reads each wallet's history. For adoption:

| Current assumption in `proveLaunch` | What adoption needs |
|---|---|
| The launcher is a listed wallet, so the builder reads that wallet's own history | The launcher can be **any** wallet. Discover pools instead (section 5.3). |
| Refuses version-1 transactions (`tx_version`) | Must read v1: third-party tools use it (VERIFIED). |
| Refuses CPI launches (`cpi_launch`) and any instruction outside a short list (`unexpected_instruction`) | Judge the resulting **state** (pool and mint) and the creation transaction's payer. The wrapper is not what matters. |
| Refuses a quote whose token program is not Token-2022 | Keep it. All 93 site pairs are Token-2022 (VERIFIED comment and test in `assets/collection.js`). |
| Matches a cat by **pair and ticker** (`assets/residents.js`, per `README.md`) | Match by the kit's **URI**, plus name, ticker and pair. |
| `tests/page.test.mjs` forbids any `connect-src` other than `'self'`, and any fetch to another host | The Adopt feature needs `connect-src` to include `https://www.stonkfun.xyz`, an RPC (for example `https://solana-rpc.publicnode.com`), and optionally `https://raw.githubusercontent.com`. The test must change accordingly. |

INFERRED: the owner's own launches from `3J57…iji3` become ordinary adoptions under the same rule, so the Collection workflow can be retired or folded in (section 5.3).

---

## 4. (c) First confirmed wins

### 4.1 The ordering key
- The key is **`(slot, transactionIndex)` of each valid pool's creation transaction, at `finalized` commitment.**
- Both values come from `getSignaturesForAddress`. That method orders by slot descending and by `transactionIndex` descending within a slot (VERIFIED, 125 of 125 slots).
- `getBlock(slot, {transactionDetails:"signatures"})` gave the same index (721). Use it only to settle a same-slot tie if `transactionIndex` were ever missing.
- `blockTime` is per block, shared by every transaction in the slot, so it is display only (VERIFIED: the field is identical within a slot in the lists).
- If one transaction creates two pools of the same kit, which our builder never does, refuse both (`several_launches`, as `proveLaunch` does today).

### 4.2 States in the registry

| State | Meaning | Shown on the page |
|---|---|---|
| `open` | No valid pool yet | "Adopt me" |
| `moving_in` (client only, never in the file) | The page has seen a candidate: the adopter's own confirmed transaction, or a StonkFun `/launches` row matching the kit's image and pair since the file's `generatedAt` | "Moving in… (confirming)" |
| `adopted` | Clauses 1–8 hold at `finalized`, and one more sweep saw no earlier pool | "Adopted by `3J57…iji3`", with the coin, StonkFun, GMGN and FOMO links for **this mint only** |
| `later` (a list under the cat) | Valid kit pools after the winner | Collapsed "Other launches of this cat's kit (not the resident)": short mint, wallet, date. **No buy links.** Not in the garden. |
| `over_limit` (the same list) | A valid kit pool the section 6 limits refused; the cat stays `open` | The same list, with the reason |
| `lookalike` (optional list) | Same pair and same name **or** symbol, but a different URI. Seen for free in the sliced metadata read. | "Lookalikes exist. Only mint `Ab12…` is this cat." |
| `refused` (a log, the last 100) | A candidate that failed a clause, with the clause name, as in `collection-state.json` today | Not shown |

### 4.3 Can discovery arrive out of order?
- Yes, in principle. INFERRED causes: an RPC lagging on `getProgramAccounts`, a run that hit its time budget, or StonkFun's feed skipping a pool.
- **Policy:** a new winner is written as `adopted` only after a later run's sweep (at least one sweep snapshot slot after the winner's slot) finds no earlier valid pool.
- After that it is **never changed automatically**. This keeps the builder's "never drop a cat" principle (`build-collection.mjs`).
- If an earlier valid pool is later proven to exist, the builder stops and reports it, and the owner fixes it by hand with a public commit.

### 4.4 Why StonkFun's clock cannot be used (VERIFIED, section 2.1 lag table)
- Take the same kit launched twice: a browser-built launch at 17:00:00 (recorded about +135 s) and a StonkFun-form launch at 17:01:30 (recorded about +2 s).
- StonkFun's `createdAt` would list the form launch **first** (17:01:32 before 17:02:15), although it is 90 s later on chain.
- The registry must order on chain.

---

## 5. (d) Instant feedback in the page against the scheduled GitHub Action

### 5.1 Timeline after the adopter signs

| t | What is known | Where from |
|---|---|---|
| about 0.4–1 s | The transaction is `confirmed`. The page knows the signature (from the wallet), the mint (it made the keypair) and the pool (a PDA) | `getSignatureStatuses` via publicnode (VERIFIED allowed from our Origin). INFERRED times. |
| about 13 s | `finalized` | same (INFERRED: 32 slots) |
| +1–3 s (form) or **+133–155 s** (self-built) | Listed in StonkFun `/launches` | VERIFIED |
| +106–420 s | StonkFun `/tokens/{mint}` answers 200, and the token page exists | VERIFIED |
| **usually 5–25 min**, sometimes longer | Registry commit, Pages deploy, and a CDN copy up to 10 min old | cron minimum 5 min, delays at busy times, runs can be dropped (VERIFIED docs); `cache-control: max-age=600` on catcoinsanctuary.com (VERIFIED); run and deploy times INFERRED |

### 5.2 In the page (no server)

1. **Before signing, check that the cat is still free.**
   - Fetch `data/adoptions.json` with `cache:"no-cache"`.
   - Fetch `GET /launches?since=<adoptions.generatedAt − 10 min>&mode=standard&pageSize=100` from StonkFun, and look for rows where `quote.mint == C.quoteMint` and either `logoUrl == C.imageUri` or `name/symbol == C's`.
   - If any are found: read `getAccountInfo(mint)` through publicnode, decode the URI, and if it is the kit, show "Someone just adopted this cat".
   - Always add: "If another launch of this kit confirms before yours, yours will still exist on chain but will not be the sanctuary's cat." The race cannot be closed without a server. INFERRED.
2. **After sending,** poll `getSignatureStatuses([sig])` about every 1.5 s, which publicnode answers (VERIFIED). Then:
   - read `getAccountInfo(pool)` and `getAccountInfo(mint)` (VERIFIED allowed), and apply clauses 1–4 and 7 to the adopter's own launch;
   - show "Moving in…" with the mint, "adopted by you (pending)", and links;
   - store a per-viewer "pending adoption" note in `localStorage`, so a reload keeps showing it until the registry agrees. This is only a convenience; the registry decides.
3. **For every other visitor:** make one `/launches?since=<generatedAt>` call on load (1 request per visit, well under 300 per minute per IP; VERIFIED limit). Matching rows show as "moving in (confirming)", never as adopted.
4. **Signing and sending.** The page cannot send through the public mainnet RPC (403 to browsers). It can use the wallet's `signAndSendTransaction`, or publicnode, or a keyed RPC restricted to our domain. `sendTransaction` on publicnode was deliberately **not** tested, since it would be a send. The wallet flow belongs to the launcher research.

### 5.3 The scheduled builder

- **Schedule and triggers:**
  - `schedule: cron "3-58/5 * * * *"`: every 5 minutes, off the hour (INFERRED: GitHub says the start of each hour is the busiest).
  - plus `workflow_dispatch`.
  - Shortest interval 5 minutes; "can be delayed … some queued jobs may be dropped"; "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days"; schedules run only on the default branch. All VERIFIED in `R/docs/gh-events.txt`; the repo is public, `R/docs/gh-repo.json`.
- **One workflow that also deploys.**
  - A push made with the workflow token starts no other workflow. The site's own Pages workflow says so and works around it with `workflow_run` (VERIFIED: `.github/workflows/pages.yml` comment).
  - The simplest shape: sweep, commit if changed, then deploy Pages **in the same run** (the job needs `pages: write`, `id-token: write`). Or add the new workflow to `pages.yml`'s `workflow_run.workflows` list. INFERRED.
  - Share one `concurrency` group with Collection, or fold Collection into it, so the two never race to push `data/*.json` (INFERRED; Collection already rebases once on a push race).
- **Steps each run** (all RPC figures VERIFIED on the public RPC):
  1. `getSlot(finalized)` → E = slot / 432,000.
  2. **Fast discovery:** `GET /launches?since=<cursor − 10 min>` pages, which is 1–2 calls per 5 minutes at 605 launches per hour. Keep rows whose `quote.mint` belongs to an open cat.
  3. **Complete discovery,** every run or at least hourly: 2 × `getProgramAccounts(LaunchLab, dataSize 429, memcmp 173 = platform, memcmp 8 = u64le(E) or u64le(E−1), dataSlice(205,160))`. That is about 1.1 MB and 140 ms per epoch, around 900 pools per epoch on our pairs. Keep pools whose quote belongs to an open cat.
     - Once a day, or if the builder was down for more than 2 epochs, run a full per-quote sweep instead: 93 calls, 9,496 pools on our pairs all-time.
  4. `getMultipleAccounts(base mints, dataSlice {302, 200})` in batches of 100: about 30 KB and 250 ms per 100. Keep exact `(name, symbol, uri)` kit matches, and record same-pair name or symbol hits as lookalikes.
  5. For each match: full `getMultipleAccounts([mint, pool, global_config])` for clauses 1–5. Then `getSignaturesForAddress(pool, finalized)`, paged to the oldest with a cap of 20 pages (INFERRED; the new pools seen needed at most 5), for the creation `(slot, transactionIndex)`. Then `getTransaction(sig, maxSupportedTransactionVersion: 1)` for the fee payer and the initialize log (clauses 6–7).
  6. Apply the ordering and limits (sections 4 and 6), write `data/adoptions.json` (never dropping an `adopted` cat, as `build-collection.mjs` does today), and commit only if something changed.
- **Budget.** A normal run is about 3 + ⌈pools/100⌉ + 3 × (matches) RPC calls, roughly 10–25. At 400 ms spacing that is about 10 s. Keep the optional `SOLANA_RPC_URL` secret the site already documents, because the public RPC can start refusing `getProgramAccounts` at any time: it already refuses the Token-2022 scan (VERIFIED) and returned one 429.
- **State.** The registry itself is enough state: re-reading ~1–2k mints' 200-byte slices each run is about 20 small calls. An optional `data/adoptions-state.json` can hold `{apiCursor, lastSweepSlot, refused[]}`, excluded from the deploy like `collection-state.json`.

### 5.4 Files

**`data/kits.json`**, or a `kit` block added to each cat in `data/planned.json`. It is written once, when the owner uploads, and must never change after the first adoption:

```json
{ "PATCHPAW": { "name": "Patchpaw the Calico", "symbol": "PATCHPAW",
    "quoteMint": "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    "metadataUri": "https://arweave.net/<43-char id>", "imageUri": "https://arweave.net/<id>",
    "bannerUri": "https://arweave.net/<id>", "imageSha256": "<hex>", "opensAt": null } }
```

**`data/adoptions.json`**, written by the Action:

```json
{ "version": 1, "generatedAt": "2026-…Z", "snapshotSlot": 450437442,
  "cats": { "PATCHPAW": {
      "status": "adopted",
      "mint": "…", "pool": "…", "creator": "…", "tx": "…",
      "slot": 450416570, "txIndex": 721, "time": "2026-09-25T17:13:38Z",
      "stonkfunRecorded": true,
      "later": [ { "mint": "…", "creator": "…", "tx": "…", "slot": 0, "txIndex": 0, "time": "…", "reason": "later|over_limit" } ],
      "lookalikes": [ { "mint": "…", "name": "…", "symbol": "…" } ] } },
  "withheld": [] }
```

Cap each list, for example at 20 entries. Validate the file the way `assets/collection.js` validates `collection.json` today: base58 lengths, times, https-only, no HTML (INFERRED design).

### 5.5 Caching facts that shape the page (VERIFIED: `R/docs/pages-cache-headers.txt`)
- `catcoinsanctuary.com` sends `cache-control: max-age=600` with Varnish/Fastly in front.
- A never-seen `?cb=<timestamp>` query came back `x-cache: HIT`, `age: 12`. INFERRED: the CDN ignores query strings, so cache-busting by query does not force a fresh copy.
- The page should `fetch(…, {cache:"no-cache"})`, which revalidates the browser's copy, and accept up to about 10 minutes of CDN age. It can also read `https://raw.githubusercontent.com/<owner>/<repo>/main/data/adoptions.json`, which is `max-age=300` with ACAO `*` and updates on commit without a deploy (VERIFIED headers on the v0 repo's README).

### 5.6 Optional faster path with no server (INFERRED, untested)
- A GitHub `issues: opened` workflow could re-run the sweep within seconds.
- The page could offer "Speed up confirmation", linking to a prefilled `…/issues/new?title=adopt PATCHPAW <sig>`.
- The workflow reads only the chain and ignores the issue text, apart from the signature as a hint.
- The adopter needs a GitHub account, and spam costs only Actions minutes.

---

## 6. (e) Abuse, and limits that need no server

**What an attack costs.** A launch costs the payer about **0.0085 SOL** (VERIFIED simulation, `A/simulate-browser-build.json`). **All 91 cats cost about 0.77 SOL.** The creator's reward is StonkFun's creator-fee forwarding, which is the motive for squatting (VERIFIED forwarding in `research-stonkfun.md` §4.3).

| Threat | Mitigation | Strength |
|---|---|---|
| Lookalike launches outside the site: same name or ticker, other image or JSON | Clause 3 (exact URI); `lookalikes` warnings on the card; the card always shows the resident mint | Complete for the registry. Buyers elsewhere can still be fooled, which is unavoidable. |
| Fake names on our URI (right JSON, wrong on-chain name) | Clause 3 requires the name and symbol as well | Complete |
| "Adopted by" a wallet that never agreed (creator ≠ signer) | Clause 7 | Complete (VERIFIED that the creator need not sign, so the clause is necessary) |
| A reward-platform (taxed) or transfer-fee copy | Clauses 1 and 4 | Complete |
| Later metadata edits | Impossible: LaunchLab PDA authority and no update instruction (VERIFIED) | Complete |
| Registry poisoning through the API | The API only nominates candidates; every acceptance is proven on chain | Complete |
| **One actor squats many or all cats** | **(i)** One accepted adoption per creator wallet per 24 h of chain time, applied in global `(slot, txIndex)` order. An extra launch is logged `over_limit` and **the cat stays open**, so the next valid launch of that kit by another wallet wins. **(ii)** Optional `opensAt` per cat (a drip release, for example 3 cats a day), with earlier pools `refused: too_early`. **(iii)** Optional public `withheld` list edited by the owner (mint and a reason, shown on the page), for an obvious sybil farm. | **Weak against sybils.** New wallets are free, so these only stop lazy squatting and spread the "adopted by" tags. State it plainly on the Adopt page. |
| A bundled snipe (a huge dev buy in the creation transaction) | Optional clause: refuse if the creation transaction's `buy_exact_in` by the creator exceeds X% of `total_base_sell`. Our free builder never buys. | Partial: a buy in a separate transaction in the same slot cannot be attributed. INFERRED. |
| Duplicates confuse buyers (an `over_limit` or `later` coin carries identical metadata) | Show the resident mint prominently; list the others as "not the resident", with no buy links | A real cost of rule (i). It is why (i) is a choice for the owner. |

**Default I recommend** (INFERRED), as owner question 2:
- Enforce (i) at acceptance.
- Leave (ii) off at launch.
- Keep (iii) available but empty.
- Publish the exact rules on the Adopt page and in the README.

**What cannot be done without a server or a fee:** proving that a launch came through our page, rate-limiting a person rather than a wallet, or reserving a cat for someone before they sign. A reservation would need an extra step the site cannot check. INFERRED.

---

## 7. (f) Metadata hosting

### 7.1 Must the URI be permanent? Yes.
- The URI is written once into the mint's TokenMetadata. Its authority is the LaunchLab PDA and the program has no update instruction (VERIFIED), so the string can never change.
- Whatever it points at is what wallets and explorers show, and what StonkFun shows: its `imageUrl` is the JSON's `image` (VERIFIED: `research-stonkfun.md` §4.3). The registry also uses the string as the kit's fingerprint.
- The host therefore has to outlive the coin, and the content should be immutable so the owner cannot switch it after a sale.
- **The JSON must be final before the first adoption:** description, website (the cat's page), files and links. The adopter's own X handle is not known in advance, so leave `twitter` out or use the sanctuary's account (owner question 8).

### 7.2 Options

| Option | Permanence | Cost for 91 cats (images of about 1.2 MB, banners of about 1 MB, JSONs of about 2 KB) | StonkFun display |
|---|---|---|---|
| **ArDrive Turbo, which is Arweave** (`https://arweave.net/<43-char id>`) | Arweave's pay-once storage; the IDs are content-bound | **Each JSON is free: items of 107,520 bytes or less are free**, with a free tier of 10 MiB lifetime per wallet or IP (VERIFIED: `R/arweave/turbo-upload-info.json`). 1.3 MB costs 16,392,292,083 winc (VERIFIED). At the published rate (1 GiB = 13,535,677,081,999 winc = $94.96, VERIFIED `R/arweave/turbo-rates.json`) that is about **$0.115 per image**, so about **$18 for about 200 MB** of images and banners (arithmetic). | Through StonkFun's `wsrv.nl` proxy (VERIFIED code) |
| **Irys**, which is StonkFun's own choice (`https://gateway.irys.xyz/<id>`) | Irys's own promise. **StonkFun's Irys IDs do not resolve on arweave.net** (404 and "invalid tx id") and redirect to `datasprite-cdn.com` (VERIFIED: `R/arweave/irys-vs-arweave-check.txt`). INFERRED: Irys data lives on Irys's own chain, not Arweave. | **30,705 lamports per 1.3 MB** (VERIFIED `R/arweave/irys-price-solana-1300000.txt`), so about **0.005 SOL for about 200 MB**, and 1,935 lamports per JSON | "Optimized", loaded directly (VERIFIED code) |
| catcoinsanctuary.com (GitHub Pages) | **Changeable by us, and only as permanent as the domain and repo** | Free | proxied |
| IPFS pinning (Pinata and similar; CIA's `bots/cashcat/metadata.mjs` uses Pinata) | Only while someone pays for pinning | subscription | proxied |

**Recommendation** (INFERRED): Turbo, for true Arweave permanence and free JSONs, with images of 1024 px PNG or WebP. Or Irys, if near-zero cost and matching StonkFun matter more than Arweave. Pick **one canonical gateway string** (for example `https://arweave.net/<id>`) and never vary it: the registry compares strings.

### 7.3 Who pays, and the tools (INFERRED; nothing was uploaded or signed)
- **The owner pays, once**: about $18 on Turbo, or about 0.005 SOL on Irys. That keeps adoption free apart from network costs (owner decision 3).
- Uploading costs the adopter nothing. An adopter-side upload through the Irys browser SDK is possible, but it adds a signature and a fee and makes the URI different per launch, which defeats clause 3.
- **Tools:**
  - `@ardrive/turbo-sdk`: `TurboFactory.authenticated`, then `uploadFile`. Credits can be bought with SOL or AR, or with a card in ArDrive.
  - Or `@irys/upload` with `@irys/upload-solana`: `fund`, then `uploadFile`.
  - Use a **dedicated upload wallet** funded with a small amount, not the owner's main wallet.
- **Order of work:**
  1. Upload the image and the banner.
  2. Write the JSON with their URIs.
  3. Upload the JSON.
  4. Record all three URIs and the image's sha256 in `data/kits.json`.
  5. Check each URI through two gateways.
  6. Only then enable Adopt for that cat.
- **JSON shape.** Mirror StonkFun's own JSON, as in `research-stonkfun.md` §8: `name, symbol, description, image, external_url` (the cat's page), `extensions.website`, `properties.files` (image and banner) and `properties.links`.
  - StonkFun shows **no links** for self-built launches whatever the JSON says (VERIFIED, 4 of 4). The website still reaches wallets and explorers through the JSON.

### 7.4 Against letting StonkFun upload during its own form
- In the form path, StonkFun's server uploads the image and writes its own JSON to Irys, with the description "<name> was launched on StonkFun." and the links from the form (VERIFIED: `research-stonkfun.md` §2).
- Consequences:
  - the URI differs for every launch, so clause 3 cannot match it;
  - our description and banner never reach the chain;
  - the adopter has to type or paste every field.
- It also cannot be driven from our origin: there is no CORS and no URL prefill, and the page sends `X-Frame-Options: DENY` (VERIFIED: `research-stonkfun.md` §2 and §5).
- **Keep the form path out of v1.** Add it later only with the image-hash rule in 3.2, after a test launch shows whether StonkFun keeps the image bytes as uploaded.

---

## 8. Sketch of the two checks (INFERRED; pseudocode)

**The registry builder, in Node:**

```text
E = floor(getSlot(finalized) / 432000)
open = kits with no adopted entry;  byQuote = group(open, kit.quoteMint)
cands = {}                                     # pool -> {mint, quote}
for row in stonkfunLaunchesSince(cursor - 10min):   if row.quote.mint in byQuote: cands[row.pool] = row
for e in [E, E-1]:
  for (pool, slice) in getProgramAccounts(LL, dataSize 429, memcmp173=PLATFORM, memcmp8=u64le(e), dataSlice 205..365):
    quote = slice[32..64]; if quote in byQuote: cands[pool] = {mint: slice[0..32], quote, creator: slice[128..160]}
for batch of 100 in cands: meta = getMultipleAccounts(mints, dataSlice 302..502) -> (name, symbol, uri)
  kit = byQuote[quote].find(uri == kit.metadataUri && name == kit.name && symbol == kit.symbol)
  if !kit: if same quote && (name|symbol equal a kit's): note lookalike;  continue
  full = getMultipleAccounts([mint, pool, globalConfig]) -> clauses 1-5
  sigs = page getSignaturesForAddress(pool, finalized) to the oldest; creation = oldest ok sig whose tx logs InitializeWithToken2022
  tx = getTransaction(creation, maxSupportedTransactionVersion 1) -> clause 6 (err null), clause 7 (accountKeys[0] == pool.creator)
  valid.push({kit, mint, pool, creator, sig, slot, txIndex, time})
sort valid by (slot, txIndex); for v in valid: apply the per-wallet-24h limit and opensAt; the first accepted per kit is the winner
winner -> "adopted" only if a sweep with snapshotSlot > winner.slot saw no earlier valid pool; never drop an adopted cat
write data/adoptions.json atomically; commit if changed; deploy Pages in the same job
```

**The page, after the adopter's transaction:**

```text
poll publicnode getSignatureStatuses([sig]) until confirmed (or err -> show failure)
pool = getAccountInfo(poolPda); mint = getAccountInfo(mintPubkey)
check clauses 1-4 and 7 locally (platform, quote, name/symbol/uri, creator == my wallet)
show "Moving in… adopted by you (pending)"; localStorage.pending[ticker] = {mint, sig, at}
later visits: if adoptions.json says adopted by another mint -> "Another launch confirmed first"; clear pending
```

---

## 9. Open questions and blockers

**Blockers** (VERIFIED unless marked):
1. **The kit URIs do not exist yet.** Clause 3 needs the pre-uploaded, final JSON and image for every cat. Uploading requires the owner, or a dedicated wallet the owner funds, to pay and sign. That is outside a research agent's permissions.
2. **Launch sheet 2** (`…/scratchpad/launch-sheet-2/`) is still being written, so 67 kits are not final. Today `data/planned.json` holds 24 cats and 93 stocks.
3. **The site tests forbid other hosts** (`tests/page.test.mjs`), and the CSP is `connect-src 'self' blob: data:`. The Adopt feature needs an agreed change to both.
4. **The site's current proof code** refuses v1 transactions and CPI launches and requires listed wallets. Adoption needs a state-based proof (section 3.4).
5. **The public RPC is fragile for `getProgramAccounts`.** Heavy scans are already refused (Token-2022) and a 429 was seen, so a keyed `SOLANA_RPC_URL` secret is advisable (INFERRED risk).

**Owner questions:**
1. Accept only exact-kit launches (the recommendation), or also StonkFun-form launches under an image-hash rule, which is untested?
2. Per-wallet limit: none, one per 24 h (the recommendation), or a lifetime cap? Enforced at acceptance, or on display only?
3. Drip release (`opensAt`), or all cats open at once?
4. Hosting: Turbo (Arweave, about $18, JSONs free) or Irys (about 0.005 SOL; not on arweave.net)?
5. Should "adopted" wait for StonkFun to record the pool, or stay chain-only with StonkFun as a status (the recommendation)?
6. A public `withheld` moderation list: yes or no?
7. A dev-buy cap for accepted adoptions?
8. The metadata `twitter` field: the sanctuary's X account, or none?
