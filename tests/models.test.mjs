/* The Models workflow (.github/workflows/models.yml), read as text as the other workflows are: pinned
   actions, no permission by default and the least each job needs, fail closed on MODELS_ENABLED, each
   API key in exactly the one step that calls its API, no wallet secret, the token only in the push, and
   the Pages dispatch in a job that runs no code of the repository's. Then scripts/models.mjs with fakes:
   choosing the cats (launched first), the credit reserves, the retry bookkeeping, the checks a model
   must pass, and the steps themselves (a model that fails is discarded and recorded). No network, no key. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import {
  main, selectEntries, reserveOf, perRun, backlogOn, startTry, finishTry, cleanRow, bundlePaths, meshyOutcome, restoreJob, stateOf, keysOf, launchedCats,
  glbProblems, rigProblems, glbPositions, readGlb, modelProblems, loadRig, MAX_TRIES, DEFAULT_RESERVE, BUDGET, MODEL_TESTS, FILES,
} from "../scripts/models.mjs";
import { tripo as tripoCli, TRIPO_TIMEOUT_MS } from "../scripts/tripo.mjs";

const W = fs.readFileSync(path.join(ROOT, ".github/workflows/models.yml"), "utf8");
const LAUNCH = fs.readFileSync(path.join(ROOT, ".github/workflows/launch.yml"), "utf8");
const steps = W.split(/\n      - /);
const job = (name) => { const from = W.indexOf(`\n  ${name}:\n`); const next = W.slice(from + 1).search(/\n  [a-z][\w-]*:\n/); return next < 0 ? W.slice(from) : W.slice(from, from + 1 + next); };
const stepNamed = (re) => { const s = steps.filter((x) => re.test(x)); assert.equal(s.length, 1, `one step ${re}`); return s[0]; };
const R = await loadRig();

/* ── the workflow's shape ─────────────────────────────────────────────────────────────── */

test("models workflow: name, triggers (by hand, daily, and the Launch workflow's dispatch), no permission by default, one run at a time", () => {
  assert.match(W, /^name: Models$/m);
  assert.match(W, /on:\n  schedule:\n    - cron: "\d{1,2} \d{1,2} \* \* \*"\n  workflow_dispatch:\n/);
  assert.ok(!/\n  push:|pull_request/.test(W));
  assert.match(W, /^permissions: \{\}$/m);
  assert.match(W, /concurrency:\n  group: models\n  cancel-in-progress: false\n/);
  const publish = LAUNCH.slice(LAUNCH.indexOf("\n  publish:"));
  assert.match(publish, /gh workflow run models\.yml -R "\$REPO" --ref main \|\| echo/);
});

