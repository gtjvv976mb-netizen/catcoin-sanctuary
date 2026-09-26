# How StonkFun builds a launch, and whether catcoinsanctuary.com can make the adopter's wallet produce one StonkFun records

Researched 2026-09-25, 17:38 to 18:00 UTC. Everything was read-only. Nothing was signed, sent or broadcast. The only transaction calls were `simulateTransaction` with `sigVerify:false` and `replaceRecentBlockhash:true`, using the owner's wallet `3J57…eji3` as an unsigned payer address. Mint addresses came from throwaway keypairs whose secrets were never used. No private key or seed phrase was asked for or handled.

**Labels.** VERIFIED means I saw it in StonkFun's shipped JS, its API answers, on-chain accounts or transactions, or simulation output. INFERRED means reasoning or an unconfirmed claim. Every evidence path below is relative to `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/`, which I shorten to `raw/`.

---

## 0. The answer

**Yes. Our static site can build a StonkFun-recorded launch entirely in the adopter's browser. The adopter's wallet signs and pays, and no StonkFun endpoint needs to be called.** This is StonkFun's documented "Building it yourself" path, and third-party launchers use it in production today.

- StonkFun's own developer page documents the path. You make two public reads (`GET /pairs` and `GET /launchlab/pricing`), then send your own `initialize_with_token_2022` with StonkFun's standard platform id and the curve-rule account appended last. StonkFun says: "There is nothing else to call. Within a minute or two the pool is adopted." (VERIFIED: `raw/developers-build-yourself-code.txt`)
- The shape is enforced on chain. StonkFun's PlatformConfig has `restrict_curve_param = 1`. In simulation, an initialize without the curve rule fails with **6018**, a wrong supply fails with **6025**, and the exact published shape passes. A launch carrying StonkFun's platform id therefore cannot land in a shape StonkFun would reject. (VERIFIED: `raw/simulate-browser-build.json`, `raw/chain-accounts.json`)
- **Third-party-built pools are adopted today.** Three launches from today were built outside StonkFun's form: one from the uxento terminal, one from j7tracker, and one with a catbox-hosted JSON. All three were recorded with `launchpad:"launchlab"`, appear in `/launches` and `/tokens/{mint}`, and `/fees` reports creator forwarding for them. (VERIFIED)
  - Their launch records appeared about 133 to 155 s after the block, and their token pages 4 to 7 min after. Form launches are recorded within 1 to 3 s.
  - The stonkblend.fun "Elon Coin" (graduated, about $283k volume in 24 h) is a third-party-built, adopted launch. Its creator receives on-chain transfers of the quote token from StonkFun's fee wallet `5CEbue…`, which confirms that creator forwarding works for self-built launches. (VERIFIED: `raw/chain-creator-inflows-8RjhJJ.json`)
- **Our browser build matches the form's bytes.** I re-encoded all six sampled launches' instruction data and got byte-identical output: three made by StonkFun's form and three by third parties (VERIFIED: `raw/reencode-check.json`). A browser-style build simulates cleanly on mainnet against:
  - an xStock (NVDAx)
  - a Backpack Token-2022 stock (HTZ)
  - a Backpack classic-SPL token (DOGE)
  - a pre-IPO stock (OPENAI)

  Each uses about 88k to 104k CU. The payer spends about 0.0085 SOL (rent plus the base fee), and there is no platform fee. (VERIFIED: `raw/simulate-browser-build*.json`)
- **Image and metadata.** On this path StonkFun uploads nothing for you. The URI is whatever you put in the instruction. StonkFun reads the JSON's `image` for the token page (VERIFIED). The best option is to pre-upload each cat's image and metadata JSON to Arweave through Irys, once, as the owner. That costs about 0.00003 SOL per 1.3 MB image (VERIFIED: `raw/arweave/irys-price-solana-1300000.txt`). Adoption itself then needs no upload.
- **Two trade-offs versus the StonkFun form (VERIFIED):**
  1. StonkFun shows **no project links** (website, X, Telegram) on the token page of a self-built launch. `links` is `{}` for all four adopted launches I checked, even though their JSON carries links. The links still live in the on-chain metadata JSON that wallets and explorers read.
  2. The adopter never passes through StonkFun's terms or geo gate, so our site has to carry those notices itself. See section 9.
- **StonkFun's form cannot be driven from another origin.**
  - The form calls an internal endpoint, `POST /api/launchlab-launch`, which answers the CORS preflight with 405 and sends no `Access-Control-Allow-Origin` header.
  - The form reads no URL parameters, and the page sends `X-Frame-Options: DENY`.
  - The public two-call API (`/api/public/v1/launches/prepare`) answers 503: "New launches on this venue are disabled; launch through LaunchLab instead". (All VERIFIED.)

  If the adopter uses StonkFun's own form instead, all we can do is hand them the files and copy-paste values. See section 5.

---

## 1. Evidence index

