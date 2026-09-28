/* The launcher, stage 4: a StonkFun launch (Raydium LaunchLab on StonkFun's standard platform) built
   and signed offline (scripts/lib/launchlab.mjs). Proved against the six recorded real StonkFun
   launches (tests/fixtures/stonkfun-launches.json), two real answers of StonkFun's pricing API
   (tests/fixtures/stonkfun-pricing.json, served by a fake fetch) and the Collection's own proof
   (scripts/lib/chain.mjs proveLaunch). No network, and no real key: every wallet here is a constant
   filler seed or crypto.randomBytes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  PRICING_URL, PRICING_MAX_AGE_MS, LAUNCHLAB_LIMITS, LAUNCH_DEFAULTS, MAX_PRIORITY_FEE_LAMPORTS, PricingError,
  STANDARD_SUPPLY, STANDARD_SALE, STANDARD_RAISE_SOL, RAISE_TOLERANCE, DEXSCREENER_TOKENS_URL, WRAPPED_SOL_MINT, PRICE_ANCHOR_TOLERANCE,
  fetchPricing, anchorPricing, dexScreenerPriceUsd, pricingFromAnswer, checkPricingConfig, encodeInitializeData, initializeAccounts, initializeWithToken2022Instruction,
  buildInitializeWithToken2022, buildLaunchTransaction, checkLaunchMessage, signLaunchTransaction,
} from "../scripts/lib/launchlab.mjs";
import {
  proveLaunch, checkLaunchAccounts, decodeInitialize, signaturesVerify, messageBytes, curveRuleAddress, poolAddress, vaultAddress, IX,
  LAUNCHLAB_PROGRAM, LAUNCHLAB_AUTHORITY, STONKFUN_PLATFORM, STONKFUN_PLATFORM_REWARD, SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM,
  ATA_PROGRAM, COMPUTE_BUDGET_PROGRAM,
} from "../scripts/lib/chain.mjs";
import {
  keypairFromSecret, deriveMintKeypair, compileLegacyMessage, decodeLegacyMessage, decompileInstructions, decodeTransaction, transactionToJson,
  setComputeUnitLimit, setComputeUnitPrice, verifyEd25519, PACKET_DATA_SIZE,
} from "../scripts/lib/solana-tx.mjs";
import { STOCK_PAIRS, base58Decode, base58Encode } from "../assets/collection.js";
import { LAUNCHES, ROOT, launchTx, recordedAccounts, token2022MintData, GME_LAUNCHER, IREN_LAUNCHER } from "./helpers.mjs";

const PRICING = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/stonkfun-pricing.json"), "utf8"));
const answerFor = (symbol) => PRICING.answers.find((a) => a.body.data.quote.symbol === symbol);
const GMEX = answerFor("GMEX"), TOPENAI = answerFor("OPENAI");
const hexOf = (b) => Buffer.from(b).toString("hex");
const pairOf = (mint) => { const p = STOCK_PAIRS.find((s) => s.mint === mint); return p ? { symbol: p.symbol, mint: p.mint } : null; };

/** A fake fetch answering `body` (JSON) with `status`, recording each call. */
function fakeFetch(body, { status = 200, text } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response(text ?? JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); };
  return { fetchImpl, calls };
}
/** The pricing a real answer gives, read one second after StonkFun wrote it. */
const pricingOf = (a) => pricingFromAnswer(structuredClone(a.body), a.body.data.quote.mint, { nowMs: Date.parse(a.body.data.prices.observedAt) + 1000 });

/* ── the prices, anchored on DexScreener ─────────────────────────────────────────────────── */

/** A fake DexScreener: each mint's pairs as `prices` gives them ({ mint: priceUsd }), a deep pair and a thin one at 3 times the price; `status` for an outage. Records every URL asked. */
function fakeDex(prices, { status = 200, throws = false } = {}) {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(String(url));
    if (throws) throw new TypeError("fetch failed");
    if (!String(url).startsWith(`${DEXSCREENER_TOKENS_URL}/`)) throw new Error(`no network: ${url}`);
    if (status !== 200) return new Response("busy", { status });
    const mint = String(url).slice(DEXSCREENER_TOKENS_URL.length + 1), price = prices[mint];
    const pairs = price === undefined ? [] : [
      { chainId: "solana", baseToken: { address: mint }, quoteToken: { address: "x" }, priceUsd: String(price * 3), liquidity: { usd: 100 } },
      { chainId: "solana", baseToken: { address: mint }, quoteToken: { address: "y" }, priceUsd: String(price), liquidity: { usd: 9_000_000 } },
      { chainId: "solana", baseToken: { address: "other" }, quoteToken: { address: mint }, priceUsd: "0.0001", liquidity: { usd: 99_000_000 } },
    ];
    return new Response(JSON.stringify(pairs), { status: 200 });
  };
  return { fetchImpl, asked };
}

