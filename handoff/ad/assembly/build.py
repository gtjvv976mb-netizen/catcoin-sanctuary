# Catcoin Sanctuary ad assembly: edit + graphics + mix + encode + QA + upload.
# usage: python3 build.py edl.json
import json, subprocess, sys, os, math, wave, struct, random, concurrent.futures as cf
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import overlays as O

E = json.load(open(sys.argv[1]))
W, H, FPS, DUR = E["W"], E["H"], E["fps"], E["dur"]
TOT = int(round(DUR * FPS))
os.makedirs("work", exist_ok=True)
SR = 48000

def sh(cmd, **kw):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)
    if r.returncode:
        print("CMD FAILED:", cmd[:400], "\n", r.stderr[-2000:]); sys.exit(1)
    return r.stdout + r.stderr

# ------------------------------------------------------------ downloads
urls = {}
for s in E["shots"]: urls["shot%s" % s["key"]] = s["url"]
for k, u in E.get("media", {}).items(): urls[k] = u
for i, v in enumerate(E["vo"]): urls["vo%d" % i] = v["url"]
def dl(kv):
    k, u = kv
    ext = ".wav" if k.startswith("vo") else os.path.splitext(u.split("?")[0])[1] or ".bin"
    p = "work/%s%s" % (k, ext)
    if not os.path.exists(p):
        subprocess.run(["curl", "-sSfL", "--retry", "3", "-o", p, u], check=True)
    return k, p
with cf.ThreadPoolExecutor(10) as ex:
    P = dict(ex.map(dl, urls.items()))
print("downloaded", len(P))

# ------------------------------------------------------------ video segments
def geom_filter(g):
    g = g or {"mode": "cover"}
    if g["mode"] == "cover":
        f = "scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos,crop=%d:%d" % (W, H, W, H)
    else:  # crop box in fractions of source
        x, y, w, h = g["box"]
        xe = "iw*(%f+(%f)*min(t/%f\\,1))" % (x, g["x_end"] - x, g["T"]) if g.get("x_end") is not None else "iw*%f" % x
        f = "crop=iw*%f:ih*%f:%s:ih*%f,scale=%d:%d:flags=lanczos" % (w, h, xe, y, W, H)
    if g.get("sharpen"):
        f += ",unsharp=5:5:%s" % g["sharpen"]
    return f

class Seg:
    def __init__(self, s, nframes):
        src = P["shot%s" % s["key"]]
        gf = geom_filter(s.get("geom"))
        if s.get("ramp"):
            parts, labels = [], []
            for i, (a, b, sp) in enumerate(s["ramp"]):
                parts.append("[0:v]trim=start=%f:end=%f,setpts=(PTS-STARTPTS)/%f[p%d]" % (a, b, sp, i)); labels.append("[p%d]" % i)
            fc = ";".join(parts) + ";" + "".join(labels) + "concat=n=%d:v=1:a=0,fps=%d,%s,format=rgb24[o]" % (len(labels), FPS, gf)
            cmd = ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", src, "-filter_complex", fc, "-map", "[o]"]
        else:
            sp = s.get("speed", 1.0)
            vf = "setpts=(PTS-STARTPTS)/%f,fps=%d,%s,format=rgb24" % (sp, FPS, gf)
            cmd = ["ffmpeg", "-nostdin", "-loglevel", "error", "-ss", "%.4f" % s.get("src_in", 0), "-i", src, "-vf", vf]
        cmd += ["-frames:v", str(nframes), "-f", "rawvideo", "-"]
        self.p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
        self.last = None; self.n = 0
    def next(self):
        b = self.p.stdout.read(W * H * 3)
        if len(b) == W * H * 3:
            self.last = Image.frombytes("RGB", (W, H), b)
        self.n += 1
        return self.last.copy()

shots = E["shots"]
for s in shots:
    s["f0"] = int(round(s["t0"] * FPS)); s["f1"] = int(round(s["t1"] * FPS))
