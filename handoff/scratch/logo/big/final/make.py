"""Catcoin Sanctuary - final logo set (built on approach A "bold type band").

Regenerates everything from the clean source art only (s1.png, cmc-banner-b.png, Gluten, Figtree):
  avatar.png (1024, circle-safe) + avatar-400.png
  square.png (1024)              + square-400.png
  banner.png (1500x500, X header)
  sheet.jpg  (contact sheet: avatar circle @400/96/48 on #000 and #fff, square @400/64,
              banner @750 and @600x200 with a 130 px avatar circle over its lower-left as X shows it)
Run:  python3 make.py [avatar|square|banner|all]   (paths resolve relative to this file; writes next to it)

Lettering is built per text line from ONE union alpha mask (the whole line rendered in a single
draw call, no FreeType stroker).  The outline is an exact Euclidean dilation of that union (lightly
closed, enclosed pockets filled), the extrusion is the union outline offset downwards, the soft
shadow comes from the union ink, and each layer is composited once (premultiplied, at 4x, box-
filtered down).  So there are no seams where glyph contours or neighbouring glyph outlines meet.
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

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
SS = 4                          # text supersampling factor (built at 4x, box-filtered down)
WEIGHT = 800                    # Gluten wght axis for "Catcoin" (700 = Bold; 800 reads better when tiny)
WEIGHT_S = 750                  # "Sanctuary": a touch lighter so the 'a' bowls stay open at 48 px
SAFE_R = 476                    # avatar: all lettering (and its visible shadow) within this radius
# outline weights, in units of the "Sanctuary" font size (same unit as approach A's stroke_em)
STROKE_C = 0.085                # "Catcoin"   (unchanged from A)
STROKE_S = 0.065                # "Sanctuary" (thinner: keeps the 'a' bowls open)
EXTRUDE = 0.055
GAP = 0.02
CLOSE = 0.02                    # outline closing radius (fills pinch points between glyph outlines)


def gluten(px, weight=WEIGHT):
    f = ImageFont.truetype(GLUTEN, px)
    f.set_variation_by_axes([weight, 0])
    return f


def figtree(px, w=600):
    f = ImageFont.truetype(FIGTREE, px)
    f.set_variation_by_axes([w])
    return f


def vgrad(size, top, bot, y0, y1):
    """RGB vertical gradient, computed in float (no banding)."""
    w, h = size
    t = np.clip((np.arange(h) - y0) / max(1, (y1 - y0)), 0, 1)[:, None, None]
    a = np.array(top, float)[None, None, :]
    b = np.array(bot, float)[None, None, :]
    arr = np.repeat(a + (b - a) * t, w, axis=1)
    return Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), 'RGB')


# ------------------------------------------------------------------ lettering
_INK_EM = {}


def ink_em(text, weight=WEIGHT):
    """Fill ink box of `text` per 1 px of font size: (left, top, right, bottom) from the draw origin."""
    key = (text, weight)
    if key not in _INK_EM:
        f = gluten(1000, weight)
        im = Image.new('L', (int(f.getlength(text)) + 400, 1500), 0)
        ImageDraw.Draw(im).text((200, 200), text, font=f, fill=255)
        l, t, r, b = im.getbbox()
        _INK_EM[key] = ((l - 200) / 1000, (t - 200) / 1000, (r - 200) / 1000, (b - 200) / 1000)
    return _INK_EM[key]


def _shift(a, dy, dx, fill=0.0):
    """a shifted by (dy, dx) with constant fill (no wrap-around)."""
    H, W = a.shape
    out = np.full_like(a, fill)
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[yd, xd] = a[ys, xs]
    return out


def edt(binary, R):
    """Exact Euclidean distance (px) from every pixel to the nearest True pixel of `binary`,
    bounded: anything farther than R comes back as >= R + 1."""
    R = int(math.ceil(R))
    big = np.float32(R + 2)
    g = np.where(binary, np.float32(0), big).astype(np.float32)   # vertical distance first
    for k in range(1, R + 1):
        kk = np.float32(k)
        g[k:] = np.minimum(g[k:], np.where(binary[:-k], kk, big))
        g[:-k] = np.minimum(g[:-k], np.where(binary[k:], kk, big))
    g2 = g * g
    d2 = g2.copy()
    for k in range(1, R + 1):
        k2 = np.float32(k * k)
        d2[:, k:] = np.minimum(d2[:, k:], g2[:, :-k] + k2)
        d2[:, :-k] = np.minimum(d2[:, :-k], g2[:, k:] + k2)
    return np.sqrt(d2)


def fill_holes(solid):
    """`solid` with every enclosed background pocket filled (4-connected reachability from the
    border, propagated along whole runs of rows and columns until it stops changing)."""
    free = ~solid
    reach = np.zeros_like(free)
    reach[0], reach[-1], reach[:, 0], reach[:, -1] = free[0], free[-1], free[:, 0], free[:, -1]
    for _ in range(100):
        before = int(reach.sum())
        for transpose in (False, True):
            f = free.T if transpose else free
            r = reach.T if transpose else reach
            H, W = f.shape
            ff = np.concatenate([f, np.zeros((H, 1), bool)], axis=1).ravel()
            rr = np.concatenate([r, np.zeros((H, 1), bool)], axis=1).ravel()
            starts = ff & ~np.concatenate([[False], ff[:-1]])
            rid = np.cumsum(starts) * ff                              # run id per free pixel (0 = solid)
            hit = np.bincount(rid, weights=rr) > 0
            hit[0] = False
            new = hit[rid].reshape(H, W + 1)[:, :W]
            reach = np.ascontiguousarray(new.T) if transpose else new
        if int(reach.sum()) == before:
            break
    return solid | (free & ~reach)


def _down(a):
    """Exact box filter by SS (a's shape must be a multiple of SS)."""
    H, W = a.shape[:2]
    return a.reshape(H // SS, SS, W // SS, SS, *a.shape[2:]).mean(axis=(1, 3))


def lockup(lines, s_ref, align='center', extrude_em=EXTRUDE, shadow=(0.07, 0.10, 0.55), gap_em=GAP,
           close_em=CLOSE):
    """Two-line name.  lines = [(text, font_px, stroke_px, (fill_top, fill_bot), weight), ...].
    s_ref = the "Sanctuary" size, the unit for extrusion / gap / shadow / closing.
    Outline = exact Euclidean dilation of each line's union fill mask by its stroke, unioned over
    the lines, then morphologically closed (radius close_em) with every enclosed pocket filled, so
    the pinch points where neighbouring glyph outlines just meet become smooth fillets instead of
    dark specks or slivers (counters read as solid dark holes).
    Returns dict(img=RGBA letters (fill+outline+extrusion) at 1x, ink=L mask of those letters,
                 shadow=L soft-shadow alpha, bbox=ink bbox, lines=[per-line ink boxes, lockup px])."""
    pad = int(0.45 * s_ref * SS)
    rc = close_em * s_ref * SS
    rendered = []
    for text, px, stroke, fills, weight in lines:
        f = gluten(int(round(px * SS)), weight)
        st = stroke * SS
        m = int(math.ceil(st + rc)) + 6
        w = int(f.getlength(text)) + 2 * m + 8 * SS
        h = int(px * SS * 1.25) + 2 * m
        fm = Image.new('L', (w, h), 0)
        ImageDraw.Draw(fm).text((m, m), text, font=f, fill=255)     # one draw call = one union mask
        fill = np.asarray(fm, np.float32) / 255
        sd = edt(fill >= 0.5, st + rc + 3) - st                      # <= 0 : inside the outline
        ys, xs = np.nonzero(sd <= 0.5)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)       # outline ink box (SS px)
        rendered.append(dict(fill=fill, sd=sd, box=box, fbox=fm.getbbox(), fills=fills))
    widths = [r['box'][2] - r['box'][0] for r in rendered]
    Wi = max(widths)
    gap = int(gap_em * s_ref * SS)
    ext = int(round(extrude_em * s_ref * SS))
    sh_dy, sh_blur, sh_op = shadow
    H = pad + sum(r['box'][3] - r['box'][1] for r in rendered) + gap * (len(rendered) - 1) + ext + pad
    W = Wi + 2 * pad
    W += (-W) % SS
    H += (-H) % SS
    FILL = np.zeros((H, W), np.float32)
    SD = np.full((H, W), np.float32(1e3))
    RGB = np.zeros((H, W, 3), np.float32)
    y = pad
    boxes = []
    for r, wd in zip(rendered, widths):
        l, t, rr, b = r['box']
        x = pad + ((Wi - wd) // 2 if align == 'center' else 0)
        ox, oy = x - l, y - t                                        # canvas offset of the line image
        h, w = r['fill'].shape
        SD[oy:oy + h, ox:ox + w] = np.minimum(SD[oy:oy + h, ox:ox + w], r['sd'])
        FILL[oy:oy + h, ox:ox + w] = np.maximum(FILL[oy:oy + h, ox:ox + w], r['fill'])
        ft, fbot = r['fills']
        g = np.asarray(vgrad((w, h), ft, fbot, r['fbox'][1], r['fbox'][3]), np.float32) / 255
        sel = r['fill'] > 0
        RGB[oy:oy + h, ox:ox + w][sel] = g[sel]
        boxes.append((x, y, x + wd, y + b - t))
        y += (b - t) + gap
    if rc > 0:      # closing: dilate the union outline by rc, then erode it back by rc (anti-aliased)
        grown = fill_holes(SD <= rc + 0.5)
        OUT = np.clip(edt(~grown, rc + 2) - rc, 0, 1).astype(np.float32)
    else:
        OUT = np.clip(1 - SD, 0, 1).astype(np.float32)
        OUT[fill_holes(SD <= 0.5) & (SD > 0.5)] = 1
    OUT = np.maximum(OUT, FILL)
    EXT = np.zeros_like(OUT)
    for dy in range(1, ext + 1):
        EXT[dy:] = np.maximum(EXT[dy:], OUT[:-dy])
    # premultiplied "over" compositing, each union layer exactly once: extrusion, outline, fill
    C = np.zeros((H, W, 3), np.float32)
    A = np.zeros((H, W), np.float32)
    for col, a in ((np.array(DEEP, np.float32) / 255, EXT), (np.array(STROKE, np.float32) / 255, OUT),
                   (RGB, FILL)):
        C = col * a[..., None] + C * (1 - a[..., None])
        A = a + A * (1 - a)
    C1, A1 = _down(C), _down(A)
    rgb = np.where(A1[..., None] > 1e-6, C1 / np.maximum(A1[..., None], 1e-6), 0)
    rgba = np.dstack([rgb * 255, A1 * 255])
    img = Image.fromarray(np.clip(rgba + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    ink = Image.fromarray(np.clip(A1 * 255 + 0.5, 0, 255).astype(np.uint8), 'L')
    sh = Image.fromarray(np.clip(_down(np.maximum(OUT, EXT)) * 255 + 0.5, 0, 255).astype(np.uint8), 'L')
    sh = _shift(np.asarray(sh, np.float32), int(round(sh_dy * s_ref)), 0)
    sh = Image.fromarray(sh.astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(sh_blur * s_ref))
    sh = sh.point(lambda v: int(v * sh_op + 0.5))
    lb = [tuple(v / SS for v in b) for b in boxes]
    return dict(img=img, ink=ink, shadow=sh, bbox=ink.getbbox(), lines=lb)


def name_lines(s_size, c_size, stroke_c=STROKE_C, stroke_s=STROKE_S, weight_s=WEIGHT_S):
    return [('Catcoin', c_size, stroke_c * s_size, FILL_C, WEIGHT),
            ('Sanctuary', s_size, stroke_s * s_size, FILL_S, weight_s)]


def put(canvas, lk, x_ink, y_ink, anchor='center', shadow_clip=None):
    """Composite a lockup so its ink box's top edge is at y_ink and its centre (or left edge) is at
    x_ink.  Returns (full-canvas letters mask, full-canvas shadow alpha)."""
    l, t, r, b = lk['bbox']
    x = x_ink - (l + r) / 2 if anchor == 'center' else x_ink - l
    x, y = int(round(x)), int(round(y_ink - t))
    shf = Image.new('L', canvas.size, 0)
    shf.paste(lk['shadow'], (x, y))
    if shadow_clip is not None:
        shf = Image.fromarray(np.clip(np.asarray(shf, np.float32) * shadow_clip + 0.5, 0, 255).astype(np.uint8), 'L')
    canvas.paste(Image.new('RGBA', canvas.size, DEEP + (255,)), (0, 0), shf)
    canvas.alpha_composite(lk['img'], (x, y))
    full = Image.new('L', canvas.size, 0)
    full.paste(lk['ink'], (x, y))
    return full, shf, (x, y)


def max_radius(mask, cx, cy, thresh=0):
    """Distance from (cx, cy) to the farthest corner of any pixel > thresh (conservative)."""
    ys, xs = np.nonzero(np.asarray(mask) > thresh)
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


def pool(ink, grow, soft, alpha, clip=None):
    """Soft plum pool that hugs the lettering: ink grown by ~`grow` px, feathered by `soft` px."""
    m = ink.filter(ImageFilter.GaussianBlur(grow / 2)).point(lambda v: 255 if v > 6 else int(v * 42))
    m = m.filter(ImageFilter.GaussianBlur(soft))
    a = np.asarray(m, np.float32) / 255 * alpha
    if clip is not None:
        a = a * clip
    lay = Image.new('RGBA', ink.size, PLUM + (0,))
    lay.putalpha(Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'L'))
    return lay


def radial(S, r0, r1):
    """1 inside r0, smoothly 0 at r1 (float array)."""
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) + 0.5
    r = np.hypot(xx - S / 2, yy - S / 2)
    return (1 - smooth((r - r0) / (r1 - r0))).astype(np.float32), r


def scene_s1(k, ox, oy, S=1024):
    src = Image.open(S1).convert('RGB')
    n = round(1024 * k)
    big = src.resize((n, n), LANCZOS)
    assert 0 <= ox <= n - S and 0 <= oy <= n - S, 'crop leaves the scaled scene'
    return big.crop((ox, oy, ox + S, oy + S)).convert('RGBA')


# ------------------------------------------------------------------ AVATAR (circle-safe)
AV = dict(k=1.25, ox=95, oy=256, top=428, s_size=150, c_size=170,
          band=[(380, 0.0), (560, 0.55), (780, 0.5), (1024, 0.35)],
          pool=(26, 30, 0.62), rim_in=504.0,
          rim=((255, 204, 128), (240, 146, 62)))


def centre_dx(lk, top, S=1024):
    """Horizontal nudge (px) that balances the left/right lettering radius (the 'S' foot reaches
    farther out than the 'y' arm); returns (dx, radius)."""
    best = None
    for dx in range(-12, 13):
        ink, _, _ = put(Image.new('RGBA', (S, S)), lk, S / 2 + dx, top)
        r = max_radius(ink, S / 2, S / 2)
        if best is None or r < best[1]:
            best = (dx, r)
    return best


def make_avatar():
    S = 1024
    im = scene_s1(AV['k'], AV['ox'], AV['oy'])
    im.alpha_composite(vband((S, S), AV['band']))
    lk = lockup(name_lines(AV['s_size'], AV['c_size']), AV['s_size'])
    dx, _ = centre_dx(lk, AV['top'])
    clip, rr = radial(S, SAFE_R - 40, SAFE_R - 1)
    # letters mask first (for the pool), then the real composite
    ink, _, _ = put(Image.new('RGBA', (S, S)), lk, S / 2 + dx, AV['top'])
    im.alpha_composite(pool(ink, *AV['pool'], clip=clip))
    ink, shf, (x, y) = put(im, lk, S / 2 + dx, AV['top'], shadow_clip=clip)
    # warm amber rim just inside the circle so the avatar holds its edge on X dark mode
    rim_a = smooth(rr - (AV['rim_in'] - 0.5)) * (1 - smooth(rr - 513.5))   # ring r_in..513, scene beyond
    rim = vgrad((S, S), AV['rim'][0], AV['rim'][1], 0, S).convert('RGBA')
    rim.putalpha(Image.fromarray((rim_a * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(rim)
    r_ink = max_radius(ink, S / 2, S / 2)
    r_sh = max_radius(shf, S / 2, S / 2, thresh=8)
    lines = [(l + x, t + y, r + x, b + y) for l, t, r, b in lk['lines']]
    return im.convert('RGB'), dict(r_ink=r_ink, r_shadow=r_sh, bbox=ink.getbbox(), lines=lines, dx=dx)


# ------------------------------------------------------------------ SQUARE
SQ = dict(k=1.10, ox=51, oy=100, s_size=155, c_size=180, bottom=978,
          band=[(520, 0.0), (760, 0.4), (1024, 0.45)],
          pool=(26, 30, 0.6))


def make_square():
    S = 1024
    im = scene_s1(SQ['k'], SQ['ox'], SQ['oy'])
    im.alpha_composite(vband((S, S), SQ['band']))
    lk = lockup(name_lines(SQ['s_size'], SQ['c_size']), SQ['s_size'])
    l, t, r, b = lk['bbox']
    top = SQ['bottom'] - (b - t)
    probe = Image.new('RGBA', (S, S))
    ink, _, _ = put(probe, lk, S / 2, top)
    im.alpha_composite(pool(ink, *SQ['pool']))
    ink, _, _ = put(im, lk, S / 2, top)
    return im.convert('RGB'), dict(bbox=ink.getbbox(), lines=lk['lines'])


# ------------------------------------------------------------------ BANNER 1500x500
BN = dict(scale=0.94, oy=26, x_left=50, top=40, right_max=730, fade_end=880, wash=0.9,
          tag='Every cat here is a token.', url='catcoinsanctuary.com  ·  $CATSANC',
          tag_px=33, url_px=25, sec_right=854)
# X profile picture over the header, in 1500x500 banner coordinates: X shows the header at 600x200
# with a 130 px avatar at x 20-150, y 110-240 (x2.5 -> centre (212.5, 437.5), r 162.5) plus a
# page-coloured border ring (4 px @600 -> r 172.5).  Title ink must stay outside r AVATAR_CLEAR.
AVATAR_C = (212.5, 437.5)
AVATAR_CLEAR = 172.0


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
    # left plum wash, sky-toned at the top, easing out just before the cat
    xs = np.arange(W, dtype=float)
    a = BN['wash'] * (1 - smooth((xs - 150) / (BN['fade_end'] - 150)))
    a = np.where(xs < 150, BN['wash'], a)[None, :].repeat(H, axis=0)
    wash = vgrad((W, H), (44, 27, 58), (26, 19, 33), 0, H).convert('RGBA')
    wash.putalpha(Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(wash)
    # title: justified lockup ('Catcoin' as wide as 'Sanctuary'), left-aligned, ink x_left -> right_max
    cl, _, cr, _ = ink_em('Catcoin', WEIGHT)
    sl, _, sr, _ = ink_em('Sanctuary', WEIGHT_S)
    span = BN['right_max'] - BN['x_left']
    s_size = span / ((sr - sl) + 2 * STROKE_S)
    c_size = ((sr - sl) * s_size + 2 * STROKE_S * s_size - 2 * STROKE_C * s_size) / (cr - cl)
    lk = lockup(name_lines(s_size, c_size), s_size, align='left', shadow=(0.06, 0.09, 0.6))
    ink, _, _ = put(im, lk, BN['x_left'], BN['top'], anchor='left')
    l, t, r, b = ink.getbbox()
    ys, xs = np.nonzero(np.asarray(ink) > 20)                    # title ink (fill+outline+extrusion)
    av_d = float(np.hypot(xs + 0.5 - AVATAR_C[0], ys + 0.5 - AVATAR_C[1]).min())
    # secondary lines, right-aligned (keeps x<420,y>330 clear for the avatar)
    d = ImageDraw.Draw(im)
    f1, f2 = figtree(BN['tag_px'], 680), figtree(BN['url_px'], 600)
    right = BN['sec_right']
    tb = d.textbbox((0, 0), BN['tag'], font=f1)
    ub = d.textbbox((0, 0), BN['url'], font=f2)
    tx, ty = right - tb[2], b + 14 - tb[1]
    ux, uy = right - ub[2], ty + tb[3] + 11 - ub[1]
    sec = (min(tx + tb[0], ux + ub[0]), ty + tb[1], right, uy + ub[3])
    # soft plum pool behind the secondary lines so they sit calmly on the busy meadow
    pl = Image.new('L', (W, H), 0)
    ImageDraw.Draw(pl).rounded_rectangle((sec[0] - 26, sec[1] - 14, sec[2] + 18, sec[3] + 14), 30, fill=165)
    pl = pl.filter(ImageFilter.GaussianBlur(20))
    im.paste(Image.new('RGBA', (W, H), PLUM + (255,)), (0, 0), pl)
    for (x, y, txt, f, col) in [(tx, ty, BN['tag'], f1, CREAM), (ux, uy, BN['url'], f2, AMBER)]:
        shl = Image.new('L', (W, H), 0)
        ImageDraw.Draw(shl).text((x, y + 2), txt, font=f, fill=255, stroke_width=2, stroke_fill=255)
        shl = shl.filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.6))
        im.paste(Image.new('RGBA', (W, H), DEEP + (255,)), (0, 0), shl)
        ImageDraw.Draw(im).text((x, y), txt, font=f, fill=col)
    return im.convert('RGB'), dict(title=(l, t, r, b), sec=sec, s_size=s_size, c_size=c_size, av_d=av_d)


# ------------------------------------------------------------------ contact sheet
def circle_mask(s):
    m = Image.new('L', (s * 8, s * 8), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 8 - 1, s * 8 - 1), fill=255)
    return m.resize((s, s), LANCZOS)


def circle_exact(im, s, bg):
    """Downscale first (as X does), then mask with a supersampled circle."""
    t = im.resize((s, s), LANCZOS)
    out = Image.new('RGB', (s, s), bg)
    out.paste(t, (0, 0), circle_mask(s))
    return out


def make_sheet(av, sq, bn):
    bg = (22, 17, 28)
    W, H = 1790, 900
    sh = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(sh)
    lab = figtree(20, 600)
    grey = (200, 190, 200)
    d.text((30, 20), 'Catcoin Sanctuary - final logo set', font=figtree(28, 700), fill=CREAM)
    # avatar circles on X dark (#000) and light (#fff) backgrounds
    for i, (pbg, name) in enumerate([((0, 0, 0), '#000'), ((255, 255, 255), '#fff')]):
        x0, y0 = 30 + i * 660, 70
        d.rectangle((x0, y0, x0 + 640, y0 + 440), fill=pbg)
        sh.paste(circle_exact(av, 400, pbg), (x0 + 20, y0 + 20))
        sh.paste(circle_exact(av, 96, pbg), (x0 + 450, y0 + 172))
        sh.paste(circle_exact(av, 48, pbg), (x0 + 570, y0 + 196))
        d.text((x0, y0 + 450), f'avatar on {name}: circle @400 / @96 / @48', font=lab, fill=grey)
    # square @400 and @64
    sh.paste(sq.resize((400, 400), LANCZOS), (1360, 70))
    sh.paste(sq.resize((64, 64), LANCZOS), (1360, 490))
    d.text((1440, 510), 'square @400 / @64', font=lab, fill=grey)
    # banner @750
    y0 = 600
    sh.paste(bn.resize((750, 250), LANCZOS), (30, y0))
    d.text((30, y0 + 262), 'banner @750', font=lab, fill=grey)
    # banner @600x200 with the 130 px avatar circle over its lower-left, as X lays out a profile:
    # the avatar's 130 px outer edge spans x 20-150, y 110-240 of the 600x200 header, and the 4 px
    # page-coloured ring sits inside that edge (picture 122 px)
    x0 = 820
    sh.paste(bn.resize((600, 200), LANCZOS), (x0, y0))
    s, ring = 130, 4
    cx, cy = x0 + 20 + s // 2, y0 + 110 + s // 2
    sh.paste(Image.new('RGB', (s, s), (0, 0, 0)), (cx - s // 2, cy - s // 2), circle_mask(s))
    si = s - 2 * ring
    sh.paste(circle_exact(av, si, (0, 0, 0)), (cx - si // 2, cy - si // 2), circle_mask(si))
    d.text((x0 + 170, y0 + 212), 'banner @600x200 + 130 px avatar (X layout)', font=lab, fill=grey)
    return sh


def report_boxes(name, lines):
    return '; '.join(f'{n} ink {tuple(round(v) for v in b)} h {b[3]-b[1]:.0f}' for n, b in zip(('Catcoin', 'Sanctuary'), lines))


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    out = {}
    if what in ('avatar', 'all'):
        av, ai = make_avatar()
        assert ai['r_ink'] <= SAFE_R, ai
        assert ai['r_shadow'] <= SAFE_R, ai
        av.save(os.path.join(HERE, 'avatar.png'))
        av.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'avatar-400.png'))
        print(f"avatar : Sanctuary {AV['s_size']}px, Catcoin {AV['c_size']}px, dx {ai['dx']:+d}; ink bbox {ai['bbox']}; "
              f"max text radius {ai['r_ink']:.1f}, max shadow(>8) radius {ai['r_shadow']:.1f} (limit {SAFE_R})")
        print('         ' + report_boxes('avatar', ai['lines']))
        out['av'] = av
    if what in ('square', 'all'):
        sq, si = make_square()
        assert si['bbox'][0] >= 45 and 1024 - si['bbox'][2] >= 45, si                 # square side margins
        sq.save(os.path.join(HERE, 'square.png'))
        sq.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'square-400.png'))
        print(f"square : Sanctuary {SQ['s_size']}px, Catcoin {SQ['c_size']}px; ink bbox {si['bbox']}")
        out['sq'] = sq
    if what in ('banner', 'all'):
        bn, bi = make_banner()
        for box in (bi['title'], bi['sec']):                                            # banner safe areas
            assert box[1] >= 40 and box[3] <= 420, box                                  # text inside y 40-420
            assert not (box[0] < 420 and box[3] > 330), box                             # avatar corner clear
        assert bi['av_d'] >= AVATAR_CLEAR, bi                                           # title clears X avatar + ring
        bn.save(os.path.join(HERE, 'banner.png'))
        print(f"banner : Sanctuary {bi['s_size']:.1f}px, Catcoin {bi['c_size']:.1f}px; title ink {bi['title']}; "
              f"secondary {bi['sec']}; title ink (a>20) to X avatar centre {bi['av_d']:.1f} "
              f"(circle r 162.5, ring r 172.5, limit {AVATAR_CLEAR})")
        out['bn'] = bn
    if what == 'all':
        make_sheet(out['av'], out['sq'], out['bn']).save(os.path.join(HERE, 'sheet.jpg'), quality=92)
