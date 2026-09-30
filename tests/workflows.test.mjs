/* The three workflows, read as text: pinned actions, least permissions, one optional secret. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

const read = (name) => fs.readFileSync(path.join(ROOT, ".github/workflows", name), "utf8");
const PAGES = read("pages.yml");
const COLLECTION = read("collection.yml");
const FAMOUS = read("famous.yml");
const MODELS = read("models.yml");
const REWARDS = read("rewards.yml");

/* Each action at the commit its release tag points to (git ls-remote github.com/actions/<name>, 2026-09-25). */
const PINNED = {
  "actions/checkout": ["3d3c42e5aac5ba805825da76410c181273ba90b1", "v7.0.1"],
  "actions/configure-pages": ["45bfe0192ca1faeb007ade9deae92b16b8254a0d", "v6.0.0"],
  "actions/upload-pages-artifact": ["fc324d3547104276b827a68afc52ff2a11cc49c9", "v5.0.0"],
  "actions/deploy-pages": ["368f82528645a54fb793d4d04e342629a3f51346", "v5.0.1"],
  "actions/setup-node": ["820762786026740c76f36085b0efc47a31fe5020", "v7.0.0"],
  "actions/upload-artifact": ["043fb46d1a93c77aae656e7c1c64a875d1fc6a0a", "v7.0.1"],
  "actions/download-artifact": ["3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c", "v8.0.1"],
};

