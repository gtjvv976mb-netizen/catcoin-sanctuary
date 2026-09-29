#!/usr/bin/env python3
"""ARCHIVE THE SOURCE MODELS, with nothing but Python 3.8+ (no Node, no clone needed).

Downloads every full-detail source GLB behind the cats into one folder and checks each file
against its recorded size and SHA-256 (scripts/source-models.sha256.json), plus any newer model
in scripts/cat-models.jobs.json (checked by the length its GLB header records). Same file names as
scripts/archive-sources.mjs.

    python3 archive-sources.py "DIR"             download what is missing, check everything
    python3 archive-sources.py "DIR" --verify    only check the files already in DIR
    python3 archive-sources.py "DIR" --only KEY,KEY  only these cats (any capitalisation)

(On Windows the command is usually "py" instead of "python3".)

Run it from a clone or on its own: outside a clone it reads the two lists from GitHub. Re-running
resumes: files already in DIR and correct are skipped, and Ctrl-C stops it at once. It writes
DIR/index.json (each file's cat, field, job, link, size and SHA-256) and DIR/README.txt; --verify
works offline from that index.json. Exit status 0 only when every file is there and correct. It
needs to reach raw.githubusercontent.com, assets.meshy.ai and d8j0ntlcm91z4.cloudfront.net.

Meshy's signed links (assets.meshy.ai) last three days from their task and cannot be renewed, so
run this soon after a batch; the site itself only needs the packed copies in assets/models/cats/.
"""
import errno
import hashlib
import json
import os
import shutil
import struct
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


HOSTS = ("raw.githubusercontent.com", "assets.meshy.ai", "d8j0ntlcm91z4.cloudfront.net")


def load_list(name):
    """A list from scripts/ next to this file when run from a clone, else from GitHub (3 tries)."""
    local = os.path.join(HERE, name)
    if os.path.exists(local):
        with open(local, encoding="utf-8") as f:
            return json.load(f)
    for attempt in range(3):
        try:
            return json.loads(fetch_bytes(RAW + "scripts/" + name).decode("utf-8"))
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 + 3 * attempt)


def probe(url):
    """None when the link's host answers (any HTTP status), else why it can't be reached."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-0"})
    try:
        with urllib.request.urlopen(req, timeout=30):
            return None
    except urllib.error.HTTPError:
        return None  # the host answered; a dead link is reported file by file
    except urllib.error.URLError as err:
        if "CERTIFICATE_VERIFY_FAILED" in str(err) and shutil.which("curl"):
            return None  # the downloads fall back to curl
        return str(err.reason)[:150]
    except Exception as err:
        return str(err)[:150]


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
        out = {f: e for f, e in out.items() if e["key"].lower() in only}
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
        head = fh.read(12)
    if len(head) < 12 or head[:4] != b"glTF":
        return "not a GLB file"
    if struct.unpack("<I", head[8:12])[0] != size:  # a GLB header records its own total length
        return f"truncated GLB ({size} of {struct.unpack('<I', head[8:12])[0]} bytes)"
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
                cp = subprocess.run(["curl", "-sSL", "--retry", "2", "-A", UA, "-o", part, "-w", "%{http_code}", url],
                                    capture_output=True, text=True)
                code = int((cp.stdout or "0")[-3:] or 0)
                if code >= 400:
                    raise urllib.error.HTTPError(url, code, f"HTTP {code}", None, None)
                if cp.returncode:
                    raise IOError(f"curl exit {cp.returncode}: {cp.stderr.strip()[:150]}")
                want = None
            got = os.path.getsize(part)
            if want is not None and int(want) != got:
                raise IOError(f"short download {got}/{want}")
            problem = check(part, e)
            if problem:
                raise IOError(problem)
            for i in range(5):
                try:
                    os.replace(part, path)
                    break
                except PermissionError:  # Windows: an antivirus scan or Explorer preview still holds a file
                    if i == 4:
                        raise
                    time.sleep(1 + i)
            return got
        except urllib.error.HTTPError as err:
            last = f"HTTP {err.code}"
            if err.code in (400, 401, 403, 404, 410):  # an expired or withdrawn link: retrying will not help
                break
        except OSError as err:
            last = str(err)[:200]
            if getattr(err, "errno", None) in (errno.ENOSPC, getattr(errno, "EDQUOT", -1), errno.EROFS):
                break  # the folder is full or not writable: retrying will not help
        except Exception as err:  # network hiccup, short or corrupt download: try again
            last = str(err)[:200]
        if attempt < 3:
            time.sleep(2 * 2 ** attempt)
    if os.path.exists(part):
        os.remove(part)
    exp = link_expiry(url)
    if exp and exp < datetime.now(timezone.utc):
        last = f"{last} (the link expired {exp:%Y-%m-%d %H:%M} UTC)"
    raise IOError(last)


README = """Catcoin Sanctuary: source models
================================

The full-detail 3D models behind the cats of Catcoin Sanctuary, archived because their download
links expire. The website itself uses smaller packed copies of these
(assets/models/cats/ in the catcoin-sanctuary repository); keep this folder to repack or rebuild them.

