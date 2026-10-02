/* The research team's trend watch (scripts/scan-trending-cats.mjs) against a fake X, a fake
   DexScreener and a fake Claude: what qualifies, how it is ranked, what becomes a candidate. */
import test from "node:test";
import assert from "node:assert/strict";
import { readBudget, postCount, mergeAnswers, qualify, heat, cleanReading, isCandidate, scan, MIN_LIKES, MAX_AGE_HOURS, QUERY,
  stageOf, mentionsCat, watchList, figureIn, bigQueries, figureQueries, nameFromTrend, nameReading, trackNames, pruneNames, emergingNames, loadState,
  ROTATION, PER_SEARCH, MAX_QUERY, MAX_SIGNALS, MAX_NAMES, RISING_MAX_AGE_HOURS, RISING_MIN_LIKES, RISING_LIKES_PER_HOUR, RISING_VIEWS_PER_HOUR, RISING_MIN_HOURS,
  isFigureName, BIG_FOLLOWERS, BIG_TERMS, approvedRows, withApproved, memeNamed, memeQueries, bigTurns } from "../scripts/scan-trending-cats.mjs";
import { readPostByRules, tickerFor, namesIn } from "../scripts/lib/read-cat-post.mjs";

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
  assert.ok(MIN_LIKES >= 5_000);
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
  // Changed on purpose (trend lens): a post that names no cat borrows the trend's name when the trend is one.
  assert.deepEqual([p.reading.catName, p.reading.ticker, p.reading.nameFrom, p.lens, p.stage, p.status], ["Pudding", "PUDDING", "trend", "trend", "viral", "candidate"]);
  assert.equal(asked.filter((u) => u.startsWith("https://api.x.com/2/tweets/search/recent")).length, 1, "one post search a run: the busiest cat trend");
  assert.deepEqual([postCount("12.5K posts"), postCount("1,204 posts"), postCount("2M"), postCount(undefined)], [12_500, 1204, 2_000_000, 0]);
  assert.equal(mergeAnswers([{ data: [{ id: "1" }] }, { data: [{ id: "1" }, { id: "2" }] }]).data.length, 2);
});

test("X reads are budgeted: paced by day within the month, each search asks for few posts, a spent day searches nothing", async () => {
  const b = readBudget({ month: "2026-09", monthUsed: 900, day: "2026-09-27", dayUsed: 300 }, NOW, 10_000);
  assert.deepEqual([b.dayCap, b.left], [333, 33], "10,000 over September's 30 days");
  assert.equal(readBudget({ month: "2026-08", monthUsed: 9_999, day: "2026-08-31", dayUsed: 333 }, NOW).left, 333, "a new day and month start fresh");
  const f = fakes();
  const t = await scan({ data: { trending: { posts: [] }, names: new Set() }, creds: CREDS, client: null, fetchImpl: f.fetchImpl, nowMs: NOW });
  const searches = f.calls.filter((u) => u.startsWith("https://api.x.com/2/tweets/search/recent"));
  assert.ok(searches.every((u) => Number(new URL(u).searchParams.get("max_results")) <= 30), "at most 30 posts a search");
  assert.deepEqual([t.reads.dayUsed, t.reads.monthUsed], [answer.data.length, answer.data.length], "what X returned is counted");
  const spent = fakes();
  const t2 = await scan({ data: { trending: { ...t, reads: { ...t.reads, dayUsed: 330 } }, names: new Set() }, creds: CREDS, client: null, fetchImpl: spent.fetchImpl, nowMs: NOW, log: () => {} });
  assert.equal(spent.calls.length, 0, "nothing searched once today's share is spent");
  assert.deepEqual(t2.candidates, t.candidates, "the last list is kept");
});

