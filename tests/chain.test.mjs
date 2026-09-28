/* Proving a launch, from real StonkFun launches recorded on mainnet (tests/fixtures/). */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  proveLaunch, checkLaunchAccounts, readTokenMetadata, decodeInitialize, pda, isOnCurve, poolAddress, vaultAddress, curveRuleAddress,
  IX, GLOBAL_CONFIG_DISC, LAUNCHLAB_PROGRAM, LAUNCHLAB_AUTHORITY, LAUNCHLAB_EVENT_AUTHORITY, STONKFUN_PLATFORM, STONKFUN_PLATFORM_REWARD,
  signaturesVerify, messageBytes, proveLaunchPump, checkPumpAccounts, BONDING_CURVE_DISC, SOL_PAIR,
  SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, COMPUTE_BUDGET_PROGRAM,
} from "../scripts/lib/chain.mjs";
import { PUMP, CREATE_V2_DISC, createV2Accounts, decodeCreateV2, bondingCurve, anchorDiscriminator } from "../scripts/lib/pump.mjs";
import { base58Decode, base58Encode, STOCK_PAIRS, XSTOCKS } from "../assets/collection.js";
import {
  LAUNCHES, PUMPFUN, FAILED, ACCOUNTS, ACCOUNTS_MORE, REWARD, launchTx, recordedAccounts, GME_LAUNCHER, GOOGL_LAUNCHER, GME_LAUNCH, GOOGL_LAUNCH,
  ANTHROPIC_LAUNCHER, IREN_LAUNCHER, pumpLaunch, token2022MintData, PUMP_COIN,
} from "./helpers.mjs";