for i, s in enumerate(shots):
    nxt = shots[i + 1] if i + 1 < len(shots) else None
    s["tail"] = nxt.get("dissolve_in", 0) if nxt else 0

def ease(u): return u * u * (3 - 2 * u)
def xform(img, s, k):
    X = s.get("xform")
    if not X: return img
    n = s["f1"] - s["f0"]; K = int(round(X["dur"] * FPS))
    if X["at"] == "start":
        if k >= K: return img
        e = ease(k / K)           # 0 -> matched, 1 -> identity
    else:
        k0 = n - K
        if k < k0: return img
        e = 1 - ease(min(1.0, (k - k0 + 1) / K))
    z = X["z"] + (1 - X["z"]) * e
    sx = X["s"][0] + (W / 2 - X["s"][0]) * e; sy = X["s"][1] + (H / 2 - X["s"][1]) * e
    tx = X["t"][0] + (W / 2 - X["t"][0]) * e; ty = X["t"][1] + (H / 2 - X["t"][1]) * e
    return img.transform((W, H), Image.AFFINE, (1 / z, 0, sx - tx / z, 0, 1 / z, sy - ty / z), resample=Image.BICUBIC)

# graphics
wm = Image.open(P["wordmark"]).convert("RGBA")
ph = Image.open(P["photo"]).convert("RGB")
bx = E["photo_box"]; ph = ph.crop(tuple(int(v) for v in bx))
sprites = O.build(E["layout"], wm, ph, E.get("pos"))

SKIPV = os.environ.get("SKIPV") and os.path.exists("work/video.mkv")
if not SKIPV:
  enc = subprocess.Popen(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H),
                          "-r", str(FPS), "-i", "-", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "8", "-g", str(FPS * 2), "work/video.mkv"], stdin=subprocess.PIPE)
  segs = {}
  prev_seg = None
  for i, s in enumerate(shots):
      seg = Seg(s, s["f1"] - s["f0"] + s["tail"])
      n = s["f1"] - s["f0"]; din = s.get("dissolve_in", 0)
      for k in range(n):
          img = xform(seg.next(), s, k)
          if din and k < din and prev_seg is not None:
              pimg = xform(prev_seg.next(), shots[i - 1], shots[i - 1]["f1"] - shots[i - 1]["f0"] - 1)
              img = Image.blend(pimg, img, (k + 1) / (din + 1))
          t = (s["f0"] + k) / FPS
          O.render(img, sprites, t)
          enc.stdin.write(img.tobytes())
      if prev_seg: prev_seg.p.kill()
      prev_seg = seg
      print("shot", s["key"], "frames", n, flush=True)
  prev_seg.p.kill()
  enc.stdin.close(); enc.wait()

# ------------------------------------------------------------ audio
def write_wav(path, x):
    x = np.clip(x, -1, 1)
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())

rng = np.random.default_rng(7)
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)
def whoosh(dur=0.45):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # crude rising band-pass: difference of one-pole low-passes with rising cutoff
    y = np.zeros(n); lp1 = lp2 = 0.0
    for i in range(n):
        fc = 300 + 3500 * (t[i] / dur) ** 2
        a = math.exp(-2 * math.pi * fc / SR); b = math.exp(-2 * math.pi * fc * 0.35 / SR)
        lp1 = (1 - a) * noise[i] + a * lp1; lp2 = (1 - b) * noise[i] + b * lp2
        y[i] = lp1 - lp2
    y *= np.sin(np.pi * np.minimum(1, t / dur)) ** 1.5
    return 0.5 * y / (np.abs(y).max() + 1e-9)
def pop():
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = 950 * np.exp(-t * 18) + 380
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.03)
    y += 0.15 * rng.standard_normal(n) * env(n, 0.0005, 0.006)
    return 0.6 * y / np.abs(y).max()
