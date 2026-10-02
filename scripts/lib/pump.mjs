/**
 * A PUMP.FUN LAUNCH, BUILT AND SIGNED OFFLINE: one legacy transaction holding ComputeBudget
 * (limit, price) and pump.fun's create_v2, and nothing else: no dev buy, no token account, no
 * transfer. Stage 1 of the launcher (no network: the caller brings the recent blockhash).
 *
 * create_v2 (pump.fun's IDL, idl/pump.json in github.com/pump-fun/pump-public-docs, and
 * docs/instructions/COIN_CREATION.md; read 2026-09-27): data is the discriminator
 * sha256("global:create_v2")[0..8], then name, symbol, uri (borsh strings, at most 32, 13 and 200
 * bytes), creator (a pubkey), is_mayhem_mode (bool), then three trailing arguments the program
 * reads as false / 0 when absent: is_cashback_enabled (OptionBool: one bool byte; deprecated, true
 * is rejected), creator_fee_bps (OptionU64: eight bytes) and is_holder_reward (OptionBool). This
 * module always writes all three: false / 0, and is_holder_reward as the launch asks (`holderReward`).
 * A holder rewards coin (pump.fun's docs, HOLDER_REWARDS_README.md, read 2026-10-02): the creator fee
 * of every trade is set aside for the coin's holders and paid out to them by pump.fun, never to a
 * creator wallet; the same accounts, permanent. The `creator` argument is still the wallet (pump.fun
 * records its own address on the curve instead).
 *
 * The sixteen accounts, every one reproduced from the recorded real launch
 * (tests/fixtures/pumpfun-create.json, tx 33Z62j…mwsmi, "Gull Gadot", 2026-09-24):
 *    0 mint (writable signer: the new Token-2022 mint)
 *    1 mint_authority            PDA["mint-authority"] of pump.fun
 *    2 bonding_curve (w)         PDA["bonding-curve", mint] of pump.fun
 *    3 associated_bonding_curve (w)  the Token-2022 associated token account of bonding_curve for mint
 *    4 global                    PDA["global"] of pump.fun
 *    5 user (writable signer: the payer)
 *    6 system program  7 Token-2022  8 associated token program
 *    9 mayhem program (w)        MAyhSm…MD4e (writable: the IDL says so and the fixture has it so)
 *   10 global_params             PDA["global-params"] of the mayhem program
 *   11 sol_vault (w)             PDA["sol-vault"] of the mayhem program
 *   12 mayhem_state (w)          PDA["mayhem-state", mint] of the mayhem program
 *   13 mayhem_token_vault (w)    the Token-2022 associated token account of sol_vault for mint
 *   14 event_authority           PDA["__event_authority"] of pump.fun
 *   15 program                   pump.fun itself
 * Every PDA's seeds and program are the IDL's; each one re-derives to the fixture's account in
 * tests/launcher-tx.test.mjs, and the flags equal the fixture's message flags.
 *
 * A COIN-PRICED LAUNCH (pump.fun's Custom Pairs; stage 4, UNVERIFIED: no real one is recorded, so
 * PUMP_QUOTE_VERIFIED is false). As the official SDK builds it (@pump-fun/pump-sdk 2.0.0,
 * src/sdk.ts createV2Instruction and createV2QuoteRemainingAccounts, src/pda.ts QUOTE_CONTROL_PDA
 * and quoteAta, read 2026-09-28), a quote other than SOL changes no byte of the data and appends
 * four remaining accounts after the sixteen:
 *   16 quote_mint                      (readonly)
 *   17 associated_quote_bonding_curve  (writable) the quote's associated token account of the
 *                                      bonding curve, under the quote's own token program
 *   18 quote_token_program             (readonly) the classic token program or Token-2022, the
 *                                      program that owns the quote mint (the program checks: 6063)
 *   19 QuoteControl                    (readonly) PDA["quote-control"] of pump.fun, the account
 *                                      that lists the quote mints create_v2 accepts
 * A quote admitted through QuoteControl cannot be used with mayhem mode (6071), which this module
 * never turns on anyway. Which quotes may be launched is data/pump-quotes.json (validatePumpQuotes):
 * the builder refuses any other, and so does the Collection's proof (chain.mjs proveLaunchPump).
 */
