"""Catcoin Sanctuary - approach C "ribbon title".

Builds avatar.png (+400), square.png (+400), banner.png and sheet.jpg from the
clean source art. The name is the hero: "Sanctuary" sits big on an arched plum
ribbon with folded swallow tails, "Catcoin" rides on top of the ribbon.
Everything text-related is drawn at 2x and box-downsampled (premultiplied) so
edges stay clean.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
S1 = os.path.join(SCRATCH, 'logo', 's1.png')
BANNER_SRC = os.path.join(SCRATCH, 'kit', 'cmc-banner-b.png')
GLUTEN = os.path.join(SCRATCH, 'kit', 'Gluten.ttf')
FIGTREE = os.path.join(SCRATCH, 'kit', 'Figtree.ttf')
OUT = HERE

SS = 2  # supersampling factor for all lettering / ribbon work

CREAM = (255, 244, 228)
AMBER = (255, 178, 92)
PLUM_STROKE = (46, 28, 40)
PLUM_GROUND = (30, 23, 38)
# ribbon palette (plum ribbon, amber trim, cream->amber lettering)
RIB_TOP = (104, 58, 118)
RIB_BOT = (62, 33, 74)
TAIL_TOP = (70, 38, 82)
TAIL_BOT = (46, 25, 56)
FOLD = (24, 13, 28)
OUTLINE = (30, 17, 30)
TRIM = (255, 190, 110)
SANC_TOP = (255, 222, 158)
SANC_BOT = (255, 164, 74)

WORDS = ('Catcoin', 'Sanctuary')


# ---------------------------------------------------------------- helpers
def gluten(px, wght=700):
    f = ImageFont.truetype(GLUTEN, int(round(px)))
    f.set_variation_by_axes([wght, 0])
    return f


def figtree(px, wght=600):
    f = ImageFont.truetype(FIGTREE, int(round(px)))
    f.set_variation_by_axes([wght])
    return f


def vgrad(w, h, c0, c1, y0=0, y1=None):
    """RGB image w x h with a vertical gradient c0 (at y0) -> c1 (at y1)."""
    y1 = h if y1 is None else y1
    t = np.clip((np.arange(h, dtype=np.float32) - y0) / max(1, (y1 - y0)), 0, 1)[:, None]
    c0 = np.array(c0, np.float32)
    c1 = np.array(c1, np.float32)
    row = c0[None, :] * (1 - t) + c1[None, :] * t
    arr = np.repeat(row[:, None, :], w, axis=1)
    return Image.fromarray(arr.round().astype(np.uint8), 'RGB')


def solid(w, h, c):
    return Image.new('RGB', (w, h), c)


def paint(layer, colour_img, mask):
    """alpha-composite colour_img (RGB, same size) through mask (L) onto layer."""
    rgba = colour_img.convert('RGBA')
    rgba.putalpha(mask)
    layer.alpha_composite(rgba)


def to_premul(img):
    a = np.asarray(img.convert('RGBA'), np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


def from_premul(a):
    a = a.copy()
    al = a[..., 3:4]
    rgb = np.where(al > 1e-6, a[..., :3] / np.maximum(al, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), np.clip(al, 0, 1)], axis=2)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')


def box_down(a, k):
    """exact k x k area average of an HxWxC (or HxW) float array."""
    h, w = a.shape[:2]
    a = a[: h - h % k, : w - w % k]
    if a.ndim == 2:
        return a.reshape(h // k, k, w // k, k).mean(axis=(1, 3))
    return a.reshape(h // k, k, w // k, k, a.shape[2]).mean(axis=(1, 3))


def arc_warp(a, cx, hw, amp):
    """Arch the layer into a smile: column x moves UP by amp*((x-cx)/hw)^2.
    a: HxWxC or HxW float array (premultiplied). Linear interpolation."""
    h, w = a.shape[:2]
    xs = np.arange(w, dtype=np.float32)
    off = amp * ((xs - cx) / hw) ** 2  # >0 moves content up
    k = np.floor(off).astype(np.int64)
    f = (off - k).astype(np.float32)
    ys = np.arange(h)[:, None]
    i0 = ys + k[None, :]
    i1 = i0 + 1
    v0 = (i0 >= 0) & (i0 < h)
    v1 = (i1 >= 0) & (i1 < h)
    i0c = np.clip(i0, 0, h - 1)
    i1c = np.clip(i1, 0, h - 1)
    cols = np.arange(w)[None, :]
    if a.ndim == 2:
        s0 = np.where(v0, a[i0c, cols], 0)
        s1 = np.where(v1, a[i1c, cols], 0)
        return s0 * (1 - f[None, :]) + s1 * f[None, :]
    s0 = np.where(v0[..., None], a[i0c, cols], 0)
    s1 = np.where(v1[..., None], a[i1c, cols], 0)
    return s0 * (1 - f[None, :, None]) + s1 * f[None, :, None]


def fat_polygon(draw, pts, r, fill):
    """polygon grown by r (Minkowski sum with a disc) -> clean round outline."""
    draw.polygon(pts, fill=fill)
    if r <= 0:
        return
    n = len(pts)
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        draw.line([p, q], fill=fill, width=int(round(2 * r)))
        draw.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=fill)


# ---------------------------------------------------------------- emblem
def build_emblem(W, H, cx, band_y, sanc_px, cat_px, *, padx=0.30, tail=0.42,
                 drop=0.24, notch=0.36, amp=28, overlap=0.10, cat_stroke=8,
                 outline=5, trim=True, sash=False):
    """Return (premultiplied RGBA float array at 1x, text-alpha float array at 1x,
    ribbon geometry dict). All geometry params are in 1x pixels / fractions of
    the band height. band_y = top of the ribbon band (before arching)."""
    s = SS
    Wz, Hz = W * s, H * s
    layer = Image.new('RGBA', (Wz, Hz), (0, 0, 0, 0))
    text_mask = Image.new('L', (Wz, Hz), 0)

    fS = gluten(sanc_px * s)
    fC = gluten(cat_px * s)
    # Sanctuary metrics
    l, t, r, b = fS.getbbox('Sanctuary')
    cap_t = fS.getbbox('S')[1]
    base = fS.getbbox('S')[3]  # baseline (bottom of cap S)
    capH = base - cap_t
    tw = r - l
    bandH = int(round(capH + 0.62 * sanc_px * s))
    top_pad = int(round(0.29 * sanc_px * s))
    by0 = band_y * s
    by1 = by0 + bandH
    bx0 = int(round(cx * s - tw / 2 - padx * sanc_px * s))
    bx1 = int(round(cx * s + tw / 2 + padx * sanc_px * s))
    cxz = cx * s

    L = tail * bandH
    d = drop * bandH
    n = notch * bandH
    fw = 0.30 * bandH  # fold width tucked behind the band
    mid = (by0 + by1) / 2

    left_tail = [(bx0 + fw, by0 + d), (bx0 - L, by0 + d), (bx0 - L + n, mid + d),
                 (bx0 - L, by1 + d), (bx0 + fw, by1 + d)]
    right_tail = [(bx1 - fw, by0 + d), (bx1 + L, by0 + d), (bx1 + L - n, mid + d),
                  (bx1 + L, by1 + d), (bx1 - fw, by1 + d)]
    left_fold = [(bx0, by1), (bx0 + fw, by1), (bx0 + fw, by1 + d)]
    right_fold = [(bx1, by1), (bx1 - fw, by1), (bx1 - fw, by1 + d)]
    band = [(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)]
    hw = (bx1 - bx0) / 2  # curvature reference (text + padding)
    if sash:  # avatar: band runs off both edges, the circle crop becomes its ends
        bx0, bx1 = -20 * s, Wz + 20 * s
        band = [(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)]
        left_tail = right_tail = left_fold = right_fold = []

    # 1. dark outline around the whole ribbon silhouette
    sil = Image.new('L', (Wz, Hz), 0)
    ds = ImageDraw.Draw(sil)
    for poly in (left_tail, right_tail, left_fold, right_fold, band):
        if poly:
            fat_polygon(ds, poly, outline * s, 255)
    paint(layer, solid(Wz, Hz, OUTLINE), sil)

    # 2. tails (back side of the ribbon, darker) + folds
    m = Image.new('L', (Wz, Hz), 0)
    dm = ImageDraw.Draw(m)
    for poly in (left_tail, right_tail):
        if poly:
            dm.polygon(poly, fill=255)
    paint(layer, vgrad(Wz, Hz, TAIL_TOP, TAIL_BOT, by0 + d, by1 + d), m)
    if trim and not sash:
        tm = Image.new('L', (Wz, Hz), 0)
        dt = ImageDraw.Draw(tm)
        ins = 0.085 * bandH
        tw_ = max(2, int(round(2.2 * s)))
        for sign, x_in, x_out in ((-1, bx0, bx0 - L), (1, bx1, bx1 + L)):
            for yy in (by0 + d + ins, by1 + d - ins):
                # stop the trim before the notch cut
                frac = abs(yy - (mid + d)) / (bandH / 2)
                x_end = x_out - sign * (n * (1 - frac)) - sign * ins * 0.9
                dt.line([(x_in, yy), (x_end, yy)], fill=150, width=tw_)
        paint(layer, solid(Wz, Hz, TRIM), tm)
    m = Image.new('L', (Wz, Hz), 0)
    dm = ImageDraw.Draw(m)
    for poly in (left_fold, right_fold):
        if poly:
            dm.polygon(poly, fill=255)
    paint(layer, solid(Wz, Hz, FOLD), m)

    # 3. front band
    m = Image.new('L', (Wz, Hz), 0)
    ImageDraw.Draw(m).polygon(band, fill=255)
    paint(layer, vgrad(Wz, Hz, RIB_TOP, RIB_BOT, by0, by1), m)
    # soft top highlight on the band
    hl = Image.new('L', (Wz, Hz), 0)
    ImageDraw.Draw(hl).rectangle((bx0, by0, bx1, by0 + int(bandH * 0.40)), fill=38)
    hl = Image.fromarray((np.asarray(hl, np.float32) *
                          np.clip(1 - (np.arange(Hz)[:, None] - by0) / (bandH * 0.40), 0, 1)
                          ).astype(np.uint8))
    paint(layer, solid(Wz, Hz, (255, 220, 240)), hl)
    if trim:
        tm = Image.new('L', (Wz, Hz), 0)
        dt = ImageDraw.Draw(tm)
        ins = 0.085 * bandH
        tw_ = max(2, int(round(2.2 * s)))
        dt.line([(bx0 + ins, by0 + ins), (bx1 - ins, by0 + ins)], fill=215, width=tw_)
        dt.line([(bx0 + ins, by1 - ins), (bx1 - ins, by1 - ins)], fill=215, width=tw_)
        paint(layer, solid(Wz, Hz, TRIM), tm)

    # crisp paper edge where the band ends in front of the tails
    if not sash:
        em = Image.new('L', (Wz, Hz), 0)
        de = ImageDraw.Draw(em)
        ew = max(2, int(round(2.5 * s)))
        de.line([(bx0 + ew // 2, by0), (bx0 + ew // 2, by1)], fill=255, width=ew)
        de.line([(bx1 - ew // 2, by0), (bx1 - ew // 2, by1)], fill=255, width=ew)
        paint(layer, solid(Wz, Hz, OUTLINE), em)

    # 4. "Sanctuary" on the band
    tx = int(round(cxz - tw / 2 - l))
    ty = int(round(by0 + top_pad - cap_t))
    sh = Image.new('L', (Wz, Hz), 0)
    ImageDraw.Draw(sh).text((tx, ty + int(0.035 * sanc_px * s)), 'Sanctuary', font=fS, fill=255)
    sh = sh.filter(ImageFilter.GaussianBlur(0.02 * sanc_px * s))
    paint(layer, solid(Wz, Hz, FOLD), sh.point(lambda v: int(v * 0.85)))
    tmk = Image.new('L', (Wz, Hz), 0)
    ImageDraw.Draw(tmk).text((tx, ty), 'Sanctuary', font=fS, fill=255)
    paint(layer, vgrad(Wz, Hz, SANC_TOP, SANC_BOT, ty + cap_t, ty + base), tmk)
    text_mask.paste(255, (0, 0), Image.fromarray(np.maximum(np.asarray(sh), np.asarray(tmk))))

    # 5. "Catcoin" riding on top of the ribbon (cream, thick plum stroke)
    cl, ct, cr, cb = fC.getbbox('Catcoin')
    cw = cr - cl
    c_base = fC.getbbox('C')[3]
    cxp = int(round(cxz - cw / 2 - cl))
    cyp = int(round(by0 + overlap * cat_px * s - c_base))
    st = int(round(cat_stroke * s))
    csh = Image.new('L', (Wz, Hz), 0)
    ImageDraw.Draw(csh).text((cxp, cyp + int(0.05 * cat_px * s)), 'Catcoin', font=fC, fill=255,
                             stroke_width=st, stroke_fill=255)
    csh = csh.filter(ImageFilter.GaussianBlur(0.035 * cat_px * s))
    paint(layer, solid(Wz, Hz, (16, 8, 16)), csh.point(lambda v: int(v * 0.55)))
    cst = Image.new('L', (Wz, Hz), 0)
    ImageDraw.Draw(cst).text((cxp, cyp), 'Catcoin', font=fC, fill=255, stroke_width=st, stroke_fill=255)
    paint(layer, solid(Wz, Hz, PLUM_STROKE), cst)
    cfl = Image.new('L', (Wz, Hz), 0)
    ImageDraw.Draw(cfl).text((cxp, cyp), 'Catcoin', font=fC, fill=255)
    paint(layer, vgrad(Wz, Hz, (255, 250, 240), (255, 232, 206), cyp + ct, cyp + c_base), cfl)
    tm_arr = np.maximum.reduce([np.asarray(text_mask), np.asarray(cst), np.asarray(csh)])

    # 6. arch + downsample
    pm = to_premul(layer)
    pm = arc_warp(pm, cxz, hw, amp * s)
    tmf = arc_warp(tm_arr.astype(np.float32) / 255.0, cxz, hw, amp * s)
    pm = box_down(pm, s)
    tmf = box_down(tmf, s)
    geo = dict(bx0=bx0 / s, bx1=bx1 / s, by0=by0 / s, by1=by1 / s, bandH=bandH / s,
               text_w=tw / s, cat_w=cw / s, cat_top=(cyp + ct - st) / s)
    return pm, tmf, geo


def drop_shadow(pm, dx, dy, blur, opacity, colour=(18, 8, 20)):
    a = Image.fromarray((pm[..., 3] * 255).astype(np.uint8))
    sh = Image.new('L', a.size, 0)
    sh.paste(a, (dx, dy))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    al = np.asarray(sh, np.float32) / 255.0 * opacity
    out = np.zeros(pm.shape, np.float32)
    out[..., :3] = np.array(colour, np.float32)[None, None, :] / 255.0 * al[..., None]
    out[..., 3] = al
    return out


def over(dst_rgb, pm):
    """dst_rgb float HxWx3 (0..1); pm premultiplied RGBA float."""
    return pm[..., :3] + dst_rgb * (1 - pm[..., 3:4])


def to_img(rgb):
    return Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')


def text_extent(mask, cx, cy, thr=0.0):
    ys, xs = np.nonzero(mask > thr)
    # pixel centres
    return float(np.sqrt((xs + 0.5 - cx) ** 2 + (ys + 0.5 - cy) ** 2).max())


def bottom_shade(rgb, y0, y1, strength, colour=PLUM_GROUND):
    h = rgb.shape[0]
    t = np.clip((np.arange(h, dtype=np.float32) - y0) / (y1 - y0), 0, 1)
    t = (t * t * (3 - 2 * t)) * strength
    c = np.array(colour, np.float32) / 255.0
    return rgb * (1 - t[:, None, None]) + c[None, None, :] * t[:, None, None]


# ---------------------------------------------------------------- avatar
AV = dict(crop=(90, 153, 800), sanc=144, cat=120, band_y=638, amp=60, overlap=0.18)


def make_avatar():
    S = 1024
    left, top, size = AV['crop']
    scene = Image.open(S1).convert('RGB').crop((left, top, left + size, top + size)).resize((S, S), Image.LANCZOS)
    rgb = np.asarray(scene, np.float32) / 255.0
    rgb = bottom_shade(rgb, 640, 1024, 0.45)
    pm, tmask, geo = build_emblem(S, S, 512, AV['band_y'], AV['sanc'], AV['cat'], amp=AV['amp'],
                                  overlap=AV['overlap'], cat_stroke=8, outline=5, sash=True)
    rgb = over(rgb, drop_shadow(pm, 0, 9, 11, 0.55))
    rgb = over(rgb, pm)
    img = to_img(rgb)
    r_text = text_extent(tmask, S / 2, S / 2)
    r_rib = text_extent(pm[..., 3], S / 2, S / 2, thr=0.02)
    img.save(os.path.join(OUT, 'avatar.png'))
    img.resize((400, 400), Image.LANCZOS).save(os.path.join(OUT, 'avatar-400.png'))
    return img, r_text, r_rib, geo


# ---------------------------------------------------------------- square
SQ = dict(crop=(20, 60, 948), sanc=138, cat=114, band_y=722, amp=34, tail=0.34, padx=0.22)


def make_square():
    S = 1024
    left, top, size = SQ['crop']
    scene = Image.open(S1).convert('RGB').crop((left, top, left + size, top + size)).resize((S, S), Image.LANCZOS)
    rgb = np.asarray(scene, np.float32) / 255.0
    rgb = bottom_shade(rgb, 700, 1024, 0.40)
    pm, tmask, geo = build_emblem(S, S, 512, SQ['band_y'], SQ['sanc'], SQ['cat'], amp=SQ['amp'],
                                  tail=SQ['tail'], padx=SQ['padx'], cat_stroke=9, outline=6)
    rgb = over(rgb, drop_shadow(pm, 0, 10, 12, 0.55))
    rgb = over(rgb, pm)
    img = to_img(rgb)
    img.save(os.path.join(OUT, 'square.png'))
    img.resize((400, 400), Image.LANCZOS).save(os.path.join(OUT, 'square-400.png'))
    ys, xs = np.nonzero(tmask > 0)
    return img, geo, (xs.min(), xs.max(), ys.min(), ys.max())


# ---------------------------------------------------------------- banner
BN = dict(shift=190, sanc=132, cat=106, band_y=124, amp=16, tail=0.36, cx=502)


def banner_scene():
    W, H = 1500, 500
    src = Image.open(BANNER_SRC).convert('RGB')
    s = W / src.width  # 1.116, same scale as the old banner
    top = (576 - 448) // 2 + 24
    band = src.crop((0, top, src.width, top + 448)).resize((W, H), Image.LANCZOS)
    sh = BN['shift']
    canvas = Image.new('RGB', (W, H))
    canvas.paste(band, (sh, 0))
    # extend the empty meadow/sky to the left by mirroring the leftmost strip
    strip = band.crop((0, 0, sh, H)).transpose(Image.FLIP_LEFT_RIGHT)
    canvas.paste(strip, (0, 0))
    rgb = np.asarray(canvas, np.float32) / 255.0
    # plum wash on the left so the lettering owns that side
    x = np.arange(W, dtype=np.float32)
    t = np.clip(1 - x / 980.0, 0, 1)
    t = (t * t * (3 - 2 * t)) * 0.62
    c = np.array(PLUM_GROUND, np.float32) / 255.0
    rgb = rgb * (1 - t[None, :, None]) + c[None, None, :] * t[None, :, None]
    return rgb, s


def text_block(W, H, lines):
    """lines: list of (text, font, colour, x_right, y_top). Right-aligned, 2x SS."""
    s = SS
    layer = Image.new('RGBA', (W * s, H * s), (0, 0, 0, 0))
    mask = Image.new('L', (W * s, H * s), 0)
    # soft plum backing so the small lines read over the busy meadow
    back = Image.new('L', layer.size, 0)
    for text, font, colour, xr, yt in lines:
        l, t, r, b = font.getbbox(text)
        ImageDraw.Draw(back).text((int(round(xr * s - r)), int(round(yt * s - t))), text, font=font,
                                  fill=255, stroke_width=6 * s, stroke_fill=255)
    back = back.filter(ImageFilter.GaussianBlur(9 * s))
    paint(layer, solid(*layer.size, PLUM_GROUND), back.point(lambda v: int(v * 0.62)))
    for text, font, colour, xr, yt in lines:
        l, t, r, b = font.getbbox(text)
        x = int(round(xr * s - r))
        y = int(round(yt * s - t))
        sh = Image.new('L', layer.size, 0)
        ImageDraw.Draw(sh).text((x, y + 2 * s), text, font=font, fill=255)
        sh = sh.filter(ImageFilter.GaussianBlur(2.5 * s))
        paint(layer, solid(*layer.size, (14, 6, 16)), sh.point(lambda v: int(v * 0.8)))
        m = Image.new('L', layer.size, 0)
        ImageDraw.Draw(m).text((x, y), text, font=font, fill=255)
        paint(layer, solid(*layer.size, colour), m)
        mask = Image.fromarray(np.maximum(np.asarray(mask), np.asarray(m)))
    pm = box_down(to_premul(layer), s)
    mk = box_down(np.asarray(mask, np.float32) / 255.0, s)
    return pm, mk


def make_banner():
    W, H = 1500, 500
    rgb, _ = banner_scene()
    pm, tmask, geo = build_emblem(W, H, BN['cx'], BN['band_y'], BN['sanc'], BN['cat'], amp=BN['amp'],
                                  tail=BN['tail'], cat_stroke=8, outline=5)
    rgb = over(rgb, drop_shadow(pm, 0, 8, 10, 0.55))
    rgb = over(rgb, pm)
    xr = geo['bx1'] - 6
    y0 = geo['by1'] + 30
    lines = [
        ('Every cat here is a token.', figtree(34 * SS, 600), CREAM, xr, y0),
        ('catcoinsanctuary.com  ·  $CATSANC', figtree(27 * SS, 600), AMBER, xr, y0 + 50),
    ]
    tpm, tmk = text_block(W, H, lines)
    rgb = over(rgb, tpm)
    img = to_img(rgb)
    img.save(os.path.join(OUT, 'banner.png'))
    allm = np.maximum(tmask, tmk)
    ys, xs = np.nonzero(allm > 0)
    # anything inside the profile-picture zone (x<420, y>330)?
    zone = allm[331:, :420]
    return img, geo, (xs.min(), xs.max(), ys.min(), ys.max()), float(zone.max())


# ---------------------------------------------------------------- sheet
def circle(img, d, bg):
    k = 4
    m = Image.new('L', (d * k, d * k), 0)
    ImageDraw.Draw(m).ellipse((0, 0, d * k - 1, d * k - 1), fill=255)
    m = m.resize((d, d), Image.LANCZOS)
    out = Image.new('RGB', (d, d), bg)
    out.paste(img.resize((d, d), Image.LANCZOS), (0, 0), m)
    return out


def make_sheet(avatar, square, banner):
    bg = (22, 18, 26)
    Wd = 1060
    sheet = Image.new('RGB', (Wd, 20 + 400 + 24 + 250 + 20), bg)
    x = 20
    sheet.paste(circle(avatar, 400, bg), (x, 20))
    x += 420
    # 96 and 48 circles on dark and on white
    sheet.paste(circle(avatar, 96, bg), (x, 20))
    sheet.paste(circle(avatar, 48, bg), (x + 24, 130))
    white = Image.new('RGB', (116, 176), (255, 255, 255))
    white.paste(circle(avatar, 96, (255, 255, 255)), (10, 8))
    white.paste(circle(avatar, 48, (255, 255, 255)), (34, 116))
    sheet.paste(white, (x - 10, 200))
    sheet.paste(square.resize((400, 400), Image.LANCZOS), (Wd - 420, 20))
    sheet.paste(banner.resize((750, 250), Image.LANCZOS), (20, 444))
    sheet.save(os.path.join(OUT, 'sheet.jpg'), quality=92)


if __name__ == '__main__':
    av, r_text, r_rib, ageo = make_avatar()
    print('avatar: farthest text pixel from centre = %.1f px (limit 476); ribbon %.1f (circle 512)'
          % (r_text, r_rib))
    print('avatar geo', {k: round(v, 1) for k, v in ageo.items()})
    sq, sgeo, sbox = make_square()
    print('square geo', {k: round(v, 1) for k, v in sgeo.items()}, 'text bbox x %d-%d y %d-%d' % sbox)
    bn, bgeo, bbox, zone = make_banner()
    print('banner geo', {k: round(v, 1) for k, v in bgeo.items()}, 'text bbox x %d-%d y %d-%d' % bbox,
          'max text alpha in avatar zone', zone)
    make_sheet(av, sq, bn)
