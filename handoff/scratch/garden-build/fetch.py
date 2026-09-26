# Fetches, for every coin in coins-base.json: DexScreener pairs (tokens/v1), GeckoTerminal token info
# (description, image, links) and CoinGecko coin descriptions. Writes ds.json, gt.json, cg.json.
import json, os, time, urllib.request, urllib.parse, sys
D = os.path.dirname(os.path.abspath(__file__))
coins = json.load(open(f"{D}/coins-base.json"))
def get(url, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"accept": "application/json", "user-agent": "catcoinsanctuary-build/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(20 * (t + 1)); continue
            if e.code == 404: return None
            time.sleep(3)
        except Exception: time.sleep(3)
    return None
what = sys.argv[1:] or ["ds", "gt", "cg"]
if "ds" in what:
    ds = {}
    by = {}
    for c in coins: by.setdefault(c["chain"], []).append(c["contract"])
    for ch, addrs in by.items():
        for i in range(0, len(addrs), 30):
            part = addrs[i:i+30]
            r = get(f"https://api.dexscreener.com/tokens/v1/{ch}/{','.join(urllib.parse.quote(a, safe='') for a in part)}")
            for p in r or []: ds.setdefault(f"{ch}|{p['baseToken']['address'].lower()}", []).append(p)
            time.sleep(0.4)
    json.dump(ds, open(f"{D}/ds.json", "w")); print("ds", len(ds), flush=True)
GT = {"ethereum": "eth", "polygon": "polygon_pos", "avalanche": "avax", "cronos": "cro", "sui": "sui-network", "worldchain": "world-chain"}
if "cg" in what:
    cg = {}
    for c in coins:
        k = c.get("coingeckoId")
        if not k or c.get("profile"): continue
        r = get(f"https://api.coingecko.com/api/v3/coins/{k}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false")
        if r: cg[k] = {"description": (r.get("description") or {}).get("en", ""), "image": (r.get("image") or {}).get("large"), "links": r.get("links"), "name": r.get("name"), "symbol": r.get("symbol")}
        time.sleep(7)
    json.dump(cg, open(f"{D}/cg.json", "w")); print("cg", len(cg), flush=True)
if "gt" in what:
    path = f"{D}/gt.json"
    gt = json.load(open(path)) if os.path.exists(path) else {}
    for n, c in enumerate(coins):
        key = f"{c['chain']}|{c['contract'].lower()}"
        if key in gt: continue
        net = GT.get(c["chain"], c["chain"])
        r = get(f"https://api.geckoterminal.com/api/v2/networks/{net}/tokens/{urllib.parse.quote(c['contract'], safe='')}/info")
        gt[key] = (r or {}).get("data", {}).get("attributes") if r else None
        if n % 20 == 0: json.dump(gt, open(path, "w")); print("gt", n, flush=True)
        time.sleep(2.2)
    json.dump(gt, open(path, "w")); print("gt done", len(gt), flush=True)
