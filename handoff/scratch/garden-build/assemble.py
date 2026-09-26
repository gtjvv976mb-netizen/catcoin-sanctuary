# Assembles every cat coin (>= $1M selection, the $20k-$1M selection, and genuine cats the $1M pass
# flagged for trading or data problems) into one list: coins-base.json. No network.
import json, glob, re, os, unicodedata
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(S, "famous")
sel = json.load(open(f"{F}/selection.json"))
sel20 = json.load(open(f"{F}/extra/selection-20k.json"))
live = json.load(open(f"{F}/merge/live.json"))

CH = {"robinhood (Robinhood Chain)": "robinhood", "hyperliquid (HyperCore spot)": "hyperliquid",
      "binance-smart-chain": "bsc", "ethereum": "ethereum", "solana": "solana"}
def chain_of(c): return CH.get(c, c.split(" ")[0])

profiles = {}
files = sorted(glob.glob(f"{F}/profiles/batch-*.json"), key=lambda f: (f.count("."), f))  # plain batch-N.json first
for f in files:
    for c in json.load(open(f))["cats"]:
        k = c["contract"].lower()
        if k not in profiles: profiles[k] = c
        else:
            for kk, vv in c.items():
                if not profiles[k].get(kk): profiles[k][kk] = vv

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

coins, seen = [], set()
def add(c):
    key = (c["chain"], c["contract"].lower())
    if key in seen: return False
    seen.add(key); coins.append(c); return True

for x in sel["selected"]:
    p = profiles.get(x["contract"].lower())
    cg = live["cg"].get(x.get("coingeckoId") or "", {})
    add({
        "srcId": x["id"], "name": x["name"], "symbol": x["symbol"], "chain": chain_of(x["chain"]),
        "contract": x["contract"], "coingeckoId": x.get("coingeckoId"),
        "marketCapUsd": x["marketCapUsd"], "liquidityUsd": x["liquidityUsd"], "volume24hUsd": x["volume24hUsd"],
        "measuredAt": "2026-09-25T19:55:32Z", "list": "1m", "evidence": x["evidence"],
        "profile": p, "cgImage": cg.get("image"), "catWhy": None, "company": None, "ownerPick": False,
    })

for x in sel20:
    add({
        "srcId": None, "name": x["name"], "symbol": x["symbol"], "chain": x["chain"], "contract": x["contract"],
        "coingeckoId": None, "marketCapUsd": x["marketCapUsd"], "liquidityUsd": x["liquidityUsd"], "volume24hUsd": x["volume24hUsd"],
        "measuredAt": x["measuredAt"], "list": "20k", "pairQuote": x["pairQuote"], "pairAddress": x["pairAddress"], "dex": x["dex"],
        "x": x.get("x"), "website": x.get("website"), "imageUrl": x.get("imageUrl"), "catWhy": x["catWhy"],
        "company": x.get("company"), "ownerPick": bool(x.get("ownerPick")), "profile": profiles.get(x["contract"].lower()),
    })

# Genuine cats the $1M pass left out only for their trading or data (not copies, impersonators or non-cats).
FLAGGED = {
    "ansem-cat": "Its only pool's price is far off CoinGecko's, so DEX liquidity figures are unreliable; very little real trading.",
    "billion-dollar-cat-runes": "Almost no trading on its Solana pool.",
    "vankedisi": "Almost no trading; DexScreener's market cap uses a wrong supply.",
    "waffles": None,
    "hunhunmao-bsc": None,
    "elonxcat": "Liquidity looks fake: the pool holds almost nothing on the non-token side, and there is almost no trading.",
    "baby-catecoin": "A 'Baby' spin-off of Catecoin (CATE); its own site says it is not affiliated with CATE.",
}
for k, note in FLAGGED.items():
    c = live["coins"][k]
    cs = [cc for cc in c["contracts"] if cc.get("ds")] or c["contracts"]
    m = next((cc for cc in cs if cc.get("main")), cs[0])
    cg = live["cg"].get(k, {})
    top = (m.get("top") or [{}])[0]
    ch = CH.get(m["platform"], m.get("ds") or m["platform"])
    mc = cg.get("mcap") or m.get("dsMcap") or 0
    name = c.get("name") or k
    add({
        "srcId": k, "name": None, "symbol": None, "chain": m.get("ds") or ch, "contract": m["address"],
        "coingeckoId": k if cg else None, "marketCapUsd": mc, "liquidityUsd": m.get("liq") or 0, "volume24hUsd": cg.get("vol") or m.get("vol24") or 0,
        "measuredAt": (m.get("fetchedAt") or "2026-09-25T19:56:00Z")[:19] + "Z", "list": "flagged", "flagNote": note,
        "pairAddress": top.get("pair"), "pairQuote": top.get("otherSym"), "dex": top.get("dex"),
        "cgImage": cg.get("image"), "catWhy": None, "company": None, "ownerPick": False, "profile": None,
    })

json.dump(coins, open(os.path.join(S, "garden-build/coins-base.json"), "w"), indent=1, ensure_ascii=False)
print(len(coins), sum(1 for c in coins if c["profile"]), sum(1 for c in coins if c["list"] == "flagged"))
