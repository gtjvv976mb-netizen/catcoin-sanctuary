/* "Holder rewards": the $CATSANC section of the About panel. The creator fees our launcher bot
   claims go to $CATSANC holders, older tokens earning more. This section explains the formula in
   three lines, shows what was claimed and paid and when the next payout is due, lists the last
   payout's transactions, and has a "check a wallet" box.

   It reads the files the Rewards workflow commits (scripts/rewards.mjs): data/rewards/ledger.json
   (every claim and payout) and data/rewards/state.json (each wallet's tokens with their age, its
   points and what it is owed), plus data/rewards-exclude.json and data/wallets.json (wallets that
   never earn). All four are on this site, fetched when About is first opened (with this section's
   stylesheet). The rules live in scripts/lib/rewards.mjs. The words and the age bonus here copy its
   rewardsSiteText (the three lines, with the numbers of the rules in force that state.json records),
   REWARDS_SITE_EXCLUDED and mFp, and tests/panels.test.mjs keeps the copies equal.
   Each file is checked before anything from it is shown. One that does not read is reported and
   never guessed at. Amounts stay BigInt lamports, rounded down for display, and text is drawn only
   through textContent. The only outbound links are a payout's Solscan transaction pages, built from
   checked signatures. */

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIG = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const AMOUNT = /^\d{1,20}$/, SIGNED = /^-?\d{1,20}$/, POINTS = /^\d{1,60}$/;
const whole = (n, lo = 0) => Number.isSafeInteger(n) && n >= lo;
const PAYOUT_STATUS = ["sending", "paid", "failed", "expired"];

/** The rules the page quotes until state.json records the ones in force: the Rewards workflow's defaults. */
export const DEFAULT_RULES = Object.freeze({ everyDays: 7, releasePct: 50, closeUsd: 100, walletCapPct: 10, minBalancePpm: 100, minPayoutLamports: 1_000_000n });
/** Lamports as an exact SOL decimal ("0.001"). */
const solExact = (l) => { const f = String(l % 1_000_000_000n).padStart(9, "0").replace(/0+$/, ""); return `${l / 1_000_000_000n}${f ? `.${f}` : ""}`; };
/** The smallest holding that counts, in tokens of the 1 billion supply ("100,000"). */
const minTokens = (r) => (r.minBalancePpm * 1_000).toLocaleString("en-US");

/** The three lines for `rules` (state.json's, checked; null: the defaults): scripts/lib/rewards.mjs rewardsSiteText, kept equal by the tests. */
export function rewardsText(rules = null) {
  const r = rules ?? DEFAULT_RULES;
  const share = r.releasePct === 50 ? "half" : r.releasePct === 100 ? "all" : `${r.releasePct}%`;
  const cap = r.walletCapPct < 100 ? `, at most ${r.walletCapPct}% of it to any one wallet (the rest stays in the pot for later),` : "";
  return Object.freeze([
    Object.freeze({ title: "Hold $CATSANC, earn SOL.", text: `Once an hour, at a random moment, we check every wallet. You earn points for tokens you held at both this check and the one before: balance × hours × age bonus. You need at least ${minTokens(r)} $CATSANC (${r.minBalancePpm / 10_000}% of the 1 billion supply). Pools, bonding curves and team wallets don't count.` }),
    Object.freeze({ title: "Older tokens earn more.", text: "Each token's bonus grows from 1× toward 2×: 1.33× after 1 week, 1.5× after 2 weeks, 1.68× after a month. A brand-new holder always earns at least half the top rate. When you sell, your newest tokens go first, so your oldest keep their age. Tokens you buy or receive start at 1×, and age counts from the first rewards check, so tokens held before the rewards started also begin at 1×." }),
    Object.freeze({ title: r.everyDays === 1 ? "Every day," : `Every ${r.everyDays} days,`, text: `${share} of the unpaid holder pot (the creator fees our launcher bot has claimed) is split by points${cap} and sent to you automatically.${r.closeUsd > 0 ? ` As soon as the pot is worth $${r.closeUsd.toLocaleString("en-US")}, all of it is split and sent, without waiting for the day.` : ""} Amounts under ${solExact(r.minPayoutLamports)} SOL are saved for your next payout and never lost. Every payout's points and amounts are published.` }),
  ]);
}
/** The three lines with the defaults. */
export const REWARDS_TEXT = rewardsText();
/** What goes in the pot, and what never does (scripts/lib/rewards.mjs REWARDS_SITE_EXCLUDED). */
export const REWARDS_EXCLUDED = "Only SOL goes in the pot: pump.fun and PumpSwap creator fees our launcher claims. StonkFun (Raydium LaunchLab) coins pay their creator no fee on chain, and coins priced in another coin pay in that coin; neither is claimed, because turning it into SOL would need a swap, and the launcher never trades.";
/** What the section says while rewards are off (the Rewards workflow has never run: REWARDS_ENABLED is not on or dry). */
export const REWARDS_OFF = "Holder rewards are switched off. No creator fees are shared with $CATSANC holders, and none are promised.";
export const NOT_ADVICE = "Not financial advice. Rewards come only from the fees our launcher's coins happen to earn, so they can be small or nothing. Holding $CATSANC is not an investment, and nothing here promises income.";

