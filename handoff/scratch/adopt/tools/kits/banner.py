"""FEASIBILITY PROTOTYPE (not final art): a per-cat 1500x500 X header + 400x400 avatar, composited with PIL
from the cat's own 1024 token image and the sanctuary scene, in the brand's fonts and colours.
Reads (read-only): kit/cmc-banner-b.png, kit/Gluten.ttf, kit/Figtree.ttf, launch-sheet/images/<TICKER>.png,
adopt/raw/kits/base-inventory.json. Writes only adopt/raw/kits/proto/.
Geometry and colours follow logo/big/final/make.py (scene scale 0.94, oy 26, flush right, mirrored strip,
plum wash; X avatar over the header at centre (212.5, 437.5) r 172 in 1500x500 coordinates).
Run: python3 banner.py TICKER [TICKER ...]"""
import json, os, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SP = '/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad'
OUT = f'{SP}/adopt/raw/kits/proto'
SCENE = f'{SP}/kit/cmc-banner-b.png'
GLUTEN, FIGTREE = f'{SP}/kit/Gluten.ttf', f'{SP}/kit/Figtree.ttf'
CREAM, AMBER, PLUM, DEEP, STROKE = (255, 244, 228), (255, 178, 92), (30, 23, 38), (20, 12, 20), (46, 28, 40)
LANCZOS = Image.Resampling.LANCZOS
W, H = 1500, 500
AVATAR_C, AVATAR_CLEAR = (212.5, 437.5), 172.0
MED_C, MED_D = (962, 246), 404          # medallion sits over the scene's own mascot (x ~895-1027 after scaling)
TEXT_L, TEXT_R = 56, 700


def gluten(px, w=800):
    f = ImageFont.truetype(GLUTEN, px); f.set_variation_by_axes([w, 0]); return f


def figtree(px, w=600):
    f = ImageFont.truetype(FIGTREE, px); f.set_variation_by_axes([w]); return f


def smooth(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)


def scene():
    src = Image.open(SCENE).convert('RGB')
    sw, sh = round(src.width * 0.94), round(src.height * 0.94)
    sc = src.resize((sw, sh), LANCZOS).crop((0, 26, sw, 26 + H))
    x0 = W - sw
    im = Image.new('RGBA', (W, H), PLUM + (255,))
    im.paste(sc.convert('RGBA'), (x0, 0))
    im.paste(sc.crop((0, 0, x0, H)).transpose(Image.Transpose.FLIP_LEFT_RIGHT).convert('RGBA'), (0, 0))
    xs = np.arange(W, dtype=float)
    a = 0.9 * (1 - smooth((xs - 150) / (760 - 150)))
    a = np.where(xs < 150, 0.9, a)[None, :].repeat(H, axis=0)
    wash = Image.new('RGBA', (W, H), (36, 24, 46, 255))
    wash.putalpha(Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), 'L'))
    im.alpha_composite(wash)
    return im


def medallion(im, token_path):
    d = MED_D
    tok = Image.open(token_path).convert('RGB').resize((d, d), LANCZOS)
    m = Image.new('L', (d * 4, d * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, d * 4 - 1, d * 4 - 1), fill=255)
    m = m.resize((d, d), LANCZOS)
    cx, cy = MED_C
    x, y = cx - d // 2, cy - d // 2
    # soft drop shadow, then a cream ring with a thin plum outline, then the cat
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).ellipse((x - 14, y - 4, x + d + 14, y + d + 24), fill=200)
    im.paste(Image.new('RGBA', (W, H), DEEP + (255,)), (0, 0), sh.filter(ImageFilter.GaussianBlur(18)))
    ring = Image.new('L', (W * 2, H * 2), 0)
    ImageDraw.Draw(ring).ellipse(((x - 13) * 2, (y - 13) * 2, (x + d + 13) * 2, (y + d + 13) * 2), fill=255)
    ring = ring.resize((W, H), LANCZOS)
    im.paste(Image.new('RGBA', (W, H), STROKE + (255,)), (0, 0), ring)
    ring2 = Image.new('L', (W * 2, H * 2), 0)
    ImageDraw.Draw(ring2).ellipse(((x - 10) * 2, (y - 10) * 2, (x + d + 10) * 2, (y + d + 10) * 2), fill=255)
    im.paste(Image.new('RGBA', (W, H), CREAM + (255,)), (0, 0), ring2.resize((W, H), LANCZOS))
    im.paste(tok.convert('RGBA'), (x, y), m)


def fit_lines(text, max_w, sizes=range(92, 47, -4)):
    """One line if it fits at >= 72 px, else the best two-line split, largest size that fits."""
    words = text.split()
    for px in sizes:
        f = gluten(px)
        if px >= 72 and f.getlength(text) + 2 * 0.08 * px <= max_w:
            return px, [text]
    for px in sizes:
        f = gluten(px)
        best = None
        for i in range(1, len(words)):
            a, b = ' '.join(words[:i]), ' '.join(words[i:])
            wmax = max(f.getlength(a), f.getlength(b)) + 2 * 0.08 * px
            if wmax <= max_w and (best is None or wmax < best[0]):
                best = (wmax, [a, b])
        if best:
            return px, best[1]
    return sizes[-1], [text]


