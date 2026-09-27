/* The research team's trend watch (scripts/scan-trending-cats.mjs) against a fake X, a fake
   DexScreener and a fake Claude: what qualifies, how it is ranked, what becomes a candidate. */
import test from "node:test";
import assert from "node:assert/strict";
import { qualify, heat, cleanReading, isCandidate, scan, MIN_LIKES, MAX_AGE_HOURS, QUERY } from "../scripts/scan-trending-cats.mjs";

const NOW = Date.parse("2026-09-27T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();
const CREDS = { apiKey: "k", apiSecret: "s", accessToken: "t", accessSecret: "a" };

const answer = {
  data: [
    { id: "1001", text: "My cat Biscuit learned to open the fridge 😹", created_at: hoursAgo(5), author_id: "u1", attachments: { media_keys: ["m1"] }, public_metrics: { like_count: 90_000, retweet_count: 12_000, impression_count: 4_000_000 } },
    { id: "1002", text: "cat nap", created_at: hoursAgo(3), author_id: "u2", attachments: { media_keys: ["m2"] }, public_metrics: { like_count: 500, impression_count: 20_000 } },
    { id: "1003", text: "old viral cat", created_at: hoursAgo(MAX_AGE_HOURS + 1), author_id: "u1", attachments: { media_keys: ["m1"] }, public_metrics: { like_count: 500_000 } },
    { id: "1004", text: "cat with no picture", created_at: hoursAgo(2), author_id: "u1", public_metrics: { like_count: 50_000 } },
    { id: "1005", text: "Our cat Mochi sleeping in a salad bowl", created_at: hoursAgo(1), author_id: "u2", attachments: { media_keys: ["m2"] }, public_metrics: { like_count: 30_000, impression_count: 900_000 } },
    { id: "1006", text: "sensitive cat", created_at: hoursAgo(1), author_id: "u2", possibly_sensitive: true, attachments: { media_keys: ["m2"] }, public_metrics: { like_count: 80_000 } },
  ],
  includes: {
    users: [{ id: "u1", username: "biscuitmom", name: "Ana", public_metrics: { followers_count: 1200 } }, { id: "u2", username: "mochi", name: "M" }],
    media: [{ media_key: "m1", type: "photo", url: "https://pbs.twimg.com/media/a.jpg" }, { media_key: "m2", type: "video", preview_image_url: "https://pbs.twimg.com/ext/b.jpg" }],
  },
};

test("qualifies: fresh, liked or viewed enough, with a picture, not marked sensitive; hottest per hour first", () => {
  const q = qualify(answer, NOW);
  assert.deepEqual(q.map((p) => p.id), ["1005", "1001"], "Mochi is newer, so hotter per hour");
  assert.equal(q[1].url, "https://x.com/biscuitmom/status/1001");
  assert.equal(q[1].media[0].url, "https://pbs.twimg.com/media/a.jpg");
  assert.equal(heat({ like_count: 100, retweet_count: 10, impression_count: 10_000 }, 2), 110);
  assert.ok(MIN_LIKES >= 10_000);
  assert.match(QUERY, /-is:retweet/);
  assert.match(QUERY, /-pump/);
});

test("a reading is cleaned: ticker shape, no links or price talk in the lore, sensitive unless said otherwise", () => {
  const r = cleanReading({ aboutOneCat: true, catName: "Biscuit‮", kind: "real", coinName: "Biscuit", ticker: "$biscuit", lore: "Biscuit opens the fridge at night.", sensitive: false, why: "ok" });
  assert.deepEqual([r.catName, r.ticker, r.lore, r.sensitive], ["Biscuit", "BISCUIT", "Biscuit opens the fridge at night.", false]);
  assert.equal(cleanReading({ ticker: "BISCUIT COIN!!", lore: "buy at https://x.y" }).ticker, null);
  assert.equal(cleanReading({ lore: "Biscuit, see www.biscuit.cat" }).lore, null);
  assert.equal(cleanReading({}).sensitive, true, "no answer means sensitive");
  assert.equal(cleanReading({ kind: "robot" }).kind, "none");
});

function fakes({ taken = [], xStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith("https://api.x.com/2/tweets/search/recent")) return new Response(JSON.stringify(xStatus === 200 ? answer : { title: "nope" }), { status: xStatus });
    if (url.startsWith("https://api.dexscreener.com/latest/dex/search")) {
      const q = new URL(url).searchParams.get("q");
      return new Response(JSON.stringify({ pairs: taken.includes(q) ? [{ chainId: "solana", url: "https://dexscreener.com/solana/x", baseToken: { address: "So1anaMintxxxxxxxxxxxxxxxxxxxxxxxxxxxxx9999", name: q, symbol: q } }] : [] }));
    }
    throw new Error(`unexpected ${url}`);
  };
  const readings = {
    1001: { aboutOneCat: true, catName: "Biscuit", kind: "real", coinName: "Biscuit", ticker: "BISCUIT", lore: "Biscuit learned to open the fridge.", sensitive: false, why: "one named cat" },
    1005: { aboutOneCat: true, catName: "Mochi", kind: "real", coinName: "Mochi", ticker: "MOCHI", lore: "Mochi naps in a salad bowl.", sensitive: false, why: "one named cat" },
  };
  const asked = [];
  const client = { messages: { create: async (req) => {
    asked.push(req);
    const id = req.messages[0].content.at(-1).text.includes("Biscuit") ? 1001 : 1005;
    return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(readings[id]) }] };
  } } };
  return { fetchImpl, calls, client, asked };
}