test("models workflow: separate jobs, fail closed: Meshy (read, no installs), Pack (read, no secret), Tripo (read), Commit (write, no third-party code), Pages (actions)", () => {
  assert.deepEqual([...W.matchAll(/^  ([a-z][\w-]*):\n    (?:needs|if|runs-on)/gm)].map((m) => m[1]), ["meshy", "pack", "tripo", "commit", "pages"]);
  assert.match(job("meshy"), /\n    if: \$\{\{ vars\.MODELS_ENABLED == 'on' \}\}\n/);
  for (const name of ["pack", "tripo", "commit", "pages"]) assert.match(job(name), /\n    needs: /, `${name} runs only after the gated job`);
  const perms = Object.fromEntries(["meshy", "pack", "tripo", "commit", "pages"].map((n) => [n, job(n).match(/permissions:\n((?:\s{6}\S.*\n)+)/)[1].trim()]));
  assert.deepEqual(perms, { meshy: "contents: read", pack: "contents: read", tripo: "contents: read", commit: "contents: write", pages: "actions: write" });
  for (const name of ["meshy", "pack", "tripo", "commit", "pages"]) assert.match(job(name), /timeout-minutes: \d+/, name);
  // No package is installed where a key or the push token is: Meshy and Commit install nothing (meshy.mjs and the checks are node built-ins).
  for (const name of ["meshy", "commit"]) assert.ok(!/\bnpm\b|\bnpx\b|\bpip\b|playwright install|\byarn\b|\bpnpm\b/.test(job(name)), `${name} installs nothing`);
  assert.ok(!/secrets\./.test(job("pack")) && !/github\.token/.test(job("pack")), "pack: no secret, no token");
  assert.ok(!/github\.token/.test(job("tripo")) && !/github\.token/.test(job("meshy")));
  // Every package installed with its install scripts off, at a pinned version.
  for (const name of ["pack", "tripo"]) {
    const lines = job(name).split("\n").filter((l) => /\bnpm i\b/.test(l));
    assert.ok(lines.length > 0, name);
    for (const l of lines) {
      assert.match(l, /--ignore-scripts/, l);
      for (const p of l.trim().split(/\s+/).filter((w) => /^@?[a-z]/.test(w) && !["npm", "i"].includes(w))) assert.match(p, /^@?[\w./-]+@\d+\.\d+\.\d+$/, `${p} is pinned`);
    }
  }
  assert.match(job("pack"), /pip" install --quiet numpy==[\d.]+ pillow==[\d.]+/);
  assert.match(job("pages"), /needs: commit\n\s+if: \$\{\{ !cancelled\(\) && needs\.commit\.outputs\.pushed == 'true' \}\}/);
  assert.ok(!/uses:|\bnode\b|\bnpm\b|secrets\.|checkout/.test(job("pages")));
});

test("models workflow: every action pinned to its release's commit, and every checkout keeps no credentials", () => {
  assert.deepEqual([...new Set([...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`))].sort(), [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1",
    "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c v8.0.1",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0",
    "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a v7.0.1",
  ]);
  for (const m of W.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /^actions\/[\w-]+@[0-9a-f]{40}$/);
  assert.equal([...W.matchAll(/actions\/checkout@/g)].length, 4);
  assert.equal([...W.matchAll(/- uses: actions\/checkout@\S+ # v7\.0\.1\n\s+with:\n\s+ref: main\n\s+persist-credentials: false\n/g)].length, 4);
});

test("models workflow: MESHY_API_KEY only in the Meshy step of the Meshy job, TRIPO_API_KEY only in the Tripo step of the Tripo job; no wallet secret; no expression in a script", () => {
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["MESHY_API_KEY", "TRIPO_API_KEY"]);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 2);
  const meshy = stepNamed(/node scripts\/models\.mjs meshy/), tripo = stepNamed(/node scripts\/models\.mjs tripo/);
  assert.deepEqual([...meshy.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["MESHY_API_KEY"]);
  assert.deepEqual([...tripo.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["TRIPO_API_KEY"]);
  assert.ok(job("meshy").includes(meshy) && job("tripo").includes(tripo));
  for (const bad of ["LAUNCH_WALLET_KEY", "SOLANA_RPC_URL", "WALLET", "X_API", "ANTHROPIC", "GITHUB_TOKEN"]) assert.ok(!W.replace(/^#.*$/gm, "").includes(bad), bad);
  assert.ok(!/^ {0,4}env:/m.test(W));
  assert.match(meshy, /MODELS_MESHY_RESERVE: \$\{\{ vars\.MODELS_MESHY_RESERVE \}\}/);
  assert.match(tripo, /MODELS_TRIPO_RESERVE: \$\{\{ vars\.MODELS_TRIPO_RESERVE \}\}/);
  // The API steps are bounded in time.
  for (const s of [meshy, tripo, stepNamed(/node scripts\/models\.mjs pack/)]) assert.match(s, /timeout-minutes: \d+/);
  for (const s of steps) {
    const script = s.includes("run: |") ? s.split("run: |")[1].split("\n").slice(1).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith("          ") || !x.trim())).join("\n") : (s.match(/run: .*/)?.[0] ?? "");
    assert.ok(!script.includes("${{"), `no expression inside a script: ${s.slice(0, 60)}`);
  }
});

test("models workflow: the state always reaches the commit (every bundle, upload and the commit run always), and the push has git hooks off and one rebase retry", () => {
  for (const name of ["meshy", "pack", "tripo"]) {
    const j = job(name);
    assert.match(j, /node scripts\/models\.mjs bundle "\$RUNNER_TEMP\/out"/, name);
    for (const s of j.split(/\n      - /).filter((x) => /models\.mjs bundle|upload-artifact/.test(x))) assert.match(s, /if: \$\{\{ always\(\)/, `${name}: ${s.slice(0, 40)}`);
  }
  assert.match(job("commit"), /needs: \[meshy, pack, tripo\]\n\s+if: \$\{\{ always\(\) && needs\.meshy\.outputs\.keys != '' \}\}/);
  assert.match(job("commit"), /node scripts\/models\.mjs merge/);
  const commit = stepNamed(/git -c core\.hooksPath=\/dev\/null -c user\.name/);
  assert.match(commit, /if: \$\{\{ always\(\) \}\}/);
  assert.match(commit, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.equal(steps.filter((s) => /github\.token/.test(s)).length, 2, "the push and the Pages dispatch only");
  assert.match(commit, /auth=\$\(printf 'x-access-token:%s' "\$GH_TOKEN" \| base64 -w0\)\n\s+echo "::add-mask::\$auth"/);
  assert.match(commit, /if ! git -c core\.hooksPath=\/dev\/null -c http\.extraheader="AUTHORIZATION: basic \$auth" push origin HEAD:main; then\n\s+git -c core\.hooksPath=\/dev\/null -c http\.extraheader="AUTHORIZATION: basic \$auth" fetch origin main\n\s+git -c core\.hooksPath=\/dev\/null -c user\.name="github-actions\[bot\]" -c user\.email="41898282\+github-actions\[bot\]@users\.noreply\.github\.com" rebase origin\/main\n\s+git -c core\.hooksPath=\/dev\/null -c http\.extraheader="AUTHORIZATION: basic \$auth" push origin HEAD:main\n\s+fi/);
  assert.ok([...commit.matchAll(/\bgit (?!-c core\.hooksPath)(commit|push|rebase|fetch)/g)].length === 0, "every git that could run a hook has them off");
  assert.match(commit, /commit -q -m "Models: [a-zA-Z0-9 ]+"/);
  // A merge that failed commits no model file, only the state.
  assert.match(commit, /if \[ "\$MERGED" != "success" \]; then\n\s+git checkout -- assets\/models scripts\/cat-models\.jobs\.json/);
  assert.match(commit, /MERGED: \$\{\{ steps\.merge\.outcome \}\}/);
});

/* ── configuration and choosing ───────────────────────────────────────────────────────── */

test("the credit reserves: the scripts' own defaults, from the repository variables, clamped; one or two cats a run", () => {
  // The defaults are the ones scripts/meshy.mjs run and scripts/tripo.mjs rig use.
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/meshy.mjs"), "utf8"), new RegExp(`flag\\("--reserve", ${DEFAULT_RESERVE.meshy}\\)`));
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/tripo.mjs"), "utf8"), new RegExp(`flag\\("--reserve", ${DEFAULT_RESERVE.tripo}\\)`));
  assert.deepEqual(reserveOf({}, "MODELS_MESHY_RESERVE", 100), { value: 100, note: null });
  assert.deepEqual(reserveOf({ MODELS_MESHY_RESERVE: " 250 " }, "MODELS_MESHY_RESERVE", 100), { value: 250, note: null });
  assert.equal(reserveOf({ MODELS_MESHY_RESERVE: "lots" }, "MODELS_MESHY_RESERVE", 100).value, 100);
  assert.match(reserveOf({ MODELS_MESHY_RESERVE: "lots" }, "MODELS_MESHY_RESERVE", 100).note, /not a number/);
  assert.equal(reserveOf({ MODELS_TRIPO_RESERVE: "-5" }, "MODELS_TRIPO_RESERVE", 100).value, 0);
  assert.equal(reserveOf({ MODELS_TRIPO_RESERVE: "12.7" }, "MODELS_TRIPO_RESERVE", 100).value, 12);
  assert.deepEqual([perRun({}), perRun({ MODELS_PER_RUN: "2" }), perRun({ MODELS_PER_RUN: "9" }), perRun({ MODELS_PER_RUN: "0" }), perRun({ MODELS_PER_RUN: "x" })], [1, 2, 2, 1, 1]);
  assert.deepEqual([backlogOn({}), backlogOn({ MODELS_BACKLOG: " ON " }), backlogOn({ MODELS_BACKLOG: "yes" })], [false, true, false]);
  // The size budgets are the ones the model tests and the packer keep.
  const cm = fs.readFileSync(path.join(ROOT, "tests/catmodels.test.mjs"), "utf8"), py = fs.readFileSync(path.join(ROOT, "scripts/make-cat-models.py"), "utf8");
  assert.ok(cm.includes(`const BUDGET = { "": ${BUDGET.full.toLocaleString("en").replace(/,/g, "_")}, "-lo": ${BUDGET.far.toLocaleString("en").replace(/,/g, "_")} };`));
  assert.ok(cm.includes(`const BUDGET_HD = { "": ${BUDGET.hdFull.toLocaleString("en").replace(/,/g, "_")}, "-lo": ${BUDGET.hdFar.toLocaleString("en").replace(/,/g, "_")} };`));
  assert.ok(py.includes(`BUDGET_HI, BUDGET_LO, BUDGET_HD, BUDGET_HD_LO = ${[BUDGET.full, BUDGET.far, BUDGET.hdFull, BUDGET.hdFar].map((n) => n.toLocaleString("en").replace(/,/g, "_")).join(", ")}`));
  assert.deepEqual(MODEL_TESTS, ["tests/catmodels.test.mjs", "tests/catrig.test.mjs", "tests/meshy.test.mjs"]);
});

const QUEUE = { cats: {
  OLDCAT: { action: "rebuild", priority: 1, referencePrompt: "An old cat that has a model.", styleImage: "generate", order: 1 },
  NEWCAT: { action: "rebuild", priority: 1, referencePrompt: "A launched cat with no model.", styleImage: "https://pbs.twimg.com/media/a.jpg", order: 90 },
  LATECAT: { action: "rebuild", priority: 1, referencePrompt: "Another launched cat.", styleImage: "https://pbs.twimg.com/media/b.jpg", order: 91 },
  HIDECAT: { action: "rebuild", priority: 1, referencePrompt: "A launched cat, photo hidden.", styleImage: "https://pbs.twimg.com/media/c.jpg", order: 92 },
  TINT: { action: "retexture", priority: 1, retexturePrompt: "A ginger tabby cat.", styleImage: "generate", order: 0 },
  VIEWS: { action: "rebuild", priority: 1, referencePrompt: "Views wait.", styleImage: "generate", order: 2 },
} };
const launchedRow = (ticker, post) => ({ ticker, launch: { mint: "m", tx: "t", launchpad: "pump.fun", at: "2026-09-28T00:00:00Z" }, proof: { url: `https://x.com/a/status/${post}` } });
const ADOPT = { cats: [launchedRow("NEWCAT", "2100000000000000001"), launchedRow("LATECAT", "2100000000000000002"), launchedRow("HIDECAT", "2100000000000000003"), { ticker: "OLDCAT" }] };

test("choosing: queued rebuilds only; launched cats with no model first, the rest only with the backlog on; never a hidden photo, views waiting, a cat made, or one past its tries", () => {
  assert.deepEqual([...launchedCats(ADOPT)], [["NEWCAT", "2100000000000000001"], ["LATECAT", "2100000000000000002"], ["HIDECAT", "2100000000000000003"]]);
  const base = { queue: QUEUE, meshyState: { VIEWS: { status: "views" } }, adoptables: ADOPT, hidden: new Set(["2100000000000000003"]), index: { cats: {} } };
  let r = selectEntries({ ...base, limit: 2 });
  assert.deepEqual(r.picked.map((p) => p.key), ["NEWCAT", "LATECAT"], "launched cats first, in the queue's order; the backlog is off");
  assert.ok(r.picked.every((p) => p.launched));
  const why = Object.fromEntries(r.skipped.map((s) => [s.key, s.why]));
  assert.match(why.HIDECAT, /hidden/);
  assert.match(why.VIEWS, /wait for a person/);
  assert.ok(!("TINT" in why) && !r.picked.some((p) => p.key === "TINT"), "a retexture is not this workflow's");
  assert.deepEqual(selectEntries({ ...base, limit: 1 }).picked.map((p) => p.key), ["NEWCAT"]);
  // The backlog after the launched cats.
  assert.deepEqual(selectEntries({ ...base, backlog: true, limit: 2, adoptables: { cats: [] } }).picked.map((p) => p.key), ["OLDCAT", "NEWCAT"]);
  // A photo hidden in data/real-photos.json (hidden) is hidden too.
  assert.match(Object.fromEntries(selectEntries({ ...base, hidden: new Set(), photos: { cats: {}, hidden: { HIDECAT: { postId: "2100000000000000003", entry: {} } } } }).skipped.map((s) => [s.key, s.why])).HIDECAT, /hidden/);
  // Made (Meshy done), live, a launched cat with a model already, or tried MAX_TRIES times: skipped.
  r = selectEntries({ ...base, limit: 2, meshyState: { NEWCAT: { status: "done" } }, state: { cats: { LATECAT: { attempts: MAX_TRIES, status: "gave-up" } } } });
  assert.deepEqual(r.picked, []);
  assert.match(Object.fromEntries(r.skipped.map((s) => [s.key, s.why])).LATECAT, /failed 2 times/);
  assert.deepEqual(selectEntries({ ...base, index: { cats: { NEWCAT: {} } } }).picked.map((p) => p.key), ["LATECAT"]);
  assert.deepEqual(selectEntries({ ...base, state: { cats: { NEWCAT: { attempts: 1, status: "failed" } } } }).picked.map((p) => p.key), ["NEWCAT"], "one failure: tried again");
  // A key a file could not be named by is never taken; KEYS from a step are checked against the queue.
  assert.deepEqual(keysOf({ KEYS: "NEWCAT ../x TINT NEWCAT NOPE LATECAT" }, QUEUE), ["NEWCAT", "LATECAT"]);
});

test("bookkeeping: a try is counted before Meshy is called; made, live or failed after; the second failure gives up; rows from an artifact cleaned", () => {
  const st = stateOf(null);
  assert.deepEqual(st.cats, {});
  const { row, prev } = startTry(st, "A", { at: "t0" });
  assert.deepEqual([row, prev], [{ attempts: 1, status: "started", at: "t0" }, null]);
  assert.deepEqual(finishTry(st, "A", { made: true, at: "t1", tasks: ["v", "m", "f"] }), { attempts: 1, status: "made", at: "t1", tasks: ["v", "m", "f"] });
  assert.deepEqual(finishTry(st, "A", { ok: false, error: "boom", at: "t2" }), { attempts: 1, status: "failed", at: "t2", error: "boom", tasks: ["v", "m", "f"] });
  startTry(st, "A", { at: "t3" });
  assert.equal(finishTry(st, "A", { ok: false, error: "boom", at: "t4" }).status, "gave-up");
  st.cats.B = { attempts: 1, status: "failed", tripo: { status: "rigged" } };
  startTry(st, "B", { at: "t5" });
  assert.deepEqual(finishTry(st, "B", { ok: true, at: "t6", tasks: ["x"] }), { attempts: 2, status: "live", at: "t6", tasks: ["x"], tripo: { status: "rigged" } });
  // A try that never finished (started or made) is chosen again while tries are left, and not once they are used.
  const q = { cats: { AA: { action: "rebuild", priority: 1 } } }, launched = { cats: [launchedRow("AA", "2100000000000000009")] };
  assert.deepEqual(selectEntries({ queue: q, adoptables: launched, state: { cats: { AA: { attempts: 1, status: "started" } } } }).picked.map((p) => p.key), ["AA"]);
  assert.deepEqual(selectEntries({ queue: q, adoptables: launched, state: { cats: { AA: { attempts: 2, status: "made" } } } }).picked, []);
  assert.equal(meshyOutcome(null, null).outcome, "stopped");
  assert.equal(meshyOutcome({ status: "failed", at: "a" }, { status: "failed", at: "a" }).outcome, "stopped", "nothing new: the reserve");
  assert.deepEqual(meshyOutcome(null, { status: "done", tasks: ["v", "m", "f"], credits: 41 }), { outcome: "made", tasks: ["v", "m", "f"], credits: 41 });
  assert.deepEqual(meshyOutcome({ status: "failed", at: "a" }, { status: "failed", at: "b", error: "503" }), { outcome: "failed", error: "503" });
  assert.deepEqual(restoreJob({ A: { url: "new", previous: { url: "old" } } }, "A"), { A: { url: "old" } });
  assert.deepEqual(restoreJob({ A: { url: "new", previous: null }, B: {} }, "A"), { B: {} });
  // A row from another job's artifact: its known fields only, bounded; nonsense refused.
  assert.deepEqual(cleanRow({ attempts: 1, status: "live", at: "t", tasks: ["a", 5], evil: "x", tripo: { status: "rigged", riggable: true, task: "t1", run: "rm" } }), { attempts: 1, status: "live", at: "t", tasks: ["a"], tripo: { status: "rigged", riggable: true, task: "t1" } });
  for (const bad of [null, [], { attempts: 0, status: "live" }, { attempts: 1, status: "hacked" }, { attempts: "1", status: "live" }]) assert.equal(cleanRow(bad), null, JSON.stringify(bad));
  // What goes between the jobs: the state files and each model's pieces, never anything else.
  assert.deepEqual(bundlePaths(["NEWCAT", "../x"]), [FILES.meshyState, FILES.state, FILES.tripoState, FILES.jobs, FILES.index, FILES.provenance,
    "assets/models/cats/NEWCAT.glb", "assets/models/cats/NEWCAT-lo.glb", "scripts/model-previews/NEWCAT.png"]);
});

test("time bounds: a Tripo CLI call is killed after TRIPO_TIMEOUT_MS, every Meshy request carries an abort signal, and a missed poll is asked again", () => {
  let opts;
  tripoCli(["balance"], { run: (cmd, args, o) => { opts = o; return '{"balance": 5}'; } });
  assert.equal(opts.timeout, TRIPO_TIMEOUT_MS);
  assert.ok(TRIPO_TIMEOUT_MS > 0 && TRIPO_TIMEOUT_MS <= 60 * 60_000);
  assert.equal(opts.killSignal, "SIGKILL");
  const src = fs.readFileSync(path.join(ROOT, "scripts/meshy.mjs"), "utf8");
  const calls = [...src.matchAll(/\bfetch\(([^;]*)\);/g)].map((m) => m[1]);
  assert.equal(calls.length, 2);
  for (const c of calls) assert.match(c, /signal: AbortSignal\.timeout\((API|DOWNLOAD)_TIMEOUT_MS\)/, c);
  assert.match(src, /catch \(e\) \{ if \(\+\+misses >= 3\) throw e; continue; \}/);
});

/* ── the checks ───────────────────────────────────────────────────────────────────────── */

const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/index.json"), "utf8"));
const SAMPLE = Object.keys(INDEX.cats).find((k) => !INDEX.cats[k].hd && typeof INDEX.cats[k].file !== "string") ?? Object.keys(INDEX.cats)[0];

test("the checks: a shipped model passes (budget, a textured GLB, the garden's rig, 1 unit tall); a broken one does not", async () => {
  assert.deepEqual(await modelProblems(ROOT, SAMPLE, { R }), [], SAMPLE);
  const buf = fs.readFileSync(path.join(ROOT, `assets/models/cats/${SAMPLE}.glb`));
  assert.match(glbProblems(buf, 1000).join(), /over the 1000-byte budget/);
  assert.deepEqual(glbProblems(Buffer.from("not a model at all, not a model at all"), 1e6), ["not a GLB"]);
  const pos = glbPositions(readGlb(buf));
  assert.deepEqual(rigProblems(pos, R), []);
  // Floating, or too few points: refused.
  assert.deepEqual(rigProblems(new Float32Array(9), R), ["too few points"]);
  assert.match(rigProblems(pos.map((v, i) => (i % 3 === 1 ? v + 0.5 : v)), R).join(), /not 1 unit tall on the ground/);
  assert.deepEqual(await modelProblems(ROOT, "NOT-A-CAT", { R }), ["not in assets/models/cats/index.json"]);
});

/* ── the steps, on a throwaway repository with fakes ──────────────────────────────────── */

function repo({ queue = QUEUE, meshyState = {}, jobs = {}, adoptables = ADOPT, state = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "models-"));
  const w = (rel, v) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), typeof v === "string" || Buffer.isBuffer(v) ? v : `${JSON.stringify(v, null, 1)}\n`); };
  w(FILES.queue, queue); w(FILES.meshyState, meshyState); w(FILES.jobs, jobs); w(FILES.adoptables, adoptables);
  w(FILES.photos, { cats: {}, none: {} });
  w(FILES.index, { version: 1, cats: { [SAMPLE]: INDEX.cats[SAMPLE] } });
  w(FILES.provenance, "# Models\n");
  if (state) w(FILES.state, { note: "n", cats: state });
  for (const tag of ["", "-lo"]) w(`assets/models/cats/${SAMPLE}${tag}.glb`, fs.readFileSync(path.join(ROOT, `assets/models/cats/${SAMPLE}${tag}.glb`)));
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  return { root, w, read, json: (rel) => JSON.parse(read(rel)), exists: (rel) => fs.existsSync(path.join(root, rel)) };
}
const NOW = () => Date.parse("2026-09-28T06:00:00Z");

test("pick: the step's output is the keys to make; nothing when no launched cat waits (the backlog is off)", async () => {
  const t = repo();
  const logs = [];
  const r = await main(["pick"], { env: { MODELS_PER_RUN: "2" }, root: t.root, now: NOW, log: (l) => logs.push(l) });
  assert.deepEqual(r, { code: 0, outputs: { keys: "NEWCAT LATECAT" } });
  const none = await main(["pick"], { env: {}, root: repo({ adoptables: { cats: [] } }).root, now: NOW, log: () => {} });
  assert.equal(none.outputs.keys, "");
  // A hidden photo (data/photo-hide.json) is never sent to Meshy.
  t.w("data/photo-hide.json", { note: "t", hide: ["2100000000000000001"] });
  assert.equal((await main(["pick"], { env: {}, root: t.root, now: NOW, log: () => {} })).outputs.keys, "LATECAT");
});

test("meshy: no key, nothing called; each cat through scripts/meshy.mjs with the reserve; a failure is a try; the reserve stops the run and uses none", async () => {
  const t = repo();
  const calls = [];
  const fakeMeshy = (result) => (cmd, args) => {
    calls.push([cmd, ...args]);
    // The try is on disk before Meshy is called (a run killed here still counts it).
    assert.deepEqual([t.json(FILES.state).cats[args[2]].status, t.json(FILES.state).cats[args[2]].attempts], ["started", 1]);
    const key = args[2];
    const s = t.json(FILES.meshyState);
    if (result[key] === "done") s[key] = { status: "done", action: "rebuild", tasks: ["v1", "m1", "f1"], credits: 41, at: "x" };
    if (result[key] === "failed") s[key] = { status: "failed", action: "rebuild", error: "multi-image-to-3d FAILED", at: "y" };
    t.w(FILES.meshyState, s);
    return { status: 0 };
  };
  const logs = [];
  let r = await main(["meshy"], { env: { KEYS: "NEWCAT" }, root: t.root, now: NOW, exec: fakeMeshy({}), log: (l) => logs.push(l) });
  assert.deepEqual([r.outputs.made, calls.length], ["", 0]);
  assert.match(logs.join("\n"), /MESHY_API_KEY is not set/);
  r = await main(["meshy"], { env: { KEYS: "NEWCAT LATECAT", MESHY_API_KEY: "fake", MODELS_MESHY_RESERVE: "150" }, root: t.root, now: NOW, exec: fakeMeshy({ NEWCAT: "done", LATECAT: "failed" }), log: () => {} });
  assert.equal(r.outputs.made, "NEWCAT");
  assert.deepEqual(calls[0], ["node", "scripts/meshy.mjs", "run", "NEWCAT", "--limit", "1", "--only", "rebuild", "--reserve", "150"]);
  assert.deepEqual(t.json(FILES.state).cats.LATECAT, { attempts: 1, status: "failed", at: "2026-09-28T06:00:00Z", error: "Meshy: multi-image-to-3d FAILED" });
  assert.deepEqual(t.json(FILES.state).cats.NEWCAT, { attempts: 1, status: "made", at: "2026-09-28T06:00:00Z", tasks: ["v1", "m1", "f1"] });
  // Nothing new in Meshy's state (its balance at the reserve): no try used, and the run stops there; the reserve's default is the script's.
  const t2 = repo(), asked = [];
  r = await main(["meshy"], { env: { KEYS: "NEWCAT LATECAT", MESHY_API_KEY: "fake" }, root: t2.root, now: NOW, exec: (cmd, args) => { asked.push(args); return { status: 0 }; }, log: () => {} });
  assert.deepEqual([r.outputs.made, asked.length, asked[0].at(-1)], ["", 1, String(DEFAULT_RESERVE.meshy)]);
  assert.deepEqual(t2.json(FILES.state).cats, {});
});

/** A fake packer: puts `src`'s model files in place for `key` and its index row (hd as asked), as make-cat-models.py would. */
const fakePacker = (t, { src = SAMPLE, hd = INDEX.cats[src].hd === true, testsPass = true } = {}) => (cmd, args) => {
  if (cmd === "python3") {
    const key = args.at(-1);
    for (const tag of ["", "-lo"]) t.w(`assets/models/cats/${key}${tag}.glb`, fs.readFileSync(path.join(ROOT, `assets/models/cats/${src}${tag}.glb`)));
    const idx = t.json(FILES.index);
    idx.cats[key] = { ...INDEX.cats[src], ...(hd ? { hd: true } : {}) };
    if (!hd) delete idx.cats[key].hd;
    t.w(FILES.index, idx);
    t.w(FILES.provenance, `${t.read(FILES.provenance)}| ${key} | … |\n`);
    const jobs = t.json(FILES.jobs); jobs[key] = { ...jobs[key], sizes: { hi: 1, lo: 1 } }; t.w(FILES.jobs, jobs);
    return { status: 0 };
  }
  if (cmd === "node" && args[0] === "--test") { assert.deepEqual(args.slice(1), MODEL_TESTS); return { status: testsPass ? 0 : 1 }; }
  throw new Error(`unexpected ${cmd} ${args.join(" ")}`);
};

test("pack: a model that passes every check goes live; its index row, files and job stay", async () => {
  const t = repo({ meshyState: { NEWCAT: { status: "done", tasks: ["v1", "m1", "f1"] } }, jobs: { NEWCAT: { model_job: "m1", url: "https://x/new.glb", status: "done", previous: null } },
    state: { NEWCAT: { attempts: 1, status: "made", at: "t", tasks: ["v1", "m1", "f1"] } } });
  const r = await main(["pack"], { env: { KEYS: "NEWCAT" }, root: t.root, now: NOW, exec: fakePacker(t), R, log: () => {} });
  assert.equal(r.outputs.live, "NEWCAT");
  assert.ok(t.exists("assets/models/cats/NEWCAT.glb") && t.json(FILES.index).cats.NEWCAT);
  assert.deepEqual(t.json(FILES.state).cats.NEWCAT, { attempts: 1, status: "live", at: "2026-09-28T06:00:00Z", tasks: ["v1", "m1", "f1"] });
  assert.equal(t.json(FILES.jobs).NEWCAT.model_job, "m1");
});

test("pack: a model over its budget, or failing the model tests, is discarded: files, index row and job put back, Meshy's state failed, a try used; twice, and it gives up", async () => {
  const jobs = { NEWCAT: { model_job: "m2", url: "https://x/new.glb", status: "done", previous: { model_job: "m0", url: "https://x/old.glb", status: "done" } } };
  const t = repo({ meshyState: { NEWCAT: { status: "done", tasks: ["v2", "m2", "f2"] } }, jobs, state: { NEWCAT: { attempts: 1, status: "made", at: "t" } } });
  const before = [t.read(FILES.index), t.read(FILES.provenance)];
  // Over budget: an HD model's full copy (over 600 KB) packed as a standard one; the model tests are never reached.
  const hdKey = Object.keys(INDEX.cats).find((k) => INDEX.cats[k].hd && typeof INDEX.cats[k].file !== "string" && fs.statSync(path.join(ROOT, `assets/models/cats/${k}.glb`)).size > BUDGET.full);
  assert.ok(hdKey, "a shipped HD model over the standard budget");
  const logs = [];
  const r = await main(["pack"], { env: { KEYS: "NEWCAT" }, root: t.root, now: NOW, exec: fakePacker(t, { src: hdKey, hd: false }), R, log: (l) => logs.push(l) });
  assert.equal(r.outputs.live, "");
  assert.ok(!t.exists("assets/models/cats/NEWCAT.glb") && !t.exists("assets/models/cats/NEWCAT-lo.glb"), "the files are gone");
  assert.deepEqual([t.read(FILES.index), t.read(FILES.provenance)], before, "the index and provenance as they were");
  assert.deepEqual(t.json(FILES.jobs).NEWCAT, jobs.NEWCAT.previous, "the job entry as before Meshy");
  assert.equal(t.json(FILES.meshyState).NEWCAT.status, "failed", "Meshy's state failed, so the cat is tried again");
  assert.match(t.json(FILES.meshyState).NEWCAT.error, /did not pass the checks/);
  const row = t.json(FILES.state).cats.NEWCAT;
  assert.deepEqual([row.attempts, row.status], [1, "failed"]);
  assert.match(logs.join("\n"), /discarded \(NEWCAT\.glb: \d+ bytes, over the 600000-byte budget[^)]*\)[\s\S]*keeps its portrait/);
  // Chosen again (one try left), then discarded again: it gives up, and is not chosen any more.
  assert.equal((await main(["pick"], { env: {}, root: t.root, now: NOW, log: () => {} })).outputs.keys, "NEWCAT");
  const j2 = t.json(FILES.jobs); j2.NEWCAT = jobs.NEWCAT; t.w(FILES.jobs, j2);
  t.w(FILES.state, { note: "n", cats: { NEWCAT: { attempts: 2, status: "made", at: "t" } } });
  await main(["pack"], { env: { KEYS: "NEWCAT" }, root: t.root, now: NOW, exec: fakePacker(t, { testsPass: false }), R, log: () => {} });
  assert.deepEqual([t.json(FILES.state).cats.NEWCAT.attempts, t.json(FILES.state).cats.NEWCAT.status], [2, "gave-up"]);
  assert.equal((await main(["pick"], { env: {}, root: t.root, now: NOW, log: () => {} })).outputs.keys, "LATECAT");
  // A packer that fails is a discarded model too.
  const t3 = repo({ meshyState: { NEWCAT: { status: "done" } }, state: { NEWCAT: { attempts: 1, status: "made", at: "t" } } });
  const r3 = await main(["pack"], { env: { KEYS: "NEWCAT" }, root: t3.root, now: NOW, exec: () => ({ status: 1 }), R, log: () => {} });
  assert.equal(r3.outputs.live, "");
  assert.match(t3.json(FILES.state).cats.NEWCAT.error, /packer failed/);
});

test("tripo: skipped with a log line without its key; otherwise scripts/tripo.mjs rig for each live model, with the reserve, its verdict recorded", async () => {
  const t = repo();
  t.w(FILES.state, { note: "n", cats: { NEWCAT: { attempts: 1, status: "live", at: "t" }, LATECAT: { attempts: 1, status: "failed", at: "t" } } });
  const calls = [];
  const logs = [];
  await main(["tripo"], { env: { KEYS: "NEWCAT" }, root: t.root, now: NOW, exec: (c, a) => { calls.push(a); return { status: 0 }; }, log: (l) => logs.push(l) });
  assert.deepEqual(calls, []);
  assert.match(logs.join("\n"), /TRIPO_API_KEY is not set: the Tripo rig is skipped/);
  const exec = (c, a) => { calls.push([c, ...a]); t.w(FILES.tripoState, { [a[2]]: { status: "rigged", check: { riggable: false }, rig_task: "tr1", credits: 25 } }); return { status: 0 }; };
  await main(["tripo"], { env: { KEYS: "NEWCAT LATECAT", TRIPO_API_KEY: "fake", MODELS_TRIPO_RESERVE: "300" }, root: t.root, now: NOW, exec, log: (l) => logs.push(l) });
  assert.deepEqual(calls, [["node", "scripts/tripo.mjs", "rig", "NEWCAT", "--rig-type", "quadruped", "--reserve", "300"]], "only the live model");
  assert.deepEqual(t.json(FILES.state).cats.NEWCAT.tripo, { status: "rigged", riggable: false, task: "tr1" });
  assert.match(logs.join("\n"), /not riggable: look at it/);
});

test("preview and summary: a PNG through scripts/render-cat-thumbs.mjs, and the run in the job summary with a reminder to look", async () => {
  const t = repo({ jobs: { NEWCAT: { model: "meshy-7.1 multi-image-to-3d", sizes: { hi: 300_000, lo: 90_000 } } } });
  t.w(FILES.state, { note: "n", cats: { NEWCAT: { attempts: 1, status: "live", at: "t", tasks: ["v1", "m1", "f1"] }, LATECAT: { attempts: 2, status: "gave-up", at: "t", error: "over budget" } } });
  const idx = t.json(FILES.index); idx.cats.NEWCAT = INDEX.cats[SAMPLE]; t.w(FILES.index, idx);
  const calls = [];
  const logs = [];
  await main(["preview"], { env: { KEYS: "NEWCAT LATECAT" }, root: t.root, now: NOW, exec: (c, a) => { calls.push([c, ...a]); return { status: 1 }; }, log: (l) => logs.push(l) });
  assert.deepEqual(calls, [["node", "scripts/render-cat-thumbs.mjs", "scripts/model-previews", "NEWCAT"]]);
  assert.match(logs.join("\n"), /preview could not be rendered[\s\S]*live all the same/);
  t.w("scripts/model-previews/NEWCAT.png", "png");
  const summary = path.join(t.root, "summary.md");
  await main(["summary"], { env: { KEYS: "NEWCAT LATECAT", GITHUB_STEP_SUMMARY: summary, GITHUB_REPOSITORY: "o/r" }, root: t.root, now: NOW, log: () => {} });
  const text = fs.readFileSync(summary, "utf8");
  assert.match(text, /## Models/);
  assert.match(text, /\*\*NEWCAT\*\*: live\. meshy-7\.1 multi-image-to-3d, 293 KB full, 88 KB far; Meshy tasks v1, m1, f1; Tripo skipped · \[preview\]\(https:\/\/github\.com\/o\/r\/blob\/main\/scripts\/model-previews\/NEWCAT\.png\)/);
  assert.match(text, /\*\*LATECAT\*\*: gave-up \(try 2 of 2\): over budget/);
  assert.match(text, /A quick look at each new model is still wise/);
});

/* ── the commit job's merge: only the expected files, checked again; every try recorded ─────────── */

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
/** What the Pack job's artifact holds after it made NEWCAT live (a real pack run with the fake packer, then bundle). */
async function packArtifact({ src = SAMPLE, hd } = {}) {
  const runner = repo({ meshyState: { NEWCAT: { status: "done", tasks: ["v1", "m1", "f1"] } }, jobs: { NEWCAT: { model_job: "m1", url: "https://x/new.glb", status: "done", previous: null } },
    state: { NEWCAT: { attempts: 1, status: "made", at: "t", tasks: ["v1", "m1", "f1"] } } });
  const r = await main(["pack"], { env: { KEYS: "NEWCAT" }, root: runner.root, now: NOW, exec: fakePacker(runner, { src, ...(hd === undefined ? {} : { hd }) }), R, log: () => {} });
  assert.equal(r.outputs.live, "NEWCAT");
  runner.w(`${FILES.previews}/NEWCAT.png`, PNG);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "models-art-"));
  await main(["bundle", dir], { env: { KEYS: "NEWCAT" }, root: runner.root, now: NOW, log: () => {} });
  return dir;
}
const testsOk = (calls = []) => (cmd, args) => { calls.push([cmd, ...args]); assert.deepEqual([cmd, args[0], ...args.slice(1)], ["node", "--test", ...MODEL_TESTS]); return { status: 0 }; };

test("merge: a model the Pack job made live is taken piece by piece, checked and tested again, and nothing else from the artifact is", async () => {
  const dir = await packArtifact();
  // Anything else in the artifact (a changed script, a git hook) is never taken.
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true }); fs.writeFileSync(path.join(dir, "scripts/launch.mjs"), "evil");
  fs.mkdirSync(path.join(dir, ".git/hooks"), { recursive: true }); fs.writeFileSync(path.join(dir, ".git/hooks/pre-push"), "evil");
  const t = repo({ meshyState: {} });
  const summary = path.join(t.root, "summary.md"), calls = [];
  const r = await main(["merge"], { env: { KEYS: "NEWCAT", PACK_DIR: dir, MESHY_DIR: path.join(t.root, "missing"), GITHUB_STEP_SUMMARY: summary }, root: t.root, now: NOW, exec: testsOk(calls), R, log: () => {} });
  assert.equal(r.outputs.live, "NEWCAT");
  assert.equal(calls.length, 1, "the model tests ran in the commit job");
  for (const tag of ["", "-lo"]) assert.ok(fs.readFileSync(path.join(t.root, `assets/models/cats/NEWCAT${tag}.glb`)).equals(fs.readFileSync(path.join(ROOT, `assets/models/cats/${SAMPLE}${tag}.glb`))));
  assert.deepEqual(t.json(FILES.index).cats.NEWCAT, INDEX.cats[SAMPLE]);
  assert.ok(t.json(FILES.index).cats[SAMPLE], "the other rows stay");
  assert.match(t.read(FILES.provenance), /^# Models\n\| NEWCAT \| … \|\n$/);
  assert.equal(t.json(FILES.jobs).NEWCAT.model_job, "m1");
  assert.ok(fs.readFileSync(path.join(t.root, `${FILES.previews}/NEWCAT.png`)).equals(PNG));
  assert.equal(t.json(FILES.state).cats.NEWCAT.status, "live");
  assert.equal(t.json(FILES.meshyState).NEWCAT.status, "done");
  assert.ok(!t.exists("scripts/launch.mjs") && !t.exists(".git/hooks/pre-push"));
  assert.match(fs.readFileSync(summary, "utf8"), /\*\*NEWCAT\*\*: live/);
});

