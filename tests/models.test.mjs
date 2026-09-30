/* The Models workflow (.github/workflows/models.yml), read as text as the other workflows are: pinned
   actions, no permission by default and the least each job needs, fail closed on MODELS_ENABLED and on
   MODELS_GENERATOR, each API key only in the one step of each job that calls its API (Tripo's: the make and
   the rig), no wallet secret, the token only in the push, and the Pages dispatch in a job that runs no code of
   the repository's. Then scripts/models.mjs with fakes: choosing the cats (launched first) and the tool, the
   credit reserves, the retry bookkeeping for either tool, the checks a model must pass, and the steps
   themselves (a model that fails is discarded and recorded). Then scripts/tripo.mjs make on a fake tripo CLI
   (the `run` tripo() takes), and a Tripo-made model through every job. No network, no key. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import {
  main, selectEntries, reserveOf, perRun, backlogOn, generatorOf, startTry, finishTry, cleanRow, bundlePaths, artifactPath, furthestRow, meshyOutcome, tripoOutcome, failTripoMake, byOf, canTry, restoreJob, stateOf, keysOf, launchedCats,
  glbProblems, rigProblems, glbPositions, readGlb, modelProblems, loadRig, MAX_TRIES, DEFAULT_RESERVE, GENERATORS, BUDGET, MODEL_TESTS, FILES, TRIPO_MAKE_MINUTES, MAKE_MARGIN_MS,
} from "../scripts/models.mjs";
import { tripo as tripoCli, TRIPO_TIMEOUT_MS, makeModel, makePlan, modelArgs, modelUrlOf, modelFileOf, checkVerdict, MAKE, MAKE_MODEL_NAME, MAKE_CAT_MS, PROMPT_MAX, TRIPO_REPOSE, TRIPO_STANDING, tripoPrompt, fitLook } from "../scripts/tripo.mjs";
import { REPOSE, STANDING } from "../scripts/meshy.mjs";

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

const JOBS = ["pick", "tripo-make", "meshy", "pack", "tripo", "commit", "pages"];

test("models workflow: separate jobs, fail closed: Pick (read, no installs, no secret), one make job per tool (Tripo's, Meshy's: read), Pack (read, no secret), Tripo rig (read), Commit (write, no third-party code), Pages (actions)", () => {
  assert.deepEqual([...W.matchAll(/^  ([a-z][\w-]*):\n    (?:needs|if|runs-on)/gm)].map((m) => m[1]), JOBS);
  assert.match(job("pick"), /\n    if: \$\{\{ vars\.MODELS_ENABLED == 'on' \}\}\n/);
  for (const name of JOBS.slice(1)) assert.match(job(name), /\n    needs: /, `${name} runs only after the gated job`);
  // One make job runs, the chosen tool's (the pick's `generator`: MODELS_GENERATOR, normalized; none when it is not a tool).
  assert.match(job("tripo-make"), /\n    needs: pick\n    if: \$\{\{ needs\.pick\.outputs\.keys != '' && needs\.pick\.outputs\.generator == 'tripo' \}\}\n/);
  assert.match(job("meshy"), /\n    needs: pick\n    if: \$\{\{ needs\.pick\.outputs\.keys != '' && needs\.pick\.outputs\.generator == 'meshy' \}\}\n/);
  assert.match(job("pick"), /generator: \$\{\{ steps\.pick\.outputs\.generator \}\}/);
  assert.match(stepNamed(/node scripts\/models\.mjs pick/), /MODELS_GENERATOR: \$\{\{ vars\.MODELS_GENERATOR \}\}/);
  // Pack after whichever tool made models, Tripo's rig after Pack: the other make job is always skipped, and a
  // skipped ancestor fails the implicit success(), so each checks its needs' results by hand.
  // (Each also needs the Pick job, for the commit it checks out.)
  assert.match(job("pack"), /\n    needs: \[pick, tripo-make, meshy\]\n    if: \$\{\{ !cancelled\(\) && \(\(needs\.tripo-make\.result == 'success' && needs\.tripo-make\.outputs\.made != ''\) \|\| \(needs\.meshy\.result == 'success' && needs\.meshy\.outputs\.made != ''\)\) \}\}\n/);
  assert.match(job("tripo"), /\n    needs: \[pick, pack\]\n    if: \$\{\{ !cancelled\(\) && needs\.pack\.result == 'success' && needs\.pack\.outputs\.live != '' \}\}\n/);
  for (const s of job("pack").split(/\n      - /).filter((x) => /KEYS:/.test(x) && !/steps\.pack\.outputs\.live/.test(x))) assert.match(s, /KEYS: \$\{\{ needs\.tripo-make\.outputs\.made \|\| needs\.meshy\.outputs\.made \}\}/);
  const perms = Object.fromEntries(JOBS.map((n) => [n, job(n).match(/permissions:\n((?:\s{6}\S.*\n)+)/)[1].trim()]));
  assert.deepEqual(perms, { pick: "contents: read", "tripo-make": "contents: read", meshy: "contents: read", pack: "contents: read", tripo: "contents: read", commit: "contents: write", pages: "actions: write" });
  for (const name of JOBS) assert.match(job(name), /timeout-minutes: \d+/, name);
  // No package is installed where a key or the push token is: Pick, Meshy and Commit install nothing (meshy.mjs and the checks are node built-ins).
  for (const name of ["pick", "meshy", "commit"]) assert.ok(!/\bnpm\b|\bnpx\b|\bpip\b|playwright install|\byarn\b|\bpnpm\b/.test(job(name)), `${name} installs nothing`);
  for (const name of ["pick", "pack"]) assert.ok(!/secrets\./.test(job(name)) && !/github\.token/.test(job(name)), `${name}: no secret, no token`);
  for (const name of ["tripo-make", "meshy", "tripo"]) assert.ok(!/github\.token/.test(job(name)), `${name}: no token`);
  // The Tripo jobs install only from the repository's locked manifests (tools/: every package, the CLI's own
  // dependencies too, at the version and hash package-lock.json names), with install scripts off: the make job the
  // CLI, the rig job the CLI and what `tripo.mjs plain` imports. Both run in the step that holds TRIPO_API_KEY.
  const npmLines = (name) => job(name).split("\n").filter((l) => /\bnpm\b|\bnpx\b|\bpip\b|\byarn\b|\bpnpm\b/.test(l)).map((l) => l.trim());
  const ci = (dir) => `npm ci --ignore-scripts --no-audit --no-fund --prefix tools/${dir}`;
  assert.deepEqual(npmLines("tripo-make"), [ci("tripo-cli")]);
  assert.deepEqual(npmLines("tripo"), [ci("tripo-cli"), ci("tripo-rig")]);
  for (const name of ["tripo-make", "tripo"]) assert.match(job(name), /\n\s+echo "\$GITHUB_WORKSPACE\/tools\/tripo-cli\/node_modules\/\.bin" >> "\$GITHUB_PATH"\n/, name);
  assert.match(job("tripo"), /\n\s+ln -s tools\/tripo-rig\/node_modules node_modules\n/);
  // The Pack job (no secret): every package installed with its install scripts off, at a pinned version.
  const packLines = job("pack").split("\n").filter((l) => /\bnpm i\b/.test(l));
  assert.ok(packLines.length > 0);
  for (const l of packLines) {
    assert.match(l, /--ignore-scripts/, l);
    for (const p of l.trim().split(/\s+/).filter((w) => /^@?[a-z]/.test(w) && !["npm", "i"].includes(w))) assert.match(p, /^@?[\w./-]+@\d+\.\d+\.\d+$/, `${p} is pinned`);
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
  assert.equal([...W.matchAll(/actions\/checkout@/g)].length, 6);
  const checkout = (ref) => new RegExp(`- uses: actions/checkout@\\S+ # v7\\.0\\.1\\n\\s+with:\\n\\s+ref: ${ref}\\n\\s+persist-credentials: false\\n`);
  // The Pick job runs the model tests on main and hands on that commit: the jobs that spend credits (the make jobs,
  // the rig) and the Pack job run the code the tests ran on, whatever reaches main meanwhile; the commit builds on main.
  for (const name of ["pick", "commit"]) assert.match(job(name), checkout("main"), name);
  for (const name of ["tripo-make", "meshy", "pack", "tripo"]) {
    assert.match(job(name), checkout("\\$\\{\\{ needs\\.pick\\.outputs\\.sha \\}\\}"), name);
    assert.match(job(name), /\n    needs: (pick|\[pick, [\w, -]+\])\n/, `${name} needs the Pick job for its commit`);
  }
  assert.match(job("pick"), /\n      sha: \$\{\{ steps\.sha\.outputs\.sha \}\}\n/);
  assert.match(job("pick"), /checkout@[\s\S]*\n      - name: [^\n]+\n        id: sha\n        run: echo "sha=\$\(git rev-parse HEAD\)" >> "\$GITHUB_OUTPUT"\n[\s\S]*\n      - run: node --test tests\/models\.test\.mjs tests\/meshy\.test\.mjs\n/);
  assert.equal([...W.matchAll(/ref: /g)].length, 6, "no other checkout or ref");
});

test("models workflow: the Tripo jobs' packages come from locked manifests (tools/tripo-cli, tools/tripo-rig): every package, the CLI's own dependencies too, at the version and integrity hash package-lock.json names; tripo-cli at 0.5.1", () => {
  const manifests = [["tripo-cli", { "tripo-cli": "0.5.1" }],
    ["tripo-rig", { "@gltf-transform/core": "4.5.1", "@gltf-transform/extensions": "4.5.1", "@gltf-transform/functions": "4.5.1", meshoptimizer: "1.3.0" }]];
  for (const [dir, deps] of manifests) {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, `tools/${dir}/package.json`), "utf8"));
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, `tools/${dir}/package-lock.json`), "utf8"));
    assert.equal(pkg.private, true, dir);
    assert.deepEqual(pkg.dependencies, deps, `${dir}: exact versions only`);
    for (const f of ["scripts", "devDependencies", "optionalDependencies", "peerDependencies", "workspaces", "overrides"]) assert.ok(!(f in pkg), `${dir}: no ${f}`);
    assert.equal(lock.lockfileVersion, 3, dir);
    assert.deepEqual(lock.packages[""].dependencies, deps, `${dir}: the lock is the manifest's (npm ci refuses one that is not)`);
    const entries = Object.entries(lock.packages).filter(([k]) => k !== "");
    assert.ok(entries.length > Object.keys(deps).length, `${dir}: the dependencies' own dependencies are locked too`);
    for (const [k, v] of entries) {
      assert.match(k, /^node_modules\/(@[\w.-]+\/)?[\w.-]+(\/node_modules\/(@[\w.-]+\/)?[\w.-]+)*$/, `${dir}: ${k}`);
      assert.match(v.version, /^\d+\.\d+\.\d+$/, `${dir}: ${k} at one version`);
      assert.match(v.resolved, /^https:\/\/registry\.npmjs\.org\//, `${dir}: ${k} from the registry`);
      assert.match(v.integrity, /^sha512-[A-Za-z0-9+/]{80,}={0,2}$/, `${dir}: ${k} carries its hash`);
      assert.ok(!v.link, `${dir}: ${k} is no link`);
    }
    for (const [name, version] of Object.entries(deps)) assert.equal(lock.packages[`node_modules/${name}`].version, version, `${dir}: ${name}`);
  }
  // tripo-cli 0.5.1 asks for its dependencies by ranges and ships no shrinkwrap: each is locked here.
  const cli = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/tripo-cli/package-lock.json"), "utf8")).packages;
  assert.deepEqual(Object.keys(cli["node_modules/tripo-cli"].dependencies).sort(), ["@clack/prompts", "commander", "picocolors", "undici", "yaml"]);
  for (const d of Object.keys(cli["node_modules/tripo-cli"].dependencies)) assert.ok(cli[`node_modules/${d}`]?.integrity, d);
  assert.match(cli["node_modules/tripo-cli"].bin.tripo, /\.js$/, "the CLI's bin, which the jobs put on PATH");
  // No node_modules of theirs is ever committed.
  assert.match(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8"), /^node_modules\/$/m);
});

test("models workflow: MESHY_API_KEY only in the Meshy step of the Meshy job; TRIPO_API_KEY only in the make step of the Tripo make job and the rig step of the Tripo job; no wallet secret; no expression in a script", () => {
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["MESHY_API_KEY", "TRIPO_API_KEY"]);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 3);
  const meshy = stepNamed(/node scripts\/models\.mjs meshy(?![\w-])/), make = stepNamed(/node scripts\/models\.mjs tripo-make(?![\w-])/), rig = stepNamed(/node scripts\/models\.mjs tripo(?![\w-])/);
  assert.deepEqual([...meshy.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["MESHY_API_KEY"]);
  assert.deepEqual([...make.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["TRIPO_API_KEY"]);
  assert.deepEqual([...rig.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["TRIPO_API_KEY"]);
  assert.ok(job("meshy").includes(meshy) && job("tripo-make").includes(make) && job("tripo").includes(rig));
  // Each key reaches no other step or job, and the make job holds only its own tool's key.
  assert.equal(W.replace(/^#.*$/gm, "").split("MESHY_API_KEY").length - 1, 2, "MESHY_API_KEY: the env name and the secret, in one step");
  assert.equal(W.replace(/^#.*$/gm, "").split("TRIPO_API_KEY").length - 1, 4, "TRIPO_API_KEY: the env name and the secret, in two steps");
  assert.ok(!/MESHY_API_KEY/.test(job("tripo-make")) && !/TRIPO_API_KEY/.test(job("meshy")), "a make job holds only its own tool's key");
  for (const bad of ["LAUNCH_WALLET_KEY", "SOLANA_RPC_URL", "WALLET", "X_API", "ANTHROPIC", "GITHUB_TOKEN"]) assert.ok(!W.replace(/^#.*$/gm, "").includes(bad), bad);
  assert.ok(!/^ {0,4}env:/m.test(W));
  assert.match(meshy, /MODELS_MESHY_RESERVE: \$\{\{ vars\.MODELS_MESHY_RESERVE \}\}/);
  assert.match(make, /MODELS_TRIPO_MAKE_RESERVE: \$\{\{ vars\.MODELS_TRIPO_MAKE_RESERVE \}\}/);
  assert.match(rig, /MODELS_TRIPO_RESERVE: \$\{\{ vars\.MODELS_TRIPO_RESERVE \}\}/);
  // The API steps are bounded in time.
  for (const s of [meshy, make, rig, stepNamed(/node scripts\/models\.mjs pack/)]) assert.match(s, /timeout-minutes: \d+/);
  for (const s of steps) {
    const script = s.includes("run: |") ? s.split("run: |")[1].split("\n").slice(1).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith("          ") || !x.trim())).join("\n") : (s.match(/run: .*/)?.[0] ?? "");
    assert.ok(!script.includes("${{"), `no expression inside a script: ${s.slice(0, 60)}`);
  }
});