/** A token's age bonus, fixed point (1,000,000 = 1×): 1 + a / (a + 14 days), rounded down (scripts/lib/rewards.mjs mFp). */
export const HALF_AGE = 1_209_600;
export function ageBonus(ageSeconds) {
  const a = BigInt(Math.max(0, ageSeconds));
  return 1_000_000n + (1_000_000n * a) / (a + BigInt(HALF_AGE));
}

/* ── the files, checked ──────────────────────────────────────────────────────────────── */

/** An amount as the files write it: a canonical decimal string (no leading zeros, no -0), as a BigInt; anything else throws. */
const big = (v, re = AMOUNT) => { if (typeof v !== "string" || !re.test(v) || String(BigInt(v)) !== v) throw new Error("amount"); return BigInt(v); };

/**
 * data/rewards/ledger.json, checked: { E (the holders' share of the claims), P (paid), F (payout
 * fees), claimed (Σ creator fees the landed claims took), unpaid (max(0, E − P − F)), payouts:
 * [{ sig, status, sentAt, fee, rows: [[address, net, share]] }] }. null when it does not read.
 */
export function checkLedger(j) {
  try {
    if (!j || typeof j !== "object" || j.version !== 1) return null;
    const E = big(j.E, SIGNED), P = big(j.P), F = big(j.F);
    let claimed = 0n;
    for (const c of j.claims) {
      if (!c || !SIG.test(c.sig)) return null;
      if (c.status === "landed") claimed += big(c.claimed);
    }
    const payouts = j.payouts.map((p) => {
      if (!p || !SIG.test(p.sig) || !PAYOUT_STATUS.includes(p.status) || !ISO.test(p.sentAt) || !p.rows.length) throw new Error("payout");
      const rows = p.rows.map((r) => { if (!B58.test(r[0])) throw new Error("row"); return [r[0], big(r[1]), big(r[2])]; });
      return { sig: p.sig, status: p.status, sentAt: p.sentAt, fee: big(p.fee), rows };
    });
    const unpaid = E - P - F;
    return { E, P, F, claimed, unpaid: unpaid > 0n ? unpaid : 0n, payouts };
  } catch { return null; }
}

/** state.json's "rules", checked against the variables' ranges (null: none recorded yet); anything else throws. */
function checkRules(r) {
  if (r === null || r === undefined) return null;
  const within = (k, lo, hi) => { if (!whole(r[k], lo) || r[k] > hi) throw new Error("rules"); return r[k]; };
  const minPayoutLamports = big(r.minPayoutLamports);
  if (minPayoutLamports < 100_000n || minPayoutLamports > 100_000_000n) throw new Error("rules");
  return { everyDays: within("everyDays", 1, 30), releasePct: within("releasePct", 10, 100), closeUsd: r.closeUsd === undefined ? 0 : within("closeUsd", 0, 100_000), walletCapPct: within("walletCapPct", 1, 100), minBalancePpm: within("minBalancePpm", 10, 10_000), minPayoutLamports };
}