test("merge: a model that fails at the commit (over budget, a bad index row, or the tests) is not taken; the tree stays; the try is recorded failed", async () => {
  const hdKey = Object.keys(INDEX.cats).find((k) => INDEX.cats[k].hd && typeof INDEX.cats[k].file !== "string" && fs.statSync(path.join(ROOT, `assets/models/cats/${k}.glb`)).size > BUDGET.full);
  for (const [name, prepare, exec] of [
    ["over budget (an HD model with a standard row)", async (d) => { const idx = JSON.parse(fs.readFileSync(path.join(d, FILES.index), "utf8")); delete idx.cats.NEWCAT.hd; fs.writeFileSync(path.join(d, FILES.index), JSON.stringify(idx)); for (const tag of ["", "-lo"]) fs.copyFileSync(path.join(ROOT, `assets/models/cats/${hdKey}${tag}.glb`), path.join(d, `assets/models/cats/NEWCAT${tag}.glb`)); }, testsOk()],
    ["a malformed index row", async (d) => { const idx = JSON.parse(fs.readFileSync(path.join(d, FILES.index), "utf8")); idx.cats.NEWCAT.onload = "x"; fs.writeFileSync(path.join(d, FILES.index), JSON.stringify(idx)); }, testsOk()],
    ["the model tests", async () => {}, () => ({ status: 1 })],
  ]) {
    const dir = await packArtifact();
    await prepare(dir);
    const t = repo();
    const before = [FILES.index, FILES.provenance, FILES.jobs].map(t.read);
    const r = await main(["merge"], { env: { KEYS: "NEWCAT", PACK_DIR: dir }, root: t.root, now: NOW, exec, R, log: () => {} });
    assert.equal(r.outputs.live, "", name);
    assert.deepEqual([FILES.index, FILES.provenance, FILES.jobs].map(t.read), before, name);
    assert.ok(!t.exists("assets/models/cats/NEWCAT.glb") && !t.exists(`${FILES.previews}/NEWCAT.png`), name);
    assert.deepEqual([t.json(FILES.state).cats.NEWCAT.status, t.json(FILES.state).cats.NEWCAT.attempts], ["failed", 1], name);
    assert.match(t.json(FILES.state).cats.NEWCAT.error, /at the commit/, name);
    assert.equal(t.json(FILES.meshyState).NEWCAT.status, "failed", `${name}: tried again`);
  }
});

