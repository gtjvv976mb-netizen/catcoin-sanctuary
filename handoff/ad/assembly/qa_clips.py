# Download clips, probe them, and build labelled contact sheets for review.
# usage: python3 qa_clips.py clips.json   (clips.json: {"items":[{"name":..,"url":..,"n":6}], "uploads":{"sheetname":"PUT url"}, "sheets":{"sheetname":[names]}})
import json, subprocess, sys, os, concurrent.futures as cf
from PIL import Image, ImageDraw, ImageFont

cfg = json.load(open(sys.argv[1]))
os.makedirs("clips", exist_ok=True)

def dl(it):
    p = "clips/%s.mp4" % it["name"]
    if not os.path.exists(p):
        subprocess.run(["curl", "-sSfL", "-o", p, it["url"]], check=True)
    return p

with cf.ThreadPoolExecutor(8) as ex:
    paths = dict(zip([i["name"] for i in cfg["items"]], ex.map(dl, cfg["items"])))

def probe(p):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,duration,sample_rate,channels",
                        "-show_entries", "format=duration,bit_rate", "-of", "json", p], capture_output=True, text=True).stdout
    return json.loads(o)

fnt = ImageFont.truetype("fonts/Figtree.ttf", 26)
thumbs = {}
for it in cfg["items"]:
    p = paths[it["name"]]
    info = probe(p)
    dur = float(info["format"]["duration"])
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    print("CLIP", it["name"], "%sx%s" % (v["width"], v["height"]), v["r_frame_rate"], "dur=%.2f" % dur,
          "br=%s" % info["format"].get("bit_rate"), "audio=%s" % (a[0]["sample_rate"] + "Hz" if a else "none"))
    n = it.get("n", 6)
    times = it.get("times") or [dur * (i + 0.5) / n for i in range(n)]
    ims = []
    for t in times:
        out = "clips/%s_%.2f.png" % (it["name"], t)
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", "%.3f" % t, "-i", p, "-frames:v", "1", out], check=True)
        im = Image.open(out).convert("RGB")
        tw = it.get("tw", 640)
        im = im.resize((tw, int(tw * im.size[1] / im.size[0])), Image.LANCZOS)
        ImageDraw.Draw(im).text((10, 8), "%s t=%.2f" % (it["name"], t), font=fnt, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        ims.append(im)
    thumbs[it["name"]] = ims
    if it.get("lum_box"):
        # mean luminance of a centre box per frame (e.g. to find a blink)
        x, y, w, h = it["lum_box"]
        o = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", p, "-vf",
                            "crop=iw*%f:ih*%f:iw*%f:ih*%f,scale=32:32,format=gray" % (w, h, x, y), "-f", "rawvideo", "-"],
                           capture_output=True).stdout
        vals = [sum(o[i:i + 1024]) / 1024 for i in range(0, len(o), 1024)]
        print("LUM", it["name"], " ".join("%d:%.0f" % (i, v) for i, v in enumerate(vals)))

for sname, names in cfg["sheets"].items():
    cols = cfg.get("cols", 3)
    rows = []
    for nm in names:
        ims = thumbs[nm]
        for i in range(0, len(ims), cols):
            rows.append(ims[i:i + cols])
    tw, th = rows[0][0].size
    sheet = Image.new("RGB", (tw * cols, th * len(rows)), (20, 20, 20))
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            sheet.paste(im, (c * tw, r * th))
    out = "clips/%s.jpg" % sname
    sheet.save(out, quality=84)
    url = cfg["uploads"].get(sname)
    if url:
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", "-X", "PUT", "-H", "Content-Type: image/jpeg",
                            "-H", "If-None-Match: *", "--upload-file", out, url], capture_output=True, text=True)
        print("UPLOAD", sname, r.stdout, sheet.size)
