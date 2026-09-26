# Builds data/famous.json and assets/coins/<id>.webp in the site from coins-base.json (assemble.py),
# ds.json, gt.json, cg.json (fetch.py). Market figures here are the research's; run
# `node scripts/refresh-famous.mjs` in the site afterwards for live ones.
import json, os, re, io, sys, unicodedata, urllib.request, hashlib, datetime
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SITE = "/home/user/cat-sanctuary"
coins = json.load(open(f"{D}/coins-base.json"))
ds = json.load(open(f"{D}/ds.json")) if os.path.exists(f"{D}/ds.json") else {}
gt = json.load(open(f"{D}/gt.json")) if os.path.exists(f"{D}/gt.json") else {}
cg = json.load(open(f"{D}/cg.json")) if os.path.exists(f"{D}/cg.json") else {}
IMG_CACHE = f"{D}/img"; os.makedirs(IMG_CACHE, exist_ok=True)
os.makedirs(f"{SITE}/assets/coins", exist_ok=True)

CHAIN_LABEL = {"solana": "Solana", "ethereum": "Ethereum", "base": "Base", "bsc": "BNB Chain", "robinhood": "Robinhood Chain", "ton": "TON",
  "hyperevm": "HyperEVM", "hyperliquid": "Hyperliquid", "arc": "Arc", "ink": "Ink", "sui": "Sui", "avalanche": "Avalanche", "arbitrum": "Arbitrum",
  "xrpl": "XRP Ledger", "cronos": "Cronos", "stacks": "Stacks", "near": "NEAR", "tron": "Tron", "beam": "Beam", "polygon": "Polygon",
  "worldchain": "World Chain", "unichain": "Unichain", "abstract": "Abstract", "zksync": "zkSync"}
GT_NET = {"ethereum": "eth", "polygon": "polygon_pos", "avalanche": "avax", "cronos": "cro", "sui": "sui-network", "worldchain": "world-chain"}
GMGN = {"solana": "sol", "ethereum": "eth", "base": "base", "bsc": "bsc"}
DEX_LABEL = lambda d: (d or "").replace("-", " ").title().replace("Pancakeswap", "PancakeSwap").replace("Uniswap", "Uniswap").replace("Pumpswap", "PumpSwap") if d else None

# Companies / projects behind the >= $1M cats, from the research's own evidence lines (selection.json).
COMPANY = {
  "CASHCAT": "Robinhood (its original app name; unofficial)", "PURR": "Hyperliquid (its Hypurr mascot)",
  "TOSHI": "Coinbase (CEO Brian Armstrong's cat Toshi; unofficial)", "WKC": "SMC DAO (Wiki Cat mascot)",
  "GOLDEN": "Product Hunt's Golden Kitty, won by Robinhood (unofficial)", "MIGGLES": "Coinbase (licensed Miggles IP)",
  "LEO": "Stacks (founder Muneeb Ali's cat Leo; unofficial)", "BOXY": "Amazon-themed (unofficial)",
  "CPU": "Intel-themed (unofficial)", "WELOVECATS": "Robinhood-themed (unofficial)", "BUN": "Mosh launchpad (its first coin)",
  "CATI": "Catizen (the game's cat)", "SC": "Simon's Cat (licensed)",
}