test("trend watch workflow: pinned actions, contents: write for the scan, secrets only in the scan step, the launcher and next-run jobs run no repository code", async () => {
  const fs = await import("node:fs");
  const W = fs.readFileSync(new URL("../.github/workflows/trendwatch.yml", import.meta.url), "utf8");
  assert.deepEqual([...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`), ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1", "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0"]);
  assert.match(W, /^permissions: \{\}$/m);
  assert.deepEqual([...W.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim()), ["contents: write", "actions: write", "actions: write"]);
  const withSecrets = W.split(/\n      - /).filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 1);
  assert.match(withSecrets[0], /node scripts\/scan-trending-cats\.mjs/);
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["ANTHROPIC_API_KEY", "X_ACCESS_SECRET", "X_ACCESS_TOKEN", "X_API_KEY", "X_API_SECRET"]);
  assert.ok(!/SECRET_KEY|WALLET|PRIVATE/i.test(W), "no wallet key: the trend watch never signs anything (the launcher is launch.yml)");
  const launcher = W.slice(W.indexOf("\n  launcher:"), W.indexOf("\n  next:"));
  const next = W.slice(W.indexOf("\n  next:"));
  for (const job of [launcher, next]) assert.ok(!/uses:|\bnode\b|\bnpm\b|secrets\./.test(job));
  // A commit that brings new candidates starts the launcher at once (LAUNCH_ENABLED on or dry), from a job of its own: it waits for
  // nothing, TRENDWATCH_CHAIN=off does not stop it, and a failed dispatch cannot stop the chain (the next job does not need it).
  assert.match(W, /outputs:\n\s+candidates: \$\{\{ steps\.commit\.outputs\.candidates \}\}/);
  assert.match(W, /id: commit\n/);
  assert.match(W, /if \[ "\$fresh" -gt 0 \]; then echo "candidates=true" >> "\$GITHUB_OUTPUT"; fi\n\n  launcher:/, "set only after the push");
  assert.match(launcher, /\n  launcher:\n    needs: scan\n    if: \$\{\{ !cancelled\(\) && needs\.scan\.outputs\.candidates == 'true' && \(vars\.LAUNCH_ENABLED == 'on' \|\| vars\.LAUNCH_ENABLED == 'dry'\) \}\}\n/);
  assert.match(launcher, /env:\n\s+GH_TOKEN: \$\{\{ github\.token \}\}\n\s+REPO: \$\{\{ github\.repository \}\}\n\s+run: gh workflow run launch\.yml -R "\$REPO" --ref main\n/);
  assert.ok(!/TRENDWATCH_CHAIN|sleep/.test(launcher), "never behind the chain's switch or its wait");
  assert.ok(!next.includes("launch.yml"), "the chain's job never dispatches the launcher, so a failed dispatch cannot skip the chain's step");
  assert.match(next, /\n  next:\n    needs: scan\n/, "the chain needs only the scan");
});

test("trend watch workflow: the commit step counts the candidates the commit adds (git and jq, as the runner has them)", { skip: process.platform === "win32" }, async () => {
  const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path"), { execFileSync } = await import("node:child_process");
  const W = fs.readFileSync(new URL("../.github/workflows/trendwatch.yml", import.meta.url), "utf8");
  const lines = W.match(/\n {10}(fresh=\$\(comm[^\n]*\\\n[^\n]*)\n/)[1].replace(/\\\n\s*/, "");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-"));
  const git = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir, encoding: "utf8" });
  const put = (v) => { fs.mkdirSync(path.join(dir, "data"), { recursive: true }); fs.writeFileSync(path.join(dir, "data/trending-cats.json"), JSON.stringify(v)); };
  const count = () => execFileSync("bash", ["-eo", "pipefail", "-c", `${lines}\necho "$fresh"`], { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q");
  put({ candidates: ["1", "2"] }); git("add", "."); git("commit", "-qm", "a");
  put({ candidates: ["2", "1"] });
  assert.equal(count(), "0", "the same candidates: nothing new");
  put({ candidates: ["3", "1"] });
  assert.equal(count(), "1", "one new candidate");
  put({ posts: [] });
  assert.equal(count(), "0", "no candidates at all");
});

/* ---------- lenses: one X search a run, chosen for being first ---------- */

const MEDIA = [{ media_key: "m1", type: "photo", url: "https://pbs.twimg.com/media/a.jpg" }];
const USERS = [
  { id: "u1", username: "biscuitmom", name: "Ana" }, { id: "u2", username: "mochi", name: "M" }, { id: "u3", username: "catfan3", name: "C" },
  { id: "e1", username: "elonmusk", name: "Elon" }, { id: "n1", username: "NASA", name: "NASA" },
];
const post = (id, text, { h = 1, likes = 0, views = 0, author = "u1", media = true, sensitive = false } = {}) => ({
  id, text, created_at: hoursAgo(h), author_id: author, ...(media ? { attachments: { media_keys: ["m1"] } } : {}),
  ...(sensitive ? { possibly_sensitive: true } : {}), public_metrics: { like_count: likes, impression_count: views },
});
const reply = (...posts) => ({ data: posts, includes: { users: USERS, media: MEDIA } });
const WATCH = {
  bigAccounts: ["elonmusk", "@NASA", "not a handle!", "ELONMUSK"],
  figures: [
    { name: "Big Floppa", aliases: ["Floppa"], kind: "meme", ticker: "FLOPPA" },
    { name: "Tom", aliases: ["Tom and Jerry", "Tom Cat"], matchOnlyAliases: true, kind: "cartoon", ticker: "TOMCAT" },
    { name: "Garfield", aliases: [], kind: "cartoon", needsCatWord: true },
    { name: "Grumpy Cat", aliases: ["Tardar Sauce"], kind: "meme" },
  ],
};

/** A fake X: trend lists (worldwide, and "for you" when `personal` is given; read at each call, so a test may change
 *  them between runs) and one search answer per query; every search recorded. */
function fakeX({ trends = [], personal = null, search = () => ({ data: [] }), status = 200 } = {}) {
  const searches = [];
  const fetchImpl = async (url) => {
    if (url.startsWith("https://api.x.com/2/trends/by/woeid/1?")) return new Response(JSON.stringify({ data: trends }));
    if (url.startsWith("https://api.x.com/2/trends/by/woeid/")) return new Response("{}", { status: 403 });
    if (url.startsWith("https://api.x.com/2/users/personalized_trends")) return personal ? new Response(JSON.stringify({ data: personal })) : new Response("{}", { status: 403 });
    if (url.startsWith("https://api.x.com/2/tweets/search/recent")) {
      const u = new URL(url);
      searches.push({ query: u.searchParams.get("query"), max: Number(u.searchParams.get("max_results")), sort: u.searchParams.get("sort_order"), fields: u.searchParams.get("tweet.fields") });
      return status === 200 ? new Response(JSON.stringify(search(u.searchParams.get("query")))) : new Response(JSON.stringify({ title: "nope" }), { status });
    }
    if (url.startsWith("https://api.dexscreener.com/")) return new Response(JSON.stringify({ pairs: [] }));
    throw new Error(`unexpected ${url}`);
  };
  return { fetchImpl, searches };
}
const run = (trending, x, { watch = WATCH, names = new Set(), at = NOW, perSearch, client = null } = {}) =>
  scan({ data: { trending, names, watch }, creds: CREDS, client, fetchImpl: x.fetchImpl, nowMs: at, log: () => {}, ...(perSearch ? { perSearch } : {}) });
/** A fake Claude that gives every post the same reading (a function of the post's text, or a fixed reading). */
const claudeSays = (reading) => ({ messages: { create: async (req) => {
  const r = typeof reading === "function" ? reading(req.messages[0].content.at(-1).text) : reading;
  return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(r) }] };
} } });
const NOT_A_CAT = { aboutOneCat: false, catName: null, kind: "none", coinName: null, ticker: null, lore: null, sensitive: false, why: "about a singer, not a cat" };
const H = 3_600_000;

// Changed on purpose (review): the rotation keeps at least every other run, so after a trend run the rotation goes before
// the emerging name; and a name is followed up again only when a new account gives it (see the tests below).
test("lens priority: a cat trend not searched for 6 hours, then an emerging name not followed up for 12, then the rotation, which keeps every other run", async () => {
  const trends = [{ trend_name: "Pudding the Cat", tweet_count: 90_000 }];
  const x = fakeX({ trends });
  const names = { zuzu: { name: "Zuzu", sightings: [{ at: hoursAgo(3), author: "a", post: "1", likes: 5 }, { at: hoursAgo(2), author: "b", post: "2", likes: 5 }] } };
  const t1 = await run({ posts: [], state: { names } }, x);
  assert.equal(t1.lens, "trend");
  assert.ok(x.searches[0].query.startsWith('"Pudding the Cat" has:media -is:retweet -is:reply'));
  assert.equal(t1.state.trendSearchedAt["pudding the cat"], new Date(NOW).toISOString());
  assert.equal(t1.state.lastLens, "trend");
  const t2 = await run(t1, x, { at: NOW + H });
  assert.equal(t2.lens, "big", "the trend was searched an hour ago, and after a trend run the rotation has its turn before the name");
  const t3 = await run(t2, x, { at: NOW + 2 * H });
  assert.equal(t3.lens, "emerging");
  assert.equal(x.searches[2].query, '"Zuzu" (cat OR cats OR kitten OR kitty OR meow) has:media -is:retweet -is:reply -"$" -pump -memecoin -solana -"contract address" -airdrop -giveaway');
  assert.equal(t3.state.followedUp.zuzu, new Date(NOW + 2 * H).toISOString());
  const t4 = await run(t3, x, { at: NOW + 3 * H });
  assert.equal(t4.lens, "viral", "the rotation goes on where it was");
  const t5 = await run(t4, x, { at: NOW + 7 * H });
  assert.equal(t5.lens, "trend", "six hours on, the trend is searched again");
  const t6 = await run(t5, x, { at: NOW + 8 * H });
  assert.equal(t6.lens, "big", "a trend searched before waits for the rotation's turn");
  trends.push({ trend_name: "#MochiTheCat", tweet_count: 5 });
  const t7 = await run(t6, x, { at: NOW + 9 * H });
  assert.equal(t7.query.split('"')[1], "#MochiTheCat", "a new cat trend");
  trends.push({ trend_name: "#BiscuitTheCat", tweet_count: 3 });
  const t8 = await run(t7, x, { at: NOW + 9.5 * H });
  assert.deepEqual([t8.lens, t8.query.split('"')[1]], ["trend", "#BiscuitTheCat"], "a trend never searched does not wait, even after a trend run: being first matters most there");
  const t9 = await run(t8, x, { at: NOW + 10 * H });
  assert.equal(t9.lens, "figures", "the rotation's turn");
  const t10 = await run(t9, x, { at: NOW + 15 * H });
  assert.equal(t10.lens, "trend", "Pudding the Cat, eight hours on");
  trends.length = 0;
  const t11 = await run(t10, x, { at: NOW + 16 * H });
  const t12 = await run(t11, x, { at: NOW + 17 * H });
  assert.deepEqual([t11.lens, t12.lens], ["big", "viral"], "Zuzu was followed up 14 hours ago, but no new account has given the name since");
  assert.equal(x.searches.length, 12, "exactly one post search a run");
});

test("the trend lens: every cat trend is considered, busiest first; one on cooldown or already a sanctuary cat is passed over for a smaller one", async () => {
  const trends = [{ trend_name: "Doja Cat", tweet_count: 900_000 }, { trend_name: "Hello Kitty", tweet_count: 800_000 }, { trend_name: "#BiscuitTheCat", tweet_count: 500_000 }, { trend_name: "#PuddingTheCat", tweet_count: 4_000 }];
  const x = fakeX({ trends });
  const names = new Set(["hello kitty"]);
  const t = await run({ posts: [], state: { trendSearchedAt: { "doja cat": hoursAgo(2), "#biscuitthecat": hoursAgo(5) }, lastLens: "big" } }, x, { names });
  assert.deepEqual(t.trends.map((tr) => tr.name), ["Doja Cat", "Hello Kitty", "#BiscuitTheCat", "#PuddingTheCat"], "all of them, not only the two busiest");
  assert.equal(t.lens, "trend");
  assert.ok(x.searches[0].query.startsWith('"#PuddingTheCat"'), "the two busiest were searched within 6 hours and Hello Kitty lives in the sanctuary");
  const t2 = await run(t, x, { names, at: NOW + 2 * H });
  assert.equal(t2.lens, "big", "#BiscuitTheCat is off cooldown but was searched before, so after a trend run the rotation goes first");
  const t3 = await run(t2, x, { names, at: NOW + 4.5 * H });
  assert.ok(t3.lens === "trend" && x.searches[2].query.startsWith('"Doja Cat"'), "Doja Cat is off cooldown and the busiest");
});

test("rotation: big, viral, big, figures, kept in state; big-account chunks take turns; a lens with an empty list is skipped", async () => {
  const handles = Array.from({ length: 40 }, (_, i) => `account${String(i).padStart(2, "0")}`);
  const watch = { bigAccounts: handles, figures: WATCH.figures };
  const x = fakeX();
  let t = { posts: [] };
  const lenses = [];
  for (let i = 0; i < 8; i++) { t = await run(t, x, { watch, at: NOW + i * H }); lenses.push(t.lens); }
  assert.deepEqual(ROTATION, ["big", "viral", "big", "figures"]);
  assert.deepEqual(lenses, ["big", "viral", "big", "figures", "big", "viral", "big", "figures"]);
  assert.deepEqual(x.searches.map((s) => s.max), Array(8).fill(PER_SEARCH), "one search a run, PER_SEARCH posts");
  const big = x.searches.filter((s) => s.query.includes("from:"));
  assert.equal(big.length, 4);
  assert.notEqual(big[0].query, big[1].query, "the next big-account chunk each time");
  assert.equal(big[0].query, big[2].query, "two chunks, taken in turn");
  for (const h of handles) assert.equal(big.slice(0, 2).filter((s) => s.query.includes(`from:${h} `) || s.query.includes(`from:${h})`)).length, 1, h);
  assert.ok(big.every((s) => s.sort === "recency" && s.query.length <= MAX_QUERY && !s.query.includes("-is:reply") && !s.query.includes("has:media") && s.query.endsWith("-is:retweet")));
  assert.ok(x.searches[3].query.startsWith('("Big Floppa" OR "Floppa" OR "Tom and Jerry" OR "Tom Cat" OR ("Garfield" (cat OR cats OR kitten OR kitty)) OR "Grumpy Cat"'),
    "figures by name; Tom only by its aliases; Garfield (needsCatWord) only with a cat word, so Andrew Garfield does not fill the ten posts");
  assert.match(x.searches[3].query, /\) has:media -is:retweet -is:reply -"\$" -pump/);
  assert.equal(x.searches[1].query, QUERY);
  assert.deepEqual([t.state.nextLens, t.state.bigChunk, t.state.figureChunk], [0, 0, 0]);

  const noBig = fakeX();
  let u = { posts: [] };
  const l2 = [];
  for (let i = 0; i < 4; i++) { u = await run(u, noBig, { watch: { figures: WATCH.figures }, at: NOW + i * H }); l2.push(u.lens); }
  assert.deepEqual(l2, ["viral", "figures", "viral", "figures"]);
  const none = fakeX();
  let v = { posts: [] };
  for (let i = 0; i < 3; i++) { v = await run(v, none, { watch: null, at: NOW + i * H }); assert.equal(v.lens, "viral", "no data/cat-watch.json: viral only"); }
});

test("exactly one post search a run with max_results PER_SEARCH (10 to 100); the posts X returns are spent; a day that cannot pay searches nothing", async () => {
  const two = fakeX({ trends: [{ trend_name: "Pudding the Cat", tweet_count: 9 }, { trend_name: "#MochiTheCat", tweet_count: 5 }], search: () => reply(post("1", "a cat"), post("2", "a cat"), post("3", "a cat")) });
  const t = await run({ posts: [] }, two);
  assert.equal(two.searches.length, 1, "two cat trends, still one search");
  assert.equal(two.searches[0].max, 12);
  assert.deepEqual([t.reads.dayUsed, t.reads.monthUsed], [3, 3], "the three posts X returned are counted");
  const big = fakeX();
  await run({ posts: [] }, big, { perSearch: 250 });
  await run({ posts: [] }, big, { perSearch: 3 });
  assert.deepEqual(big.searches.map((s) => s.max), [100, 10]);
  const almost = fakeX({ search: () => reply(post("1", "a cat")) });
  const a = await run({ posts: [], reads: { day: "2026-09-27", dayUsed: 321, month: "2026-09", monthUsed: 900 } }, almost);
  assert.deepEqual([almost.searches.length, a.reads.dayUsed, a.reads.monthUsed], [1, 322, 901], "12 left today pays for one search");
  const spent = fakeX();
  const s = await run(a, spent);
  assert.equal(spent.searches.length, 0);
  assert.equal(s.lens, null, "nothing searched");
  assert.deepEqual(s.state, a.state, "the rotation waits");
});

test("big accounts: any cat post of theirs in 48 hours qualifies, with no thresholds and no picture; one that names no cat is a signal", async () => {
  const x = fakeX({ search: () => reply(
    post("9001", "I love my cat so much", { author: "e1", media: false, likes: 5 }),
    post("9002", "Meet Pudding, the office cat who runs payroll", { author: "e1", h: 2, media: false, likes: 3 }),
    post("9003", "Rocket launch today", { author: "n1" }),
    post("9004", "my old cat photo", { author: "e1", h: MAX_AGE_HOURS + 1 }),
    post("9005", "a cat", { author: "e1", sensitive: true }),
    post("9006", "my cat Biscuit says hi", { author: "u1", likes: 10 }),
    post("9007", "@catlover thanks!", { author: "e1" }),
    post("9008", "猫 🐈 catcoin?", { author: "n1", h: 3 }),
  ) });
  const t = await run({ posts: [] }, x);
  assert.equal(t.lens, "big");
  assert.ok(x.searches[0].query.startsWith("(from:elonmusk OR from:NASA) (cat OR cats OR kitten OR kitty OR meow OR catcoin OR 猫 OR 🐱 OR 🐈) -is:retweet"));
  assert.deepEqual(t.posts.map((p) => p.id).sort(), ["9001", "9002", "9008"], "only watched accounts' cat posts, 48 h, not sensitive");
  const p1 = t.posts.find((p) => p.id === "9001");
  assert.deepEqual([p1.stage, p1.lens, p1.bigAccount, p1.status, p1.media.length], ["big-account", "big", "elonmusk", "signal", 0]);
  assert.deepEqual(t.signals, ["9001", "9008"], "newest first");
  assert.equal(t.posts.find((p) => p.id === "9008").bigAccount, "NASA", "the watch list's spelling");
  const p2 = t.posts.find((p) => p.id === "9002");
  assert.deepEqual([p2.status, p2.reading.catName], ["candidate", "Pudding"], "a big account naming a cat is a candidate");
  assert.deepEqual(t.candidates, ["9002"]);
  // A big account's cat post counts on every lens (the owner's ask); anyone else keeps the thresholds and the picture.
  assert.deepEqual(qualify(reply(post("9001", "I love my cat", { author: "e1", media: false, likes: 5 })), NOW, { lens: "viral", bigAccounts: ["elonmusk"] }).map((p) => [p.stage, p.bigAccount]), [["big-account", "elonmusk"]]);
  assert.deepEqual(qualify(reply(post("9006", "my cat Biscuit says hi", { author: "u1", media: false, likes: 10 })), NOW, { lens: "viral", bigAccounts: ["elonmusk"] }), [], "a small account needs the thresholds");
  assert.ok(mentionsCat("so many kitties 😹") && mentionsCat("$CAT") && !mentionsCat("@catlover https://x.com/cat ok"));
  // At most MAX_SIGNALS signals, newest first.
  const old = Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, postedAt: new Date(NOW - (i + 5) * H).toISOString(), status: "signal" }));
  const t2 = await run({ ...t, posts: [...t.posts, ...old] }, fakeX(), { at: NOW + H });
  assert.equal(t2.signals.length, MAX_SIGNALS);
  assert.deepEqual(t2.signals.slice(0, 3), ["9001", "9008", "s0"]);
});

test("big accounts: a sensitive cat post is never a signal; a long post is read whole (note_tweet)", async () => {
  const long = { ...post("9102", `${"Long thoughts on engines, orbits and the next launch window. ".repeat(4)}Also`, { author: "e1", media: false }),
    note_tweet: { text: `${"Long thoughts on engines, orbits and the next launch window. ".repeat(4)}Also, my cat walked across the keyboard and sent this.` } };
  const x = fakeX({ search: () => reply(post("9101", "RIP to the best cat who ever lived. Goodbye old friend", { author: "e1", media: false }), long) });
  const t = await run({ posts: [] }, x);
  assert.match(x.searches[0].fields, /(^|,)note_tweet(,|$)/, "the search asks X for a long post's full text");
  const rip = t.posts.find((p) => p.id === "9101");
  assert.deepEqual([rip.stage, rip.reading.sensitive, rip.status], ["big-account", true, "passed"]);
  assert.deepEqual(t.signals, ["9102"], "the sad post is kept out of signals; the long post's cat, past its first 280 characters, is found");
  assert.match(t.posts.find((p) => p.id === "9102").text, /my cat walked across the keyboard/);
});

// Changed on purpose (review): the rate is counted over the post's real age, 15 minutes at least (was an hour at least),
// so a post gaining views fast in its first hour, the earliest case, is rising.
test("rising: at most 12 hours old and 1,000 likes at 500 an hour, or 50,000 views an hour (15 minutes at least); viral beats rising", () => {
  assert.deepEqual([RISING_MAX_AGE_HOURS, RISING_MIN_LIKES, RISING_LIKES_PER_HOUR, RISING_VIEWS_PER_HOUR, RISING_MIN_HOURS], [12, 1_000, 500, 50_000, 0.25]);
  const s = (likes, views, h) => stageOf({ like_count: likes, impression_count: views }, h);
  assert.equal(s(1_000, 0, 2), "rising", "exactly 500 likes an hour");
  assert.equal(s(999, 0, 1), null, "fewer than 1,000 likes");
  assert.equal(s(1_999, 0, 4), null, "499.75 an hour");
  assert.equal(s(2_000, 0, 4), "rising");
  assert.equal(s(0, 100_000, 2), "rising", "exactly 50,000 views an hour");
  assert.equal(s(0, 99_999, 2), null);
  assert.equal(s(0, 200_000, 4), "rising", "exactly 50,000 views an hour, under the viral bar");
  assert.equal(s(4_000, 0, 12 + 1 / 60), null, "past 12 hours it is no longer rising");
  assert.equal(s(0, 600_000, 12), "viral", "a rising pace that long is past the viral bar: viral beats rising");
  assert.equal(s(1_000, 0, 0.5), "rising", "half an hour old: 2,000 an hour");
  assert.equal(s(999, 0, 0.1), null, "still 1,000 likes at least, however young");
  assert.equal(s(0, 40_000, 0.25), "rising", "40,000 views in 15 minutes is 160,000 an hour");
  assert.equal(s(0, 30_000, 0.5), "rising", "exactly 60,000 an hour");
  assert.equal(s(0, 24_999, 0.5), null, "49,998 an hour");
  assert.equal(s(0, 12_500, 0.05), "rising", "3 minutes old counts as 15: exactly 50,000 an hour");
  assert.equal(s(0, 12_499, 0.05), null, "a few thousand views in the first minutes are no rush");
  assert.equal(s(30_000, 0, 3), "viral");
  assert.equal(s(0, 1_000_000, 11), "viral");
  const q = qualify(reply(post("1", "a cat", { h: 2, likes: 1_500 }), post("2", "a cat", { h: 2, likes: 1_500, sensitive: true }), post("3", "a cat", { h: 2, likes: 1_500, media: false })), NOW);
  assert.deepEqual(q.map((p) => [p.id, p.stage]), [["1", "rising"]], "never sensitive; a picture needed");
});

test("figures: a post naming a watched figure is read as that cat (matchOnlyAliases, needsCatWord, longest match); watch lists are cleaned", async () => {
  const w = watchList(WATCH);
  assert.deepEqual(w.bigAccounts, ["elonmusk", "NASA"], "no @, valid handles only, once each");
  const f = (text) => figureIn(text, w.figures)?.name ?? null;
  assert.equal(f("Tom is on the couch again"), null, "Tom alone is too common a word");
  assert.equal(f("Tom and Jerry marathon tonight"), "Tom");
  assert.equal(f("Tom &amp; Jerry forever"), "Tom");
  assert.equal(f("#TomAndJerry"), "Tom");
  assert.equal(f("Floppa stares into your soul"), "Big Floppa");
  assert.equal(f("#BigFloppa"), "Big Floppa");
  assert.equal(f("floppafication"), null, "whole words only");
  assert.equal(f("Andrew Garfield at the premiere"), null, "Garfield needs a cat word");
  assert.equal(f("Garfield hates Mondays, classic cat"), "Garfield");
  assert.equal(f("GRUMPY CAT day"), "Grumpy Cat", "a phrase in capitals");
  assert.equal(f("#GrumpyCat forever"), "Grumpy Cat");
  // A phrase of everyday words counts only written as the figure's name (review): people describe their own cats this way.
  assert.equal(f("My grumpy cat Biscuit refuses to share the bed"), null);
  assert.equal(f("Grumpy cat this morning"), null);
  assert.equal(f("Our tom cat Oliver finally came home"), null, "a tom cat is any male cat");
  assert.equal(f("tom and jerry marathon"), null);
  assert.equal(f("floppa stares"), "Big Floppa", "one distinctive word in any case");
  // A term inside a sanctuary cat's name is dropped: Talking Tom's old name is "Talking Tom Cat".
  const home = watchList(WATCH, new Set(["talking tom", "talktom"]));
  assert.deepEqual(home.figures.find((x) => x.name === "Tom").terms, ["Tom and Jerry"]);
  assert.equal(figureIn("Talking Tom Cat just turned 16 and still repeats everything you say", home.figures), null);
  assert.deepEqual(watchList({ figures: [{ name: "Nyan Cat" }] }, new Set(["same-nyan"])).figures.map((x) => x.name), ["Nyan Cat"], "a hyphenated name is one word");
  assert.equal(figureIn("Same-nyan cat plush restock", watchList({ figures: [{ name: "Nyan Cat" }] }).figures), null);
  assert.deepEqual([isFigureName("Floppa", w.figures[0]), isFigureName("big floppa", w.figures[0]), isFigureName("Tom", w.figures[1]), isFigureName("Mochi", w.figures[1]), isFigureName("Cat", w.figures[3])],
    [true, true, true, false, false]);
  assert.deepEqual(watchList({ figures: [{ name: "Hello Kitty" }, { name: "Duchess", matchOnlyAliases: true }, { name: 'Bad "quote"', aliases: ["x"] }] }, new Set(["hello kitty"])).figures.map((x) => x.name),
    ['Bad quote'], "a sanctuary cat and a figure with only an unusable name are left out; quotes cannot reach a query");
  assert.deepEqual(watchList(undefined), { topAccounts: [], bigAccounts: [], memeAccounts: [], figures: [] });

  const x = fakeX({ search: () => reply(
    post("7001", "Floppa is judging you again", { likes: 30_000 }),
    post("7002", "Tom and Jerry reboot drops a new clip of the chase", { likes: 25_000, author: "u2" }),
    post("7003", "My cat Mochi is the best girl", { likes: 25_000, author: "u3" }),
    post("7004", "My cat Pip is watching Tom and Jerry again, she thinks she is Jerry", { likes: 40_000, author: "u3" }),
  ) });
  const t = await run({ posts: [], state: { nextLens: 3 } }, x);
  assert.equal(t.lens, "figures");
  const r1 = t.posts.find((p) => p.id === "7001");
  assert.deepEqual([r1.figure, r1.reading.catName, r1.reading.coinName, r1.reading.ticker, r1.reading.kind, r1.reading.nameFrom, r1.status],
    ["Big Floppa", "Big Floppa", "Big Floppa", "FLOPPA", "cartoon", "figure", "candidate"], "the figure's name and ticker win over the rules' Floppa, the figure's own word; a meme reads as cartoon");
  const r2 = t.posts.find((p) => p.id === "7002");
  assert.deepEqual([r2.reading.catName, r2.reading.ticker, r2.reading.kind, r2.reading.aboutOneCat], ["Tom", "TOMCAT", "cartoon", true]);
  const r3 = t.posts.find((p) => p.id === "7003");
  assert.deepEqual([r3.figure, r3.reading.catName, r3.reading.nameFrom], [undefined, "Mochi", undefined], "no figure named: the reading stands");
  const r4 = t.posts.find((p) => p.id === "7004");
  assert.deepEqual([r4.figure, r4.reading.catName, r4.reading.ticker, r4.reading.nameFrom, r4.status], ["Tom", "Pip", "PIP", undefined, "candidate"],
    "a different cat keeps its own name (review): the figure it mentions is only recorded");
  const sad = nameReading(cleanReading(readPostByRules({ text: "RIP Floppa, you were the best" })), "RIP Floppa, you were the best", { name: "Big Floppa", from: "figure", kind: "meme", override: true });
  assert.deepEqual([sad.catName, sad.sensitive, sad.aboutOneCat], ["Big Floppa", true, false], "the post's words still decide sensitive");
});

test("a name lent by the lens never overrules Claude saying the post is not about one cat (trend, figures and emerging lenses)", async () => {
  // The trend lens: Claude says the post is not about a cat; the trend's name is recorded, but it is no candidate.
  const trend = fakeX({ trends: [{ trend_name: "Pudding the Cat", tweet_count: 9 }], search: () => reply(post("6001", "Pudding at the vending machine again", { likes: 90_000 })) });
  const t1 = await run({ posts: [] }, trend, { client: claudeSays({ ...NOT_A_CAT, why: "a vending machine ad" }) });
  const p1 = t1.posts[0];
  assert.deepEqual([p1.lens, p1.reading.readBy, p1.reading.catName, p1.reading.aboutOneCat, p1.reading.kind, p1.status], ["trend", "claude", "Pudding", false, "none", "passed"]);
  assert.deepEqual(t1.candidates, []);
  // The figures lens: a hoodie ad that names Floppa.
  const figs = fakeX({ search: () => reply(post("6002", "Our new Floppa hoodie drops Friday in all sizes", { likes: 90_000 })) });
  const t2 = await run({ posts: [], state: { nextLens: 3 } }, figs, { client: claudeSays({ ...NOT_A_CAT, why: "a product ad" }) });
  assert.deepEqual([t2.lens, t2.posts[0].figure, t2.posts[0].reading.aboutOneCat, t2.posts[0].status], ["figures", "Big Floppa", false, "passed"]);
  // The emerging lens.
  const names = { zuzu: { name: "Zuzu", sightings: [{ at: hoursAgo(3), author: "a", post: "1", likes: 5 }, { at: hoursAgo(2), author: "b", post: "2", likes: 5 }] } };
  const em = fakeX({ search: () => reply(post("6003", "Zuzu is the name of my new band, first show Friday", { likes: 90_000 })) });
  const t3 = await run({ posts: [], state: { names } }, em, { client: claudeSays({ ...NOT_A_CAT, why: "a band" }) });
  assert.deepEqual([t3.lens, t3.posts[0].reading.catName, t3.posts[0].status], ["emerging", "Zuzu", "passed"]);
  // Claude saying it is about one cat, with no name it could read (it sees the picture): the trend's name makes it a candidate.
  const face = fakeX({ trends: [{ trend_name: "Pudding the Cat", tweet_count: 9 }], search: () => reply(post("6004", "This face though", { likes: 90_000 })) });
  const t4 = await run({ posts: [] }, face, { client: claudeSays({ aboutOneCat: true, catName: null, kind: "real", coinName: null, ticker: null, lore: "A cat making a face at the camera.", sensitive: false, why: "one cat, no name given" }) });
  assert.deepEqual([t4.posts[0].reading.catName, t4.posts[0].reading.nameFrom, t4.posts[0].status], ["Pudding", "trend", "candidate"]);
});

// Changed on purpose (review): a trend lends its name only when it has a cat's name's shape ("X the Cat", "#XTheCat",
// "#XCat") or the name is already tracked; a leading "Cat" is never stripped ("Cat Stevens"), so "pudding", "Cat Pudding",
// "#Nyanners" and "Señor Whiskers" alone no longer give a name.
test("trend names: '#PuddingTheCat' is Pudding; 'Grumpy Cat', 'Doja Cat' and 'Cat Stevens' are nobody; days and clubs are no cat", async () => {
  assert.equal(nameFromTrend("#PuddingTheCat"), "Pudding");
  assert.equal(nameFromTrend("Pudding the Cat"), "Pudding");
  assert.equal(nameFromTrend("#MochiKitten"), "Mochi", "one hashtag, a name and a cat word");
  assert.equal(nameFromTrend("Mochi Cat"), null, "written apart, 'X Cat' is as often a person or a description");
  assert.equal(nameFromTrend("Mochi Cat", new Set(), new Set(["mochi"])), "Mochi", "unless people have been writing 'my cat Mochi'");
  assert.equal(nameFromTrend("pudding"), null);
  assert.equal(nameFromTrend("pudding", new Set(), new Set(["pudding"])), "Pudding", "a trend with no cat word, when the name is tracked");
  assert.equal(nameFromTrend("Señor Whiskers", new Set(), new Set(["señor whiskers"])), "Señor Whiskers");
  for (const no of ["Grumpy Cat", "Black Cat", "#NationalCatDay", "#CatsOfTwitter", "Caturday", "猫の日", "#Cat", "Hello Kitty", "#Cat2026", "Mochi Pudding Taco Biscuit",
    "Doja Cat", "#DojaCat", "Cat Stevens", "#CatStevens", "Cat Power", "Kitty Pryde", "Cat Pudding", "#SleepyCat", "#LazyCat", "#FluffiestCat", "Dancing Cat", "Crying Cat",
    "Talking Cat", "Lucky Cat", "Cool Cat", "Kentucky Wildcats", "Catturd", "Catwoman", "Kat Graham", "Moo Deng", "#Nyanners", "Señor Whiskers"]) assert.equal(nameFromTrend(no), null, no);
  assert.equal(nameFromTrend("Doja Cat", new Set(), new Set(["doja"])), null, "Doja is never a cat's name");
  assert.equal(nameFromTrend("Hello Kitty", new Set(["hello kitty"])), "Hello Kitty", "a sanctuary cat's full name is kept, to be marked known");
  assert.equal(nameFromTrend("#TalkingTomCat", new Set(["talking tom"])), "Talking Tom", "so is a sanctuary cat's name before its cat word");

  const trendPost = () => reply(post("8001", "This face though", { likes: 50_000 }), post("8002", "This face though, Grumpy Cat forever", { likes: 50_000 }));
  const withFigure = fakeX({ trends: [{ trend_name: "Grumpy Cat", tweet_count: 9 }], search: trendPost });
  const t = await run({ posts: [] }, withFigure);
  const p = t.posts.find((x) => x.id === "8002");
  assert.deepEqual([p.trend, p.figure, p.reading.catName, p.reading.nameFrom, p.reading.kind], ["Grumpy Cat", "Grumpy Cat", "Grumpy Cat", "figure", "cartoon"]);
  assert.equal(t.posts.find((x) => x.id === "8001").reading.catName, null, "read by rules, a trend post must itself name the figure or mention a cat to borrow it");
  const noFigure = fakeX({ trends: [{ trend_name: "Grumpy Cat", tweet_count: 9 }], search: trendPost });
  const t2 = await run({ posts: [] }, noFigure, { watch: {} });
  assert.equal(t2.posts.find((x) => x.id === "8002").reading.catName, null, "not a plausible name alone, and no figure: no name");
  const known = fakeX({ trends: [{ trend_name: "Hello Kitty", tweet_count: 9 }], search: trendPost });
  const t3 = await run({ posts: [] }, known, { names: new Set(["hello kitty"]) });
  assert.ok(t3.lens !== "trend" && !known.searches[0].query.startsWith('"Hello Kitty"'), "already home: its trend is not searched");
});

test("X-only mode: trends that are no cat's name (a singer, a team, a hippo X files under animals) give no candidate", async () => {
  const cases = [
    [{ trends: [{ trend_name: "Cat Stevens", tweet_count: 900_000 }] }, "Wild World still hits different after all these years"],
    [{ trends: [{ trend_name: "Doja Cat", tweet_count: 900_000 }] }, "Doja Cat killed it tonight, what a performance"],
    [{ trends: [{ trend_name: "Kentucky Wildcats", tweet_count: 900_000 }] }, "Kentucky Wildcats win again, what a game tonight"],
    [{ personal: [{ trend_name: "Moo Deng", category: "Animals", post_count: "50K posts" }] }, "She bit the zookeeper again and everyone loves it"],
  ];
  for (const [lists, text] of cases) {
    const x = fakeX({ ...lists, search: () => reply(post("4001", text, { likes: 90_000 })) });
    const t = await run({ posts: [] }, x);
    assert.equal(t.lens, "trend", text);
    assert.deepEqual([t.posts[0].reading.catName, t.posts[0].status, t.candidates], [null, "passed", []], text);
  }
  // A cat trend whose posts do not say cat or the name: read by rules, they get no name.
  const x = fakeX({ trends: [{ trend_name: "#PuddingTheCat", tweet_count: 9 }], search: () => reply(post("4002", "What a performance at the VMAs tonight", { likes: 90_000 }), post("4003", "Pudding did it again", { likes: 90_000 })) });
  const t = await run({ posts: [] }, x);
  assert.deepEqual(t.posts.map((p) => [p.id, p.reading.catName, p.status]).sort(), [["4002", null, "passed"], ["4003", "Pudding", "candidate"]]);
});

test("name tracking: every post's cat names are recorded; two different accounts in 48 hours make a name emerging, and the next run follows it up", async () => {
  assert.deepEqual(namesIn("Meet Zuzu! #ZuzuTheCat #MochiCat #BlackCat #TheCat"), ["Zuzu", "Mochi"]);
  const answers = [
    reply(post("5001", "Meet Zuzu, she steals socks", { author: "u1", likes: 12 })),
    reply(post("5002", "#ZuzuTheCat strikes again", { author: "u1", likes: 30, h: 0 })),
    reply(post("5003", "#ZuzuTheCat is back and Jorts the cat too", { author: "u3", likes: 40, h: -1.5 }), post("5004", "Jorts the cat again", { author: "u2", h: -1.5 })),
  ];
  let i = 0;
  const x = fakeX({ search: (q) => (q.startsWith('"Zuzu"') ? reply(post("5005", "Zuzu stole the remote again, look at her", { author: "u2", likes: 40_000, h: 2 }), post("5006", "zuzu cake with my cat", { author: "u2", likes: 30_000 }), post("5007", "#ZuzuTheCat fan club", { author: "u2", likes: 3 })) : answers[i++] ?? { data: [] }) });
  const names = new Set(["jorts"]);
  let t = await run({ posts: [] }, x, { watch: {}, names });
  assert.deepEqual([t.state.names.zuzu.authors, t.state.names.zuzu.posts, t.state.names.zuzu.likes], [["biscuitmom"], ["5001"], 12], "recorded though it does not qualify");
  t = await run(t, x, { watch: {}, names, at: NOW + H });
  assert.deepEqual(emergingNames(t.state.names, { known: names, nowMs: NOW + H }), [], "the same account twice is not spreading");
  t = await run(t, x, { watch: {}, names, at: NOW + 2 * H });
  assert.deepEqual(t.state.names.zuzu.authors, ["catfan3", "biscuitmom"]);
  assert.equal(t.state.names.jorts.authors.length, 2);
  assert.deepEqual(emergingNames(t.state.names, { known: names, nowMs: NOW + 2 * H }).map((e) => e.name), ["Zuzu"], "Jorts is a sanctuary cat");
  t = await run(t, x, { watch: {}, names, at: NOW + 3 * H });
  assert.equal(t.lens, "emerging");
  assert.equal(t.state.followedUp.zuzu, new Date(NOW + 3 * H).toISOString());
  const z = t.posts.find((p) => p.id === "5005");
  assert.deepEqual([z.emerging, z.stage, z.reading.catName, z.reading.nameFrom, z.status], ["Zuzu", "viral", "Zuzu", "emerging", "candidate"]);
  assert.equal(t.posts.find((p) => p.id === "5006").reading.catName, null, "'zuzu' the cake: the name must be written as a name");
  assert.equal(t.state.names.zuzu.authors.length, 3, "the follow-up's posts are tracked too");
  const own = t.state.names.zuzu.sightings.filter((s) => ["5005", "5006", "5007"].includes(s.post));
  assert.ok(own.length && own.every((s) => s.via === "emerging:zuzu" && s.seen === new Date(NOW + 3 * H).toISOString()), "marked as found by its own follow-up");
  t = await run(t, x, { watch: {}, names, at: NOW + 4 * H });
  assert.equal(t.lens, "viral", "followed up an hour ago");
});

test("name tracking keeps to clear names: no adjectives, superlatives or sentence openings", () => {
  for (const text of ["Best cat ever!", "Top cat moments of the week", "Cutest kitten ever", "Cool cat alert", "Nothing is cuter than my cat", "Elon just posted his cat",
    "Life is better with a cat", "Mood is a cat", "#LazyCat #SleepyCat #FluffyCat #LuckyCat #DailyCat #RescueCat #ScaredyCat #FluffiestCat", "Grumpy cat this morning", "Doja Cat tonight"]) {
    assert.deepEqual(namesIn(text), [], text);
  }
  assert.deepEqual(namesIn("My cat Lulu met Jorts the cat, say hi to Pip. #KikiTheCat #BaoKitten").sort(), ["Bao", "Jorts", "Kiki", "Lulu", "Pip"], "the clear ways, every name in the post");
  assert.equal(readPostByRules({ text: "Nugget has learned to ring the doorbell" }).catName, "Nugget", "the rules' own reading is unchanged");
});

test("emerging names do not feed themselves: a follow-up's own finds never count, a new account elsewhere does; the big accounts keep their turns", async () => {
  // A name whose follow-ups keep finding it (by design) is followed up once, not every 12 hours.
  let n = 0;
  const x = fakeX({ search: (q) => (q.startsWith('"Zuzu"') ? reply(post(`f${++n}a`, "Meet Zuzu, the socks thief", { author: "u2" }), post(`f${n}b`, "#ZuzuTheCat strikes", { author: "u3" })) : { data: [] }) });
  const seed = (h = 3) => ({ zuzu: { name: "Zuzu", sightings: [{ at: hoursAgo(h), author: "a", post: "1", likes: 5, via: "viral" }, { at: hoursAgo(h - 1), author: "b", post: "2", likes: 5, via: "viral" }] } });
  let t = { posts: [], state: { names: seed() } };
  const lenses = [];
  for (let i = 0; i < 48; i++) { t = await run(t, x, { at: NOW + i * H }); lenses.push(t.lens); }
  assert.equal(lenses.filter((l) => l === "emerging").length, 1, "followed up once");
  assert.equal(lenses.filter((l) => l === "big").length, 24, "every other rotation turn");
  assert.equal(t.state.names.zuzu.authors.length, 4, "its follow-up's finds are recorded all the same");

  // A new account giving it through another search: followed up again, once 12 hours have passed since the last time.
  const y = fakeX({ search: (q) => (q.includes("from:") ? reply(post("g1", "Meet Zuzu, she found my socks", { author: "u1" })) : { data: [] }) });
  const a = await run({ posts: [], state: { names: seed(20), followedUp: { zuzu: hoursAgo(13) }, lastLens: "viral" } }, y);
  assert.deepEqual([a.lens, a.state.names.zuzu.authors.includes("biscuitmom")], ["big", true], "no new account since the follow-up: the rotation; its big-account search finds one");
  const b = await run(a, y, { at: NOW + H });
  assert.equal(b.lens, "emerging", "a new account since the follow-up 14 hours ago");
  const c = await run({ posts: [], state: { ...a.state, followedUp: { zuzu: hoursAgo(5) } } }, y, { at: NOW + H });
  assert.notEqual(c.lens, "emerging", "followed up 6 hours ago: it waits");

  // Names found on every search: emerging never takes two runs in a row, so the rotation (and the big accounts) keep turns.
  let id = 0;
  const pool = ["Zuzu", "Pip", "Nori", "Kiki", "Bao", "Toffee", "Waffles", "Pickles", "Mango", "Olive", "Sushi", "Poppy", "Mochi", "Tofu", "Biscuit", "Nugget"];
  const z = fakeX({ search: () => { const a1 = pool[id % pool.length], a2 = pool[(id + 1) % pool.length]; id += 2;
    return reply(post(`p${id}a`, `my cat ${a1} naps`, { author: "u1" }), post(`p${id}b`, `Meet ${a1} today`, { author: "u2" }), post(`p${id}c`, `my cat ${a2} naps`, { author: "u3" }), post(`p${id}d`, `Meet ${a2}!`, { author: "u1" })); } });
  let s = { posts: [] };
  const seq = [];
  for (let i = 0; i < 48; i++) { s = await run(s, z, { at: NOW + i * H }); seq.push(s.lens); }
  assert.ok(seq.some((l) => l === "emerging"), "names are followed up");
  assert.ok(seq.every((l, i) => i === 0 || !(l === "emerging" && seq[i - 1] === "emerging")), `never twice in a row: ${seq.join(" ")}`);
  assert.ok(seq.filter((l) => l === "big").length >= 12, "the big accounts at least every fourth run");
});

test("pruning: sightings older than 72 hours go, 20 kept a name, 300 names at most; old trend and follow-up times go; the state stays small", () => {
  const names = {
    old: { name: "Old", sightings: [{ at: hoursAgo(73), author: "a", post: "1", likes: 1 }] },
    mixed: { name: "Mixed", sightings: [{ at: hoursAgo(80), author: "a", post: "1", likes: 1 }, { at: hoursAgo(1), author: "b", post: "2", likes: 2 }] },
    busy: { name: "Busy", sightings: Array.from({ length: 25 }, (_, i) => ({ at: hoursAgo(i + 1), author: `a${i % 3}`, post: `p${i}`, likes: 1 })) },
  };
  const p = pruneNames(names, NOW);
  assert.deepEqual(Object.keys(p), ["mixed", "busy"]);
  assert.deepEqual([p.mixed.authors, p.mixed.posts, p.mixed.likes, p.mixed.firstSeen], [["b"], ["2"], 2, hoursAgo(1)]);
  assert.deepEqual([p.busy.sightings.length, p.busy.posts[0], p.busy.authors, p.busy.lastSeen, p.busy.firstSeen], [20, "p0", ["a0", "a1", "a2"], hoursAgo(1), hoursAgo(20)]);
  const many = Object.fromEntries(Array.from({ length: MAX_NAMES + 10 }, (_, i) => [`n${i}`, { name: `N${i}`, sightings: [{ at: new Date(NOW - i * 60_000).toISOString(), author: "a", post: `${i}`, likes: 0 }] }]));
  const kept = pruneNames(many, NOW);
  assert.equal(Object.keys(kept).length, MAX_NAMES);
  assert.ok(kept.n0 && kept[`n${MAX_NAMES - 1}`] && !kept[`n${MAX_NAMES}`], "the least recently seen go");
  const tracked = trackNames({}, reply(post("1", "Meet Zuzu", { h: 73 }), post("2", "Meet Kiki", { h: 71 })), NOW);
  assert.deepEqual(Object.keys(tracked), ["kiki"], "a post older than 72 hours is no sighting");
  const s = loadState({ nextLens: 9, bigChunk: -1, trendSearchedAt: { a: hoursAgo(25), b: hoursAgo(5) }, followedUp: { a: hoursAgo(73), b: hoursAgo(13) }, names }, NOW);
  assert.deepEqual([s.nextLens, s.bigChunk, s.figureChunk, Object.keys(s.trendSearchedAt), Object.keys(s.followedUp), Object.keys(s.names)], [1, 0, 0, ["b"], ["b"], ["mixed", "busy"]]);
  assert.equal(names.busy.sightings.length, 25, "the state read is not changed in place");
  assert.deepEqual([loadState({ lastLens: "emerging" }, NOW).lastLens, loadState({ lastLens: "bogus" }, NOW).lastLens, loadState(undefined, NOW).lastLens], ["emerging", null, null]);
});

test("an X failure: busy or down (429, 5xx) tries the same lens next run; a refused query (400) moves on", async () => {
  const busy = fakeX({ status: 429 });
  const t = await run({ posts: [] }, busy);
  assert.deepEqual([t.searchError, t.lens, t.state.nextLens], [429, "big", 0]);
  const bad = fakeX({ status: 400 });
  const t2 = await run(t, bad);
  assert.deepEqual([t2.searchError, t2.lens, t2.state.nextLens, t2.state.bigChunk], [400, "big", 1, 0]);
});

test("big accounts: any account with 1,000,000+ followers counts on any lens; top accounts take every other big turn", () => {
  const ans = (followers, text = "look at this cat", author = "zz") => ({
    data: [{ id: "7001", text, created_at: new Date(NOW - 2 * H).toISOString(), author_id: author, public_metrics: { like_count: 3 } }],
    includes: { users: [{ id: author, username: "SomeStar", name: "Star", public_metrics: { followers_count: followers } }] },
  });
  assert.deepEqual(qualify(ans(BIG_FOLLOWERS), NOW, { lens: "figures" }).map((p) => [p.stage, p.bigAccount]), [["big-account", "SomeStar"]], "not listed, but famous");
  assert.deepEqual(qualify(ans(BIG_FOLLOWERS - 1), NOW, { lens: "figures" }), [], "just under: thresholds and a picture apply");
  assert.deepEqual(qualify(ans(5_000_000, "big day at the office"), NOW, { lens: "viral" }), [], "a famous account's post must mention a cat");
  assert.deepEqual(qualify(ans(undefined), NOW, { lens: "viral" }), [], "unknown followers: not big");
  assert.deepEqual(bigQueries(["a1", "b1", "b2"], ["a1"]), ["(from:a1) " + BIG_TERMS + " -is:retweet", "(from:b1 OR from:b2) " + BIG_TERMS + " -is:retweet"]);
  const many = Array.from({ length: 60 }, (_, i) => `acct${String(i).padStart(3, "0")}xyz`);
  const qs = bigQueries(["top1", "top2", ...many], ["top1", "top2"]);
  assert.ok(qs.length >= 4 && qs.every((q) => q.length <= MAX_QUERY));
  qs.forEach((q, i) => assert.equal(q.includes("from:top1"), i % 2 === 0, `turn ${i}`));
  assert.deepEqual(bigQueries(["x1", "x2"]), ["(from:x1 OR from:x2) " + BIG_TERMS + " -is:retweet"], "no top list: as before");
});

test("data/cat-watch.json as shipped (edited by hand): whatever it holds, watchList cleans it and every query fits X's 512 characters", async () => {
  const fs = await import("node:fs");
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(new URL("../data/cat-watch.json", import.meta.url), "utf8").replace(/^\uFEFF/, "")); } catch { /* read as empty lists by the trend watch */ }
  const w = watchList(raw);
  for (const q of [...bigQueries(w.bigAccounts, w.topAccounts), ...figureQueries(w.figures)]) assert.ok(q.length <= MAX_QUERY, `${q.length} characters`);
  for (const odd of [{ topAccounts: ["@someone", "someone"], bigAccounts: ["someone"] }, { figures: [{ name: "Tom", aliases: ["Tom"], kind: "Cartoon" }] }, {}, [], null]) {
    const x = watchList(odd);
    for (const q of [...bigQueries(x.bigAccounts, x.topAccounts), ...figureQueries(x.figures)]) assert.ok(q.length <= MAX_QUERY);
  }
});

test("the watch list (the curated copy tests/fixtures/cat-watch.json): every query fits X's 512 characters and covers every handle and figure; no figure is a sanctuary cat", async () => {
  const fs = await import("node:fs");
  const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
  // The shipped data/cat-watch.json is edited by hand and only has to be readable (watchList cleans it; see the next test),
  // so its content never stops npm test or a Pages deploy; these rules are checked on the curated copy.
  const raw = JSON.parse(fs.readFileSync(new URL("./fixtures/cat-watch.json", import.meta.url), "utf8"));
  const sanctuary = [...read("adoptables.json").cats, ...read("planned.json").cats].flatMap((c) => [c.name, c.coinName, c.ticker, c.launchTicker]).filter(Boolean).map((s) => String(s).toLowerCase());
  const names = new Set(sanctuary);
  assert.ok(names.size > 100, "the sanctuary's names are read");
  const w = watchList(raw, names);
  assert.equal(w.bigAccounts.length, raw.topAccounts.length + raw.bigAccounts.length, "every handle is valid and listed once");
  assert.deepEqual(w.topAccounts, raw.topAccounts);
  assert.ok(!w.bigAccounts.some((h) => /^(BarackObama|JoeBiden|realDonaldTrump|POTUS|KamalaHarris)$/i.test(h)), "no politicians: politics is sensitive");
  assert.deepEqual(w.figures.map((f) => f.name), raw.figures.map((f) => f.name), "no figure is dropped as a sanctuary cat");
  for (const f of raw.figures) {
    for (const n of [f.name, ...(f.aliases || [])]) assert.ok(!names.has(n.toLowerCase()), `${n} is already in the sanctuary`);
    assert.ok(!names.has((f.ticker || tickerFor(f.name)).toLowerCase()), `${f.name}'s ticker is already a sanctuary ticker`);
    assert.ok(["cartoon", "fiction", "real", "meme"].includes(f.kind), f.name);
    if (f.matchOnlyAliases) assert.ok(f.aliases.length, `${f.name} needs aliases`);
    for (const a of f.aliases || []) assert.ok(a.includes(" ") || a.length > 5, `${a}: no single common word as an alias`);
  }
  for (const gone of ["Hello Kitty", "Mittens", "Azrael"]) assert.ok(names.has(gone.toLowerCase()) && !raw.figures.some((f) => f.name === gone), `${gone} lives in the sanctuary`);
  const big = bigQueries(w.bigAccounts, w.topAccounts), figs = figureQueries(w.figures);
  assert.ok(big.length >= 1 && figs.length >= 1);
  for (const q of [...big, ...figs]) assert.ok(q.length <= MAX_QUERY, `${q.length} characters: ${q}`);
  const has = (q, h) => new RegExp(`from:${h}[ )]`).test(q);
  for (const h of w.bigAccounts.filter((x) => !w.topAccounts.includes(x))) assert.equal(big.filter((q) => has(q, h)).length, 1, h);
  big.forEach((q, i) => assert.equal(w.topAccounts.some((h) => has(q, h)), i % 2 === 0, `turn ${i}: top accounts every other turn`));
  for (const f of w.figures) for (const term of f.terms) assert.equal(figs.filter((q) => q.includes(`"${term}"`)).length, 1, term);
  assert.ok(!figs.some((q) => q.includes('"Tom"') || q.includes('"Duchess"') || q.includes('"Happy Cat"')), "matchOnlyAliases names are not searched alone");
  for (const f of w.figures.filter((x) => x.needsCatWord)) assert.ok(figs.some((q) => q.includes(`("${f.name}" (cat OR cats OR kitten OR kitty))`)), `${f.name} is searched with a cat word`);
  // No figure is found inside a sanctuary cat's name, or that name with "Cat" after it (Talking Tom was "Talking Tom Cat").
  const sanctuaryNames = [...read("adoptables.json").cats, ...read("planned.json").cats].flatMap((c) => [c.name, c.coinName]).filter(Boolean);
  for (const n of sanctuaryNames) {
    for (const text of [n, `${n} Cat`, `#${n.replace(/[^\p{L}\p{N}]/gu, "")}Cat`]) assert.equal(figureIn(text, w.figures)?.name ?? null, null, `${text} names a figure`);
  }
  assert.equal(figureIn("Same-nyan cat plush restock", w.figures), null, "Same-nyan is a sanctuary cat, not Nyan Cat");
  // Everyday phrases and other cats are no figure.
  for (const text of ["Talking Tom Cat just turned 16 and still repeats everything you say", "Our tom cat Oliver finally came home", "Marie from The Aristocats is the most elegant kitten",
    "My grumpy cat Biscuit refuses to share the bed", "top cat energy today", "such a polite cat", "a spinning cat video", "my happy cat", "Andrew Garfield at the premiere"]) {
    assert.equal(figureIn(text, w.figures)?.name ?? null, null, text);
  }
  // (A figure the sanctuary's launcher launched has moved into the sanctuary and left the list: only the ones still listed are looked for.)
  const named = [["Grumpy Cat is back", "Grumpy Cat"], ["Tom and Jerry marathon", "Tom"], ["Floppa stares", "Big Floppa"], ["Garfield the cat hates Mondays", "Garfield"],
    ["OIIAI Cat on repeat", "OIIA Cat"], ["Happy Happy Happy Cat", "Happy Cat"]].filter(([, name]) => raw.figures.some((f) => f.name === name));
  assert.deepEqual(named.map(([text]) => figureIn(text, w.figures)?.name), named.map(([, name]) => name));
});

