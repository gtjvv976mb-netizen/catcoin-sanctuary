"""Catcoin Sanctuary - cat-lettering logo set, FINAL (approach A: AI wordmark, composited; judges' fixes applied).

The lettering is ONE AI-generated wordmark (Higgsfield gpt_image_2_5, transparent background; the
prompt + job ids are in notes.md), saved here as wordmark-src.png.  It is used unchanged in every piece.
The avatar's foreground (stepping stones + flower clumps below the name) comes from one AI edit of the
s1 scene, saved as gen/s1-foreground.png.  Everything else is deterministic:
  wordmark.png                cleaned, tight RGBA master (haze cut, specks dropped, enclosed pockets filled, defringed)
  wordmark@2x.png             2x print master (edge-tightened Lanczos upscale of wordmark.png)
  lockup-transparent.png      stacked lockup with its soft drop shadow, transparent, at master size
  lockup-wide-transparent.png the banner's staggered two-line lockup, transparent, at master size
  avatar.png     1024 (+ avatar-400.png)  X / pump.fun picture: every text pixel within r 476 of centre;
                 stone path + flower clumps below the name, soft plum ground shadow under the sign
  square.png     1024 (+ square-400.png)  name ~87 % of the width, no circle rule; mascot's feet under
                 the sign painted over with the stone path
  banner.png     1500x500 X header: the SAME lettering split into its two lines and staggered
                 ("Catcoin" top-left, "Sanctuary" from x 420 so it can run down to y 420 without
                 touching X's avatar zone), warm rim + soft glow around the title, tagline + url in the
                 gap right of "Catcoin", CoinMarketCat 1.25x bigger in front of the cottage
  sheet.jpg      contact sheet (avatar circle @400/96/48 on #000 and #fff, square @400/64,
                 banner @750 and @600x200 with a 130 px avatar circle at x 20-150, y 110-240)
Run:  python3 make.py            (paths resolve relative to this file; writes next to it; no API calls)
Needs: Python 3, Pillow, numpy.  Scene art: ../../s1.png, gen/s1-foreground.png, ../../../kit/cmc-banner-b.png;
font: ../../../kit/Figtree.ttf
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


def zoom(src, k, ox, oy, S=1024):
    """Scale a 1024 scene by k and crop an S x S window at (ox, oy)."""
    n = round(1024 * k)
    assert 0 <= ox <= n - S and 0 <= oy <= n - S, 'crop leaves the scaled scene'
    return src.resize((n, n), LANCZOS).crop((ox, oy, ox + S, oy + S)).convert('RGBA')


def overlay(im, col, alpha):
    """Blend a flat colour into an opaque RGBA canvas with a float alpha map (0..1)."""
    m = Image.fromarray(np.clip(alpha * 255 + 0.5, 0, 255).astype(np.uint8), 'L')
    im.paste(Image.new('RGBA', im.size, tuple(col) + (255,)), (0, 0), m)


# ============================================================ scene sources (s1 edits)
FG_SRC = os.path.join(HERE, 'gen', 's1-foreground.png')
FG = dict(seam=735, feather=30)          # s1 rows: below the seam the AI-edited foreground takes over
FEET = dict(box=(388, 684, 612, 742), mirror=612, feather=6)     # s1 px


def s1_source(foreground=False):
    """s1.png.  With foreground=True its bare lawn (rows below FG['seam']) is swapped for the AI-edited
    foreground (gen/s1-foreground.png: the same scene with stepping stones and flower clumps added in the
    lawn), blended over FG['feather'] rows.  Above the seam the two agree (mean |diff| < 7/255, no offset)."""
    src = Image.open(S1).convert('RGB')
    if not foreground:
        return src
    a = np.asarray(src, np.float32)
    b = np.asarray(Image.open(FG_SRC).convert('RGB').resize(src.size, LANCZOS), np.float32)
    y = np.arange(a.shape[0], dtype=np.float32) + 0.5
    m = smooth((y - FG['seam']) / FG['feather'])[:, None, None]
    return Image.fromarray(np.clip(a * (1 - m) + b * m + 0.5, 0, 255).astype(np.uint8), 'RGB')


def patch_feet(src):
    """Paint the stone path over CoinMarketCat's feet (s1 px) for the square, where they would peek out as
    pale blobs under the sign: the path just right of the feet, mirrored about x = FEET['mirror'], feathered."""
    a = np.asarray(src, np.float32).copy()
    x0, y0, x1, y1 = FEET['box']
    xs = np.arange(x0, x1)
    patch = a[y0:y1][:, 2 * FEET['mirror'] - 1 - xs]
    yy = np.arange(y0, y1, dtype=np.float32)[:, None] + 0.5
    xx = xs.astype(np.float32)[None, :] + 0.5
    m = smooth(np.minimum(np.minimum(xx - x0, x1 - xx), np.minimum(yy - y0, y1 - yy)) / FEET['feather'])[..., None]
    a[y0:y1, x0:x1] = a[y0:y1, x0:x1] * (1 - m) + patch * m
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), 'RGB')


# ============================================================ AVATAR
AV = dict(k=1.35, ox=143, oy=251, top=360, limit=SAFE_R - 4, shadow=(9, 12, 0.55),
          band=[(560, 0.0), (1024, 0.30)], rim_in=504.0, rim=((255, 204, 128), (240, 146, 62)),
          ground=dict(c=(512, 780), r=(410, 40), blur=22, op=0.45),        # contact shadow under the sign
          vignette=dict(y=(740, 900), r=(150, 470), op=0.62))            # plum darkening of the foreground


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
    im = zoom(s1_source(foreground=True), AV['k'], AV['ox'], AV['oy'])
    im.alpha_composite(vband((S, S), AV['band']))
    # foreground: plum darkening that deepens downward and toward the rim, so the new stones and
    # flowers anchor the sign without competing with it
    V = AV['vignette']
    clip, rr = radial(S, SAFE_R - 40, SAFE_R - 1)
    yy = np.arange(S, dtype=np.float32)[:, None] + 0.5
    va = V['op'] * smooth((yy - V['y'][0]) / (V['y'][1] - V['y'][0])) * (0.55 + 0.45 * smooth((rr - V['r'][0]) / (V['r'][1] - V['r'][0])))
    overlay(im, PLUM, va)
    # soft plum ground-contact shadow under "Sanctuary"
    G = AV['ground']
    gl = Image.new('L', (S, S), 0)
    (gx, gy), (rx, ry) = G['c'], G['r']
    ImageDraw.Draw(gl).ellipse((gx - rx, gy - ry, gx + rx, gy + ry), fill=255)
    ga = np.asarray(gl.filter(ImageFilter.GaussianBlur(G['blur'])), np.float32) / 255 * G['op']
    overlay(im, DEEP, ga)
    w, dx = fit_avatar(master, AV['top'], AV['limit'])
    wm = scale_rgba(master, w)
    x0 = round(512 - w / 2 + dx)
    ink, shf = place(im, wm, x0, AV['top'], AV['shadow'], clip)
    rim_a = smooth(rr - (AV['rim_in'] - 0.5)) * (1 - smooth(rr - 513.5))
    rim = vgrad((S, S), AV['rim'][0], AV['rim'][1], 0, S).convert('RGBA')
    rim.putalpha(Image.fromarray((rim_a * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(rim)
    # brightest foreground pixel inside the circle below the sign (relative luminance, 0..1)
    arr = np.asarray(im.convert('RGB'), np.float32) / 255
    lum = arr @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    below = (yy >= ink.getbbox()[3] + 4) & (rr <= SAFE_R) & (np.asarray(ink) == 0)
    fg_lum = np.percentile(lum[below], [50, 99])
    return im.convert('RGB'), dict(w=w, h=wm.height, x0=x0, dx=dx, bbox=ink.getbbox(),
                                   r_ink=max_radius(ink, 512, 512), r_shadow=max_radius(shf, 512, 512, 8),
                                   fg_lum=fg_lum)


# ============================================================ SQUARE
SQ = dict(k=1.5, ox=202, oy=151, w=890, bottom=992, shadow=(9, 12, 0.55),
          band=[(600, 0.0), (1024, 0.35)])


def make_square(master):
    S = 1024
    im = zoom(patch_feet(s1_source()), SQ['k'], SQ['ox'], SQ['oy'])
    im.alpha_composite(vband((S, S), SQ['band']))
    wm = scale_rgba(master, SQ['w'])
    x0, y0 = (S - wm.width) // 2, SQ['bottom'] - wm.height
    ink, _ = place(im, wm, x0, y0, SQ['shadow'])
    return im.convert('RGB'), dict(bbox=ink.getbbox(), size=wm.size)


# ============================================================ BANNER 1500x500
BN = dict(U=0.37, c_xy=(36, 40), s_x=420,
          scene_scale=1.25, scene_x=320, scene_y=176,           # CoinMarketCat 1.25x, feet at y ~489
          wash=0.82, fade=(760, 1170), wash_top=(52, 32, 68), wash_bot=(30, 22, 39),
          lift=dict(c=(560, 165), r=(640, 250), col=(138, 90, 134), op=0.26),   # warm mauve sky lift
          glow=dict(col=(255, 233, 199), grow=3, blur=12, op=0.22),            # soft cream glow behind the title
          rim=dict(col=(255, 212, 150), width=2.5, op=0.38),                   # thin warm rim outside the outline
          shadow=(6, 8, 0.6), ramp=14,
          tag='Every cat here is a token.', url='catcoinsanctuary.com  ·  $CATSANC', tag_px=33, url_px=24,
          text_right=1138)
AVATAR_C = (212.5, 437.5)       # X profile picture over the header, in banner px (130 px @600 -> r 162.5)
AVATAR_CLEAR = 172.5            # + the 4 px page-coloured ring
X_ZONE = (420, 330)             # X's avatar overlay zone: x < 420 and y > 330, kept free of glow
MASCOT_SRC = (699, 330, 848, 532)   # CoinMarketCat in cmc-banner-b.png: tail tip .. raised paw, ear tips .. feet
SIDE_CATS_X0 = 947              # leftmost px of the white cat on the steps (the grey cat starts at 960)


def keepout(W, H, ramp):
    """1 where glow may go; exactly 0 inside X's avatar zone (x < 420, y > 330) and within AVATAR_CLEAR of
    the avatar centre, ramping up over `ramp` px outside them."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    d = np.hypot(np.maximum(xx - X_ZONE[0], 0), np.maximum(X_ZONE[1] - yy, 0))
    dc = np.hypot(xx - AVATAR_C[0], yy - AVATAR_C[1]) - AVATAR_CLEAR
    return smooth(d / ramp) * smooth(dc / ramp)


