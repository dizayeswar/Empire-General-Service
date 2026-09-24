"""Search Personal account filter and classify first-column icon. No Pay."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from nova_search_filter import last_filter_y, search as pa_search

SHOT = Path(__file__).resolve().parent / "logs" / "screenshots"


def first_col_verdict(img: Image.Image, filter_y: int | None = None) -> str:
    rgb = img.convert("RGB")
    y0 = (filter_y + 20) if filter_y is not None else 276
    y1 = y0 + 40
    red = 0
    green = 0
    grey = 0
    for y in range(y0, min(y1, rgb.size[1])):
        for x in range(8, 80):
            r, g, b = rgb.getpixel((x, y))
            if r > 200 and g < 90 and b < 90:
                red += 1
            elif g > 170 and g > r + 25:
                green += 1
            elif abs(r - g) < 18 and abs(g - b) < 18 and 90 < r < 190:
                grey += 1
    print(f"icon pixels red={red} green={green} grey={grey} y={y0}-{y1}")
    if green >= 20 and green > red and green > grey:
        return "green"
    if red >= 12 and red > green:
        return "red_x"
    if grey >= 20 and grey > green:
        return "pending"
    return "other"


def search(apartment: str) -> tuple[str, Path]:
    path = pa_search(apartment)
    y = last_filter_y()
    verdict = first_col_verdict(Image.open(path), filter_y=y)
    print(f"apartment={apartment} verdict={verdict} shot={path}")
    return verdict, path


if __name__ == "__main__":
    search(sys.argv[1] if len(sys.argv) > 1 else "ES-3-17-01")
