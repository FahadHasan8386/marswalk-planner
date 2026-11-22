
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException
)

from starlette.concurrency import run_in_threadpool

from app.schemas.terrain_ai_models import TerrainAIResponse
from app.services.terrain_ai_service import get_terrain_ai_service


router = APIRouter(
    prefix="/api/terrain-ai",
    tags=["AI Terrain Intelligence"]
)


@router.post(
    "/predict",
    response_model=TerrainAIResponse
)
async def predict_terrain(
    file: UploadFile = File(...)
):
    """
    Run MARSWALK U-Net terrain segmentation
    on an uploaded rover-camera image.
    """

    allowed_types = {
        "image/jpeg",
        "image/jpg",
        "image/png"
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG images are supported."
        )

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    # Limit upload size to 15 MB.
    if len(image_bytes) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image size must not exceed 15 MB."
        )

    try:

        service = get_terrain_ai_service()

        result = await run_in_threadpool(
            service.predict,
            image_bytes
        )

        return result

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    except FileNotFoundError as exc:

        raise HTTPException(
            status_code=503,
            detail=str(exc)
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Terrain AI prediction failed: {str(exc)}"
        )