const payerOf = (tx) => tx.transaction.message.accountKeys[0];
const keysOf = (tx) => [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
const initOf = (tx) => tx.transaction.message.instructions.find((ix) => keysOf(tx)[ix.programIdIndex] === LAUNCHLAB_PROGRAM
  && Buffer.from(base58Decode(ix.data, 2000)).subarray(0, 8).toString("hex") === IX.initializeWithToken2022);

test("the discriminators are sha256 of their Anchor names", () => {
  const h = (s) => createHash("sha256").update(s).digest().subarray(0, 8).toString("hex");
  assert.equal(h("global:initialize_with_token_2022"), IX.initializeWithToken2022);
  assert.equal(h("global:initialize"), IX.initialize);
  assert.equal(h("global:initialize_v2"), IX.initializeV2);
  assert.equal(h("global:buy_exact_in"), IX.buyExactIn);
  assert.equal(h("account:GlobalConfig"), GLOBAL_CONFIG_DISC);
});

test("the pinned LaunchLab PDAs re-derive, and a PDA is off the curve while a wallet is on it", () => {
  assert.equal(pda(["utf8:vault_auth_seed"], LAUNCHLAB_PROGRAM), LAUNCHLAB_AUTHORITY);
  assert.equal(pda(["utf8:__event_authority"], LAUNCHLAB_PROGRAM), LAUNCHLAB_EVENT_AUTHORITY);
  assert.equal(isOnCurve(base58Decode(LAUNCHLAB_AUTHORITY)), false);
  for (const w of [GME_LAUNCHER, GOOGL_LAUNCHER]) assert.equal(isOnCurve(base58Decode(w)), true, w);
});

test("every account of all six real launches re-derives: pool, both vaults and the curve rule", () => {
  assert.equal(LAUNCHES.answers.length, 6);
  for (const a of LAUNCHES.answers) {
    const tx = a.result, keys = keysOf(tx), ix = initOf(tx);
    const acc = ix.accounts.map((i) => keys[i]);
    assert.equal(acc.length, 16);
    assert.equal(acc[3], STONKFUN_PLATFORM);
    assert.equal(acc[5], poolAddress(acc[6], acc[7]), a.params[0]);
    assert.equal(acc[8], vaultAddress(acc[5], acc[6]));
    assert.equal(acc[9], vaultAddress(acc[5], acc[7]));
    assert.equal(acc[15], curveRuleAddress(acc[3], acc[2]));
  }
});

test("base58 round-trips real signatures and addresses", () => {
  for (const a of LAUNCHES.answers) {
    const sig = a.result.transaction.signatures[0];
    assert.equal(base58Decode(sig).length, 64);
    assert.equal(base58Encode(base58Decode(sig)), sig);
  }
  assert.equal(base58Encode(base58Decode("11111111111111111111111111111111")), "11111111111111111111111111111111");
});

test("ACCEPTED: the real GMEx launch (legacy, with a dev buy) paid by its wallet", () => {
  const tx = launchTx("2VJ6Eqt9");
  const r = proveLaunch(tx, { wallet: GME_LAUNCHER });
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(r.launch, {
    mint: "EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL",
    name: "1 GME can change your life",
    symbol: "1GME",
    pair: { symbol: "GMEx", mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc" },
    pool: "2un6cyq4X2fMdgevvUSpcueiX1ER2CxRjsPxNMNkHcFz",
    payer: GME_LAUNCHER,
    tx: GME_LAUNCH,
    time: new Date(tx.blockTime * 1000).toISOString().replace(".000Z", "Z"),
    globalConfig: "2TygvvGwVLxpJaGfQkFtGFzgvRMQmcFi6fM6iceLTTpu",
    uri: r.launch.uri,
  });
  assert.equal(r.launch.time, "2026-09-24T20:57:15Z"); // block time 1790283435
});

test("ACCEPTED: the real GOOGLx launch, and both pass the read-back of the mint and the global config", () => {
  const r = proveLaunch(launchTx("592bMtm5"), { wallet: GOOGL_LAUNCHER });
  assert.equal(r.ok, true, r.detail);
  assert.equal(r.launch.name, "MedPad");
  assert.equal(r.launch.symbol, "MEDPAD");
  assert.deepEqual(r.launch.pair, { symbol: "GOOGLx", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN" });
  assert.equal(r.launch.tx, GOOGL_LAUNCH);
  const accounts = recordedAccounts();
  for (const [prefix, wallet] of [["592bMtm5", GOOGL_LAUNCHER], ["2VJ6Eqt9", GME_LAUNCHER]]) {
    const { launch } = proveLaunch(launchTx(prefix), { wallet });
    assert.deepEqual(checkLaunchAccounts(launch, accounts.get(launch.mint), accounts.get(launch.globalConfig)), { ok: true });
  }
});

test("each real mint's own metadata carries the name and symbol its launch wrote", () => {
  const accounts = recordedAccounts();
  for (const a of LAUNCHES.answers) {
    const args = decodeInitialize(Buffer.from(base58Decode(initOf(a.result).data, 2000)));
    const mint = keysOf(a.result)[initOf(a.result).accounts[6]];
    const meta = readTokenMetadata(Buffer.from(accounts.get(mint).data[0], "base64"));
    assert.equal(meta.mint, mint);
    assert.equal(meta.name, args.name);
    assert.equal(meta.symbol, args.symbol);
  }
});

test("the read-back refuses a mint whose metadata differs, a missing mint, and a config for another stock", () => {
  const accounts = recordedAccounts();
  const { launch } = proveLaunch(launchTx("592bMtm5"), { wallet: GOOGL_LAUNCHER });
  const mint = accounts.get(launch.mint), config = accounts.get(launch.globalConfig);
  assert.equal(checkLaunchAccounts({ ...launch, name: "MedPad2" }, mint, config).clause, "metadata_mismatch");
  assert.equal(checkLaunchAccounts(launch, null, config).clause, "metadata");
  const renamable = Buffer.from(mint.data[0], "base64");
  const at = renamable.indexOf(Buffer.from(base58Decode(LAUNCHLAB_AUTHORITY)), 166);
  assert.ok(at > 0);
  base58Decode(GOOGL_LAUNCHER).forEach((b, i) => { renamable[at + i] = b; }); // the creator as update authority
  assert.match(checkLaunchAccounts(launch, { ...mint, data: [renamable.toString("base64"), "base64"] }, config).detail, /not held by LaunchLab/);
  assert.equal(checkLaunchAccounts(launch, { ...mint, owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, config).clause, "metadata");
  const gme = proveLaunch(launchTx("2VJ6Eqt9"), { wallet: GME_LAUNCHER }).launch;
  assert.equal(checkLaunchAccounts(launch, mint, accounts.get(gme.globalConfig)).clause, "global_config");
  assert.equal(checkLaunchAccounts(launch, mint, null).clause, "global_config");
});

test("REFUSED: a real launch whose fee payer is not the listed wallet", () => {
  const r = proveLaunch(launchTx("2VJ6Eqt9"), { wallet: GOOGL_LAUNCHER });
  assert.equal(r.clause, "fee_payer");
  assert.equal(r.launchLike, true);
});

test("REFUSED: a real failed transaction of a launch wallet, and a real launch marked as failed", () => {
  const real = proveLaunch(structuredClone(FAILED.answer.result), { wallet: GME_LAUNCHER });
  assert.equal(real.clause, "failed");
  assert.equal(real.launchLike, false);
  const tx = launchTx("2VJ6Eqt9");
  tx.meta.err = { InstructionError: [2, { Custom: 6003 }] };
  tx.meta.status = { Err: tx.meta.err };
  assert.equal(proveLaunch(tx, { wallet: GME_LAUNCHER }).clause, "failed");
});

test("ACCEPTED: the real launches priced in a PreStock (ANTHROPIC, v0 with a lookup table) and a Backpack stock (IREN), with the read-back", () => {
  const accounts = recordedAccounts();
  const anthropic = launchTx("4Q6JhGwz");
  assert.equal(anthropic.version, 0);
  assert.ok(anthropic.transaction.message.addressTableLookups.length > 0);
  const a = proveLaunch(anthropic, { wallet: ANTHROPIC_LAUNCHER });
  assert.equal(a.ok, true, a.detail);
  assert.deepEqual([a.launch.name, a.launch.symbol, a.launch.pair, a.launch.time], ["Hollow Finch", "HLFINC", { symbol: "ANTHROPIC", mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw" }, "2026-09-24T20:29:58Z"]);
  const i = proveLaunch(launchTx("5egBA4T2"), { wallet: IREN_LAUNCHER });
  assert.equal(i.ok, true, i.detail);
  assert.deepEqual([i.launch.name, i.launch.symbol, i.launch.pair], ["I-RUN", "IRUN", { symbol: "IREN", mint: "RENzhrJQgmAnfcLhU1U5XwAMc6TC15UA6jCbPBaasnj" }]);
  for (const { launch } of [a, i]) {
    assert.deepEqual(checkLaunchAccounts(launch, accounts.get(launch.mint), accounts.get(launch.globalConfig)), { ok: true });
  }
  assert.equal(ACCOUNTS_MORE.globalConfigs.accounts.length, 2);
});

test("REFUSED: the two real launches priced in something that is not a stock pair (SOL; a custom token), after passing every other check", () => {
  // one v0 with a lookup table, one legacy with a dev buy
  for (const prefix of ["4wACyqyi", "5cy1wDDr"]) {
    const tx = launchTx(prefix);
    const r = proveLaunch(tx, { wallet: payerOf(tx) });
    assert.equal(r.clause, "quote_not_stock", `${prefix}: ${r.detail}`);
    assert.equal(r.launchLike, true);
  }
});

test("REFUSED: the list of stock pairs is what decides; a launch on an allowed pair is refused against a list without it", () => {
  const i = proveLaunch(launchTx("5egBA4T2"), { wallet: IREN_LAUNCHER, stocks: XSTOCKS });
  assert.equal(i.clause, "quote_not_stock");
  assert.equal(proveLaunch(launchTx("592bMtm5"), { wallet: GOOGL_LAUNCHER, stocks: [] }).clause, "quote_not_stock");
});

/** A real launch re-priced in `quote`: the quote, the pool, both vaults (and the buy's) re-derived, so only the quote list can refuse it. */
function repriced(prefix, quote) {
  const tx = launchTx(prefix);
  const msg = tx.transaction.message;
  const keys = msg.accountKeys;
  const init = initOf(tx);
  const [mint, oldQuote, oldPool] = [keys[init.accounts[6]], keys[init.accounts[7]], keys[init.accounts[5]]];
  const pool = poolAddress(mint, quote);
  const swap = { [oldQuote]: quote, [oldPool]: pool, [vaultAddress(oldPool, mint)]: vaultAddress(pool, mint), [vaultAddress(oldPool, oldQuote)]: vaultAddress(pool, quote) };
  msg.accountKeys = keys.map((k) => swap[k] ?? k);
  for (const g of tx.meta.innerInstructions ?? []) g.instructions = [];
  return tx;
}

test("REFUSED (hostile): a real launch re-priced, with every account re-derived, in tokens that are not the sanctuary's pairs", () => {
  const control = repriced("592bMtm5", "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc"); // GMEx, an allowed pair: accepted
  assert.equal(proveLaunch(control, { wallet: GOOGL_LAUNCHER }).ok, true);
  const hostile = [
    "So11111111111111111111111111111111111111112",   // SOL
    "6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx",  // STONK, a "custom" StonkFun pair
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  // USDC
  ];
  for (const quote of hostile) assert.equal(proveLaunch(repriced("592bMtm5", quote), { wallet: GOOGL_LAUNCHER }).clause, "quote_not_stock", quote);
});

test("REFUSED (hostile): an allowed pair's mint put in the quote slot without the pool and vaults that go with it", () => {
  const tx = launchTx("592bMtm5");
  const keys = tx.transaction.message.accountKeys;
  const init = initOf(tx);
  keys[init.accounts[7]] = "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ"; // the Tessera OPENAI mint
  assert.equal(proveLaunch(tx, { wallet: GOOGL_LAUNCHER }).clause, "accounts");
});

test("every stock pair is a Token-2022 mint, so a launch priced in one with the classic token program is refused", () => {
  const tx = repriced("592bMtm5", STOCK_PAIRS.find((p) => p.symbol === "MU").mint);
  const keys = tx.transaction.message.accountKeys;
  const init = initOf(tx);
  let classic = keys.indexOf("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  if (classic < 0) { keys.push("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"); tx.transaction.message.header.numReadonlyUnsignedAccounts += 1; classic = keys.length - 1; }
  init.accounts[11] = classic;
  tx.transaction.message.instructions = tx.transaction.message.instructions.filter((ix) => ix === init || keys[ix.programIdIndex] === "ComputeBudget111111111111111111111111111111");
  const r = proveLaunch(tx, { wallet: GOOGL_LAUNCHER });
  assert.equal(r.clause, "accounts");
  assert.match(r.detail, /Token-2022/);
});

test("REFUSED: the wrong platform (a real launch with the platform config swapped, and the curve rule to match)", () => {
  for (const platform of [STONKFUN_PLATFORM_REWARD, "Aew2FoY9UPjKGgkuDrDMb238fH2pU8XuZRHmXwuRsiQB"]) {
    const tx = launchTx("592bMtm5");
    const keys = tx.transaction.message.accountKeys;
    const init = initOf(tx);
    const gc = keys[init.accounts[2]];
    keys[keys.indexOf(STONKFUN_PLATFORM)] = platform;
    keys[init.accounts[15]] = curveRuleAddress(platform, gc);
    const r = proveLaunch(tx, { wallet: GOOGL_LAUNCHER });
    assert.equal(r.clause, "platform");
  }
});

test("REFUSED: a real launch on StonkFun's reward platform (transfer-taxed), made the way StonkFun's site makes them", () => {
  const tx = structuredClone(REWARD.answer.result);
  const init = initOf(tx);
  assert.equal(keysOf(tx)[init.accounts[3]], STONKFUN_PLATFORM_REWARD);
  assert.equal(decodeInitialize(Buffer.from(base58Decode(init.data, 2000))).transferFee, 1);
  const r = proveLaunch(tx, { wallet: payerOf(tx) });
  assert.equal(r.clause, "platform");
  assert.match(r.detail, /reward platform/);
  // and a transfer-taxed launch on the standard platform is refused too
  const taxed = launchTx("592bMtm5");
  const ti = initOf(taxed);
  const d = Buffer.from(base58Decode(ti.data, 2000));
  const tail = Buffer.from(base58Decode(init.data, 2000)).subarray(-11); // the reward launch's Some(transfer fee)
  tail.copy(d, d.length - 11);
  ti.data = base58Encode(d);
  assert.equal(proveLaunch(taxed, { wallet: GOOGL_LAUNCHER }).clause, "transfer_fee");
});

test("REFUSED: a real pump.fun create, even when its payer is listed", () => {
  const tx = structuredClone(PUMPFUN.answer.result);
  const r = proveLaunch(tx, { wallet: payerOf(tx) });
  assert.equal(r.clause, "no_launch");
  assert.equal(r.launchLike, false);
});

test("REFUSED: instructions that cannot be decoded", () => {
  const cut = launchTx("592bMtm5");
  const init = initOf(cut);
  init.data = base58Encode(base58Decode(init.data, 2000).subarray(0, 60));
  assert.equal(proveLaunch(cut, { wallet: GOOGL_LAUNCHER }).clause, "decode");

  const longer = launchTx("592bMtm5");
  const i2 = initOf(longer);
  i2.data = base58Encode(Uint8Array.from([...base58Decode(i2.data, 2000), 7]));
  assert.equal(proveLaunch(longer, { wallet: GOOGL_LAUNCHER }).clause, "decode");

  const garbled = launchTx("592bMtm5");
  initOf(garbled).data = "0OIl"; // not base58
  assert.equal(proveLaunch(garbled, { wallet: GOOGL_LAUNCHER }).clause, "unreadable");

  const outOfRange = launchTx("592bMtm5");
  initOf(outOfRange).accounts[3] = 999;
  assert.equal(proveLaunch(outOfRange, { wallet: GOOGL_LAUNCHER }).clause, "unreadable");

  const curve = launchTx("592bMtm5");
  const i3 = initOf(curve);
  const d = Buffer.from(base58Decode(i3.data, 2000));
  const args = decodeInitialize(d);
  const curveAt = 8 + 1 + 4 + Buffer.byteLength(args.name) + 4 + Buffer.byteLength(args.symbol) + 4 + Buffer.byteLength(args.uri);
  d[curveAt] = 1; // the Fixed curve
  i3.data = base58Encode(d);
  assert.equal(proveLaunch(curve, { wallet: GOOGL_LAUNCHER }).clause, "decode");
});

test("REFUSED: anything else in the transaction, another LaunchLab variant, a launch made through another program, a newer version", () => {
  const memo = launchTx("592bMtm5");
  const msg = memo.transaction.message;
  msg.accountKeys.push("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
  msg.header.numReadonlyUnsignedAccounts += 1;
  msg.instructions.push({ programIdIndex: msg.accountKeys.length - 1, accounts: [], data: base58Encode(Buffer.from("meow")), stackHeight: null });
  const r = proveLaunch(memo, { wallet: GOOGL_LAUNCHER });
  assert.equal(r.clause, "unexpected_instruction");

  const variant = launchTx("592bMtm5");
  const iv = initOf(variant);
  const d = Buffer.from(base58Decode(iv.data, 2000));
  Buffer.from(IX.initialize, "hex").copy(d, 0);
  iv.data = base58Encode(d);
  assert.equal(proveLaunch(variant, { wallet: GOOGL_LAUNCHER }).clause, "unrecorded_variant");

  const cpi = launchTx("592bMtm5");
  const ci = initOf(cpi);
  cpi.transaction.message.instructions = cpi.transaction.message.instructions.filter((x) => x !== ci);
  cpi.meta.innerInstructions.push({ index: 0, instructions: [{ ...ci, stackHeight: 2 }] });
  assert.equal(proveLaunch(cpi, { wallet: GOOGL_LAUNCHER }).clause, "cpi_launch");

  const buyElsewhere = launchTx("592bMtm5");
  const keys = keysOf(buyElsewhere);
  const buy = buyElsewhere.transaction.message.instructions.find((x) => keys[x.programIdIndex] === LAUNCHLAB_PROGRAM
    && Buffer.from(base58Decode(x.data, 2000)).subarray(0, 8).toString("hex") === IX.buyExactIn);
  buy.accounts[4] = buy.accounts[2]; // another account where the pool must be
  assert.equal(proveLaunch(buyElsewhere, { wallet: GOOGL_LAUNCHER }).clause, "unexpected_instruction");

  const v1 = launchTx("592bMtm5");
  v1.version = 1;
  assert.equal(proveLaunch(v1, { wallet: GOOGL_LAUNCHER }).clause, "tx_version");
  assert.equal(proveLaunch(null, { wallet: GOOGL_LAUNCHER }).clause, "unreadable");
});

test("REFUSED: a launch whose creator is not the wallet, or whose new mint did not sign", () => {
  const creator = launchTx("592bMtm5");
  const keys = creator.transaction.message.accountKeys;
  keys.push(GME_LAUNCHER);
  creator.transaction.message.header.numReadonlyUnsignedAccounts += 1;
  initOf(creator).accounts[1] = keys.length - 1;
  assert.equal(proveLaunch(creator, { wallet: GOOGL_LAUNCHER }).clause, "creator");

  const unsigned = launchTx("592bMtm5");
  const m = unsigned.transaction.message;
  const mintIndex = initOf(unsigned).accounts[6];
  assert.ok(mintIndex < m.header.numRequiredSignatures);
  m.header.numRequiredSignatures = 1; // the mint no longer a signer
  unsigned.transaction.signatures = unsigned.transaction.signatures.slice(0, 1);
  assert.equal(proveLaunch(unsigned, { wallet: GOOGL_LAUNCHER }).clause, "accounts");
});

test("the recorded accounts are the ones the fixtures say (capture dates kept)", () => {
  assert.equal(ACCOUNTS.mints.readAt, "2026-09-25T13:50:10.276Z");
  assert.equal(ACCOUNTS.globalConfigs.readAt, "2026-09-25T13:50:08.022Z");
  assert.equal(ACCOUNTS.mints.accounts.length, 6);
  for (const a of LAUNCHES.answers) assert.match(a.readAt, /^2026-09-25T/);
});

/* ── The transaction's own signatures, and more hostile variants (review 3) ──────────────── */

const OWNER_W = "3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3";
const ATTACKER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
/** A recorded launch with its launcher replaced by `who` everywhere (static keys and loaded ones). */
function asWallet(prefix, who = OWNER_W) {
  const tx = launchTx(prefix), orig = payerOf(tx), sw = (k) => (k === orig ? who : k);
  tx.transaction.message.accountKeys = tx.transaction.message.accountKeys.map(sw);
  if (tx.meta.loadedAddresses) for (const l of ["writable", "readonly"]) tx.meta.loadedAddresses[l] = tx.meta.loadedAddresses[l].map(sw);
  return tx;
}

test("every signature of every recorded launch verifies over its rebuilt message (legacy and v0); relabelled or altered, none does", () => {
  for (const a of LAUNCHES.answers) {
    const tx = structuredClone(a.result);
    assert.equal(signaturesVerify(tx), true, a.params[0].slice(0, 8));
    assert.equal(signaturesVerify(asWallet(a.params[0].slice(0, 8))), false, `${a.params[0].slice(0, 8)} relabelled`);
    const changed = structuredClone(a.result);
    changed.transaction.message.recentBlockhash = base58Encode(Buffer.alloc(32, 3));
    assert.equal(signaturesVerify(changed), false, `${a.params[0].slice(0, 8)} with another blockhash`);
    const dropped = structuredClone(a.result);
    dropped.transaction.signatures.pop();
    assert.equal(signaturesVerify(dropped), false, "a signature missing");
  }
  assert.equal(messageBytes({ version: 1, transaction: launchTx("592bMtm5").transaction }), null, "no message for a version it does not know");
});

test("REFUSED (hostile, review 3): the owner loaded from a lookup table as payer, an attacker co-signer as the launch's payer, a status with no err", () => {
  {
    const tx = asWallet("4Q6JhGwz", ATTACKER);
    tx.meta.loadedAddresses.readonly.push(OWNER_W);
    tx.transaction.message.addressTableLookups[0].readonlyIndexes.push(250);
    const idx = keysOf(tx).length - 1, init = initOf(tx);
    init.accounts[0] = idx; init.accounts[1] = idx;
    assert.equal(proveLaunch(tx, { wallet: OWNER_W }).clause, "fee_payer");
  }
  {
    const tx = asWallet("592bMtm5"), m = tx.transaction.message;
    m.accountKeys.splice(1, 0, ATTACKER); m.header.numRequiredSignatures += 1; tx.transaction.signatures.splice(1, 0, base58Encode(Buffer.alloc(64, 7)));
    const shift = (i) => (i >= 1 ? i + 1 : i);
    for (const ix of m.instructions) { ix.programIdIndex = shift(ix.programIdIndex); ix.accounts = ix.accounts.map(shift); }
    initOf(tx).accounts[0] = 1;
    assert.equal(proveLaunch(tx, { wallet: OWNER_W }).clause, "payer");
  }
  {
    const tx = asWallet("592bMtm5");
    delete tx.meta.err;
    assert.equal(proveLaunch(tx, { wallet: OWNER_W }).clause, "failed");
  }
});

/* ── pump.fun: the sanctuary's automatic launcher (scripts/lib/pump.mjs), proved like LaunchLab ─── */

const PUMP_PAYER = "BevqMZhvHq1T3io2eRL6ZmvzyHmH6wk6qh1e3oTgrdrM";   // the recorded launch's payer and creator
const PUMP_MINT = "EbBE6V3wta2HtsdAPsxoJwaYtGUuxdsLRLTZ8btTpump";
const pumpKeys = (tx) => keysOf(tx);
const pumpCreateOf = (tx) => tx.transaction.message.instructions.find((ix) => pumpKeys(tx)[ix.programIdIndex] === PUMP.program
  && Buffer.from(base58Decode(ix.data, 2000)).subarray(0, 8).toString("hex") === CREATE_V2_DISC);
/** The recorded real launch, as recorded: ComputeBudget (one with a Jito marker account), create_v2, an ATA create, buy_v2. */
const recordedPump = () => structuredClone(PUMPFUN.answer.result);
/** The recorded real launch cut down to what the sanctuary's launcher sends: plain ComputeBudget and create_v2 alone. */
function createOnly() {
  const tx = recordedPump(), m = tx.transaction.message;
  m.instructions = m.instructions.filter((ix) => [COMPUTE_BUDGET_PROGRAM, PUMP.program].includes(pumpKeys(tx)[ix.programIdIndex])
    && !(pumpKeys(tx)[ix.programIdIndex] === PUMP.program && ix !== pumpCreateOf(tx)));
  for (const ix of m.instructions) if (pumpKeys(tx)[ix.programIdIndex] === COMPUTE_BUDGET_PROGRAM) ix.accounts = [];
  tx.meta.innerInstructions = tx.meta.innerInstructions.filter((g) => g.index === 2);
  return tx;
}
/** Rewrite create_v2's data in `tx` with `edit(bytes, offsetAfterStrings)`. */
function editCreate(tx, edit) {
  const ix = pumpCreateOf(tx), d = Buffer.from(base58Decode(ix.data, 2000)), a = decodeCreateV2(d);
  const at = 8 + 12 + Buffer.byteLength(a.name) + Buffer.byteLength(a.symbol) + Buffer.byteLength(a.uri); // the creator
  edit(d, at);
  ix.data = base58Encode(d);
  return tx;
}
/** A legacy launch built and signed by the stage-1 builder, with `ix` (a { programId, accounts, data } json instruction) added. */
function builtWith(extra) {
  const L = pumpLaunch();
  const m = L.tx.transaction.message;
  for (const x of extra) {
    const idx = (k) => { let i = m.accountKeys.indexOf(k); if (i < 0) { m.accountKeys.push(k); m.header.numReadonlyUnsignedAccounts += 1; i = m.accountKeys.length - 1; } return i; };
    m.instructions.push({ programIdIndex: idx(x.programId), accounts: x.accounts.map(idx), data: base58Encode(Buffer.from(x.data)) });
  }
  return L;
}

test("pump.fun: the recorded real create_v2 is re-derived by pump.mjs's own derivations (every one of its sixteen accounts)", () => {
  const tx = recordedPump(), ix = pumpCreateOf(tx);
  assert.deepEqual(ix.accounts.map((i) => pumpKeys(tx)[i]), createV2Accounts(PUMP_MINT, PUMP_PAYER).map((k) => k.pubkey));
  assert.equal(pumpKeys(tx)[ix.accounts[2]], bondingCurve(PUMP_MINT));
  assert.equal(BONDING_CURVE_DISC, createHash("sha256").update("account:BondingCurve").digest().subarray(0, 8).toString("hex"));
});

test("pump.fun REFUSED: the recorded real launch as it was made (a dev buy with buy_v2), even with its payer listed; LaunchLab's proof still calls it no launch", () => {
  const r = proveLaunchPump(recordedPump(), { wallet: PUMP_PAYER });
  assert.equal(r.clause, "pump_dev_buy");
  assert.equal(r.launchLike, true);
  assert.equal(proveLaunch(recordedPump(), { wallet: PUMP_PAYER }).clause, "no_launch");
  // without the buy, its ATA create and Jito-marked ComputeBudget are still refused
  const noBuy = recordedPump(), m = noBuy.transaction.message;
  m.instructions = m.instructions.filter((ix) => !(pumpKeys(noBuy)[ix.programIdIndex] === PUMP.program && ix !== pumpCreateOf(noBuy)));
  assert.equal(proveLaunchPump(noBuy, { wallet: PUMP_PAYER }).clause, "pump_unexpected_instruction");
});

test("pump.fun ACCEPTED: the recorded real launch cut down to create_v2 alone (v0, lookup table), as a SOL-priced entry", () => {
  const tx = createOnly();
  const r = proveLaunchPump(tx, { wallet: PUMP_PAYER });
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(r.launch, {
    mint: PUMP_MINT, name: "Gull Gadot", symbol: "GULLGADOT", pair: { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" },
    pool: bondingCurve(PUMP_MINT), payer: PUMP_PAYER, tx: tx.transaction.signatures[0], time: "2026-09-24T20:41:59Z", launchpad: "pump.fun",
    uri: "https://ipfs.io/ipfs/QmbUFoY7PHPMCmkqKjerAnfseEKLszkdmqcd4SX4dGqJJd",
  });
  assert.deepEqual(r.launch.pair, SOL_PAIR);
  assert.equal(proveLaunch(tx, { wallet: PUMP_PAYER }).clause, "no_launch");
});

test("pump.fun ACCEPTED: a launch built and signed by the stage-1 builder (legacy), its signatures verify, and the read-back passes", () => {
  const L = pumpLaunch();
  const r = proveLaunchPump(L.tx, { wallet: L.wallet });
  assert.equal(r.ok, true, r.detail);
  assert.equal(signaturesVerify(L.tx), true);
  assert.deepEqual([r.launch.mint, r.launch.pool, r.launch.launchpad, r.launch.tx], [L.mint, L.curve, "pump.fun", L.signature]);
  assert.deepEqual(checkPumpAccounts(r.launch, L.accounts.get(L.mint), L.accounts.get(L.curve)), { ok: true });
});

test("pump.fun REFUSED: the wrong wallet, a failed transaction, a newer version, no block time", () => {
  assert.equal(proveLaunchPump(createOnly(), { wallet: GME_LAUNCHER }).clause, "fee_payer");
  const L = pumpLaunch();
  assert.equal(proveLaunchPump(L.tx, { wallet: PUMP_PAYER }).clause, "fee_payer");
  const failed = createOnly();
  failed.meta.err = { InstructionError: [2, { Custom: 6000 }] }; failed.meta.status = { Err: failed.meta.err };
  assert.equal(proveLaunchPump(failed, { wallet: PUMP_PAYER }).clause, "failed");
  const noErr = createOnly(); delete noErr.meta.err;
  assert.equal(proveLaunchPump(noErr, { wallet: PUMP_PAYER }).clause, "failed");
  const v1 = createOnly(); v1.version = 1;
  assert.equal(proveLaunchPump(v1, { wallet: PUMP_PAYER }).clause, "tx_version");
  const untimed = createOnly(); delete untimed.blockTime;
  assert.equal(proveLaunchPump(untimed, { wallet: PUMP_PAYER }).clause, "no_time");
  assert.equal(proveLaunchPump(null, { wallet: PUMP_PAYER }).clause, "unreadable");
  assert.equal(proveLaunchPump(launchTx("592bMtm5"), { wallet: GOOGL_LAUNCHER }).clause, "no_launch");
  // A malformed status (an RPC answer that is not { Ok } / { Err }) is a refusal, never a crash, on both launchpads.
  for (const status of ["Ok", 1, true, []]) {
    const odd = createOnly(); odd.meta.status = status;
    assert.equal(proveLaunchPump(odd, { wallet: PUMP_PAYER }).clause, "failed", JSON.stringify(status));
    const oddLab = launchTx("2VJ6Eqt9"); oddLab.meta.status = status;
    assert.equal(proveLaunch(oddLab, { wallet: GME_LAUNCHER }).clause, "failed", JSON.stringify(status));
  }
});

test("pump.fun REFUSED: a create made through another program (CPI), and two creates in one transaction", () => {
  const cpi = createOnly(), ci = pumpCreateOf(cpi);
  cpi.transaction.message.instructions = cpi.transaction.message.instructions.filter((x) => x !== ci);
  cpi.meta.innerInstructions.push({ index: 0, instructions: [{ ...ci, stackHeight: 2 }] });
  const r = proveLaunchPump(cpi, { wallet: PUMP_PAYER });
  assert.equal(r.clause, "pump_cpi_launch");
  assert.equal(r.launchLike, true);
  const two = createOnly();
  two.transaction.message.instructions.push(structuredClone(pumpCreateOf(two)));
  assert.equal(proveLaunchPump(two, { wallet: PUMP_PAYER }).clause, "pump_several_launches");
  const legacyCreate = createOnly(), li = pumpCreateOf(legacyCreate), d = Buffer.from(base58Decode(li.data, 2000));
  Buffer.from(createHash("sha256").update("global:create").digest().subarray(0, 8)).copy(d, 0);
  li.data = base58Encode(d);
  assert.equal(proveLaunchPump(legacyCreate, { wallet: PUMP_PAYER }).clause, "pump_unrecorded_variant");
});

test("pump.fun REFUSED: anything else in the transaction: a SOL transfer, a memo, a buy, an unknown ComputeBudget kind", () => {
  const transfer = Buffer.alloc(12); transfer.writeUInt32LE(2, 0); transfer.writeBigUInt64LE(1_000_000n, 4);
  const cases = [
    [{ programId: SYSTEM_PROGRAM, accounts: [null, "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"], data: transfer }, "pump_unexpected_instruction"],
    [{ programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", accounts: [], data: Buffer.from("meow") }, "pump_unexpected_instruction"],
    [{ programId: PUMP.program, accounts: [], data: Buffer.from(anchorDiscriminator("buy_v2") + "00".repeat(16), "hex") }, "pump_dev_buy"],
    [{ programId: PUMP.program, accounts: [], data: Buffer.from(anchorDiscriminator("buy") + "00".repeat(16), "hex") }, "pump_dev_buy"],
    [{ programId: PUMP.program, accounts: [], data: Buffer.from(anchorDiscriminator("sell") + "00".repeat(16), "hex") }, "pump_unexpected_instruction"],
    [{ programId: COMPUTE_BUDGET_PROGRAM, accounts: [], data: Buffer.from([2, 1, 0, 0]) }, "pump_unexpected_instruction"],
  ];
  for (const [ix, clause] of cases) {
    const x = { ...ix, accounts: ix.accounts.map((a) => a ?? pumpLaunch().wallet) };
    const t = builtWith([x]);
    assert.equal(proveLaunchPump(t.tx, { wallet: t.wallet }).clause, clause, ix.programId);
  }
});

test("pump.fun REFUSED: mayhem mode on, other options on, a creator that is not the wallet, a mint that did not sign", () => {
  const mayhem = editCreate(createOnly(), (d, at) => { d[at + 32] = 1; });
  assert.equal(proveLaunchPump(mayhem, { wallet: PUMP_PAYER }).clause, "pump_mayhem");
  for (const [off, what] of [[33, "cashback"], [34, "creator fee"], [42, "holder reward"]]) {
    const t = editCreate(createOnly(), (d, at) => { d[at + off] = 1; });
    assert.equal(proveLaunchPump(t, { wallet: PUMP_PAYER }).clause, "pump_options", what);
  }
  const creator = editCreate(createOnly(), (d, at) => { Buffer.from(base58Decode(GME_LAUNCHER)).copy(d, at); });
  assert.equal(proveLaunchPump(creator, { wallet: PUMP_PAYER }).clause, "pump_not_creator");
  // absent trailing options read as off (the program reads them so): the same coin
  const short = createOnly(), si = pumpCreateOf(short);
  si.data = base58Encode(Buffer.from(base58Decode(si.data, 2000)).subarray(0, -10));
  assert.equal(proveLaunchPump(short, { wallet: PUMP_PAYER }).ok, true);
  const garbled = editCreate(createOnly(), (d, at) => { d[at + 32] = 2; });
  assert.equal(proveLaunchPump(garbled, { wallet: PUMP_PAYER }).clause, "pump_decode");
  const L = pumpLaunch(), m = L.tx.transaction.message;
  m.header.numRequiredSignatures = 1; L.tx.transaction.signatures = L.tx.transaction.signatures.slice(0, 1);
  assert.equal(proveLaunchPump(L.tx, { wallet: L.wallet }).clause, "pump_mint_unsigned");
});

test("pump.fun REFUSED: an account swapped, replaced or added (a coin-priced launch), and a user that is not the wallet", () => {
  const swapped = createOnly(), s = pumpCreateOf(swapped);
  [s.accounts[2], s.accounts[3]] = [s.accounts[3], s.accounts[2]];
  assert.equal(proveLaunchPump(swapped, { wallet: PUMP_PAYER }).clause, "pump_wrong_accounts");
  const L = pumpLaunch(), m = L.tx.transaction.message, c = m.instructions.find((ix) => m.accountKeys[ix.programIdIndex] === PUMP.program);
  m.accountKeys[c.accounts[2]] = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";          // another bonding curve
  assert.equal(proveLaunchPump(L.tx, { wallet: L.wallet }).clause, "pump_wrong_accounts");
  const extra = createOnly();
  pumpCreateOf(extra).accounts.push(0);
  assert.equal(proveLaunchPump(extra, { wallet: PUMP_PAYER }).clause, "pump_not_sol");
  const fewer = createOnly();
  pumpCreateOf(fewer).accounts.pop();
  assert.equal(proveLaunchPump(fewer, { wallet: PUMP_PAYER }).clause, "pump_wrong_accounts");
  const user = createOnly(), u = pumpCreateOf(user);
  u.accounts[5] = u.accounts[0];
  assert.equal(proveLaunchPump(user, { wallet: PUMP_PAYER }).clause, "pump_payer");
});

test("pump.fun read-back: refuses a mint whose metadata differs or can be renamed by the wallet, and a bonding curve that is missing, foreign or not one", () => {
  const L = pumpLaunch(), { launch } = proveLaunchPump(L.tx, { wallet: L.wallet });
  const mint = L.accounts.get(L.mint), curve = L.accounts.get(L.curve);
  assert.equal(checkPumpAccounts({ ...launch, symbol: "GULL" }, mint, curve).clause, "metadata_mismatch");
  assert.equal(checkPumpAccounts(launch, { ...mint, owner: TOKEN_PROGRAM }, curve).clause, "metadata");
  assert.equal(checkPumpAccounts(launch, null, curve).clause, "metadata");
  const renamable = { ...mint, data: [token2022MintData({ mint: L.mint, updateAuthority: L.wallet, ...PUMP_COIN }).toString("base64"), "base64"] };
  assert.match(checkPumpAccounts(launch, renamable, curve).detail, /rename/);
  const another = { ...mint, data: [token2022MintData({ mint: PUMP_MINT, updateAuthority: SYSTEM_PROGRAM, ...PUMP_COIN }).toString("base64"), "base64"] };
  assert.equal(checkPumpAccounts(launch, another, curve).clause, "metadata");
  assert.equal(checkPumpAccounts(launch, mint, null).clause, "bonding_curve");
  assert.equal(checkPumpAccounts(launch, mint, { ...curve, owner: SYSTEM_PROGRAM }).clause, "bonding_curve");
  assert.equal(checkPumpAccounts(launch, mint, { ...curve, data: [Buffer.alloc(151).toString("base64"), "base64"] }).clause, "bonding_curve");
  assert.equal(checkPumpAccounts({ ...launch, pool: GME_LAUNCHER }, mint, curve).clause, "bonding_curve");
});

test("pump.fun read-back: the metadata's update authority must be None (32 zero bytes), as create_v2 leaves it on chain; any key that could rename the coin is refused", () => {
  // The recorded real launch: pump.fun's create_v2 calls Token-2022's UpdateAuthority
  // (spl_token_metadata_interface:update_the_authority) with 32 zero bytes: no one can rename the coin.
  const tx = recordedPump(), keys = pumpKeys(tx);
  const ua = createHash("sha256").update("spl_token_metadata_interface:update_the_authority").digest().subarray(0, 8).toString("hex");
  assert.equal(ua, "d7e4a6e45464567b");
  const inner = tx.meta.innerInstructions.flatMap((g) => g.instructions).filter((ix) => keys[ix.programIdIndex] === TOKEN_2022_PROGRAM)
    .map((ix) => Buffer.from(base58Decode(ix.data, 2000))).filter((d) => d.subarray(0, 8).toString("hex") === ua);
  assert.equal(inner.length, 1);
  assert.equal(base58Encode(inner[0].subarray(8, 40)), SYSTEM_PROGRAM, "the new update authority is None");
  const L = pumpLaunch(), { launch } = proveLaunchPump(L.tx, { wallet: L.wallet });
  const curve = L.accounts.get(L.curve);
  const mintWith = (updateAuthority) => ({ ...L.accounts.get(L.mint), data: [token2022MintData({ mint: L.mint, updateAuthority, ...PUMP_COIN }).toString("base64"), "base64"] });
  assert.deepEqual(checkPumpAccounts(launch, mintWith(SYSTEM_PROGRAM), curve), { ok: true });
  for (const [who, key] of [["a stranger", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"], ["pump.fun's mint authority", PUMP.mintAuthority], ["pump.fun itself", PUMP.program], ["the wallet", L.wallet]]) {
    const r = checkPumpAccounts(launch, mintWith(key), curve);
    assert.equal(r.clause, "metadata", who);
    assert.match(r.detail, /rename/, who);
  }
});

test("pump.fun read-back: a malformed RPC answer (no data, a null, a number, an array) is refused, never thrown out of the builder", () => {
  const L = pumpLaunch(), { launch } = proveLaunchPump(L.tx, { wallet: L.wallet });
  const mint = L.accounts.get(L.mint), curve = L.accounts.get(L.curve);
  for (const data of [[], [null], [123, "base64"], [undefined, "base64"], [{}, "base64"], [[1, 2, 3], "base64"]]) {
    let r;
    assert.doesNotThrow(() => { r = checkPumpAccounts(launch, mint, { ...curve, data }); }, JSON.stringify(data));
    assert.equal(r.clause, "bonding_curve", JSON.stringify(data));
    assert.doesNotThrow(() => { r = checkPumpAccounts(launch, { ...mint, data }, curve); }, JSON.stringify(data));
    assert.equal(r.clause, "metadata", JSON.stringify(data));
  }
});
