"""
Turn dup_groups.json (from photo_dup_scan.py) into a readable HTML report.

Usage:
  python -I tools/photo_dup_report.py <dup_groups.json> <out.html> [seen.json]

seen.json (optional) remembers which reused photos were already reported, so
the next report can mark the ones that are NEW since the last check.
"""
import datetime
import html
import json
import os
import sys
from collections import Counter, defaultdict

PROJECT_NAMES = {}  # optional pretty names, e.g. {"ww2": "WW2"}


def esc(v):
    return html.escape(str(v if v is not None else ""))


def fmt_period(p):
    # "2026-10#2" -> "Oct 2026 · week 2"
    try:
        ym, wk = p.split("#")
        y, m = ym.split("-")
        mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][int(m) - 1]
        return f"{mon} {y} · week {wk}"
    except Exception:  # noqa: BLE001
        return p


def classify(group):
    """Mark every photo after the first one as a reuse and say what kind."""
    photos = group["photos"]
    first = photos[0]
    out = []
    for idx, p in enumerate(photos):
        if idx == 0:
            out.append((p, "original", ""))
            continue
        earlier = photos[:idx]
        if any(e["period"] != p["period"] for e in earlier):
            src = next(e for e in earlier if e["period"] != p["period"])
            kind = "old"
            note = f"Same picture as {fmt_period(src['period'])} ({src['task']})"
        else:
            kind = "twice"
            note = f"Same picture also used for “{first['task']}” ({first['project'].upper()})"
        out.append((p, kind, note))
    return out


