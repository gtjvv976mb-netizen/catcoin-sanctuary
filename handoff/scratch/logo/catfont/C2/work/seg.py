"""Text-mask segmentation for AI lettering with a dark plum outline."""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

def hsv(a):
    a = a.astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    h *= 60
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def plum(rgb):
    h, s, v = hsv(rgb)
    return (((h >= 285) | (h <= 12)) & (s > 0.28) & (v < 0.50))

def text_mask(rgb, min_area=4000, close=3):
    p = plum(rgb)
    p = ndi.binary_closing(p, iterations=close)
    lab, n = ndi.label(p)
    sizes = ndi.sum(p, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool); keep[1:] = sizes >= min_area
    m = keep[lab]
    m = ndi.binary_fill_holes(m)
    return m

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    rgb = np.asarray(Image.open(src).convert('RGB'))
    m = text_mask(rgb)
    H, W = m.shape
    ys, xs = np.nonzero(m)
    print('bbox x', xs.min(), xs.max(), 'y', ys.min(), ys.max(), 'width frac', (xs.max() - xs.min() + 1) / W)
    cy, cx = (H - 1) / 2, (W - 1) / 2
    r = np.hypot(ys - cy, xs - cx)
    print('max r', r.max())
    ov = rgb.copy().astype(np.float32)
    ov[m] = ov[m] * 0.4 + np.array([0, 255, 255]) * 0.6
    Image.fromarray(ov.astype(np.uint8)).save(out)
