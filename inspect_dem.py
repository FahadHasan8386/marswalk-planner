import sys
import rasterio

with rasterio.open(sys.argv[1]) as d:
    print("size (w x h):", d.width, d.height)
    print("bounds:", d.bounds)
    print("pixel size:", d.transform.a, d.transform.e)
    print("nodata:", d.nodata, "| dtype:", d.dtypes[0])
    a = d.read(1, masked=True)
    print("elevation min / max / mean:", a.min(), a.max(), a.mean())
    print("CRS:")
    print(d.crs.to_wkt() if d.crs else "none")