def main():
    data = json.load(open(sys.argv[1], encoding="utf8"))
    groups = data["groups"]
    rows = []  # (photo, kind, note, group_index)
    for gi, g in enumerate(groups):
        for p, kind, note in classify(g):
            rows.append((p, kind, note, gi))
    reused = [r for r in rows if r[1] != "original"]
    old = [r for r in reused if r[1] == "old"]
    twice = [r for r in reused if r[1] == "twice"]

    seen_path = sys.argv[3] if len(sys.argv) > 3 else ""
    seen = {}
    if seen_path and os.path.exists(seen_path):
        seen = json.load(open(seen_path, encoding="utf8"))
    first_run = not seen
    today = datetime.date.today().isoformat()
    new_ids = set() if first_run else {p["id"] for p, *_ in reused if p["id"] not in seen}
    last_check = max(seen.values()) if seen else ""

    by_user = defaultdict(Counter)
    for p, kind, _, _ in reused:
        by_user[p["by"]][kind] += 1
        if p["id"] in new_ids:
            by_user[p["by"]]["new"] += 1
    by_month = Counter(p["period"].split("#")[0] for p, *_ in reused)
    by_proj = Counter(p["project"].upper() for p, *_ in reused)

    def stat(n, label, tone=""):
        return f'<div class="stat {tone}"><b>{n}</b><span>{label}</span></div>'

    user_rows = "".join(
        f"<tr><td>{esc(u)}</td><td class=n>{c['old']}</td><td class=n>{c['twice']}</td>"
        f"<td class=n><b>{c['old'] + c['twice']}</b></td>"
        f"<td class=n>{'<b class=newn>' + str(c['new']) + '</b>' if c['new'] else '0'}</td></tr>"
        for u, c in sorted(by_user.items(), key=lambda x: -sum(x[1].values()))
    )
    month_rows = "".join(f"<tr><td>{esc(m)}</td><td class=n>{n}</td></tr>" for m, n in sorted(by_month.items()))
    proj_rows = "".join(f"<tr><td>{esc(p)}</td><td class=n>{n}</td></tr>" for p, n in by_proj.most_common())

    cards = []
    order = sorted(range(len(groups)), key=lambda gi: (
        0 if any(p["id"] in new_ids for p in groups[gi]["photos"]) else 1,
        0 if any(k == "old" for _, k, _ in classify(groups[gi])) else 1, -len(groups[gi]["photos"])))
    for gi in order:
        g = groups[gi]
        cl = classify(g)
        has_old = any(k == "old" for _, k, _ in cl)
        tag = '<span class="tag old">Reused from an older week</span>' if has_old else \
              '<span class="tag twice">Same photo for two tasks</span>'
        match = "Identical file" if g["exactCopy"] else (
            "Same picture (re-saved by phone)" if g["maxDistance"] == 0 else
            f"Near-identical shot (difference {g['maxDistance']}) – please check")
        tiles = []
        for p, kind, note in cl:
            badge = {"original": '<span class="b first">First upload</span>',
                     "old": '<span class="b old">REUSED</span>',
                     "twice": '<span class="b twice">USED TWICE</span>'}[kind]
            if p["id"] in new_ids:
                badge += ' <span class="b new">NEW</span>'
            src = "Gallery" if p["src"] == "g" else "Camera"
            gps = "GPS ✓" if p.get("lat") else "no GPS"
            tiles.append(f"""
      <figure class="{kind}">
        <a href="{esc(p['url'])}" target="_blank" rel="noopener"><img loading="lazy" src="{esc(p['url'])}" alt=""></a>
        <figcaption>
          {badge}
          <div class="task">{esc(p['task'])}</div>
          <div>{esc(p['project'].upper())} · {esc(fmt_period(p['period']))}</div>
          <div>Uploaded {esc(p['createdAt'][:10])} by <b>{esc(p['by'])}</b></div>
          <div class="muted">{src} · {gps}</div>
          {f'<div class="note">{esc(note)}</div>' if note else ''}
        </figcaption>
      </figure>""")
        cards.append(f"""
    <section class="group">
      <header>{tag}<span class="muted">{len(g['photos'])} uploads · {esc(match)}</span></header>
      <div class="tiles">{''.join(tiles)}</div>
    </section>""")

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cleaning Photo Reuse</title>
<style>
:root {{ --bg:#f6f7f9; --card:#fff; --ink:#1d2330; --muted:#6b7385; --line:#e3e6ec;
        --red:#c62828; --redbg:#fdecea; --amber:#a15c00; --amberbg:#fff4e0; --green:#2e7d32; --greenbg:#e8f5e9; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#14171d; --card:#1d2129; --ink:#e8eaf0; --muted:#9aa3b5;
        --line:#2c323d; --redbg:#3a1d1d; --amberbg:#3a2c14; --greenbg:#1b3020; --red:#ff8a80; --amber:#ffc266; --green:#81c784; }} }}
* {{ box-sizing:border-box }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif }}
main {{ max-width:1180px; margin:0 auto; padding:24px 16px 60px }}
h1 {{ margin:0 0 4px; font-size:24px }} h2 {{ font-size:18px; margin:32px 0 12px }}
.muted {{ color:var(--muted) }}
.stats {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin:20px 0 }}
.stat {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px }}
.stat b {{ display:block; font-size:28px }} .stat span {{ color:var(--muted); font-size:13px }}
.stat.red b {{ color:var(--red) }} .stat.amber b {{ color:var(--amber) }}
.tables {{ display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px }}
@media (max-width:760px) {{ .tables {{ grid-template-columns:1fr }} }}
table {{ width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden }}
th,td {{ padding:8px 12px; border-bottom:1px solid var(--line); text-align:left }} th {{ font-size:12px; color:var(--muted); font-weight:600 }}
td.n,th.n {{ text-align:right; font-variant-numeric:tabular-nums }}
.group {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; margin:14px 0 }}
.group header {{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:12px }}
.tag {{ font-weight:600; font-size:13px; padding:3px 10px; border-radius:99px }}
.tag.old {{ background:var(--redbg); color:var(--red) }} .tag.twice {{ background:var(--amberbg); color:var(--amber) }}
.tiles {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px }}
figure {{ margin:0; border:2px solid var(--line); border-radius:10px; overflow:hidden }}
figure.old {{ border-color:var(--red) }} figure.twice {{ border-color:var(--amber) }} figure.original {{ border-color:var(--green) }}
figure img {{ width:100%; aspect-ratio:3/4; object-fit:cover; display:block; background:var(--line) }}
figcaption {{ padding:8px 10px; font-size:13px }} .task {{ font-weight:600; margin:4px 0 2px }}
.b {{ font-size:11px; font-weight:700; padding:2px 8px; border-radius:99px }}
.b.first {{ background:var(--greenbg); color:var(--green) }} .b.old {{ background:var(--redbg); color:var(--red) }}
.b.twice {{ background:var(--amberbg); color:var(--amber) }}
.note {{ margin-top:6px; color:var(--red); font-weight:500 }}
.b.new {{ background:var(--ink); color:var(--bg) }} .newn {{ color:var(--red) }}
.stat.new {{ border:2px solid var(--ink) }}
</style></head><body><main>
<h1>Cleaning photo reuse report</h1>
<div class="muted">Checked {esc(today)}. Scanned {data['scanned']} of {data['total']} cleaning task photos. Every photo was compared with every other photo by how it looks, so a picture still matches after the phone re-saves it.</div>
<div class="stats">
  {stat(len(new_ids), "NEW since last check" + (f" ({esc(last_check)})" if last_check else ""), "new") if not first_run else ""}
  {stat(len(reused), "reused uploads in total", "red")}
  {stat(len(old), "reused from an older week/month", "red")}
  {stat(len(twice), "same photo used for 2 tasks at once", "amber")}
  {stat(len(groups), "different pictures involved")}
</div>
<div class="tables">
  <table><tr><th>Uploaded by</th><th class=n>From older week</th><th class=n>2 tasks at once</th><th class=n>Total</th><th class=n>New</th></tr>{user_rows}</table>
  <table><tr><th>Month</th><th class=n>Reused</th></tr>{month_rows}</table>
  <table><tr><th>Project</th><th class=n>Reused</th></tr>{proj_rows}</table>
</div>
<h2>Every match</h2>
<div class="muted">Green = first time the picture was uploaded. Red = the same picture uploaded again in a later week. Amber = the same picture used as proof for another task in the same week. Click a photo to open it full size.</div>
{''.join(cards)}
</main></body></html>"""
    open(sys.argv[2], "w", encoding="utf8").write(page)
    if seen_path:
        for p, *_ in reused:
            seen.setdefault(p["id"], today)
        json.dump(seen, open(seen_path, "w", encoding="utf8"), indent=1)
    print(f"reused {len(reused)} (older week {len(old)}, two tasks {len(twice)})  NEW {len(new_ids)}")
    for u, c in by_user.items():
        print(" ", u, dict(c))


if __name__ == "__main__":
    main()