/**
 * data/rewards/state.json, checked: { started, rules (the rules in force, or null), mint, decimals, V
 * (the verified clock), tPrev (the last check), period, periodEnd, intervals, wallets: Map address →
 * { lots: [[BigInt, sinceV]], pts, ptsAt, owed, first } }. null when it does not read.
 */
export function checkState(j) {
  try {
    if (!j || typeof j !== "object" || j.version !== 1 || !j.wallets || typeof j.wallets !== "object") return null;
    const rules = checkRules(j.rules);
    const started = j.epoch !== null;
    if (started && !(B58.test(j.mint) && whole(j.decimals) && j.decimals <= 30 && whole(j.V) && whole(j.tPrev, 1) && whole(j.period, 1) && whole(j.periodEnd, 1))) return null;
    const V = started ? j.V : 0;
    const intervals = started ? j.intervals.map((iv) => { if (!whole(iv[0]) || !whole(iv[1], 1)) throw new Error("interval"); return [iv[0], iv[1]]; }) : [];
    const wallets = new Map();
    for (const [a, w] of Object.entries(j.wallets)) {
      if (!B58.test(a) || !w || !whole(w.ptsAt) || w.ptsAt > intervals.length || !(w.first === null || whole(w.first, 1))) return null;
      const lots = w.lots.map((l) => { if (!whole(l[1]) || l[1] > V) throw new Error("lot"); return [big(l[0]), l[1]]; });
      wallets.set(a, { lots, pts: big(w.pts, POINTS), ptsAt: w.ptsAt, owed: big(w.owed), first: w.first });
    }
    return { started, rules, mint: started ? j.mint : null, decimals: started ? j.decimals : 0, V, tPrev: started ? j.tPrev : null,
      period: started ? j.period : 0, periodEnd: started ? j.periodEnd : null, intervals, wallets };
  } catch { return null; }
}

/** Addresses that never earn → why: data/wallets.json's (the sanctuary's own) and data/rewards-exclude.json's (the owner's reason). */
export function excludedWallets(wallets, exclude) {
  const out = new Map();
  for (const w of Array.isArray(wallets?.launchers) ? wallets.launchers : []) if (B58.test(w?.address ?? "")) out.set(w.address, "This is one of the sanctuary's own wallets: it never earns holder rewards.");
  for (const r of Array.isArray(exclude?.exclude) ? exclude.exclude : []) {
    const why = typeof r?.reason === "string" ? r.reason.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200) : "";
    if (B58.test(r?.address ?? "") && !out.has(r.address)) out.set(r.address, `This wallet is excluded from holder rewards${why ? `: ${why}` : ""}.`);
  }
  return out;
}

/* ── the numbers ─────────────────────────────────────────────────────────────────────── */

/** A wallet's points this period so far: its stored points plus every interval since ptsAt at full credit (exactly the rules' lazy accrual). */
function pointsNow(s, w, memo) {
  let p = w.pts;
  for (const [amt, since] of w.lots) {
    const key = `${since}:${w.ptsAt}`;
    let sum = memo.get(key);
    if (sum === undefined) {
      sum = 0n;
      for (let i = w.ptsAt; i < s.intervals.length; i++) sum += BigInt(s.intervals[i][1]) * ageBonus(s.intervals[i][0] - since);
      memo.set(key, sum);
    }
    p += amt * sum;
  }
  return p;
}

/** Every wallet's points this period so far (address → BigInt) and their total. */
export function periodPoints(s) {
  const memo = new Map(), by = new Map();
  let total = 0n;
  for (const [a, w] of s.wallets) { const p = pointsNow(s, w, memo); by.set(a, p); total += p; }
  return { by, total };
}

/** The last payout: the newest run of payout transactions with no gap over 12 hours between them (expired ones never landed and are left out). */
export function lastPayout(payouts) {
  const list = payouts.filter((p) => p.status !== "expired").sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0));
  let i = list.length - 1;
  while (i > 0 && Date.parse(list[i].sentAt) - Date.parse(list[i - 1].sentAt) <= 12 * 3_600_000) i--;
  return list.slice(Math.max(i, 0));
}

