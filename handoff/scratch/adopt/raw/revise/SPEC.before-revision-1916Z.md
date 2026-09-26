# Adopt a cat: implementable spec for catcoinsanctuary.com

Written 2026-09-25, about 19:00–19:30 UTC, by the architect pass. It builds on four research reports and adds a few new read-only probes (section 0.2).

**Nothing was signed, sent or broadcast.** The only transaction call was one `simulateTransaction` with `sigVerify:false` and `replaceRecentBlockhash:true`, re-run on a transaction the StonkFun research had already built. No key or seed phrase was asked for or handled. `/home/user/cat-sanctuary` and `/home/user/Cat-Intelligence-Agency` were only read.

**Labels.** Every claim carries one of these:

- **VERIFIED**: seen in code, data, a live answer or on chain, with the evidence path given.
- **INFERRED**: reasoning, a design choice, or a claim that has not been checked.

**Path shorthands**

| Short | Full path |
|---|---|
| `A/` | `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/` |
| `S/` | `A/spec/`: new evidence from this pass |
| `RS` | `…/scratchpad/adopt/research-stonkfun.md` |
| `RL` | `…/scratchpad/adopt/research-launcher.md` |
| `RR` | `…/scratchpad/adopt/research-registry.md` |
| `KI` | `…/scratchpad/adopt/kits-inventory.json` (plus `A/kits/tables.md`, `descriptions.md`, `sample.md`) |
| `site/` | `/home/user/cat-sanctuary/`, as read at about 19:00 UTC |
| `cia/` | `/home/user/Cat-Intelligence-Agency/` at `5f573e5` |

The site is being rebuilt by another workflow right now. File paths in section 5 refer to the tree as it was at 19:00 UTC, so the implementer should re-map them onto the rebuilt tree.

---

## 0. Summary

### 0.1 The design in one screen

1. **The launch happens on our site.** The adopter's own wallet signs and pays for it, with **one approval** and **no backend**.
   - The page builds StonkFun's documented "build it yourself" LaunchLab launch, `initialize_with_token_2022` on StonkFun's standard platform, with every field taken from the cat's frozen kit.
   - The launch is priced in the cat's stock.
   - StonkFun records such pools by itself, in about 2–7 minutes (VERIFIED, section 1).
2. **The sanctuary never holds anything.** There are no keys, no fees and no server. The only secret-like value in the page is the one-time **mint keypair** the page generates in memory. It is not the user's key, and it is discarded after one signature.
3. **The kit is fixed ahead of time, for each cat.**
   - The name, ticker, description and 1024 px image are final.
   - The 1500×500 banner, the 400 px avatar and the 1200×630 share card are generated.
   - The metadata JSON sets its website to `https://catcoinsanctuary.com/cat/<ticker>`.
   - A one-click X post and an X profile kit go with it.
   - The owner uploads the image and metadata to Arweave **once**, before a cat opens. The metadata address can never change afterwards (VERIFIED).
4. **The chain decides who adopted a cat.**
   - A launch counts only if it matches the kit exactly: the platform, the stock, and the name, ticker and metadata address. The fee payer must also be the creator.
   - The earliest `(slot, transactionIndex)` at `finalized` wins.
   - A GitHub Action commits `data/adoptions.json` every 5 minutes. The page covers the gap live, through a browser-usable RPC.
5. **What this cannot fix.** The kit is public, so anyone, bots included, can launch it first. Light limits exist, but only the owner can decide how much of this to accept (section 9).

### 0.2 New evidence and corrections from this pass

| # | Finding | Label | Evidence |
|---|---|---|---|
| N1 | **None of the 91 cats' stocks uses the classic SPL token program.** All 91 are Token-2022 and LaunchLab-ready. RS §3.2 said 15 of "our" Backpack cats were classic SPL, but those 16 Backpack pairs are crypto (DOGE, LINK, PEPE, …). The site's collection code excludes them on purpose (`site/assets/collection.js` header). The builder still takes the quote token program from the pair, as a precaution. | VERIFIED | `S/quote-token-programs-91.json` |
| N2 | **The public mainnet RPC cannot be used from the page.** Its preflight answers with an ACAO header (which is what RS §6 saw), but the POST itself answers **403** to any browser Origin. | VERIFIED | `A/registry/chain/rpc-origin-check.txt`, `A/registry/chain/browser-rpc-origin-matrix.txt` |
| N3 | **`solana-rpc.publicnode.com` serves every call the page needs from our Origin** (ACAO `*`): `getLatestBlockhash`, `getMultipleAccounts`, `getBalance`, `simulateTransaction` (our transaction: err null, 94,118 CU), `getSignaturesForAddress`, `getTransaction` and `getSignatureStatuses`. It refuses only `getProgramAccounts`. `sendTransaction` was **not** tested, because that would be a send. | VERIFIED (except send) | `S/publicnode-probe.out.json`, `S/curve-rule-feed-probe.out.json`, `A/registry/chain/publicnode-browser-reads.txt` |
| N4 | **Each stock has a launch-only feed on chain.** The signature list of StonkFun's curve-rule address for that stock (PDA["platform_curve_rule", 4E876…, config]) contains launches only. For SPYx: 25 of the last 25 signatures had no error and all carry `transactionIndex`; 8 of 8 read back were `InitializeWithToken2022`, covering legacy and v1 transactions, bundled buys and swaps. The feed spans about 17 h, and publicnode serves it to a browser. The page therefore gets a live "has anyone just launched this cat?" check without `getProgramAccounts`, and the registry gets each creation transaction without paging the pool's history. | VERIFIED (SPYx sample); INFERRED that it holds for every stock, because the curve rule is only an `initialize` account | `S/curve-rule-feed-probe.out.json` |
| N5 | **Phantom documents the order for multi-signer transactions.** "If the transaction requires multiple signers, sign it with Phantom first using signTransaction instead of signAndSendTransaction, then collect signatures from the other signers", and "simulate the transaction with `sigVerify: false` … before submitting it for signing". Phantom's injected extension accepts pre-signed transactions; its embedded (social-login) wallets do not. | VERIFIED (docs) | `S/developer-powertools_domain-and-transaction-warnings.md` lines 105–112, `S/phantom-browser-sdk-sign-and-send.md` lines 42–52 |
| N6 | **The Wallet Standard defines both features we need.** `solana:signTransaction` takes a `Uint8Array` transaction and returns `signedTransaction`. `solana:signAndSendTransaction` returns `signature`. Both support `'legacy' \| 0 \| 1`. The discovery module `@wallet-standard/app` 1.1.1 is a 6,372-byte ES module with no imports. | VERIFIED | `S/wsf-1.5.0-*.d.ts`, `S/wsapp-1.1.1-wallets.js` (sha256 `36155c77…ed97`) |
| N7 | **GitHub Pages serves a page without its `.html` extension, with no redirect.** On our domain, `/index` answered 200 with `index.html`'s content. So `cat/patchpaw.html` should serve at `/cat/patchpaw`. | VERIFIED (`/index`); INFERRED for a subfolder until deployed | `S/gh-pages-extensionless.txt` |
| N8 | **StonkFun has no standalone terms page.** Terms are accepted inside the app (`/api/terms-accept`), and blocked visitors are sent to `/restricted`. | VERIFIED | `S/stonkfun-routes.txt`, `A/pretty/1j6ogqjj6b5kt.js` |

---

## 1. Feasibility verdict

### 1.1 Verdict: in-site launch, one approval, StonkFun records it

**Yes.** The adopter can launch from our site in one approval, and StonkFun will record it. This rests on the following, in order of strength:

1. **StonkFun documents the path** and says it needs no registration call: "There is nothing else to call. Within a minute or two the pool is adopted." VERIFIED: `A/developers-build-yourself-code.txt`.
2. **Third-party launches built this way are recorded in production.** Launches from uxento, j7tracker and a catbox-hosted JSON appear with `launchpad:"launchlab"`: in `/launches` after 133–155 s, and in `/tokens/{mint}` after 4–7 min. VERIFIED: RS §4.3, RR §2.1.
3. **The launch shape is enforced on chain.** The platform has `restrict_curve_param = 1`. Leaving out the curve rule fails with 6018, a wrong supply fails with 6025, and the exact shape passes. So a pool that carries StonkFun's platform id cannot land in a shape StonkFun would refuse. VERIFIED: `A/simulate-browser-build.json`.
4. **Our bytes match StonkFun's own.**
   - RS re-encoded 6 of 6 real launches (3 form, 3 third-party) byte for byte (`A/reencode-check.json`).
   - CIA's `bots/cashcat/stonkfun.mjs` does the same and passes its tests (RL §4).
   - A browser-style build simulates cleanly on mainnet for NVDAx, HTZ, DOGE and OPENAI (RS), and for SPYx, TSLAx, ANTHROPIC, MU and PSG (RL): 88k–106k CU, with the payer spending 0.0085–0.0087 SOL. Today the same transaction also simulates through publicnode (N3). All VERIFIED.
5. **Signing and sending work from a static page.**
   - Phantom's documented order for two signers is: wallet `signTransaction` first, then the other signer (N5, VERIFIED).
   - Wallet Standard exposes that call (N6, VERIFIED).
   - publicnode serves the reads, the simulation and the status checks to our Origin (N3, VERIFIED).

**What is not yet proven, and where the plan proves it:**

