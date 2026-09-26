(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([
  "object" == typeof document ? document.currentScript : void 0,
  94105,
  (e) => {
    "use strict";
    var t = e.i(80447),
      a = e.i(11666),
      n = e.i(54316),
      s = e.i(99161),
      r = e.i(72139),
      i = e.i(61979);
    let o = "/api/public/v1",
      l = [
        {
          method: "GET",
          path: "/tokens",
          group: "Data",
          summary: "List and search tokens",
          description:
            "Every token with a live platform pool, with market data. Works without a key at a lower rate limit. V3 reward tokens additionally carry transferFee.bps (a Token-2022 transfer tax paid to holders — use the Token-2022 program for their accounts) and, while in the buyback rankings, flywheel.active.",
          params: [
            {
              name: "q",
              in: "query",
              type: "string",
              description: "Search name, symbol or mint.",
            },
            {
              name: "sort",
              in: "query",
              type: "'marketCap' | 'newest' | 'volume'",
              description: "Defaults to marketCap.",
            },
            {
              name: "mode",
              in: "query",
              type: "'standard' | 'reward'",
              description: "Filter by fee model.",
            },
            {
              name: "status",
              in: "query",
              type: "'new' | 'aboutToGraduate' | 'graduated'",
              description: "Filter by graduation status.",
            },
            {
              name: "quoteMint",
              in: "query",
              type: "string",
              description: "Filter by paired token.",
            },
            {
              name: "category",
              in: "query",
              type: "string",
              description: "Filter by pair category, e.g. xstock.",
            },
            {
              name: "page",
              in: "query",
              type: "integer",
              description: "Defaults to 1.",
            },
            {
              name: "pageSize",
              in: "query",
              type: "integer",
              description: "1-100, defaults to 25.",
            },
          ],
        },
        {
          method: "GET",
          path: "/tokens/{mint}",
          group: "Data",
          summary: "Get one token",
          description:
            "Live market data plus the launch record, when the platform launched it. V3 reward tokens carry the same optional transferFee and flywheel fields as /tokens.",
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
          ],
        },
        {
          method: "GET",
          path: "/tokens/{mint}/burns",
          group: "Data",
          summary: "Token burn history",
          description:
            "Totals and recent burns of this token by the platform fee sweep.",
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
            {
              name: "limit",
              in: "query",
              type: "integer",
              description: "1-100, defaults to 25.",
            },
          ],
        },
        {
          method: "GET",
          path: "/tokens/{mint}/rewards",
          group: "Data",
          summary: "Token holder rewards",
          description:
            'Distribution totals for a reward coin. Standard launches answer with mode "standard" and a null rewards object. Amounts under "rewards" are quote-token amounts; the separate "base" object carries what the launch paid holders in its OWN token, and is null when that has never happened.',
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
          ],
        },
        {
          method: "GET",
          path: "/tokens/{mint}/airdrop",
          group: "Data",
          feature: "airdrop",
          summary: "Token launch airdrop",
          description:
            "The airdrop a token launched with, if any: what share of supply was carved out of the pool, how many wallets received it, and where those wallets came from. Reads the frozen snapshot taken at quote time, so it is the drop that was actually paid for rather than a live balance scan. A token that launched without one answers airdrop: null, which is not an error — most tokens have no airdrop.",
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
          ],
        },
        {
          method: "GET",
          path: "/tokens/{mint}/fees",
          group: "Fees",
          summary: "Creator claimable fees",
          description:
            'Trading fees currently claimable by the creator of a standard (fee coin) launch, in both the base and quote token. Needs no wallet, so a dashboard can show what is waiting before anyone connects. Reward coins and pump launches return claimable: null with a reason rather than an error. LaunchLab launches answer the same way for a different reason: a standard one accrues creator fees, a share of the platform fee that is FORWARDED to the creator automatically, with nothing to claim by signature, and a reward one distributes the mint’s transfer tax to holders and has no creator fees. Where a LaunchLab creator does have a claimable balance it is quote-side only, and scope: "creator-quote-vault" says the amount covers every launch that creator has against this quote token, not this one alone.',
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
          ],
        },
        {
          method: "POST",
          path: "/tokens/{mint}/fees/claim/prepare",
          group: "Fees",
          summary: "Step 1: prepare a fee claim",
          description:
            "Returns an UNSIGNED transaction that pays the creator their claimable trading fees, plus the amounts it will collect. Sign it with the wallet holding this launch’s Fee Key NFT — on a LaunchLab launch there is no Fee Key NFT and the creator wallet itself signs, draining its per-quote fee vault — and post it to /fees/claim/submit. Non-custodial: the claim is only valid signed by that wallet and pays that wallet’s own token accounts, so no platform key signs anything and a claim prepared for a token you do not own is unusable. Standard (fee coin) launches only — reward coins and pump launches answer 403. 409 when nothing is claimable yet. Expires after 90 seconds; just prepare again, fees keep accruing.",
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
            {
              name: "creatorWallet",
              in: "body",
              type: "string",
              required: !0,
              description:
                "The creator wallet holding the Fee Key NFT. It must be the fee payer of the transaction you sign.",
            },
          ],
        },
        {
          method: "POST",
          path: "/tokens/{mint}/fees/claim/submit",
          group: "Fees",
          summary: "Step 2: submit the signed claim",
          description:
            "Relays the signed claim and waits for confirmation, answering with the transaction signature. Fees land directly in the creator’s token accounts. Only the exact transaction issued by /prepare is relayed — instructions are checked against the recorded intent. Idempotent per intentId: an intent already relayed returns its original signature with alreadySubmitted: true, so a retry after a timeout cannot claim twice.",
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
            {
              name: "creatorWallet",
              in: "body",
              type: "string",
              required: !0,
              description: "The same wallet passed to /prepare.",
            },
            {
              name: "intentId",
              in: "body",
              type: "string",
              required: !0,
              description: "From /fees/claim/prepare.",
            },
            {
              name: "signedTransaction",
              in: "body",
              type: "base64",
              required: !0,
              description:
                "The transaction from /fees/claim/prepare, signed by the creator wallet.",
            },
          ],
        },
        {
          method: "GET",
          path: "/tokens/{mint}/backing",
          group: "Data",
          summary: "Token backing value",
          description:
            "USD permanently locked behind a pump-launched token, summed from the platform’s own locked positions. Pump launches only: every other launch — Raydium CLMM and LaunchLab alike — answers 400 invalid_request rather than a zero, since backing is not a thing those have. Check launchpad from /tokens/{mint} before calling.",
          params: [
            {
              name: "mint",
              in: "path",
              type: "string",
              required: !0,
              description: "Token mint address.",
            },
          ],
        },
        {
          method: "GET",
          path: "/launches",
          group: "Data",
          summary: "List launches",
          description:
            'The launch ledger, newest first. Filter by creator to find your own. Launches built directly against the venue appear here too, once adopted, under launchpad "launchlab" — no payment of ours exists for those, so they are read here or from /tokens/{mint} rather than by polling a payment signature.',
          params: [
            {
              name: "creator",
              in: "query",
              type: "string",
              description: "Filter by creator wallet.",
            },
            {
              name: "mode",
              in: "query",
              type: "'standard' | 'reward'",
              description: "Filter by fee model.",
            },
            {
              name: "since",
              in: "query",
              type: "ISO 8601",
              description: "Only launches at or after this time.",
            },
            {
              name: "page",
              in: "query",
              type: "integer",
              description: "Defaults to 1.",
            },
            {
              name: "pageSize",
              in: "query",
              type: "integer",
              description: "1-100, defaults to 25.",
            },
          ],
        },
        {
          method: "GET",
          path: "/pairs",
          group: "Data",
          summary: "List launchable pairs",
          description:
            "Quote tokens a new launch can be paired against. Call this first — quoteMint must be one of these. Two different gates apply and both are reported: `launchable` is this platform’s own rule (retired categories and mints are false), while `launchLabReady` says whether Raydium has created the on-chain GlobalConfig a LaunchLab launch needs. A pair can be launchable but not yet LaunchLab-ready; constructing a launch against one of those fails on-chain. `launchLabReady` is absent rather than false when the venue is off or the probe could not run.",
          params: [
            {
              name: "category",
              in: "query",
              type: "string",
              description: "Filter by category.",
            },
            {
              name: "launchable",
              in: "query",
              type: "boolean",
              description: "Set true to exclude retired categories.",
            },
            {
              name: "launchLabReady",
              in: "query",
              type: "boolean",
              feature: "launchlab",
              description:
                "Set true to return only pairs with a live LaunchLab config on-chain.",
            },
          ],
        },
        {
          method: "GET",
          path: "/rewards",
          group: "Data",
          summary: "Rewards overview",
          description:
            'Lifetime payout totals per reward coin plus recent distribution transactions. "launches" and "recentDistributions" are quote-token amounts only; rewards paid in a launch\'s own token appear in "baseDistributions" and "recentBaseDistributions". In those two, "decimals" and the token amount are null together when the launch record cannot be resolved — read the raw amount instead of scaling it yourself.',
          params: [
            {
              name: "limit",
              in: "query",
              type: "integer",
              description: "1-100, defaults to 25.",
            },
          ],
        },
        {
          method: "GET",
          path: "/revenue",
          group: "Data",
          summary: "Platform revenue and burns",
          description: "Fee revenue, buybacks and burns.",
          params: [
            {
              name: "limit",
              in: "query",
              type: "integer",
              description: "1-100, defaults to 25.",
            },
          ],
        },
        {
          method: "GET",
          path: "/revenue/history",
          group: "Data",
          summary: "Daily revenue series",
          description:
            'Whole daily history in one response, keyed by UTC day, in USD. dailyRevenue is quote-token fees claimed to the treasury valued at claim time, and sums to the "Total revenue" figure on the /revenue page; dailyHoldersRevenue is the share spent buying the platform token back and burning it; dailyProtocolRevenue is the remainder. Fees earned by creator and reward-holder positions are claimed directly from Raydium and are not included. A coverage block reports ledger rows that carry no USD price and therefore count as zero. No date parameter by design — fetch once and index locally.',
          params: [],
        },
        {
          method: "GET",
          path: "/stats",
          group: "Data",
          summary: "Platform stats and config",
          description:
            "Aggregate totals plus the thresholds and switches a client needs, so your UI tracks the platform instead of hardcoding it. config.paidLaunchesEnabled and config.launchLabEnabled together say which launch path is live: the two-call /launches flow, the transaction you build yourself, or both. Read them before offering a launch button.",
        },
        {
          method: "POST",
          path: "/launches/prepare",
          group: "Launch",
          feature: "legacyLaunch",
          summary: "Step 1: prepare a launch",
          description:
            "Validates the token and returns a signed quote plus an unsigned SOL payment transaction for the creator to sign.",
          params: [
            {
              name: "creatorWallet",
              in: "body",
              type: "string",
              required: !0,
              description: "Wallet that will own and pay for the launch.",
            },
            {
              name: "quoteMint",
              in: "body",
              type: "string",
              required: !0,
              description: "Pair to launch against, from GET /pairs.",
            },
            {
              name: "name",
              in: "body",
              type: "string",
              required: !0,
              description: "1-32 bytes.",
            },
            {
              name: "symbol",
              in: "body",
              type: "string",
              required: !0,
              description: "1-10 bytes.",
            },
            {
              name: "logo",
              in: "body",
              type: "data URL",
              required: !0,
              description: `data:image/(png|jpeg|webp);base64,... up to ${i.MAX_IMAGE_LABEL}.`,
            },
            {
              name: "mode",
              in: "body",
              type: "'standard' | 'reward'",
              absentFeature: "v3",
              description:
                "standard = fee coin (50/50 with creator). reward = reward coin (85% to holders). Defaults to standard.",
            },
            {
              name: "mode",
              in: "body",
              type: "'standard' | 'reward'",
              feature: "v3",
              description:
                "standard = fee coin (50/50 with creator, classic SPL mint). reward = reward coin: a Token-2022 mint carrying an immutable transfer tax paid to holders on EVERY transfer (1% by default; choose 3% with rewardTaxBps), trading on a 1% pool. The response carries each token’s rate in transferFee.bps; use the Token-2022 program for that token’s accounts, and expect a dev buy on it to deliver devBuy.netTokens rather than devBuy.tokens. Defaults to standard.",
            },
            {
              name: "rewardTaxBps",
              in: "body",
              type: "100 | 300",
              feature: "v3",
              description:
                "Reward mode only: the transfer tax baked immutably into the token, in basis points. 100 (a 1% tax, the default when omitted — existing integrations are unchanged) keeps total trading friction at 2% alongside the 1% pool; 300 sets a 3% tax at 4% total friction. The choice is signed into the quote and cannot be changed once the mint exists; the response echoes it in transferFee.bps. Rejected on standard launches.",
            },
            {
              name: "feeTier",
              in: "body",
              type: "'1%' | '2%'",
              description:
                'Standard mode only: the pool’s trading-fee tier. "1%" (the default when omitted) splits fees 50/50 — 0.5% of every trade to the creator, 0.5% to the platform. "2%" routes 1.5% of every trade to the creator while the platform still keeps 0.5%; the higher creator cut comes out of the trader’s fee, not the platform’s share. The response echoes the result as poolFeePercent. Rejected on reward launches.',
            },
            {
              name: "website",
              in: "body",
              type: "string",
              description:
                "Optional project website, saved in the token’s permanent metadata. Must be a public HTTPS URL. Omit it and the launch links to StonkFun, as every launch did before this field was accepted.",
            },
            {
              name: "twitter",
              in: "body",
              type: "string",
              description: "Optional social link.",
            },
            {
              name: "telegram",
              in: "body",
              type: "string",
              description: "Optional social link.",
            },
            {
              name: "devBuyPercent",
              in: "body",
              type: "number",
              feature: "devBuy",
              description:
                "Optional dev buy as a share of supply, max 50. On a non-SOL quote token the SOL cost is priced against the live conversion market at quote time (impact included), so the payment covers the full share even on a thin market. Executed as the pool’s literal first trade, Jito-bundled with the liquidity that makes the pool tradeable at all — designed so there is no block in which anyone else could trade ahead of it. The SOL cost (curve price plus the pool’s trading fee) is added to payment.lamports; the fill is transferred to creatorWallet once the pool is live. Token amounts are targets — a real swap fills within a small tolerance, and on a taxed launch what arrives is net of the transfer fee (see devBuy.netTokens in the response). Mutually exclusive with devBuySol. 503 when the platform cannot currently guarantee bundling.",
            },
            {
              name: "devBuySol",
              in: "body",
              type: "number",
              feature: "devBuy",
              description:
                "Optional dev buy as a SOL amount; the supply share it buys (capped at 50%) is derived from the launch curve including the pool’s trading fee — and, on a non-SOL quote token, from what the SOL genuinely converts to at live market depth. Mutually exclusive with devBuyPercent. The response echoes the target tokens and exact lamports under devBuy.",
            },
            {
              name: "airdropPercent",
              in: "body",
              type: "number",
              feature: "airdrop",
              description:
                "Optional Airdrop Mode, reward launches only: the share of supply (max 50) held OUT of the pool and distributed to holders of the quote token you are pairing against. The recipient set is snapshotted and FROZEN at this call, then hashed into the signed quote — so the drop is fixed before your mint is public and is designed so it cannot be gamed by anyone buying the quote token afterwards, and no later change can redirect it. The response carries an airdrop object with the recipient count and the extra fee, which is included in payment.lamports. Omit it and the launch behaves exactly as it did before this parameter existed.",
            },
            {
              name: "airdropTier",
              in: "body",
              type: "'top100' | 'top1000' | 'top5000'",
              feature: "airdrop",
              description:
                "How far down the quote token’s holder ranking the drop reaches. Defaults to top100. A tier is refused if the quote token has fewer eligible holders than it names, rather than silently delivering a smaller drop than you paid for. Exchange, custody and treasury wallets, and any account owned by a program (liquidity pools, vaults), are removed from the ranking and backfilled by the next holder down, so you still receive the full tier.",
            },
            {
              name: "airdropSource",
              in: "body",
              type: "'quote-holders'",
              feature: "airdrop",
              description:
                "Where recipients come from. Only quote-holders is accepted today; the curated wallet-list source exists but has never delivered on chain, so it is refused here rather than taking payment for an untested path. Defaults to quote-holders.",
            },
          ],
        },
        {
          method: "POST",
          path: "/launches/submit",
          group: "Launch",
          feature: "legacyLaunch",
          summary: "Step 2: submit payment and launch",
          description:
            'Submits the signed payment and creates the token, all-or-nothing. The payment, mint, pool, liquidity and any dev buy are submitted as ONE atomic Jito bundle, so they land together in a single block or not at all. Success returns status "completed" or "processing" (on chain, details recording) — never pay twice on "processing". If the bundle does not land, the response is service_unavailable with charged: false: nothing was charged, and the retry is a fresh quote from /prepare.',
          params: [
            {
              name: "signedQuote",
              in: "body",
              type: "string",
              required: !0,
              description: "From /prepare.",
            },
            {
              name: "signedTransaction",
              in: "body",
              type: "base64",
              required: !0,
              description:
                "The paymentTransaction from /prepare, signed by the creator.",
            },
            {
              name: "logo",
              in: "body",
              type: "data URL",
              required: !0,
              description: "The identical logo sent to /prepare.",
            },
          ],
        },
        {
          method: "GET",
          path: "/launches/{paymentSignature}",
          group: "Launch",
          summary: "Launch status",
          description:
            'Poll this after a "processing" response until status is "completed".',
          params: [
            {
              name: "paymentSignature",
              in: "path",
              type: "string",
              required: !0,
              description: "Signature of the fee payment.",
            },
          ],
        },
        {
          method: "GET",
          path: "/launchlab/pricing",
          group: "Launch",
          feature: "launchlab",
          summary: "Curve pricing for a launch you build yourself",
          description:
            "Everything needed to size and attribute a LaunchLab launch you construct YOURSELF, instead of through /launches/prepare: the exact raw totalFundRaisingB to pass so the launch opens and graduates at the same market caps as one launched here, the caps that raise produces, the virtual reserves the program will derive from it, and the remaining create-instruction constants. The raise is a RAW amount in the quote’s own decimals — reusing Raydium’s 85-SOL lamport constant on another quote is the mistake this endpoint exists to prevent. `platform.standard` / `platform.reward` are the platform ids to attribute the create to, and `modes.reward.transferFeeBps` the holder-tax tiers this platform publishes. `curveRule` carries the per-platform rule account to append as the LAST (read-only) account of the initialize instruction: once a platform enforces its launch shape on-chain, an initialize without it is refused outright (6018), and one outside the published shape is refused too (6025) — append it now and both futures are covered. A pool built to exactly this shape is adopted automatically once it lands — same token page, same fee forwarding, same holder rewards as a launch made through the API; one built to any other shape is left alone, which for a taxed mint means nobody ever collects the tax. Prices move, so a raise is only as current as prices.observedAt; nothing is reserved by calling this.",
          params: [
            {
              name: "quoteMint",
              in: "query",
              type: "string",
              required: !0,
              description:
                "Mint address of the quote token to price against, from GET /pairs.",
            },
          ],
        },
      ],
      d = [
        {
          code: "invalid_request",
          status: 400,
          meaning: "A parameter is missing or malformed.",
        },
        {
          code: "forbidden",
          status: 403,
          meaning: "The action is refused outright.",
        },
        { code: "not_found", status: 404, meaning: "No such resource." },
        {
          code: "method_not_allowed",
          status: 405,
          meaning: "Wrong HTTP method for this path.",
        },
        {
          code: "conflict",
          status: 409,
          meaning:
            "Well-formed, but the moment is wrong. For a launch, the payment landed and needs manual recovery — never retry or re-pay. For a fee claim, nothing is claimable yet or the prepared claim expired, and preparing again is the fix.",
        },
        {
          code: "rate_limited",
          status: 429,
          meaning: "Per-minute limit exceeded. Honour Retry-After.",
        },
        {
          code: "internal",
          status: 500,
          meaning: "Something broke on our side. Safe to retry.",
        },
        {
          code: "service_unavailable",
          status: 503,
          meaning: "A dependency or feature is temporarily unavailable.",
        },
      ],
      c = 300,
      h = 25,
      m = 20;
    var u = e.i(99583),
      p = e.i(96164);
    let y = "text-sm leading-6 text-ink-dim",
      f = "rounded-sm bg-well px-1.5 py-0.5 font-mono text-xs text-ink",
      g = {
        GET: "bg-accent/12 text-ink-mid",
        POST: "bg-emerald-400/12 text-emerald-300",
        DELETE: "bg-rose-400/12 text-rose-300",
      },
      x = [
        { id: "quickstart", label: "Quickstart" },
        {
          id: "launching",
          label: "Launching a token",
          feature: "legacyLaunch",
        },
        {
          id: "build-your-own",
          label: "Building it yourself",
          feature: "launchlab",
        },
        { id: "claiming", label: "Claiming fees" },
        { id: "rate-limits", label: "Rate limits" },
        { id: "endpoints", label: "Endpoint reference" },
        { id: "errors", label: "Errors" },
      ];
    function b({ id: e, children: a }) {
      return (0, t.jsxs)("h2", {
        id: e,
        className:
          "group scroll-mt-24 text-lg font-semibold tracking-[-0.02em] text-ink",
        children: [
          a,
          (0, t.jsx)("a", {
            href: `#${e}`,
            "aria-label": `Link to ${e}`,
            className:
              "ml-2 text-accent opacity-0 transition-opacity group-hover:opacity-100",
            children: "#",
          }),
        ],
      });
    }
    let w = `    devBuyPercent: 1,          // optional dev buy: up to 50% of supply, paid in SOL
    logo,                      // with the fee — or pass devBuySol instead
  }),
});
// prepared.devBuy echoes the exact tokens you receive and the SOL it adds to the payment.`,
      k = `    logo,
  }),
});`;
    e.s(
      [
        "__N_SSP",
        0,
        !0,
        "default",
        0,
        function ({
          devBuyEnabled: e,
          v3Enabled: i,
          airdropEnabled: j,
          launchlabEnabled: N,
          legacyLaunchEnabled: v,
        }) {
          let [T, S] = (0, s.useState)("Data"),
            [q, P] = (0, s.useState)(p.PLATFORM_URL);
          (0, s.useEffect)(() => P(window.location.origin), []);
          let [L, E] = (0, s.useState)(x[0].id),
            O = (0, s.useMemo)(
              () => ({ launchlab: N, legacyLaunch: v }),
              [N, v],
            ),
            R = (0, s.useMemo)(
              () => x.filter((e) => !("feature" in e) || O[e.feature]),
              [O],
            );
          (0, s.useEffect)(() => {
            let e = R.map(({ id: e }) => document.getElementById(e)).filter(
                (e) => null !== e,
              ),
              t = () => {
                let t = x[0].id;
                for (let a of e)
                  a.getBoundingClientRect().top <= 104 && (t = a.id);
                E(t);
              };
            return (
              t(),
              window.addEventListener("scroll", t, { passive: !0 }),
              () => window.removeEventListener("scroll", t)
            );
          }, [R]);
          let A = (0, s.useMemo)(() => {
            var t;
            let a;
            return ((t = {
              devBuy: e,
              v3: i,
              airdrop: j,
              launchlab: N,
              legacyLaunch: v,
            }),
            (a = (e) =>
              (!e.feature || t[e.feature]) &&
              (!e.absentFeature || !t[e.absentFeature])),
            l
              .filter((e) => !e.feature || t[e.feature])
              .map((e) =>
                e.params?.some((e) => !a(e))
                  ? { ...e, params: e.params.filter(a) }
                  : e,
              )).filter((e) => e.group === T);
          }, [T, e, i, j, N, v]);
          return u.PUBLIC_API_ENABLED
            ? (0, t.jsxs)(r.default, {
                containerClassName: "max-w-5xl",
                children: [
                  (0, t.jsxs)(n.default, {
                    children: [
                      (0, t.jsx)("title", {
                        children: "Developer API · StonkFun",
                      }),
                      (0, t.jsx)("meta", {
                        name: "description",
                        content:
                          "Launch tokens and read market data programmatically on StonkFun. Non-custodial, open, and no API key required.",
                      }),
                    ],
                  }),
                  (0, t.jsxs)("div", {
                    className: "lg:flex lg:gap-12",
                    children: [
                      (0, t.jsxs)("main", {
                        className: "max-w-3xl min-w-0 flex-1",
                        children: [
                          (0, t.jsxs)("header", {
                            className: "border-b border-line pb-8",
                            children: [
                              (0, t.jsx)("h1", {
                                className:
                                  "text-2xl font-bold tracking-[-0.035em] text-ink",
                                children: "Developer API",
                              }),
                              (0, t.jsx)("p", {
                                className: `mt-3 max-w-2xl ${y}`,
                                children:
                                  "Read market data and launch tokens over plain HTTP. There is no API key and nothing to sign up for: a launch is authorised by your own wallet's signature on the fee payment, which is stronger proof than any key we could issue. So we don't issue one.",
                              }),
                              (0, t.jsx)("p", {
                                className: `mt-3 max-w-2xl ${y}`,
                                children:
                                  "Non-custodial throughout. We never ask for, accept or store a private key; you sign the launch fee locally, and no endpoint will sign on your behalf or make the platform wallet sign anything you supply.",
                              }),
                              (0, t.jsxs)("p", {
                                className: "mt-4 text-sm text-ink-dim",
                                children: [
                                  "Base URL ",
                                  (0, t.jsx)("code", {
                                    className: f,
                                    children: o,
                                  }),
                                ],
                              }),
                            ],
                          }),
                          (0, t.jsxs)("div", {
                            className: "space-y-14 pt-10",
                            children: [
                              (0, t.jsxs)("section", {
                                children: [
                                  (0, t.jsx)(b, {
                                    id: "quickstart",
                                    children: "Quickstart",
                                  }),
                                  (0, t.jsx)("p", {
                                    className: `mt-2 max-w-2xl ${y}`,
                                    children:
                                      "Every endpoint is open behind a per-minute rate limit per IP address. Start from a terminal:",
                                  }),
                                  (0, t.jsx)("div", {
                                    className: "mt-4",
                                    children: (0, t.jsx)(a.CodeBlock, {
                                      label: "terminal",
                                      children: `# No key, no signup, no plan. Just call it.
curl ${q}${o}/tokens?sort=newest

# Launching is the same — what authorises it is your own
# signature on the launch fee, not a token we hand you.
curl ${q}${o}/pairs?launchable=true`,
                                    }),
                                  }),
                                ],
                              }),
                              v &&
                                (0, t.jsxs)("section", {
                                  children: [
                                    (0, t.jsx)(b, {
                                      id: "launching",
                                      children: "Launching a token",
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-2 max-w-2xl ${y}`,
                                      children: [
                                        "Two calls. ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "/launches/prepare",
                                        }),
                                        " returns an unsigned payment transaction; you sign it with the creator's wallet and hand it to ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "/launches/submit",
                                        }),
                                        ". First, pick a mode:",
                                      ],
                                    }),
                                    (0, t.jsxs)("div", {
                                      className:
                                        "mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2",
                                      children: [
                                        (0, t.jsxs)("div", {
                                          children: [
                                            (0, t.jsxs)("h3", {
                                              className:
                                                "text-sm font-medium text-ink",
                                              children: [
                                                "Fee coin",
                                                " ",
                                                (0, t.jsx)("code", {
                                                  className:
                                                    "ml-1 font-mono text-xs text-ink-mid",
                                                  children: 'mode: "standard"',
                                                }),
                                              ],
                                            }),
                                            (0, t.jsxs)("p", {
                                              className: `mt-1.5 ${y}`,
                                              children: [
                                                "Trades on a 1% pool by default: fees split 50/50, so creator fees are approximately 0.5% of every trade. Add the optional",
                                                " ",
                                                (0, t.jsx)("code", {
                                                  className:
                                                    "font-mono text-xs text-ink-mid",
                                                  children: 'feeTier: "2%"',
                                                }),
                                                " ",
                                                "tag to open a 2% pool instead — creator fees are approximately 1.5% of every trade and the platform still keeps about 0.5%. Either way the creator claims from the token page, or over this API — see",
                                                " ",
                                                (0, t.jsx)("a", {
                                                  href: "#claiming",
                                                  className:
                                                    "text-ink-mid hover:text-ink",
                                                  children: "Claiming fees",
                                                }),
                                                ".",
                                              ],
                                            }),
                                          ],
                                        }),
                                        (0, t.jsxs)("div", {
                                          children: [
                                            (0, t.jsxs)("h3", {
                                              className:
                                                "text-sm font-medium text-ink",
                                              children: [
                                                "Reward coin",
                                                " ",
                                                (0, t.jsx)("code", {
                                                  className:
                                                    "ml-1 font-mono text-xs text-ink-mid",
                                                  children: 'mode: "reward"',
                                                }),
                                              ],
                                            }),
                                            (0, t.jsxs)("p", {
                                              className: `mt-1.5 ${y}`,
                                              children: [
                                                i
                                                  ? `Trades on a 1% pool and carries a transfer tax paid straight to
                         holders — 1% by default, or 3% by choice at launch — automatically, in
                         the token it is paired against, on every transfer, on any venue. No
                         creator fee position.`
                                                  : `Trades on a 4% pool and pays 85% of trading fees straight to holders,
                         automatically, in the token it is paired against. No creator fee
                         position.`,
                                                !u.REWARD_LAUNCHES_ENABLED &&
                                                  (0, t.jsx)("span", {
                                                    className:
                                                      "mt-1 block text-amber-200/80",
                                                    children:
                                                      "Currently paused on this deployment.",
                                                  }),
                                              ],
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),
                                    (0, t.jsx)("h3", {
                                      className:
                                        "mt-8 text-sm font-medium text-ink",
                                      children:
                                        "Raydium pairs — what you launch against",
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-1.5 max-w-2xl ${y}`,
                                      children: [
                                        "Every token is priced against another token: tokenized stocks (xStocks), pre-IPO stocks (PreStocks), currencies, leveraged tokens, SOL, or a custom mint. Fetch the current list from ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "GET /pairs",
                                        }),
                                        " and pass one as",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "quoteMint",
                                        }),
                                        ".",
                                      ],
                                    }),
                                    j &&
                                      (0, t.jsxs)(t.Fragment, {
                                        children: [
                                          (0, t.jsx)("h3", {
                                            className:
                                              "mt-8 text-sm font-medium text-ink",
                                            children:
                                              "Airdrop to the quote token's holders",
                                          }),
                                          (0, t.jsxs)("p", {
                                            className: `mt-1.5 max-w-2xl ${y}`,
                                            children: [
                                              "On a reward launch you can hold back up to ",
                                              50,
                                              "% of supply and drop it on the holders of the token you are pairing against. Pass",
                                              " ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "airdropPercent",
                                              }),
                                              " to",
                                              " ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "/prepare",
                                              }),
                                              ", optionally with",
                                              " ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "airdropTier",
                                              }),
                                              " (",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "top100",
                                              }),
                                              " through",
                                              " ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "top5000",
                                              }),
                                              ", default",
                                              " ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "top100",
                                              }),
                                              "). Every field is optional; omit them and the launch is byte-for-byte the one you get today.",
                                            ],
                                          }),
                                          (0, t.jsxs)("p", {
                                            className: `mt-3 max-w-2xl ${y}`,
                                            children: [
                                              "The recipient list is snapshotted and frozen by that",
                                              " ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "/prepare",
                                              }),
                                              " call, before your mint exists. That ordering is the point: nobody can see the new token and buy the quote token to get into the drop, and nothing afterwards can redirect it. Exchange, custody and treasury wallets are removed, as is any account owned by a program — a liquidity pool or vault cannot sign, so tokens sent there are burnt in practice. Removals are backfilled by the next holder down, so you receive the tier you paid for.",
                                            ],
                                          }),
                                          (0, t.jsxs)("p", {
                                            className: `mt-3 max-w-2xl ${y}`,
                                            children: [
                                              "The response's ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "airdrop",
                                              }),
                                              " object gives the recipient count and the extra fee before you sign; that fee is already included in ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "payment.lamports",
                                              }),
                                              ". The carve-out is minted into escrow inside the same atomic bundle as the mint and the pool, so supply is committed the moment the token exists — but delivery itself lands shortly after, since hundreds of transfers cannot fit in one bundle. Read ",
                                              (0, t.jsxs)("code", {
                                                className: f,
                                                children: [
                                                  "/tokens/",
                                                  "{mint}",
                                                  "/airdrop",
                                                ],
                                              }),
                                              " ",
                                              "to see what a token launched with.",
                                            ],
                                          }),
                                          (0, t.jsxs)("p", {
                                            className: `mt-3 max-w-2xl ${y}`,
                                            children: [
                                              "One consequence worth pricing in: the pool is seeded with less base token, so it is thinner. The starting market cap is unchanged, but a given buy moves the price further — including your own dev buy, whose cost",
                                              " ",
                                              (0, t.jsx)("code", {
                                                className: f,
                                                children: "/prepare",
                                              }),
                                              " already accounts for.",
                                            ],
                                          }),
                                        ],
                                      }),
                                    (0, t.jsx)("h3", {
                                      className:
                                        "mt-8 text-sm font-medium text-ink",
                                      children: "Dev buy, if you want one",
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-1.5 max-w-2xl ${y}`,
                                      children: [
                                        "You can buy up to 50% of the supply as the pool's literal first trade. Pass",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "devBuyPercent",
                                        }),
                                        " (a supply share, max 50) or",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "devBuySol",
                                        }),
                                        " (a SOL amount), never both, to",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "/prepare",
                                        }),
                                        ". The SOL cost, curve price plus the pool's trading fee, rides in the same payment transaction as the launch fee.",
                                      ],
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-3 max-w-2xl ${y}`,
                                      children: [
                                        "The buy is submitted in the same atomic bundle as the transaction that makes the pool tradeable, designed so it cannot be front-run: either the pool opens with your buy already filled, or nothing happens and the launch retries. The response's ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "devBuy",
                                        }),
                                        " object carries the target token amount and the exact lamports before you sign anything; being a real swap, the executed fill can vary slightly from the target. The fill is transferred to the creator wallet the moment the pool is live.",
                                        !e &&
                                          (0, t.jsx)("span", {
                                            className:
                                              "mt-1 block text-amber-200/80",
                                            children:
                                              "Currently paused on this deployment. Sending either parameter answers 503, and they are omitted from the OpenAPI spec until it is back on.",
                                          }),
                                      ],
                                    }),
                                    (0, t.jsx)("p", {
                                      className: `mt-8 max-w-2xl ${y}`,
                                      children: "The whole thing, end to end:",
                                    }),
                                    (0, t.jsx)("div", {
                                      className: "mt-3",
                                      children: (0, t.jsx)(a.CodeBlock, {
                                        label: "launch.mjs",
                                        children: `import {
  Connection, Keypair, Transaction,
} from '@solana/web3.js';
import fs from 'node:fs';

const API = '${q}${o}';
const creator = Keypair.fromSecretKey(            // your own wallet, never sent anywhere
  Uint8Array.from(JSON.parse(fs.readFileSync('creator.json', 'utf8')))
);

const headers = { 'Content-Type': 'application/json' };   // no key, nothing to sign up for
const call = async (path, init) => {
  const response = await fetch(API + path, init);
  const body = await response.json();
  if (!response.ok) throw new Error(\`\${body.error.code}: \${body.error.message}\`);
  return body.data;
};

// 1. Pick a pair to launch against.
const { pairs } = await call('/pairs?launchable=true');
const pair = pairs.find((item) => item.symbol === 'NVDAx') ?? pairs[0];

// 2. Prepare. Returns an UNSIGNED payment transaction.
const logo = 'data:image/png;base64,' + fs.readFileSync('logo.png').toString('base64');
const prepared = await call('/launches/prepare', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    creatorWallet: creator.publicKey.toBase58(),
    quoteMint: pair.mint,
    name: 'My Token',
    symbol: 'MYTKN',
    mode: 'standard',          // 'standard' accrues creator fees
    // feeTier: '2%',          // optional: 2% pool — creator fees ~1.5% per trade instead of ~0.5%
${e ? w : k}

// 3. Sign the fee payment locally. Your key never leaves this process.
const tx = Transaction.from(Buffer.from(prepared.paymentTransaction, 'base64'));
tx.sign(creator);

// 4. Submit. Usually returns a finished token in this one call.
let result = await call('/launches/submit', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    signedQuote: prepared.signedQuote,
    signedTransaction: tx.serialize().toString('base64'),
    logo,                      // must be byte-identical to step 2
  }),
});

// 5. 'processing' means the launch is ON CHAIN and details are recording. NEVER pay again.
//    A failed bundle instead returns service_unavailable with charged: false — nothing was
//    charged; get a fresh quote from /prepare and submit again.
while (result.status === 'processing') {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  result = await call(\`/launches/\${result.paymentSignature}\`);
}

console.log('Live:', result.mint);`,
                                      }),
                                    }),
                                    (0, t.jsxs)("div", {
                                      className:
                                        "mt-6 border-l-2 border-amber-300/60 pl-4",
                                      children: [
                                        (0, t.jsx)("h3", {
                                          className:
                                            "text-sm font-medium text-amber-200",
                                          children:
                                            "The two outcomes of submit",
                                        }),
                                        (0, t.jsxs)("p", {
                                          className: `mt-1.5 max-w-2xl ${y}`,
                                          children: [
                                            "Launches are all-or-nothing: the payment, mint, pool and liquidity land together in one atomic bundle, or none of them do. A response of",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "processing",
                                            }),
                                            " means the launch is ON CHAIN and the last details are being recorded — it completes automatically even if your process dies. Poll",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children:
                                                "GET /launches/{paymentSignature}",
                                            }),
                                            " ",
                                            "until it reads ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "completed",
                                            }),
                                            ", and",
                                            " ",
                                            (0, t.jsx)("strong", {
                                              className:
                                                "font-medium text-amber-200",
                                              children: "never pay twice",
                                            }),
                                            " — a second payment creates a second token. If the bundle does not land, submit answers ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "service_unavailable",
                                            }),
                                            " with",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "charged: false",
                                            }),
                                            ": nothing was charged, no token exists, and the retry is a fresh quote from",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "/prepare",
                                            }),
                                            " — the old quote's payment expires on its own either way.",
                                          ],
                                        }),
                                      ],
                                    }),
                                    N &&
                                      (0, t.jsxs)("p", {
                                        className: `mt-6 max-w-2xl ${y}`,
                                        children: [
                                          "Rather build the transaction yourself? You can — see",
                                          " ",
                                          (0, t.jsx)("a", {
                                            href: "#build-your-own",
                                            className:
                                              "text-ink-mid hover:text-ink",
                                            children: "Building it yourself",
                                          }),
                                          ", which skips both calls and still gets the launch a token page, fee forwarding and holder rewards.",
                                        ],
                                      }),
                                  ],
                                }),
                              N &&
                                (0, t.jsxs)("section", {
                                  children: [
                                    (0, t.jsx)(b, {
                                      id: "build-your-own",
                                      children: "Building it yourself",
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-2 max-w-2xl ${y}`,
                                      children: [
                                        "The two calls above hand you a transaction we built. You can skip them entirely and construct the launch yourself against Raydium's LaunchLab program — your own mint keypair, your own instructions, your own bundle — and still get everything this platform does around a launch. Two reads are all you need from us:",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "GET /pairs",
                                        }),
                                        " for a pair, and",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "GET /launchlab/pricing",
                                        }),
                                        " for the numbers that go in the create instruction.",
                                      ],
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-3 max-w-2xl ${y}`,
                                      children: [
                                        "What ties the two together is the",
                                        " ",
                                        (0, t.jsx)("strong", {
                                          className: "font-medium text-ink",
                                          children: "platform id",
                                        }),
                                        " you bake into the pool. It is what the LaunchLab program charges the 1% curve fee to, and it is what we scan for: every minute we read the pools attributed to our platforms and adopt the ones we do not already have a record of. An adopted launch is indistinguishable from an API-created one — token page, chart, volume, fee ledger, holder rewards — and the pool's own",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "creator",
                                        }),
                                        " account is who gets paid, so a standard launch forwards its creator share to your wallet without you registering anything.",
                                      ],
                                    }),
                                    (0, t.jsx)("h3", {
                                      className:
                                        "mt-8 text-sm font-medium text-ink",
                                      children:
                                        "Sizing: one number, and it is not the SDK's",
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-1.5 max-w-2xl ${y}`,
                                      children: [
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "totalFundRaisingB",
                                        }),
                                        " is a RAW amount in the",
                                        " ",
                                        (0, t.jsx)("em", {
                                          children: "quote token's",
                                        }),
                                        " decimals, and Raydium's own constant is 85 SOL written in lamports. Pass it through on an 8-decimal xStock and you have asked for a 850-unit raise; on a 6-decimal stablecoin, 85,000. Both launch happily and graduate at a market cap nobody intended.",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "raise.raw",
                                        }),
                                        " from the pricing call is the integer to use — sized so your launch opens and graduates where one launched here would — and ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "curve.derived",
                                        }),
                                        " carries the virtual reserves the program will compute from it, so you can check your opening price before signing rather than after landing. It is priced at request time; re-fetch if you have been sitting on the response.",
                                      ],
                                    }),
                                    (0, t.jsx)("h3", {
                                      className:
                                        "mt-8 text-sm font-medium text-ink",
                                      children: "What we adopt, exactly",
                                    }),
                                    (0, t.jsx)("p", {
                                      className: `mt-1.5 max-w-2xl ${y}`,
                                      children:
                                        "Attribution is necessary but not sufficient: a pool carrying our platform id is adopted only if it matches the launch our own builder would have produced. Everything in this list comes straight out of the pricing response, so matching it is a matter of not substituting your own values:",
                                    }),
                                    (0, t.jsxs)("ul", {
                                      className: `mt-3 max-w-2xl list-disc space-y-1.5 pl-5 ${y}`,
                                      children: [
                                        (0, t.jsxs)("li", {
                                          children: [
                                            "the GlobalConfig from ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "curve.configId",
                                            }),
                                            ", and a constant-product curve migrating to ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "cpmm",
                                            }),
                                            ";",
                                          ],
                                        }),
                                        (0, t.jsxs)("li", {
                                          children: [
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "supply",
                                            }),
                                            " and",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "totalSellA",
                                            }),
                                            " as given — they fix the open-to-graduation run — with a positive",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "totalFundRaisingB",
                                            }),
                                            ";",
                                          ],
                                        }),
                                        (0, t.jsxs)("li", {
                                          children: [
                                            "a base mint created by",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children:
                                                "initialize_with_token2022",
                                            }),
                                            " at 6 decimals, which every LaunchLab launch is;",
                                          ],
                                        }),
                                        (0, t.jsxs)("li", {
                                          children: [
                                            "no transfer-fee extension at all for a standard launch, or a rate from",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children:
                                                "modes.reward.transferFeeBps",
                                            }),
                                            " for a reward one — the extension IS the mode, and it is read off the mint rather than claimed;",
                                          ],
                                        }),
                                        (0, t.jsxs)("li", {
                                          children: [
                                            "the platform id that matches that mode:",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "platform.standard",
                                            }),
                                            " for an untaxed mint,",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "platform.reward",
                                            }),
                                            " for a taxed one;",
                                          ],
                                        }),
                                        (0, t.jsxs)("li", {
                                          children: [
                                            "the platform's curve-rule account —",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "curveRule.standard",
                                            }),
                                            " /",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "curveRule.reward",
                                            }),
                                            " from pricing — appended as the LAST account of the initialize, read-only. Ignored until the platform enforces its launch shape on-chain; once it does, an initialize without it is refused outright (",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "6018",
                                            }),
                                            ") and one outside this list is refused too (",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "6025",
                                            }),
                                            ").",
                                          ],
                                        }),
                                      ],
                                    }),
                                    (0, t.jsx)("p", {
                                      className: `mt-3 max-w-2xl ${y}`,
                                      children:
                                        "Miss any of them and nothing bad happens on chain — the pool exists and trades on Raydium — but this platform never records it, which for a standard launch means no fee forwarding, and for a taxed one means the warning below.",
                                    }),
                                    (0, t.jsxs)("div", {
                                      className:
                                        "mt-6 border-l-2 border-amber-300/60 pl-4",
                                      children: [
                                        (0, t.jsx)("h3", {
                                          className:
                                            "text-sm font-medium text-amber-200",
                                          children:
                                            "A taxed mint you get wrong taxes holders for nobody",
                                        }),
                                        (0, t.jsxs)("p", {
                                          className: `mt-1.5 max-w-2xl ${y}`,
                                          children: [
                                            "On a reward launch the program assigns our platform's withhold authority (",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children:
                                                "modes.reward.withdrawWithheldAuthority",
                                            }),
                                            ") to the mint at creation. Holders are taxed on every transfer from the first trade, and only that wallet can ever withdraw what is withheld. If the launch is adopted we collect it and pay it out to holders on the reward cycle. If it is not — wrong curve, wrong config, an unpublished tax rate — the tax accrues and is never distributed to anyone.",
                                            " ",
                                            (0, t.jsx)("strong", {
                                              className:
                                                "font-medium text-amber-200",
                                              children:
                                                "Land a standard launch first",
                                            }),
                                            ", confirm it appears in ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "GET /tokens",
                                            }),
                                            " with",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children:
                                                'launchpad: "launchlab"',
                                            }),
                                            ", and only then build a taxed one.",
                                          ],
                                        }),
                                      ],
                                    }),
                                    (0, t.jsx)("p", {
                                      className: `mt-8 max-w-2xl ${y}`,
                                      children: "The whole thing, end to end:",
                                    }),
                                    (0, t.jsx)("div", {
                                      className: "mt-3",
                                      children: (0, t.jsx)(a.CodeBlock, {
                                        label: "build.mjs",
                                        children: `import {
  ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  getPdaLaunchpadAuth, getPdaLaunchpadPoolId, getPdaLaunchpadVaultId, initializeWithToken2022,
} from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';

const API = '${q}${o}';
const QUOTE = 'YOUR_QUOTE_MINT';   // a mint from /pairs
const TAX_BPS = 100;               // reward launch: an offered tier. 0 = standard, no tax.
const connection = new Connection(pickRpcUrl());
const creator = Keypair.fromSecretKey(/* your own wallet, never sent anywhere */);

const get = async (path) => (await (await fetch(API + path)).json()).data;

// 1. The pair must be launchable here AND carry a LaunchLab config on chain.
const { pairs } = await get('/pairs?launchable=true&launchLabReady=true');
const pair = pairs.find((item) => item.mint === QUOTE);
if (!pair) throw new Error('Not launchable against that quote right now');

// 2. Size the curve. raise.raw is a raw amount in the quote's decimals. The SDK's 85-SOL
//    constant would mean 850 units on an 8-decimal xStock and 85,000 on a 6-decimal stablecoin.
const pricing = await get(\`/launchlab/pricing?quoteMint=\${QUOTE}\`);
if (TAX_BPS && !pricing.modes.reward.transferFeeBps.includes(TAX_BPS)) {
  throw new Error('That tax rate is not one this platform publishes');
}

// 3. Build the create. The platform id attributes the pool to us; pick it by mode.
const programId = new PublicKey(pricing.curve.programId);
const platformId = new PublicKey(TAX_BPS ? pricing.platform.reward : pricing.platform.standard);
const quoteMint = new PublicKey(QUOTE);
const mintKeypair = Keypair.generate();
const mint = mintKeypair.publicKey;
const { publicKey: poolId } = getPdaLaunchpadPoolId(programId, mint, quoteMint);

const instruction = initializeWithToken2022(
  programId,
  creator.publicKey,                       // payer
  creator.publicKey,                       // creator: the wallet fees are forwarded to
  new PublicKey(pricing.curve.configId),
  platformId,
  getPdaLaunchpadAuth(programId).publicKey,
  poolId,
  mint,
  quoteMint,
  getPdaLaunchpadVaultId(programId, poolId, mint).publicKey,
  getPdaLaunchpadVaultId(programId, poolId, quoteMint).publicKey,
  pricing.curve.baseDecimals,
  'My Token', 'MYTKN', 'https://example.com/metadata.json',
  {
    type: 'ConstantCurve',
    supply: new BN(pricing.curve.supply),
    totalSellA: new BN(pricing.curve.totalSellA),
    totalFundRaisingB: new BN(pricing.raise.raw),   // must come from the pricing response
    migrateType: 'cpmm',
  },
  new BN(0), new BN(0), new BN(0),         // no vesting
  pricing.curve.cpmmCreatorFeeOn,
  // Reward mode only. Both keys must match the Raydium SDK's declaration exactly, as written
  // here. The SDK ignores keys it does not recognise and then writes a zero-rate transfer-fee
  // extension, which looks taxed but collects nothing.
  TAX_BPS ? { transferFeeBasePoints: TAX_BPS, maxinumFee: new BN('1000000000000000') } : undefined
);

// The SDK hardcodes classic SPL in the quote-token-program slot. Every xStock is Token-2022,
// so that account must be substituted or the program is handed the wrong token program.
if (pair.tokenProgram === TOKEN_2022_PROGRAM_ID.toBase58()) {
  if (!instruction.keys[11].pubkey.equals(TOKEN_PROGRAM_ID)) throw new Error('layout changed');
  instruction.keys[11] = { ...instruction.keys[11], pubkey: TOKEN_2022_PROGRAM_ID };
}

// Append the platform's curve-rule account last, read-only, matching your platform id. While
// enforcement is off the program ignores it. Once enforcement is on, an initialize without it
// fails with error 6018 and one outside the published shape fails with 6025.
instruction.keys.push({
  pubkey: new PublicKey(TAX_BPS ? pricing.curveRule.reward : pricing.curveRule.standard),
  isSigner: false,
  isWritable: false,
});

// 4. Sign with both the creator and the new mint, then send it yourself.
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
const tx = new Transaction()
  .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }))
  .add(instruction);
Object.assign(tx, { recentBlockhash: blockhash, lastValidBlockHeight, feePayer: creator.publicKey });
tx.sign(creator, mintKeypair);
console.log('sent:', await connection.sendRawTransaction(tx.serialize()));

// 5. There is nothing else to call. Within a minute or two the pool is adopted. Once the venue
//    is public, GET /tokens/\${mint} answers with launchpad "launchlab".`,
                                      }),
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-6 max-w-2xl ${y}`,
                                      children: [
                                        "Two details in there are worth repeating, because both fail silently. The transfer-fee parameters take the exact names the Raydium SDK declares —",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "transferFeeBasePoints",
                                        }),
                                        " and",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "maxinumFee",
                                        }),
                                        " — and a key that does not match is simply ignored, leaving an extension with a zero rate: a mint that looks like a reward coin and taxes nobody. The SDK also supplies the classic SPL program in the quote-token-program account, so a Token-2022 quote (every xStock) needs that key substituted before you sign.",
                                      ],
                                    }),
                                    (0, t.jsxs)("p", {
                                      className: `mt-3 max-w-2xl ${y}`,
                                      children: [
                                        "You pay only what Solana charges — rent, fees, and any priority fee you add. There is no launch fee on this path and nothing to submit to us afterwards: no",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "paymentSignature",
                                        }),
                                        " exists to poll, so watch",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "GET /tokens/{mint}",
                                        }),
                                        " instead. A dev buy is yours to arrange too — append a",
                                        " ",
                                        (0, t.jsx)("code", {
                                          className: f,
                                          children: "buy_exact_in",
                                        }),
                                        " to the same transaction and it fills against a pool nobody has touched.",
                                      ],
                                    }),
                                  ],
                                }),
                              (0, t.jsxs)("section", {
                                children: [
                                  (0, t.jsx)(b, {
                                    id: "claiming",
                                    children: "Claiming fees",
                                  }),
                                  (0, t.jsx)("p", {
                                    className: `mt-2 max-w-2xl ${y}`,
                                    children:
                                      "A fee coin accrues creator fees, a share of every trading fee — about half on the default 1% pool, about three quarters on the 2% tier — on a locked position until they are claimed. The token page has a button for it; this is the same thing for a script, so you can claim across many tokens on a schedule instead of clicking through them one at a time.",
                                  }),
                                  (0, t.jsxs)("p", {
                                    className: `mt-3 max-w-2xl ${y}`,
                                    children: [
                                      "Three calls. ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "GET /tokens/{mint}/fees",
                                      }),
                                      " ",
                                      "tells you what is waiting and needs no wallet at all;",
                                      " ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children:
                                          "POST /tokens/{mint}/fees/claim/prepare",
                                      }),
                                      " ",
                                      "returns an unsigned claim transaction; you sign it and hand it to",
                                      " ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children:
                                          "POST /tokens/{mint}/fees/claim/submit",
                                      }),
                                      ". Fees arrive in both tokens of the pair — your token and the one it trades against — and land directly in your own token accounts.",
                                    ],
                                  }),
                                  (0, t.jsxs)("div", {
                                    className:
                                      "mt-6 border-l-2 border-accent/60 pl-4",
                                    children: [
                                      (0, t.jsx)("h3", {
                                        className:
                                          "text-sm font-medium text-ink",
                                        children:
                                          "Only your signature can claim your fees",
                                      }),
                                      (0, t.jsxs)("p", {
                                        className: `mt-1.5 max-w-2xl ${y}`,
                                        children: [
                                          "The claim transaction is only valid when signed by the wallet holding that launch's Fee Key NFT, and it pays that wallet's own accounts. Preparing a claim is therefore not a privileged action and needs no credential: for a token you do not own it returns a transaction you cannot make valid, which would pay someone else if you could. No platform key signs any part of it, and",
                                          " ",
                                          (0, t.jsx)("code", {
                                            className: f,
                                            children: "submit",
                                          }),
                                          " relays only the exact transaction",
                                          " ",
                                          (0, t.jsx)("code", {
                                            className: f,
                                            children: "prepare",
                                          }),
                                          " issued — its instructions are checked against what we built before anything is broadcast.",
                                        ],
                                      }),
                                    ],
                                  }),
                                  (0, t.jsx)("p", {
                                    className: `mt-6 max-w-2xl ${y}`,
                                    children: "The whole thing, end to end:",
                                  }),
                                  (0, t.jsx)("div", {
                                    className: "mt-3",
                                    children: (0, t.jsx)(a.CodeBlock, {
                                      label: "claim.mjs",
                                      children: `import { Keypair, Transaction } from '@solana/web3.js';
import fs from 'node:fs';

const API = '${q}${o}';
const mint = 'YOUR_TOKEN_MINT';
const creator = Keypair.fromSecretKey(            // the wallet holding the Fee Key NFT
  Uint8Array.from(JSON.parse(fs.readFileSync('creator.json', 'utf8')))
);

const headers = { 'Content-Type': 'application/json' };
const call = async (path, init) => {
  const response = await fetch(API + path, init);
  const body = await response.json();
  if (!response.ok) throw new Error(\`\${body.error.code}: \${body.error.message}\`);
  return body.data;
};

// 1. What is waiting? A plain read — no wallet involved.
const { claimable } = await call(\`/tokens/\${mint}/fees\`);
if (!claimable) throw new Error('Nothing claimable on this launch');
console.log('Waiting:', claimable.quote.amountTokens, claimable.quote.symbol);

// 2. Prepare. Returns an UNSIGNED claim transaction, valid for 90 seconds.
const wallet = creator.publicKey.toBase58();
const prepared = await call(\`/tokens/\${mint}/fees/claim/prepare\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ creatorWallet: wallet }),
});

// 3. Sign locally. Your key never leaves this process, and this transaction can only ever
//    pay you: sign it as-is, since altering the instructions invalidates the claim.
const tx = Transaction.from(Buffer.from(prepared.transaction, 'base64'));
tx.sign(creator);

// 4. Submit. The fees land straight in your own token accounts.
const claimed = await call(\`/tokens/\${mint}/fees/claim/submit\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    creatorWallet: wallet,
    intentId: prepared.intentId,
    signedTransaction: tx.serialize().toString('base64'),
  }),
});

console.log('Claimed:', claimed.signature);`,
                                    }),
                                  }),
                                  (0, t.jsxs)("p", {
                                    className: `mt-6 max-w-2xl ${y}`,
                                    children: [
                                      "A prepared claim expires after 90 seconds, because the transaction carries a live blockhash. Expiring costs you nothing — prepare again; the fees are still sitting on the position. Retrying a ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "submit",
                                      }),
                                      " that timed out is safe too: an ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "intentId",
                                      }),
                                      " that already went through answers with its original signature and",
                                      " ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "alreadySubmitted: true",
                                      }),
                                      " rather than claiming a second time. Reward coins and pump launches have no creator position at all, so they answer ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "403",
                                      }),
                                      ", and",
                                      " ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "409",
                                      }),
                                      " means there is simply nothing to claim yet.",
                                    ],
                                  }),
                                  N &&
                                    (0, t.jsxs)(t.Fragment, {
                                      children: [
                                        (0, t.jsx)("h3", {
                                          className:
                                            "mt-8 text-sm font-medium text-ink",
                                          children:
                                            "LaunchLab launches don't work like this",
                                        }),
                                        (0, t.jsxs)("p", {
                                          className: `mt-1.5 max-w-2xl ${y}`,
                                          children: [
                                            "Everything above describes a launch with a locked Raydium position and a Fee Key NFT. A LaunchLab launch has neither, and its creator is paid a different way: the platform collects the pool's 1% fee and",
                                            " ",
                                            (0, t.jsx)("strong", {
                                              className: "font-medium text-ink",
                                              children: "forwards",
                                            }),
                                            " the creator's share to their wallet automatically. There is nothing to sign and nothing to poll — ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children:
                                                "GET /tokens/{mint}/fees",
                                            }),
                                            " ",
                                            "says so in its ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "reason",
                                            }),
                                            ", and a reward launch distributes the mint's transfer tax to holders and has no creator fees at all, so both claim calls answer ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children: "403",
                                            }),
                                            ".",
                                          ],
                                        }),
                                        (0, t.jsxs)("p", {
                                          className: `mt-3 max-w-2xl ${y}`,
                                          children: [
                                            "One exception, and it is worth knowing before you write a loop over a portfolio: launches created before the platform's fee shape was unified accrue into an on-chain vault keyed by ",
                                            (0, t.jsx)("em", {
                                              children:
                                                "creator and quote token",
                                            }),
                                            " — not by launch. When the read reports one, it carries",
                                            " ",
                                            (0, t.jsx)("code", {
                                              className: f,
                                              children:
                                                'scope: "creator-quote-vault"',
                                            }),
                                            ", the amount is quote-side only, and claiming it from any one of that creator's launches against that quote sweeps the balance for all of them. Claim once per quote token, not once per mint.",
                                          ],
                                        }),
                                      ],
                                    }),
                                ],
                              }),
                              (0, t.jsxs)("section", {
                                children: [
                                  (0, t.jsx)(b, {
                                    id: "rate-limits",
                                    children: "Rate limits",
                                  }),
                                  (0, t.jsxs)("p", {
                                    className: `mt-2 max-w-2xl ${y}`,
                                    children: [
                                      "Every response carries ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "X-RateLimit-Remaining",
                                      }),
                                      " ",
                                      "and ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "X-RateLimit-Reset",
                                      }),
                                      ". A 429 adds",
                                      " ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "Retry-After",
                                      }),
                                      "; honour it.",
                                    ],
                                  }),
                                  (0, t.jsx)("div", {
                                    className: "mt-4 overflow-x-auto",
                                    children: (0, t.jsxs)("table", {
                                      className:
                                        "w-full min-w-[480px] text-left text-sm",
                                      children: [
                                        (0, t.jsx)("thead", {
                                          className:
                                            "text-xs tracking-wide text-ink-dim uppercase",
                                          children: (0, t.jsxs)("tr", {
                                            children: [
                                              (0, t.jsx)("th", {
                                                className:
                                                  "pr-4 pb-2 font-medium",
                                                children: "Endpoints",
                                              }),
                                              (0, t.jsx)("th", {
                                                className:
                                                  "pr-4 pb-2 font-medium",
                                                children: "Per minute",
                                              }),
                                              (0, t.jsx)("th", {
                                                className: "pb-2 font-medium",
                                                children: "Why",
                                              }),
                                            ],
                                          }),
                                        }),
                                        (0, t.jsxs)("tbody", {
                                          className: "text-ink-mid",
                                          children: [
                                            (0, t.jsxs)("tr", {
                                              className: "border-t border-line",
                                              children: [
                                                (0, t.jsx)("td", {
                                                  className: "py-2.5 pr-4",
                                                  children:
                                                    "Everything except the two prepares",
                                                }),
                                                (0, t.jsx)("td", {
                                                  className:
                                                    "py-2.5 pr-4 tabular-nums",
                                                  children: c,
                                                }),
                                                (0, t.jsx)("td", {
                                                  className:
                                                    "py-2.5 text-ink-dim",
                                                  children:
                                                    "Reads, both submits, status",
                                                }),
                                              ],
                                            }),
                                            (0, t.jsxs)("tr", {
                                              className: "border-t border-line",
                                              children: [
                                                (0, t.jsx)("td", {
                                                  className: "py-2.5 pr-4",
                                                  children: (0, t.jsx)("code", {
                                                    className:
                                                      "font-mono text-xs",
                                                    children:
                                                      "POST /launches/prepare",
                                                  }),
                                                }),
                                                (0, t.jsx)("td", {
                                                  className:
                                                    "py-2.5 pr-4 tabular-nums",
                                                  children: h,
                                                }),
                                                (0, t.jsx)("td", {
                                                  className:
                                                    "py-2.5 text-ink-dim",
                                                  children: "Launch quotes",
                                                }),
                                              ],
                                            }),
                                            (0, t.jsxs)("tr", {
                                              className: "border-t border-line",
                                              children: [
                                                (0, t.jsx)("td", {
                                                  className: "py-2.5 pr-4",
                                                  children: (0, t.jsx)("code", {
                                                    className:
                                                      "font-mono text-xs",
                                                    children:
                                                      "POST /tokens/{mint}/fees/claim/prepare",
                                                  }),
                                                }),
                                                (0, t.jsx)("td", {
                                                  className:
                                                    "py-2.5 pr-4 tabular-nums",
                                                  children: m,
                                                }),
                                                (0, t.jsx)("td", {
                                                  className:
                                                    "py-2.5 text-ink-dim",
                                                  children: "Claim quotes",
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),
                                  }),
                                  (0, t.jsx)("p", {
                                    className:
                                      "mt-4 max-w-2xl text-xs leading-5 text-ink-dim",
                                    children:
                                      "Limits are per IP address and per minute, and that table is the whole story: there are no paid tiers above it. Read responses are CDN-cached, and a cache hit never reaches our servers, so it costs you nothing against these numbers. Building something that needs more headroom? Get in touch.",
                                  }),
                                ],
                              }),
                              (0, t.jsxs)("section", {
                                children: [
                                  (0, t.jsxs)("div", {
                                    className:
                                      "flex flex-wrap items-baseline justify-between gap-3",
                                    children: [
                                      (0, t.jsx)(b, {
                                        id: "endpoints",
                                        children: "Endpoint reference",
                                      }),
                                      (0, t.jsx)("a", {
                                        href: `${o}/openapi.json`,
                                        className:
                                          "text-sm text-ink-mid transition-colors hover:text-ink",
                                        children: "OpenAPI spec →",
                                      }),
                                    ],
                                  }),
                                  (0, t.jsx)("div", {
                                    className:
                                      "mt-4 flex gap-6 border-b border-line",
                                    role: "tablist",
                                    "aria-label": "Endpoint group",
                                    children: ["Data", "Launch", "Fees"].map(
                                      (e) =>
                                        (0, t.jsx)(
                                          "button",
                                          {
                                            type: "button",
                                            role: "tab",
                                            "aria-selected": T === e,
                                            onClick: () => S(e),
                                            className: `-mb-px border-b-2 pb-2 text-sm font-medium transition-colors ${T === e ? "border-accent text-ink" : "border-transparent text-ink-dim hover:text-ink-mid"}`,
                                            children: e,
                                          },
                                          e,
                                        ),
                                    ),
                                  }),
                                  (0, t.jsx)("div", {
                                    className: "divide-y divide-line",
                                    children: A.map((e) =>
                                      (0, t.jsxs)(
                                        "article",
                                        {
                                          className: "py-5",
                                          children: [
                                            (0, t.jsxs)("div", {
                                              className:
                                                "flex flex-wrap items-center gap-2",
                                              children: [
                                                (0, t.jsx)("span", {
                                                  className: `rounded-sm px-2 py-0.5 font-mono text-xs font-semibold ${g[e.method]}`,
                                                  children: e.method,
                                                }),
                                                (0, t.jsxs)("code", {
                                                  className:
                                                    "font-mono text-sm text-ink",
                                                  children: [o, e.path],
                                                }),
                                              ],
                                            }),
                                            (0, t.jsx)("p", {
                                              className: `mt-2 max-w-2xl ${y}`,
                                              children: e.description,
                                            }),
                                            e.params &&
                                              e.params.length > 0 &&
                                              (0, t.jsx)("dl", {
                                                className: "mt-3 space-y-1.5",
                                                children: e.params.map((e) =>
                                                  (0, t.jsxs)(
                                                    "div",
                                                    {
                                                      className:
                                                        "flex flex-wrap gap-x-2 text-xs leading-5",
                                                      children: [
                                                        (0, t.jsxs)("dt", {
                                                          className:
                                                            "font-mono text-ink-mid",
                                                          children: [
                                                            e.name,
                                                            e.required &&
                                                              (0, t.jsx)(
                                                                "span",
                                                                {
                                                                  className:
                                                                    "text-rose-300",
                                                                  children: "*",
                                                                },
                                                              ),
                                                          ],
                                                        }),
                                                        (0, t.jsxs)("dd", {
                                                          className:
                                                            "text-ink-dim",
                                                          children: [
                                                            (0, t.jsx)("span", {
                                                              className:
                                                                "font-mono",
                                                              children: e.type,
                                                            }),
                                                            (0, t.jsx)("span", {
                                                              className:
                                                                "mx-1.5",
                                                              children: "·",
                                                            }),
                                                            (0, t.jsx)("span", {
                                                              className:
                                                                "text-ink-dim",
                                                              children:
                                                                e.description,
                                                            }),
                                                          ],
                                                        }),
                                                      ],
                                                    },
                                                    e.name,
                                                  ),
                                                ),
                                              }),
                                          ],
                                        },
                                        `${e.method} ${e.path}`,
                                      ),
                                    ),
                                  }),
                                  (0, t.jsxs)("div", {
                                    className: "border-t border-line pt-5",
                                    children: [
                                      (0, t.jsxs)("h3", {
                                        className:
                                          "flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-medium text-ink",
                                        children: [
                                          (0, t.jsx)("code", {
                                            className:
                                              "font-mono text-sm text-ink",
                                            children:
                                              "GET /api/public/total-assets",
                                          }),
                                          (0, t.jsx)("span", {
                                            className:
                                              "rounded-sm border border-line px-2 py-0.5 text-xs font-normal text-ink-dim",
                                            children: "no key",
                                          }),
                                        ],
                                      }),
                                      (0, t.jsxs)("p", {
                                        className: `mt-2 max-w-2xl ${y}`,
                                        children: [
                                          "One more, outside the versioned base path: a flat index of every token this platform has launched, built for exchanges, aggregators and explorers. It carries asset ",
                                          (0, t.jsx)("em", {
                                            children: "identity",
                                          }),
                                          " only — mint, name, symbol, decimals, logo — and no market data, so it is cheap to poll on a schedule. Predates v1 and is unversioned; it is not going anywhere. Use ",
                                          (0, t.jsx)("code", {
                                            className: f,
                                            children: "GET /tokens",
                                          }),
                                          " above when you want prices, market caps and volume.",
                                        ],
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                              (0, t.jsxs)("section", {
                                children: [
                                  (0, t.jsx)(b, {
                                    id: "errors",
                                    children: "Errors",
                                  }),
                                  (0, t.jsxs)("p", {
                                    className: `mt-2 max-w-2xl ${y}`,
                                    children: [
                                      "Every failure returns",
                                      " ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children:
                                          "{ error: { code, message } }",
                                      }),
                                      ". Branch on",
                                      " ",
                                      (0, t.jsx)("code", {
                                        className: f,
                                        children: "code",
                                      }),
                                      ", which is stable; messages are for humans and may be reworded.",
                                    ],
                                  }),
                                  (0, t.jsx)("div", {
                                    className: "mt-4 overflow-x-auto",
                                    children: (0, t.jsxs)("table", {
                                      className:
                                        "w-full min-w-[560px] text-left text-sm",
                                      children: [
                                        (0, t.jsx)("thead", {
                                          className:
                                            "text-xs tracking-wide text-ink-dim uppercase",
                                          children: (0, t.jsxs)("tr", {
                                            children: [
                                              (0, t.jsx)("th", {
                                                className:
                                                  "pr-4 pb-2 font-medium",
                                                children: "Code",
                                              }),
                                              (0, t.jsx)("th", {
                                                className:
                                                  "pr-4 pb-2 font-medium",
                                                children: "HTTP",
                                              }),
                                              (0, t.jsx)("th", {
                                                className: "pb-2 font-medium",
                                                children: "Meaning",
                                              }),
                                            ],
                                          }),
                                        }),
                                        (0, t.jsx)("tbody", {
                                          className: "text-ink-mid",
                                          children: d.map((e) =>
                                            (0, t.jsxs)(
                                              "tr",
                                              {
                                                className:
                                                  "border-t border-line",
                                                children: [
                                                  (0, t.jsx)("td", {
                                                    className:
                                                      "py-2.5 pr-4 font-mono text-xs",
                                                    children: e.code,
                                                  }),
                                                  (0, t.jsx)("td", {
                                                    className:
                                                      "py-2.5 pr-4 text-ink-dim",
                                                    children: e.status,
                                                  }),
                                                  (0, t.jsx)("td", {
                                                    className:
                                                      "py-2.5 text-ink-dim",
                                                    children: e.meaning,
                                                  }),
                                                ],
                                              },
                                              e.code,
                                            ),
                                          ),
                                        }),
                                      ],
                                    }),
                                  }),
                                ],
                              }),
                              (0, t.jsxs)("p", {
                                className:
                                  "border-t border-line pt-6 text-xs leading-5 text-ink-dim",
                                children: [
                                  "Spotted something wrong or unclear on this page?",
                                  " ",
                                  (0, t.jsx)("a", {
                                    href: "https://x.com/launchonsf",
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    className:
                                      "text-ink-dim transition-colors hover:text-ink",
                                    children: "Tell us on X",
                                  }),
                                  " ",
                                  "and we'll fix it.",
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                      (0, t.jsx)("nav", {
                        "aria-label": "On this page",
                        className: "hidden w-44 shrink-0 lg:block",
                        children: (0, t.jsxs)("div", {
                          className: "sticky top-24",
                          children: [
                            (0, t.jsx)("p", {
                              className:
                                "text-[11px] font-medium tracking-wider text-ink-dim uppercase",
                              children: "On this page",
                            }),
                            (0, t.jsx)("ul", {
                              className:
                                "mt-3 space-y-2 border-l border-line text-[13px]",
                              children: R.map(({ id: e, label: a }) =>
                                (0, t.jsx)(
                                  "li",
                                  {
                                    children: (0, t.jsx)("a", {
                                      href: `#${e}`,
                                      className: `-ml-px block border-l pl-3 leading-5 transition-colors ${L === e ? "border-accent text-ink" : "border-transparent text-ink-dim hover:text-ink-mid"}`,
                                      children: a,
                                    }),
                                  },
                                  e,
                                ),
                              ),
                            }),
                          ],
                        }),
                      }),
                    ],
                  }),
                ],
              })
            : (0, t.jsxs)(r.default, {
                containerClassName: "max-w-3xl",
                children: [
                  (0, t.jsx)(n.default, {
                    children: (0, t.jsx)("title", {
                      children: "Developer API · StonkFun",
                    }),
                  }),
                  (0, t.jsxs)("main", {
                    className: "py-16 text-center",
                    children: [
                      (0, t.jsx)("h1", {
                        className: "text-2xl font-bold text-ink",
                        children: "Developer API",
                      }),
                      (0, t.jsx)("p", {
                        className: `mt-2 ${y}`,
                        children:
                          "The public API is not enabled on this deployment yet. Check back soon.",
                      }),
                    ],
                  }),
                ],
              });
        },
      ],
      94105,
    );
  },
  95196,
  (e, t, a) => {
    let n = "/developers";
    ((window.__NEXT_P = window.__NEXT_P || []).push([n, () => e.r(94105)]),
      t.hot &&
        t.hot.dispose(function () {
          window.__NEXT_P.push([n]);
        }));
  },
]);
