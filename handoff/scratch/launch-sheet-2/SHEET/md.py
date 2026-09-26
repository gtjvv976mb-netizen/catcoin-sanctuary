#!/usr/bin/env python3
"""Orders launch-sheet.json by group (Backpack first, then pre-IPO) and writes launch-sheet.md from it."""
import json

D = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet-2"
cats = json.load(open(f"{D}/launch-sheet.json"))
summary = json.load(open(f"{D}/SHEET/build.summary.json"))
epoch = json.load(open(f"{D}/SHEET/epoch.out.json"))
live = json.load(open(f"{D}/SHEET/livepairs.out.json"))
assert not live["missing"] and not live["changed"], live

IMGNOTE = {
    "LIDNAP": "the cat sits instead of lying folded flat",
    "PINROW": "chip-style pins show around the cat's base",
    "CASENAP": "the points came out a light fawn-ginger",
    "HEARTHBIB": "stands on its hind legs, as its look says",
}
cats.sort(key=lambda c: (c["group"] != "backpack", c["order"]))
for i, c in enumerate(cats, 1):
    c["order"] = i
    c["imageNote"] = IMGNOTE.get(c["ticker"], "matches the look")
    c["pairsRecheckedLive"] = {"at": live["fetchedAt"], "source": "https://stonkfun.xyz/api/public/v1/pairs", "unchanged": True}
json.dump(cats, open(f"{D}/launch-sheet.json", "w"), indent=1, ensure_ascii=False)
open(f"{D}/launch-sheet.json", "a").write("\n")

bp = [c for c in cats if c["group"] == "backpack"]
pre = [c for c in cats if c["group"] == "pre-ipo"]
png_sizes = [c["imageBytes"] for c in cats]
rel = lambda p: p.replace(D + "/", "")


def short(m):
    return f"{m[:5]}…{m[-4:]}"


def quote_lines(c):
    ch = c["pairChoices"]
    if len(ch) == 1:
        p = ch[0]
        return [f"- **Quote token:** open the **{p['formTab']}** tab, paste `{p['mint']}` into the search box and pick **{p['symbol']}**"
                + (f" (listed as \"{p['name']}\")" if p["name"] != p["symbol"] else "") + "."]
    out = [f"- **Quote token:** pick **one** of the two {c['stonkfunSymbol']} pairs (see the pair note):"]
    for p in ch:
        fee = p["onChain"]["transferFee"] if p.get("onChain") else None
        fee_txt = ""
        if fee:
            fee_txt = f"; transfer fee {fee['bps'] / 100:g}%" + (f", {fee['nextBps'] / 100:g}% from epoch {fee['nextFromEpoch']}" if fee["nextBps"] != fee["bps"] else "")
        out.append(f"  - **{p['formTab']}** tab: paste `{p['mint']}` and pick **{p['symbol']}** ({p['issuer']}{fee_txt})")
    return out


def entry(c):
    L = [f"### {c['order']}. {c['stonkfunSymbol']} → {c['ticker']}", ""]
    L.append(f"- **Token name:** `{c['name']}`")
    L.append(f"- **Symbol:** `{c['ticker']}`")
    L.append(f"- **Token image:** `{rel(c['image'])}`")
    L += quote_lines(c)
    L.append("- **Description** (for the cat's page and posts; StonkFun has no box for it):")
    L.append(f"  > {c['description']}")
    L.append(f"- **Why it looks like this:** {c['whyLook']}")
    L.append(f"- **Pair note:** {c['note']}")
    L.append("")
    return L


def index_rows(group):
    rows = ["| # | Pair | Symbol | Token name |", "|---|---|---|---|"]
    for c in group:
        rows.append(f"| {c['order']} | {c['stonkfunSymbol']} | `{c['ticker']}` | {c['name']} |")
    return rows