| Open point | Risk | Proven at |
|---|---|---|
| Phantom, Solflare and Backpack return our message unchanged from `signTransaction`, so the mint's co-signature stays valid | If a wallet rewrites the message (for example with Lighthouse assertions), the page catches it with `sameMessage` and refuses. Nothing lands and nothing is charged. | Stage 4: a devnet two-signer test, then a **mainnet sign-only dry run** that is never sent (section 7.4) |
| publicnode accepts `sendTransaction` from a browser | Without it, the page falls back to Path P (the wallet sends) or to an owner-provided RPC restricted to our domain | Stage 4 (devnet) and the owner's test launch (Stage 7) |
| StonkFun records a launch built by **our** code | Every other hand-built launch sampled was recorded (VERIFIED), but not one built by our code. INFERRED low risk. | Stage 7: the owner's single real test launch |
| StonkFun shows website and X links for self-built launches | VERIFIED **not** shown: 4 of 4 had `links: {}`. The links live only in the permanent JSON, which wallets and explorers read. | Owner decision D5, not a blocker |

### 1.2 Why not hand off to StonkFun's form (all VERIFIED, RS §2, §5)

- StonkFun's internal `POST /api/launchlab-launch` answers the CORS preflight with **405** and no ACAO header, so another site cannot call it.
- `/api/public/v1/launches/prepare` answers **503**: "launch through LaunchLab instead".
- The form reads no URL parameters. It sends `X-Frame-Options: DENY`, and its image field is a file input. Nothing can be prefilled.
- The form writes its own JSON: the description becomes "<name> was launched on StonkFun.", the URI is a new Irys URI for each launch, and there is no banner. Our description and disclosure never reach the chain, and the registry's exact-URI rule cannot match the launch.

The hand-off is kept only as **Plan B** (section 1.5).

### 1.3 The exact transaction recipe (in-site)

**Where the inputs come from.** Each input comes from one of these sources and is checked before use:

- the frozen kit, `data/kits.json`: `name`, `symbol`, `metadataUri`, `quoteMint`, `quoteTokenProgram`;
- StonkFun's public API on `https://www.stonkfun.xyz/api/public/v1` (CORS `*`, 300 requests a minute; VERIFIED RS §6, RR §2.1);
- chain reads through publicnode (N3);
- the connected wallet's public key, A;
- the page's one-time mint keypair, M.

**Format.** A **legacy** transaction, as StonkFun's own form sends (VERIFIED, RS §2). It is 836–896 bytes (VERIFIED), with no lookup tables.

```
fee payer            A (adopter wallet)
recentBlockhash      getLatestBlockhash("confirmed") via publicnode; keep lastValidBlockHeight
signers              exactly [A, M], A first (fee payer)
ix0  ComputeBudget   SetComputeUnitLimit(250_000)        data 02 90d00300
ix1  ComputeBudget   SetComputeUnitPrice(20_000 µlamports) data 03 204e000000000000
ix2  LaunchLab LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj  initialize_with_token_2022
```

- **Compute limit.** 250,000 is CIA's `COMPUTE_LIMITS.stonkfun`, the limit its v0 simulations were run with. The heaviest simulation seen used 105,719 CU (VERIFIED, `cia/bots/cashcat/config.mjs:56`, RL §6).
- **Compute price.** 20,000 µL comes to 5,000 lamports of priority fee. This is INFERRED; keep it configurable, capped at txcheck's 200,000 µL.
- **Memo, dev buy, other instructions: none.** CIA's `checkLaunchMessage` allows exactly this shape, and owner decision (3) means no dev buy.

**ix2 accounts** (VERIFIED: RS §3.2 and RL §2.2, 6 of 6 real launches re-derived):

| # | Account | Signer | Writable | Value |
|---|---|---|---|---|
| 0 | payer | yes | yes | A |
| 1 | creator | (merged with 0) | | A. The IDL does not make the creator sign. Setting it equal to the payer is what makes "adopted by" honest (section 4.2). |
| 2 | global_config | | | `pricing.curve.configId` (per stock, for example SPYx `B7ctMMdG…9adg`) |
| 3 | platform_config | | | `4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7` (StonkFun standard) |
| 4 | authority | | | `WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh` = PDA["vault_auth_seed"] |
| 5 | pool_state | | yes | PDA["pool", M, quoteMint] |
| 6 | base_mint | yes | yes | M |
| 7 | quote_mint | | | the kit's `quoteMint` |
| 8 | base_vault | | yes | PDA["pool_vault", pool, M] |
| 9 | quote_vault | | yes | PDA["pool_vault", pool, quoteMint] |
| 10 | base_token_program | | | Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| 11 | quote_token_program | | | `pair.tokenProgram`: Token-2022 for all 91 cats (N1) |
| 12 | system_program | | | `11111111111111111111111111111111` |
| 13 | event_authority | | | `2DPAtwB8L12vrMRExbLuyGnC7n2J5LNoZQSejeQGpwkr` = PDA["__event_authority"] |
| 14 | program | | | `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj` |
| 15 | curve rule (last, read-only) | | | `pricing.curveRule.standard`, which must equal PDA["platform_curve_rule", platform, global_config] |

**ix2 data** (borsh; VERIFIED: re-encoded byte-identical 6 of 6, RS §3.3; `cia/bots/cashcat/stonkfun.mjs` `encodeInitialize`):

```
25be7ede2c9aab11                     discriminator
u8   6                               decimals
str  name        (u32 LE length + UTF-8, ≤ 32 bytes)
str  symbol      (≤ 10 bytes)
str  uri         (≤ 200 bytes; the kit's metadataUri, byte for byte)
u8   0                               CurveParams::Constant
u64  1_000_000_000_000_000           supply
u64  793_100_000_000_000             total_base_sell
u64  pricing.raise.raw               total_quote_fund_raising (in the stock's decimals, priced live)
u8   1                               migrate_type = cpmm
u64 0, u64 0, u64 0                  vesting (locked, cliff, unlock)
u8   pricing.curve.cpmmCreatorFeeOn  (0 in every plan seen)
u8 0 + 10 zero bytes                 transfer_fee_extension_param = None, written exactly as StonkFun writes it
```

**Checks before the wallet is asked.** These are ported from CIA's `planStonkfunLaunch`, `checkLaunchMessage` and `checkSimulation`. Every one must pass, and each refusal names its clause.

1. **`GET /stats`:** `config.launchLabEnabled === true`.
2. **`GET /pairs?launchable=true&launchLabReady=true`:**
   - The kit's `quoteMint` must be listed as launchable and ready.
   - `tokenProgram` must equal the kit's.
   - Key the lookup by mint, never by symbol (HTZ has two pairs; VERIFIED RS §6).
3. **`GET /launchlab/pricing?quoteMint=`** must satisfy all of:
   - `curve.programId` = LaunchLab;
   - `platform.standard` = `4E876…`;
   - `ConstantCurve`, `cpmm`, `baseDecimals` 6, `supply` 1e15, `totalSellA` 793.1e12, vesting all "0";
   - `raise.raw` a positive integer string;
   - `curveRule.standard` equal to the derived PDA;
   - `quote.mint` equal to the kit's.
4. **One `getMultipleAccounts` (publicnode) of platform, config, rule and quote mint:**
   - platform, config and rule are owned by LaunchLab;
   - the platform's name decodes to "StonkFun";
   - the config's `quote_mint` is the kit's stock and its `curve_type` is 0;
   - the rule's platform and config match;
   - the quote mint's owner is the pair's token program.
5. **Compile, then re-read the compiled bytes** (`readMessage` → `checkLaunchMessage`):
   - the fee payer is A, and the signers are exactly {A, M};
   - at most 2 compute-budget instructions (limit ≤ 1.4M, price ≤ 200,000 µL) plus exactly one LaunchLab instruction;
   - every account re-derives, flags included;
   - the decoded arguments equal the kit, the shape and the plan's raise.
6. **`simulateTransaction`** (publicnode; `sigVerify:false`, `replaceRecentBlockhash:true`, `accounts:[A]`) must show:
   - `err === null`;
   - the log line `Instruction: InitializeWithToken2022`;
   - A's spend ≤ **15,000,000 lamports** (CIA's `MAX_LAUNCH_SPEND_LAMPORTS.stonkfun`), and A gains nothing;
   - `unitsConsumed` < 250,000.
7. **The race check** in section 4.7: the cat is still free on chain.

**Signing: one approval.** The page picks the path from the wallet's features.

- **Path S** (preferred, and what Phantom documents for multiple signers, N5). The wallet must expose `solana:signTransaction` and the send-RPC health check must pass.
  1. `signTransaction({ account, transaction: unsignedWire, chain: "solana:mainnet" })` returns `signedTransaction`.
  2. Parse it. The message bytes must equal the bytes we built (`sameMessage`, from `cia/src/lib/tx.mjs`), and slot 0 must hold a valid ed25519 signature by A over them. Otherwise refuse with `wallet_changed_tx`. The wallet-signed copy can never land without M's signature, so refusing is safe.
  3. M signs the same message into slot 1. Then **wipe M's secret** (`fill(0)`).
  4. Send the base64 wire to publicnode `sendTransaction` with preflight on (`preflightCommitment:"confirmed"`, `maxRetries:0`), so a transaction that would now fail is refused without a charge. Also send it to the optional second RPC (D11). Rebroadcast the same bytes every 2 s with `skipPreflight:true` until `confirmed`, or until block height passes `lastValidBlockHeight`.
  5. The signature is base58 of slot 0.