def tick():
    n = int(0.08 * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 2400 * t) * env(n, 0.0005, 0.012) + 0.4 * np.sin(2 * np.pi * 4100 * t) * env(n, 0.0003, 0.006)
    return 0.45 * y / np.abs(y).max()
def glock(f0=1318.5, dur=2.6):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for m, a, d in [(1, 1.0, 1.1), (2.756, 0.32, 0.45), (5.404, 0.12, 0.2), (8.933, 0.05, 0.1)]:
        y += a * np.sin(2 * np.pi * f0 * m * t) * env(n, 0.002, d)
    return 0.5 * y / np.abs(y).max()
sfx = {"whoosh": whoosh(), "pop": pop(), "tick": tick(), "glock": glock()}
for k, v in sfx.items(): write_wav("work/sfx_%s.wav" % k, v)

A = E["audio"]
inputs, chains, amb_labels, idx = [], [], [], 0
def add_input(path, ss=None, t=None):
    global idx
    args = []
    if ss is not None: args += ["-ss", "%.4f" % max(0, ss)]
    if t is not None: args += ["-t", "%.4f" % t]
    inputs.extend(args + ["-i", path]); idx += 1
    return idx - 1
h = 0.12
for a in A["beds"]:
    src = P[a["src"]]
    start = a["at"] - h; ss = a["src_in"] - h
    pre = 0.0
    if ss < 0: pre = -ss; ss = 0
    d = a["dur"] + 2 * h - pre
    if start + pre < 0:
        cut = -(start + pre); ss += cut; d -= cut; pre += cut
    j = add_input(src, ss, d)
    lab = "b%d" % j
    chains.append("[%d:a]aresample=%d,aformat=channel_layouts=stereo,afade=t=in:d=%f,afade=t=out:st=%f:d=%f,volume=%sdB,adelay=%d|%d[%s]" % (
        j, SR, h, max(0, d - h), h, a.get("gain", 0), int((start + pre) * 1000), int((start + pre) * 1000), lab))
    amb_labels.append("[%s]" % lab)
chains.append("%samix=inputs=%d:normalize=0:duration=longest,apad=whole_dur=%f[amb]" % ("".join(amb_labels), len(amb_labels), DUR))
vo_labels = []
for i, v in enumerate(E["vo"]):
    j = add_input(P["vo%d" % i], v.get("ss"), v.get("t"))
    tempo = ",atempo=%s" % v["tempo"] if v.get("tempo") else ""
    chains.append("[%d:a]aresample=%d,aformat=channel_layouts=stereo%s,afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse,highpass=f=75,acompressor=threshold=-22dB:ratio=2.5:attack=5:release=150:makeup=2,volume=%sdB,adelay=%d|%d[v%d]" % (
        j, SR, tempo, v.get("gain", 0) + A.get("vo_gain", 0), int(v["at"] * 1000), int(v["at"] * 1000), i))
    vo_labels.append("[v%d]" % i)
chains.append("%samix=inputs=%d:normalize=0:duration=longest,apad=whole_dur=%f,asplit=2[vo][vosc]" % ("".join(vo_labels), len(vo_labels), DUR))
fx_labels = []
for i, f in enumerate(A["sfx"]):
    if f["type"] == "clip":
        j = add_input(P[f["src"]], f["src_in"], f["dur"])
        chains.append("[%d:a]aresample=%d,aformat=channel_layouts=stereo,afade=t=in:d=0.08,afade=t=out:st=%f:d=%f,volume=%sdB,adelay=%d|%d[f%d]" % (
            j, SR, f["dur"] * 0.45, f["dur"] * 0.55, f.get("gain", 0), int(f["at"] * 1000), int(f["at"] * 1000), i))
    else:
        j = add_input("work/sfx_%s.wav" % f["type"])
        chains.append("[%d:a]volume=%sdB,adelay=%d|%d[f%d]" % (j, f.get("gain", 0), int(f["at"] * 1000), int(f["at"] * 1000), i))
    fx_labels.append("[f%d]" % i)