test("merge: a try whose Pack (or Meshy) job failed, timed out or was cancelled is recorded failed, Meshy's state too (never left done), and the summary says so", async () => {
  // Meshy made it (its artifact: state "made", Meshy "done", a new job entry); no Pack artifact.
  const runner = repo({ state: {} });
  const ms = { NEWCAT: { status: "done", tasks: ["v1", "m1", "f1"], credits: 41 } };
  runner.w(FILES.meshyState, ms);
  runner.w(FILES.state, { note: "n", cats: { NEWCAT: { attempts: 1, status: "made", at: "t", tasks: ["v1", "m1", "f1"] }, LATECAT: { attempts: 2, status: "started", at: "t" } } });
  runner.w(FILES.jobs, { NEWCAT: { model_job: "m1", url: "https://x/unchecked.glb", status: "done", previous: null } });
  const meshyDir = fs.mkdtempSync(path.join(os.tmpdir(), "models-art-"));
  await main(["bundle", meshyDir], { env: { KEYS: "NEWCAT LATECAT" }, root: runner.root, now: NOW, log: () => {} });
  const t = repo();
  const jobsBefore = t.read(FILES.jobs);
  const summary = path.join(t.root, "summary.md");
  const r = await main(["merge"], { env: { KEYS: "NEWCAT LATECAT", MESHY_DIR: meshyDir, PACK_DIR: path.join(t.root, "none"), GITHUB_STEP_SUMMARY: summary }, root: t.root, now: NOW, exec: () => assert.fail("no test run"), R, log: () => {} });
  assert.equal(r.outputs.live, "");
  const st = t.json(FILES.state).cats;
  assert.deepEqual([st.NEWCAT.status, st.NEWCAT.attempts], ["failed", 1]);
  assert.match(st.NEWCAT.error, /packing did not finish/);
  assert.deepEqual([st.LATECAT.status, st.LATECAT.attempts], ["gave-up", 2]);
  assert.match(st.LATECAT.error, /Meshy step did not finish/);
  assert.equal(t.json(FILES.meshyState).NEWCAT.status, "failed", "never committed as done without its model");
  assert.equal(t.read(FILES.jobs), jobsBefore, "the unchecked model's job entry is not committed");
  const text = fs.readFileSync(summary, "utf8");
  assert.match(text, /\*\*Did not finish:\*\*[\s\S]*NEWCAT: Meshy made the model, but packing did not finish/);
  // So the next run chooses NEWCAT again (a try left) and pays Meshy only within the bound.
  assert.equal((await main(["pick"], { env: {}, root: t.root, now: NOW, log: () => {} })).outputs.keys, "NEWCAT");
});

