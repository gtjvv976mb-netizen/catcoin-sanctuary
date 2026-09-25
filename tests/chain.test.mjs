/* Proving a launch, from real StonkFun launches recorded on mainnet (tests/fixtures/). */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  proveLaunch, checkLaunchAccounts, readTokenMetadata, decodeInitialize, pda, isOnCurve, poolAddress, vaultAddress, curveRuleAddress,
  IX, GLOBAL_CONFIG_DISC, LAUNCHLAB_PROGRAM, LAUNCHLAB_AUTHORITY, LAUNCHLAB_EVENT_AUTHORITY, STONKFUN_PLATFORM, STONKFUN_PLATFORM_REWARD,
  signaturesVerify, messageBytes,
} from "../scripts/lib/chain.mjs";
import { base58Decode, base58Encode, STOCK_PAIRS, XSTOCKS } from "../assets/collection.js";
import {
  LAUNCHES, PUMPFUN, FAILED, ACCOUNTS, ACCOUNTS_MORE, REWARD, launchTx, recordedAccounts, GME_LAUNCHER, GOOGL_LAUNCHER, GME_LAUNCH, GOOGL_LAUNCH,
  ANTHROPIC_LAUNCHER, IREN_LAUNCHER,
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
