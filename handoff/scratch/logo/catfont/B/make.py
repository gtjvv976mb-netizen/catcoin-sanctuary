"""Catcoin Sanctuary - logo set v2, approach B: procedural cat lettering in PIL.

What changed vs the previous set (logo/big/final): the name is set in a cat-themed logotype built
procedurally in catletters.py (next to this file) and it is much bigger:
  * base face: DynaPuff Bold (wght 700, wdth 88), a chunky puffy rounded display face (OFL,
    google/fonts ofl/dynapuff), tracked +0.035 em so the letters stay separate when small
  * cat features merged into the letter mask BEFORE outlining (one outline / extrusion for all):
      1. cat ears with pink inner ears growing from the capital C of "Catcoin"
      2. a toe-bean paw print as the dot of the i (the i is set dotless, U+0131)
      3. the final y of "Sanctuary" ends in a curling tabby tail (bands + cream tip)
      4. tabby stripes (tapered wedges entering from the stroke tops) inside "Sanctuary"
  * "Catcoin" cream, "Sanctuary" tabby amber/orange, thick plum outline + extrusion + soft shadow

Outputs (written next to this file):
  avatar.png (1024, circle-safe: every text pixel within r 476 of the centre) + avatar-400.png
  square.png (1024, name ~88% of the width)                                + square-400.png
  banner.png (1500x500 X header: title in y 40-420, x<420/y>330 left clear for the profile picture)
  logotype-transparent.png (the lettering alone, with its shadow, on transparency - extra)
  sheet.jpg  (contact sheet: avatar circle @400/96/48 on #000 and #fff, square @400/64,
              banner @750 and @600x200 with the 130 px profile circle at x 20-150, y 110-240)
Run:  python3 make.py [avatar|square|banner|all]
Sources: ../../s1.png (clean 1024 scene), ../../../kit/cmc-banner-b.png (wide scene),
         ../../../kit/Figtree.ttf (secondary text), fonts/DynaPuff[wdth,wght].ttf.
"""
import math, os, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

import catletters as CL

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.abspath(os.path.join(HERE, '..', '..', '..'))      # .../scratchpad
S1 = os.path.join(SCR, 'logo', 's1.png')
WIDE = os.path.join(SCR, 'kit', 'cmc-banner-b.png')
FIGTREE = os.path.join(SCR, 'kit', 'Figtree.ttf')
LANCZOS = Image.Resampling.LANCZOS

CREAM = (255, 244, 228)
AMBER = (255, 178, 92)
PLUM = (30, 23, 38)
DEEP = CL.DEEP
SAFE_R = 476

FILL_C = ((255, 251, 242), (255, 231, 198))      # "Catcoin": cream, top -> baseline
FILL_S = ((255, 205, 120), (255, 158, 60))       # "Sanctuary": tabby amber -> orange
STRIPES = dict(color=(222, 112, 30), alpha=0.75, period=0.20, width=0.07, depth=0.24, short=0.55, lean=0.12, pow=0.8)
TAIL = dict(index=8, cut=1.06, r0=0.112, r1=0.066, taper_pow=0.9,
            path=[(0.239, 0.945), (0.200, 1.03), (0.14, 1.12), (0.04, 1.20), (-0.10, 1.255), (-0.28, 1.275),
                  (-0.46, 1.26), (-0.62, 1.22), (-0.72, 1.17), (-0.735, 1.105), (-0.685, 1.075), (-0.62, 1.095)],
            color=(250, 150, 50), stripe=(206, 92, 22), bands=7, band_w=0.17, band_a=0.85, tip=0.86)
TRACK = 0.035


def ears_C():
    out = []
    for fx, extra, w, h in ((0.30, -16, 0.30, 0.27), (0.66, 12, 0.28, 0.25)):
        x, y, ang = CL.top_contour('C', fx)
        out.append(dict(base=(x, y + 0.075), w=w, h=h + 0.075, ang=ang + extra, round=0.045, bury=0.10))
    return out


NAME = ('Catcoin', 'Sanctuary')      # exact spelling; every glyph is rendered and checked for ink


def name_lines(cpx, spx):
    assert NAME == ('Catcoin', 'Sanctuary')
    c = CL.build_line('Catcoin', cpx, dict(fill=FILL_C, ears={0: ears_C()}, paw=5, paw_scale=1.9, paw_dy=-0.04),
                      tracking=TRACK)
    s = CL.build_line('Sanctuary', spx, dict(fill=FILL_S, tail=TAIL, stripes=STRIPES), tracking=TRACK)
    return c, s