test("merge: the Tripo job's record wins for the rig; bundle and unbundle carry only the expected paths", async () => {
  const dir = await packArtifact();
  const tripoDir = fs.mkdtempSync(path.join(os.tmpdir(), "models-art-"));
  const runner = repo();
  await main(["unbundle", dir], { env: { KEYS: "NEWCAT" }, root: runner.root, now: NOW, log: () => {} });
  assert.ok(runner.exists("assets/models/cats/NEWCAT.glb") && runner.json(FILES.state).cats.NEWCAT.status === "live");
  const st = runner.json(FILES.state); st.cats.NEWCAT.tripo = { status: "rigged", riggable: true, task: "tr1" }; runner.w(FILES.state, st);
  runner.w(FILES.tripoState, { NEWCAT: { status: "rigged", rig_task: "tr1" } });
  await main(["bundle", tripoDir], { env: { KEYS: "NEWCAT" }, root: runner.root, now: NOW, log: () => {} });
  const t = repo();
  await main(["merge"], { env: { KEYS: "NEWCAT", PACK_DIR: dir, TRIPO_DIR: tripoDir }, root: t.root, now: NOW, exec: testsOk(), R, log: () => {} });
  assert.deepEqual(t.json(FILES.state).cats.NEWCAT.tripo, { status: "rigged", riggable: true, task: "tr1" });
  assert.deepEqual(t.json(FILES.tripoState).NEWCAT, { status: "rigged", rig_task: "tr1" });
});

test("the shipped state files read as the steps expect", () => {
  const st = JSON.parse(fs.readFileSync(path.join(ROOT, FILES.state), "utf8"));
  assert.deepEqual(Object.keys(st).sort(), ["cats", "note"]);
  for (const [k, v] of Object.entries(st.cats)) {
    assert.ok(Number.isInteger(v.attempts) && v.attempts >= 1 && v.attempts <= MAX_TRIES, k);
    assert.ok(["started", "made", "live", "failed", "gave-up"].includes(v.status), k);
  }
});