test("both prices of a StonkFun answer are anchored on DexScreener before a build: matching prices pass; an answer whose quote price and raise are scaled together (1e-6..1e6) passes its own raise bound but is refused here; DexScreener down or with no pair: refused (the launcher then falls back to pump.fun in SOL); no network", async () => {
  assert.equal(DEXSCREENER_TOKENS_URL, "https://api.dexscreener.com/tokens/v1/solana");
  assert.equal(PRICE_ANCHOR_TOLERANCE, 0.15);
  for (const a of PRICING.answers) {
    const mint = a.body.data.quote.mint, at = Date.parse(a.body.data.prices.observedAt) + 1000;
    const { solUsd, quoteUsd } = a.body.data.prices;
    const p = pricingOf(a);
    const ok = fakeDex({ [WRAPPED_SOL_MINT]: solUsd, [mint]: quoteUsd });
    assert.deepEqual(await anchorPricing(p, ok.fetchImpl), { solUsd, quoteUsd }, "the most liquid pair with the mint as its base");
    assert.deepEqual(ok.asked, [`${DEXSCREENER_TOKENS_URL}/${WRAPPED_SOL_MINT}`, `${DEXSCREENER_TOKENS_URL}/${mint}`]);
    // Within 15% either way: passes; past it: refused.
    for (const f of [0.9, 1.1]) await anchorPricing(p, fakeDex({ [WRAPPED_SOL_MINT]: solUsd * f, [mint]: quoteUsd / f }).fetchImpl);
    await assert.rejects(anchorPricing(p, fakeDex({ [WRAPPED_SOL_MINT]: solUsd * 1.3, [mint]: quoteUsd }).fetchImpl), (e) => e instanceof PricingError && /SOL price .* not within 15%/.test(e.message));
    await assert.rejects(anchorPricing(p, fakeDex({ [WRAPPED_SOL_MINT]: solUsd, [mint]: quoteUsd * 0.8 }).fetchImpl), (e) => e instanceof PricingError && /not within 15%/.test(e.message));
    // The probe: raise and quoteUsd scaled by f and 1/f pass the answer's own bound, and are refused once anchored.
    for (const f of [1e-6, 1e-3, 0.5, 2, 1e3, 1e6]) {
      const body = structuredClone(a.body);
      body.data.raise.raw = String(BigInt(Math.round(Number(body.data.raise.raw) * f)));
      body.data.prices.quoteUsd = quoteUsd / f;
      let scaled;
      try { scaled = pricingFromAnswer(body, mint, { nowMs: at }); } catch { continue; }   // (a raise under its own minimum is refused already)
      await assert.rejects(anchorPricing(scaled, ok.fetchImpl), (e) => e instanceof PricingError && /not within 15%/.test(e.message), `scaled by ${f}`);
    }
    // DexScreener down, unreachable, not JSON, or no pair with a price: refused.
    await assert.rejects(anchorPricing(p, fakeDex({}, { status: 503 }).fetchImpl), /DexScreener answered HTTP 503/);
    await assert.rejects(anchorPricing(p, fakeDex({}, { throws: true }).fetchImpl), /DexScreener could not be reached/);
    await assert.rejects(anchorPricing(p, fakeDex({ [WRAPPED_SOL_MINT]: solUsd }).fetchImpl), /no pair with a price/);
    await assert.rejects(anchorPricing(p, async () => new Response("<html>", { status: 200 })), /not JSON/);
    await assert.rejects(anchorPricing(p, async () => new Response(JSON.stringify([{ chainId: "solana", baseToken: { address: WRAPPED_SOL_MINT }, priceUsd: "abc" }]), { status: 200 })), /no pair with a price/);
    await assert.rejects(anchorPricing({ ...p, prices: undefined }, ok.fetchImpl), /no prices/);
  }
  assert.equal(await dexScreenerPriceUsd(WRAPPED_SOL_MINT, fakeDex({ [WRAPPED_SOL_MINT]: 150 }).fetchImpl), 150);
  await assert.rejects(dexScreenerPriceUsd("nope", fakeDex({}).fetchImpl), TypeError);
});

/* ── the recorded launches' initialize, and their message flags ─────────────────────────── */

