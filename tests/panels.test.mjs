/* The About and Socials panels, and data/socials.json: only https links on known hosts show,
   empty ones stay hidden, and both panels are modal dialogs the page opens from its own pills.
   About's "Holder rewards" section (assets/ui/rewards.js): its words and age bonus are the rules'
   own (scripts/lib/rewards.mjs), it reads the files the Rewards workflow writes (a scenario is run
   through the real rules and shown), and a file that does not read is never shown. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ROOT } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { checkSocials, socialLinks, safeSocialUrl, isMint, createPanels, SOCIAL_HOSTS } from "../assets/ui/panels.js";
import {
  REWARDS_TEXT, REWARDS_EXCLUDED, HALF_AGE, ageBonus, checkLedger, checkState, excludedWallets, periodPoints, lastPayout,
  solText, bonusText, whenText, walletReport, fetchRewards, createRewards, rewardsText, DEFAULT_RULES,
} from "../assets/ui/rewards.js";
import * as R from "../scripts/lib/rewards.mjs";
import { isOnCurve } from "../scripts/lib/solana-tx.mjs";
import { TOKEN_2022_PROGRAM } from "../scripts/lib/programs.mjs";
import { base58Encode } from "../assets/collection.js";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const SOCIALS = JSON.parse(read("data/socials.json"));

test("data/socials.json is valid: https only, allowed hosts, the $CATSANC ticker", () => {
  assert.deepEqual(checkSocials(SOCIALS), []);
  assert.equal(SOCIALS.ticker, "$CATSANC");
  for (const l of SOCIALS.links) if (l.url) {
    const u = new URL(l.url);
    assert.equal(u.protocol, "https:", l.id);
    assert.ok(SOCIAL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)), `${l.id}: ${u.hostname}`);
  }
  const ids = SOCIALS.links.map((l) => l.id);
  for (const id of ["website", "x", "telegram"]) assert.ok(ids.includes(id), `socials.json lists ${id}`);
  assert.equal(SOCIALS.links.find((l) => l.id === "website").url, "https://catcoinsanctuary.com/");
});

test("social links: only https on an allowed host; empty ones are hidden", () => {
  assert.equal(safeSocialUrl("https://x.com/catcosanctuary"), "https://x.com/catcosanctuary");
  assert.equal(safeSocialUrl("https://t.me/+x58u0_NhAAZlMTZl"), "https://t.me/+x58u0_NhAAZlMTZl", "a Telegram invite link");
  assert.equal(safeSocialUrl("https://dexscreener.com/solana/abc"), "https://dexscreener.com/solana/abc");
  for (const bad of ["", "   ", "http://x.com/a", "javascript:alert(1)", "https://evil.example/x.com", "https://x.com.evil.example/", "https://user:pw@x.com/", "https://x.com:8443/", "//x.com/a", "data:text/html,hi", 42, null]) {
    assert.equal(safeSocialUrl(bad), null, String(bad));
  }
  const cfg = { links: [
    { id: "website", label: "Website", url: "https://catcoinsanctuary.com/" },
    { id: "x", label: "X", url: "" },
    { id: "bad", label: "Bad", url: "http://pump.fun/coin" },
  ] };
  assert.deepEqual(socialLinks(cfg).map((l) => l.id), ["website"]);
  assert.ok(checkSocials(cfg).some((p) => /not an https address/.test(p)), "an http link is reported");
  assert.ok(checkSocials({ links: [{ id: "a", label: "A", url: "" }, { id: "a", label: "B", url: "" }] }).some((p) => /repeats/.test(p)));
  assert.ok(checkSocials({ links: [], contract: "not-a-mint" }).length);
  assert.ok(checkSocials({ links: [], ticker: "SANC" }).length, "a ticker without $");
  assert.ok(isMint("45ByChvJhwVFBP9pzZDvsByfoepRnmRMRNhXE6SD2Wjc"));
  assert.ok(!isMint("0OIl"));
});

function dialog() {
  const d = new Element("dialog");
  d.open = false;
  d.showModal = () => { d.open = true; };
  d.close = () => { d.open = false; };
  return d;
}
const links = (root) => root.querySelectorAll("a").map((a) => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent }));

test("the About and Socials panels: modal dialogs with a title, a close button and the right content", () => {
  const remove = installDom();
  globalThis.location = { host: "catcoinsanctuary.com" };
  try {
    const about = dialog(), socials = dialog();
    let disclaimers = 0;
    const p = createPanels({ about, socials, config: SOCIALS, onDisclaimers: () => disclaimers++ });
    p.openAbout();
    assert.ok(about.open, "About opens as a modal dialog");
    assert.equal(about.getAttribute("aria-labelledby"), "about-title");
    assert.match(about.textContent, /A home for adoptable cats/);
    assert.match(about.textContent, /Where all catcoins live/);
    const logo = about.querySelector("img.panel-logo");
    assert.equal(logo?.getAttribute("src"), "assets/brand/wordmark-480.webp", "About opens with the logo");
    assert.equal(logo.getAttribute("alt"), "Catcoin Sanctuary");
    assert.match(about.textContent, /companies, personalities, shows, movies and crypto projects/);
    assert.match(about.textContent, /real, verified lore \(X posts and sources\)/);
    assert.match(about.textContent, /under \$50k/);
    assert.match(about.textContent, /Hall of Fame: legendary cat coins that already exist/);
    assert.match(about.textContent, /\$CATSANC/);
    assert.match(about.textContent, /StonkFun/);
    assert.ok(!/\$SANCTUARY/.test(about.textContent));
    // Its one link, until a payout is made, is the rewards ledger on this site.
    assert.deepEqual(links(about).map((l) => l.href), ["data/rewards/ledger.json"], "About has no outbound links");
    const close = about.querySelector("button.finder-close");
    assert.match(close.getAttribute("aria-label"), /Close About/);
    close.click();
    assert.ok(!about.open, "the close button closes it");
    p.openAbout();
    about.querySelectorAll("button.panel-link").find((b) => b.textContent === "Read the disclaimers").click();
    assert.equal(disclaimers, 1, "the disclaimers button opens the disclaimers");
    assert.ok(!about.open);

    p.openSocials();
    assert.ok(socials.open);
    const shown = links(socials);
    assert.deepEqual(shown.map((l) => l.href), SOCIALS.links.filter((l) => l.url).map((l) => l.url), "every filled-in link, in order, and no empty one");
    for (const l of shown) { assert.equal(l.target, "_blank"); assert.equal(l.rel, "noopener noreferrer"); }
    assert.ok(shown.some((l) => l.href === "https://x.com/catcosanctuary"));
    assert.ok(shown.some((l) => l.href === "https://t.me/+x58u0_NhAAZlMTZl"));

    // A config with a bad link keeps it off the page.
    p.setConfig({ links: [{ id: "website", label: "Website", url: "https://catcoinsanctuary.com/" }, { id: "x", label: "X", url: "https://evil.example/" }] });
    assert.deepEqual(links(socials).map((l) => l.href), ["https://catcoinsanctuary.com/"]);
  } finally { delete globalThis.location; remove(); }
});

test("the page has About and Socials pills that open dialogs", () => {
  const html = read("index.html");
  assert.match(html, /<button class="pill" id="about-open" type="button" aria-haspopup="dialog"/);
  assert.match(html, /<button class="pill" id="socials-open" type="button" aria-haspopup="dialog"/);
  assert.match(html, /<dialog class="finder panel" id="about" aria-labelledby="about-title"><\/dialog>/);
  assert.match(html, /<dialog class="finder panel" id="socials" aria-labelledby="socials-title"><\/dialog>/);
  const main = read("assets/ui/main.js");
  assert.match(main, /fetch\("data\/socials\.json"\)/);
});

test("About shows $CATSANC's contract once data/socials.json has loaded (then or when it next opens), and a file that fails its checks changes nothing", () => {
  const remove = installDom();
  try {
    const about = dialog(), socials = dialog();
    const p = createPanels({ about, socials });
    assert.match(about.textContent, /\$CATSANC has not launched yet/, "before the file loads");
    assert.equal(about.querySelector("p.panel-contract"), null);
    p.setConfig({ ...SOCIALS, contract: "not-a-mint" });
    assert.equal(about.querySelector("p.panel-contract"), null, "a file that fails its checks is not used for About");
    p.openAbout();
    p.setConfig(SOCIALS);
    assert.equal(about.querySelector("p.panel-contract"), null, "not redrawn under the visitor's eyes");
    about.close();
    p.openAbout();
    assert.equal(about.querySelector("p.panel-contract").querySelector("code").textContent, SOCIALS.contract, "drawn when About opens again");
    assert.ok(!/has not launched yet/.test(about.querySelector("p.panel-contract").parentNode.textContent.split("Holder rewards")[0]));
    // The rewards section sits under the ticker and the contract, with its own heading.
    const sec = about.querySelector("section.rw");
    assert.equal(sec.getAttribute("aria-labelledby"), "rw-title");
    assert.equal(sec.querySelector("h3#rw-title").textContent, "Holder rewards");
    const kids = about.querySelector("div.panel-body").children;
    assert.ok(kids.indexOf(sec) > kids.indexOf(about.querySelector("p.panel-contract")), "under the contract");
  } finally { remove(); }
});

/* ── Holder rewards ──────────────────────────────────────────────────────────────────── */

