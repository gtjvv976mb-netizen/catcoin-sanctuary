#!/usr/bin/env node
/**
 * ARCHIVE THE SOURCE MODELS: downloads every full-detail source GLB listed in
 * scripts/cat-models.jobs.json (each cat's "url", "lo_url" and, with --previous, the same fields of
 * the model it replaced) into a folder, so the originals survive their hosts' links.
 *
 *   node scripts/archive-sources.mjs DIR [--previous] [--only KEY,KEY]
 *
 * Meshy's signed links (assets.meshy.ai) last three days from the task and asking Meshy again
 * does not renew them, so run this soon after a batch. Files already in DIR with the right size
 * are skipped; DIR/index.json maps each file to its cat, field, job id and original link. The
 * site itself only needs the packed copies in assets/models/cats/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JOBS = path.join(ROOT, "scripts/cat-models.jobs.json");

/** The downloads for a jobs file: [{ key, field, job, url, file }], newest model first. */
export function sources(jobs, { previous = false, only = null } = {}) {
  const out = [];
  const add = (key, entry, tag) => {
    for (const [field, jobField] of [["url", "model_job"], ["lo_url", "lo_job"]]) {
      const url = entry?.[field];
      if (!/^https:\/\//.test(url || "")) continue;
      const job = entry[jobField] || "";
      out.push({ key, field, job, url, file: `${key}${tag}${field === "lo_url" ? "-lo" : ""}${job ? `.${job.slice(0, 13)}` : ""}.glb` });
    }
  };
  for (const [key, entry] of Object.entries(jobs)) {
    if (only && !only.includes(key)) continue;
    add(key, entry, "");
    if (previous && entry.previous) add(key, entry.previous, ".previous");
  }
  return out;
}

async function fetchTo(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const want = +r.headers.get("content-length") || buf.length;
  if (buf.length !== want) throw new Error(`short download ${buf.length}/${want}`);
  fs.writeFileSync(`${file}.part`, buf);
  fs.renameSync(`${file}.part`, file);
  return buf.length;
}

async function main(argv) {
  const dir = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--only"));
  if (!dir) throw new Error("usage: node scripts/archive-sources.mjs DIR [--previous] [--only KEY,KEY]");
  const oi = argv.indexOf("--only");
  const list = sources(JSON.parse(fs.readFileSync(JOBS, "utf8")), { previous: argv.includes("--previous"), only: oi >= 0 ? argv[oi + 1].split(",") : null });
  fs.mkdirSync(dir, { recursive: true });
  const indexFile = path.join(dir, "index.json");
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : {};
  let got = 0, skipped = 0, bytes = 0;
  const failed = [];
  const queue = [...list];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const file = path.join(dir, s.file);
      if (fs.existsSync(file) && index[s.file]?.bytes === fs.statSync(file).size) { skipped++; continue; }
      try {
        const n = await fetchTo(s.url, file);
        index[s.file] = { key: s.key, field: s.field, job: s.job, url: s.url, bytes: n, at: new Date().toISOString() };
        got++; bytes += n;
        if (got % 10 === 0) console.log(`  ${got} downloaded (${(bytes / 1e6).toFixed(0)} MB)`);
      } catch (e) { failed.push(`${s.key} ${s.field}: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`${list.length} sources: ${got} downloaded (${(bytes / 1e6).toFixed(0)} MB), ${skipped} already there, ${failed.length} failed`);
  for (const f of failed) console.log(`  failed: ${f}`);
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
