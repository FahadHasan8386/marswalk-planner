
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image


# =====================================================
# 1. DEFINE PROJECT PATHS
# =====================================================

# This script is located inside the backend directory
BASE_DIR = Path(__file__).resolve().parent

# Input GeoTIFF file
TIFF_PATH = BASE_DIR / "data" / "jezero_ortho_cropped.tif"

# Output PNG file inside frontend/public
OUTPUT_PATH = (
    BASE_DIR.parent
    / "frontend"
    / "public"
    / "jezero_ortho.png"
)


# =====================================================
# 2. CHECK INPUT FILE
# =====================================================

print("=" * 55)
print("MARSWALK GEOTIFF TO PNG CONVERTER")
print("=" * 55)

print(f"\nInput:  {TIFF_PATH}")
print(f"Output: {OUTPUT_PATH}")

if not TIFF_PATH.exists():
    raise FileNotFoundError(
        f"\nGeoTIFF file not found: {TIFF_PATH}\n"
        "Please check backend/data/ directory."
    )


# =====================================================
# 3. LOAD GEOTIFF
# =====================================================

print("\nLoading GeoTIFF...")

with rasterio.open(TIFF_PATH) as src:

    print(f"Width:       {src.width}")
    print(f"Height:      {src.height}")
    print(f"Bands:       {src.count}")
    print(f"Data type:   {src.dtypes}")
    print(f"CRS:         {src.crs}")

    # Read raster bands
    if src.count >= 3:
        image_array = src.read([1, 2, 3])
        image_array = np.moveaxis(image_array, 0, -1)

    else:
        image_array = src.read(1)


# =====================================================
# 4. NORMALIZE IMAGE VALUES
# =====================================================

print("\nNormalizing image...")

def normalize_band(band):

    band = band.astype(np.float32)

    valid = np.isfinite(band)

    if not np.any(valid):
        return np.zeros(band.shape, dtype=np.uint8)

    low, high = np.percentile(
        band[valid],
        [2, 98]
    )

    if high <= low:
        return np.zeros(band.shape, dtype=np.uint8)

    normalized = np.zeros(
        band.shape,
        dtype=np.uint8
    )

    scaled = (
        (band[valid] - low)
        / (high - low)
        * 255
    )

    normalized[valid] = np.clip(
        scaled, 0, 255
    ).astype(np.uint8)

    return normalized


if image_array.ndim == 2:

    # Single-band grayscale image
    png_array = normalize_band(image_array)

else:

    # Three-band RGB image
    png_array = np.stack(
        [
            normalize_band(image_array[:, :, i])
            for i in range(3)
        ],
        axis=-1
    )


# =====================================================
# 5. SAVE PNG
# =====================================================

print("\nSaving PNG...")

OUTPUT_PATH.parent.mkdir(
    parents=True,
    exist_ok=True
)

if png_array.ndim == 2:
    output_image = Image.fromarray(
        png_array,
        mode="L"
    )
else:
    output_image = Image.fromarray(
        png_array,
        mode="RGB"
    )

output_image.save(
    OUTPUT_PATH,
    format="PNG",
    optimize=True
)


# =====================================================
# 6. VERIFY OUTPUT
# =====================================================

if OUTPUT_PATH.exists():

    print("\n" + "=" * 55)
    print("CONVERSION SUCCESSFUL!")
    print("=" * 55)

    print(f"PNG location: {OUTPUT_PATH}")
    print(f"Image size:   {output_image.size}")
    print(f"Image mode:   {output_image.mode}")
    print(
        f"File size:    "
        f"{OUTPUT_PATH.stat().st_size / (1024 * 1024):.2f} MB"
    )

else:

    raise RuntimeError("PNG conversion failed!")
