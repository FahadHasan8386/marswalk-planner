
from fastapi import APIRouter, HTTPException

from app.schemas.pydantic_models import (
    MissionRequest,
    MissionResponse,
    RouteResponse,
    RouteComparisonResponse,
    TerrainAnalysisRequest,
    TerrainAnalysisResponse,
    GeminiExplanationRequest,
    GeminiExplanationResponse,
)

from app.services.terrain_service import get_terrain_service
from app.services.routing_service import get_routing_service
from app.services.mission_service import get_mission_service
from app.services.gemini_analysis_service import (
    get_gemini_analysis_service,
)


router = APIRouter()


# --------------------------------------------------
# TERRAIN ANALYSIS
# --------------------------------------------------

@router.post(
    "/terrain/analyze",
    response_model=TerrainAnalysisResponse,
    tags=["Terrain"],
)
def analyze_terrain(request: TerrainAnalysisRequest):

    try:
        terrain_service = get_terrain_service()

        result = terrain_service.analyze_coordinate(
            request.location.latitude,
            request.location.longitude,
        )

        return TerrainAnalysisResponse(
            elevation_m=result.get("elevation_m"),
            slope_deg=result.get("slope_deg"),
            roughness_m=result.get("roughness_m"),
            terrain_class=result.get("terrain_class", "unknown"),
            is_traversable=result.get("traversable", False),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Terrain analysis failed: {str(error)}",
        )


# --------------------------------------------------
# ROUTE PLANNING
# --------------------------------------------------

@router.post(
    "/routes/plan",
    response_model=RouteResponse,
    tags=["Routing"],
)
def plan_route(request: MissionRequest):

    try:
        routing_service = get_routing_service()

        return routing_service.plan_route(request)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Route planning failed: {str(error)}",
        )


# --------------------------------------------------
# ROUTE COMPARISON
# --------------------------------------------------

@router.post(
    "/routes/compare",
    response_model=RouteComparisonResponse,
    tags=["Routing"],
)
def compare_routes(request: MissionRequest):

    try:
        mission_service = get_mission_service()

        return mission_service.compare_routes(request)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Route comparison failed: {str(error)}",
        )


# --------------------------------------------------
# COMPLETE MISSION PLANNING
# --------------------------------------------------

@router.post(
    "/missions/plan",
    response_model=MissionResponse,
    tags=["Mission"],
)
def plan_mission(request: MissionRequest):

    try:
        mission_service = get_mission_service()

        return mission_service.plan_mission(request)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Mission planning failed: {str(error)}",
        )


# --------------------------------------------------
# GEMINI AI MISSION EXPLANATION
# --------------------------------------------------

@router.post(
    "/gemini/explain",
    response_model=GeminiExplanationResponse,
    tags=["AI Analysis"],
)
def explain_mission(request: GeminiExplanationRequest):

    try:
        gemini_service = get_gemini_analysis_service()

        return gemini_service.generate_explanation(request)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini explanation failed: {str(error)}",
        )
