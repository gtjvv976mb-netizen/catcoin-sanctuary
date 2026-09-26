import fs from "node:fs";
import path from "node:path";
const REPO = "/home/user/Cat-Intelligence-Agency";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { detectCat } = await import(`${REPO}/bots/lib/catdetect.mjs`);
const J = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8"));
const unpinned = J("scan-unpinned.json"), pinned = J("scan-pinned.json"), cases = J("cases.json");
const list = J("list-unpinned.json");
const KEEP = new Set(["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]);
/* The icon and the social links are not kept: the scout reads neither, and one project's link
   text matched the pattern test-agent-no-leak.mjs holds every file to. */
const LINKS = ["icon", "website", "twitter", "telegram", "discord", "otherUrl", "instagram", "tiktok"];
const strip = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => !LINKS.includes(k)));
const rows = list.filter((t) => detectCat({ name: t.name, symbol: t.symbol }).isCat || KEEP.has(t.id)).map(strip);
const cats = rows.filter((t) => detectCat({ name: t.name, symbol: t.symbol }).isCat).length;
console.log("rows", rows.length, "cats", cats, "kept others", rows.filter((t) => KEEP.has(t.id)).map((t) => t.symbol).join(","));
const at = new Date(unpinned.report.at).toISOString();
const w = (name, obj) => { const p = path.join(REPO, "fixtures", "agent", name); fs.writeFileSync(p, JSON.stringify(obj, null, 1) + "\n"); console.log(name, (fs.statSync(p).size / 1024).toFixed(0), "KB"); };

w("jupiter-verified-cats.json", {
  note: `GET ${unpinned.log.list.url} — live answer, read by the scout's own scan (src/lib/agent-scout.mjs) through the bots' paced client; trimmed to the ${cats} rows that are cats by bots/lib/catdetect.mjs (their name or ticker) and three that are not (JUP, WIF, USDC), each row whole but for its icon and its social links (website, twitter, telegram, discord, instagram, tiktok, otherUrl), which the scout never reads; nothing else edited. The whole answer was ${unpinned.log.list.bytes.toLocaleString("en-US")} bytes and ${list.length.toLocaleString("en-US")} rows. A replay pads the list back to \`count\` with rows that are not cats, which the scan counts and drops at its first gate exactly as it dropped the real ones.`,
  capturedAt: unpinned.log.list.at, source: unpinned.log.list.url, status: unpinned.log.list.status, count: list.length, bytes: unpinned.log.list.bytes, cacheControl: unpinned.log.list.cacheControl, date: unpinned.log.list.date,
  earlierRead: { capturedAt: pinned.log.list.at, bytes: pinned.log.list.bytes, note: "the same URL a minute earlier, for the scan with the preset pinned (not kept: its cat rows passed and failed the same gates)" },
  rows,
});

w("jupiter-search-cat-cluster.json", {
  note: `GET ${cases.cluster.url} — live answer, three cat-named Token-2022 coins that are NOT verified, each reporting millions of dollars of "liquidity" against a few thousand of market cap and a handful of holders; rows whole but for their icons and social links; nothing else edited.`,
  capturedAt: cases.cluster.at, source: cases.cluster.url, status: cases.cluster.status, rows: cases.cluster.body.map(strip),
});

const scanRead = (s) => ({ at: s.log.rpc[0].at, commitment: s.log.rpc[0].commitment, slot: s.log.rpc[0].slot, addresses: s.log.rpc[0].addresses, accounts: s.log.rpc[0].accounts });
w("scout-mints.json", {
  note: "POST https://api.mainnet-beta.solana.com getMultipleAccounts (base64, confirmed) — live answers: `named`, six mints read for the chain gates' cases; `scans`, the one read each recorded scan made of the coins that passed Jupiter's figures, in the order it asked. Accounts as the node answered them; nothing edited.",
  rpc: "https://api.mainnet-beta.solana.com",
  named: { readAt: cases.mints.readAt, slot: cases.mints.slot, accounts: cases.mints.accounts,
    cases: { POPCAT: "passes", VIBE: "passes on chain (Jupiter gives it no 24-hour volume: scout_unmeasured before it is read)", CATWIF: "passes on chain (Token-2022, metadata only); scout_copycat of catwifhat by its name",
      ZCAT: "scout_mint_unsupported: TransferFeeConfig", INBRED: "scout_mint_authority: its mint account still names a mint authority (the all-zero address) where Jupiter's audit says mintAuthorityDisabled",
      CASHCAT: "scout_mint_authority", freezeAuthority: "USDC's own bytes in fixtures/agent/cats-verified.json (its issuer's freeze authority)" } },
  scans: { unpinned: scanRead(unpinned), pinned: scanRead(pinned) },
});

const jlog = (s) => s.log.jupiter.map((x) => ({ at: x.at, url: x.url, status: x.status, body: x.body }));
w("jupiter-scout-quotes-cats.json", {
  note: "GET https://api.jup.ag/swap/v1/quote — live answers. `scans`: every quote the two recorded scans asked, in order, as the scout asks them (the agent's way: direct first, then one hop through SOL at maxAccounts 24 only on a no-route answer; background priority, so a request found no free slot is retried by the scan and never reached Jupiter), with the report each scan returned. `cases`: CATWIF and CATCOIN quoted the agent's way, buy of 25 USDC and the sell of its output. `unbounded`: the four coins that had no route within 24 accounts, asked the hop's way once more with maxAccounts left out, to see why. Nothing edited.",
  capturedAt: at, sizeUsd: 25, slippageBps: 100,
  scans: {
    unpinned: { input: unpinned.input, requests: jlog(unpinned), report: unpinned.report, tookMs: unpinned.took },
    pinned: { input: pinned.input, requests: jlog(pinned), report: pinned.report, tookMs: pinned.took },
  },
  cases: cases.quotes, unbounded: cases.unbounded.map((u) => ({ symbol: u.symbol, mint: u.mint, url: u.url, status: u.status, body: u.body })),
  casesLog: cases.log.map((x) => ({ at: x.at, url: x.url, status: x.status })),
});
