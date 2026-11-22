import json
from pathlib import Path
import rasterio

# Paths relative to backend root
dem_path = Path("data/jezero_dem_cropped.tif")
ortho_path = Path("data/jezero_ortho_cropped.tif")
manifest_path = Path("data/dataset_manifest.json")

manifest = {}

# Inspect DEM
if dem_path.exists():
    with rasterio.open(dem_path) as src:
        manifest["dem"] = {
            "filename": dem_path.name,
            "width": src.width,
            "height": src.height,
            "count": src.count,
            "crs": str(src.crs),
            "bounds": {
                "left": src.bounds.left,
                "bottom": src.bounds.bottom,
                "right": src.bounds.right,
                "top": src.bounds.top,
            },
            "resolution": src.res,
            "nodata": src.nodata,
            "dtype": str(src.dtypes[0]),
        }
else:
    print(f"Warning: {dem_path} not found.")

# Inspect Orthoimage
if ortho_path.exists():
    with rasterio.open(ortho_path) as src:
        manifest["ortho"] = {
            "filename": ortho_path.name,
            "width": src.width,
            "height": src.height,
            "crs": str(src.crs),
            "bounds": {
                "left": src.bounds.left,
                "bottom": src.bounds.bottom,
                "right": src.bounds.right,
                "top": src.bounds.top,
            },
            "resolution": src.res,
        }
else:
    print(f"Warning: {ortho_path} not found.")

# Write to dataset_manifest.json
with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=4)

print(f"Successfully generated manifest at: {manifest_path}")