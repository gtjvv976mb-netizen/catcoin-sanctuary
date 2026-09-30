#!/usr/bin/env python3
"""The garden's photoreal models (assets/models/world/, see its README.md): trees, the cottage and props.

Each came from Higgsfield (Tripo H3.1 image to 3D, from a generated reference picture) as a raw GLB of
about two million triangles with 4k textures. This script, for every model in MODELS (or only the
names given):

  1. keeps the colour texture only, re-encoded to a 1024 px JPEG (512 px for the small props);
     metallic 0, roughness 0.85 (make-cat-models.retexture),
  2. normalizes it: y up, front towards +Z, `height` units tall, base on y = 0, centred on x/z
     (a tree on the foot of its trunk; a wrapper node that gltfpack bakes in),
  3. simplifies and packs it with gltfpack (-si to about `tris` triangles, -sp so it can cut across
     UV seams; quantized, no Draco, no meshopt, no KTX2: the page's GLTFLoader has no decoders),
  4. writes assets/models/world/<name>.glb (a tree also <name>-lo.glb: about 2500 triangles and a
     512 px texture, for far off) and index.json (each model's size and top, for the page to fit it).

Usage:  python3 scripts/make-world-models.py [NAME ...] --raw DIR [--gltfpack PATH]
        DIR holds the raw <name>.glb files (not in the repo: 60-75 MB each).
"""
import argparse, importlib.util, json, os, subprocess, sys, tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/models/world"
sys.dont_write_bytecode = True  # scripts/__pycache__ is checked in: leave it as it is
_spec = importlib.util.spec_from_file_location("catmodels", ROOT / "scripts/make-cat-models.py")
cm = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cm)

# height: units tall (the page fits each model to its spot anyway); tris: the triangle target; tex:
# texture size; tree: centred on the foot of the trunk rather than on its bounding box. Tripo H3.1 puts
# a model's front at +X; every model is turned -90 degrees so its front (the cottage's door, the
# bench's seat, the cat tree's den) faces +Z.
MODELS = {
    "oak":      dict(height=5.6, tris=14000, tex=1024, tree=True, lo=2500),
    "birch":    dict(height=6.4, tris=12000, tex=1024, tree=True, lo=2500),
    "cherry":   dict(height=5.2, tris=12000, tex=1024, tree=True, lo=2500),
    "pine":     dict(height=7.0, tris=10000, tex=1024, tree=True, lo=2500),
    "apple":    dict(height=5.0, tris=12000, tex=1024, tree=True, lo=2500),
    "cottage":  dict(height=5.2, tris=20000, tex=1024, seams=True),
    "fountain": dict(height=3.2, tris=8000, tex=1024),
    "bench":    dict(height=0.95, tris=5000, tex=512),
    "lamp":     dict(height=2.3, tris=2000, tex=512),
    "cattower": dict(height=2.0, tris=6000, tex=512),
    "bed":      dict(height=0.3, tris=2500, tex=512),
}
YAW = -90
BUDGET = 600_000


def fit(js, binc, height, tree=False):
    """Wraps the scene in a node that turns it, scales it to `height` and stands it on y = 0, centred.
    Returns its size and its top (the mean of its highest points: the cottage's chimney)."""
    pts = cm.world_points(js, binc)
    th = np.radians(YAW)
    c, s = np.cos(th), np.sin(th)
    R = np.array([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]])
    p = (np.c_[pts, np.ones(len(pts))] @ R.T)[:, :3]
    lo, hi = p.min(0), p.max(0)
    k = height / (hi[1] - lo[1])
    mid = (lo + hi) / 2
    if tree:  # the trunk a little above the roots
        band = p[(p[:, 1] > lo[1] + 0.04 * (hi[1] - lo[1])) & (p[:, 1] < lo[1] + 0.1 * (hi[1] - lo[1]))]
        mid = np.median(band, 0)
    T = np.eye(4); T[:3, 3] = [-mid[0], -lo[1], -mid[2]]
    M = np.diag([k, k, k, 1]) @ T @ R
    sc = js["scenes"][js.get("scene", 0)]
    js["nodes"].append({"matrix": [float(x) for x in M.T.reshape(-1)], "children": sc["nodes"]})
    sc["nodes"] = [len(js["nodes"]) - 1]
    for n in js["nodes"]: n.pop("name", None)
    q = (np.c_[pts, np.ones(len(pts))] @ M.T)[:, :3]
    top = q[q[:, 1] > height * 0.985].mean(0)
    r = lambda v: round(float(v), 3)
    return {"w": r((hi - lo)[0] * k), "h": r(height), "d": r((hi - lo)[2] * k), "top": [r(v) for v in top],
            "box": [r(v) for v in (*q.min(0), *q.max(0))]}


def triangles(js):
    return sum(js["accessors"][p["indices"]]["count"] // 3 for m in js["meshes"] for p in m["primitives"])


def pack(name, cfg, raw, exe, tag="", tris=None, tex=None):
    js, binc = cm.read_glb((raw / f"{name}.glb").read_bytes())
    n0 = triangles(js)
    js, binc = cm.retexture(js, binc, tex or cfg["tex"], 84)
    dims = fit(js, binc, cfg["height"], cfg.get("tree", False))
    dst = OUT / f"{name}{tag}.glb"
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "fit.glb"
        src.write_bytes(cm.write_glb(js, binc))
        ratio = min(1.0, (tris or cfg["tris"]) / n0)
        # -sa: without it the UV seams stop the simplifier at ~25k triangles (about 900 KB); it smears
        # the texture across seams a little, which only the cottage's crisp timbers show ("seams": off).
        subprocess.run([exe, "-i", str(src), "-o", str(dst), "-km", "-si", f"{ratio:.5f}", "-sp", *([] if cfg.get("seams") else ["-sa"])], check=True, capture_output=True)
    out, _ = cm.read_glb(dst.read_bytes())
    for k in ("extensionsRequired", "extensionsUsed"):
        bad = [e for e in out.get(k, []) if e not in ("KHR_mesh_quantization", "KHR_texture_transform")]
        assert not bad, f"{name}: {bad}"
    sz = dst.stat().st_size
    print(f"{dst.name}: {n0} -> {triangles(out)} triangles, {sz / 1024:.0f} KB, {dims}")
    if sz > BUDGET: print(f"  ! over the {BUDGET} byte budget", file=sys.stderr)
    return dims


def build(name, cfg, raw, exe):
    dims = pack(name, cfg, raw, exe)
    # A tree also gets a far copy, <name>-lo.glb, for the meadows beyond the near ones.
    if cfg.get("lo"):
        pack(name, cfg, raw, exe, "-lo", cfg["lo"], 512)
        dims["lo"] = True
    return dims


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--raw", required=True)
    ap.add_argument("--gltfpack", default=os.environ.get("GLTFPACK", "gltfpack"))
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    idx = OUT / "index.json"
    index = json.loads(idx.read_text()) if idx.exists() else {"version": 1, "models": {}}
    for n in a.names or MODELS:
        info = build(n, MODELS[n], Path(a.raw), a.gltfpack)
        index["models"][n] = info
    rows = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v)}" for k, v in sorted(index["models"].items()))
    idx.write_text('{ "version": 1, "models": {\n' + rows + "\n} }\n")


if __name__ == "__main__":
    main()
