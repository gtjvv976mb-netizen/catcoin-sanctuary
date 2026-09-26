# Adopt a cat: implementable spec for catcoinsanctuary.com

Written 2026-09-25, about 19:00–19:30 UTC, by the architect pass. **Revised about 19:45–20:30 UTC** against a 29-finding critique from three reviews (safety, feasibility, honesty). Each finding was checked against its evidence. All 29 held in substance, and in 8 of them this revision uses a different fix than the one proposed, with the reason. **Appendix B (Critique log)** gives each verdict, the evidence re-checked and the sections changed. Section 0.3 maps findings to sections. The pre-revision text is kept at `V/SPEC.before-revision-1916Z.md`.

**Nothing was signed, sent or broadcast.** The architect pass made one transaction call: a `simulateTransaction` with `sigVerify:false` and `replaceRecentBlockhash:true`, re-run on a transaction the StonkFun research had already built. The revision pass made **no network calls**. It re-read saved evidence and ran local checks with CIA's content rules (`V/`). No key or seed phrase was asked for or handled. `/home/user/cat-sanctuary` and `/home/user/Cat-Intelligence-Agency` were only read.

**Labels.** Every claim carries one of these:

- **VERIFIED**: seen in code, data, a live answer or on chain, with the evidence path given.
- **INFERRED**: reasoning, a design choice, or a claim that has not been checked.

**Path shorthands**

| Short | Full path |
|---|---|
| `A/` | `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/` |
| `S/` | `A/spec/`: evidence from the architect pass |
| `R/` | `A/review/`: evidence from the feasibility review (19:20–19:40 UTC) |
| `RSF/` | `A/review-safety/`: evidence from the safety review |
| `RH/` | `A/review-honesty/`: evidence from the honesty review |
| `V/` | `A/revise/`: evidence from this revision (local checks only) |
| `RS` | `…/scratchpad/adopt/research-stonkfun.md` |
| `RL` | `…/scratchpad/adopt/research-launcher.md` |
| `RR` | `…/scratchpad/adopt/research-registry.md` |
| `KI` | `…/scratchpad/adopt/kits-inventory.json` (plus `A/kits/tables.md`, `descriptions.md`, `sample.md`) |
| `site/` | `/home/user/cat-sanctuary/`, as read at about 19:00–19:50 UTC |
| `cia/` | `/home/user/Cat-Intelligence-Agency/` at `5f573e5` |

The site is being rebuilt by another workflow right now. File paths in section 5 refer to the tree as it was at 19:00–19:50 UTC, so the implementer should re-map them onto the rebuilt tree.

---

## 0. Summary

### 0.1 The design in one screen

1. **The owner must first decide whether to offer adoption at all (D0, a blocker).**
   - StonkFun's Terms (version 2026-09-18) define a "Restricted User" as anyone "a citizen or resident of, located in, or accessing or using the Services from the United States, Canada, or the United Kingdom", or tied to a sanctioned jurisdiction. They also require users to be at least 18. VERIFIED: `RH/stonkfun-terms-excerpts.txt`, `RH/live-0s2-lymzpm5aj.js` (US, CA and GB are listed as restricted but not IP-blocked).
   - A static page cannot geo-block. It can only ask for an honest statement.
   - Those terms exclude a large part of an English-language X audience (INFERRED).
2. **The launch happens on our site.** The adopter's own wallet signs and pays, with one approval and no backend.
   - The page builds StonkFun's documented "build it yourself" LaunchLab launch, `initialize_with_token_2022` on StonkFun's standard platform, from the cat's kit. It is priced in the cat's stock.
   - StonkFun recorded 72 of 72 recent launches on 8 sampled stocks. 36 of them were built outside its form, and those reached `/tokens` after 2–12 minutes (VERIFIED: `R/feed-recorded.out.json`, `V/recompute.out.txt`).
3. **One wallet question is still open, and it gates the build (Stage 4).**
   - The mint key must co-sign after the wallet, so the page needs a **sign-only** wallet call.
   - Phantom's docs say its sign-only methods live only on `window.phantom.solana`, are not in its Wallet Standard implementation, and "may be removed". VERIFIED (docs): `S/solana_sending-a-transaction.md` lines 73–79.
   - The spec therefore adds **Path S′**, which signs through Phantom's own provider, as CIA's Phantom bridge already does. "Phantom can adopt" becomes an explicit go/no-go gate.
4. **The sanctuary never holds anything.** There are no keys, no fees and no server. The one secret in the page is the **mint keypair** for one adoption attempt. It stays in memory until the attempt resolves and is then dropped. It is not the user's key.
5. **The kit is fixed ahead of time, but its fingerprint stays secret until the cat opens.**
   - The kit holds the name, ticker, description, image, banner, avatar, share card and X texts. Its website is the cat's own page.
   - The image and banner are uploaded early. The metadata JSON's URI is the on-chain fingerprint. Before a cat opens, the repository holds only its **sha256**; the URI is published in the same commit that opens the cat (commit and reveal). So nobody can mint an exact copy early.
   - **8 of the 24 finished xStock kits are held** by the site because their portraits copy a company's own cat. They are not adoptable until redrawn. VERIFIED: `site/data/held.json` (copy `V/site-held.json.copy-1950Z`).
6. **The chain decides who adopted a cat.**
   - A launch counts only if it matches the kit exactly: the platform, the stock, and the name, ticker and metadata URI.
   - The creator must be the fee payer.
   - The creation transaction must do **nothing but create the coin**: no bundled buy.
   - The earliest `(slot, transactionIndex)` at `finalized` wins.
   - A GitHub Action finds new pools with a program-account sweep, which spam cannot inflate. It commits `data/adoptions.json` on change and at least hourly.
   - The page covers the gap live and **fails closed**: if it cannot confirm that a cat is still free, Adopt stays disabled.
7. **What this cannot fix.** Once a cat opens, anyone can launch it first, bots included, and the first confirmed launch wins. A human who loses the race is left with a permanent duplicate coin and about 0.0087 SOL spent. Only the owner can decide how much of this to accept (D1).

### 0.2 Evidence notes N1–N8, as revised

| # | Finding | Label | Evidence |
|---|---|---|---|
| N1 | **None of the 91 cats' stocks uses the classic SPL token program.** All 91 are Token-2022, and `/pairs` lists all 91 as launchable and LaunchLab-ready. **But `/launchlab/pricing` answered 503** `service_unavailable` ("retryAfterSeconds":30) for **PENG, AMBA and ARM** (not-yet-picked Backpack cats) on every retry from 19:22 to 19:33 UTC. The other 88 simulated cleanly with the exact recipe in section 1.3. So a stock is "ready" only when `/pairs` lists it **and** pricing answers 200. RS §3.2 said 15 of "our" Backpack cats were classic SPL, but those 16 Backpack pairs are crypto (DOGE, LINK, PEPE, …), which the site's collection code excludes on purpose. The builder still takes the quote token program from the pair, as a precaution. | VERIFIED | `S/quote-token-programs-91.json`, `R/verify-91.out.json`, `R/pricing-retry-*.json`, `R/pricing-503-control.txt`, `R/pairs-ready-now.json` |
| N2 | **The public mainnet RPC cannot be used from the page.** Its preflight answers with an ACAO header, but the POST itself answers **403** to any browser Origin. | VERIFIED | `A/registry/chain/rpc-origin-check.txt`, `A/registry/chain/browser-rpc-origin-matrix.txt` |
| N3 | **`solana-rpc.publicnode.com` serves every read the page needs from our Origin** (ACAO `*`): `getLatestBlockhash`, `getMultipleAccounts`, `getBalance`, `simulateTransaction`, `getSignaturesForAddress` (including `transactionIndex`), `getTransaction` and `getSignatureStatuses`. It refuses `getProgramAccounts`. **Its default commitment is `finalized`** (getSlot default 450446038 vs confirmed 450446069), so the page always passes `commitment` explicitly. `sendTransaction` was **not** tested, because that would be a send. | VERIFIED (except send) | `S/publicnode-probe.out.json`, `S/curve-rule-feed-probe.out.json`, `RSF/publicnode-default-commitment.txt`, `R/feed-recorded.out.json` (`pnTxIndex`) |
| N4 | **Each stock's curve-rule address gives a launch feed, but not a launch-only one** (relabelled). For SPYx, 25 of 25 recent signatures were launches, in an unattacked sample. But `getSignaturesForAddress` returns every transaction "that reference[s] the supplied address in accountKeys". A 1-lamport credit to the rule, or a read-only mention of it, simulates with `err: null` at 150 CU, so **anyone can add entries for a 5,000-lamport fee**. The feed is therefore only a **hint for the page**, with paging and fail-closed caps (section 4.7). The registry does not depend on it (section 4.5). | VERIFIED | `S/curve-rule-feed-probe.out.json`, `RSF/feed-injection-sim.out.json`, `RSF/solana-docs-getsignaturesforaddress.html` |
| N5 | **Phantom's docs conflict on sign-only signing** (relabelled). One page says: "If the transaction requires multiple signers, sign it with Phantom first using signTransaction … then collect signatures from the other signers". Another says the sign-only methods "are not supported in the wallet standard implementation and may be removed in a future release. These methods are only available via the window.solana object". A third says transactions submitted through Phantom "may be augmented with Lighthouse assertion instructions". Phantom's embedded (social-login) wallets refuse pre-signed transactions. **What Phantom actually exposes today is unknown until Stage 4.** | VERIFIED (docs only) | `S/developer-powertools_domain-and-transaction-warnings.md` lines 105–112, `S/solana_sending-a-transaction.md` lines 73–110, `RSF/phantom-lighthouse.md`, `S/phantom-browser-sdk-sign-and-send.md` lines 42–52 |
| N6 | **The Wallet Standard defines both features** (relabelled). `solana:signTransaction` takes a `Uint8Array` transaction and returns `signedTransaction`. `solana:signAndSendTransaction` returns `signature`. Both support `'legacy' \| 0 \| 1`. This is a fact about the standard's type definitions, **not** about any wallet: nobody has yet dumped a real wallet's `features`. The discovery module `@wallet-standard/app` 1.1.1 is a 6,372-byte ES module with no imports, and its tarball matches the registry integrity. | VERIFIED (standard only) | `S/wsf-1.5.0-*.d.ts`, `S/wsapp-1.1.1-wallets.js`, `RSF/wsapp-1.1.1-registry.json` |
| N7 | **GitHub Pages serves a page without its `.html` extension, with no redirect.** On our domain, `/index` answered 200 with `index.html`'s content. So `cat/patchpaw.html` should serve at `/cat/patchpaw`. Today `/cat/patchpaw` answers 404. | VERIFIED (`/index`); INFERRED for a subfolder until deployed | `S/gh-pages-extensionless.txt`, `R/site-url-checks.txt` |
| N8 | **StonkFun's Terms live inside the app** (version constant 2026-09-18, `/api/terms-accept`). Visitors from the 20 IP-blocked jurisdictions are sent to `/restricted`. US, Canada and the UK are **restricted by the Terms but not IP-blocked** (see D0). The Terms also forbid "any robot, spider, scraper, or other automated means … except through the public API", so the Action never scrapes StonkFun's site. | VERIFIED | `S/stonkfun-routes.txt`, `RH/stonkfun-terms-excerpts.txt`, `RH/live-0s2-lymzpm5aj.js` |

### 0.3 What this revision changed

