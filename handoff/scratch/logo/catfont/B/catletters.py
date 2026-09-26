"""Procedural cat lettering for "Catcoin Sanctuary" (approach B).

A chunky puffy display face (DynaPuff Bold, slightly condensed) is laid out glyph by glyph into one
union mask per line at SS x resolution, and cat features are merged into that same mask as vector
shapes BEFORE the outline is computed, so letters and features share one outline / extrusion:
  * cat ears (rounded, slightly convex sides, pink inner ear) growing from the top of the capital C
  * a toe-bean paw print replacing the dot of the i (the i is set as a dotless i)
  * the descender of the final y becomes a curling tabby tail (stripes, cream tip)
  * tabby stripes (wedges entering from the stroke edges) inside the "Sanctuary" fill
All geometry is in em units relative to each glyph's origin, so it scales with the font size.
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, 'fonts', 'DynaPuff[wdth,wght].ttf')
AXES = [700, 88]            # DynaPuff axes order: wght, wdth
ASC = 0.965                 # baseline below the draw origin, em (DynaPuff ascent)
SS = 4

PINK = (255, 150, 172)
PINK_D = (236, 112, 142)
CREAM_TIP = (255, 246, 230)


def font(px):
    f = ImageFont.truetype(FONT, int(round(px)))
    f.set_variation_by_axes(AXES)
    return f


# ------------------------------------------------------------------ small raster helpers
def edt(binary, R):
    """Exact Euclidean distance (px) from every pixel to the nearest True pixel of `binary`,
    bounded: anything farther than R comes back as >= R + 1."""
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


class Local:
    """A local raster window (x0, y0, w, h) inside a full canvas of `shape` (H, W)."""
    def __init__(self, shape, pts, margin):
        H, W = shape
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        self.x0 = int(max(0, math.floor(min(xs) - margin)))
        self.y0 = int(max(0, math.floor(min(ys) - margin)))
        self.x1 = int(min(W, math.ceil(max(xs) + margin)))
        self.y1 = int(min(H, math.ceil(max(ys) + margin)))
        self.shape = (self.y1 - self.y0, self.x1 - self.x0)
        self.full = shape

    def poly(self, pts):
        """Polygon mask in this window (drawn 2x supersampled, box-filtered)."""
        h, w = self.shape
        im = Image.new('L', (w * 2, h * 2), 0)
        ImageDraw.Draw(im).polygon([((x - self.x0) * 2, (y - self.y0) * 2) for x, y in pts], fill=255)
        return np.asarray(im.resize((w, h), Image.Resampling.BOX), np.float32) / 255

    def paste(self, a):
        out = np.zeros(self.full, np.float32)
        out[self.y0:self.y1, self.x0:self.x1] = a
        return out


def soft_open(mask, r):
    """Morphological opening by a disc of radius r (rounds convex corners), anti-aliased."""
    b = mask >= 0.5
    inside = edt(~b, r + 2)                  # distance to outside
    core = inside > r
    d = edt(core, r + 2)
    return np.clip(r + 0.5 - d, 0, 1).astype(np.float32)


def run_dist(B, axis, reverse=False):
    """For a boolean array, the length of the run of True pixels from the nearest False pixel along
    `axis` (in the given direction) up to and including each pixel (0 where False)."""
    A = np.moveaxis(B, axis, 0)
    if reverse:
        A = A[::-1]
    n = A.shape[0]
    idx = np.arange(n).reshape((n,) + (1,) * (A.ndim - 1))
    last_false = np.maximum.accumulate(np.where(~A, idx, -1), axis=0)
    d = np.where(A, idx - last_false, 0)
    if reverse:
        d = d[::-1]
    return np.moveaxis(d, 0, axis)


# ------------------------------------------------------------------ cat features (em units)
def ear_points(bx, by, w, h, ang, bulge=0.10, n=24):
    """Ear outline: base centre (bx, by), base width w, height h, tilt ang (deg, + = clockwise,
    i.e. leaning right); sides bulge outward (quadratic curves). y grows downwards."""
    a = math.radians(ang)
    ux, uy = math.sin(a), -math.cos(a)            # 'up' along the ear axis
    px, py = math.cos(a), math.sin(a)             # across the base (to the right)
    L = (bx - px * w / 2, by - py * w / 2)
    R = (bx + px * w / 2, by + py * w / 2)
    T = (bx + ux * h, by + uy * h)
    def quad(p0, p2, out_sign):
        mx, my = (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2
        dx, dy = p2[0] - p0[0], p2[1] - p0[1]
        ln = math.hypot(dx, dy)
        nx, ny = dy / ln * out_sign, -dx / ln * out_sign
        c = (mx + nx * bulge * ln, my + ny * bulge * ln)
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1]) for t in np.linspace(0, 1, n)]
    # base below (straight), left side L->T bulging out-left, right side T->R bulging out-right
    return quad(L, T, 1) + quad(T, R, 1)[1:]


def ear_layers(shape, ox, oy, em, spec):
    """Returns (ear mask, inner-ear mask) on a canvas of `shape`, for ear spec in em units
    relative to the glyph origin (ox, oy)."""
    bx, by, w, h, ang = spec['base'][0], spec['base'][1], spec['w'], spec['h'], spec['ang']
    pts = ear_points(bx, by, w, h, ang, spec.get('bulge', 0.10))
    P = [(ox + x * em, oy + y * em) for x, y in pts]
    a = math.radians(ang)
    ux, uy = math.sin(a), -math.cos(a)
    dep = spec.get('bury', 0.10)
    L, R = P[0], P[-1]
    P = P + [(R[0] - ux * dep * em, R[1] - uy * dep * em), (L[0] - ux * dep * em, L[1] - uy * dep * em)]
    win = Local(shape, P, 0.1 * em + 8)
    ear = soft_open(win.poly(P), spec.get('round', 0.05) * em)
    k = spec.get('inner', 0.56)
    lift = spec.get('inner_lift', 0.045)
    ib = (bx + ux * lift, by + uy * lift)
    ipts = ear_points(ib[0], ib[1], w * k, (h - lift) * 0.80, ang, spec.get('bulge', 0.10))
    inner = soft_open(win.poly([(ox + x * em, oy + y * em) for x, y in ipts]), spec.get('round', 0.05) * em * 0.7)
    return win.paste(ear), win.paste(inner)


def ellipse_pts(cx, cy, rx, ry, ang=0.0, n=64):
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    out = []
    for t in np.linspace(0, 2 * math.pi, n, endpoint=False):
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return out


def paw_layers(shape, cx, cy, s):
    """Toe-bean paw print centred at (cx, cy) (canvas px), overall size s px (about its width):
    a main pad (union of three ellipses, wider at the bottom) and four oval toe beans on an arc."""
    win = Local(shape, [(cx - s, cy - s), (cx + s, cy + s)], 4)
    pc = (cx, cy + 0.20 * s)
    m = np.zeros(win.shape, np.float32)
    for ex, ey, rx, ry in ((0, 0.02, 0.30, 0.22), (-0.10, 0.06, 0.20, 0.17), (0.10, 0.06, 0.20, 0.17)):
        m = np.maximum(m, win.poly(ellipse_pts(pc[0] + ex * s, pc[1] + ey * s, rx * s, ry * s)))
    for ang, rr, sz in ((-58, 0.44, 0.90), (-19, 0.47, 1.0), (19, 0.47, 1.0), (58, 0.44, 0.90)):
        a = math.radians(ang)
        tx, ty = pc[0] + math.sin(a) * rr * s, pc[1] - 0.02 * s - math.cos(a) * rr * s
        m = np.maximum(m, win.poly(ellipse_pts(tx, ty, 0.105 * s * sz, 0.135 * s * sz, ang)))
    return win.paste(m)


def catmull(points, n=40):
    """Centripetal-ish uniform Catmull-Rom through points (list of (x, y)); returns dense samples."""
    P = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(np.array(P[-2]))
    return np.array(out, np.float64)


def tail_layers(shape, ox, oy, em, spec):
    """Tapered tail along a Catmull-Rom centreline (em units rel. glyph origin).
    Returns (mask, s) where s is the normalised arc length (0 at the root, 1 at the tip) of the
    nearest centreline sample for every tail pixel (for stripes / tip colour)."""
    pts = [(ox + x * em, oy + y * em) for x, y in spec['path']]
    C = catmull(pts, 60)
    seg = np.hypot(*np.diff(C, axis=0).T)
    s = np.r_[0, np.cumsum(seg)]
    s /= s[-1]
    r0, r1 = spec['r0'] * em, spec['r1'] * em
    rad = r0 + (r1 - r0) * (s ** spec.get('taper_pow', 1.0))
    H, W = shape
    x0 = int(max(0, C[:, 0].min() - r0 - 4)); x1 = int(min(W, C[:, 0].max() + r0 + 4))
    y0 = int(max(0, C[:, 1].min() - r0 - 4)); y1 = int(min(H, C[:, 1].max() + r0 + 4))
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32) + 0.5
    best = np.full(xx.shape, np.float32(1e9))
    sidx = np.zeros(xx.shape, np.int32)
    sd = np.full(xx.shape, np.float32(1e9))            # signed distance to the stamped disc union
    for i in range(len(C)):
        d = np.hypot(xx - C[i, 0], yy - C[i, 1]).astype(np.float32)
        sdi = d - np.float32(rad[i])
        upd = sdi < sd
        sd = np.where(upd, sdi, sd)
        closer = d < best
        best = np.where(closer, d, best)
        sidx = np.where(upd, i, sidx)
    m = np.zeros(shape, np.float32)
    m[y0:y1, x0:x1] = np.clip(0.5 - sd, 0, 1)
    S = np.zeros(shape, np.float32)
    S[y0:y1, x0:x1] = s[sidx]
    return m, S, C, rad


# ------------------------------------------------------------------ one line of lettering
def build_line(text, px, spec, tracking=0.0):
    """Render one line at SS x.  spec: dict with optional keys
        fill=(top, bottom)          vertical gradient of the letter fill
        ears={glyph_index: [ear, ...]}   ears in em units rel. that glyph's origin
        paw=glyph_index             i to set dotless with a paw print as its dot
        paw_scale=1.6               paw width relative to the original dot width
        tail=dict(index, cut, path, r0, r1, stripes)   final y descender -> tail
        stripes=dict(color, alpha, period, width, depth, lean)
    Returns dict(fill=float mask, rgb=float RGB, em=px*SS, origin x list, baseline y) with a margin
    `m` around the ink so outlines fit."""
    em = px * SS
    f = font(em)
    adv = [f.getlength(text[:i + 1]) - f.getlength(text[i]) + i * tracking * em for i in range(len(text))]
    m = int(0.9 * em)
    W = int(adv[-1] + f.getlength(text[-1]) + 2 * m)
    H = int(em * 1.45 + 2 * m)
    W += (-W) % SS
    H += (-H) % SS
    oy = m
    glyph = np.zeros((H, W), np.float32)
    feat = np.zeros((H, W), np.float32)      # feature shapes (part of the fill)
    rgb_over = []                             # (mask, color or rgb array) painted over the gradient
    info = dict(em=em, adv=adv, oy=oy, m=m, boxes=[])
    for i, ch in enumerate(text):
        ox = m + adv[i]
        c = ch
        if spec.get('paw') == i:
            c = 'ı'
        im = Image.new('L', (W, H), 0)
        ImageDraw.Draw(im).text((ox, oy), c, font=f, fill=255)
        g = np.asarray(im, np.float32) / 255
        if spec.get('tail') and spec['tail']['index'] == i:
            cut = int(oy + spec['tail']['cut'] * em)
            ramp = np.clip((cut - np.arange(H)) / 2.0 + 0.5, 0, 1)[:, None]
            g = g * ramp
        gb = Image.fromarray((g * 255).astype(np.uint8)).getbbox()
        assert gb is not None and font(em).getmask(c).getbbox() is not None, f'glyph {c!r} has no ink'
        info['boxes'].append(gb)
        glyph = np.maximum(glyph, g)
        if spec.get('paw') == i:
            dot = Image.new('L', (W, H), 0)
            ImageDraw.Draw(dot).text((ox, oy), 'i', font=f, fill=255)
            d = np.asarray(dot, np.float32) / 255
            d = np.where(np.arange(H)[:, None] < oy + 0.40 * em, d, 0)      # the dot only
            ys, xs = np.nonzero(d > 0.5)
            dcx, dcy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
            dw = xs.max() - xs.min()
            s = dw * spec.get('paw_scale', 1.6)
            dy = spec.get('paw_dy', 0.0) * em
            paw = paw_layers((H, W), dcx, dcy + dy, s)
            feat = np.maximum(feat, paw)
            rgb_over.append((paw, 'paw'))
            info['paw'] = (dcx, dcy + dy, s)
        for e in spec.get('ears', {}).get(i, []):
            ear, inner = ear_layers((H, W), ox, oy, em, e)
            feat = np.maximum(feat, ear)
            rgb_over.append((inner * ear, PINK))
        if spec.get('tail') and spec['tail']['index'] == i:
            t = spec['tail']
            tm, ts, C, rad = tail_layers((H, W), ox, oy, em, t)
            feat = np.maximum(feat, tm)
            rgb_over.append((tm, ('tail', ts)))
            info['tail'] = (C, rad)
    fill = np.maximum(glyph, feat)
    ys, xs = np.nonzero(fill > 0.5)
    fb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    # base gradient over the x-height/cap band of the line
    top, bot = spec['fill']
    y0, y1 = oy + 0.25 * em, oy + ASC * em
    t = np.clip((np.arange(H) - y0) / (y1 - y0), 0, 1)[:, None, None]
    rgb = (np.array(top, np.float32) + (np.array(bot, np.float32) - np.array(top, np.float32)) * t) / 255
    rgb = np.repeat(rgb, W, axis=1).astype(np.float32)
    st = spec.get('stripes')
    if st:
        rgb = paint_stripes(rgb, glyph, st, em)
    gl = spec.get('gloss')
    if gl:
        rgb = paint_gloss(rgb, np.maximum(glyph, feat), gl, em)
    for mask, col in rgb_over:
        if isinstance(col, tuple) and len(col) == 2 and col[0] == 'tail':
            rgb = paint_tail(rgb, mask, col[1], spec, em)
        elif col == 'paw':
            yy = np.arange(H, dtype=np.float32)[:, None]
            pc = np.array(PINK, np.float32) / 255
            pd = np.array(PINK_D, np.float32) / 255
            ys_, _ = np.nonzero(mask > 0.5)
            k = np.clip((yy - ys_.min()) / max(1, ys_.max() - ys_.min()), 0, 1)[..., None]
            col_arr = pc + (pd - pc) * k * 0.6
            rgb = rgb * (1 - mask[..., None]) + col_arr * mask[..., None]
        else:
            c = np.array(col, np.float32) / 255
            rgb = rgb * (1 - mask[..., None]) + c * mask[..., None]
    info.update(fill=fill, rgb=rgb, fbox=fb, shape=(H, W))
    return info


def paint_stripes(rgb, glyph, st, em):
    """Tabby stripes clipped inside the letter fill: tapered wedges that enter each stroke from its
    top edge (and, if st['sides'], from its side edges), widest at the edge and fading to a point
    at depth st['depth'], like the markings on a tabby's forehead and legs."""
    ys, xs = np.nonzero(glyph > 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    G = glyph[y0:y1, x0:x1]
    B = G >= 0.5
    H, W = B.shape
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    P = st['period'] * em
    hw = st['width'] * em / 2
    D = st['depth'] * em
    lean = st.get('lean', 0.0)
    wave = st.get('wave', 0.0) * em
    up = run_dist(B, 0).astype(np.float32)
    u = (xx + lean * yy + wave * np.sin(yy / (0.35 * em))) / P
    fu = np.abs(u - np.round(u)) * P
    # alternate long / short stripes (tabby markings are never uniform)
    k = np.round(u).astype(np.int64)
    Dk = np.where(k % 2 == 0, D, D * st.get('short', 0.62)).astype(np.float32)
    prof = np.clip(1 - up / Dk, 0, 1) ** st.get('pow', 0.7)
    sv = np.clip(hw * prof - fu + 0.5, 0, 1) * np.clip(hw * prof, 0, 1)
    s = sv
    if st.get('sides'):
        lf, rt = run_dist(B, 1).astype(np.float32), run_dist(B, 1, True).astype(np.float32)
        dh = np.minimum(lf, rt)
        v = (yy + 0.5 * P) / P
        fv = np.abs(v - np.round(v)) * P
        profh = np.clip(1 - dh / (D * st.get('side_depth', 0.8)), 0, 1) ** st.get('pow', 0.7)
        sh = np.clip(hw * 0.8 * profh - fv + 0.5, 0, 1) * np.clip(hw * 0.8 * profh, 0, 1) * (up > 0.35 * em)
        s = np.maximum(s, sh)
    s = s * G * st['alpha']
    c = np.array(st['color'], np.float32) / 255
    sub = rgb[y0:y1, x0:x1]
    rgb[y0:y1, x0:x1] = sub * (1 - s[..., None]) + c * s[..., None]
    return rgb


def paint_gloss(rgb, fill, gl, em):
    """Soft light rim just inside the top edge of every stroke (reads as a rounded, puffy 3D
    letter), strength gl['alpha'], depth gl['depth'] em."""
    ys, xs = np.nonzero(fill > 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    F = fill[y0:y1, x0:x1]
    up = run_dist(F >= 0.5, 0).astype(np.float32)
    D = gl['depth'] * em
    off = gl.get('offset', 0.012) * em
    k = np.clip(1 - np.abs(up - off - D / 2) / (D / 2), 0, 1) ** 1.5 * (up > 0) * gl['alpha'] * F
    c = np.array(gl.get('color', (255, 255, 255)), np.float32) / 255
    sub = rgb[y0:y1, x0:x1]
    rgb[y0:y1, x0:x1] = sub * (1 - k[..., None]) + c * k[..., None]
    return rgb


def paint_tail(rgb, mask, s, spec, em):
    t = spec['tail']
    base = np.array(t['color'], np.float32) / 255
    dark = np.array(t['stripe'], np.float32) / 255
    tip = np.array(CREAM_TIP, np.float32) / 255
    # bands along the arc length
    n = t.get('bands', 5)
    u = s * n
    fr = np.abs(u - np.round(u))
    band = np.clip((t.get('band_w', 0.16) - fr) * 18, 0, 1) * (s > 0.08) * (s < t.get('tip', 0.86))
    col = base * (1 - band[..., None] * t.get('band_a', 0.8)) + dark * (band[..., None] * t.get('band_a', 0.8))
    tipk = np.clip((s - t.get('tip', 0.86)) * 40, 0, 1)[..., None]
    col = col * (1 - tipk) + tip * tipk
    # root blend: the first ~10% of the tail fades from the letter gradient to the tail colour
    rootk = np.clip((s - 0.02) / 0.10, 0, 1)[..., None]
    col = rgb * (1 - rootk) + col * rootk
    return rgb * (1 - mask[..., None]) + col * mask[..., None]


# ------------------------------------------------------------------ lockup (outline / extrusion / shadow)
STROKE = (46, 28, 40)
DEEP = (20, 12, 20)


def fill_holes(solid):
    """`solid` with every enclosed background pocket filled (4-connected reachability from the
    border, propagated along whole runs of rows and columns until it stops changing)."""
    free = ~solid
    reach = np.zeros_like(free)
    reach[0], reach[-1], reach[:, 0], reach[:, -1] = free[0], free[-1], free[:, 0], free[:, -1]
    for _ in range(200):
        before = int(reach.sum())
        for transpose in (False, True):
            f = free.T if transpose else free
            r = reach.T if transpose else reach
            H, W = f.shape
            ff = np.concatenate([f, np.zeros((H, 1), bool)], axis=1).ravel()
            rr = np.concatenate([r, np.zeros((H, 1), bool)], axis=1).ravel()
            starts = ff & ~np.concatenate([[False], ff[:-1]])
            rid = np.cumsum(starts) * ff
            hit = np.bincount(rid, weights=rr) > 0
            hit[0] = False
            new = hit[rid].reshape(H, W + 1)[:, :W]
            reach = np.ascontiguousarray(new.T) if transpose else new
        if int(reach.sum()) == before:
            break
    return solid | (free & ~reach)


def _down(a):
    H, W = a.shape[:2]
    return a.reshape(H // SS, SS, W // SS, SS, *a.shape[2:]).mean(axis=(1, 3))


def lockup(lines, unit, gap_em=0.02, stroke_em=0.085, close_em=0.03, extrude_em=0.06,
           shadow=(0.07, 0.10, 0.55), align='center', offsets=None):
    """Stack built lines (from build_line) vertically; unit = reference font px (for stroke etc.).
    offsets: optional per-line x offsets (1x px) added after alignment.
    Outline = exact Euclidean dilation of the union fill (all lines, all cat features) by the
    stroke, closed by close_em with enclosed pockets filled; extrusion = outline shifted down;
    everything composited once at SS and box-filtered to 1x."""
    from PIL import ImageFilter
    st = stroke_em * unit * SS
    rc = close_em * unit * SS
    ext = int(round(extrude_em * unit * SS))
    gap = int(gap_em * unit * SS)
    pad = int(st + rc + ext + 0.2 * unit * SS)
    boxes = [ln['fbox'] for ln in lines]
    widths = [b[2] - b[0] for b in boxes]
    Wi = max(widths)
    rel = [((Wi - wd) // 2 if align == 'center' else 0) + (int(round(offsets[k] * SS)) if offsets else 0)
           for k, wd in enumerate(widths)]
    mn = min(rel)
    rel = [v - mn for v in rel]
    W = max(v + wd for v, wd in zip(rel, widths)) + 2 * pad + int(2 * st)
    H = sum(b[3] - b[1] for b in boxes) + gap * (len(lines) - 1) + int(2 * st) * len(lines) + 2 * pad
    W += (-W) % SS
    H += (-H) % SS
    FILL = np.zeros((H, W), np.float32)
    RGB = np.zeros((H, W, 3), np.float32)
    y = pad + int(st)
    placed = []
    for k, (ln, wd, b) in enumerate(zip(lines, widths, boxes)):
        x = pad + int(st) + rel[k]
        ox, oy = x - b[0], y - b[1]
        h, w = ln['fill'].shape
        # crop the line canvas to what fits
        sy0, sx0 = max(0, -oy), max(0, -ox)
        sy1, sx1 = min(h, H - oy), min(w, W - ox)
        dst = (slice(oy + sy0, oy + sy1), slice(ox + sx0, ox + sx1))
        src = (slice(sy0, sy1), slice(sx0, sx1))
        f = ln['fill'][src]
        FILL[dst] = np.maximum(FILL[dst], f)
        sel = f > 0
        RGB[dst][sel] = ln['rgb'][src][sel]
        placed.append((ox, oy))
        y += (b[3] - b[1]) + int(2 * st) + gap
    solid = FILL >= 0.5
    SD = edt(solid, st + rc + 3) - st
    if rc > 0:
        grown = fill_holes(SD <= rc + 0.5)
        OUT = np.clip(edt(~grown, rc + 2) - rc, 0, 1).astype(np.float32)
    else:
        OUT = np.clip(1 - SD, 0, 1).astype(np.float32)
    OUT = np.maximum(OUT, FILL)
    EXT = np.zeros_like(OUT)
    for dy in range(1, ext + 1):
        EXT[dy:] = np.maximum(EXT[dy:], OUT[:-dy])
    C = np.zeros((H, W, 3), np.float32)
    A = np.zeros((H, W), np.float32)
    for col, a in ((np.array(DEEP, np.float32) / 255, EXT), (np.array(STROKE, np.float32) / 255, OUT),
                   (RGB, FILL)):
        C = col * a[..., None] + C * (1 - a[..., None])
        A = a + A * (1 - a)
    C1, A1 = _down(C), _down(A)
    rgb = np.where(A1[..., None] > 1e-6, C1 / np.maximum(A1[..., None], 1e-6), 0)
    img = Image.fromarray(np.clip(np.dstack([rgb * 255, A1 * 255]) + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    ink = Image.fromarray(np.clip(A1 * 255 + 0.5, 0, 255).astype(np.uint8), 'L')
    sh_dy, sh_blur, sh_op = shadow
    sha = np.clip(_down(np.maximum(OUT, EXT)) * 255 + 0.5, 0, 255)
    dy = int(round(sh_dy * unit))
    sh2 = np.zeros_like(sha)
    sh2[dy:] = sha[:-dy] if dy > 0 else sha
    sh = Image.fromarray(sh2.astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(sh_blur * unit))
    sh = sh.point(lambda v: int(v * sh_op + 0.5))
    return dict(img=img, ink=ink, shadow=sh, bbox=ink.getbbox(), placed=[(a / SS, b / SS) for a, b in placed])


_TOPS = {}


def top_contour(ch, fx):
    """(x, y, normal_angle_deg) in em of the glyph's upper outline at fraction fx of its ink width;
    normal_angle 0 = straight up, + = leaning right."""
    if ch not in _TOPS:
        f = font(1000)
        im = Image.new('L', (1400, 1600), 0)
        ImageDraw.Draw(im).text((200, 200), ch, font=f, fill=255)
        a = np.asarray(im) > 127
        l, t, r, b = im.getbbox()
        _TOPS[ch] = (a, l, r)
    a, l, r = _TOPS[ch]
    def top_at(x):
        col = np.nonzero(a[:, int(round(x))])[0]
        return col.min()
    x = l + fx * (r - l)
    y = top_at(x)
    y1, y2 = top_at(x - 25), top_at(x + 25)
    ang = math.degrees(math.atan2(y2 - y1, 50))       # slope: + when the outline descends to the right
    return (x - 200) / 1000, (y - 200) / 1000, ang