| What | Path |
|---|---|
| StonkFun pages (launch, developers, integrators, 404s for /api /docs /api-docs /create /how-it-works /faq) | `raw/site/*.html`, `raw/site/headers-launch.txt` |
| Next.js build manifest (every route, including internal APIs) | `raw/js/_buildManifest.js` |
| Middleware-matched API routes | `raw/js/_clientMiddlewareManifest.js` |
| Launch form chunk (form, transaction flow, "Token is live" panel) | `raw/js/3f11vexa51nkb.js`, pretty-printed as `raw/pretty/3f11vexa51nkb.js` |
| Developer docs chunk ("Building it yourself", "What we adopt, exactly") | `raw/js/2_3dpvczqpz5u.js`, `raw/developers-build-yourself-code.txt`, `raw/developers-strings.txt` |
| Terms-of-service cookie and signMessage code | `raw/pretty/1j6ogqjj6b5kt.js` (lines 93–190) |
| Image host handling (irys and imgur direct, others through wsrv.nl) | `raw/image-host-handling-excerpt.js.txt` |
| Geo-blocked jurisdictions list | `raw/geo-country-list-excerpt.txt` |
| Integrator docs (password-gated) | `raw/js/10qnwltq2p5dd.js` |
| Public API answers (stats, pairs, pricing, launches, tokens, fees, openapi) | `raw/api/*.json`, CORS and rate-limit headers in `raw/api/*.headers` |
| CORS preflights (internal and public endpoints) | `raw/api/preflight_*.headers`, `.body` |
| Paid two-call path disabled | `raw/api/launches-prepare-empty.json` |
| Six real launches decoded (form and third-party) | `raw/chain-launch-decodes.json` |
| Platform config, global configs, curve rules and pool states decoded; PDA checks | `raw/chain-accounts.json` |
| Token-2022 mint extensions of the six launches | `raw/chain-mint-extensions.json` |
| Byte-for-byte re-encode check | `raw/reencode-check.json` |
| On-chain LaunchLab IDL ("raydium_launchpad" 0.2.0, sha256 ce2ea0da…) | `raw/launchlab-idl.json` |
| Simulations of a browser-built launch (correct shape, no rule, wrong supply, creator≠payer; DOGE, OPENAI, HTZ quotes) | `raw/simulate-browser-build.json`, `raw/simulate-browser-build-{DOGE,OPENAI,HTZ}.json` |
| Metadata JSONs behind the six launches and Elon Coin | `raw/metadata/*.json`, `raw/metadata/uris.tsv` |
| StonkFun token records for them (`links`, `imageUrl`) | `raw/api/tokens/*.json` |
| Creator-fee forwarding seen on chain | `raw/chain-creator-inflows-8RjhJJ.json`, `raw/chain-fee-wallet-5CEbue.json` |
| Irys and ArDrive Turbo prices; Irys CORS | `raw/arweave/*` |
| Public Solana RPC CORS | `raw/rpc-preflight.headers` |
| stonkfun.xyz-adjacent site flagged as phishing | `raw/stonkblend/home-cloudflare-phishing-interstitial.html` |
| Scripts that produced the chain evidence | `../tools/*.mjs` (`rpc.mjs` allows read methods, and `simulateTransaction` only with `sigVerify:false`) |

---

## 2. (a) What the StonkFun form does, step by step

Source: `raw/pretty/3f11vexa51nkb.js`, lines 128–714. All of this section is VERIFIED from the shipped client code unless marked otherwise.

1. **On load**
   - It fetches `GET /api/quote-tokens` (the quote list) and `GET /api/launch-quote` (switches and fees).
   - Today `launch-quote` answers `launchLabEnabled:true`, `launchLabFeeSol:0`, `launchLabRentSol:{standard:0.012, reward:0.013, devBuyExtra:0.003}` and `legacyLaunchesDisabled:true` (`raw/api/launch-quote.json`).
   - With `launchLabEnabled`, the form fixes the venue to LaunchLab (`eN("launchlab")`), so there is nothing to pick.
   - It also restores any `sessionStorage["pending-launch-v1"]`, which is only used on the legacy paid path.
2. **Fields**
   - Token name: `maxLength 32`.
   - Symbol: `maxLength 10`, forced to upper case.
   - Token image: `<input type=file accept="image/png,image/jpeg,image/webp">`, at most `MAX_IMAGE_BYTES = 2097152` ("2 MB").
   - Project links:
     - Website, which must be a public HTTPS URL of at most 200 characters.
     - X/Twitter, which must be on x.com, www.x.com, twitter.com or www.twitter.com and must include a profile path.
     - Telegram, on t.me or telegram.me.

     The form says the links are "Saved in the token's permanent metadata". If Website is blank, the placeholder is `DEFAULT_LAUNCH_WEBSITE = https://www.stonkfun.xyz/`.
   - Quote token: category tabs, plus a search that matches symbol, name **or mint address**.
   - Fee model / Holder rewards tax: None (standard), 1% or 3% (reward).
   - Dev buy, as a percentage or in SOL.
   - **There is no description field.**
3. **Launch, LaunchLab path** (the `e9` branch, lines 396–476)
   1. The browser reads the image file into a **data URL** (`FileReader.readAsDataURL`).
   2. `POST /api/launchlab-launch` with `credentials:"same-origin"`, `Content-Type: application/json` and this body:
      `{ action:"prepare", creatorWallet, quoteMint, name, symbol, logo:<data URL>, [devBuyPercent|devBuySol], [mode:"reward", rewardTaxBps], website, twitter, telegram }`.
      - It asks for **no wallet signature or nonce**. `creatorWallet` is just a string.
      - It carries admin headers only when an admin session is present.
   3. The response carries:
      - `transaction`: a base64 **legacy** `Transaction` built and partly signed on the server. The mint is a server-generated keypair (INFERRED from the code and the chain).
      - `fundingTransaction`, only when there is a dev buy: a base64 `VersionedTransaction` that turns SOL into the quote token.
      - `feeSol` (0 today) and `devBuy.sol`.
   4. The wallet signs:
      - `signTransaction(tx)` when there is no dev buy;
      - `signAllTransactions([funding, tx])` when there is one.

      The wallet does **not** send. StonkFun sends.
   5. `POST /api/launchlab-launch {action:"submit", signedTransaction, [signedFundingTransaction]}`. The response is `{mint, pool}`, or `error` with the message "The launch did not land — nothing was charged."
   6. The "Token is live" panel shows the Mint, the Pool, `/token/<mint>` and `https://jup.ag/swap/<quote>-<mint>`.