def name_lockup(cpx, spx, **kw):
    c, s = name_lines(cpx, spx)
    return CL.lockup([c, s], spx, **kw)


# ------------------------------------------------------------------ generic helpers
def figtree(px, w=600):
    f = ImageFont.truetype(FIGTREE, px)
    f.set_variation_by_axes([w])
    return f


def vgrad(size, top, bot, y0, y1):
    w, h = size
    t = np.clip((np.arange(h) - y0) / max(1, (y1 - y0)), 0, 1)[:, None, None]
    a = np.array(top, float)[None, None, :]
    b = np.array(bot, float)[None, None, :]
    arr = np.repeat(a + (b - a) * t, w, axis=1)
    return Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), 'RGB')


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
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) + 0.5
    r = np.hypot(xx - S / 2, yy - S / 2)
    return (1 - smooth((r - r0) / (r1 - r0))).astype(np.float32), r


def max_radius(mask, cx, cy, thresh=0):
    """Distance from (cx, cy) to the farthest corner of any pixel > thresh (conservative)."""
    ys, xs = np.nonzero(np.asarray(mask) > thresh)
    dx = np.maximum(np.abs(xs - cx), np.abs(xs + 1 - cx))
    dy = np.maximum(np.abs(ys - cy), np.abs(ys + 1 - cy))
    return float(np.sqrt(dx * dx + dy * dy).max())


def put(canvas, lk, x_ink, y_ink, anchor='center', shadow_clip=None):
    """Composite a lockup so its ink box's top edge is at y_ink and its centre (or left edge) is at
    x_ink.  Returns (full-canvas letters mask, full-canvas shadow alpha, paste origin)."""
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


def scene_s1(k, ox, oy, S=1024):
    src = Image.open(S1).convert('RGB')
    n = round(1024 * k)
    big = src.resize((n, n), LANCZOS)
    assert 0 <= ox <= n - S and 0 <= oy <= n - S, 'crop leaves the scaled scene'
    return big.crop((ox, oy, ox + S, oy + S)).convert('RGBA')


# ------------------------------------------------------------------ AVATAR (circle-safe)
AV = dict(k=1.25, ox=95, oy=256, top=360, cpx=197, spx=167,
          band=[(300, 0.0), (470, 0.50), (760, 0.50), (1024, 0.40)],
          pool=(26, 30, 0.62), rim_in=504.0, rim=((255, 204, 128), (240, 146, 62)))