test("an approved post the search never found is looked up by id (one read each), read, and listed as a candidate; one too old, sensitive or without a picture is not", async () => {
  // A rescue's kitten post with few likes (no search lens would list it): fresh, a video still on pbs.twimg.com.
  const lookup = { data: [
    { id: "2001", text: "Meet Cupsey, the kitten who kept climbing into the coffee cup", created_at: hoursAgo(3), author_id: "u2", attachments: { media_keys: ["m2"] }, public_metrics: { like_count: 400, impression_count: 120_000 } },
    { id: "2002", text: "old cat", created_at: hoursAgo(MAX_AGE_HOURS + 1), author_id: "u2", attachments: { media_keys: ["m2"] }, public_metrics: {} },
    { id: "2003", text: "cat", created_at: hoursAgo(1), author_id: "u2", possibly_sensitive: true, attachments: { media_keys: ["m2"] }, public_metrics: {} },
    { id: "2004", text: "cat, no picture", created_at: hoursAgo(1), author_id: "u2", public_metrics: {} },
  ], includes: answer.includes };
  assert.deepEqual(approvedRows(lookup, NOW).map((p) => [p.id, p.stage, p.media[0].url]), [["2001", "approved", "https://pbs.twimg.com/ext/b.jpg"]]);
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    if (url.startsWith("https://api.x.com/2/tweets?")) return new Response(JSON.stringify(lookup));
    if (url.startsWith("https://api.dexscreener.com/")) return new Response(JSON.stringify({ pairs: [] }));
    throw new Error(`unexpected ${url}`);
  };
  const before = { posts: [{ id: "1001", postedAt: hoursAgo(5), status: "candidate" }], candidates: ["1001"], reads: { day: "2026-09-27", dayUsed: 10, month: "2026-09", monthUsed: 100 } };
  const cupsey = { aboutOneCat: true, catName: "Cupsey", kind: "real", coinName: "Cupsey", ticker: "CUPSEY", lore: "Cupsey kept climbing into the coffee cup.", sensitive: false, why: "one named cat" };
  const r = await withApproved(before, { approvals: new Set(["1001", "2001", "2002", "2003", "2004"]), creds: CREDS, client: claudeSays(cupsey), fetchImpl, nowMs: NOW });
  assert.deepEqual(r.added, ["2001"]);
  const ids = new URL(asked[0]).searchParams.get("ids").split(",");
  assert.deepEqual(ids, ["2001", "2002", "2003", "2004"], "only the approvals not already read");
  assert.deepEqual(r.trending.candidates, ["2001", "1001"]);
  const row = r.trending.posts.find((p) => p.id === "2001");
  assert.deepEqual([row.status, row.stage, row.reading.catName, row.url], ["candidate", "approved", "Cupsey", "https://x.com/mochi/status/2001"]);
  assert.equal(r.trending.reads.dayUsed, 14, "one read per post X returned");
  // Nothing to look up, no X secrets, or no reads left: nothing asked, nothing changed.
  for (const opts of [{ approvals: new Set(["1001"]), creds: CREDS }, { approvals: new Set(["2001"]), creds: null }, { approvals: new Set(["2001"]), creds: CREDS, monthlyReads: 100 }]) {
    asked.length = 0;
    const same = await withApproved(before, { ...opts, client: null, fetchImpl, nowMs: NOW });
    assert.deepEqual([same.added, asked.length, same.trending.posts.length], [[], 0, 1], JSON.stringify([...opts.approvals]));
  }
  // X refusing the lookup: nothing listed, tried again next run.
  const refused = await withApproved(before, { approvals: new Set(["2001"]), creds: CREDS, client: null, fetchImpl: async () => new Response("{}", { status: 503 }), nowMs: NOW });
  assert.deepEqual(refused.added, []);
});