- **Path P** (fallback). Used when the wallet has only `solana:signAndSendTransaction`, or when no browser RPC accepts sends.
  1. M signs slot 1 first.
  2. `signAndSendTransaction({ account, transaction: wireWithMintSig, chain: "solana:mainnet", options: { preflightCommitment: "confirmed" } })` returns `signature`.
  3. If the wallet rewrites the message, M's signature becomes invalid and the network rejects the transaction. Nothing is charged, and the page reports "did not land" once the blockhash expires. INFERRED from how signature checks work.
- **Never used:** `signAllTransactions`, `signMessage`, token approvals, or any second transaction.

**The mint key's lifecycle.**
- It is generated once per adoption attempt, from `crypto.getRandomValues`, and kept only in memory.
- It is never persisted, never logged and never sent.
- If the blockhash expires and the page rebuilds, it **reuses the same M**. If the earlier copy did land after all, the rebuild fails harmlessly ("account already in use"), so one attempt can never create two coins. INFERRED from how account creation works; there is a unit test for it with a chain double.

**Confirmation.**
1. Poll `getSignatureStatuses([sig])` (publicnode) every 1.5 s until `confirmed`, then `finalized`.
2. Then `getMultipleAccounts([pool, M])` and apply registry clauses 1–4 and 7 locally: platform, stock, the kit's name, symbol and URI, and creator = A.

**Cost to the adopter.** The exact amount comes from the simulation and is shown before signing.
- About **0.0085–0.0087 SOL**, depending on the stock and the text lengths: rent of about 0.0085–0.0087 SOL for the mint, the pool and two vaults, plus a 15,000-lamport network fee (2 × 5,000 for signatures, plus 5,000 priority). Simulated spends were 8,534,240–8,668,820 lamports with smaller fees (VERIFIED, RS §3.4, RL §6).
- There is no platform fee: LaunchLab's fee is 0 (VERIFIED, `A/api/launch-quote.json`). The sanctuary takes no fee.
- The rent is not refundable: the accounts belong to the programs (INFERRED).

### 1.4 How the design stays safe if a wallet misbehaves

| Wallet behaviour | Result |
|---|---|
| Changes the message in `signTransaction` (Lighthouse or anything else) | `sameMessage` fails, the page refuses, nothing is sent and nothing is charged. Stage 4 records which wallets do this. **v2 option (INFERRED):** if a wallet only *appends* Lighthouse assertion instructions, relax the check to allow exactly those, verified by program id. M then co-signs the wallet's returned message, so its signature stays valid. |
| Supports only `signAndSendTransaction` | Path P. A rewrite makes the network reject the transaction, with no charge. |
| Is an embedded (social-login) wallet | Not offered. Phantom's docs say these refuse pre-signed transactions and are reached only through its SDK (VERIFIED, N5); that they never register as injected Wallet Standard wallets is INFERRED. |
| Is on devnet | Refused: the page requires `account.chains` to include `solana:mainnet`. |

### 1.5 Plan B: hand-off to StonkFun's form

Use this only if the owner rejects in-site launching, or if Stage 4 finds no wallet that can co-sign.

**What we provide** (field rules VERIFIED in `A/pretty/3f11vexa51nkb.js`; KI `limits.stonkfunForm`):
- a download of the 1024 px PNG (at most 2 MB, square);
- copy buttons for the name (≤ 32), the ticker (≤ 10), the website (`https://catcoinsanctuary.com/cat/<ticker>`, ≤ 200) and an optional X profile URL;
- the stock's **mint**, which StonkFun's quote search matches;
- the instructions "Holder rewards tax: None. Dev buy: empty.";
- a link to `https://www.stonkfun.xyz/launch`.

**How we detect it.**
- Poll `GET /launches?creator=<A>&since=<t>`, or `/launches?since=`, filtered to the cat's `quote.mint`.
- Confirm on chain: the name, symbol and stock match exactly, the pool is on the standard platform, the creator is the fee payer, **and** the JSON's image bytes hash to the kit image's sha256.
- It is **untested** whether StonkFun re-encodes uploaded images (RR §3.2). The hash rule must be proven by the owner's own form launch first.

**What is lost.** Our description and disclosure never reach the chain; the metadata address is different for each launch; the adopter types every field by hand. In return, the links **do** show on StonkFun.

---

## 2. Adopter UX flow

Every text on screen is set with `textContent`, as the site's page test requires (`site/tests/page.test.mjs`). The adopter types nothing: every value comes from the kit or the chain.

### 2.1 Happy path

1. **The garden.**
   - Every planned cat whose kit is frozen shows the tag **"Up for adoption"**. This replaces "Not launched yet" for those cats.
   - The other tags are **"Adopted by 3J57…iji3"** (with the gold coin, as launched cats have today), **"Moving in…"**, **"Opens 2 Oct"** and **"Adoption paused"**.
   - The legend gains the badges "Up for adoption" and "Adopted".
2. **Click a cat to open its card.** The card keeps today's content: story, portrait, the real-cat research and the disclaimer. It adds an **Adoption** panel:
   - thumbnails of the kit: token image and banner;
   - the name, `$TICKER`, "priced in SPYx", and the website URL;
   - **[Adopt this cat]**;
   - **[Share: up for adoption]**, the waiting post as an X intent;
   - a "How adoption works" disclosure.
3. **Adopt opens a modal dialog** (`<dialog id="adopt">`, keyboard-trappable). The route `#adopt=<TICKER>` opens it directly; the per-cat pages link to it.
   - **Step 1 of 4, "What you get":**
     - the kit, with every permanent field marked "permanent";
     - "You will be the coin's creator on StonkFun";
     - "About 0.0087 SOL in network costs, almost all of it rent for the coin's accounts. The sanctuary takes nothing.";
     - the rules in plain words: first confirmed launch wins; anyone can launch this kit, bots included; one adoption per wallet per 24 h (if the owner keeps D1).
     - **[Continue]**
4. **Step 2 of 4, "Connect a wallet".**
   - The page lists the Wallet Standard wallets it finds that support `solana:mainnet` and `solana:signTransaction` or `solana:signAndSendTransaction`: Phantom, Solflare, Backpack and others (INFERRED that all three register).
   - Connecting uses `standard:connect`. The page then shows `3J57…iji3` and the balance (`getBalance`).
   - **If no wallet is found:** "Open this page in your wallet app's browser". Offer the Phantom and Solflare browse deep links (INFERRED link formats; verify in Stage 4) and the plain URL to copy.
5. **Step 3 of 4, "Review".** A live checklist, with each line ticking as it passes (section 1.3, checks 1–7):
   - "StonkFun launches are on"
   - "The SPYx pair is ready"
   - "StonkFun's launch shape confirmed on Solana"
   - "Patchpaw is still free"
   - "Your wallet can adopt today"
   - "Test run on Solana passed: your wallet pays 0.00868 SOL"

   Below the checklist:
   - **A decoded summary:** "One transaction. It creates the coin Patchpaw the Calico ($PATCHPAW), with 1,000,000,000 supply, on StonkFun (Raydium LaunchLab), priced in SPYx. You are its creator. No tokens leave your wallet. Nothing is approved for later."
   - **Two required checkboxes:**
     1. "I understand the coin's name, picture, description and website are permanent, and that if someone else's launch of this cat confirms first, mine will not be the sanctuary's cat."
     2. "I am not in a jurisdiction StonkFun blocks [list] and I accept StonkFun's terms (shown on stonkfun.xyz)."
   - **[Adopt Patchpaw: approve in your wallet]**
6. **Step 4 of 4, "Approve in your wallet".** A spinner. Cancelling returns to Review with "Nothing was signed or charged."
7. **"Sending…"**, then **"Confirmed on Solana"**, with a Solscan link for the transaction.
   - The page checks its own launch: clauses 1–4 and 7.
   - It re-runs the race check once the launch is `finalized`.
8. **"Moving in…"**
   - The mint with a copy button, and "adopted by you (pending)".
   - The StonkFun status: "StonkFun lists coins launched outside its form after about 2–7 minutes". The page polls `/tokens/{mint}` every 20 s for up to 15 min.
   - The garden shows the cat with "Moving in…" in this browser only.
   - `localStorage.adoptPending[TICKER] = {sig, mint, at}` holds no keys. It is wrapped in try/catch and exists only for convenience.
9. **Share** (enabled once the finalized race check passes):
   - **[Post on X]**: the adopted template with `CA <mint>` filled in, as an `x.com/intent/tweet?text=` link;
   - **[Get your X profile kit]**: the display name, bio and suggested handle with copy buttons; the avatar and header as downloads; the website to put in the profile;
   - **[Open on StonkFun]**, once recorded;
   - **[Solscan]**.
10. **The registry confirms** (about 5–25 min): the cat shows "Adopted by 3J57…iji3". The card shows the mint, the Solscan and StonkFun pages, and the GMGN and FOMO links built by the site's shared `buyLinks(mint)`.

### 2.2 Failure and race states (every one is handled)

