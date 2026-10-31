"""Clip a square area out of the big Jezero DEM so the app stays fast.

Example (default = Jezero delta, 12 km box):
    python scripts/clip_dem.py cache/mars/raw/M20_JezeroCrater_CTXDEM_20m.tif cache/mars/jezero_dem.tif
    python scripts/clip_dem.py SRC DST --lon 77.40 --lat 18.45 --size-km 12
"""
import argparse
import math
import os
import sys

import rasterio
from rasterio.windows import Window

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src.compute.dem import equirect_params, lonlat_to_xy_proj  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--lon", type=float, default=77.40, help="centre longitude (deg E)")
ap.add_argument("--lat", type=float, default=18.45, help="centre latitude (deg N)")
ap.add_argument("--size-km", type=float, default=12.0)
a = ap.parse_args()

with rasterio.open(a.src) as ds:
    radius, std_par, lon0 = equirect_params(ds.crs.to_wkt())
    cx, cy = lonlat_to_xy_proj(a.lon, a.lat, radius, std_par, lon0)
    px = abs(ds.transform.a)
    n = int(round(a.size_km * 1000 / px))
    col = int(round((cx - ds.transform.c) / px)) - n // 2
    row = int(round((ds.transform.f - cy) / px)) - n // 2
    col0, row0 = max(col, 0), max(row, 0)
    w = min(n, ds.width - col0)
    h = min(n, ds.height - row0)
    if w <= 0 or h <= 0:
        sys.exit("Requested area is outside the DEM.")
    win = Window(col0, row0, w, h)
    data = ds.read(1, window=win)
    profile = ds.profile
    profile.update(width=w, height=h, transform=ds.window_transform(win), compress="deflate")
    os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
    with rasterio.open(a.dst, "w", **profile) as out:
        out.write(data, 1)

print(f"Wrote {a.dst}: {w} x {h} px = {w * px / 1000:.1f} x {h * px / 1000:.1f} km at {px:g} m/px")