4. **Where the image and metadata go.** The server uploads them to **Irys, which stores on Arweave**:
   - The form says: "Image and metadata are stored permanently on Arweave."
   - The privacy text in chunk `0s2-lymzpm5aj.js` says: "Content you supply at launch is sent to Irys for permanent storage on Arweave."
   - Form launches carry `https://gateway.irys.xyz/<id>` URIs on chain.

   The JSON the server writes has this shape, verbatim from RoxAI (`raw/metadata/FbDVeq…json`):
   ```json
   {"name":"RoxAI","symbol":"ROX","description":"RoxAI was launched on StonkFun.",
    "image":"https://gateway.irys.xyz/5f7k…","external_url":"https://www.roxai.space/",
    "extensions":{"website":"…","twitter":"…"},
    "properties":{"category":"image","files":[{"uri":"https://gateway.irys.xyz/5f7k…","type":"image/jpeg"}],
                  "links":{"website":"…","twitter":"…"}}}
   ```
   The description is always "<name> was launched on StonkFun." That holds for all three form JSONs I read.
5. **Endpoints that no longer work.**
   - `/api/upload` answers **410** "Legacy DBC launch endpoint retired".
   - `/api/send-transaction` answers **410** "Generic transaction relay retired".
   - Public `POST /api/public/v1/launches/prepare` answers **503** `service_unavailable`: "New launches on this venue are disabled; launch through LaunchLab instead". The `/stats` config agrees: `paidLaunchesEnabled:false`, `launchLabEnabled:true`. (`raw/api/preflight_api_upload.body`, `raw/api/launches-prepare-empty.json`, `raw/api/stats.json`)
6. **CORS: can another origin call the form's endpoints? No.**
   - `OPTIONS /api/launchlab-launch` with `Origin: https://catcoinsanctuary.com` answers **405** `allow: POST` with **no** `access-control-allow-origin` (`raw/api/preflight_api_launchlab-launch.headers`). A JSON POST needs a preflight, so a browser on our origin is blocked.
   - `GET /api/launch-quote` also sends no ACAO header.
   - The middleware manifest applies middleware to `/api/launchlab-launch`, `/api/upload` and the other launch routes (`raw/js/_clientMiddlewareManifest.js`). INFERRED: this is for geo-blocking and rate limits.
7. **Terms and geo gate on StonkFun's site.**
   - A cookie `stonkfun_terms=2026-09-18` is set.
   - Optionally the wallet signs "StonkFun Terms of Service / Version: 2026-09-18 / Wallet: … / I have read and accept these terms.", which is posted to `/api/terms-accept`.
   - The bundle lists 20 geo-blocked jurisdictions: RU, BY, CU, IR, KP, SY, MM, CF, CD, LY, SO, SD, SS, YE, ZW, VE, AF, IQ, LB, NI, plus the Crimea, Sevastopol, Donetsk and Luhansk regions. These are redirected to `/restricted`. (`raw/pretty/1j6ogqjj6b5kt.js`, `raw/geo-country-list-excerpt.txt`)
   - **Correction (2026-09-25, SPEC revision, finding 19).** The line above counts only the IP-blocked entries (`blocked:!0`). The same list also names **US, CA and GB with `blocked:!1`**: they are restricted by the Terms but not IP-blocked. The Terms (version 2026-09-18) define a "Restricted User" as anyone "a citizen or resident of, located in, or accessing or using the Services from the United States, Canada, or the United Kingdom", or tied to a sanctioned jurisdiction. They also require users to be at least 18, and say the Services are "intended for use by persons acting in a business or professional capacity". VERIFIED: `raw/review-honesty/stonkfun-terms-excerpts.txt`, `raw/review-honesty/live-0s2-lymzpm5aj.js`. See SPEC D0.
8. **Integrator docs** (`/integrators`) are behind a password (`x-integrator-password` header, `POST /api/integrators-docs`). I could not read them. (VERIFIED gate; content unknown.)

---

## 3. (b) The exact transaction

Program: **Raydium LaunchLab `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`**, instruction **`initialize_with_token_2022`**, discriminator `25be7ede2c9aab11`. On-chain IDL `E6wT2uNeoWUvDrwdch1R8ETsyewR1ZM4WAwsa5hLJK5Z`, "raydium_launchpad" 0.2.0 (VERIFIED: `raw/launchlab-idl.json`).

### 3.1 The six launches decoded (VERIFIED: `raw/chain-launch-decodes.json`)

