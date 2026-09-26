/* The Research Team's status, read from data/research/log.json (one entry per /scout run on the
   owner's laptop) and data/research/inbox.json (the candidates it found, waiting for the owner).
   Pure functions: used by the house in the 3D world (research.js) and by scripts/research-status.mjs. */

/** A scan within this long counts as "the team is at work". */
export const ACTIVE_MS = 6 * 3600 * 1000;
const WEEK_MS = 7 * 24 * 3600 * 1000;

const time = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? t : null; };

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function timeAgo(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** The runs in a log, oldest first, each with a finish time (bad entries dropped). */
export function runsOf(log) {
  const runs = Array.isArray(log?.runs) ? log.runs : [];
  return runs
    .filter((r) => r && typeof r === "object" && time(r.finishedAt ?? r.startedAt) !== null)
    .map((r) => ({ ...r, at: time(r.finishedAt ?? r.startedAt), found: Math.max(0, Number(r.found) || 0), accepted: Math.max(0, Number(r.accepted) || 0), searched: Math.max(0, Number(r.searched) || 0) }))
    .sort((a, b) => a.at - b.at);
}

/** The candidates in an inbox (a list, newest first). */
export function candidatesOf(inbox) {
  const list = Array.isArray(inbox?.candidates) ? inbox.candidates : [];
  return list.filter((c) => c && typeof c === "object" && c.catName).slice().sort((a, b) => (time(b.foundAt) ?? 0) - (time(a.foundAt) ?? 0));
}

/**
 * @returns {{ active: boolean, lastAt: number|null, ago: string, newLeads: number, weekFound: number, runs: number,
 *   latest: { name: string, owner: string, category: string, status: string }[], line: string }}
 */
export function researchStatus(log, inbox, now = Date.now()) {
  const runs = runsOf(log);
  const last = runs[runs.length - 1] ?? null;
  const lastAt = last ? last.at : null;
  const active = lastAt !== null && now - lastAt <= ACTIVE_MS && now - lastAt >= -60000;
  const weekFound = runs.filter((r) => now - r.at <= WEEK_MS).reduce((n, r) => n + r.found, 0);
  const cands = candidatesOf(inbox);
  const latest = cands.slice(0, 5).map((c) => ({ name: String(c.catName), owner: String(c.owner ?? ""), category: String(c.category ?? ""), status: String(c.status ?? "pending") }));
  const newLeads = last ? last.found : 0;
  const ago = lastAt === null ? "" : timeAgo(now - lastAt);
  const line = active
    ? `Scanning the net… ${newLeads} new lead${newLeads === 1 ? "" : "s"}`
    : lastAt === null ? "Research team resting — no scan yet" : `Research team resting — last scan ${ago}`;
  return { active, lastAt, ago, newLeads, weekFound, runs: runs.length, latest, line };
}