/* ---------- meme cats: the owner's kind of coin (Foot Cat, Wiwiwi Cat) ---------- */

test("meme cats: a cat-meme account's post needs no cat word; Claude's meme name names a real cat with no name of its own; never a face", async () => {
  // The queries: every post with a picture, no cat word; woven into the big lens after every second big query.
  const [mq] = memeQueries(["catfan3", "@bad handle"].filter((h) => /^\w+$/.test(h)));
  assert.match(mq, /^\(from:catfan3\) has:media /);
  assert.ok(!/\bcat OR\b/.test(mq), "no cat word needed");
  assert.deepEqual(bigTurns(["b1", "b2", "b3"], ["m1"]), ["b1", "b2", "m1", "b3", "m1"]);
  assert.deepEqual(bigTurns(["b1"], []), ["b1"]);
  assert.deepEqual(bigTurns([], ["m1"]), ["m1"]);
  assert.deepEqual(watchList({ memeAccounts: ["KittiesVids", "@kittiesvids", "no way!"] }).memeAccounts, ["KittiesVids"]);
  assert.deepEqual(watchList({ memeAccounts: ["KittiesVids"] }).bigAccounts, [], "a meme account is not a big account by being listed");

  // The reading: a meme name only in its shape; a face is kept; memeNamed names only a real, unnamed, harmless cat.
  const FOOT = { aboutOneCat: true, catName: null, memeName: "Foot Cat", personFace: false, kind: "real", coinName: null, ticker: "FOOTCAT", lore: "A cat sits inside a giant cat's foot.", sensitive: false, why: "a cat meme" };
  assert.equal(cleanReading({ ...FOOT, memeName: "the cat" }).memeName, null);
  assert.equal(cleanReading({ ...FOOT, memeName: "Foot Cat $FOOT" }).memeName, null);
  assert.equal(cleanReading(FOOT).memeName, "Foot Cat");
  const named = memeNamed(cleanReading(FOOT));
  assert.deepEqual([named.catName, named.coinName, named.ticker, named.nameFrom], ["Foot Cat", "Foot Cat", "FOOTCAT", "meme"]);
  assert.equal(memeNamed(cleanReading({ ...FOOT, ticker: null })).ticker, tickerFor("Foot Cat"));
  assert.equal(memeNamed(cleanReading({ ...FOOT, catName: "Mochi" })).catName, "Mochi", "its own name wins");
  assert.equal(memeNamed(cleanReading({ ...FOOT, kind: "cartoon" })).catName, null, "a drawn cat is never named by a meme");
  assert.equal(memeNamed(cleanReading({ ...FOOT, sensitive: true })).catName, null);
  assert.equal(isCandidate({ reading: named, known: false }), true);
  assert.equal(isCandidate({ reading: { ...named, personFace: true }, known: false }), false, "a face in the picture: never a candidate");
  assert.equal(cleanReading({ ...FOOT, personFace: undefined }).personFace, false, "the rules' reading has no face check");

  // A whole run: the big lens's meme turn finds a viral post with no words; Claude reads its picture and names it.
  const watch = { bigAccounts: ["elonmusk"], memeAccounts: ["catfan3"], figures: [] };
  const x = fakeX({ search: () => reply(post("901", "", { author: "u3", likes: 20_000, h: 3 }), post("902", "wiwiwi", { author: "u3", likes: 9_000, h: 2 })) });
  const t = await run({ posts: [], state: { nextLens: 0, bigChunk: 1 } }, x, { watch, client: claudeSays((text) => (text.endsWith("wiwiwi") ? { ...FOOT, memeName: "Wiwiwi Cat", ticker: "WIWIWI", personFace: true } : FOOT)) });
  assert.match(x.searches[0].query, /^\(from:catfan3\) has:media /);
  const byId = Object.fromEntries(t.posts.map((p) => [p.id, p]));
  assert.equal(byId["901"].status, "candidate");
  assert.deepEqual([byId["901"].reading.catName, byId["901"].reading.ticker, byId["901"].reading.nameFrom], ["Foot Cat", "FOOTCAT", "meme"]);
  assert.equal(byId["902"].status, "passed", "a face in the picture");
  assert.deepEqual(t.candidates, ["901"]);
  // Without Claude, a post with no cat word cannot be judged: it is not read.
  const t2 = await run({ posts: [], state: { nextLens: 0, bigChunk: 1 } }, fakeX({ search: () => reply(post("903", "", { author: "u3", likes: 20_000 })) }), { watch });
  assert.equal(t2.posts.length, 0);
});