test("models workflow: the state always reaches the commit (every bundle, upload and the commit run always; a job that never took the state before it uploads none; a missing artifact never stops the merge), and the push has git hooks off and one rebase retry", () => {
  // The make jobs bundle and upload always (their state is their own: the try counted before the tool ran).
  for (const name of ["tripo-make", "meshy"]) {
    const j = job(name);
    assert.match(j, /node scripts\/models\.mjs bundle "\$RUNNER_TEMP\/out"/, name);
    const parts = j.split(/\n      - /).filter((x) => /models\.mjs bundle|upload-artifact/.test(x));
    assert.equal(parts.length, 2, name);
    for (const s of parts) assert.match(s, /\n\s+if: \$\{\{ always\(\) \}\}\n/, `${name}: ${s.slice(0, 40)}`);
  }
  // Pack and the rig carry on the state of the job before them: when that never arrived (its download failed), the
  // checkout's own, older, state is not theirs to upload (it would hide the make job's try at the commit).
  for (const [name, take] of [["pack", "Take the state"], ["tripo", "Take the models"]]) {
    const j = job(name);
    assert.match(j, new RegExp(`\\n      - name: ${take}\\n        id: take\\n[\\s\\S]*?run: node scripts/models\\.mjs unbundle "\\$RUNNER_TEMP/in"\\n`), name);
    const parts = j.split(/\n      - /).filter((x) => /models\.mjs bundle|upload-artifact/.test(x));
    assert.equal(parts.length, 2, name);
    for (const s of parts) assert.match(s, /\n\s+if: \$\{\{ always\(\) && steps\.take\.outcome == 'success' \}\}\n/, `${name}: ${s.slice(0, 40)}`);
  }
  // Whichever tool made the models, its artifact has one name: Pack and the commit take it.
  for (const name of ["tripo-make", "meshy"]) assert.match(job(name), /upload-artifact@\S+ # v7\.0\.1\n\s+if: \$\{\{ always\(\) \}\}\n\s+with:\n\s+name: models-made\n/, name);
  assert.match(job("pack"), /download-artifact@\S+ # v8\.0\.1\n\s+with:\n\s+name: models-made\n/);
  assert.match(job("commit"), /name: models-made\n\s+path: \$\{\{ runner\.temp \}\}\/made\n/);
  // Pack's and the rig's artifacts are often missing (a job skipped): each download in the commit job goes on
  // without it, else the merge would be skipped and every try of the run dropped.
  const downloads = [...job("commit").matchAll(/download-artifact@\S+ # v8\.0\.1\n\s+continue-on-error: true\n\s+with:\n\s+name: models-(made|pack|tripo)\n/g)].map((m) => m[1]);
  assert.deepEqual(downloads, ["made", "pack", "tripo"]);
  assert.equal([...job("commit").matchAll(/download-artifact@/g)].length, 3);
  assert.match(job("commit"), /needs: \[pick, tripo-make, meshy, pack, tripo\]\n\s+if: \$\{\{ always\(\) && needs\.pick\.outputs\.keys != '' \}\}/);
  assert.match(job("commit"), /KEYS: \$\{\{ needs\.pick\.outputs\.keys \}\}\n\s+run: MAKE_DIR="\$RUNNER_TEMP\/made" PACK_DIR="\$RUNNER_TEMP\/pack" TRIPO_DIR="\$RUNNER_TEMP\/tripo" node scripts\/models\.mjs merge/);
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

test("the generator: MODELS_GENERATOR tripo by default, meshy when asked, nothing for any other value", () => {
  assert.deepEqual(GENERATORS, ["tripo", "meshy"]);
  assert.deepEqual(generatorOf({}), { value: "tripo", note: null });
  assert.deepEqual(generatorOf({ MODELS_GENERATOR: "  " }), { value: "tripo", note: null });
  assert.deepEqual(generatorOf({ MODELS_GENERATOR: " Meshy " }), { value: "meshy", note: null });
  assert.deepEqual(generatorOf({ MODELS_GENERATOR: "TRIPO" }), { value: "tripo", note: null });
  const bad = generatorOf({ MODELS_GENERATOR: "hunyuan" });
  assert.equal(bad.value, null);
  assert.match(bad.note, /MODELS_GENERATOR "hunyuan" is neither "tripo" nor "meshy": no model is made/);
});

test("the credit reserves: the scripts' own defaults, from the repository variables, clamped; one or two cats a run", () => {
  // The defaults are the ones scripts/meshy.mjs run, scripts/tripo.mjs rig and scripts/tripo.mjs make use.
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/meshy.mjs"), "utf8"), new RegExp(`flag\\("--reserve", ${DEFAULT_RESERVE.meshy}\\)`));
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/tripo.mjs"), "utf8"), new RegExp(`flag\\("--reserve", ${DEFAULT_RESERVE.tripo}\\)`));
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/tripo.mjs"), "utf8"), new RegExp(`if \\(cmd === "make"\\) \\{\\n\\s+const reserve = Number\\(flag\\("--reserve", ${DEFAULT_RESERVE.tripoMake}\\)\\)`));
  assert.equal(DEFAULT_RESERVE.tripoMake, 0, "Tripo's make spends what is there (Tripo itself refuses an empty balance)");
  assert.deepEqual(reserveOf({}, "MODELS_TRIPO_MAKE_RESERVE", DEFAULT_RESERVE.tripoMake), { value: 0, note: null });
  assert.deepEqual(reserveOf({ MODELS_TRIPO_MAKE_RESERVE: "40" }, "MODELS_TRIPO_MAKE_RESERVE", DEFAULT_RESERVE.tripoMake), { value: 40, note: null });
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
  assert.deepEqual(cleanRow({ attempts: 1, status: "made", at: "t", by: "tripo" }), { attempts: 1, status: "made", at: "t", by: "tripo" });
  assert.deepEqual(cleanRow({ attempts: 1, status: "made", at: "t", by: "rm -rf" }), { attempts: 1, status: "made", at: "t" }, "an unknown tool is dropped");
  for (const bad of [null, [], { attempts: 0, status: "live" }, { attempts: 1, status: "hacked" }, { attempts: "1", status: "live" }]) assert.equal(cleanRow(bad), null, JSON.stringify(bad));
  // What goes between the jobs: the state files and each model's pieces (with the raw GLB Tripo made and its stamp
  // in the packer's git-ignored cache), never anything else.
  assert.deepEqual(bundlePaths(["NEWCAT", "../x"]), [FILES.meshyState, FILES.state, FILES.tripoState, FILES.jobs, FILES.index, FILES.provenance,
    "assets/models/cats/NEWCAT.glb", "assets/models/cats/NEWCAT-lo.glb", "scripts/model-previews/NEWCAT.png",
    "scripts/.cat-models-cache/NEWCAT.raw.glb", "scripts/.cat-models-cache/NEWCAT.raw.job"]);
  assert.match(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8"), /^scripts\/\.cat-models-cache\/$/m, "the cache is never committed");
  // In the artifact, the packer's cache (a hidden folder, which upload-artifact leaves out) goes under raw/: no
  // bundled file is at a hidden path, so every one of them reaches the next job.
  assert.deepEqual(bundlePaths(["NEWCAT"]).map(artifactPath).slice(-2), ["raw/NEWCAT.raw.glb", "raw/NEWCAT.raw.job"]);
  assert.deepEqual(bundlePaths(["NEWCAT"]).map(artifactPath).slice(0, -2), bundlePaths(["NEWCAT"]).slice(0, -2), "the rest at their own paths");
  for (const rel of bundlePaths(["NEWCAT", "fam-cat"])) assert.ok(!artifactPath(rel).split("/").some((seg) => seg.startsWith(".")), rel);
  assert.ok(!/include-hidden-files/.test(W), "the uploads keep upload-artifact's default (hidden files left out), which the tests' uploadLike copies");
});

test("bookkeeping by tool: the row says which tool made the model (Meshy's when it does not say), Tripo's make record read as Meshy's state is, and marked failed when its model does not go live", () => {
  const st = stateOf(null);
  assert.deepEqual(startTry(st, "T", { at: "t0", by: "tripo" }).row, { attempts: 1, status: "started", at: "t0", by: "tripo" });
  assert.deepEqual(finishTry(st, "T", { made: true, at: "t1", tasks: ["r", "m"] }), { attempts: 1, status: "made", at: "t1", by: "tripo", tasks: ["r", "m"] });
  assert.equal(finishTry(st, "T", { ok: false, error: "x", at: "t2" }).by, "tripo", "kept on the outcome");
  assert.deepEqual([byOf(st.cats.T), byOf({ attempts: 1, status: "live" }), byOf(null), byOf({ by: "other" })], ["tripo", "meshy", "meshy", "meshy"]);
  // A cat that is live, gave up or used its tries is not tried again in the make job.
  assert.deepEqual(["live", "gave-up", "failed"].map((status) => canTry({ cats: { A: { attempts: 1, status } } }, "A")), [false, false, true]);
  assert.equal(canTry({ cats: { A: { attempts: MAX_TRIES, status: "failed" } } }, "A"), false);
  assert.equal(canTry({ cats: {} }, "A"), true);
  // Tripo's make record: unchanged (the reserve, or it never got to spend) is no try; done is made; failed, or left halfway (its tasks may have cost credits), is a try.
  assert.deepEqual(tripoOutcome(null, null), { outcome: "stopped" });
  assert.deepEqual(tripoOutcome({ status: "done", at: "a" }, { status: "done", at: "a" }), { outcome: "stopped" });
  assert.deepEqual(tripoOutcome(null, { status: "done", tasks: ["r1", "m1"], credits: 40 }), { outcome: "made", tasks: ["r1", "m1"], credits: 40 });
  assert.deepEqual(tripoOutcome(null, { status: "failed", error: "task m1 failed" }), { outcome: "failed", error: "task m1 failed" });
  assert.deepEqual(tripoOutcome(null, { status: "started", tasks: ["r1"] }), { outcome: "failed", error: "it stopped before the model was made (started)" });
  // Marked failed, the rig's record beside it kept; nothing to mark without a make record.
  assert.deepEqual(failTripoMake({ A: { status: "rigged", make: { status: "done", model_task: "m1" } } }, "A", "no", "t"), { A: { status: "rigged", make: { status: "failed", model_task: "m1", error: "no", at: "t" } } });
  assert.deepEqual(failTripoMake({ A: { status: "rigged" } }, "A", "no", "t"), { A: { status: "rigged" } });
});

test("time bounds: a Tripo CLI call is killed after TRIPO_TIMEOUT_MS, every Meshy request carries an abort signal, and a missed poll is asked again", () => {
  let opts;
  tripoCli(["balance"], { run: (cmd, args, o) => { opts = o; return '{"balance": 5}'; } });
  assert.equal(opts.timeout, TRIPO_TIMEOUT_MS);
  assert.ok(TRIPO_TIMEOUT_MS > 0 && TRIPO_TIMEOUT_MS <= 60 * 60_000);
  assert.equal(opts.killSignal, "SIGKILL");
  // One cat's Tripo make is bounded (five CLI calls, each killed at its bound), and the make step starts a cat only
  // while its make still fits before the step's limit, so the step never times out holding a model made and paid for.
  assert.equal(MAKE_CAT_MS, 3 * MAKE.callSeconds * 1000 + 2 * TRIPO_TIMEOUT_MS);
  assert.ok(MAKE.watchSeconds * 1000 < TRIPO_TIMEOUT_MS, "the CLI's own wait ends before tripo() kills it");
  assert.ok(MAKE_CAT_MS + MAKE_MARGIN_MS <= TRIPO_MAKE_MINUTES * 60_000, "one cat always fits in the step");
  assert.match(stepNamed(/node scripts\/models\.mjs tripo-make(?![\w-])/), new RegExp(`\\n\\s+timeout-minutes: ${TRIPO_MAKE_MINUTES}\\n`), "the step's limit is the one models.mjs plans with");
  assert.ok(Number(job("tripo-make").match(/\n    timeout-minutes: (\d+)\n/)[1]) >= TRIPO_MAKE_MINUTES + 15, "the job outlasts its make step (setup, then the bundle and upload)");
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

test("pick: the step's outputs are the keys to make and the tool; nothing when no launched cat waits (the backlog is off) or the tool is not one", async () => {
  const t = repo();
  const logs = [];
  const r = await main(["pick"], { env: { MODELS_PER_RUN: "2" }, root: t.root, now: NOW, log: (l) => logs.push(l) });
  assert.deepEqual(r, { code: 0, outputs: { keys: "NEWCAT LATECAT", generator: "tripo" } });
  assert.match(logs.join("\n"), /this run makes NEWCAT \(launched\), LATECAT \(launched\) with Tripo\./);
  assert.deepEqual((await main(["pick"], { env: { MODELS_GENERATOR: "meshy" }, root: t.root, now: NOW, log: () => {} })).outputs, { keys: "NEWCAT", generator: "meshy" });
  const badLogs = [];
  assert.deepEqual((await main(["pick"], { env: { MODELS_GENERATOR: "both" }, root: t.root, now: NOW, log: (l) => badLogs.push(l) })).outputs, { keys: "", generator: "" }, "fail closed");
  assert.match(badLogs.join("\n"), /::warning title=Models::MODELS_GENERATOR "both" is neither "tripo" nor "meshy": no model is made\./);
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
  assert.deepEqual(t.json(FILES.state).cats.LATECAT, { attempts: 1, status: "failed", at: "2026-09-28T06:00:00Z", by: "meshy", error: "Meshy: multi-image-to-3d FAILED" });
  assert.deepEqual(t.json(FILES.state).cats.NEWCAT, { attempts: 1, status: "made", at: "2026-09-28T06:00:00Z", by: "meshy", tasks: ["v1", "m1", "f1"] });
  // Nothing new in Meshy's state (its balance at the reserve): no try used, and the run stops there; the reserve's default is the script's.
  const t2 = repo(), asked = [];
  r = await main(["meshy"], { env: { KEYS: "NEWCAT LATECAT", MESHY_API_KEY: "fake" }, root: t2.root, now: NOW, exec: (cmd, args) => { asked.push(args); return { status: 0 }; }, log: () => {} });
  assert.deepEqual([r.outputs.made, asked.length, asked[0].at(-1)], ["", 1, String(DEFAULT_RESERVE.meshy)]);
  assert.deepEqual(t2.json(FILES.state).cats, {});
});

test("tripo-make: no key, nothing called; each cat through scripts/tripo.mjs make with the reserve (0 by default), the try on disk first; made, failed or left halfway is a try; the reserve stops the run and uses none", async () => {
  const queue = { cats: { ...QUEUE.cats, FAMCAT: { action: "rebuild", priority: 1, modelKey: "fam-cat", referencePrompt: "A famous cat.", styleImage: "https://pbs.twimg.com/media/f.jpg", order: 93 } } };
  const t = repo({ queue, adoptables: { cats: [...ADOPT.cats, launchedRow("FAMCAT", "2100000000000000004")] } });
  const calls = [];
  const fakeTripo = (result) => (cmd, args) => {
    calls.push([cmd, ...args]);
    const key = args[2], m = queue.cats[key].modelKey ?? key;
    // The try is on disk, and says it is Tripo's, before Tripo is called (a run killed here still counts it).
    assert.deepEqual(t.json(FILES.state).cats[key], { attempts: 1, status: "started", at: "2026-09-28T06:00:00Z", by: "tripo" });
    const s = t.exists(FILES.tripoState) ? t.json(FILES.tripoState) : {};
    if (result[key] === "done") s[m] = { ...(s[m] ?? {}), make: { status: "done", tasks: ["r1", "m1"], credits: 40, at: "x" } };
    if (result[key] === "failed") s[m] = { make: { status: "failed", tasks: ["r2"], error: "task r2 failed: content policy", at: "y" } };
    if (result[key] === "halfway") s[m] = { make: { status: "started", tasks: ["r3"], at: "z" } };
    t.w(FILES.tripoState, s);
    return { status: 0 };
  };
  const logs = [];
  let r = await main(["tripo-make"], { env: { KEYS: "NEWCAT", MESHY_API_KEY: "not this one" }, root: t.root, now: NOW, exec: fakeTripo({}), log: (l) => logs.push(l) });
  assert.deepEqual([r.outputs.made, calls.length], ["", 0]);
  assert.match(logs.join("\n"), /TRIPO_API_KEY is not set: no model is made/);
  r = await main(["tripo-make"], { env: { KEYS: "FAMCAT NEWCAT LATECAT", TRIPO_API_KEY: "fake", MODELS_TRIPO_MAKE_RESERVE: "20" }, root: t.root, now: NOW, exec: fakeTripo({ FAMCAT: "done", NEWCAT: "failed", LATECAT: "halfway" }), log: (l) => logs.push(l) });
  assert.equal(r.outputs.made, "FAMCAT");
  assert.deepEqual(calls, ["FAMCAT", "NEWCAT", "LATECAT"].map((k) => ["node", "scripts/tripo.mjs", "make", k, "--reserve", "20"]));
  const st = t.json(FILES.state).cats;
  assert.deepEqual(st.FAMCAT, { attempts: 1, status: "made", at: "2026-09-28T06:00:00Z", by: "tripo", tasks: ["r1", "m1"] }, "read under its model key");
  assert.deepEqual(st.NEWCAT, { attempts: 1, status: "failed", at: "2026-09-28T06:00:00Z", by: "tripo", error: "Tripo: task r2 failed: content policy" });
  assert.deepEqual(st.LATECAT, { attempts: 1, status: "failed", at: "2026-09-28T06:00:00Z", by: "tripo", error: "Tripo: it stopped before the model was made (started)" });
  assert.match(logs.join("\n"), /FAMCAT: Tripo made its model \(40 credits\)/);
  assert.ok(!logs.join("\n").includes("fake"), "the key is never printed");
  // Nothing new in Tripo's record (its balance under the reserve): no try used, and the run stops there; the reserve's default is the script's (0).
  const t2 = repo(), asked = [];
  t2.w(FILES.tripoState, { NEWCAT: { make: { status: "failed", error: "old", at: "old" } } });
  const logs2 = [];
  r = await main(["tripo-make"], { env: { KEYS: "NEWCAT LATECAT", TRIPO_API_KEY: "fake" }, root: t2.root, now: NOW, exec: (cmd, args) => { asked.push(args); return { status: 0 }; }, log: (l) => logs2.push(l) });
  assert.deepEqual([r.outputs.made, asked.length, asked[0].at(-1)], ["", 1, String(DEFAULT_RESERVE.tripoMake)]);
  assert.deepEqual(t2.json(FILES.state).cats, {});
  assert.match(logs2.join("\n"), /NEWCAT: nothing made \(the Tripo balance is at its reserve of 0 credits, or the run stopped\); no try is used\./);
  // A cat already live, or out of tries, is not tried again (the pick and the make job may be minutes apart).
  const t3 = repo({ state: { NEWCAT: { attempts: 1, status: "live", at: "t" }, LATECAT: { attempts: MAX_TRIES, status: "gave-up", at: "t" } } });
  const none = [];
  r = await main(["tripo-make"], { env: { KEYS: "NEWCAT LATECAT", TRIPO_API_KEY: "fake" }, root: t3.root, now: NOW, exec: (c, a) => { none.push(a); return { status: 0 }; }, log: () => {} });
  assert.deepEqual([r.outputs.made, none.length], ["", 0]);
  // A cat is started only while its make (at most MAKE_CAT_MS) still fits before the step's limit: after a slow first
  // cat the second waits for the next run, no try used, and the step ends in time, so the first one's model (paid for)
  // goes on to Pack instead of dying with a step that timed out.
  const roomMinutes = TRIPO_MAKE_MINUTES - (MAKE_MARGIN_MS + MAKE_CAT_MS) / 60_000;
  for (const [minutes, expect] of [[1, "NEWCAT LATECAT"], [roomMinutes, "NEWCAT LATECAT"], [roomMinutes + 1, "NEWCAT"]]) {
    const t4 = repo();
    let clock = NOW();
    const asked4 = [], logs4 = [];
    const exec4 = (cmd, args) => {
      asked4.push(args[2]);
      clock += minutes * 60_000;
      const s = t4.exists(FILES.tripoState) ? t4.json(FILES.tripoState) : {};
      s[args[2]] = { make: { status: "done", tasks: ["r", "m"], credits: 40, at: "x" } };
      t4.w(FILES.tripoState, s);
      return { status: 0 };
    };
    const r4 = await main(["tripo-make"], { env: { KEYS: "NEWCAT LATECAT", TRIPO_API_KEY: "fake" }, root: t4.root, now: () => clock, exec: exec4, log: (l) => logs4.push(l) });
    assert.equal(r4.outputs.made, expect, `${minutes} minutes`);
    assert.deepEqual(asked4, expect.split(" "), `${minutes} minutes`);
    if (expect === "NEWCAT") {
      assert.ok(!("LATECAT" in t4.json(FILES.state).cats), "no try used");
      assert.match(logs4.join("\n"), new RegExp(`LATECAT waits for the next run: its make can take ${MAKE_CAT_MS / 60_000} minutes, more than this step has left \\(its limit is ${TRIPO_MAKE_MINUTES}\\); no try is used\\.`));
    }
  }
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

test("pack: a model Tripo made is packed as Meshy's is, from the raw GLB its make job handed over (never Tripo's expiring link); discarded, it is Tripo's make record that is marked failed (Meshy's state untouched)", async () => {
  const tripoJob = { image_job: "r1", clean_job: "r1", model_job: "m1", model: MAKE_MODEL_NAME, faces: 12000, url: "https://tripo.example/m.glb", pose: "standing on all fours", status: "done", previous: null };
  const made = { attempts: 1, status: "made", at: "t", by: "tripo", tasks: ["r1", "m1"] };
  const tripoState = { NEWCAT: { make: { status: "done", tasks: ["r1", "m1"], credits: 40, at: "t" } } };
  const handOver = (t, stamp = "m1") => { t.w(`${FILES.cache}/NEWCAT.raw.glb`, fs.readFileSync(path.join(ROOT, `assets/models/cats/${SAMPLE}.glb`))); t.w(`${FILES.cache}/NEWCAT.raw.job`, stamp); };
  const t = repo({ jobs: { NEWCAT: tripoJob }, state: { NEWCAT: made } });
  t.w(FILES.tripoState, tripoState);
  handOver(t);
  const r = await main(["pack"], { env: { KEYS: "NEWCAT" }, root: t.root, now: NOW, exec: fakePacker(t), R, log: () => {} });
  assert.equal(r.outputs.live, "NEWCAT");
  assert.deepEqual(t.json(FILES.state).cats.NEWCAT, { ...made, status: "live", at: "2026-09-28T06:00:00Z" });
  assert.deepEqual(t.json(FILES.tripoState), tripoState, "Tripo's record stays done");
  // The same model failing the model tests: discarded; Tripo's make record failed, Meshy's state as it was.
  const t2 = repo({ jobs: { NEWCAT: tripoJob }, state: { NEWCAT: made }, meshyState: { OTHER: { status: "done" } } });
  t2.w(FILES.tripoState, tripoState);
  handOver(t2);
  await main(["pack"], { env: { KEYS: "NEWCAT" }, root: t2.root, now: NOW, exec: fakePacker(t2, { testsPass: false }), R, log: () => {} });
  assert.deepEqual([t2.json(FILES.state).cats.NEWCAT.status, t2.json(FILES.state).cats.NEWCAT.by], ["failed", "tripo"]);
  assert.equal(t2.json(FILES.tripoState).NEWCAT.make.status, "failed");
  assert.match(t2.json(FILES.tripoState).NEWCAT.make.error, /did not pass the checks: the model tests failed/);
  assert.deepEqual(t2.json(FILES.meshyState), { OTHER: { status: "done" } });
  assert.ok(!("NEWCAT" in t2.json(FILES.jobs)), "the job entry as before Tripo");
  // Chosen again (one try left).
  assert.equal((await main(["pick"], { env: {}, root: t2.root, now: NOW, log: () => {} })).outputs.keys, "NEWCAT");
  // The raw GLB missing (or stamped with another task): the packer is never run (it would fetch Tripo's link, which
  // expires in minutes, or fail on "tripo:task/…"); discarded at once, the try recorded, Tripo's make record failed.
  for (const prepare of [() => {}, (t) => handOver(t, "another-task")]) {
    const t3 = repo({ jobs: { NEWCAT: tripoJob }, state: { NEWCAT: made } });
    t3.w(FILES.tripoState, tripoState);
    prepare(t3);
    const logs = [];
    const r3 = await main(["pack"], { env: { KEYS: "NEWCAT" }, root: t3.root, now: NOW, exec: (c, a) => assert.fail(`no ${c} ${a.join(" ")}`), R, log: (l) => logs.push(l) });
    assert.equal(r3.outputs.live, "");
    assert.deepEqual([t3.json(FILES.state).cats.NEWCAT.status, t3.json(FILES.state).cats.NEWCAT.attempts], ["failed", 1]);
    assert.match(t3.json(FILES.state).cats.NEWCAT.error, /the model Tripo made did not reach the Pack job/);
    assert.equal(t3.json(FILES.tripoState).NEWCAT.make.status, "failed");
    assert.ok(!("NEWCAT" in t3.json(FILES.jobs)), "the job entry as before Tripo");
  }
  // And the packer itself downloads only a web link: "tripo:task/…" stops it before any request.
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/make-cat-models.py"), "utf8"), /stamp\.read_text\(\) != job_id:\n(\s+#[^\n]*\n)*\s+if not str\(url\)\.startswith\("https:\/\/"\):\n\s+sys\.exit\([^\n]+\)\n\s+req = urllib\.request\.Request/);
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
  assert.match(text, /\*\*NEWCAT\*\*: live\. meshy-7\.1 multi-image-to-3d, 293 KB full, 88 KB far; Meshy tasks v1, m1, f1; Tripo rig skipped · \[preview\]\(https:\/\/github\.com\/o\/r\/blob\/main\/scripts\/model-previews\/NEWCAT\.png\)/);
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
/**
 * An artifact folder as the next job gets it: what actions/upload-artifact v7.0.1 uploads with include-hidden-files
 * false (its default, which the workflow keeps): any file or folder whose name starts with "." is left out.
 */
function uploadLike(dir) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "models-up-"));
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const r = path.join(rel, e.name);
      if (e.isDirectory()) { fs.mkdirSync(path.join(out, r), { recursive: true }); walk(r); } else fs.copyFileSync(path.join(dir, r), path.join(out, r));
    }
  };
  walk("");
  return out;
}
/** `t`'s bundle for these keys, as the next job gets it (uploadLike). */
async function artifactOf(t, keys) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "models-art-"));
  await main(["bundle", dir], { env: { KEYS: keys }, root: t.root, now: NOW, log: () => {} });
  return uploadLike(dir);
}

test("merge: a model the Pack job made live is taken piece by piece, checked and tested again, and nothing else from the artifact is", async () => {
  const dir = await packArtifact();
  // Anything else in the artifact (a changed script, a git hook) is never taken.
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true }); fs.writeFileSync(path.join(dir, "scripts/launch.mjs"), "evil");
  fs.mkdirSync(path.join(dir, ".git/hooks"), { recursive: true }); fs.writeFileSync(path.join(dir, ".git/hooks/pre-push"), "evil");
  const t = repo({ meshyState: {} });
  const summary = path.join(t.root, "summary.md"), calls = [];
  const r = await main(["merge"], { env: { KEYS: "NEWCAT", PACK_DIR: dir, MAKE_DIR: path.join(t.root, "missing"), GITHUB_STEP_SUMMARY: summary }, root: t.root, now: NOW, exec: testsOk(calls), R, log: () => {} });
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
  const r = await main(["merge"], { env: { KEYS: "NEWCAT LATECAT", MAKE_DIR: meshyDir, PACK_DIR: path.join(t.root, "none"), GITHUB_STEP_SUMMARY: summary }, root: t.root, now: NOW, exec: () => assert.fail("no test run"), R, log: () => {} });
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

test("merge: a Tripo try whose make or Pack job did not finish is recorded failed, and Tripo's make record with it (Meshy's state untouched); the raw GLB is never taken", async () => {
  const runner = repo({ state: {} });
  runner.w(FILES.state, { note: "n", cats: { NEWCAT: { attempts: 1, status: "made", at: "t", by: "tripo", tasks: ["r1", "m1"] }, LATECAT: { attempts: 1, status: "started", at: "t", by: "tripo" } } });
  runner.w(FILES.tripoState, { NEWCAT: { make: { status: "done", tasks: ["r1", "m1"], credits: 40, at: "t" } }, LATECAT: { make: { status: "started", tasks: ["r2"], credits: 10, at: "t" } } });
  runner.w(FILES.jobs, { NEWCAT: { model_job: "m1", url: "https://tripo.example/m.glb", status: "done", previous: null } });
  runner.w(`${FILES.cache}/NEWCAT.raw.glb`, fs.readFileSync(path.join(ROOT, `assets/models/cats/${SAMPLE}.glb`)));
  runner.w(`${FILES.cache}/NEWCAT.raw.job`, "m1");
  const madeDir = fs.mkdtempSync(path.join(os.tmpdir(), "models-art-"));
  await main(["bundle", madeDir], { env: { KEYS: "NEWCAT LATECAT" }, root: runner.root, now: NOW, log: () => {} });
  const t = repo({ meshyState: { OTHER: { status: "done" } } });
  const jobsBefore = t.read(FILES.jobs), summary = path.join(t.root, "summary.md");
  await main(["merge"], { env: { KEYS: "NEWCAT LATECAT", MAKE_DIR: madeDir, GITHUB_STEP_SUMMARY: summary }, root: t.root, now: NOW, exec: () => assert.fail("no test run"), R, log: () => {} });
  const st = t.json(FILES.state).cats, ts = t.json(FILES.tripoState);
  assert.deepEqual([st.NEWCAT.status, st.NEWCAT.by, st.LATECAT.status, st.LATECAT.by], ["failed", "tripo", "failed", "tripo"]);
  assert.match(st.NEWCAT.error, /^Tripo made the model, but packing did not finish/);
  assert.match(st.LATECAT.error, /^the Tripo step did not finish/);
  assert.deepEqual([ts.NEWCAT.make.status, ts.LATECAT.make.status], ["failed", "failed"], "never left done (or halfway) without its model");
  assert.deepEqual(ts.LATECAT.make.tasks, ["r2"], "its tasks stay on the record");
  assert.deepEqual(t.json(FILES.meshyState), { OTHER: { status: "done" } });
  assert.equal(t.read(FILES.jobs), jobsBefore);
  assert.ok(!t.exists(`${FILES.cache}/NEWCAT.raw.glb`), "the raw GLB goes nowhere near the commit");
  assert.match(fs.readFileSync(summary, "utf8"), /\*\*Did not finish:\*\*[\s\S]*NEWCAT: Tripo made the model, but packing did not finish[\s\S]*LATECAT: the Tripo step did not finish/);
  // Both are chosen again (a try left each).
  assert.equal((await main(["pick"], { env: { MODELS_PER_RUN: "2" }, root: t.root, now: NOW, log: () => {} })).outputs.keys, "NEWCAT LATECAT");
});

test("merge: an artifact bundled from a checkout that never took the state before it (its download failed) never hides a try: per cat, the row furthest on, with its tools' records from the same artifact", async () => {
  // More tries, then further on, then the later job's; a missing row, or one that is not a row, never wins.
  const row = (attempts, status) => ({ attempts, status, at: "t" });
  assert.equal(furthestRow([]), -1);
  assert.equal(furthestRow([null, { attempts: 1, status: "hacked" }, undefined]), -1);
  assert.equal(furthestRow([row(1, "made"), undefined]), 0, "a missing row never replaces one");
  assert.equal(furthestRow([row(2, "made"), row(1, "failed")]), 0, "an older try never replaces a newer one");
  assert.equal(furthestRow([row(1, "started"), row(1, "made")]), 1);
  assert.equal(furthestRow([row(1, "made"), row(1, "started")]), 0);
  assert.equal(furthestRow([row(1, "made"), row(1, "live"), row(1, "live")]), 2, "a tie: the later job's (the rig's record on the live row)");

  // main's tripo.state.json: none, or one with an older record for the cat.
  for (const mainTripo of [null, { NEWCAT: { status: "rigged", rig_task: "old", make: { status: "failed", tasks: ["r0"], credits: 10, error: "old", at: "2026-09-01T00:00:00Z" } } }]) {
    const onMain = () => { const c = repo(); c.w(FILES.state, { note: "n", cats: {} }); if (mainTripo) c.w(FILES.tripoState, mainTripo); return c; };
    // The Tripo make job's artifact (from main's files): NEWCAT made this try (tasks r1 and m1, 40 credits).
    const maker = onMain();
    maker.w(FILES.state, { note: "n", cats: { NEWCAT: { attempts: 1, status: "made", at: "t", by: "tripo", tasks: ["r1", "m1"] } } });
    maker.w(FILES.tripoState, { NEWCAT: { ...mainTripo?.NEWCAT, make: { status: "done", tasks: ["r1", "m1"], credits: 40, at: "2026-09-28T06:02:00Z" } } });
    const madeDir = await artifactOf(maker, "NEWCAT");
    // Pack (or the rig) never took the make job's state: it bundled its fresh checkout's (main's, no row for NEWCAT).
    const staleDir = await artifactOf(onMain(), "NEWCAT");
    for (const dirs of [{ PACK_DIR: staleDir }, { TRIPO_DIR: staleDir }, { PACK_DIR: staleDir, TRIPO_DIR: staleDir }]) {
      const t = onMain();
      const what = `${mainTripo ? "main has a record" : "main has none"}, ${Object.keys(dirs).join(" ")}`;
      const r = await main(["merge"], { env: { KEYS: "NEWCAT", MAKE_DIR: madeDir, ...dirs }, root: t.root, now: NOW, exec: () => assert.fail("no test run"), R, log: () => {} });
      assert.equal(r.outputs.live, "", what);
      const st = t.json(FILES.state).cats.NEWCAT;
      assert.deepEqual([st?.status, st?.attempts, st?.by], ["failed", 1, "tripo"], `${what}: the try is recorded`);
      assert.match(st.error, /^Tripo made the model, but packing did not finish/, what);
      const ts = t.json(FILES.tripoState).NEWCAT;
      assert.deepEqual([ts.make.status, ts.make.tasks, ts.make.credits], ["failed", ["r1", "m1"], 40], `${what}: this try's make record, what it spent, marked failed`);
      if (mainTripo) assert.equal(ts.rig_task, "old", `${what}: the rig's record beside it kept`);
      assert.deepEqual((await main(["pick"], { env: {}, root: t.root, now: NOW, log: () => {} })).outputs.keys, "NEWCAT", `${what}: one try left`);
    }
  }
  // main had a row (an earlier failed try): this run's second try wins over the stale copy, and it gives up.
  const second = repo();
  second.w(FILES.state, { note: "n", cats: { NEWCAT: { attempts: 2, status: "made", at: "t", by: "tripo", tasks: ["r1", "m1"] } } });
  second.w(FILES.tripoState, { NEWCAT: { make: { status: "done", tasks: ["r1", "m1"], credits: 40, at: "t" } } });
  const earlier = { NEWCAT: { attempts: 1, status: "failed", at: "t0", by: "tripo", error: "old" } };
  const staleOld = repo({ state: earlier });
  const t2 = repo({ state: earlier });
  await main(["merge"], { env: { KEYS: "NEWCAT", MAKE_DIR: await artifactOf(second, "NEWCAT"), PACK_DIR: await artifactOf(staleOld, "NEWCAT") }, root: t2.root, now: NOW, exec: () => assert.fail("no test run"), R, log: () => {} });
  assert.deepEqual([t2.json(FILES.state).cats.NEWCAT.status, t2.json(FILES.state).cats.NEWCAT.attempts], ["gave-up", 2]);
  // Meshy's path too: its state for the cat (this try's tasks) is the make artifact's, not the stale Pack copy's.
  const meshyMaker = repo({ meshyState: { NEWCAT: { status: "done", tasks: ["v1", "m1", "f1"], credits: 41 } }, state: { NEWCAT: { attempts: 1, status: "made", at: "t", tasks: ["v1", "m1", "f1"] } } });
  const t3 = repo({ meshyState: { NEWCAT: { status: "failed", error: "old" } } });
  await main(["merge"], { env: { KEYS: "NEWCAT", MAKE_DIR: await artifactOf(meshyMaker, "NEWCAT"), PACK_DIR: await artifactOf(repo({ meshyState: { NEWCAT: { status: "failed", error: "old" } } }), "NEWCAT") }, root: t3.root, now: NOW, exec: () => assert.fail("no test run"), R, log: () => {} });
  assert.deepEqual([t3.json(FILES.state).cats.NEWCAT.status, t3.json(FILES.state).cats.NEWCAT.attempts], ["failed", 1]);
  assert.deepEqual([t3.json(FILES.meshyState).NEWCAT.status, t3.json(FILES.meshyState).NEWCAT.tasks], ["failed", ["v1", "m1", "f1"]]);
  // The rig job never took the Pack job's state: the model Pack made live is still taken, its try still counted.
  const packDir = await packArtifact();
  const t4 = repo();
  const r4 = await main(["merge"], { env: { KEYS: "NEWCAT", PACK_DIR: packDir, TRIPO_DIR: await artifactOf(repo(), "NEWCAT") }, root: t4.root, now: NOW, exec: testsOk(), R, log: () => {} });
  assert.equal(r4.outputs.live, "NEWCAT");
  assert.deepEqual([t4.json(FILES.state).cats.NEWCAT.status, t4.json(FILES.state).cats.NEWCAT.attempts], ["live", 1]);
});

/* ── scripts/tripo.mjs make, on a fake tripo CLI (the `run` tripo() takes): no network, no key ─────────── */

const REF_ID = "0a1b2c3d-1111-2222-3333-444455556666", MODEL_ID = "9f8e7d6c-5555-6666-7777-888899990000";
/**
 * A fake `tripo` CLI as execFileSync runs it: answers each command as tripo-cli 0.5.1 does in --json mode (the final
 * JSON line; progress lines before it; an error line and a non-zero exit as a thrown error with stdout), and downloads
 * a real GLB for the model task. `onPaid(args)` is called at each call that creates a task (it may cost credits).
 */
function fakeCli({ balance = 100, refId = REF_ID, modelId = MODEL_ID, failAt = null, failCode = 4, onPaid = () => {} } = {}) {
  const calls = [];
  const exit = (error, code) => { const e = new Error(`Command failed: tripo (exit ${code})`); e.status = code; e.stdout = `${JSON.stringify({ error, exit_code: code })}\n`; e.stderr = `✗ ${error}\n`; throw e; };
  const run = (cmd, argv, opts) => {
    assert.equal(cmd, "tripo");
    assert.deepEqual(argv.slice(-4), ["--json", "--yes", "--quiet", "--no-open"]);
    assert.ok(opts.timeout > 0 && opts.killSignal === "SIGKILL");
    const a = argv.slice(0, -4);
    calls.push({ args: a, cwd: opts.cwd, timeout: opts.timeout });
    const progress = (id) => `${JSON.stringify({ event: "progress", task_id: id, status: "running", progress: 50 })}\n`;
    if (a[0] === "balance") return `${JSON.stringify({ balance, frozen: 0 })}\n`;
    if (a[0] === "generate") {
      onPaid(a);
      if (failAt === a[1]) exit(failCode === 4 ? "Insufficient credits" : "Input violates the content policy; change the input", failCode);
      return `${JSON.stringify({ task_id: a[1] === "image-to-model" ? modelId : refId, type: a[1], status: "queued" })}\n`;
    }
    if (a[0] === "task" && a[1] === "watch" && a[2] === refId) {
      if (failAt === "reference") exit(`task ${refId} failed (frozen credits have been refunded automatically)`, 6);
      return progress(refId) + `${JSON.stringify({ task_id: refId, type: "generate_image", status: "success", progress: 100, credits_consumed: 10, output: { generated_image_url: "https://tripo.example/ref.png" } })}\n`;
    }
    if (a[0] === "task" && a[1] === "watch" && a[2] === modelId) {
      if (failAt === "model") exit(`task ${modelId} failed: the input violates the content policy (frozen credits have been refunded automatically)`, 6);
      const dir = a[a.indexOf("-o") + 1];
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(ROOT, `assets/models/cats/${SAMPLE}.glb`), path.join(dir, "model.glb"));
      fs.writeFileSync(path.join(dir, "task.json"), "{}\n");
      const files = ["model.glb", "rendered_image.webp", "task.json"].map((f) => path.join(dir, f));
      return progress(modelId) + `${JSON.stringify({ task_id: modelId, type: "image_to_model", status: "success", progress: 100, credits_consumed: 30, output: { model_url: "https://tripo.example/m.glb?Expires=1", rendered_image_url: "https://tripo.example/r.webp" }, output_dir: dir, files, model_file: files[0], preview: null })}\n`;
    }
    throw new Error(`unexpected tripo ${a.join(" ")}`);
  };
  return { run, calls };
}

test("tripo.mjs make: what it asks Tripo for: the picture redrawn standing (image-to-image, or text-to-image without a picture), then image-to-model with tripo-v3.1 always named, textured, 12000 faces; about 40 credits", () => {
  const url = "https://pbs.twimg.com/media/a.jpg";
  const plan = makePlan("NEWCAT", QUEUE.cats.NEWCAT);
  assert.equal(plan.kind, "image-to-image");
  assert.deepEqual(plan.args, ["generate", "image-to-image", url, "--model", "banana2", "--prompt", `${TRIPO_REPOSE} A launched cat with no model. ${TRIPO_STANDING}`, "-p", "aspect_ratio=4:3", "--no-wait", "--name", "NEWCAT-ref"]);
  assert.deepEqual([plan.cost, plan.cut], [40, 0]);
  const words = makePlan("OLDCAT", QUEUE.cats.OLDCAT);
  assert.deepEqual([words.kind, words.cost], ["text-to-image", 35]);
  assert.deepEqual(words.args, ["generate", "text-to-image", `An old cat that has a model. ${TRIPO_STANDING}`, "--model", "seedream_v4", "--no-wait", "--name", "OLDCAT-ref"]);
  // Meshy's pose words, said shorter (Tripo takes at most PROMPT_MAX characters for a picture's prompt).
  assert.equal(PROMPT_MAX, 1024);
  assert.ok(TRIPO_REPOSE.length < REPOSE.length && TRIPO_STANDING.length < STANDING.length);
  for (const w of ["all four legs", "horizontal", "paws flat on the ground", "never upright", "3/4", "head to the right", "light grey background"]) assert.ok(TRIPO_STANDING.includes(w), w);
  // A picture in the repository goes by its full path (the CLI uploads it); anything else is refused before anything is spent.
  const t = repo();
  t.w("assets/portraits/X.webp", "webp");
  assert.equal(makePlan("X", { styleImage: "assets/portraits/X.webp" }, { root: t.root }).args[2], path.join(t.root, "assets/portraits/X.webp"));
  for (const bad of ["assets/portraits/missing.jpg", "../outside.png", "data/adoptables.json", "http://plain.example/a.jpg"]) assert.throws(() => makePlan("X", { styleImage: bad }, { root: t.root }), /neither an https URL nor a PNG, JPEG or WebP file/, bad);
  // The model: v3.1 by name (with face_limit ≤ 20000 and no --model the CLI would pick P1 at 50 credits), textured, no PBR; never meshopt compression or quads.
  const m = modelArgs(REF_ID, "NEWCAT");
  assert.deepEqual(m, ["generate", "image-to-model", REF_ID, "--model", "tripo-v3.1", "-p", "face_limit=12000", "-p", "texture=true", "-p", "pbr=false", "--no-wait", "--name", "NEWCAT-model"]);
  assert.ok(!m.join(" ").match(/compress|quad|P1|p1/));
  assert.deepEqual([MAKE.cost["image-to-image"] + MAKE.cost["image-to-model"], MAKE.faces, MAKE_MODEL_NAME], [40, 12000, "tripo v3.1-20260211 image-to-model"]);
  assert.equal(modelUrlOf({ model_url: "https://a/m.glb" }), "https://a/m.glb");
  assert.equal(modelUrlOf({ pbr_model: { url: "https://a/p.glb" } }), "https://a/p.glb");
  assert.equal(modelUrlOf({ model_url: "javascript:alert(1)" }), null);
});

test("tripo.mjs make: every prompt fits Tripo's 1024 characters: the pose words whole, the queue's look cut at a sentence, clause or word when it must; every queued rebuild in the shipped queue fits", () => {
  // The look, cut to its room: whole when it fits; else after a sentence that keeps most of the room, else a clause or a word.
  assert.equal(fitLook("  A  cat.\n", 10), "A cat.");
  assert.equal(fitLook("One two three. Four five six.", 20), "One two three.");
  assert.equal(fitLook("One two three four five six seven, eight nine ten eleven twelve", 40), "One two three four five six seven.");
  assert.equal(fitLook("Onetwothree fourfivesix seveneightnine", 20), "Onetwothree.");
  assert.equal(fitLook("x".repeat(30), 10), `${"x".repeat(9)}.`);
  for (const n of [2, 5, 17, 100, 333]) for (const t of ["A b. C d, e f; g h i j k l m n o p.", "word ".repeat(200), "Sentence one here. ".repeat(40)]) assert.ok(fitLook(t, n).length <= n, `${n}: ${t.slice(0, 20)}`);
  // A look too long for the room left by the pose words: the prompt is PROMPT_MAX at most, the pose words whole.
  const long = { referencePrompt: `${"A very long description of a very particular cat. ".repeat(30)}The end.` };
  for (const fromPicture of [true, false]) {
    const { prompt, cut } = tripoPrompt(long, { fromPicture });
    assert.ok(prompt.length <= PROMPT_MAX && cut > 0, `${fromPicture}: ${prompt.length}`);
    assert.ok(prompt.endsWith(TRIPO_STANDING) && prompt.startsWith(fromPicture ? `${TRIPO_REPOSE} A very long` : "A very long"));
  }
  // Every queued rebuild in the shipped queue (the backlog included): a prompt Tripo takes, never refused for its length.
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, FILES.queue), "utf8"));
  let n = 0;
  for (const [key, q] of Object.entries(queue.cats)) {
    if (q.action !== "rebuild") continue;
    const plan = makePlan(key, q);
    const prompt = plan.kind === "image-to-image" ? plan.args[plan.args.indexOf("--prompt") + 1] : plan.args[2];
    assert.ok(prompt.length <= PROMPT_MAX, `${key}: ${prompt.length} characters`);
    assert.ok(prompt.endsWith(TRIPO_STANDING) && (plan.kind === "text-to-image" || prompt.startsWith(TRIPO_REPOSE)), `${key}: the pose words whole`);
    const look = String(q.referencePrompt || q.retexturePrompt || "").trim().replace(/\s+/g, " ");
    assert.ok(prompt.includes(look.slice(0, 80)), `${key}: its look is in it`);
    n++;
  }
  assert.ok(n > 100, "the whole queue");
  assert.equal(makePlan("MEDIACAT", queue.cats.MEDIACAT).cut, 0, "the launched cat's words are whole");
});

test("tripo.mjs make: the balance first; under the reserve nothing is spent or recorded; the record on disk before the first paid task; the GLB and its stamp where the packer reads them; the job entry; no key anywhere", () => {
  const t = repo({ jobs: { NEWCAT: { model_job: "old", url: "https://x/old.glb", status: "done" } } });
  const secret = "tsk_fake_secret_do_not_print";
  const saved = process.env.TRIPO_API_KEY;
  process.env.TRIPO_API_KEY = secret;
  try {
    // Under the reserve: only the (free) balance is read.
    let cli = fakeCli({ balance: 45 });
    const logs = [];
    assert.deepEqual(makeModel("NEWCAT", { root: t.root, run: cli.run, reserve: 10, log: (l) => logs.push(l) }), { stopped: true });
    assert.deepEqual(cli.calls.map((c) => c.args), [["balance"]]);
    assert.ok(!t.exists(FILES.tripoState) && !t.exists(`${FILES.cache}/NEWCAT.raw.glb`));
    assert.match(logs.join("\n"), /NEWCAT: stop: balance 45, its model needs about 40, reserve 10/);
    // A balance that cannot pay for the task (reserve 0): stopped too; Tripo would only refuse it halfway.
    cli = fakeCli({ balance: 39 });
    assert.deepEqual(makeModel("NEWCAT", { root: t.root, run: cli.run, reserve: 0, log: () => {} }), { stopped: true });
    // Enough: the reference, then the model from the reference task, each id saved as soon as it is known.
    const seen = [];
    cli = fakeCli({ balance: 40, onPaid: (a) => seen.push([a[1], t.exists(FILES.tripoState) ? structuredClone(t.json(FILES.tripoState).NEWCAT.make) : null]) });
    const r = makeModel("NEWCAT", { root: t.root, run: cli.run, reserve: 0, log: (l) => logs.push(l), now: () => "2026-09-28T06:05:00Z" });
    assert.deepEqual(r, { made: true, credits: 40 });
    assert.deepEqual(seen, [
      ["image-to-image", { status: "started", at: "2026-09-28T06:05:00Z", tasks: [], credits: 0 }],
      ["image-to-model", { status: "started", at: "2026-09-28T06:05:00Z", tasks: [REF_ID], credits: 10, ref_task: REF_ID }],
    ], "on disk before each paid task");
    assert.deepEqual(cli.calls.map((c) => c.args.slice(0, 3)), [["balance"], ["generate", "image-to-image", "https://pbs.twimg.com/media/a.jpg"], ["task", "watch", REF_ID], ["generate", "image-to-model", REF_ID], ["task", "watch", MODEL_ID]]);
    // Each call killed at its bound: a read or a submission soon, a wait at TRIPO_TIMEOUT_MS; one cat's make, MAKE_CAT_MS at most.
    const short = MAKE.callSeconds * 1000;
    assert.deepEqual(cli.calls.map((c) => c.timeout), [short, short, TRIPO_TIMEOUT_MS, short, TRIPO_TIMEOUT_MS]);
    assert.equal(cli.calls.reduce((n, c) => n + c.timeout, 0), MAKE_CAT_MS);
    const watch = cli.calls.at(-1).args, dir = path.join(t.root, "scripts/.cat-models-cache/tripo/NEWCAT-model");
    assert.deepEqual(watch, ["task", "watch", MODEL_ID, "--download", "-o", dir, "--timeout", "1500"]);
    assert.ok(cli.calls.every((c) => c.cwd === path.join(t.root, "scripts/.cat-models-cache/tripo")), "the CLI runs in the git-ignored cache (its .tripo/context.json lands there)");
    assert.ok(cli.calls.every((c) => !c.args.join(" ").includes(secret)) && !logs.join("\n").includes(secret), "the key is in no argument and no log line");
    // Where make-cat-models.py reads it: the raw GLB and its stamp (the model task), so it is never fetched again.
    assert.ok(fs.readFileSync(path.join(t.root, `${FILES.cache}/NEWCAT.raw.glb`)).equals(fs.readFileSync(path.join(ROOT, `assets/models/cats/${SAMPLE}.glb`))));
    assert.equal(t.read(`${FILES.cache}/NEWCAT.raw.job`), MODEL_ID);
    assert.deepEqual(t.json(FILES.jobs).NEWCAT, { image_job: REF_ID, clean_job: REF_ID, model_job: MODEL_ID, model: MAKE_MODEL_NAME, faces: 12000, url: "https://tripo.example/m.glb?Expires=1", pose: "standing on all fours", status: "done",
      previous: { model_job: "old", url: "https://x/old.glb", status: "done" } });
    assert.deepEqual(t.json(FILES.tripoState).NEWCAT.make, { status: "done", at: "2026-09-28T06:05:00Z", tasks: [REF_ID, MODEL_ID], credits: 40, ref_task: REF_ID, model_task: MODEL_ID, file: "NEWCAT.raw.glb" });
  } finally {
    if (saved === undefined) delete process.env.TRIPO_API_KEY; else process.env.TRIPO_API_KEY = saved;
  }
});

test("tripo.mjs make: a failure is recorded with its task ids and what it spent, the model's files and job entry untouched; a reference id the CLI would not take goes by its picture", () => {
  for (const [failAt, tasks, credits, error] of [
    ["image-to-image", [], 0, /content policy/],
    ["reference", [REF_ID], 0, /failed \(frozen credits have been refunded/],
    ["model", [REF_ID, MODEL_ID], 10, /content policy/],
  ]) {
    const t = repo();
    const jobsBefore = t.read(FILES.jobs);
    const r = makeModel("NEWCAT", { root: t.root, run: fakeCli({ failAt, failCode: 5 }).run, log: () => {}, now: () => "t" });
    assert.equal(r.failed, true, failAt);
    const rec = t.json(FILES.tripoState).NEWCAT.make;
    assert.deepEqual([rec.status, rec.tasks, rec.credits], ["failed", tasks, credits], failAt);
    assert.match(rec.error, error, failAt);
    assert.equal(t.read(FILES.jobs), jobsBefore, failAt);
    assert.ok(!t.exists(`${FILES.cache}/NEWCAT.raw.glb`) && !t.exists(`${FILES.cache}/NEWCAT.raw.job`), failAt);
  }
  // Tripo refusing the first task for want of credits (nothing created, nothing spent) is a stop, as the reserve: the record as it was.
  const tc = repo();
  tc.w(FILES.tripoState, { NEWCAT: { status: "rigged", make: { status: "failed", error: "old", at: "old" } } });
  const before = tc.read(FILES.tripoState), stopLogs = [];
  assert.deepEqual(makeModel("NEWCAT", { root: tc.root, run: fakeCli({ failAt: "image-to-image", failCode: 4 }).run, log: (l) => stopLogs.push(l) }), { stopped: true });
  assert.deepEqual(JSON.parse(tc.read(FILES.tripoState)), JSON.parse(before));
  assert.match(stopLogs.join("\n"), /NEWCAT: stop: Tripo refused the task for want of credits \(balance 100\); nothing was spent/);
  // For want of credits once the reference is paid for: a failure (it spent credits).
  const tm = repo();
  assert.equal(makeModel("NEWCAT", { root: tm.root, run: fakeCli({ failAt: "image-to-model", failCode: 4 }).run, log: () => {} }).failed, true);
  assert.deepEqual(tm.json(FILES.tripoState).NEWCAT.make.credits, 10);
  // An id that is neither task_… nor a UUID would be read by the CLI as a prompt: the model is made from the reference's picture instead.
  const t = repo(), cli = fakeCli({ refId: "ref123abc" });
  assert.equal(makeModel("NEWCAT", { root: t.root, run: cli.run, log: () => {} }).made, true);
  assert.equal(cli.calls.find((c) => c.args[1] === "image-to-model").args[2], "https://tripo.example/ref.png");
  // A picture that cannot be used: recorded failed before the CLI is called (so it is a try, and never holds the queue).
  const tp = repo({ queue: { cats: { ...QUEUE.cats, NEWCAT: { ...QUEUE.cats.NEWCAT, styleImage: "assets/portraits/NEWCAT.jpg" } } } });
  assert.equal(makeModel("NEWCAT", { root: tp.root, run: () => assert.fail("no call"), log: () => {} }).failed, true);
  assert.deepEqual(Object.keys(tp.json(FILES.tripoState).NEWCAT.make).sort(), ["at", "credits", "error", "status", "tasks"]);
  assert.match(tp.json(FILES.tripoState).NEWCAT.make.error, /its picture assets\/portraits\/NEWCAT\.jpg is neither/);
  // Not a queued rebuild, or no number for the reserve: refused before the CLI is called.
  assert.throws(() => makeModel("TINT", { root: t.root, run: () => assert.fail("no call") }), /not a queued rebuild/);
  assert.throws(() => makeModel("NEWCAT", { root: t.root, run: () => assert.fail("no call"), reserve: NaN }), /--reserve must be a number/);
  // Only a GLB inside the download folder is taken.
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "tripo-dl-"));
  fs.writeFileSync(path.join(d, "model.glb"), "not a glb");
  assert.throws(() => modelFileOf({ model_file: path.join(d, "model.glb"), files: ["/etc/hostname"] }, d), /no GLB/);
});

