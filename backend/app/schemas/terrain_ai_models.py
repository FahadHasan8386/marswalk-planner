
from pydantic import BaseModel
from typing import List, Dict, Any


class TerrainAIClassResult(BaseModel):
    class_id: int
    class_name: str
    pixel_count: int
    percentage: float
    mean_confidence: float


class TerrainAIResponse(BaseModel):
    success: bool
    model_name: str
    device: str

    input_image: Dict[str, int]
    output_image: Dict[str, int]

    overall_mean_confidence: float

    classes: List[TerrainAIClassResult]

    segmentation_base64: str
    overlay_base64: str
    mask_indices_base64: str

    class_colors: Dict[str, List[int]]

    scientific_note: str