test("Holder rewards: the three lines (for any rules in force), what goes in the pot and the age bonus are the rules' own (scripts/lib/rewards.mjs)", () => {
  assert.deepEqual(REWARDS_TEXT.map((l) => ({ ...l })), R.REWARDS_SITE_TEXT.map((l) => ({ ...l })));
  assert.deepEqual({ ...DEFAULT_RULES }, { ...R.siteRules(R.rewardsConfig({})) }, "the page's defaults are the workflow's");
  const envs = [{}, { REWARDS_EVERY_DAYS: "1", REWARDS_RELEASE_PCT: "100", REWARDS_WALLET_CAP_PCT: "100" }, { REWARDS_EVERY_DAYS: "14", REWARDS_RELEASE_PCT: "30", REWARDS_WALLET_CAP_PCT: "20", REWARDS_MIN_BALANCE_PPM: "15", REWARDS_MIN_PAYOUT_SOL: "0.00025" },
    { REWARDS_EVERY_DAYS: "30", REWARDS_RELEASE_PCT: "10", REWARDS_WALLET_CAP_PCT: "1", REWARDS_MIN_BALANCE_PPM: "10000", REWARDS_MIN_PAYOUT_SOL: "0.1" }];
  for (const env of envs) {
    const rules = R.siteRules(R.rewardsConfig(env));
    const page = checkState({ ...R.stateJson(Object.assign(R.emptyState(), { rules })) }).rules;
    assert.deepEqual(rewardsText(page).map((l) => ({ ...l })), R.rewardsSiteText(rules).map((l) => ({ ...l })), JSON.stringify(env));
  }
  assert.equal(REWARDS_EXCLUDED, R.REWARDS_SITE_EXCLUDED);
  assert.equal(HALF_AGE, R.H);
  for (const a of [-5, 0, 1, 59, 3_600, 86_399, 604_800, 1_209_600, 2_592_000, 31_536_000, 9_007_199_254_740_000]) assert.equal(ageBonus(a), R.mFp(a), `age ${a}`);
  for (let a = 0; a < 5_000_000; a += 7_919) assert.equal(ageBonus(a), R.mFp(a));
  assert.equal(bonusText(R.mFp(0)), "1.00×");
  assert.equal(bonusText(R.mFp(7 * 86_400)), "1.33×");
  assert.equal(bonusText(R.mFp(14 * 86_400)), "1.50×");
  assert.equal(bonusText(R.mFp(30 * 86_400)), "1.68×");
  assert.equal(bonusText(1_999_999n), "1.99×", "rounded down: never shown as 2×");
  assert.equal(solText(0n), "0 SOL");
  assert.equal(solText(1_000_000_000n), "1 SOL");
  assert.equal(solText(1_234_567_891n), "1.2345 SOL", "rounded down");
  assert.equal(solText(5_000n), "0.000005 SOL", "a tiny amount keeps its digits");
  assert.equal(solText(12_345_678_900_000_000_000n), "12,345,678,900 SOL");
  assert.match(whenText(4_000_000_000), /^2 Oct 2096, 07:06 UTC$/);
});

