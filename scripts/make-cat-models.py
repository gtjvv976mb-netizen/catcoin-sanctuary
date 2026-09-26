#!/usr/bin/env python3
"""Per-cat 3D models: the local half of the pipeline (see scripts/CAT-MODELS.md).

The Higgsfield half (balance check, image -> 3D with tripo_h3_1_image_to_3d) runs through the
Higgsfield tools and records each finished job in scripts/cat-models.jobs.json:

    { "PATCHPAW": { "image_job": "<picture job id>", "model_job": "<3D job id>",
                    "model": "tripo_h3_1_image_to_3d", "faces": 12000,
                    "url": "https://.../<3D job>.glb", "status": "done" }, ... }

This script then, for every ticker with a "url" (or only the tickers named on the command line):

  1. downloads the raw GLB (cached in scripts/.cat-models-cache/, which is git-ignored),
  2. normalizes it: y up, facing +X like the shared base models, 1 unit tall, feet on y = 0,
     centred on x/z (a wrapper node carrying the fit; gltfpack bakes it in),
  3. re-encodes the colour texture to 1024 px JPEG (512 px for the far copy), drops PBR extras,
  4. packs it with gltfpack -kn -km -tr (quantized, no decoder needed), and writes
       assets/models/cats/<TICKER>.glb      the full model (budget 600 KB)
       assets/models/cats/<TICKER>-lo.glb   gltfpack -si 0.25 copy for far away (budget 150 KB)
  5. rewrites assets/models/cats/index.json (the tickers the page may load) and the cats'
     table in assets/models/PROVENANCE.md.

Usage:  python3 scripts/make-cat-models.py [TICKER ...] [--gltfpack PATH] [--yaw DEG]
        --yaw adds a turn (degrees about y) for one model whose "front" came out rotated.
Needs Pillow and numpy, and gltfpack (npm i gltfpack; pass --gltfpack or set GLTFPACK).
"""
import argparse, io, json, math, os, struct, subprocess, sys, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "scripts/cat-models.jobs.json"
CACHE = ROOT / "scripts/.cat-models-cache"
OUT = ROOT / "assets/models/cats"
BUDGET_HI, BUDGET_LO, BUDGET_HD, BUDGET_HD_LO = 600_000, 150_000, 800_000, 300_000
COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(data):
    magic, _, _ = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a GLB"
    off, js, binc = 12, None, b""
    while off < len(data):
        ln, kind = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + ln]
        if kind == 0x4E4F534A: js = json.loads(chunk)
        elif kind == 0x004E4942: binc = bytes(chunk)
        off += 8 + ln
    return js, binc


def write_glb(js, binc):
    j = json.dumps(js, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    binc += b"\0" * (-len(binc) % 4)
    total = 12 + 8 + len(j) + (8 + len(binc) if binc else 0)
    out = struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(j), 0x4E4F534A) + j
    if binc: out += struct.pack("<II", len(binc), 0x004E4942) + binc
    return out


def accessor(js, binc, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    n, dt = NCOMP[a["type"]], np.dtype(COMP[a["componentType"]])
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or n * dt.itemsize
    raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (a["count"] - 1) + n * dt.itemsize, offset=base)
    rows = np.lib.stride_tricks.as_strided(raw, (a["count"], n * dt.itemsize), (stride, 1))
    return np.ascontiguousarray(rows).view(dt).reshape(a["count"], n).astype(np.float64)


