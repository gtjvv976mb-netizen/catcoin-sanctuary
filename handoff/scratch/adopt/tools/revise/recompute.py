# Read-only recomputations over evidence already on disk (no network). Output: raw/revise/recompute.out.txt
import json, statistics, collections
from datetime import datetime
A = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/"
out = []
fr = json.load(open(A + "review/feed-recorded.out.json"))
L = fr["launches"]
out.append(f"feed-recorded: launches={len(L)} stonkfun status200={sum(1 for x in L if (x['stonkfun'] or {}).get('status')==200)} hasBuy={sum(1 for x in L if x['hasBuy'])} payerIsCreator=false:{sum(1 for x in L if not x['payerIsCreator'])}")
sb = []
for x in L:
    s = x["stonkfun"] or {}
    ll = s.get("launchLagSec")
    tl = datetime.fromisoformat(s["tokenCreatedAt"].replace("Z", "+00:00")).timestamp() - x["blockTime"] if s.get("tokenCreatedAt") else None
    if ll is not None and ll > 10: sb.append((ll, tl))
a = [l for l, _ in sb]; b = [t for _, t in sb if t is not None]
out.append(f"self-built (launch lag >10 s): n={len(sb)}; /launches lag s min/median/max = {min(a)}/{statistics.median(a)}/{max(a)}; /tokens lag s = {round(min(b))}/{round(statistics.median(b))}/{round(max(b))}")
pf = json.load(open(A + "review/priority-fees-decoded.json"))["rows"]
c = collections.Counter(r["cuPriceMicroLamports"] for r in pf)
out.append(f"priority prices (µL) over {len(pf)} launches: {dict(c)}; with a price set: {sum(v for k,v in c.items() if k is not None)}")
v = json.load(open(A + "review/verify-91.out.json"))
bad = [(r["stock"], r["category"], r["quote"], r["pricingStatus"]) for r in v["rows"] if r["pricingStatus"] != 200]
out.append(f"verify-91: n={v['summary']['n']} simOk={v['summary']['simOk']} maxCu={v['summary']['maxCu']} maxBytes={v['summary']['maxBytes']} costRange={v['summary']['costRange']} pricing!=200: {bad}")
cf = json.load(open(A + "spec/curve-rule-feed-probe.out.json"))
for t in cf["txs"]:
    trade = [n for n in t["instructionsLogged"] if n in ("BuyExactIn","BuyExactOut","SellExactIn","SellExactOut","Trade","SwapV2")]
    out.append(f"SPYx creation {t['sig'][:8]} v={t['version']} trade-like={trade}")
open(A + "revise/recompute.out.txt", "w").write("\n".join(out) + "\n")
print("\n".join(out))