/** Lamports as SOL, rounded down: "1.2345 SOL", or more digits for a tiny amount ("0.000005 SOL"). */
export function solText(lamports) {
  const i = lamports / 1_000_000_000n, f = String(lamports % 1_000_000_000n).padStart(9, "0");
  const first = f.search(/[1-9]/);
  const digits = i === 0n && first >= 4 ? Math.min(9, first + 2) : 4;
  const frac = f.slice(0, digits).replace(/0+$/, "");
  return `${i.toLocaleString("en-US")}${frac ? `.${frac}` : ""} SOL`;
}
/** A fixed-point bonus as "1.33×" (rounded down). */
export const bonusText = (fp) => `${(Math.floor(Number(fp) / 10_000) / 100).toFixed(2)}×`;
const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
/** Chain seconds as "7 Oct 2026, 14:05 UTC". */
export const whenText = (sec) => `${WHEN.format(new Date(sec * 1000))} UTC`;
const shortSig = (s) => `${s.slice(0, 6)}…${s.slice(-6)}`;

/**
 * What the box says about one address: { kind: "invalid" | "loading" | "unread" | "excluded" | "none" | "wallet", text?, rows? }.
 * rows: [[label, value]] for a wallet the rewards know (it holds counted tokens, is owed, or was paid).
 */
export function walletReport(data, input) {
  const addr = String(input ?? "").trim();
  if (!B58.test(addr)) return { kind: "invalid", text: "That is not a Solana wallet address." };
  if (!data) return { kind: "loading", text: "The rewards are still loading. Try again in a moment." };
  const { state, ledger, excluded } = data;
  if (!state || !ledger) return { kind: "unread", text: "The rewards files could not be read just now, so this wallet cannot be checked. Please try again later." };
  let paid = 0n, paidN = 0, sending = 0n;
  for (const p of ledger.payouts) for (const [a, net] of p.rows) if (a === addr) {
    if (p.status === "paid") { paid += net; paidN++; } else if (p.status === "sending") sending += net;
  }
  const w = state.wallets.get(addr), why = excluded.get(addr);
  if (!w && !paidN && !sending) {
    if (why) return { kind: "excluded", text: why };
    return { kind: "none", text: state.started
      ? `No counted $CATSANC in this wallet yet. The hourly check counts a wallet that holds at least ${minTokens(state.rules ?? DEFAULT_RULES)} $CATSANC itself (tokens in a pool, a locker or an exchange don't count). A new holder shows up after the next check.`
      : "No holders have been counted yet: the rewards start with the first hourly check of $CATSANC holders." };
  }
  // An excluded wallet stops earning at the next check, but what it was already owed is still paid.
  const rows = why ? [["Not earning", why]] : [];
  const bal = w ? w.lots.reduce((s, l) => s + l[0], 0n) : 0n;
  if (bal > 0n) {
    rows.push(["Tokens counted", `${(bal / 10n ** BigInt(state.decimals)).toLocaleString("en-US")} $CATSANC`]);
    let weighted = 0n;
    for (const [amt, since] of w.lots) weighted += amt * ageBonus(state.V - since);
    const oldest = ageBonus(state.V - w.lots[0][1]), newest = ageBonus(state.V - w.lots[w.lots.length - 1][1]);
    rows.push(["Age bonus now", w.lots.length > 1 && oldest !== newest ? `${bonusText(weighted / bal)} on average (oldest tokens ${bonusText(oldest)}, newest ${bonusText(newest)})` : bonusText(weighted / bal)]);
    if (w.first) rows.push(["Counted since", whenText(w.first)]);
    const { by, total } = periodPoints(state);
    const bp = total > 0n ? (by.get(addr) * 10_000n) / total : 0n;
    rows.push(["This period's points so far", total > 0n ? `${bp / 100n}.${String(bp % 100n).padStart(2, "0")}% of all holders' points` : "none yet (points start at the second check you are counted in)"]);
  } else rows.push(["Tokens counted", "none now (what it is owed is still paid)"]);
  rows.push(["Owed, waiting to be sent", solText(w ? w.owed : 0n)]);
  if (sending) rows.push(["Being sent now", solText(sending)]);
  rows.push(["Paid so far", paidN ? `${solText(paid)} in ${paidN} ${paidN === 1 ? "payout" : "payouts"}` : "nothing yet"]);
  return { kind: "wallet", rows };
}

