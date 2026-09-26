#!/usr/bin/env node
/**
 * The Research Team's desk on the owner's laptop. /scout (.claude/commands/scout.md) fills
 * data/research/inbox.json with candidate cats and appends a run to data/research/log.json; this
 * script reads them, and lets the owner approve or reject each candidate.
 *
 *   npm run scout:status                       summary of the log and the inbox
 *   npm run scout:review                       list the candidates waiting for review, in full
 *   npm run scout:review -- --approve <id>     approve one: it joins the adoptable cats (held from X)
 *   npm run scout:review -- --reject <id> [--why "reason"]
 *
 * Approving checks the candidate the same way scripts/build-adoptables.mjs does (a verified X post,
 * a sanctuary pair, a free ticker, a valid card), then:
 *   - appends its research row to data/research/adoptables-source.json (the adoptables research
 *     source: `node scripts/build-adoptables.mjs data/research/adoptables-source.json` rebuilds from it),
 *   - adds the cat to data/adoptables.json,
 *   - records it as "held" in data/announced.json (never auto-posted to X),
 *   - marks the candidate "approved" in the inbox.
 * Nothing here touches the network, a wallet or X.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { researchStatus, candidatesOf, runsOf, timeAgo } from "../assets/world/research-status.js";

export class ResearchError extends Error { constructor(m) { super(m); this.name = "ResearchError"; } }
const serialize = (v) => `${JSON.stringify(v, null, 2)}\n`;
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fallback; } };
export const paths = (root) => ({
  inbox: path.join(root, "data/research/inbox.json"),
  log: path.join(root, "data/research/log.json"),
  source: path.join(root, "data/research/adoptables-source.json"),
  adoptables: path.join(root, "data/adoptables.json"),
  announced: path.join(root, "data/announced.json"),
  planned: path.join(root, "data/planned.json"),
});

/** The problems with one inbox candidate (empty when it is complete enough to review). */
export function candidateProblems(c) {
  const p = [];
  if (!c || typeof c !== "object") return ["not an object"];
  if (!/^[a-z0-9-]{2,40}$/.test(String(c.id ?? ""))) p.push("id is missing or odd");
  for (const k of ["catName", "owner", "category", "story", "look", "suggestedTicker"]) if (!String(c[k] ?? "").trim()) p.push(`${k} is missing`);
  const x = c.proof?.x?.[0];
  if (!x || !/^https:\/\/(x|twitter)\.com\//.test(String(x.url ?? "")) || !x.handle || !x.date || !x.text) p.push("no verified X post (url, handle, date, text)");
  if (!Array.isArray(c.proof?.web) || !c.proof.web.some((w) => /^https:\/\//.test(String(w?.url ?? "")))) p.push("no web source");
  if (c.existingCoin && Number(c.existingCoin.mcap) > 50000) p.push("an existing coin is over $50k: skip this cat");
  return p;
}

export function summary(root, now = Date.now()) {
  const P = paths(root);
  const log = readJson(P.log, null), inbox = readJson(P.inbox, null);
  const s = researchStatus(log, inbox, now);
  const cands = candidatesOf(inbox);
  const by = (st) => cands.filter((c) => (c.status ?? "pending") === st).length;
  const lines = [
    `Research Team: ${s.line}`,
    `Runs logged: ${s.runs}${s.lastAt ? ` (last ${new Date(s.lastAt).toISOString()}, ${timeAgo(now - s.lastAt)})` : ""}`,
    `Found this week: ${s.weekFound}`,
    `Inbox: ${cands.length} candidates, ${by("pending")} waiting, ${by("approved")} approved, ${by("rejected")} rejected`,
  ];
  const last = runsOf(log).at(-1);
  if (last?.notes) lines.push(`Last run notes: ${last.notes}`);
  return lines.join("\n");
}

export function review(root) {
  const cands = candidatesOf(readJson(paths(root).inbox, null)).filter((c) => (c.status ?? "pending") === "pending");
  if (!cands.length) return "No candidates waiting. Run /scout in Claude Code to look for more.";
  return cands.map((c) => {
    const x = c.proof?.x?.[0];
    const probs = candidateProblems(c);
    return [
      `● ${c.catName} (${c.id}) — ${c.category}, ${c.owner}`,
      `  Coin: ${c.suggestedName ?? c.catName} $${c.suggestedTicker}, pair ${c.pairSuggestion ?? "STONK"}; look: ${c.look}`,
      `  Story: ${String(c.story ?? "").slice(0, 280)}`,
      x ? `  X: ${x.url} (@${String(x.handle).replace(/^@/, "")}, ${x.date})` : "  X: none",
      ...(c.proof?.web ?? []).slice(0, 3).map((w) => `  Web: ${w.title ?? ""} ${w.url}`),
      c.existingCoin ? `  Existing coin: ${c.existingCoin.symbol} ~$${c.existingCoin.mcap}` : "  Existing coin: none found",
      c.sensitivity ? `  Sensitivity: ${c.sensitivity}` : "",
      `  Confidence: ${c.confidence ?? "?"}${probs.length ? `  ⚠ ${probs.join("; ")}` : ""}`,
      `  → npm run scout:review -- --approve ${c.id}   |   --reject ${c.id}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

/** Approve one candidate: into the adoptables source, data/adoptables.json (held from X), and marked in the inbox. */
export async function approve(root, id, { checked = new Date().toISOString().slice(0, 10) } = {}) {
  const P = paths(root);
  const inbox = readJson(P.inbox, null);
  const c = inbox?.candidates?.find((x) => x?.id === id);
  if (!c) throw new ResearchError(`${id} is not in the inbox`);
  if ((c.status ?? "pending") !== "pending") throw new ResearchError(`${id} is already ${c.status}`);
  const probs = candidateProblems(c);
  if (probs.length) throw new ResearchError(`${id}: ${probs.join("; ")}`);
  if (c.confidence === "low") throw new ResearchError(`${id}: confidence is low; verify more before approving`);

  const { adoptableFrom } = await import("./build-adoptables.mjs");
  const { validateAdoptables } = await import("../assets/ui/adoptables.js");
  const row = { ...c };
  delete row.status; delete row.foundAt; delete row.reviewedAt;
  const cat = adoptableFrom(row, { root });
  const adopt = readJson(P.adoptables, { cats: [] });
  if (adopt.cats.some((x) => x.id === cat.id || x.ticker === cat.ticker)) throw new ResearchError(`${id}: already an adoptable cat (or its ticker is taken)`);
  const planned = readJson(P.planned, { cats: [] });
  const next = { ...adopt, checked, cats: [...adopt.cats, cat] };
  const v = validateAdoptables(next, { taken: new Set(planned.cats.map((x) => x.ticker)) });
  if (v.refused.length) throw new ResearchError(`${id}: would not validate (${v.refused.map((r) => r.detail).join("; ")}); nothing was written`);

  const source = readJson(P.source, []);
  if (!source.some((r) => r.id === row.id)) source.push(row);
  fs.writeFileSync(P.source, serialize(source));
  fs.writeFileSync(P.adoptables, serialize(next));
  const ann = readJson(P.announced, { cats: {} });
  ann.cats ??= {};
  if (!ann.cats[cat.ticker]) { ann.cats[cat.ticker] = { status: "held", reason: "adoptable cat: announcing paused" }; fs.writeFileSync(P.announced, serialize(ann)); }
  c.status = "approved"; c.reviewedAt = new Date().toISOString();
  fs.writeFileSync(P.inbox, serialize(inbox));
  return cat;
}

export function reject(root, id, why = "") {
  const P = paths(root);
  const inbox = readJson(P.inbox, null);
  const c = inbox?.candidates?.find((x) => x?.id === id);
  if (!c) throw new ResearchError(`${id} is not in the inbox`);
  c.status = "rejected"; c.reviewedAt = new Date().toISOString();
  if (why) c.rejectReason = String(why);
  fs.writeFileSync(P.inbox, serialize(inbox));
  return c;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  try {
    if (opt("--approve")) {
      const cat = await approve(root, opt("--approve"));
      console.log(`Approved ${cat.name} ($${cat.ticker}): added to data/adoptables.json and held from X. Portrait: ${cat.portraitStatus}.`);
    } else if (opt("--reject")) {
      reject(root, opt("--reject"), opt("--why"));
      console.log(`Rejected ${opt("--reject")}.`);
    } else if (args.includes("--review")) console.log(review(root));
    else console.log(summary(root));
  } catch (e) {
    if (!(e instanceof ResearchError) && e?.name !== "AdoptablesError") throw e;
    console.error(e.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