const keysOf = (tx) => [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
const initOf = (tx) => tx.transaction.message.instructions.find((ix) => keysOf(tx)[ix.programIdIndex] === LAUNCHLAB_PROGRAM
  && hexOf(base58Decode(ix.data, 2000).subarray(0, 8)) === IX.initializeWithToken2022);
/** The message's own signer / writable flags of account i (static keys by the header; loaded ones writable, then readonly, never signers). */
function flagsOf(tx, i) {
  const m = tx.transaction.message, h = m.header, n = m.accountKeys.length, lw = tx.meta.loadedAddresses?.writable?.length ?? 0;
  const isSigner = i < h.numRequiredSignatures;
  const isWritable = i < n ? (isSigner ? i < h.numRequiredSignatures - h.numReadonlySignedAccounts : i < n - h.numReadonlyUnsignedAccounts) : i < n + lw;
  return { isSigner, isWritable };
}
/** Everything a recorded launch's initialize was built from: its accounts, its decoded arguments, the ten bytes after its None tag. */
function recorded(a) {
  const tx = structuredClone(a.result), ix = initOf(tx), keys = keysOf(tx);
  const data = Buffer.from(base58Decode(ix.data, 2000));
  return { tx, ix, data, acc: ix.accounts.map((i) => keys[i]), metas: ix.accounts.map((i) => ({ pubkey: keys[i], ...flagsOf(tx, i) })), args: decodeInitialize(data), tail: data.subarray(-10) };
}
/** A pricing answer in StonkFun's shape carrying a recorded launch's own numbers. The prices at the
    time of the launch were not recorded: they are made up (SOL at $100) so that its raise is worth 85 SOL. */
function answerOf({ acc, args }, { observedAt = "2026-09-24T20:00:00.000Z" } = {}) {
  const solUsd = 100, quoteUsd = (85 * solUsd * 1e8) / Number(args.raise);
  return {
    data: {
      quote: { mint: acc[7], symbol: pairOf(acc[7])?.symbol ?? "X", decimals: 8, tokenProgram: acc[11] },
      raise: { raw: String(args.raise), minimumRaw: "1" },
      curve: {
        programId: LAUNCHLAB_PROGRAM, configId: acc[2], curveType: "ConstantCurve", migrateType: "cpmm", baseDecimals: args.decimals,
        supply: String(args.supply), totalSellA: String(args.totalBaseSell), vesting: { totalLockedAmount: "0", cliffPeriod: "0", unlockPeriod: "0" }, cpmmCreatorFeeOn: args.ammFeeOn,
      },
      platform: { standard: STONKFUN_PLATFORM, reward: STONKFUN_PLATFORM_REWARD },
      curveRule: { standard: curveRuleAddress(STONKFUN_PLATFORM, acc[2]), reward: curveRuleAddress(STONKFUN_PLATFORM_REWARD, acc[2]) },
      modes: { standard: { transferFee: null } },
      prices: { solUsd, quoteUsd, observedAt },
    },
  };
}
const ALL = LAUNCHES.answers.map(recorded);
const STOCK_PRICED = ALL.filter((r) => pairOf(r.acc[7]));

/* ── throwaway keys ─────────────────────────────────────────────────────────────────────── */

const fresh = () => keypairFromSecret(randomBytes(32));
const blockhash = () => base58Encode(randomBytes(32));
const COIN = { name: "Pudding the Cat", symbol: "PUDDING", uri: "https://gateway.irys.xyz/9gfUcCRaGVkPgk1vhjJThQdqrfJjbyw4awGa29y6hR1f" };
const GMEX_PAIR = pairOf(GMEX.body.data.quote.mint);
function launch({ wallet = fresh(), postId = "1971234567890123456", answer = GMEX, ...rest } = {}) {
  const mint = deriveMintKeypair(wallet, postId), pricing = pricingOf(answer);
  const built = buildLaunchTransaction({ wallet, mint, pair: pairOf(answer.body.data.quote.mint), ...COIN, pricing, recentBlockhash: blockhash(), ...rest });
  return { wallet, mint, pricing, built };
}
/** A signed launch in getTransaction's json shape, landed at `blockTime`. */
function landed(b64, blockTime = 1790300000) {
  const tx = transactionToJson(new Uint8Array(Buffer.from(b64, "base64")));
  return Object.assign(tx, { slot: 450200000, blockTime, meta: { err: null, status: { Ok: null }, fee: 10000, innerInstructions: [], logMessages: [] } });
}

/* ── the pricing ────────────────────────────────────────────────────────────────────────── */

test("StonkFun's pricing (two real answers): fetched from its public endpoint, every field read, the ids are the pinned ones and the curve rules re-derive", async () => {
  assert.equal(PRICING.answers.length, 2);
  for (const a of PRICING.answers) {
    const mint = a.body.data.quote.mint;
    assert.ok(pairOf(mint), `${a.body.data.quote.symbol} is a stock pair`);
    const f = fakeFetch(a.body);
    const p = await fetchPricing(mint, f.fetchImpl, { nowMs: Date.parse(a.body.data.prices.observedAt) + 60_000 });
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, `${PRICING_URL}?quoteMint=${mint}`);
    assert.equal(f.calls[0].url, a.url, "the URL the answer was recorded from");
    assert.deepEqual([f.calls[0].init.method, f.calls[0].init.redirect], ["GET", "error"]);
    assert.ok(Object.isFrozen(p) && Object.isFrozen(p.quote));
    assert.equal(p.curveRule, curveRuleAddress(STONKFUN_PLATFORM, p.configId));
    assert.equal(a.body.data.curveRule.derivation, "[\"platform_curve_rule\", platform_config, global_config] on the LaunchLab program");
    assert.equal(a.body.data.curve.programId, LAUNCHLAB_PROGRAM);
    assert.deepEqual([a.body.data.platform.standard, a.body.data.platform.reward], [STONKFUN_PLATFORM, STONKFUN_PLATFORM_REWARD]);
  }
  const p = pricingOf(GMEX);
  assert.deepEqual(p, {
    quote: { mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc", symbol: "GMEX", decimals: 8, tokenProgram: TOKEN_2022_PROGRAM },
    configId: "2TygvvGwVLxpJaGfQkFtGFzgvRMQmcFi6fM6iceLTTpu", curveRule: curveRuleAddress(STONKFUN_PLATFORM, "2TygvvGwVLxpJaGfQkFtGFzgvRMQmcFi6fM6iceLTTpu"),
    supply: 1_000_000_000_000_000n, totalSellA: 793_100_000_000_000n, raise: 43_540_640_192n, baseDecimals: 6, migrateType: 1, cpmmCreatorFeeOn: 0,
    prices: { solUsd: GMEX.body.data.prices.solUsd, quoteUsd: GMEX.body.data.prices.quoteUsd }, observedAt: GMEX.body.data.prices.observedAt,
  });
  assert.ok(Object.isFrozen(p.prices));
  assert.deepEqual([STANDARD_SUPPLY, STANDARD_SALE, STANDARD_RAISE_SOL, RAISE_TOLERANCE], [p.supply, p.totalSellA, 85, 0.02]);
  // both real answers: the raise is 85 SOL at the answer's own prices, in the quote's own decimals (to within 1e-11)
  for (const a of PRICING.answers) {
    const d = a.body.data;
    assert.match(d.raise.basis, /85 SOL/);
    assert.ok(Math.abs(Number(d.raise.raw) / (85 * d.prices.solUsd / d.prices.quoteUsd * 10 ** d.quote.decimals) - 1) < 1e-10, d.quote.symbol);
  }
  // the config StonkFun names for GMEx is the GlobalConfig of the recorded real GMEx launch, and the recorded account says so
  const gme = proveLaunch(launchTx("2VJ6Eqt9"), { wallet: GME_LAUNCHER }).launch;
  assert.equal(p.configId, gme.globalConfig);
  const accounts = recordedAccounts();
  assert.deepEqual(checkPricingConfig(p, accounts.get(p.configId)), { ok: true });
  assert.match(checkPricingConfig(pricingOf(TOPENAI), accounts.get(p.configId)).detail, /another quote/);
  assert.match(checkPricingConfig(p, { ...accounts.get(p.configId), owner: SYSTEM_PROGRAM }).detail, /not a LaunchLab account/);
  assert.equal(checkPricingConfig(p, null).ok, false);
  // the same supply and sale as all six recorded launches
  for (const r of ALL) assert.deepEqual([r.args.supply, r.args.totalBaseSell, r.args.decimals, r.args.migrateType], [p.supply, p.totalSellA, 6, 1]);
});

test("pricing answers that are refused: other ids, another quote or program, another curve, vesting, a transfer fee, bad amounts, stale prices, errors", async () => {
  const mint = GMEX.body.data.quote.mint, at = Date.parse(GMEX.body.data.prices.observedAt);
  const refused = (edit, pattern, { nowMs = at + 1000 } = {}) => {
    const body = structuredClone(GMEX.body);
    edit(body.data, body);
    assert.throws(() => pricingFromAnswer(body, mint, { nowMs }), (e) => e instanceof PricingError && pattern.test(e.message), pattern.source);
  };
  refused((d) => { d.curve.programId = "LanD8FpTBBvzZFXjTxsAoipkFsxPUCDB4qAqKxYDiNP"; }, /LaunchLab's pinned/);
  refused((d) => { d.platform.standard = "Aew2FoY9UPjKGgkuDrDMb238fH2pU8XuZRHmXwuRsiQB"; }, /platforms are not StonkFun's/);
  refused((d) => { d.platform.reward = STONKFUN_PLATFORM; }, /platforms are not StonkFun's/);
  refused((d) => { d.curveRule.standard = d.curveRule.reward; }, /curve rules/);
  refused((d) => { d.curveRule.reward = d.curveRule.standard; }, /curve rules/);
  refused((d) => { d.curve.configId = "3exefyTZ6ves3Z6cvQ9nf1NtSPAnHX95ZtvKWedf7JX6"; }, /curve rules/); // another config, its rule left as it was
  refused((d) => { d.curve.configId = "not an address"; }, /config is not an address/);
  refused((d) => { d.quote.mint = TOPENAI.body.data.quote.mint; }, /another quote/);
  refused((d) => { d.quote.tokenProgram = TOKEN_PROGRAM; }, /Token-2022/);
  refused((d) => { d.quote.decimals = 19; }, /decimals/);
  refused((d) => { d.quote.symbol = "<b>GME</b>"; }, /symbol/);
  refused((d) => { d.curve.curveType = "FixedCurve"; }, /constant-product/);
  refused((d) => { d.curve.migrateType = "amm"; }, /cpmm/);
  refused((d) => { d.curve.baseDecimals = 9; }, /6 decimals/);
  refused((d) => { d.curve.supply = "1e15"; }, /whole u64/);
  refused((d) => { d.curve.supply = "18446744073709551616"; }, /whole u64/);
  refused((d) => { d.raise.raw = "-5"; }, /whole u64/);
  refused((d) => { d.raise.raw = 1.5; }, /whole u64/);
  refused((d) => { d.raise.raw = "0"; d.raise.minimumRaw = "0"; }, /raise must be above 0/);
  refused((d) => { d.raise.minimumRaw = "99999999999999"; }, /its own minimum/);
  refused((d) => { d.curve.totalSellA = d.curve.supply; }, /sale must be/);
  refused((d) => { d.curve.totalSellA = "0"; }, /sale must be/);
  // absurd numbers that are whole u64s: an off-standard supply or sale, a raise not worth 85 SOL (review: each was built and signed before)
  const U64_MAX = "18446744073709551615";
  refused((d) => { d.curve.supply = "2"; d.curve.totalSellA = "1"; }, /standard one/);
  refused((d) => { d.curve.supply = U64_MAX; d.curve.totalSellA = "1"; }, /standard one/);
  refused((d) => { d.curve.supply = U64_MAX; }, /standard one/);
  refused((d) => { d.curve.totalSellA = "793100000000001"; }, /standard one/);
  refused((d) => { d.raise.raw = "1"; }, /not worth 85 SOL/);
  refused((d) => { d.raise.raw = "1"; delete d.raise.minimumRaw; }, /not worth 85 SOL/);
  refused((d) => { d.raise.raw = U64_MAX; }, /not worth 85 SOL/);
  refused((d) => { d.raise.raw = String(Math.round(Number(d.raise.raw) * 1.03)); }, /not worth 85 SOL/);
  refused((d) => { d.raise.raw = String(Math.round(Number(d.raise.raw) * 0.97)); }, /not worth 85 SOL/);
  refused((d) => { d.quote.decimals = 9; }, /not worth 85 SOL/); // the same raw raise in another quote's decimals is ten times too much
  refused((d) => { d.prices.solUsd = d.prices.solUsd * 2; }, /not worth 85 SOL/);
  for (const bad of [0, -120, "120.5", null, undefined, true]) {
    refused((d) => { d.prices.solUsd = bad; }, /not positive numbers/);
    refused((d) => { d.prices.quoteUsd = bad; }, /not positive numbers/);
  }
  refused((d) => { d.prices.quoteUsd = 1e-320; }, /not worth 85 SOL/); // a subnormal price: the expected raise is not a finite number
  for (const f of [1.015, 0.985]) {
    const body = structuredClone(GMEX.body);
    body.data.raise.raw = String(Math.round(Number(body.data.raise.raw) * f));
    assert.doesNotThrow(() => pricingFromAnswer(body, mint, { nowMs: at + 1000 }), `a raise ${f} times 85 SOL is within 2%`);
  }
  refused((d) => { d.curve.vesting.totalLockedAmount = "1"; }, /vests nothing/);
  refused((d) => { delete d.curve.vesting; }, /vests nothing/);
  refused((d) => { d.curve.cpmmCreatorFeeOn = 2; }, /cpmmCreatorFeeOn/);
  refused((d) => { d.modes.standard.transferFee = { bps: 100 }; }, /transfer fee/);
  refused((d) => { delete d.prices.observedAt; }, /observedAt/);
  refused((d) => { delete d.curveRule; }, /missing/);
  refused((d, b) => { delete b.data; }, /no data/);
  refused(() => {}, /minutes old/, { nowMs: at + PRICING_MAX_AGE_MS + 60_000 });
  refused(() => {}, /future/, { nowMs: at - 10 * 60_000 });
  assert.doesNotThrow(() => pricingFromAnswer(structuredClone(GMEX.body), mint, { nowMs: at + PRICING_MAX_AGE_MS }));
  assert.throws(() => pricingFromAnswer(structuredClone(GMEX.body), "nope"), TypeError);

  // the fetch itself
  const now = { nowMs: at + 1000 };
  const status = fakeFetch({ error: { code: "rate_limited", message: "slow down", retryable: true } }, { status: 429 });
  await assert.rejects(fetchPricing(mint, status.fetchImpl, now), /HTTP 429: rate_limited/);
  await assert.rejects(fetchPricing(mint, fakeFetch(null, { text: "<html>busy</html>", status: 503 }).fetchImpl, now), /HTTP 503$/);
  await assert.rejects(fetchPricing(mint, fakeFetch(null, { text: "not json" }).fetchImpl, now), /not JSON/);
  await assert.rejects(fetchPricing(mint, fakeFetch(null, { text: `{"pad":"${"x".repeat(70_000)}"}` }).fetchImpl, now), /short text/);
  await assert.rejects(fetchPricing(mint, async () => { throw new TypeError("fetch failed"); }, now), /could not be reached \(network error\)/);
  await assert.rejects(fetchPricing(mint, fakeFetch(TOPENAI.body).fetchImpl, now), /another quote/);
  const none = fakeFetch(GMEX.body);
  await assert.rejects(fetchPricing("0OIl", none.fetchImpl, now), TypeError);
  await assert.rejects(fetchPricing(`${mint}&quoteMint=x`, none.fetchImpl, now), TypeError);
  assert.equal(none.calls.length, 0, "nothing is fetched for a quote that is not an address");
});

/* ── the instruction, against the six recorded launches ────────────────────────────────────── */

test("all six recorded launches' initialize_with_token_2022 are rebuilt byte for byte from their decoded inputs: data, sixteen keys and their flags", () => {
  assert.equal(ALL.length, 6);
  for (const r of ALL) {
    const what = r.tx.transaction.signatures[0].slice(0, 8);
    assert.equal(r.acc[1], r.acc[0], `${what}: the creator is the payer`);
    const ix = initializeWithToken2022Instruction({
      payer: r.acc[0], globalConfig: r.acc[2], platform: r.acc[3], mint: r.acc[6], quote: r.acc[7], quoteTokenProgram: r.acc[11],
      args: { ...r.args, noneTail: new Uint8Array(r.tail) },
    });
    assert.equal(ix.programId, LAUNCHLAB_PROGRAM);
    assert.equal(hexOf(ix.data), hexOf(r.data), `${what}: data`);
    assert.deepEqual(ix.keys.map((k) => k.pubkey), r.acc, `${what}: keys`);
    assert.deepEqual(ix.keys, r.metas, `${what}: keys and flags`);
    assert.deepEqual(decodeInitialize(ix.data), r.args);
  }
  // StonkFun's own site writes None as the tag and ten zero bytes; one launch (the SOL-priced VOLTAGENT, from another builder) put garbage there
  const zeroTail = ALL.filter((r) => r.tail.every((b) => b === 0)).map((r) => r.tx.transaction.signatures[0].slice(0, 8));
  assert.deepEqual(zeroTail.length, 5);
  assert.ok(STOCK_PRICED.every((r) => r.tail.every((b) => b === 0)));
  assert.equal(hexOf(encodeInitializeData({ ...STOCK_PRICED[0].args })), hexOf(STOCK_PRICED[0].data), "ten zero bytes are the default");
  assert.equal(encodeInitializeData({ ...STOCK_PRICED[0].args, noneTail: new Uint8Array(0) }).length, STOCK_PRICED[0].data.length - 10);
  for (const bad of [{ migrateType: 2 }, { ammFeeOn: 2 }, { supply: -1n }, { raise: 2n ** 64n }, { decimals: 256 }, { vesting: [0n, 0n] }, { noneTail: new Uint8Array(3) }, { name: 5 }]) {
    assert.throws(() => encodeInitializeData({ ...STOCK_PRICED[0].args, ...bad }), JSON.stringify(bad, (_, v) => (typeof v === "bigint" ? String(v) : v)));
  }
});

test("the four launches priced in a stock pair are rebuilt by buildInitializeWithToken2022 from a pricing answer made of their own numbers", () => {
  assert.deepEqual(STOCK_PRICED.map((r) => pairOf(r.acc[7]).symbol).sort(), ["ANTHROPIC", "GMEx", "GOOGLx", "IREN"]);
  for (const r of STOCK_PRICED) {
    const pricing = pricingFromAnswer(answerOf(r), r.acc[7], { nowMs: Date.parse("2026-09-24T20:01:00Z") });
    const ix = buildInitializeWithToken2022({ wallet: r.acc[0], mint: r.acc[6], pair: pairOf(r.acc[7]), name: r.args.name, symbol: r.args.symbol, uri: r.args.uri, pricing });
    assert.equal(hexOf(ix.data), hexOf(r.data));
    assert.deepEqual(ix.keys, r.metas);
    assert.deepEqual(ix.keys, initializeAccounts({ payer: r.acc[0], globalConfig: r.acc[2], mint: r.acc[6], quote: r.acc[7] }));
    // each derivation on its own, so a failure names the account
    assert.deepEqual([r.acc[3], r.acc[4], r.acc[10], r.acc[11], r.acc[12], r.acc[14]], [STONKFUN_PLATFORM, LAUNCHLAB_AUTHORITY, TOKEN_2022_PROGRAM, TOKEN_2022_PROGRAM, SYSTEM_PROGRAM, LAUNCHLAB_PROGRAM]);
    assert.equal(r.acc[5], poolAddress(r.acc[6], r.acc[7]));
    assert.deepEqual([r.acc[8], r.acc[9]], [vaultAddress(r.acc[5], r.acc[6]), vaultAddress(r.acc[5], r.acc[7])]);
    assert.equal(r.acc[15], pricing.curveRule);
  }
});

test("a whole recorded launch (IREN, 5egBA4T2: ComputeBudget and the initialize, nothing else) is rebuilt byte for byte by buildLaunchTransaction, and its real signatures verify over the rebuilt message", () => {
  const r = ALL.find((x) => x.tx.transaction.signatures[0].startsWith("5egBA4T2"));
  assert.equal(r.tx.version, "legacy");
  assert.equal(r.tx.transaction.message.instructions.length, 3);
  const cb = r.tx.transaction.message.instructions.slice(0, 2).map((ix) => hexOf(base58Decode(ix.data)));
  assert.deepEqual(cb, [hexOf(setComputeUnitLimit(600_000).data), hexOf(setComputeUnitPrice(50_000).data)]);
  const pricing = pricingFromAnswer(answerOf(r), r.acc[7], { nowMs: Date.parse("2026-09-24T20:01:00Z") });
  const built = buildLaunchTransaction({
    wallet: IREN_LAUNCHER, mint: r.acc[6], pair: pairOf(r.acc[7]), name: r.args.name, symbol: r.args.symbol, uri: r.args.uri, pricing,
    recentBlockhash: r.tx.transaction.message.recentBlockhash, keyOrder: "sorted", computeUnitLimit: 600_000, computeUnitPriceMicroLamports: 50_000,
  });
  const real = messageBytes(r.tx);
  assert.equal(hexOf(built.messageBytes), hexOf(real));
  r.tx.transaction.signatures.forEach((sig, i) => assert.equal(verifyEd25519(built.signers[i], built.messageBytes, base58Decode(sig)), true, `signature ${i}`));
  assert.deepEqual(built.signers, [IREN_LAUNCHER, r.acc[6]]);
  assert.equal(proveLaunch(r.tx, { wallet: IREN_LAUNCHER }).ok, true);
});

/* ── a launch, end to end ──────────────────────────────────────────────────────────────────── */

test("a launch built and signed with throwaway keys is proved by the Collection (proveLaunch, its signatures, the read-back of the mint and GMEx's recorded config)", () => {
  const wallet = keypairFromSecret(new Uint8Array(32).fill(7));
  const { mint, pricing, built } = launch({ wallet });
  assert.ok(Object.isFrozen(built) && Object.isFrozen(built.pricing) && Object.isFrozen(built.pair));
  assert.deepEqual(built.signers, [wallet.publicKey, mint.publicKey]);
  const b64 = signLaunchTransaction(built, wallet, mint);
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  assert.ok(bytes.length <= PACKET_DATA_SIZE, `${bytes.length} bytes`);
  const { message } = decodeTransaction(bytes);
  assert.deepEqual(decompileInstructions(message).map((ix) => ix.programId), [COMPUTE_BUDGET_PROGRAM, COMPUTE_BUDGET_PROGRAM, LAUNCHLAB_PROGRAM], "no dev buy, no token account");
  assert.equal(decompileInstructions(message)[0].data[1] + (decompileInstructions(message)[0].data[2] << 8) + (decompileInstructions(message)[0].data[3] << 16), LAUNCH_DEFAULTS.computeUnitLimit);

  const tx = landed(b64);
  assert.equal(signaturesVerify(tx), true);
  const r = proveLaunch(tx, { wallet: wallet.publicKey });
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(r.launch, {
    mint: mint.publicKey, name: COIN.name, symbol: COIN.symbol, pair: GMEX_PAIR, pool: poolAddress(mint.publicKey, GMEX_PAIR.mint),
    payer: wallet.publicKey, tx: tx.transaction.signatures[0], time: "2026-09-25T01:33:20Z", globalConfig: pricing.configId, uri: COIN.uri,
  });
  assert.equal(proveLaunch(tx, { wallet: GME_LAUNCHER }).clause, "fee_payer");
  const mintAccount = { owner: TOKEN_2022_PROGRAM, lamports: 1, data: [token2022MintData({ mint: mint.publicKey, updateAuthority: LAUNCHLAB_AUTHORITY, ...COIN }).toString("base64"), "base64"] };
  assert.deepEqual(checkLaunchAccounts(r.launch, mintAccount, recordedAccounts().get(pricing.configId)), { ok: true });

  // the free pair (tOpenAI) too, and the longest name, symbol and uri still fit one packet
  const t = launch({ answer: TOPENAI, name: "N".repeat(32), symbol: "S".repeat(10), uri: `https://a.example/${"p".repeat(182)}` });
  const tb = signLaunchTransaction(t.built, t.wallet, t.mint);
  assert.ok(Buffer.from(tb, "base64").length <= PACKET_DATA_SIZE);
  const tp = proveLaunch(landed(tb), { wallet: t.wallet.publicKey });
  assert.equal(tp.ok, true, tp.detail);
  assert.deepEqual(tp.launch.pair, { symbol: "tOpenAI", mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ" });
});

test("a message with anything but the plain launch is refused at sign time and never signed: a dev buy, a token account, a transfer, the reward platform, a transfer fee, another config or raise, the fee guard", () => {
  const { wallet, mint, pricing, built } = launch();
  const attacker = fresh();
  const init = buildInitializeWithToken2022({ wallet, mint, pair: GMEX_PAIR, ...COIN, pricing });
  const cb = [setComputeUnitLimit(200_000), setComputeUnitPrice(1_000)];
  const k = (pubkey, isSigner = false, isWritable = false) => ({ pubkey, isSigner, isWritable });
  const withData = (edit) => { const d = Buffer.from(init.data); edit(d); return { ...init, data: new Uint8Array(d) }; };
  const argsEnd = init.data.length - 11; // the transfer-fee option's tag
  const buy = { programId: LAUNCHLAB_PROGRAM, keys: init.keys.slice(0, 15), data: Buffer.from(`${IX.buyExactIn}${"00".repeat(24)}`, "hex") };
  const ataCreate = { programId: ATA_PROGRAM, keys: [k(wallet.publicKey, true, true), k(attacker.publicKey, false, true), k(wallet.publicKey), k(mint.publicKey), k(SYSTEM_PROGRAM), k(TOKEN_2022_PROGRAM)], data: Uint8Array.from([1]) };
  const transfer = { programId: SYSTEM_PROGRAM, keys: [k(wallet.publicKey, true, true), k(attacker.publicKey, false, true)], data: Uint8Array.from([2, 0, 0, 0, 0, 202, 154, 59, 0, 0, 0, 0]) };
  const memo = { programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", keys: [], data: Buffer.from("meow") };
  const rewardPlatform = { ...init, keys: init.keys.map((x, i) => (i === 3 ? { ...x, pubkey: STONKFUN_PLATFORM_REWARD } : i === 15 ? { ...x, pubkey: curveRuleAddress(STONKFUN_PLATFORM_REWARD, pricing.configId) } : x)) };
  const otherConfig = "3exefyTZ6ves3Z6cvQ9nf1NtSPAnHX95ZtvKWedf7JX6";
  const anotherConfig = { ...init, keys: init.keys.map((x, i) => (i === 2 ? { ...x, pubkey: otherConfig } : i === 15 ? { ...x, pubkey: curveRuleAddress(STONKFUN_PLATFORM, otherConfig) } : x)) };
  const classicQuote = { ...init, keys: init.keys.map((x, i) => (i === 11 ? { ...x, pubkey: TOKEN_PROGRAM } : x)) };
  const otherCreator = { ...init, keys: init.keys.map((x, i) => (i === 1 ? k(attacker.publicKey) : x)) };
  const taxed = withData((d) => { d[argsEnd] = 1; d.writeUInt16LE(100, argsEnd + 1); d.writeBigUInt64LE(10n ** 15n, argsEnd + 3); });
  const moreRaise = withData((d) => { const at = 8 + 1 + 12 + Buffer.byteLength(COIN.name) + Buffer.byteLength(COIN.symbol) + Buffer.byteLength(COIN.uri) + 1 + 16; d.writeBigUInt64LE(pricing.raise * 2n, at); });
  const feeOn = withData((d) => { d[argsEnd - 1] = 1; });
  const rawLimit = (units) => { const d = Buffer.alloc(5); d[0] = 2; d.writeUInt32LE(units, 1); return { programId: COMPUTE_BUDGET_PROGRAM, keys: [], data: new Uint8Array(d) }; };
  const hostile = {
    "a dev buy (buy_exact_in)": [[...cb, init, buy], /instruction for LanMV9.* does not carry/],
    "a token account": [[...cb, ataCreate, init], /instruction for ATokenG.* does not carry/],
    "a SOL transfer": [[...cb, init, transfer], /instruction for 1111.* does not carry/],
    "a memo": [[...cb, init, memo], /instruction for Memo.* does not carry/],
    "the reward platform, with its curve rule": [[...cb, rewardPlatform], /accounts are not the ones/],
    "another config, with its curve rule": [[...cb, anotherConfig], /accounts are not the ones/],
    "the classic token program for the stock": [[...cb, classicQuote], /accounts are not the ones/],
    "another creator": [[...cb, otherCreator], /accounts are not the ones/],
    "a transfer fee": [[...cb, taxed], /data is not the one/],
    "twice the raise": [[...cb, moreRaise], /data is not the one/],
    "the creator fee turned on": [[...cb, feeOn], /data is not the one/],
    "two initializes": [[...cb, init, init], /more than one initialize/],
    "a 1,400-SOL priority fee": [[setComputeUnitLimit(1_400_000), setComputeUnitPrice(10n ** 12n), init], /priority fee of 1400000000000 lamports/],
    "a fee one lamport over the guard": [[setComputeUnitLimit(200_000), setComputeUnitPrice(25_000_001), init], /priority fee of 5000001 lamports/],
    "a huge price and no limit": [[setComputeUnitPrice(10n ** 12n), init], /priority fee/],
    "a limit of 0 units": [[rawLimit(0), init], /compute-unit limit of 0/],
    "two limits": [[cb[0], cb[0], init], /more than one compute-budget/],
    "a third signer": [[...cb, { ...init, keys: [...init.keys, k(attacker.publicKey, true)] }], /signers are not/],
    "no initialize": [[...cb, { ...memo, keys: [k(mint.publicKey, true, true)] }], /does not carry|no initialize/],
  };
  for (const [what, [instructions, reason]] of Object.entries(hostile)) {
    const msg = compileLegacyMessage({ payer: wallet.publicKey, recentBlockhash: blockhash(), instructions }).bytes;
    let calls = 0;
    const spy = (kp) => ({ publicKey: kp.publicKey, sign: (b) => { calls++; return kp.sign(b); } });
    assert.throws(() => checkLaunchMessage(msg, { wallet: wallet.publicKey, mint: mint.publicKey, pair: GMEX_PAIR, pricing }), reason, what);
    assert.throws(() => signLaunchTransaction({ ...built, messageBytes: msg }, spy(wallet), spy(mint)), reason, what);
    assert.equal(calls, 0, `${what}: nothing was signed`);
  }
  // the plain launch passes, with or without a limit, and at exactly the fee guard
  const passes = (instructions) => checkLaunchMessage(compileLegacyMessage({ payer: wallet.publicKey, recentBlockhash: blockhash(), instructions }).bytes, { wallet: wallet.publicKey, mint: mint.publicKey, pair: GMEX_PAIR, pricing });
  assert.equal(passes([...cb, init]).name, COIN.name);
  assert.doesNotThrow(() => passes([init]));
  assert.doesNotThrow(() => passes([setComputeUnitLimit(200_000), setComputeUnitPrice(25_000_000), init]));
  // checked against the pricing it was built with: another raise for the same bytes is refused
  assert.throws(() => checkLaunchMessage(built.messageBytes, { wallet: wallet.publicKey, mint: mint.publicKey, pair: GMEX_PAIR, pricing: { ...pricing, raise: pricing.raise + 1n } }), /data is not the one/);
  // a built launch carrying an absurd curve (a raise of 1, an off-standard supply) is never signed
  for (const bad of [{ raise: 1n }, { supply: 2n, totalSellA: 1n }]) {
    let calls = 0;
    const spy = (kp) => ({ publicKey: kp.publicKey, sign: (b) => { calls++; return kp.sign(b); } });
    assert.throws(() => signLaunchTransaction({ ...built, pricing: { ...built.pricing, ...bad } }, spy(wallet), spy(mint)), /not what fetchPricing returns/);
    assert.equal(calls, 0);
  }
  // a launch is only signed by its own wallet and mint
  assert.throws(() => signLaunchTransaction(built, attacker, mint), /wallet/);
  assert.throws(() => signLaunchTransaction(built, wallet, attacker), /mint/);
  assert.throws(() => signLaunchTransaction(built, mint, wallet), /wallet/);
});

test("what signLaunchTransaction checks is exactly what it signs, even when the built launch's bytes change under it", () => {
  const { wallet, mint, pricing, built } = launch();
  const init = buildInitializeWithToken2022({ wallet, mint, pair: GMEX_PAIR, ...COIN, pricing });
  const costly = compileLegacyMessage({ payer: wallet.publicKey, recentBlockhash: blockhash(), instructions: [setComputeUnitLimit(1_400_000), setComputeUnitPrice(10n ** 12n), init] }).bytes;
  let signed = 0;
  for (let k = 0; k <= 5; k++) {
    let reads = 0;
    const shifty = { ...built, get messageBytes() { return reads++ < k ? built.messageBytes : costly; } };
    let b64;
    try { b64 = signLaunchTransaction(shifty, wallet, mint); } catch (e) { assert.match(e.message, /priority fee/, `k = ${k}`); continue; }
    signed++;
    const { signatures, messageBytes: msg } = decodeTransaction(new Uint8Array(Buffer.from(b64, "base64")));
    assert.equal(hexOf(msg), hexOf(built.messageBytes), `k = ${k}: the plain launch, not the costly one`);
    assert.equal(verifyEd25519(wallet.publicKey, msg, signatures[0]) && verifyEd25519(mint.publicKey, msg, signatures[1]), true);
  }
  assert.ok(signed > 0);
});

test("the builder refuses: a pair that is not a stock pair, pricing for another pair or not fetchPricing's, text over LaunchLab's limits, the mint as the wallet, the fee guard", () => {
  const wallet = fresh(), mint = deriveMintKeypair(wallet, "42"), pricing = pricingOf(GMEX);
  const build = (over) => buildLaunchTransaction({ wallet, mint, pair: GMEX_PAIR, ...COIN, pricing, recentBlockhash: blockhash(), ...over });
  assert.doesNotThrow(() => build({}));
  assert.deepEqual(LAUNCHLAB_LIMITS, { name: 32, symbol: 10, uri: 200 });
  const refused = {
    "STONK (a custom StonkFun pair)": [{ pair: { symbol: "STONK", mint: "6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx" } }, /stock pairs/],
    "SOL": [{ pair: { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" } }, /stock pairs/],
    "a pair whose symbol is another's": [{ pair: { symbol: "TSLAx", mint: GMEX_PAIR.mint } }, /pair's mint is GMEx/],
    "pricing for tOpenAI on the GMEx pair": [{ pricing: pricingOf(TOPENAI) }, /another quote/],
    "a curve rule that is not the config's": [{ pricing: { ...pricing, curveRule: STONKFUN_PLATFORM } }, /not what fetchPricing returns/],
    "a sale as large as the supply": [{ pricing: { ...pricing, totalSellA: pricing.supply } }, /not what fetchPricing returns/],
    "an off-standard supply and sale": [{ pricing: { ...pricing, supply: 2n, totalSellA: 1n } }, /not what fetchPricing returns/],
    "a raise of 1": [{ pricing: { ...pricing, raise: 1n } }, /not what fetchPricing returns/],
    "a raise of u64::MAX": [{ pricing: { ...pricing, raise: 2n ** 64n - 1n } }, /not what fetchPricing returns/],
    "no prices": [{ pricing: { ...pricing, prices: undefined } }, /not what fetchPricing returns/],
    "prices that make a raise of 1 look right": [{ pricing: { ...pricing, raise: 1n, prices: { solUsd: 0, quoteUsd: 1 } } }, /not what fetchPricing returns/],
    "no quote decimals": [{ pricing: { ...pricing, quote: { ...pricing.quote, decimals: undefined } } }, /not what fetchPricing returns/],
    "a raise as a number": [{ pricing: { ...pricing, raise: 5 } }, /not what fetchPricing returns/],
    "a classic-token quote": [{ pricing: { ...pricing, quote: { ...pricing.quote, tokenProgram: TOKEN_PROGRAM } } }, /not what fetchPricing returns/],
    "no pricing": [{ pricing: undefined }, /not what fetchPricing returns/],
    "a 33-byte name": [{ name: "N".repeat(33) }, /name/],
    "an 11-byte symbol": [{ symbol: "S".repeat(11) }, /symbol/],
    "a name with a link": [{ name: "visit cat.fun" }, /name/],
    "an http uri": [{ uri: "http://gateway.irys.xyz/x" }, /https/],
    "a 201-byte uri": [{ uri: `https://a.example/${"p".repeat(183)}` }, /uri/],
    "the mint as the wallet": [{ mint: wallet }, /three accounts/],
    "a fee over the guard": [{ computeUnitLimit: 200_000, computeUnitPriceMicroLamports: 25_000_001 }, /priority fee/],
    "a limit of 0": [{ computeUnitLimit: 0 }, /compute-unit limit/],
    "a bad blockhash": [{ recentBlockhash: "nope" }, /blockhash/],
  };
  for (const [what, [over, pattern]] of Object.entries(refused)) assert.throws(() => build(over), pattern, what);
  assert.equal(MAX_PRIORITY_FEE_LAMPORTS, 5_000_000n, "pump.mjs's guard");
  assert.doesNotThrow(() => build({ computeUnitLimit: 200_000, computeUnitPriceMicroLamports: 25_000_000 }));
  // the sanctuary's launches are never the reward platform's or a transfer-taxed coin's: nothing here can build one
  const ix = buildInitializeWithToken2022({ wallet, mint, pair: GMEX_PAIR, ...COIN, pricing });
  assert.equal(ix.keys[3].pubkey, STONKFUN_PLATFORM);
  assert.equal(decodeInitialize(ix.data).transferFee, 0);
  assert.equal(decodeLegacyMessage(build({}).messageBytes).accountKeys[0], wallet.publicKey, "the wallet pays");
});
