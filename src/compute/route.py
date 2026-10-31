"""Route cost from terrain: sampling, slope profile, energy, time, limit checks."""
import math

import numpy as np

from . import astronaut


def sample_polyline(dem, pts_xy, spacing_m):
    """Resample a polyline (list of (x, y) metres) at fixed spacing and read elevation."""
    pts = np.asarray(pts_xy, dtype=float)
    seg = np.hypot(*np.diff(pts, axis=0).T)
    cum = np.concatenate([[0], np.cumsum(seg)])
    total = cum[-1]
    d = np.arange(0, total, spacing_m)
    if len(d) == 0 or d[-1] < total:
        d = np.append(d, total)
    x = np.interp(d, cum, pts[:, 0])
    y = np.interp(d, cum, pts[:, 1])
    return d, x, y, dem.elevation_at(x, y)


def route_profile(elevations_m, dists_m, params=None):
    """Compute the traverse metrics from an elevation profile.

    Horizontal step between samples is taken from dists_m; the walked (slope) distance
    is the hypotenuse, so steep routes are slightly longer than their map length.
    """
    p = params or astronaut.values()
    z = np.asarray(elevations_m, float)
    d = np.asarray(dists_m, float)
    dz = np.diff(z)
    dx = np.diff(d)
    slope = np.degrees(np.arctan2(dz, dx))
    seg_len = np.hypot(dx, dz)
    climb = float(dz[dz > 0].sum())
    distance = float(seg_len.sum())
    time_s = distance / p["walk_speed_m_s"]
    energy_j = (p["metabolic_base_w"] * time_s
                + climb * p["total_mass_kg"] * p["gravity_m_s2"] / p["climb_efficiency"])
    limit = p["slope_limit_deg"]
    over = np.abs(slope) > limit
    failing = [{"index": int(i), "start_m": float(d[i]), "end_m": float(d[i + 1]),
                "slope_deg": float(slope[i]),
                "excess_deg": float(abs(slope[i]) - limit)} for i in np.where(over)[0]]
    time_h = time_s / 3600
    budget_h = p["eva_duration_h"]
    return {
        "distance_m": distance,
        "map_distance_m": float(dx.sum()),
        "total_climb_m": climb,
        "max_slope_deg": float(np.abs(slope).max()) if len(slope) else 0.0,
        "time_hours": float(time_h),
        "energy_wh": float(energy_j / 3600),
        "eva_fraction": float(time_h / budget_h),
        "within_eva_time": bool(time_h <= budget_h),
        "passes_slope_limit": bool(not over.any()),
        "passes": bool(not over.any() and time_h <= budget_h),
        "failing_segments": failing,
        "profile": [{"dist_m": float(d[i]), "elev_m": float(z[i]),
                     "slope_deg": float(slope[i - 1]) if i > 0 else 0.0}
                    for i in range(len(z))],
        "assumptions": p,
    }


def analyze_xy(dem, pts_xy, spacing_m=20.0, params=None):
    d, x, y, z = sample_polyline(dem, pts_xy, spacing_m)
    out = route_profile(z, d, params)
    out["path_xy"] = [[float(a), float(b)] for a, b in zip(x, y)]
    return out


def walk_back_ok(dem, pts_xy, base_xy, params=None):
    """True if every point on the route is within the walk-back limit of the base."""
    p = params or astronaut.values()
    pts = np.asarray(pts_xy, float)
    dist = np.hypot(pts[:, 0] - base_xy[0], pts[:, 1] - base_xy[1])
    return bool(dist.max() <= p["max_return_distance_m"]), float(dist.max())
