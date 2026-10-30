# Data download notes

This file records exactly which data the project uses, where it came from, and where to put it.
It is committed to git. The data files themselves are not (`cache/` is in `.gitignore`).

## Where the files go

```
marswalk-planner/
  cache/
    mars/
      jezero_dem.tif        <- DEM (required)
      dem_bbox.json         <- lon/lat bounds of the DEM (create after inspecting the file)
      raw/                  <- optional: original downloads and .xml metadata files
```

`cache/mars/jezero_dem.tif` is the path the code loads (`src/compute/dem.py`).

## Downloaded so far

### 1. DEM (topography), downloaded 2026-10-30

| Field | Value |
|---|---|
| Original file name | `M20_JezeroCrater_CTXDEM_20m.tif` |
| Saved as | `cache/mars/jezero_dem.tif` |
| Size | 86.2 MB |
| What it is | Mars 2020 Science Investigation CTX DEM, about 20 m per pixel, Jezero crater |
| Provider | USGS Astrogeology Science Center (Astropedia), NASA Planetary Data System |
| Product page | https://astrogeology.usgs.gov/search/map/mars-2020-jezero-crater-landing-site-products |
| File listing used | https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/index.html |
| Folder in listing | `ScienceInvestigationMaps_JPL/` |

Status of the details below: **not yet verified**, fill in after running `inspect_dem.py`:

- Projection: file names in the same listing contain `Eqc_latTs0_lon0` (equirectangular, standard parallel 0). Confirm for this file.
- Bounds (lon/lat): TODO
- Pixel size: TODO
- Elevation range (m): TODO
- Product ID / PDS identifier / citation text: TODO (from the `.xml` metadata file)

### 2. Metadata file (download next)

- `M20_JezeroCrater_CTXDEM_20m.xml`, same folder as the DEM. Save it in `cache/mars/raw/`.
  It holds the official description, projection and citation details.

### 3. Optical imagery (not downloaded yet)

- `M20_JezeroCrater_CTXortho_mosaic_5m.tif` (+ `.xml`), same folder. Check the file size before downloading.
- If it is too large, the app falls back to a hillshaded relief made from the DEM.

## Not needed

Individual `rect*` CTX image tiles, the per-pair `DTM_..._F05X/J03X/J21_J22X` tiles, and the `.jpg` browse files.
Note: the 9.3 MB "Download" button next to the thumbnail on the Astropedia page is only a JPG preview, not data.

## Third data layer (needed for the "3 kinds of data" goal)

TODO: thermal (THEMIS) or spectral (CRISM) from NASA Mars Trek. Record name, ID and date here.

## Credits

Data: NASA / JPL / USGS Astrogeology Science Center, archived by the NASA Planetary Data System (PDS).
NASA Mars Trek (https://trek.nasa.gov/mars) for browsing and additional layers.
Copy the exact citation text from each product's `.xml` metadata into `DATA_SOURCES.md`.