/** Fetches the four files (relative to the site, never cached stale); each is null when it cannot be read. */
export async function fetchRewards(fetchImpl = fetch) {
  const get = (rel) => Promise.resolve().then(() => fetchImpl(rel, { cache: "no-cache" })).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [ledger, state, exclude, wallets] = await Promise.all(["data/rewards/ledger.json", "data/rewards/state.json", "data/rewards-exclude.json", "data/wallets.json"].map(get));
  return { ledger, state, exclude, wallets };
}

/* ── the section ─────────────────────────────────────────────────────────────────────── */

/* Its styles live in assets/ui/rewards.css, linked once from here when About is first opened (show), never on the first view. */
function linkStyles() {
  try {
    const head = document.head;
    if (!head || document.getElementById("rewards-css")) return;
    const l = document.createElement("link");
    l.id = "rewards-css";
    l.rel = "stylesheet";
    l.href = new URL("./rewards.css", import.meta.url).href;
    head.append(l);
  } catch { /* no document head (tests): the section still renders, unstyled */ }
}

/**
 * Draws the section into `root` (a <section> in the About panel) and returns { setData, show }: show()
 * links its stylesheet (About calls it when it opens).
 * @param {HTMLElement} root
 * @param {object} o
 * @param {string|null} o.contract   $CATSANC's mint (data/socials.json), or null while it has none
 * @param {() => number} [o.now]
 */
