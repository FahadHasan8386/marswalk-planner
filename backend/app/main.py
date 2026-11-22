
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --------------------------------------------------
# API ROUTER IMPORTS
# --------------------------------------------------

from app.api.routes import router as mission_router
from app.api.raster import router as raster_router
from app.api.rover_routes import router as rover_router
from app.api.terrain_ai_routes import router as terrain_ai_router

# --------------------------------------------------
# SERVICE IMPORTS
# --------------------------------------------------

from app.services.raster_service import get_raster_service


# --------------------------------------------------
# APPLICATION LIFECYCLE
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Mars raster resources at startup."""

    print("Starting MARSWALK backend...")

    try:
        raster_service = get_raster_service()
        raster_info = raster_service.get_raster_info()

        print("Mars raster data loaded successfully.")

        print(
            "DEM dimensions:",
            raster_info.get("width")
        )

        print(
            "DEM height:",
            raster_info.get("height")
        )

        print(
            "Orthomosaic available:",
            raster_info.get("orthomosaic_available", False)
        )

        print("MARSWALK raster initialization complete.")

    except Exception as error:
        print(f"Raster initialization failed: {error}")
        raise

    yield

    print("Shutting down MARSWALK backend...")


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="MARSWALK API",

    description=(
        "Mars terrain intelligence and rover mission planning API. "
        "Provides terrain analysis, route optimization, mission "
        "comparison, rover energy calculations, AI terrain "
        "segmentation and Gemini-powered explanations."
    ),

    version="1.1.0",

    lifespan=lifespan,
)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=False,

    allow_methods=["*"],

    allow_headers=["*"],
)


# --------------------------------------------------
# API ROUTER REGISTRATION
# --------------------------------------------------

# Existing mission planning endpoints
# Example: /api/missions/plan

app.include_router(
    mission_router,
    prefix="/api",
)


# Existing raster endpoints
# Example: /api/raster/info

app.include_router(
    raster_router,
    prefix="/api/raster",
)


# Existing rover intelligence endpoints
# Example: /api/rover/mission/plan
# rover_routes.py already defines its own prefix.

app.include_router(
    rover_router,
)


# NEW: AI Terrain Intelligence endpoints
# Example: POST /api/terrain-ai/predict
# terrain_ai_routes.py already defines /api/terrain-ai.

app.include_router(
    terrain_ai_router,
)


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/", tags=["System"])
def root():

    return {
        "application": "MARSWALK",

        "description": (
            "Mars Rover Terrain Intelligence System"
        ),

        "version": "1.1.0",

        "status": "running",

        "features": [
            "Terrain Analysis",
            "Mission Planning",
            "Rover Route Planning",
            "Rover Route Comparison",
            "Rover Energy Analysis",
            "AI Terrain Segmentation",
            "Gemini Mission Explanation"
        ],

        "documentation": "/docs",

        "health": "/health"
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health", tags=["System"])
def health_check():

    try:

        raster_service = get_raster_service()

        raster_info = raster_service.get_raster_info()

        dem_available = bool(
            raster_info.get(
                "dem_available",

                raster_info.get("width", 0) > 0
                and raster_info.get("height", 0) > 0
            )
        )

        ortho_available = bool(
            raster_info.get(
                "orthomosaic_available",
                False
            )
        )

        return {

            "status": (
                "healthy"
                if dem_available
                else "unhealthy"
            ),

            "app_name": "MARSWALK",

            "dem_available": dem_available,

            "ortho_available": ortho_available,

            "ai_terrain_api_registered": True

        }

    except Exception as error:

        return {

            "status": "unhealthy",

            "app_name": "MARSWALK",

            "dem_available": False,

            "ortho_available": False,

            "error": str(error)

        }
