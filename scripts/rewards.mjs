#!/usr/bin/env node
/**
 * $CATSANC HOLDER REWARDS, one phase a call (the Rewards workflow commits after each):
 *
 *   node scripts/rewards.mjs snapshot   (no key) the hour's sample of $CATSANC holders at a random,
 *                                       hidden moment (lots, points, a period close when due);
 *                                       with REWARDS_NEW_EPOCH=<contract>, first a new epoch
 *   node scripts/rewards.mjs send       (the only phase with LAUNCH_WALLET_KEY) settle what was sent,
 *                                       count the wallet's transactions since the cursor, claim the
 *                                       launcher's creator fees, pay the holders what they are owed
 *   node scripts/rewards.mjs claim      send without the payouts
 *   node scripts/rewards.mjs pay        send without the claim
 *
 * The rules are scripts/lib/rewards.mjs (every amount), the claim scripts/lib/pump-fees.mjs, the runs
 * scripts/lib/rewards-run.mjs (see their headers). No dependency: node only.
 *
 * Environment (repository variables and secrets, set by .github/workflows/rewards.yml):
 *   REWARDS_ENABLED           "on" claims and pays, "dry" samples and simulates claims and payouts
 *                             (nothing signed or sent), anything else does nothing
 *   REWARDS_HOLDER_SHARE_PCT, REWARDS_EVERY_DAYS, REWARDS_RELEASE_PCT, REWARDS_CLOSE_USD (the pot's
 *   worth in dollars at which a period closes early, releasing all of it; SOL's price from DexScreener),
 *   REWARDS_WALLET_CAP_PCT, REWARDS_MIN_BALANCE_PPM, REWARDS_MIN_PAYOUT_SOL, REWARDS_MIN_CLAIM_SOL,
 *   REWARDS_MAX_TX_PER_RUN, REWARDS_MAX_SOL_PER_RUN
 *                             the rules and caps (defaults 100, 7, 50, 100, 10, 100, 0.001, 0.01, 10, 2), clamped
 *   LAUNCH_PRIORITY_MICROLAMPORTS  (send) the payouts' priority price, as the launcher's (100000), clamped
 *   LAUNCH_MIN_BALANCE_SOL    (send) the launcher's reserve, which I2 keeps whole (0.02), clamped
 *   REWARDS_NEW_EPOCH         (snapshot) the owner's workflow_dispatch input new_epoch
 *   LAUNCH_WALLET_KEY         (send) the launcher wallet's secret key, as scripts/launch.mjs reads it
 *   SOLANA_RPC_URL            the RPC (the public mainnet endpoint when unset; the snapshot's
 *                             getProgramAccounts needs a provider that serves it)
 *
 * Neither the key nor the RPC URL is ever printed: every line goes through the launcher's scrubber.
 */
import path from "node:path";
import { randomInt } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { snapshot, send } from "./lib/rewards-run.mjs";
import { RewardsError } from "./lib/rewards.mjs";
import { LaunchError } from "./lib/launcher.mjs";
import { createRpc, PUBLIC_RPC } from "./lib/rpc.mjs";
import { fsStore, scrubber, secretForms } from "./launch.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PHASES = Object.freeze(["snapshot", "send", "claim", "pay"]);

/**
 * One phase. Everything outside is injectable: the environment, the repo folder, fetch, the clock,
 * sleep, the random moment and the output. Returns the exit code.
 */
export async function main(argv = process.argv.slice(2), { env = process.env, root = ROOT, fetchImpl = globalThis.fetch, now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = (n) => randomInt(0, n), stdout = console.log, stderr = console.error, rpc: rpcIn = null,
  confirmWaitMs, confirmPollMs } = {}) {
  const scrub = scrubber([...secretForms(env.LAUNCH_WALLET_KEY), env.SOLANA_RPC_URL]);
  const log = (line) => stdout(scrub(line));
  const phase = argv[0];
  if (!PHASES.includes(phase)) { stderr(`Usage: node scripts/rewards.mjs ${PHASES.join(" | ")}`); return 2; }
  try {
    const io = fsStore(root);
    const url = String(env.SOLANA_RPC_URL ?? "").trim() || PUBLIC_RPC;
    const rpc = rpcIn ?? createRpc({ url, fetchImpl, delayMs: url === PUBLIC_RPC ? 400 : 100 });
    log(`Rewards: ${phase}; Solana through ${url === PUBLIC_RPC ? "the public mainnet RPC" : "the RPC in SOLANA_RPC_URL"}.`);
    if (phase === "snapshot") return (await snapshot({ io, env, rpc, fetchImpl, now, sleep, random, log, scrub })).code;
    const confirmOpts = { ...(confirmWaitMs !== undefined ? { confirmWaitMs } : {}), ...(confirmPollMs !== undefined ? { confirmPollMs } : {}) };
    return (await send({ io, env, rpc, now, sleep, log, scrub, claim: phase !== "pay", pay: phase !== "claim", ...confirmOpts })).code;
  } catch (e) {
    stderr(scrub(`::error title=Rewards::${e instanceof RewardsError || e instanceof LaunchError ? e.message : `${e?.name ?? "Error"}: ${e?.message ?? e}`}`));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
