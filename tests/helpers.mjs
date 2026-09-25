/* Shared by the tests: the recorded fixtures, a fake JSON-RPC endpoint that answers from them,
   and a throwaway copy of the data folder. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The clock for tests that read the shipped data (data/*.json): the real time, and never earlier
    than the day the data was first built. A launch or a research source dated after some frozen
    moment must not make these tests fail or silently drop it. Tests on fixtures keep a fixed clock. */
export const DATA_NOW = Math.max(Date.parse("2026-09-25T18:00:00Z"), Date.now());
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures", name), "utf8"));

export const LAUNCHES = fixture("stonkfun-launches.json");
export const PUMPFUN = fixture("pumpfun-create.json");
export const FAILED = fixture("failed-tx.json");
export const V1 = fixture("v1-refusal.json");
export const HISTORIES = fixture("wallet-histories.json");
export const ACCOUNTS = fixture("accounts.json");
export const OFFICIAL = fixture("xstocks-official-24.json");
export const REWARD = fixture("stonkfun-reward-launch.json");
export const ACCOUNTS_MORE = fixture("accounts-more.json");
export const STONKFUN_PAIRS = fixture("stonkfun-pairs.json");
export const PAIR_MINTS = fixture("pair-mints.json");
export const BUY_EVIDENCE = fixture("buy-links.json");

/** A recorded launch's getTransaction result, by the first characters of its signature. Deep-copied. */
export function launchTx(prefix) {
  const a = LAUNCHES.answers.find((x) => x.params[0].startsWith(prefix));
  if (!a) throw new Error(`no recorded launch ${prefix}`);
  return structuredClone(a.result);
}

export const GME_LAUNCHER = "45ByChvJhwVFBP9pzZDvsByfoepRnmRMRNhXE6SD2Wjc";
export const GOOGL_LAUNCHER = "8MwvKAAYCq258pUuT4ndQFjbwTyDZ8qHdGG6RzNdr43b";
export const GME_LAUNCH = HISTORIES.wallets[GME_LAUNCHER].launch;
export const GOOGL_LAUNCH = HISTORIES.wallets[GOOGL_LAUNCHER].launch;
/** The real launches priced in a PreStock (ANTHROPIC, a v0 transaction with a lookup table) and a Backpack stock (IREN). */
export const ANTHROPIC_LAUNCHER = "DUHuWSVRrbaPN7sAT1YFp67ZiRFB6tHaDJR1BBYYZJeB";
export const IREN_LAUNCHER = "3DGnxRA1WzXVQcM26KTzAoT6VSTTMp8te3WxGdYiLsW6";
/** The owner's wallet, as data/wallets.json lists it. */
export const OWNER = "3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3";

/** A one-transaction history for a recorded launch, as getSignaturesForAddress would list it. */
export function launchHistory(prefix) {
  const tx = launchTx(prefix);
  return [{ signature: tx.transaction.signatures[0], slot: tx.slot, err: null, memo: null, blockTime: tx.blockTime, confirmationStatus: "finalized" }];
}

/** Every recorded getTransaction answer, by signature. */
export function recordedTransactions() {
  const map = new Map();
  const add = (a) => map.set(a.params[0], a.error ? { error: a.error } : { result: a.result });
  LAUNCHES.answers.forEach(add);
  add(PUMPFUN.answer);
  add(FAILED.answer);
  add(V1.answer);
  add(REWARD.answer);
  for (const w of Object.values(HISTORIES.wallets)) w.transactions.forEach(add);
  return map;
}

/** Every recorded account (base64), by address, in getMultipleAccounts' answer shape. */
export function recordedAccounts() {
  const map = new Map();
  for (const a of [...ACCOUNTS.mints.accounts, ...ACCOUNTS.globalConfigs.accounts, ...ACCOUNTS_MORE.globalConfigs.accounts]) {
    map.set(a.address, { owner: a.owner, lamports: a.lamports, data: [a.dataBase64, "base64"], executable: false, rentEpoch: 0, space: Buffer.from(a.dataBase64, "base64").length });
  }
  return map;
}

/** A wallet's recorded history, newest first, as getSignaturesForAddress lists it. */
export const history = (wallet) => structuredClone(HISTORIES.wallets[wallet].signatures);

/**
 * A fake Solana JSON-RPC endpoint, as a fetch function. `histories` maps a wallet to its
 * signature list (newest first); `transactions` and `accounts` are maps as above. `fail`
 * (method, params) may return an HTTP status to answer with instead. `calls` records every call.
 */
export function fakeRpc({ histories = {}, transactions = recordedTransactions(), accounts = recordedAccounts(), fail = () => null } = {}) {
  const calls = [];
  async function fetchImpl(url, init) {
    const { id, method, params } = JSON.parse(init.body);
    calls.push({ method, params });
    const status = fail(method, params);
    if (status) return new Response("{}", { status });
    const answer = (body) => new Response(JSON.stringify({ jsonrpc: "2.0", id, ...body }), { status: 200, headers: { "content-type": "application/json" } });
    if (method === "getSignaturesForAddress") {
      const [address, { limit = 1000, before, until }] = params;
      let list = histories[address] ?? [];
      if (before) { const i = list.findIndex((s) => s.signature === before); list = i < 0 ? [] : list.slice(i + 1); }
      if (until) { const i = list.findIndex((s) => s.signature === until); if (i >= 0) list = list.slice(0, i); }
      return answer({ result: structuredClone(list.slice(0, limit)) });
    }
    if (method === "getTransaction") {
      const [sig, opts] = params;
      if (opts.encoding !== "json" || opts.maxSupportedTransactionVersion !== 0) throw new Error("getTransaction asked in an unexpected form");
      const a = transactions.get(sig);
      return answer(a ? structuredClone(a) : { result: null });
    }
    if (method === "getMultipleAccounts") {
      const [addresses] = params;
      return answer({ result: { context: { slot: 1 }, value: addresses.map((x) => structuredClone(accounts.get(x) ?? null)) } });
    }
    return answer({ error: { code: -32601, message: "Method not found" } });
  }
  return { fetchImpl, calls };
}

/** A temporary copy of a data folder with the given files. Returns its root. */
export function tempSite({ wallets = { launchers: [] }, collection = { cats: [] }, state } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sanctuary-"));
  fs.mkdirSync(path.join(root, "data"));
  const put = (name, value) => fs.writeFileSync(path.join(root, "data", name), `${JSON.stringify(value, null, 2)}\n`);
  put("wallets.json", wallets);
  put("collection.json", collection);
  if (state) put("collection-state.json", state);
  return root;
}

export const readData = (root, name) => fs.readFileSync(path.join(root, "data", name), "utf8");
export const readDataJson = (root, name) => JSON.parse(readData(root, name));