| State | Detected by | What the adopter sees | Money |
|---|---|---|---|
| Adoption not open | `kits.json` `opensAt` in the future | "Opens 2 Oct, 14:00 UTC"; Adopt is disabled | none |
| Adoption paused | `adoptions.json.cats[T].paused` (a daily simulation failed), or check 1–4 fails live | "StonkFun changed something; adoption is paused. Nothing was signed." | none |
| StonkFun API unreachable or 429 | fetch error, or `Retry-After` | "StonkFun isn't answering; try again in a minute." | none |
| **Someone adopted this cat first** (already known) | `adoptions.json` `status:"adopted"` | The card shows the resident; Adopt is hidden | none |
| **Someone is moving in** (live) | race check finds a valid kit launch newer than `adoptions.json.snapshotSlot` | "Someone just adopted this cat (mint Ab12…). It is being confirmed." Adopt is disabled. | none |
| Wallet over the per-wallet limit | `adoptions.json` (plus the live feed) shows an accepted adoption by A within 24 h | "This wallet adopted Pewter 3 h ago. One adoption per wallet per 24 h." | none |
| Not enough SOL | balance, or a simulation error about insufficient funds | "You need about 0.009 SOL; you have 0.004 SOL." | none |
| Simulation fails (6018, 6025 or anything else) | check 6 | "The test run failed: <code>. Nothing was signed." The failure is logged to the console only. | none |
| User cancels in the wallet | the wallet promise rejects | Back to Review, "Nothing was signed or charged." | none |
| Wallet changed the transaction | `sameMessage` fails (Path S) | "Your wallet changed the transaction, so it was not sent. Try another wallet." | none |
| Send refused, or the RPC is down | error from `sendTransaction` | Retry on the second RPC; if it still fails, offer Path P when the wallet supports it | none |
| Blockhash expired (wallet left open for more than 60–90 s) | block height passes `lastValidBlockHeight` without confirmation | "It didn't land in time; nothing was charged. [Try again]": rebuilds with the **same** mint key | none |
| The transaction landed with an error | `err` in the status | "Solana rejected it: <err>. Only the network fee was charged." | fee only |
| **Lost the race** (confirmed, but an earlier valid kit launch exists) | race check at `finalized`, or the registry lists the launch under `later` | "Someone else's launch of Patchpaw confirmed first (mint Cd34…). Your coin exists on Solana and on StonkFun, but it is not the sanctuary's Patchpaw." No share button, and no garden tag. | the launch cost |
| StonkFun has not recorded it after 15 min | `/tokens/{mint}` still 404 | "StonkFun hasn't listed it yet. Your coin exists on Solana (mint …). The sanctuary counts it from the chain." | n/a |
| Page closed mid-flow | `localStorage` pending entry on the next visit | Resumes the status check for `sig`. No key is ever stored, so an unsent attempt is simply gone. | none unless sent |

---

## 3. The kit for each cat

### 3.1 What exists today (VERIFIED, KI 18:58 UTC)

| Group | Cats | State |
|---|---|---|
| Sheet 1 (xStocks) | 24 | name, ticker, description (244–280 characters) and 1024 px PNG (1.08–1.28 MB, RGB) all final |
| Sheet 2, picked | 26 | text only; no image, and most lack the "look" sentence the image recipe needs |
| Sheet 2, not picked | 41 | candidate names only |
| All | 91 | **no** banner, avatar, share card or per-cat page yet; all 91 stocks are Token-2022 and LaunchLab-ready (N1) |

**Collisions** (VERIFIED, KI `collisions`):
- TTWO **SAVEPAW** must be renamed before its kit is frozen: it clashes with GMEx SAVEPAWS.
- CARTONPAW and TARTANPAW are flagged only.

### 3.2 Files

| File | Spec | Hosted at | Used for | Label |
|---|---|---|---|---|
| Token image | 1024×1024 PNG, ≤ 2,097,152 bytes, no text or logos | Arweave (canonical, for the metadata `image`); a 512 px JPEG copy on the site (`assets/portraits/<T>.jpg`, which already exists for the 24) | the coin's picture everywhere | VERIFIED limits |
| Banner | 1500×500; PNG (about 0.87 MB) to Arweave, JPEG q90 (about 165 KB) on the site at `assets/kits/<T>/banner-1500x500.jpg`. PIL composite: sanctuary scene, the cat's token image in a medallion, `$TICKER`, the name, and "lives at catcoinsanctuary.com". Lettering clears X's avatar circle by at least 8 px. | Arweave and the site | X header, the cat page, `properties.files` | VERIFIED prototype (KI keyFindings; `A/kits/proto/`) |
| Avatar | 400×400, a LANCZOS resize of the token image; JPEG (about 40 KB, INFERRED) at `assets/kits/<T>/avatar-400.jpg` | site | X profile picture | INFERRED size; recipe VERIFIED (`…/adopt/tools/kits/banner.py`) |
| Share card | 1200×630 JPEG (same compositing code) at `assets/kits/<T>/og-1200x630.jpg` | site | the cat page's `og:image` and `twitter:image`, so X previews show the cat | INFERRED |
| Metadata JSON | section 3.4, ≤ 107,520 bytes | Arweave | the on-chain `uri` | — |

**Site size.** About 0.35 MB per cat (banner JPEG about 165 KB, VERIFIED; avatar and share card about 40 KB and 150 KB, INFERRED) × 91 ≈ **32 MB** of new site assets. Full PNGs stay on Arweave to keep the repository small (INFERRED).

**Missing images, 67 cats.** Use sheet 1's recipe (VERIFIED, `…/launch-sheet/images/_work/batch1.json`):
- Higgsfield `gpt_image_2_5`, 1:1, style reference `c0dc6227-9a1e-4375-9933-5cb61d2a5aec`;
- the prompt ends "no text, no letters, no logos, no brand marks";
- about 17 credits (INFERRED price);
- each image needs a human check for stray marks.

### 3.3 Text fields and templates

All VERIFIED as rendered and checked by `…/adopt/tools/kits/text.mjs` for the 50 drafted cats; KI `templates`.

| Field | Rule | Example (PATCHPAW) |
|---|---|---|
| name | ≤ 32 bytes, Latin, contains a cat word (`checkProposal`) | `Patchpaw the Calico` |
| ticker | `^[A-Z0-9]{2,10}$`, not a Jupiter-verified ticker | `PATCHPAW` |
| description (permanent) | `{story} {disclosure}`, ≤ 280 characters | story + "A cat coin priced in SPYx. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice." (the disclosure wording is decision **D2**) |
| website (permanent) | `https://catcoinsanctuary.com/cat/{ticker lower-case}`, ≤ 200 | `https://catcoinsanctuary.com/cat/patchpaw` |
| X post, before adoption | "{name} is up for adoption at Catcoin Sanctuary. $TICKER / [story variant] / {website} / {disclosure}"; weighted ≤ 276 (twitter-text v3, URL = 23) | 209 weighted |
| X post, after adoption | "I adopted {name} at Catcoin Sanctuary. $TICKER / [story variant] / CA {mint} / {website} / {disclosure}"; the worst case with a 44-character mint is ≤ 275 | 248 weighted (worst case) |
| X display name | `{name}`, ≤ 50 (INFERRED limit) | `Patchpaw the Calico` |
| X bio | the first of 5 fallback variants that fits in ≤ 160 characters | "Patchpaw the Calico, adopted at Catcoin Sanctuary. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice." (138) |
| X handle suggestion | `{TICKER}cat` (≤ 15), or `{TICKER}` when it already ends in CAT | shown as a suggestion only |

**Rules for these texts.**
- Only 5 tickers become clickable cashtags on X: PEWTER, PINROW, COBBLE, TOUSLE and HUBBUB. The rest stay plain text (VERIFIED in twitter-text; INFERRED on x.com).
- "Catcoin Sanctuary" must be masked before the pair-term check, because "catcoin" contains COIN (VERIFIED).
- The site is titled "Cat Sanctuary" today (`site/index.html`), so the brand name is decision **D12**.

### 3.4 The metadata JSON (permanent), its hosting, and how the URI and website are set

The shape mirrors StonkFun's own JSON (VERIFIED, RS §2 item 4), without `twitter` (decision **D4**). The **website is baked into this JSON and into nothing else**: the LaunchLab instruction carries only name, symbol and URI.

```json
{
  "name": "Patchpaw the Calico",
  "symbol": "PATCHPAW",
  "description": "<story> <disclosure>",
  "image": "https://arweave.net/<imageTxId>",
  "external_url": "https://catcoinsanctuary.com/cat/patchpaw",
  "extensions": { "website": "https://catcoinsanctuary.com/cat/patchpaw" },
  "properties": {
    "category": "image",
    "files": [
      { "uri": "https://arweave.net/<imageTxId>",  "type": "image/png" },
      { "uri": "https://arweave.net/<bannerTxId>", "type": "image/png" }
    ],
    "links": { "website": "https://catcoinsanctuary.com/cat/patchpaw" }
  }
}
```

**Hosting.** The default recommended here is **ArDrive Turbo** (Arweave), under decision **D3**:
- Every JSON of 107,520 bytes or less is free. The images and banners come to about $18 in total (VERIFIED prices, RR §7.2).
- **Irys** is StonkFun's choice and costs about 0.005 SOL, but its IDs do not resolve on `arweave.net` (VERIFIED, `A/registry/arweave/irys-vs-arweave-check.txt`).
- Use **one canonical gateway string**, `https://arweave.net/<43-char id>`, and never vary it, because the registry compares strings.
- StonkFun renders non-Irys images through its `wsrv.nl` proxy (VERIFIED, `A/image-host-handling-excerpt.js.txt`).
- GitHub Pages is refused as a host: the owner could change files there after a sale.

**Upload order** (the owner does this, with a **dedicated upload wallet**, never in CI; INFERRED):
1. Upload the image PNG and the banner PNG.
2. Write the JSON with their URIs.
3. Upload the JSON.
4. Fetch all three back through `arweave.net` and one other gateway, and compare the sha256 of each.
5. Record them in `data/kits.json` together with `data/kits.lock.json`.

