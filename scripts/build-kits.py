#!/usr/bin/env python3
"""Build each cat's LAUNCH KIT pictures for the Adopt panel (assets/ui/adopt.js).

For every planned cat (data/planned.json) and adoptable cat (data/adoptables.json) whose portrait
is on the site (assets/portraits/<T>.jpg), this writes:

  assets/kits/<T>/token.png         the Sanctuary-portrait token logo: the cat's portrait, square 1024x1024 PNG, <= 2 MB
  assets/kits/<T>/banner.png        a 1500x500 banner in the site's style: the evening garden, the
                                    cat's lore picture (assets/lore/<T>.webp, else its portrait) as
                                    the hero on the right, its name in the Gluten lettering (cream
                                    with a plum outline), the Catcoin Sanctuary wordmark and
                                    catcoinsanctuary.com. The bottom-left 420x170 (where X puts the
                                    profile picture) is left clear.
  assets/kits/<T>/banner-plain.png  the same size with no Sanctuary branding: just the cat and its name.

and assets/kits/kits.json: { built, cats: { <T>: { token, banner, bannerPlain, tokenSha256, photo } } },
which the Adopt panel reads to know which kits exist. tokenSha256 lets a later check match a launch's
image to this kit. photo is { url, handle, post } for the first photo in the cat's X proof post
(read from api.fxtwitter.com), or null: only its pbs.twimg.com address and credit are kept, the
photo itself is never copied here. The portraits and lore pictures are generated pictures.

Run: python3 scripts/build-kits.py [--offline] [TICKER ...]   (no tickers: every cat). Needs Pillow.
"""
import hashlib
import io
import json
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
KITS = ROOT / "assets" / "kits"
FONT = ROOT / "assets" / "fonts" / "gluten-latin.woff2"
SCENE = ROOT / "assets" / "brand" / "loading-scene.webp"
WORDMARK = ROOT / "assets" / "brand" / "wordmark-480.webp"

TOKEN_SIZE = 1024
TOKEN_MAX_BYTES = 2 * 1024 * 1024
BANNER = (1500, 500)
AVATAR_ZONE = (0, 500 - 170, 420, 500)  # left, top, right, bottom: kept clear for the X avatar

CREAM = (255, 243, 220)
AMBER = (245, 160, 44)
PLUM = (61, 24, 52)
SKY_TOP = (58, 32, 82)
SKY = (138, 79, 110)
HAZE = (242, 163, 106)


def cats():
    planned = json.loads((ROOT / "data" / "planned.json").read_text())["cats"]
    try:
        adopt = json.loads((ROOT / "data" / "adoptables.json").read_text())["cats"]
    except (OSError, ValueError, KeyError):
        adopt = []
    out = {}
    for c in [*planned, *adopt]:
        out.setdefault(c["ticker"], {"ticker": c["ticker"], "name": c["name"], "proof": c.get("proof") or None})
    return out


def proof_photo(proof):
    """The first PHOTO in the cat's X proof post, as { url, handle, post }, or None (no X post, no
    photo, only a video or a link-card picture). Read from api.fxtwitter.com; only the address and
    the credit are kept: the photo is never copied to this site."""
    import re
    import urllib.request
    if not proof or proof.get("kind") != "x":
        return None
    m = re.match(r"^https://(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})/status/(\d+)", proof.get("url") or "")
    if not m:
        return None
    req = urllib.request.Request(f"https://api.fxtwitter.com/{m[1]}/status/{m[2]}", headers={"User-Agent": "catcoinsanctuary-kit-builder"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            tweet = json.load(r).get("tweet") or {}
    except (OSError, ValueError):
        return None
    photos = [x for x in ((tweet.get("media") or {}).get("all") or []) if x.get("type") == "photo" and str(x.get("url", "")).startswith("https://pbs.twimg.com/")]
    if not photos:
        return None
    handle = ((tweet.get("author") or {}).get("screen_name")) or m[1]
    return {"url": photos[0]["url"], "handle": handle, "post": proof["url"]}


def font(size, weight=800):
    f = ImageFont.truetype(str(FONT), size)
    try:
        f.set_variation_by_axes([weight])
    except (OSError, AttributeError):
        pass
    return f


def cover(img, w, h):
    """Scale and centre-crop img to exactly w x h."""
    s = max(w / img.width, h / img.height)
    img = img.resize((max(w, round(img.width * s)), max(h, round(img.height * s))), Image.LANCZOS)
    l, t = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((l, t, l + w, t + h))


def rounded(img, radius):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(m)
    return out


def token_png(portrait):
    img = cover(Image.open(portrait).convert("RGB"), TOKEN_SIZE, TOKEN_SIZE)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    if buf.tell() > TOKEN_MAX_BYTES:  # a busy picture: 256 colours still look right at logo size
        buf = io.BytesIO()
        img.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(buf, "PNG", optimize=True)
    return buf.getvalue()


def fit_name(draw, name, max_w, start=112, least=44):
    """The biggest Gluten size (and up to two lines) that fits the name in max_w."""
    words = name.split()
    for size in range(start, least - 1, -4):
        f = font(size)
        if draw.textlength(name, font=f) <= max_w:
            return f, [name]
        for i in range(1, len(words)):
            a, b = " ".join(words[:i]), " ".join(words[i:])
            if size <= 92 and max(draw.textlength(a, font=f), draw.textlength(b, font=f)) <= max_w:
                return f, [a, b]
    f = font(least)
    return f, [name]


def lettering(img, xy, lines, f, fill=CREAM, stroke=PLUM, sw=None, shadow=True):
    """The site's cat lettering: cream letters, a chunky plum outline and a soft drop."""
    d = ImageDraw.Draw(img)
    sw = sw or max(3, f.size // 11)
    x, y = xy
    lh = round(f.size * 1.08)
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        for i, line in enumerate(lines):
            sd.text((x + 3, y + i * lh + 7), line, font=f, fill=(*PLUM, 150), stroke_width=sw, stroke_fill=(*PLUM, 150))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3)))
    for i, line in enumerate(lines):
        d.text((x, y + i * lh), line, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
    return y + len(lines) * lh


def hero_picture(ticker, portrait):
    lore = ROOT / "assets" / "lore" / f"{ticker}.webp"
    if lore.exists():
        return cover(Image.open(lore).convert("RGB"), 630, 420)
    return cover(Image.open(portrait).convert("RGB"), 420, 420)


def framed(pic):
    """The hero picture in a rounded plum frame with a soft shadow."""
    pad = 7
    frame = Image.new("RGBA", (pic.width + pad * 2, pic.height + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, frame.width - 1, frame.height - 1), 30, fill=(*PLUM, 255))
    ImageDraw.Draw(frame).rounded_rectangle((3, 3, frame.width - 4, frame.height - 4), 27, fill=(*CREAM, 255))
    frame.alpha_composite(rounded(pic, 24), (pad, pad))
    return frame


def paste_hero(img, pic):
    fr = framed(pic)
    x, y = BANNER[0] - fr.width - 44, (BANNER[1] - fr.height) // 2
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x + 4, y + 12, x + fr.width + 4, y + fr.height + 12), 30, fill=(*PLUM, 120))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
    img.alpha_composite(fr, (x, y))
    return x