def make_avatar():
    S = 1024
    im = scene_s1(AV['k'], AV['ox'], AV['oy'])
    im.alpha_composite(vband((S, S), AV['band']))
    lk = name_lockup(AV['cpx'], AV['spx'])
    best = None                      # horizontal nudge that balances the left/right radius
    for dx in range(-16, 17, 2):
        ink, _, _ = put(Image.new('RGBA', (S, S)), lk, S / 2 + dx, AV['top'])
        r = max_radius(ink, S / 2, S / 2)
        if best is None or r < best[1]:
            best = (dx, r)
    dx = best[0]
    clip, rr = radial(S, SAFE_R - 40, SAFE_R - 1)
    ink, _, _ = put(Image.new('RGBA', (S, S)), lk, S / 2 + dx, AV['top'])
    im.alpha_composite(pool(ink, *AV['pool'], clip=clip))
    ink, shf, (x, y) = put(im, lk, S / 2 + dx, AV['top'], shadow_clip=clip)
    rim_a = smooth(rr - (AV['rim_in'] - 0.5)) * (1 - smooth(rr - 513.5))
    rim = vgrad((S, S), AV['rim'][0], AV['rim'][1], 0, S).convert('RGBA')
    rim.putalpha(Image.fromarray((rim_a * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(rim)
    return im.convert('RGB'), dict(r_ink=max_radius(ink, S / 2, S / 2), r_shadow=max_radius(shf, S / 2, S / 2, 8),
                                   bbox=ink.getbbox(), dx=dx)


# ------------------------------------------------------------------ SQUARE
SQ = dict(k=1.10, ox=51, oy=100, cpx=198, spx=168, bottom=982,
          band=[(420, 0.0), (640, 0.45), (1024, 0.5)], pool=(26, 30, 0.6))


def make_square():
    S = 1024
    im = scene_s1(SQ['k'], SQ['ox'], SQ['oy'])
    im.alpha_composite(vband((S, S), SQ['band']))
    lk = name_lockup(SQ['cpx'], SQ['spx'])
    l, t, r, b = lk['bbox']
    top = SQ['bottom'] - (b - t)
    ink, _, _ = put(Image.new('RGBA', (S, S)), lk, S / 2, top)
    im.alpha_composite(pool(ink, *SQ['pool']))
    ink, _, _ = put(im, lk, S / 2, top)
    return im.convert('RGB'), dict(bbox=ink.getbbox(), lk=lk)


def logotype(lk):
    """The lettering alone on transparency (letters + soft shadow), cropped with a small margin."""
    w, h = lk['img'].size
    out = Image.new('RGBA', (w, h), DEEP + (0,))
    out.putalpha(lk['shadow'])
    out.alpha_composite(lk['img'])
    l, t, r, b = out.getbbox()
    return out.crop((max(0, l - 8), max(0, t - 8), min(w, r + 8), min(h, b + 8)))


# ------------------------------------------------------------------ BANNER 1500x500
BN = dict(scale=0.90, oy=20, mascot_x=1215, x_left=50, top=40, cpx=152, spx=130, s_indent=374,
          fade_end=1120, wash=0.88,
          tag='Every cat here is a token.', url='catcoinsanctuary.com  ·  $CATSANC', tag_px=34, url_px=26)
AVATAR_C = (212.5, 437.5)          # X profile picture over the header, in banner px (r 162.5 + ring)
AVATAR_CLEAR = 172.0
MASCOT_SRC_X = 772                 # the waving mascot's centre in cmc-banner-b.png


def make_banner():
    W, H = 1500, 500
    src = Image.open(WIDE).convert('RGB')
    sc_w, sc_h = round(src.width * BN['scale']), round(src.height * BN['scale'])
    sc = src.resize((sc_w, sc_h), LANCZOS).crop((0, BN['oy'], sc_w, BN['oy'] + H))
    x0 = int(round(BN['mascot_x'] - MASCOT_SRC_X * BN['scale']))
    im = Image.new('RGBA', (W, H), PLUM + (255,))
    im.paste(sc.convert('RGBA'), (x0, 0))
    if x0 > 0:   # fill left of the scene with its own mirror image (sky / meadow continue)
        im.paste(sc.crop((0, 0, x0, H)).transpose(Image.Transpose.FLIP_LEFT_RIGHT).convert('RGBA'), (0, 0))
    xs = np.arange(W, dtype=float)
    a = BN['wash'] * (1 - smooth((xs - 300) / (BN['fade_end'] - 300)))
    a = np.where(xs < 300, BN['wash'], a)[None, :].repeat(H, axis=0)
    wash = vgrad((W, H), (44, 27, 58), (26, 19, 33), 0, H).convert('RGBA')
    wash.putalpha(Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(wash)
    # staircase title: "Catcoin" top-left, "Sanctuary" below, indented past the profile picture
    c, s = name_lines(BN['cpx'], BN['spx'])
    ind = BN['s_indent']
    lk = CL.lockup([c, s], BN['spx'], align='left', offsets=[0, ind], shadow=(0.06, 0.09, 0.6))
    ink0, _, _ = put(Image.new('RGBA', (W, H)), lk, BN['x_left'], BN['top'], anchor='left')
    im.alpha_composite(pool(ink0, 30, 34, 0.55))
    ink, _, _ = put(im, lk, BN['x_left'], BN['top'], anchor='left')
    l, t, r, b = ink.getbbox()
    ys_, xs_ = np.nonzero(np.asarray(ink) > 20)
    av_d = float(np.hypot(xs_ + 0.5 - AVATAR_C[0], ys_ + 0.5 - AVATAR_C[1]).min())
    corner = bool(((xs_ < 420) & (ys_ >= 330)).any())
    # secondary lines go under "Sanctu", left-aligned with the S fill, above the tail
    s_left = BN['x_left'] + BN['s_indent']
    band = np.asarray(ink)[:, s_left:s_left + int(3.0 * BN['spx'])] > 20
    s_bottom = int(np.nonzero(band.any(axis=1))[0].max())
    tail_cols = np.nonzero((np.asarray(ink)[s_bottom + 6:, :] > 20).any(axis=0))[0]
    return im, dict(title=(l, t, r, b), av_d=av_d, corner=corner, ink=ink, lk=lk,
                    sec_x=s_left + int(0.10 * BN['spx']), sec_y=s_bottom + 14, tail_left=int(tail_cols.min()))


def banner_text(im, info):
    """Secondary lines under "Sanctuary", left-aligned with its S, left of the tail."""
    W, H = im.size
    d = ImageDraw.Draw(im)
    f1, f2 = figtree(BN['tag_px'], 680), figtree(BN['url_px'], 600)
    tb = d.textbbox((0, 0), BN['tag'], font=f1)
    ub = d.textbbox((0, 0), BN['url'], font=f2)
    x = info['sec_x']
    ty = info['sec_y'] - tb[1]
    uy = ty + tb[3] + 10 - ub[1]
    sec = (x + min(tb[0], ub[0]), ty + tb[1], x + max(tb[2], ub[2]), uy + ub[3])
    pl = Image.new('L', (W, H), 0)
    ImageDraw.Draw(pl).rounded_rectangle((sec[0] - 24, sec[1] - 12, sec[2] + 20, sec[3] + 12), 28, fill=150)
    pl = pl.filter(ImageFilter.GaussianBlur(18))
    im.paste(Image.new('RGBA', (W, H), PLUM + (255,)), (0, 0), pl)
    for (yy, txt, f, col) in [(ty, BN['tag'], f1, CREAM), (uy, BN['url'], f2, AMBER)]:
        shl = Image.new('L', (W, H), 0)
        ImageDraw.Draw(shl).text((x, yy + 2), txt, font=f, fill=255, stroke_width=2, stroke_fill=255)
        shl = shl.filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.6))
        im.paste(Image.new('RGBA', (W, H), DEEP + (255,)), (0, 0), shl)
        ImageDraw.Draw(im).text((x, yy), txt, font=f, fill=col)
    return sec


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
    d.text((30, 20), 'Catcoin Sanctuary - cat lettering (approach B)', font=figtree(28, 700), fill=CREAM)
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


def banner_full():
    bn, bi = make_banner()
    sec = banner_text(bn, bi)
    return bn.convert('RGB'), bi, sec


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    out = {}
    t0 = time.time()
    if what in ('avatar', 'all'):
        av, ai = make_avatar()
        print(f"avatar : Catcoin {AV['cpx']}px, Sanctuary {AV['spx']}px (DynaPuff), dx {ai['dx']:+d}; ink bbox {ai['bbox']}; "
              f"max text radius {ai['r_ink']:.1f}, max shadow(>8) radius {ai['r_shadow']:.1f} (limit {SAFE_R})")
        assert ai['r_ink'] <= SAFE_R and ai['r_shadow'] <= SAFE_R, ai
        av.save(os.path.join(HERE, 'avatar.png'))
        av.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'avatar-400.png'))
        out['av'] = av
    if what in ('square', 'all'):
        sq, si = make_square()
        w = si['bbox'][2] - si['bbox'][0]
        print(f"square : Catcoin {SQ['cpx']}px, Sanctuary {SQ['spx']}px; ink bbox {si['bbox']}; width {w} = {w / 1024:.1%}")
        assert 0.80 * 1024 <= w <= 0.90 * 1024 and si['bbox'][3] <= 1010, si
        sq.save(os.path.join(HERE, 'square.png'))
        sq.resize((400, 400), LANCZOS).save(os.path.join(HERE, 'square-400.png'))
        logotype(si['lk']).save(os.path.join(HERE, 'logotype-transparent.png'))
        out['sq'] = sq
    if what in ('banner', 'all'):
        bn, bi, sec = banner_full()
        print(f"banner : Catcoin {BN['cpx']}px, Sanctuary {BN['spx']}px, indent {BN['s_indent']}; title ink {bi['title']}; "
              f"secondary {tuple(round(v) for v in sec)}; title ink to X avatar centre {bi['av_d']:.1f} (limit {AVATAR_CLEAR}); "
              f"ink in x<420,y>=330: {bi['corner']}")
        for box in (bi['title'], sec):
            assert box[1] >= 40 and box[3] <= 420, box                  # text inside y 40-420
        assert not (sec[0] < 420 and sec[3] > 330), sec                  # secondary box clear of the corner
        # (the staircase title's bounding box spans the corner, so its ink is checked per pixel: corner)
        assert bi['av_d'] >= AVATAR_CLEAR and not bi['corner'], bi
        assert sec[2] + 16 <= bi['tail_left'], (sec, bi['tail_left'])      # tagline clears the tail
        bn.save(os.path.join(HERE, 'banner.png'))
        out['bn'] = bn
    if what == 'all':
        make_sheet(out['av'], out['sq'], out['bn']).save(os.path.join(HERE, 'sheet.jpg'), quality=92)
    print(f'done in {time.time() - t0:.0f}s')
