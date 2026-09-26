import { sf } from "./sf.mjs";
const SPYX = "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W";
const r = {};
// 1. token by mint (a launchlab standard adopted token, a 404)
let x = await sf("/tokens/DQVN3GbQ8ETcFERzRLJZow11yqMQ3xtSnLvNHhVkQ6K5", { save: "token-DQVN-launchlab" });
r.tokenKeys = { token: Object.keys(x.json?.data?.token ?? {}), launch: Object.keys(x.json?.data?.launch ?? {}), data: Object.keys(x.json?.data ?? {}) };
x = await sf("/tokens/11111111111111111111111111111111", { save: "token-404-system" });
r.token404 = { status: x.status, body: x.text.slice(0, 300) };
x = await sf("/tokens/notamint", { save: "token-400-bad" });
r.token400 = { status: x.status, body: x.text.slice(0, 300) };
// 2. tokens list filtered by quote, newest
x = await sf(`/tokens?quoteMint=${SPYX}&sort=newest&pageSize=100`, { save: "tokens-quote-SPYx-newest-100" });
r.tokensQuote = { status: x.status, dataKeys: Object.keys(x.json?.data ?? {}), meta: x.json?.meta, n: x.json?.data?.tokens?.length, pagination: x.json?.data?.pagination, first: x.json?.data?.tokens?.[0], itemKeys: Object.keys(x.json?.data?.tokens?.[0] ?? {}) };
// 3. sort values: try invalid to read the error
x = await sf(`/tokens?sort=bogus&pageSize=1`, { save: "tokens-sort-bogus" });
r.sortBogus = { status: x.status, body: x.text.slice(0, 400) };
x = await sf(`/tokens?mode=bogus&pageSize=1`, { save: "tokens-mode-bogus" });
r.modeBogus = { status: x.status, body: x.text.slice(0, 400) };
// 4. search
x = await sf(`/tokens?q=PATCHPAW&pageSize=100`, { save: "tokens-q-PATCHPAW" });
r.qPatchpaw = { status: x.status, n: x.json?.data?.tokens?.length, pagination: x.json?.data?.pagination };
x = await sf(`/tokens?q=NONSOL&pageSize=100`, { save: "tokens-q-NONSOL" });
r.qNonsol = { status: x.status, n: x.json?.data?.tokens?.length, hits: (x.json?.data?.tokens ?? []).map(t => [t.symbol, t.name, t.mint, t.quote?.symbol, t.createdAt]) };
// 5. launches since 1h ago
const since = new Date(Date.now() - 3600_000).toISOString();
x = await sf(`/launches?since=${encodeURIComponent(since)}&pageSize=100`, { save: "launches-since-1h-p1" });
r.launches1h = { status: x.status, pagination: x.json?.data?.pagination, n: x.json?.data?.launches?.length, itemKeys: Object.keys(x.json?.data?.launches?.[0] ?? {}) };
x = await sf(`/launches?since=${encodeURIComponent(since)}&mode=standard&pageSize=100`, { save: "launches-since-1h-standard-p1" });
r.launches1hStd = { status: x.status, pagination: x.json?.data?.pagination };
// 6. CORS with our origin
x = await sf(`/tokens?pageSize=1&sort=newest`, { save: "tokens-origin-catcoinsanctuary", origin: "https://catcoinsanctuary.com" });
r.cors = x.headers;
// 7. category filter
x = await sf(`/tokens?category=xstock&sort=newest&pageSize=100`, { save: "tokens-category-xstock-newest-100" });
r.catXstock = { status: x.status, pagination: x.json?.data?.pagination, newest: x.json?.data?.tokens?.[0]?.createdAt, oldestOnPage: x.json?.data?.tokens?.at(-1)?.createdAt };
x = await sf(`/tokens?category=backpack&sort=newest&pageSize=100`, { save: "tokens-category-backpack-newest-100" });
r.catBackpack = { status: x.status, pagination: x.json?.data?.pagination, newest: x.json?.data?.tokens?.[0]?.createdAt, oldestOnPage: x.json?.data?.tokens?.at(-1)?.createdAt };
x = await sf(`/tokens?category=prestock&sort=newest&pageSize=100`, { save: "tokens-category-prestock-newest-100" });
r.catPrestock = { status: x.status, pagination: x.json?.data?.pagination, newest: x.json?.data?.tokens?.[0]?.createdAt, oldestOnPage: x.json?.data?.tokens?.at(-1)?.createdAt };
console.log(JSON.stringify(r, null, 1));
