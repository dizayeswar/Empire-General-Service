"""
Cleaning photo reuse scan (READ ONLY).

Finds task photos that were uploaded more than once (same picture re-uploaded
in another week/month or for another task), even when the phone re-saved the
file, by comparing a visual fingerprint (perceptual hash) of every photo.

Input : photos.json  - list of task_photos rows
        (id, project, freq, task, date, period, image, by, createdAt, lat, lng, src)
Output: dup_groups.json - groups of matching photos

Usage:
  python -I tools/photo_dup_scan.py <photos.json> <cache_dir> <out.json> [max_distance]

Nothing is written to Supabase. Images are only downloaded into <cache_dir>.
"""
import hashlib
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageOps

BASE = "https://nobcitpaudeopzfymgzi.supabase.co/storage/v1/object/public/empire-photos/"


def url_of(p):
    img = p["image"]
    return img if img.startswith("http") else BASE + img


def download(p, cache):
    path = os.path.join(cache, p["id"] + ".jpg")
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        try:
            with urllib.request.urlopen(url_of(p), timeout=60) as r:
                data = r.read()
            with open(path, "wb") as f:
                f.write(data)
        except Exception as e:  # noqa: BLE001
            return p["id"], None, str(e)
    return p["id"], path, None


def _dct_matrix(n):
    m = np.zeros((n, n))
    for k in range(n):
        for i in range(n):
            m[k, i] = np.cos(np.pi * k * (2 * i + 1) / (2 * n))
    return m


_D32 = _dct_matrix(32)


def phash(img):
    """64-bit DCT perceptual hash."""
    g = np.asarray(img.convert("L").resize((32, 32), Image.LANCZOS), dtype=np.float64)
    d = _D32 @ g @ _D32.T
    low = d[:8, :8].flatten()
    med = np.median(low[1:])
    return np.packbits(low > med)


def dhash(img):
    g = np.asarray(img.convert("L").resize((9, 8), Image.LANCZOS), dtype=np.int16)
    return np.packbits((g[:, 1:] > g[:, :-1]).flatten())


def fingerprints(path):
    with open(path, "rb") as f:
        raw = f.read()
    md5 = hashlib.md5(raw).hexdigest()
    img = Image.open(path)
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    # centre crop (80%) survives small re-crops / borders
    cw, ch = int(w * 0.8), int(h * 0.8)
    centre = img.crop(((w - cw) // 2, (h - ch) // 2, (w + cw) // 2, (h + ch) // 2))
    small = np.asarray(img.convert("L").resize((16, 16)), dtype=np.float64)
    return {
        "md5": md5,
        "p": phash(img),
        "pc": phash(centre),
        "d": dhash(img),
        "std": float(small.std()),
        "size": [w, h],
    }


def ham(a, b):
    return int(np.unpackbits(a ^ b).sum())


def main():
    src, cache, out = sys.argv[1], sys.argv[2], sys.argv[3]
    max_d = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    os.makedirs(cache, exist_ok=True)
    photos = json.load(open(src, encoding="utf8"))
    by_id = {p["id"]: p for p in photos}

    with ThreadPoolExecutor(12) as ex:
        res = list(ex.map(lambda p: download(p, cache), photos))
    failed = [(i, e) for i, _, e in res if e]
    print(f"downloaded {len(res) - len(failed)}/{len(res)}  failed {len(failed)}")

    fp = {}
    for pid, path, err in res:
        if err:
            continue
        try:
            fp[pid] = fingerprints(path)
        except Exception as e:  # noqa: BLE001
            failed.append((pid, "decode: " + str(e)))

    ids = list(fp)
    # union-find over matching pairs
    parent = {i: i for i in ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    pairs = []
    for a_i in range(len(ids)):
        a = fp[ids[a_i]]
        if a["std"] < 6:  # nearly blank / black frame: fingerprint meaningless
            continue
        for b_i in range(a_i + 1, len(ids)):
            b = fp[ids[b_i]]
            if b["std"] < 6:
                continue
            exact = a["md5"] == b["md5"]
            dp = ham(a["p"], b["p"])
            dc = ham(a["pc"], b["pc"])
            dd = ham(a["d"], b["d"])
            best = min(dp, dc)
            # need perceptual AND gradient hash to agree -> few false matches
            if exact or (best <= max_d and dd <= max_d + 4):
                pairs.append((ids[a_i], ids[b_i], 0 if exact else best, dd, exact))
                parent[find(ids[a_i])] = find(ids[b_i])

    groups = {}
    for i in ids:
        groups.setdefault(find(i), []).append(i)
    groups = [g for g in groups.values() if len(g) > 1]

    result = []
    for g in groups:
        rows = sorted((by_id[i] for i in g), key=lambda r: r["createdAt"])
        periods = {r["period"] for r in rows}
        tasks = {(r["project"], r["task"]) for r in rows}
        gp = [p for p in pairs if p[0] in g and p[1] in g]
        result.append({
            "photos": [dict(r, url=url_of(r), md5=fp[r["id"]]["md5"]) for r in rows],
            "first": rows[0]["id"],
            "exactCopy": all(p[4] for p in gp),
            "maxDistance": max(p[2] for p in gp),
            "crossWeek": len(periods) > 1,
            "crossTask": len(tasks) > 1,
            "pairs": [list(p) for p in gp],
        })
    result.sort(key=lambda r: (-len(r["photos"]), r["photos"][0]["createdAt"]))
    json.dump({"total": len(photos), "scanned": len(fp), "failed": failed,
               "maxDistance": max_d, "groups": result},
              open(out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    reused = sum(len(g["photos"]) - 1 for g in result)
    print(f"groups {len(result)}  reused uploads {reused}")


if __name__ == "__main__":
    main()
