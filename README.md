# Marswalk Planner

A layered traverse and survival planner for a human Mars EVA, built on NASA data.
Draw a route on the terrain of Jezero crater; the tool computes distance, slope profile,
climb, time and metabolic energy, rejects routes that exceed the suit slope limit
(saying which segment and by how much), and proposes a least-cost contingency route.

> Status: working skeleton. It runs on a synthetic demo terrain until the real HiRISE DEM
> is placed in `cache/mars/` (see "Using real NASA data").

## Run

```bash
pip install -r requirements.txt
python -m pytest            # unit tests (synthetic ramp of known gradient)
uvicorn server.app:app --reload
# open http://localhost:8000
```

## How it works

```
browser (MapLibre + Chart.js)  <-- JSON -->  FastAPI  -->  src/compute/*  -->  cache/mars/jezero_dem.tif
```

- `src/compute/astronaut.py` – every assumption, with a one-line reason. Shown and editable in the UI.
- `src/compute/dem.py` – DEM loading, bilinear sampling, slope grid, downsampling.
- `src/compute/route.py` – polyline sampling, slope, climb, time, energy, pass/fail, failing segments, walk-back check.
- `src/compute/pathfind.py` – Dijkstra over the DEM; cost = slope distance x (1 + k (slope/limit)^2); edges over the limit are blocked.
- `server/app.py` – `/api/analyze`, `/api/contingency`, `/api/meta`, `/api/slope.png`, `/api/relief.png`.

## Model (all derived from the assumptions in `astronaut.py`)

- walked distance = sum of hypotenuses of (horizontal step, elevation change)
- time = distance / walk speed
- energy = metabolic power x time + climb x mass x g / efficiency
- FAIL if any |segment slope| > limit, time > EVA duration, or the route goes beyond the walk-back distance from base

The assumption values (mass, speed, slope limit, metabolic rate, efficiency, EVA length, walk-back distance)
are **placeholders chosen by the authors, not official NASA suit specifications**. Replace them with cited
values and update the `why` field before submission.

## Using real NASA data

1. Download `M20_JezeroCrater_CTXDEM_20m.tif` (Mars 2020 CTX DEM, USGS Astrogeology / PDS) from
   https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/index.html (folder `ScienceInvestigationMaps_JPL/`) into `cache/mars/raw/`.
2. Clip a 12 km area around the Jezero delta (the file is about 89 x 101 km):
   ```bash
   python scripts/clip_dem.py cache/mars/raw/M20_JezeroCrater_CTXDEM_20m.tif cache/mars/jezero_dem.tif
   # other area: --lon 77.40 --lat 18.45 --size-km 12
   ```
3. Start the server. The header badge says "NASA terrain data" when the real DEM is loaded, and "Demo terrain" otherwise.

The projection (equirectangular, standard parallel 18.4663 deg) and bounds are read from the GeoTIFF itself. Details of each download are in `DATA_DOWNLOAD.md`.

The map libraries (MapLibre, Chart.js) are bundled in `web/vendor/`, so the app runs fully offline.

## Limitations

- Lon/lat <-> metres uses a small-area equirectangular approximation (fine at EVA scale).
- Slope accuracy is limited by DEM resolution and by the 20 m route sampling.
- Dijkstra runs on a downsampled grid (<= 220 px per side).
- Energy is a simple metabolic estimate, not a suit life-support model.

## Data and credits

See `DATA_SOURCES.md`. Terrain/imagery: NASA Mars Trek (JPL), HiRISE on Mars Reconnaissance Orbiter,
archived by the NASA Planetary Data System (PDS).

## License

Apache-2.0. Add the full license text as `LICENSE` (GitHub: Add file > Create new file > name it LICENSE > "Choose a license template").