export function createRewards(root, { contract = null, now = () => Date.now() } = {}) {
  root.replaceChildren();
  root.setAttribute("aria-labelledby", "rw-title");
  const title = el("h3", "rw-title", "Holder rewards");
  title.id = "rw-title";
  const rules = el("ol", "rw-rules");
  const numbers = el("div", "rw-numbers");

  const form = el("form", "rw-check");
  form.setAttribute("role", "search");
  form.setAttribute("aria-label", "Check a wallet's holder rewards");
  const label = el("label", "rw-label", "Check a wallet");
  label.htmlFor = "rw-q";
  const input = el("input", "rw-input");
  input.id = "rw-q";
  input.type = "text";
  input.placeholder = "A Solana wallet address";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("aria-describedby", "rw-result");
  const go = el("button", "panel-link rw-go", "Check");
  go.type = "submit";
  const line = el("div", "rw-line");
  line.append(input, go);
  form.append(label, line);
  const result = el("div", "rw-result");
  result.id = "rw-result";
  result.setAttribute("role", "status");
  result.setAttribute("aria-live", "polite");

  const foot = el("p", "panel-small", "Figures are as of the last hourly check. Every claim and payout, with its transaction, is in ");
  const ledgerLink = el("a", null, "the rewards ledger");
  ledgerLink.href = "data/rewards/ledger.json";
  ledgerLink.target = "_blank";
  ledgerLink.rel = "noopener noreferrer";
  foot.append(ledgerLink, ".");
  // (until the Rewards workflow has run, state.json records no rules: rewards are off, and nothing about payouts is shown)
  const off = el("p", "panel-note rw-off", REWARDS_OFF);
  const payout = [el("p", "panel-note rw-nfa", NOT_ADVICE), rules, el("p", "panel-small", REWARDS_EXCLUDED), numbers, form, result, foot];
  root.append(title, off, ...payout);

  let data = null, asked = null;
  /** Rewards are running once state.json records the rules in force; before then, only the "off" line shows. */
  function drawMode() {
    const on = !!data?.state?.rules;
    off.hidden = on;
    for (const n of payout) n.hidden = !on;
  }
  drawMode();
  /* The three lines, with the rules in force once state.json has loaded. */
  function drawRules() {
    rules.replaceChildren();
    for (const l of rewardsText(data?.state?.rules ?? null)) { const li = el("li"); li.append(el("b", null, l.title), ` ${l.text}`); rules.append(li); }
  }
  drawRules();

  function check() {
    const r = walletReport(data, asked);
    result.replaceChildren();
    if (r.rows) {
      const dl = el("dl", "rw-dl");
      for (const [k, v] of r.rows) dl.append(el("dt", null, k), el("dd", null, v));
      result.append(dl, el("p", "panel-small", `Owed amounts are sent automatically after a period closes; under ${solExact((data?.state?.rules ?? DEFAULT_RULES).minPayoutLamports)} SOL they wait until they add up.`));
    } else result.append(el("p", "panel-note", r.text));
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); asked = input.value; check(); });

  function stat(dl, k, v) { dl.append(el("dt", null, k), el("dd", null, v)); }
  function drawNumbers() {
    numbers.replaceChildren();
    if (!contract) numbers.append(el("p", "panel-note", "$CATSANC has not launched yet. The fees our launcher claims are kept for its holders, and the first period starts once it has."));
    if (!data) { numbers.append(el("p", "panel-note", "Loading the rewards…")); return; }
    const { ledger: L, state: s } = data;
    if (!L) { numbers.append(el("p", "panel-note", "The rewards ledger could not be read just now. Please try again later.")); return; }
    const dl = el("dl", "rw-stats");
    stat(dl, "Creator fees claimed", solText(L.claimed));
    stat(dl, "Paid to holders", solText(L.P));
    stat(dl, "Waiting for holders", solText(L.unpaid));
    stat(dl, "Next payout", !s ? "Not known right now" : !s.started ? "Not started yet" : s.periodEnd * 1000 > now() ? `${whenText(s.periodEnd)}, or soon after` : "At the next hourly check");
    numbers.append(dl);
    if (s?.started) {
      let holders = 0;
      for (const w of s.wallets.values()) if (w.lots.length) holders++;
      numbers.append(el("p", "panel-small", `Period ${s.period}. ${holders} ${holders === 1 ? "wallet is" : "wallets are"} earning. Last check: ${whenText(s.tPrev)}.`));
      if (contract && s.mint !== contract) numbers.append(el("p", "panel-note", "The rewards still count the previous $CATSANC contract. They move to the new one when the owner starts a new epoch; what each wallet is owed is kept."));
    } else if (s) numbers.append(el("p", "panel-small", "No holders counted yet: the first period starts with the first hourly check."));

    numbers.append(el("h4", "rw-sub", "Last payout"));
    const last = lastPayout(L.payouts);
    if (!last.length) { numbers.append(el("p", "panel-small", "No payout yet.")); return; }
    const ul = el("ul", "rw-txs");
    for (const p of last) {
      const li = el("li", "rw-tx");
      const a = el("a", "rw-sig mono", `${shortSig(p.sig)} ↗`);
      a.href = `https://solscan.io/tx/${p.sig}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", `Payout transaction ${shortSig(p.sig)} on Solscan`);
      const net = p.rows.reduce((s, r) => s + r[1], 0n);
      const note = p.status === "paid" ? "" : p.status === "sending" ? " · being confirmed" : " · failed on chain; its wallets are paid again";
      li.append(a, el("span", "rw-tx-meta", `${solText(net)} to ${p.rows.length} ${p.rows.length === 1 ? "wallet" : "wallets"} · ${whenText(Date.parse(p.sentAt) / 1000)}${note}`));
      ul.append(li);
    }
    numbers.append(ul);
  }
  drawNumbers();

  return {
    /** The four files (fetchRewards' answer), checked here; the box answers again for the address last asked. */
    setData(raw) {
      data = raw ? { ledger: checkLedger(raw.ledger), state: checkState(raw.state), excluded: excludedWallets(raw.wallets, raw.exclude) } : null;
      drawMode();
      drawRules();
      drawNumbers();
      if (asked !== null) check();
    },
    /** About is open: the section's stylesheet is linked (once). */
    show: linkStyles,
  };
}
