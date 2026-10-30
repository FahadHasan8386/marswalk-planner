"""DEM access. Uses a real GeoTIFF if present, otherwise a synthetic demo terrain.

Coordinates: the planner works in local metres (x east, y north) measured from the
lower-left corner of the DEM. Lon/lat <-> metres uses a small-area equirectangular
approximation over the DEM bounding box (fine for a ~10 km EVA scale).
"""
import math
import os
import re

import numpy as np

MARS_RADIUS_M = 3396190.0  # radius used by Mars Trek products
DEFAULT_TIF = os.path.join("cache", "mars", "jezero_dem.tif")


class DEM:
    def __init__(self, z, pixel_m, bbox, source, std_parallel_deg=None, radius_m=MARS_RADIUS_M):
        self.z = np.asarray(z, dtype=float)  # row 0 = north edge
        self.pixel_m = float(pixel_m)
        self.bbox = tuple(bbox)  # lon_min, lat_min, lon_max, lat_max
        self.source = source
        self.std_parallel_deg = std_parallel_deg
        self.radius_m = radius_m
        self.h, self.w = self.z.shape
        # For an equirectangular product, metres per degree of longitude is set by the
        # product's standard parallel (not the tile centre). Fall back to the centre latitude.
        ref_lat = std_parallel_deg if std_parallel_deg is not None else (bbox[1] + bbox[3]) / 2
        self.m_per_deg_lat = math.pi * radius_m / 180.0
        self.m_per_deg_lon = self.m_per_deg_lat * math.cos(math.radians(ref_lat))

    @property
    def width_m(self):
        return (self.w - 1) * self.pixel_m

    @property
    def height_m(self):
        return (self.h - 1) * self.pixel_m

    def lonlat_to_xy(self, lon, lat):
        x = (lon - self.bbox[0]) * self.m_per_deg_lon
        y = (lat - self.bbox[1]) * self.m_per_deg_lat
        return x, y

    def xy_to_lonlat(self, x, y):
        return (self.bbox[0] + x / self.m_per_deg_lon,
                self.bbox[1] + y / self.m_per_deg_lat)

    def elevation_at(self, x, y):
        """Bilinear elevation at metre coordinates (scalars or arrays)."""
        col = np.clip(np.asarray(x) / self.pixel_m, 0, self.w - 1.000001)
        row = np.clip((self.height_m - np.asarray(y)) / self.pixel_m, 0, self.h - 1.000001)
        r0, c0 = np.floor(row).astype(int), np.floor(col).astype(int)
        fr, fc = row - r0, col - c0
        z = self.z
        return (z[r0, c0] * (1 - fr) * (1 - fc) + z[r0, c0 + 1] * (1 - fr) * fc
                + z[r0 + 1, c0] * fr * (1 - fc) + z[r0 + 1, c0 + 1] * fr * fc)

    def slope_deg_grid(self):
        gy, gx = np.gradient(self.z, self.pixel_m)
        return np.degrees(np.arctan(np.hypot(gx, gy)))

    def downsample(self, max_side=220):
        f = max(1, int(math.ceil(max(self.h, self.w) / max_side)))
        if f == 1:
            return self
        z = self.z[: self.h // f * f, : self.w // f * f]
        z = z.reshape(self.h // f, f, self.w // f, f).mean(axis=(1, 3))
        return DEM(z, self.pixel_m * f, self.bbox, self.source + f" (x{f} downsampled)",
                   self.std_parallel_deg, self.radius_m)


def synthetic_dem(size=400, pixel_m=15.0):
    """Demo terrain: gentle plain, a steep scarp ('delta front') and a crater-like hill."""
    bbox = (77.30, 18.40, 77.40, 18.50)
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    z = -2600 + 0.004 * xx * pixel_m * 0.1
    scarp = 1 / (1 + np.exp(-(xx - size * 0.55) / 3.0))
    taper = np.clip((size * 0.80 - yy) / (size * 0.15), 0, 1)  # scarp fades out smoothly to the south
    z = z + 95 * scarp * taper
    z += 60 * np.exp(-(((xx - size * 0.25) ** 2 + (yy - size * 0.3) ** 2) / (2 * 30.0 ** 2)))
    rng = np.random.default_rng(7)
    z += rng.normal(0, 0.15, z.shape)
    return DEM(z, pixel_m, bbox, "SYNTHETIC demo terrain (not NASA data)")


def equirect_params(wkt):
    """Read (radius_m, standard_parallel_deg, central_meridian_deg) from an Equirectangular WKT."""
    def num(pattern):
        m = re.search(pattern, wkt)
        return float(m.group(1)) if m else None
    radius = num(r'SPHEROID\["[^"]*",([0-9.]+)') or MARS_RADIUS_M
    return radius, num(r'"standard_parallel_1",([-0-9.]+)') or 0.0, num(r'"central_meridian",([-0-9.]+)') or 0.0


def xy_to_lonlat_proj(x, y, radius, std_par, lon0):
    lon = lon0 + math.degrees(x / (radius * math.cos(math.radians(std_par))))
    return lon, math.degrees(y / radius)


def lonlat_to_xy_proj(lon, lat, radius, std_par, lon0):
    return (radius * math.cos(math.radians(std_par)) * math.radians(lon - lon0),
            radius * math.radians(lat))


def load_dem(tif=DEFAULT_TIF):
    """Load a real GeoTIFF DEM (equirectangular, metres) or fall back to synthetic terrain."""
    if not os.path.exists(tif):
        return synthetic_dem()
    import rasterio  # imported lazily so tests run without GDAL
    with rasterio.open(tif) as ds:
        z = ds.read(1).astype(float)
        if ds.nodata is not None:
            z[z == ds.nodata] = np.nan
        z[z < -1e6] = np.nan
        if np.isnan(z).any():
            z = np.where(np.isnan(z), np.nanmean(z), z)
        if abs(abs(ds.transform.a) - abs(ds.transform.e)) > 1e-6:
            raise ValueError("Non-square pixels are not supported")
        pixel_m = abs(ds.transform.a)
        radius, std_par, lon0 = equirect_params(ds.crs.to_wkt())
        b = ds.bounds
    lon_min, lat_min = xy_to_lonlat_proj(b.left, b.bottom, radius, std_par, lon0)
    lon_max, lat_max = xy_to_lonlat_proj(b.right, b.top, radius, std_par, lon0)
    return DEM(z, pixel_m, (lon_min, lat_min, lon_max, lat_max), f"GeoTIFF {os.path.basename(tif)}",
               std_parallel_deg=std_par, radius_m=radius)