def sky(w, h):
    g = Image.new("RGB", (1, h))
    for yy in range(h):
        t = yy / (h - 1)
        a, b, u = (SKY_TOP, SKY, t / 0.65) if t < 0.65 else (SKY, HAZE, (t - 0.65) / 0.35)
        g.putpixel((0, yy), tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3)))
    return g.resize((w, h))


def banner_branded(ticker, name, portrait):
    img = cover(Image.open(SCENE).convert("RGB"), *BANNER).convert("RGBA")
    # Dusk wash on the left so the lettering reads over the garden.
    wash = Image.new("RGBA", BANNER, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    for xx in range(0, 900):
        a = round(170 * max(0.0, 1 - xx / 900) ** 1.2)
        wd.line((xx, 0, xx, BANNER[1]), fill=(*SKY_TOP, a))
    img.alpha_composite(wash)
    hero_x = paste_hero(img, hero_picture(ticker, portrait))
    d = ImageDraw.Draw(img)
    max_w = hero_x - 60 - 36
    f, lines = fit_name(d, name, max_w)
    bottom = lettering(img, (60, 48), lines, f)
    # The wordmark and the address sit above the avatar zone (y < 330).
    wm = Image.open(WORDMARK).convert("RGBA")
    wm = wm.resize((200, round(200 * wm.height / wm.width)), Image.LANCZOS)
    wy = min(max(bottom + 14, 170), AVATAR_ZONE[1] - wm.height - 4)
    img.alpha_composite(wm, (56, wy))
    small = font(30, 600)
    d.text((272, wy + wm.height // 2 - 18), "catcoinsanctuary.com", font=small, fill=CREAM, stroke_width=3, stroke_fill=PLUM)
    return img.convert("RGB")


def banner_plain(ticker, name, portrait):
    img = sky(*BANNER).convert("RGBA")
    hero_x = paste_hero(img, hero_picture(ticker, portrait))
    d = ImageDraw.Draw(img)
    f, lines = fit_name(d, name, hero_x - 60 - 36)
    lh = round(f.size * 1.08)
    top = max(40, (AVATAR_ZONE[1] - len(lines) * lh) // 2)
    lettering(img, (60, top), lines, f)
    return img.convert("RGB")


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def main(argv):
    all_cats = cats()
    offline = "--offline" in argv  # keep the proof photos already in kits.json; call nothing
    only = {a for a in argv if not a.startswith("--")} or None
    index_path = KITS / "kits.json"
    try:
        index = json.loads(index_path.read_text())
    except (OSError, ValueError):
        index = {"cats": {}}
    built = skipped = 0
    for t, c in sorted(all_cats.items()):
        if only and t not in only:
            continue
        portrait = ROOT / "assets" / "portraits" / f"{t}.jpg"
        if not portrait.exists():
            skipped += 1
            continue
        out = KITS / t
        out.mkdir(parents=True, exist_ok=True)
        tok = token_png(portrait)
        (out / "token.png").write_bytes(tok)
        (out / "banner.png").write_bytes(png_bytes(banner_branded(t, c["name"], portrait)))
        (out / "banner-plain.png").write_bytes(png_bytes(banner_plain(t, c["name"], portrait)))
        old = index["cats"].get(t) or {}
        photo = old.get("photo") if offline else proof_photo(c["proof"])
        index["cats"][t] = {
            "token": f"assets/kits/{t}/token.png",
            "banner": f"assets/kits/{t}/banner.png",
            "bannerPlain": f"assets/kits/{t}/banner-plain.png",
            "tokenSha256": hashlib.sha256(tok).hexdigest(),
            "photo": photo,
        }
        built += 1
    # Drop entries whose cat is gone.
    index["cats"] = {t: v for t, v in sorted(index["cats"].items()) if t in all_cats}
    index = {"note": "Launch kits built by scripts/build-kits.py; read by assets/ui/adopt.js.", "built": date.today().isoformat(), "cats": index["cats"]}
    KITS.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, indent=2) + "\n")
    print(f"built {built} kits, skipped {skipped} without a portrait; {len(index['cats'])} in kits.json")


if __name__ == "__main__":
    main(sys.argv[1:])
