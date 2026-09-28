/* The Launch workflow (.github/workflows/launch.yml), read as text as the other workflows are: pinned
   actions, no permission by default and the least each job needs, the wallet key in exactly one step,
   no dependency installed, the phases in order with a commit after each, the dispatches in jobs that run
   no code of the repository's, and the site (pages.yml) publishing coins/ but not the launcher's ledger. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

const read = (name) => fs.readFileSync(path.join(ROOT, ".github/workflows", name), "utf8");
const W = read("launch.yml");
const PAGES = read("pages.yml");
const steps = W.split(/\n      - /);
const job = (name) => { const from = W.indexOf(`\n  ${name}:\n`); const next = W.slice(from + 1).search(/\n  [a-z][\w-]*:\n/); return next < 0 ? W.slice(from) : W.slice(from, from + 1 + next); };
const stepNamed = (re) => { const s = steps.filter((x) => re.test(x)); assert.equal(s.length, 1, `one step ${re}`); return s[0]; };

test("launch workflow: name, triggers, no permission by default, one run at a time (never cancelled)", () => {
  assert.match(W, /^name: Launch$/m);
  assert.match(W, /on:\n  schedule:\n    - cron: "\*\/20 \* \* \* \*"\n  workflow_dispatch:\n/);
  assert.ok(!/\n  push:/.test(W), "a bot's push starts no workflow: the trend watch dispatches it instead");
  assert.match(W, /^permissions: \{\}$/m);
  assert.match(W, /concurrency:\n  group: launch\n  cancel-in-progress: false\n/);
});

test("launch workflow: every action pinned to its release's commit, the same two as the other bot workflows", () => {
  assert.deepEqual([...new Set([...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`))], [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0",
  ]);
  for (const m of W.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /^actions\/[\w-]+@[0-9a-f]{40}$/);
  for (const m of W.matchAll(/- uses: actions\/checkout@\S+ # v7\.0\.1\n\s+with:\n\s+ref: main\n\s+persist-credentials: false\n/g)) assert.ok(m);
  assert.equal([...W.matchAll(/actions\/checkout@/g)].length, [...W.matchAll(/persist-credentials: false/g)].length, "every checkout keeps no credentials");
  assert.equal([...W.matchAll(/actions\/checkout@/g)].length, 2);
});

test("launch workflow: the jobs and their permissions: contents for the two that commit, actions for the two that only dispatch", () => {
  assert.deepEqual([...W.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim()), ["contents: write", "actions: write", "contents: write", "actions: write"]);
  assert.deepEqual([...W.matchAll(/^  ([a-z][\w-]*):\n    (?:needs|if|runs-on)/gm)].map((m) => m[1]), ["prepare", "metadata", "launch", "publish"]);
  // Off unless LAUNCH_ENABLED is on or dry (fails closed: an unset variable runs nothing).
  assert.match(job("prepare"), /if: \$\{\{ vars\.LAUNCH_ENABLED == 'on' \|\| vars\.LAUNCH_ENABLED == 'dry' \}\}/);
  assert.match(job("metadata"), /needs: prepare\n\s+if: \$\{\{ needs\.prepare\.outputs\.deploy == 'true' \}\}/);
  assert.match(job("launch"), /needs: \[prepare, metadata\]\n\s+if: \$\{\{ !cancelled\(\) && needs\.prepare\.result == 'success' && needs\.prepare\.outputs\.pending == 'true' \}\}/);
  assert.match(job("publish"), /needs: launch\n\s+if: \$\{\{ !cancelled\(\) && needs\.launch\.outputs\.recorded == 'true' \}\}/);
  for (const name of ["prepare", "metadata", "launch", "publish"]) assert.match(job(name), /timeout-minutes: \d+/, name);
});

test("launch workflow: the wallet key is in the send step only; the RPC URL in prepare and send; nothing else sees a secret", () => {
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["LAUNCH_WALLET_KEY", "SOLANA_RPC_URL"]);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 2);
  const [prep, snd] = withSecrets;
  assert.match(prep, /run: node scripts\/launch\.mjs prepare$/);
  assert.deepEqual([...prep.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["SOLANA_RPC_URL"], "prepare settles over the RPC; it never sees the key");
  assert.match(snd, /run: node scripts\/launch\.mjs send$/);
  assert.deepEqual([...snd.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]).sort(), ["LAUNCH_WALLET_KEY", "SOLANA_RPC_URL"]);
  assert.equal([...W.matchAll(/LAUNCH_WALLET_KEY: \$\{\{ secrets\.LAUNCH_WALLET_KEY \}\}/g)].length, 1, "the key once");
  assert.ok(!/secrets\.GITHUB_TOKEN/.test(W), "the push uses github.token");
  // Secrets go in a step's env, never the job's or the workflow's.
  assert.ok(!/^ {0,4}env:/m.test(W));
  // The send step: the mode and the caps as repository variables, beside the key.
  for (const v of ["LAUNCH_ENABLED", "LAUNCH_MAX_PER_DAY", "LAUNCH_MAX_SOL_PER_LAUNCH", "LAUNCH_MAX_SOL_PER_DAY", "LAUNCH_MIN_BALANCE_SOL"]) assert.match(snd, new RegExp(`${v}: \\$\\{\\{ vars\\.${v} \\}\\}`), v);
  // The owner's opt-in to coin-priced pump.fun launches: a repository variable where the venue is chosen (prepare) and
  // checked again before the send, never a secret.
  for (const step of [prep, snd]) assert.match(step, /LAUNCH_PUMP_QUOTE: \$\{\{ vars\.LAUNCH_PUMP_QUOTE \}\}/);
  assert.ok(!/secrets\.LAUNCH_PUMP_QUOTE/.test(W));
  assert.match(stepNamed(/node scripts\/launch\.mjs record/), /LAUNCH_ENABLED: \$\{\{ vars\.LAUNCH_ENABLED \}\}/);
  assert.ok(!/secrets\./.test(stepNamed(/node scripts\/launch\.mjs record/)), "record needs no secret");
});

test("launch workflow: no dependency is installed (the launcher is plain node); its own tests, and its builders' (StonkFun, coin-priced pump.fun), run before prepare and before send", () => {
  assert.ok(!/\bnpm\b/.test(W), "no npm: no package reaches the job that holds the key");
  assert.ok(!/node_modules/.test(W));
  for (const name of ["prepare", "launch"]) assert.match(job(name), /- run: node --test tests\/launcher\.test\.mjs tests\/launch\.test\.mjs tests\/launchlab\.test\.mjs tests\/pump-quote\.test\.mjs\n[\s\S]*node scripts\/launch\.mjs (prepare|send)/, name);
  assert.match(job("prepare"), /node scripts\/launch\.mjs prepare/);
  assert.match(job("launch"), /node scripts\/launch\.mjs send[\s\S]*node scripts\/launch\.mjs record/);
});

test("launch workflow: a commit after each phase, the token handed to git for the push alone, with one rebase retry", () => {
  const commits = steps.filter((s) => /git -c user\.name="github-actions\[bot\]"/.test(s));
  assert.equal(commits.length, 3);
  const [c1, c2, c3] = commits;
  assert.match(c1, /git add -- data\/sanctuary-launches\.json coins\n/);
  assert.match(c2, /git add -- data\/sanctuary-launches\.json\n/);
  assert.match(c3, /git add -- data\/sanctuary-launches\.json data\/adoptables\.json data\/launches\.json data\/real-photos\.json data\/cat-watch\.json scripts\/meshy\.queue\.json\n/);
  // data/announced.json is the Announce workflow's alone (it holds the launcher's cats by rule): committed here, it raced
  // Announce's own commit, whose single rebase could then fail after its X post went out.
  assert.ok(!/announced\.json/.test(W.replace(/^#.*$/gm, "")), "the Launch workflow never commits data/announced.json");
  for (const c of commits) {
    assert.match(c, /if git diff --cached --quiet; then echo "Nothing changed\."; exit 0; fi/);
    assert.match(c, /GH_TOKEN: \$\{\{ github\.token \}\}/);
    assert.match(c, /auth=\$\(printf 'x-access-token:%s' "\$GH_TOKEN" \| base64 -w0\)\n\s+echo "::add-mask::\$auth"/);
    assert.match(c, /if ! git -c http\.extraheader="AUTHORIZATION: basic \$auth" push origin HEAD:main; then\n\s+git -c http\.extraheader="AUTHORIZATION: basic \$auth" fetch origin main\n\s+git -c user\.name="github-actions\[bot\]" -c user\.email="41898282\+github-actions\[bot\]@users\.noreply\.github\.com" rebase origin\/main\n\s+git -c http\.extraheader="AUTHORIZATION: basic \$auth" push origin HEAD:main\n\s+fi/);
    assert.ok(!/secrets\./.test(c));
  }
  // The launch is committed even when the send step failed (a sent transaction is never forgotten); the record step and its commit follow only that commit.
  assert.match(c2, /id: commit-send\n\s+if: \$\{\{ !cancelled\(\) \}\}/);
  assert.match(stepNamed(/node scripts\/launch\.mjs record/), /if: \$\{\{ !cancelled\(\) && steps\.commit-send\.outcome == 'success' \}\}/);
  assert.match(c3, /id: commit-record\n\s+if: \$\{\{ !cancelled\(\) && steps\.commit-send\.outcome == 'success' \}\}/);
  // "recorded" (what starts publish) is set by that commit's step, and only once its push went through (bash -e stops the step on a failed push).
  assert.match(c3, /RECORDED: \$\{\{ steps\.record\.outputs\.recorded \}\}/);
  assert.match(c3, /push origin HEAD:main\n\s+fi\n\s+if \[ "\$RECORDED" = "true" \]; then echo "recorded=true" >> "\$GITHUB_OUTPUT"; fi\n/);
  // Static commit messages: nothing from the data reaches the shell.
  for (const c of commits) assert.match(c, /commit -q -m "Launch: [a-z' ]+"/);
});

test("launch workflow: the dispatching jobs run no code of the repository's: the metadata job deploys the site, publish starts the Collection, Pages and Announce", () => {
  for (const name of ["metadata", "publish"]) assert.ok(!/uses:|\bnode\b|\bnpm\b|secrets\.|checkout/.test(job(name)), `${name} runs repository code or sees a secret`);
  assert.match(job("metadata"), /run: gh workflow run pages\.yml -R "\$REPO" --ref main\n/);
  const pub = job("publish");
  for (const w of ["collection.yml", "pages.yml", "announce.yml"]) assert.match(pub, new RegExp(`gh workflow run ${w.replace(".", "\\.")} -R "\\$REPO" --ref main`), w);
  // The outputs the jobs read come from the launcher's own steps.
  assert.match(job("prepare"), /outputs:\n\s+pending: \$\{\{ steps\.prepare\.outputs\.pending \}\}\n\s+deploy: \$\{\{ steps\.prepare\.outputs\.deploy \}\}/);
  assert.match(job("launch"), /outputs:\n\s+recorded: \$\{\{ steps\.commit-record\.outputs\.recorded \}\}/, "publish starts only for a cat whose record reached main");
  assert.match(stepNamed(/node scripts\/launch\.mjs prepare/), /id: prepare\n/);
  assert.match(stepNamed(/node scripts\/launch\.mjs record/), /id: record\n/);
});

test("pages: coins/ is published (the metadata a coin's uri serves); the launcher's ledger and the approvals are not; the Launch workflow dispatches the deploy", () => {
  assert.ok(!/--exclude '\/?coins/.test(PAGES), "coins/ must reach the site");
  for (const excluded of ["/data/sanctuary-launches.json", "/data/launch-approvals.json"]) assert.ok(PAGES.includes(`--exclude '${excluded}'`), excluded);
  assert.match(PAGES, /workflow_dispatch:/);
  // The only Markdown in coins/ is its note, which the site leaves out with every *.md.
  assert.ok(PAGES.includes("--exclude '*.md'"));
  assert.deepEqual(fs.readdirSync(path.join(ROOT, "coins")).filter((f) => !f.endsWith(".json")), ["README.md"]);
});
