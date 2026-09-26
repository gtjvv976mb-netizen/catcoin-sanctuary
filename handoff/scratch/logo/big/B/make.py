"""Catcoin Sanctuary - approach B ("badge with arched title").

Produces, next to this script:
  avatar.png (1024) + avatar-400.png   circle-safe coin/seal badge
  square.png (1024) + square-400.png   the same badge on a warm blurred-scene ground
  banner.png (1500x500)                straight, huge two-line title on the left
  sheet.jpg                            contact sheet for review

All text is rendered as supersampled masks (SS x), glyph by glyph for the arcs,
then box-reduced and composited with flat colours, so edges are clean and no
colour fringes appear around rotated glyphs.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.abspath(os.path.join(OUT, '..', '..', '..'))
S1 = os.path.join(SCR, 'logo', 's1.png')
BANNER_SRC = os.path.join(SCR, 'kit', 'cmc-banner-b.png')
GLUTEN = os.path.join(SCR, 'kit', 'Gluten.ttf')
FIGTREE = os.path.join(SCR, 'kit', 'Figtree.ttf')

CREAM = (255, 244, 228)
AMBER = (255, 178, 92)
STROKE = (46, 28, 40)
PLUM = (30, 23, 38)
SHADOW = (14, 8, 16)

SS = 4            # supersampling factor for all vector-ish drawing
N = 1024


# ---------------------------------------------------------------- helpers
def gluten(px):
    f = ImageFont.truetype(GLUTEN, int(round(px)))
    f.set_variation_by_axes([700, 0])
    return f


def figtree(px, w=600):
    f = ImageFont.truetype(FIGTREE, int(round(px)))
    f.set_variation_by_axes([w])
    return f


def reduce_mask(m):
    """SS-size L mask -> 1x mask (box filter = true supersampling)."""
    return m.reduce(SS)


def lighten(dst, src, x, y):
    """dst = max(dst, src pasted at x,y) for L images (numpy, clipped)."""
    W, H = dst.size
    w, h = src.size
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return dst
    d = np.asarray(dst).copy()
    s = np.asarray(src)
    d[y0:y1, x0:x1] = np.maximum(d[y0:y1, x0:x1], s[y0 - y:y1 - y, x0 - x:x1 - x])
    return Image.fromarray(d)


def fill_with(base, colour, mask, opacity=1.0):
    """Composite a flat colour onto RGB base through an L mask."""
    if opacity < 1:
        mask = mask.point(lambda v: int(v * opacity + 0.5))
    layer = Image.new('RGB', base.size, colour)
    return Image.composite(layer, base, mask)


def ring_mask(size, cx, cy, r_out, r_in=0.0):
    """Antialiased annulus mask at 1x, drawn at SS x."""
    m = Image.new('L', (size[0] * SS, size[1] * SS), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([(cx - r_out) * SS, (cy - r_out) * SS, (cx + r_out) * SS, (cy + r_out) * SS], fill=255)
    if r_in > 0:
        d.ellipse([(cx - r_in) * SS, (cy - r_in) * SS, (cx + r_in) * SS, (cy + r_in) * SS], fill=0)
    return reduce_mask(m)


def advances(text, font):
    """Per-glyph advances including kerning with the next glyph."""
    out = []
    for i, c in enumerate(text):
        if i < len(text) - 1:
            out.append(font.getlength(text[i:i + 2]) - font.getlength(text[i + 1]))
        else:
            out.append(font.getlength(c))
    return out


def arc_word(size, cx, cy, text, px, stroke, r_base, where, track=0.0, ref=0.24):
    """Render `text` along a circle, each glyph on its own tile, rotated.

    size/cx/cy/px/stroke/r_base are 1x units; everything is drawn at SS x.
    where='top'   : baseline on the inner side, glyph tops point outward
    where='bottom': baseline on the outer side, glyph tops point to centre
    Spacing is even along the circle at the radius of the x-height middle
    (r_base +/- ref*px), which is where the eye judges letter spacing.
    Returns (fill_mask, stroke_mask) at 1x.
    """
    font = gluten(px * SS)
    st = int(round(stroke * SS))
    W, H = size[0] * SS, size[1] * SS
    fill_m = Image.new('L', (W, H), 0)
    strk_m = Image.new('L', (W, H), 0)
    adv = advances(text, font)
    trk = track * SS
    total = sum(adv) + trk * (len(text) - 1)
    Rb = r_base * SS
    Rref = Rb + ref * px * SS if where == 'top' else Rb - ref * px * SS
    half = int(px * SS * 1.05 + st * 2)
    T = half * 2
    pos = -total / 2.0
    CX, CY = cx * SS, cy * SS
    for c, a in zip(text, adv):
        centre = pos + a / 2.0
        ang = centre / Rref
        if where == 'top':
            px_, py_ = CX + Rb * math.sin(ang), CY - Rb * math.cos(ang)
            rot = -math.degrees(ang)
        else:
            px_, py_ = CX + Rb * math.sin(ang), CY + Rb * math.cos(ang)
            rot = math.degrees(ang)
        # glyph tile: baseline centre of the advance box at the tile centre
        tf = Image.new('L', (T, T), 0)
        ts = Image.new('L', (T, T), 0)
        org = (half - a / 2.0, half)
        ImageDraw.Draw(tf).text(org, c, font=font, fill=255, anchor='ls')
        ImageDraw.Draw(ts).text(org, c, font=font, fill=255, anchor='ls',
                                stroke_width=st, stroke_fill=255)
        tf = tf.rotate(rot, resample=Image.BICUBIC, center=(half, half))
        ts = ts.rotate(rot, resample=Image.BICUBIC, center=(half, half))
        ox, oy = int(round(px_ - half)), int(round(py_ - half))
        fill_m = lighten(fill_m, tf, ox, oy)
        strk_m = lighten(strk_m, ts, ox, oy)
        pos += a + trk
    return reduce_mask(fill_m), reduce_mask(strk_m)


def max_radius(mask, cx, cy, thresh=0):
    a = np.asarray(mask)
    ys, xs = np.nonzero(a > thresh)
    if len(xs) == 0:
        return 0.0, 0.0
    d = np.hypot(xs + 0.5 - cx, ys + 0.5 - cy)
    return float(d.max()), float(d.min())


def fit_arc(size, cx, cy, text, px, stroke, where, limit, track, ref=0.24, guess=None):
    """Find the baseline radius so the farthest text pixel sits at `limit`."""
    if guess is None:
        guess = limit - (0.66 * px if where == 'top' else 0.23 * px) - stroke
    r = guess
    for _ in range(4):
        fm, sm = arc_word(size, cx, cy, text, px, stroke, r, where, track, ref)
        far, near = max_radius(sm, cx, cy)
        err = limit - far
        if abs(err) < 0.6:
            break
        r += err
    return r, fm, sm, far, near


def paw_mask(size, cx, cy, s, angle=0.0):
    """Simple paw print (main pad + 4 toes), s = overall height, 1x units."""
    T = int(s * SS * 1.6)
    m = Image.new('L', (T, T), 0)
    d = ImageDraw.Draw(m)
    c = T / 2
    u = s * SS
    # main pad: rounded blob made from 3 ellipses
    d.ellipse([c - 0.34 * u, c - 0.02 * u, c + 0.34 * u, c + 0.46 * u], fill=255)
    d.ellipse([c - 0.44 * u, c + 0.10 * u, c - 0.04 * u, c + 0.44 * u], fill=255)
    d.ellipse([c + 0.04 * u, c + 0.10 * u, c + 0.44 * u, c + 0.44 * u], fill=255)
    toes = [(-0.40, -0.12), (-0.15, -0.40), (0.15, -0.40), (0.40, -0.12)]
    for tx, ty in toes:
        rx, ry = 0.13 * u, 0.17 * u
        d.ellipse([c + tx * u - rx, c + ty * u - ry, c + tx * u + rx, c + ty * u + ry], fill=255)
    if angle:
        m = m.rotate(angle, resample=Image.BICUBIC, center=(c, c))
    full = Image.new('L', (size[0] * SS, size[1] * SS), 0)
    full = lighten(full, m, int(round(cx * SS - c)), int(round(cy * SS - c)))
    return reduce_mask(full)


def vgradient(size, top, bottom):
    w, h = size
    t = np.linspace(0, 1, h)[:, None, None]
    a = np.array(top, float)[None, None, :]
    b = np.array(bottom, float)[None, None, :]
    g = a + (b - a) * t
    return Image.fromarray(np.repeat(g, w, axis=1).clip(0, 255).astype('uint8'))


# ---------------------------------------------------------------- badge
BADGE = dict(
    px=160,            # Gluten size for both words (old avatar: 96)
    stroke=4,
    text_limit=471,    # farthest text pixel from centre (X crop needs <= 476)
    rim_out=(481, 489),   # amber outer rim (inner, outer radius)
    disc=None,         # computed: radius of the scene disc
    track_top=2, track_bot=0, top_inset=22,
    scene_scale=1.30, scene_focus=(508, 438),
)


def build_badge(size=(N, N), cx=N / 2, cy=N / 2, cfg=BADGE, report=None):
    """Returns the badge as a size-d RGB image (dark plum outside the circle)."""
    px, stroke, lim = cfg['px'], cfg['stroke'], cfg['text_limit']

    # --- text on the ring (fit so the outermost pixel sits on `lim`)
    rt, top_f, top_s, top_far, top_near = fit_arc(size, cx, cy, 'Catcoin', px, stroke, 'top',
                                                  lim - cfg.get('top_inset', 0), cfg['track_top'])
    rb, bot_f, bot_s, bot_far, bot_near = fit_arc(size, cx, cy, 'Sanctuary', px, stroke, 'bottom',
                                                  lim, cfg['track_bot'])
    text_near = min(top_near, bot_near)
    inner_rim_out = text_near - 12            # gap between letters and inner rim
    inner_rim_in = inner_rim_out - 7
    disc_r = inner_rim_in - 5                 # dark hairline between rim and scene

    # --- ring band: deep plum-violet with a soft vertical light
    W, H = size
    band = vgradient(size, (72, 40, 92), (40, 22, 52))
    # radial shading inside the band (slightly lighter mid-band)
    yy, xx = np.mgrid[0:H, 0:W]
    rr = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
    mid = (disc_r + cfg['rim_out'][0]) / 2
    halfw = (cfg['rim_out'][0] - disc_r) / 2
    shade = np.clip(1 - ((rr - mid) / halfw) ** 2, 0, 1) * 0.10
    b = np.asarray(band).astype(float)
    b = b * (1 + shade[..., None])
    b += np.random.default_rng(7).uniform(-0.5, 0.5, b.shape[:2])[..., None]   # dither: no banding
    band = Image.fromarray((b + 0.5).clip(0, 255).astype('uint8'))

    img = Image.new('RGB', size, (26, 16, 32))
    img = Image.composite(band, img, ring_mask(size, cx, cy, cfg['rim_out'][1] + 30, disc_r))

    # --- scene disc
    src = Image.open(S1).convert('RGB')
    k = cfg['scene_scale']
    fx, fy = cfg['scene_focus']
    sw = int(round(src.width * k))
    scn = src.resize((sw, sw), Image.LANCZOS)
    ox = int(round(cx - fx * k))
    oy = int(round(cy - fy * k))
    layer = Image.new('RGB', size, (0, 0, 0))
    layer.paste(scn, (ox, oy))
    # gentle inner vignette so the disc sits "inside" the ring
    vig = np.clip((rr - (disc_r - 46)) / 46, 0, 1) ** 2 * 0.42
    lay = np.asarray(layer).astype(float) * (1 - vig[..., None]) + np.array(PLUM)[None, None, :] * vig[..., None]
    layer = Image.fromarray(lay.clip(0, 255).astype('uint8'))
    img = Image.composite(layer, img, ring_mask(size, cx, cy, disc_r))

    # --- rims
    img = fill_with(img, (24, 14, 30), ring_mask(size, cx, cy, inner_rim_out + 3, disc_r))
    img = fill_with(img, AMBER, ring_mask(size, cx, cy, inner_rim_out, inner_rim_in))
    img = fill_with(img, AMBER, ring_mask(size, cx, cy, *cfg['rim_out'][::-1]))

    # --- side ornaments: paw prints at 9 and 3 o'clock, mid band
    paw_r = (inner_rim_out + cfg['rim_out'][0]) / 2
    paws = Image.new('L', size, 0)
    for sgn in (-1, 1):
        pm = paw_mask(size, cx + sgn * paw_r, cy + 4, 60, angle=0)
        paws = Image.fromarray(np.maximum(np.asarray(paws), np.asarray(pm)))
    img = fill_with(img, SHADOW, paws.filter(ImageFilter.GaussianBlur(3)).transform(
        size, Image.AFFINE, (1, 0, 0, 0, 1, -3)), 0.5)
    img = fill_with(img, AMBER, paws)

    # --- lettering: soft shadow, dark stroke, colour fill
    strokes = Image.fromarray(np.maximum(np.asarray(top_s), np.asarray(bot_s)))
    sh = strokes.filter(ImageFilter.GaussianBlur(5)).transform(size, Image.AFFINE, (1, 0, 0, 0, 1, -5))
    img = fill_with(img, SHADOW, sh, 0.55)
    img = fill_with(img, STROKE, strokes)
    img = fill_with(img, CREAM, top_f)
    img = fill_with(img, AMBER, bot_f)

    text_union = Image.fromarray(np.maximum(np.asarray(strokes), np.maximum(np.asarray(top_f), np.asarray(bot_f))))
    if report is not None:
        far, _ = max_radius(text_union, cx, cy)
        a = np.asarray(bot_s)
        xs = np.nonzero(a.max(axis=0) > 0)[0]
        report.update(dict(
            r_top=rt, r_bot=rb, disc_r=disc_r, text_far=far, text_far_corner=far + 0.7072,
            sanctuary_span=(int(xs.min()), int(xs.max())), sanctuary_span_px=int(xs.max() - xs.min() + 1),
            text_union=text_union,
        ))
    return img


def circle_crop(img, bg=None):
    w, h = img.size
    m = Image.new('L', (w * SS, h * SS), 0)
    ImageDraw.Draw(m).ellipse([0, 0, w * SS - 1, h * SS - 1], fill=255)
    m = m.reduce(SS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(img.convert('RGB'), (0, 0), m)
    if bg is not None:
        base = Image.new('RGB', (w, h), bg)
        base.paste(out, (0, 0), out)
        return base
    return out


# ---------------------------------------------------------------- avatar
def make_avatar():
    rep = {}
    img = build_badge(report=rep)
    img.save(os.path.join(OUT, 'avatar.png'))
    img.resize((400, 400), Image.LANCZOS).save(os.path.join(OUT, 'avatar-400.png'))
    return img, rep


# ---------------------------------------------------------------- square
SQUARE_BADGE = dict(BADGE, scene_scale=1.12, scene_focus=(495, 478))   # whole cat, ears to feet


def make_square():
    size = (N, N)
    rep = {}
    badge_rgb = build_badge(cfg=SQUARE_BADGE, report=rep)
    # warm blurred scene ground
    src = Image.open(S1).convert('RGB')
    ground = src.resize((N, N), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
    g = np.asarray(ground).astype(float)
    warm = np.array((255, 196, 140), float)
    g = g * 0.78 + warm * 0.22
    ground = Image.fromarray(g.clip(0, 255).astype('uint8'))
    # badge disc (outer edge a little past the amber rim), with a soft drop shadow
    R = 502
    cm = ring_mask(size, N / 2, N / 2, R)
    shadow = cm.filter(ImageFilter.GaussianBlur(14)).transform(size, Image.AFFINE, (1, 0, 0, 0, 1, -10))
    ground = fill_with(ground, (60, 30, 30), shadow, 0.55)
    out = Image.composite(badge_rgb, ground, cm)
    out.save(os.path.join(OUT, 'square.png'))
    out.resize((400, 400), Image.LANCZOS).save(os.path.join(OUT, 'square-400.png'))
    return out, rep


# ---------------------------------------------------------------- banner
BAN = dict(
    px=146, stroke=6, left=62, top=40, line=0.80,
    scene_scale=0.90, scene_top=10, scene_x=290,
)


def straight_masks(size, items, stroke):
    """items: list of (text, font_px, x, baseline_y) at 1x -> (fill masks list, stroke union)."""
    W, H = size[0] * SS, size[1] * SS
    fills = []
    strk = Image.new('L', (W, H), 0)
    for text, px, x, y in items:
        f = gluten(px * SS)
        fm = Image.new('L', (W, H), 0)
        ImageDraw.Draw(fm).text((x * SS, y * SS), text, font=f, fill=255, anchor='ls')
        ImageDraw.Draw(strk).text((x * SS, y * SS), text, font=f, fill=255, anchor='ls',
                                  stroke_width=int(stroke * SS), stroke_fill=255)
        fills.append(reduce_mask(fm))
    return fills, reduce_mask(strk)


def make_banner():
    W, H = 1500, 500
    cfg = BAN
    src = Image.open(BANNER_SRC).convert('RGB')
    sc, top, sx = cfg['scene_scale'], cfg['scene_top'], cfg['scene_x']
    # extend the source to the left by mirroring its left strip (hidden under the plum field)
    ext_w = int(math.ceil(sx / sc))
    strip = src.crop((0, 0, ext_w, src.height)).transpose(Image.FLIP_LEFT_RIGHT)
    ext = Image.new('RGB', (src.width + ext_w, src.height))
    ext.paste(strip, (0, 0))
    ext.paste(src, (ext_w, 0))
    ext = ext.resize((int(round(ext.width * sc)), int(round(ext.height * sc))), Image.LANCZOS)
    x0 = int(round(ext_w * sc - sx))
    y0 = int(round(top * sc))
    scene = ext.crop((x0, y0, x0 + W, y0 + H))

    # plum field on the left: smooth horizontal falloff + slight top weight
    xs = np.linspace(0, 1, W)[None, :]
    ys = np.linspace(0, 1, H)[:, None]
    x_end = 1000 / W
    t = np.clip(xs / x_end, 0, 1)
    a = (1 - (t * t * (3 - 2 * t))) * 0.90
    a = a * (0.92 + 0.08 * (1 - ys))
    a = np.clip(a, 0, 1)
    sc_arr = np.asarray(scene).astype(float)
    sc_arr = sc_arr * (1 - a[..., None]) + np.array(PLUM, float)[None, None, :] * a[..., None]
    sc_arr += np.random.default_rng(11).uniform(-0.5, 0.5, sc_arr.shape[:2])[..., None]
    img = Image.fromarray((sc_arr + 0.5).clip(0, 255).astype('uint8'))

    # title: two lines, both at px
    px, st = cfg['px'], cfg['stroke']
    f = gluten(px)
    asc_top = -f.getbbox('Catcoin', anchor='ls')[1]
    b1 = cfg['top'] + st + asc_top
    b2 = b1 + cfg['line'] * px
    left = cfg['left']
    fills, strk = straight_masks((W, H), [('Catcoin', px, left, b1), ('Sanctuary', px, left, b2)], st)
    sh = strk.filter(ImageFilter.GaussianBlur(7)).transform((W, H), Image.AFFINE, (1, 0, 0, 0, 1, -6))
    glow = strk.filter(ImageFilter.GaussianBlur(26))
    img = fill_with(img, PLUM, glow, 0.45)
    img = fill_with(img, SHADOW, sh, 0.6)
    img = fill_with(img, STROKE, strk)
    img = fill_with(img, CREAM, fills[0])
    img = fill_with(img, AMBER, fills[1])

    # footer row: tagline left, url/ticker right-aligned to the title's right edge
    a = np.asarray(strk)
    cols = np.nonzero(a.max(axis=0) > 0)[0]
    rows = np.nonzero(a.max(axis=1) > 0)[0]
    title_l, title_r = int(cols.min()), int(cols.max())
    title_t, title_b = int(rows.min()), int(rows.max())
    d = ImageDraw.Draw(img)
    tag_f = figtree(26, 600)
    url_f = figtree(26, 600)
    fy = 324                                    # baseline; descenders stay above y=330
    tag = 'Every cat here is a token.'
    url = 'catcoinsanctuary.com  \u00b7  $CATSANC'
    tx = left + 4
    # soft dark bed under the small text so it holds over the scene
    bed = Image.new('L', (W, H), 0)
    bd = ImageDraw.Draw(bed)
    tb = d.textbbox((tx, fy), tag, font=tag_f, anchor='ls')
    ux = tb[2] + 26
    ub = d.textbbox((ux, fy), url, font=url_f, anchor='ls')
    bd.text((tx, fy), tag, font=tag_f, fill=255, anchor='ls', stroke_width=3, stroke_fill=255)
    bd.text((ux, fy), url, font=url_f, fill=255, anchor='ls', stroke_width=3, stroke_fill=255)
    img = fill_with(img, PLUM, bed.filter(ImageFilter.GaussianBlur(6)), 0.7)
    d = ImageDraw.Draw(img)
    d.text((tx, fy), tag, font=tag_f, fill=CREAM, anchor='ls')
    d.text((ux, fy), url, font=url_f, fill=AMBER, anchor='ls')
    # hard checks on the actual letterforms (title incl. stroke, footer glyphs):
    # text inside y 40..420 and nothing important in x<420, y>330
    foot = Image.new('L', (W, H), 0)
    ImageDraw.Draw(foot).text((tx, fy), tag, font=tag_f, fill=255, anchor='ls')
    ImageDraw.Draw(foot).text((ux, fy), url, font=url_f, fill=255, anchor='ls')
    allm = np.maximum(np.asarray(strk), np.asarray(foot))
    ys_, xs_ = np.nonzero(allm)
    assert ys_.min() >= 40 and ys_.max() <= 420, (ys_.min(), ys_.max())
    assert not np.any((xs_ < 420) & (ys_ > 330)), 'text in avatar zone'
    img.save(os.path.join(OUT, 'banner.png'))
    return img, dict(title_bbox=(title_l, title_t, title_r, title_b), tagline_bbox=tb, url_bbox=ub,
                     title_px=px, text_y=(int(ys_.min()), int(ys_.max())),
                     max_y_left_of_420=int(ys_[xs_ < 420].max()))


# ---------------------------------------------------------------- sheet
def make_sheet(avatar, square, banner):
    bg = (236, 232, 228)
    Wd = 1760
    sheet = Image.new('RGB', (Wd, 1000), bg)
    d = ImageDraw.Draw(sheet)
    lab = figtree(22, 600)
    x = 40
    y = 60
    a400 = circle_crop(avatar.resize((400, 400), Image.LANCZOS))
    sheet.paste(a400, (x, y), a400)
    d.text((x, y - 16), 'avatar, circle 400', font=lab, fill=(60, 50, 60), anchor='ls')
    x += 440
    a96 = circle_crop(avatar.resize((96, 96), Image.LANCZOS))
    sheet.paste(a96, (x, y), a96)
    d.text((x, y - 16), '96', font=lab, fill=(60, 50, 60), anchor='ls')
    a48 = circle_crop(avatar.resize((48, 48), Image.LANCZOS))
    sheet.paste(a48, (x, y + 130), a48)
    d.text((x, y + 114), '48', font=lab, fill=(60, 50, 60), anchor='ls')
    # the same thumbs on a dark ground (X dark mode)
    dark = Image.new('RGB', (150, 240), (0, 0, 0))
    sheet.paste(dark, (x + 130, y - 4))
    sheet.paste(a96, (x + 157, y + 10), a96)
    sheet.paste(a48, (x + 181, y + 140), a48)
    x += 330
    s400 = square.resize((400, 400), Image.LANCZOS)
    sheet.paste(s400, (x, y))
    d.text((x, y - 16), 'square 400', font=lab, fill=(60, 50, 60), anchor='ls')
    x += 440
    # 96/48 enlarged 3x (nearest) to judge the pixels
    big96 = circle_crop(avatar.resize((96, 96), Image.LANCZOS)).resize((288, 288), Image.NEAREST)
    sheet.paste(big96, (x, y), big96)
    d.text((x, y - 16), '96 px, shown 3x', font=lab, fill=(60, 50, 60), anchor='ls')
    big48 = circle_crop(avatar.resize((48, 48), Image.LANCZOS)).resize((144, 144), Image.NEAREST)
    sheet.paste(big48, (x + 300, y), big48)
    d.text((x + 300, y + 170), '48 px, 3x', font=lab, fill=(60, 50, 60), anchor='ls')
    y = 560
    b750 = banner.resize((750, 250), Image.LANCZOS)
    sheet.paste(b750, (40, y))
    d.text((40, y - 16), 'banner 750 wide', font=lab, fill=(60, 50, 60), anchor='ls')
    # banner with the avatar where X puts it (check only)
    b2 = b750.copy()
    av = circle_crop(avatar.resize((140, 140), Image.LANCZOS))
    ring = Image.new('RGBA', (148, 148), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([0, 0, 147, 147], fill=(255, 255, 255, 255))
    canvas = Image.new('RGB', (750, 330), (255, 255, 255))
    canvas.paste(b2, (0, 0))
    canvas.paste(ring, (16, 250 - 74), ring)
    canvas.paste(av, (20, 250 - 70), av)
    sheet.paste(canvas, (830, y))
    d.text((830, y - 16), 'banner with profile picture overlap (check)', font=lab, fill=(60, 50, 60), anchor='ls')
    sheet = sheet.crop((0, 0, Wd, y + 350))
    sheet.save(os.path.join(OUT, 'sheet.jpg'), quality=92)
    return sheet


if __name__ == '__main__':
    avatar, rep = make_avatar()
    square, srep = make_square()
    banner, brep = make_banner()
    make_sheet(avatar, square, banner)
    print('avatar: baseline r top %.1f bottom %.1f, disc r %.1f' % (rep['r_top'], rep['r_bot'], rep['disc_r']))
    print('avatar: farthest text pixel centre %.2f px (corner %.2f) of limit 476' % (rep['text_far'], rep['text_far_corner']))
    print('avatar: "Sanctuary" spans x %s = %d px = %.1f%% of width' % (
        rep['sanctuary_span'], rep['sanctuary_span_px'], 100 * rep['sanctuary_span_px'] / N))
    print('square: "Sanctuary" spans x %s = %.1f%% of width' % (srep['sanctuary_span'], 100 * srep['sanctuary_span_px'] / N))
    print('banner:', brep)