e_now = epoch
md = []
md += [
    "# Cat Sanctuary: StonkFun launch sheet 2 (67 cats)",
    "",
    "This sheet covers the cats priced in Backpack-listed stocks and funds (60) and in pre-IPO tokens (7). "
    "The 24 xStock cats are in the first sheet (`../launch-sheet/launch-sheet.md`). Every cat stays \"not launched yet\" in the garden until you launch it by hand on stonkfun.xyz/launch. "
    "Image paths below are relative to `" + D + "/`. The same data, with the full basis, coat colours, on-chain pair data and check output, is in `launch-sheet.json`.",
    "",
    "## Before you start",
    "",
    f"1. **The form, top to bottom.** I re-read the live /launch page on 2026-09-25 at about 20:40 UTC: the fee choice(s) at the top, then **Token name** (max 32 characters), **Symbol** (max 10), "
    f"**Token image** (PNG, JPEG or WebP, square, up to 2 MB), **Project links** (optional, saved permanently; a blank Website links to StonkFun), then **Quote token** "
    "(tabs xStocks, PreStocks, Tessera, Sunrise, Currencies, Leverage, Collectibles, Solana, Custom). There is still no description box. Each entry below follows that order.",
    "2. **Fees and dev buy.** What the top of the form shows depends on the venue StonkFun is using when you launch. If it shows **Launch on: LaunchLab** with a Fee model / Holder rewards tax, "
    "choose Standard / **None**, as in the first sheet. If it shows **Pool fee**, the form says 1% is \"the default, and the lowest cost to traders\" (about 0.5% to the creator); 2% sends about 1.5% to the creator and costs traders more. "
    "Leave **Dev buy** empty. The first sheet's other tips still apply: check the Launch summary before approving, and open the new token's page after each launch before starting the next.",
    f"3. **Images.** Each cat has a 1024×1024 PNG ({min(png_sizes) / 1e6:.2f}–{max(png_sizes) / 1e6:.2f} MB, all under the 2 MB limit) and a `-512.jpg` fallback beside it. Checked by eye: each shows one cat, with no text and no logos. Small differences from the text: Lidnap (DELL) sits instead of lying flat, Pinrow (DRAM) has chip-style pins around its base, and Satchel's (FWDI) points came out a light fawn-ginger.",
    f"4. **Every pair is live and ready.** In StonkFun's pairs list (generated {summary['pairsListGeneratedAt'][11:16]} UTC today) all {live['checked']} pairs these cats use are launchable, LaunchLab-ready and Token-2022. I re-fetched the live list at {live['fetchedAt'][11:16]} UTC and none of the {live['checked']} had changed.",
    "5. **Backpack ('Sunrise') quote tokens** have no transfer fee (on-chain re-read today), but each issuer holds a permanent delegate, a pause switch (not paused) and freeze authority, so the issuer can move, pause or freeze the quote token.",
    f"6. **Pre-IPO quote tokens charge a transfer fee** each time they move, so every buy or sell of a cat paired with one pays it on the quote side, on top of the pool fee. "
    f"The five PreStocks-only pairs (ANTHROPIC, ANDURIL, POLYMARKET, NEURALINK, FIGUREAI) and the PreStocks OPENAI and KALSHI pairs take **1% now and 3% from epoch 1043**. "
    f"When I read the chain at {e_now['now'][11:16]} UTC it was epoch {e_now['epoch']}, slot {e_now['slotIndex']:,} of {e_now['slotsInEpoch']:,}, so 3% starts around 09:00–10:00 UTC on 26 Sep 2026. "
    "The Tessera OPENAI and KALSHI pairs take 0.2% and have no permanent delegate. None of these tokens is company stock: PreStocks are SPV-backed, Tessera is a share-backed loan participation.",
    "7. **Always paste the mint.** OPENAI and KALSHI each have two real pairs, so you pick one. MRNA, GPRO, AMC and HTZ share their symbol with custom look-alike tokens; the mints below are the Backpack ones.",
    "8. **Your calls.** OPENAI and KALSHI: which pair (Tessera 0.2% fee, or PreStocks 1% rising to 3%). DJT: the disclaimer names the company by its short name, TMTG, because its legal name contains a person's name. "
    "SCHH: its cat rests on a weak link (a rescue's photo for the company's volunteers); the notes' fallback is a brick-red or slate-grey look. WEBULL: \"rise and dip like a chart\" describes stripes and promises nothing, but you may prefer a softer line.",
    f"9. **Checks.** At {summary['builtAt'][11:16]} UTC I re-ran the repo's content rules on the final text of all 67 and searched Jupiter for every symbol: {summary['recheckOk']}/67 pass. "
    "checkProposal and displaySafe are clean for every name, symbol and story, and checkFields is clean on name, symbol, story and look. On the full description, checkFields flags only the required disclaimer "
    "(the company or \"stonkfun\" as a brand, \"affiliated\", \"financial advice\"), the same three hits as the disclaimer alone. No symbol matches any token on Jupiter, verified or not. "
    f"Across both sheets' {summary['total91']} coins there are no repeated names or symbols. Each entry's full check record is in `launch-sheet.json`.",
    "",
    "## Index",
    "",
    "**Backpack stocks and funds (Sunrise tab)**",
    "",
]
md += index_rows(bp)
md += ["", "**Pre-IPO (PreStocks and Tessera tabs)**", ""]
md += index_rows(pre)
md += ["", f"## Backpack stocks and funds ({len(bp)} cats, Sunrise tab)", ""]
for c in bp:
    md += entry(c)
md += [f"## Pre-IPO ({len(pre)} cats, PreStocks and Tessera tabs)", ""]
for c in pre:
    md += entry(c)
open(f"{D}/launch-sheet.md", "w").write("\n".join(md).rstrip() + "\n")
print(len(cats), len(bp), len(pre), sum(len(x) for x in md))
