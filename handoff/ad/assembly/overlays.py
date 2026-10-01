# Catcoin Sanctuary ad: graphics layer (supers, card, captions, end card).
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")
PLUM = (61, 18, 49)
CREAM = (255, 246, 226)
WHITE = (255, 255, 255)
INK = (176, 52, 74)

_fc = {}
def font(name, size, wght):
    key = (name, size, wght)
    if key not in _fc:
        f = ImageFont.truetype(os.path.join(FONT_DIR, name + ".ttf"), size)
        f.set_variation_by_axes([wght])
        _fc[key] = f
    return _fc[key]

def wrap(text, fnt, max_w):
    out = []
    for para in text.split("\n"):
        words, line = para.split(" "), ""
        for w in words:
            cand = (line + " " + w).strip()
            if fnt.getlength(cand) <= max_w or not line:
                line = cand
            else:
                out.append(line); line = w
        out.append(line)
    return out

def text_sprite(text, fnt, fill=WHITE, max_w=None, stroke=0, stroke_fill=PLUM,
                shadow=(0, 0, 0, 150), shadow_blur=7, shadow_off=(0, 3), line_gap=0.18, align="center"):
    lines = wrap(text, fnt, max_w) if max_w else text.split("\n")
    asc, desc = fnt.getmetrics()
    lh = int((asc + desc) * (1 + line_gap))
    widths = [fnt.getlength(l) + 2 * stroke for l in lines]
    pad = shadow_blur * 3 + stroke + 6
    W = int(max(widths)) + 2 * pad
    H = lh * len(lines) - int((asc + desc) * line_gap) + 2 * pad
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    for i, l in enumerate(lines):
        w = fnt.getlength(l) + 2 * stroke
        x = pad + (0 if align == "left" else (max(widths) - w) / 2 if align == "center" else max(widths) - w) + stroke
        d.text((x, pad + i * lh), l, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    if shadow:
        a = txt.getchannel("A").filter(ImageFilter.GaussianBlur(shadow_blur))
        sh = Image.new("RGBA", (W, H), shadow[:3] + (0,))
        sh.putalpha(a.point(lambda v: v * shadow[3] // 255))
        base.alpha_composite(sh, shadow_off)
    base.alpha_composite(txt)
    return base

def scrim(w, h, alpha=110, color=(20, 8, 16)):
    im = Image.new("RGBA", (w, h), color + (0,))
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).ellipse((w * 0.12, h * 0.18, w * 0.88, h * 0.82), fill=alpha)
    im.putalpha(m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.18)))
    return im

def vgrad(w, h, a0, a1, color=(12, 6, 10)):
    im = Image.new("RGBA", (w, h), color + (0,))
    m = Image.new("L", (1, h))
    for y in range(h):
        u = y / max(1, h - 1)
        m.putpixel((0, y), int(a0 + (a1 - a0) * (u * u * (3 - 2 * u))))
    im.putalpha(m.resize((w, h)))
    return im

def rounded(size, r, fill, outline=None, width=0):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=fill, outline=outline, width=width)
    return im

def blurred_text_line(w, h, seed, color=(90, 70, 84)):
    words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split()
    fnt = font("Figtree", int(h * 0.9), 600)
    im = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s, i, x = "", seed, 0
    while fnt.getlength(s) < w:
        s += words[i % len(words)] + " "; i += 7
    while fnt.getlength(s) > w and len(s) > 3:
        s = s[:-1]
    d.text((20, 20), s.strip(), font=fnt, fill=color)
    return im.filter(ImageFilter.GaussianBlur(h * 0.22))

