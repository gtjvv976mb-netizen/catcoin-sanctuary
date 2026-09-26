"""Catcoin Sanctuary - approach A "bold type band".

Builds, from the clean source art only (s1.png, cmc-banner-b.png, Gluten, Figtree):
  avatar.png (1024, circle-safe) + avatar-400.png
  square.png (1024)              + square-400.png
  banner.png (1500x500, X header)
  sheet.jpg  (contact sheet: avatar circle @400/96/48, square @400, banner @750)
Run:  python3 make.py      (paths resolve relative to this file; writes next to it)
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.abspath(os.path.join(HERE, '..', '..', '..'))      # .../scratchpad
S1 = os.path.join(SCR, 'logo', 's1.png')
WIDE = os.path.join(SCR, 'kit', 'cmc-banner-b.png')
GLUTEN = os.path.join(SCR, 'kit', 'Gluten.ttf')
FIGTREE = os.path.join(SCR, 'kit', 'Figtree.ttf')

CREAM = (255, 244, 228)
AMBER = (255, 178, 92)
STROKE = (46, 28, 40)
PLUM = (30, 23, 38)
DEEP = (20, 12, 20)            # extrusion + soft shadow tone
FILL_C = ((255, 250, 241), (255, 234, 206))   # "Catcoin"  cream, top -> bottom
FILL_S = ((255, 198, 120), (255, 160, 68))    # "Sanctuary" amber, top -> bottom
LANCZOS = Image.Resampling.LANCZOS
BOX = Image.Resampling.BOX
SS = 4                          # text supersampling factor (draw at 4x, box-filter down)
WEIGHT = 800                    # Gluten wght axis (700 = Bold; 800 reads better when tiny)
SAFE_R = 476                    # avatar: all lettering within this radius of the centre


def gluten(px):
    f = ImageFont.truetype(GLUTEN, px)
    f.set_variation_by_axes([WEIGHT, 0])
    return f


def figtree(px, w=600):
    f = ImageFont.truetype(FIGTREE, px)
    f.set_variation_by_axes([w])
    return f


def gluten_width(text, px):
    return gluten(px).getlength(text)


def vgrad(size, top, bot, y0, y1):
    """RGB vertical gradient, computed in float (no banding)."""
    w, h = size
    t = np.clip((np.arange(h) - y0) / max(1, (y1 - y0)), 0, 1)[:, None, None]
    a = np.array(top, float)[None, None, :]
    b = np.array(bot, float)[None, None, :]
    arr = np.repeat(a + (b - a) * t, w, axis=1)
    return Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), 'RGB')


def lockup(s_size, stroke_em=0.085, extrude_em=0.055, shadow=(0.07, 0.10, 0.55), gap_em=0.02):
    """Two-line justified name: 'Catcoin' is sized so it is exactly as wide as 'Sanctuary'.
    Returns (rgba_1x, ink_mask_1x, ink_bbox) where ink = letters + outline + extrusion
    (the soft shadow is excluded from ink but kept inside the returned image)."""
    c_size = s_size * gluten_width('Sanctuary', 400) / gluten_width('Catcoin', 400)
    lines = [('Catcoin', c_size, FILL_C), ('Sanctuary', s_size, FILL_S)]
    stroke_px = stroke_em * s_size * SS          # same outline weight on both lines
    s = int(round(stroke_px))
    fonts = [gluten(int(round(sz * SS))) for _, sz, _ in lines]
    boxes = [f.getbbox(t, stroke_width=s) for f, (t, _, _) in zip(fonts, lines)]
    W = max(b[2] - b[0] for b in boxes)
    pad = int(0.4 * s_size * SS)
    ys, y = [], pad
    for (t, sz, _), b in zip(lines, boxes):
        ys.append(y - b[1])
        y += (b[3] - b[1]) + int(gap_em * s_size * SS)
    H = y + pad
    Wc = W + 2 * pad
    Wc += (-Wc) % SS
    H += (-H) % SS
    m_str = Image.new('L', (Wc, H), 0)
    m_fill = Image.new('L', (Wc, H), 0)
    fill_rgb = Image.new('RGB', (Wc, H), 0)
    for f, (t, sz, (ft, fb)), b, yy in zip(fonts, lines, boxes, ys):
        x = pad + (W - (b[2] - b[0])) // 2 - b[0]
        ImageDraw.Draw(m_str).text((x, yy), t, font=f, fill=255, stroke_width=s, stroke_fill=255)
        mf = Image.new('L', (Wc, H), 0)
        ImageDraw.Draw(mf).text((x, yy), t, font=f, fill=255)
        fill_rgb.paste(vgrad((Wc, H), ft, fb, yy + b[1] + s, yy + b[3] - s), (0, 0), mf)
        m_fill = ImageChops.lighter(m_fill, mf)
    ext = int(round(extrude_em * s_size * SS))
    m_ext = Image.new('L', (Wc, H), 0)
    for dy in range(SS, ext + 1, SS):
        m_ext = ImageChops.lighter(m_ext, ImageChops.offset(m_str, 0, dy))
    ink = ImageChops.lighter(m_str, m_ext)
    sh_dy, sh_blur, sh_op = shadow
    m_sh = ImageChops.offset(ink, 0, int(sh_dy * s_size * SS))
    m_sh = m_sh.filter(ImageFilter.GaussianBlur(sh_blur * s_size * SS)).point(lambda v: int(v * sh_op))
    out = Image.new('RGBA', (Wc, H), (0, 0, 0, 0))
    out.paste(Image.new('RGBA', (Wc, H), DEEP + (255,)), (0, 0), m_sh)
    out.paste(Image.new('RGBA', (Wc, H), DEEP + (255,)), (0, 0), m_ext)
    out.paste(Image.new('RGBA', (Wc, H), STROKE + (255,)), (0, 0), m_str)
    out.paste(fill_rgb.convert('RGBA'), (0, 0), m_fill)
    size1 = (Wc // SS, H // SS)
    img, ink1 = out.resize(size1, BOX), ink.resize(size1, BOX)
    return img, ink1, ink1.getbbox()


def put(canvas, lk, x_ink, y_ink, anchor='center'):
    """Composite a lockup so its ink box's top edge is at y_ink and its centre (or left
    edge) is at x_ink. Returns the full-canvas ink mask."""
    img, ink, (l, t, r, b) = lk
    x = x_ink - (l + r) / 2 if anchor == 'center' else x_ink - l
    x, y = int(round(x)), int(round(y_ink - t))
    canvas.alpha_composite(img, (x, y))
    full = Image.new('L', canvas.size, 0)
    full.paste(ink, (x, y))
    return full


def max_radius(mask, cx, cy):
    """Distance from (cx, cy) to the farthest corner of any non-zero pixel (conservative)."""
    ys, xs = np.nonzero(np.array(mask))
    dx = np.maximum(np.abs(xs - cx), np.abs(xs + 1 - cx))
    dy = np.maximum(np.abs(ys - cy), np.abs(ys + 1 - cy))
    return float(np.sqrt(dx * dx + dy * dy).max())


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def vband(size, stops, color=PLUM):
    """Vertical plum overlay. stops = [(y, alpha), ...] smoothstep-interpolated."""
    w, h = size
    y = np.arange(h, dtype=float)
    a = np.full(h, stops[0][1])
    for (y0, a0), (y1, a1) in zip(stops, stops[1:]):
        seg = (y >= y0) & (y <= y1)
        a[seg] = a0 + (a1 - a0) * smooth((y[seg] - y0) / (y1 - y0))
        a[y > y1] = a1
    lay = Image.new('RGBA', size, color + (0,))
    lay.putalpha(Image.fromarray(np.repeat((a * 255 + 0.5).astype(np.uint8)[:, None], w, axis=1), 'L'))
    return lay


def scene_s1(k, ox, oy, S=1024):
    src = Image.open(S1).convert('RGB')
    n = round(1024 * k)
    big = src.resize((n, n), LANCZOS)
    assert 0 <= ox <= n - S and 0 <= oy <= n - S, 'crop leaves the scaled scene'
    return big.crop((ox, oy, ox + S, oy + S)).convert('RGBA')


# ------------------------------------------------------------------ AVATAR (circle-safe)
AV = dict(k=1.22, ox=80, oy=210, top=486,
          band=[(400, 0.0), (590, 0.86), (810, 0.86), (1024, 0.62)])


def fit_avatar_size(top, lo=110.0, hi=160.0, limit=SAFE_R - 1.0):
    """Largest 'Sanctuary' size whose lettering (ink top fixed at `top`) stays inside `limit`."""
    best = None
    for _ in range(9):
        mid = (lo + hi) / 2
        lk = lockup(mid)
        c = Image.new('RGBA', (1024, 1024))
        r = max_radius(put(c, lk, 512, top), 512, 512)
        if r <= limit:
            best, lo = (mid, lk, r), mid
        else:
            hi = mid
    return best


def make_avatar(s_size=None):
    S = 1024
    im = scene_s1(AV['k'], AV['ox'], AV['oy'])
    im.alpha_composite(vband((S, S), AV['band']))
    if s_size is None:
        s_size, lk, _ = fit_avatar_size(AV['top'])
    else:
        lk = lockup(s_size)
    ink = put(im, lk, S / 2, AV['top'])
    r = max_radius(ink, S / 2, S / 2)
    return im.convert('RGB'), r, ink.getbbox(), s_size, lk


# ------------------------------------------------------------------ SQUARE
SQ = dict(k=1.16, ox=50, oy=80, s_frac=0.83, bottom=968,
          band=[(480, 0.0), (680, 0.86), (1024, 0.9)])


def make_square():
    S = 1024
    im = scene_s1(SQ['k'], SQ['ox'], SQ['oy'])
    im.alpha_composite(vband((S, S), SQ['band']))
    # size so the 'Sanctuary' glyphs (no outline) span s_frac of the width
    s_size = SQ['s_frac'] * S / (gluten_width('Sanctuary', 1000) / 1000)
    lk = lockup(s_size)
    l, t, r, b = lk[2]
    ink = put(im, lk, S / 2, SQ['bottom'] - (b - t))
    return im.convert('RGB'), ink.getbbox(), s_size


# ------------------------------------------------------------------ BANNER 1500x500
BN = dict(scale=0.96, oy=38, x_left=58, top=42, right_max=838, fade_end=872, wash=0.9,
          tag='Every cat here is a token.', url='catcoinsanctuary.com  ·  $CATSANC')


def make_banner():
    W, H = 1500, 500
    src = Image.open(WIDE).convert('RGB')
    sw, sh = round(src.width * BN['scale']), round(src.height * BN['scale'])
    sc = src.resize((sw, sh), LANCZOS).crop((0, BN['oy'], sw, BN['oy'] + H))
    x0 = W - sw                                  # scene flush right
    im = Image.new('RGBA', (W, H), PLUM + (255,))
    im.paste(sc.convert('RGBA'), (x0, 0))
    # fill the strip left of the scene with its own mirror image (seamless sky/meadow)
    im.paste(sc.crop((0, 0, x0, H)).transpose(Image.Transpose.FLIP_LEFT_RIGHT).convert('RGBA'), (0, 0))
    # left plum wash, sky-toned at the top, easing out just before the cat (cat tail ~x 881)
    xs = np.arange(W, dtype=float)
    a = BN['wash'] * (1 - smooth((xs - 150) / (BN['fade_end'] - 150)))
    a = np.where(xs < 150, BN['wash'], a)[None, :].repeat(H, axis=0)
    wash = vgrad((W, H), (44, 27, 58), (26, 19, 33), 0, H).convert('RGBA')
    wash.putalpha(Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(wash)
    # title: justified lockup, left-aligned, sized so its ink runs exactly x_left -> right_max
    probe = lockup(100)[2]
    s_size = 100 * (BN['right_max'] - BN['x_left']) / (probe[2] - probe[0])
    lk = lockup(s_size, shadow=(0.06, 0.09, 0.6))
    ink = put(im, lk, BN['x_left'], BN['top'], anchor='left')
    l, t, r, b = ink.getbbox()
    # secondary lines, right-aligned to the title's right edge (keeps x<420,y>330 clear for the avatar)
    d = ImageDraw.Draw(im)
    f1, f2 = figtree(31, 650), figtree(24, 560)
    right = r - 6
    tb = d.textbbox((0, 0), BN['tag'], font=f1)
    ub = d.textbbox((0, 0), BN['url'], font=f2)
    tx, ty = right - tb[2], b + 16 - tb[1]
    ux, uy = right - ub[2], ty + tb[3] + 12 - ub[1]
    sec = (min(tx + tb[0], ux + ub[0]), ty + tb[1], right, uy + ub[3])
    # soft plum pool behind the secondary lines so they sit calmly on the busy meadow
    pool = Image.new('L', (W, H), 0)
    ImageDraw.Draw(pool).rounded_rectangle((sec[0] - 26, sec[1] - 14, sec[2] + 22, sec[3] + 16), 30, fill=150)
    pool = pool.filter(ImageFilter.GaussianBlur(22))
    im.paste(Image.new('RGBA', (W, H), PLUM + (255,)), (0, 0), pool)
    for (x, y, txt, f, col) in [(tx, ty, BN['tag'], f1, CREAM), (ux, uy, BN['url'], f2, AMBER)]:
        shl = Image.new('L', (W, H), 0)
        ImageDraw.Draw(shl).text((x, y + 2), txt, font=f, fill=255, stroke_width=2, stroke_fill=255)
        shl = shl.filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.6))
        im.paste(Image.new('RGBA', (W, H), DEEP + (255,)), (0, 0), shl)
        ImageDraw.Draw(im).text((x, y), txt, font=f, fill=col)
    return im.convert('RGB'), (l, t, r, b), sec, s_size


# ------------------------------------------------------------------ contact sheet
def circle(im, s, bg):
    t = im.resize((s * 4, s * 4), LANCZOS)
    m = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    out = Image.new('RGB', (s * 4, s * 4), bg)
    out.paste(t, (0, 0), m)
    return out.resize((s, s), LANCZOS) if s != s * 4 else out


def circle_exact(im, s, bg):
    """Downscale first (as X does), then mask with a supersampled circle."""
    t = im.resize((s, s), LANCZOS)
    m = Image.new('L', (s * 8, s * 8), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 8 - 1, s * 8 - 1), fill=255)
    m = m.resize((s, s), LANCZOS)
    out = Image.new('RGB', (s, s), bg)
    out.paste(t, (0, 0), m)
    return out


def make_sheet(av, sq, bn):
    bg = (22, 17, 28)
    W, H = 1640, 900
    sh = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(sh)
    lab = figtree(20, 600)
    d.text((40, 24), 'Catcoin Sanctuary - approach A (bold type band)', font=figtree(26, 700), fill=CREAM)
    sh.paste(circle_exact(av, 400, bg), (40, 80))
    d.text((40, 490), 'avatar, circle @400', font=lab, fill=(200, 190, 200))
    sh.paste(circle_exact(av, 96, bg), (470, 80))
    d.text((470, 186), '@96', font=lab, fill=(200, 190, 200))
    sh.paste(circle_exact(av, 48, bg), (590, 104))
    d.text((590, 186), '@48', font=lab, fill=(200, 190, 200))
    # the same small sizes on a light timeline background
    lt = (245, 245, 247)
    d.rectangle((460, 230, 680, 380), fill=lt)
    sh.paste(circle_exact(av, 96, lt), (470, 250))
    sh.paste(circle_exact(av, 48, lt), (590, 274))
    d.text((470, 390), 'on light', font=lab, fill=(200, 190, 200))
    sh.paste(sq.resize((400, 400), LANCZOS), (720, 80))
    d.text((720, 490), 'square @400', font=lab, fill=(200, 190, 200))
    sh.paste(bn.resize((750, 250), LANCZOS), (40, 560))
    d.text((40, 820), 'banner @750', font=lab, fill=(200, 190, 200))
    # banner as X shows it: avatar overlapping the lower-left
    b2 = bn.resize((750, 250), LANCZOS)
    s = 168
    b2c = Image.new('RGB', (750, 250 + s // 2), bg)
    b2c.paste(b2, (0, 0))
    ring = Image.new('L', (s + 8, s + 8), 0)
    ImageDraw.Draw(ring).ellipse((0, 0, s + 7, s + 7), fill=255)
    b2c.paste(Image.new('RGB', (s + 8, s + 8), bg), (16, 250 - s // 2 - 4), ring)
    b2c.paste(circle_exact(av, s, bg), (20, 250 - s // 2), circle_mask(s))
    sh.paste(b2c, (850, 560))
    d.text((850, 560 + 250 + s // 2 + 6), 'banner @750 with avatar overlap (X layout)', font=lab, fill=(200, 190, 200))
    return sh


def circle_mask(s):
    m = Image.new('L', (s * 8, s * 8), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 8 - 1, s * 8 - 1), fill=255)
    return m.resize((s, s), LANCZOS)


if __name__ == '__main__':
    av, r, avbb, av_size, _ = make_avatar()
    assert r <= SAFE_R, r
    av.save(os.path.join(HERE, 'avatar.png'))
    av.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'avatar-400.png'))
    sq, sqbb, sq_size = make_square()
    sq.save(os.path.join(HERE, 'square.png'))
    sq.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'square-400.png'))
    assert sqbb[0] >= 40 and 1024 - sqbb[2] >= 40, sqbb                 # square side margins
    bn, tbb, sec, bn_size = make_banner()
    for box in (tbb, sec):                                               # banner safe areas
        assert box[1] >= 40 and box[3] <= 420, box                       # text inside y 40-420
        assert not (box[0] < 420 and box[3] > 330), box                  # avatar corner stays clear
    bn.save(os.path.join(HERE, 'banner.png'))
    make_sheet(av, sq, bn).save(os.path.join(HERE, 'sheet.jpg'), quality=92)
    wS = gluten_width('Sanctuary', 1000) / 1000
    print(f'avatar : Sanctuary {av_size:.1f}px, glyph span {wS*av_size:.0f}px = {wS*av_size/1024:.1%}; '
          f'ink bbox {avbb}; max text radius {r:.1f} (limit {SAFE_R})')
    print(f'square : Sanctuary {sq_size:.1f}px, glyph span {wS*sq_size:.0f}px = {wS*sq_size/1024:.1%}; ink bbox {sqbb}')
    print(f'banner : Sanctuary {bn_size:.1f}px; title ink {tbb}; secondary {sec}')