**URI.** `metadataUri` is `https://arweave.net/<id>`, 63 bytes, well under the 200-byte cap. It is copied **byte for byte** into ix2's `uri`. The page never builds it.

**Freeze.** Once a kit's JSON is uploaded and its cat opens, the kit is frozen:
- `data/kits.lock.json` holds the sha256 of each kit entry.
- A test fails if an entry changes while it is locked.
- The Action refuses to run if a locked kit changed.

**The website page must exist first.** `https://catcoinsanctuary.com/cat/<ticker>` must be live at exactly that URL, answering 200 with no redirect, before the cat opens. The URL is permanent in the metadata. GitHub Pages serves `cat/<ticker>.html` there (N7).

### 3.5 The `data/kits.json` schema

```json
{ "version": 1,
  "kits": { "PATCHPAW": {
      "name": "Patchpaw the Calico", "symbol": "PATCHPAW",
      "quoteMint": "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", "quoteSymbol": "SPYx",
      "quoteTokenProgram": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      "metadataUri": "https://arweave.net/<id>", "imageUri": "https://arweave.net/<id>", "bannerUri": "https://arweave.net/<id>",
      "imageSha256": "<hex>", "metadataSha256": "<hex>",
      "website": "https://catcoinsanctuary.com/cat/patchpaw",
      "text": { "xPostWaiting": "…", "xPostAdoptedTemplate": "…{MINT}…", "xBio": "…", "xDisplayName": "…", "xHandleSuggestion": "…" },
      "assets": { "avatar": "assets/kits/PATCHPAW/avatar-400.jpg", "banner": "assets/kits/PATCHPAW/banner-1500x500.jpg", "og": "assets/kits/PATCHPAW/og-1200x630.jpg" },
      "checks": { "contentRules": "pass", "inputSha256": "<hex>", "checkedAt": "…" },
      "opensAt": null } } }
```

---

## 4. Registry and data pipeline

This follows RR, with one improvement: the curve-rule feed (N4).

### 4.1 Sources

| Source | Use | Trust |
|---|---|---|
| Solana, through the Action (public RPC or the `SOLANA_RPC_URL` secret) | the authority for every accepted adoption | authority |
| **Curve-rule feed**: `getSignaturesForAddress(rule(stock))` | every launch on that stock, with slot, `transactionIndex` and err (N4). Each entry *is* a creation transaction, so there is no pool-history paging. | discovery and ordering; confirmed by clauses |
| Epoch sweep: `getProgramAccounts(LaunchLab, dataSize 429, memcmp 173 = platform, memcmp 8 = epoch E or E−1)` | a safety net if StonkFun rotates a stock's config (a new rule address) or the feed misses a pool. About 1.1 MB and 140 ms per call (VERIFIED, RR §2.2.2). | completeness |
| Sliced `getMultipleAccounts(mints, dataSlice {302, 200})` | the name, symbol and URI of 100 mints in 253 ms (VERIFIED, RR §2.2.3) | kit match |
| StonkFun `/launches?since=`, `/tokens/{mint}` | the `stonkfunRecorded` status, and fast hints | status only; never used for ordering (its lag is 1–155 s, VERIFIED) |

### 4.2 The rule: pool P adopts cat C when every clause holds (RR §3.1)

1. P is owned by LaunchLab, its size is 429 bytes, and `P.platform_config = 4E876…gZL7` (standard, not reward).
2. `P.quote_mint = C.quoteMint`.
3. P's mint TokenMetadata has **name, symbol and uri byte-equal to C's kit**. The URI is the fingerprint.
4. The mint's `update_authority = WLHv2…VVh`, its extensions are exactly [MetadataPointer, TokenMetadata] (no TransferFee), its mint and freeze authorities are None, `base_decimals` is 6, `migrate_type` is 1 and supply is 1e15.
5. `P.global_config` is a LaunchLab GlobalConfig whose quote mint is C's stock.
6. The creation transaction (the curve-rule feed entry whose LaunchLab `initialize` creates P) is `finalized` with `err: null`. Read it with `getTransaction(maxSupportedTransactionVersion: 1)`, because v1 transactions exist (VERIFIED).
7. **`P.creator` equals that transaction's fee payer.** This is required because LaunchLab does not make the creator sign (VERIFIED, simulation D). Without it, anyone could tag a wallet as the adopter.
8. P is the first pool meeting 1–7 for C in `(slot, transactionIndex)` order that the limits in section 4.4 accept.

**The adopter is `P.creator`.** That is also the wallet StonkFun forwards the creator share to (VERIFIED quote, RS §4.1).

**Lookalikes** are pools on the same stock with the same name or symbol but a different URI. They are recorded as `lookalikes`, shown as a warning, and never counted.

### 4.3 First wins, and the states

- **Order** by the creation transaction's `(slot, transactionIndex)` at `finalized`. Never by StonkFun's `createdAt`, which can reverse the chain order (VERIFIED, RR §4.4).
- **A winner is written `adopted` only after a later run.** The next run's feed read (snapshot slot > winner slot) must show no earlier valid pool. After that the entry is **never changed automatically**. An earlier pool found later stops the builder, and the owner fixes it by a public commit (RR §4.3).
- **States:**

| State | Where it lives |
|---|---|
| `open` | `adoptions.json` |
| `adopted` | `adoptions.json` |
| `later` | `adoptions.json`: valid, but after the winner. No buy links. |
| `over_limit` | `adoptions.json`: refused by the limits. The cat stays open. |
| `too_early` | `adoptions.json`: before `opensAt` |
| `paused` | `adoptions.json`: the daily simulation failed |
| `lookalikes` | `adoptions.json` |
| `moving_in` | **client only**, never in the file |

### 4.4 Limits against squatting (owner decision D1)

- **Squatting all 91 cats costs about 0.77 SOL** (VERIFIED from the per-launch cost), and squatters gain creator-fee forwarding.
- **Configurable in `data/adoption-rules.json`:**
  - `perWalletPer24h: 1`, applied in global chain order. The recommended default.
  - `opensAt` for each kit: a drip release.
  - `withheld: [{mint, reason}]`, edited by hand and shown publicly.
  - `maxCreatorBuyPctOfSell: null`: an optional cap on a dev buy bundled into the creation transaction.
- **These limits are weak against sybils.** The Adopt page says so plainly.
- **What a static site cannot do:** prove that a launch came through our page, reserve a cat, or limit a person rather than a wallet (INFERRED, RR §6).

### 4.5 The builder and its schedule

**New workflow `.github/workflows/adoptions.yml`:**
- `schedule: cron "3-58/5 * * * *"` plus `workflow_dispatch`.
- `concurrency: data-writers`, the same group Collection must join, so the two never race to push `data/*.json`.
- Permissions `contents: write`. The actions are pinned to SHAs, like the existing workflows.
- After a data commit, Pages deploys through `pages.yml`'s `workflow_run.workflows: [Collection, Adoptions]`. A push made with the workflow token starts no other workflow (VERIFIED, `site/.github/workflows/pages.yml` header).

