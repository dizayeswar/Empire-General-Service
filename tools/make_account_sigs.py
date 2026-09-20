"""Crop handwritten photos into transparent e-signature PNGs."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

INK = (18, 42, 132)
MAX_W, MAX_H = 880, 260
PAD = 10

SRC = Path(
    r"C:\Users\Windows dunya\AppData\Roaming\Cursor\User"
    r"\workspaceStorage\7f4a8a3052410a8ee4275a97b0d88ecd\images"
)
OUT = Path(r"c:\Users\Windows dunya\Documents\Empire-General-Service\assets\account-sigs")

JOBS = [
    ("WhatsApp_Image_2026-09-19_at_12.47.23_PM-c5d89783-5941-4b01-83f3-a8cacfea07f0.jpg", "01-sami", "Sami"),
    ("WhatsApp_Image_2026-09-19_at_12.47.40_PM-e4471862-7879-4177-9515-a4a12c4bffe0.jpg", "02-firas", "Firas"),
    ("WhatsApp_Image_2026-09-19_at_12.47.53_PM-0cef59d9-4446-407c-950b-9c43c22e8745.jpg", "03", "Signature 03"),
    ("WhatsApp_Image_2026-09-19_at_12.48.13_PM-61f03eb8-3332-407e-81f6-09eafead37fa.jpg", "04", "Signature 04"),
    ("WhatsApp_Image_2026-09-19_at_12.48.33_PM-7854f2fa-c8f5-425c-aabf-1bde577db34e.jpg", "05", "Signature 05"),
    ("WhatsApp_Image_2026-09-19_at_12.49.10_PM-d97760df-de2a-4c24-ace5-6ad5b67e8c6d.jpg", "06", "Signature 06"),
    ("WhatsApp_Image_2026-09-19_at_12.49.27_PM-452f57a8-1786-40f3-9794-b468d0fdc4a0.jpg", "07", "Signature 07"),
    ("WhatsApp_Image_2026-09-19_at_12.49.44_PM-7967c408-3396-4b9a-b46c-15cc8c3073a7.jpg", "08-dilan", "Dilan"),
    ("WhatsApp_Image_2026-09-19_at_12.49.54_PM-fc8b70ff-d72d-404b-a4bc-c2d08e747596.jpg", "09", "Signature 09"),
    ("WhatsApp_Image_2026-09-19_at_12.50.05_PM-9cbe7126-243a-4405-80e6-60af720929c3.jpg", "10-evan", "Evan"),
    ("WhatsApp_Image_2026-09-19_at_12.50.29_PM-61f85b25-c7c5-4bc4-a947-12a0a67154cd.jpg", "11-ahmad", "Ahmad"),
    ("WhatsApp_Image_2026-09-19_at_12.50.40_PM-2ed4e789-e7dd-4661-9b33-3a10976aa38b.jpg", "12", "Signature 12"),
    ("WhatsApp_Image_2026-09-19_at_12.50.52_PM-1df5052e-386a-40d6-b4e3-6a633d0d9337.jpg", "13-mohammed-jawad", "Mohammed Jawad"),
    ("WhatsApp_Image_2026-09-19_at_12.51.08_PM-4823a61f-e7cc-42bd-bcf9-102a7a10f16f.jpg", "14-elan", "Elan"),
    ("WhatsApp_Image_2026-09-19_at_12.51.21_PM-f6e9f0f0-47c2-4a9d-b820-665dd0dd8678.jpg", "15-awat", "Awat"),
    ("WhatsApp_Image_2026-09-19_at_12.51.37_PM-36dd1639-616b-4d96-a258-a205bea417a0.jpg", "16", "Signature 16"),
    ("WhatsApp_Image_2026-09-19_at_12.53.09_PM-c700d900-ec1c-4d3e-b5d9-61ae414b7798.jpg", "17", "Signature 17"),
    ("WhatsApp_Image_2026-08-20_at_6.01.42_PM-1783c630-30f9-4042-86b1-ae0c1b8fee79.jpg", "18-rawa", "Rawa"),
    ("WhatsApp_Image_2026-08-22_at_4.49.42_PM-b3a18cc6-742b-4233-ab25-7c7941980588.jpg", "19", "Signature 19"),
    ("WhatsApp_Image_2026-09-20_at_2.38.32_PM-e2ccfc4c-5bbd-4704-8782-bfbd56a7b819.jpg", "20", "Signature 20"),
    ("WhatsApp_Image_2026-09-20_at_2.42.24_PM-5fbc7e45-3622-4360-bed3-bfbb566c5c61.jpg", "21", "Signature 21"),
]


def find_src(name: str) -> Path:
    uid = "-".join(Path(name).stem.split("-")[-5:])
    matches = list(SRC.glob(f"*{uid}.*"))
    if not matches:
        raise FileNotFoundError(name)
    return matches[0]


def largest_ink_blobs(mask: np.ndarray, min_frac: float = 0.06, min_area: int = 28) -> np.ndarray:
    h, w = mask.shape
    ys, xs = np.where(mask)
    n = len(xs)
    if n == 0:
        return mask
    if n > 80000:
        return mask
    pts = set(zip(map(int, ys), map(int, xs)))
    seen = set()
    blobs = []
    for p in pts:
        if p in seen:
            continue
        stack = [p]
        blob = []
        seen.add(p)
        while stack:
            y, x = stack.pop()
            blob.append((y, x))
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                q = (y + dy, x + dx)
                if q in pts and q not in seen:
                    seen.add(q)
                    stack.append(q)
        blobs.append(blob)
    scored = []
    for blob in blobs:
        by = sum(p[0] for p in blob) / len(blob)
        bx = sum(p[1] for p in blob) / len(blob)
        edge = by < 0.08 * h or by > 0.92 * h
        scored.append((0 if edge else 1, len(blob), blob, by, bx))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    # Prefer non-edge blobs; fall back to largest if everything sits on an edge.
    chosen = [t for t in scored if t[0] == 1] or scored
    main = chosen[0]
    maxn = main[1]
    my, mx = main[3], main[4]
    out = np.zeros_like(mask)
    for keep_flag, sz, blob, by, bx in scored:
        near = abs(by - my) < 0.32 * h and abs(bx - mx) < 0.48 * w
        if sz >= max(min_area, int(maxn * min_frac)) and (blob is main[2] or near):
            for y, x in blob:
                out[y, x] = True
    return out


def extract(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    max_side = 1400
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        w, h = im.size

    rgb = np.asarray(im).astype(np.float32)
    r, g, bch = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * bch
    hsv = np.asarray(im.convert("HSV"))
    hh = hsv[:, :, 0].astype(np.int16)
    ss = hsv[:, :, 1].astype(np.int16)
    vv = hsv[:, :, 2].astype(np.int16)
    blue_hue = (hh >= 125) & (hh <= 215)

    def bbox_fill(mask: np.ndarray) -> float:
        ys, xs = np.where(mask)
        if len(xs) < 25:
            return 1.0
        return float(len(xs)) / float((int(ys.max()) - int(ys.min()) + 1) * (int(xs.max()) - int(xs.min()) + 1))

    keep = np.zeros((h, w), dtype=bool)
    target_hi = 0.014 * h * w
    for smin in (24, 32, 40, 50, 62, 76, 92, 110):
        cand = blue_hue & (ss >= smin) & (vv >= 22) & (vv <= 212) & (lum < 210) & (bch > r + 5)
        keep = cand
        csum = int(cand.sum())
        if csum > target_hi or bbox_fill(cand) > 0.28:
            continue
        break
    if keep.sum() < 80 or bbox_fill(keep) > 0.28:
        # Last resort: stronger blue chroma only.
        chroma = bch - np.maximum(r, g)
        keep = (chroma > 14) & (ss >= 28) & (lum < 200) & (vv > 20)
        if bbox_fill(keep) > 0.28:
            keep = (chroma > 22) & (ss >= 40) & (lum < 190)

    # Close gaps so thin loops stay attached to the main stroke, then keep
    # only original ink that belongs to those connected blobs.
    closed = np.asarray(Image.fromarray((keep.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(5))) > 0
    keep = keep & largest_ink_blobs(closed, min_frac=0.04, min_area=18)
    if int(keep.sum()) < 40:
        raise RuntimeError(f"no ink in {path.name}")

    strength = np.clip((205.0 - lum) / 90.0, 0, 1) * 0.45 + np.clip(ss / 120.0, 0, 1) * 0.55
    alpha = np.zeros((h, w), dtype=np.float32)
    alpha[keep] = np.clip(np.power(np.maximum(strength[keep], 0.22), 0.62), 0.32, 1.0)

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, 0] = INK[0]
    rgba[:, :, 1] = INK[1]
    rgba[:, :, 2] = INK[2]
    rgba[:, :, 3] = (alpha * 255.0).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    bbox = out.getbbox()
    if not bbox:
        raise RuntimeError(f"empty stamp {path.name}")
    x0, y0, x1, y1 = bbox
    out = out.crop((max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD), min(h, y1 + PAD)))

    cw, ch = out.size
    scale = min(1.0, MAX_W / max(1, cw), MAX_H / max(1, ch))
    if scale < 1:
        out = out.resize(
            (max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))),
            Image.Resampling.LANCZOS,
        )
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i, (fname, slug, label) in enumerate(JOBS, 1):
        src = find_src(fname)
        png_name = f"{slug}.png"
        dest = OUT / png_name
        try:
            img = extract(src)
        except Exception as err:
            print(f"{i:02d} FAIL {label}: {err}")
            continue
        img.save(dest, "PNG", optimize=True)
        size = dest.stat().st_size
        preview_dir = OUT / "preview"
        preview_dir.mkdir(exist_ok=True)
        white = Image.new("RGB", img.size, (255, 255, 255))
        white.paste(img, mask=img.split()[-1])
        white.save(preview_dir / f"{slug}.jpg", "JPEG", quality=92)
        print(f"{i:02d} {label:16s} {img.size[0]}x{img.size[1]}  {size:6d}b  {src.name}")
        manifest.append({
            "id": f"photo-{i:02d}",
            "label": label,
            "file": png_name,
        })
    (OUT / "index.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("wrote", OUT / "index.json")


if __name__ == "__main__":
    main()