test("every action is pinned to the full commit SHA of its release", () => {
  for (const [name, text] of [["pages.yml", PAGES], ["collection.yml", COLLECTION], ["famous.yml", FAMOUS], ["models.yml", MODELS], ["rewards.yml", REWARDS]]) {
    const uses = [...text.matchAll(/uses:\s*(\S+)(?:\s*#\s*(\S+))?/g)];
    assert.ok(uses.length > 0, name);
    for (const [, u, comment] of uses) {
      assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${name}: ${u}`);
      const [action, sha] = u.split("@");
      assert.ok(PINNED[action], `${name}: ${action} is not one of the pinned actions`);
      assert.equal(sha, PINNED[action][0], `${name}: ${action}`);
      assert.equal(comment, PINNED[action][1], `${name}: ${action}'s comment`);
    }
  }
  for (const action of ["actions/configure-pages", "actions/upload-pages-artifact", "actions/deploy-pages"]) assert.ok(PAGES.includes(`${action}@`), action);
});

test("pages: deploys on a push to main; nothing by default; the deploy job may write Pages and mint an OIDC token, nothing more, and runs no code of the repository's", () => {
  assert.match(PAGES, /^permissions: \{\}$/m);
  const deploy = PAGES.slice(PAGES.indexOf("\n  deploy:"));
  const testJob = PAGES.slice(PAGES.indexOf("\n  test:"), PAGES.indexOf("\n  deploy:"));
  assert.match(deploy, /permissions:\n\s+contents: read\n\s+pages: write\n\s+id-token: write\n/);
  // The tests (and npm) run in a job that can only read; the deploy job only gathers and publishes what they passed.
  assert.match(testJob, /permissions:\n\s+contents: read\n\s+outputs:/);
  assert.match(testJob, /npm ci[\s\S]*npm test/);
  assert.ok(!/\bnpm\b|\bnode\b/.test(deploy), "the deploy job runs npm or node");
  assert.match(deploy, /needs: \[check, test\]/);
  assert.match(deploy, /ref: \$\{\{ needs\.test\.outputs\.sha \}\}/);
  assert.match(PAGES, /push:\n\s+branches: \[main\]/);
  assert.match(PAGES, /workflow_run:\n\s+workflows: \[Collection, Famous coins\]/);
  assert.ok(!/secrets\./.test(PAGES));
  assert.match(PAGES, /npm ci[\s\S]*npm test[\s\S]*configure-pages[\s\S]*upload-pages-artifact[\s\S]*deploy-pages/);
  for (const excluded of ["/scripts", "/tests", "/.github", "*.prototype.html", "/data/collection-state.json", "/data/held.json", "/data/launches.json"]) assert.ok(PAGES.includes(`--exclude '${excluded}'`), excluded);
  assert.match(PAGES, /test -f _site\/data\/planned\.json/);
  assert.match(PAGES, /test -f _site\/data\/famous\.json/);
});

test("collection: hourly and by hand, contents: write for collecting, actions: write only for the next-run job, no stored credentials, one optional secret, commits data only when it changed", () => {
  assert.match(COLLECTION, /^name: Collection$/m);
  assert.match(COLLECTION, /cron: "\d{1,2} \* \* \* \*"/);
  assert.match(COLLECTION, /workflow_dispatch:/);
  assert.match(COLLECTION, /^permissions: \{\}$/m);
  const perms = [...COLLECTION.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim());
  assert.deepEqual(perms, ["contents: write", "actions: write"]);
  // The next-run job runs no code of the repository's: no checkout, no node, no secrets.
  const next = COLLECTION.slice(COLLECTION.indexOf("\n  next:"));
  assert.match(next, /needs: collect/);
  assert.match(next, /gh workflow run collection\.yml/);
  assert.match(next, /vars\.COLLECTION_CHAIN != 'off'/);
  assert.ok(!/uses:|\bnode\b|\bnpm\b|secrets\./.test(next), "the next job runs repository code or sees a secret");
  assert.match(COLLECTION, /persist-credentials: false/);
  assert.deepEqual([...new Set([...COLLECTION.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))], ["SOLANA_RPC_URL"]);
  // Only the builder's own tests gate the hourly run (a content test can hold up a deploy, never the recording of a launch).
  // tests/pump-quote.test.mjs is one: the Collection proves a pump.fun launch priced in a listed coin (chain.mjs
  // proveLaunchPump's quotes, the curve's quote read back, collection.js's entry rules, the builder's pump-quotes.json),
  // which the launcher makes once the owner opts in. launchlab and venues-routing test the launcher only (the Launch
  // workflow runs launchlab's before it sends; venues-routing's reads the trend watch, which needs npm).
  assert.match(COLLECTION, /npm ci[\s\S]*npm run test:builder[\s\S]*node scripts\/build-collection\.mjs/);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(pkg.scripts["test:builder"].split(" ").filter((w) => w.startsWith("tests/")).sort(), ["tests/build.test.mjs", "tests/chain.test.mjs", "tests/collection.test.mjs", "tests/pump-quote.test.mjs", "tests/workflows.test.mjs"]);
  assert.match(COLLECTION, /git add -- 'data\/\*\.json'/);
  assert.match(COLLECTION, /git diff --cached --quiet/);
  assert.match(COLLECTION, /concurrency:\n\s+group: collection/);
});

test("famous coins: daily and by hand, contents: write only, no secrets, builder tests first, commits data/famous.json only when it changed", () => {
  assert.match(FAMOUS, /^name: Famous coins$/m);
  assert.match(FAMOUS, /cron: "\d{1,2} \d{1,2} \* \* \*"/);
  assert.match(FAMOUS, /workflow_dispatch:/);
  assert.match(FAMOUS, /^permissions: \{\}$/m);
  const perms = [...FAMOUS.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim());
  assert.deepEqual(perms, ["contents: write"]);
  assert.match(FAMOUS, /persist-credentials: false/);
  assert.ok(!/secrets\./.test(FAMOUS), "no secrets");
  assert.match(FAMOUS, /npm ci[\s\S]*npm run test:builder[\s\S]*node scripts\/refresh-famous\.mjs/);
  assert.match(FAMOUS, /git add -- data\/famous\.json/);
  assert.match(FAMOUS, /Refresh the Hall of Fame coins/, "only the Hall of Fame coins are refreshed");
  assert.match(FAMOUS, /git diff --cached --quiet/);
  assert.match(FAMOUS, /concurrency:\n\s+group: famous/);
});

test("models: fails closed on MODELS_ENABLED, each API key only in its own step of the jobs that call its API, no expression inside a script, no wallet secret", () => {
  assert.match(MODELS, /^name: Models$/m);
  assert.match(MODELS, /^permissions: \{\}$/m);
  const jobs = MODELS.slice(MODELS.indexOf("\njobs:")).split(/\n  (?=[a-z][\w-]*:\n)/).slice(1);
  const jobOf = (name) => jobs.find((j) => j.startsWith(`${name}:`));
  assert.equal(jobs[0].split(":")[0], "pick");
  assert.match(jobOf("pick"), /\n    if: \$\{\{ vars\.MODELS_ENABLED == 'on' \}\}\n/, "the first job is gated; every other job needs it");
  assert.ok(!/secrets\./.test(jobOf("pick")), "the pick holds no key");
  for (const j of jobs.filter((j) => !j.startsWith("pick:"))) assert.match(j, /\n    needs: /, j.split(":")[0]);
  // Meshy's key where Meshy makes the models; Tripo's where Tripo makes them and where it rigs them: one step in each.
  for (const [secret, where] of [["MESHY_API_KEY", ["meshy"]], ["TRIPO_API_KEY", ["tripo-make", "tripo"]]]) {
    const holders = jobs.filter((j) => j.includes(`secrets.${secret}`));
    assert.deepEqual(holders.map((j) => j.split(":")[0]), where, secret);
    for (const j of holders) assert.equal([...j.matchAll(new RegExp(`secrets\\.${secret}`, "g"))].length, 1, `${secret} in one step of ${j.split(":")[0]}`);
  }
  assert.deepEqual([...new Set([...MODELS.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["MESHY_API_KEY", "TRIPO_API_KEY"]);
  assert.ok(!/LAUNCH_WALLET_KEY|SOLANA_RPC_URL/.test(MODELS));
  for (const step of MODELS.split(/\n      - /)) {
    const run = step.includes("run: |") ? step.split("run: |")[1].split("\n").slice(1).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith("          ") || !x.trim())).join("\n") : step.match(/run: .*/)?.[0] ?? "";
    assert.ok(!run.includes("${{"), `no expression inside a script: ${step.slice(0, 50)}`);
  }
  assert.match(MODELS, /persist-credentials: false/);
  assert.equal([...MODELS.matchAll(/actions\/checkout@/g)].length, [...MODELS.matchAll(/persist-credentials: false/g)].length);
});
