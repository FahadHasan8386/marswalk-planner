
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class Coordinate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class RasterPixel(BaseModel):
    """
    Pixel position in the processed Mars raster.

    x = column index
    y = row index
    """

    x: float
    y: float


class MissionRequest(BaseModel):
    start: Coordinate
    destination: Coordinate

    route_mode: Literal["shortest", "safest"] = "safest"

    max_slope_deg: float = Field(default=25.0, gt=0, le=90)

    battery_capacity_wh: float = Field(default=7200.0, gt=0)
    reserve_percent: float = Field(default=20.0, ge=0, lt=100)

    rover_speed_mps: float = Field(default=0.05, gt=0)

    @model_validator(mode="after")
    def validate_coordinates(self):
        if (
            self.start.latitude == self.destination.latitude
            and self.start.longitude == self.destination.longitude
        ):
            raise ValueError("Start and destination must be different.")

        return self


class TerrainAnalysisRequest(BaseModel):
    location: Coordinate
    radius_m: float = Field(default=50.0, gt=0, le=5000)


class TerrainAnalysisResponse(BaseModel):
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    roughness_m: Optional[float] = None

    terrain_class: str
    is_traversable: bool


class RouteMetrics(BaseModel):
    distance_m: float

    mean_slope_deg: float
    max_slope_deg: float

    ascent_m: float
    descent_m: float

    estimated_energy_wh: float
    estimated_travel_time_seconds: float

    steep_segments: int = 0
    total_segments: int = 0


class RouteResponse(BaseModel):
    status: Literal["success", "failed"]

    route_mode: str

    # Geographic coordinates: [latitude, longitude] represented
    # as Coordinate objects.
    route_coordinates: list[Coordinate] = Field(default_factory=list)

    # Raster coordinates: [x, y] represented as RasterPixel objects.
    # These are used to draw the route on the Jezero orthomosaic.
    route_pixels: list[RasterPixel] = Field(default_factory=list)

    metrics: Optional[RouteMetrics] = None

    estimated_remaining_battery_wh: Optional[float] = None
    battery_reserve_satisfied: Optional[bool] = None

    message: Optional[str] = None


class RouteComparisonResponse(BaseModel):
    shortest_route: Optional[RouteResponse] = None
    safest_route: Optional[RouteResponse] = None

    recommended_route: Optional[str] = None
    recommendation_reason: Optional[str] = None


class MissionResponse(BaseModel):
    mission_id: str
    status: str

    start: Coordinate
    destination: Coordinate

    route: RouteResponse

    gemini_explanation: Optional[str] = None


class GeminiExplanationRequest(BaseModel):
    route_metrics: RouteMetrics
    route_mode: str

    terrain_summary: Optional[str] = None


class GeminiExplanationResponse(BaseModel):
    explanation: str


class HealthResponse(BaseModel):
    status: str
    app_name: str

    dem_available: bool
    ortho_available: bool
