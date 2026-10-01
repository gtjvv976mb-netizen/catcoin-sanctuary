# Build edl JSON for build.py from clips.json (urls) + params.json (per-cut decisions).
# usage: python3 make_edl.py 16x9|9x16 params.json out.json
import json, sys
layout, params_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
Pm = json.load(open(params_path))
C = Pm["clips"][layout]
W, H = (1920, 1080) if layout == "16x9" else (1080, 1920)
T = [0.0, 2.2, 5.2, 9.2, 11.4, 16.4, 19.2, 23.7, 28.5, 30.5, 38.0]
shots = []
for i in range(10):
    n = i + 1
    s = {"key": n, "url": C[str(n)]["url"], "t0": T[i], "t1": T[i + 1]}
    s.update(C[str(n)].get("edit", {}))
    shots.append(s)
beds = []
for i in range(10):
    n = i + 1
    a = C[str(n)].get("audio")
    if a is None:
        continue
    for piece in (a if isinstance(a, list) else [a]):
        src = piece.get("src", "shot%d" % n)
        beds.append({"src": src, "src_in": piece["src_in"], "at": piece.get("at", T[i]), "dur": piece.get("dur", T[i + 1] - T[i]), "gain": piece.get("gain", 0)})
vo = Pm["vo"]  # list of {url, at, ss, t, tempo, gain}
E = {
    "layout": layout, "W": W, "H": H, "fps": 24, "dur": 38.0, "out": "work/final_%s.mp4" % layout,
    "shots": shots,
    "media": {"wordmark": Pm["wordmark"], "photo": C["photo"]["url"]},
    "photo_box": C["photo"]["box"],
    "vo": vo,
    "audio": {"beds": beds, "sfx": Pm["sfx"][layout] if layout in Pm["sfx"] else Pm["sfx"]["all"], "vo_gain": Pm.get("vo_master", 0),
              "duck": Pm.get("duck", {"threshold": 0.015, "ratio": 5}), "lufs": Pm.get("lufs", -16)},
    "pos": Pm.get("pos", {}).get(layout, {}),
    "upload": Pm.get("upload", {}).get(layout, {}),
    "sheet_times": Pm.get("sheet_times", {}).get(layout) or [0.25, 1.2, 2.0, 2.3, 2.6, 3.4, 4.8, 6.5, 8.6, 10.2, 11.2, 12.3, 15.2, 17.5, 19.8, 21.5, 22.9, 25.5, 28.0, 29.6, 31.5, 33.2, 34.2, 35.5, 37.8],
    "sheet_tw": 480 if layout == "16x9" else 270, "sheet_cols": 5 if layout == "16x9" else 9,
}
if layout == "9x16":
    E["vbr"], E["vmax"], E["vbuf"] = "20M", "28M", "40M"
json.dump(E, open(out_path, "w"), indent=1)
print("ok", out_path, len(shots), "shots", len(beds), "beds")
