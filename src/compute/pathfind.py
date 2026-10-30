"""Least-cost path over the DEM (Dijkstra, 8-connected grid)."""
import heapq
import math

import numpy as np

from . import astronaut

NEIGHBOURS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def least_cost_path(dem, start_xy, end_xy, params=None, max_side=220):
    """Return list of (x, y) metres, or None if no path respects the slope limit.

    Edge cost = slope_distance * (1 + k * (slope / limit)^2); edges steeper than the
    limit are blocked. Works on a downsampled grid so it stays fast on a laptop.
    """
    p = params or astronaut.values()
    g = dem.downsample(max_side)
    limit, k = p["slope_limit_deg"], p["slope_penalty_k"]
    z, px = g.z, g.pixel_m

    def to_rc(xy):
        c = int(round(min(max(xy[0] / px, 0), g.w - 1)))
        r = int(round(min(max((g.height_m - xy[1]) / px, 0), g.h - 1)))
        return r, c

    s, t = to_rc(start_xy), to_rc(end_xy)
    dist = np.full(z.shape, np.inf)
    prev = {}
    dist[s] = 0.0
    heap = [(0.0, s)]
    while heap:
        cost, (r, c) = heapq.heappop(heap)
        if (r, c) == t:
            break
        if cost > dist[r, c]:
            continue
        for dr, dc in NEIGHBOURS:
            nr, nc = r + dr, c + dc
            if not (0 <= nr < g.h and 0 <= nc < g.w):
                continue
            run = px * math.hypot(dr, dc)
            dz = z[nr, nc] - z[r, c]
            slope = math.degrees(math.atan2(abs(dz), run))
            if slope > limit:
                continue
            step = math.hypot(run, dz) * (1 + k * (slope / limit) ** 2)
            nxt = cost + step
            if nxt < dist[nr, nc]:
                dist[nr, nc] = nxt
                prev[(nr, nc)] = (r, c)
                heapq.heappush(heap, (nxt, (nr, nc)))
    if not np.isfinite(dist[t]):
        return None
    path, node = [t], t
    while node != s:
        node = prev[node]
        path.append(node)
    path.reverse()
    xy = [(c * px, g.height_m - r * px) for r, c in path]
    xy[0], xy[-1] = tuple(start_xy), tuple(end_xy)
    return xy