def make_banner(pieces):
    W, H = 1500, 500
    src = Image.open(WIDE).convert('RGB')
    s = BN['scene_scale']
    sw, sh = round(src.width * s), round(src.height * s)
    assert BN['scene_y'] + H <= sh
    sc = src.resize((sw, sh), LANCZOS).crop((0, BN['scene_y'], sw, BN['scene_y'] + H))
    x0 = BN['scene_x']
    im = Image.new('RGBA', (W, H), PLUM + (255,))
    im.paste(sc.convert('RGBA'), (x0, 0))
    im.paste(sc.crop((0, 0, x0, H)).transpose(Image.Transpose.FLIP_LEFT_RIGHT).convert('RGBA'), (0, 0))
    xs = np.arange(W, dtype=float)
    f0, f1 = BN['fade']
    a = BN['wash'] * (1 - smooth((xs - f0) / (f1 - f0)))
    wash = vgrad((W, H), BN['wash_top'], BN['wash_bot'], 0, H).convert('RGBA')
    wash.putalpha(Image.fromarray((np.clip(a, 0, 1)[None, :].repeat(H, 0) * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(wash)
    # warm mauve lift of the sky behind the title (fades out well before X's avatar zone)
    L = BN['lift']
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    rn = np.hypot((xx - L['c'][0]) / L['r'][0], (yy - L['c'][1]) / L['r'][1])
    lift_a = L['op'] * (1 - smooth(rn)) * keepout(W, H, 80)
    overlay(im, L['col'], lift_a)
    # the two lines
    U = BN['U']
    (pc, oc), (ps, os_) = pieces['C'], pieces['S']
    c_img = scale_rgba(pc, round(pc.width * U))
    s_img = scale_rgba(ps, round(ps.width * U))
    cx, cy = BN['c_xy']
    sy = cy + round((os_[1] - oc[1]) * U)                   # keep the lockup's vertical relation
    sx = BN['s_x']
    T = np.zeros((H, W), np.float32)
    for img, (x, y) in ((s_img, (sx, sy)), (c_img, (cx, cy))):
        full = Image.new('L', (W, H), 0)
        full.paste(img.getchannel('A'), (x, y))
        T = np.maximum(T, np.asarray(full, np.float32) / 255)
    ko = keepout(W, H, BN['ramp'])
    # soft cream glow behind the title
    G = BN['glow']
    g = Image.fromarray(dilate(T > 0.5, G['grow']).astype(np.uint8) * 255, 'L').filter(ImageFilter.GaussianBlur(G['blur']))
    glow_a = np.asarray(g, np.float32) / 255 * G['op'] * ko
    overlay(im, G['col'], glow_a)
    # Sanctuary first, Catcoin on top (Catcoin's extrusion overlaps Sanctuary's cap line, as in the lockup)
    s_ink, _ = place(im, s_img, sx, sy, BN['shadow'])
    c_ink, _ = place(im, c_img, cx, cy, BN['shadow'])
    # thin warm rim just outside the plum outline of both lines
    R = BN['rim']
    dist = edt(T > 0.5, R['width'] + 3)
    rim_a = np.clip(R['width'] + 0.5 - dist, 0, 1) * (1 - T) * R['op'] * ko
    overlay(im, R['col'], rim_a)
    title = Image.fromarray(np.maximum(np.asarray(s_ink), np.asarray(c_ink)), 'L')
    ys, xs_ = np.nonzero(np.asarray(title) > 20)
    av_d = float(np.hypot(xs_ + 0.5 - AVATAR_C[0], ys + 0.5 - AVATAR_C[1]).min())
    zone = (xx < X_ZONE[0]) & (yy > X_ZONE[1])
    glow_in_zone = float(max(glow_a[zone].max(), rim_a[zone].max(), lift_a[zone].max()))
    fx = np.maximum(glow_a, rim_a) > 1 / 255
    gy_, gx_ = np.nonzero(fx)
    glow_av_d = float(np.hypot(gx_ + 0.5 - AVATAR_C[0], gy_ + 0.5 - AVATAR_C[1]).min())
    # tagline + url: right-aligned at text_right, clear of the cottage, in the gap right of "Catcoin"
    d = ImageDraw.Draw(im)
    f1, f2 = figtree(BN['tag_px'], 700), figtree(BN['url_px'], 620)
    right = BN['text_right']
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
    # gap between "Catcoin" (letters + paw dot) and the text block, over the block's rows
    c_np = np.asarray(c_ink) > 20
    band = c_np[max(sec[1] - 12, 0):sec[3] + 12]
    tag_gap = int(sec[0] - (np.nonzero(band.any(axis=0))[0].max() + 1))
    # CoinMarketCat's box in banner px, its clearance from the title ink, and the side cats' left edge
    mb = (x0 + s * MASCOT_SRC[0], s * MASCOT_SRC[1] - BN['scene_y'], x0 + s * MASCOT_SRC[2], s * MASCOT_SRC[3] - BN['scene_y'])
    ddx = np.maximum(np.maximum(mb[0] - (xs_ + 1), xs_ - mb[2]), 0)
    ddy = np.maximum(np.maximum(mb[1] - (ys + 1), ys - mb[3]), 0)
    mascot_gap = float(np.hypot(ddx, ddy).min())
    cats_x = x0 + s * SIDE_CATS_X0
    return im.convert('RGB'), dict(title=title.getbbox(), s=(sx, sy, sx + s_img.width, sy + s_img.height),
                                   c=(cx, cy, cx + c_img.width, cy + c_img.height), sec=sec, av_d=av_d,
                                   c_ink=c_ink.getbbox(), s_ink=s_ink.getbbox(), tag_gap=tag_gap,
                                   mascot=tuple(round(v, 1) for v in mb), mascot_gap=mascot_gap, cats_x=cats_x,
                                   glow_in_zone=glow_in_zone, glow_av_d=glow_av_d,
                                   c_off=(cx, cy), s_off=(sx, sy))


# ============================================================ print / reuse masters
def upscale2x(master, slope=1.8):
    """2x print master: Lanczos 2x with a light unsharp mask on the colour, and the alpha edge ramp
    (doubled in width by the resize) tightened back by `slope` around 0.5."""
    W2, H2 = master.width * 2, master.height * 2
    rgb = master.convert('RGB').resize((W2, H2), LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
    a = np.asarray(master.getchannel('A').resize((W2, H2), LANCZOS), np.float32) / 255
    a = np.clip((a - 0.5) * slope + 0.5, 0, 1)
    out = rgb.convert('RGBA')
    out.putalpha(Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'L'))
    return out


def compose_transparent(items, shadow, margin=8):
    """Transparent lockup: items [(rgba, (x, y))] bottom to top, each over its own soft shadow (dy, blur, op)."""
    dy, blur, op = shadow
    pad = int(dy + 3 * blur) + margin
    W = max(x + im.width for im, (x, y) in items) + 2 * pad
    H = max(y + im.height for im, (x, y) in items) + 2 * pad
    canvas = Image.new('RGBA', (W, H), DEEP + (0,))
    for im, (x, y) in items:
        sh = Image.new('L', (W, H), 0)
        sh.paste(im.getchannel('A'), (x + pad, y + pad + dy))
        sh = sh.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * op + 0.5))
        layer = Image.new('RGBA', (W, H), DEEP + (0,))
        layer.putalpha(sh)
        canvas.alpha_composite(layer)
        canvas.alpha_composite(im, (x + pad, y + pad))
    l, t, r, b = canvas.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox()
    return canvas.crop((max(l - margin, 0), max(t - margin, 0), min(r + margin, W), min(b + margin, H)))


def make_lockups(master, pieces, bi):
    k = master.width / AV_W_REF
    stacked = compose_transparent([(master, (0, 0))], (round(AV['shadow'][0] * k), round(AV['shadow'][1] * k), AV['shadow'][2]))
    (pc, oc), (ps, os_) = pieces['C'], pieces['S']
    U = BN['U']
    dx = round((bi['s_off'][0] - bi['c_off'][0]) / U)
    sh = BN['shadow']
    wide = compose_transparent([(ps, (dx, os_[1] - oc[1])), (pc, (0, 0))], (round(sh[0] / U), round(sh[1] / U), sh[2]))
    return stacked, wide


AV_W_REF = 848      # avatar wordmark width the avatar shadow (9, 12) was tuned at


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
    d.text((30, 20), 'Catcoin Sanctuary - cat lettering (final)', font=figtree(28, 700), fill=CREAM)
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
    if what in ('masters', 'all'):
        up = upscale2x(master)
        up.save(os.path.join(HERE, 'wordmark@2x.png'))
        print(f'wordmark@2x: {up.size}')
    if what in ('avatar', 'all'):
        av, ai = make_avatar(master)
        assert ai['r_ink'] <= SAFE_R and ai['r_shadow'] <= SAFE_R, ai
        av.save(os.path.join(HERE, 'avatar.png'))
        av.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'avatar-400.png'))
        print(f"avatar : wordmark {ai['w']}x{ai['h']} at x {ai['x0']} (dx {ai['dx']:+d}), top {AV['top']}; ink bbox {ai['bbox']}; "
              f"max text radius {ai['r_ink']:.1f}, max shadow(>8) radius {ai['r_shadow']:.1f} (limit {SAFE_R}); "
              f"foreground luminance below the sign p50 {ai['fg_lum'][0]:.3f} / p99 {ai['fg_lum'][1]:.3f}")
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
        assert bi['av_d'] >= AVATAR_CLEAR and bi['glow_av_d'] >= AVATAR_CLEAR, bi
        assert bi['glow_in_zone'] == 0, bi
        assert bi['tag_gap'] >= 60 and bi['sec'][2] <= 1140, bi
        assert bi['mascot_gap'] >= 25 and bi['cats_x'] >= 1500, bi
        bn.save(os.path.join(HERE, 'banner.png'))
        print(f"banner : title ink {bi['title']} (Catcoin {bi['c_ink']}, Sanctuary {bi['s_ink']}); secondary {bi['sec']}; "
              f"title ink to X avatar centre {bi['av_d']:.1f}, glow/rim to it {bi['glow_av_d']:.1f} (limit {AVATAR_CLEAR}); "
              f"glow in x<420,y>330: {bi['glow_in_zone']}; gap Catcoin->tagline {bi['tag_gap']} px; "
              f"CoinMarketCat box {bi['mascot']} ({bi['mascot'][2]-bi['mascot'][0]:.0f} px wide), {bi['mascot_gap']:.1f} px from the title; "
              f"side cats start at x {bi['cats_x']:.0f} (off-frame)")
        out['bn'] = bn
        if what == 'all':
            stacked, wide = make_lockups(master, pieces, bi)
            stacked.save(os.path.join(HERE, 'lockup-transparent.png'))
            wide.save(os.path.join(HERE, 'lockup-wide-transparent.png'))
            print(f'lockups: stacked {stacked.size}, wide {wide.size}')
    if what == 'all':
        make_sheet(out['av'], out['sq'], out['bn']).save(os.path.join(HERE, 'sheet.jpg'), quality=92)