chains.append("%samix=inputs=%d:normalize=0:duration=longest,apad=whole_dur=%f[fx]" % ("".join(fx_labels), len(fx_labels), DUR))
duck = A.get("duck", {"threshold": 0.015, "ratio": 5})
chains.append("[amb][vosc]sidechaincompress=threshold=%s:ratio=%s:attack=20:release=400:knee=4[ambd]" % (duck["threshold"], duck["ratio"]))
chains.append("[ambd][vo][fx]amix=inputs=3:normalize=0:duration=longest,atrim=0:%f,afade=t=out:st=%f:d=0.25,loudnorm=I=%s:TP=-1.5:LRA=11,aresample=%d[mix]" % (
    DUR, DUR - 0.25, A.get("lufs", -16), SR))
fc = ";".join(chains)
open("work/fc.txt", "w").write(fc)
sh("ffmpeg -nostdin -loglevel error -y %s -filter_complex_script work/fc.txt -map '[mix]' -ac 2 -ar %d work/mix.wav" % (
    " ".join("'%s'" % a if " " in a else a for a in inputs), SR))
print(sh("ffmpeg -nostdin -i work/mix.wav -af ebur128=peak=true -f null - 2>&1 | tail -12"))

# ------------------------------------------------------------ final mux
out = E["out"]
sh("ffmpeg -nostdin -loglevel error -y -i work/video.mkv -i work/mix.wav -map 0:v -map 1:a "
   "-c:v libx264 -preset slow -profile:v high -level 4.2 -pix_fmt yuv420p -b:v %s -maxrate %s -bufsize %s -g %d "
   "-colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest %s" % (
       E.get("vbr", "22M"), E.get("vmax", "30M"), E.get("vbuf", "44M"), FPS * 2, out))
print(sh("ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate,sample_rate -show_entries format=duration,bit_rate -of compact %s" % out))

# ------------------------------------------------------------ QA: contact sheet + transcript
times = E.get("sheet_times", [i * 1.5 + 0.5 for i in range(25)])
fnt = ImageFont.truetype(os.path.join(O.FONT_DIR, "Figtree.ttf"), 22)
tw = E.get("sheet_tw", 480)
ims = []
for t in times:
    sh("ffmpeg -nostdin -loglevel error -y -ss %.3f -i %s -frames:v 1 work/qa.png" % (t, out))
    im = Image.open("work/qa.png").convert("RGB"); im = im.resize((tw, int(tw * im.size[1] / im.size[0])), Image.LANCZOS)
    ImageDraw.Draw(im).text((8, 6), "%.2f" % t, font=fnt, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
    ims.append(im)
cols = E.get("sheet_cols", 5)
rows = math.ceil(len(ims) / cols)
sheet = Image.new("RGB", (tw * cols, ims[0].size[1] * rows), (0, 0, 0))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * tw, (i // cols) * im.size[1]))
sheet.save("work/sheet.jpg", quality=86)
try:
    from faster_whisper import WhisperModel
    m = WhisperModel("base.en", device="cpu", compute_type="int8")
    segs, _ = m.transcribe("work/mix.wav", word_timestamps=True)
    for sg in segs:
        print("ASR %.2f-%.2f %s" % (sg.start, sg.end, sg.text.strip()))
except Exception as ex:
    print("asr failed", ex)

for kind, path, ctype in [("video", out, "video/mp4"), ("sheet", "work/sheet.jpg", "image/jpeg")]:
    u = E.get("upload", {}).get(kind)
    if u:
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", "-X", "PUT", "-H", "Content-Type: " + ctype,
                            "-H", "If-None-Match: *", "--upload-file", path, u], capture_output=True, text=True)
        print("UPLOAD", kind, r.stdout, os.path.getsize(path))
print("BUILD DONE")