| # | Coin, quote | Built by | Tx | Wrapper |
|---|---|---|---|---|
| 1 | RoxAI / ROX, NVDAX | StonkFun form (Irys URI; recorded 2 s after block) | `2dnvjQoB…D6Zc` slot 450421989 | legacy; CU limit 600000; CU price 50000 µlam; init; 2× ATA create; `buy_exact_in` (dev buy, 25,966,318 raw NVDAX, min_out 1) |
| 2 | The Best Part Is No Part / NOPART, SPCXX | form (recorded 3 s after) | `3vGueqjB…vGss9` slot 450420747 | legacy; CU limit 600000; CU price 50000; init. **No dev buy.** Fee 40,000 lamports; payer −8,665,840 lamports |
| 3 | test / NONSOL, SPYX | form (recorded 1 s after) | `EkKE99vA…AUD` slot 450416570 | like #1 (dev buy 15,194 raw SPYX) |
| 4 | Comfy Panda / COMFPAND, METAX | third party (catbox JSON; recorded 155 s after) | `5RfEZ834…eAotD` slot 450422298 | copies the form's wrapper (CU 600000 at 50000 µlam, init, 2 ATAs, `buy_exact_in` of 2,946,186 raw METAX), except that `min_out` is a real value rather than 1 |
| 5 | yippee / YIPPEE, MSFTX | uxento terminal (recorded 135 s after) | `zL5q74Xw…ub9P` slot 450410713 | **v1 transaction**; wrap SOL; 2× Raydium CLMM swaps SOL→MSFTX; 0.003 SOL tip to `moonXwp…`; init; ATAs; `buy_exact_in` |
| 6 | Artificial Grok Investor / AGI, SPCXX | j7tracker (recorded 133 s after) | `z9u5Quug…16S` slot 450415375 | **v1**; init; then j7tracker's own program `J7pour…` doing the buy |

Every one has exactly **2 signers: payer and base mint**, and every one has **payer = creator**.

### 3.2 Accounts (16), with constant and per-launch values (VERIFIED from 6 of 6 samples and PDA re-derivation in `raw/chain-accounts.json`)

| # | IDL name | Flags | Value | Constant? |
|---|---|---|---|---|
| 0 | payer | signer, writable | adopter wallet | per launch |
| 1 | creator | — (IDL: **not** a signer) | the same wallet; StonkFun pays creator fees to this address | per launch |
| 2 | global_config | — | one per quote mint, from pricing `curve.configId`: NVDAX `2NuVPU5V…WFQ4`, SPYX `B7ctMMdG…9adg`, SPCXX `9mfQRzhy…wCd8`, METAX `G9NjYUD9…6qFC`, MSFTX `G9uCP4Dw…LmS`, DOGE `E4RpUdyh…XL7H`, OPENAI `DrQRhq4L…Xfu`, HTZ `GEHL56Um…AhXX` | per quote |
| 3 | platform_config | — | **`4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7`** (StonkFun standard). Reward: `6BwHHDg3…nESt` | constant |
| 4 | authority | — | `WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh` = PDA["vault_auth_seed"] | constant |
| 5 | pool_state | writable | PDA["pool", base_mint, quote_mint] | per launch |
| 6 | base_mint | signer, writable | fresh keypair | per launch |
| 7 | quote_mint | — | the cat's stock | per quote |
| 8 | base_vault | writable | PDA["pool_vault", pool, base_mint] | per launch |
| 9 | quote_vault | writable | PDA["pool_vault", pool, quote_mint] | per launch |
| 10 | base_token_program | — | Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | constant |
| 11 | quote_token_program | — | **the quote mint's owner**. Token-2022 for all 24 xStocks, all 7 pre-IPO and 62 of the Backpack pairs. **Classic SPL `Tokenkeg…` for 16 Backpack pairs**, 15 of them our cats: PEPE, LINK, ENA, AVAX, ZAMA, INJ, LIT, DOGE, TAO, PONS, PSG, ARB, APE, CHIP, PEAQ. The Raydium SDK hard-codes SPL here, and StonkFun's docs warn to substitute it for Token-2022 quotes. | per quote |
| 12 | system_program | — | `111…1` | constant |
| 13 | event_authority | — | `2DPAtwB8L12vrMRExbLuyGnC7n2J5LNoZQSejeQGpwkr` = PDA["__event_authority"] | constant |
| 14 | program | — | `LanMV9s…3uj` | constant |
| 15 | curve rule (remaining account) | read-only | PDA["platform_curve_rule", platform_config, global_config], from pricing `curveRule.standard`, e.g. NVDAX `9MHtkhfn…We9g`, SPYX `QYZp1Yzq…DbWA`, SPCXX `BanUAzET…71a1` | per quote |

The curve-rule address in the transaction equalled the derived PDA in 6 of 6 cases, as did the pool, both vaults, the authority and the event authority (`raw/chain-accounts.json` → `pdaChecks`).

### 3.3 Arguments (VERIFIED: decoded, and re-encoded byte-identical 6/6 in `raw/reencode-check.json`)

```
disc 25be7ede2c9aab11
MintParams     { decimals u8 = 6, name string, symbol string, uri string }        name/symbol/uri per launch
CurveParams    tag u8 = 0 (Constant) { supply u64 = 1_000_000_000_000_000,
                                       total_base_sell u64 = 793_100_000_000_000,
                                       total_quote_fund_raising u64 = pricing.raise.raw (per launch, priced live),
                                       migrate_type u8 = 1 (cpswap / "cpmm") }
VestingParams  { 0, 0, 0 }
AmmCreatorFeeOn u8 = 0 (QuoteToken)        from pricing curve.cpmmCreatorFeeOn
transfer_fee_extension_param: Option = None, written as tag 0 followed by 10 zero bytes (11 bytes).
All six real launches, form and third-party, write it this way.
```