def node_matrix(n):
    if "matrix" in n: return np.array(n["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.eye(4); t[:3, 3] = n.get("translation", [0, 0, 0])
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    r = np.eye(4)
    r[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                 [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                 [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    s = np.diag(list(n.get("scale", [1, 1, 1])) + [1])
    return t @ r @ s


def world_points(js, binc):
    pts = []
    def walk(ni, parent):
        n = js["nodes"][ni]; m = parent @ node_matrix(n)
        if "mesh" in n:
            for p in js["meshes"][n["mesh"]]["primitives"]:
                v = accessor(js, binc, p["attributes"]["POSITION"])
                pts.append((np.c_[v, np.ones(len(v))] @ m.T)[:, :3])
        for c in n.get("children", []): walk(c, m)
    for r in js["scenes"][js.get("scene", 0)]["nodes"]: walk(r, np.eye(4))
    return np.concatenate(pts)


def retexture(js, binc, size, quality=86):
    """Colour textures -> <= size px JPEG; everything but baseColor dropped. Rebuilds the binary chunk."""
    keep = set()
    for m in js.get("materials", []):
        pbr = m.setdefault("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr: keep.add(js["textures"][pbr["baseColorTexture"]["index"]]["source"])
        pbr.pop("metallicRoughnessTexture", None)
        for k in ("normalTexture", "occlusionTexture", "emissiveTexture"): m.pop(k, None)
        pbr["metallicFactor"], pbr["roughnessFactor"] = 0.0, 0.85
        m.pop("extensions", None)
    new_imgs = {}
    for i in keep:
        im = js["images"][i]; bv = js["bufferViews"][im["bufferView"]]
        data = binc[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        img = Image.open(io.BytesIO(data)).convert("RGB")
        if max(img.size) > size: img = img.resize((size, size) if img.width == img.height else (min(size, img.width), min(size, img.height)), Image.LANCZOS)
        b = io.BytesIO(); img.save(b, "JPEG", quality=quality, optimize=True, progressive=False)
        new_imgs[i] = b.getvalue()
    # Rebuild buffer views: copy all non-image views, then the new images.
    img_views = {js["images"][i]["bufferView"] for i in range(len(js.get("images", [])))}
    out, remap = bytearray(), {}
    views = []
    for vi, bv in enumerate(js["bufferViews"]):
        if vi in img_views: continue
        out += b"\0" * (-len(out) % 4)
        start = bv.get("byteOffset", 0)
        nb = dict(bv, byteOffset=len(out)); out += binc[start: start + bv["byteLength"]]
        remap[vi] = len(views); views.append(nb)
    images, imap = [], {}
    for i in sorted(keep):
        out += b"\0" * (-len(out) % 4)
        views.append({"buffer": 0, "byteOffset": len(out), "byteLength": len(new_imgs[i])}); out += new_imgs[i]
        imap[i] = len(images); images.append({"bufferView": len(views) - 1, "mimeType": "image/jpeg"})
    for a in js["accessors"]:
        if "bufferView" in a: a["bufferView"] = remap[a["bufferView"]]
    textures, tmap = [], {}
    for ti, t in enumerate(js.get("textures", [])):
        if t.get("source") in imap: tmap[ti] = len(textures); textures.append({k: v for k, v in dict(t, source=imap[t["source"]]).items() if k != "extensions"})
    for m in js.get("materials", []):
        bt = m["pbrMetallicRoughness"].get("baseColorTexture")
        if bt: bt["index"] = tmap[bt["index"]]; bt.pop("extensions", None)
    js["bufferViews"], js["images"], js["textures"] = views, images, textures
    js["buffers"] = [{"byteLength": len(out)}]
    for k in ("extensionsUsed", "extensionsRequired"):
        if k in js:
            js[k] = [e for e in js[k] if e in ("KHR_mesh_quantization", "KHR_texture_transform")]
            if not js[k]: del js[k]
    return js, bytes(out)


def heading(pts):
    """The turn about y that points a standing cat's head at +X: the body's long axis (principal
    axis of its footprint), then whichever end has more of the model up high (the head and ears;
    the tail is thin, so it has few points even when it is held up)."""
    xz = pts[:, [0, 2]] - pts[:, [0, 2]].mean(0)
    w, v = np.linalg.eigh(np.cov(xz.T))
    e = v[:, np.argmax(w)]
    a = math.atan2(e[1], e[0])
    along = xz @ e
    y = pts[:, 1]
    high = y > y.min() + 0.55 * (y.max() - y.min())
    span = along.max() - along.min()
    front = np.count_nonzero(high & (along > along.min() + 0.6 * span))
    back = np.count_nonzero(high & (along < along.min() + 0.4 * span))
    return a if front >= back else a + math.pi


def normalize(js, binc, yaw_deg=0.0):
    """Wrap the scene in a node that makes it y-up, facing +X, 1 unit tall, feet on the ground."""
    pts = world_points(js, binc)
    th = heading(pts) + math.radians(yaw_deg)  # Tripo H3.1 already puts the front at +X (checked with render-cat-thumbs)
    c, s = math.cos(th), math.sin(th)
    R = np.array([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]])
    p = (np.c_[pts, np.ones(len(pts))] @ R.T)[:, :3]
    lo, hi = p.min(0), p.max(0)
    k = 1.0 / (hi[1] - lo[1])
    T = np.eye(4); T[:3, 3] = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2]
    M = np.diag([k, k, k, 1]) @ T @ R
    sc = js["scenes"][js.get("scene", 0)]
    js["nodes"].append({"name": "fit", "matrix": [float(x) for x in M.T.reshape(-1)], "children": sc["nodes"]})
    sc["nodes"] = [len(js["nodes"]) - 1]
    size = (hi - lo) * k
    return js, {"len": round(float(size[0]), 4), "height": 1.0, "width": round(float(size[2]), 4)}


def gltfpack(exe, src, dst, extra):
    subprocess.run([exe, "-i", str(src), "-o", str(dst), "-kn", "-km", "-tr", *extra], check=True, capture_output=True)


def build(ticker, job, exe, yaw):
    CACHE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    raw = CACHE / f"{ticker}.raw.glb"
    stamp = raw.with_suffix(".job")
    if not raw.exists() or not stamp.exists() or stamp.read_text() != job.get("model_job", ""):
        req = urllib.request.Request(job["url"], headers={"User-Agent": "cat-sanctuary-models"})
        raw.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        raw.with_suffix(".job").write_text(job.get("model_job", ""))
    info = {}
    # Per-job overrides for dense sources (Hunyuan3D v3 gives ~500k faces): "si"/"si_lo" simplify
    # ratios, "tex"/"tex_lo" texture sizes; HD models get the larger full-size budget.
    si_hi = [] if not job.get("si") else ["-si", str(job["si"])]
    si_lo = ["-si", str(job.get("si_lo", 0.25))]
    hi_budget = BUDGET_HD if job.get("hd") else BUDGET_HI
    for tag, tex, extra, budget in (("", job.get("tex", 1024), si_hi, hi_budget), ("-lo", job.get("tex_lo", 512), si_lo, BUDGET_HD_LO if job.get("hd") else BUDGET_LO)):
        js, binc = read_glb(raw.read_bytes())
        js, binc = retexture(js, binc, tex, job.get("q", 86))
        js, dims = normalize(js, binc, yaw if yaw is not None else job.get("yaw", 0))
        tmp = CACHE / f"{ticker}{tag}.fit.glb"; tmp.write_bytes(write_glb(js, binc))
        dst = OUT / f"{ticker}{tag}.glb"
        gltfpack(exe, tmp, dst, extra)
        sz = dst.stat().st_size
        info["hi" if not tag else "lo"] = sz
        if sz > budget: print(f"  ! {dst.name} is {sz} bytes, over the {budget} budget", file=sys.stderr)
        info.update(dims)
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tickers", nargs="*")
    ap.add_argument("--gltfpack", default=os.environ.get("GLTFPACK", "gltfpack"))
    ap.add_argument("--yaw", type=float, default=None)
    a = ap.parse_args()
    jobs = json.loads(JOBS.read_text())
    todo = a.tickers or [t for t, j in jobs.items() if j.get("url") and j.get("status") == "done"]
    for t in todo:
        j = jobs[t]
        print(f"{t}: {j['model_job']}")
        info = build(t, j, a.gltfpack, a.yaw)
        j.update(sizes={"hi": info["hi"], "lo": info["lo"]}, dims={k: info[k] for k in ("len", "height", "width")})
        if a.yaw is not None: j["yaw"] = a.yaw
        print(f"  {info['hi']/1024:.0f} KB full, {info['lo']/1024:.0f} KB far; len {info['len']} x width {info['width']}")
    JOBS.write_text(json.dumps(jobs, indent=1) + "\n")
    ready = {t: {**j["dims"], **({"hd": True} if j.get("hd") else {})} for t, j in jobs.items() if j.get("status") == "done" and (OUT / f"{t}.glb").exists() and (OUT / f"{t}-lo.glb").exists()}
    (OUT / "index.json").write_text(json.dumps({"version": 1, "cats": ready}, indent=1) + "\n")
    write_provenance(jobs)


def write_provenance(jobs):
    p = ROOT / "assets/models/PROVENANCE.md"
    text = p.read_text()
    mark = "\n## Per-cat models (assets/models/cats/)\n"
    text = text.split(mark)[0].rstrip("\n") + "\n" + mark + (
        "\nEach cat's own model, made from its own picture by scripts/make-cat-models.py (see scripts/CAT-MODELS.md).\n"
        "Normalized: y up, facing +X, 1 unit tall, feet on y = 0; texture 1024 px JPEG; gltfpack 0.24 -kn -km -tr.\n"
        "<TICKER>-lo.glb is the far copy (gltfpack -si 0.25, 512 px texture).\n\n"
        "| Cat | Picture job | Clean image job | 3D job | Model | Full | Far |\n|---|---|---|---|---|---|---|\n")
    for t, j in jobs.items():
        if j.get("status") != "done" or "sizes" not in j: continue
        text += f"| {t} | {j['image_job']} | {j.get('clean_job', '-')} | {j['model_job']} | {j['model']}, {j.get('faces', '?')} faces | {j['sizes']['hi']/1024:.0f} KB | {j['sizes']['lo']/1024:.0f} KB |\n"
    p.write_text(text)


if __name__ == "__main__":
    main()
