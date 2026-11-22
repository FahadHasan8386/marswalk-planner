
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.pydantic_models import RasterPixel


# --------------------------------------------------
# SHARED ROUTE STRATEGIES
# --------------------------------------------------

RouteStrategy = Literal[
    "shortest",
    "safest",
    "energy_efficient",
    "balanced",
]


# --------------------------------------------------
# ROVER CONFIGURATION
# --------------------------------------------------

class RoverSpecifications(BaseModel):
    battery_capacity_wh: float = Field(..., gt=0)
    average_speed_mps: float = Field(..., gt=0)
    flat_power_w: float = Field(..., gt=0)
    rover_mass_kg: float = Field(..., gt=0)

    reserve_percent: float = Field(default=20.0, ge=0, lt=100)
    max_slope_deg: float = Field(default=25.0, gt=0, le=90)

    rolling_resistance_coefficient: float = Field(
        default=0.02,
        ge=0,
    )

    drivetrain_efficiency: float = Field(
        default=0.75,
        gt=0,
        le=1,
    )


# --------------------------------------------------
# ROUTE SEGMENTS
# --------------------------------------------------

class RouteSegment(BaseModel):
    distance_m: float = Field(..., ge=0)
    elevation_change_m: float = Field(default=0.0)
    slope_deg: float = Field(default=0.0, ge=0, le=90)


# --------------------------------------------------
# ROVER ENERGY REQUEST
# --------------------------------------------------

class RoverEnergyRequest(BaseModel):
    rover: RoverSpecifications

    outbound_segments: list[RouteSegment] = Field(
        ...,
        min_length=1,
    )

    return_segments: list[RouteSegment] = Field(
        ...,
        min_length=1,
    )


# --------------------------------------------------
# COMPLETE ROVER MISSION REQUEST
# --------------------------------------------------

class RoverMissionRequest(BaseModel):
    start_pixel: RasterPixel
    destination_pixel: RasterPixel

    algorithm: Literal["astar", "dijkstra"] = "astar"

    route_mode: RouteStrategy = "balanced"

    rover: RoverSpecifications


# --------------------------------------------------
# ENERGY RESPONSE: ONE LEG
# --------------------------------------------------

class RoverLegEnergyResponse(BaseModel):
    distance_m: float
    travel_time_seconds: float

    base_energy_wh: float
    uphill_energy_wh: float
    rolling_adjustment_wh: float

    total_energy_wh: float

    maximum_slope_deg: float
    slope_violation_count: int


# --------------------------------------------------
# ENERGY RESPONSE: ROUND TRIP
# --------------------------------------------------

class RoundTripEnergyResponse(BaseModel):
    total_distance_m: float

    total_time_seconds: float
    total_time_hours: float

    total_energy_wh: float

    usable_energy_wh: float
    reserve_energy_wh: float

    remaining_battery_wh: float
    remaining_battery_percent: float


# --------------------------------------------------
# MISSION FEASIBILITY CHECKS
# --------------------------------------------------

class MissionFeasibilityChecks(BaseModel):
    battery_sufficient: bool
    slope_sufficient: bool

    slope_violation_count: int

    required_reserve_percent: float


# --------------------------------------------------
# COMPLETE ENERGY RESPONSE
# --------------------------------------------------

class RoverEnergyResponse(BaseModel):
    status: Literal["success"]

    mission_feasible: bool

    recommendation: Literal["GO", "NO-GO"]
    recommendation_reason: str

    rover_specifications: RoverSpecifications

    outbound: RoverLegEnergyResponse

    return_leg: RoverLegEnergyResponse = Field(alias="return")

    round_trip: RoundTripEnergyResponse

    checks: MissionFeasibilityChecks

    model_assumptions: list[str]

    model_config = ConfigDict(populate_by_name=True)


# --------------------------------------------------
# COMPLETE ROVER MISSION RESPONSE
# --------------------------------------------------

class RoverMissionResponse(BaseModel):
    status: Literal["success", "failed"]

    algorithm: Literal["astar", "dijkstra"] = "astar"

    route_mode: RouteStrategy = "balanced"

    outbound_route_pixels: list[RasterPixel] = Field(
        default_factory=list,
    )

    return_route_pixels: list[RasterPixel] = Field(
        default_factory=list,
    )

    outbound_nodes_explored: int = 0
    return_nodes_explored: int = 0
    total_nodes_explored: int = 0

    outbound_distance_m: float | None = None
    return_distance_m: float | None = None

    energy: RoverEnergyResponse | None = None

    message: str | None = None


# --------------------------------------------------
# MULTI-ROUTE COMPARISON: ONE CANDIDATE
# --------------------------------------------------

class RoverRouteCandidate(BaseModel):
    route_id: str

    strategy: RouteStrategy

    status: Literal["success", "failed"]

    algorithm: Literal["astar", "dijkstra"]

    outbound_route_pixels: list[RasterPixel] = Field(
        default_factory=list,
    )

    return_route_pixels: list[RasterPixel] = Field(
        default_factory=list,
    )

    outbound_nodes_explored: int = 0
    return_nodes_explored: int = 0
    total_nodes_explored: int = 0

    outbound_distance_m: float | None = None
    return_distance_m: float | None = None

    energy: RoverEnergyResponse | None = None

    feasible: bool = False

    selection_score: float | None = None

    selected: bool = False

    reason: str | None = None


# --------------------------------------------------
# MULTI-ROUTE COMPARISON: COMPLETE RESPONSE
# --------------------------------------------------

class RoverRouteComparisonResponse(BaseModel):
    status: Literal["success", "failed"]

    recommendation: Literal["GO", "NO-GO"]

    selected_route_id: str | None = None

    recommended_strategy: RouteStrategy | Literal["none"] = "none"

    recommendation_reason: str

    max_allowed_slope_deg: float

    candidates: list[RoverRouteCandidate] = Field(
        default_factory=list,
    )

    successful_candidates: int = 0
    feasible_candidates: int = 0

    message: str | None = None