`total_quote_fund_raising` varies with price. It is sized so the raise is worth what the default 85 SOL raise is worth. Examples: SPYX 1,329,871,109 and 1,326,137,249; NVDAX 4,555,267,759; SPCXX 6,875,476,594 and 6,952,060,167; METAX 1,365,445,229; MSFTX 1,984,728,980. A self-builder must take it from `GET /api/public/v1/launchlab/pricing?quoteMint=…` at build time (VERIFIED: `raw/api/pricing-*.json`). The on-chain curve rule does **not** constrain it (field 5 is absent from the rule; see 4.2), so any positive value lands. The docs ask for "a positive totalFundRaisingB". INFERRED: use the pricing value so the market caps match StonkFun's launches.

### 3.4 Extra instructions, fees and cost

- **The form's wrapper** (VERIFIED) is a legacy transaction with `SetComputeUnitLimit(600000)`, `SetComputeUnitPrice(50000 µlamports)` and the init. With a dev buy it adds `createAssociatedTokenAccount` twice (base and quote ATA for the creator) and `buy_exact_in(amount_in, minimum_amount_out = 1, share_fee_rate = 0)`. The SOL→quote conversion runs in a separate server-built `fundingTransaction`. There is no memo and no platform-fee transfer (LaunchLab fee 0 SOL).
  - Network fee: 40,000 lamports (2 signatures × 5,000, plus 600,000 CU × 0.05 lamports).
  - Payer cost without a dev buy: 0.00867 SOL (tx #2).
- **Third-party wrappers vary** (v1 transactions, tips, CPI buys) and are still adopted. What matters is the pool, not the wrapper (VERIFIED from #5 and #6).
- **Our browser build, simulated** (VERIFIED: `raw/simulate-browser-build.json`): CU limit 600000, then the init, with no priority fee. Result: 94,118 CU, 836 bytes, payer −8,534,240 lamports (about 0.0085 SOL). StonkFun's own quote says "about 0.012 SOL" for rent, which is conservative.
  - DOGE (SPL quote): 88,499 CU, 864 bytes.
  - OPENAI: 94,772 CU.
  - HTZ: 103,566 CU.

  All passed without error.
- **Token-2022 mint created by LaunchLab** (VERIFIED: `raw/chain-mint-extensions.json`, 6/6):
  - Extensions: `MetadataPointer` (pointing to itself, authority none) and `TokenMetadata`.
  - `mint_authority` none, `freeze_authority` none, supply 1e15, 6 decimals.
  - TokenMetadata `update_authority = WLHv2…` (the LaunchLab authority PDA). The IDL has no update-metadata instruction (VERIFIED list in `raw/launchlab-idl.json`), so INFERRED: **the name, symbol and URI are permanent from launch.**
- **Quote side** (VERIFIED in the CIA simulation log): the xStock mints carry a PermanentDelegate ("Mint has a permanent delegate, so tokens in this account may be seized at any time"). This is a property of the stock token and cannot be changed by us.
- **Creator does not need to sign** (VERIFIED: IDL flags; simulation variant D, where creator ≠ payer, passed). The owner's decision (the adopter signs and is the creator) fits either way. In our build payer = creator = adopter, as in all real launches.

---

## 4. (c) How StonkFun records ("adopts") a pool

### 4.1 StonkFun's rule, verbatim (VERIFIED: `raw/developers-build-yourself-code.txt`)

- "What ties the two together is the **platform id** you bake into the pool … every minute we read the pools attributed to our platforms and adopt the ones we do not already have a record of. An adopted launch is indistinguishable from an API-created one — token page, chart, volume, fee ledger, holder rewards — and the pool's own `creator` account is who gets paid, so a standard launch forwards its creator share to your wallet without you registering anything."
- "Attribution is necessary but not sufficient: a pool carrying our platform id is adopted only if it matches the launch our own builder would have produced." The requirements:
  - the GlobalConfig from `curve.configId`;
  - a constant-product curve migrating to `cpmm`;
  - `supply` and `totalSellA` as given, with a positive `totalFundRaisingB`;
  - a base mint created by `initialize_with_token2022` at 6 decimals;
  - no transfer-fee extension for a standard launch;
  - `platform.standard` for an untaxed mint;
  - the curve-rule account last, read-only.
- "Miss any of them and nothing bad happens on chain — the pool exists and trades on Raydium — but this platform never records it."
- "5. There is nothing else to call. Within a minute or two the pool is adopted." **No registration API call exists or is needed.** A `/api/helius/webhook` route exists (`raw/js/_buildManifest.js`). INFERRED: StonkFun may also detect pools through Helius webhooks.
- The docs advise: "Land a standard launch first, confirm it appears in `GET /tokens` with `launchpad: "launchlab"`."

### 4.2 On-chain enforcement (VERIFIED)

- PlatformConfig `4E876…` decodes as follows (`raw/chain-accounts.json`):
  - name "StonkFun", web `https://www.stonkfun.xyz`
  - `fee_rate` 10000 (1%), `creator_fee_rate` **0**
  - `restrict_curve_param` **1**, `restrict_global_config` 0
  - `curve_rule_manager` `2pMi1Sr8…`
  - `transfer_fee_extension_auth` `5KXDF6Qn…`
  - platform fee wallet `5CEbueQn…`
- Every curve rule I decoded (5 quotes: NVDAX, SPYX, SPCXX, METAX, MSFTX) has version 1 and one group whose constraints are all `op 0` (equal):
  - field 3 = 1,000,000,000,000,000 (supply)
  - field 4 = 793,100,000,000,000 (total sell)
  - fields 0, 2, 6, 7, 8, 10 = 0
  - fields 1 and 9 = 1
  - field 5 is absent

  INFERRED mapping (Raydium's `param_field` enum is not in the IDL): field 5 is the raise, which is left free; the zeros are vesting and similar fields; the ones are curve and migrate kinds.
- Simulation (`raw/simulate-browser-build.json`):
  - without the rule account: **`Custom 6018 NotEnoughRemainingAccounts`**;
  - with supply ×2: **`Custom 6025 CurveParamNotMatchPlatformRule`** (thrown in `platform_curve_rule.rs:305`);
  - exact shape: success, for NVDAX, and also for DOGE, OPENAI and HTZ, whose rules I simulated against but did not decode.

  So a pool attributed to StonkFun cannot land in a wrong curve shape. INFERRED: the remaining off-chain checks are decimals, the Token-2022 initializer, no transfer-fee extension and the platform-id/mode match, and our build satisfies all of them.

### 4.3 What an adopted (self-built) launch gets (VERIFIED: `raw/api/tokens/*.json`, `raw/api/fees-*.json`, `raw/metadata/*.json`)

| | Form launch | Adopted, self-built launch |
|---|---|---|
| `/launches`, `/tokens/{mint}`, `launchpad:"launchlab"`, `mode:"standard"` | yes, launch record 1–3 s after the block | **yes, launch record 133–155 s after, token page 4–7 min after** |
| `imageUrl` | Irys image | **the metadata JSON's `image`** (catbox, uxento, j7tracker and stonkblend images all shown) |
| `links` (website, X, Telegram) on StonkFun | from the form fields | **`{}`**, even when the JSON has `extensions.website` and `properties.links` in StonkFun's own shape (Comfy Panda), top-level `website`/`twitter` (uxento, j7), or `extensions` + `links` (stonkblend "Elon Coin", 22 h old). The only route I saw for adding them is the admin-only `/api/admin/token-socials`. |
| `/fees` | "forwarded to the creator wallet automatically" | **same answer** |
| Forwarding seen on chain | — | **yes.** "Elon Coin" (stonkblend.fun, adopted) creator `8RjhJJB6…` received STONK (its quote) from StonkFun's fee wallet `5CEbue…` three times between 17:10 and 17:44 UTC. The forward is paid **in the quote token**, so for our cats it would arrive in the stock. |

- Duplicates are allowed. Two "RoxAI / ROX" tokens on NVDAX exist from different creators (`raw/api/tokens-q-ROX-NVDAX.json`). StonkFun enforces no uniqueness of name or ticker, so "first launch wins" is our rule to enforce.
- Third-party sites already do exactly this. stonkfun-adjacent launchers (uxento, j7tracker, stonkblend.fun) make adopted launches daily (VERIFIED from `/launches` and the image hosts). Note that `https://stonkblend.fun/` currently serves a **Cloudflare "Suspected Phishing"** interstitial (VERIFIED: `raw/stonkblend/home-cloudflare-phishing-interstitial.html`). INFERRED: a new site that asks wallets to sign token launches can get flagged, so our page must be transparent. See section 9.

---

## 5. (d) Prefill and deep links on StonkFun's form: none

- The launch chunk reads no query string, hash or router params. Every field starts as `useState("")`, and the quote defaults to the first pair in the first category (VERIFIED: `grep` over `raw/pretty/3f11vexa51nkb.js`; its only `URLSearchParams` builds the airdrop-preview request).
- The page cannot be embedded: `x-frame-options: DENY` and `frame-ancestors 'none'` (VERIFIED: `raw/site/headers-launch.txt`).
- The image is a file input, so we cannot inject it cross-origin.
- **What we can hand an adopter who prefers StonkFun's own form** (INFERRED UX, built on VERIFIED field rules):
  - a download button for the 1024 px PNG (≤2 MB, square);
  - copy buttons for the name (≤32), the ticker (≤10), the website (the cat's page, `https://`, ≤200), and the X link (must be an `x.com/<profile>` URL, not an intent link);
  - the quote **mint**, which can be pasted into the form's search because it matches addresses;
  - "Fee model: None, Dev buy: empty";
  - a link to `https://www.stonkfun.xyz/launch`.

  Afterwards our site finds the launch by polling `GET /api/public/v1/launches?creator=<adopter>` or `/tokens?q=<TICKER>&quoteMint=<stock>`, both of which allow CORS.
- On this path, StonkFun's server writes its own JSON ("<name> was launched on StonkFun."), so **our description and banner never reach the chain**. It also puts the image on Irys for us, and the links **do** show on StonkFun.

---

## 6. (e) Public read endpoints we can use from the browser (VERIFIED: `raw/api/openapi.json`, headers)

All return `access-control-allow-origin: *`, with methods GET, POST and OPTIONS. The rate limit is `x-ratelimit-limit: 300` per minute per IP. They also expose `X-Quota-Remaining-Day` and `Retry-After`, and need no key.

| Endpoint | Use for us |
|---|---|
| `GET /api/public/v1/stats` | `config.launchLabEnabled` (true) and `paidLaunchesEnabled` (false). Gate the Adopt button on it. |
| `GET /api/public/v1/pairs?launchable=true&launchLabReady=true` | Confirm each cat's quote is still ready. Key by **mint**: `symbolAmbiguous` exists, and HTZ has two pairs. It also gives `tokenProgram` and `decimals`. Today all 107 note symbols map to a ready stock pair: 24 xStock, 76 Backpack and 7 pre-IPO. |
| `GET /api/public/v1/launchlab/pricing?quoteMint=<m>` | `curve.configId`, `supply`, `totalSellA`, `baseDecimals`, `cpmmCreatorFeeOn`, `raise.raw`, `platform.standard`, `curveRule.standard`, and `prices.observedAt`. Fetch it just before building. |
| `GET /api/public/v1/tokens/{mint}` | 200 with `launchpad:"launchlab"` once adopted. Before that: 404 `not_found` "No platform pool exists for this mint." (CIA fixture). Also gives `imageUrl`, `links`, `market`, `status`, `graduationProgress`. |
| `GET /api/public/v1/tokens?q=&quoteMint=&category=&mode=&status=&sort=newest&page=&pageSize≤100` | Search by name, symbol or mint within a quote. Fuzzy, so filter by exact symbol. |
| `GET /api/public/v1/launches?creator=&mode=&since=&page=&pageSize≤100` | The launch ledger, including adopted ones. Carries `creator`, `logoUrl` (the JSON `image`), `quote`, `createdAt`. |
| `GET /api/public/v1/tokens/{mint}/fees` | Shows the forwarding note. |
| `GET /api/public/v1/launches/{paymentSignature}` | Paid path only; not used by us. |

Solana RPC from the browser: `https://api.mainnet-beta.solana.com` answers the preflight with `access-control-allow-origin: https://catcoinsanctuary.com` (VERIFIED: `raw/rpc-preflight.headers`). It is rate-limited, so INFERRED: use a keyed RPC for sending.

---

## 7. Cross-check with the CIA repo (read-only)

- `bots/cashcat/stonkfun.mjs` in commit `486717d` "WIP launcher", plus `bots/lib/verified.mjs`, already implement this path. They cover the planner, the on-chain checks of platform, config and rule, `encodeInitialize` with the same 11-byte None tail, and the same 16-account layout. My fresh decodes of today's launches agree with them on every constant: `STONKFUN_PLATFORM_STANDARD 4E876…`, reward `6BwHH…`, the authority and event-authority PDAs, the IDL discriminators, and `STONKFUN_SHAPE` `{6, 1e15, 793.1e12, cpmm, constant}` (VERIFIED).
- CIA simulations from 2026-09-25 (`fixtures/bots/stonkfun/2026-09-25/simulate-initialize-v0-{SPYx,PLTRx}.json`) passed as v0 transactions. Today's legacy browser-style simulations also pass (VERIFIED).
- The CIA code's premise: `creator_fee_rate` is 0 on chain and forwarding happens off chain. That is still true (VERIFIED). Today I also **observed a forward on chain** for an adopted launch (VERIFIED, section 4.3). CIA's planner assumes every quote is Token-2022, because it was written for xStocks. For the 15 SPL-quote Backpack cats, the quote token program must come from `pair.tokenProgram` or the mint owner (VERIFIED by the DOGE simulation).
- CIA pinned metadata on Pinata IPFS (`bots/cashcat/metadata.mjs`). StonkFun's form uses Irys/Arweave. Both are accepted by adoption; the image host does not matter.
- `git stash@{0}` ("SOL-hop route + cat scout") touches Jupiter routing only. It contains no StonkFun or LaunchLab code (VERIFIED by grep).

---

## 8. Recommended design: "Adopt" builds the launch in the adopter's browser

INFERRED design; each step rests on the VERIFIED facts above.

**Prepared once by the owner, per cat:**
1. Upload the **1024 px token image** and a **metadata JSON** to Arweave through Irys. Cost is about 30,806 lamports per 1.3 MB on Solana (Irys `/price/solana/1300000`), so all 91 cats with banners cost well under 0.01 SOL (VERIFIED prices). Put the banner (1500×500) on Arweave too. JSON shape:
   ```json
   {"name":"Sockfoot the Morning Cat","symbol":"SOCKFOOT",
    "description":"<story> <disclosure>",
    "image":"https://gateway.irys.xyz/<imageId>",
    "external_url":"https://catcoinsanctuary.com/cat/sockfoot",
    "extensions":{"website":"https://catcoinsanctuary.com/cat/sockfoot","twitter":"https://x.com/<handle>"},
    "properties":{"category":"image","files":[{"uri":"https://gateway.irys.xyz/<imageId>","type":"image/png"},
                                              {"uri":"https://gateway.irys.xyz/<bannerId>","type":"image/png"}],
                  "links":{"website":"https://catcoinsanctuary.com/cat/sockfoot"}}}
   ```
   - This mirrors StonkFun's own JSON. StonkFun's image component loads `gateway.irys.xyz` directly and "optimized"; other hosts go through the `wsrv.nl` proxy (VERIFIED: `raw/image-host-handling-excerpt.js.txt`).
   - Keep name ≤32 bytes, ticker ≤10 and URI ≤200. Those are the form's limits and CIA's guard; INFERRED that they are safe on chain.
   - Hosting the JSON on catcoinsanctuary.com also works: StonkFun renders any HTTPS image through its proxy (VERIFIED code). But GitHub Pages is mutable and not permanent, while the on-chain URI is permanent. INFERRED: Arweave is better.
2. The kit file for the site holds `{catId, quoteMint, quoteTokenProgram, name, symbol, uri, imageUrl, bannerUrl, xPostText, xProfileKit}`.

**At adoption (browser only; no server, no custody):**
1. The adopter connects a wallet through Wallet Standard.
2. `GET /stats`: require `launchLabEnabled`. `GET /pairs?launchable=true&launchLabReady=true`: require the cat's quote mint, and read `tokenProgram`. `GET /launchlab/pricing?quoteMint=`: read `configId`, `raise.raw`, `platform.standard` and `curveRule.standard`, and check them the way CIA's planner does:
   - the rule equals PDA(platform, config);
   - the platform equals `4E876…`;
   - supply, sell amount and decimals are the constants;
   - optionally, re-read the platform, config and rule accounts on chain.
3. Check that the cat has not been adopted yet (see "first launch wins" below).
4. Generate a **mint keypair in the page**. It is a one-time signer, not the user's key.
5. Build a **legacy** transaction: `SetComputeUnitLimit(600000)`, optionally a small `SetComputeUnitPrice`, then `initialize_with_token_2022`:
   - the 16 accounts from section 3.2, with payer = creator = adopter and quote token program = the pair's program;
   - the arguments from section 3.3.

   Optionally add a Memo "catcoinsanctuary adopt <catId>". INFERRED: harmless, since third-party wrappers with extra instructions are adopted.
6. Run `simulateTransaction` before asking for a signature. Show the adopter the cost (about 0.0086 SOL) and the result.
7. Signing: the wallet signs, the page adds the mint signature, then the page sends and confirms. StonkFun's form uses `signTransaction` plus its own relay (VERIFIED). The sibling "launcher" research covers `signAndSendTransaction` and how Phantom's Lighthouse assertions interact with multi-signer transactions (`raw/launcher/ph-*.md`), so the exact wallet call is deferred to it.
8. Show "moving in…" immediately with the mint and pool. Poll `/tokens/{mint}` until it answers 200 with `launchpad:"launchlab"` (4–7 min observed). The cat then moves into the garden as "adopted by <short creator>", with GMGN/FOMO/Jupiter links keyed by mint.

**"First confirmed launch wins" (INFERRED method on VERIFIED data):**
- A launch counts for cat C only when all of these hold:
  - it is a LaunchLab `initialize_with_token_2022`;
  - `pool.platform_config = 4E876…`;
  - `pool.quote_mint` = C's stock;
  - the TokenMetadata `uri` equals C's kit URI (and name and symbol match);
  - the transaction is finalized without error.
- The earliest slot wins, with the transaction index breaking ties. Do not use StonkFun's `createdAt` for ordering: it lags 2+ min for self-built launches.
- Cheap discovery without RPC: `/launches?since=…&pageSize=100` returns `logoUrl` (the JSON `image`). If every cat's image URL is unique, it identifies the cat. Confirm on chain with `getAccountInfo(mint)` and read the Token-2022 metadata URI.
- Store the result in a JSON file written by a scheduled GitHub Action, the way the CIA bots' workflows do, and have the page also check live for the cat it is showing.
- The current sanctuary rule ("fee payer is a listed wallet") has to become "any wallet whose launch matches the kit".

---

## 9. Risks and caveats

1. **Kits are public, so anyone can launch one.** The name, ticker, image and URI are predetermined and published, so any wallet or bot, using any tool, can launch a kit first. StonkFun allows duplicate names (VERIFIED). Under "first confirmed launch wins", a squatter who does this becomes that cat's adopter. **The owner needs to decide this.**
2. **No links on StonkFun for self-built launches** (VERIFIED, 4 of 4). The website and X are in the permanent JSON only. If the owner wants them on StonkFun's token page, the only paths are StonkFun's own form, where our description is lost and StonkFun's JSON is used, or StonkFun adding them by hand (the admin-only route exists).
3. **Metadata is permanent.** The update authority is the LaunchLab PDA and there is no update instruction (VERIFIED and INFERRED; see 3.4). Every kit field must be final before the first adoption.
4. **Terms and geo.** Building directly skips StonkFun's terms cookie and signature and its 20-jurisdiction geo gate (VERIFIED that both exist). INFERRED: our Adopt page should link StonkFun's terms and state the same restrictions, so it does not work as a way around them.
5. **Wallet and phishing reputation.** A comparable third-party StonkFun launcher currently shows a Cloudflare "Suspected Phishing" page (VERIFIED). INFERRED ways to reduce the risk:
   - show the fully decoded transaction and simulation result before signing;
   - never request `signAllTransactions` or other broad approvals;
   - keep the adopter's single approval limited to this one launch.
6. **The platform could change.** Configs are per quote, and the raise moves with price. StonkFun could change the curve rule, since there is a rule manager (VERIFIED). Rule 6018/6025 failures show up in simulation before signing (VERIFIED). Re-read pricing and the rule accounts on every adoption.
7. **Fee forwarding depends on StonkFun.** The on-chain `creator_fee_rate` is 0, so forwarding is StonkFun's off-chain promise. I observed it working for one adopted launch (VERIFIED) but cannot guarantee it (INFERRED). It is paid in the quote token, so for our cats in the stock itself (VERIFIED for STONK).
8. **Dev buy.** With a stock quote, `buy_exact_in` pays in the stock. The form converts SOL through a separate transaction. Owner decision (3) implies no dev buy, so I left it out (INFERRED fit).
9. **Rate limits.** The public API allows 300 requests per minute per IP. A static page must not poll all 91 cats on every visit; use a cached JSON (INFERRED).
