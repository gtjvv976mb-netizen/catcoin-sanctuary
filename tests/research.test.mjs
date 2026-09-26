import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { researchStatus, timeAgo, ACTIVE_MS } from "../assets/world/research-status.js";
import { approve, reject, candidateProblems, summary, review } from "../scripts/research-status.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const now = Date.parse("2026-09-26T12:00:00Z");

test("research files exist and parse", () => {
  const inbox = JSON.parse(fs.readFileSync(path.join(ROOT, "data/research/inbox.json"), "utf8"));
  const log = JSON.parse(fs.readFileSync(path.join(ROOT, "data/research/log.json"), "utf8"));
  assert.ok(Array.isArray(inbox.candidates));
  assert.ok(Array.isArray(log.runs));
  assert.ok(fs.existsSync(path.join(ROOT, ".claude/commands/scout.md")));
});

test("the house is at work within ~6 hours of a scan, resting after", () => {
  const log = (ago) => ({ runs: [{ startedAt: new Date(now - ago - 60000).toISOString(), finishedAt: new Date(now - ago).toISOString(), searched: 40, found: 3, accepted: 2 }] });
  const on = researchStatus(log(3600e3), null, now);
  assert.equal(on.active, true);
  assert.equal(on.line, "Scanning the net… 3 new leads");
  const off = researchStatus(log(ACTIVE_MS + 60000), null, now);
  assert.equal(off.active, false);
  assert.match(off.line, /^Research team resting — last scan 6 hours ago$/);
  assert.equal(researchStatus(null, null, now).line, "Research team resting — no scan yet");
  assert.equal(timeAgo(3 * 86400e3), "3 days ago");
});

test("cats found this week counts only the last 7 days", () => {
  const runs = [10, 3, 9].map((d, i) => ({ finishedAt: new Date(now - d * 86400e3).toISOString(), found: i + 1 }));
  assert.equal(researchStatus({ runs }, null, now).weekFound, 2);
});

const cand = {
  id: "testcat", catName: "Test Cat", owner: "Example Co", category: "company", story: "Test Cat is the office cat at Example Co, shown on its official account greeting visitors every morning.",
  look: "Short-haired orange tabby with green eyes.", suggestedName: "Test Cat", suggestedTicker: "TESTCATZ", pairSuggestion: "STONK",
  proof: { x: [{ url: "https://x.com/example/status/1928847972642501086", handle: "@example", date: "2026-01-01", text: "Meet our office cat", verifiedVia: "api.fxtwitter.com 2026-09-26" }], web: [{ title: "Example", url: "https://example.com/cat" }] },
  existingCoin: null, sensitivity: "", confidence: "high", status: "pending", foundAt: "2026-09-26T10:00:00Z",
};

function tempRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "research-"));
  fs.mkdirSync(path.join(r, "data/research"), { recursive: true });
  const w = (f, v) => fs.writeFileSync(path.join(r, f), JSON.stringify(v));
  w("data/research/inbox.json", { candidates: [cand, { ...cand, id: "other", suggestedTicker: "OTHERZ" }] });
  w("data/research/log.json", { runs: [] });
  w("data/adoptables.json", { note: "", checked: "2026-01-01", cats: [] });
  w("data/announced.json", { cats: {} });
  w("data/planned.json", { cats: [] });
  return r;
}

test("a candidate needs an X post and a web source, and no big coin", () => {
  assert.deepEqual(candidateProblems(cand), []);
  assert.ok(candidateProblems({ ...cand, proof: { x: [], web: [] } }).length >= 2);
  assert.ok(candidateProblems({ ...cand, existingCoin: { symbol: "T", mcap: 60000 } }).some((p) => /50k/.test(p)));
});

test("approving moves a candidate into the adoptable cats, held from X", async () => {
  const r = tempRoot();
  assert.match(review(r), /Test Cat/);
  const cat = await approve(r, "testcat");
  assert.equal(cat.ticker, "TESTCATZ");
  const read = (f) => JSON.parse(fs.readFileSync(path.join(r, f), "utf8"));
  assert.equal(read("data/adoptables.json").cats[0].id, "testcat");
  assert.equal(read("data/announced.json").cats.TESTCATZ.status, "held");
  assert.equal(read("data/research/adoptables-source.json")[0].id, "testcat");
  assert.equal(read("data/research/inbox.json").candidates[0].status, "approved");
  await assert.rejects(approve(r, "testcat"), /already approved/);
  reject(r, "other", "not verified");
  assert.equal(read("data/research/inbox.json").candidates[1].status, "rejected");
  assert.match(summary(r), /1 approved, 1 rejected/);
});
