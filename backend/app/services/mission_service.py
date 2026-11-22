from uuid import uuid4

from app.schemas.pydantic_models import (
    MissionRequest,
    MissionResponse,
    RouteComparisonResponse,
    GeminiExplanationRequest,
)
from app.services.routing_service import get_routing_service
from app.services.rover_energy_service import rover_energy_service
from app.services.gemini_analysis_service import get_gemini_analysis_service


class MissionService:
    """
    Coordinates rover mission planning, energy simulation, and AI analysis.
    """

    def __init__(self):
        self.routing_service = get_routing_service()
        self.gemini_service = get_gemini_analysis_service()

    def plan_mission(
        self,
        request: MissionRequest
    ) -> MissionResponse:
        """
        Create a mission, calculate route metrics, run round-trip energy simulation,
        and generate a human-readable Gemini mission safety briefing.
        """

        mission_id = str(uuid4())

        # 1. Plan route via A* routing service
        route = self.routing_service.plan_route(
            request
        )

        mission_status = (
            "completed"
            if route.status == "success"
            else "failed"
        )

        gemini_explanation_text = None

        if mission_status == "completed":
            # Extract full path segments for energy calculations
            start = self.routing_service.raster.coordinate_to_pixel(
                request.start.latitude,
                request.start.longitude,
            )
            destination = self.routing_service.raster.coordinate_to_pixel(
                request.destination.latitude,
                request.destination.longitude,
            )
            
            full_path = self.routing_service._find_path(
                start=start,
                destination=destination,
                route_mode=request.route_mode,
                max_slope=float(request.max_slope_deg),
            )

            outbound_segments = self.routing_service._extract_segments(full_path)
            return_path = list(reversed(full_path))
            return_segments = self.routing_service._extract_segments(return_path)

            rover_specs = {
                "battery_capacity_wh": request.battery_capacity_wh,
                "average_speed_mps": request.rover_speed_mps,
                "flat_power_w": 150.0,
                "rover_mass_kg": 300.0,
                "reserve_percent": request.reserve_percent,
                "max_slope_deg": request.max_slope_deg,
                "rolling_resistance_coefficient": 0.02,
                "drivetrain_efficiency": 0.75,
            }

            # 2. Run Mission Engine Energy Calculations
            energy_analysis = rover_energy_service.calculate_mission(
                outbound_segments=outbound_segments,
                return_segments=return_segments,
                rover_specs=rover_specs,
            )

            # Sync up route response flags with energy findings
            route.estimated_remaining_battery_wh = energy_analysis["round_trip"]["remaining_battery_wh"]
            route.battery_reserve_satisfied = energy_analysis["checks"]["battery_sufficient"]

            # 3. Generate Human-Readable Gemini Safety & Feasibility Explanation
            gemini_req = GeminiExplanationRequest(
                route_mode=request.route_mode,
                route_metrics=route.metrics,
                terrain_summary=energy_analysis.get("recommendation_reason")
            )

            gemini_resp = self.gemini_service.generate_explanation(
                gemini_req,
                energy_analysis=energy_analysis
            )
            gemini_explanation_text = gemini_resp.explanation

        return MissionResponse(
            mission_id=mission_id,
            status=mission_status,
            start=request.start,
            destination=request.destination,
            route=route,
            gemini_explanation=gemini_explanation_text
        )

    def compare_routes(
        self,
        request: MissionRequest
    ) -> RouteComparisonResponse:
        """
        Calculate shortest and safest routes and
        recommend one based on route feasibility.
        """

        shortest_request = request.model_copy(
            update={
                "route_mode": "shortest"
            }
        )

        safest_request = request.model_copy(
            update={
                "route_mode": "safest"
            }
        )

        shortest_route = self.routing_service.plan_route(
            shortest_request
        )

        safest_route = self.routing_service.plan_route(
            safest_request
        )

        shortest_available = (
            shortest_route.status == "success"
        )

        safest_available = (
            safest_route.status == "success"
        )

        recommended_route = None
        recommendation_reason = None

        if not shortest_available and not safest_available:

            recommendation_reason = (
                "Neither route could be generated. "
                "Check the selected coordinates, terrain "
                "constraints and DEM coverage."
            )

        elif safest_available and (
            safest_route.battery_reserve_satisfied
        ):

            recommended_route = "safest"

            recommendation_reason = (
                "The safest route is traversable and "
                "satisfies the requested battery reserve."
            )

        elif shortest_available and (
            shortest_route.battery_reserve_satisfied
        ):

            recommended_route = "shortest"

            if safest_available:
                recommendation_reason = (
                    "The safest route does not satisfy the "
                    "battery reserve, while the shortest "
                    "route does."
                )
            else:
                recommendation_reason = (
                    "Only the shortest route satisfies "
                    "the requested battery reserve."
                )

        elif safest_available:

            recommended_route = "safest"

            recommendation_reason = (
                "The safest route is available, but its "
                "estimated remaining battery is below "
                "the requested reserve."
            )

        elif shortest_available:

            recommended_route = "shortest"

            recommendation_reason = (
                "Only the shortest route could be generated. "
                "Its battery reserve should be reviewed."
            )

        return RouteComparisonResponse(
            shortest_route=shortest_route,
            safest_route=safest_route,
            recommended_route=recommended_route,
            recommendation_reason=recommendation_reason
        )


_mission_service = None


def get_mission_service():
    global _mission_service

    if _mission_service is None:
        _mission_service = MissionService()

    return _mission_service