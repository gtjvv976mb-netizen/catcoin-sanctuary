/* The research team's trend watch (scripts/scan-trending-cats.mjs) against a fake X, a fake
   DexScreener and a fake Claude: what qualifies, how it is ranked, what becomes a candidate. */
import test from "node:test";
import assert from "node:assert/strict";
import { postCount, mergeAnswers, qualify, heat, cleanReading, isCandidate, scan, MIN_LIKES, MAX_AGE_HOURS, QUERY } from "../scripts/scan-trending-cats.mjs";
import { readPostByRules, tickerFor } from "../scripts/lib/read-cat-post.mjs";

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
  assert.deepEqual(t.candidates, ["1005", "1001"], "a taken ticker does not rule a cat out");
  assert.equal(t.posts.find((p) => p.id === "1005").taken[0].symbol, "MOCHI", "the coins already using it are recorded");
  assert.equal(f.asked[0].model, "claude-opus-5");
  assert.equal(f.asked[0].output_config.format.type, "json_schema");
  assert.equal(f.asked[0].messages[0].content[0].type, "image", "Claude sees the picture");
  const again = fakes();
  const t2 = await scan({ data: { trending: t, names: new Set() }, creds: CREDS, client: again.client, fetchImpl: again.fetchImpl, nowMs: NOW + 60_000 });
  assert.equal(again.asked.length, 0, "already read");
  assert.deepEqual(t2.candidates, ["1005", "1001"]);
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

test("X-only mode (no Anthropic key): posts are read by rules from their words, and the ticker is still checked", async () => {
  const f = fakes({ taken: ["MOCHI"] });
  const t = await scan({ data: { trending: { posts: [] }, names: new Set() }, creds: CREDS, client: null, fetchImpl: f.fetchImpl, nowMs: NOW });
  assert.deepEqual(t.candidates, ["1005", "1001"], "both cats, Mochi's taken ticker only recorded");
  const b = t.posts.find((p) => p.id === "1001").reading;
  assert.deepEqual([b.catName, b.ticker, b.kind, b.sensitive, b.readBy], ["Biscuit", "BISCUIT", "real", false, "rules"]);
  assert.equal(b.lore, "Biscuit learned to open the fridge 😹");
  assert.equal(t.posts.find((p) => p.id === "1005").taken.length, 1);
  assert.equal(f.asked.length, 0, "Claude is never asked");
  assert.ok(!isCandidate({ reading: null }));
});

test("the rules: a name only from how people write about their cat, sensitive on any sad or political word", () => {
  const name = (text) => readPostByRules({ text }).catName;
  assert.equal(name("my cat Biscuit learned to open the fridge"), "Biscuit");
  assert.equal(name("Meet Pudding, the office cat who runs payroll"), "Pudding");
  assert.equal(name("Taco the cat refuses to leave the box"), "Taco");
  assert.equal(name("new video of #MochiTheCat is out"), "Mochi");
  assert.equal(name("Nugget has learned to ring the doorbell"), "Nugget");
  assert.equal(name("This cat learned to open the fridge"), null, "no name, no cat coin");
  assert.equal(name("Black cat crossing the road"), null);
  assert.equal(name("My cat is judging me"), null);
  assert.equal(readPostByRules({ text: "Meet Pudding" }).readBy, "rules");
  for (const sad of ["RIP my cat Biscuit, 14 years", "my cat Biscuit is at the vet for surgery", "Meet Pudding, my son's cat", "my cat Biscuit went missing"]) {
    assert.equal(readPostByRules({ text: sad }).sensitive, true, sad);
  }
  assert.equal(readPostByRules({ text: "Meet Nyan, the anime cat everyone is drawing" }).kind, "cartoon");
  assert.equal(readPostByRules({ text: "Meet Goose, the cat stealing the new movie trailer" }).kind, "fiction");
  assert.equal(tickerFor("Señor Whiskers"), "SENORWHISK");
  assert.equal(tickerFor("B"), null);
  assert.equal(readPostByRules({ text: "Meet Nugget 🐱 https://t.co/x @someone #cats" }).lore, null, "too little left for a lore line");
  assert.equal(cleanReading(readPostByRules({ text: "my cat Biscuit buys $BISC at https://x.y" })).lore, null, "no links or price talk");
});

test("X's own trending lists: a cat trend is searched on its own and its posts lead, marked with the trend", async () => {
  const trendPost = { id: "2001", text: "Pudding at the vending machine again", created_at: hoursAgo(2), author_id: "u1", attachments: { media_keys: ["m1"] }, public_metrics: { like_count: 60_000, impression_count: 2_000_000 } };
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    if (url.startsWith("https://api.x.com/2/trends/by/woeid/1?")) return new Response(JSON.stringify({ data: [{ trend_name: "Pudding the Cat", tweet_count: 90_000 }, { trend_name: "Champions League", tweet_count: 900_000 }] }));
    if (url.startsWith("https://api.x.com/2/trends/by/woeid/")) return new Response(JSON.stringify({ title: "Forbidden" }), { status: 403 });
    if (url.startsWith("https://api.x.com/2/users/personalized_trends")) return new Response(JSON.stringify({ data: [{ trend_name: "#Nyanners", category: "Animals", post_count: "12.5K posts" }, { trend_name: "Mondays", category: "Only on X" }] }));
    if (url.startsWith("https://api.x.com/2/tweets/search/recent")) {
      const q = new URL(url).searchParams.get("query");
      if (q.startsWith('"Pudding the Cat"')) return new Response(JSON.stringify({ data: [trendPost], includes: answer.includes }));
      if (q.startsWith('"#Nyanners"')) return new Response(JSON.stringify({ data: [] }));
      return new Response(JSON.stringify(answer));
    }
    if (url.startsWith("https://api.dexscreener.com/")) return new Response(JSON.stringify({ pairs: [] }));
    throw new Error(`unexpected ${url}`);
  };
  const t = await scan({ data: { trending: { posts: [] }, names: new Set() }, creds: CREDS, client: null, fetchImpl, nowMs: NOW });
  assert.deepEqual(t.trends.map((x) => x.name), ["Pudding the Cat", "#Nyanners"], "cat trends only; a place the plan refuses is skipped");
  assert.ok(asked.some((u) => new URL(u).searchParams.get("query")?.includes("-is:retweet") && new URL(u).searchParams.get("query")?.startsWith('"Pudding the Cat"')));
  const p = t.posts.find((x) => x.id === "2001");
  assert.equal(p.trend, "Pudding the Cat", "found through the trend, though its words never say cat");
  assert.equal(p.reading.catName, null, "the rules still need the post to name its cat");
  assert.deepEqual([postCount("12.5K posts"), postCount("1,204 posts"), postCount("2M"), postCount(undefined)], [12_500, 1204, 2_000_000, 0]);
  assert.equal(mergeAnswers([{ data: [{ id: "1" }] }, { data: [{ id: "1" }, { id: "2" }] }]).data.length, 2);
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
