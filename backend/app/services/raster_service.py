
from functools import lru_cache
from pathlib import Path
import warnings

import numpy as np
import rasterio
from pyproj import CRS, Transformer

from app.core.config import settings


class RasterService:
    def __init__(self):
        self.dem_dataset = None
        self.ortho_dataset = None

        self.dem = None
        self.ortho = None

        self.crs_warning = None

        self._load_rasters()

    def _load_rasters(self):
        dem_path = Path(settings.DEM_PATH)
        ortho_path = Path(settings.ORTHO_PATH)

        if not dem_path.exists():
            raise FileNotFoundError(
                f"DEM file not found: {dem_path}"
            )

        self.dem_dataset = rasterio.open(dem_path)

        if self.dem_dataset.crs is None:
            raise ValueError(
                "DEM has no coordinate reference system."
            )

        self.dem = self.dem_dataset.read(
            1,
            masked=True
        ).astype(np.float64)

        if ortho_path.exists():
            self.ortho_dataset = rasterio.open(ortho_path)

            if self.ortho_dataset.crs is None:
                raise ValueError(
                    "Orthomosaic has no coordinate reference system."
                )

            self._validate_alignment()

            self.ortho = self.ortho_dataset.read(
                1,
                masked=True
            ) #Reading elevation values

    def _validate_alignment(self):
        dem = self.dem_dataset
        ortho = self.ortho_dataset

        if dem.width != ortho.width:
            raise ValueError(
                "DEM and orthomosaic widths do not match."
            )

        if dem.height != ortho.height:
            raise ValueError(
                "DEM and orthomosaic heights do not match."
            )

        if not dem.transform.almost_equals(ortho.transform):
            raise ValueError(
                "DEM and orthomosaic pixel grids do not match."
            )

        dem_bounds = dem.bounds
        ortho_bounds = ortho.bounds

        bounds_match = np.allclose(
            [
                dem_bounds.left,
                dem_bounds.bottom,
                dem_bounds.right,
                dem_bounds.top
            ],
            [
                ortho_bounds.left,
                ortho_bounds.bottom,
                ortho_bounds.right,
                ortho_bounds.top
            ],
            rtol=0,
            atol=1e-9
        )

        if not bounds_match:
            raise ValueError(
                "DEM and orthomosaic bounds do not match."
            )

        if dem.crs != ortho.crs:
            self.crs_warning = (
                "DEM and orthomosaic CRS identifiers differ, "
                "but their pixel grids and bounds match."
            )

            warnings.warn(
                self.crs_warning,
                RuntimeWarning
            )

    @property
    def shape(self):
        return self.dem.shape

    @property
    def crs(self):
        return self.dem_dataset.crs

    def get_raster_info(self):
        return {
            "width": self.dem_dataset.width,
            "height": self.dem_dataset.height,
            "crs": str(self.dem_dataset.crs),
            "orthomosaic_crs": (
                str(self.ortho_dataset.crs)
                if self.ortho_dataset is not None
                else None
            ),
            "bounds": list(self.dem_dataset.bounds),
            "resolution": list(self.dem_dataset.res),
            "nodata": self.dem_dataset.nodata,
            "orthomosaic_available": (
                self.ortho_dataset is not None
            ),
            "same_pixel_grid": (
                self.ortho_dataset is not None
            ),
            "crs_warning": self.crs_warning
        }

    def _get_geographic_crs(self):
        """
        Get the geographic CRS associated with the Mars
        projected CRS using PyProj.
        """

        projected_crs = CRS.from_user_input(
            self.dem_dataset.crs
        )

        if projected_crs.is_geographic:
            return projected_crs

        geographic_crs = projected_crs.geodetic_crs

        if geographic_crs is None:
            raise ValueError(
                "Could not identify the geographic CRS "
                "associated with the Mars DEM."
            )

        return geographic_crs

    def coordinate_to_pixel(self, latitude, longitude):
        try:
            projected_crs = CRS.from_user_input(
                self.dem_dataset.crs
            )

            geographic_crs = self._get_geographic_crs()

            if projected_crs.is_geographic:
                x = float(longitude)
                y = float(latitude)

            else:
                transformer = Transformer.from_crs(
                    geographic_crs,
                    projected_crs,
                    always_xy=True
                )

                x, y = transformer.transform(
                    float(longitude),
                    float(latitude)
                )

            row, col = self.dem_dataset.index(x, y)

            if (
                row < 0
                or col < 0
                or row >= self.dem_dataset.height
                or col >= self.dem_dataset.width
            ):
                raise ValueError(
                    "Coordinate is outside the DEM coverage."
                )

            return int(row), int(col)

        except Exception as exc:
            raise ValueError(
                f"Could not convert Mars coordinate to raster pixel: {exc}"
            ) from exc

    def pixel_to_coordinate(self, row, col):
        if (
            row < 0
            or col < 0
            or row >= self.dem_dataset.height
            or col >= self.dem_dataset.width
        ):
            raise ValueError(
                "Pixel is outside the DEM."
            )

        x, y = self.dem_dataset.xy(row, col)

        projected_crs = CRS.from_user_input(
            self.dem_dataset.crs
        )

        geographic_crs = self._get_geographic_crs()

        if projected_crs.is_geographic:
            longitude = x
            latitude = y

        else:
            transformer = Transformer.from_crs(
                projected_crs,
                geographic_crs,
                always_xy=True
            )

            longitude, latitude = transformer.transform(
                x,
                y
            )

        return float(latitude), float(longitude)

    def elevation(self, row, col):
        if (
            row < 0
            or col < 0
            or row >= self.dem.shape[0]
            or col >= self.dem.shape[1]
        ):
            raise ValueError(
                "Pixel is outside the DEM."
            )

        value = self.dem[row, col]

        if np.ma.is_masked(value) or not np.isfinite(value):
            raise ValueError(
                "DEM pixel contains NoData."
            )

        return float(value)

    def get_metric_pixel_size(self):
        crs = self.dem_dataset.crs

        if not crs.is_projected:
            raise ValueError(
                "DEM CRS must be projected before "
                "calculating physical distances or slopes."
            )

        units = crs.linear_units

        if units is None or units.lower() not in (
            "metre",
            "meter",
            "metres",
            "meters"
        ):
            raise ValueError(
                f"DEM CRS units are not metres: {units}"
            )

        transform_matrix = self.dem_dataset.transform

        pixel_width = abs(float(transform_matrix.a))
        pixel_height = abs(float(transform_matrix.e))

        if pixel_width <= 0 or pixel_height <= 0:
            raise ValueError(
                "Invalid raster pixel resolution."
            )

        return pixel_width, pixel_height

    def close(self):
        if self.dem_dataset is not None:
            self.dem_dataset.close()
            self.dem_dataset = None

        if self.ortho_dataset is not None:
            self.ortho_dataset.close()
            self.ortho_dataset = None


@lru_cache(maxsize=1)
def get_raster_service():
    return RasterService()
