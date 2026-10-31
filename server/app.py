"""FastAPI server: local-only. Run:  uvicorn server.app:app --reload"""
import io
import os

import numpy as np
from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel

from src.compute import astronaut, pathfind, route
from src.compute.dem import load_dem

app = FastAPI(title="Mars Marswalk Planner")
DEM = load_dem()


class AnalyzeReq(BaseModel):
    polyline: list[list[float]]          # [[lon, lat], ...]
    spacing_m: float = 20.0
    overrides: dict[str, float] | None = None
    base: list[float] | None = None      # [lon, lat] of lander/base for the walk-back check


class ContingencyReq(BaseModel):
    start: list[float]
    end: list[float]
    spacing_m: float = 20.0
    overrides: dict[str, float] | None = None
    base: list[float] | None = None


def _xy(poly):
    return [DEM.lonlat_to_xy(lo, la) for lo, la in poly]


def _finish(out, params, base):
    out["path_lonlat"] = [list(DEM.xy_to_lonlat(x, y)) for x, y in out.pop("path_xy")]
    if base:
        ok, far = route.walk_back_ok(DEM, _xy([out_pt for out_pt in out["path_lonlat"]]),
                                     DEM.lonlat_to_xy(*base), params)
        out["walk_back"] = {"ok": ok, "max_distance_m": far,
                            "limit_m": params["max_return_distance_m"]}
        out["passes"] = bool(out["passes"] and ok)
    return out


REAL_DATA = not DEM.source.startswith("SYNTHETIC")
if not REAL_DATA:
    print("WARNING: cache/mars/jezero_dem.tif not found - running on SYNTHETIC demo terrain.")


@app.get("/api/meta")
def meta():
    return {"real_data": REAL_DATA, "expected_path": "cache/mars/jezero_dem.tif", "bbox": DEM.bbox, "source": DEM.source, "pixel_m": DEM.pixel_m,
            "size_m": [DEM.width_m, DEM.height_m],
            "assumptions": astronaut.ASTRONAUT}


@app.post("/api/analyze")
def analyze(req: AnalyzeReq):
    params = astronaut.values(req.overrides)
    out = route.analyze_xy(DEM, _xy(req.polyline), req.spacing_m, params)
    return _finish(out, params, req.base)


@app.post("/api/contingency")
def contingency(req: ContingencyReq):
    params = astronaut.values(req.overrides)
    path = pathfind.least_cost_path(DEM, DEM.lonlat_to_xy(*req.start),
                                    DEM.lonlat_to_xy(*req.end), params)
    if path is None:
        return {"found": False, "reason": "No path stays under the slope limit on this terrain."}
    out = route.analyze_xy(DEM, path, req.spacing_m, params)
    out = _finish(out, params, req.base)
    out["found"] = True
    return out


@app.get("/api/slope.png")
def slope_png(limit: float | None = None):
    """Hazard overlay: transparent = fine, yellow = above 70% of the limit, red = over the limit."""
    lim = limit or astronaut.ASTRONAUT["slope_limit_deg"]["value"]
    s = DEM.downsample(900).slope_deg_grid()
    img = np.zeros(s.shape + (4,), np.uint8)
    img[s > 0.7 * lim] = (245, 190, 40, 120)
    img[s > lim] = (225, 50, 40, 175)
    buf = io.BytesIO()
    Image.fromarray(img, "RGBA").save(buf, "PNG")
    return Response(buf.getvalue(), media_type="image/png")


@app.get("/api/relief.png")
def relief_png():
    """Hillshade of the DEM (sun from the north-west) as a neutral grey basemap."""
    g = DEM.downsample(900)
    gy, gx = np.gradient(g.z * 2.0, g.pixel_m)  # 2x vertical exaggeration
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = np.radians(315), np.radians(40)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    lo, hi = np.percentile(shade, [1, 99])
    shade = np.clip((shade - lo) / max(hi - lo, 1e-9), 0, 1)
    img = (60 + shade * 170).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(img, "L").save(buf, "PNG")
    return Response(buf.getvalue(), media_type="image/png")


WEB = os.path.join(os.path.dirname(__file__), "..", "web")
app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
