#!/usr/bin/env node
/**
 * THE SANCTUARY'S AUTOMATIC LAUNCHER, one phase a call (the Launch workflow commits between them):
 *
 *   node scripts/launch.mjs prepare   settle what was sent, then prepare at most ONE trending cat:
 *                                     its coin's metadata (coins/<postId>.json) and its ledger row
 *   node scripts/launch.mjs send      (the only phase with LAUNCH_WALLET_KEY) wait until the site serves
 *                                     the metadata, build (on pump.fun in SOL, on StonkFun in a stock
 *                                     pair, or on pump.fun in a listed coin; any of the last two falls
 *                                     back to SOL if it fails before the send), sign, simulate within
 *                                     the caps, send, confirm
 *   node scripts/launch.mjs record    move each launched cat into the sanctuary (adoptables, the
 *                                     Collection's list, the 3D-model queue, its real photo, its X post)
 *
 * The logic is scripts/lib/launcher.mjs (see its header for the rules). No dependency: node only.
 *
 * Environment (repository variables and secrets, set by .github/workflows/launch.yml):
 *   LAUNCH_ENABLED            "on" launches, "dry" builds and simulates only, anything else does nothing
 *   LAUNCH_WALLET_KEY         (send only) the launch wallet's secret key: 64 bytes in base58, or a JSON
 *                             byte array (64 bytes, or the 32-byte seed)
 *   SOLANA_RPC_URL            (prepare and send) the RPC; the public mainnet endpoint when unset
 *   LAUNCH_MAX_PER_DAY, LAUNCH_MAX_SOL_PER_LAUNCH, LAUNCH_MAX_SOL_PER_DAY, LAUNCH_MIN_BALANCE_SOL,
 *   LAUNCH_PRIORITY_MICROLAMPORTS   the caps (defaults 3, 0.03, 0.1, 0.02; 100000), clamped
 *   LAUNCH_PUMP_QUOTE         (prepare and send) "on" opts in to pump.fun launches priced in a coin
 *                             data/pump-quotes.json lists (unverified); anything else keeps them off
 *   GITHUB_OUTPUT             where the workflow reads pending, deploy, launched, again and recorded
 *
 * Neither the key nor the RPC URL is ever printed: every line goes through a scrubber that blanks
 * both, and no error the launcher makes quotes either.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepare, send, record, LaunchError } from "./lib/launcher.mjs";
import { createRpc, PUBLIC_RPC } from "./lib/rpc.mjs";
import { base58Decode, base58Encode } from "../assets/collection.js";
import { keypairFromSecret } from "./lib/solana-tx.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Files by their repo path: read (null when missing) and written atomically (a temporary file, then a rename). */
export function fsStore(root) {
  const abs = (rel) => {
    const file = path.resolve(root, rel);
    if (!file.startsWith(path.resolve(root) + path.sep)) throw new LaunchError(`${rel} is outside the repository`);
    return file;
  };
  return {
    readText(rel) {
      try { return fs.readFileSync(abs(rel), "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
    },
    writeText(rel, text) {
      const file = abs(rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, file);
    },
  };
}

/**
 * The forms a secret key may be quoted in: as given, trimmed, and (when it reads as bytes) its bytes and
 * its seed in base58, as a JSON array, in hex and in base64. Never throws.
 */
export function secretForms(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  const t = value.trim();
  const out = [value, t];
  let bytes = null;
  try {
    if (t.startsWith("[")) { const a = JSON.parse(t); if (Array.isArray(a) && a.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) bytes = Buffer.from(a); }
    else { const b = base58Decode(t, 200); if (b) bytes = Buffer.from(b); }
  } catch { bytes = null; }
  if (bytes && bytes.length >= 32) {
    // A 32-byte seed also stands for its whole 64-byte secret key (the seed, then its public key).
    let full = bytes;
    if (bytes.length === 32) { try { full = Buffer.concat([bytes, Buffer.from(keypairFromSecret(Uint8Array.from(bytes)).publicKeyBytes)]); } catch { full = bytes; } }
    for (const b of [full, full.subarray(0, 32)]) out.push(base58Encode(b), JSON.stringify([...b]), `[${[...b].join(", ")}]`, b.toString("hex"), b.toString("base64"));
    full.fill(0); bytes.fill(0);
  }
  return out;
}

/**
 * A function that blanks every secret value (and its trimmed form) in a text, and any piece of one of
 * at least `minRun` characters (an error that cut a quoted secret short still shows none of it).
 */
export function scrubber(secrets, minRun = 12) {
  const values = [...new Set(secrets.filter((s) => typeof s === "string").flatMap((s) => [s, s.trim()]).filter((s) => s.length >= 8))].sort((a, b) => b.length - a.length);
  return (text) => {
    let t = String(text);
    for (const v of values) {
      t = t.split(v).join("***");
      for (let i = 0; i + minRun <= v.length; i++) {
        const piece = v.slice(i, i + minRun);
        for (let at = t.indexOf(piece); at >= 0; at = t.indexOf(piece)) {
          let a = at, b = at + minRun, j = i, k = i + minRun;           // the whole stretch of the text that follows the secret
          while (a > 0 && j > 0 && t[a - 1] === v[j - 1]) { a--; j--; }
          while (b < t.length && k < v.length && t[b] === v[k]) { b++; k++; }
          t = `${t.slice(0, a)}***${t.slice(b)}`;
        }
      }
    }
    return t;
  };
}

/**
 * One phase. Everything outside is injectable: the environment, the repo folder, fetch, the clock,
 * sleep and the output. Returns the exit code.
 */
export async function main(argv = process.argv.slice(2), { env = process.env, root = ROOT, fetchImpl = globalThis.fetch, now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), stdout = console.log, stderr = console.error, rpc: rpcIn = null } = {}) {
  const scrub = scrubber([...secretForms(env.LAUNCH_WALLET_KEY), env.SOLANA_RPC_URL]);
  const log = (line) => stdout(scrub(line));
  const phase = argv[0];
  const outputs = {};
  let code = 0;
  try {
    const io = fsStore(root);
    const url = String(env.SOLANA_RPC_URL ?? "").trim() || PUBLIC_RPC;
    const rpc = () => rpcIn ?? createRpc({ url, fetchImpl, delayMs: url === PUBLIC_RPC ? 400 : 100 });
    if (phase === "prepare" || phase === "send") log(`Launcher: ${phase}; Solana through ${url === PUBLIC_RPC ? "the public mainnet RPC" : "the RPC in SOLANA_RPC_URL"}.`);
    if (phase === "prepare") {
      const r = await prepare({ io, env, rpc: rpc(), fetchImpl, now, log, scrub });
      Object.assign(outputs, { pending: r.pending, deploy: r.deploy });
    } else if (phase === "send") {
      const r = await send({ io, env, rpc: rpc(), fetchImpl, now, sleep, log, scrub });
      Object.assign(outputs, { launched: r.launched, again: r.again === true });
      code = r.code;
    } else if (phase === "record") {
      const r = record({ io, env, now, log });
      Object.assign(outputs, { recorded: r.recorded.length > 0 });
      if (r.problems.length) code = 1;
    } else {
      stderr("Usage: node scripts/launch.mjs prepare | send | record");
      return 2;
    }
  } catch (e) {
    stderr(scrub(`::error title=Launcher::${e instanceof LaunchError ? e.message : `${e?.name ?? "Error"}: ${e?.message ?? e}`}`));
    code = 1;
  }
  if (env.GITHUB_OUTPUT) {
    try { fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(outputs).map(([k, v]) => `${k}=${v ? "true" : "false"}\n`).join("")); }
    catch (e) { stderr(`::warning title=Launcher::could not write the step's outputs (${e.code ?? e.message})`); }
  }
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