**Limits of scheduled runs** (VERIFIED from GitHub's docs, RR §5.3):
- the shortest interval is 5 minutes;
- runs can be delayed or dropped;
- schedules are **disabled after 60 days** with no repository activity.

The builder therefore commits `data/adoptions-state.json` (`lastRunAt`) at least weekly as a heartbeat. INFERRED that a bot commit counts as activity; check this in Stage 6.

**`scripts/build-adoptions.mjs` steps** (budget of about 15–40 RPC calls, about 20 s):
1. `getSlot(finalized)`.
2. For each **open** cat's stock, and each rule address ever seen for it (kept in the state file): `getSignaturesForAddress(rule, {until: lastSeenSig, commitment: finalized})`. That is at most 91 calls at 2 per second, about 45 s. INFERRED: acceptable; lower it to the few stocks with activity by reading `/launches?since=` first.
3. Hourly: the epoch sweep (two calls). Daily: re-read `pricing.curveRule.standard` for every stock to catch rotated configs.
4. For new, successful feed entries: `getTransaction(v1)`, then take the pool and mint from the LaunchLab instruction (top level or inner), plus the fee payer.
5. Sliced `getMultipleAccounts` of the mints: keep exact kit matches and record lookalikes.
6. For matches: a full `getMultipleAccounts([mint, pool, global_config])` for clauses 1–5.
7. Apply the ordering, the limits and the two-run confirmation. Write `data/adoptions.json` atomically, never dropping an `adopted` cat. Commit only if something changed.
8. **Daily simulation guard.** For every open cat, run `scripts/simulate-adopt.mjs` logic: the exact page build, with the owner's **public** address as the payer, `sigVerify:false` and `replaceRecentBlockhash:true`. On failure, set `paused: true` with the clause, so the page disables Adopt before any user is asked to sign.

**What it reuses.** It reuses the site's `scripts/lib/rpc.mjs` pattern. It **does not reuse** `proveLaunch` (`site/scripts/lib/chain.mjs`), which refuses v1 and CPI launches and unlisted wallets (VERIFIED, RR §3.4). The new state-based checker is `scripts/lib/adopt-chain.mjs`.

### 4.6 Files

- **`data/kits.json`:** section 3.5; frozen and locked.
- **`data/adoption-rules.json`:** section 4.4.
- **`data/adoptions.json`** (validated like `collection.json`: base58 lengths, https-only, no HTML, lists capped at 20):

```json
{ "version": 1, "generatedAt": "…Z", "snapshotSlot": 450437442,
  "cats": { "PATCHPAW": { "status": "adopted", "mint": "…", "pool": "…", "creator": "…", "tx": "…",
      "slot": 450416570, "txIndex": 721, "time": "…Z", "stonkfunRecorded": true, "paused": false,
      "later": [], "overLimit": [], "lookalikes": [] } },
  "withheld": [] }
```

- **`data/adoptions-state.json`:** `{lastSeenSigByRule, rulesByQuote, lastSweepSlot, lastRunAt, refused[100]}`. Excluded from the deploy, as `collection-state.json` is today.

### 4.7 Live checks in the page (the gap before the registry commits)

- **Race check** (before signing, and again at `finalized`):
  - `adoptions.json`, fetched with `cache:"no-cache"`. The CDN copy can be up to 10 min old (VERIFIED, RR §5.5).
  - Then publicnode `getSignaturesForAddress(rule(C.stock), {limit: 25})`. For entries newer than `snapshotSlot` with no error, `getTransaction`, then read the mint's metadata slice and compare it with the kit.
  - That is about 1 + k calls, where k is small: SPYx, which has the most pools of the stocks sampled (785, RR §2.2.2), had about 1.5 launches an hour (VERIFIED, N4).
- **Everyone else:** the garden makes **no** third-party call on load. Only opening a card whose cat is `open` runs the race check, so visitors see "Moving in…" when it applies.
- **Own launch:** `getSignatureStatuses`, then clauses 1–4 and 7 on `getMultipleAccounts([pool, mint])`.

### 4.8 How the 3D world reads it

- **`assets/residents.js`** also fetches `data/kits.json`, `data/adoptions.json` and `data/adoption-rules.json` (relative URLs), and validates them in the new pure module `assets/adoptions.js`. It gives each planned cat one of these statuses: `adopted | open | not_open | paused | no_kit`. For `adopted`, it adds `token: {status:"adopted", mint, pool, tx, adopter, adoptedAt, stonkfunRecorded}`, `buy: buyLinks(mint)` and `explorer`.
- **Precedence.** A frozen kit's resident is decided **only** by `adoptions.json`. A Collection launch by a listed wallet that matches pair and ticker but not the kit URI shows as a token of its own. Cats without a kit keep today's Collection rule. INFERRED design; the owner can fold Collection in later.
- **`assets/world/cats.js` and `catviews.js`.** Adopted cats get the existing gold coin, and the hover tag becomes "Adopted by `3J57…iji3`". Open cats get the tag "Up for adoption". A client-side `moving_in` overlay adds a soft sparkle and the tag "Moving in…".

---

## 5. Files, libraries and size budget

### 5.1 New modules in the page

All are plain ES modules with no build step, **loaded only when Adopt is opened**, through a relative `import()`.

| Path (under `site/`) | What | Source |
|---|---|---|
| `assets/adopt/constants.js` | program ids, PDAs' seeds, `STONKFUN_SHAPE`, discriminator, caps (250k CU, 20k µL, 15M lamports) | port of `cia/bots/lib/verified.mjs` and `stonkfun.mjs` |
| `assets/adopt/bytes.js` | base58, compact-u16, borsh writer and bounded reader | port of `cia/bots/lib/solana.mjs` |
| `assets/adopt/ed25519.js` | keygen, sign, verify, on-curve check and sha256 over the vendored noble | new, thin |
| `assets/adopt/solana.js` | PDA find, legacy message compile, serialize and parse, signature slots, ComputeBudget instructions | new; checked against web3.js in tests |
| `assets/adopt/launchlab.js` | `initializeAccounts`, `encodeInitialize`, `decodeInitialize`, and decoders for PlatformConfig, GlobalConfig, CurveRule, PoolState and the TokenMetadata slice | port of `cia/bots/cashcat/stonkfun.mjs` |
| `assets/adopt/plan.js` | checks 1–4 for one kit | port of `planStonkfunLaunch` (without its `src/lib/config.mjs` import; RL §9) |
| `assets/adopt/txcheck.js` | `readMessage`, `checkLaunchMessage`, `checkSimulation`, `sameMessage` | port of `cia/bots/lib/txcheck.mjs` (StonkFun part only) and `cia/src/lib/tx.mjs` |
| `assets/adopt/net.js` | **the only file naming external hosts**: `https://www.stonkfun.xyz/api/public/v1` (never the apex, which answers 308 with no CORS, VERIFIED) and the RPC list (publicnode, plus an optional owner RPC); timeouts, JSON shape checks, 429 back-off | new |
| `assets/adopt/wallets.js` | discovery (vendored `@wallet-standard/app`), feature and chain checks, connect, Path S and Path P | new |
| `assets/adopt/race.js` | section 4.7 | new |
| `assets/adopt/flow.js` | the pure state machine for sections 2.1–2.2, with RPC, API and wallet injected, so it can be tested with doubles | new |
| `assets/adopt/xkit.js` | X intent URLs (fills `{MINT}` only after base58 validation), profile kit text | new |
| `assets/ui/adopt.js` | the dialog DOM, `textContent` only | new |
| `assets/adoptions.js` | pure validators and the status merge for `kits.json`, `adoptions.json` and `adoption-rules.json`, shared by the page and Node, as `collection.js` is today | new |

### 5.2 Changes to existing files

- **`index.html`:**
  - CSP `connect-src 'self' https://www.stonkfun.xyz https://solana-rpc.publicnode.com` (plus the D11 host);
  - `<dialog id="adopt">`;
  - the legend badges;
  - footer copy: the paragraph "A cat is not launched yet until the sanctuary's keeper launches it…" must change;
  - a privacy line: "Adopting calls StonkFun's public API and a public Solana RPC from your browser."
  - The inline import map (`three`) is unchanged, so the CSP script hash stays.
- **`assets/residents.js`, `assets/ui/card.js`, `assets/ui/main.js`:** the `#adopt=<T>` route and the lazy import. Also `assets/world/cats.js`, `assets/world/catviews.js` and `assets/site.css`.
- **`tests/page.test.mjs`:**
  - Replace "`connect-src` allows no other host" with an **exact allow-list** test.
  - "Only `assets/adopt/net.js` may contain an `https:` fetch target."
  - "residents fetches exactly [collection, planned, wallets, kits, adoptions, adoption-rules]".
  - Keep every HTML-sink rule.
- **`.github/workflows/pages.yml`:**
  - `workflow_run.workflows: [Collection, Adoptions]`;
  - rsync must also exclude `/data/adoptions-state.json` and `/kits-src`;
  - the deploy asserts that `data/kits.json`, `data/adoptions.json` and one `cat/*.html` exist.
- **`.github/workflows/collection.yml`:** join `concurrency: data-writers`.
- **`README.md`:** the new "How adoption works", the rules, the hosts called, and the upload procedure.

### 5.3 New static pages and assets

- **`cat/<ticker>.html`**, 91 pages written by `scripts/build-cat-pages.mjs`. Each has:
  - per-cat `<title>`, `og:*` and `twitter:*` tags using `assets/kits/<T>/og-1200x630.jpg`;
  - the story, the kit and the disclaimer;
  - "Open in the garden" (`/#cat=<T>`) and "Adopt" (`/#adopt=<T>`);
  - a tiny module that reads `data/adoptions.json` to show the resident mint prominently, to counter lookalikes.
  - **These pages are permanent.** A test asserts that every `kits.json` website maps to an existing file.
- **`assets/kits/<T>/{avatar-400.jpg, banner-1500x500.jpg, og-1200x630.jpg}`**: 91 × about 0.35 MB.

### 5.4 Node scripts

Never shipped: `scripts/` is excluded from the deploy.

- **`scripts/build-kits.mjs`:** validates the kit sources in `kits-src/<T>/` (limits, sha256 and templates), writes the draft JSONs, and imports the check results produced by `…/adopt/tools/kits/text.mjs`, which uses CIA's `content-rules.mjs`.
- **`scripts/upload-kits.mjs`:** run **by the owner locally** with `@ardrive/turbo-sdk` (version pinned when chosen). The key file is a dedicated upload wallet **outside the repository**. The script refuses to run in CI (`process.env.CI`). It writes `data/kits.json` and `data/kits.lock.json`.
- **`scripts/build-cat-pages.mjs`**, **`scripts/build-adoptions.mjs`** with **`scripts/lib/adopt-chain.mjs`**, and **`scripts/simulate-adopt.mjs`**. The last one is read-only and refuses any method outside the reads and `simulateTransaction` with `sigVerify:false`, as `…/adopt/tools/rpc.mjs` does.

### 5.5 Third-party libraries (pinned, self-hosted like three.js)

| Library | Version | Licence | How it is shipped |
|---|---|---|---|
| `@noble/curves` (ed25519) + `@noble/hashes` (sha256, sha512) | **1.9.7 / 1.8.0**, the versions already in CIA's lockfile (VERIFIED). Latest is 2.4.0 (`S/npm-latest.txt`); stay on 1.x for parity with the tested code. | MIT | One ESM file, `assets/vendor/noble/noble-ed25519-sha2.min.js`, built once by esbuild 0.25.9 (CIA's version). `PROVENANCE.md` records the command and the sha256; a test checks the sha256. |
| `@wallet-standard/app` | **1.1.1** | Apache-2.0 | `assets/vendor/wallet-standard/app-1.1.1.js` copied as is (6,372 B, no imports; sha256 `36155c77…ed97`, VERIFIED) plus LICENSE |
| `@solana/web3.js` | 1.98.4 | MIT | **devDependency for tests only.** It proves our lean compiler's bytes round-trip, and matches CIA. Not shipped. |