test("tripo.mjs rig: the rig check's verdict is read from the task's detail (the step's own result carries no output)", () => {
  assert.deepEqual(checkVerdict({ task_id: "c1", status: "success" }, { task_id: "c1", output: { riggable: false, rig_type: "quadruped" } }), { task: "c1", riggable: false, rig_type: "quadruped" });
  assert.deepEqual(checkVerdict({ task_id: "c1" }, null), { task: "c1", riggable: undefined, rig_type: undefined }, "unknown: the rig runs, as before");
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/tripo.mjs"), "utf8"), /detail = tripo\(\["task", "get", check\.task_id\]\)/);
});

test("a Tripo-made model end to end: tripo-make (scripts/tripo.mjs make on the fake CLI), its artifact, Pack (the raw GLB from the packer's cache), the rig, and the commit: live, Tripo's tasks in the summary, the make and rig records side by side", async () => {
  const maker = repo();
  const cli = fakeCli();
  const exec = (cmd, args) => {
    assert.deepEqual([cmd, ...args.slice(0, 3), ...args.slice(4)], ["node", "scripts/tripo.mjs", "make", "NEWCAT", "0"]);
    makeModel(args[2], { root: maker.root, run: cli.run, reserve: Number(args[4]), log: () => {}, now: () => "2026-09-28T06:02:00Z" });
    return { status: 0 };
  };
  assert.equal((await main(["tripo-make"], { env: { KEYS: "NEWCAT", TRIPO_API_KEY: "fake" }, root: maker.root, now: NOW, exec, log: () => {} })).outputs.made, "NEWCAT");
  // Each artifact goes between the jobs as upload-artifact takes it (hidden files and folders left out).
  const madeDir = await artifactOf(maker, "NEWCAT");
  // Pack: the packer finds the raw GLB in its cache, stamped with the job's model_job (make-cat-models.py's fetch()).
  const packer = repo();
  await main(["unbundle", madeDir], { env: { KEYS: "NEWCAT" }, root: packer.root, now: NOW, log: () => {} });
  const job = packer.json(FILES.jobs).NEWCAT;
  assert.equal(job.model_job, MODEL_ID);
  assert.equal(packer.read(`${FILES.cache}/NEWCAT.raw.job`), job.model_job);
  assert.ok(packer.exists(`${FILES.cache}/NEWCAT.raw.glb`) && !("lo_url" in job), "one raw GLB; the far copy is simplified from it");
  const py = fs.readFileSync(path.join(ROOT, "scripts/make-cat-models.py"), "utf8");
  assert.match(py, /raw = CACHE \/ f"\{ticker\}\{name\}\.raw\.glb"\n\s+stamp = raw\.with_suffix\("\.job"\)\n\s+if not raw\.exists\(\) or not stamp\.exists\(\) or stamp\.read_text\(\) != job_id:/);
  const rp = await main(["pack"], { env: { KEYS: "NEWCAT" }, root: packer.root, now: NOW, exec: fakePacker(packer), R, log: () => {} });
  assert.equal(rp.outputs.live, "NEWCAT");
  const packDir = await artifactOf(packer, "NEWCAT");
  // The rig, on the live model: its record beside the make's.
  const rigger = repo();
  await main(["unbundle", packDir], { env: { KEYS: "NEWCAT" }, root: rigger.root, now: NOW, log: () => {} });
  const rig = (cmd, args) => {
    assert.deepEqual(args.slice(0, 3), ["scripts/tripo.mjs", "rig", "NEWCAT"]);
    const s = rigger.json(FILES.tripoState);
    s.NEWCAT = { ...s.NEWCAT, status: "rigged", check: { task: "c1", riggable: true, rig_type: "quadruped" }, rig_task: "tr1", credits: 25 };
    rigger.w(FILES.tripoState, s);
    return { status: 0 };
  };
  await main(["tripo"], { env: { KEYS: "NEWCAT", TRIPO_API_KEY: "fake" }, root: rigger.root, now: NOW, exec: rig, log: () => {} });
  const tripoDir = await artifactOf(rigger, "NEWCAT");
  // The commit.
  const t = repo(), summary = path.join(t.root, "summary.md");
  const r = await main(["merge"], { env: { KEYS: "NEWCAT", MAKE_DIR: madeDir, PACK_DIR: packDir, TRIPO_DIR: tripoDir, GITHUB_STEP_SUMMARY: summary }, root: t.root, now: NOW, exec: testsOk(), R, log: () => {} });
  assert.equal(r.outputs.live, "NEWCAT");
  assert.deepEqual(t.json(FILES.state).cats.NEWCAT, { attempts: 1, status: "live", at: "2026-09-28T06:00:00Z", by: "tripo", tasks: [REF_ID, MODEL_ID], tripo: { status: "rigged", riggable: true, task: "tr1" } });
  const ts = t.json(FILES.tripoState).NEWCAT;
  assert.deepEqual([ts.make.status, ts.make.model_task, ts.status, ts.rig_task], ["done", MODEL_ID, "rigged", "tr1"]);
  assert.equal(t.json(FILES.jobs).NEWCAT.model, MAKE_MODEL_NAME);
  assert.deepEqual(t.json(FILES.meshyState), {}, "Meshy is not involved");
  assert.ok(!t.exists(`${FILES.cache}/NEWCAT.raw.glb`));
  assert.match(fs.readFileSync(summary, "utf8"), new RegExp(`\\*\\*NEWCAT\\*\\*: live\\. tripo v3\\.1-20260211 image-to-model, \\d+ KB full, \\d+ KB far; Tripo tasks ${REF_ID}, ${MODEL_ID}; Tripo rig rigged, riggable true`));
});

test("the shipped state files read as the steps expect", () => {
  const st = JSON.parse(fs.readFileSync(path.join(ROOT, FILES.state), "utf8"));
  assert.deepEqual(Object.keys(st).sort(), ["cats", "note"]);
  for (const [k, v] of Object.entries(st.cats)) {
    assert.ok(Number.isInteger(v.attempts) && v.attempts >= 1 && v.attempts <= MAX_TRIES, k);
    assert.ok(["started", "made", "live", "failed", "gave-up"].includes(v.status), k);
  }
});
