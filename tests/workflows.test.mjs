/* The two workflows, read as text: pinned actions, least permissions, one optional secret. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

const read = (name) => fs.readFileSync(path.join(ROOT, ".github/workflows", name), "utf8");
const PAGES = read("pages.yml");
const COLLECTION = read("collection.yml");

/* Each action at the commit its release tag points to (git ls-remote github.com/actions/<name>, 2026-09-25). */
const PINNED = {
  "actions/checkout": ["3d3c42e5aac5ba805825da76410c181273ba90b1", "v7.0.1"],
  "actions/configure-pages": ["45bfe0192ca1faeb007ade9deae92b16b8254a0d", "v6.0.0"],
  "actions/upload-pages-artifact": ["fc324d3547104276b827a68afc52ff2a11cc49c9", "v5.0.0"],
  "actions/deploy-pages": ["368f82528645a54fb793d4d04e342629a3f51346", "v5.0.1"],
  "actions/setup-node": ["820762786026740c76f36085b0efc47a31fe5020", "v7.0.0"],
};

test("every action is pinned to the full commit SHA of its release", () => {
  for (const [name, text] of [["pages.yml", PAGES], ["collection.yml", COLLECTION]]) {
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
  assert.match(PAGES, /workflow_run:\n\s+workflows: \[Collection\]/);
  assert.ok(!/secrets\./.test(PAGES));
  assert.match(PAGES, /npm ci[\s\S]*npm test[\s\S]*configure-pages[\s\S]*upload-pages-artifact[\s\S]*deploy-pages/);
  for (const excluded of ["/scripts", "/tests", "/.github", "*.prototype.html", "/data/collection-state.json", "/data/held.json", "/data/launches.json"]) assert.ok(PAGES.includes(`--exclude '${excluded}'`), excluded);
  assert.match(PAGES, /test -f _site\/data\/planned\.json/);
});

test("collection: hourly and by hand, contents: write only, no stored credentials, one optional secret, commits data only when it changed", () => {
  assert.match(COLLECTION, /^name: Collection$/m);
  assert.match(COLLECTION, /cron: "\d{1,2} \* \* \* \*"/);
  assert.match(COLLECTION, /workflow_dispatch:/);
  assert.match(COLLECTION, /^permissions: \{\}$/m);
  const perms = [...COLLECTION.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim());
  assert.deepEqual(perms, ["contents: write"]);
  assert.match(COLLECTION, /persist-credentials: false/);
  assert.deepEqual([...new Set([...COLLECTION.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))], ["SOLANA_RPC_URL"]);
  // Only the builder's own tests gate the hourly run (a content test can hold up a deploy, never the recording of a launch).
  assert.match(COLLECTION, /npm ci[\s\S]*npm run test:builder[\s\S]*node scripts\/build-collection\.mjs/);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(pkg.scripts["test:builder"].split(" ").filter((w) => w.startsWith("tests/")).sort(), ["tests/build.test.mjs", "tests/chain.test.mjs", "tests/collection.test.mjs", "tests/workflows.test.mjs"]);
  assert.match(COLLECTION, /git add -- 'data\/\*\.json'/);
  assert.match(COLLECTION, /git diff --cached --quiet/);
  assert.match(COLLECTION, /concurrency:\n\s+group: collection/);
});