/* A scenario run through the real rules, as the Rewards workflow would: two claims, hourly samples for
   15 days (two closes), payouts after each close, one of them expired and sent again, one still sending. */
const onCurve = (seed) => { for (let i = 0; ; i++) { const h = createHash("sha256").update(`${seed}:${i}`).digest(); if (isOnCurve(h)) return base58Encode(h); } };
const [ALICE, BOB, CAROL, DAVE, EVE, TEAM] = ["alice", "bob", "carol", "dave", "eve", "team"].map((n) => onCurve(`panels-rewards:${n}`));
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
let sigN = 0;
const sig = () => { let n = ++sigN, tail = ""; for (let i = 0; i < 8; i++) { tail = B58[n % 58] + tail; n = Math.floor(n / 58); } return `3${"P".repeat(79)}${tail}`; };
const T0 = 4_000_000_000, HOUR = 3_600, TOK = 1_000_000n;
const iso = (t) => new Date(t * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
const LAUNCHER = "HxhisqFBeZRJcBWkjnumk6HwWxFLGVVD6jfX23tXHzQh";

function scenario() {
  const cfg = R.rewardsConfig({});
  const state = R.emptyState(), L = R.emptyLedger();
  const claim = (t, lamports) => {
    const s = sig();
    R.recordClaimSending(L, { sig: s, lastValidBlockHeight: 1, sharePct: 100, sentAt: iso(t) });
    R.settleClaim(L, s, { status: "landed", claimed: lamports, walletFee: 5_000n, net: lamports - 5_000n }, { settledAt: iso(t) });
  };
  const holdings = (h) => new Map([
    [ALICE, 50_000_000n * TOK],
    [BOB, (h < 72 ? 20_000_000n : h < 200 ? 30_000_000n : 10_000_000n) * TOK],
    ...(h >= 120 ? [[CAROL, 5_000_000n * TOK]] : []),
    ...(h >= 10 ? [[DAVE, (h >= 300 ? 3_000_000n : 1_000_000n) * TOK]] : []),
    [TEAM, 90_000_000n * TOK],
    [EVE, 50_000n * TOK], // under the 100,000 minimum: never counted
  ]);
  const accounts = new Map([ALICE, BOB, CAROL, DAVE].map((a) => [a, 1_000_000_000n]));
  const send = (batch, t, outcome) => {
    const s = sig();
    R.recordPayoutSending(state, L, batch, { sig: s, lastValidBlockHeight: 1, sentAt: iso(t) });
    if (outcome) R.settlePayout(state, L, s, outcome, { settledAt: iso(t + 60) });
    return s;
  };
  const plan = () => R.planPayouts(state, { pot: R.payoutBudget(L, { maxLamportsPerRun: 2_000_000_000n }), accounts, rent: 890_880n, priceMicroLamports: 100_000, perTx: 1, payer: LAUNCHER }).batches;
  claim(T0, 1_000_000_000n);
  const groups = [];
  for (let h = 0; h <= 360; h++) {
    const t = T0 + h * HOUR;
    if (h === 150) claim(t, 500_000_000n);
    const r = R.applySample(state, L, { T: t, slot: 1_000 + h, mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, supply: 1_000_000_000n * TOK, holders: holdings(h) }, cfg, { excluded: new Set([TEAM]) });
    if (!r.closed) continue;
    if (r.closed.k === 1) groups.push(plan().map((b) => send(b, t + HOUR, "paid")));
    else {
      const [b0, b1, b2] = plan();
      const g = [send(b0, t + HOUR, "paid"), send(b1, t + HOUR + 60, "expired"), send(b2, t + HOUR + 120, null)];
      g.push(...plan().map((b) => send(b, t + 2 * HOUR, "paid")));
      groups.push(g);
    }
  }
  assert.equal(R.identityProblem(state, L), null);
  return { state, L, groups, ledger: R.ledgerJson(L), stateFile: R.stateJson(state) };
}
const MINT = "GPAAHLhvBUuRs5Lkfe9MuZBuQVU5RSprn1K2NyJbpump";
const EXCLUDE = { note: "x", exclude: [{ address: TEAM, reason: "the team's vesting wallet" }] };
const WALLETS = JSON.parse(read("data/wallets.json"));

test("Holder rewards: the page reads the files the rules write, and its numbers are the rules' numbers", () => {
  const { state, L, groups, ledger, stateFile } = scenario();
  const l = checkLedger(ledger), s = checkState(stateFile);
  assert.ok(l && s, "both files read");
  assert.equal(l.claimed, 1_500_000_000n);
  assert.deepEqual([l.E, l.P, l.F], [L.E, L.P, L.F]);
  assert.equal(l.unpaid, L.E - L.P - L.F);
  assert.equal(s.started, true);
  assert.equal(s.period, 3);
  assert.equal(s.periodEnd, state.periodEnd);
  assert.deepEqual([...s.wallets.keys()].sort(), [...state.wallets.keys()].sort());
  assert.ok(!s.wallets.has(EVE) && !s.wallets.get(TEAM)?.lots.length, "under the minimum, and excluded: never counted");
  // Points this period: the page's lazy accrual gives exactly the rules' points, wallet by wallet.
  const clone = R.validateRewardsState(stateFile);
  R.accrueAll(clone);
  const { by, total } = periodPoints(s);
  let sum = 0n;
  for (const [a, w] of clone.wallets) { assert.equal(by.get(a), w.pts, a); sum += w.pts; }
  assert.ok(total > 0n && total === sum);
  // The last payout: the second close's transactions, the expired one left out; the first close's are older.
  const last = lastPayout(l.payouts).map((p) => p.sig);
  assert.deepEqual(last, [groups[1][0], groups[1][2], ...groups[1].slice(3)]);
  assert.ok(!last.some((x) => groups[0].includes(x)));
  assert.deepEqual(lastPayout([]), []);
});

test("Holder rewards in About: the formula, the totals, the next payout, the last payout's transactions on Solscan, and not financial advice", () => {
  const remove = installDom();
  try {
    const { L, groups, ledger, stateFile, state } = scenario();
    const about = dialog(), socials = dialog();
    const p = createPanels({ about, socials, config: SOCIALS });
    p.openAbout();
    const sec = about.querySelector("section.rw");
    assert.match(sec.querySelector("p.rw-nfa").textContent, /^Not financial advice\./);
    assert.match(sec.textContent, /Loading the rewards…/);
    const rules = sec.querySelectorAll("li").slice(0, 3);
    assert.deepEqual(rules.map((li) => li.textContent), REWARDS_TEXT.map((x) => `${x.title} ${x.text}`));
    assert.ok(sec.textContent.includes(REWARDS_EXCLUDED));
    p.setRewards({ ledger, state: stateFile, exclude: EXCLUDE, wallets: WALLETS });
    const stats = Object.fromEntries(sec.querySelector("dl.rw-stats").querySelectorAll("dt").map((dt) => [dt.textContent, dt.parentNode.childNodes[dt.parentNode.childNodes.indexOf(dt) + 1].textContent]));
    assert.deepEqual(stats, {
      "Creator fees claimed": "1.5 SOL",
      "Paid to holders": solText(L.P),
      "Waiting for holders": solText(L.E - L.P - L.F),
      "Next payout": `${whenText(state.periodEnd)}, or soon after`,
    });
    assert.match(sec.textContent, /Period 3\. 4 wallets are earning\. Last check: /);
    const txs = sec.querySelectorAll("li.rw-tx");
    const want = [groups[1][0], groups[1][2], ...groups[1].slice(3)];
    assert.equal(txs.length, want.length);
    txs.forEach((li, i) => {
      const a = li.querySelector("a");
      assert.equal(a.href, `https://solscan.io/tx/${want[i]}`);
      assert.equal(a.target, "_blank");
      assert.equal(a.rel, "noopener noreferrer");
      assert.equal(a.textContent, `${want[i].slice(0, 6)}…${want[i].slice(-6)} ↗`);
      assert.match(li.textContent, /SOL to 1 wallet · \d{1,2} \w{3,4} 2096, \d\d:\d\d UTC/);
    });
    assert.match(txs[1].textContent, /being confirmed/, "the one still sending says so");
    // Every link: a payout's Solscan page, or the ledger on this site.
    for (const a of links(about)) assert.ok(a.href === "data/rewards/ledger.json" || /^https:\/\/solscan\.io\/tx\/[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(a.href), a.href);
    assert.match(about.textContent, /nothing here is financial advice/);
  } finally { remove(); }
});

test("Holder rewards: check a wallet shows its tokens, age bonus, share of the period's points, what it is owed, what is being sent and what was paid", () => {
  const remove = installDom();
  try {
    const { ledger, stateFile, state, L } = scenario();
    const about = dialog(), socials = dialog();
    const p = createPanels({ about, socials, config: SOCIALS });
    const form = about.querySelector("form.rw-check");
    const input = about.querySelector("input.rw-input");
    assert.equal(about.querySelector("label.rw-label").htmlFor, input.id, "the box has a label");
    assert.equal(about.querySelector("div.rw-result").getAttribute("aria-live"), "polite");
    assert.equal(about.querySelector("button.rw-go").type, "submit");
    const ask = (v) => { input.value = v; form.listeners.submit[0]({ preventDefault() {} }); return about.querySelector("div.rw-result").textContent; };
    assert.match(ask(ALICE), /still loading/, "before the files arrive");
    p.setRewards({ ledger, state: stateFile, exclude: EXCLUDE, wallets: WALLETS });
    assert.match(about.querySelector("div.rw-result").textContent, /Tokens counted50,000,000 \$CATSANC/, "the box answers again once they have");
    assert.match(ask("not an address"), /not a Solana wallet address/);
    assert.match(ask(` ${LAUNCHER} `), /one of the sanctuary's own wallets/);
    assert.match(ask(TEAM), /excluded from holder rewards: the team's vesting wallet\./);
    assert.match(ask(EVE), /No counted \$CATSANC in this wallet yet.*at least 100,000 \$CATSANC/);
    const rows = (a) => { ask(a); return Object.fromEntries(about.querySelector("dl.rw-dl").querySelectorAll("dt").map((dt) => [dt.textContent, dt.parentNode.childNodes[dt.parentNode.childNodes.indexOf(dt) + 1].textContent])); };
    const clone = R.validateRewardsState(stateFile);
    R.accrueAll(clone);
    let total = 0n;
    for (const w of clone.wallets.values()) total += w.pts;
    const share = (a) => { const bp = (clone.wallets.get(a).pts * 10_000n) / total; return `${bp / 100n}.${String(bp % 100n).padStart(2, "0")}% of all holders' points`; };
    const paid = (a) => { let s = 0n, n = 0; for (const x of L.payouts) if (x.status === "paid") for (const r of x.rows) if (r[0] === a) { s += r[1]; n++; } return `${solText(s)} in ${n} ${n === 1 ? "payout" : "payouts"}`; };
    const V = state.V;
    // Alice has held from the start: her tokens are 15 days old.
    const alice = rows(ALICE);
    assert.equal(alice["Tokens counted"], "50,000,000 $CATSANC");
    assert.equal(alice["Age bonus now"], bonusText(R.mFp(V)));
    assert.equal(alice["Age bonus now"], "1.51×");
    assert.equal(alice["This period's points so far"], share(ALICE));
    assert.equal(alice["Owed, waiting to be sent"], solText(state.wallets.get(ALICE).owed));
    assert.equal(alice["Paid so far"], paid(ALICE));
    // Bob bought more on day 3 and sold on day 8: his newest tokens went first, so the rest keep Alice's age.
    assert.equal(rows(BOB)["Age bonus now"], "1.51×");
    assert.equal(rows(BOB)["Tokens counted"], "10,000,000 $CATSANC");
    // Carol arrived on day 5; Dave holds two lots of different ages.
    assert.equal(rows(CAROL)["Age bonus now"], bonusText(R.mFp(V - 120 * HOUR)));
    const dLots = state.wallets.get(DAVE).lots;
    assert.equal(dLots.length, 2);
    const avg = (dLots[0][0] * R.mFp(V - dLots[0][1]) + dLots[1][0] * R.mFp(V - dLots[1][1])) / (dLots[0][0] + dLots[1][0]);
    assert.equal(rows(DAVE)["Age bonus now"], `${bonusText(avg)} on average (oldest tokens ${bonusText(R.mFp(V - dLots[0][1]))}, newest ${bonusText(R.mFp(V - dLots[1][1]))})`);
    // The wallet whose payout is still sending.
    const sending = L.payouts.find((x) => x.status === "sending");
    const who = sending.rows[0][0];
    assert.equal(rows(who)["Being sent now"], solText(sending.rows[0][1]));
    assert.match(about.querySelector("div.rw-result").textContent, /under 0\.001 SOL they wait/);
    // A wallet the owner excludes later stops earning, and the box still shows what it is owed and was paid.
    const later = walletReport({ state: checkState(stateFile), ledger: checkLedger(ledger), excluded: excludedWallets(WALLETS, { exclude: [{ address: ALICE, reason: "moved to cold storage" }] }) }, ALICE);
    assert.deepEqual(later.rows[0], ["Not earning", "This wallet is excluded from holder rewards: moved to cold storage."]);
    assert.ok(later.rows.some(([k, v]) => k === "Owed, waiting to be sent" && v === solText(state.wallets.get(ALICE).owed)));
    assert.ok(later.rows.some(([k, v]) => k === "Paid so far" && v === paid(ALICE)));
  } finally { remove(); }
});

test("Holder rewards: before $CATSANC has a contract or a first check, and with files that do not read", () => {
  const remove = installDom();
  try {
    const root = new Element("section");
    // (Not the owner's data/rewards-exclude.json: a typo in it must never fail the tests that gate every deploy.)
    const shipped = { ledger: JSON.parse(read("data/rewards/ledger.json")), state: JSON.parse(read("data/rewards/state.json")), exclude: EXCLUDE, wallets: WALLETS };
    assert.ok(checkLedger(shipped.ledger) && checkState(shipped.state), "the shipped files read on the page");
    let r = createRewards(root, { contract: null });
    r.setData(shipped);
    assert.match(root.textContent, /\$CATSANC has not launched yet\. The fees our launcher claims are kept for its holders/);
    assert.match(root.textContent, /Creator fees claimed/, "what was claimed shows even before the coin launches");
    r = createRewards(root, { contract: MINT });
    r.setData(shipped);
    const empty = checkState(shipped.state);
    if (!empty.started) {
      assert.match(root.textContent, /Next payoutNot started yet/);
      assert.match(walletReport({ state: empty, ledger: checkLedger(shipped.ledger), excluded: new Map() }, ALICE).text, /No holders have been counted yet/);
    }
    // The next payout is due: it goes at the next hourly check.
    const { ledger, stateFile, state } = scenario();
    r = createRewards(root, { contract: MINT, now: () => (state.periodEnd + 60) * 1000 });
    r.setData({ ledger, state: stateFile, exclude: EXCLUDE, wallets: WALLETS });
    assert.match(root.textContent, /Next payoutAt the next hourly check/);
    // A contract the rewards do not track yet (before the owner's new_epoch).
    r = createRewards(root, { contract: LAUNCHER });
    r.setData({ ledger, state: stateFile, exclude: EXCLUDE, wallets: WALLETS });
    assert.match(root.textContent, /still count the previous \$CATSANC contract/);
    // A file that does not read is reported, never guessed.
    const bad = [
      { ...ledger, E: "01" }, { ...ledger, P: 5 }, { ...ledger, claims: {} }, { ...ledger, version: 2 },
      { ...ledger, payouts: [{ ...ledger.payouts[0], status: "lost" }] }, { ...ledger, payouts: [{ ...ledger.payouts[0], sig: "javascript:alert(1)" }] },
      { ...ledger, payouts: [{ ...ledger.payouts[0], rows: [["<b>x</b>", "1", "0"]] }] }, null, "ledger",
    ];
    for (const b of bad) {
      assert.equal(checkLedger(b), null, JSON.stringify(b)?.slice(0, 80));
      r = createRewards(root, { contract: MINT });
      r.setData({ ledger: b, state: stateFile, exclude: EXCLUDE, wallets: WALLETS });
      assert.match(root.textContent, /The rewards ledger could not be read just now/);
      assert.equal(root.querySelectorAll("a").filter((a) => a.href.startsWith("https:")).length, 0);
    }
    const w = Object.entries(stateFile.wallets)[0];
    for (const b of [{ ...stateFile, V: -1 }, { ...stateFile, wallets: { [w[0]]: { ...w[1], owed: 7 } } }, { ...stateFile, wallets: { [w[0]]: { ...w[1], lots: [["1", stateFile.V + 1]] } } },
      { ...stateFile, wallets: { "not-an-address": w[1] } }, { ...stateFile, intervals: [[0, 0]] }, { ...stateFile, version: 9 }]) {
      assert.equal(checkState(b), null);
    }
    assert.match(walletReport({ state: null, ledger: checkLedger(ledger), excluded: new Map() }, ALICE).text, /could not be read just now/);
    assert.equal(excludedWallets(null, { exclude: [{ address: TEAM, reason: "a\u0000b" }] }).get(TEAM), "This wallet is excluded from holder rewards: a b.");
  } finally { remove(); }
});

test("Holder rewards: the page fetches only its four files from this site, when About is first opened, and styles the section from its own stylesheet", async () => {
  const asked = [];
  // (The owner's data/rewards-exclude.json is served as a fixture: a typo in it must never fail the tests that gate every deploy.)
  const got = await fetchRewards(async (rel, opts) => { asked.push([rel, opts?.cache]); return rel.endsWith("state.json") ? new Response("nope", { status: 404 }) : new Response(rel.endsWith("rewards-exclude.json") ? JSON.stringify(EXCLUDE) : read(rel)); });
  assert.deepEqual(asked.map((a) => a[0]).sort(), ["data/rewards-exclude.json", "data/rewards/ledger.json", "data/rewards/state.json", "data/wallets.json"]);
  assert.ok(asked.every((a) => a[1] === "no-cache"));
  assert.equal(got.state, null, "a file that cannot be fetched is null");
  assert.ok(got.ledger && got.exclude && got.wallets);
  assert.deepEqual(await fetchRewards(() => { throw new Error("offline"); }), { ledger: null, state: null, exclude: null, wallets: null });
  const main = read("assets/ui/main.js");
  assert.match(main, /import \{ fetchRewards \} from "\.\/rewards\.js";/);
  assert.match(main, /panels\.openAbout\(\);\s*if \(!rewardsAsked\) \{ rewardsAsked = true; fetchRewards\(\)\.then\(\(d\) => panels\.setRewards\(d\)\); \}/);
  assert.match(read("assets/ui/rewards.js"), /new URL\("\.\/rewards\.css", import\.meta\.url\)/);
  const css = read("assets/ui/rewards.css");
  for (const cls of ["rw", "rw-title", "rw-nfa", "rw-rules", "rw-stats", "rw-txs", "rw-check", "rw-input", "rw-result", "rw-dl"]) assert.match(css, new RegExp(`\\.${cls}\\b`), cls);
  assert.ok(!/url\(|@import|https?:/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), "the stylesheet loads nothing");
});

test("Holder rewards: the three lines, the minimum and the smallest payout follow the rules state.json records; rules that do not read make the file unread", () => {
  const remove = installDom();
  try {
    const { ledger, stateFile } = scenario();
    const rules = R.siteRules(R.rewardsConfig({ REWARDS_EVERY_DAYS: "3", REWARDS_WALLET_CAP_PCT: "25", REWARDS_MIN_BALANCE_PPM: "200", REWARDS_MIN_PAYOUT_SOL: "0.005" }));
    const withRules = { ...stateFile, rules: R.stateJson(Object.assign(R.emptyState(), { rules })).rules };
    const root = new Element("section");
    const r = createRewards(root, { contract: MINT });
    assert.deepEqual(root.querySelectorAll("li").slice(0, 3).map((li) => li.textContent), REWARDS_TEXT.map((x) => `${x.title} ${x.text}`), "the defaults until the files arrive");
    r.setData({ ledger, state: withRules, exclude: EXCLUDE, wallets: WALLETS });
    assert.deepEqual(root.querySelectorAll("li").slice(0, 3).map((li) => li.textContent), R.rewardsSiteText(rules).map((x) => `${x.title} ${x.text}`));
    assert.match(root.textContent, /Every 3 days, half of the unpaid holder pot .* at most 25% of it to any one wallet/);
    const report = walletReport({ state: checkState(withRules), ledger: checkLedger(ledger), excluded: new Map() }, EVE);
    assert.match(report.text, /at least 200,000 \$CATSANC itself/);
    for (const bad of [{ ...withRules.rules, everyDays: 0 }, { ...withRules.rules, minPayoutLamports: 5 }, { ...withRules.rules, minPayoutLamports: "1" }]) assert.equal(checkState({ ...stateFile, rules: bad }), null);
    assert.equal(checkState({ ...stateFile, rules: null }).rules, null, "none recorded yet: the defaults");
  } finally { remove(); }
});

test("Holder rewards: its stylesheet is linked when About is first opened, never on the first view", () => {
  const remove = installDom();
  try {
    const head = new Element("head");
    document.head = head;
    document.getElementById = (id) => head.querySelectorAll("link").find((l) => l.id === id) ?? null;
    const about = dialog(), socials = dialog();
    const p = createPanels({ about, socials, config: SOCIALS });
    assert.equal(head.querySelectorAll("link").length, 0, "About drawn (the page's start-up) links nothing");
    p.openAbout();
    const links = head.querySelectorAll("link");
    assert.equal(links.length, 1);
    assert.equal(links[0].id, "rewards-css");
    assert.match(links[0].href, /\/assets\/ui\/rewards\.css$/);
    about.close(); p.openAbout();
    assert.equal(head.querySelectorAll("link").length, 1, "once");
  } finally { remove(); }
});
