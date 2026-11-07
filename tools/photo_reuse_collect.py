"""
Build photos.json from the photo list read out of the cleaning dashboard.

The list is read in the browser (logged-in cleaning-dashboard.html) as compact
rows, in chunks. Each chunk is either a plain JSON array of rows or a saved
browser-tool result file ([{"type":"text","text":"<json>"}]).

Row order: id, project, freq, task, date, period, image, by, createdAt, lat, lng, src

Usage:
  python -I tools/photo_reuse_collect.py <out photos.json> <chunk file> [<chunk file> ...]
"""
import json
import sys

KEYS = ["id", "project", "freq", "task", "date", "period", "image", "by", "createdAt", "lat", "lng", "src"]


def load_chunk(path):
    v = json.load(open(path, encoding="utf8"))
    if isinstance(v, list) and v and isinstance(v[0], dict) and "text" in v[0]:
        txt = v[0]["text"].split("\n\n(captured at origin")[0].strip()
        v = json.loads(txt)
    while isinstance(v, str):
        v = json.loads(v)
    return v


def main():
    out, chunks = sys.argv[1], sys.argv[2:]
    rows = {}
    for c in chunks:
        for r in load_chunk(c):
            d = dict(zip(KEYS, r))
            if not d["id"].startswith("tp-"):
                d["id"] = "tp-" + d["id"]
            rows[d["id"]] = d
    json.dump(list(rows.values()), open(out, "w", encoding="utf8"), ensure_ascii=False)
    print(f"{len(rows)} photos -> {out}")


if __name__ == "__main__":
    main()