import { createHash } from "node:crypto";
import { base58Decode, base58Encode, isAddress, textProblem, httpsProblem, quoteProblem, validatePumpQuotes } from "../../assets/collection.js";
import { PUMPFUN_PROGRAM, SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, ATA_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "./programs.mjs";
import {
  pda, ata, compileLegacyMessage, decodeLegacyMessage, decompileInstructions, setComputeUnitLimit, setComputeUnitPrice,
  signTransaction, serializeTransaction, priorityFeeLamports, MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT, PACKET_DATA_SIZE,
} from "./solana-tx.mjs";

/** pump.fun's fixed accounts. The PDAs are pinned here and re-derived by the tests. */
export const PUMP = Object.freeze({
  program: PUMPFUN_PROGRAM,
  global: "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf",          // PDA["global"]
  mintAuthority: "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",   // PDA["mint-authority"]
  eventAuthority: "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1",  // PDA["__event_authority"]
  mayhemProgram: "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e",
  mayhemGlobalParams: "13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ", // PDA["global-params"] of the mayhem program
  mayhemSolVault: "BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s",     // PDA["sol-vault"] of the mayhem program
  quoteControl: "6z6GDdfb2AjR9ZhJmAUQ5cipJCVxQvLJhB2H8mCwTFBP",      // PDA["quote-control"] (the SDK's QUOTE_CONTROL_PDA)
  system: SYSTEM_PROGRAM,
  token2022: TOKEN_2022_PROGRAM,
  ataProgram: ATA_PROGRAM,
  computeBudget: COMPUTE_BUDGET_PROGRAM,
});

/** sha256("global:create_v2")[0..8] (a test recomputes it). */
export const CREATE_V2_DISC = "d6904cec5f8b31b4";
/** create_v2's limits, in UTF-8 bytes (Rust's String::len). */
export const CREATE_V2_LIMITS = Object.freeze({ name: 32, symbol: 13, uri: 200 });

/** The launch's defaults: create_v2 alone used 100,529 compute units in the recorded launch. */
export const LAUNCH_DEFAULTS = Object.freeze({ computeUnitLimit: 200_000, computeUnitPriceMicroLamports: 100_000 });
/** A coin-priced create is heavier (the SDK: "Token-quoted creates are heavy"); no real one is recorded, so the limit is generous. */
export const QUOTE_LAUNCH_COMPUTE_UNIT_LIMIT = 300_000;
/** The most a launch may bid in priority fees (limit × price), in lamports: 0.005 SOL. A guard against a slipped digit. */
export const MAX_PRIORITY_FEE_LAMPORTS = 5_000_000n;

/**
 * Whether a coin-priced pump.fun launch has been seen to work end to end. It has not: no real
 * custom-quote create is recorded, only the SDK's source. While this is false, scripts/lib/
 * venues-routing.mjs chooses the "pump-quote" venue only when the owner opts in explicitly, and
 * the launcher (scripts/lib/launcher.mjs send) simulates such a launch before sending it and falls
 * back to SOL if it, or anything else before the send, fails.
 */
export const PUMP_QUOTE_VERIFIED = false;

export const bondingCurve = (mint) => pda(["utf8:bonding-curve", mint], PUMP.program);
export const associatedBondingCurve = (mint) => ata(bondingCurve(mint), mint, TOKEN_2022_PROGRAM);
export const mayhemState = (mint) => pda(["utf8:mayhem-state", mint], PUMP.mayhemProgram);
export const mayhemTokenVault = (mint) => ata(PUMP.mayhemSolVault, mint, TOKEN_2022_PROGRAM);
/** The bonding curve's token account for a quote { mint, tokenProgram } (the SDK's quoteAta(bondingCurvePda(mint), …)). */
export const associatedQuoteBondingCurve = (mint, quote) => ata(bondingCurve(mint), quote.mint, quote.tokenProgram);

const address = (value, what) => {
  const a = typeof value === "string" ? value : value?.publicKey; // an address, or a keypair
  if (!isAddress(a)) throw new TypeError(`${what} is not a base58 address`);
  return a;
};

/**
 * Why `quote` ({ mint, tokenProgram }, as data/pump-quotes.json lists it) cannot price a pump.fun
 * launch, or null. SOL is not a quote here (wrapped SOL and the zero key, which legacy SOL-priced
 * curves store as their quote mint, are what the SDK reads as "priced in SOL"; a SOL launch has no
 * quote at all), and the token program is one of the two. The rule lives in assets/collection.js,
 * so the page reads data/pump-quotes.json by it too; it is re-exported here.
 */
export { quoteProblem };

/** The four remaining accounts that price a create_v2 in `quote` (see the header), in the SDK's order. */
function quoteAccounts(mint, quote) {
  const bad = quoteProblem(quote);
  if (bad) throw new TypeError(bad);
  return [
    { pubkey: quote.mint, isSigner: false, isWritable: false },
    { pubkey: associatedQuoteBondingCurve(mint, quote), isSigner: false, isWritable: true },
    { pubkey: quote.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: PUMP.quoteControl, isSigner: false, isWritable: false },
  ];
}

/**
 * The account metas of create_v2 for a new `mint` paid by `user`, in the program's order: the
 * sixteen, then (with a `quote`) the four that price the coin in it.
 */
export function createV2Accounts(mint, user, quote = null) {
  const m = (pubkey, isWritable = false, isSigner = false) => ({ pubkey, isSigner, isWritable });
  const accounts = [
    m(mint, true, true),
    m(PUMP.mintAuthority),
    m(bondingCurve(mint), true),
    m(associatedBondingCurve(mint), true),
    m(PUMP.global),
    m(user, true, true),
    m(PUMP.system),
    m(PUMP.token2022),
    m(PUMP.ataProgram),
    m(PUMP.mayhemProgram, true),
    m(PUMP.mayhemGlobalParams),
    m(PUMP.mayhemSolVault, true),
    m(mayhemState(mint), true),
    m(mayhemTokenVault(mint), true),
    m(PUMP.eventAuthority),
    m(PUMP.program),
  ];
  return quote === null ? accounts : [...accounts, ...quoteAccounts(mint, quote)];
}

/**
 * Why a coin's name, symbol or metadata uri may not be launched, or null. The name and symbol
 * must be plain text the sanctuary would show (assets/collection.js textProblem: no link, markup,
 * control or hidden character) within create_v2's byte limits (or `limits`, for another
 * launchpad); the uri must be a link the sanctuary itself would make (assets/collection.js
 * httpsProblem: https to a named host, no credentials) that starts with "https://", is at most
 * 200 bytes and holds no space, control character, markup or quote (< > " ' ` \), since it is
 * written on-chain for good.
 */
export function launchTextProblem({ name, symbol, uri } = {}, limits = CREATE_V2_LIMITS) {
  const n = textProblem(name, { maxBytes: limits.name });
  if (n) return `the name: ${n}`;
  const s = textProblem(symbol, { maxBytes: limits.symbol });
  if (s) return `the symbol: ${s}`;
  if (typeof uri !== "string" || !uri.startsWith("https://")) return "the uri must start with https://";
  if (Buffer.byteLength(uri, "utf8") > limits.uri) return `the uri is longer than ${limits.uri} bytes`;
  if (/[\s\p{Cc}\p{Cf}]/u.test(uri)) return "the uri holds a space or a control character";
  if (/[<>"'`\\]/.test(uri)) return "the uri holds markup or a quote (< > \" ' ` \\)";
  const bad = httpsProblem(uri);
  if (bad) return `the uri: ${bad}`;
  return null;
}

const borshString = (s) => {
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
};

/**
 * pump.fun create_v2 as an instruction { programId, keys, data } for a new `mint` paid by `user`,
 * with `creator` (who earns the creator fees) written into the data, priced in SOL or (with
 * `quote`, { mint, tokenProgram }) in that coin. Throws on a bad address, a default creator, a
 * name, symbol or uri that launchTextProblem refuses, a non-boolean mayhemMode, a quote that
 * quoteProblem refuses, and mayhem mode with a quote (the program refuses it: 6071).
 */
export function createV2Instruction({ mint, user, creator, name, symbol, uri, mayhemMode = false, quote = null, holderReward = false } = {}) {
  mint = address(mint, "the mint");
  user = address(user, "the user");
  creator = address(creator, "the creator");
  if (mint === user) throw new Error("the mint and the user must be two accounts");
  if (creator === SYSTEM_PROGRAM) throw new Error("the creator must not be the default pubkey");
  const bad = launchTextProblem({ name, symbol, uri });
  if (bad) throw new RangeError(bad);
  if (typeof mayhemMode !== "boolean") throw new TypeError("mayhemMode is true or false");
  if (typeof holderReward !== "boolean") throw new TypeError("holderReward is true or false");
  if (quote !== null && quoteProblem(quote)) throw new TypeError(quoteProblem(quote));
  if (quote !== null && mayhemMode) throw new Error("a coin-priced launch cannot be a mayhem-mode coin (6071)");
  if (quote !== null && [mint, user].includes(quote.mint)) throw new Error("the quote must be another coin");
  const data = Buffer.concat([
    Buffer.from(CREATE_V2_DISC, "hex"),
    borshString(name), borshString(symbol), borshString(uri),
    Buffer.from(base58Decode(creator)),
    Buffer.from([mayhemMode ? 1 : 0]),
    Buffer.from([0]),        // is_cashback_enabled: OptionBool(false) (deprecated; true is rejected)
    Buffer.alloc(8),         // creator_fee_bps: OptionU64(0), the standard fee schedule
    Buffer.from([holderReward ? 1 : 0]),  // is_holder_reward: OptionBool: true, its creator fees go to its holders
  ]);
  return { programId: PUMP.program, keys: createV2Accounts(mint, user, quote), data: new Uint8Array(data) };
}

/**
 * create_v2's data, decoded: { name, symbol, uri, creator, isMayhemMode, isCashbackEnabled,
 * creatorFeeBps (BigInt), isHolderReward, trailingArgs (how many of the three optional
 * arguments were present) }. A missing trailing argument reads as false / 0, as the program
 * reads it; a partial one, a bool that is not 0 or 1, or a byte past the end is refused.
 */
export function decodeCreateV2(data) {
  const d = Buffer.from(data);
  if (d.length < 8 || d.subarray(0, 8).toString("hex") !== CREATE_V2_DISC) throw new Error("not a pump.fun create_v2 instruction");
  let o = 8;
  const need = (n) => { if (o + n > d.length) throw new RangeError(`create_v2 data ends at ${d.length}; ${n} more bytes were needed at ${o}`); };
  const str = () => {
    need(4);
    const n = d.readUInt32LE(o); o += 4;
    if (n > PACKET_DATA_SIZE) throw new RangeError(`a string of ${n} bytes`);
    need(n);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(d.subarray(o, o + n)); o += n;
    return text;
  };
  const bool = (what) => { need(1); const b = d[o++]; if (b > 1) throw new RangeError(`${what} is ${b}, not a bool`); return b === 1; };
  const out = { name: str(), symbol: str(), uri: str() };
  need(32);
  out.creator = base58Encode(d.subarray(o, o + 32)); o += 32;
  out.isMayhemMode = bool("is_mayhem_mode");
  out.isCashbackEnabled = false; out.creatorFeeBps = 0n; out.isHolderReward = false; out.trailingArgs = 0;
  if (o < d.length) { out.isCashbackEnabled = bool("is_cashback_enabled"); out.trailingArgs = 1; }
  if (o < d.length) { need(8); out.creatorFeeBps = d.readBigUInt64LE(o); o += 8; out.trailingArgs = 2; }
  if (o < d.length) { out.isHolderReward = bool("is_holder_reward"); out.trailingArgs = 3; }
  if (o !== d.length) throw new RangeError(`${d.length - o} bytes after create_v2's arguments`);
  return out;
}

/* ── data/pump-quotes.json: the coins a pump.fun launch may be priced in ─────────────────── */

export const PUMP_QUOTE_FIELDS = Object.freeze(["symbol", "mint", "tokenProgram"]);

/**
 * data/pump-quotes.json: { note?, quotes: [{ symbol, mint, tokenProgram }] }, the coins (besides
 * SOL) a pump.fun launch may be priced in. Returns { quotes: [frozen copies], refused: [{ index,
 * detail }] }. The fields are closed; the symbol is plain text of at most 16 bytes (what a
 * Collection entry's pair symbol may be); the mint passes quoteProblem and is not one of the
 * sanctuary's stock pairs (a company's stock launches on StonkFun, and a pump.fun coin priced in
 * a stock pair could take that pair's planned cat's card); no mint or symbol is listed twice.
 * Listing a coin here says nothing about pump.fun accepting it: pump.fun's own QuoteControl
 * account decides that on chain. The rule lives in assets/collection.js (the page reads the list
 * by it, to show a coin-priced launch the Collection proved); it is re-exported here.
 */
export { validatePumpQuotes };

/** The allowlisted quote for `quote` ({ mint, tokenProgram? }), as the list writes it; throws when it is not listed. */
function listedQuote(quote, quotes) {
  const q = (Array.isArray(quotes) ? quotes : []).find((x) => x?.mint === quote?.mint);
  if (!q || quoteProblem(q)) throw new Error("the quote is not one data/pump-quotes.json lists");
  if (quote.tokenProgram !== undefined && quote.tokenProgram !== q.tokenProgram) throw new Error("the quote's token program is not the one data/pump-quotes.json lists");
  return Object.freeze({ symbol: q.symbol, mint: q.mint, tokenProgram: q.tokenProgram });
}

/**
 * Build the launch: a legacy transaction, paid by `wallet` (who is also the coin's creator),
 * holding SetComputeUnitLimit, SetComputeUnitPrice and create_v2 for `mint`, and nothing else.
 * `wallet` and `mint` are addresses or keypairs (only the public keys are read). Priced in SOL,
 * or with `quote` ({ mint } or { symbol, mint }) in that coin, which must be one of `quotes` (data/
 * pump-quotes.json's list, validatePumpQuotes; its token program is taken from there). Returns a
 * frozen { messageBytes, signers (the addresses that must sign, in the message's order: [wallet,
 * mint]), instructions, wallet, mint, quote (null, or { symbol, mint, tokenProgram }), message }.
 * Throws on anything create_v2 or the fee guard refuses.
 */
export function buildLaunchTransaction({
  wallet, mint, name, symbol, uri, recentBlockhash, quote = null, quotes = [], holderReward = false,
  computeUnitLimit = quote === null ? LAUNCH_DEFAULTS.computeUnitLimit : QUOTE_LAUNCH_COMPUTE_UNIT_LIMIT,
  computeUnitPriceMicroLamports = LAUNCH_DEFAULTS.computeUnitPriceMicroLamports,
} = {}) {
  wallet = address(wallet, "the wallet");
  mint = address(mint, "the mint");
  const q = quote === null ? null : listedQuote(quote, quotes);
  if (!Number.isInteger(computeUnitLimit) || computeUnitLimit < 1 || computeUnitLimit > MAX_COMPUTE_UNIT_LIMIT) {
    throw new RangeError(`a compute-unit limit is 1..${MAX_COMPUTE_UNIT_LIMIT}`);
  }
  const price = typeof computeUnitPriceMicroLamports === "bigint" ? computeUnitPriceMicroLamports
    : Number.isSafeInteger(computeUnitPriceMicroLamports) ? BigInt(computeUnitPriceMicroLamports) : -1n;
  if (price < 0n) throw new RangeError("a compute-unit price is a whole number of micro-lamports, 0 or more");
  const priorityFee = priorityFeeLamports(computeUnitLimit, price);
  if (priorityFee > MAX_PRIORITY_FEE_LAMPORTS) {
    throw new RangeError(`a priority fee of ${priorityFee} lamports is more than the ${MAX_PRIORITY_FEE_LAMPORTS} this launcher allows`);
  }
  const instructions = [
    setComputeUnitLimit(computeUnitLimit),
    setComputeUnitPrice(price),
    createV2Instruction({ mint, user: wallet, creator: wallet, name, symbol, uri, quote: q, holderReward }),
  ];
  const message = compileLegacyMessage({ payer: wallet, recentBlockhash, instructions });
  const signers = message.accountKeys.slice(0, message.header.numRequiredSignatures);
  const size = 1 + 64 * signers.length + message.bytes.length;
  if (size > PACKET_DATA_SIZE) throw new RangeError(`the launch would be ${size} bytes; Solana takes at most ${PACKET_DATA_SIZE}`);
  checkLaunchMessage(message.bytes, { wallet, mint, quote: q, holderReward });
  return Object.freeze({ messageBytes: message.bytes, signers, instructions, wallet, mint, quote: q, holderReward, message });
}

/**
 * Check, from the bytes alone, that a message is a launch this module would build: paid by
 * `wallet`, signed by exactly [wallet, mint], holding at most one SetComputeUnitLimit and one
 * SetComputeUnitPrice (no accounts, the 5- and 9-byte forms) and exactly one create_v2 whose
 * accounts and flags are createV2Accounts(mint, wallet, quote) (sixteen, or twenty with a quote),
 * whose creator is the wallet and whose options are all off, and no other instruction. The
 * compute budget is read too: a limit is 1..1,400,000 and the priority fee (limit × price) is at
 * most MAX_PRIORITY_FEE_LAMPORTS; with no limit, 200,000 units for every instruction (at most
 * 1,400,000) are assumed, never less than the runtime's default. Returns the decoded create_v2
 * arguments; throws with the reason otherwise.
 */
export function checkLaunchMessage(messageBytes, { wallet, mint, quote = null, holderReward = false } = {}) {
  const msg = decodeLegacyMessage(messageBytes);
  const signers = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  if (signers.length !== 2 || signers[0] !== wallet || signers[1] !== mint) throw new Error("the signers are not [wallet, mint]");
  let limit = null, price = null, create = null;
  for (const ix of decompileInstructions(msg)) {
    const d = Buffer.from(ix.data);
    const budget = ix.programId === COMPUTE_BUDGET_PROGRAM && ix.keys.length === 0;
    if (budget && d[0] === 2 && d.length === 5) {
      if (limit !== null) throw new Error("more than one compute-budget instruction of a kind");
      limit = d.readUInt32LE(1);
    } else if (budget && d[0] === 3 && d.length === 9) {
      if (price !== null) throw new Error("more than one compute-budget instruction of a kind");
      price = d.readBigUInt64LE(1);
    } else if (ix.programId === PUMP.program && d.subarray(0, 8).toString("hex") === CREATE_V2_DISC) {
      if (create) throw new Error("more than one create_v2");
      create = ix;
    } else {
      throw new Error(`an instruction for ${ix.programId} that a launch does not carry`);
    }
  }
  if (limit !== null && (limit < 1 || limit > MAX_COMPUTE_UNIT_LIMIT)) throw new Error(`a compute-unit limit of ${limit}; a launch asks for 1..${MAX_COMPUTE_UNIT_LIMIT}`);
  const units = limit ?? Math.min(MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT * msg.instructions.length);
  const priorityFee = priorityFeeLamports(units, price ?? 0n);
  if (priorityFee > MAX_PRIORITY_FEE_LAMPORTS) {
    throw new Error(`a priority fee of ${priorityFee} lamports is more than the ${MAX_PRIORITY_FEE_LAMPORTS} this launcher allows`);
  }
  if (!create) throw new Error("no create_v2");
  const want = createV2Accounts(mint, wallet, quote);
  if (create.keys.length !== want.length || create.keys.some((k, i) => k.pubkey !== want[i].pubkey || k.isSigner !== want[i].isSigner || k.isWritable !== want[i].isWritable)) {
    throw new Error("create_v2's accounts are not the ones for this mint and wallet");
  }
  const args = decodeCreateV2(create.data);
  if (args.creator !== wallet) throw new Error("create_v2's creator is not the wallet");
  if (args.isMayhemMode || args.isCashbackEnabled || args.creatorFeeBps !== 0n) throw new Error("create_v2 turns on an option a launch leaves off");
  if (args.isHolderReward !== (holderReward === true)) throw new Error(`create_v2 ${args.isHolderReward ? "makes" : "does not make"} a holder rewards coin, which this launch ${holderReward ? "is" : "is not"}`);
  const bad = launchTextProblem(args);
  if (bad) throw new Error(bad);
  return args;
}

/**
 * Sign a built launch with the wallet's and the mint's keypairs and return the serialized
 * transaction, base64 (what sendTransaction takes). The message is copied once and that copy is
 * re-checked from its bytes (checkLaunchMessage, the fee guard included), signed and serialized,
 * so bytes that are not a plain launch are never signed, even if `built` was changed after it was
 * built or its bytes change while this runs.
 */
export function signLaunchTransaction(built, walletKeypair, mintKeypair) {
  if (!built || !(built.messageBytes instanceof Uint8Array)) throw new TypeError("signLaunchTransaction takes what buildLaunchTransaction returned");
  if (walletKeypair?.publicKey !== built.wallet) throw new Error("the wallet keypair is not the launch's wallet");
  if (mintKeypair?.publicKey !== built.mint) throw new Error("the mint keypair is not the launch's mint");
  const messageBytes = Uint8Array.from(built.messageBytes); // what is checked is what is signed and sent
  checkLaunchMessage(messageBytes, { wallet: built.wallet, mint: built.mint, quote: built.quote ?? null, holderReward: built.holderReward === true });
  const signatures = signTransaction(messageBytes, [walletKeypair, mintKeypair]);
  return Buffer.from(serializeTransaction(messageBytes, signatures)).toString("base64");
}

/**
 * The same launch UNSIGNED: every signature slot zero-filled, after the very checks
 * signLaunchTransaction makes (checkLaunchMessage on a copy of the bytes), base64. What the
 * launcher simulates (sigVerify false): nothing signed leaves the runner before the send itself,
 * so a simulation, a dry run or a cap refusal can never be replayed by the RPC's operator.
 */
export function unsignedLaunchTransaction(built) {
  if (!built || !(built.messageBytes instanceof Uint8Array)) throw new TypeError("unsignedLaunchTransaction takes what buildLaunchTransaction returned");
  const messageBytes = Uint8Array.from(built.messageBytes);
  checkLaunchMessage(messageBytes, { wallet: built.wallet, mint: built.mint, quote: built.quote ?? null, holderReward: built.holderReward === true });
  return Buffer.from(serializeTransaction(messageBytes, [0, 1].map(() => new Uint8Array(64)))).toString("base64");
}

/** sha256("global:<name>")[0..8] as hex: an Anchor instruction discriminator. */
export const anchorDiscriminator = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8).toString("hex");