def draw_text(im, ink, xy, txt, font, fill, stroke_px):
    x, y = xy
    shl = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shl).text((x, y + max(2, stroke_px // 2)), txt, font=font, fill=255, stroke_width=stroke_px + 2, stroke_fill=255)
    im.paste(Image.new('RGBA', (W, H), DEEP + (255,)), (0, 0), shl.filter(ImageFilter.GaussianBlur(4)).point(lambda v: int(v * 0.55)))
    ImageDraw.Draw(im).text((x, y), txt, font=font, fill=fill, stroke_width=stroke_px, stroke_fill=STROKE)
    ImageDraw.Draw(ink).text((x, y), txt, font=font, fill=255, stroke_width=stroke_px, stroke_fill=255)


def layout(row, name_px_cap):
    d = row['draft']; name, ticker = d['name'], d['ticker']
    im = scene(); ink = Image.new('L', (W, H), 0)
    medallion(im, d['imagePath'])
    dr = ImageDraw.Draw(im)
    # 1) the ticker on top, 2) the name in one or two lines, 3) the address right-aligned: all kept out of the avatar zone
    y = 34
    tf = gluten(54, 780)
    bb = dr.textbbox((0, 0), f'${ticker}', font=tf, stroke_width=4)
    draw_text(im, ink, (TEXT_L - bb[0], y - bb[1]), f'${ticker}', tf, AMBER, 4)
    y += bb[3] - bb[1] + 14
    px, lines = fit_lines(name, TEXT_R - TEXT_L, sizes=range(name_px_cap, 43, -4))
    f = gluten(px); sp = round(px * 0.08)
    for ln in lines:
        bb = dr.textbbox((0, 0), ln, font=f, stroke_width=sp)
        draw_text(im, ink, (TEXT_L - bb[0], y - bb[1]), ln, f, CREAM, sp)
        y += (bb[3] - bb[1]) + 6
    uf = figtree(27, 620); url = 'lives at catcoinsanctuary.com'
    ub = dr.textbbox((0, 0), url, font=uf)
    draw_text(im, ink, (TEXT_R - ub[2], y + 14), url, uf, CREAM, 0)
    ys, xs = np.nonzero(np.asarray(ink) > 20)
    av_d = float(np.hypot(xs + 0.5 - AVATAR_C[0], ys + 0.5 - AVATAR_C[1]).min())
    return im, px, lines, y, av_d - AVATAR_CLEAR


def make(row):
    d = row['draft']; name, ticker = d['name'], d['ticker']
    for cap in range(92, 43, -4):                       # largest name size whose ink clears the avatar by >= 8 px
        im, px, lines, y, clear = layout(row, cap)
        if clear >= 8:
            break
    out = im.convert('RGB')
    os.makedirs(OUT, exist_ok=True)
    p_png, p_jpg = f'{OUT}/{ticker}-banner-1500x500.png', f'{OUT}/{ticker}-banner-1500x500.jpg'
    out.save(p_png, optimize=True); out.save(p_jpg, quality=90, optimize=True, progressive=True)
    av = Image.open(d['imagePath']).convert('RGB').resize((400, 400), LANCZOS)
    p_av = f'{OUT}/{ticker}-avatar-400.png'; av.save(p_av, optimize=True)
    return dict(ticker=ticker, name=name, namePx=px, nameLines=lines, textBottomY=y, avatarClearancePx=round(clear, 1),
                bannerPng=p_png, bannerPngBytes=os.path.getsize(p_png), bannerJpg=p_jpg, bannerJpgBytes=os.path.getsize(p_jpg),
                avatar=p_av, avatarBytes=os.path.getsize(p_av))


if __name__ == '__main__':
    base = json.load(open(f'{SP}/adopt/raw/kits/base-inventory.json'))
    by = {r['draft'].get('ticker'): r for r in base['rows']}
    res = []
    for t in sys.argv[1:]:
        t0 = time.time(); r = make(by[t]); r['seconds'] = round(time.time() - t0, 2); res.append(r); print(json.dumps(r))
    # a contact sheet of the prototypes at X's desktop display size (600x200) with the avatar circle drawn in
    sheet = Image.new('RGB', (1240, 40 + 230 * len(res)), (245, 240, 232)); ds = ImageDraw.Draw(sheet)
    for i, r in enumerate(res):
        b = Image.open(r['bannerPng']).resize((600, 200), LANCZOS); y0 = 20 + 230 * i
        sheet.paste(b, (20, y0)); sheet.paste(Image.open(r['bannerPng']).resize((600, 200), LANCZOS), (620, y0))
        av = Image.open(r['avatar']).resize((130, 130), LANCZOS); m = Image.new('L', (130, 130), 0); ImageDraw.Draw(m).ellipse((0, 0, 129, 129), fill=255)
        ds.ellipse((620 + 16, y0 + 106, 620 + 154, y0 + 244), fill=(245, 240, 232)); sheet.paste(av, (620 + 20, y0 + 110), m)
        ds.text((20, y0 + 204), f"{r['ticker']}: left = header alone, right = as X overlays the 130px avatar (clearance {r['avatarClearancePx']} px @1500)", fill=(60, 50, 60))
    sheet.save(f'{OUT}/proto-sheet.jpg', quality=88)
    json.dump(res, open(f'{OUT}/proto-results.json', 'w'), indent=1)
