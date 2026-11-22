from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from pyproj import CRS


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

DEM_PATH = DATA_DIR / "jezero_dem_cropped.tif"
ORTHO_PATH = DATA_DIR / "jezero_ortho_cropped.tif"

OUTPUT_DIR = DATA_DIR / "processed"

DEM_OUTPUT = OUTPUT_DIR / "jezero_dem_mars_projected.tif"
ORTHO_OUTPUT = OUTPUT_DIR / "jezero_ortho_mars_projected.tif"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not DEM_PATH.exists():
        raise FileNotFoundError(f"DEM not found: {DEM_PATH}")

    if not ORTHO_PATH.exists():
        raise FileNotFoundError(
            f"Orthomosaic not found: {ORTHO_PATH}"
        )

    with rasterio.open(DEM_PATH) as dem, rasterio.open(ORTHO_PATH) as ortho:

        if dem.crs is None or ortho.crs is None:
            raise ValueError("Both rasters must have CRS information.")

        if dem.width != ortho.width or dem.height != ortho.height:
            raise ValueError("Raster dimensions do not match.")

        if not dem.transform.almost_equals(ortho.transform):
            raise ValueError("Raster transforms do not match.")

        dem_crs = CRS.from_user_input(dem.crs)
        ortho_crs = CRS.from_user_input(ortho.crs)
        
        dem_radius = dem_crs.ellipsoid.semi_major_metre
        ortho_radius = ortho_crs.ellipsoid.semi_major_metre
        
        dem_minor_radius = dem_crs.ellipsoid.semi_minor_metre
        ortho_minor_radius = ortho_crs.ellipsoid.semi_minor_metre

        if not np.isclose(dem_radius, ortho_radius, atol=0.01):
            raise ValueError("Mars ellipsoid radii do not match.")
        
        if not np.isclose(dem_radius, ortho_radius, atol=0.01):
            raise ValueError("Mars semi-major radii do not match.")

        if not np.isclose(dem_minor_radius, ortho_minor_radius, atol=0.01):
            raise ValueError("Mars semi-minor radii do not match.")

        if not np.isclose(dem_radius, 3396190, atol=1):
            raise ValueError(
                f"Unexpected Mars radius: {dem_radius}"
            )

        bounds = dem.bounds

        center_lon = (bounds.left + bounds.right) / 2
        center_lat = (bounds.bottom + bounds.top) / 2

        mars_crs = CRS.from_proj4(
            f"+proj=tmerc "
            f"+lat_0={center_lat} "
            f"+lon_0={center_lon} "
            f"+k=1 "
            f"+x_0=0 +y_0=0 "
            f"+a={dem_radius} +b={dem_radius} "
            f"+units=m +no_defs +type=crs"
        )

        dst_transform, dst_width, dst_height = calculate_default_transform(
            dem.crs,
            mars_crs,
            dem.width,
            dem.height,
            *dem.bounds,
            resolution=1.0
        )

        print("Starting Mars raster reprojection...")
        print("Center latitude:", center_lat)
        print("Center longitude:", center_lon)
        print("Mars radius:", dem_radius)
        print("Output dimensions:", dst_width, dst_height)

        dem_nodata = -9999.0

        dem_profile = dem.profile.copy()

        dem_profile.update(
            driver="GTiff",
            crs=mars_crs,
            transform=dst_transform,
            width=dst_width,
            height=dst_height,
            dtype="float32",
            count=1,
            nodata=dem_nodata,
            compress="lzw"
        )

        with rasterio.open(DEM_OUTPUT, "w", **dem_profile) as dst:
            reproject(
                source=rasterio.band(dem, 1),
                destination=rasterio.band(dst, 1),
                src_transform=dem.transform,
                src_crs=dem.crs,
                src_nodata=dem.nodata,
                dst_transform=dst_transform,
                dst_crs=mars_crs,
                dst_nodata=dem_nodata,
                resampling=Resampling.bilinear
            )

        ortho_profile = ortho.profile.copy()

        ortho_profile.update(
            driver="GTiff",
            crs=mars_crs,
            transform=dst_transform,
            width=dst_width,
            height=dst_height,
            dtype="uint8",
            count=1,
            compress="lzw"
        )

        with rasterio.open(ORTHO_OUTPUT, "w", **ortho_profile) as dst:
            reproject(
                source=rasterio.band(ortho, 1),
                destination=rasterio.band(dst, 1),
                src_transform=ortho.transform,
                src_crs=ortho.crs,
                dst_transform=dst_transform,
                dst_crs=mars_crs,
                resampling=Resampling.nearest
            )

    print("\nMars raster reprojection completed!")

    for path in [DEM_OUTPUT, ORTHO_OUTPUT]:
        with rasterio.open(path) as raster:
            print("\nFile:", path)
            print("CRS:", raster.crs)
            print("Dimensions:", raster.width, raster.height)
            print("Resolution:", raster.res)

    print("\nOriginal files remain unchanged.")


if __name__ == "__main__":
    main()