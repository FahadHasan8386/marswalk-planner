
from fastapi import APIRouter, HTTPException

from app.schemas.rover_models import (
    RoverEnergyRequest,
    RoverEnergyResponse,
    RoverMissionRequest,
    RoverMissionResponse,
    RoverRouteComparisonResponse,
)

from app.services.rover_energy_service import (
    rover_energy_service,
)

from app.services.rover_mission_service import (
    rover_mission_service,
)

from app.services.rover_route_comparison_service import (
    rover_route_comparison_service,
)


router = APIRouter(
    prefix="/api/rover",
    tags=["Rover Mission Intelligence"],
)


# --------------------------------------------------
# SINGLE ROVER MISSION PLANNING
# --------------------------------------------------

@router.post(
    "/mission/plan",
    response_model=RoverMissionResponse,
)
async def plan_rover_mission(
    request: RoverMissionRequest,
):
    """
    Plan one rover mission with outbound and return routes.

    Returns mission feasibility and energy information.
    """

    try:

        return rover_mission_service.plan_mission(
            request
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# --------------------------------------------------
# MULTI-STRATEGY ROUTE COMPARISON
# --------------------------------------------------

@router.post(
    "/routes/compare",
    response_model=RoverRouteComparisonResponse,
)
async def compare_rover_routes(
    request: RoverMissionRequest,
):
    """
    Compare four rover navigation strategies:

        1. Shortest
        2. Safest
        3. Energy efficient
        4. Balanced

    Each candidate receives independent outbound and
    return route calculations.

    The rover energy service evaluates each round trip.

    The backend selects the best feasible candidate.
    """

    try:

        return rover_route_comparison_service.compare_routes(
            request
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Route comparison failed: "
                f"{str(exc)}"
            ),
        )


# --------------------------------------------------
# STANDALONE ROVER ENERGY CALCULATION
# --------------------------------------------------

@router.post(
    "/energy",
    response_model=RoverEnergyResponse,
)
async def calculate_rover_energy(
    request: RoverEnergyRequest,
):
    """
    Calculate rover energy consumption independently.
    """

    try:

        return rover_energy_service.calculate_energy(
            request
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# --------------------------------------------------
# ENERGY SERVICE HEALTH
# --------------------------------------------------

@router.get("/energy/health")
async def rover_energy_health():
    """
    Check whether the rover energy service is available.
    """

    return {
        "status": "healthy",
        "service": "rover_energy_service",
        "message": "Rover energy calculation service is available.",
    }
