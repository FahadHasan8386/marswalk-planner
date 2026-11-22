
import numpy as np
from scipy.ndimage import sobel, generic_filter

from app.core.config import settings
from app.services.raster_service import get_raster_service


class TerrainService:
    """
    Calculates terrain properties from the projected Mars DEM.

    Elevation: metres
    Slope: degrees
    Roughness: local elevation standard deviation in metres
    """

    def __init__(self):
        self.raster = get_raster_service()

        self.dem = self.raster.dem
        self.pixel_width, self.pixel_height = (
            self.raster.get_metric_pixel_size()
        ) # retrives physical pixel Dimension

        self.max_slope_deg = float(
            settings.DEFAULT_MAX_SLOPE_DEG
        )

        self._valid_mask = (
            ~np.ma.getmaskarray(self.dem)
            & np.isfinite(np.asarray(self.dem.filled(np.nan)))
        )

        self.elevation_data = np.asarray(
            self.dem.filled(np.nan),
            dtype=np.float64
        ) #This converts the DEM into a NumPy array of 64-bit floating-point values

        self.slope_map = None
        self.roughness_map = None

        self._calculate_terrain_maps()

    def _calculate_terrain_maps(self):
        """
        Calculate slope and roughness maps for the entire DEM.
        """

        safe_dem = np.where(
            self._valid_mask,
            self.elevation_data,
            0.0
        ) #Creates a temporary DEM in which invalid pixels are replaced with zero for the Sobel calculation.

        dz_drow = sobel(
            safe_dem,
            axis=0,
            mode="nearest"
        ) / (8.0 * self.pixel_height)

        dz_dcol = sobel(
            safe_dem,
            axis=1,
            mode="nearest"
        ) / (8.0 * self.pixel_width)

        gradient = np.sqrt(
            dz_drow ** 2 + dz_dcol ** 2
        )

        self.slope_map = np.degrees(
            np.arctan(gradient)
        )

        self.slope_map[~self._valid_mask] = np.nan

        def local_std(values):
            valid = values[np.isfinite(values)]

            if valid.size < 5:
                return np.nan

            return float(np.std(valid))

        self.roughness_map = generic_filter(
            self.elevation_data,
            function=local_std,
            size=3,
            mode="nearest"
        )

        self.roughness_map[~self._valid_mask] = np.nan

    def _validate_pixel(self, row, col):
        if (
            row < 0
            or col < 0
            or row >= self.dem.shape[0]
            or col >= self.dem.shape[1]
        ):
            raise ValueError(
                "Requested pixel is outside the DEM."
            )

        if not self._valid_mask[row, col]:
            raise ValueError(
                "Requested pixel contains NoData."
            )

    def classify_terrain(self, slope, roughness):
        """
        Classify terrain using slope and local roughness.

        These are prototype rover-traversability categories,
        not official NASA terrain classifications.
        """

        if slope >= 25:
            return "steep"

        if slope >= 15 or roughness >= 1.0:
            return "difficult"

        if slope >= 8 or roughness >= 0.5:
            return "moderate"

        if slope >= 3 or roughness >= 0.15:
            return "rough"

        return "smooth"

    def analyze_pixel(self, row, col):
        """
        Analyze terrain at a raster pixel.
        """

        row = int(row)
        col = int(col)

        self._validate_pixel(row, col)

        elevation = float(
            self.elevation_data[row, col]
        )

        slope = float(
            self.slope_map[row, col]
        )

        roughness = float(
            self.roughness_map[row, col]
        )

        if not np.isfinite(slope):
            raise ValueError(
                "Slope could not be calculated at this pixel."
            )

        if not np.isfinite(roughness):
            raise ValueError(
                "Roughness could not be calculated at this pixel."
            )

        terrain_class = self.classify_terrain(
            slope,
            roughness
        )

        latitude, longitude = (
            self.raster.pixel_to_coordinate(row, col)
        )

        return {
            "row": row,
            "col": col,
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": elevation,
            "slope_deg": slope,
            "roughness_m": roughness,
            "terrain_class": terrain_class,
            "traversable": bool(
                slope <= self.max_slope_deg
            )
        }

    def analyze_coordinate(self, latitude, longitude):
        """
        Convert Mars latitude/longitude to a pixel
        and analyze its terrain.
        """

        row, col = self.raster.coordinate_to_pixel(
            latitude,
            longitude
        )

        return self.analyze_pixel(row, col)

    def get_slope_map(self):
        return self.slope_map

    def get_roughness_map(self):
        return self.roughness_map

    def get_elevation_range(self):
        valid_values = self.elevation_data[
            self._valid_mask
        ]

        if valid_values.size == 0:
            raise ValueError("DEM contains no valid elevation data.")

        return {
            "minimum_m": float(np.min(valid_values)),
            "maximum_m": float(np.max(valid_values)),
            "mean_m": float(np.mean(valid_values))
        }

    def get_terrain_statistics(self):
        valid_slopes = self.slope_map[
            np.isfinite(self.slope_map)
        ]

        valid_roughness = self.roughness_map[
            np.isfinite(self.roughness_map)
        ]

        if valid_slopes.size == 0:
            raise ValueError("No valid slope values available.")

        if valid_roughness.size == 0:
            raise ValueError("No valid roughness values available.")

        return {
            "elevation": self.get_elevation_range(),
            "slope": {
                "minimum_deg": float(np.min(valid_slopes)),
                "maximum_deg": float(np.max(valid_slopes)),
                "mean_deg": float(np.mean(valid_slopes))
            },
            "roughness": {
                "minimum_m": float(np.min(valid_roughness)),
                "maximum_m": float(np.max(valid_roughness)),
                "mean_m": float(np.mean(valid_roughness))
            },
            "valid_pixel_count": int(
                np.count_nonzero(self._valid_mask)
            ),
            "total_pixel_count": int(self.dem.size)
        }


_terrain_service = None


def get_terrain_service():
    global _terrain_service

    if _terrain_service is None:
        _terrain_service = TerrainService()

    return _terrain_service
