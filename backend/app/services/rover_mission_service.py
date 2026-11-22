
from app.schemas.rover_models import (
    RoverMissionRequest,
    RoverMissionResponse,
    RoverEnergyResponse,
)

from app.services.routing_service import get_routing_service
from app.services.rover_energy_service import rover_energy_service


class RoverMissionService:
    """
    Integrates route planning and rover energy calculations.

    Calculates outbound and return routes independently,
    then evaluates the complete round-trip mission.
    """

    def __init__(self):
        self.routing_service = get_routing_service()
        self.energy_service = rover_energy_service

    def plan_mission(
        self,
        request: RoverMissionRequest,
    ) -> RoverMissionResponse:

        # --------------------------------------------------
        # 1. READ MISSION CONFIGURATION
        # --------------------------------------------------

        start_pixel = request.start_pixel
        destination_pixel = request.destination_pixel

        algorithm = request.algorithm
        route_mode = request.route_mode

        rover_specs = request.rover.model_dump()

        max_slope = request.rover.max_slope_deg

        # --------------------------------------------------
        # 2. CALCULATE OUTBOUND ROUTE
        # --------------------------------------------------

        outbound_result = self.routing_service.plan_route_full(
            start_pixel=start_pixel,
            destination_pixel=destination_pixel,
            algorithm=algorithm,
            route_mode=route_mode,
            max_slope=max_slope,
        )

        if outbound_result.get("status") != "success":
            return RoverMissionResponse(
                status="failed",
                algorithm=algorithm,
                route_mode=route_mode,
                message="Could not calculate a valid outbound route.",
            )

        # --------------------------------------------------
        # 3. CALCULATE RETURN ROUTE INDEPENDENTLY
        # --------------------------------------------------

        return_result = self.routing_service.plan_route_full(
            start_pixel=destination_pixel,
            destination_pixel=start_pixel,
            algorithm=algorithm,
            route_mode=route_mode,
            max_slope=max_slope,
        )

        if return_result.get("status") != "success":
            return RoverMissionResponse(
                status="failed",
                algorithm=algorithm,
                route_mode=route_mode,
                outbound_route_pixels=outbound_result["route_pixels"],
                outbound_nodes_explored=outbound_result["nodes_explored"],
                outbound_distance_m=outbound_result["distance_m"],
                message=(
                    "Outbound route was found, but a valid return route "
                    "could not be calculated. Mission cannot be approved."
                ),
            )

        # --------------------------------------------------
        # 4. GET FULL-RESOLUTION ROUTE SEGMENTS
        # --------------------------------------------------

        outbound_segments = outbound_result["segments"]
        return_segments = return_result["segments"]

        # --------------------------------------------------
        # 5. CALCULATE ROUND-TRIP ENERGY
        # --------------------------------------------------

        energy_result = self.energy_service.calculate_mission(
            outbound_segments=outbound_segments,
            return_segments=return_segments,
            rover_specs=rover_specs,
        )

        # Validate the energy result against the response schema.
        energy_response = RoverEnergyResponse.model_validate(
            energy_result
        )

        # --------------------------------------------------
        # 6. BUILD COMPLETE MISSION RESPONSE
        # --------------------------------------------------

        total_nodes_explored = (
            outbound_result["nodes_explored"]
            + return_result["nodes_explored"]
        )

        response = RoverMissionResponse(
            status="success",

            algorithm=algorithm,
            route_mode=route_mode,

            outbound_route_pixels=outbound_result["route_pixels"],
            return_route_pixels=return_result["route_pixels"],

            outbound_nodes_explored=outbound_result["nodes_explored"],
            return_nodes_explored=return_result["nodes_explored"],
            total_nodes_explored=total_nodes_explored,

            outbound_distance_m=outbound_result["distance_m"],
            return_distance_m=return_result["distance_m"],

            energy=energy_response,

            message=(
                "Outbound and return routes calculated successfully. "
                "Round-trip rover energy analysis completed."
            ),
        )

        return response


rover_mission_service = RoverMissionService()
