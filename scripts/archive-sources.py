#!/usr/bin/env python3
"""ARCHIVE THE SOURCE MODELS, with nothing but Python 3.8+ (no Node, no clone needed).

Downloads every full-detail source GLB behind the cats into one folder and checks each file
against its recorded size and SHA-256 (scripts/source-models.sha256.json), plus any newer model
in scripts/cat-models.jobs.json (checked by size). Same file names as scripts/archive-sources.mjs.

    python3 archive-sources.py "DIR"             download what is missing, check everything
    python3 archive-sources.py "DIR" --verify    only check the files already in DIR
    python3 archive-sources.py "DIR" --only KEY,KEY

Run it from a clone or on its own: outside a clone it reads the two lists from GitHub. Re-running
resumes: files already in DIR and correct are skipped. It writes DIR/index.json (each file's cat,
field, job, link, size and SHA-256) and DIR/README.txt. Exit status 0 only when every file is
there and correct.

Meshy's signed links (assets.meshy.ai) last three days from their task and cannot be renewed, so
run this soon after a batch; the site itself only needs the packed copies in assets/models/cats/.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

RAW = "https://raw.githubusercontent.com/gtjvv976mb-netizen/catcoin-sanctuary/main/"
HERE = os.path.dirname(os.path.abspath(__file__))
UA = "catcoin-sanctuary-archive/1"


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.URLError as e:
        if "CERTIFICATE_VERIFY_FAILED" in str(e) and shutil.which("curl"):  # python.org macOS builds lack certificates
            return subprocess.run(["curl", "-fsSL", "-A", UA, url], check=True, capture_output=True).stdout
        raise


def load_list(name):
    """A list from scripts/ next to this file when run from a clone, else from GitHub."""
    local = os.path.join(HERE, name)
    if os.path.exists(local):
        with open(local, encoding="utf-8") as f:
            return json.load(f)
    return json.loads(fetch_bytes(RAW + "scripts/" + name).decode("utf-8"))


def file_name(key, field, job):
    return f"{key}{'-lo' if field == 'lo_url' else ''}{('.' + job[:13]) if job else ''}.glb"


def wanted(manifest, jobs, only):
    """{file: {key, field, job, url, bytes?, sha256?}}: the archived set, then anything newer in the jobs list."""
    out = {}
    for f, e in manifest.get("files", {}).items():
        out[f] = dict(e)
    for key, entry in jobs.items():
        for field, job_field in (("url", "model_job"), ("lo_url", "lo_job")):
            url = (entry or {}).get(field) or ""
            if not url.startswith("https://"):
                continue
            job = entry.get(job_field) or ""
            f = file_name(key, field, job)
            if f not in out:
                out[f] = {"key": key, "field": field, "job": job, "url": url}
    if only:
        out = {f: e for f, e in out.items() if e["key"] in only}
    return out


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def check(path, e):
    """None when the file at path is the right one, else what is wrong."""
    if not os.path.exists(path):
        return "missing"
    size = os.path.getsize(path)
    if e.get("bytes") is not None and size != e["bytes"]:
        return f"size {size}, expected {e['bytes']}"
    with open(path, "rb") as fh:
        if fh.read(4) != b"glTF":
            return "not a GLB file"
    if e.get("sha256") and sha256_of(path) != e["sha256"]:
        return "SHA-256 differs"
    return None


def link_expiry(url):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    try:
        if "Expires" in q:
            return datetime.fromtimestamp(int(q["Expires"][0]), timezone.utc)
        if "X-Amz-Date" in q:
            t = datetime.strptime(q["X-Amz-Date"][0], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
            return datetime.fromtimestamp(t.timestamp() + int(q.get("X-Amz-Expires", ["0"])[0]), timezone.utc)
    except (ValueError, KeyError):
        pass
    return None


def download(url, path, e):
    part = path + ".part"
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=120) as r, open(part, "wb") as out:
                    shutil.copyfileobj(r, out, 1 << 20)
                    want = r.headers.get("Content-Length")
            except urllib.error.URLError as err:
                if "CERTIFICATE_VERIFY_FAILED" not in str(err) or not shutil.which("curl"):
                    raise
                subprocess.run(["curl", "-fsSL", "--retry", "2", "-A", UA, "-o", part, url], check=True, capture_output=True)
                want = None
            got = os.path.getsize(part)
            if want is not None and int(want) != got:
                raise IOError(f"short download {got}/{want}")
            problem = check(part, e)
            if problem:
                raise IOError(problem)
            os.replace(part, path)
            return got
        except urllib.error.HTTPError as err:
            last = f"HTTP {err.code}"
            if err.code in (400, 401, 403, 404, 410):  # an expired or withdrawn link: retrying will not help
                break
        except Exception as err:  # network hiccup, short or corrupt download: try again
            last = str(err)[:200]
        time.sleep(2 * 2 ** attempt)
    if os.path.exists(part):
        os.remove(part)
    exp = link_expiry(url)
    if exp and exp < datetime.now(timezone.utc):
        last = f"{last} (the link expired {exp:%Y-%m-%d %H:%M} UTC)"
    raise IOError(last)


README = """Catcoin Sanctuary: source models
================================