def make_card(photo, scale=1.0):
    S = lambda v: int(round(v * scale))
    W, H = S(660), S(440)
    pad = S(40)
    card = Image.new("RGBA", (W + 2 * pad, H + 2 * pad), (0, 0, 0, 0))
    # soft drop shadow
    sh = rounded((W, H), S(30), (30, 10, 24, 120))
    shl = Image.new("RGBA", card.size, (0, 0, 0, 0)); shl.alpha_composite(sh, (pad, pad + S(10)))
    card.alpha_composite(shl.filter(ImageFilter.GaussianBlur(S(16))))
    card.alpha_composite(rounded((W, H), S(30), CREAM + (255,), PLUM + (255,), S(6)), (pad, pad))
    ox, oy = pad, pad
    # round photo thumbnail
    D = S(168)
    ph = photo.convert("RGB")
    side = min(ph.size); l = (ph.size[0] - side) // 2; t = (ph.size[1] - side) // 2
    ph = ph.crop((l, t, l + side, t + side)).resize((D, D), Image.LANCZOS)
    m = Image.new("L", (D * 4, D * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, D * 4 - 1, D * 4 - 1), fill=255)
    m = m.resize((D, D), Image.LANCZOS)
    ring = Image.new("RGBA", (D + S(14), D + S(14)), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((0, 0, D + S(13), D + S(13)), fill=PLUM + (255,))
    card.alpha_composite(ring, (ox + S(34) - S(7), oy + S(34) - S(7)))
    phr = ph.convert("RGBA"); phr.putalpha(m)
    card.alpha_composite(phr, (ox + S(34), oy + S(34)))
    # blurred name line + three blurred body lines
    nx = ox + S(232)
    card.alpha_composite(blurred_text_line(S(300), S(40), 3, PLUM), (nx - 20, oy + S(58) - 20))
    card.alpha_composite(blurred_text_line(S(220), S(24), 11, (140, 110, 128)), (nx - 20, oy + S(122) - 20))
    for i, (w, sd) in enumerate([(590, 1), (560, 5), (400, 9)]):
        card.alpha_composite(blurred_text_line(S(w), S(24), sd, (110, 88, 104)), (ox + S(34) - 20, oy + S(236) + i * S(44) - 20))
    # micro tag
    tag_f = font("Figtree", S(18), 650)
    tw = int(tag_f.getlength("Illustrative")) + S(26)
    tag = rounded((tw, S(32)), S(16), (232, 222, 214, 255))
    ImageDraw.Draw(tag).text((S(13), S(5)), "Illustrative", font=tag_f, fill=(110, 92, 104))
    card.alpha_composite(tag, (ox + W - tw - S(22), oy + S(20)))
    # stamp
    st_f = font("Nunito", S(30), 950)
    txt = "SOURCES & DATES"
    sw, shh = int(st_f.getlength(txt)) + S(36), S(58)
    st = Image.new("RGBA", (sw + S(10), shh + S(10)), (0, 0, 0, 0))
    ImageDraw.Draw(st).rounded_rectangle((S(5), S(5), sw + S(4), shh + S(4)), S(10), outline=INK + (230,), width=S(4))
    ImageDraw.Draw(st).text((S(5) + S(18), S(5) + S(10)), txt, font=st_f, fill=INK + (230,))
    st = st.rotate(-7, resample=Image.BICUBIC, expand=True)
    card.alpha_composite(st, (ox + W - st.size[0] - S(18), oy + H - st.size[1] - S(22)))
    return card

def make_badge(scale=1.0):
    S = lambda v: int(round(v * scale))
    f = font("Figtree", S(23), 760)
    txt = "Meme coin · No intrinsic value · Not financial advice"
    w = int(f.getlength(txt)) + S(44)
    h = S(48)
    pad = S(16)
    im = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.alpha_composite(rounded((w, h), h // 2, (20, 6, 16, 140)), (pad, pad + S(4)))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S(7))))
    im.alpha_composite(rounded((w, h), h // 2, PLUM + (255,), CREAM + (255,), S(3)), (pad, pad))
    ImageDraw.Draw(im).text((pad + S(22), pad + S(9)), txt, font=f, fill=CREAM)
    return im

# ---------------------------------------------------------------- animation
def ease_out_cubic(u): return 1 - (1 - u) ** 3
def ease_out_back(u, k=1.9): return 1 + (k + 1) * (u - 1) ** 3 + k * (u - 1) ** 2
def ease_out_bounce(u):
    n, d = 7.5625, 2.75
    if u < 1 / d: return n * u * u
    if u < 2 / d: u -= 1.5 / d; return n * u * u + 0.75
    if u < 2.5 / d: u -= 2.25 / d; return n * u * u + 0.9375
    u -= 2.625 / d; return n * u * u + 0.984375

class Sprite:
    def __init__(self, img, cx, cy, t0, t1, fin=0.25, fout=0.25, anim="fade", rise=18, dur=0.45, z=0):
        self.img, self.cx, self.cy, self.t0, self.t1 = img, cx, cy, t0, t1
        self.fin, self.fout, self.anim, self.rise, self.dur, self.z = fin, fout, anim, rise, dur, z
        self._a = img.getchannel("A")
    def state(self, t):
        if t < self.t0 or t >= self.t1: return None
        a = 1.0
        if self.fin > 0: a = min(a, (t - self.t0) / self.fin)
        if self.fout > 0: a = min(a, (self.t1 - t) / self.fout)
        a = max(0.0, min(1.0, a))
        s, dy = 1.0, 0.0
        u = max(0.0, min(1.0, (t - self.t0) / self.dur))
        if self.anim == "fade":
            dy = self.rise * (1 - ease_out_cubic(min(1.0, (t - self.t0) / max(self.fin, 1e-3) / 1.6)))
        elif self.anim == "pop":
            s = 0.55 + 0.45 * ease_out_back(u)
        elif self.anim == "drop":
            dy = -40 * (1 - ease_out_cubic(u)); s = 1.12 - 0.12 * ease_out_cubic(u)
        elif self.anim == "bounce":
            dy = -90 * (1 - ease_out_bounce(u)); s = 0.9 + 0.1 * ease_out_back(u)
        return a, s, dy
    def draw(self, frame, t):
        st = self.state(t)
        if not st: return
        a, s, dy = st
        img, alpha = self.img, self._a
        if abs(s - 1) > 1e-3:
            w, h = max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s))
            img = img.resize((w, h), Image.BICUBIC); alpha = img.getchannel("A")
        if a < 0.999:
            alpha = alpha.point(lambda v: int(v * a))
        x = int(round(self.cx - img.size[0] / 2)); y = int(round(self.cy - img.size[1] / 2 + dy))
        frame.paste(img.convert("RGB"), (x, y), alpha)

# ---------------------------------------------------------------- layouts
def build(layout, wordmark, photo, pos=None):
    """layout: '16x9' or '9x16'. Returns list of Sprites. pos: optional overrides."""
    P = dict(pos or {})
    sp = []
    if layout == "16x9":
        W, H = 1920, 1080
        sup = lambda txt, size=56, w=900: font("Nunito", size, w)
        def S(txt, t0, t1, cy, size=56, wght=850, cx=960):
            sp.append(Sprite(text_sprite(txt, font("Nunito", size, wght)), cx, cy, t0, t1, 0.28, 0.22))
        S("Look closer.", 0.3, 2.0, P.get("look_y", 930), 54)
        wm = wordmark.resize((400, int(400 * wordmark.size[1] / wordmark.size[0])), Image.LANCZOS)
        sp.append(Sprite(scrim(1100, 520, 95), 960, 850, 5.5, 9.0, 0.4, 0.3))
        sp.append(Sprite(wm, 960, 790, 5.5, 9.0, 0.15, 0.3, anim="pop", dur=0.5))
        S("A free 3D cat garden to explore", 5.75, 9.0, 950, 40, 850)
        sp.append(Sprite(text_sprite("Dramatised. The real site is a stylised 3D world.", font("Figtree", 21, 600),
                                     fill=(255, 255, 255), shadow=(0, 0, 0, 170), shadow_blur=4), 1590, 1040, 5.5, 9.0, 0.3, 0.3, rise=0))
        cx = P.get("card_x", 470); cy = P.get("card_y", 470)
        sp.append(Sprite(make_card(photo), cx, cy, 11.7, 16.35, 0.12, 0.2, anim="pop", dur=0.5, z=1))
        sp.append(Sprite(make_badge(), cx, cy + 250, 14.7, 16.35, 0.1, 0.2, anim="drop", dur=0.3, z=2))
        sp.append(Sprite(text_sprite("Every cat has a card, with sources and dates.", font("Nunito", 40, 850)), cx, cy + 360, 11.95, 16.35, 0.3, 0.2))
        S("New cats arrive every hour.", 16.7, 19.0, 930, 56)
        S("Who’s that cat?", 19.4, 21.8, P.get("who_y", 930), 64, 900)
        S("Settling right in.", 24.6, 26.8, 950, 44, 800)
        S("Who’s next?", 28.7, 30.5, P.get("next_y", 880), 64, 900)
        S("New cats every hour on X · @catcosanctuary", 29.0, 30.5, P.get("next_y", 880) + 80, 36, 800)
        # end card
        wy, ey = P.get("wm_y", 205), P.get("end_y", 420)
        sp.append(Sprite(scrim(1400, 560, 90), 960, wy, 33.8, 38.5, 0.6, 0.0))
        sp.append(Sprite(scrim(1500, 460, 125), 960, ey + 75, 33.8, 38.5, 0.6, 0.0))
        sp.append(Sprite(vgrad(1920, 150, 0, 150), 960, 1005, 33.8, 38.5, 0.5, 0.0))
        ww = P.get("wm_w", 560)
        wm2 = wordmark.resize((ww, int(ww * wordmark.size[1] / wordmark.size[0])), Image.LANCZOS)
        sp.append(Sprite(wm2, 960, wy, 33.8, 38.5, 0.12, 0.0, anim="bounce", dur=0.75, z=3))
        sp.append(Sprite(text_sprite("A free 3D cat garden to explore.", font("Nunito", 48, 850)), 960, ey, 34.25, 38.5, 0.35, 0.0))
        sp.append(Sprite(text_sprite("catcoinsanctuary.com", font("Nunito", 60, 950), fill=CREAM, stroke=5, stroke_fill=PLUM), 960, ey + 80, 34.45, 38.5, 0.35, 0.0))
        sp.append(Sprite(text_sprite("New cats every hour on X · @catcosanctuary", font("Nunito", 34, 800)), 960, ey + 150, 34.65, 38.5, 0.35, 0.0))
        sp.append(Sprite(text_sprite("Meme coins: not affiliated with any company, no intrinsic value, not financial advice. Scenes dramatised; the site is a stylised 3D world.",
                                     font("Figtree", 23, 560), shadow=(0, 0, 0, 190), shadow_blur=4), 960, 1046, 33.8, 38.5, 0.3, 0.0, rise=0))
    else:
        W, H = 1080, 1920
        CX = 500  # keep text clear of the right-hand 140 px
        def S(txt, t0, t1, cy, size=66, wght=880, maxw=800, z=0):
            sp.append(Sprite(text_sprite(txt, font("Nunito", size, wght), max_w=maxw), CX, cy, t0, t1, 0.28, 0.22, z=z))
        def CAP(txt, t0, t1, cy):
            S(txt, t0, t1, cy, 50, 820, 800)
        sp.append(Sprite(text_sprite("Look closer.", font("Nunito", 104, 950), max_w=800), CX, P.get("look_y", 1420), 0.0, 2.0, 0.0, 0.22, rise=0))
        CAP("Welcome to Catcoin Sanctuary:\na free 3D garden full of cats.", 5.4, 9.6, P.get("cap1_y", 1060))
        wm = wordmark.resize((440, int(440 * wordmark.size[1] / wordmark.size[0])), Image.LANCZOS)
        sp.append(Sprite(scrim(1000, 700, 95), CX, 1400, 5.5, 9.0, 0.4, 0.3))
        sp.append(Sprite(wm, CX, 1330, 5.5, 9.0, 0.15, 0.3, anim="pop", dur=0.5))
        S("A free 3D cat garden to explore", 5.75, 9.0, 1500, 42, 850)
        sp.append(Sprite(text_sprite("Dramatised. The real site is a stylised 3D world.", font("Figtree", 24, 600),
                                     shadow=(0, 0, 0, 170), shadow_blur=4, max_w=760), 920 - 300, 1618, 5.5, 9.0, 0.3, 0.3, rise=0))
        cy = P.get("card_y", 1215); cs = P.get("card_s", 1.0)
        sp.append(Sprite(make_card(photo, cs), CX, cy, 11.7, 16.35, 0.12, 0.2, anim="pop", dur=0.5, z=1))
        sp.append(Sprite(make_badge(1.0), CX, cy + int(262 * cs), 14.7, 16.35, 0.1, 0.2, anim="drop", dur=0.3, z=2))
        CAP("Every cat has a card, with sources and dates.", 11.7, 14.75, cy + P.get("cap_dy", 375))
        CAP("Some cats get a meme coin.", 14.8, 16.4, cy + P.get("cap_dy", 375))
        S("New cats arrive\nevery hour.", 16.7, 19.0, P.get("new_y", 1300), 70)
        S("Who’s that cat?", 19.4, 21.8, P.get("who_y", 1500), 82, 950)
        S("Someone new.\nSettling right in.", 24.5, 26.8, P.get("settle_y", 1560), 62, 880)
        S("Who’s next?", 28.7, 30.5, P.get("next_y", 1440), 82, 950)
        S("New cats every hour on X · @catcosanctuary", 29.0, 30.5, P.get("next_y", 1440) + 100, 35, 820, maxw=860)
        # end card
        sp.append(Sprite(scrim(1080, 900, 110), 540, 480, 33.8, 38.5, 0.6, 0.0))
        sp.append(Sprite(scrim(1080, 700, 120), CX, 1230, 33.8, 38.5, 0.6, 0.0))
        sp.append(Sprite(vgrad(1080, 420, 0, 150), 540, 1640, 33.8, 38.5, 0.5, 0.0))
        ww = P.get("wm_w", 620)
        wm2 = wordmark.resize((ww, int(ww * wordmark.size[1] / wordmark.size[0])), Image.LANCZOS)
        sp.append(Sprite(wm2, CX, P.get("wm_y", 430), 33.8, 38.5, 0.12, 0.0, anim="bounce", dur=0.75, z=3))
        ey = P.get("end_y", 1150)
        sp.append(Sprite(text_sprite("A free 3D cat garden to explore.", font("Nunito", 52, 850), max_w=820), CX, ey, 34.25, 38.5, 0.35, 0.0))
        sp.append(Sprite(text_sprite("catcoinsanctuary.com", font("Nunito", 64, 950), fill=CREAM, stroke=5, stroke_fill=PLUM), CX, ey + 90, 34.45, 38.5, 0.35, 0.0))
        sp.append(Sprite(text_sprite("New cats every hour on X · @catcosanctuary", font("Nunito", 37, 800), max_w=820), CX, ey + 168, 34.65, 38.5, 0.35, 0.0))
        sp.append(Sprite(text_sprite("Meme coins: not affiliated with any company,\nno intrinsic value, not financial advice.\nScenes dramatised; the site is a stylised 3D world.",
                                     font("Figtree", 28, 580), shadow=(0, 0, 0, 200), shadow_blur=4, max_w=860), CX, 1585, 33.8, 38.5, 0.3, 0.0, rise=0))
    sp.sort(key=lambda s: s.z)
    return sp

def render(frame, sprites, t):
    for s in sprites:
        s.draw(frame, t)
    return frame