| Finding (Appendix B) | Change | Sections |
|---|---|---|
| 1 | Page race check: `confirmed`, paging back to `snapshotSlot`, caps, a second source (StonkFun `/launches`), fail closed. Builder: epoch sweep on every run, with no dependence on the feed. N4 relabelled. | 0.2, 4.1, 4.5, 4.7 |
| 2 | Commit and reveal: only `sha256(metadataUri)` before opening. The JSON is uploaded at opening from a fresh key. `opensAt: null` means closed. Openings are unannounced. The Adopt dialog states the bounded loss. | 2.1, 3.4, 3.5, 4.2, 8, D18 |
| 3 | New clause 8: the creation transaction may only create the coin. Holder-concentration gate on buy links. | 4.2, 4.4, 4.6, 2.1, D19 |
| 4 | The site stays dependency-free. No web3.js in the repository. Data-writer jobs run no `npm`, disable hooks, and commit only builder-owned files. The upload tool lives outside the site. | 4.5, 5.4, 5.5, 7.1 |
| 5, 10 | Path S′ (Phantom's provider). Allowed-delta verification moved into v1. No silent Path P. Phantom go/no-go gate. N5 and N6 relabelled. | 0.2, 1.1, 1.3, 1.4, 7.4, 8 |
| 6 | Mint key lives for one attempt. WebCrypto non-extractable key where available. Public-key equality asserted on rebuild. | 1.3, 7.1 |
| 7 | `@noble/ed25519` 3.2.0 vendored byte for byte. No esbuild. Tarball byte tests. | 5.1, 5.5, 7.1 |
| 8 | Frame check. CSP on every `cat/*.html`. Page tests cover every HTML file. URL-sink rule. | 4.7, 5.2, 5.3, 7.1 |
| 9 | A key in the page is public. Page key separate from the Action's key. Exhaustion is designed for. | 1.3, D11 |
| 11 | "Ready" requires pricing 200. The 503 is a temporary state. Stage 3 acceptance restated. | 0.2, 1.3, 2.2, 4.5, 8 |
| 12 | Keyed `SOLANA_RPC_URL` required for Adoptions. Back-off, per-run caps, hosted-runner acceptance. | 4.5, 8 |
| 13 | Separate concurrency groups (disjoint files) with fetch, rebase and retry push. | 4.5 |
| 14 | Hourly heartbeat commit refreshes `snapshotSlot`. The page pages back to it and fails closed. | 4.5, 4.7 |
| 15 | Pre-sign wallet check: StonkFun `/launches?creator=` plus a recent-chain read plus local notes. | 4.7, 2.2 |
| 16 | "Usually 2–10 minutes, sometimes longer". Poll for 30 min. `imageUrl` becomes a warning. | 2.1, 7.5 |
| 17 | Default price 50,000 µL (StonkFun's form value). | 1.3 |
| 18 | Stage 1 test upload decides the canonical gateway prefix. Fetch-back follows redirects. | 3.4, 7.1, 8, D3 |
| 19 | Eligibility from StonkFun's actual Terms. D0 blocker. Owner's test launch bound too. RS corrected. | 0.1, 2.1, 6, 9 |
| 20 | Held cats refused by the tooling. Honest counts. Examples and prototypes moved to non-held cats. D13 licence required. D17 ruling. | 3.1, 3.5, 7.1, 8, 9 |
| 21 | Loss, no-refund and StonkFun-discretion statements. Creator wording. | 2.1, 6 |
| 22 | "Memecoin" in every X text. "Not an animal charity" in the dialog and on the cat page. Button and tag renamed. D12. | 2.1, 3.3, 6 |
| 23 | No `$` before adoption. Two-state share card. | 3.2, 3.3, 7.1 |
| 24 | Third-party creator disclosure on the card, footer, posts, bio and metadata. The banner no longer implies the account is sanctuary-run. | 2.1, 3.2, 3.3, 5.2, 6 |
| 25 | xStock disclosures name "xStocks". PreStock phrasing. | 3.3, D2 |
| 26 | Cost wording: rent vs fees, no refund. | 1.3, 2.1 |
| 27 | Adoption panel in its own section above the research, with a separator. | 2.1 |
| 28 | The wallet address is published: said up front. | 2.1, 6 |
| 29 | Duplicate warning. `Not this cat` list on the cat page. | 2.1, 4.3, 5.3 |

### 0.4 Blockers before any build work

1. **D0**, the StonkFun eligibility question (section 9).
2. **Held and borderline cats:** 8 held tickers can never be frozen as they are. SUNMANE and SAVEPAWS need an owner ruling (D17).
3. **Stage 4 gate:** at least Phantom (extension and mobile) through Path S or S′, or an explicit owner decision to open without Phantom.
4. **D13:** a written licence line, so that an adopter can truthfully give StonkFun's Submission warranty for the sanctuary's art.

---

## 1. Feasibility verdict

### 1.1 Verdict: technically yes, with one wallet gate and one terms question

**Technically yes.** For any wallet that offers a sign-only call (Path S or S′), the adopter can launch from our site in one approval, and StonkFun will very likely record it. This rests on the following, in order of strength:

1. **StonkFun documents the path** and says it needs no registration call: "There is nothing else to call. Within a minute or two the pool is adopted." VERIFIED: `A/developers-build-yourself-code.txt`.
2. **Launches built outside the form are recorded in production.**
   - 72 of 72 launches read from 8 stocks' feeds were recorded (VERIFIED: `R/feed-recorded.out.json`).
   - 36 of those were self-built (recorded more than 10 s after the block). They reached `/launches` after 14–460 s (median 89) and `/tokens` after 114–693 s (median 281). 7 of the 36 had exactly our shape, `[ComputeBudget, ComputeBudget, init]`, legacy, with no dev buy (VERIFIED: `V/recompute.out.txt`, `R/priority-fees-decoded.json`).
   - A stale raise does not stop recording. Recorded pools include raises at 0.25–0.28× today's pricing (VERIFIED: `R/raise-spread.out.json`).
3. **The launch shape is enforced on chain.** The platform has `restrict_curve_param = 1`. Leaving out the curve rule fails with 6018, a wrong supply fails with 6025, and the exact shape passes (VERIFIED: `A/simulate-browser-build.json`, `R/verify-91.out.json`).
4. **Our bytes match StonkFun's own.**
   - RS re-encoded 6 of 6 real launches byte for byte (`A/reencode-check.json`).
   - With the exact recipe in section 1.3, **88 of 91** stocks simulate on mainnet with `err: null` and the `InitializeWithToken2022` log:
     - 91,084–113,594 CU and 847–869 bytes;
     - a payer cost of 8,534,160–8,686,560 lamports;
     - every rule equals its PDA, and every rule and config is owned by LaunchLab.
     The other 3 are the pricing-503 stocks (N1). VERIFIED: `R/verify-91.out.json`.
5. **Signing from a static page is unproven** (this changed from the pre-revision text).
   - The Wallet Standard defines a sign-only feature (N6), but no wallet's registered features have been recorded.
   - Phantom's docs point sign-only signing to its own provider, and warn that the method may be removed (N5).
   - Path S′ copies the pattern CIA already ships for Phantom (VERIFIED: `cia/src/injected.mjs` lines 10 and 94, `cia/src/lib/engine.mjs:822`). It is untested from a web page.
   - **Stage 4 is a go/no-go gate** (section 7.4).

**The terms question (D0) is not technical, but it is a blocker.** StonkFun's Terms exclude US, Canadian and UK persons and anyone under 18. The in-site launch uses StonkFun's public API from the adopter's browser (checks 1–3) and StonkFun's platform, recording and creator-fee forwarding. The Terms list "APIs through which a visitor may then launch tokens" among the Services (VERIFIED: `RH/stonkfun-terms-excerpts.txt`). The spec does **not** try to route around the Terms, for example by moving the API calls into the Action; an adopter would still be launching on StonkFun's platform (INFERRED).

**Fallbacks:**
- **Phantom fails Stage 4, other wallets pass:** open with the wallets that pass, and say on the dialog "Phantom can't adopt yet: use Solflare or Backpack". This is an owner decision at the Stage 4 gate.
- **Every wallet fails Stage 4, or the owner rejects in-site launching:** Plan B (section 1.5), a hand-off to StonkFun's form. It is a much weaker product: no kit description reaches the chain, and adoption can be counted only by an image-hash rule (D15).

**What is not yet proven, and where the plan proves it:**

| Open point | Risk | Proven at |
|---|---|---|
| Which wallets register `solana:signTransaction`, and what Phantom's `window.phantom.solana` sign-only call accepts and returns | Without a sign-only call, the mint cannot co-sign after the wallet. Path P is not acceptable for Phantom (section 1.3). | Stage 4: a devnet two-signer test and a **mainnet sign-only dry run** that is never sent (section 7.4) |
| Wallets return our message unchanged, or change it only in the allowed ways (Lighthouse or ComputeBudget) | Any other change is refused (`wallet_changed_tx`), so nothing lands and nothing is charged | Stage 4 |
| publicnode accepts `sendTransaction` from a browser | Without it, the page uses the second sender (D11). If that is exhausted too, the page says "try again later" and nothing is charged. | Stage 4 (devnet) and the owner's test launch (Stage 7) |
| arweave.net serves ArDrive Turbo data-item ids, and how fast | The canonical URI prefix is permanent, so it is not fixed until a test upload proves it (finding 18) | Stage 1: one free test upload |
| StonkFun records a launch built by **our** code | Every other hand-built launch sampled was recorded (VERIFIED), but not yet one built by our code. INFERRED low risk. | Stage 7: the owner's single real test launch |
| StonkFun shows website and X links for self-built launches | VERIFIED **not** shown: 4 of 4 had `links: {}`. The links live only in the permanent JSON. | Owner decision D5, not a blocker |

### 1.2 Why not hand off to StonkFun's form (all VERIFIED, RS §2, §5)

- StonkFun's internal `POST /api/launchlab-launch` answers the CORS preflight with **405** and no ACAO header, so another site cannot call it.
- `/api/public/v1/launches/prepare` answers **503**: "launch through LaunchLab instead".
- The form reads no URL parameters. It sends `X-Frame-Options: DENY`, and its image field is a file input. Nothing can be prefilled.
- The form writes its own JSON: the description becomes "<name> was launched on StonkFun.", the URI is a new Irys URI for each launch, and there is no banner. Our description and disclosures never reach the chain, and the registry's exact-URI rule cannot match the launch.

The hand-off is kept only as **Plan B** (section 1.5).

### 1.3 The exact transaction recipe (in-site)

**Where the inputs come from.** Each input comes from one of these sources and is checked before use:

- the kit in `data/kits.json`: `name`, `symbol`, `metadataUri` (present only once the cat is open), `quoteMint`, `quoteTokenProgram`;
- StonkFun's public API on `https://www.stonkfun.xyz/api/public/v1` (CORS `*`, 300 requests a minute; VERIFIED RS §6, RR §2.1);
- chain reads through publicnode (N3), always with an explicit `commitment`;
- the connected wallet's public key, A;
- the attempt's mint keypair, M.

**Format.** A **legacy** transaction, as StonkFun's own form sends (VERIFIED, RS §2). It is 836–896 bytes (VERIFIED), with no lookup tables.

```
fee payer            A (adopter wallet)
recentBlockhash      getLatestBlockhash("confirmed") via publicnode; keep lastValidBlockHeight
signers              exactly [A, M], A first (fee payer)
ix0  ComputeBudget   SetComputeUnitLimit(250_000)          data 02 90d00300
ix1  ComputeBudget   SetComputeUnitPrice(50_000 µlamports) data 03 50c3000000000000
ix2  LaunchLab LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj  initialize_with_token_2022
```

- **Compute limit.** 250,000 is CIA's `COMPUTE_LIMITS.stonkfun`. The heaviest of the 88 simulations used 113,594 CU (VERIFIED: `R/verify-91.out.json`).
- **Compute price.** The default is **50,000 µL**, StonkFun's own form value (VERIFIED: RS §3.4). 37 of the 48 sampled launches that set a price used exactly that; 9 used 100,000–150,000, 1 used 4,000,000 and 1 used 500 (VERIFIED: `R/priority-fees-decoded.json`, `V/recompute.out.txt`).
  - With the 250k limit, that is a 12,500-lamport priority fee.
  - The value is configurable in `data/adoption-rules.json` and capped at 200,000 µL.
  - It cannot outbid bots, and the dialog says so.
- **Memo, dev buy, other instructions: none.** CIA's `checkLaunchMessage` allows exactly this shape. Owner decision (3) means no dev buy, and registry clause 8 refuses any creation transaction that trades.

**ix2 accounts** (VERIFIED: RS §3.2 and RL §2.2, 6 of 6 real launches re-derived; `R/verify-91.out.json` for all 88 priced stocks):

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

0. **The page's own state:**
   - the page is top-level (`window.top === window.self`), or the dialog refuses (section 4.7);
   - `adoptions.json` is fresh (`generatedAt` within 120 min, and `health.ok`);
   - the cat's kit is `open`, and its `metadataUri` hashes to the locked `metadataUriSha256`.
1. **`GET /stats`:** `config.launchLabEnabled === true`.
2. **`GET /pairs?launchable=true&launchLabReady=true`:**
   - the kit's `quoteMint` must be listed as launchable and ready;
   - `tokenProgram` must equal the kit's;
   - key the lookup by mint, never by symbol (HTZ has two pairs; VERIFIED RS §6).
3. **`GET /launchlab/pricing?quoteMint=`.**
   - A **503 with `retryAfterSeconds`** is a distinct, temporary state, `pricing_unavailable` (N1). It is not "paused". The page waits the given seconds and retries at most 3 times.
   - A 200 must satisfy all of:
     - `curve.programId` = LaunchLab;
     - `platform.standard` = `4E876…`;
     - `ConstantCurve`, `cpmm`, `baseDecimals` 6, `supply` 1e15, `totalSellA` 793.1e12, vesting all "0";
     - `raise.raw` a positive integer string;
     - `curveRule.standard` equal to the derived PDA;
     - `quote.mint` equal to the kit's.
4. **One `getMultipleAccounts` (publicnode, `confirmed`) of the platform, config, rule and quote mint:**
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
7. **The race check** (section 4.7): the result must be `free`. `unknown` counts as not free.
8. **The wallet check** (section 4.7), when D1(b) is on: A has no accepted or pending sanctuary adoption in the last 24 h. If the check cannot finish, an extra required checkbox is shown.

**Signing: one approval, and only through a path Stage 4 recorded as working.**

The page picks the path from a pinned per-wallet table, `assets/adopt/wallet-paths.js`, written from the Stage 4 results and keyed by wallet name plus the features found. It **never falls back silently**. The dialog names the path in use.

- **Path S: Wallet Standard sign-only.** Used when the wallet registers `solana:signTransaction` **and** Stage 4 recorded that its result passes verification.
  1. `signTransaction({ account, transaction: unsignedWire, chain: "solana:mainnet" })` returns `signedTransaction`.
  2. Verification (below).
  3. M signs slot 1, then the page sends.
- **Path S′: Phantom's own provider** (`window.phantom.solana`). Used for Phantom when Stage 4 shows that its Wallet Standard wallet lacks `solana:signTransaction`.
  - This is the pattern CIA's Phantom bridge ships: `p.signTransaction(tx)` followed by `sameMessage` (VERIFIED: `cia/src/injected.mjs:10`, `:94`; `cia/src/lib/engine.mjs:822`).
  - The page does not ship web3.js, so it uses Phantom's documented request form: `provider.request({ method: "signTransaction", params: { message: base58(messageBytes) } })` (VERIFIED docs: `S/solana_sending-a-transaction.md` lines 96–110).
  - Before calling, the page requires `provider.isPhantom`, and requires `provider.publicKey` to equal the connected account A.
  - The return shape is not documented beyond an example. Stage 4 records it (INFERRED: either a serialized transaction or `{ signature, publicKey }`). The page accepts either form, takes A's 64-byte signature, and verifies it as below.
  - The page feature-detects on every open. If the method disappears (Phantom's docs say it "may be removed"), Phantom is hidden with the message "Phantom can't adopt right now".
- **Verification, the same for S and S′.** The page **never sends bytes the wallet returns**. It sends its own message with two signatures.
  - **Case 1:** A's signature is a valid ed25519 signature over **our** message bytes. Proceed.
  - **Case 2, allowed delta** (moved into v1 from the old "v2 option"): the wallet signed a different message. Accept it only if all of these hold:
    1. the header's signer count, the fee payer, the signer set [A, M] and the recent blockhash are unchanged;
    2. the LaunchLab instruction, its accounts and its data are byte-identical;
    3. every other difference is one of:
       - appended instructions whose program is the Lighthouse program, whose id is pinned from what Stage 4 observes, and whose accounts are all read-only non-signers;
       - ComputeBudget limit or price changed within the caps (limit ≤ 1.4M, price ≤ 200,000 µL);
    4. the message passes `checkLaunchMessage` extended with exactly that allowance;
    5. re-simulation of that message passes check 6;
    6. A's signature verifies over that message.

    M then co-signs **the wallet's message**, and that message is what is sent.
  - **Otherwise:** refuse with `wallet_changed_tx`. The wallet-signed copy can never land without M's signature, so refusing is safe.
  - Also refuse a signature of 64 zero bytes, or one that verifies only under a different key.
- **Send (S and S′).**
  - Send the base64 wire to publicnode `sendTransaction` with preflight on (`preflightCommitment:"confirmed"`, `maxRetries:0`), so a transaction that would now fail is refused without a charge.
  - Also send it to the second sender (D11).
  - Rebroadcast the same bytes every 2 s with `skipPreflight:true`, until `confirmed` or until block height passes `lastValidBlockHeight`.
  - If both senders refuse or are rate-limited (for example because the page key is exhausted, D11), stop and say: "We can't reach Solana right now. Nothing was sent or charged. Try again later."
- **Path P: the wallet sends a transaction M has already signed.** Allowed **only** for a wallet that has no sign-only call **and** that Stage 4 recorded as sending a pre-signed two-signer transaction unchanged.
  - **Never for Phantom.** Its docs warn against this order for multiple signers, and say transactions it submits may gain Lighthouse instructions, which would void M's signature (N5).
  - The dialog says "Your wallet will send this transaction itself".
  - If the wallet changes the message anyway, M's signature fails and the network rejects the transaction, with no charge (INFERRED from how signature checks work).
- **Never used:** `signAllTransactions`, `signMessage`, token approvals, or any second transaction.

**The mint key's lifecycle** (this fixes a contradiction in the pre-revision text).

- **One M per adoption attempt.** An attempt begins when Review starts. It ends when it resolves:
  - confirmed, whether our launch won or lost;
  - expired and abandoned by the user;
  - cancelled;
  - or the dialog is closed.
- **How M is created.** Where the browser supports it, M is a **non-extractable** WebCrypto key: `crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign"])`. The public key is exported raw, and signing uses `crypto.subtle.sign("Ed25519", …)`. Browser support is INFERRED; Stage 4 records it. Otherwise M is a 32-byte seed from `crypto.getRandomValues`, held in a closure and used with the vendored `@noble/ed25519` `signAsync`.
- It is never persisted, logged, posted or sent. Tests spy on `localStorage`, `console`, `fetch` and `postMessage`.
- **Expiry rebuild.** If the blockhash expires and the user retries, the rebuild **reuses the same M**. Before every signature, the page asserts two things:
  - M's public key equals the public key recorded at the start of the attempt;
  - on the noble path, the seed is not all zeros.

  If either fails, the attempt aborts with `key_lost` and nothing is signed.
- **Dropping M.** Only when the attempt resolves are the references dropped, and on the noble path the seed zeroed (`fill(0)`).
- If an earlier copy did land after all, the rebuild fails harmlessly ("account already in use"), so one attempt can never create two coins. INFERRED from how account creation works; there is a unit test for it with a chain double.

**Confirmation.**
1. Poll `getSignatureStatuses([sig])` (publicnode) every 1.5 s until `confirmed`, then `finalized`.
2. Then `getMultipleAccounts([pool, M], {commitment:"confirmed"})` and apply registry clauses 1–4, 7 and 8 locally: the platform, the stock, the kit's name, symbol and URI, creator = A, and our own transaction's shape.

**Cost to the adopter.** The exact amount comes from the simulation and is shown before signing.
- **About 0.0085–0.0087 SOL.** The 88 priced stocks simulated a payer cost of 8,534,160–8,686,560 lamports at 20,000 µL (VERIFIED: `R/verify-91.out.json`). At the new 50,000 µL default, that is 7,500 lamports more (INFERRED arithmetic).
- **Almost all of it is rent** for the new mint, pool and two vaults (INFERRED split). The network fee is 2 × 5,000 lamports for signatures plus a 12,500-lamport priority fee, 22,500 lamports in all (about 0.0000225 SOL).
- **There is no platform fee:** LaunchLab's launch fee is 0 (VERIFIED: `A/api/launch-quote.json`). The sanctuary takes no fee.
- **The rent is not refundable.** The accounts belong to programs, and the mint has no close authority (INFERRED).
- **A race loser pays the same** and gets no cat.

### 1.4 How the design stays safe if a wallet misbehaves

| Wallet behaviour | Result |
|---|---|
| Returns a message changed in any way other than the allowed delta | Verification fails. The page refuses; nothing is sent or charged. |
| Appends Lighthouse assertions, or changes the compute budget within the caps | Allowed delta: the message is re-checked and re-simulated, then M co-signs **that** message (section 1.3). |
| Has no sign-only call | Path P only if Stage 4 recorded that the wallet sends pre-signed transactions unchanged. Otherwise the wallet is not offered. Never Phantom. |
| Lacks `solana:signTransaction` but is Phantom | Path S′ through `window.phantom.solana`, if Stage 4 passed it. Otherwise Phantom is hidden, with a message. |
| Is an embedded (social-login) wallet | Not offered. Phantom's docs say these refuse pre-signed transactions and are reached only through its SDK (VERIFIED, N5). That they never register as injected Wallet Standard wallets is INFERRED. |
| Is on devnet | Refused: the page requires `account.chains` to include `solana:mainnet`. |

### 1.5 Plan B: hand-off to StonkFun's form

Use this only if the owner rejects in-site launching, or if Stage 4 finds no wallet that can co-sign.

**What we provide** (field rules VERIFIED in `A/pretty/3f11vexa51nkb.js`; KI `limits.stonkfunForm`):
- a download of the 1024 px PNG (at most 2 MB, square);
- copy buttons for the name (≤ 32), the ticker (≤ 10), the website (`https://catcoinsanctuary.com/cat/<ticker>`, ≤ 200) and an optional X profile URL;
- the stock's **mint**, which StonkFun's quote search matches;
- the instructions "Holder rewards tax: None. Dev buy: empty.";
- a link to `https://www.stonkfun.xyz/launch`, where StonkFun's own Terms gate and loss warning apply.

**How we detect it.**
- Poll `GET /launches?creator=<A>&since=<t>`, or `/launches?since=`, filtered client-side to the cat's `quote.mint`. The endpoint has no quote filter (VERIFIED: `A/api/openapi.json`).
- Confirm on chain: the name, symbol and stock match exactly, the pool is on the standard platform, the creator is the fee payer, the creation transaction has no buy, **and** the JSON's image bytes hash to the kit image's sha256.
- It is **untested** whether StonkFun re-encodes uploaded images (RR §3.2). The hash rule must first be proven by the owner's own form launch.

**What is lost.** Our description and disclosures never reach the chain. The metadata address is different for each launch. The adopter types every field by hand. In return, the links **do** show on StonkFun.

---

## 2. Adopter UX flow

Every text on screen is set with `textContent`, as the site's page test requires (`site/tests/page.test.mjs`). The adopter types nothing: every value comes from the kit or the chain. **Every adopter-facing string lives in one module, `assets/adopt/copy.js`**, and a test asserts that the required statements are present (section 7.1, test 13). The example cat throughout is PATCHPAW, which is not held.

### 2.1 Happy path

1. **The garden.**
   - Every cat whose kit is `open` shows the tag **"Up for adoption (memecoin)"**. This replaces "Not launched yet" for those cats.
   - The other tags are:
     - **"Adopted by 3J57…iji3"**, with the gold coin, as launched cats have today;
     - **"Moving in…"**;
     - **"Not open yet"** for a locked kit. No date is published (finding 2).
     - **"Adoption paused"**;
     - **"StonkFun can't price this right now"**.
   - The legend gains "Up for adoption (memecoin): a coin anyone can launch from this site" and "Adopted".
2. **Click a cat to open its card.** The card keeps today's content: story, portrait, the real-cat research and the disclaimer. The **Adoption panel is its own section, placed above the research.** It is separated from the research by one line: "The research below is about companies' own cats and posts. No company or person named there is involved with this coin." The panel holds:
   - thumbnails of the kit: token image and banner;
   - the name, the ticker **without `$`** (the site's planned-ticker rule), "priced in SPYx", and the website URL;
   - the line "Not an animal charity: no real cat is involved.";
   - **[Adopt this cat]**, shown only when the kit is `open`;
   - **[Share this memecoin]**, the waiting post as an X intent, shown only when the kit is `open`;
   - a "How adoption works" disclosure.
3. **Adopt opens a modal dialog** (`<dialog id="adopt">`, keyboard-trappable). The route `#adopt=<TICKER>` opens it directly, and the per-cat pages link to it.
   - **If the page is inside a frame** (`window.top !== window.self`), the dialog shows only "Open catcoinsanctuary.com directly to adopt", with the URL as text. It never connects a wallet there.
   - **Step 1 of 4, "What you get, and what it costs":**
     - "This is a memecoin, not a pet. Catcoin Sanctuary is not an animal charity; no real cat is involved."
     - The kit, with every permanent field marked "permanent".
     - "You will be the coin's creator on Solana (Raydium LaunchLab, on StonkFun's platform)."
     - "Cost: about 0.0087 SOL (the exact amount is shown after the test run). About 0.0085 SOL of it is rent kept by the coin's accounts and never returned, plus about 0.00002 SOL in network fees. There is no sanctuary or StonkFun fee."
     - "This coin can lose all of its value and may never be traded."
     - "StonkFun decides whether to list your coin and whether to forward any creator fees. That is not guaranteed, and the sanctuary cannot promise it." With a link to StonkFun's launch page, whose own text says "Creator fees are approximate and depend on trading that may never happen. A token can lose all of its value." (VERIFIED: `RH/launch-live.html`).
     - The rules in plain words:
       - "The first confirmed launch of this cat wins. Anyone can launch it, bots included, and bots are usually faster."
       - "If another launch wins, you still pay about 0.0087 SOL, which is not refunded. Your coin still carries this cat's name, picture and our website forever, and our page will list it as not this cat."
       - "A launch that also buys the coin in the same transaction does not count."
       - "One adoption per wallet per 24 hours; a second one does not count and is not refunded." (if D1(b) is kept)
     - "Your wallet address will be shown publicly as this cat's adopter on catcoinsanctuary.com and kept in the site's public history."
     - The licence line (D13).
     - **[Continue]**
4. **Step 2 of 4, "Connect a wallet".**
   - The page lists only wallets that support `solana:mainnet` **and** have a path in `wallet-paths.js` (section 1.3). For Phantom that means Path S or S′.
   - Connecting uses `standard:connect`. The page then shows `3J57…iji3` and the balance (`getBalance`).
   - **If no wallet is found:** "Open this page in your wallet app's browser". Offer the Phantom and Solflare browse deep links (INFERRED link formats; verify in Stage 4) and the plain URL to copy.
5. **Step 3 of 4, "Review".** A live checklist, with each line ticking as it passes (section 1.3, checks 0–8):
   - "The sanctuary's registry is up to date"
   - "StonkFun launches are on"
   - "The SPYx pair is ready"
   - "StonkFun's launch shape confirmed on Solana"
   - "Patchpaw is still free" (the fail-closed race check)
   - "Your wallet hasn't adopted another cat today" (if D1(b))
   - "Test run on Solana passed: your wallet pays 0.00868 SOL"

   Below the checklist:
   - **A decoded summary:** "One transaction. It creates the memecoin Patchpaw the Calico (ticker PATCHPAW), with a supply of 1,000,000,000, on Raydium LaunchLab (StonkFun's platform), priced in SPYx. You become its creator. Only the SOL shown above leaves your wallet; no other token moves, and nothing is approved for later. Your wallet will [sign it and the page will send it | send it itself]."
   - **Three required checkboxes:**
     1. "I understand this memecoin can lose all of its value, that the ~0.0087 SOL is not refunded even if someone else's launch wins, and that the coin's name, picture, description and website are permanent."
     2. "I am 18 or older, and I am not a Restricted User under StonkFun's Terms (version 2026-09-18). That means I am not a citizen or resident of, located in, or using StonkFun from the United States, Canada or the United Kingdom, and I am not in, from or controlled from a sanctioned jurisdiction." Below it, StonkFun's Restricted User clause is quoted verbatim in a disclosure block, with its version.
     3. "I understand my wallet address will be published as this cat's adopter."
   - **[Adopt Patchpaw: approve in your wallet]**
6. **Step 4 of 4, "Approve in your wallet".** A spinner. Cancelling returns to Review with "Nothing was signed or charged."
7. **"Sending…"**, then **"Confirmed on Solana"**, with a Solscan link for the transaction.
   - The page checks its own launch: clauses 1–4, 7 and 8.
   - It re-runs the race check once the launch is `finalized`.
8. **"Moving in…"**
   - The mint with a copy button, and "adopted by you (pending)".
   - The StonkFun status: "StonkFun usually lists coins launched outside its form within 2–10 minutes, sometimes longer." The page polls `/tokens/{mint}` every 30 s for up to 30 min.
   - The garden shows the cat with "Moving in…" in this browser only.
   - `localStorage.adoptPending[TICKER] = {sig, mint, wallet, at}` holds no keys. It is wrapped in try/catch and is only a convenience. It also feeds the wallet check.
9. **Share.** This step is enabled once the finalized race check returns `free-for-us`, meaning our launch is the earliest valid one. The same fail-closed rule applies.
   - **[Post on X]**: the adopted template with `CA <mint>` filled in, as an `x.com/intent/tweet?text=` link. The post says the poster is the coin's creator and may receive fees (section 3.3).
   - **[Get your X profile kit]**: the display name, bio and suggested handle with copy buttons; the avatar and header as downloads; the website to put in the profile.
   - **[Open on StonkFun]**, once recorded.
   - **[Solscan]**.
10. **The registry confirms** (about 5–25 min). The cat shows "Adopted by 3J57…iji3". The card then shows:
    - "Launched by 3J57…iji3, an independent adopter, not by Catcoin Sanctuary. The sanctuary does not vet adopters. StonkFun may pay the coin's creator part of its trading fees." For a wallet listed in `data/wallets.json`, it shows "Launched by the sanctuary keeper's wallet 3J57…iji3" instead.
    - The mint, the Solscan and StonkFun pages, and the GMGN and FOMO links built by the site's shared `buyLinks(mint)`. **These links appear only when `holders.buyLinks` is true** (section 4.4). Otherwise the card says "Buy links are hidden: one wallet holds 12% of the supply (limit 5%)."

### 2.2 Failure and race states (every one is handled)

| State | Detected by | What the adopter sees | Money |
|---|---|---|---|
| Page is framed | `window.top !== window.self` | "Open catcoinsanctuary.com directly to adopt." No wallet connect. | none |
| Adoption not open | the kit's `state` is not `open`, or `opensAt` is null | "Not open yet." Adopt is hidden. | none |
| Registry behind | `adoptions.json` `generatedAt` older than 120 min, or `health.ok` false | "The sanctuary's registry is behind, so adoption is paused. Nothing was signed." | none |
| Adoption paused | `adoptions.json.cats[T].paused` (a daily simulation failed), or checks 1, 2 or 4 fail live | "StonkFun or Solana changed something; adoption is paused. Nothing was signed." | none |
| **StonkFun can't price the stock** | pricing answers 503 with `retryAfterSeconds` (live), or `pricingUnavailableSince` (daily guard) | "StonkFun can't price SPYx right now. We'll retry in 30 s. Nothing was signed." Up to 3 automatic retries. | none |
| StonkFun API unreachable or 429 | fetch error, or `Retry-After` | "StonkFun isn't answering; try again in a minute." | none |
| **Someone adopted this cat first** (already known) | `adoptions.json` `status:"adopted"` | The card shows the resident; Adopt is hidden. | none |
| **Someone is moving in** (live) | the race check finds a valid kit launch newer than `snapshotSlot` | "Someone just adopted this cat (mint Ab12…). It is being confirmed." Adopt is disabled. | none |
| **Can't confirm the cat is free** | the race check returns `unknown`: a cap was hit, `snapshotSlot` was not reached, or a source failed | "We can't confirm Patchpaw is still free right now. Try again in a few minutes. Nothing was signed." | none |
| Wallet over the per-wallet limit | the wallet check finds an accepted or pending sanctuary adoption by A within 24 h | "This wallet adopted Rosette 3 h ago. One adoption per wallet per 24 h; a second would not count." | none |
| Wallet check incomplete | more than 10 recent transactions to read | An extra required checkbox: "This wallet has not adopted another sanctuary cat in the last 24 hours. I understand that a second adoption within 24 hours will not count and its cost is not refunded." | none |
| Not enough SOL | the balance, or a simulation error about insufficient funds | "You need about 0.009 SOL; you have 0.004 SOL." | none |
| Simulation fails (6018, 6025 or anything else) | check 6 | "The test run failed: <code>. Nothing was signed." The failure is logged to the console only. | none |
| User cancels in the wallet | the wallet promise rejects | Back to Review, "Nothing was signed or charged." | none |
| Wallet changed the transaction | verification fails (S or S′) | "Your wallet changed the transaction, so it was not sent. Try another wallet." | none |
| Mint key lost | public-key assertion fails | "Something went wrong on this page; nothing was signed. Reload and try again." | none |
| Send refused, or the RPCs are down or exhausted | error from both senders | "We can't reach Solana right now. Nothing was sent or charged. Try again later." | none |
| Blockhash expired (wallet left open for more than 60–90 s) | block height passes `lastValidBlockHeight` without confirmation | "It didn't land in time; nothing was charged. [Try again]". This rebuilds with the **same** mint key. | none |
| The transaction landed with an error | `err` in the status | "Solana rejected it: <err>. Only the network fee was charged." | fee only |
| **Lost the race** (confirmed, but an earlier valid kit launch exists) | race check at `finalized`, or the registry lists the launch in `notThisCat` | "Someone else's launch of Patchpaw confirmed first (mint Cd34…). Your coin exists on Solana and may appear on StonkFun, but it is not the sanctuary's Patchpaw. It still carries this cat's name, picture and our website, and our page lists it under 'Not this cat'. The ~0.0087 SOL is not refunded." No share button and no garden tag. | the launch cost |
| StonkFun has not recorded it after 30 min | `/tokens/{mint}` still 404 | "StonkFun hasn't listed it yet; that is StonkFun's decision. Your coin exists on Solana (mint …). The sanctuary counts it from the chain." | n/a |
| Page closed mid-flow | `localStorage` pending entry on the next visit | Resumes the status check for `sig`. No key is ever stored, so an unsent attempt is simply gone. | none unless sent |

---

## 3. The kit for each cat

### 3.1 What exists today (VERIFIED, KI 18:58 UTC and `site/data/held.json` 19:50 UTC)

| Group | Cats | State |
|---|---|---|
| Sheet 1 (xStocks) | 24 | Name, ticker, description (244–280 characters) and 1024 px PNG (1.08–1.28 MB, RGB) are drafted. **8 are held by the site and cannot be frozen as they are:** HARRUMPH (Coinbase's Mister Miggles), PEWTER (@RobinhoodApp's pixel cat), SNOWCURL (Tesla Pet Mode avatar), MOATCAT (Squishmallows' Cam the Cat), COUCHCAP (Meta's Make-A-Video demo cat), WARMSPOT (Starlink's "Cat 5" sticker cat), SOCKFOOT (NVIDIA blog's Figure 1 cat) and HALFSMILE (Jellie, the Minecraft cat skin). **2 more need an owner ruling (D17):** SUNMANE (mane-like ruff, "Big-cat link: the MGM lion") and SAVEPAWS (based on the kitten avatar of the best-known GME fan account, a real person's avatar). Eligible today: **16**, or **14** if the two are held. |
| Sheet 2, picked | 26 | text only; no image, and most lack the "look" sentence the image recipe needs |
| Sheet 2, not picked | 41 | candidate names only. PENG, AMBA and ARM have no pricing today (N1). |
| All | 91 | **no** banner, avatar, share card or per-cat page yet. At most **83** cats can be adoptable once every kit is made, ruled on and priced. |

Sources: `RH/site-held.json.copy-1940Z`, `V/site-held.json.copy-1950Z`, `RH/launch-sheet-whylook-excerpt.txt`. `site/data/planned.json` has 16 cats, with none of the held tickers.

**Rules that follow:**
- `scripts/build-kits.mjs` and the freeze test **refuse any ticker listed in `data/held.json`**. `assets/adoptions.js` gives held cats the status `no_kit`.
- A held cat returns only by the site's own procedure: redraw its launch-sheet picture as a cat of its own, rewrite its `whyLook`, delete its row in `held.json`, then build its kit.
- **Collisions** (VERIFIED, KI `collisions`): TTWO **SAVEPAW** must be renamed before its kit is frozen, because it clashes with GMEx SAVEPAWS. CARTONPAW and TARTANPAW are flagged only.
- The banner prototypes in `A/kits/proto/` are HALFSMILE, MOATCAT and SOCKFOOT (held), SAVEPAWS (borderline) and PORCHLIGHT. **Only PORCHLIGHT may be used as an example**, and it must be regenerated with the revised lettering (section 3.2).

### 3.2 Files

| File | Spec | Hosted at | Used for | Label |
|---|---|---|---|---|
| Token image | 1024×1024 PNG, ≤ 2,097,152 bytes, no text or logos, not derived from any company's cat or mascot | Arweave (canonical, for the metadata `image`, uploaded before opening); a 512 px JPEG copy on the site (`assets/portraits/<T>.jpg`) | the coin's picture everywhere | VERIFIED limits |
| Banner | 1500×500; PNG (about 0.87 MB) to Arweave, JPEG q90 (about 165 KB) on the site at `assets/kits/<T>/banner-1500x500.jpg`. PIL composite: sanctuary scene, the cat's token image in a medallion, the name, the ticker **without `$`**, and "a memecoin · catcoinsanctuary.com/cat/<t>". It replaces "lives at catcoinsanctuary.com", which implied the account belongs to the sanctuary. Lettering clears X's avatar circle by at least 8 px. It is valid before and after adoption, because it is permanent. | Arweave and the site | X header, the cat page, `properties.files` | VERIFIED prototype recipe (`…/adopt/tools/kits/banner.py`); new lettering INFERRED |
| Avatar | 400×400, a LANCZOS resize of the token image; JPEG (about 40 KB, INFERRED) at `assets/kits/<T>/avatar-400.jpg` | site | X profile picture | recipe VERIFIED |
| Share card | 1200×630 JPEG in **two states**. `og-planned.jpg`: ticker without `$`, plus "Not launched yet: any coin under this name is not this cat". `og-adopted.jpg`: generated after adoption, with `$TICKER` and the short mint. | site | the cat page's `og:image` and `twitter:image`. The page switches the meta tags when `build-cat-pages.mjs` re-runs after an adoption. | INFERRED |
| Metadata JSON | section 3.4, ≤ 107,520 bytes | Arweave, **uploaded at opening** | the on-chain `uri` | — |

**Site size.** About 0.4 MB per cat (the banner JPEG about 165 KB, VERIFIED; the avatar and two share cards about 40 KB + 2 × 150 KB, INFERRED) × 83 ≈ **33 MB** of new site assets. Full PNGs stay on Arweave to keep the repository small (INFERRED).

**Missing images (59 of the 67 sheet-2 cats, plus redraws for any held cat brought back).** Use sheet 1's recipe (VERIFIED, `…/launch-sheet/images/_work/batch1.json`):
- Higgsfield `gpt_image_2_5`, 1:1, style reference `c0dc6227-9a1e-4375-9933-5cb61d2a5aec`;
- the prompt ends "no text, no letters, no logos, no brand marks";
- **the look sentence must describe an original cat, not a company's, a brand's or a real person's cat or avatar** (the rule that produced the 8 holds);
- about 17 credits (INFERRED price);
- a human checks each image for stray marks and for likeness to a known mascot.

### 3.3 Text fields and templates (revised)

The revised templates were rendered and checked for all 50 drafted cats by `…/adopt/tools/revise/text-v2-check.mjs`. It applies the same rules as `…/adopt/tools/kits/text.mjs`:
- CIA's `checkFields`, the pair's own terms, `LAUNCH_CLAIMS` and the other pairs' terms, applied to the cat's own words;
- `checkFields` on the disclosure, with brand, endorsement and financial-promise hits excused;
- the no-hype list on the whole post;
- X weighting ≤ 276 and bio ≤ 160.

With "xStocks" named in the 24 xStock disclosures and the PreStock phrasing below, **50 of 50 pass**. The longest waiting post weighs 276, the longest adopted post 275, and the longest bio is 160 characters. VERIFIED: `V/text-v2-check-issuer-xStocks-prestock.out.json`.

| Field | Rule | Example (PATCHPAW) |
|---|---|---|
| name | ≤ 32 bytes, Latin, contains a cat word (`checkProposal`) | `Patchpaw the Calico` |
| ticker | `^[A-Z0-9]{2,10}$`, not a Jupiter-verified ticker, not in `held.json` | `PATCHPAW` |
| disclosure (full) | "A cat coin priced in {pair}. Not affiliated with {issuers}, {xStocks \| Backpack Securities \| PreStocks} or StonkFun. No intrinsic value; not financial advice." For PreStocks, "priced in the {SYM} PreStocks token", so the symbol is not read as the company. The wording is D2. | "A cat coin priced in SPYx. Not affiliated with State Street, xStocks or StonkFun. No intrinsic value; not financial advice." |
| description (permanent) | "{story} {disclosure full} A memecoin; it can lose all of its value. Launched by its adopter's own wallet; Catcoin Sanctuary does not vet adopters." **≤ 450 characters.** The drafted cats come to 374–419 (VERIFIED: `V/desc-v2-check.out.json`). The JSON cap is 107,520 bytes; the 280 limit was self-imposed. | — |
| website (permanent) | `https://catcoinsanctuary.com/cat/{ticker lower-case}`, ≤ 200 | `https://catcoinsanctuary.com/cat/patchpaw` |
| X post, before adoption (**no `$`**) | "{name}: a memecoin up for adoption at Catcoin Sanctuary. Not launched yet; anything called {TICKER} before then is not it." / [story, first sentence or none, whichever fits] / {website} / {disclosure full, core or short} | "Patchpaw the Calico: a memecoin up for adoption at Catcoin Sanctuary. Not launched yet; anything called PATCHPAW before then is not it." / the website / the full disclosure (274 weighted) |
| X post, after adoption | "I launched {name}, a memecoin. I'm its creator, so fees may come to me." / [story variant] / "CA {mint}" / {website} / {disclosure}. The worst case with a 44-character mint is ≤ 276. The cashtag was dropped to make room for the creator disclosure; the mint is the identifier. | 271 weighted |
| X display name | `{name}`, ≤ 50 (INFERRED limit) | `Patchpaw the Calico` |
| X bio | the first of 4 variants that fits in ≤ 160 characters. All contain "memecoin" and "Run by its adopter". Variant 1 adds "(no real cat)". | "Patchpaw the Calico, a memecoin adopted at Catcoin Sanctuary. Run by its adopter. Not affiliated with State Street or StonkFun. No intrinsic value; NFA." (152) |
| X handle suggestion | `{TICKER}cat` (≤ 15), or `{TICKER}` when it already ends in CAT | shown as a suggestion only |

**Rules for these texts** (each is a test, section 7.1 test 10):
- **Every X post and bio contains "memecoin"** in the cat's own words. The test is `/coin/i` after masking the brand name, since "Catcoin Sanctuary" would otherwise satisfy it.
  - "cat coin" would trip COINx's pair term COIN in own words, but "memecoin" passes every rule. VERIFIED: `V/coin-word-check.out.json`.
  - "cat coin" stays only in the disclosure slot, where it already passes.
- **No `$` in any text or image used before adoption**: the waiting post, `og-planned.jpg`, the banner and the card.
- **Naming the xStocks issuer:** "Backed" (the issuer's name) trips the no-hype word "backed" in 24 of 24 xStock posts. VERIFIED: `V/text-v2-check-issuer-Backed_Assets.out.json`. So the permanent text says "xStocks". The cat page names the issuer in full: "xStocks are issued by Backed", with the exact legal name taken from xStocks' own site before freeze (INFERRED name).
- **The cost of the extra disclosures:** with them, the posts no longer have room for the story (0 of 50 fit it). The story lives on the linked cat page and in the share card. The bio fits "(no real cat)" for 1 of 50, so "Not an animal charity" is carried by the cat page and the dialog, not the bio.
- Only 5 tickers become clickable cashtags on X: PEWTER, PINROW, COBBLE, TOUSLE and HUBBUB (VERIFIED in twitter-text; INFERRED on x.com). PEWTER is held.
- "Catcoin Sanctuary" must be masked before the pair-term check, because "catcoin" contains COIN (VERIFIED).
- The brand name is decision **D12**. "Catcoin Sanctuary" is recommended: the domain, the logo work and every kit text already use it.

### 3.4 The metadata JSON (permanent), its hosting, and commit and reveal

The shape mirrors StonkFun's own JSON (VERIFIED, RS §2 item 4), without `twitter` (decision **D4**). **The website is baked into this JSON and into nothing else**: the LaunchLab instruction carries only name, symbol and URI.

```json
{
  "name": "Patchpaw the Calico",
  "symbol": "PATCHPAW",
  "description": "<story> <disclosure full> A memecoin; it can lose all of its value. Launched by its adopter's own wallet; Catcoin Sanctuary does not vet adopters.",
  "image": "<PREFIX><imageTxId>",
  "external_url": "https://catcoinsanctuary.com/cat/patchpaw",
  "extensions": { "website": "https://catcoinsanctuary.com/cat/patchpaw" },
  "properties": {
    "category": "image",
    "files": [
      { "uri": "<PREFIX><imageTxId>",  "type": "image/png" },
      { "uri": "<PREFIX><bannerTxId>", "type": "image/png" }
    ],
    "links": { "website": "https://catcoinsanctuary.com/cat/patchpaw" }
  }
}
```

**Hosting.** The recommended default is **ArDrive Turbo** (Arweave), under decision **D3**.
- A JSON of 107,520 bytes or less is free. The free tier is 10 MiB for the lifetime of a wallet or IP (VERIFIED: `A/registry/arweave/turbo-upload-info.json`). Images and banners are paid, about $18 in total (VERIFIED prices, RR §7.2).
- **`<PREFIX>` is not fixed yet.** Turbo's own info names `https://turbo-gateway.com` as its gateway. `arweave.net/<id>` answers with a **302** to a per-id sandbox subdomain, which wsrv.nl (StonkFun's image proxy) follows to a 200 `image/png`. That was checked on an L1 id only (VERIFIED: `R/arweave-wsrv-check.txt`).
- **Stage 1 test upload.** The owner makes one free Turbo upload of a dummy JSON well under 107,520 bytes, from a throwaway key. It measures:
  - whether and when `https://arweave.net/<id>` resolves the data item;
  - whether `turbo-gateway.com/<id>` does;
  - whether wsrv.nl fetches an image through the chosen prefix.

  `<PREFIX>` is then fixed, `https://arweave.net/` if it works, and never varied, because the registry compares strings.
- **Irys** is StonkFun's choice and costs about 0.005 SOL, but its IDs do not resolve on `arweave.net` (VERIFIED: `A/registry/arweave/irys-vs-arweave-check.txt`). One well-formed Irys-hosted launch (NUVEX) still had StonkFun `imageUrl: null` after 18 h (VERIFIED: `R/null-image-recheck.json`), so a missing StonkFun image is StonkFun's issue and not a pass/fail gate.
- GitHub Pages is refused as a host: the owner could change files there after a sale.

**Commit and reveal: the fingerprint stays secret until the cat opens** (finding 2).

- **Why.** An exact copy needs the exact URI. If `metadataUri` is public days before a cat opens, anyone can mint permanent, indistinguishable copies early. They would carry our name, picture and website, and the registry could only file them as `too_early`.
- **Before opening (Stage 5, "freeze"):**
  1. Upload the **image and banner** PNGs from the **image key**, a dedicated key holding Turbo credits only.
  2. Write each JSON with their URIs, and render it byte-exactly.
  3. **Sign each JSON as a data item with a fresh JSON key** (one per opening batch), never used for anything else and never linked to the sanctuary by any tag, **but do not post it yet**. Its id, and therefore its URI, is known locally (INFERRED: Turbo accepts posting a pre-signed data item later; confirmed by the Stage 1 test).
  4. Commit to `data/kits.lock.json` only `metadataUriSha256` = sha256 of the exact URI string, plus `metadataJsonSha256`, `imageSha256` and `bannerSha256`. The URI itself stays off the repository and off the site.
  5. Simulate the page's transaction with the **real** URI locally, never in CI. The Action's daily guard uses an equal-length placeholder until opening.
- **At opening (Stage 8, for each batch):**
  1. Post the pre-signed JSON data items.
  2. Wait until `<PREFIX><id>` serves them, using the propagation time measured in Stage 1 plus a margin. Fetch them back through two gateways, **following redirects**, and compare the sha256 of the final body.
  3. Make **one commit** that sets `metadataUri`, `state: "open"` and `opensAt` for the batch. Its test checks sha256(metadataUri) == the locked `metadataUriSha256`.
  4. Pages deploys it.
- **Timing is unannounced.** No opening date or time is published in advance. The garden shows "Not open yet".
- **Residual, INFERRED:**
  - someone watching the public repository sees the reveal commit about 1–3 minutes before Pages serves it;
  - someone scanning new Arweave data items could find the JSONs during the propagation wait.

  Both windows are minutes long and are stated under D1.
- **Brute force is not a risk.** The URI contains a 43-character id derived from a signature, so its sha256 does not leak it (INFERRED from preimage resistance).

**URI.** `metadataUri` is `<PREFIX><43-char id>`, 63 bytes with the arweave.net prefix, well under the 200-byte cap. It is copied **byte for byte** into ix2's `uri`. The page never builds it.

**Freeze.**
- `data/kits.lock.json` holds the sha256 of each kit entry, excluding `metadataUri`, `state` and `opensAt`, plus the four hashes above.
- A test fails if a locked entry changes, or if a revealed `metadataUri` does not match its hash.
- The Adoptions Action refuses to commit if any `data/kits*.json` or `data/adoption-rules.json` changed (section 4.5).

**The website page must exist first.** `https://catcoinsanctuary.com/cat/<ticker>` must be live at exactly that URL, answering 200 with no redirect, before the JSON is signed. The URL is permanent in the metadata. GitHub Pages serves `cat/<ticker>.html` there (N7). Today it answers 404 (VERIFIED: `R/site-url-checks.txt`).

### 3.5 The `data/kits.json` schema

```json
{ "version": 2,
  "kits": { "PATCHPAW": {
      "state": "locked",
      "name": "Patchpaw the Calico", "symbol": "PATCHPAW",
      "quoteMint": "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", "quoteSymbol": "SPYx",
      "quoteTokenProgram": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      "metadataUri": null, "metadataUriSha256": "<hex>", "metadataJsonSha256": "<hex>",
      "imageUri": "<PREFIX><id>", "imageSha256": "<hex>", "bannerUri": "<PREFIX><id>", "bannerSha256": "<hex>",
      "website": "https://catcoinsanctuary.com/cat/patchpaw",
      "text": { "xPostWaiting": "…", "xPostAdoptedTemplate": "…{MINT}…", "xBio": "…", "xDisplayName": "…", "xHandleSuggestion": "…" },
      "assets": { "avatar": "assets/kits/PATCHPAW/avatar-400.jpg", "banner": "assets/kits/PATCHPAW/banner-1500x500.jpg",
                  "ogPlanned": "assets/kits/PATCHPAW/og-planned.jpg", "ogAdopted": null },
      "checks": { "contentRules": "pass", "heldChecked": true, "inputSha256": "<hex>", "checkedAt": "…" },
      "opensAt": null } } }
```

- `state` is one of `draft | locked | open`.
- **`opensAt: null` means closed.** A cat is open only when `state === "open"`, `opensAt` is set and not in the future, and `metadataUri` is set and matches its hash.
- Held tickers can never appear here: the build refuses them and a test checks it.

### 3.6 Rights to the kit art (D13, now required)

StonkFun's Terms make whoever launches warrant that the name, ticker, image and description are "yours to submit, and [do] not infringe … the intellectual property … of any third party", and indemnify StonkFun for any Submission (VERIFIED: `RH/stonkfun-terms-excerpts.txt`).

An adopter can make that warranty truthfully only if the sanctuary grants it the right to submit the kit. The cat page and the dialog therefore carry a written licence line (D13 picks the text). For example: "Catcoin Sanctuary grants the adopter of this cat a free, non-exclusive, permanent licence to use this cat's name, picture, banner and description for this coin and its social accounts."

Whether AI-generated images carry copyright at all is uncertain (INFERRED). The licence covers whatever rights the owner has.

---

## 4. Registry and data pipeline

This follows RR, but the registry no longer depends on the curve-rule feed (finding 1).

### 4.1 Sources

| Source | Use | Trust |
|---|---|---|
| Solana, through the Action and the **required** `SOLANA_RPC_URL` (a keyed RPC, section 4.5) | the authority for every accepted adoption | authority |
| **Epoch sweep, every run:** `getProgramAccounts(LaunchLab, dataSize 429, memcmp 173 = platform, memcmp 8 = u64le(E) or u64le(E−1), dataSlice(205,160))` | every standard pool created since the start of epoch E−1, with base mint, quote mint, vaults and creator. About 1.1 MB and 140 ms per call, 2 calls (VERIFIED, RR §2.2.2). **Spam cannot inflate it:** each entry is a pool costing about 0.0086 SOL of rent. | discovery |
| **Catch-up sweep** (only after a stall longer than one epoch): `getProgramAccounts(…, memcmp 237 = quote, memcmp 173 = platform, dataSlice(205,32))` per open stock, resumable across runs | completeness after an outage. SPYx: 785 pools, 451 ms, 213 KB (VERIFIED, RR §2.2.2). | completeness |
| Sliced `getMultipleAccounts(mints, dataSlice {302, 200})` | the name, symbol and URI of 100 mints in 253 ms (VERIFIED, RR §2.2.3) | kit match |
| `getSignaturesForAddress(pool)` paged to its oldest entries, then `getTransaction(v1)` | the creation transaction's `(slot, transactionIndex)`, fee payer and shape, **only for exact kit matches** | ordering and clauses 6–8 |
| `getTokenLargestAccounts(mint)` plus the owners of those accounts | holder concentration for adopted cats (section 4.4) | buy-link gate |
| **Curve-rule feed:** `getSignaturesForAddress(rule(stock))` | **the page only**, as a live hint with caps (section 4.7). Not used by the builder. | hint |
| StonkFun `/launches?since=`, `/launches?creator=`, `/tokens/{mint}` | the `stonkfunRecorded` status, the page's second race source and the wallet check. Never used for ordering: its lag is 14–460 s for self-built launches (VERIFIED, `V/recompute.out.txt`). | status and hints |

### 4.2 The rule: pool P adopts cat C when every clause holds (RR §3.1, extended)

1. P is owned by LaunchLab, its size is 429 bytes, and `P.platform_config = 4E876…gZL7` (standard, not reward).
2. `P.quote_mint = C.quoteMint`.
3. P's mint TokenMetadata has **name and symbol byte-equal to C's kit, and a URI whose sha256 equals C's `metadataUriSha256`**. After the reveal, the URI is also compared byte for byte with `metadataUri`. The URI is the fingerprint. Hashing lets the builder recognise a copy made before the reveal without the URI being public.
4. The mint's `update_authority = WLHv2…VVh`. Its extensions are exactly [MetadataPointer, TokenMetadata] (no TransferFee). Its mint and freeze authorities are None, `base_decimals` is 6, `migrate_type` is 1 and supply is 1e15.
5. `P.global_config` is a LaunchLab GlobalConfig whose quote mint is C's stock.
6. **The creation transaction** is the earliest of P's oldest signatures (at most the 3 oldest are read) whose LaunchLab `initialize_with_token_2022` creates P. It is `finalized` with `err: null`, and is read with `getTransaction(maxSupportedTransactionVersion: 1)`, because v1 transactions exist (VERIFIED).
7. **`P.creator` equals that transaction's fee payer.** This is required because LaunchLab does not make the creator sign (VERIFIED, simulation D).
8. **The creation transaction only creates the coin** (new; `adoption-rules.json` `creationTx: "init_only"`, the default):
   - its top-level instructions are at most 2 ComputeBudget instructions, exactly one LaunchLab `initialize_with_token_2022`, and optionally SPL Memo and Lighthouse assertions (program ids pinned);
   - no LaunchLab `buy_*` or `sell_*` appears anywhere, inner instructions included, and no other program runs at the top level;
   - inner instructions are only those the initialize performs itself (Token-2022 and System; the logs show `InitializeAccount3`, `InitializeMint2`, `MintTo`, `SetAuthority`).

   **Why:** 37 of 72 recent launches carried a trade inside the creation transaction (VERIFIED: `R/feed-recorded.out.json` `hasBuy`). In the SPYx sample, `EkKE99…` and `3PBkfy…` ran `BuyExactIn`, `5DWD4…` ran `Trade` plus `SwapV2`, `4Qutq1…` ran `SwapV2`, and `3gytEW…` swapped before the init (VERIFIED: `S/curve-rule-feed-probe.out.json`, `V/recompute.out.txt`). A sniper's bundled buy must not become the sanctuary's cat. The page's own transaction always meets this clause. Launches routed through a CPI (a router program at the top level) are also refused.
9. **Timing and limits:** the creation slot is at or after the cat's `opensAt` (else `too_early`), and P passes the limits in section 4.4.
10. P is the **first** pool meeting 1–9 for C in `(slot, transactionIndex)` order.

**The adopter is `P.creator`.** That is also the wallet StonkFun forwards the creator share to (VERIFIED quote, RS §4.1).

**Lookalikes** are pools on the same stock with the same name or symbol but a different URI. They are recorded as `lookalikes`, shown as a warning, and never counted.

### 4.3 First wins, and the states

- **Order** by the creation transaction's `(slot, transactionIndex)` at `finalized`. Never by StonkFun's `createdAt`, which can reverse the chain order (VERIFIED, RR §4.4). Stage 6 must confirm that the keyed RPC returns `transactionIndex`. If it does not, use `getBlock` to find the position (INFERRED fallback).
- **A winner is written `adopted` only after a later run.** The next run's sweep (snapshot slot > winner slot) must show no earlier valid pool. After that the entry is **never changed automatically**. An earlier pool found later stops the builder, and the owner fixes it by a public commit (RR §4.3).
- **States:**

| State | Where it lives |
|---|---|
| `open` | `adoptions.json` |
| `adopted` | `adoptions.json` |
| `notThisCat` entries with a reason: `later` (valid but after the winner), `over_limit`, `too_early` (before the reveal), `shape_refused` (clause 8), `withheld` | `adoptions.json`, each with mint and slot, capped at 20 per cat. **Listed on the cat page under "Not this cat"** (finding 29). No buy links. |
| `paused` (a daily simulation or shape check failed) | `adoptions.json` |
| `pricingUnavailableSince` (pricing 503 after the retries) | `adoptions.json`; temporary, not a pause |
| `lookalikes` | `adoptions.json` |
| `moving_in` | **client only**, never in the file |

### 4.4 Limits and gates (owner decision D1, D19)

- **Squatting.** Squatting every adoptable cat costs about 0.0087 SOL each, about 0.72 SOL for 83 (INFERRED from the per-launch cost). Squatters gain creator-fee forwarding.
- **Configurable in `data/adoption-rules.json`:**
  - `perWalletPer24h: 1`, applied in global chain order. The recommended default, with the page's wallet check (section 4.7).
  - `creationTx: "init_only"` (clause 8). This is the default and replaces the old `maxCreatorBuyPctOfSell: null`.
  - `buyLinks: { maxSingleHolderPct: 5, maxTop10Pct: 20 }` (D19; the numbers are INFERRED placeholders).
  - `computeUnitPriceMicroLamports: 50000` (cap 200,000).
  - `withheld: [{mint, reason}]`, edited by hand and shown publicly.
  - `stonkfunTermsVersion: "2026-09-18"`. The owner re-checks it by hand before every opening and weekly. The Action does not scrape StonkFun's site, whose Terms forbid automated access except through the public API (N8). If the version changes, the owner sets `paused: "terms_changed"` until the dialog text is reviewed.
- **The holder-concentration gate on buy links** (finding 3):
  - A sniper can launch without a bundled buy and buy in a separate transaction in the same slot. That cannot be attributed (RR §6).
  - So for each adopted cat, the builder reads `getTokenLargestAccounts(mint)` at acceptance, hourly for 72 h, then daily. It excludes token accounts owned by the LaunchLab vault authority `WLHv2…` or by the Raydium CPMM authority after migration (id pinned in Stage 6, INFERRED).
  - It writes `holders: {creatorPct, maxOtherPct, top10Pct, checkedSlot, buyLinks}`.
  - Buy links are shown only when `buyLinks` is true. The card always shows the creator's share.
  - `getTokenLargestAccounts` runs in the Action, not the page, because publicnode's support for it from our Origin is unverified.
- **These limits are weak against many wallets.** The Adopt dialog says so plainly.
- **What a static site cannot do:** prove that a launch came through our page, reserve a cat, or limit a person rather than a wallet (INFERRED, RR §6).

### 4.5 The builder and its schedule

**New workflow `.github/workflows/adoptions.yml`:**
- `schedule: cron "3-58/5 * * * *"` plus `workflow_dispatch`.
- **Its own concurrency group:** `concurrency: { group: adoptions, cancel-in-progress: false }`. Collection keeps its own `collection` group.
  - The two write **disjoint files**. Each push uses the fetch, rebase and retry already in `collection.yml` (VERIFIED: `RSF/site-collection.yml.copy-1929Z`), so a rebase cannot conflict.
  - This replaces the pre-revision shared group. With the default `queue: single`, an Adoptions run every 5 minutes would cancel a pending Collection run (VERIFIED docs: `R/gh-concurrency.md` lines 11 and 17).
  - A shared group with `queue: max` is the documented alternative, if the file sets ever overlap.
- **No `npm` in this workflow.** The builder is plain Node (global `fetch`), and the site has no dependencies (section 5.5).
- **Two jobs:**
  1. `build`, with `contents: read`, runs `node scripts/build-adoptions.mjs` and uploads the two output files as an artifact.
  2. `commit`, with `contents: write`, downloads them and commits **only** `data/adoptions.json` and `data/adoptions-state.json`. It:
     - runs `git add -- data/adoptions.json data/adoptions-state.json`;
     - refuses (exit 1) if `git status --porcelain` shows any other path, especially `data/kits*.json` or `data/adoption-rules.json`;
     - commits with `git -c core.hooksPath=/dev/null commit --no-verify`, and pushes the same way.
- The actions are pinned to SHAs, like the existing workflows.
- **`SOLANA_RPC_URL` is required**: a keyed RPC, a repository secret, **never** the page's key (D11). The job fails fast without it.
  - Nobody has yet run this RPC load from a GitHub-hosted runner. The live repository has only `pages.yml` and one run (VERIFIED: `R/gh-actions-workflows-live.json`, `R/gh-actions-runs-live.json`).
  - The public RPC throttled at about 1.6 req/s and blocked by provider in the research probes (VERIFIED: RR §2.3, `A/registry/chain/_probe-chain4.out.json`).
- **Deploys.** After a data commit, Pages deploys through `pages.yml`'s `workflow_run.workflows: [Collection, Adoptions]`, whose `check` job deploys only if the run committed. A push made with the workflow token starts no other workflow (VERIFIED: `RSF/site-pages.yml.copy-1929Z`). Pages' 10-builds-per-hour soft limit does not apply to custom Actions deploys (VERIFIED: `R/gh-pages-limits.md` line 23).

**Limits of scheduled runs** (VERIFIED from GitHub's docs, RR §5.3):
- the shortest interval is 5 minutes;
- runs can be delayed or dropped;
- schedules are **disabled after 60 days** with no repository activity.

The hourly heartbeat commit (step 9) also keeps the repository active. INFERRED that a bot commit counts as activity; check this in Stage 6.

**`scripts/build-adoptions.mjs` steps.** A typical run makes about 10–20 calls. There is a **hard cap of 150 RPC calls per run**, with exponential back-off on 429 and 5xx (1, 2, 4, 8, 16 s; at most 5 tries per call).
1. `getSlot(finalized)` gives S and the epoch E.
2. **Epoch sweep** (2 calls). If the last complete run was more than one epoch ago, switch to the catch-up sweep for open and locked stocks. It is resumable, with at most 40 calls per run.
3. Keep pools whose quote is a stock with a `locked` or `open` kit. Keep a rolling set of already-classified pool addresses for epochs E and E−1 only (about 2 × 900 on our pairs, VERIFIED counts, RR §2.2.2).
4. For new pools: sliced `getMultipleAccounts` of their mints, 100 per call. Keep exact kit matches (clause 3, by hash before the reveal) and record lookalikes.
5. For each exact match: `getSignaturesForAddress(pool, {limit: 1000, commitment: "finalized"})`, paging with `before` to the oldest entries (at most 5 pages per candidate per run, with a stored cursor). Then `getTransaction(v1)` on the oldest ≤ 3 for clauses 6–8.
6. A full `getMultipleAccounts([mint, pool, global_config])` for clauses 1–5.
7. Apply the ordering, the limits and the two-run confirmation. Never drop an `adopted` cat.
8. Holder checks for adopted cats as scheduled (section 4.4). At most 20 per run, oldest check first.
9. **Write `data/adoptions.json` atomically.** Commit when `cats`, `withheld`, `holders` or `health` changed, **or** when the last commit is 60 minutes old or more (heartbeat). Either way `generatedAt` and `snapshotSlot` are refreshed. That makes at most about 24 heartbeat deploys a day, plus changes.
10. **Daily simulation guard.** For every `locked` or `open` cat, run the `scripts/simulate-adopt.mjs` logic: the exact page build, with the owner's **public** address as the payer, `sigVerify:false` and `replaceRecentBlockhash:true`. Locked cats use an equal-length placeholder URI.
    - Pricing 503: retry 3 times, 30 s apart, then set `pricingUnavailableSince`. This is not a pause.
    - Any other failure sets `paused: "<clause>"`, so the page disables Adopt before any user is asked to sign.
11. **Health.** If the call cap is hit, a step throws, or back-off is exhausted:
    - write `health: {ok: false, reason, at}`;
    - commit that alone;
    - exit non-zero, so the run shows as failed. GitHub emails the owner about failed scheduled runs (INFERRED default).

    The page treats `health.ok === false`, or a `generatedAt` older than 120 min, as "registry behind" and disables Adopt.

**What it reuses.** It reuses the site's `scripts/lib/rpc.mjs` pattern. It **does not reuse** `proveLaunch` (`site/scripts/lib/chain.mjs`), which refuses v1 and CPI launches and unlisted wallets (VERIFIED, RR §3.4). The new state-based checker is `scripts/lib/adopt-chain.mjs`.

**Recommended for Collection too, outside this feature:** the same commit hardening (hooks off, `--no-verify`, add only owned files). `collection.yml` today runs `npm ci` with `contents: write` (VERIFIED). That is harmless while the site has zero packages, and the test in section 7.1 keeps it that way.

### 4.6 Files

- **`data/kits.json`:** section 3.5; locked, and revealed at opening.
- **`data/kits.lock.json`:** section 3.4.
- **`data/adoption-rules.json`:** section 4.4.
- **`data/adoptions.json`** (validated like `collection.json`: base58 lengths, https-only, no HTML, lists capped at 20):

```json
{ "version": 2, "generatedAt": "…Z", "snapshotSlot": 450437442,
  "health": { "ok": true, "reason": null, "at": "…Z" },
  "stonkfunTermsVersion": "2026-09-18",
  "cats": { "PATCHPAW": { "status": "adopted", "mint": "…", "pool": "…", "creator": "…", "tx": "…",
      "slot": 450416570, "txIndex": 721, "time": "…Z", "stonkfunRecorded": true,
      "holders": { "creatorPct": 0, "maxOtherPct": 1.2, "top10Pct": 6.5, "checkedSlot": 450437000, "buyLinks": true },
      "paused": null, "pricingUnavailableSince": null,
      "notThisCat": [ { "mint": "…", "reason": "later", "slot": 450416901 } ],
      "lookalikes": [] } },
  "withheld": [] }
```

- **`data/adoptions-state.json`:** `{classifiedPoolsByEpoch, candidateCursors, lastCompleteRunSlot, lastCommitAt, lastRunAt, refused[100]}`. Excluded from the deploy, as `collection-state.json` is today.

### 4.7 Live checks in the page (the gap before the registry commits)

**Race check** (before signing; again at `finalized` for our own launch). It returns `free`, `taken`, `moving_in` or `unknown`. **`unknown` is never treated as free.**

```
race(C):
  a = GET data/adoptions.json {cache:"no-cache"}          // the CDN copy can be up to 10 min old (VERIFIED, RR §5.5)
  if !a.health.ok or now − a.generatedAt > 120 min → unknown ("registry behind")
  if a.cats[C].status == "adopted" → taken
  // source 1: the curve-rule feed, at confirmed, paged back to the snapshot
  sigs = []; before = none
  repeat up to 3 times:
    r = getSignaturesForAddress(rule(C.quote), {limit: 100, before, commitment: "confirmed"})   // publicnode
    sigs += r
    if r.length < 100 or last(r).slot <= a.snapshotSlot: break
    before = last(r).signature
  if the snapshot was not reached → unknown
  newer = sigs where slot > a.snapshotSlot and err == null
  if newer.length > 12 → unknown ("unusual activity on this stock")
  for s in newer: t = getTransaction(s, {commitment:"confirmed", maxSupportedTransactionVersion: 1})
                  if t has a LaunchLab initialize_with_token_2022 → candidate mint
  // source 2: StonkFun, which records only real launches, so spam cannot inflate it
  L = GET /launches?since=<a.generatedAt − 10 min>&pageSize=100   (at most 2 pages; an error → unknown)
  candidate mints += L where quote.mint == C.quoteMint and name == C.name and symbol == C.symbol
  // confirm
  if candidates: getMultipleAccounts(mints, {commitment:"confirmed", dataSlice {302, 200}})
     any exact kit match → moving_in (with that mint)
  → free
```

- The page derives `rule(C.quote)` and compares it with check 3's `curveRule.standard`.
- Normal cost is about 4–6 calls. With the hourly heartbeat, the snapshot is normally at most about 70 minutes old. SPYx, the busiest stock sampled, had about 1.5 launches an hour (VERIFIED, `S/curve-rule-feed-probe.out.json`).
- **What spam can do now:** force `unknown` (Adopt disabled) for as long as the attacker keeps paying. About 13 entries between heartbeats cost 65,000 lamports (INFERRED). That is a nuisance, not a loss of anyone's money.
- **Share** is gated by the same check at `finalized`: our launch must be the earliest kit match found.

**Wallet check** (when D1(b) is on; before signing). It returns `clear`, `over_limit` or `incomplete`.
1. Look for an accepted adoption by A with `time` in the last 24 h in `adoptions.json`, and in `localStorage.adoptPending` entries for A.
2. `GET /launches?creator=A&since=<now − 24 h>` (StonkFun; its lag is up to 460 s). For entries whose quote, name and symbol match any kit, confirm the URI with a sliced `getMultipleAccounts`.
3. For the last 10 minutes, which StonkFun may not yet show: `getSignaturesForAddress(A, {limit: 50, commitment:"confirmed"})` (publicnode, VERIFIED allowed from our Origin). Then `getTransaction` for the entries with `blockTime` in that window and `err: null`, **at most 10**. Any LaunchLab initialize with a kit URI counts. More than 10 such entries gives `incomplete`.
- `over_limit` blocks Adopt. `incomplete` shows the extra checkbox (section 2.2).

**Everyone else:** the garden makes **no** third-party call on load. Only opening a card whose cat is `open` runs the race check, so visitors see "Moving in…" when it applies.

**Own launch:** `getSignatureStatuses`, then clauses 1–4, 7 and 8 on `getMultipleAccounts([pool, mint])` and our own known transaction.

**Framing:** `assets/ui/adopt.js` refuses to open the dialog's wallet steps when `window.top !== window.self`. GitHub Pages sends no `X-Frame-Options` or CSP header, and a meta CSP cannot carry `frame-ancestors` (VERIFIED: `RSF/site-headers.txt`, `RSF/site-excerpts.txt`).

### 4.8 How the 3D world reads it

- **`assets/residents.js`** also fetches `data/kits.json`, `data/adoptions.json` and `data/adoption-rules.json` (relative URLs), and validates them in the new pure module `assets/adoptions.js`.
  - It gives each planned cat one of these statuses: `adopted | open | not_open | paused | pricing_unavailable | registry_behind | no_kit`. Held cats are `no_kit`.
  - For `adopted`, it adds `token: {status:"adopted", mint, pool, tx, adopter, adoptedAt, stonkfunRecorded, holders}`, `explorer`, and `buy: buyLinks(mint)` **only when `holders.buyLinks`** is true.
- **Precedence.** A kit's resident is decided **only** by `adoptions.json`. A Collection launch by a listed wallet that matches pair and ticker but not the kit URI shows as a token of its own. Cats without a kit keep today's Collection rule. INFERRED design; the owner can fold Collection in later.
- **`assets/world/cats.js` and `catviews.js`.** Adopted cats get the existing gold coin, and the hover tag becomes "Adopted by `3J57…iji3`". Open cats get the tag "Up for adoption (memecoin)". A client-side `moving_in` overlay adds a soft sparkle and the tag "Moving in…".

---

## 5. Files, libraries and size budget

### 5.1 New modules in the page

All are plain ES modules with no build step, **loaded only when Adopt is opened**, through a relative `import()`.

| Path (under `site/`) | What | Source |
|---|---|---|
| `assets/adopt/constants.js` | program ids (LaunchLab, ComputeBudget, Memo, Lighthouse as observed in Stage 4), PDA seeds, `STONKFUN_SHAPE`, discriminator, caps (250k CU, 50k µL default, 200k µL cap, 15M lamports), race and wallet-check caps | port of `cia/bots/lib/verified.mjs` and `stonkfun.mjs` |
| `assets/adopt/bytes.js` | base58, compact-u16, borsh writer and bounded reader | port of `cia/bots/lib/solana.mjs` |
| `assets/adopt/ed25519.js` | a thin wrapper over the vendored `@noble/ed25519` 3.2.0 (`signAsync`, `verifyAsync`, `getPublicKeyAsync`, and `Point.fromHex` for the PDA on-curve check with zip215 semantics, as web3.js uses). SHA-256 and SHA-512 come from `crypto.subtle`. | new, thin |
| `assets/adopt/keys.js` | the mint-key holder: WebCrypto non-extractable Ed25519, or the noble seed; the public-key assertion; drop on resolve | new |
| `assets/adopt/solana.js` | PDA find, legacy message compile, serialize and parse, signature slots, ComputeBudget instructions | new; checked against committed byte fixtures (section 7.1) |
| `assets/adopt/launchlab.js` | `initializeAccounts`, `encodeInitialize`, `decodeInitialize`, and decoders for PlatformConfig, GlobalConfig, CurveRule, PoolState and the TokenMetadata slice | port of `cia/bots/cashcat/stonkfun.mjs` |
| `assets/adopt/plan.js` | checks 1–4 for one kit, including the pricing-503 state | port of `planStonkfunLaunch` (without its `src/lib/config.mjs` import; RL §9) |
| `assets/adopt/txcheck.js` | `readMessage`, `checkLaunchMessage`, `checkSimulation`, `sameMessage`, `allowedDelta` | port of `cia/bots/lib/txcheck.mjs` (StonkFun part only) and `cia/src/lib/tx.mjs` |
| `assets/adopt/net.js` | **the only file naming external hosts**: `https://www.stonkfun.xyz/api/public/v1` (never the apex, which answers 308 with no CORS, VERIFIED) and the RPC list (publicnode plus the D11 sender); timeouts, JSON shape checks, 429 and `retryAfterSeconds` back-off | new |
| `assets/adopt/wallets.js` | discovery (vendored `@wallet-standard/app`), feature and chain checks, connect, Paths S, S′ and P as allowed by `wallet-paths.js` | new |
| `assets/adopt/wallet-paths.js` | the pinned per-wallet table from Stage 4 | new, data |
| `assets/adopt/race.js` | the race check and the wallet check (section 4.7) | new |
| `assets/adopt/flow.js` | the pure state machine for sections 2.1–2.2, with RPC, API, wallet and key injected, so it can be tested with doubles | new |
| `assets/adopt/copy.js` | **every adopter-facing string**, including the required statements in section 6 | new |
| `assets/adopt/xkit.js` | X intent URLs (fills `{MINT}` only after base58 validation), profile kit text | new |
| `assets/ui/adopt.js` | the dialog DOM, `textContent` only; the frame check | new |
| `assets/adoptions.js` | pure validators and the status merge for `kits.json`, `adoptions.json` and `adoption-rules.json`, shared by the page and Node, as `collection.js` is today | new |

### 5.2 Changes to existing files

- **`index.html`:**
  - CSP `connect-src 'self' https://www.stonkfun.xyz https://solana-rpc.publicnode.com` (plus the D11 host);
  - `<dialog id="adopt">`;
  - the legend badges.
  - **Footer copy.** The paragraph "A cat is not launched yet until the sanctuary's keeper launches it…" is replaced by: "A cat becomes a coin in one of two ways. Either the sanctuary's keeper launches it from a wallet listed on this site, or someone adopts it: an independent adopter, not Catcoin Sanctuary, launches it on StonkFun from their own wallet, and the sanctuary's registry finds that launch on Solana. The sanctuary does not vet adopters, and StonkFun may pay a coin's creator part of its trading fees. Buy links appear on a card only after that, and are hidden while a few wallets hold much of the supply."
  - A privacy line: "Adopting calls StonkFun's public API and a public Solana RPC from your browser. An adopter's wallet address is published on the site and kept in its public history."
  - The inline import map (`three`) is unchanged, so the CSP script hash stays.
- **`assets/residents.js`, `assets/ui/card.js`, `assets/ui/main.js`:** the `#adopt=<T>` route, the lazy import, the Adoption panel section and its separator. Also `assets/world/cats.js`, `assets/world/catviews.js` and `assets/site.css`.
- **`tests/page.test.mjs`:**
  - Replace "`connect-src` allows no other host" with an **exact allow-list** test.
  - "Only `assets/adopt/net.js` may contain an `https:` fetch target."
  - "residents fetches exactly [collection, planned, wallets, kits, adoptions, adoption-rules]".
  - **Every `*.html` file** in the deploy tree, not only `index.html`, has the same meta CSP, no inline script other than the hashed import map, and no HTML sinks.
  - **URL-sink rule:** any `href` or `src` set from data comes only from `buyLinks(mint)`, `solscanTx(sig)`, `solscanToken(mint)` or `stonkfunToken(mint)`, and each validates base58 lengths.
  - The `vendor` directory is still skipped by the sink scan, but it is covered by the byte tests.
  - Keep every existing HTML-sink rule.
- **`.github/workflows/pages.yml`:**
  - `workflow_run.workflows: [Collection, Adoptions]`;
  - rsync must also exclude `/data/adoptions-state.json`, `/kits-src` and `/vendor-src`;
  - the deploy asserts that `data/kits.json`, `data/adoptions.json` and one `cat/*.html` exist;
  - the deploy job keeps running **no npm** (VERIFIED today).
- **`.github/workflows/collection.yml`:** keep its own group (section 4.5); the commit hardening is recommended.
- **`README.md`:** the new "How adoption works", the rules, the hosts called, the eligibility statement, and the upload and reveal procedure.

### 5.3 New static pages and assets

- **`cat/<ticker>.html`**, one page per cat with a kit, written by `scripts/build-cat-pages.mjs`. Each has:
  - **the same meta CSP as `index.html`**, with `connect-src 'self'` (the page calls no third party) and no inline script;
  - per-cat `<title>`, `og:*` and `twitter:*` tags using `og-planned.jpg`, or `og-adopted.jpg` once adopted;
  - the story, the kit, the disclaimer, "Not an animal charity: no real cat is involved.", the licence line (D13), and the xStocks or PreStocks issuer line;
  - "Open in the garden" (`/#cat=<T>`) and "Adopt" (`/#adopt=<T>`);
  - a small module (a separate file, not inline) that reads `data/adoptions.json`. It shows **the resident mint** prominently, the third-party creator line, and a **"Not this cat"** list of `notThisCat` and `lookalikes` mints with their reasons.
  - **These pages are permanent.** A test asserts that every `kits.json` website maps to an existing file.
- **`assets/kits/<T>/{avatar-400.jpg, banner-1500x500.jpg, og-planned.jpg, og-adopted.jpg}`**: about 0.4 MB per cat.

### 5.4 Node scripts and the upload tool

`scripts/` is never shipped: it is excluded from the deploy. **None of these scripts imports a package.**

- **`scripts/build-kits.mjs`:** validates the kit sources in `kits-src/<T>/` (limits, sha256, templates, **not in `held.json`**), writes the draft JSONs, and imports the check results produced by the text checker, which uses CIA's `content-rules.mjs`. Those results are committed as data, so CIA's code is never imported in CI.
- **`scripts/build-cat-pages.mjs`**, **`scripts/build-adoptions.mjs`** with **`scripts/lib/adopt-chain.mjs`**, and **`scripts/simulate-adopt.mjs`**. The last one is read-only. It refuses any method outside the reads and `simulateTransaction` with `sigVerify:false`, as `…/adopt/tools/rpc.mjs` does.
- **The upload tool is not in the site repository.** It is `kit-upload/`: a separate folder or private repository that no workflow installs, with its own lockfile and `@ardrive/turbo-sdk` pinned. Version 2.1.0 pulls in `@solana/web3.js ^1.95.5`, ethers, viem, axios and arbundles (VERIFIED: `RSF/turbo-sdk-latest.json`).
  - The owner runs it locally after `npm ci --ignore-scripts`. INFERRED that the SDK works without install scripts; check this in Stage 1.
  - It refuses to run when `process.env.CI` is set.
  - Its keys hold **Turbo credits only**, never a funded SOL wallet (INFERRED that credits can be bought by card).
  - It outputs `kits.lock.json` entries and the pre-signed JSON data items, which are kept outside the repository until opening.

### 5.5 Third-party code (pinned, self-hosted, vendored byte for byte)

**The site's `package.json` stays dependency-free.** Today `package-lock.json` has only the root package (VERIFIED: `RSF/site-excerpts.txt`). A test asserts that `packages` stays `[""]`.

The reason: `@solana/web3.js` was hijacked in December 2024 to exfiltrate private keys (VERIFIED: `RSF/osv-web3js-1.95.6.json`, GHSA-jcxm-7wvp-g6p5 / CVE-2024-54134). Its closure in CIA's lockfile is 50 packages, including install scripts (VERIFIED: `RSF/cia-web3js-closure.txt`). Any job that runs `npm ci` with `contents: write` and the token could then rewrite `kits*.json` or plant a git hook.

| Library | Version | Licence | How it is shipped |
|---|---|---|---|
| `@noble/ed25519` | **3.2.0** | MIT | `assets/vendor/noble-ed25519-3.2.0/index.js`, **byte for byte** from the npm tarball: 39,841 bytes, no imports, no dependencies, npm provenance. It exports `sign`, `signAsync`, `verify`, `verifyAsync`, `getPublicKey(Async)` and `Point`. File sha256 `a4f631d1…569a`; tarball sha512 equals the registry `dist.integrity` `sha512-criDgRln…bPQ==`. VERIFIED: `RSF/ned/package/index.js`, `RSF/_noble_ed25519_latest.json`, `V/noble-ed25519-hashes.txt`. **No esbuild step.** |
| `@wallet-standard/app` | **1.1.1** | Apache-2.0 | `assets/vendor/wallet-standard/app-1.1.1.js`, byte for byte from `lib/esm/wallets.js` (6,372 B, no imports; sha256 `36155c77…ed97`), plus LICENSE. Its tarball sha512 equals the registry integrity (VERIFIED: `RSF/wsapp-1.1.1-registry.json`). |
| `@solana/web3.js` | — | — | **Not in the site repository at all.** Reference transactions are generated once, outside this repository, in CIA's checkout with its lockfile's 1.98.4. They are committed as byte fixtures with the generator script's path and version recorded (section 7.1). |

- **Tarballs for the byte tests.** The two npm tarballs are committed under `vendor-src/`, which is excluded from the deploy.
- **Provenance.** `vendor-src/PROVENANCE.json` records each tarball's registry URL, `dist.integrity`, the path inside the tarball, and the sha256 of the vendored file.
- **The same rule applies to every vendored file, three.js included**, when it is next touched.

**Why not ship web3.js?** RL measured a 336–432 KB minified browser bundle. The page needs only ed25519, sha256, PDAs and a legacy message, which is about 10× smaller. INFERRED.

### 5.6 Size budget

| Part | Budget | Loaded |
|---|---|---|
| Garden page JS and CSS | **+≤ 8 KB** (card panel, tags) | always |
| `assets/adopt/*`, `assets/ui/adopt.js` and the vendored noble ed25519 and wallet-standard | **≤ 100 KB** (noble 39,841 B, VERIFIED; wallet-standard 6,372 B, VERIFIED) | only on Adopt |
| Data files (`kits.json` about 83 × 1.6 KB; `adoptions.json` ≤ 150 KB, lists capped) | ≤ 300 KB | always (small) |
| Kit images on the site | about 33 MB total, about 0.4 MB per cat | on demand |

A test asserts the byte budgets of `assets/adopt/**` and the vendored files.

---

## 6. Safety and honesty

**Eligibility (D0)**
- The dialog states StonkFun's Restricted User clause verbatim, with its version, and requires the 18+ and not-restricted checkbox (section 2.1).
- The page does not geo-block. It cannot do so without a server, and it says so.
- **The owner's own Stage 7 test launch must meet the same eligibility.**

**Non-custodial**
- The sanctuary never holds, asks for or stores a user key, seed phrase or funds.
- The only key the page creates is the mint keypair for one attempt. It stays in memory, non-extractable where the browser supports it, and is dropped when the attempt resolves. It is never persisted, logged or sent.
- There is no server, no relay and no co-signer.

**One narrow approval**
- One transaction, with exactly the shape in section 1.3. The only accepted wallet changes are the allowed delta.
- No `signMessage`, `signAllTransactions`, token approvals, delegate or transfer instructions.
- The decoded summary and the simulation result are shown **before** the wallet opens.
- The compiled bytes are re-checked after building and again after the wallet signs. The page sends only its own message, or the verified allowed-delta message.
- The dialog names the signing path. Nothing falls back silently.

**No fees**
- The adopter pays rent and network fees only (about 0.0087 SOL, exact from the simulation; about 0.0085 SOL of it is rent that is never returned).
- LaunchLab's launch fee is 0 (VERIFIED). There is no dev buy.
- The sanctuary receives nothing, and the page states that.

**No free text**
- The adopter cannot change the name, ticker, image, description or website. Everything comes from the pre-reviewed kit.
- The only runtime value inserted into text is a base58-validated mint in the X post.

**Content rules**
- Every kit text is checked offline at freeze with CIA's `checkProposal` (people, brands, endorsement, tragedy, minors, sexual, hate, identity, politics, financial promises, links; formats; "must be a cat"). The pair and other-pair terms, `LAUNCH_CLAIMS` and the no-hype list are also checked. The revised templates pass for 50 of 50 drafted cats (VERIFIED: `V/text-v2-check-issuer-xStocks-prestock.out.json`).
- Images come from the no-text, no-logo recipe, with a human review for likeness to company mascots.
- **A company's own cat or mascot is never a coin's picture or name.** This is enforced by `held.json` in the kit build and the freeze test.

**Disclosures**

On the card, the Adopt dialog, the cat page and the permanent description, and in shortened form in the X posts and bio:
- "memecoin", and in the dialog and on the cat page "not an animal charity; no real cat is involved";
- not affiliated with the company, the stock token's issuer (xStocks, Backpack Securities or PreStocks) or StonkFun. The wording is D2.
- no intrinsic value, and it can lose all of its value;
- not financial advice;
- "a cat coin priced in <stock>", not the stock (the disclosure slot);
- **launched by an independent adopter's own wallet, not by Catcoin Sanctuary; the sanctuary does not vet adopters; the creator may receive fees** (the card, the footer, the cat page and the description; the posts say "I'm its creator, so fees may come to me"; the bio says "Run by its adopter").

**Plain statements on the Adopt dialog** (in `copy.js`, and asserted by test 13):
- "This coin can lose all of its value and may never be traded."
- "About 0.0085 SOL is rent kept by the coin's accounts and never returned … not refunded, even if someone else's launch wins."
- "StonkFun decides whether to list your coin and whether to forward any creator fees. That is not guaranteed, and the sanctuary cannot promise it."
- "You will be the coin's creator on Solana (Raydium LaunchLab, on StonkFun's platform)."
- "If another launch wins, your coin still carries this cat's name, picture and our website forever, and our page will list it as not this cat."
- "Your wallet address will be shown publicly as this cat's adopter … and kept in the site's public history."
- "Not an animal charity; no real cat is involved."
- The permanent fields.
- First confirmed launch wins. Anyone can launch this kit, bots included, and bots are usually faster.
- The limits, and that they are weak against many wallets.
- A launch that also buys in the same transaction does not count.
- StonkFun shows no website or X links for coins launched this way.
- The stock token's issuer can freeze or seize tokens in the pool's stock vault, and the logs say so (VERIFIED, RL §7).
- For PreStock cats, the stock charges a transfer fee: 1% now, 3% from epoch 1043 (VERIFIED, RL §7), if D6 opens them.
- The eligibility statement (D0) and the licence line (D13).

**What we never claim**
- earnings, returns, price, market cap or "guaranteed";
- that creator fees will arrive. If D8 mentions them at all: "StonkFun says it forwards a creator share, paid in the stock token; this is StonkFun's promise, not the sanctuary's".
- "official", "partner", "backed", "LP locked or burned", "fair launch";
- that the coin is or represents the stock;
- that the sanctuary endorses a cat's adopter or buyers, or has vetted them;
- that "adopted" means ownership of anything but the creator role of that coin;
- that an adopter's X account is run by the sanctuary.

**No impersonation**
- The X profile kit uses the cat's own name, and the bio says "Run by its adopter".
- The banner says "a memecoin · catcoinsanctuary.com/cat/<t>", not "lives at" (finding 24).
- The handle is only a suggestion.
- Nothing says "official" or implies the account is run by the sanctuary.
- The kit never uses a real person, company logo, trademark, or a company's or real person's cat.

**Reputation**
- A comparable third-party StonkFun launcher currently shows a Cloudflare "Suspected Phishing" page (VERIFIED, RS §9). Transparency is the defence: the decoded summary, the public rules and the source on GitHub.
- Before opening, submit the domain to Phantom's domain review (the form is linked in `S/developer-powertools_domain-and-transaction-warnings.md`), because new domains get warnings.
- The adoption flow refuses to run inside a frame.

**Privacy**
- Only the Adopt dialog, and a card whose cat is open, call third parties (StonkFun and publicnode). The garden and the cat pages stay same-origin.
- An adopter's wallet address is published in `adoptions.json` and committed to the public repository permanently. The dialog says so before signing.
- `localStorage` holds only `{sig, mint, wallet, at}` pending notes.

---

## 7. Test plan

### 7.1 Unit tests with recorded fixtures (`site/tests/adopt-*.test.mjs`, `node --test`, offline, no packages)

**Fixtures** in `site/tests/fixtures/adopt/`:
- copied from CIA: `launch-samples.json` (6 real launches, **raw transaction bytes included**), `launchlab-idl-subset.json`, `accounts.json`, `2026-09-25/api-*.json` and `pricing/*`;
- copied from the research:
  - `A/reencode-check.json`, `A/chain-mint-extensions.json`;
  - `A/registry/chain/mints-metadata-slice-100.json`, `A/registry/chain/tx-creation*.json` (v0 and v1);
  - `S/curve-rule-feed-probe.out.json`, `S/publicnode-probe.out.json`;
  - `R/feed-recorded.out.json` (72 creation transactions with shapes);
  - `RSF/feed-injection-sim.out.json`;
  - `R/verify-91.out.json` (including the 3 pricing 503s);
- **reference bytes generated once outside the repository** with web3.js 1.98.4 in CIA's checkout: about 20 legacy messages covering the longest name, ticker and URI, both signer orders, and Lighthouse-appended and compute-changed variants. The generator is `…/adopt/tools/…` and its version is recorded in the fixture header.
- **new, recorded in Stage 3:** pricing and pairs for **every stock with a kit**, and each stock's platform, config and rule accounts.

**Tests:**

1. **Encoder:** `encodeInitialize` re-encodes the 6 real launches byte for byte. `decodeInitialize` round-trips.
2. **Accounts:** all 16 re-derive for the 6 samples. Every PDA matches the recorded one, including the on-curve rejection path.
3. **Plans:** every priced stock plans against the recordings. Twenty tampered answers are each refused by name: wrong platform, rule, supply, sell, decimals, vesting, curve, migrate, program, quote, token program, `launchLabEnabled` false, missing pair, symbol-keyed lookup, and so on. **A 503 with `retryAfterSeconds` gives `pricing_unavailable`, not `paused`.**
4. **Compiler, with no web3.js:** our legacy bytes equal the reference fixtures byte for byte. CIA's `readMessage` and `checkLaunchMessage` (ported) accept them. The signature slot order is `[A, M]`. Size ≤ 1,232 bytes for the longest name, ticker and URI.
5. **`txcheck` refuses:** an extra instruction, a third signer, a lookup table, CU > 1.4M, price > 200k µL, a changed raise, creator ≠ payer, and a transfer-fee tail. **`allowedDelta` accepts** only appended Lighthouse instructions with read-only non-signer accounts and compute-budget changes within the caps, and refuses everything else: a changed LaunchLab instruction, a new signer, a changed blockhash, a writable Lighthouse account.
6. **`checkSimulation`:** the recorded success passes; err, a missing log, overspend and a wallet gain each fail.
7. **Wallet doubles** (fake Wallet Standard wallets and a fake `window.phantom.solana`):
   - Path S returns the same message: sent;
   - Path S returns an allowed delta: re-simulated, M co-signs the wallet's message, sent;
   - Path S adds a disallowed instruction: `wallet_changed_tx`, nothing sent;
   - **Path S′** returns a serialized transaction, and separately `{signature, publicKey}`: both are verified over our message and sent. A signature over a different message is refused.
   - Phantom present without `solana:signTransaction` and without `window.phantom.solana.request`: Phantom is hidden, and **Path P is not offered**.
   - A wallet with only `signAndSendTransaction` and no Stage-4 record: not offered. With a record: Path P, and the dialog names it.
   - rejects: back to Review;
   - devnet-only account: refused;
   - `signAllTransactions` and `signMessage` are **never called** (a spy asserts this).
8. **Mint key:**
   - M survives an expiry rebuild, and the rebuilt transaction's slot-6 key equals the original public key;
   - an all-zero seed, or a changed public key, aborts with `key_lost` and nothing is signed;
   - M is dropped (and the noble seed zeroed) only on resolve: confirmed, expired and abandoned, cancelled, or closed;
   - it never reaches `localStorage`, `console`, `fetch` or `postMessage` (spies);
   - a chain double shows that the second landing fails with "already in use".
9. **Race, wallet check and registry:**
   - the race check returns `unknown` when: the feed has 13 or more non-launch entries past the snapshot (the injection fixture), the snapshot is not reached in 3 pages, `/launches` fails, or `adoptions.json` is older than 120 min. It returns `moving_in` when StonkFun alone shows a kit match. It passes `commitment: "confirmed"` on every call.
   - the wallet check: `over_limit` from `/launches?creator=`, from the chain window and from `localStorage`; `incomplete` over 10 reads.
   - ordering by `(slot, txIndex)`; two-run confirmation; `over_limit` keeps the cat open;
   - `later`, `too_early` (hash match before the reveal), `shape_refused` (the `EkKE99…` and `5DWD4…` shapes) and lookalike classification;
   - creator ≠ payer refused; a v1 creation read;
   - never dropping an `adopted` cat; the builder stops on an earlier pool found late;
   - **spam does not change the builder's call count**: the sweep fixture plus 1,000 injected feed entries gives the same calls;
   - the call cap sets `health.ok = false`;
   - the holder gate: vault accounts are excluded, and a threshold breach hides buy links.
10. **Texts:**
    - every X post is ≤ 276 weighted with a 44-character mint, and every bio is ≤ 160;
    - **every post and bio matches `/coin/i` after the brand is masked**;
    - **no waiting post, planned card or banner text contains `$`**;
    - the adopted post contains "I'm its creator";
    - the description is ≤ 450 characters and contains "can lose all of its value" and "Launched by its adopter's own wallet";
    - xStock disclosures contain "xStocks", and PreStock disclosures contain "PreStocks token";
    - intent URLs decode back to the template;
    - every `kits.json` text equals its template rendering and has a passing check record with a matching input hash.
11. **Freeze and reveal:**
    - changing a locked kit fails;
    - **any ticker in `held.json` in `kits.json` fails**;
    - `metadataUri` is null unless `state === "open"`, and when set its sha256 equals `metadataUriSha256`;
    - `opensAt: null` means closed;
    - each website maps to `cat/<t>.html`;
    - each URI is ≤ 200 bytes and starts with the prefix fixed in Stage 1.
12. **Page rules:**
    - the exact CSP allow-list on **every** HTML file;
    - only `net.js` names hosts;
    - no HTML sinks;
    - the URL-sink rule;
    - the frame check exists in `assets/ui/adopt.js`;
    - the budgets;
    - `package-lock.json` has no packages;
    - **each vendored file equals the file inside its committed tarball, and the tarball's sha512 equals the recorded registry `dist.integrity`**. The test untars with `node:zlib` and a small tar reader, so no package is needed.
13. **Copy:** `copy.js` contains each required statement in section 6, and the dialog module renders only strings from `copy.js`.

### 7.2 Simulations against mainnet (read-only)

- **`node scripts/simulate-adopt.mjs --all --payer 3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3`** builds **exactly the page's transaction** (same modules) for each cat with a kit, then simulates it with `sigVerify:false` and `replaceRecentBlockhash:true`. Locked kits use a placeholder URI of the final length. The owner runs the real URIs locally before opening.
- **Pass criteria:** `err === null`, the `InitializeWithToken2022` log, CU < 250k, spend ≤ 15,000,000 lamports, size ≤ 1,232 bytes. A pricing 503 is reported as `pricing_unavailable` and is neither a pass nor a failure.
- It runs in Stage 3, again right before each opening, and daily in the Action (section 4.5 step 10).
- It also runs the page's own RPC path once against publicnode with an `Origin: https://catcoinsanctuary.com` header, as `S/publicnode-probe.mjs` does.
- It also runs from a GitHub-hosted runner with the keyed RPC (Stage 6).

### 7.3 Browser tests

- **Local:** run `python3 -m http.server` with a mocked wallet injected through Wallet Standard `register`, and a mocked `window.phantom.solana`. Walk every row of section 2.2 using fetch doubles, including the framed page.
- **Real browser, no wallet:** check that Adopt lazy-loads, the CSP blocks everything else, the garden page and the cat pages make zero third-party requests, and the dialog refuses inside an `<iframe>`.

### 7.4 Wallet matrix and the go/no-go gate (Stage 4, by the developer or owner, not by research agents)

1. **Record the features first.** On a throwaway page, list `wallet.name`, `wallet.version`, `Object.keys(wallet.features)` and `account.chains` for:
   - the Phantom extension and Phantom mobile (in-app browser);
   - the Solflare extension and mobile;
   - the Backpack extension.

   For Phantom also record:
   - whether `window.phantom.solana` exists;
   - `isPhantom`;
   - the exact accepted input and returned shape of `request({method:"signTransaction", params:{message}})`.

   Also record whether WebCrypto Ed25519 `generateKey` works in each wallet's browser.
2. **Devnet two-signer test.** A throwaway page builds `SystemProgram.createAccount(payer → fresh keypair)`, the same two-signer pattern as payer plus mint.
   - Run Path S, Path S′ (Phantom) and Path P on every wallet above.
   - Record whether the returned message is identical, is an allowed delta (and which Lighthouse program id appears), or is otherwise changed.
   - Record whether a pre-signed co-signature survives `signAndSendTransaction`.
   - Record whether `sendTransaction` works from the page through publicnode's devnet endpoint (INFERRED to exist) or the D11 sender.
3. **Mainnet sign-only dry run.** On the production page behind `#adopt-preview&dry`, with the real transaction for a real cat:
   - the wallet signs (S or S′), the page verifies, and then **both signatures are discarded without M's**;
   - such a transaction can never land, because M's signature is missing, so this carries no risk (INFERRED from how signature checks work);
   - Phantom's warning UI ("This dApp could be malicious" or not) is recorded with a screenshot.
4. **Go/no-go:**
   - **Go** if Phantom (extension **and** mobile) passes Path S or S′ with an identical message or an allowed delta.
   - **Otherwise the owner decides** between opening without Phantom (the dialog says "Phantom can't adopt yet") and not opening.
   - Every wallet in the list passes one recorded path; the others are hidden.
   - The results table is committed as `assets/adopt/wallet-paths.js` plus a README section.

### 7.5 One real test launch by the owner, before the public opens (Stage 7)

- **Who and where:** the owner, from `3J57…iji3`, on production behind the preview gate. **The owner must meet StonkFun's eligibility (D0).** The owner picks one non-held cat whose kit is final (D10). This is a real, permanent adoption, and it reveals that cat's URI.
- **Acceptance checks:**
  1. The transaction confirms.
  2. On chain, the mint's name, symbol and URI equal the kit, the pool is on `4E876…`, creator = payer, and the creation transaction meets clause 8.
  3. `/launches` shows it, usually within 2 minutes; allow 10.
  4. `/tokens/{mint}` answers 200 with `launchpad:"launchlab"` and `mode:"standard"`, usually within 10 minutes; allow 30. **`imageUrl` equal to the kit image is a warning, not a pass/fail gate**: one valid Irys launch still had none after 18 h (VERIFIED, `R/null-image-recheck.json`).
  5. The registry writes `adopted` within about 25 min. The garden shows the coin, the tag and the "sanctuary keeper's wallet" line. The holder check runs. The GMGN and FOMO links open the right mint.
  6. The X intent opens with the right text, and X renders the cat page's card.
  7. `/tokens/{mint}/fees` states forwarding.
- **Failure drills on the same run:** cancel in the wallet; leave the popup open more than 2 minutes to test expiry, and confirm the rebuild reused M; use a second, empty wallet to test insufficient SOL; open the page in an iframe.

---

## 8. Build plan in stages

| Stage | Work | Acceptance |
|---|---|---|
| **0. Decisions** | The owner answers section 9, **D0 first**, then D1–D19. The held cats are ruled on or excluded; SUNMANE and SAVEPAWS are ruled on (D17). Launch sheet 2 finishes, TTWO SAVEPAW is renamed, and the D2 disclosure text is fixed. | The decisions are written into `data/adoption-rules.json` and the README. The list of cats with kits is final, and no held ticker is on it. |
| **1. Kit production and test upload** | Write the look sentences (original cats only) and generate the images with a human likeness review. Generate banners (new lettering), avatars and both share-card states (`…/adopt/tools/kits/banner.py`). Render the texts with the revised templates. Stage everything in `kits-src/<T>/`. **One free Turbo test upload** of a dummy JSON (section 3.4) fixes `<PREFIX>`, and measures propagation and pre-signed posting. | Every kit: image 1024², ≤ 2 MB, no text or logos, not a company's cat (reviewed); every text passes the checks (as `V/text-v2-check*.out.json` does for 50 of 50); no collisions; `build-kits.mjs` reports 0 errors and refuses a held ticker. `<PREFIX>` is recorded with its measured propagation time. |
| **2. Cat pages** | `scripts/build-cat-pages.mjs` writes `cat/<t>.html` and `assets/kits/*`. Deploy. | For every kit: `curl -sI https://catcoinsanctuary.com/cat/<t>` answers **200 with no redirect**; the og tags point to `og-planned.jpg`; the page's CSP passes the test. The X card validator (or a real post preview) shows the cat. |
| **3. Library and simulation** | Port `assets/adopt/*`, vendor the libraries byte for byte, write the tests in 7.1, and record fixtures for every stock with a kit. | `npm test` is green with **no packages installed**. `simulate-adopt.mjs --all` passes for **every cat whose pricing answers 200**; the rest report `pricing_unavailable` (88 of 91 priced on 2026-09-25). Adopt JS ≤ 100 KB. |
| **4. Wallet matrix (go/no-go)** | Section 7.4, steps 1–4. | The features table is recorded. Phantom (extension and mobile) passes Path S or S′, or the owner records the decision to open without Phantom. `wallet-paths.js` is committed. The send path is chosen (publicnode or D11). |
| **5. Upload and freeze** | The owner uploads images and banners with the image key, pre-signs the JSONs with a fresh JSON key, and commits **hashes only** to `data/kits.lock.json`. Kits become `locked`. | Every image and banner resolves through two gateways, following redirects, with a matching sha256. `simulate-adopt.mjs --all` passes locally with the **real** URIs. The lock and hash tests are green. No `metadataUri` is in the repository. |
| **6. Registry in shadow** | `build-adoptions.mjs` and `adoptions.yml` run with every kit `locked` (closed). A fixture kit table points at known real launches (for example NONSOL's URI hash) to prove detection. | Detection, ordering, clause 8, the hash match before the reveal and two-run confirmation are proven on fixtures and a dry run. **24 consecutive scheduled runs on a GitHub-hosted runner with the keyed RPC have zero 429 or 403 responses and stay under the call cap.** A run takes under 60 s. The Pages deploy chain and the hourly heartbeat work. The keyed RPC returns `transactionIndex`. |
| **7. Owner's test launch** | UI behind `#adopt-preview`; section 7.5. | Every check in section 7.5 passes, and a short post-mortem is written. |
| **8. Opening** | Unannounced, in batches (D1, D18): post the batch's pre-signed JSONs, wait for propagation, then **one reveal commit** (`metadataUri`, `state: "open"`, `opensAt`). Remove the preview gate at the first opening. Watch the Action, StonkFun recording and phishing flags for the first week. Re-check the StonkFun Terms version before each batch. | The first public adoptions show up in the registry; the daily simulation guard is green; no Phantom or Cloudflare flag; `health.ok` stays true. |

---

## 9. Decisions only the owner can make

| # | Decision | Options | Recommended (INFERRED) |
|---|---|---|---|
| **D0** | **Offer adoption at all, given StonkFun's Terms.** US, Canadian and UK persons are Restricted Users, users must be 18 or older, and the Services are "intended for use by persons acting in a business or professional capacity" (VERIFIED, `RH/stonkfun-terms-excerpts.txt`). The page cannot geo-block. | (a) offer it with the verbatim clause and the attestation checkbox; (b) do not offer in-site adoption; (c) ask StonkFun in writing whether sanctuary-hosted launches and our audience are acceptable, and wait | (c), then (a) only if StonkFun does not object. Never (a) without the verbatim clause. The owner's own test launch must also qualify. |
| D1 | **Squatting.** Once a cat opens, bots can launch it first and become its adopter (about 0.0087 SOL a cat). Residual windows: the reveal commit is visible on GitHub about 1–3 minutes before Pages serves it, and the pre-posted JSON may be found during propagation. | (a) accept, no limits; (b) one accepted adoption per wallet per 24 h, with the wallet check; (c) drip openings in unannounced batches; (d) a public `withheld` list; (e) `creationTx: "init_only"` (now the default) | (b) + (c) + (e), for example 3–5 cats a day; keep (d) available and empty; state plainly that it is weak against many wallets and that bots are usually faster |
| D2 | **Disclosure wording**, which is permanent on chain | the sheet's text naming the company, plus the stock token's issuer ("xStocks", "Backpack Securities", "PreStocks") and StonkFun; or CIA's `pairDisclosure`, which names only the symbol | the sheet's text plus "xStocks" for all 24 xStock kits, and "priced in the {SYM} PreStocks token". Not "Backed", which trips the no-hype list (VERIFIED, `V/`). Decide before Stage 1. |
| D3 | **Metadata hosting and the canonical prefix** | ArDrive Turbo (Arweave, about $18, JSONs free) or Irys (about 0.005 SOL, StonkFun's host, not on `arweave.net`); prefix `https://arweave.net/` or `https://turbo-gateway.com/` | Turbo. The prefix is chosen **after** the Stage 1 test upload, preferring `https://arweave.net/` if it serves Turbo ids reliably. |
| D4 | **The `twitter` field in the metadata** | none, or a sanctuary X account (none exists in the site code) | none. The adopter's handle is unknown in advance, and the field is permanent. |
| D5 | **No links on StonkFun's token page** for coins launched this way (VERIFIED 4 of 4) | accept; ask StonkFun to add them (an admin-only route exists); or Plan B | accept, and say so in the dialog |
| D6 | **Which stocks open** | all; or xStocks first; or no PreStocks (1% → 3% transfer fee, issuer seize and freeze powers) | xStocks first (16 eligible, or 14 per D17); Backpack after; PreStocks only with an explicit fee notice |
| D7 | *(merged into D0)* The old "20 blocked jurisdictions plus 4 regions" framing understated the Terms; RS §2 item 7 is corrected. | — | — |
| D8 | **Creator-fee mention** (StonkFun's off-chain promise, paid in the stock, seen once for a self-built launch) | say nothing; or a factual note with no numbers | a factual note with no numbers. The adopted post's "I'm its creator, so fees may come to me" is a disclosure of interest, not a promise. |
| D9 | **Dev buy** | never, or optional | never (decision 3), now enforced by clause 8 |
| D10 | **Owner's test launch:** which cat and which wallet | any final, non-held cat, from `3J57…iji3`, if the owner is eligible under D0 | a sheet-1 xStock cat that is not held and not borderline (for example PATCHPAW), whose kit is checked twice |
| D11 | **Send RPC and keys** | publicnode only; plus a keyed RPC for the page; plus the required `SOLANA_RPC_URL` for the Action | publicnode plus a keyed page sender. **Any key in the page is public**: an Origin allow-list stops only browsers, since Origin can be forged from a script (VERIFIED: the research probes did exactly that, `S/publicnode-probe.mjs`). Use a plan with a hard spend cap and rate limit, **never** the Action's key. The page handles exhaustion (publicnode → page key → "try again later", nothing charged). |
| D12 | **Brand name** in the texts ("Catcoin Sanctuary" in kits and posts, "Cat Sanctuary" as the site title) | pick one | **"Catcoin Sanctuary"**: the domain, the logo set and every kit text use it. Rename the site title to match. |
| D13 | **Licence for the kit art (now required)** | all rights reserved with a use licence for the coin and its accounts; or CC BY 4.0; or CC0 | a written licence line on the Adopt dialog and the cat page, granting the adopter the right to submit the kit to StonkFun and LaunchLab and to use it on the coin's social accounts (section 3.6) |
| D14 | **Website URL form**, permanent | `https://catcoinsanctuary.com/cat/<ticker>` (recommended, per-cat share card) or the existing `/#cat=<TICKER>` | `/cat/<ticker>`, never renamed |
| D15 | **StonkFun-form launches of our kit** (Plan B image-hash rule) | not counted in v1; or counted after a test shows StonkFun keeps the image bytes | not in v1 |
| D16 | **When a cat counts as adopted** | chain-only, with StonkFun as a status; or wait for StonkFun to record it | chain-only, with StonkFun shown as a status |
| **D17** | **Held and borderline cats.** 8 are held (section 3.1). SUNMANE ("the MGM lion" link, a mane-like ruff) and SAVEPAWS (based on a real fan account's kitten avatar) are borderline. | redraw and rewrite as original cats; drop them; or rule the two borderline cats acceptable | redraw all 8 as original cats before any kit work; hold SUNMANE and SAVEPAWS until redrawn, since both follow a specific brand's or person's animal |
| **D18** | **Opening schedule** | published dates; or unannounced batches | unannounced batches; the page never shows a date |
| **D19** | **Buy-link concentration thresholds** | none; or hide above a single non-vault holder share or a top-10 share | hide above 5% single holder or 20% top-10 (placeholder numbers), and always show the creator's share |

Also for the owner:
- the CARTONPAW / TARTANPAW near-collision (flag only);
- who writes the look sentences and reviews the images for likeness to company or personal cats;
- a budget of about 17 Higgsfield credits per image (INFERRED price);
- a keyed RPC plan for the Action and a separate capped one for the page (D11).

---

## Appendix A: evidence

**Added by the architect pass (`S/` = `A/spec/`)**

| File | What |
|---|---|
| `quote-token-programs-91.json` | the 91 cats joined to StonkFun's `/pairs`: 0 classic-SPL quotes, 0 missing, 0 not ready (N1; pricing added in R/) |
| `publicnode-probe.mjs`, `.out.json` | browser-Origin reads and a simulation through publicnode (N3) |
| `curve-rule-feed-probe.mjs`, `.out.json` | SPYx's curve-rule feed; the publicnode `getSignaturesForAddress` and `getTransaction`; creation-transaction instruction names (N4, clause 8) |
| `developer-powertools_domain-and-transaction-warnings.md`, `phantom-browser-sdk-sign-and-send.md`, `solana_sending-a-transaction.md`, `developer-powertools_wallet-standard.md`, `phantom-llms.txt` | Phantom's docs on the multi-signer order, the sign-only methods' availability, pre-signed transactions, the simulation warning and the domain review form (N5) |
| `wsf-1.5.0-signTransaction.d.ts`, `wsf-1.5.0-signAndSendTransaction.d.ts`, `wsapp-1.1.1-wallets.js`, `npm-latest.txt` | the Wallet Standard API and the pinned module (N6) |
| `gh-pages-extensionless.txt` | GitHub Pages serving `/index` without a redirect on our domain (N7) |
| `stonkfun-routes.txt` | StonkFun's page routes: no terms page; `/restricted` (N8) |

**Relied on from the reviews (`R/`, `RSF/`, `RH/`):** listed per finding in Appendix B.

**Added by this revision (`V/` = `A/revise/`; tools in `…/adopt/tools/revise/`; all local, no network)**

| File | What |
|---|---|
| `SPEC.before-revision-1916Z.md` | the spec as it stood before this revision |
| `recompute.out.txt` (`recompute.py`) | recomputed from saved evidence: StonkFun recording lags (self-built /launches 14/89/460 s, /tokens 114/281/693 s), `hasBuy` 37/72, priority-price tally, the verify-91 summary and the 3 pricing-503 stocks, and trade-like instructions in the 8 SPYx creation transactions |
| `coin-word-check.out.json` (`coin-word-check.mjs`) | "memecoin" passes CIA's rules. "cat coin" and a bare "coin" trip COINx's pair term COIN in own words. "Backed Assets" / "PreStock" hits in the disclosure slot. |
| `text-v2-check*.out.json` (`text-v2-check.mjs`) | the revised X templates over 50 drafted cats: 50/50 pass with "xStocks" and the PreStock phrasing; 26/50 with "Backed Assets" (hype word "backed") |
| `desc-v2-check.out.json` (`desc-v2-check.mjs`) | the revised permanent description: 374–419 characters for the 50 drafted cats |
| `noble-ed25519-hashes.txt` | sha256 of the vendored `index.js`; the tarball sha512 equals the registry integrity |
| `site-held.json.copy-1950Z` | `site/data/held.json` at 19:50 UTC: the same 8 held tickers |

---

## Appendix B: Critique log

Each finding was re-checked against the evidence it cites, and in several cases against more evidence. "Accepted" means the spec was changed as proposed. "Accepted, different fix" means the problem is real, but the spec fixes it another way, for the reason given. No finding was rejected outright. Where a detail of a finding was inaccurate, that is noted.

| # | Severity | Verdict | Re-verification | Where changed |
|---|---|---|---|---|
| 1 | major / security | **Accepted, different fix for the builder.** | VERIFIED: the docs quote "reference the supplied address in accountKeys" (`RSF/solana-docs-getsignaturesforaddress.html`). Both injection cases simulate with `err: null` at 150 CU (`RSF/feed-injection-sim.out.json`). publicnode's default is finalized (`RSF/publicnode-default-commitment.txt`). The old §4.7 read `{limit: 25}` with no commitment, and §4.5 step 4 called `getTransaction` per feed entry. **Builder:** the proposal allowed per-stock `getProgramAccounts` or the epoch sweep every run. The spec runs the **epoch sweep every run** (2 calls, about 1.1 MB, RR §2.2.2), not up to 91 per-stock calls (SPYx alone is 213 KB), and reads transactions only for exact kit matches. **Page:** as proposed (confirmed, paging, caps, StonkFun `/launches`, fail closed). The residual (spam can force `unknown`) is stated. | 0.2 N4, 4.1, 4.5, 4.7, 7.1 test 9 |
| 2 | major / security | **Accepted.** | VERIFIED in the old text: URIs were committed at Stage 5 (§3.4 step 5, §8), and `opensAt: null` was undefined. The fix uses commit and reveal: hashes before opening, a fresh pre-signed JSON key, and one reveal commit. Also: the builder matches **by URI hash** before the reveal, so pre-reveal copies are still caught as `too_early`. Added residual: the reveal commit is visible on GitHub before Pages serves it (INFERRED, a few minutes). The bounded loss is in the dialog. | 0.1, 2.1, 3.4, 3.5, 4.2 clause 3, 8, D1, D18 |
| 3 | major / security | **Accepted, with the holder check moved to the Action.** | VERIFIED: 37/72 creation transactions carry a trade (`R/feed-recorded.out.json`). In the SPYx sample, 5 of 8 have trade or swap instructions, 2 of them `BuyExactIn` (`V/recompute.out.txt`; the finding said 4 of 8, and the difference is `4Qutq1…`'s `SwapV2`). Clause 8 `init_only` is the default. `getTokenLargestAccounts` runs in the Action rather than the page, because publicnode's support for it from our Origin is unverified. Buy links are gated. | 4.2 clause 8, 4.4, 4.6, 4.8, 2.1 step 10, D19 |
| 4 | major / security | **Accepted.** | VERIFIED: the Collection job has `contents: write`, then `npm ci`, then a commit with `GH_TOKEN` (`RSF/site-collection.yml.copy-1929Z`). Zero packages today (`RSF/site-excerpts.txt`). OSV entry for the web3.js hijack. The turbo-sdk dependency list. The spec now has no web3.js devDependency (byte fixtures instead), no npm in Adoptions, a read-only build job, a commit job limited to owned files with hooks off, and refuses changes to kit and rules files. The upload tool is outside the site. | 4.5, 5.4, 5.5, 7.1 tests 4 and 12 |
| 5 | minor / security | **Accepted; merged with 10.** | VERIFIED: `S/solana_sending-a-transaction.md` lines 73–79 and `RSF/phantom-lighthouse.md`. N5 and N6 are relabelled. Stage 4 records features. There is no silent Path P, and never Path P for Phantom. | 0.2, 1.3, 1.4, 7.4 |
| 6 | minor / security | **Accepted.** | VERIFIED contradiction: the old "discarded after one signature" and "wipe M's secret (fill(0))" versus "reuses the same M", and test 8 required both. M now lives for one attempt, as a non-extractable WebCrypto key where supported, with a public-key assertion and a zero-seed refusal. | 1.3, 7.1 test 8 |
| 7 | minor / security | **Accepted.** | VERIFIED: `@noble/ed25519` 3.2.0 `index.js` is 39,841 B. Its only `import` is inside a doc comment (line 8). It exports `Point`, `signAsync` and `verifyAsync`, and uses `crypto.subtle`. The tarball sha512 equals the registry integrity, and it has provenance (`V/noble-ed25519-hashes.txt`). The esbuild step is dropped; tarballs are committed for offline byte tests. | 5.1, 5.5, 5.6, 7.1 test 12 |
| 8 | minor / security | **Accepted.** | VERIFIED: no XFO or CSP header (`RSF/site-headers.txt`). The test reads only `index.html` and skips `vendor` (`RSF/site-excerpts.txt`). Added the frame refusal, CSP on every HTML file with tests, and the URL-sink rule. The cat-page module is a separate file, not inline. | 2.1 step 3, 4.7, 5.2, 5.3, 7.1 test 12 |
| 9 | minor / security | **Accepted.** | VERIFIED: the research probes themselves forged `Origin` from Node and were served (`S/publicnode-probe.mjs`, `RSF/publicnode-default-commitment.txt`). The page key is treated as public, capped, and separate from the Action's key; exhaustion is handled. | 1.3 (send), D11 |
| 10 | major / feasibility | **Accepted.** | Same evidence as 5, plus CIA's working bridge (`cia/src/injected.mjs:10, :94`; `cia/src/lib/engine.mjs:822`, VERIFIED). CIA passes a web3.js `VersionedTransaction`, which the page cannot, so Path S′ uses Phantom's documented `request({method:"signTransaction", params:{message}})` form, with the return shape recorded in Stage 4. The allowed delta moves into v1. "Phantom can adopt" is a go/no-go gate. §1.1 now says unproven. | 0.1, 1.1, 1.3, 1.4, 7.4, 8 Stage 4 |
| 11 | minor / feasibility | **Accepted.** | VERIFIED: `R/verify-91.out.json` has 88/91 sims passing, and PENG, AMBA and ARM return 503 `retryAfterSeconds:30`. The retries and the control call are also 503. Pricing 200 is part of readiness. The 503 is a distinct temporary state. The daily guard retries. The Stage 3 acceptance is restated. | 0.2 N1, 1.3 check 3, 2.2, 4.5 step 10, 7.2, 8 |
| 12 | minor / feasibility | **Accepted.** | VERIFIED: the live repository has one workflow and one run (`R/gh-actions-*-live.json`). The public RPC throttled and blocked in the research probes. `SOLANA_RPC_URL` is now required, with back-off, a 150-call cap, and 24 hosted-runner runs as a Stage 6 acceptance. | 4.1, 4.5, 8 Stage 6 |
| 13 | minor / feasibility | **Accepted, different fix.** | VERIFIED docs: `queue: single` is the default, and a pending run is replaced (`R/gh-concurrency.md` lines 11 and 17). The spec uses **separate groups** instead of `queue: max`, because the writers now touch disjoint files (finding 4) and Collection already has fetch, rebase and retry. `queue: max` is noted as the alternative. | 4.5 |
| 14 | minor / feasibility | **Accepted: option (b) plus an hourly heartbeat.** | VERIFIED in the old text (§4.5 step 7, §4.6, §4.7). The builder commits on change or when 60 minutes old, refreshing `snapshotSlot`. The page pages back to it with a cap and fails closed. Deploy volume stays within limits (`R/gh-pages-limits.md` line 23). | 4.5 step 9, 4.7 |
| 15 | minor / feasibility | **Accepted.** | VERIFIED in the old text (§2.2, §4.3). The new wallet check uses StonkFun `/launches?creator=` (the endpoint has `creator` and `since` parameters, VERIFIED `A/api/openapi.json`), plus A's last-10-minute chain window with at most 10 reads, plus `localStorage`. An incomplete check requires an explicit checkbox. | 1.3 check 8, 2.2, 4.7 |
| 16 | minor / feasibility | **Accepted.** | VERIFIED: 72/72 recorded; for self-built launches, `/launches` lag 14–460 s and `/tokens` lag 114–693 s. The median `/tokens` lag recomputes to **281 s**, not 290 (`V/recompute.out.txt`), which does not change the conclusion. NUVEX `imageUrl` is null after about 1,112 min. The copy now says "usually 2–10 minutes, sometimes longer", polling lasts 30 min, and `imageUrl` is a warning. | 1.1, 2.1 step 8, 7.5 |
| 17 | minor / feasibility | **Accepted.** | VERIFIED: 37 of 48 priced launches used 50,000 µL (`R/priority-fees-decoded.json`), which is StonkFun's form value (RS §3.4). The default is now 50,000 µL (12,500 lamports), configurable, with a 200k cap. | 1.3, 4.4 |
| 18 | minor / feasibility | **Accepted.** | VERIFIED: Turbo info names `turbo-gateway.com` and a free JSON limit of 107,520 B; arweave.net answers 302 on an L1 id, and wsrv.nl follows it (`R/arweave-wsrv-check.txt`). The Stage 1 test upload fixes `<PREFIX>`. Fetch-back follows redirects. Test 11 checks the chosen prefix, not a hard-coded one. | 3.4, 7.1 test 11, 8 Stage 1, D3 |
| 19 | blocker / honesty | **Accepted, one part of the fix changed.** | VERIFIED: the Restricted User clause (US, Canada, UK), 18+ and business capacity (`RH/stonkfun-terms-excerpts.txt`); US, CA and GB are `blocked:!1` in `RH/live-0s2-lymzpm5aj.js`. The fix asked to "re-check the terms version live" automatically. The Terms forbid automated access except through the public API (same file), so the spec makes it a **manual** check before each opening and weekly, with a pause on change. D0 is a new blocker. RS §2 item 7 is corrected in place. | 0.1, 0.4, 1.1, 2.1 step 5, 4.4, 6, 7.5, 9 D0/D7 |
| 20 | blocker / honesty | **Accepted.** | VERIFIED: `site/data/held.json` lists the 8 tickers (re-copied, `V/site-held.json.copy-1950Z`); `planned.json` has 16 cats; the launch-sheet `whyLook` lines copy company cats (`RH/launch-sheet-whylook-excerpt.txt`). The tooling refuses held tickers. The counts are honest (16, or 14, of 24 xStocks; at most 83 overall). The examples moved to PATCHPAW and Rosette; only PORCHLIGHT's prototype is usable. D13 is required and D17 added. | 0.1, 3.1, 3.5, 3.6, 7.1 test 11, 8, 9 |
| 21 | major / honesty | **Accepted.** | VERIFIED: StonkFun's launch page says "A token can lose all of its value" (`RH/launch-live.html`), and the old §2.1 and §6 had no loss statement. Added the statements, the creator wording, and a test on `copy.js`. The test targets `copy.js` rather than `ui/adopt.js`, because the strings are centralised there. | 2.1, 5.1, 6, 7.1 test 13 |
| 22 | major / honesty | **Accepted, wording changed.** | VERIFIED: `RH/kit-disclosure-audit.txt` (48/50 bios without "coin", 15 posts without "A cat coin", 0 charity lines) and "help this cat find a home" in `tools/kits/text.mjs:45`. **"cat coin" in own words trips COINx's pair term** (`V/coin-word-check.out.json`), so every X text uses "memecoin" instead. That passes for 50/50 (`V/text-v2-check*.out.json`). "(no real cat)" fits the bio for only 1 of 50, so "Not an animal charity" lives in the dialog, the card panel and the cat page. The button is renamed "Share this memecoin". D12 recommends "Catcoin Sanctuary". | 2.1, 3.3, 5.3, 6, 7.1 test 10, D12 |
| 23 | major / honesty | **Accepted.** | VERIFIED: every waiting post had `$TICKER`; the site rule is "shown without a `$`" (`RH/site-rules-excerpts.txt`); the SOCKFOOT banner prototype prints `$SOCKFOOT`. The share-card concern was INFERRED and is now moot: the card has two states, and the banner has no `$`. A test covers texts, and the image-generation inputs for the planned card and banner. | 2.1, 3.2, 3.3, 7.1 test 10 |
| 24 | major / honesty | **Accepted, one wording changed.** | VERIFIED in the old text (no third-party-creator item in §6; the footer replacement unspecified; the banner said "lives at"). The permanent description uses "Launched by its adopter's own wallet; Catcoin Sanctuary does not vet adopters" rather than "an independent adopter", because the same JSON must stay true for the owner's own test launch. The card uses "independent adopter" for non-listed wallets, and "the sanctuary keeper's wallet" for listed ones. | 2.1 step 10, 3.2, 3.3, 5.2 footer, 6 |
| 25 | minor / honesty | **Accepted, issuer naming changed.** | VERIFIED: 0/24 xStock disclosures name the issuer (`RH/kit-disclosure-audit.txt`). Naming "Backed" trips the no-hype word "backed" in 24/24 posts (`V/text-v2-check-issuer-Backed_Assets.out.json`), so the permanent text says "xStocks" (50/50 pass), and the cat page names the issuer in full. PreStocks: "priced in the {SYM} PreStocks token". The lengths were re-run. | 3.3, 5.3, D2 |
| 26 | minor / honesty | **Accepted.** | VERIFIED in the old text (lines 274 and 290). The cost is now split into rent (never returned) and fees. "No tokens leave your wallet" is replaced. "Not refunded" sits next to the race rule. | 1.3, 2.1 |
| 27 | minor / honesty | **Accepted.** | VERIFIED: the card shows company cats and Elon Musk post counts (`site/data/cats-info.json`). The Adoption panel is its own section above the research, with the separator line. The Adopt dialog shows none of the research or virality counts. | 2.1 step 2 |
| 28 | minor / honesty | **Accepted.** | VERIFIED in the old text (the tag, the `creator` field, public commits, and a privacy section silent on this). Now stated in step 1, in checkbox 3, and in Privacy and the footer. | 2.1, 5.2, 6 |
| 29 | minor / honesty | **Accepted.** | VERIFIED: duplicates are allowed (RS line 269); the loser text did not mention the permanent copy. The dialog warns. `notThisCat` (later, over_limit, too_early, shape_refused, withheld) is listed on the cat page. | 2.1, 2.2, 4.3, 4.6, 5.3 |
