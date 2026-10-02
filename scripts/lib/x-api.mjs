/**
 * The X API, as the sanctuary's announcer uses it: OAuth 1.0a user context (HMAC-SHA1), one
 * image upload and one post. No dependencies. `fetchImpl` is injectable so tests never reach X.
 *
 *   POST https://api.x.com/2/media/upload            (multipart, v2; falls back to v1.1 below)
 *   POST https://upload.twitter.com/1.1/media/upload.json
 *   POST https://api.x.com/2/tweets                  (JSON body: text, media, reply)
 *
 * JSON and multipart bodies are not part of the OAuth 1.0a signature base string, so only the
 * oauth_* parameters (and any query string) are signed.
 */
import crypto from "node:crypto";

const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** The Authorization header for one request. `nonce` and `timestamp` are injectable for tests. */
export function oauthHeader(method, url, creds, { nonce = crypto.randomBytes(16).toString("hex"), timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const u = new URL(url);
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const params = [...Object.entries(oauth), ...u.searchParams.entries()].map(([k, v]) => [enc(k), enc(v)]).sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1));
  const base = [method.toUpperCase(), enc(`${u.origin}${u.pathname}`), enc(params.map(([k, v]) => `${k}=${v}`).join("&"))].join("&");
  const key = `${enc(creds.apiSecret)}&${enc(creds.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.entries(oauth).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(", ");
}

/** The four secrets from the environment, or null when any is missing. */
export function credsFromEnv(env = process.env) {
  const t = (v) => (typeof v === "string" ? v.trim() : v); // a pasted secret often carries a stray space or newline
  const c = { apiKey: t(env.X_API_KEY), apiSecret: t(env.X_API_SECRET), accessToken: t(env.X_ACCESS_TOKEN), accessSecret: t(env.X_ACCESS_SECRET) };
  return Object.values(c).every((v) => typeof v === "string" && v.trim()) ? c : null;
}

export class XError extends Error {
  constructor(message, status, body) { super(message); this.name = "XError"; this.status = status; this.body = body; }
}

async function call(fetchImpl, method, url, creds, init = {}) {
  const res = await fetchImpl(url, { method, ...init, headers: { ...(init.headers || {}), Authorization: oauthHeader(method, url, creds) } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new XError(`X API ${method} ${new URL(url).pathname}: HTTP ${res.status}`, res.status, body);
  return body;
}

/** Upload one image (a Buffer); returns its media id string. */
export async function uploadImage(bytes, mime, creds, fetchImpl = fetch) {
  const form = () => { const f = new FormData(); f.append("media", new Blob([bytes], { type: mime }), "card.jpg"); f.append("media_category", "tweet_image"); return f; };
  try {
    const b = await call(fetchImpl, "POST", "https://api.x.com/2/media/upload", creds, { body: form() });
    const id = b?.data?.id ?? b?.id ?? b?.media_id_string;
    if (id) return String(id);
  } catch (e) { if (!(e instanceof XError) || e.status === 401) throw e; }
  const b = await call(fetchImpl, "POST", "https://upload.twitter.com/1.1/media/upload.json", creds, { body: form() });
  if (!b?.media_id_string) throw new XError("X media upload returned no media id", 200, b);
  return b.media_id_string;
}

/** Post; returns the new post's id. */
export async function createPost({ text, mediaIds = [], replyTo = null, quote = null }, creds, fetchImpl = fetch) {
  const payload = { text };
  if (mediaIds.length) payload.media = { media_ids: mediaIds };
  if (replyTo) payload.reply = { in_reply_to_tweet_id: replyTo };
  if (quote) payload.quote_tweet_id = quote;
  const b = await call(fetchImpl, "POST", "https://api.x.com/2/tweets", creds, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const id = b?.data?.id;
  if (!id) throw new XError("X returned no post id", 200, b);
  return String(id);
}

/** The account the keys act for (GET /2/users/me). */
export async function whoAmI(creds, fetchImpl = fetch) {
  return call(fetchImpl, "GET", "https://api.x.com/2/users/me", creds);
}

/** The id of an account's most recent post (GET /2/users/:id/tweets). */
export async function getLatestOwnPostId(userId, creds, fetchImpl = fetch) {
  const b = await call(fetchImpl, "GET", `https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets?max_results=5`, creds);
  return b?.data?.[0]?.id ?? null;
}

/** Up to 100 posts with their public figures (GET /2/tweets?ids=…&tweet.fields=public_metrics). */
export async function getPosts(ids, creds, fetchImpl = fetch) {
  return call(fetchImpl, "GET", `https://api.x.com/2/tweets?ids=${ids.slice(0, 100).map(encodeURIComponent).join(",")}&tweet.fields=public_metrics`, creds);
}

/** Up to 100 posts by id with their figures, media and authors, as searchRecent gives them (GET /2/tweets?ids=…): one read each. */
export async function lookupPosts(ids, creds, fetchImpl = fetch) {
  const q = new URLSearchParams({
    ids: ids.slice(0, 100).join(","),
    "tweet.fields": "public_metrics,created_at,author_id,attachments,lang,possibly_sensitive,note_tweet",
    expansions: "attachments.media_keys,author_id",
    "media.fields": "type,url,preview_image_url,width,height",
    "user.fields": "username,name,public_metrics",
  });
  return call(fetchImpl, "GET", `https://api.x.com/2/tweets?${q}`, creds);
}

/** Recent posts (last 7 days) matching a search query, with their figures, media and authors
 *  (GET /2/tweets/search/recent; needs an X plan whose keys may search, Basic or above). */
/** What is trending on X in one place (WOEID: 1 worldwide, 23424977 the US, 23424856 Japan): { data: [{ trend_name, tweet_count }] }. */
export async function getTrends(woeid, creds, fetchImpl = fetch) {
  return call(fetchImpl, "GET", `https://api.x.com/2/trends/by/woeid/${encodeURIComponent(woeid)}?max_trends=50&trend.fields=trend_name,tweet_count`, creds);
}

/** What X shows the account as trending "for you": { data: [{ trend_name, category, post_count, trending_since }] }. */
export async function getPersonalizedTrends(creds, fetchImpl = fetch) {
  return call(fetchImpl, "GET", "https://api.x.com/2/users/personalized_trends?personalized_trend.fields=category,post_count,trend_name,trending_since", creds);
}

export async function searchRecent(query, creds, fetchImpl = fetch, { maxResults = 100, sort = "relevancy" } = {}) {
  const q = new URLSearchParams({
    query, max_results: String(maxResults), sort_order: sort,
    "tweet.fields": "public_metrics,created_at,author_id,attachments,lang,possibly_sensitive,note_tweet",  // note_tweet: a long post's full text (text holds its first 280 characters)
    expansions: "attachments.media_keys,author_id",
    "media.fields": "type,url,preview_image_url,width,height",
    "user.fields": "username,name,public_metrics",
  });
  return call(fetchImpl, "GET", `https://api.x.com/2/tweets/search/recent?${q}`, creds);
}