test("a run: new trending posts read by Claude, tickers checked on Solana, candidates listed; a post is never read twice", async () => {
  const f = fakes({ taken: ["MOCHI"] });
  const t = await scan({ data: { trending: { posts: [] }, names: new Set() }, creds: CREDS, client: f.client, fetchImpl: f.fetchImpl, nowMs: NOW });
  assert.deepEqual(t.candidates, ["1001"], "Mochi's ticker is taken");
  assert.equal(t.posts.find((p) => p.id === "1005").status, "passed");
  assert.equal(f.asked[0].model, "claude-opus-5");
  assert.equal(f.asked[0].output_config.format.type, "json_schema");
  assert.equal(f.asked[0].messages[0].content[0].type, "image", "Claude sees the picture");
  const again = fakes();
  const t2 = await scan({ data: { trending: t, names: new Set() }, creds: CREDS, client: again.client, fetchImpl: again.fetchImpl, nowMs: NOW + 60_000 });
  assert.equal(again.asked.length, 0, "already read");
  assert.deepEqual(t2.candidates, ["1001"]);
});

test("a cat already in the sanctuary is not a candidate; X refusing search keeps the last list", async () => {
  const f = fakes();
  const t = await scan({ data: { trending: { posts: [] }, names: new Set(["biscuit"]) }, creds: CREDS, client: f.client, fetchImpl: f.fetchImpl, nowMs: NOW });
  assert.deepEqual(t.candidates, ["1005"]);
  const r = fakes({ xStatus: 403 });
  const t2 = await scan({ data: { trending: t, names: new Set() }, creds: CREDS, client: r.client, fetchImpl: r.fetchImpl, nowMs: NOW, log: () => {} });
  assert.equal(t2.searchError, 403);
  assert.deepEqual(t2.candidates, t.candidates);
});

test("without Claude, trending posts are not read and are tried again next run", async () => {
  const f = fakes();
  const t = await scan({ data: { trending: { posts: [] }, names: new Set() }, creds: CREDS, client: null, fetchImpl: f.fetchImpl, nowMs: NOW });
  assert.deepEqual(t.posts, []);
  assert.ok(!isCandidate({ reading: null }));
});

test("trend watch workflow: pinned actions, contents: write for the scan, secrets only in the scan step, the next-run job runs no repository code", async () => {
  const fs = await import("node:fs");
  const W = fs.readFileSync(new URL("../.github/workflows/trendwatch.yml", import.meta.url), "utf8");
  assert.deepEqual([...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`), ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1", "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0"]);
  assert.match(W, /^permissions: \{\}$/m);
  assert.deepEqual([...W.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim()), ["contents: write", "actions: write"]);
  const withSecrets = W.split(/\n      - /).filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 1);
  assert.match(withSecrets[0], /node scripts\/scan-trending-cats\.mjs/);
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["ANTHROPIC_API_KEY", "X_ACCESS_SECRET", "X_ACCESS_TOKEN", "X_API_KEY", "X_API_SECRET"]);
  assert.ok(!/SECRET_KEY|WALLET|PRIVATE/i.test(W), "no wallet key: launching stays a person's decision");
  const next = W.slice(W.indexOf("\n  next:"));
  assert.ok(!/uses:|\bnode\b|\bnpm\b|secrets\./.test(next));
});