The full-detail 3D models (Meshy) behind the cats of Catcoin Sanctuary, archived because their
download links expire. The website itself uses smaller packed copies of these
(assets/models/cats/ in the catcoin-sanctuary repository); keep this folder to repack or rebuild them.

index.json lists every file: its cat (key), whether it is the model ("url") or its lighter variant
("lo_url"), the Meshy job, the original link, the size and the SHA-256. To check the folder later:

    python3 archive-sources.py "{dir}" --verify

(archive-sources.py is in the repository's scripts/ folder.)
"""


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    only = None
    if "--only" in argv:
        only = set(argv[argv.index("--only") + 1].split(","))
        args = [a for a in args if a != argv[argv.index("--only") + 1]]
    if len(args) != 1:
        print(__doc__)
        return 2
    folder = os.path.abspath(os.path.expanduser(args[0]))
    verify_only = "--verify" in argv
    os.makedirs(folder, exist_ok=True)

    manifest, jobs = load_list("source-models.sha256.json"), load_list("cat-models.jobs.json")
    files = wanted(manifest, jobs, only)
    print(f"{len(files)} source models for {folder}")

    todo, ok = [], 0
    for f, e in sorted(files.items()):
        problem = check(os.path.join(folder, f), e)
        if problem is None:
            ok += 1
        else:
            todo.append((f, e, problem))
    print(f"  {ok} already there and correct, {len(todo)} to {'report' if verify_only else 'download'}")

    failed = [(f, p) for f, e, p in todo] if verify_only else []
    if todo and not verify_only:
        need = sum(e.get("bytes") or 40_000_000 for _, e, _ in todo)
        free = shutil.disk_usage(folder).free
        if free < need * 1.05:
            print(f"Not enough free space: need about {need / 1e9:.1f} GB, {free / 1e9:.1f} GB free.")
            return 1
        done, t0 = 0, time.time()
        with ThreadPoolExecutor(max_workers=4) as pool:
            jobs_ = {pool.submit(download, e["url"], os.path.join(folder, f), e): f for f, e, _ in todo}
            for fut in as_completed(jobs_):
                f = jobs_[fut]
                try:
                    fut.result()
                    ok += 1
                except Exception as err:
                    failed.append((f, str(err)))
                done += 1
                if done % 10 == 0 or done == len(todo):
                    print(f"  {done}/{len(todo)} ({time.time() - t0:.0f} s)", flush=True)

    index = {}
    for f, e in sorted(files.items()):
        p = os.path.join(folder, f)
        if os.path.exists(p) and f not in dict(failed):
            index[f] = {k: e.get(k) for k in ("key", "field", "job", "url")}
            index[f]["bytes"] = os.path.getsize(p)
            index[f]["sha256"] = e.get("sha256") or sha256_of(p)
    with open(os.path.join(folder, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, indent=1)
    with open(os.path.join(folder, "README.txt"), "w", encoding="utf-8") as fh:
        fh.write(README.format(dir=folder))

    total = sum(v["bytes"] for v in index.values())
    if failed:
        print(f"{ok} of {len(files)} files correct ({total / 1e9:.2f} GB); {len(failed)} FAILED:")
        for f, why in sorted(failed):
            print(f"  {f}: {why}")
        return 1
    print(f"All {len(files)} files there and correct ({total / 1e9:.2f} GB) in {folder}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