LINK = re.compile(r"[a-z][a-z0-9+.-]*://|\b(javascript|data|vbscript|file|blob|mailto|tel|ipfs|ipns):|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|fun|app|me|gg|co|ai|dev|sol|link|site|online|tech|finance|money|lol|wtf)\b", re.I)
def text_ok(t): return isinstance(t, str) and t and t.strip() == t and "  " not in t and not re.search(r"[<>]|&(#\d+|[a-z]+);", t) and not LINK.search(t) and not re.search(r"[\x00-\x1f​-‏‪-‮⁠-⁯﻿]", t)
def clean(t):
    t = unicodedata.normalize("NFC", str(t or ""))
    t = re.sub(r"[\x00-\x09\x0b-\x1f​-‏‪-‮⁠-⁯﻿ 　]", " ", t)
    import html as _h
    t = _h.unescape(_h.unescape(re.sub(r"<[^>]*>", "", t)))
    t = re.sub(r"https?://\S+|www\.\S+", "", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()

def slug(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40]

def https(u):
    if not isinstance(u, str): return None
    u = u.strip()
    if u.startswith("http://"): u = "https://" + u[7:]
    if not re.match(r"^https://[a-z0-9-]+(\.[a-z0-9-]+)+(/[^\s]*)?$", u, re.I) or len(u) > 400: return None
    host = re.match(r"^https://([^/]+)", u).group(1).lower()
    if re.search(r"stonkfun\.xyz/(token|coin|trade)|solscan\.io|pump\.fun|four\.meme|bonk\.fun", u, re.I): return None
    if any(host == h or host.endswith("." + h) for h in ["gmgn.ai", "pump.fun", "dexscreener.com", "birdeye.so", "jup.ag", "raydium.io", "geckoterminal.com", "t.me", "telegram.me", "linktr.ee"]):
        return None if "linktr.ee" not in host else u
    return u
def x_url(u):
    if not u: return None
    if not u.startswith("http"): u = "https://x.com/" + u.lstrip("@")
    u = u.replace("://twitter.com", "://x.com").replace("://www.x.com", "://x.com").replace("://www.twitter.com", "://x.com").replace("://mobile.x.com", "://x.com")
    m = re.match(r"^https?://x\.com/([A-Za-z0-9_]{1,15})(/status/\d+)?/?(\?.*)?$", u)
    if not m: return None
    if m.group(1).lower() in ("i", "search", "home", "intent", "share"): return None
    return f"https://x.com/{m.group(1)}{m.group(2) or ''}"

def best_pair(c):
    pairs = ds.get(f"{c['chain']}|{c['contract'].lower()}") or []
    if not pairs: return None
    if c.get("pairAddress"):
        for p in pairs:
            if p.get("pairAddress", "").lower() == c["pairAddress"].lower(): return p
    return max(pairs, key=lambda p: (p.get("liquidity") or {}).get("usd") or 0)

def sentences(t, n=2, maxc=330):
    if str(t).count("✔") + str(t).count("✅") >= 2: return ""
    t = clean(t).replace("\n", " ")
    t = re.sub(r"\s+", " ", t)
    parts = re.split(r"(?<=[.!?])\s+", t)
    out = ""
    for p in parts:
        p = p.strip()
        if not p: continue
        if re.search(r"\b(100x|1000x|10x|guarantee|to the moon|financial|invest|profit|buy now|ape in|next big)\b", p, re.I): continue
        if len(out) + len(p) + 1 > maxc: break
        out = (out + " " + p).strip()
        if out.count(".") + out.count("!") + out.count("?") >= n: break
    if not out and parts: out = parts[0][:maxc].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return out

PATTERN_WORDS = [("tuxedo", r"tux"), ("calico", r"calico"), ("tortie", r"tort"), ("point", r"point|siamese"), ("spotted", r"spot|leopard|bengal"),
                 ("tabby", r"tabby|stripe|mackerel|tiger"), ("bicolour", r"bi-?colou?r|white (face|chest|belly|muzzle)")]
def coat_from_look(look):
    if not isinstance(look, dict): return None
    hexes = [h.lower() for h in re.findall(r"#[0-9A-Fa-f]{6}", look.get("coat") or "")]
    if not hexes: return None
    words = f"{look.get('pattern','')} {look.get('coat','')} {look.get('breed','')}".lower()
    pattern = next((p for p, rx in PATTERN_WORDS if re.search(rx, words)), "solid")
    eyes = re.findall(r"#[0-9A-Fa-f]{6}", look.get("eyes") or "")
    second = next((h for h in hexes[1:] if h != hexes[0]), "")
    return {"base": hexes[0], "second": second, "pattern": pattern, "eyes": eyes[0].lower() if eyes else ""}

def coat_from_logo(img):
    try:
        im = img.convert("RGB")
        w, h = im.size
        im = im.crop((w * 0.2, h * 0.2, w * 0.8, h * 0.8)).resize((48, 48))
        q = im.quantize(colors=5, method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette()[:15]
        counts = sorted(q.getcolors(), reverse=True)
        cols = [tuple(pal[i * 3:i * 3 + 3]) for _, i in counts]
        def lum(c): return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
        def sat(c): return (max(c) - min(c)) / (max(c) + 1)
        # A cat's coat is rarely a vivid backdrop: prefer the most common muted colour.
        ranked = sorted(cols, key=lambda c: (sat(c) > 0.55) * 1)
        base = ranked[0]; second = next((c for c in ranked[1:] if abs(lum(c) - lum(base)) > 40), None)
        hx = lambda c: "#%02x%02x%02x" % c
        return {"base": hx(base), "second": hx(second) if second else "", "pattern": "bicolour" if second and abs(lum(second) - lum(base)) > 90 else "solid", "eyes": ""}
    except Exception:
        return None

def fetch_img(url):
    if not url: return None
    key = hashlib.sha1(url.encode()).hexdigest()
    path = f"{IMG_CACHE}/{key}"
    if not os.path.exists(path):
        try:
            req = urllib.request.Request(url, headers={"user-agent": "Mozilla/5.0 catcoinsanctuary-build", "accept": "image/*"})
            with urllib.request.urlopen(req, timeout=25) as r: data = r.read(6_000_000)
            open(path, "wb").write(data)
        except Exception as e:
            open(path + ".err", "w").write(str(e)); return None
    try:
        im = Image.open(path); im.load(); return im
    except Exception: return None

def fmt_usd(v):
    return f"${v:,.0f}"

now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
out, ids = [], set()
skipped = []
dropped_chains = {}
for c in coins:
    # Owner decision (2026-09-26): famous cat coins are Solana only.
    if c["chain"] != "solana":
        dropped_chains[c["chain"]] = dropped_chains.get(c["chain"], 0) + 1
        continue
    p = c.get("profile")
    pair = best_pair(c)
    g = gt.get(f"{c['chain']}|{c['contract'].lower()}") or {}
    cgd = cg.get(c.get("coingeckoId") or "") or {}
    name = clean((p or {}).get("name") or c.get("name") or (pair or {}).get("baseToken", {}).get("name") or cgd.get("name") or g.get("name") or "")
    symbol = clean((p or {}).get("symbol") or c.get("symbol") or (pair or {}).get("baseToken", {}).get("symbol") or g.get("symbol") or "").lstrip("$")
    if not text_ok(name): name = symbol if text_ok(symbol) else None
    if not text_ok(symbol): symbol = None
    if not name or not symbol: skipped.append((c.get("symbol") or c.get("srcId"), "name or symbol not showable")); continue
    name = name[:48]; symbol = symbol[:24]
    # id
    base = (p or {}).get("id") or c.get("srcId") or slug(name) or slug(symbol) or "coin"
    if not re.match(r"^[a-z0-9]", base): base = "c-" + base
    cid = base if len(base) >= 2 else base + "-coin"
    if cid in ids: cid = f"{base}-{c['chain']}"
    k = 2
    while cid in ids: cid = f"{base}-{k}"; k += 1
    ids.add(cid)
    company = COMPANY.get(c.get("symbol") or "") if c["list"] == "1m" else c.get("company")
    mcap = float(c["marketCapUsd"] or 0)
    tier = "main" if (company or mcap >= 1_000_000) else "ring1" if mcap >= 100_000 else "ring2"
    # pair
    quote = (pair or {}).get("quoteToken", {}).get("symbol") or c.get("pairQuote")
    quote = clean(quote) if quote and text_ok(clean(quote)) else None
    pair_url = (pair or {}).get("url") if (pair or {}).get("url", "").startswith(f"https://dexscreener.com/{c['chain']}/") else None
    pair_addr = (pair or {}).get("pairAddress") or c.get("pairAddress")
    dex = ((pair or {}).get("dexId") or c.get("dex") or None)
    if dex and not re.match(r"^[a-z0-9-]{2,40}$", dex): dex = None
    info = (pair or {}).get("info") or {}
    # links
    pc = (p or {}).get("coin") or {}
    xs = [pc.get("officialX"), c.get("x")] + [s.get("url") for s in info.get("socials", []) if s.get("type") == "twitter"] + ([g.get("twitter_handle")] if g.get("twitter_handle") else [])
    xlink = next((x_url(u) for u in xs if u and x_url(u)), None)
    webs = [pc.get("website"), c.get("website")] + [w.get("url") for w in info.get("websites", [])] + (g.get("websites") or [])
    web = next((https(u) for u in webs if u and https(u)), None)
    # logo
    img = None
    for u in [pc.get("imageUrl"), c.get("cgImage"), c.get("imageUrl"), info.get("imageUrl"), g.get("image_url"), (cgd.get("image"))]:
        if u and not str(u).startswith("missing"):
            img = fetch_img(u)
            if img: break
    logo = None
    if img:
        im = img.convert("RGBA")
        w, h = im.size; s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((96, 96), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, "WEBP", quality=80, method=6)
        open(f"{SITE}/assets/coins/{cid}.webp", "wb").write(buf.getvalue())
        logo = f"assets/coins/{cid}.webp"
    coat = coat_from_look((p or {}).get("look")) or (coat_from_logo(img) if img else None) or {"base": "cream", "second": "", "pattern": "tabby", "eyes": ""}
    # lore
    viral = None
    if p:
        cat_name = clean(p.get("catName"))[:120] or None
        who = clean(p.get("whoIsTheCat"))[:900]
        lore = clean(p.get("lore"))[:1200]
        lore_src = {"kind": "profile", "label": "The sanctuary's research on this cat", "url": None}
        v = p.get("virality") or {}
        if v.get("summary"):
            viral = {"summary": clean(v["summary"])[:900], "url": https(v.get("originalPostUrl"))}
    else:
        cat_name, who = None, ""
        desc = g.get("description") or cgd.get("description") or ""
        s2 = sentences(desc) if desc else ""
        net = GT_NET.get(c["chain"], c["chain"])
        if s2 and len(s2) > 25:
            lore = s2
            lore_src = {"kind": "coin", "label": "The coin's own description, as listed on GeckoTerminal" if g.get("description") else "The coin's own description, as listed on CoinGecko",
                        "url": f"https://www.geckoterminal.com/{net}/tokens/{c['contract']}" if g.get("description") else f"https://www.coingecko.com/en/coins/{c['coingeckoId']}"}
        else:
            where = f" against {quote}" if quote else ""
            on = f" on {DEX_LABEL(dex)}" if dex else ""
            lore = f"{name} (${symbol}) is a token on {CHAIN_LABEL.get(c['chain'], c['chain'])}, traded{where}{on}. Its listing gives no description of the cat."
            lore_src = {"kind": "listing", "label": "Its DexScreener listing", "url": pair_url or f"https://dexscreener.com/{c['chain']}/{c['contract']}"}
    # warnings (honest, specific)
    warns = []
    why = c.get("catWhy") or ""
    m = re.search(r"buy ([\d.]+)% / sell ([\d.]+)% tax", why)
    if m: warns.append(f"Taxed token: {m.group(1)}% tax when you buy and {m.group(2)}% when you sell (honeypot.is rates it high risk).")
    if "CoinGecko cat-themed" in why: warns.append("Listed as cat-themed by CoinGecko; its name and ticker don't say cat.")
    if "panther" in why.lower(): warns.append("A panther, not a house cat: here because 'panther' is in its name.")
    if c["symbol"] == "PURR" and c["chain"] == "solana": warns.append("Community coin, not Hyperliquid's official PURR.")
    if c["symbol"] == "NEARKAT": warns.append("A meerkat, not a cat: included as an owner pick.")
    if c["symbol"] == "BTC": warns.append("Its ticker is BTC, but it is not Bitcoin.")
    if company and "unofficial" in company.lower(): warns.append(f"Not made or endorsed by the company it is themed on.")
    if c.get("flagNote"): warns.append(c["flagNote"])
    d_all = (g.get("description") or "") + " " + (cgd.get("description") or "")
    if re.search(r"transfer tax|burn fee|\d+% (tax|fee)|tax on (every|each)|% of \$?\w+ (are|is) (automatically )?burned", d_all, re.I) and not m:
        warns.append("Takes a fee on transfers, by its own description.")
    vol, liq = float(c["volume24hUsd"] or 0), float(c["liquidityUsd"] or 0)
    # (Trading, liquidity and market-cap warnings are worked out on the card from the live figures.)
    disc = clean((p or {}).get("disclaimerNote") or "")
    if not (re.search(r"not affiliated", disc, re.I) and re.search(r"not financial advice", disc, re.I)) or len(disc) > 400:
        disc = f"Unofficial fan card. Catcoin Sanctuary is not affiliated with {name}, its team{', ' + company.split(' (')[0] if company else ''} or StonkFun. Not financial advice: memecoins are highly volatile and can go to zero. Always check the contract address yourself."
        if len(disc) > 400: disc = f"Unofficial fan card. Catcoin Sanctuary is not affiliated with {name} or its team. Not financial advice: memecoins are highly volatile and can go to zero."
    gm = GMGN.get(c["chain"])
    buy = {"label": "GMGN", "url": f"https://gmgn.ai/{gm}/token/{c['contract']}"} if gm else {"label": "DexScreener", "url": pair_url or f"https://dexscreener.com/{c['chain']}/{c['contract']}"}
    out.append({
        "id": cid, "name": name, "symbol": symbol, "chain": c["chain"], "contract": c["contract"],
        "pair": {"quote": quote, "address": pair_addr, "dex": dex, "url": pair_url},
        "company": company or None, "tier": tier, "logo": logo,
        "market": {"marketCapUsd": round(mcap), "liquidityUsd": round(liq), "volume24hUsd": round(vol), "measuredAt": c["measuredAt"][:19] + "Z" if not c["measuredAt"].endswith("Z") else c["measuredAt"][:19] + "Z", "source": "research"},
        "coingeckoId": c.get("coingeckoId"),
        "catName": cat_name, "who": who, "lore": lore, "loreSource": lore_src, "viral": viral,
        "links": {"x": xlink, "website": web}, "buy": buy, "warnings": warns[:8], "coat": coat,
        "ownerPick": bool(c.get("ownerPick")), "disclaimer": disc,
    })

out.sort(key=lambda x: ({"main": 0, "ring1": 1, "ring2": 2}[x["tier"]], -x["market"]["marketCapUsd"]))
doc = {
    "note": "Famous cat coins: coins that already exist, made by others, shown with their real token and pair. Not affiliated with Catcoin Sanctuary. Built from the sanctuary's research (selection of cat coins >= $20k market cap, 2026-09-25/26); market figures are refreshed daily from DexScreener and CoinGecko by scripts/refresh-famous.mjs. tier: main (>= $1M or a company or project cat), ring1 ($100k-$1M), ring2 (< $100k), fixed when the coin was placed.",
    "refreshedAt": now_iso, "coins": out,
}
line = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
text = '{\n "note": ' + json.dumps(doc["note"], ensure_ascii=False) + ',\n "refreshedAt": ' + json.dumps(doc["refreshedAt"]) + ',\n "coins": [\n' + ",\n".join("  " + line(c) for c in doc["coins"]) + "\n ]\n}\n"
open(f"{SITE}/data/famous.json", "w").write(text)
import collections
print(len(out), collections.Counter(x["tier"] for x in out), "logos", sum(1 for x in out if x["logo"]), "skipped", skipped, "dropped (not Solana)", dropped_chains, sum(dropped_chains.values()))
print("lore kinds", collections.Counter(x["loreSource"]["kind"] for x in out))