**Why not ship web3.js?** RL measured a 336–432 KB minified browser bundle. The page needs only ed25519, sha256, PDAs and a legacy message, which is about 10× smaller. INFERRED.

### 5.6 Size budget

| Part | Budget | Loaded |
|---|---|---|
| Garden page JS and CSS | **+≤ 8 KB** (card panel, tags) | always |
| `assets/adopt/*`, `assets/ui/adopt.js` and vendored noble + wallet-standard | **≤ 120 KB** minified-equivalent (noble about 45 KB, INFERRED) | only on Adopt |
| Data files (`kits.json` about 91 × 1.5 KB; `adoptions.json` ≤ 150 KB, lists capped) | ≤ 300 KB | always (small) |
| Kit images on the site | about 32 MB total, about 0.35 MB per cat | on demand |

A test asserts the byte budgets of `assets/adopt/**` and the vendored files.

---

## 6. Safety and honesty

**Non-custodial**
- The sanctuary never holds, asks for or stores a user key, seed phrase or funds.
- The only key the page creates is the mint keypair. It exists in memory for one signature, is wiped, and is never persisted, logged or sent.
- There is no server, no relay and no co-signer.

**One narrow approval**
- One transaction, with exactly the shape in section 1.3.
- No `signMessage`, `signAllTransactions`, token approvals, delegate or transfer instructions.
- The decoded summary and the simulation result are shown **before** the wallet opens.
- The compiled bytes are re-checked after building and again after the wallet signs.

**No fees**
- The adopter pays network costs only (about 0.0087 SOL, exact from the simulation).
- LaunchLab's launch fee is 0 (VERIFIED). There is no dev buy.
- The sanctuary receives nothing, and the page states that.

**No free text**
- The adopter cannot change the name, ticker, image, description or website. Everything comes from the frozen, pre-reviewed kit.
- The only runtime value inserted into text is a base58-validated mint in the X post.

**Content rules**
- Every kit text is checked offline at freeze with CIA's `checkProposal` (people, brands, endorsement, tragedy, minors, sexual, hate, identity, politics, financial promises, links; formats; "must be a cat"). The pair and other-pair terms, `LAUNCH_CLAIMS` and the no-hype list are also checked (VERIFIED passing for the 50 drafted cats, KI).
- Images come from the no-text, no-logo recipe, with a human review.
- A company's mascot is never a coin's picture or name (a site rule today).

**Disclosures, shown on the card, the Adopt dialog, the cat page, the permanent description, the X posts and the bio:**
- not affiliated with the issuer or company (wording is D2) or StonkFun;
- no intrinsic value;
- not financial advice;
- "a cat coin priced in <stock>", not the stock.

**Plain statements on the Adopt dialog:**
- the permanent fields;
- first confirmed launch wins, and anyone, bots included, can launch this kit;
- the limits, and that they are weak against many wallets;
- StonkFun shows no website or X links for coins launched this way;
- the stock token's issuer can freeze or seize tokens in the pool's stock vault, and the logs say so (VERIFIED, RL §7);
- for PreStock cats, the stock charges a transfer fee: 1% now, 3% from epoch 1043 (VERIFIED, RL §7), if D6 opens them;
- the terms and geo notice (D7).

**What we never claim**
- earnings, returns, price, market cap or "guaranteed";
- that creator fees will arrive (if D8 mentions them at all: "StonkFun says it forwards a creator share, paid in the stock token; this is StonkFun's promise, not the sanctuary's");
- "official", "partner", "backed", "LP locked or burned", "fair launch";
- that the coin is or represents the stock;
- that the sanctuary endorses a cat's buyers;
- that "adopted" means ownership of anything but the creator role of that coin.

**No impersonation**
- The X profile kit uses the cat's own name.
- The bio says "adopted at <brand>" and carries the disclaimer.
- The handle is only a suggestion.
- Nothing says "official" or implies the account is run by the sanctuary.
- The kit never uses a real person, company logo or trademark.

**Reputation**
- A comparable third-party StonkFun launcher currently shows a Cloudflare "Suspected Phishing" page (VERIFIED, RS §9). Transparency is the defence: the decoded summary, the public rules and the source on GitHub.
- Before opening, submit the domain to Phantom's domain review (the form is linked in `S/developer-powertools_domain-and-transaction-warnings.md`), because new domains get warnings.

**Privacy**
- Only the Adopt dialog, and a card whose cat is open, call third parties (StonkFun and publicnode). The garden itself stays same-origin.
- `localStorage` holds only `{sig, mint, at}` pending notes.

---

## 7. Test plan

### 7.1 Unit tests with recorded fixtures (`site/tests/adopt-*.test.mjs`, `node --test`, offline)

**Fixtures** in `site/tests/fixtures/adopt/`:
- copied from CIA: `launch-samples.json` (6 real launches), `launchlab-idl-subset.json`, `accounts.json`, `2026-09-25/api-*.json` and `pricing/*`;
- copied from the research: `A/reencode-check.json`, `A/chain-mint-extensions.json`, `A/registry/chain/mints-metadata-slice-100.json`, `A/registry/chain/tx-creation*.json` (v0 and v1), `S/curve-rule-feed-probe.out.json` and `S/publicnode-probe.out.json`;
- **new, recorded in Stage 3:** pricing and pairs for **all 91 stocks**, and each stock's platform, config and rule accounts.

**Tests:**

1. **Encoder:** `encodeInitialize` re-encodes the 6 real launches byte for byte. `decodeInitialize` round-trips.
2. **Accounts:** all 16 re-derive for the 6 samples. Every PDA matches the recorded one.
3. **Plans:** all 91 plan against the recordings. Twenty tampered answers are each refused by name: wrong platform, rule, supply, sell, decimals, vesting, curve, migrate, program, quote, token program, `launchLabEnabled` false, missing pair, symbol-keyed lookup, and so on.
4. **Compiler:**
   - our legacy bytes parse with web3.js `Transaction.from` and re-serialize identically;
   - CIA's `readMessage` and `checkLaunchMessage` accept our bytes;
   - signature slot order is `[A, M]`;
   - size ≤ 1,232 bytes for the longest name, ticker and URI.
5. **`txcheck` refuses:** an extra instruction, a third signer, a lookup table, CU > 1.4M, price > 200k µL, a changed raise, creator ≠ payer, and a transfer-fee tail.
6. **`checkSimulation`:** the recorded success passes; err, a missing log, overspend and a wallet gain each fail.
7. **Wallet doubles** (fake Wallet Standard wallets):
   - returns the same message: sent;
   - adds an instruction: `wallet_changed_tx`, nothing sent;
   - rejects: back to Review;
   - only has `signAndSendTransaction`: Path P;
   - devnet-only account: refused;
   - `signAllTransactions` and `signMessage` are **never called** (a spy asserts this).
8. **Mint key:**
   - the secret is wiped after signing;
   - it never reaches `localStorage`, `console` or `fetch` (spies);
   - a rebuild after expiry reuses M;
   - a chain double shows the second landing fails with "already in use".
9. **Race and registry:**
   - the ordering by `(slot, txIndex)` on recorded feeds;
   - two-run confirmation;
   - over_limit keeps the cat open;
   - later and lookalike classification;
   - creator ≠ payer refused;
   - a v1 creation read;
   - never dropping an `adopted` cat;
   - the builder stops on an earlier pool found late.
10. **Texts:**
    - every kit's X posts are ≤ 280 weighted with a 44-character mint;
    - intent URLs decode back to the template;
    - bios ≤ 160;
    - every `kits.json` text equals its template rendering and has a passing check record with a matching input hash.
11. **Freeze:** changing a locked kit fails; each website maps to `cat/<t>.html`; each URI is ≤ 200 bytes and `https://arweave.net/` + 43 characters.
12. **Page rules:** the exact CSP allow-list; only `net.js` names hosts; no HTML sinks; the budgets; the vendored sha256 values.

### 7.2 Simulations against mainnet (read-only)

- **`node scripts/simulate-adopt.mjs --all --payer 3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3`** builds **exactly the page's transaction** (same modules) for each of the 91 cats with its real kit URI, then simulates it with `sigVerify:false` and `replaceRecentBlockhash:true`.
- **Pass criteria:** `err === null`, the `InitializeWithToken2022` log, CU < 250k, spend ≤ 15,000,000 lamports, size ≤ 1,232 bytes.
- It runs in Stage 3, again right before opening, and daily in the Action (section 4.5 step 8).
- It also runs the page's own RPC path once against publicnode with an `Origin: https://catcoinsanctuary.com` header, as `S/publicnode-probe.mjs` does.

### 7.3 Browser tests

- **Local:** run `python3 -m http.server` with a mocked wallet injected through Wallet Standard `register`. Walk every row of section 2.2 using fetch doubles.
- **Real browser, no wallet:** check that Adopt lazy-loads, the CSP blocks everything else, and the garden page makes zero third-party requests.

### 7.4 Wallet matrix (Stage 4, by the developer or owner, not by research agents)

1. **Devnet two-signer test.** A throwaway page builds `SystemProgram.createAccount(payer → fresh keypair)`, the same two-signer pattern as payer + mint.
   - Run Path S and Path P on: Phantom extension, Phantom mobile in-app browser, Solflare extension and mobile, Backpack extension.
   - Record: the features exposed, whether `signTransaction` returns an identical message, and whether a pre-signed co-signature survives `signAndSendTransaction`.
   - Also record whether `sendTransaction` from the page works through publicnode's devnet endpoint (INFERRED to exist) or the chosen RPC.
