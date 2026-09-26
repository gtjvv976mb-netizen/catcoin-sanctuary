"""Catcoin Sanctuary - cat-lettering logo set, approach A (AI wordmark, composited).

The lettering is ONE AI-generated wordmark (Higgsfield gpt_image_2_5, transparent background; the
prompt + job ids are in notes.md), saved here as wordmark-src.png.  Everything else is deterministic:
  wordmark.png   cleaned, tight RGBA master (haze cut, specks dropped, enclosed pockets filled, defringed)
  avatar.png     1024 (+ avatar-400.png)  X / pump.fun picture: every text pixel within r 476 of centre
  square.png     1024 (+ square-400.png)  name ~87 % of the width, no circle rule
  banner.png     1500x500 X header: the SAME lettering split into its two lines and staggered
                 ("Catcoin" top-left, "Sanctuary" from x 420 so it can run down to y 420 without
                 touching X's avatar zone), tagline + url tucked in the gap right of "Catcoin"
  sheet.jpg      contact sheet (avatar circle @400/96/48 on #000 and #fff, square @400/64,
                 banner @750 and @600x200 with a 130 px avatar circle at x 20-150, y 110-240)
Run:  python3 make.py            (paths resolve relative to this file; writes next to it)
Needs: Python 3, Pillow, numpy.  Scene art: ../../s1.png, ../../../kit/cmc-banner-b.png; font: kit/Figtree.ttf
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.abspath(os.path.join(HERE, '..', '..', '..'))       # .../scratchpad
S1 = os.path.join(SCR, 'logo', 's1.png')
WIDE = os.path.join(SCR, 'kit', 'cmc-banner-b.png')
FIGTREE = os.path.join(SCR, 'kit', 'Figtree.ttf')
SRC = os.path.join(HERE, 'wordmark-src.png')
LANCZOS = Image.Resampling.LANCZOS

CREAM = (255, 244, 228)
AMBER = (255, 178, 92)
PLUM = (30, 23, 38)             # washes / pools
DEEP = (20, 12, 20)             # soft shadows
SAFE_R = 476                    # avatar: all lettering within this radius of the centre
LO, HI = 10.0, 245.0            # wordmark alpha remap window (0..255)


# ============================================================ small numpy helpers
def label(mask):
    """8-connected component labels of a bool mask (run-length union-find). Returns (labels, sizes)."""
    H, W = mask.shape
    parent = [0]
    runs = []

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    prev = []
    for y in range(H):
        d = np.diff(np.concatenate([[0], mask[y].astype(np.int8), [0]]))
        starts, ends = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
        cur, j = [], 0
        for x0, x1 in zip(starts, ends):
            rid = len(parent)
            parent.append(rid)
            while j < len(prev) and prev[j][1] < x0:      # 8-connected: touches [x0-1, x1]
                j += 1
            k = j
            while k < len(prev) and prev[k][0] <= x1:
                a, b = find(rid), find(prev[k][2])
                if a != b:
                    parent[max(a, b)] = min(a, b)
                k += 1
            cur.append((x0, x1, rid))
        runs.append(cur)
        prev = cur
    lab = np.zeros((H, W), np.int32)
    roots = {}
    for y, cur in enumerate(runs):
        for x0, x1, rid in cur:
            r = find(rid)
            if r not in roots:
                roots[r] = len(roots) + 1
            lab[y, x0:x1] = roots[r]
    return lab, np.bincount(lab.ravel())


def dilate(m, r):
    """8-neighbourhood dilation, r steps."""
    out = m.copy()
    for _ in range(r):
        g = out.copy()
        g[1:] |= out[:-1]; g[:-1] |= out[1:]
        g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
        g[1:, 1:] |= out[:-1, :-1]; g[:-1, :-1] |= out[1:, 1:]
        g[1:, :-1] |= out[:-1, 1:]; g[:-1, 1:] |= out[1:, :-1]
        out = g
    return out


def box(x, r):
    """Mean over a (2r+1)^2 box (zero padded), via a summed-area table."""
    p = np.pad(x.astype(np.float64), ((r + 1, r), (r + 1, r)))
    c = p.cumsum(0).cumsum(1)
    n = 2 * r + 1
    return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]).astype(np.float32) / (n * n)


def fill_holes(solid):
    """(solid with every enclosed background pocket filled, the pockets)."""
    lab, _ = label(~solid)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    holes = (lab > 0) & ~np.isin(lab, border[border > 0])
    return solid | holes, holes


def edt(binary, R):
    """Exact Euclidean distance to the nearest True pixel, bounded (farther than R -> >= R+1)."""
    R = int(math.ceil(R))
    big = np.float32(R + 2)
    g = np.where(binary, np.float32(0), big).astype(np.float32)
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


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def to_img(rgb, a):
    return Image.fromarray(np.clip(np.dstack([rgb, a * 255]) + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def vgrad(size, top, bot, y0, y1):
    w, h = size
    t = np.clip((np.arange(h) - y0) / max(1, (y1 - y0)), 0, 1)[:, None, None]
    a = np.array(top, float)[None, None, :]
    b = np.array(bot, float)[None, None, :]
    return Image.fromarray(np.clip(np.repeat(a + (b - a) * t, w, axis=1) + 0.5, 0, 255).astype(np.uint8), 'RGB')


def scale_rgba(img, w):
    """Premultiplied Lanczos resize to width w (keeps aspect)."""
    h = round(img.height * w / img.width)
    return img.convert('RGBa').resize((w, h), LANCZOS).convert('RGBA')


def figtree(px, w=600):
    f = ImageFont.truetype(FIGTREE, px)
    f.set_variation_by_axes([w])
    return f


# ============================================================ 1. wordmark master
def clean(src=SRC, min_keep=400):
    """AI wordmark -> tight defringed RGBA master.  Returns (img, pockets mask, stats) cropped alike.
      1. alpha remap (LO..HI -> 0..1): drops the faint AI haze, snaps the near-opaque interior to 1
      2. 8-connected components (a > .5): drop stray specks (< min_keep px) and any haze not
         within 2 px of the kept lettering
      3. enclosed transparent pockets (between the two lines, inside the 'y' crook) filled, colour
         inpainted from the surrounding opaque lettering (grown 2 px so no semi-clear seam remains)
      4. defringe: every partially transparent pixel takes the outline plum, so no light halo"""
    im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
    rgb, a = im[..., :3].copy(), im[..., 3]
    a = np.clip((a - LO) / (HI - LO), 0, 1)
    lab, sizes = label(a > 0.5)
    keep = np.zeros(len(sizes), bool)
    keep[1:] = sizes[1:] >= min_keep
    kept = keep[lab]
    a = np.where(dilate(kept, 2), a, 0)
    filled, holes = fill_holes(a > 0.5)
    holes = dilate(holes, 2)
    ring = (a > 0.98) & dilate(~filled, 3)
    plum = np.median(rgb[ring], axis=0)
    rgb[(a < 0.999) & ~holes] = plum
    w = ((a > 0.999) & ~holes).astype(np.float32)
    num = np.dstack([box(rgb[..., c] * w, 14) for c in range(3)])
    den = box(w, 14)[..., None]
    rgb[holes] = np.where(den > 1e-3, num / np.maximum(den, 1e-3), plum)[holes]
    a_full = np.where(holes, 1.0, a)
    img = to_img(rgb, a_full)
    bb = img.getchannel('A').getbbox()
    l, t, r, b = bb
    stats = dict(components=int((sizes[1:] > 0).sum()), specks_removed=int((sizes[1:] < min_keep).sum()),
                 pocket_px=int(holes.sum()), plum=tuple(int(v) for v in plum), src_bbox=bb)
    return img.crop(bb), holes[t:b, l:r], stats


# ============================================================ 2. split into the two lines (banner)
SPLIT_Y = 0.42          # fill components whose centroid is above this fraction of the height = "Catcoin"
# (outline radius, extrusion depth) in master px.  Measured on the art: outline 22-28 px on letter
# tops, 30-35 px on the sides, 76-78 px from a fill's bottom to its extrusion's bottom.
ENV = {'C': (34, 44), 'S': (28, 50)}


def split_lines(master, pockets):
    """Split the lockup into its "Catcoin" and "Sanctuary" lines, each with a whole outline/extrusion.
    Fill = opaque non-plum pixels; each fill component goes to the line its centroid sits in.
    Envelope of a line = its fill dilated by the outline radius and extruded straight down (ENV).
    Where the OTHER line's envelope does not reach, a line keeps the art's own edge (art alpha
    clipped to its envelope).  Inside the other line's envelope (the band where the two lines'
    plum merged in the lockup; for "Catcoin" the whole extrusion band above "Sanctuary") the art
    cannot tell whose plum it is, so the line's edge there is its own envelope (synthetic plum,
    the art's extrusion colour).  Only parts connected to the line's letters are kept.  Opaque pixels outside
    both envelopes are kept only when clearly one line's (whiskers, the paw print's outline)."""
    im = np.asarray(master).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3] / 255
    H, W = a.shape
    a_art = np.where(pockets, 0, a)
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    fill = (a > 0.5) & (lum > 85)
    lab, sizes = label(fill)
    ys = np.repeat(np.arange(H, dtype=np.float64)[:, None], W, axis=1)
    cy = np.bincount(lab.ravel(), weights=ys.ravel()) / np.maximum(sizes, 1)
    top_ids = np.nonzero(cy < SPLIT_Y * H)[0]
    F = {'C': np.isin(lab, top_ids[top_ids > 0]) & fill}
    F['S'] = fill & ~F['C']
    R = max(ro + ext for ro, ext in ENV.values()) + 40
    D = {k: edt(F[k], R) for k in F}
    env = {}
    for k in F:
        ro, ext = ENV[k]
        o = np.clip(ro + 0.5 - D[k], 0, 1)
        e = o.copy()
        for dy in range(1, ext + 1):
            e[dy:] = np.maximum(e[dy:], o[:-dy])
        env[k] = e
    hard = {k: env[k] > 0.5 for k in env}
    dark = (a > 0.99) & (lum < 60)
    plum = np.median(rgb[dark], axis=0)
    ext_col = np.median(rgb[dark & hard['C'] & (D['C'] > ENV['C'][0] + 6) & ~hard['S']], axis=0)
    # opaque leftovers outside both envelopes: whole 8-connected components, given to the line
    # they touch (nearest fill) and only when clearly clear of the other line
    leftover = (a_art > 0.5) & ~hard['C'] & ~hard['S']
    labL, sizesL = label(leftover)
    mins = {}
    for k in D:
        m = np.full(len(sizesL), np.inf, np.float32)
        np.minimum.at(m, labL.ravel(), D[k].ravel())
        mins[k] = m
    own = {'C': (mins['C'] < mins['S']) & (mins['S'] > ENV['S'][0] + 12),
           'S': (mins['S'] < mins['C']) & (mins['C'] > sum(ENV['C']) + 20)}
    pieces = {}
    for k, o in (('C', 'S'), ('S', 'C')):
        own[k][0] = False
        own_left = dilate(own[k][labL], 2)
        # own envelope with the lockup's pockets solid; synthetic where the other line's plum sat
        synth = hard[o] | F[o]
        if k == 'C':        # Catcoin's whole extrusion band above Sanctuary: one consistent edge
            synth = synth | (D['S'] <= ENV['S'][0] + 50)
        alpha = np.where(synth, env[k], np.minimum(env[k], a))
        alpha = np.maximum(np.maximum(alpha, own_left * a_art), F[k] * a)
        lab2, _ = label(alpha > 0.5)                # keep only what hangs together with our letters
        ids = np.unique(lab2[F[k]])
        alpha = alpha * dilate(np.isin(lab2, ids[ids > 0]), 2)
        trust = F[k] | (~hard[o] & ~F[o] & (a_art > 0.5))
        col = np.where(trust[..., None], rgb, ext_col if k == 'C' else plum)
        col[(alpha < 0.999) & ~F[k]] = plum
        img = to_img(col, alpha)
        bb = img.getchannel('A').getbbox()
        pieces[k] = (img.crop(bb), bb[:2])
    return pieces, dict(ENV=ENV, ext_col=tuple(int(v) for v in ext_col))


# ============================================================ scene helpers
def scene_s1(k, ox, oy, S=1024):
    src = Image.open(S1).convert('RGB')
    n = round(1024 * k)
    assert 0 <= ox <= n - S and 0 <= oy <= n - S, 'crop leaves the scaled scene'
    return src.resize((n, n), LANCZOS).crop((ox, oy, ox + S, oy + S)).convert('RGBA')


def vband(size, stops, color=PLUM):
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


def radial(S, r0, r1):
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) + 0.5
    r = np.hypot(xx - S / 2, yy - S / 2)
    return (1 - smooth((r - r0) / (r1 - r0))).astype(np.float32), r


def place(canvas, piece, x, y, shadow=None, clip=None):
    """Composite an RGBA piece at (x, y) with an optional soft shadow (dy, blur, opacity).
    Returns the full-canvas alpha of the piece and of its shadow."""
    full = Image.new('L', canvas.size, 0)
    full.paste(piece.getchannel('A'), (x, y))
    sh = Image.new('L', canvas.size, 0)
    if shadow:
        dy, blur, op = shadow
        sh.paste(piece.getchannel('A'), (x, y + dy))
        sh = sh.filter(ImageFilter.GaussianBlur(blur))
        s = np.asarray(sh, np.float32) * op
        if clip is not None:
            s = s * clip
        sh = Image.fromarray(np.clip(s + 0.5, 0, 255).astype(np.uint8), 'L')
        canvas.paste(Image.new('RGBA', canvas.size, DEEP + (255,)), (0, 0), sh)
    canvas.alpha_composite(piece, (x, y))
    return full, sh


def max_radius(mask, cx, cy, thresh=0):
    ys, xs = np.nonzero(np.asarray(mask) > thresh)
    dx = np.maximum(np.abs(xs - cx), np.abs(xs + 1 - cx))
    dy = np.maximum(np.abs(ys - cy), np.abs(ys + 1 - cy))
    return float(np.sqrt(dx * dx + dy * dy).max())


# ============================================================ AVATAR
AV = dict(k=1.35, ox=143, oy=251, top=360, limit=SAFE_R - 4, shadow=(9, 12, 0.55),
          band=[(560, 0.0), (1024, 0.30)], rim_in=504.0, rim=((255, 204, 128), (240, 146, 62)))


def fit_avatar(master, top, limit):
    """Largest wordmark width (and horizontal nudge) whose ink stays within `limit` of the centre."""
    A = master.getchannel('A')
    best = None
    for w in range(760, 960, 4):
        h = round(master.height * w / master.width)
        a = np.asarray(A.resize((w, h), LANCZOS)) > 0
        ys, xs = np.nonzero(a)
        found = None
        for dx in range(-24, 25, 2):
            x0 = round(512 - w / 2 + dx)
            X, Y = xs + x0, ys + top
            ddx = np.maximum(np.abs(X - 512), np.abs(X + 1 - 512))
            ddy = np.maximum(np.abs(Y - 512), np.abs(Y + 1 - 512))
            r = float(np.sqrt(ddx * ddx + ddy * ddy).max())
            if r <= limit and (found is None or r < found[1]):
                found = (dx, r)
        if found:
            best = (w, found[0])
        elif best:
            break
    return best


def make_avatar(master):
    S = 1024
    im = scene_s1(AV['k'], AV['ox'], AV['oy'])
    im.alpha_composite(vband((S, S), AV['band']))
    w, dx = fit_avatar(master, AV['top'], AV['limit'])
    wm = scale_rgba(master, w)
    x0 = round(512 - w / 2 + dx)
    clip, rr = radial(S, SAFE_R - 40, SAFE_R - 1)
    ink, shf = place(im, wm, x0, AV['top'], AV['shadow'], clip)
    rim_a = smooth(rr - (AV['rim_in'] - 0.5)) * (1 - smooth(rr - 513.5))
    rim = vgrad((S, S), AV['rim'][0], AV['rim'][1], 0, S).convert('RGBA')
    rim.putalpha(Image.fromarray((rim_a * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(rim)
    return im.convert('RGB'), dict(w=w, h=wm.height, x0=x0, dx=dx, bbox=ink.getbbox(),
                                   r_ink=max_radius(ink, 512, 512), r_shadow=max_radius(shf, 512, 512, 8))


# ============================================================ SQUARE
SQ = dict(k=1.5, ox=202, oy=151, w=890, bottom=992, shadow=(9, 12, 0.55),
          band=[(600, 0.0), (1024, 0.35)])


def make_square(master):
    S = 1024
    im = scene_s1(SQ['k'], SQ['ox'], SQ['oy'])
    im.alpha_composite(vband((S, S), SQ['band']))
    wm = scale_rgba(master, SQ['w'])
    x0, y0 = (S - wm.width) // 2, SQ['bottom'] - wm.height
    ink, _ = place(im, wm, x0, y0, SQ['shadow'])
    return im.convert('RGB'), dict(bbox=ink.getbbox(), size=wm.size)


# ============================================================ BANNER 1500x500
BN = dict(U=0.37, c_xy=(36, 40), s_x=420, scene_scale=1.0, scene_x=470, scene_y=44, wash=0.82,
          fade=(760, 1190), shadow=(6, 8, 0.6),
          tag='Every cat here is a token.', url='catcoinsanctuary.com  ·  $CATSANC', tag_px=34, url_px=25)
AVATAR_C = (212.5, 437.5)       # X profile picture over the header, in banner px (130 px @600 -> r 162.5)
AVATAR_CLEAR = 172.5            # + the 4 px page-coloured ring


def make_banner(pieces):
    W, H = 1500, 500
    src = Image.open(WIDE).convert('RGB')
    s = BN['scene_scale']
    sw, sh = round(src.width * s), round(src.height * s)
    sc = src.resize((sw, sh), LANCZOS).crop((0, BN['scene_y'], sw, BN['scene_y'] + H))
    x0 = BN['scene_x']
    im = Image.new('RGBA', (W, H), PLUM + (255,))
    im.paste(sc.convert('RGBA'), (x0, 0))
    im.paste(sc.crop((0, 0, x0, H)).transpose(Image.Transpose.FLIP_LEFT_RIGHT).convert('RGBA'), (0, 0))
    xs = np.arange(W, dtype=float)
    f0, f1 = BN['fade']
    a = BN['wash'] * (1 - smooth((xs - f0) / (f1 - f0)))
    wash = vgrad((W, H), (44, 27, 58), (26, 19, 33), 0, H).convert('RGBA')
    wash.putalpha(Image.fromarray((np.clip(a, 0, 1)[None, :].repeat(H, 0) * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(wash)
    U = BN['U']
    (pc, oc), (ps, os_) = pieces['C'], pieces['S']
    c_img = scale_rgba(pc, round(pc.width * U))
    s_img = scale_rgba(ps, round(ps.width * U))
    cx, cy = BN['c_xy']
    sy = cy + round((os_[1] - oc[1]) * U)                   # keep the lockup's vertical relation
    sx = BN['s_x']
    # Sanctuary first, Catcoin on top (Catcoin's extrusion overlaps Sanctuary's cap line, as in the lockup)
    s_ink, _ = place(im, s_img, sx, sy, BN['shadow'])
    c_ink, _ = place(im, c_img, cx, cy, BN['shadow'])
    title = Image.fromarray(np.maximum(np.asarray(s_ink), np.asarray(c_ink)), 'L')
    ys, xs_ = np.nonzero(np.asarray(title) > 20)
    av_d = float(np.hypot(xs_ + 0.5 - AVATAR_C[0], ys + 0.5 - AVATAR_C[1]).min())
    # tagline + url: right-aligned to Sanctuary's right edge, in the gap right of "Catcoin"
    d = ImageDraw.Draw(im)
    f1, f2 = figtree(BN['tag_px'], 700), figtree(BN['url_px'], 620)
    right = sx + s_img.width - 6
    tb = d.textbbox((0, 0), BN['tag'], font=f1)
    ub = d.textbbox((0, 0), BN['url'], font=f2)
    s_top = np.nonzero(np.asarray(s_ink)[:, right - max(tb[2], ub[2]):right].max(axis=1) > 20)[0].min()
    uy = s_top - 16 - ub[3]
    ty = uy + ub[1] - 10 - tb[3]
    tx, ux = right - tb[2], right - ub[2]
    sec = (min(tx + tb[0], ux + ub[0]), ty + tb[1], right, uy + ub[3])
    pl = Image.new('L', (W, H), 0)
    ImageDraw.Draw(pl).rounded_rectangle((sec[0] - 24, sec[1] - 14, sec[2] + 18, sec[3] + 12), 28, fill=150)
    pl = pl.filter(ImageFilter.GaussianBlur(18))
    im.paste(Image.new('RGBA', (W, H), PLUM + (255,)), (0, 0), pl)
    for (x, y, txt, f, col) in [(tx, ty, BN['tag'], f1, CREAM), (ux, uy, BN['url'], f2, AMBER)]:
        shl = Image.new('L', (W, H), 0)
        ImageDraw.Draw(shl).text((x, y + 2), txt, font=f, fill=255, stroke_width=2, stroke_fill=255)
        shl = shl.filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.6))
        im.paste(Image.new('RGBA', (W, H), DEEP + (255,)), (0, 0), shl)
        ImageDraw.Draw(im).text((x, y), txt, font=f, fill=col)
    return im.convert('RGB'), dict(title=title.getbbox(), c=(cx, cy) + (cx + c_img.width, cy + c_img.height),
                                   s=(sx, sy, sx + s_img.width, sy + s_img.height), sec=sec, av_d=av_d,
                                   c_ink=c_ink.getbbox(), s_ink=s_ink.getbbox())


# ============================================================ contact sheet
def circle_mask(s):
    m = Image.new('L', (s * 8, s * 8), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 8 - 1, s * 8 - 1), fill=255)
    return m.resize((s, s), LANCZOS)


def circle_exact(im, s, bg):
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
    d.text((30, 20), 'Catcoin Sanctuary - cat lettering (A: AI wordmark)', font=figtree(28, 700), fill=CREAM)
    for i, (pbg, name) in enumerate([((0, 0, 0), '#000'), ((255, 255, 255), '#fff')]):
        x0, y0 = 30 + i * 660, 70
        d.rectangle((x0, y0, x0 + 640, y0 + 440), fill=pbg)
        sh.paste(circle_exact(av, 400, pbg), (x0 + 20, y0 + 20))
        sh.paste(circle_exact(av, 96, pbg), (x0 + 450, y0 + 172))
        sh.paste(circle_exact(av, 48, pbg), (x0 + 570, y0 + 196))
        d.text((x0, y0 + 450), f'avatar on {name}: circle @400 / @96 / @48', font=lab, fill=grey)
    sh.paste(sq.resize((400, 400), LANCZOS), (1360, 70))
    sh.paste(sq.resize((64, 64), LANCZOS), (1360, 490))
    d.text((1440, 510), 'square @400 / @64', font=lab, fill=grey)
    y0 = 600
    sh.paste(bn.resize((750, 250), LANCZOS), (30, y0))
    d.text((30, y0 + 262), 'banner @750', font=lab, fill=grey)
    x0 = 820
    sh.paste(bn.resize((600, 200), LANCZOS), (x0, y0))
    s, ring = 130, 4
    cx, cy = x0 + 20 + s // 2, y0 + 110 + s // 2
    sh.paste(Image.new('RGB', (s, s), (0, 0, 0)), (cx - s // 2, cy - s // 2), circle_mask(s))
    si = s - 2 * ring
    sh.paste(circle_exact(av, si, (0, 0, 0)), (cx - si // 2, cy - si // 2), circle_mask(si))
    d.text((x0 + 170, y0 + 212), 'banner @600x200 + 130 px avatar (X layout)', font=lab, fill=grey)
    return sh


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    master, pockets, st = clean()
    master.save(os.path.join(HERE, 'wordmark.png'))
    print(f'wordmark: {master.size}  {st}')
    out = {}
    if what in ('avatar', 'all'):
        av, ai = make_avatar(master)
        assert ai['r_ink'] <= SAFE_R and ai['r_shadow'] <= SAFE_R, ai
        av.save(os.path.join(HERE, 'avatar.png'))
        av.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'avatar-400.png'))
        print(f"avatar : wordmark {ai['w']}x{ai['h']} at x {ai['x0']} (dx {ai['dx']:+d}), top {AV['top']}; ink bbox {ai['bbox']}; "
              f"max text radius {ai['r_ink']:.1f}, max shadow(>8) radius {ai['r_shadow']:.1f} (limit {SAFE_R})")
        out['av'] = av
    if what in ('square', 'all'):
        sq, si = make_square(master)
        sq.save(os.path.join(HERE, 'square.png'))
        sq.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'square-400.png'))
        b = si['bbox']
        print(f"square : wordmark {si['size']}; ink bbox {b}; width {b[2]-b[0]} = {(b[2]-b[0])/1024:.1%} of 1024")
        out['sq'] = sq
    if what in ('banner', 'all'):
        pieces, sp = split_lines(master, pockets)
        for k, (p, o) in pieces.items():
            p.save(os.path.join(HERE, f'line-{k}.png'))
        print(f'split  : {sp}; Catcoin piece {pieces["C"][0].size} @ {pieces["C"][1]}, Sanctuary piece {pieces["S"][0].size} @ {pieces["S"][1]}')
        bn, bi = make_banner(pieces)
        for box_ in (bi['title'], bi['sec']):
            assert box_[1] >= 40 and box_[3] <= 420, (box_, bi)
        for box_ in (bi['c_ink'], bi['s_ink'], bi['sec']):
            assert not (box_[0] < 420 and box_[3] > 330), (box_, bi)
        assert bi['av_d'] >= AVATAR_CLEAR, bi
        bn.save(os.path.join(HERE, 'banner.png'))
        print(f"banner : title ink {bi['title']} (Catcoin {bi['c_ink']}, Sanctuary {bi['s_ink']}); secondary {bi['sec']}; "
              f"title ink to X avatar centre {bi['av_d']:.1f} (limit {AVATAR_CLEAR})")
        out['bn'] = bn
    if what == 'all':
        make_sheet(out['av'], out['sq'], out['bn']).save(os.path.join(HERE, 'sheet.jpg'), quality=92)
