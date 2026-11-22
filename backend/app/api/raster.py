
from fastapi import APIRouter, HTTPException, Query

from app.services.raster_service import get_raster_service
from app.services.terrain_service import get_terrain_service


router = APIRouter()


@router.get("/info", tags=["Raster"])
def get_raster_info():
    """Return metadata about the loaded Mars rasters."""

    try:
        raster_service = get_raster_service()
        return raster_service.get_raster_info()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve raster information: {str(error)}",
        )


@router.get("/elevation", tags=["Raster"])
def get_elevation(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    """Return elevation at a geographic coordinate."""

    try:
        terrain_service = get_terrain_service()

        result = terrain_service.analyze_coordinate(
            latitude,
            longitude,
        )

        return {
            "latitude": result["latitude"],
            "longitude": result["longitude"],
            "elevation_m": result["elevation_m"],
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Elevation lookup failed: {str(error)}",
        )


@router.get("/terrain", tags=["Raster"])
def get_terrain_at_coordinate(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    """Return terrain properties at a geographic coordinate."""

    try:
        terrain_service = get_terrain_service()

        return terrain_service.analyze_coordinate(
            latitude,
            longitude,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Terrain lookup failed: {str(error)}",
        )
