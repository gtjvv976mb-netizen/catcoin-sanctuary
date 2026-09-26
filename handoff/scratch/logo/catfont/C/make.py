"""Catcoin Sanctuary - cat-lettering logo set, approach C (one integrated AI logo).

The art comes from four Higgsfield gpt_image_2_5 generations saved in ./gen (see notes.md for the
prompts and job ids).  This script never calls the API; it only derives the deliverables:

  square.png  (1024)       + square-400.png   <- gen/r2_square.png      (integrated logo, 2048)
  avatar.png  (1024)       + avatar-400.png   <- gen/r2_avatar.png      (integrated logo, 2048),
                                                  re-composed so every text pixel is inside r 476
  banner.png  (1500x500)                      <- gen/r4_banner_scene.png (wide scene, no text)
                                                  + gen/r2_wordmark.png   (same lettering, transparent)
                                                  + Figtree tagline / url
  sheet.jpg   contact sheet (avatar circle @400/96/48 on #000 and #fff, square @400/64,
              banner @750 and @600x200 with the 130 px X avatar circle at x 20-150, y 110-240)

Run:  python3 make.py            (Pillow + numpy only; paths resolve relative to this file)

Text measurement: the AI lettering has a thick dark-plum outline + extrusion that no other part of
the scene uses (hue 285-12 deg, low value).  The text mask is the connected plum region grown from a
seed inside the name, lightly closed, with every enclosed pocket (the letter fills) filled.  All
radius / width / zone numbers printed below come from that mask.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, 'gen')
SCR = os.path.abspath(os.path.join(HERE, '..', '..', '..'))          # .../scratchpad
FIGTREE = os.path.join(SCR, 'kit', 'Figtree.ttf')
SQ_SRC = os.path.join(GEN, 'r2_square.png')
AV_SRC = os.path.join(GEN, 'r2_avatar.png')
WM_SRC = os.path.join(GEN, 'r2_wordmark.png')
BN_SRC = os.path.join(GEN, 'r4_banner_scene.png')
LANCZOS = Image.Resampling.LANCZOS

CREAM = (255, 244, 228)
AMBER = (255, 184, 96)
PLUM = (46, 16, 38)
SAFE_R = 476            # avatar: every text pixel within this radius of the centre (X circle crop)
AV_TARGET_R = 466       # what the re-composition aims for (10 px spare for anti-aliasing)


def figtree(px, w=600):
    f = ImageFont.truetype(FIGTREE, px)
    f.set_variation_by_axes([w])
    return f


# ------------------------------------------------------------------ binary morphology (numpy only)
def _shift(a, dy, dx):
    H, W = a.shape
    out = np.zeros_like(a)
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[yd, xd] = a[ys, xs]
    return out


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r and (dy or dx):
                out |= _shift(m, dy, dx)
    return out


def erode(m, r):
    return ~dilate(~m, r)


def _row_runs(mask, mark):
    """Grow `mark` to the whole horizontal runs of `mask` it touches."""
    H, W = mask.shape
    start = mask.copy()
    start[:, 1:] &= ~mask[:, :-1]
    rid = (np.cumsum(start.ravel()) * mask.ravel()).reshape(H, W)
    hit = np.zeros(int(rid.max()) + 1, bool)
    hit[rid[mark & mask]] = True
    hit[0] = False
    return hit[rid]


def reconstruct(mask, seed):
    """4-connected component(s) of `mask` that contain `seed` (alternating row / column run fills)."""
    cur = seed & mask
    n = -1
    while True:
        cur = _row_runs(mask, cur)
        cur = np.ascontiguousarray(_row_runs(np.ascontiguousarray(mask.T), np.ascontiguousarray(cur.T)).T)
        c = int(cur.sum())
        if c == n:
            return cur
        n = c


def fill_holes(m):
    free = ~m
    border = np.zeros_like(m)
    border[0], border[-1], border[:, 0], border[:, -1] = True, True, True, True
    return m | ~reconstruct(free, border)


# ------------------------------------------------------------------ text mask of an integrated logo
def plum_mask(rgb):
    a = rgb.astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    ok = d > 1e-6
    rm = ok & (mx == r)
    gm = ok & (mx == g) & ~rm
    bm = ok & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    h *= 60
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return ((h >= 285) | (h <= 12)) & (s > 0.28) & (mx < 0.50)


def text_mask(img, seed_box):
    """Lettering mask (outline + extrusion + fills) of `img`; seed_box = (x0, y0, x1, y1) inside the name."""
    rgb = np.asarray(img.convert('RGB'))
    p = erode(dilate(plum_mask(rgb), 2), 2)
    seed = np.zeros_like(p)
    x0, y0, x1, y1 = seed_box
    seed[y0:y1, x0:x1] = True
    return fill_holes(reconstruct(p, seed & p))


def bbox(m):
    ys, xs = np.nonzero(m)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def max_radius(m, cx, cy):
    ys, xs = np.nonzero(m)
    return float(np.hypot(xs + 0.5 - cx, ys + 0.5 - cy).max())


# ------------------------------------------------------------------ SQUARE
def make_square():
    src = Image.open(SQ_SRC).convert('RGB')
    sq = src.resize((1024, 1024), LANCZOS)
    m = text_mask(sq, (300, 700, 720, 760))
    return sq, dict(bbox=bbox(m), width=(bbox(m)[2] - bbox(m)[0]) / 1024)


# ------------------------------------------------------------------ AVATAR
def _mirror_tile(block, n, axis):
    """n rows (axis 0) / columns (axis 1) continuing `block` past its far edge by repeated mirroring."""
    reps = [np.flip(block, axis), block]
    parts, have, i = [], 0, 0
    while have < n:
        parts.append(reps[i % 2])
        have += block.shape[axis]
        i += 1
    out = np.concatenate(parts, axis)
    return out[:n] if axis == 0 else out[:, :n]


def make_avatar():
    S2 = 2048                                          # work at the generation's 2k, output 1024
    src = Image.open(AV_SRC).convert('RGB')
    m2 = text_mask(src, (600, 1400, 1440, 1520))
    ys, xs = np.nonzero(m2)
    px = (xs + 0.5) / 2.0                              # text pixel centres in 1024 units
    py = (ys + 0.5) / 2.0
    # zoom the whole logo out about a pivot at the top centre: the name moves up towards the centre,
    # the face stays uncovered.  Largest zoom f whose transformed text stays inside AV_TARGET_R.
    PX, PY = 512.0, 0.0
    f = 1.0
    while f > 0.6:
        r = np.hypot(PX + (px - PX) * f - 512, PY + (py - PY) * f - 512).max()
        if r <= AV_TARGET_R:
            break
        f -= 0.0025
    w = int(round(S2 * f))
    ox = int(round(S2 / 2 - w / 2))                    # scaled image placed at (ox, 0)
    small = np.asarray(src.resize((w, w), LANCZOS)).astype(np.float32)
    canvas = np.zeros((S2, S2, 3), np.float32)
    canvas[0:w, ox:ox + w] = small
    # uncovered bands: bottom (grass) and both sides (bushes) - continued by mirror tiling of the
    # adjacent strip of the zoomed art.  The strips hold no lettering (checked below).
    text_bottom = int(np.ceil((ys.max() + 1) * f))
    grass = small[text_bottom + 24:w]                  # pure grass rows under the name
    canvas[w:S2, ox:ox + w] = _mirror_tile(grass, S2 - w, 0)
    left = canvas[:, ox:ox + ox]
    canvas[:, 0:ox] = np.flip(left, 1)
    right = canvas[:, ox + w - (S2 - ox - w):ox + w]
    canvas[:, ox + w:S2] = np.flip(right, 1)
    assert text_bottom + 24 < w and xs.min() * f + ox > 2 * ox and (xs.max() + 1) * f + ox < S2 - 2 * (S2 - ox - w)
    im = Image.fromarray(np.clip(canvas + 0.5, 0, 255).astype(np.uint8), 'RGB')
    # gentle vignette so the mirrored outer bands stay quiet, then a warm amber rim just inside
    # the circle (holds the edge on X dark and light modes)
    yy, xx = np.mgrid[0:S2, 0:S2]
    rr = np.hypot(xx + 0.5 - S2 / 2, yy + 0.5 - S2 / 2) / 2.0          # radius in 1024 units
    arr = np.asarray(im).astype(np.float32)
    vig = 1 - 0.28 * np.clip((rr - 440) / 72, 0, 1) ** 1.5
    arr *= vig[..., None]
    # outside the circle (only seen where the image is shown square, e.g. pump.fun): a soft, darker
    # blur of the same scene, so the mirrored fill never reads as a pattern
    soft = np.asarray(Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(28))).astype(np.float32) * 0.82
    w_out = np.clip(rr - 512.0, 0, 1)[..., None]
    arr = arr * (1 - w_out) + soft * w_out
    t = np.clip((yy / S2), 0, 1)[..., None]
    rim_col = np.array(AMBER, np.float32) * (1 - t) + np.array((226, 128, 52), np.float32) * t
    a_line = np.clip(rr - 489.5, 0, 1) * np.clip(493.5 - rr, 0, 1)         # thin plum line r 490-493
    a_rim = np.clip(rr - 493.0, 0, 1) * np.clip(514.0 - rr, 0, 1)          # amber rim r 493-514, scene beyond
    arr = arr * (1 - a_line[..., None]) + np.array(PLUM, np.float32) * a_line[..., None]
    arr = arr * (1 - a_rim[..., None]) + rim_col * a_rim[..., None]
    im = Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), 'RGB')
    av = im.resize((1024, 1024), LANCZOS)
    # measured on the transformed mask at output resolution (any partially covered pixel counts)
    mt = np.zeros((S2, S2), np.uint8)
    mt[0:w, ox:ox + w] = np.asarray(Image.fromarray(m2.astype(np.uint8) * 255).resize((w, w), LANCZOS))
    m1 = np.asarray(Image.fromarray(mt).resize((1024, 1024), Image.Resampling.BOX)) > 0
    # cross-check: re-segment the final avatar itself
    m_final = text_mask(av, (300, 700, 720, 760))
    return av, dict(f=f, r_text=max_radius(m1, 512, 512), bbox=bbox(m1),
                    r_final_seg=max_radius(m_final, 512, 512), bbox_final=bbox(m_final))


# ------------------------------------------------------------------ BANNER
def wordmark_lines():
    """The two lines of the transparent AI wordmark as separate, cleaned RGBA images."""
    wm = Image.open(WM_SRC).convert('RGBA')
    arr = np.asarray(wm).astype(np.float32)
    a = arr[..., 3]
    a = np.clip((a - 16) / (255 - 16), 0, 1)                    # drop the faint generation haze
    solid = a > 0.05
    lines = []
    for band in ((350, 500), (950, 1100)):                      # seed rows inside Catcoin / Sanctuary
        seed = np.zeros_like(solid)
        seed[band[0]:band[1]] = True
        comp = fill_holes(reconstruct(solid, seed & (a > 0.5)))
        l, t, r, b = bbox(comp)
        pad = 4
        l, t, r, b = max(l - pad, 0), max(t - pad, 0), min(r + pad, wm.width), min(b + pad, wm.height)
        la = (a * comp)[t:b, l:r]
        rgb = arr[t:b, l:r, :3]
        out = np.dstack([rgb, la * 255])
        lines.append(Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGBA'))
    return lines                                                # [Catcoin, Sanctuary]


def scaled_rgba(im, s):
    """Premultiplied LANCZOS resize (no dark fringes)."""
    a = np.asarray(im).astype(np.float32) / 255
    pm = np.dstack([a[..., :3] * a[..., 3:4], a[..., 3:4]])
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    ch = [np.asarray(Image.fromarray(np.ascontiguousarray(pm[..., i], np.float32), 'F').resize((w, h), LANCZOS))
          for i in range(4)]
    al = np.clip(ch[3], 0, 1)
    rgb = np.stack(ch[:3], -1) / np.maximum(al[..., None], 1e-6)
    out = np.dstack([np.clip(rgb, 0, 1), al]) * 255
    return Image.fromarray((out + 0.5).astype(np.uint8), 'RGBA')


def soft_shadow(layer, dy, blur, opacity, color=(16, 6, 18)):
    a = layer.getchannel('A').filter(ImageFilter.GaussianBlur(blur))
    a = a.point(lambda v: int(v * opacity))
    sh = Image.new('RGBA', layer.size, color + (0,))
    sh.putalpha(a)
    out = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (0, dy))
    return out


BN = dict(z=1.15, y0=180,                 # scene: scaled to width 1500*z, crop (0, y0, 1500, y0+500)
          s=0.344,                        # wordmark scale (both lines)
          c_xy=(36, 40),                  # "Catcoin"   top-left of its ink box
          s_x=420, s_bottom=420,          # "Sanctuary" left edge / bottom of its ink box
          tag_gap=30)                     # tagline block: this far right of "Catcoin"
X_AV_C, X_AV_R = (212.5, 437.5), 172.5   # X avatar (incl. its page ring) over the header, in banner px


def text_layer(size, img, xy):
    L = Image.new('RGBA', size, (0, 0, 0, 0))
    L.alpha_composite(img, (int(xy[0]), int(xy[1])))
    return L


def make_banner():
    W, H = 1500, 500
    sc = Image.open(BN_SRC).convert('RGB')
    zw = round(W * BN['z'])
    zh = round(sc.height * zw / sc.width)
    sc = sc.resize((zw, zh), LANCZOS).crop((0, BN['y0'], W, BN['y0'] + H))
    im = sc.convert('RGBA')
    cat, san = [scaled_rgba(l, BN['s']) for l in wordmark_lines()]
    # ink boxes (alpha > 20) of the scaled lines, to place by ink rather than by padded image box
    def ink(img):
        return bbox(np.asarray(img.getchannel('A')) > 20)
    ci, si = ink(cat), ink(san)
    c_pos = (BN['c_xy'][0] - ci[0], BN['c_xy'][1] - ci[1])
    s_pos = (BN['s_x'] - si[0], BN['s_bottom'] - si[3])
    Lc = text_layer((W, H), cat, c_pos)
    Ls = text_layer((W, H), san, s_pos)
    # soft shadow lifts the plum outline off the dark sky / meadow
    for L in (Ls, Lc):
        im.alpha_composite(soft_shadow(L, 5, 7, 0.55))
    im.alpha_composite(Ls)
    im.alpha_composite(Lc)              # "Catcoin" on top where its extrusion meets "Sanctuary"
    # tagline + url, right of "Catcoin", left-aligned, vertically centred on its letters
    c_box = bbox(np.asarray(Lc.getchannel('A')) > 20)
    s_box = bbox(np.asarray(Ls.getchannel('A')) > 20)
    f1, f2 = figtree(35, 700), figtree(23, 650)
    t1, t2 = 'Every cat here is a token.', 'catcoinsanctuary.com  ·  $CATSANC'
    x = c_box[2] + BN['tag_gap']
    b1, b2 = f1.getbbox(t1), f2.getbbox(t2)
    h1, h2, gap = b1[3] - b1[1], b2[3] - b2[1], 13
    y = (c_box[1] + c_box[3]) / 2 - (h1 + gap + h2) / 2 + 6
    T = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(T)
    d.text((x - b1[0], y - b1[1]), t1, font=f1, fill=CREAM)
    d.text((x - b2[0], y + h1 + gap - b2[1]), t2, font=f2, fill=AMBER)
    im.alpha_composite(soft_shadow(T, 2, 16, 0.75, color=(24, 8, 30)))   # wide dusk glow: reads over the porch
    im.alpha_composite(soft_shadow(T, 3, 4, 0.9))
    im.alpha_composite(T)
    t_box = bbox(np.asarray(T.getchannel('A')) > 20)
    # checks: all text ink (a > 20) and its shadows
    all_ink = (np.asarray(Lc.getchannel('A')) > 20) | (np.asarray(Ls.getchannel('A')) > 20) | \
              (np.asarray(T.getchannel('A')) > 20)
    yy, xx = np.nonzero(all_ink)
    d_av = float(np.hypot(xx + 0.5 - X_AV_C[0], yy + 0.5 - X_AV_C[1]).min())
    corner = bool((all_ink[330:, :420]).any())
    return im.convert('RGB'), dict(cat=c_box, san=s_box, tag=t_box, all=bbox(all_ink), d_av=d_av,
                                   corner=corner, s=BN['s'])


# ------------------------------------------------------------------ contact sheet
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
    d.text((30, 20), 'Catcoin Sanctuary - cat lettering (approach C: integrated AI logo)',
           font=figtree(28, 700), fill=CREAM)
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
    sq, qi = make_square()
    sq.save(os.path.join(HERE, 'square.png'))
    sq.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'square-400.png'))
    print(f"square : text bbox {qi['bbox']}, name spans {qi['width'] * 100:.1f}% of the width")

    av, ai = make_avatar()
    assert ai['r_text'] <= SAFE_R and ai['r_final_seg'] <= SAFE_R, ai
    av.save(os.path.join(HERE, 'avatar.png'))
    av.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'avatar-400.png'))
    print(f"avatar : zoom {ai['f']:.4f} about (512, 0); text bbox {ai['bbox']}; max text radius "
          f"{ai['r_text']:.1f} (limit {SAFE_R}); re-segmented final: bbox {ai['bbox_final']}, "
          f"max radius {ai['r_final_seg']:.1f}")

    bn, bi = make_banner()
    for box in (bi['cat'], bi['san'], bi['tag']):
        assert box[1] >= 40 and box[3] <= 420, box
        assert not (box[0] < 420 and box[3] > 330), box
    assert not bi['corner'] and bi['d_av'] >= X_AV_R, bi
    bn.save(os.path.join(HERE, 'banner.png'))
    print(f"banner : wordmark scale {bi['s']}; Catcoin ink {bi['cat']}; Sanctuary ink {bi['san']}; "
          f"tagline+url {bi['tag']}; all text {bi['all']}; nearest text to X avatar centre {bi['d_av']:.1f} "
          f"(avatar+ring r {X_AV_R}); any text in x<420,y>330: {bi['corner']}")

    make_sheet(av, sq, bn).save(os.path.join(HERE, 'sheet.jpg'), quality=92)
    print('sheet.jpg written')