2. **Mainnet sign-only dry run.** On the production page behind `#adopt-preview&dry`, with the real transaction for a real cat: the wallet runs `signTransaction`, the page checks `sameMessage`, and then **discards both signatures without adding M's**.
   - Such a transaction can never land, because M's signature is missing, so this carries no risk. INFERRED from how signature checks work.
   - Phantom's warning UI is recorded with a screenshot.
3. **Acceptance:** at least Phantom (extension and mobile) passes Path S with an identical message. Every wallet shown in the list passes one path; the others are hidden.

### 7.5 One real test launch by the owner, before the public opens (Stage 7)

- **Who and where:** the owner, from `3J57…iji3`, on production behind the preview gate. The owner picks one cat whose kit is final (D10). This is a real, permanent adoption.
- **Acceptance checks:**
  1. The transaction confirms.
  2. On-chain, the mint's name, symbol and URI equal the kit, the pool is on `4E876…`, and creator = payer.
  3. `/launches` shows it within about 3 min.
  4. `/tokens/{mint}` answers 200 with `launchpad:"launchlab"` and `mode:"standard"` within about 10 min, and its `imageUrl` is the kit image.
  5. The registry writes `adopted` within about 25 min, the garden shows the coin and tag, and the GMGN and FOMO links open the right mint.
  6. The X intent opens with the right text, and X renders the cat page's card.
  7. `/tokens/{mint}/fees` states forwarding.
- **Failure drills on the same run:** cancel in the wallet, and leave the popup open more than 2 min to test expiry. Also test a wallet with less SOL than needed (a second, empty wallet).

---

## 8. Build plan in stages

| Stage | Work | Acceptance |
|---|---|---|
| **0. Decisions** | The owner answers section 9 (D1–D16). Launch sheet 2 finishes; TTWO SAVEPAW is renamed; D2 disclosure text is fixed. | The decisions are written into `data/adoption-rules.json` and README. 91 names, tickers and stories are final. |
| **1. Kit production** | Write the 67 look sentences and generate the images with a human review. Generate banners, avatars and share cards (`…/adopt/tools/kits/banner.py`). Render the texts (`text.mjs`). Stage everything in `kits-src/<T>/`. | 91 kits; each image is 1024², ≤ 2 MB, with no text or logos (reviewed); every text passes checks; no ticker or name collisions; `build-kits.mjs` reports 0 errors. |
| **2. Cat pages** | `scripts/build-cat-pages.mjs` writes the 91 `cat/<t>.html` and `assets/kits/*`. Deploy. | For all 91: `curl -sI https://catcoinsanctuary.com/cat/<t>` answers **200 with no redirect**, and the og tags point to an existing image. The X card validator (or a real post preview) shows the cat. |
| **3. Library and simulation** | Port `assets/adopt/*`, vendor the libraries, write tests 7.1, and record fixtures for the 91 stocks. | `npm test` is green. `simulate-adopt.mjs --all` passes for 91 of 91 (with placeholder URIs of the final length). Adopt JS ≤ 120 KB. |
| **4. Wallet matrix** | Section 7.4, steps 1–2. | Phantom (extension and mobile) Path S has an identical message; the results table is committed to `docs/` (or the README); the send path is chosen (publicnode or D11). |
| **5. Upload and freeze** | The owner uploads with a dedicated upload wallet (section 3.4), then `data/kits.json` and `kits.lock.json` are written. | Every URI resolves through two gateways and its sha256 matches; `simulate-adopt.mjs --all` passes with the **real** URIs; the lock test is green. |
| **6. Registry in shadow** | `build-adoptions.mjs` and `adoptions.yml` run with every cat `opensAt` in the future. A fixture kit table points at known real launches (for example NONSOL's URI) to prove detection. | Detection, ordering and two-run confirmation are proven on fixtures and a dry run; a run takes < 60 s; the Pages deploy chain works; the heartbeat commit exists. |
| **7. Owner's test launch** | UI behind `#adopt-preview`; section 7.5. | Every check in section 7.5 passes, and a short post-mortem is written. |
| **8. Opening** | Set `opensAt` (everything at once, or drip, per D1). Remove the preview gate. Watch the Action, StonkFun recording and phishing flags for the first week. | The first public adoptions show up in the registry; the daily simulation guard is green; no Phantom or Cloudflare flag. |

---

## 9. Decisions only the owner can make

| # | Decision | Options | Recommended (INFERRED) |
|---|---|---|---|
| D1 | **Squatting.** Kits are public, so bots can launch a cat first and become its adopter (about 0.77 SOL for all 91). | (a) accept, no limits; (b) one accepted adoption per wallet per 24 h; (c) also drip release (`opensAt`); (d) also a public `withheld` list; (e) a dev-buy cap | (b) + (c), for example 3–5 cats a day; keep (d) available and empty; state plainly that it is weak against many wallets |
| D2 | **Disclosure wording**, which is permanent on chain | the sheet's text naming the issuer or company ("Not affiliated with State Street or StonkFun…"), or CIA's `pairDisclosure`, which names only the symbol | Decide once, before Stage 1. CIA's content rules flag company names in coin text; the sheet's version is clearer for readers. |
| D3 | **Metadata hosting** | ArDrive Turbo (Arweave, about $18, JSONs free, `arweave.net`) or Irys (about 0.005 SOL, StonkFun's host, not on `arweave.net`) | Turbo, with the canonical `https://arweave.net/<id>` |
| D4 | **The `twitter` field in the metadata** | none, or a sanctuary X account (none exists in the site code) | none. The adopter's handle is unknown in advance, and the field is permanent. |
| D5 | **No links on StonkFun's token page** for coins launched this way (VERIFIED 4 of 4) | accept; ask StonkFun to add them (an admin-only route exists); or Plan B | accept, and say so in the dialog |
| D6 | **Which stocks open** | all 91; or xStocks first; or no PreStocks (1% → 3% transfer fee, issuer seize and freeze powers) | xStocks first; Backpack after; PreStocks only with an explicit fee notice |
| D7 | **StonkFun's terms and geo gate** (20 blocked jurisdictions plus 4 regions), which our page otherwise bypasses | a self-attestation checkbox plus the list; or nothing | the checkbox and list, and a link to stonkfun.xyz |
| D8 | **Creator-fee mention** (StonkFun's off-chain promise, paid in the stock, seen once for a self-built launch) | say nothing; or a factual note with no numbers | a factual note with no numbers |
| D9 | **Dev buy** | never, or optional | never (decision 3: free, no extra transaction) |
| D10 | **Owner's test launch:** which cat and which wallet | any final cat, from `3J57…iji3` | a sheet-1 xStock cat whose kit is checked twice |
| D11 | **Send RPC** | publicnode only; plus a domain-restricted keyed RPC (the owner signs up; the key is visible in the page but locked to our origin); plus the `SOLANA_RPC_URL` secret for the Action | publicnode plus a domain-locked key as a second sender; add the Action secret |
| D12 | **Brand name** in the texts ("Catcoin Sanctuary" in kits and posts, "Cat Sanctuary" as the site title) | pick one | pick before Stage 1. The banner already says "catcoinsanctuary.com". |
| D13 | **Rights to the kit art for adopters** (avatar, header, token image) | all rights reserved with a use licence for the coin's accounts; or CC BY 4.0; or CC0 | a written licence line on the Adopt dialog and the cat page |
| D14 | **Website URL form**, permanent | `https://catcoinsanctuary.com/cat/<ticker>` (recommended, per-cat share card) or the existing `/#cat=<TICKER>` | `/cat/<ticker>`, never renamed |
| D15 | **StonkFun-form launches of our kit** (Plan B image-hash rule) | not counted in v1; or counted after a test shows StonkFun keeps the image bytes | not in v1 |
| D16 | **When a cat counts as adopted** | chain-only, with StonkFun as a status; or wait for StonkFun to record it | chain-only, with StonkFun shown as a status |

Also for the owner:
- the CARTONPAW / TARTANPAW near-collision (flag only);
- who writes the 67 look sentences and reviews the images;
- a budget of about 17 Higgsfield credits (INFERRED price).

---

## Appendix: evidence added in this pass (`S/` = `A/spec/`)

| File | What |
|---|---|
| `quote-token-programs-91.json` | the 91 cats joined to StonkFun's `/pairs`: 0 classic-SPL quotes, 0 missing, 0 not ready (N1) |
| `publicnode-probe.mjs`, `.out.json` | browser-Origin reads and a simulation through publicnode (N3) |
| `curve-rule-feed-probe.mjs`, `.out.json` | the launch-only feed on SPYx's curve rule; publicnode `getSignaturesForAddress` and `getTransaction` (N4) |
| `developer-powertools_domain-and-transaction-warnings.md`, `phantom-browser-sdk-sign-and-send.md`, `solana_sending-a-transaction.md`, `developer-powertools_wallet-standard.md`, `phantom-llms.txt` | Phantom's docs on the multi-signer order, pre-signed transactions, the simulation warning and the domain review form (N5) |
| `wsf-1.5.0-signTransaction.d.ts`, `wsf-1.5.0-signAndSendTransaction.d.ts`, `wsapp-1.1.1-wallets.js`, `npm-latest.txt` | the Wallet Standard API and the pinned module (N6) |
| `gh-pages-extensionless.txt` | GitHub Pages serving `/index` without a redirect on our domain (N7) |
| `stonkfun-routes.txt` | StonkFun's page routes: no terms page; `/restricted` (N8) |
