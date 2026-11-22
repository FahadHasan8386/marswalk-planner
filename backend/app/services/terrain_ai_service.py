
import base64
import io
import json
from pathlib import Path

import numpy as np
import torch

from PIL import Image

from app.services.terrain_ai_model import UNet


# --------------------------------------------------
# MODEL CONFIGURATION
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[2]

MODEL_DIR = BACKEND_DIR / "model_artifacts" / "terrain_ai"

WEIGHTS_PATH = MODEL_DIR / "marswalk_unet.pth"
CONFIG_PATH = MODEL_DIR / "config.json"

CLASS_NAMES = {
    0: "Soil",
    1: "Bedrock",
    2: "Sand",
    3: "Big Rock"
}

CLASS_COLORS = {
    0: (216, 179, 101),  # Soil - golden
    1: (91, 141, 184),   # Bedrock - blue
    2: (46, 157, 114),   # Sand - green
    3: (217, 83, 79),    # Big Rock - red
}


class TerrainAIService:

    def __init__(self):

        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        if not WEIGHTS_PATH.exists():
            raise FileNotFoundError(
                f"Model weights not found: {WEIGHTS_PATH}"
            )

        if not CONFIG_PATH.exists():
            raise FileNotFoundError(
                f"Model configuration not found: {CONFIG_PATH}"
            )

        with open(CONFIG_PATH, "r", encoding="utf-8") as file:
            self.config = json.load(file)

        self.image_size = int(
            self.config.get("image_size", 256)
        )

        self.num_classes = int(
            self.config.get("num_classes", 4)
        )

        if self.num_classes != 4:
            raise ValueError(
                "This service expects exactly four terrain classes."
            )

        self.model = UNet(
            num_classes=self.num_classes
        ).to(self.device)

        checkpoint = torch.load(
            WEIGHTS_PATH,
            map_location=self.device,
            weights_only=True
        )

        # Support both a raw state_dict and common checkpoint formats.
        if "model_state_dict" in checkpoint:
            state_dict = checkpoint["model_state_dict"]
        elif "state_dict" in checkpoint:
            state_dict = checkpoint["state_dict"]
        else:
            state_dict = checkpoint

        self.model.load_state_dict(state_dict)
        self.model.eval()

        print(
            f"MARSWALK Terrain AI loaded successfully on {self.device}"
        )

    @staticmethod
    def _encode_png(image):
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

        return base64.b64encode(
            buffer.getvalue()
        ).decode("utf-8")

    def predict(self, image_bytes):

        # ------------------------------------------
        # 1. DECODE AND PREPROCESS IMAGE
        # ------------------------------------------

        try:
            image = Image.open(
                io.BytesIO(image_bytes)
            ).convert("L")

        except Exception as exc:
            raise ValueError(
                "Invalid image. Upload a valid JPG or PNG file."
            ) from exc

        original_width, original_height = image.size

        if original_width < 1 or original_height < 1:
            raise ValueError("Image dimensions are invalid.")

        resized = image.resize(
            (self.image_size, self.image_size),
            Image.Resampling.BILINEAR
        )

        image_array = np.asarray(
            resized,
            dtype=np.float32
        ) / 255.0

        input_tensor = torch.from_numpy(
            image_array
        ).unsqueeze(0).unsqueeze(0).to(self.device)

        # ------------------------------------------
        # 2. MODEL INFERENCE
        # ------------------------------------------

        with torch.inference_mode():

            logits = self.model(input_tensor)

            probabilities = torch.softmax(
                logits,
                dim=1
            )

            prediction = torch.argmax(
                probabilities,
                dim=1
            )

            predicted_mask = (
                prediction[0].cpu().numpy().astype(np.uint8)
            )

            probability_array = (
                probabilities[0].cpu().numpy()
            )

        # ------------------------------------------
        # 3. GENERATE COLOR SEGMENTATION
        # ------------------------------------------

        height, width = predicted_mask.shape

        color_mask = np.zeros(
            (height, width, 3),
            dtype=np.uint8
        )

        for class_id, color in CLASS_COLORS.items():

            color_mask[predicted_mask == class_id] = color

        segmentation_image = Image.fromarray(
            color_mask,
            mode="RGB"
        )

        # ------------------------------------------
        # 4. GENERATE OVERLAY
        # ------------------------------------------

        grayscale_rgb = np.asarray(
            resized.convert("RGB"),
            dtype=np.uint8
        )

        overlay_array = (
            grayscale_rgb.astype(np.float32) * 0.55
            + color_mask.astype(np.float32) * 0.45
        )

        overlay_array = np.clip(
            overlay_array,
            0,
            255
        ).astype(np.uint8)

        overlay_image = Image.fromarray(
            overlay_array,
            mode="RGB"
        )

        # ------------------------------------------
        # 5. CLASS DISTRIBUTION AND CONFIDENCE
        # ------------------------------------------

        total_pixels = predicted_mask.size

        class_results = []

        for class_id, class_name in CLASS_NAMES.items():

            class_pixels = predicted_mask == class_id
            pixel_count = int(class_pixels.sum())

            percentage = (
                pixel_count / total_pixels * 100
                if total_pixels > 0 else 0.0
            )

            if pixel_count > 0:

                class_confidence = float(
                    probability_array[class_id][class_pixels].mean()
                )

            else:
                class_confidence = 0.0

            class_results.append({
                "class_id": class_id,
                "class_name": class_name,
                "pixel_count": pixel_count,
                "percentage": round(percentage, 3),
                "mean_confidence": round(
                    class_confidence, 5
                )
            })

        overall_confidence = float(
            probability_array.max(axis=0).mean()
        )

        # ------------------------------------------
        # 6. RETURN API RESULT
        # ------------------------------------------

        raw_mask_image = Image.fromarray(
            predicted_mask,
            mode="L"
        )

        return {
            "success": True,
            "model_name": self.config.get(
                "model_name",
                "MARSWALK U-Net"
            ),
            "device": str(self.device),
            "input_image": {
                "width": original_width,
                "height": original_height
            },
            "output_image": {
                "width": self.image_size,
                "height": self.image_size
            },
            "overall_mean_confidence": round(
                overall_confidence, 5
            ),
            "classes": class_results,
            "segmentation_base64": self._encode_png(
                segmentation_image
            ),
            "overlay_base64": self._encode_png(
                overlay_image
            ),
            "mask_indices_base64": self._encode_png(
                raw_mask_image
            ),
            "class_colors": {
                str(key): list(value)
                for key, value in CLASS_COLORS.items()
            },
            "scientific_note": (
                "Predictions are based on AI4MARS MSL rover-camera "
                "training data. They are not validated for orbital "
                "Jezero orthomosaic imagery or autonomous safety decisions."
            )
        }


# Lazy singleton: model loads only when first requested.
_terrain_ai_service = None


def get_terrain_ai_service():

    global _terrain_ai_service

    if _terrain_ai_service is None:
        _terrain_ai_service = TerrainAIService()

    return _terrain_ai_service