index.json lists every file: its cat (key), whether it is the model ("url") or its lighter variant
("lo_url"), the job that made it, the original link, the size and the SHA-256. To check the
folder later (it works offline, against index.json):

    python3 archive-sources.py "PATH OF THIS FOLDER" --verify      (Windows: py archive-sources.py ...)

(archive-sources.py is in the repository's scripts/ folder.)
"""


def main(argv):
    args, only, verify_only, i = [], None, False, 0
    while i < len(argv):
        a = argv[i]
        if a == "--verify":
            verify_only = True
        elif a == "--only" or a.startswith("--only="):
            if a == "--only":
                i += 1
                if i == len(argv):
                    print("--only needs a list of cat keys, e.g. --only SNOWCURL,PINROW")
                    return 2
            val = argv[i] if a == "--only" else a[len("--only="):]
            only = {k.strip().lower() for k in val.split(",") if k.strip()}
        elif a.startswith("-"):
            print(__doc__ if a in ("-h", "--help") else f"Unknown option {a}\n{__doc__}")
            return 2
        else:
            args.append(a)
        i += 1
    if len(args) != 1:
        print(__doc__)
        return 2
    folder = os.path.abspath(os.path.expanduser(args[0]))
    if verify_only and not os.path.isdir(folder):
        print(f"No such folder: {folder}")
        return 1
    os.makedirs(folder, exist_ok=True)

    try:
        manifest, jobs = load_list("source-models.sha256.json"), load_list("cat-models.jobs.json")
    except Exception as err:
        own = os.path.join(folder, "index.json")
        if verify_only and os.path.exists(own):  # offline: check the folder against its own record
            with open(own, encoding="utf-8") as fh:
                manifest, jobs = {"files": json.load(fh)}, {}
            print("(no network: checking against this folder's own index.json)")
        else:
            print(f"Cannot fetch the lists from {HOSTS[0]}: {str(err)[:150]}")
            return 1
    files = wanted(manifest, jobs, only)
    if only and not files:
        print(f"None of {', '.join(sorted(only))} is a cat in the list.")
        return 2
    if only and len({e['key'].lower() for e in files.values()}) < len(only):
        print(f"Not in the list: {', '.join(sorted(only - {e['key'].lower() for e in files.values()}))}")
        return 2
    print(f"{len(files)} source models for {folder}", flush=True)

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
        for host in sorted({urllib.parse.urlparse(e["url"]).netloc for _, e, _ in todo}):
            why = probe(next(e["url"] for _, e, _ in todo if urllib.parse.urlparse(e["url"]).netloc == host))
            if why:
                print(f"Cannot reach {host} ({why}). Allow these hosts and run again: {', '.join(HOSTS)}")
                return 1
        done, t0 = 0, time.time()
        far = datetime.max.replace(tzinfo=timezone.utc)
        todo.sort(key=lambda t: link_expiry(t[1]["url"]) or far)  # the links that die first go first
        pool = ThreadPoolExecutor(max_workers=4)
        jobs_ = {pool.submit(download, e["url"], os.path.join(folder, f), e): f for f, e, _ in todo}
        try:
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
        except KeyboardInterrupt:  # otherwise the pool finishes every queued download before exiting
            print(f"\nStopped after {done} of {len(todo)}. Finished files are kept; run the same command to resume.", flush=True)
            os._exit(130)
        pool.shutdown()

    total = 0
    for f, e in sorted(files.items()):
        p = os.path.join(folder, f)
        if os.path.exists(p) and f not in dict(failed):
            total += os.path.getsize(p)
    if failed:
        print(f"{ok} of {len(files)} files correct ({total / 1e9:.2f} GB); {len(failed)} FAILED:")
        for f, why in sorted(failed):
            print(f"  {f}: {why}")

    index_path = os.path.join(folder, "index.json")
    index = {}
    try:  # keep what earlier runs (e.g. with --only) recorded for files still in the folder
        with open(index_path, encoding="utf-8") as fh:
            index = {f: v for f, v in json.load(fh).items() if os.path.exists(os.path.join(folder, f))}
    except (OSError, ValueError):
        pass
    for f, e in sorted(files.items()):
        p = os.path.join(folder, f)
        index.pop(f, None)
        if os.path.exists(p) and f not in dict(failed):
            index[f] = {k: e.get(k) for k in ("key", "field", "job", "url")}
            index[f]["bytes"] = os.path.getsize(p)
            index[f]["sha256"] = e.get("sha256") or sha256_of(p)
    try:
        for name, text in (("index.json", json.dumps(dict(sorted(index.items())), indent=1)), ("README.txt", README)):
            tmp = os.path.join(folder, name + ".tmp")
            with open(tmp, "w", encoding="utf-8") as fh:
                fh.write(text)
            os.replace(tmp, os.path.join(folder, name))
    except OSError as err:
        for name in ("index.json.tmp", "README.txt.tmp"):
            try:
                os.remove(os.path.join(folder, name))
            except OSError:
                pass
        print(f"Could not write index.json/README.txt (the old ones are kept): {err}")
        return 1

    if failed:
        return 1
    print(f"All {len(files)} files there and correct ({total / 1e9:.2f} GB) in {folder}")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(line_buffering=True, errors="replace")  # logs show at once when piped
    except (AttributeError, ValueError):
        pass
    sys.exit(main(sys.argv[1:]))
